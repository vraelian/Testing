// js/services/ui/UIMissionControl.js
import { DB } from '../../data/database.js';
import { INTEL_CONTENT } from '../../data/intelContent.js';
import { formatCredits } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { GameAttributes } from '../GameAttributes.js';
import { OFFICERS } from '../../data/officers.js';

function getOfficerRarityHex(rarity) {
    switch (rarity) {
        case 'uncommon': return '#4ade80';
        case 'rare': return '#facc15';
        case 'very_rare': return '#fb923c';
        case 'hyper_rare': return '#f87171';
        case 'common':
        default: return '#94a3b8';
    }
}

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
                // Find first uncompleted objective
                firstObj = mission.objectives.find(obj => {
                    const localKey = obj.id || obj.goodId || obj.target;
                    const pObj = progress.objectives[localKey];
                    const locCurrent = pObj ? pObj.current : 0;
                    const locTarget = pObj ? pObj.target : (obj.quantity || obj.value || 1);
                    
                    if (['have_hull_pct', 'HAVE_HULL_PCT', 'have_cargo_pct', 'HAVE_CARGO_PCT'].includes(obj.type)) {
                        const comparator = obj.comparator || '>=';
                        if (comparator === '<=') return locCurrent > locTarget;
                        return locCurrent < locTarget;
                    }
                    return locCurrent < locTarget;
                });
                
                // Synthesize travel objective if all objectives are met but we are at the wrong location
                if (!firstObj) {
                    const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === gameState.currentLocationId;
                    
                    if (!isAtCorrectLocation) {
                        firstObj = { type: 'travel_to', target: mission.completion.locationId };
                        objKey = 'travel_fallback';
                        current = 0;
                        target = 1;
                    } else {
                        // Fully ready to turn in
                        firstObj = mission.objectives[mission.objectives.length - 1];
                    }
                }

                if (objKey !== 'travel_fallback') {
                    objKey = firstObj.id || firstObj.goodId || firstObj.target;
                    if (progress.objectives[objKey]) {
                        current = progress.objectives[objKey].current;
                        target = progress.objectives[objKey].target;
                    } else {
                         current = 0;
                         target = firstObj.quantity || firstObj.value || 1;
                    }
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

                // --- TELEMETRY DASHBOARD (CSS GRID) ---
                const objectivesEl = modal.querySelector('#mission-modal-objectives');
                const rewardsEl = modal.querySelector('#mission-modal-rewards');
                if (rewardsEl) rewardsEl.style.display = 'none'; // Hide native rewards block

                let flexColumns = [];
                let animDelayIdx = 0;

                // Evaluate Payout to inform Inbound stretching
                const hasPayout = (mission.rewards && mission.rewards.length > 0) || !!mission.officerReward;

                // 1. INBOUND (Granted Cargo / Intel / Credits)
                let inboundItems = [];
                if (mission.grantedCargo && mission.grantedCargo.length > 0) {
                    mission.grantedCargo.forEach(cargo => {
                        const name = DB.COMMODITIES.find(c => c.id === cargo.goodId)?.name || 'ITEM';
                        inboundItems.push(`<span class="t-qty">${cargo.quantity}x</span> <span class="t-subject">${name.toUpperCase()}</span>`);
                    });
                }
                if (mission.grantedIntel && mission.grantedIntel.length > 0) {
                    mission.grantedIntel.forEach(intel => {
                        inboundItems.push(`<span class="t-qty">1x</span> <span class="t-subject">${intel.name.toUpperCase()}</span>`);
                    });
                }
                if (mission.onAccept && mission.onAccept.length > 0) {
                    mission.onAccept.forEach(action => {
                        if (action.type === 'GRANT_CREDITS') {
                            inboundItems.push(`<span class="credits-text-pulsing">${formatCredits(action.amount, true)}</span> <span class="t-subject">GRANT</span>`);
                        }
                    });
                }

                if (inboundItems.length > 0) {
                    const inboundFullWidthClass = !hasPayout ? ' full-width' : '';
                    const grantedStr = inboundItems.map(item => {
                        const delay = animDelayIdx++ * 0.05;
                        return `<div class="telemetry-item" style="animation-delay: ${delay}s">${item}</div>`;
                    }).join('');
                    
                    flexColumns.push(`
                        <div class="telemetry-panel panel-inbound${inboundFullWidthClass}">
                            <div class="telemetry-header">INBOUND</div>
                            <div class="telemetry-content">${grantedStr}</div>
                        </div>
                    `);
                }

                // 2. PAYOUT (Rewards) - Dynamically spans if inbound is empty
                let payoutPanelHtml = '';
                if (hasPayout) {
                    let rewsList = '';
                    if (mission.rewards) {
                        rewsList += mission.rewards.map(r => {
                            const delay = animDelayIdx++ * 0.05;
                            let content = '';
                            if(r.type.toLowerCase() === 'credits') {
                                content = `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                            } else if(r.type.toLowerCase() === 'upgrade') {
                                const upgName = GameAttributes.getDefinition(r.id || r.target)?.name || 'SHIP UPGRADE';
                                content = `<span class="t-subject">${upgName.toUpperCase()}</span>`;
                            } else {
                                content = `<span class="t-subject">${r.type.toUpperCase()}</span>`;
                            }
                            return `<div class="telemetry-item payout-item" style="animation-delay: ${delay}s">${content}</div>`;
                        }).join('');
                    }

                    if (mission.officerReward) {
                        const offDef = OFFICERS[mission.officerReward];
                        if (offDef) {
                            const delay = animDelayIdx++ * 0.05;
                            const color = getOfficerRarityHex(offDef.rarity);
                            const content = `<span class="t-subject" style="color: ${color}; text-shadow: 0 0 5px ${color};">OFFICER: ${offDef.name.toUpperCase()}</span>`;
                            rewsList += `<div class="telemetry-item payout-item" style="animation-delay: ${delay}s">${content}</div>`;
                        }
                    }
                    
                    const fullWidthClass = inboundItems.length === 0 ? ' full-width' : '';
                    payoutPanelHtml = `
                        <div class="telemetry-panel panel-payout${fullWidthClass}">
                            <div class="telemetry-header">PAYOUT</div>
                            <div class="telemetry-content">${rewsList}</div>
                        </div>
                    `;
                }
                
                // Add Payout here to ensure CSS Grid layout orders correctly
                if (payoutPanelHtml) flexColumns.push(payoutPanelHtml);

                // Analyze Locations for Aggregate Destination block
                let uniqueDestinations = new Set();
                if (mission.objectives) {
                    mission.objectives.forEach(obj => {
                        if (['have_item', 'DELIVER_ITEM', 'travel_to', 'TRAVEL_TO'].includes(obj.type)) {
                            if (obj.target) uniqueDestinations.add(obj.target);
                        }
                    });
                }
                const hasSingleDestination = uniqueDestinations.size === 1;

                // 3. DIRECTIVE (Objectives)
                if (mission.objectives && mission.objectives.length > 0) {
                    const obsList = mission.objectives.map(obj => {
                        const delay = animDelayIdx++ * 0.05;
                        let text = this._getObjectiveDescription(obj, hasSingleDestination).toUpperCase();
                        
                        // Wrap preceding numbers and "x" in t-qty FIRST to avoid breaking HTML classes below
                        text = text.replace(/(\b\d+[xX]?\b)/g, '<span class="t-qty">$1</span>');
                        
                        // Append deposited info visually AFTER regex, with line break
                        if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
                            const objKey = obj.id || obj.goodId || obj.target;
                            const depositedAmt = progress?.objectives?.[objKey]?.deposited || 0;
                            const targetQty = obj.quantity || obj.value || 1;
                            if (depositedAmt > 0) {
                                text += `<br><span class="text-blue-400 font-bold">[DEPOSITED: ${depositedAmt}/${targetQty}]</span>`;
                            }
                        }
                        
                        return `<div class="telemetry-item" style="animation-delay: ${delay}s">${text}</div>`;
                    }).join('');
                    
                    flexColumns.push(`
                        <div class="telemetry-panel panel-directive">
                            <div class="telemetry-header">DIRECTIVE</div>
                            <div class="telemetry-content">${obsList}</div>
                        </div>
                    `);
                }

                // 4. DESTINATION (Extracted if unified)
                if (hasSingleDestination) {
                    const destId = Array.from(uniqueDestinations)[0];
                    const destName = DB.MARKETS.find(m => m.id === destId)?.name || 'UNKNOWN';
                    const delay = animDelayIdx++ * 0.05;
                    flexColumns.push(`
                        <div class="telemetry-panel panel-destination">
                            <div class="telemetry-header">DESTINATION</div>
                            <div class="telemetry-content">
                                <div class="telemetry-item" style="animation-delay: ${delay}s"><span class="t-subject">${destName.toUpperCase()}</span></div>
                            </div>
                        </div>
                    `);
                }

                if (flexColumns.length > 0) {
                    objectivesEl.innerHTML = `
                        <div class="telemetry-dashboard w-full my-4">
                            <div class="telemetry-grid">
                                ${flexColumns.join('')}
                            </div>
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

                // Generate structural wrappers if they don't already exist
                if (!wrapper && descEl && objectivesEl) {
                    outerWrapper = document.createElement('div');
                    outerWrapper.className = 'mission-scroll-outer w-full relative mb-2';
                    
                    wrapper = document.createElement('div');
                    wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto custom-scrollbar px-1 mb-2';
                    wrapper.style.maxHeight = '304px'; // 15% taller max-height
                    
                    descEl.parentNode.insertBefore(outerWrapper, descEl);
                    outerWrapper.appendChild(wrapper);
                    wrapper.appendChild(descEl);
                    wrapper.appendChild(objectivesEl);
                    
                    indicator = document.createElement('div');
                    indicator.className = 'scroll-indicator-arrow';
                    indicator.innerHTML = '&#8964;';
                    indicator.style.transition = 'opacity 0.2s ease-in-out';
                    outerWrapper.appendChild(indicator);
                }

                // Evaluate initial scroll state upon opening the modal securely binding listener
                if (wrapper && indicator) {
                    wrapper.onscroll = () => {
                        const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                        indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                    };
                    
                    wrapper.scrollTop = 0; // Immediate reset
                    setTimeout(() => {
                        wrapper.scrollTop = 0; // Strict layout lock reset
                        if (wrapper.scrollHeight > wrapper.clientHeight + 2) {
                            indicator.style.display = 'block';
                            const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                            indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                        } else {
                            indicator.style.display = 'none';
                            indicator.style.opacity = '0';
                        }
                    }, 150); // 150ms delay ensures DOM is fully painted and sized
                }

                const buttonsEl = modal.querySelector('#mission-modal-buttons');
                const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";
                
                if (isActive) {
                    const isAbandonable = mission.isAbandonable !== false;
                    let navButtonHtml = '';
                    let depositButtonHtml = '';
                    
                    if (isCompletable && !isAtCorrectLocation && mission.completion.locationId !== 'any') {
                        navButtonHtml = `<button id="mission-navigate-btn" class="btn w-full mt-2 btn-pulse-green" style="${btnStyles}">NAVIGATE >></button>`;
                    }
                    
                    if (isAtCorrectLocation) {
                        let canDeposit = false;
                        if (mission.objectives) {
                            mission.objectives.forEach(obj => {
                                if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
                                    const itemId = obj.goodId || obj.target;
                                    const objKey = obj.id || obj.goodId || obj.target;
                                    const targetQty = obj.quantity || obj.value || 1;
                                    const depositedAmt = progress?.objectives?.[objKey]?.deposited || 0;
                                    
                                    if (targetQty - depositedAmt > 0) {
                                        for (const shipId of gameState.player.ownedShipIds) {
                                            if (gameState.player.inventories[shipId]?.[itemId]?.quantity > 0) {
                                                canDeposit = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            });
                        }
                        
                        // Solid amber styling with static glow, no pulse animation
                        if (canDeposit) {
                            depositButtonHtml = `<button id="mission-deposit-btn" class="btn w-full mt-2 bg-amber-600/80 hover:bg-amber-500/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-white font-bold" style="${btnStyles}">DEPOSIT FREIGHT</button>`;
                        }
                    }
                    
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500" style="${btnStyles}" data-action="abandon-mission" data-mission-id="${mission.id}" ${!isAbandonable ? 'disabled' : ''}>Abandon Mission</button>${depositButtonHtml}${navButtonHtml}`;
                } else {
                     const btnText = shouldBeDisabled && missions.activeMissionIds.length >= 4 ? 'Mission Log Full (4/4)' : 'Accept';
                     buttonsEl.innerHTML = `<button class="btn w-full mission-action-btn" style="${btnStyles}" data-action="accept-mission" data-mission-id="${mission.id}" ${shouldBeDisabled ? 'disabled' : ''}>${btnText}</button>`;
                     
                     // INJECT SKIP TUTORIAL BUTTON HERE
                     if (mission.id === 'mission_tutorial_01') {
                         const skipBtn = document.createElement('button');
                         skipBtn.className = 'btn w-full bg-white text-black font-bold mt-2 hover:bg-gray-200';
                         skipBtn.style.cssText = btnStyles;
                         skipBtn.textContent = 'Skip Tutorial';
                         skipBtn.dataset.action = 'skip-tutorial';
                         buttonsEl.appendChild(skipBtn);
                     }
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
                
                const depositBtn = modal.querySelector('#mission-deposit-btn');
                if (depositBtn) {
                    depositBtn.addEventListener('click', (e) => {
                        if (this.manager.simulationService) {
                            const depositedAmt = this.manager.simulationService.missionService.depositMissionCargo(mission.id);
                            
                            if (depositedAmt > 0) {
                                // Extract bounding rect to ensure coordinates on mobile touch where clientX/Y might be missing
                                const rect = depositBtn.getBoundingClientRect();
                                const x = e.clientX || rect.left + (rect.width / 2);
                                const y = e.clientY || rect.top;
                                
                                this.manager.createFloatingText(`+${depositedAmt}`, x, y, '#ffffff');
                            }

                            // The modal now stays closed, seamlessly returning gameplay to the user without a forced refresh.
                            closeHandler();
                        }
                    });
                }
            }
        };
        if (mission.id === 'mission_tutorial_01' && tutorials.activeStepId === 'mission_1_1') {
            shouldBeDisabled = true;
        }
        this.manager.queueModal('mission-modal', parsedTitle, parsedDescription, null, options);
    }
    
    _getObjectiveDescription(obj, omitLocation = false) {
        if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             let text = `Deliver ${obj.quantity || 1}x ${name}`;
             if (obj.target && !omitLocation) {
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
             if (omitLocation) return `Establish Presence`;
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
               const hasStandardRewards = mission.rewards && mission.rewards.length > 0;
               const hasOfficerReward = !!mission.officerReward;
               
               if (hasStandardRewards || hasOfficerReward) {
                   let rewardsHtml = '';
                   if (hasStandardRewards) {
                       rewardsHtml += mission.rewards.map((r, i) => {
                            const delay = i * 0.1;
                            let content = '';
                            if(r.type.toLowerCase() === 'credits') {
                                content = `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                            } else if(r.type.toLowerCase() === 'upgrade') {
                                const upgName = GameAttributes.getDefinition(r.id || r.target)?.name || 'SHIP UPGRADE';
                                content = `<span class="t-subject">${upgName.toUpperCase()}</span>`;
                            } else {
                                content = `<span class="t-subject">${r.type.toUpperCase()}</span>`;
                            }
                            return `<div class="hero-payout-item w-full flex justify-center items-center text-center my-1 text-lg font-bold" style="animation-delay: ${delay}s">${content}</div>`;
                       }).join('');
                   }
                   
                   if (hasOfficerReward) {
                        const offDef = OFFICERS[mission.officerReward];
                        if (offDef) {
                            const delay = (mission.rewards?.length || 0) * 0.1;
                            const color = getOfficerRarityHex(offDef.rarity);
                            const content = `<span class="t-subject" style="color: ${color}; text-shadow: 0 0 5px ${color};">OFFICER: ${offDef.name.toUpperCase()}</span>`;
                            rewardsHtml += `<div class="hero-payout-item w-full flex justify-center items-center text-center my-1 text-lg font-bold" style="animation-delay: ${delay}s">${content}</div>`;
                        }
                   }
                   
                   rewardsEl.style.display = 'block';
                   rewardsEl.innerHTML = `
                        <div class="telemetry-dashboard hero-dashboard w-full my-4">
                            <div class="telemetry-panel panel-payout full-width flex flex-col items-center">
                                <div class="hero-header w-full text-center font-bold mb-2 tracking-widest text-lg">PAYOUT SECURED</div>
                                <div class="hero-content w-full flex flex-col items-center justify-center">${rewardsHtml}</div>
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
                    wrapper.style.maxHeight = '304px'; // 15% taller max-height
                    
                    descEl.parentNode.insertBefore(outerWrapper, descEl);
                    outerWrapper.appendChild(wrapper);
                    wrapper.appendChild(descEl);
                    if(objectivesEl) wrapper.appendChild(objectivesEl);
                    wrapper.appendChild(rewardsEl);
                    
                    indicator = document.createElement('div');
                    indicator.className = 'scroll-indicator-arrow';
                    indicator.innerHTML = '&#8964;';
                    indicator.style.transition = 'opacity 0.2s ease-in-out';
                    outerWrapper.appendChild(indicator);
               }

               // Evaluate initial scroll state upon opening the modal securely binding listener
               if (wrapper && indicator) {
                   wrapper.onscroll = () => {
                       const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                       indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                   };
                   
                   wrapper.scrollTop = 0; // Immediate reset
                   setTimeout(() => {
                       wrapper.scrollTop = 0; // Strict layout lock reset
                       if (wrapper.scrollHeight > wrapper.clientHeight + 2) {
                           indicator.style.display = 'block';
                           const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                           indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                       } else {
                           indicator.style.display = 'none';
                           indicator.style.opacity = '0';
                       }
                   }, 150); // 150ms delay ensures DOM is fully painted and sized
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
               
               // Inject Skip Tutorial button for mission_tutorial_01
               if (mission.id === 'mission_tutorial_01') {
                   const skipBtn = document.createElement('button');
                   skipBtn.className = 'btn w-full bg-white text-black font-bold mt-2 hover:bg-gray-200';
                   skipBtn.style.cssText = btnStyles;
                   skipBtn.textContent = 'Skip Tutorial';
                   skipBtn.dataset.action = 'skip-tutorial';
                   buttonsEl.appendChild(skipBtn);
               }
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