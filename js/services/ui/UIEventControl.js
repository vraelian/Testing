// js/services/ui/UIEventControl.js
import { DB } from '../../data/database.js';
import { EULA_CONTENT } from '../../data/eulaContent.js';
import { LORE_REGISTRY } from '../../data/lore/loreRegistry.js';
import { formatCredits, getCommodityStyle } from '../../utils.js';
import { GameAttributes } from '../GameAttributes.js';
import { _renderMaxCargoModal } from '../../ui/components/CargoScreen.js';
import { COMMODITY_IDS } from '../../data/constants.js';
import { starfieldService } from './StarfieldService.js';
import { CRITICAL_HULL_WARNINGS } from '../../data/flavorAds.js';

export class UIEventControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Constructs and queues the Hot Intel modal announcement.
     * @param {object} intelData - The active Hot Intel object containing location, commodity, and discount properties.
     */
    showHotIntelModal(intelData) {
        const commodity = DB.COMMODITIES.find(c => c.id === intelData.commodityId);
        const commodityName = commodity ? commodity.name : intelData.commodityId;
        const discountPct = Math.round((1 - intelData.discountMultiplier) * 100);

        // --- VIRTUAL WORKBENCH: Removed word "units" ---
        const htmlPayload = `
            <div class="text-lg text-gray-200 text-center">
                Data from the local exchange confirms an unexpected influx of <span class="text-result-cargo font-bold">${commodityName}</span>. To maintain market stability, vendors have authorized an immediate <span class="text-req-yellow font-bold">${discountPct}% discount</span> on all current inventory.
            </div>
        `;
        // --- END VIRTUAL WORKBENCH ---

        this.manager.queueModal('event-modal', 'Intel Acquired', htmlPayload, null, {
            dismissOutside: true,
            buttonText: 'Understood',
            theme: 'intel'
        });
    }

    // --- PHASE 3/4: CRITICAL HULL WARNING MODAL ---
    /**
     * Displays a high-priority warning modal preventing immediate launch when hull is < 15%.
     * @param {string} locationId - The intended destination ID.
     * @param {boolean} useFoldedDrive - Whether the player was attempting to use a folded drive.
     */
    showCriticalHullWarningModal(locationId, useFoldedDrive) {
        const state = this.manager.lastKnownState;
        const day = state?.day || 0;
        const shipId = state?.player?.activeShipId || 'unknown_ship';
        const currentLoc = state?.currentLocationId || 'unknown_loc';

        // Deterministic Hash: Locks the flavor text to the specific day, location, and ship.
        const seedString = `${day}_${currentLoc}_${shipId}`;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
            hash = (hash << 5) - hash + seedString.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        
        const randomIndex = Math.abs(hash) % CRITICAL_HULL_WARNINGS.length;
        const flavorWarning = CRITICAL_HULL_WARNINGS[randomIndex];

        const htmlPayload = `
            <div class="text-center text-gray-300 mb-6 font-exo leading-relaxed">
                <p class="mb-4">${flavorWarning}</p>
                <p class="text-sm font-bold text-red-500 uppercase tracking-widest animate-pulse">Warning: Extreme Risk of Catastrophic Failure</p>
            </div>
            <div class="flex justify-center gap-4 mt-6">
                <button type="button" id="btn-critical-cancel" class="btn border border-gray-600 hover:bg-gray-800 text-gray-300 flex-1 py-3 font-orbitron tracking-widest">CANCEL</button>
                <button type="button" id="btn-critical-launch" class="btn border border-red-900 bg-red-950/30 hover:bg-red-900/50 text-red-400 flex-1 py-3 font-orbitron tracking-widest transition-all duration-200 ease-in-out">LAUNCH ANYWAY</button>
            </div>
        `;

        let isProceeding = false;

        this.manager.queueModal('event-modal', '<span class="text-red-500">CRITICAL HULL DAMAGE</span>', htmlPayload, () => {
            // Callback fires if dismissed via outside click or Cancel button
            if (!isProceeding) {
                starfieldService.triggerQuickExit();
            }
        }, {
            dismissOutside: true,
            footer: null,
            theme: 'danger',
            customSetup: (modal, closeHandler) => {
                const cancelBtn = modal.querySelector('#btn-critical-cancel');
                const launchBtn = modal.querySelector('#btn-critical-launch');

                if (cancelBtn) {
                    cancelBtn.onclick = (e) => {
                        e.preventDefault();
                        closeHandler(); // Triggers modal closure and the onCloseCallback
                    };
                }

                if (launchBtn) {
                    launchBtn.onclick = (e) => {
                        e.preventDefault();
                        if (launchBtn.dataset.primed !== 'true') {
                            // Step 1: Prime the confirmation
                            launchBtn.dataset.primed = 'true';
                            launchBtn.classList.remove('bg-red-950/30', 'text-red-400', 'border-red-900', 'hover:bg-red-900/50');
                            launchBtn.classList.add('bg-red-700', 'text-white', 'border-red-500', 'hover:bg-red-600', 'shadow-[0_0_15px_rgba(239,68,68,0.8)]');
                            launchBtn.innerText = 'CONFIRM?';
                        } else {
                            // Step 2: Execute the travel sequence
                            isProceeding = true; // Prevent starfield teardown
                            closeHandler(); // Visually dismiss modal
                            this.manager.simulationService.travelTo(locationId, useFoldedDrive);
                        }
                    };
                }
            }
        });
    }
    // --- END PHASE 3/4 ---

    showRandomEventModal(event, choicesCallback) {
         const title = event.template?.title || event.title || 'Unknown Event';
         const description = event.template?.description || event.scenario || 'No description available.';

         this.manager.queueModal('random-event-modal', title, description, null, {
            nonDismissible: true,
            contentClass: 'text-center', // Enforce center alignment for Description
            specialClass: 'blur-fade-in', // Interruption blur-fade in cinematic
            customSetup: (modal, closeHandler) => {
                const choicesContainer = modal.querySelector('#random-event-choices-container');
                choicesContainer.innerHTML = '';
                
                event.choices.forEach((choice) => {
                    const button = document.createElement('button');
                    button.className = 'btn w-full p-4 hover:bg-slate-700 mb-2 event-choice-btn';
                    
                    if (choice.disabled) {
                        button.disabled = true;
                        button.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                    
                    const textMatch = (choice.text || choice.title || 'Option').match(/^(.*?)\s*(\(.*\))?$/);
                    const headerText = textMatch ? textMatch[1] : (choice.text || choice.title);
                    const subText = (textMatch && textMatch[2]) ? textMatch[2] : '';

                    let colorClass = 'text-gray-400'; 
                    if (subText) {
                        const lower = subText.toLowerCase();
                        if (lower.includes('space')) {
                            colorClass = 'text-req-yellow';
                        } else if (lower.includes('delay')) {
                            colorClass = 'text-delay-blue';
                        } else if (['credit', 'hull', 'fuel', 'ice', 'plasteel', 'processor', 'propellant', 'cybernetic', 'wealth', 'scrap', 'premium'].some(k => lower.includes(k))) {
                            colorClass = 'text-cost-orange';
                        }
                    }

                    button.innerHTML = `
                        <span class="choice-header">${headerText}</span>
                        ${subText ? `<span class="choice-subtext ${colorClass}">${subText}</span>` : ''}
                    `;
                    
                    if (choice.tooltip) {
                        button.setAttribute('title', choice.tooltip);
                    }

                    button.onclick = () => {
                        choicesCallback(choice.id);
                        closeHandler();
                     };
                    choicesContainer.appendChild(button);
                });
            }
        });
    }

    showAgeEventModal(event, choiceCallback) {
        const modal = document.getElementById('age-event-modal');
        modal.classList.add('dismiss-disabled');
        document.getElementById('age-event-title').innerHTML = event.title;
        document.getElementById('age-event-description').innerHTML = event.description;
        const btnContainer = document.getElementById('age-event-button-container');
        btnContainer.innerHTML = '';
        event.choices.forEach(choice => {
            const button = document.createElement('button');
             button.className = 'perk-button';
            button.innerHTML = `<h4>${choice.title}</h4><p>${choice.description}</p>`;
            button.onclick = () => {
                this.manager.hideModal('age-event-modal');
                choiceCallback(choice);
            };
            btnContainer.appendChild(button);
        });
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    showLoreModal(loreId) {
        const modal = this.manager.cache.loreModal;
        const contentEl = this.manager.cache.loreModalContent;
        
        if (!modal || !contentEl) {
             this.manager.logger.error('UIEventControl', 'Lore modal elements not cached or found in DOM.');
            return;
        }

        const loreEntry = LORE_REGISTRY[loreId];
        if (!loreEntry) {
            this.manager.logger.error('UIEventControl', `No lore content found for ID: ${loreId}`);
            contentEl.innerHTML = '<p>Error: Lore content not found.</p>';
        } else {
            // --- VIRTUAL WORKBENCH: Name Replacement & Viewed State ---
            const state = this.manager.lastKnownState;
            const playerName = state?.player?.name || 'Captain';
            
            // Mark as viewed if not already tracking
            if (this.manager.simulationService && this.manager.simulationService.gameState) {
                const liveState = this.manager.simulationService.gameState;
                if (!liveState.intelMarket.viewedLore) {
                    liveState.intelMarket.viewedLore = [];
                }
                if (!liveState.intelMarket.viewedLore.includes(loreId)) {
                    liveState.intelMarket.viewedLore.push(loreId);
                    liveState.setState({}); // Force UI refresh to remove glow
                }
            }
            
            contentEl.innerHTML = loreEntry.content.replace(/\[playerName\]/g, playerName);
            // --- END VIRTUAL WORKBENCH ---
        }
        
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        const closeHandler = (e) => {
            if (e.target.closest('#lore-modal-content') || e.target.id === 'lore-modal') {
                this.manager.hideModal('lore-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    showEulaModal() {
        const modal = this.manager.cache.eulaModal;
        const contentEl = this.manager.cache.eulaModalContent;
        
        if (!modal || !contentEl) {
            this.manager.logger.error('UIEventControl', 'EULA modal elements not cached or found in DOM.');
            return;
        }

        if (!EULA_CONTENT) {
            this.manager.logger.error('UIEventControl', 'EULA_CONTENT is not defined or empty.');
            contentEl.innerHTML = '<p>Error: EULA content not found.</p>';
        } else {
            contentEl.innerHTML = EULA_CONTENT;
        }
        
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        
        const closeHandler = (e) => {
            if (e.target.closest('#eula-modal-content') || e.target.id === 'eula-modal') {
                 this.manager.hideModal('eula-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    showLaunchModal(locationId) {
        const state = this.manager.lastKnownState;
        if (!state) return;

        const location = DB.MARKETS.find(l => l.id === locationId);
        if (!location) return;

        const theme = location.navTheme;
        const travelInfo = state.TRAVEL_DATA[state.currentLocationId]?.[locationId];
        const shipState = state.player.shipStates[state.player.activeShipId];

        if (!travelInfo) return;

        // --- VIRTUAL WORKBENCH (Phase 6): Folded Space Check ---
        const inventory = state.player.inventories[state.player.activeShipId] || {};
        const foldedDriveQty = inventory[COMMODITY_IDS.FOLDED_DRIVES]?.quantity || 0;
        
        // REMOVED `playerTier >= 7` constraint. Possession is the only requirement.
        const canFoldSpace = foldedDriveQty > 0;
        
        let foldSpaceHtml = '';
        if (canFoldSpace) {
             // [[REFINED]]: Split lines, centered, dynamic color
             foldSpaceHtml = `
                <div class="mt-4 flex flex-col items-center justify-center text-center space-y-1">
                    <div class="flex items-center justify-center space-x-2">
                        <input type="checkbox" id="fold-space-checkbox" class="w-5 h-5 cursor-pointer" style="accent-color: ${theme.borderColor};">
                        <label for="fold-space-checkbox" class="text-sm font-orbitron font-bold cursor-pointer select-none" style="color: ${theme.borderColor};">
                            FOLD SPACE
                        </label>
                    </div>
                    <div class="text-xs font-roboto-mono" style="color: ${theme.borderColor}; opacity: 0.9;">
                        (1x Folded Drive)
                    </div>
                </div>
            `;
        }
        // --- END VIRTUAL WORKBENCH ---

        const modalContentHtml = `
            <div class="launch-modal-wrapper panel-border" style="background: ${theme.gradient}; color: ${theme.textColor}; border-color: ${theme.borderColor}; --theme-glow-color: ${theme.borderColor};">
                <div class="flex-shrink-0">
                    <h3 class="font-orbitron">${location.name}</h3>
                     <p class="flavor-text italic text-base">${location.launchFlavor}</p>
                </div>

                <div class="flex-grow flex items-center justify-center flex-col">
                     <button id="btn-launch-travel" class="btn-launch-glow" data-action="travel" data-location-id="${locationId}" style="--launch-glow-color: ${theme.borderColor};">Launch</button>
                     ${foldSpaceHtml}
                </div>

                <div class="travel-info-text" id="launch-travel-info">
                     <p>Travel Time: ${travelInfo.time} Days</p>
                    <p>Fuel: ${Math.floor(shipState.fuel)} / ${travelInfo.fuelCost} required</p>
                </div>
            </div>`;

        const modal = this.manager.cache.launchModal;
        this.manager.cache.launchModalContent.innerHTML = modalContentHtml;
        modal.classList.remove('hidden');

        // --- VIRTUAL WORKBENCH: Event Listener for Checkbox ---
        if (canFoldSpace) {
            const checkbox = modal.querySelector('#fold-space-checkbox');
            const infoText = modal.querySelector('#launch-travel-info');
            const launchBtn = modal.querySelector('#btn-launch-travel');

            if (checkbox && infoText && launchBtn) {
                checkbox.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    
                    // Update Launch Button Dataset
                    launchBtn.dataset.useFoldedDrive = isChecked ? 'true' : 'false';
                    
                    // Update Info Text
                    if (isChecked) {
                        infoText.innerHTML = `
                            <p class="font-bold animate-pulse" style="color: ${theme.borderColor};">Travel Time: INSTANT (Warp)</p>
                            <p style="color: ${theme.borderColor};">Fuel: 0 (Folded Space)</p>
                        `;
                    } else {
                        infoText.innerHTML = `
                            <p>Travel Time: ${travelInfo.time} Days</p>
                            <p>Fuel: ${Math.floor(shipState.fuel)} / ${travelInfo.fuelCost} required</p>
                        `;
                    }
                });
            }
        }
        // --- END VIRTUAL WORKBENCH ---

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            const wrapper = modal.querySelector('.launch-modal-wrapper');
            if (wrapper) {
                 requestAnimationFrame(() => {
                     wrapper.classList.add('is-glowing');
                });
            }
            
            // Initiate Starfield Effect behind Launch Modal
            starfieldService.mount(document.body);
            starfieldService.triggerEntry();
        });

        const closeHandler = (e) => {
            if (e.target.id === 'launch-modal') {
                this.manager.hideModal('launch-modal');
                
                // Trigger quick exit transition upon explicit player dismissal
                starfieldService.triggerQuickExit();
                
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    showMapDetailModal(locationId) {
        const state = this.manager.lastKnownState;
        const location = DB.MARKETS.find(l => l.id === locationId);
        if (!location) return;

        const modal = this.manager.cache.mapDetailModal;
        const modalContent = modal.querySelector('.modal-content');
        const contentContainer = modal.querySelector('#map-modal-content-container');
        const theme = location.navTheme;

        modalContent.style.background = theme.gradient;
        modalContent.style.setProperty('--theme-glow-color', theme.borderColor);
        modal.dataset.theme = locationId;

        const imports = [];
        const exports = [];

        if (location.availabilityModifier) {
            for (const [commodityId, modifier] of Object.entries(location.availabilityModifier)) {
                  const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
                if (commodity) {
                    const tag = {
                        name: commodity.name,
                        style: getCommodityStyle(commodity.styleClass)
                    };
                    if (modifier < 1.0) {
                         imports.push(tag);
                    } else if (modifier > 1.0) {
                        exports.push(tag);
                    }
                }
            }
        }

        const renderTags = (tagArray) => tagArray.map(tag =>
             `<span class="commodity-tag" style="border-color: ${tag.style.hex}; background-color: ${tag.style.hex}20; color: ${tag.style.hex};">${tag.name}</span>`
         ).join('');

        let quirksHtml = '';
        if (location.specialty) {
            quirksHtml = `<p class="font-roboto-mono text-sm leading-relaxed imprinted-text-embedded" style="color: #facc15;">${location.specialty}</p>`;
        } else {
            quirksHtml = `<p class="font-roboto-mono imprinted-text-embedded">None reported</p>`;
        }

        // --- TUTORIAL GUARDRAIL CHECK ---
        const isMapNavLocked = state?.missions?.activeMissionIds?.some(id => ['mission_tutorial_04', 'mission_tutorial_05', 'mission_tutorial_06', 'mission_tutorial_07'].includes(id));
        const isCurrentLocation = state?.currentLocationId === locationId;
        const navigateBtnHtml = (isMapNavLocked || isCurrentLocation) ? '' : `<div class="map-navigate-btn" data-action="navigate-to-poi" data-location-id="${locationId}">NAVIGATE ❯❯</div>`;

        const contentHtml = `
            <div class="text-center">
                <h3 class="text-3xl font-orbitron" style="color: ${theme.textColor};">${location.name}</h3>
                 <p class="text-base italic imprinted-text">${location.description}</p>
            </div>

            <div class="my-4 space-y-3">
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Fuel Price</h5>
                    <p class="font-roboto-mono imprinted-text-embedded"><span class="credits-text-pulsing">${formatCredits(location.fuelPrice, true)}</span>/unit</p>
                 </div>
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Station Details</h5>
                    ${quirksHtml}
                </div>
          </div>
            
             <div class="text-center">
                 <div>
                    <h5 class="font-bold imprinted-text">Exports:</h5>
                    <div>${exports.length > 0 ? renderTags(exports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
                <div class="mt-2">
                     <h5 class="font-bold imprinted-text">Needs:</h5>
                     <div>${imports.length > 0 ? renderTags(imports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
                <div class="mt-6 mb-2">
                    ${navigateBtnHtml}
                </div>
            </div>
        `;

        contentContainer.innerHTML = contentHtml;
        modal.classList.remove('hidden');
        modal.classList.remove('is-glowing');

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            modal.classList.add('is-glowing');
        });

        const closeHandler = (e) => {
            if (e.target.id === 'map-detail-modal' || e.target.closest('.modal-content')) {
                  this.hideMapDetailModal();
                modal.removeEventListener('click', closeHandler); 
            }
        };
        requestAnimationFrame(() => {
             modal.addEventListener('click', closeHandler);
        });
    }

    hideMapDetailModal() {
        const modal = this.manager.cache.mapDetailModal;
        if (modal) {
             modal.classList.remove('is-glowing');
            delete modal.dataset.theme; 
            const existingHandler = modal.__mapDetailCloseHandler; 
            if(existingHandler) {
                modal.removeEventListener('click', existingHandler);
                delete modal.__mapDetailCloseHandler;
            }
        }
        this.manager.hideModal('map-detail-modal');
    }

    showCargoDetailModal(gameState, goodId) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        
        // --- FLEET OVERFLOW SYSTEM: AGGREGATE INVENTORY FOR MODAL ---
        let totalQty = 0;
        let totalCostValue = 0;
        
        for (const shipId of gameState.player.ownedShipIds) {
            const invItem = gameState.player.inventories[shipId]?.[goodId];
            if (invItem && invItem.quantity > 0) {
                totalQty += invItem.quantity;
                totalCostValue += invItem.quantity * invItem.avgCost;
            }
        }

        if (!good || totalQty === 0) return;

        const fleetItem = {
            quantity: totalQty,
            avgCost: totalCostValue / totalQty
        };
        // --- END FLEET OVERFLOW SYSTEM ---

        this.manager.queueModal('cargo-detail-modal', null, null, null, {
            dismissInside: true,
            dismissOutside: true,
             footer: null, 
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('#cargo-detail-content');
                 if (modalContent) {
                    modalContent.innerHTML = _renderMaxCargoModal(good, fleetItem);
                 }
            }
        });
    }

    /**
     * Spawns floating text over the UI, optionally using HTML and extended durations.
     * @param {string} text - The content to float
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {string} color - Hex or standard color string
     * @param {number} duration - Milliseconds the text should persist
     * @param {boolean} isHtml - If true, innerHTML is used instead of textContent
     */
    createFloatingText(text, x, y, color = '#fde047', duration = 2450, isHtml = false) {
        const el = document.createElement('div');
        if (isHtml) {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
        el.className = 'floating-text';
        el.style.left = `${x - 20}px`;
        el.style.top = `${y - 40}px`;
        el.style.color = color;
        el.style.animationDuration = `${duration}ms`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration);
    }

    showStrandedModal(originName, lostDays, callback) {
        const title = "Critical Failure: Stranded";
        const text = `Event delays and route deviations have pushed your fuel requirements beyond your current reserves. <br><br>Your engines sputter and die, leaving you drifting in the void. After <span class="text-result-time">${lostDays}</span> grueling days on emergency life support, a passing freighter tows you back to <b>${originName}</b>.<br><br>The rescue fees have drained your remaining fuel. Your arbitrage run has failed.`;
        
        const effects = [
            { type: 'EFF_FUEL', value: 0 }, 
            { type: 'EFF_TRAVEL_TIME', value: lostDays }
        ];

        this.showEventResultModal(title, text, effects, callback);
    }

    showEventResultModal(titleOrText, textOrEffects, effectsOrUndefined, callback) {
        let title, text, effects;
        let onDismiss = (typeof callback === 'function') ? callback : null;
        
        if (Array.isArray(effectsOrUndefined)) {
            title = titleOrText || 'System Alert';
            text = textOrEffects || '';
            effects = effectsOrUndefined;
        } 
        else if (Array.isArray(textOrEffects)) {
            title = 'System Alert'; 
            text = titleOrText || '';
            effects = textOrEffects;
            if (typeof effectsOrUndefined === 'function') {
                onDismiss = effectsOrUndefined;
            }
        } 
        else if (typeof titleOrText === 'string') {
             title = titleOrText;
             text = (typeof textOrEffects === 'string') ? textOrEffects : '';
             effects = [];
        }
        else {
             console.warn('[UIEventControl] Invalid arguments passed to showEventResultModal', { titleOrText, textOrEffects, effectsOrUndefined });
             title = 'System Alert'; 
             text = '';
             effects = [];
        }

        let effectsHtml = '';
        if (effects && effects.length > 0) {
            effectsHtml = '<ul class="list-none text-lg text-gray-300 mt-6 space-y-3 text-center">';
            effects.forEach(eff => {
                let effectText = '';
                const baseStyle = "font-medium";
                
                switch (eff.type) {
                    case 'EFF_CREDITS':
                        const isGain = eff.value > 0;
                        const sign = isGain ? '+' : '';
                        const creditClass = isGain ? 'text-result-credit-gain' : 'text-result-credit-loss';
                        
                        effectText = `<span class="${baseStyle} ${creditClass}">Credits: ${sign}${formatCredits(eff.value)}</span>`;
                        break;
                    case 'EFF_DEBT':
                        const isDebtGain = eff.value > 0;
                        const debtSign = isDebtGain ? '+' : '';
                        const debtClass = isDebtGain ? 'text-result-credit-loss' : 'text-result-credit-gain';
                        effectText = `<span class="${baseStyle} ${debtClass}">Debt: ${debtSign}${formatCredits(eff.value)}</span>`;
                        break;
                    case 'EFF_FUEL':
                        effectText = `<span class="${baseStyle} text-result-fuel">Fuel: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)}</span>`;
                        break;
                    case 'EFF_FULL_REFUEL':
                        effectText = `<span class="${baseStyle} text-result-fuel">Fuel Tanks Replenished</span>`;
                        break;
                    case 'EFF_HULL':
                        effectText = `<span class="${baseStyle} text-result-hull">Hull: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)}</span>`;
                        break;
                    case 'EFF_TRAVEL_TIME':
                    case 'EFF_MODIFY_TRAVEL':
                        effectText = `<span class="${baseStyle} text-result-time">Travel Time: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)} Days</span>`;
                        break;
                    case 'EFF_REDIRECT_TRAVEL':
                        effectText = `<span class="${baseStyle} text-yellow-400">Course Diverted</span>`;
                        break;
                    case 'EFF_ADD_ITEM':
                        const itemName = eff.addedItem || eff.target;
                        const itemQty = eff.addedQty || Math.round(eff.value);
                        effectText = `<span class="${baseStyle} text-result-cargo">Received: ${itemQty}x ${itemName}</span>`; 
                        break;
                    case 'EFF_REMOVE_ITEM':
                        effectText = `<span class="${baseStyle} text-result-cargo">Removed: ${Math.round(eff.value)}x ${eff.target}</span>`;
                        break;
                    case 'EFF_LOSE_RANDOM_CARGO':
                         effectText = `<span class="${baseStyle} text-result-cargo">Cargo Lost: ${Math.round(eff.value * 100)}%</span>`;
                         break;
                    case 'EFF_ADD_RANDOM_CARGO':
                        if (eff.addedItem && eff.addedQty) {
                             effectText = `<span class="${baseStyle} text-result-cargo">Received: ${eff.addedQty}x ${eff.addedItem}</span>`;
                        } else {
                             effectText = `<span class="${baseStyle} text-gray-500">No salvage recovered.</span>`;
                        }
                        break;
                    case 'EFF_ADD_UPGRADE':
                        if (eff.installedUpgrade) {
                             effectText = `<span class="${baseStyle} text-result-cargo">Installed: ${eff.installedUpgrade}</span>`;
                        } else {
                             effectText = `<span class="${baseStyle} text-gray-500">Upgrade already installed.</span>`;
                        }
                        break;
                    case 'EFF_UNLOCK_INTEL':
                        if (eff.intelLocation && eff.intelCommodity) {
                            effectText = `<span class="${baseStyle} text-req-yellow">Intel Acquired: ${eff.intelCommodity} at ${eff.intelLocation}</span>`;
                        } else {
                            effectText = `<span class="${baseStyle} text-gray-500">Encrypted Data Unreadable</span>`;
                        }
                        break;
                    default:
                         return;
                }
                effectsHtml += `<li>${effectText}</li>`;
            });
            effectsHtml += '</ul>';
        }

        this.manager.queueModal('event-result-modal', title, text + effectsHtml, onDismiss, {
            dismissOutside: false, 
            dismissInside: false,
            contentClass: 'text-center', 
            buttonText: 'Continue',
            exitClass: 'modal-blur-fade-out' // Blur-fade out into travel animation
        });
    }

    _renderCodexButtons(screenContainer) {
        const loreContainer = screenContainer.querySelector('#lore-button-container');
        if (!loreContainer) return;
        
        // --- VIRTUAL WORKBENCH: Name Replacement & Unread Glow Logic ---
        const state = this.manager.lastKnownState;
        const playerName = state?.player?.name || 'Captain';
        const viewedLore = state?.intelMarket?.viewedLore || [];
        
        loreContainer.innerHTML = Object.entries(LORE_REGISTRY).map(([id, data]) => {
            const title = data.title.replace(/\[playerName\]/g, playerName);
            const isUnread = !viewedLore.includes(id);
            const glowClass = isUnread ? 'unread-lore-glow' : '';
            
            return `<button class="btn btn-header ${glowClass}" data-action="show_lore" data-lore-id="${id}">
                        ${title}
                    </button>`;
        }).join('');
        // --- END VIRTUAL WORKBENCH ---
    }
}
