// js/services/ui/UIHangarControl.js
import { AssetService } from '../AssetService.js';
import { GameAttributes } from '../GameAttributes.js';
import { DB } from '../../data/database.js';
import { ACTION_IDS, GAME_RULES } from '../../data/constants.js';
import { calculateInventoryUsed, formatCredits } from '../../utils.js';
import { playBlockingAnimation } from './AnimationService.js'; 

export class UIHangarControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Updates the visual state of the Hangar/Shipyard screen (Carousel & Pagination).
     * @param {object} gameState 
     */
    updateHangarScreen(gameState) {
        const { uiState, player } = gameState;
        const hangarScreenEl = this.manager.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const carousel = hangarScreenEl.querySelector('#hangar-carousel');
        if (!carousel) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        carousel.style.transform = `translateX(-${activeIndex * 100}%)`;

        const SAFE_DISTANCE = 2;
        const pages = carousel.querySelectorAll('.carousel-page');

        pages.forEach((page, index) => {
            const distance = Math.abs(activeIndex - index);
            const img = page.querySelector('img');
            const placeholder = page.querySelector('span'); 

            if (!img) return;

            if (distance > SAFE_DISTANCE) {
                if (img.hasAttribute('src')) {
                    img.removeAttribute('src');
                    img.style.opacity = '0';
                    img.removeAttribute('data-tried-fallback'); 
                    if (placeholder) placeholder.style.display = 'flex';
                }
            } else {
                const shipId = page.dataset.shipId;
                if (shipId) {
                    const newSrc = AssetService.getShipImage(shipId, player.visualSeed);
                    if (!img.hasAttribute('src') || !img.src.includes(newSrc)) {
                        img.src = newSrc;
                        img.onload = () => { img.style.opacity = '1'; };
                        if (placeholder) placeholder.style.display = 'none';
                    }
                }
            }
        });

        this._renderHangarPagination(gameState);
        const paginationWrapper = hangarScreenEl.querySelector('#hangar-pagination-wrapper');
        const activeDot = hangarScreenEl.querySelector('.pagination-dot.active');

        if (paginationWrapper && activeDot) {
            const wrapperWidth = paginationWrapper.clientWidth;
            const dotOffsetLeft = activeDot.offsetLeft;
            const dotWidth = activeDot.offsetWidth;

            const scrollLeft = dotOffsetLeft - (wrapperWidth / 2) + (dotWidth / 2);

            paginationWrapper.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }
    }

    _renderHangarPagination(gameState) {
        const { uiState, player, currentLocationId } = gameState;
        const hangarScreenEl = this.manager.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const paginationContainer = hangarScreenEl.querySelector('#hangar-pagination');
        if (!paginationContainer) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const shipList = isHangarMode ? player.ownedShipIds : this.manager.simulationService._getShipyardInventory().map(([id]) => id);
        const totalItems = shipList.length;

        if (totalItems <= 1) {
             paginationContainer.innerHTML = '';
            return;
        }

        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        let boardedIndex = -1;
        if (isHangarMode) {
            boardedIndex = player.ownedShipIds.indexOf(player.activeShipId);
        }

        const location = DB.MARKETS.find(l => l.id === currentLocationId);
        const theme = location?.navTheme || { borderColor: '#7a9ac0' };

        const VISIBLE_FULL_DOTS = 6;
        let dots = [];

        if (totalItems <= VISIBLE_FULL_DOTS + 1) { 
            for (let i = 0; i < totalItems; i++) {
                 dots.push({ 
                    index: i, 
                    isActive: i === activeIndex, 
                    isHalf: false,
                    isBoarded: i === boardedIndex 
                });
            }
        } else {
            let start, end;
            const isNearStart = activeIndex < VISIBLE_FULL_DOTS - 1;
            const isNearEnd = activeIndex > totalItems - VISIBLE_FULL_DOTS;

            if (isNearStart) {
                start = 0;
                end = VISIBLE_FULL_DOTS;
            } else if (isNearEnd) {
                 start = totalItems - VISIBLE_FULL_DOTS;
                end = totalItems;
            } else {
                start = activeIndex - Math.floor(VISIBLE_FULL_DOTS / 2) + 1;
                end = activeIndex + Math.ceil(VISIBLE_FULL_DOTS / 2);
            }

            if (start > 0) {
                dots.push({ isHalf: true, jump: 'prev' });
            }

            for (let i = start; i < end; i++) {
                dots.push({ 
                    index: i, 
                    isActive: i === activeIndex, 
                    isHalf: false,
                    isBoarded: i === boardedIndex 
                });
            }

            if (end < totalItems) {
                dots.push({ isHalf: true, jump: 'next' });
            }
        }

        const dotsHtml = dots.map(dot => {
             const style = `
                --theme-color-primary: ${theme.borderColor};
                --theme-glow-color: ${theme.borderColor};
            `;
            if (dot.isHalf) {
                 return `<div class="pagination-dot half" style="${style}" data-action="${ACTION_IDS.SET_HANGAR_PAGE}" data-jump-direction="${dot.jump}"></div>`;
            } else {
                const boardedClass = dot.isBoarded ? 'boarded' : '';
                return `<div class="pagination-dot ${dot.isActive ? 'active' : ''} ${boardedClass}" style="${style}" data-action="${ACTION_IDS.SET_HANGAR_PAGE}" data-index="${dot.index}"></div>`;
            }
        }).join('');

        paginationContainer.innerHTML = dotsHtml;
    }

    /**
     * Shows the detailed ship modal (Buy/Sell/Board/Upgrade).
     * @param {object} gameState 
     * @param {string} shipId 
     * @param {string} context - 'shipyard' or 'hangar'
     */
    showShipDetailModal(gameState, shipId, context) {
        const { player, tutorials } = gameState;
        const shipStatic = DB.SHIPS[shipId];
        let modalContentHtml;

        if (context === 'shipyard') {
             const canAfford = player.credits >= shipStatic.price;
            const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
            const isDisabled = !canAfford || isHangarTutStep1Active;
            modalContentHtml = `
                <div class="ship-card p-4 flex flex-col space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                             <h3 class="text-xl font-orbitron text-cyan-300">${shipStatic.name}</h3>
                            <p class="text-sm text-gray-400">Class ${shipStatic.class}</p>
                         </div>
                        <div class="text-right">
                             <p class="text-lg font-bold text-cyan-300">${formatCredits(shipStatic.price)}</p>
                        </div>
                    </div>
                     <p class="text-sm text-gray-400 flex-grow text-left">${shipStatic.lore}</p>
                    <div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2">
                        <div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${shipStatic.maxHealth}</span></div>
                        <div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${shipStatic.maxFuel}</span></div>
                        <div><span class="text-gray-500">Cargo:</span> <span class="text-amber-400">${shipStatic.cargoCapacity}</span></div>
                    </div>
                     <button class="btn w-full mt-2" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${shipId}" ${isDisabled ? 'disabled' : ''}>Purchase</button>
                </div>`;
        } else { // context === 'hangar'
            const shipDynamic = player.shipStates[shipId];
            const shipInventory = player.inventories[shipId];
            const cargoUsed = calculateInventoryUsed(shipInventory);
            const isActive = shipId === player.activeShipId;
            const canSell = player.ownedShipIds.length > 1 && !isActive;
            
            // DYNAMIC RESALE & PILLS
            let upgradeValue = 0;
            if (shipDynamic.upgrades) {
                shipDynamic.upgrades.forEach(uId => {
                    const def = GameAttributes.getDefinition(uId);
                    if (def) upgradeValue += def.value;
                });
            }
            const salePrice = Math.floor((shipStatic.price + upgradeValue) * GAME_RULES.SHIP_SELL_MODIFIER);

            const upgradesHtml = (shipDynamic.upgrades || []).map(id => {
                const def = GameAttributes.getDefinition(id);
                
                const label = def ? def.name : id; 
                const tooltipText = def ? def.description : '';
                // [[FIXED]] Check 'pillColor' first, fallback to 'color', then hard fallback.
                const baseColor = def ? (def.pillColor || def.color || '#94a3b8') : '#94a3b8'; 
                
                let tier = 1;
                if (id.endsWith('_3') || id.endsWith('_III')) tier = 3;
                else if (id.endsWith('_2') || id.endsWith('_II')) tier = 2;
                else if (id.endsWith('_4')) tier = 4;
                else if (id.endsWith('_5')) tier = 5;

                const borderColor = this._adjustColor(baseColor, -40);
                const borderStyle = tier > 1 ? `2px solid ${borderColor}` : `1px solid ${baseColor}`;
                
                let backgroundStyle = baseColor;
                if (tier === 3) {
                    const highlight = this._adjustColor(baseColor, 30);
                    const shadow = this._adjustColor(baseColor, -80);
                    backgroundStyle = `linear-gradient(135deg, ${highlight} 0%, ${baseColor} 40%, ${shadow} 100%)`;
                } else if (tier === 2) {
                    backgroundStyle = `linear-gradient(to bottom, ${baseColor}, ${this._adjustColor(baseColor, -20)})`;
                } else if (tier >= 4) {
                    // Pulsing effect for Prototype/Luminary
                    backgroundStyle = `linear-gradient(45deg, ${baseColor}, ${this._adjustColor(baseColor, 40)})`;
                }

                return `<span class="attribute-pill inline-block px-2 py-0.5 rounded text-xs font-bold mr-1 mb-1 cursor-help" 
                              title="${tooltipText}"
                              style="background: ${backgroundStyle}; border: ${borderStyle}; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                            ${label}
                        </span>`;
            }).join('');
            
            const upgradeSection = upgradesHtml ? `<div class="mt-2 flex flex-wrap justify-center">${upgradesHtml}</div>` : '';

            modalContentHtml = `
                 <div class="ship-card p-4 flex flex-col space-y-3 ${isActive ? 'border-yellow-400' : ''}">
                    <h3 class="text-xl font-orbitron text-center ${isActive ? 'text-yellow-300' : 'text-cyan-300'}">${shipStatic.name}</h3>
                    <p class="text-sm text-gray-400 text-center">Class ${shipStatic.class}</p>
                    <p class="text-sm text-gray-400 flex-grow text-left my-2">${shipStatic.lore}</p>
                    <div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2">
                        <div><span class="text-gray-500">Hull</span><div class="text-green-400">${Math.floor(shipDynamic.health)}/${shipStatic.maxHealth}</div></div>
                        <div><span class="text-gray-500">Fuel</span><div class="text-sky-400">${Math.floor(shipDynamic.fuel)}/${shipStatic.maxFuel}</div></div>
                        <div><span class="text-gray-500">Cargo</span><div class="text-amber-400">${cargoUsed}/${shipStatic.cargoCapacity}</div></div>
                    </div>
                    ${upgradeSection}
                      <div class="grid grid-cols-2 gap-2 mt-2">
                        ${isActive ? '<button class="btn" disabled>ACTIVE</button>' : `<button class="btn" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${shipId}">Board</button>`}
                        <button class="btn" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${shipId}" ${!canSell ? 'disabled' : ''}>Sell<br>⌬ ${formatCredits(salePrice, false)}</button>
                    </div>
                 </div>`;
        }

        const modal = this.manager.cache.shipDetailModal;
        const modalContent = modal.querySelector('#ship-detail-content');
        modalContent.innerHTML = modalContentHtml;
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    /**
     * Shows the robust modal flow for installing upgrades (ADR-012).
     * @param {string} upgradeId 
     * @param {number} hardwareCost 
     * @param {number} installationFee 
     * @param {object} shipState 
     * @param {Function} onConfirm 
     */
    showUpgradeInstallationModal(upgradeId, hardwareCost, installationFee, shipState, onConfirm) {
        const upgradeDef = GameAttributes.getDefinition(upgradeId);
        if (!upgradeDef) return;

        const currentUpgrades = shipState.upgrades || [];
        const isFull = currentUpgrades.length >= 3;
        
        const totalCost = hardwareCost + installationFee;
        let title = totalCost > 0 ? "Purchase Upgrade" : "Install Upgrade";
        // [[FIXED]] Check pillColor first, fallback to color
        const nameColor = upgradeDef.pillColor || upgradeDef.color || '#fff';
        let desc = `<p class="mb-2">Install <span class="font-bold" style="color: ${nameColor}">${upgradeDef.name}</span>?</p>`;
        
        if (totalCost > 0) {
            desc += `<p class="text-base text-gray-400">Total Cost: <span class="credits-text-pulsing">${formatCredits(totalCost, true)}</span></p>`;
            if (installationFee > 0) {
                desc += `<p class="text-xs text-gray-500 font-mono">Installation Fee: ${formatCredits(installationFee)}</p>`;
            }
        }
        
        desc += `<p class="mt-4 italic text-sm text-gray-500">${upgradeDef.description}</p>`;

        this.manager.queueModal('event-modal', title, desc, null, {
            dismissOutside: true,
            customSetup: (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                const contentEl = modal.querySelector('#event-description'); 

                const renderStandardButtons = () => {
                    btnContainer.className = "flex justify-center gap-4 w-full mt-4";
                    btnContainer.innerHTML = `
                        <button id="confirm-install-btn" class="btn btn-pulse-green">Confirm</button>
                        <button id="cancel-install-btn" class="btn">Cancel</button>
                    `;
                    
                    const confirmBtn = modal.querySelector('#confirm-install-btn');
                    confirmBtn.onclick = () => {
                        if (isFull) {
                            renderReplacementUI();
                        } else {
                            closeHandler();
                            onConfirm(-1); 
                        }
                    };
                    
                    modal.querySelector('#cancel-install-btn').onclick = closeHandler;
                };

                const renderReplacementUI = () => {
                    const modalTitle = modal.querySelector('#event-title');
                    modalTitle.textContent = "Upgrade Capacity Full";
                    
                    const upgradesList = currentUpgrades.map((uId, idx) => {
                        const def = GameAttributes.getDefinition(uId);
                        // [[FIXED]] Fallback to color if pillColor missing
                        const pColor = def ? (def.pillColor || def.color || '#fff') : '#fff';
                        const uName = def ? def.name : uId;
                        const statText = def ? (def.statText || 'Unknown Effect') : 'Unknown Effect';
                        const valText = def ? formatCredits(def.value, true) : '0';

                        return `<button class="btn btn-sm border border-gray-600 hover:border-red-500 w-full text-left px-4 py-3 bg-gray-800 flex justify-between items-center" data-idx="${idx}">
                                    <div class="flex flex-col">
                                        <span class="font-bold" style="color: ${pColor}">${uName}</span>
                                        <span class="text-xs text-gray-400 mt-1">${statText}</span>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-xs text-gray-500 block">Value</span>
                                        <span class="font-mono font-bold text-cyan-300 text-glow-cyan text-sm">${valText}</span>
                                    </div>
                                </button>`;
                    }).join('');

                    contentEl.innerHTML = `
                        <p class="mb-4 text-orange-400">Ship systems are at maximum capacity (3/3).</p>
                        <p class="mb-4 text-sm text-gray-300">Select an existing upgrade to dismantle and replace:</p>
                        <div class="flex flex-col gap-2 w-full max-w-sm mx-auto">
                            ${upgradesList}
                        </div>
                    `;
                    
                    btnContainer.innerHTML = `<button id="cancel-replace-btn" class="btn w-full mt-2">Cancel</button>`;
                    modal.querySelector('#cancel-replace-btn').onclick = closeHandler;

                    contentEl.querySelectorAll('button[data-idx]').forEach(btn => {
                        btn.onclick = () => {
                            const idx = parseInt(btn.dataset.idx, 10);
                            renderFinalConfirmation(idx);
                        };
                    });
                };

                const renderFinalConfirmation = (indexToRemove) => {
                    const idToRemove = currentUpgrades[indexToRemove];
                    const defToRemove = GameAttributes.getDefinition(idToRemove);
                    
                    const modalTitle = modal.querySelector('#event-title');
                    modalTitle.textContent = "Confirm Replacement";
                    
                    const removeNameColor = defToRemove ? (defToRemove.pillColor || defToRemove.color || '#fff') : '#fff';
                    const removeName = defToRemove ? defToRemove.name : idToRemove;

                    contentEl.innerHTML = `
                        <p class="mb-4 text-red-400 font-bold">WARNING: Destructive Action</p>
                        <p class="mb-2">Replacing <span class="font-bold" style="color: ${removeNameColor}">${removeName}</span> will <span class="font-bold text-red-500">permanently</span> destroy it.</p>
                        <p class="text-sm text-gray-400">You will receive no credits for the dismantled part.</p>
                    `;
                    
                    btnContainer.className = "flex gap-4 w-full mt-4";
                    btnContainer.innerHTML = `
                        <button id="final-confirm-btn" class="btn bg-red-600 hover:bg-red-500 text-white flex-1">Dismantle & Install</button>
                        <button id="final-cancel-btn" class="btn flex-1">Cancel</button>
                    `;
                    
                    modal.querySelector('#final-confirm-btn').onclick = () => {
                        closeHandler();
                        onConfirm(indexToRemove);
                    };
                    modal.querySelector('#final-cancel-btn').onclick = closeHandler;
                };

                renderStandardButtons();
            }
        });
    }

    async runShipTransactionAnimation(shipId, animationClass = 'is-dematerializing') {
        const elementToAnimate = this._getActiveShipTerminalElement();

        if (!elementToAnimate) {
            this.manager.logger.warn('UIHangarControl', `No element to animate for ${shipId}. Skipping animation.`);
            return; 
        }

        await playBlockingAnimation(elementToAnimate, animationClass);
    }

    _getActiveShipTerminalElement() {
        const state = this.manager.lastKnownState; 
        if (!state) return null;

        const hangarScreenEl = this.manager.cache.hangarScreen;
        if (!hangarScreenEl) return null;

        const carousel = hangarScreenEl.querySelector('#hangar-carousel');
        if (!carousel) return null;

        const isHangarMode = state.uiState.hangarShipyardToggleState === 'hangar';
        const activeIndex = isHangarMode ? (state.uiState.hangarActiveIndex || 0) : (state.uiState.shipyardActiveIndex || 0);
        const pages = carousel.querySelectorAll('.carousel-page');
        const activePage = pages[activeIndex];
        return activePage ? activePage.querySelector('#ship-terminal') : null;
    }

    /**
     * Helper to darken/lighten color (extracted from facade).
     */
    _adjustColor(color, amount) {
        if (!color || !color.startsWith('#')) return '#94a3b8'; // Default grey on invalid input
        const hex = color.replace('#', '');
        const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
        const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
        const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
        const rr = r.toString(16).padStart(2, '0');
        const gg = g.toString(16).padStart(2, '0');
        const bb = b.toString(16).padStart(2, '0');
        return `#${rr}${gg}${bb}`;
    }
}