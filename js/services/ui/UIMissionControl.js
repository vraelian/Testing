// js/services/ui/UIMissionControl.js
import { DB } from '../../data/database.js';
import { INTEL_CONTENT } from '../../data/intelContent.js';
import { formatCredits } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { GameAttributes } from '../GameAttributes.js';

export class UIMissionControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Handles switching between the 'Terminal' and 'Mission Log' tabs.
     * @param {string} tabId - 'terminal' or 'log'
     */
    handleMissionTabSwitch(tabId) {
        if (tabId !== 'terminal' && tabId !== 'log') return;
        this.manager.lastKnownState.uiState.activeMissionTab = tabId;
        this.manager.render();
    }

    /**
     * Handles the user clicking the star icon to track a specific mission.
     * @param {string} missionId 
     */
    handleTrackMission(missionId) {
        if (!missionId) return;
        const gameState = this.manager.lastKnownState;
        gameState.missions.trackedMissionId = missionId;
        this.manager.render();
    }

    /**
     * Hides the sticky bar with a 1s fade-out animation to prevent sudden popping.
     */
    _hideStickyBarWithFade(el) {
        if (el.style.display !== 'none' && el.style.opacity !== '0') {
            el.style.transition = 'opacity 1s ease-out';
            el.style.opacity = '0';
            setTimeout(() => {
                if (el.style.opacity === '0') {
                    el.style.display = 'none';
                    el.style.transition = 'none';
                }
            }, 1000);
        }
    }

    /**
     * Renders the persistent "Sticky Bar" at the top of the UI for active missions.
     * @param {object} gameState 
     */
    renderStickyBar(gameState) {
        const stickyBarEl = this.manager.cache.missionStickyBar;
        const contentEl = stickyBarEl.querySelector('.sticky-content');
        const objectiveTextEl = this.manager.cache.stickyObjectiveText;
        const objectiveProgressEl = this.manager.cache.stickyObjectiveProgress;

        const activeMissionId = gameState.missions.trackedMissionId || gameState.missions.activeMissionIds[0];

        if (activeMissionId && gameState.missions.activeMissionIds.includes(activeMissionId)) {
            const mission = DB.MISSIONS[activeMissionId];
            
            // Immediately initiate fade out if the mission has no objectives
            if (!mission.objectives || mission.objectives.length === 0) {
                this._hideStickyBarWithFade(stickyBarEl);
                return;
            }
            
            const progress = gameState.missions.missionProgress[mission.id] || { objectives: {} };

            let objKey;
            let current = 0;
            let target = 1;
            let firstObj = null;
            
            if (mission.objectives) {
                // Find first uncompleted objective or default to the last objective
                firstObj = mission.objectives.find(obj => {
                    const localKey = obj.id || obj.goodId;
                    const pObj = progress.objectives[localKey];
                    const locCurrent = pObj ? pObj.current : 0;
                    const locTarget = pObj ? pObj.target : (obj.quantity || obj.value || 1);
                    
                    if (['have_hull_pct', 'HAVE_HULL_PCT', 'have_cargo_pct', 'HAVE_CARGO_PCT'].includes(obj.type)) {
                        const comparator = obj.comparator || '>=';
                        if (comparator === '<=') return locCurrent > locTarget;
                        return locCurrent < locTarget;
                    }
                    return locCurrent < locTarget;
                }) || mission.objectives[mission.objectives.length - 1];
                
                objKey = firstObj.id || firstObj.goodId;
                
                if (progress.objectives[objKey]) {
                    current = progress.objectives[objKey].current;
                    target = progress.objectives[objKey].target;
                } else {
                     current = 0;
                     target = firstObj.quantity || firstObj.value || 1;
                }
            }

            const objectiveLabel = this._getObjectiveLabel(firstObj);
            
            let displayStr = `[${current}/${target}]`;
            let percent = 0;
            
            if (firstObj) {
                if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(firstObj.type)) {
                    displayStr = `[${current}/${target}]`;
                    percent = Math.min(100, (current / (target || 100)) * 100);
                }
                else if (['have_hull_pct', 'HAVE_HULL_PCT'].includes(firstObj.type)) {
                    const comparator = firstObj.comparator || '>=';
                    displayStr = `[${current}/${target}]`;
                    if (comparator === '<=') {
                        percent = current <= target ? 100 : 0;
                    } else {
                        percent = Math.min(100, (current / (target || 100)) * 100);
                    }
                }
                else if (['have_cargo_pct', 'HAVE_CARGO_PCT'].includes(firstObj.type)) {
                    const comparator = firstObj.comparator || '>=';
                    displayStr = `[${current}% / ${comparator}${target}%]`;
                    percent = Math.min(100, current);
                }
                else if (['have_debt', 'HAVE_DEBT'].includes(firstObj.type)) {
                    displayStr = `[${formatCredits(current)}]`;
                    percent = current <= target ? 100 : 0;
                }
                else {
                    percent = Math.min(100, (current / target) * 100);
                }
            }

            objectiveTextEl.textContent = `${objectiveLabel}`;
            objectiveProgressEl.textContent = displayStr;

            const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-N]/g, '')}`;
            
            const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === gameState.currentLocationId;
            const isReady = progress.isCompletable && isAtCorrectLocation;
            
            let turnInClass = isReady ? 'mission-turn-in' : '';
            
            contentEl.className = `sticky-content ${hostClass} ${turnInClass}`;
            contentEl.style.background = '';
            contentEl.style.setProperty('--sticky-progress', `${percent}%`);

            // Apply solid visibility settings
            stickyBarEl.style.transition = 'none';
            stickyBarEl.style.opacity = '1';
            stickyBarEl.style.filter = 'none';
            stickyBarEl.style.webkitFilter = 'none';
            stickyBarEl.style.display = 'block';
        } else {
            this._hideStickyBarWithFade(stickyBarEl);
        }
    }

    _getObjectiveLabel(obj) {
        if (!obj) return 'Objective';
        if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             return `Deliver ${name}`;
        }
        if (obj.type === 'trade_item' || obj.type === 'TRADE_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === obj.goodId)?.name || 'Item';
             const action = obj.tradeType === 'buy' ? 'Buy' : 'Sell';
             return `${action} ${name}`;
        }
        if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') {
             const name = DB.MARKETS.find(m => m.id === obj.target)?.name || 'Location';
             return `Travel to ${name}`;
        }
        if (['have_debt', 'HAVE_DEBT'].includes(obj.type)) return 'Clear All Debt';
        if (obj.type === 'wealth_gt' || obj.type === 'WEALTH_CHECK') return `Earn Credits`;
        
        if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(obj.type)) return 'Refuel Ship';
        if (['have_hull_pct', 'HAVE_HULL_PCT'].includes(obj.type)) return 'Repair Hull';
        if (['have_cargo_pct', 'HAVE_CARGO_PCT'].includes(obj.type)) return 'Cargo Usage';
        if (['visit_screen', 'VISIT_SCREEN'].includes(obj.type)) {
            const screenTarget = obj.screenId ? obj.screenId.charAt(0).toUpperCase() + obj.screenId.slice(1).toLowerCase() : 'Screen';
            return `Visit ${screenTarget} Screen`;
        }
        
        return `Objective`;
    }

    flashObjectiveProgress() {
        const progressEl = this.manager.cache.stickyObjectiveProgress;
        if (progressEl) {
            progressEl.classList.add('objective-progress-flash');
            setTimeout(() => {
                progressEl.classList.remove('objective-progress-flash');
            }, 700);
        }
    }

    showMissionModal(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission) return;

        const { missions, currentLocationId } = this.manager.lastKnownState;
        
        const isActive = missions.activeMissionIds.includes(missionId);
        const progress = missions.missionProgress[missionId];
        const isCompletable = progress ? progress.isCompletable : false;

        const isLocationValid = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === currentLocationId;
        const canComplete = isActive && isCompletable && isLocationValid;

        if (canComplete) {
            this._showMissionCompletionModal(mission);
        } else {
            this._showMissionDetailsModal(mission);
        }
    }

    _showMissionDetailsModal(mission) {
        const gameState = this.manager.lastKnownState;
        const { missions, tutorials, currentLocationId } = gameState;
        const isActive = missions.activeMissionIds.includes(mission.id);
        
        const progress = missions.missionProgress[mission.id];
        const isCompletable = progress ? progress.isCompletable : false;
        const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === currentLocationId;
        
        let shouldBeDisabled = false;
        
        if (!isActive && missions.activeMissionIds.length >= 4) {
            shouldBeDisabled = true;
        }

        if (mission.id === 'mission_tutorial_02' && tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId !== 'mission_2_4') {
            shouldBeDisabled = true;
        }

        const parsedDescription = this._parseMissionText(mission.description, gameState);
        const parsedTitle = this._parseMissionText(mission.name, gameState);

        const options = {
            portraitId: mission.portraitId,
            dismissOutside: true, 
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('.modal-content');
                
                modalContent.classList.remove('modal-blur-fade-out');
                modal.classList.remove('backdrop-fade-out-slow', 'dismiss-disabled');

                modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
                const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-N]/g, '')}`;
                modalContent.classList.add(hostClass);

                const typeEl = modal.querySelector('#mission-modal-type');
                if (typeEl) {
                    typeEl.textContent = mission.type;
                    typeEl.style.display = 'block';
                    typeEl.style.fontSize = '0.65rem'; // Shrink type by 1pt
                }

                // --- HORIZONTAL TELEMETRY HUD (FLEX ROW) ---
                const objectivesEl = modal.querySelector('#mission-modal-objectives');
                const rewardsEl = modal.querySelector('#mission-modal-rewards');
                if (rewardsEl) rewardsEl.style.display = 'none'; // Hide native rewards block

                let flexColumns = [];

                // 1. INBOUND (Granted Cargo / Intel)
                let inboundItems = [];
                if (mission.grantedCargo && mission.grantedCargo.length > 0) {
                    mission.grantedCargo.forEach(cargo => {
                        const name = DB.COMMODITIES.find(c => c.id === cargo.goodId)?.name || 'ITEM';
                        inboundItems.push(`${cargo.quantity}x ${name.toUpperCase()}`);
                    });
                }
                if (mission.grantedIntel && mission.grantedIntel.length > 0) {
                    mission.grantedIntel.forEach(intel => {
                        inboundItems.push(`1x ${intel.name.toUpperCase()}`);
                    });
                }

                if (inboundItems.length > 0) {
                    const grantedStr = inboundItems.join('<br>');
                    flexColumns.push(`
                        <div class="flex-1 p-2 py-2 text-center flex flex-col justify-start">
                            <div class="text-[11px] text-gray-500 uppercase tracking-widest mb-2 font-bold">INBOUND</div>
                            <div class="text-sm text-gray-200 tracking-wide leading-tight">${grantedStr}</div>
                        </div>
                    `);
                }

                // 2. DIRECTIVE (Objectives)
                if (mission.objectives && mission.objectives.length > 0) {
                    const obsList = mission.objectives.map(obj => this._getObjectiveDescription(obj).toUpperCase()).join('<br>');
                    flexColumns.push(`
                        <div class="flex-1 p-2 py-2 text-center flex flex-col justify-start">
                            <div class="text-[11px] text-gray-500 uppercase tracking-widest mb-2 font-bold">DIRECTIVE</div>
                            <div class="text-sm text-gray-200 tracking-wide leading-tight">${obsList}</div>
                        </div>
                    `);
                }

                // 3. PAYOUT (Rewards)
                if (mission.rewards && mission.rewards.length > 0) {
                    const rewsList = mission.rewards.map(r => {
                        if(r.type.toLowerCase() === 'credits') return `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                        if(r.type.toLowerCase() === 'upgrade') {
                            const upgName = GameAttributes.getDefinition(r.id || r.target)?.name || 'SHIP UPGRADE';
                            return upgName.toUpperCase();
                        }
                        return r.type.toUpperCase();
                    }).join('<br>');
                    flexColumns.push(`
                        <div class="flex-1 p-2 py-2 text-center flex flex-col justify-start">
                            <div class="text-[11px] text-gray-500 uppercase tracking-widest mb-2 font-bold">PAYOUT</div>
                            <div class="text-lg text-yellow-400 tracking-wide leading-tight">${rewsList}</div>
                        </div>
                    `);
                }

                if (flexColumns.length > 0) {
                    objectivesEl.innerHTML = `
                        <div class="w-full flex flex-row justify-center items-stretch divide-x divide-gray-700/60 bg-gray-900/50 border border-gray-700/60 rounded-sm my-4 shadow-inner">
                            ${flexColumns.join('')}
                        </div>
                    `;
                    objectivesEl.style.display = 'block';
                } else {
                    objectivesEl.innerHTML = '';
                    objectivesEl.style.display = 'none';
                }

                // --- APPLY SCROLLABILITY WRAPPER ---
                const descEl = modal.querySelector('#mission-modal-description');
                let outerWrapper = modal.querySelector('.mission-scroll-outer');
                let wrapper = modal.querySelector('.mission-scroll-wrapper');
                let indicator = modal.querySelector('.scroll-indicator-arrow');

                // Generate structural wrappers if they don't already exist for this recycled modal
                if (!wrapper && descEl && objectivesEl) {
                    outerWrapper = document.createElement('div');
                    outerWrapper.className = 'mission-scroll-outer w-full relative mb-2';
                    
                    wrapper = document.createElement('div');
                    wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto custom-scrollbar px-1 mb-2';
                    wrapper.style.maxHeight = '264px'; // 20% taller max-height
                    
                    descEl.parentNode.insertBefore(outerWrapper, descEl);
                    outerWrapper.appendChild(wrapper);
                    wrapper.appendChild(descEl);
                    wrapper.appendChild(objectivesEl);
                    
                    indicator = document.createElement('div');
                    indicator.className = 'scroll-indicator-arrow';
                    indicator.innerHTML = '&#8964;';
                    outerWrapper.appendChild(indicator);
                    
                    wrapper.addEventListener('scroll', () => {
                        if (!indicator) return;
                        const distanceToBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight;
                        indicator.style.opacity = distanceToBottom < 10 ? '0' : '1';
                    });
                }

                // Evaluate initial scroll state upon opening the modal
                if (wrapper && indicator) {
                    wrapper.scrollTop = 0; // Reset scroll position for newly opened missions
                    setTimeout(() => {
                        if (wrapper.scrollHeight > wrapper.clientHeight + 2) {
                            indicator.style.display = 'block';
                            const distanceToBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight;
                            indicator.style.opacity = distanceToBottom < 10 ? '0' : '1';
                        } else {
                            indicator.style.display = 'none';
                            indicator.style.opacity = '0';
                        }
                    }, 50); // Small layout tick buffer
                }

                const buttonsEl = modal.querySelector('#mission-modal-buttons');
                const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";
                
                if (isActive) {
                    const isAbandonable = mission.isAbandonable !== false;
                    let navButtonHtml = '';
                    
                    if (isCompletable && !isAtCorrectLocation && mission.completion.locationId !== 'any') {
                        navButtonHtml = `<button id="mission-navigate-btn" class="btn w-full mt-2 btn-pulse-green" style="${btnStyles}">NAVIGATE >></button>`;
                    }
                    
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500" style="${btnStyles}" data-action="abandon-mission" data-mission-id="${mission.id}" ${!isAbandonable ? 'disabled' : ''}>Abandon Mission</button>${navButtonHtml}`;
                } else {
                     const btnText = shouldBeDisabled && missions.activeMissionIds.length >= 4 ? 'Mission Log Full (4/4)' : 'Accept';
                     buttonsEl.innerHTML = `<button class="btn w-full mission-action-btn" style="${btnStyles}" data-action="accept-mission" data-mission-id="${mission.id}" ${shouldBeDisabled ? 'disabled' : ''}>${btnText}</button>`;
                }

                const navBtn = modal.querySelector('#mission-navigate-btn');
                if (navBtn) {
                    navBtn.addEventListener('click', () => {
                        if (this.manager.simulationService) {
                            this.manager.simulationService.setScreen(NAV_IDS.SHIP, SCREEN_IDS.NAVIGATION);
                        }
                        setTimeout(() => {
                            this.manager.showLaunchModal(mission.completion.locationId);
                        }, 100);
                        closeHandler();
                    });
                }
            }
        };
        if (mission.id === 'mission_tutorial_01' && tutorials.activeStepId === 'mission_1_1') {
            shouldBeDisabled = true;
        }
        this.manager.queueModal('mission-modal', parsedTitle, parsedDescription, null, options);
    }
    
    _getObjectiveDescription(obj) {
        if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             let text = `Deliver ${obj.quantity || 1}x ${name}`;
             if (obj.target) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target)?.name || 'Unknown';
                 text += ` to ${locName}`;
             }
             return text;
        }
        if (obj.type === 'trade_item' || obj.type === 'TRADE_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === obj.goodId)?.name || 'Item';
             const action = obj.tradeType === 'buy' ? 'Buy' : 'Sell';
             return `${action} ${obj.quantity || 1}x ${name}`;
        }
        if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') {
             const name = DB.MARKETS.find(m => m.id === obj.target)?.name || 'Location';
             return `Travel to ${name}`;
        }
        if (['have_debt', 'HAVE_DEBT'].includes(obj.type)) return 'Clear All Debt';
        if (obj.type === 'wealth_gt' || obj.type === 'WEALTH_CHECK') {
             return `Amass ${formatCredits(obj.value)} Credits`;
        }
        if (obj.type === 'have_fuel_tank' || obj.type === 'HAVE_FUEL_TANK') {
            return `Refuel Ship`;
        }
        if (obj.type === 'have_hull_pct' || obj.type === 'HAVE_HULL_PCT') {
            return `Repair Hull`;
        }
        if (obj.type === 'visit_screen' || obj.type === 'VISIT_SCREEN') {
            const screenTarget = obj.screenId ? obj.screenId.charAt(0).toUpperCase() + obj.screenId.slice(1).toLowerCase() : 'Screen';
            return `Visit the ${screenTarget} Screen`;
        }
        return `Complete Objective`;
    }

    _showMissionCompletionModal(mission) {
        const gameState = this.manager.lastKnownState;
        
        let rewardVolume = 0;
        const hasUpgradeReward = mission.rewards && mission.rewards.some(r => r.type.toLowerCase() === 'upgrade');

        if (mission.rewards) {
            mission.rewards.forEach(r => {
                if (r.type === 'item' || r.type === 'cargo' || r.target) {
                    const isCommodity = DB.COMMODITIES.some(c => c.id === (r.goodId || r.target));
                    if (isCommodity) {
                        rewardVolume += (r.amount || r.quantity || 1);
                    }
                }
            });
        }

        let hasSpace = true;
        let capacityWarningHtml = '';

        if (rewardVolume > 0) {
            let totalFreeSpace = 0;
            if (gameState && gameState.player && gameState.player.ownedShipIds) {
                for (const shipId of gameState.player.ownedShipIds) {
                    const maxCap = this.manager.simulationService ? 
                        this.manager.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                        (DB.SHIPS[shipId]?.cargoCapacity || 100);
                    
                    let used = 0;
                    const inventory = gameState.player.inventories[shipId];
                    if (inventory) {
                        for (const item of Object.values(inventory)) {
                            used += (item.quantity || 0);
                        }
                    }
                    totalFreeSpace += Math.max(0, maxCap - used);
                }
            }
            if (rewardVolume > totalFreeSpace) {
                hasSpace = false;
                capacityWarningHtml = `
                    <div class="mt-4 p-2 bg-red-900/40 border border-red-500 rounded text-red-200 text-xs font-bold font-orbitron animate-pulse shadow-lg">
                        CARGO OVERFLOW: REQUIRES ${rewardVolume} SPACE (${Math.floor(totalFreeSpace)} AVAILABLE)
                    </div>
                `;
            }
        }

        const parsedTitle = this._parseMissionText(mission.completion.title, gameState);
        const parsedText = this._parseMissionText(mission.completion.text, gameState);

        const options = {
           portraitId: mission.portraitId,
           dismissOutside: true,
            customSetup: (modal, closeHandler) => {
               const modalContent = modal.querySelector('.modal-content');
               
               modalContent.classList.remove('modal-blur-fade-out');
               modal.classList.remove('backdrop-fade-out-slow', 'dismiss-disabled');

               modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
               const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-N]/g, '')}`;
               modalContent.classList.add(hostClass);

               modal.querySelector('#mission-modal-title').textContent = parsedTitle;
               
               const typeEl = modal.querySelector('#mission-modal-type');
               if (typeEl) {
                   typeEl.style.display = 'none';
               }
               
               modal.querySelector('#mission-modal-description').innerHTML = parsedText;

               const objectivesEl = modal.querySelector('#mission-modal-objectives');
               objectivesEl.style.display = 'none';

               const rewardsEl = modal.querySelector('#mission-modal-rewards');
               if (mission.rewards && mission.rewards.length > 0) {
                   const rewardsHtml = mission.rewards.map(r => {
                        if(r.type.toLowerCase() === 'credits') return `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                        if(r.type.toLowerCase() === 'upgrade') {
                            const upgName = GameAttributes.getDefinition(r.id || r.target)?.name || 'SHIP UPGRADE';
                            return upgName.toUpperCase();
                        }
                       return r.type.toUpperCase();
                   }).join('<br>');
                   
                   rewardsEl.style.display = 'block';
                   // Convert Completion Rewards to use the Telemetry HUD layout
                   rewardsEl.innerHTML = `
                        <div class="w-full flex flex-row justify-center items-stretch bg-gray-900/50 border border-gray-700/60 rounded-sm my-4 shadow-inner">
                            <div class="flex-1 p-2 py-2 text-center flex flex-col justify-start">
                                <div class="text-[11px] text-gray-500 uppercase tracking-widest mb-2 font-bold">PAYOUT SECURED</div>
                                <div class="text-lg text-yellow-400 tracking-wide leading-tight">${rewardsHtml}</div>
                            </div>
                        </div>
                   `;
               } else {
                   rewardsEl.innerHTML = '';
                   rewardsEl.style.display = 'none';
               }

               // --- APPLY SCROLLABILITY WRAPPER ---
               const descEl = modal.querySelector('#mission-modal-description');
               let outerWrapper = modal.querySelector('.mission-scroll-outer');
               let wrapper = modal.querySelector('.mission-scroll-wrapper');
               let indicator = modal.querySelector('.scroll-indicator-arrow');

               if (!wrapper && descEl && rewardsEl) {
                    outerWrapper = document.createElement('div');
                    outerWrapper.className = 'mission-scroll-outer w-full relative mb-2';
                    
                    wrapper = document.createElement('div');
                    wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto custom-scrollbar px-1 mb-2';
                    wrapper.style.maxHeight = '264px'; // 20% taller max-height
                    
                    descEl.parentNode.insertBefore(outerWrapper, descEl);
                    outerWrapper.appendChild(wrapper);
                    wrapper.appendChild(descEl);
                    if(objectivesEl) wrapper.appendChild(objectivesEl);
                    wrapper.appendChild(rewardsEl);
                    
                    indicator = document.createElement('div');
                    indicator.className = 'scroll-indicator-arrow';
                    indicator.innerHTML = '&#8964;';
                    outerWrapper.appendChild(indicator);
                    
                    wrapper.addEventListener('scroll', () => {
                        if (!indicator) return;
                        const distanceToBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight;
                        indicator.style.opacity = distanceToBottom < 10 ? '0' : '1';
                    });
               }

               // Evaluate initial scroll state upon opening the modal
               if (wrapper && indicator) {
                   wrapper.scrollTop = 0; // Reset scroll position
                   setTimeout(() => {
                       if (wrapper.scrollHeight > wrapper.clientHeight + 2) {
                           indicator.style.display = 'block';
                           const distanceToBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight;
                           indicator.style.opacity = distanceToBottom < 10 ? '0' : '1';
                       } else {
                           indicator.style.display = 'none';
                           indicator.style.opacity = '0';
                       }
                   }, 50);
               }

               const buttonsEl = modal.querySelector('#mission-modal-buttons');
               buttonsEl.innerHTML = '';
               
               const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";
               const completeBtn = document.createElement('button');
               completeBtn.className = hasSpace ? 'btn w-full mission-action-btn host-btn-pulse' : 'btn w-full bg-slate-700 text-gray-400 border-gray-600';
               completeBtn.textContent = hasSpace ? mission.completion.buttonText : 'INSUFFICIENT CARGO SPACE';
               completeBtn.style.cssText = btnStyles;
               completeBtn.disabled = !hasSpace;

               completeBtn.onclick = () => {
                   completeBtn.disabled = true;

                   modal.dataset.dismissOutside = 'false';
                   modal.classList.add('dismiss-disabled');

                   modalContent.classList.add('modal-blur-fade-out');
                   modal.classList.add('backdrop-fade-out-slow');

                   // Immediately begin 1.5s blur-fade on the background UI components
                   const card = document.querySelector(`.mission-card[data-mission-id="${mission.id}"]`);
                   const stickyBarEl = this.manager.cache.missionStickyBar;

                   if (stickyBarEl && stickyBarEl.style.display !== 'none') {
                       stickyBarEl.style.transition = 'opacity 1.5s ease-out, filter 1.5s ease-out, -webkit-filter 1.5s ease-out';
                       stickyBarEl.style.opacity = '0';
                       stickyBarEl.style.filter = 'blur(5px)';
                       stickyBarEl.style.webkitFilter = 'blur(5px)';
                   }

                   if (card) {
                       card.style.transition = 'opacity 1.5s ease-out, filter 1.5s ease-out, -webkit-filter 1.5s ease-out, transform 1.5s ease-out';
                       card.style.opacity = '0';
                       card.style.filter = 'blur(5px)';
                       card.style.webkitFilter = 'blur(5px)';
                       card.style.transform = 'scale(0.95)';
                   }

                   setTimeout(async () => {
                       modal.classList.add('hidden');
                       modal.classList.remove('modal-visible', 'dismiss-disabled', 'modal-blur-fade-out', 'backdrop-fade-out-slow');
                       delete modal.dataset.theme;
                       delete modal.dataset.dismissInside;
                       delete modal.dataset.dismissOutside;

                       if (this.manager.modalEngine && this.manager.modalEngine.modalQueue.length > 0) {
                           this.manager.modalEngine.processModalQueue();
                       }

                       if (stickyBarEl) {
                           stickyBarEl.style.transition = 'none';
                           stickyBarEl.style.filter = 'none';
                           stickyBarEl.style.webkitFilter = 'none';
                       }

                       const uiManager = this.manager;
                       const originalRender = uiManager.render;
                       
                       uiManager.render = function(...args) {
                           const newState = args[0] || uiManager.lastKnownState;
                           uiManager.lastKnownState = newState;

                           if (uiManager.missionControl) {
                               uiManager.missionControl.renderStickyBar(newState);
                           }

                           const activeTrackedId = newState.missions.trackedMissionId;
                           document.querySelectorAll('.mission-track-star').forEach(star => {
                               if (star.dataset.missionId === activeTrackedId) {
                                   star.classList.add('active');
                               } else {
                                   star.classList.remove('active');
                               }
                           });
                       };

                       if (this.manager.simulationService) {
                           this.manager.simulationService.missionService.completeMission(mission.id);
                       }
                       
                       uiManager.render = originalRender;
                       closeHandler();

                       if (hasUpgradeReward && this.manager.simulationService) {
                           // Navigate to Hangar Screen to watch the sequence play out
                           this.manager.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
                           
                           const activeShipId = uiManager.lastKnownState.player.activeShipId;
                           const shipIndex = uiManager.lastKnownState.player.ownedShipIds.indexOf(activeShipId);
                           
                           this.manager.simulationService.setHangarShipyardMode('hangar');
                           this.manager.simulationService.setHangarCarouselIndex(shipIndex !== -1 ? shipIndex : 0, 'hangar');
                           
                           await uiManager.orchestrateUpgradeSequence(activeShipId);
                       } else {
                           // --- FORCE RENDER ---
                           // Ensure the screen formally updates now that it is un-hijacked so 
                           // we can catch empty logs and the automatic Terminal switch
                           if (uiManager.lastKnownState) {
                               uiManager.render(uiManager.lastKnownState);
                           }
                       }

                       if (card) {
                           const height = card.offsetHeight;
                           const computedStyle = window.getComputedStyle(card);
                           const marginTop = computedStyle.marginTop;
                           const marginBottom = computedStyle.marginBottom;
                           const paddingTop = computedStyle.paddingTop;
                           const paddingBottom = computedStyle.paddingBottom;

                           card.style.overflow = 'hidden';
                           card.style.boxSizing = 'border-box';
                           card.style.backdropFilter = 'none';
                           card.style.webkitBackdropFilter = 'none';
                           card.style.boxShadow = 'none';
                           card.style.background = 'none';
                           card.style.border = 'none';
                           
                           const collapseAnim = card.animate([
                               { height: height + 'px', marginTop, marginBottom, paddingTop, paddingBottom },
                               { height: '0px', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }
                           ], { duration: 350, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });

                           collapseAnim.onfinish = () => {
                               card.remove(); 
                           };
                       }
                   }, 1500); // Trigger after the 1.5s fade finishes
               };
               buttonsEl.appendChild(completeBtn);
           }
        };
       this.manager.queueModal('mission-modal', parsedTitle, parsedText, null, options);
    }
    
     /**
     * Handles switching tabs within the Intel Screen (Codex vs Market).
     * @param {HTMLElement} element 
     */
    handleSetIntelTab(element) {
        const targetId = element.dataset.target;
        if (!targetId) return;

        if (this.manager.simulationService) {
            this.manager.simulationService.setIntelTab(targetId);
        }
    }

    /**
     * Updates the active class for Intel tabs in the DOM.
     * @param {string} activeTabId 
     */
    updateIntelTab(activeTabId) {
        const screen = this.manager.cache.intelScreen;
        if (!screen) return;
        
        const subNavBar = screen.querySelector('.sub-nav-bar');
        if (!subNavBar) return;
        
        screen.querySelectorAll('.sub-nav-button').forEach(btn => btn.classList.remove('active'));
        screen.querySelectorAll('.intel-tab-content').forEach(content => content.classList.remove('active'));
        const activeTabButton = screen.querySelector(`.sub-nav-button[data-target="${activeTabId}"]`);
        const activeContent = screen.querySelector(`#${activeTabId}`);

        if (activeTabButton) activeTabButton.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        if (activeTabId === 'intel-market-content') {
            subNavBar.classList.add('market-active');
        } else {
            subNavBar.classList.remove('market-active');
        }
    }

    /**
     * Prepares and shows the "Buy Intel" confirmation modal.
     * @param {HTMLElement} element 
     */
    handleShowIntelOffer(element) {
        const { packetId, locationId, price } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;
        
        const locationName = DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'a distant market';

        let msg;
        if (packet.messageKey) {
             msg = INTEL_CONTENT[packet.messageKey];
        } else if (packet.messageIndex !== undefined) {
            let msgArray = INTEL_CONTENT[packet.locationId]; 
            if (packet.fallbackMsg) { 
                msgArray = INTEL_CONTENT[packet.fallbackMsgSource];
            }
            if (!msgArray) {
                this.manager.logger.warn('UIMissionControl', `SaveCompat: No message array for ${packet.locationId}, using fallback.`);
                msgArray = INTEL_CONTENT["CORP_FAILURE_01"]; 
            }
            msg = msgArray ? msgArray[packet.messageIndex] : null;
        }

        const vagueText = (msg?.sample || "Intel available at [location name].")
            .replace('[location name]', locationName); 
        
        const priceNum = parseInt(price, 10);
        
        const purchaseButtonHTML = `
            <button class="btn btn-module btn-module-credit" 
                    data-action="buy_intel" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${locationId}" 
                    data-price="${priceNum}">
                Purchase Intel (<span class="credits-text-pulsing">${formatCredits(priceNum, true)}</span>)
            </button>`;

        this.manager.queueModal('event-modal', 'Intel Offer', vagueText, null, {
            theme: locationId, 
            dismissOutside: true, 
            footer: purchaseButtonHTML 
        });
    }

    /**
     * Executes the purchase of an intel packet.
     * @param {HTMLElement} element 
     * @param {Event} e 
     */
    handleBuyIntel(element, e) {
        const { packetId, locationId, price } = element.dataset;
        const priceNum = parseInt(price, 10);
        const purchasedPacket = this.manager.intelService.purchaseIntel(packetId, locationId, priceNum);

        if (purchasedPacket) {
            this.manager.hideModal('event-modal'); 
            
             if(e) {
                this.manager.createFloatingText(`-${formatCredits(priceNum, false)}`, e.clientX, e.clientY, '#f87171');
            }

            const updatedPacket = this._findIntelPacket(packetId, locationId);
            if (updatedPacket) {
                this._showIntelDetailsModal(updatedPacket, updatedPacket.pricePaid, locationId);
            }

        } else {
            this.manager.hideModal('event-modal');
            this.manager.queueModal('event-modal', 'Purchase Failed', 'Unable to purchase intel. You may already have an active deal or insufficient credits.');
        }
    }

    handleShowIntelDetails(element) {
        const { packetId, locationId } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;

        const price = packet.pricePaid || this.manager.intelService.calculateIntelPrice(packet);
        this._showIntelDetailsModal(packet, price, locationId);
    }

    _findIntelPacket(packetId, locationId) {
        const state = this.manager.lastKnownState;
        if (state.intelMarket[locationId]) {
            const packet = state.intelMarket[locationId].find(p => p.id === packetId);
            if (packet) return packet;
        }

        for (const locId of Object.keys(state.intelMarket)) {
            const packet = state.intelMarket[locId].find(p => p.id === packetId);
            if (packet) {
                return packet;
            }
        }
        
        this.manager.logger.error('UIMissionControl', `_findIntelPacket: Could not find packet ${packetId} anywhere.`);
        return null;
    }

    _showIntelDetailsModal(packet, price, locationId) {
        let detailsTemplate;
        let isNewFormat = false; 

        if (packet.messageKey) {
             detailsTemplate = INTEL_CONTENT[packet.messageKey]?.details || "No details found.";
            isNewFormat = true; 
        } else if (packet.messageIndex !== undefined) {
            this.manager.logger.warn('UIMissionControl', `SaveCompat: Found old packet with messageIndex ${packet.messageIndex}`);
            detailsTemplate = "Details for this expired intel packet are no longer available in the new system.";
        } else {
            const originalContent = {
                "CORPORATE_LIQUIDATION": { "details": "PACKET DECRYPTED: A [commodity name] surplus at [location name] allows for purchase at [discount amount %] below galactic average. This price is locked for [durationDays] days. A minor Corporate State is quietly liquidating assets to meet quarterly quotas. This is a standard, low-risk procurement opportunity. This intel was secured for [⌬ credit price]." },
                 "SUPPLY_CHAIN_SHOCK": { "details": "DATA UNLOCKED: [commodity name] is available at [location name] for [discount amount %] off standard pricing. This window is open for [durationDays] days. A Merchant's Guild freighter was damaged, forcing them to offload their cargo here at a loss. Their misfortune is your gain. This access was [⌬ credit price]." }
            };
            detailsTemplate = originalContent[packet.messageKey]?.details || "Packet is corrupted. No message data found.";
        }

        const formattedDetails = this._formatIntelDetails(detailsTemplate, packet, price, isNewFormat);

        this.manager.queueModal('event-modal', 'Intel Unlocked', formattedDetails, null, {
            theme: locationId, 
            dismissInside: true, 
            dismissOutside: true,
            
            customSetup: (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                if (btnContainer) {
                    btnContainer.innerHTML = `
                        <button class="btn btn-pulse-green w-full" id="intel-navigate-btn">
                            NAVIGATE TO ${packet.dealLocationId ? 'TARGET' : 'SYSTEM'}
                        </button>`;
                    
                    const btn = btnContainer.querySelector('#intel-navigate-btn');
                    if (btn) {
                        btn.addEventListener('click', () => {
                             if (this.manager.simulationService) {
                                 this.manager.simulationService.setScreen(NAV_IDS.SHIP, SCREEN_IDS.NAVIGATION);
                             }

                             if (packet.dealLocationId) {
                                 setTimeout(() => {
                                     this.manager.showLaunchModal(packet.dealLocationId);
                                 }, 100);
                             }

                             closeHandler();
                        });
                    }
                }
            }
        });
    }

    _formatIntelDetails(template, packet, price, isNewFormat) {
        const locationName = DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'an unknown location';
        const commodityName = DB.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'a mystery commodity';
        const discountStr = `${Math.floor(packet.discountPercent * 100)}%`;
        const priceStr = price ? formatCredits(-price, true) : '???';

        const currentDay = this.manager.intelService.getCurrentDay();
        const remainingDays = Math.max(0, (packet.expiryDay || 0) - currentDay);
        
        let durationStr;
        if (remainingDays === 0) {
            durationStr = "less than a day";
        } else if (remainingDays === 1) {
            durationStr = "1 day";
        } else {
            durationStr = `${remainingDays} days`;
        }
        
        let result = template
             .replace(/\[location name\]/g, locationName)
            .replace(/\[commodity name\]/g, commodityName)
            .replace(/\[discount amount %\]/g, discountStr);

        result = result.replace(/\[durationDays\]\s*days/g, durationStr); 
        result = result.replace(/\[durationDays\]/g, durationStr); 
        
        result = result.replace(/<span class="credits-text-pulsing">⌬ \[credit price\]<\/span>/g, `<span class="text-glow-red">${priceStr}</span>`);
        result = result.replace(/\[⌬ credit price\]/g, `<span class="text-glow-red">${priceStr}</span>`);

         return result;
    }

    // --- NEW HELPER: Dynamic Text Replacement ---
    _parseMissionText(text, gameState) {
        if (!text) return '';
        let parsedText = text;
        
        if (parsedText.includes('[playerName]')) {
            const pName = gameState.player?.name || 'Captain';
            parsedText = parsedText.replace(/\[playerName\]/g, pName);
        }
        
        if (parsedText.includes('[shipName]')) {
            const activeId = gameState.player?.activeShipId;
            const shipName = activeId && DB.SHIPS[activeId] ? DB.SHIPS[activeId].name : 'Vessel';
            parsedText = parsedText.replace(/\[shipName\]/g, shipName);
        }
        
        return parsedText;
    }
}