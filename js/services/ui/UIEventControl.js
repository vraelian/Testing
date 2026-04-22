// js/services/ui/UIEventControl.js
import { DB } from '../../data/database.js';
import { EULA_CONTENT } from '../../data/eulaContent.js';
import { LORE_REGISTRY } from '../../data/lore/loreRegistry.js';
import { formatCredits, getCommodityStyle } from '../../utils.js';
import { GameAttributes } from '../GameAttributes.js';
import { _renderMaxCargoModal } from '../../ui/components/CargoScreen.js';
import { COMMODITY_IDS, APP_VERSION } from '../../data/constants.js';
import { starfieldService } from './StarfieldService.js';
import { CRITICAL_HULL_WARNINGS } from '../../data/flavorAds.js';

export class UIEventControl {
    constructor(manager) {
        this.manager = manager;
    }

    showHotIntelModal(intelData) {
        const commodity = DB.COMMODITIES.find(c => c.id === intelData.commodityId);
        const commodityName = commodity ? commodity.name : intelData.commodityId;
        const discountPct = Math.round((1 - intelData.discountMultiplier) * 100);

        const htmlPayload = `
            <div class="text-lg text-gray-200 text-center">
                Data from the local exchange confirms an unexpected influx of <span class="text-result-cargo font-bold">${commodityName}</span>. To maintain market stability, vendors have authorized an immediate <span class="text-req-yellow font-bold">${discountPct}% discount</span> on all current inventory.
            </div>
        `;

        this.manager.queueModal('event-modal', 'Intel Acquired', htmlPayload, null, {
            dismissOutside: true,
            buttonText: 'Understood',
            theme: 'intel'
        });
    }

    showCriticalHullWarningModal(locationId, useFoldedDrive) {
        const state = this.manager.lastKnownState;
        const day = state?.day || 0;
        const shipId = state?.player?.activeShipId || 'unknown_ship';
        const currentLoc = state?.currentLocationId || 'unknown_loc';

        const seedString = `${day}_${currentLoc}_${shipId}`;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
            hash = (hash << 5) - hash + seedString.charCodeAt(i);
            hash |= 0; 
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
                        closeHandler(); 
                    };
                }

                if (launchBtn) {
                    launchBtn.onclick = (e) => {
                        e.preventDefault();
                        if (launchBtn.dataset.primed !== 'true') {
                            launchBtn.dataset.primed = 'true';
                            launchBtn.classList.remove('bg-red-950/30', 'text-red-400', 'border-red-900', 'hover:bg-red-900/50');
                            launchBtn.classList.add('bg-red-700', 'text-white', 'border-red-500', 'hover:bg-red-600', 'shadow-[0_0_15px_rgba(239,68,68,0.8)]');
                            launchBtn.innerText = 'CONFIRM?';
                        } else {
                            isProceeding = true; 
                            closeHandler(); 
                            this.manager.simulationService.travelTo(locationId, useFoldedDrive);
                        }
                    };
                }
            }
        });
    }

    /**
     * Executes the CRT instantiation and resolution sequence for Story Events.
     * Maps faction themes, injects character portraits, and supports both branching 
     * choice menus and simple linear dismissals.
     * @param {Object} eventDef - The definition object from STORY_EVENTS.
     * @param {Function} choicesCallback - Resolution hook passing the selected choice.id (or null if none).
     */
    showStoryEventModal(eventDef, choicesCallback) {
        const title = eventDef.title || 'Incoming Transmission';
        const description = eventDef.text || '';

        // Ensure backdrop is completely transparent to reveal starfield
        const targetModal = document.getElementById('story-event-modal');
        if (targetModal) {
            targetModal.style.transition = 'none';
            targetModal.style.backgroundColor = 'transparent';
            targetModal.style.backdropFilter = 'none';
        }

        this.manager.queueModal('story-event-modal', title, description, null, {
            nonDismissible: true,
            theme: eventDef.theme || 'default',
            portraitId: eventDef.portraitId,
            contentClass: 'text-center',
            noModalVisible: true, // Bypass standard CSS fade-in
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('.modal-content');
                
                // FORCE THEME APPLICATION (Overrides default engine if missed)
                if (eventDef.theme) {
                    modalContent.classList.add(`modal-theme-${eventDef.theme}`);
                }
                
                // Clean instantiation
                modalContent.classList.remove('sev-crt-shutdown');
                modalContent.classList.add('sev-crt-turn-on');
                modalContent.style.animationDuration = '0.4s';
                
                if (modalContent._crtTimeout) clearTimeout(modalContent._crtTimeout);
                modalContent._crtTimeout = setTimeout(() => {
                    modalContent.classList.remove('sev-crt-turn-on');
                    modalContent.style.animationDuration = '';
                }, 400);

                // --- SCROLLABILITY WRAPPER FOR STORY TEXT ---
                const descEl = modal.querySelector('[id$="-description"]');
                if (descEl) {
                    descEl.classList.add('text-[0.9rem]'); // Make text 1 point smaller
                    descEl.style.marginBottom = '0';
                    descEl.style.paddingBottom = '0';

                    let outerWrapper = modal.querySelector('.mission-scroll-outer');
                    if (!outerWrapper) {
                        outerWrapper = document.createElement('div');
                        outerWrapper.className = 'mission-scroll-outer w-full relative mt-2 mb-2';
                        
                        let wrapper = document.createElement('div');
                        wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-1 mb-0';
                        wrapper.style.maxHeight = '240px'; 
                        
                        descEl.parentNode.insertBefore(outerWrapper, descEl);
                        outerWrapper.appendChild(wrapper);
                        wrapper.appendChild(descEl);
                        
                        let indicator = document.createElement('div');
                        indicator.className = 'scroll-indicator-arrow';
                        indicator.innerHTML = '&#8964;';
                        indicator.style.transition = 'opacity 0.2s ease-in-out';
                        outerWrapper.appendChild(indicator);

                        wrapper.onscroll = () => {
                            const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                            indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                        };
                        
                        setTimeout(() => {
                            wrapper.scrollTop = 0;
                            if (wrapper.scrollHeight > wrapper.clientHeight + 2) {
                                indicator.style.display = 'block';
                                const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                                indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                            } else {
                                indicator.style.display = 'none';
                                indicator.style.opacity = '0';
                            }
                        }, 150);
                    }
                }

                // Locate containers using wildcard selector in case UIModalEngine appends IDs
                const choicesContainer = modal.querySelector('[id$="-choices-container"]');
                const btnContainer = modal.querySelector('[id$="-button-container"]');
                
                // Strip default heavy margins to tighten bottom padding
                if (btnContainer) {
                    btnContainer.classList.remove('mt-6', 'my-4', 'mb-6', 'mt-4');
                    btnContainer.classList.add('mt-2', 'mb-1');
                    btnContainer.style.paddingBottom = '0.25rem';
                }
                if (choicesContainer) {
                    choicesContainer.classList.remove('mt-6', 'my-4', 'mb-6', 'mt-4');
                    choicesContainer.classList.add('mt-2', 'mb-1');
                }
                
                if (choicesContainer) choicesContainer.innerHTML = '';
                if (btnContainer) btnContainer.innerHTML = '';

                const crtCloseHandler = (choiceId = null) => {
                    modalContent.classList.remove('sev-crt-turn-on');
                    modalContent.classList.add('sev-crt-shutdown');
                    modalContent.style.animationDuration = '0.35s';
                    
                    setTimeout(() => {
                        if (this.manager.modalEngine && this.manager.modalEngine.destroyModalInstant) {
                            this.manager.modalEngine.destroyModalInstant('story-event-modal');
                        } else {
                            modal.classList.add('hidden');
                        }
                        choicesCallback(choiceId);
                    }, 340);
                };

                // Generate Choice Buttons (Branching Event)
                if (eventDef.choices && eventDef.choices.length > 0 && choicesContainer && btnContainer) {
                    btnContainer.classList.add('hidden');
                    choicesContainer.classList.remove('hidden');

                    eventDef.choices.forEach((choice) => {
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
                            } else if (['credit', 'hull', 'fuel', 'ice', 'plasteel', 'processor', 'propellant', 'cybernetic', 'wealth', 'scrap', 'premium', 'damage', 'drain', 'stress'].some(k => lower.includes(k))) {
                                colorClass = 'text-cost-orange';
                            }
                        }

                        button.innerHTML = `
                            <span class="choice-header">${headerText}</span>
                            ${subText ? `<span class="choice-subtext ${colorClass}">${subText}</span>` : ''}
                        `;
                        
                        if (choice.tooltip) button.setAttribute('title', choice.tooltip);

                        button.onclick = () => crtCloseHandler(choice.id);
                        choicesContainer.appendChild(button);
                    });
                } 
                // Generate Single Dismissal Button (Linear Event)
                else if (choicesContainer && btnContainer) {
                    choicesContainer.classList.add('hidden');
                    btnContainer.classList.remove('hidden');
                    
                    const confirmBtn = document.createElement('button');
                    confirmBtn.className = 'btn px-6 py-2 w-full max-w-xs';
                    confirmBtn.innerHTML = eventDef.confirmText || 'Confirm';
                    confirmBtn.onclick = () => crtCloseHandler(null);
                    
                    btnContainer.appendChild(confirmBtn);
                }
            }
        });
    }

    showRandomEventModal(event, choicesCallback) {
         const title = event.template?.title || event.title || 'Unknown Event';
         const description = event.template?.description || event.scenario || 'No description available.';

         // Strip standard darkening to persist the starfield
         const targetModal = document.getElementById('random-event-modal');
         if (targetModal) {
             targetModal.style.transition = 'none';
             targetModal.style.backgroundColor = 'transparent';
             targetModal.style.backdropFilter = 'none';
         }

         this.manager.queueModal('random-event-modal', title, description, null, {
            nonDismissible: true,
            contentClass: 'text-center', 
            specialClass: 'blur-fade-in', 
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
                        } else if (['credit', 'hull', 'fuel', 'ice', 'plasteel', 'processor', 'propellant', 'cybernetic', 'wealth', 'scrap', 'premium', 'damage', 'drain', 'stress'].some(k => lower.includes(k))) {
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
            const state = this.manager.lastKnownState;
            const playerName = state?.player?.name || 'Captain';
            
            if (this.manager.simulationService && this.manager.simulationService.gameState) {
                const liveState = this.manager.simulationService.gameState;
                if (!liveState.intelMarket.viewedLore) {
                    liveState.intelMarket.viewedLore = [];
                }
                if (!liveState.intelMarket.viewedLore.includes(loreId)) {
                    liveState.intelMarket.viewedLore.push(loreId);
                    liveState.setState({}); 
                }
            }
            
            contentEl.innerHTML = loreEntry.content.replace(/\[playerName\]/g, playerName);
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

        const inventory = state.player.inventories[state.player.activeShipId] || {};
        const foldedDriveQty = inventory[COMMODITY_IDS.FOLDED_DRIVES]?.quantity || 0;
        
        const canFoldSpace = foldedDriveQty > 0;
        
        let foldSpaceHtml = '';
        if (canFoldSpace) {
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

        if (canFoldSpace) {
            const checkbox = modal.querySelector('#fold-space-checkbox');
            const infoText = modal.querySelector('#launch-travel-info');
            const launchBtn = modal.querySelector('#btn-launch-travel');

            if (checkbox && infoText && launchBtn) {
                checkbox.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    
                    launchBtn.dataset.useFoldedDrive = isChecked ? 'true' : 'false';
                    
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

        const toggleBackgroundUI = (opacity, pointerEvents) => {
            const elements = [
                document.getElementById('mission-sticky-bar'),
                document.getElementById('btn-econ-weather'),
                document.getElementById('global-help-anchor'),
                document.getElementById('btn-game-menu')
            ];
            elements.forEach(el => {
                if (el) {
                    el.style.transition = 'opacity 0.2s ease';
                    el.style.opacity = opacity;
                    el.style.pointerEvents = pointerEvents;
                }
            });
        };

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            const wrapper = modal.querySelector('.launch-modal-wrapper');
            if (wrapper) {
                 requestAnimationFrame(() => {
                     wrapper.classList.add('is-glowing');
                });
            }
            
            toggleBackgroundUI('0', 'none');

            starfieldService.mount(document.body);
            starfieldService.triggerEntry();
        });

        const closeHandler = (e) => {
            if (e.target.id === 'launch-modal') {
                this.manager.hideModal('launch-modal');
                
                starfieldService.triggerQuickExit();
                
                toggleBackgroundUI('1', 'auto');

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

        const isMapNavLocked = state?.missions?.activeMissionIds?.some(id => ['mission_tutorial_04', 'mission_tutorial_05', 'mission_tutorial_06', 'mission_tutorial_07'].includes(id));
        const isCurrentLocation = state?.currentLocationId === locationId;
        const navigateBtnHtml = (isMapNavLocked || isCurrentLocation) ? '' : `<div class="map-navigate-btn" data-action="navigate-to-poi" data-location-id="${locationId}">NAVIGATE ❯❯</div>`;

        // --- CONTEXTUAL STORY ACTIONS (HOOK PATTERN) ---
        const storyFlags = state?.player?.storyFlags || {};
        let storyActionsHtml = '';
        
        // Example implementation for contextual UI generation based on narrative state
        if (locationId === 'loc_exchange' && storyFlags['has_syndicate_access'] === true) {
            storyActionsHtml += `<div class="btn map-navigate-btn mt-2 !text-cost-orange !border-cost-orange hover:bg-cost-orange/20" data-action="trigger_story_event" data-event-id="evt_syndicate_boss">CONTACT SYNDICATE BOSS</div>`;
        }
        
        if (storyActionsHtml !== '') {
            storyActionsHtml = `
                <div class="mt-4 pt-4 border-t border-gray-700/50">
                    <h5 class="font-bold imprinted-text mb-2" style="color: ${theme.textColor};">Local Opportunities:</h5>
                    ${storyActionsHtml}
                </div>`;
        }

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
                    ${storyActionsHtml}
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
            { type: 'EFF_FUEL', actualChange: 0 }, 
            { type: 'EFF_TRAVEL_TIME', actualChange: lostDays }
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
             title = 'System Alert'; 
             text = '';
             effects = [];
        }

        // Strip standard darkening to persist the starfield
        const targetModal = document.getElementById('event-result-modal');
        if (targetModal) {
            targetModal.style.transition = 'none';
            targetModal.style.backgroundColor = 'transparent';
            targetModal.style.backdropFilter = 'none';
        }

        let pendingOverwriteId = null;
        let effectsHtml = '';
        
        if (effects && effects.length > 0) {
            effectsHtml = '<ul class="list-none text-lg text-gray-300 mt-6 space-y-3 text-center">';
            effects.forEach(eff => {
                let effectText = '';
                const baseStyle = "font-medium";
                
                switch (eff.type) {
                    case 'EFF_CREDITS':
                        const changeC = eff.actualChange || 0;
                        const isGain = changeC > 0;
                        const sign = isGain ? '+' : '';
                        const creditClass = isGain ? 'text-result-credit-gain' : 'text-result-credit-loss';
                        effectText = `<span class="${baseStyle} ${creditClass}">Credits: ${sign}${formatCredits(changeC)}</span>`;
                        break;
                    case 'EFF_DEBT':
                        const changeD = eff.actualChange || 0;
                        const isDebtGain = changeD > 0;
                        const debtSign = isDebtGain ? '+' : '';
                        const debtClass = isDebtGain ? 'text-result-credit-loss' : 'text-result-credit-gain';
                        effectText = `<span class="${baseStyle} ${debtClass}">Debt: ${debtSign}${formatCredits(changeD)}</span>`;
                        break;
                    case 'EFF_FUEL':
                        const changeF = eff.actualChange || 0;
                        effectText = `<span class="${baseStyle} text-result-fuel">Fuel: ${changeF > 0 ? '+' : ''}${changeF}</span>`;
                        break;
                    case 'EFF_FULL_REFUEL':
                        effectText = `<span class="${baseStyle} text-result-fuel">Fuel Tanks Replenished</span>`;
                        break;
                    case 'EFF_HULL':
                        const changeH = eff.actualChange || 0;
                        effectText = `<span class="${baseStyle} text-result-hull">Hull: ${changeH > 0 ? '+' : ''}${changeH}</span>`;
                        break;
                    case 'EFF_TRAVEL_TIME':
                    case 'EFF_MODIFY_TRAVEL':
                        const changeT = eff.actualChange || 0;
                        effectText = `<span class="${baseStyle} text-result-time">Travel Time: ${changeT > 0 ? '+' : ''}${changeT} Days</span>`;
                        break;
                    case 'EFF_REDIRECT_TRAVEL':
                        effectText = `<span class="${baseStyle} text-yellow-400">Course Diverted</span>`;
                        break;
                    case 'EFF_ADD_ITEM':
                        if (eff.failedTier) {
                            effectText = `<span class="${baseStyle} text-gray-500">However, without the proper Tier ${eff.requiredTier || 3} encryption keys it is inaccessible. You will have to abandon the cargo.</span>`;
                        } else if (eff.failedCapacity) {
                            effectText = `<span class="${baseStyle} text-gray-500">Fleet holds full! Cargo abandoned.</span>`;
                        } else if (eff.addedQty && eff.addedItem) {
                            effectText = `<span class="${baseStyle} text-result-cargo">Received: ${eff.addedQty}x ${eff.addedItem}</span>`; 
                        }
                        break;
                    case 'EFF_REMOVE_ITEM':
                        effectText = `<span class="${baseStyle} text-result-cargo">Removed: ${Math.round(eff.value)}x ${eff.target}</span>`;
                        break;
                    case 'EFF_LOSE_RANDOM_CARGO':
                         const totalLost = eff.actualChange || 0;
                         effectText = `<span class="${baseStyle} text-result-cargo">Cargo Lost: ${totalLost} Units</span>`;
                         if (eff.lostItems && eff.lostItems.length > 0) {
                             effectText += `<br><span class="text-sm text-gray-500 mt-1 block">`;
                             eff.lostItems.forEach(item => {
                                 effectText += `-${item.qty} ${item.name}<br>`;
                             });
                             effectText += `</span>`;
                         }
                         break;
                    case 'EFF_ADD_RANDOM_CARGO':
                        if (eff.failedTier) {
                            effectText = `<span class="${baseStyle} text-gray-500">However, without the proper Tier encryption keys it is inaccessible. You will have to abandon the cargo.</span>`;
                        } else if (eff.failedCapacity) {
                            effectText = `<span class="${baseStyle} text-gray-500">Fleet holds full! Cargo abandoned.</span>`;
                        } else if (eff.addedQty && eff.targetName) {
                             effectText = `<span class="${baseStyle} text-result-cargo">Received: ${eff.addedQty}x ${eff.targetName}</span>`;
                        } else {
                             effectText = `<span class="${baseStyle} text-gray-500">No salvage recovered.</span>`;
                        }
                        break;
                    case 'EFF_ADD_UPGRADE':
                        if (eff.installedUpgrade) {
                             effectText = `<span class="${baseStyle} text-result-cargo">Installed: ${eff.installedUpgrade}</span>`;
                        } else if (eff.pendingOverwrite) {
                             pendingOverwriteId = eff.pendingOverwrite;
                             effectText = `<span class="${baseStyle} text-orange-400">Upgrade Pending Installation</span>`;
                        } else if (eff.failedUpgrade) {
                             effectText = `<span class="${baseStyle} text-gray-500">Upgrade ${eff.targetName} already installed. Salvaged for parts.</span>`;
                        }
                        break;
                    case 'EFF_APPLY_STATUS':
                        const sName = eff.statusName || 'Unknown';
                        effectText = `<span class="${baseStyle} text-red-500">Ship Status: + ${sName}</span>`;
                        break;
                    case 'EFF_UNLOCK_INTEL':
                        if (eff.failedIntel) {
                            effectText = `<span class="${baseStyle} text-gray-500">Data corrupted. You can only maintain one active intel deal. Items expended during this attempt have been refunded.</span>`;
                        } else if (eff.intelLocation && eff.intelCommodity) {
                            effectText = `<span class="${baseStyle} text-req-yellow">Intel Acquired: ${eff.intelCommodity} at ${eff.intelLocation}</span>`;
                        } else {
                            effectText = `<span class="${baseStyle} text-gray-500">Encrypted Data Unreadable</span>`;
                        }
                        break;
                    case 'GRANT_HOT_INTEL':
                        effectText = `<span class="${baseStyle} text-req-yellow">Hot Intel: ${eff.discountPct}% off ${eff.intelCommodity} at ${eff.intelLocation}</span>`;
                        break;
                    case 'GRANT_OFFICER':
                        if (eff.installedOfficer) {
                             effectText = `<span class="${baseStyle} text-green-400">Recruited Officer: ${eff.installedOfficer}</span>`;
                        } else if (eff.failedOfficer) {
                             effectText = `<span class="${baseStyle} text-gray-500">Officer ${eff.officerName} is already in your roster.</span>`;
                        }
                        break;
                    default:
                         if (eff.type === 'EFF_QUEUE_EVENT') return; 
                         return;
                }
                if (effectText) {
                    effectsHtml += `<li>${effectText}</li>`;
                }
            });
            effectsHtml += '</ul>';
        }

        const originalOnDismiss = onDismiss;
        onDismiss = () => {
            if (pendingOverwriteId) {
                const state = this.manager.lastKnownState;
                const activeShip = state?.player?.activeShipId;
                const shipState = state?.player?.shipStates[activeShip];
                
                const hangarCtrl = this.manager.hangarControl || this.manager.uiHangarControl;
                
                if (shipState && hangarCtrl) {
                    hangarCtrl.showUpgradeInstallationModal(
                        pendingOverwriteId, 
                        { source: 'mission' }, 
                        shipState, 
                        async (idxToRemove) => {
                            if (idxToRemove !== -1) {
                                shipState.upgrades.splice(idxToRemove, 1);
                            }
                            shipState.upgrades.push(pendingOverwriteId);
                            this.manager.simulationService.logger.info.player(state.day, 'REWARD_UPGRADE', `Installed overwrite upgrade: ${pendingOverwriteId}`);
                            
                            state.uiState.hangarShipyardToggleState = 'hangar';
                            const shipIndex = state.player.ownedShipIds.indexOf(activeShip);
                            state.uiState.hangarActiveIndex = shipIndex !== -1 ? shipIndex : 0;
                            
                            await this.manager.orchestrateUpgradeSequence(activeShip);
                            this.manager.simulationService.gameState.setState({});
                            
                            if (originalOnDismiss) originalOnDismiss();
                        },
                        () => {
                            if (originalOnDismiss) originalOnDismiss();
                        }
                    );
                } else {
                    if (originalOnDismiss) originalOnDismiss();
                }
            } else {
                if (originalOnDismiss) originalOnDismiss();
            }
        };

        this.manager.queueModal('event-result-modal', title, text + effectsHtml, onDismiss, {
            dismissOutside: false, 
            dismissInside: false,
            contentClass: 'text-center', 
            buttonText: 'Continue',
            exitClass: 'modal-blur-fade-out' 
        });
    }

    _renderCodexButtons(screenContainer) {
        const loreContainer = screenContainer.querySelector('#lore-button-container');
        if (!loreContainer) return;
        
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
    }

    showPauseMenu() {
        const modal = document.getElementById('pause-menu-modal');
        if (!modal) return;
        
        const state = this.manager.lastKnownState;
        const locationId = state?.currentLocationId || 'loc_earth';
        const location = DB.MARKETS.find(l => l.id === locationId);

        const modalContent = modal.querySelector('.modal-content');
        
        modalContent.className = 'modal-content relative flex flex-col items-center justify-between p-8';
        
        if (location && location.navTheme) {
            modalContent.style.background = location.navTheme.gradient;
            modalContent.style.borderColor = location.navTheme.borderColor;
            modalContent.style.boxShadow = `0 10px 25px rgba(0,0,0,0.5), inset 0 0 15px ${location.navTheme.borderColor}40`;
        }

        const versionEl = document.getElementById('pause-menu-version');
        if (versionEl) versionEl.innerText = `Version ${APP_VERSION}`;

        const saveBtn = document.getElementById('pause-btn-save');
        if (saveBtn) {
            saveBtn.className = 'btn w-full py-3 text-lg';
            saveBtn.innerHTML = 'Save Progress';
            saveBtn.disabled = false;
        }

        const exitBtn = document.getElementById('pause-btn-exit');
        if (exitBtn) {
            exitBtn.className = 'btn w-full py-3 text-lg';
            exitBtn.innerHTML = 'Exit Game';
            exitBtn.dataset.action = 'exit-game-init';
        }

        modal.classList.remove('hidden', 'modal-hiding');
        modalContent.classList.remove('sev-crt-shutdown');
        modalContent.classList.add('sev-crt-turn-on');
        modalContent.style.animationDuration = '0.4s';

        this._pauseMenuCloseHandler = (e) => {
            if (e.target === modal) {
                this.hidePauseMenu();
            }
        };
        modal.addEventListener('click', this._pauseMenuCloseHandler);
    }

    hidePauseMenu() {
        const modal = document.getElementById('pause-menu-modal');
        if (!modal) return;

        const modalContent = modal.querySelector('.modal-content');
        
        modalContent.classList.remove('sev-crt-turn-on');
        void modalContent.offsetWidth; 
        modalContent.classList.add('sev-crt-shutdown');
        modalContent.style.animationDuration = '0.4s';

        if (this._pauseMenuCloseHandler) {
            modal.removeEventListener('click', this._pauseMenuCloseHandler);
            this._pauseMenuCloseHandler = null;
        }

        setTimeout(() => {
            modal.classList.add('hidden');
            modalContent.classList.remove('sev-crt-shutdown');
            modalContent.style.animationDuration = '';
        }, 400); 
    }
}