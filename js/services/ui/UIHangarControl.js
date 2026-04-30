// js/services/ui/UIHangarControl.js
import { AssetService } from '../AssetService.js';
import { GameAttributes } from '../GameAttributes.js';
import { DB } from '../../data/database.js';
import { ACTION_IDS, GAME_RULES, STATUS_EFFECTS, LOCATION_IDS } from '../../data/constants.js'; 
import { calculateInventoryUsed, formatCredits } from '../../utils.js';
import { playBlockingAnimation } from './AnimationService.js'; 
import { renderShipCarouselPageContent } from '../../ui/components/HangarScreen.js';

/**
 * Domain Controller responsible for Ship assets. 
 * Manages the Hangar/Shipyard carousel, pagination, and the Upgrade Installation flow.
 */
export class UIHangarControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager The master UIManager facade.
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Updates the visual state of the Hangar/Shipyard carousel.
     * With DOM virtualization in place, updates and HTML hydration occur instantly 
     * without thrashing the main thread.
     * @param {import('../GameState.js').GameState} gameState The current game state.
     */
    updateHangarScreen(gameState) {
        const { uiState, player } = gameState;
        const hangarScreenEl = this.manager.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const carousel = hangarScreenEl.querySelector('#hangar-carousel');
        if (!carousel) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        // 1. Instantly apply the transform for the CSS animation
        carousel.style.transform = `translateX(-${activeIndex * 100}%)`;
        
        // 2. Instantly update the pagination dots external to the carousel
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

        // --- VIRTUAL WORKBENCH: DYNAMIC HYDRATION LOCK ---
        // Dynamically hydrate and dehydrate the carousel pages based on their distance.
        const pages = carousel.querySelectorAll('.carousel-page');

        pages.forEach((page, index) => {
            const distance = Math.abs(index - activeIndex);
            
            if (distance <= 1) {
                // HYDRATE: The card is within the active view window
                // FIX: Only inject HTML if it is currently an empty placeholder!
                // This prevents destroying the DOM of already-visible cards during a swipe,
                // completely eliminating the image "blink" and forced reload sequence.
                if (page.classList.contains('virtualized-placeholder')) {
                    const shipId = page.dataset.shipId;
                    page.classList.remove('virtualized-placeholder');
                    page.innerHTML = renderShipCarouselPageContent(gameState, shipId, index, activeIndex, isHangarMode, this.manager.simulationService);
                }
            } else {
                // DEHYDRATE: The card is off-screen. Strip it to save memory.
                if (!page.classList.contains('virtualized-placeholder')) {
                    page.classList.add('virtualized-placeholder');
                    page.innerHTML = '';
                }
            }
        });
    }

    /**
     * Renders the micro-pagination dots beneath the hangar carousel.
     * @param {import('../GameState.js').GameState} gameState The current game state.
     * @private
     */
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
     * Instantiates and displays the detailed modal for a specific ship.
     * Context-aware routing between standard shipyard, intro sequence, and owned hangar views.
     * @param {import('../GameState.js').GameState} gameState The current game state.
     * @param {string} shipId The target ship identifier.
     * @param {string} context The origin context string (e.g., 'shipyard', 'intro_shipyard').
     */
    showShipDetailModal(gameState, shipId, context) {
        const { player, tutorials } = gameState;
        const shipStatic = DB.SHIPS[shipId];
        const modal = this.manager.cache.shipDetailModal;
        const modalContent = modal.querySelector('.modal-content');
        let modalContentHtml;

        modalContent.classList.remove('modal-theme-amber', 'modal-theme-blue', 'modal-theme-green');

        if (context === 'shipyard' || context === 'intro_shipyard') {
            let displayPrice = shipStatic.price;
            if (context === 'intro_shipyard') {
                displayPrice = 25000;
            }
            
            const canAfford = player.credits >= displayPrice;
            let isDisabled = false;
            let actionId = ACTION_IDS.BUY_SHIP;

            if (context === 'intro_shipyard') {
                isDisabled = !canAfford; 
                actionId = ACTION_IDS.INTRO_BUY_SHIP;
                modalContent.classList.add('intro-modal-width');
                
                if (shipStatic.role === 'Explorer') {
                    modalContent.classList.add('modal-theme-blue');
                } else if (shipStatic.role === 'Balanced') {
                    modalContent.classList.add('modal-theme-green');
                } else if (shipStatic.role === 'Hauler') {
                    modalContent.classList.add('modal-theme-amber');
                }
            } else {
                const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
                isDisabled = !canAfford || isHangarTutStep1Active;
                modalContent.classList.remove('intro-modal-width');
            }

            let imageSrc = AssetService.getShipImage(shipId, player.visualSeed);
            if (context === 'intro_shipyard') {
                if (shipId === 'Wanderer.Ship') imageSrc = 'assets/images/ships/Wanderer/Wanderer_F.webp';
                if (shipId === 'Mule.Ship') imageSrc = 'assets/images/ships/Mule/Mule_H.webp';
                if (shipId === 'Nomad.Ship') imageSrc = 'assets/images/ships/Nomad/Nomad_A.webp';
            }

            const largeImageHtml = context === 'intro_shipyard' ? 
                `<div class="flex justify-center my-4 -mx-4">
                    <img src="${imageSrc}" class="w-full max-w-[400px] aspect-square object-cover drop-shadow-2xl rounded border border-gray-600 bg-gray-800 bg-opacity-60 p-2" />
                </div>` : '';

            const textContent = context === 'intro_shipyard' ? shipStatic.description : shipStatic.lore;
            
            const titleStyle = context === 'intro_shipyard' ? 'style="font-size: calc(1.25rem + 3pt);"' : '';
            const pStyle = context === 'intro_shipyard' ? 'style="font-size: calc(0.875rem + 1pt);"' : '';
            const costStyle = context === 'intro_shipyard' ? 'style="font-size: calc(1.125rem + 1pt);"' : '';
            const paramStyle = context === 'intro_shipyard' ? 'style="font-size: calc(0.875rem + 2pt);"' : '';
            const titleColorClass = context === 'intro_shipyard' ? 'text-white' : 'text-cyan-300';
            const valBoldClass = context === 'intro_shipyard' ? 'font-bold' : '';

            const btnHtml = `<button class="btn w-full mt-2" data-action="${actionId}" data-ship-id="${shipId}" ${isDisabled ? 'disabled' : ''}>Purchase</button>`;

            modalContentHtml = `
                <div class="ship-card p-4 flex flex-col space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                             <h3 class="text-xl font-orbitron ${titleColorClass}" ${titleStyle}>${shipStatic.name}</h3>
                            <p class="text-sm text-gray-400" ${pStyle}>Class ${shipStatic.class}</p>
                         </div>
                        <div class="text-right">
                             <p class="text-lg font-bold text-cyan-300" ${costStyle}>${formatCredits(displayPrice)}</p>
                        </div>
                    </div>
                     <p class="text-sm text-gray-400 flex-grow text-left" ${pStyle}>${textContent}</p>
                     ${largeImageHtml}
                    <div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2" ${paramStyle}>
                        <div><span class="text-gray-500">Hull:</span><br><span class="text-green-400 ${valBoldClass}">${shipStatic.maxHealth}</span></div>
                        <div><span class="text-gray-500">Fuel:</span><br><span class="text-sky-400 ${valBoldClass}">${shipStatic.maxFuel}</span></div>
                        <div><span class="text-gray-500">Cargo:</span><br><span class="text-amber-400 ${valBoldClass}">${shipStatic.cargoCapacity}</span></div>
                    </div>
                     ${btnHtml}
                </div>`;

        } else { 
            modalContent.classList.remove('intro-modal-width');
            const shipDynamic = player.shipStates[shipId];
            const shipInventory = player.inventories[shipId];
            const cargoUsed = calculateInventoryUsed(shipInventory);
            const isActive = shipId === player.activeShipId;
            const canSell = player.ownedShipIds.length > 1 && !isActive;
            
            let upgradeValue = 0;
            if (shipDynamic.upgrades) {
                shipDynamic.upgrades.forEach(uId => {
                    const def = GameAttributes.getDefinition(uId);
                    if (def) upgradeValue += GameAttributes.getUpgradeHardwareCost(def.tier || 1, shipStatic.price);
                });
            }
            const salePrice = Math.floor((shipStatic.price + upgradeValue) * GAME_RULES.SHIP_SELL_MODIFIER);

            const statusEffectsHtml = (shipDynamic.statusEffects || []).map(effect => {
                const daysLeft = effect.expiryDay - gameState.day;
                const def = Object.values(STATUS_EFFECTS).find(s => s.id === effect.id);
                if (!def) return '';
                const cssClass = def.gradientClasses || 'bg-gray-500 border-gray-400 text-white';
                return `<span class="status-effect-pill ${cssClass} cursor-help" data-action="show-lore-tooltip" data-tooltip="${def.name}: Expires in ${daysLeft} days">${def.name}</span>`;
            }).join('');

            const upgradesHtml = (shipDynamic.upgrades || []).map(id => {
                const def = GameAttributes.getDefinition(id);
                
                const label = def ? def.name : id; 
                const baseColor = def ? (def.pillColor || def.color || '#94a3b8') : '#94a3b8'; 
                
                const tier = GameAttributes.extractTier(id);

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
                    backgroundStyle = `linear-gradient(45deg, ${baseColor}, ${this._adjustColor(baseColor, 40)})`;
                }

                return `<span class="attribute-pill inline-block px-2 py-0.5 rounded text-xs font-bold mr-1 mb-1 cursor-help" 
                              data-action="show-attribute-tooltip" data-attribute-id="${id}"
                              style="background: ${backgroundStyle}; border: ${borderStyle}; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                            ${label}
                        </span>`;
            }).join('');
            
            const combinedPillsHtml = upgradesHtml + statusEffectsHtml;
            const upgradeSection = combinedPillsHtml ? `<div class="mt-2 flex flex-wrap-reverse justify-center" id="upgrade-pill-container-${shipId}">${combinedPillsHtml}</div>` : '';

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

        const modalContentTarget = modal.querySelector('#ship-detail-content');
        modalContentTarget.innerHTML = modalContentHtml;

        if (context === 'intro_shipyard') {
            const dismissHandler = (e) => {
                if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
                    this.manager.hideModal('ship-detail-modal');
                    modal.removeEventListener('click', dismissHandler);
                }
            };
            modal.removeEventListener('click', modal._introDismissHandler);
            modal._introDismissHandler = dismissHandler;
            modal.addEventListener('click', dismissHandler);
        }

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    /**
     * Orchestrates the triple-confirmation flow required for installing or replacing ship upgrades.
     * Evaluates active system state modifiers impacting installation costs.
     * @param {string} upgradeId The target upgrade identifier.
     * @param {object} options Configuration object including source, hardwareCost, and installationFee.
     * @param {object} shipState The current dynamic state of the target ship.
     * @param {function} onConfirm Callback executed upon confirmed installation.
     * @param {function} onReject Callback executed upon cancellation or rejection.
     */
    showUpgradeInstallationModal(upgradeId, options, shipState, onConfirm, onReject) {
        const upgradeDef = GameAttributes.getDefinition(upgradeId);
        if (!upgradeDef) return;

        const { source = 'shop', eventX, eventY } = options;
        let hardwareCost = options.hardwareCost || 0;
        let installationFee = options.installationFee || 0;

        const currentUpgrades = shipState.upgrades || [];
        const isFull = currentUpgrades.length >= 3;
        
        const systemState = this.manager.lastKnownState?.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        const isTargetLocation = systemState && systemState.targetLocations?.includes(this.manager.lastKnownState?.currentLocationId);

        if (activeStateDef && activeStateDef.modifiers) {
            if (activeStateDef.modifiers.installCostMod) {
                installationFee = Math.floor(installationFee * activeStateDef.modifiers.installCostMod);
            }
            if (isTargetLocation && activeStateDef.modifiers.localUpgradeCostMod) {
                hardwareCost = Math.floor(hardwareCost * activeStateDef.modifiers.localUpgradeCostMod);
            }
        }

        const totalCost = hardwareCost + installationFee;
        
        // --- PHASE 5: THEME EXTRACTION & OVERRIDE ---
        const nameColor = upgradeDef.pillColor || upgradeDef.color || '#38bdf8';
        const darkColor = this._adjustColor(nameColor, -80);
        const btnHoverColor = this._adjustColor(nameColor, -40);

        const applyThemeToModal = (modal) => {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.background = `linear-gradient(145deg, ${darkColor} 0%, #000000 100%)`;
                modalContent.style.borderColor = nameColor;
                modalContent.style.boxShadow = `0 0 30px ${darkColor}, inset 0 0 15px ${darkColor}`;
                modalContent.style.transition = 'all 0.3s ease';
            }
            const titleEl = modal.querySelector('#event-title');
            if (titleEl) {
                titleEl.style.color = nameColor;
                titleEl.style.textShadow = `0 0 12px ${nameColor}`;
                titleEl.style.fontSize = '1.8rem'; // +20%
            }
            const descEl = modal.querySelector('#event-description');
            if (descEl) {
                descEl.style.fontSize = '1.35rem'; // +20%
                descEl.style.color = '#f3f4f6'; // Brighten slightly for contrast
            }
        };

        const clearThemeFromModal = () => {
            const modal = document.getElementById('event-modal');
            if (!modal) return;
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.background = '';
                modalContent.style.borderColor = '';
                modalContent.style.boxShadow = '';
                modalContent.style.transition = '';
            }
            const titleEl = modal.querySelector('#event-title');
            if (titleEl) {
                titleEl.style.color = '';
                titleEl.style.textShadow = '';
                titleEl.style.fontSize = '';
            }
            const descEl = modal.querySelector('#event-description');
            if (descEl) {
                descEl.style.fontSize = '';
                descEl.style.color = '';
            }
        };

        const handleDeductionAndInstall = (indexToRemove, closeHandler) => {
            if (source === 'shop' && totalCost > 0) {
                const state = this.manager.lastKnownState;
                state.player.credits -= totalCost;
                if (eventX && eventY) {
                    this.manager.createFloatingText(`-${formatCredits(totalCost, false)}`, eventX, eventY, '#f87171');
                }
                if (!state.uiState.purchasedUpgrades) state.uiState.purchasedUpgrades = [];
                state.uiState.purchasedUpgrades.push(upgradeId);
                this.manager.render(state);
            }
            
            setTimeout(() => {
                clearThemeFromModal();
                closeHandler();
                if (onConfirm) onConfirm(indexToRemove);
            }, 500);
        };

        const renderFinalConfirmation = (indexToRemove, closeHandler) => {
            const idToRemove = currentUpgrades[indexToRemove];
            const defToRemove = GameAttributes.getDefinition(idToRemove);
            
            const modal = document.getElementById('event-modal');
            applyThemeToModal(modal); // Re-apply just in case
            
            const modalTitle = modal.querySelector('#event-title');
            const contentEl = modal.querySelector('#event-description');
            const btnContainer = modal.querySelector('#event-button-container');

            modalTitle.textContent = "Confirm Replacement";
            
            const removeNameColor = defToRemove ? (defToRemove.pillColor || defToRemove.color || '#fff') : '#fff';
            const removeName = defToRemove ? defToRemove.name : idToRemove;

            contentEl.innerHTML = `
                <p class="mb-5 text-red-500 font-bold text-[1.1em] uppercase tracking-widest" style="text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);">WARNING: Destructive Action</p>
                <p class="mb-3">Replacing <span class="font-bold text-[1.1em]" style="color: ${removeNameColor}; text-shadow: 0 0 8px ${removeNameColor};">${removeName}</span> will <span class="font-bold text-red-500">permanently</span> destroy it.</p>
                <p class="text-[0.9em] text-gray-300">You will receive no credits for the dismantled part.</p>
            `;
            
            btnContainer.className = "flex flex-col w-full mt-5 gap-3";
            btnContainer.innerHTML = `
                <button id="final-confirm-btn" class="btn bg-red-800 hover:bg-red-700 text-white w-full border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] text-[1.2rem] py-3 uppercase tracking-widest">Dismantle & Install</button>
                <button id="final-cancel-btn" class="btn w-full border-gray-500 text-gray-300 hover:text-white text-[1.1rem] py-2">Cancel</button>
            `;
            
            modal.querySelector('#final-confirm-btn').onclick = () => {
                modal.querySelector('#final-confirm-btn').disabled = true;
                handleDeductionAndInstall(indexToRemove, closeHandler);
            };
            modal.querySelector('#final-cancel-btn').onclick = () => {
                renderReplacementUI(closeHandler);
            };
        };

        const renderReplacementUI = (closeHandler) => {
            const modal = document.getElementById('event-modal');
            applyThemeToModal(modal); // Ensure theme is active
            
            const modalTitle = modal.querySelector('#event-title');
            const contentEl = modal.querySelector('#event-description');
            const btnContainer = modal.querySelector('#event-button-container');

            modalTitle.textContent = "Upgrade Capacity Full";
            
            const activeShipId = this.manager.lastKnownState?.player?.activeShipId;
            const activeShipStatic = activeShipId ? DB.SHIPS[activeShipId] : null;
            const shipBasePrice = activeShipStatic ? activeShipStatic.price : 0;
            
            const upgradesList = currentUpgrades.map((uId, idx) => {
                const def = GameAttributes.getDefinition(uId);
                const pColor = def ? (def.pillColor || def.color || '#fff') : '#fff';
                const uName = def ? def.name : uId;
                const statText = def ? (def.description || 'Unknown Effect') : 'Unknown Effect';
                
                const hwCost = def ? GameAttributes.getUpgradeHardwareCost(def.tier || 1, shipBasePrice) : 0;
                const valText = formatCredits(hwCost, true);

                return `<button class="btn btn-sm border hover:border-red-500 w-full text-left px-4 py-3 bg-gray-900/80 flex justify-between items-center mb-3" style="border-color: ${pColor}80; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);" data-idx="${idx}">
                            <div class="flex flex-col overflow-hidden">
                                <span class="font-bold text-[1.1rem]" style="color: ${pColor}; text-shadow: 0 0 8px ${pColor};">${uName}</span>
                                <div class="marquee-container text-[0.85rem] text-gray-300 mt-1">
                                    <span class="marquee-content">${statText}</span>
                                </div>
                            </div>
                            <div class="text-right flex-shrink-0 ml-4">
                                <span class="text-[0.8rem] text-gray-400 block">Value</span>
                                <span class="font-mono font-bold text-cyan-300 text-[1rem]" style="text-shadow: 0 0 5px rgba(103, 232, 249, 0.5);">${valText}</span>
                            </div>
                        </button>`;
            }).join('');

            contentEl.innerHTML = `
                <p class="mb-5 text-orange-400 font-bold" style="font-size: 1.1em; text-shadow: 0 0 8px rgba(251, 146, 60, 0.6);">Ship systems are at maximum capacity (3/3).</p>
                <p class="mb-4 text-gray-200">Select an existing upgrade to dismantle and replace with <span class="font-bold" style="color: ${nameColor}; text-shadow: 0 0 8px ${nameColor};">${upgradeDef.name}</span>:</p>
                <div class="flex flex-col w-full max-w-md mx-auto">
                    ${upgradesList}
                </div>
            `;
            
            btnContainer.className = "flex flex-col w-full mt-5 gap-3";
            if (source === 'mission') {
                btnContainer.innerHTML = `<button id="cancel-replace-btn" class="btn w-full border-gray-500 text-gray-300 hover:text-white text-[1.1rem] py-2">Reject</button>`;
                const cancelBtn = modal.querySelector('#cancel-replace-btn');
                cancelBtn.onclick = () => {
                    if (cancelBtn.dataset.phase === '1') {
                        clearThemeFromModal();
                        closeHandler();
                        if (onReject) onReject();
                    } else {
                        cancelBtn.dataset.phase = '1';
                        cancelBtn.textContent = 'Confirm Reject?';
                        cancelBtn.classList.remove('border-gray-500', 'text-gray-300');
                        cancelBtn.classList.add('border-red-400', 'text-white', 'bg-red-900/60');
                    }
                };
            } else {
                btnContainer.innerHTML = `<button id="cancel-replace-btn" class="btn w-full border-gray-500 text-gray-300 hover:text-white text-[1.1rem] py-2">Cancel</button>`;
                modal.querySelector('#cancel-replace-btn').onclick = () => {
                    clearThemeFromModal();
                    closeHandler();
                };
            }

            contentEl.querySelectorAll('button[data-idx]').forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.dataset.idx, 10);
                    renderFinalConfirmation(idx, closeHandler);
                };
            });
        };

        const renderInitialModal = () => {
            let title = source === 'shop' ? "Install Upgrade" : "Reward Available";
            let desc = `<p class="mb-4">Install <span class="font-bold text-[1.1em]" style="color: ${nameColor}; text-shadow: 0 0 8px ${nameColor};">${upgradeDef.name}</span>?</p>`;
            
            if (source === 'shop' && totalCost > 0) {
                desc += `<p class="text-[1.1em] text-gray-200 mb-1 font-semibold">Total Cost: <span class="credits-text-pulsing font-mono text-cyan-300 ml-2" style="text-shadow: 0 0 8px rgba(103, 232, 249, 0.8);">${formatCredits(totalCost, true)}</span></p>`;
                if (installationFee > 0) {
                    desc += `<p class="text-[0.85em] text-gray-400 font-mono">Installation Fee: ${formatCredits(installationFee)}</p>`;
                }
            }
            
            desc += `<p class="mt-5 italic text-[0.9em] text-gray-300 leading-relaxed">${upgradeDef.description}</p>`;

            this.manager.queueModal('event-modal', title, desc, null, {
                dismissOutside: false, 
                customSetup: (modal, closeHandler) => {
                    applyThemeToModal(modal);

                    const btnContainer = modal.querySelector('#event-button-container');
                    btnContainer.className = "flex flex-col w-full mt-5 gap-3";
                    
                    let confirmBtnHtml = '';
                    if (source === 'shop') {
                        const canAfford = this.manager.lastKnownState.player.credits >= totalCost;
                        confirmBtnHtml = `
                            <button id="confirm-install-btn" class="btn w-full font-bold text-[1.2rem] py-3 tracking-widest uppercase transition-all" style="background-color: ${darkColor}; border-color: ${nameColor}; color: #fff; box-shadow: 0 0 15px ${darkColor};" ${!canAfford ? 'disabled' : ''}>
                                Purchase
                            </button>
                        `;
                    } else {
                        confirmBtnHtml = `
                            <button id="confirm-install-btn" class="btn w-full font-bold text-[1.2rem] py-3 tracking-widest uppercase transition-all" style="background-color: ${darkColor}; border-color: ${nameColor}; color: #fff; box-shadow: 0 0 15px ${darkColor};">
                                Accept Upgrade
                            </button>
                        `;
                    }

                    btnContainer.innerHTML = `
                        ${confirmBtnHtml}
                        <button id="cancel-install-btn" class="btn w-full border-gray-500 text-gray-300 hover:text-white text-[1.1rem] py-2">Reject</button>
                    `;

                    const confirmBtn = modal.querySelector('#confirm-install-btn');
                    if (confirmBtn && !confirmBtn.disabled) {
                        confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.backgroundColor = btnHoverColor);
                        confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.backgroundColor = darkColor);
                    }

                    confirmBtn.onclick = () => {
                        if (isFull) {
                            renderReplacementUI(closeHandler);
                        } else {
                            confirmBtn.disabled = true;
                            handleDeductionAndInstall(-1, closeHandler);
                        }
                    };

                    modal.querySelector('#cancel-install-btn').onclick = () => {
                        clearThemeFromModal();
                        closeHandler();
                        if (onReject) onReject();
                    };
                }
            });
        };

        renderInitialModal();
    }

    /**
     * Executes the visual transition (dematerialize/board) for a ship transaction.
     * @param {string} shipId The target ship identifier.
     * @param {string} [animationClass='is-dematerializing'] The CSS animation class to apply.
     * @returns {Promise<void>} Resolves when the animation completes.
     */
    async runShipTransactionAnimation(shipId, animationClass = 'is-dematerializing') {
        const elementToAnimate = this._getActiveShipTerminalElement(shipId);
        if (!elementToAnimate) {
            if (this.manager.logger) this.manager.logger.warn('UIHangarControl', `Target element for ship transaction animation missing. ID: ${shipId}`);
            return; 
        } 
        await playBlockingAnimation(elementToAnimate, animationClass);
    }
    
    /**
     * Locates the active ship terminal DOM element explicitly by shipId to prevent UI masking race conditions.
     * Checks open modals before falling back to the background carousel wrapper.
     * @param {string} shipId
     * @returns {HTMLElement|null} The terminal element, or null if not found.
     * @private
     */
    _getActiveShipTerminalElement(shipId) {
        // First check if the ship detail modal is active and showing this ship
        const detailModal = this.manager.cache?.shipDetailModal;
        if (detailModal && !detailModal.classList.contains('hidden')) {
            // If the detail modal is open, animate its card
            const actionBtn = detailModal.querySelector(`[data-action="${ACTION_IDS.BUY_SHIP}"][data-ship-id="${shipId}"], [data-action="${ACTION_IDS.SELL_SHIP}"][data-ship-id="${shipId}"]`);
            if (actionBtn) {
                return detailModal.querySelector('.ship-card');
            }
        }

        // Otherwise find it directly via data-attribute in the carousel DOM
        const hangarScreenEl = this.manager.cache?.hangarScreen;
        if (!hangarScreenEl) return null;
        const targetPage = hangarScreenEl.querySelector(`.carousel-page[data-ship-id="${shipId}"]`);
        return targetPage ? targetPage.querySelector('#ship-terminal') : null;
    }

    /**
     * Adjusts the brightness of a hex color for dynamic gradient generation.
     * @param {string} color Hex color string (e.g., '#ffffff').
     * @param {number} amount Adjustment amount (-255 to 255).
     * @returns {string} The adjusted hex color string.
     * @private
     */
    _adjustColor(color, amount) {
        if (!color || !color.startsWith('#')) return '#94a3b8'; 
        const hex = color.replace('#', '');
        const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
        const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
        const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
        const rr = r.toString(16).padStart(2, '0');
        const gg = g.toString(16).padStart(2, '0');
        const bb = b.toString(16).padStart(2, '0');
        return `#${rr}${gg}${bb}`;
    }

    /**
     * Plays the visual reveal sequence after a new upgrade is installed onto a ship.
     * @param {string} shipId The target ship identifier.
     * @returns {Promise<void>} Resolves when the animation sequence completes.
     */
    async playUpgradeReveal(shipId) {
        const hangarScreenEl = this.manager.cache.hangarScreen;
        if (!hangarScreenEl) return;
        const targetPage = hangarScreenEl.querySelector(`.carousel-page[data-ship-id="${shipId}"]`);
        if (!targetPage) return;
        const terminalCard = targetPage.querySelector('#ship-terminal');
        const pillContainer = targetPage.querySelector(`#upgrade-pill-container-${shipId}`);
        if (!terminalCard) return;

        terminalCard.classList.add('card-scanline-active');
        await new Promise(resolve => setTimeout(resolve, 1000));
        terminalCard.classList.remove('card-scanline-active');

        if (pillContainer && pillContainer.children.length > 0) {
            Array.from(pillContainer.children).forEach(pill => {
                pill.classList.add('pill-instantiate');
                setTimeout(() => { pill.classList.remove('pill-instantiate'); }, 500); 
            });
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}