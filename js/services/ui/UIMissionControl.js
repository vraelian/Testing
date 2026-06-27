// js/services/ui/UIMissionControl.js
import { DB } from '../../data/database.js';
import { INTEL_CONTENT } from '../../data/intelContent.js';
import { formatCredits, renderIndicatorPills } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { GameAttributes } from '../GameAttributes.js';
import { OFFICERS } from '../../data/officers.js';
import { startLicenseAnimation, endLicenseAnimation } from './AnimationService.js';
import { ACT_CINEMATIC_CONFIG } from './UIEventControl.js';
import CinematicService from './CinematicService.js';

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

function formatShortCredits(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
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
     * Hides the sticky bar with a 0.6s fade-out animation to prevent sudden popping.
     */
    _hideStickyBarWithFade(el) {
        if (el.style.display !== 'none' && el.style.opacity !== '0') {
            el.style.transition = 'opacity 0.6s ease-out';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none'; // Immediately release the click mask
            setTimeout(() => {
                if (el.style.opacity === '0') {
                    el.style.display = 'none';
                    el.style.transition = 'none';
                }
            }, 600);
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

        // Hide if a travel sequence is active, launch modal is open, or on hangar screen
        const launchModal = this.manager.cache.launchModal;
        const isLaunchModalOpen = launchModal && !launchModal.classList.contains('hidden');

        if (gameState.pendingTravel || gameState.isTraveling || isLaunchModalOpen || gameState.activeScreen === SCREEN_IDS.HANGAR) {
            this._hideStickyBarWithFade(stickyBarEl);
            return;
        }

        const activeMissionId = gameState.missions.trackedMissionId || gameState.missions.activeMissionIds[0];

        if (activeMissionId && gameState.missions.activeMissionIds.includes(activeMissionId)) {
            const mission = DB.MISSIONS[activeMissionId];
            const progress = gameState.missions.missionProgress[mission.id] || { objectives: {} };
            
            const isLogisticsPickupPhase = mission.deferredCargo && mission.deferredCargo.length > 0 && !progress.cargoLoaded;
            
            // Immediately initiate fade out if the mission has no objectives (and isn't in pickup phase)
            if (!isLogisticsPickupPhase && (!mission.objectives || mission.objectives.length === 0)) {
                this._hideStickyBarWithFade(stickyBarEl);
                return;
            }
            
            let objKey;
            let current = 0;
            let target = 1;
            let firstObj = null;
            let customObjectiveLabel = null;
            
            // Logistics Phase Intercept
            if (isLogisticsPickupPhase) {
                const pickupLocName = DB.MARKETS.find(m => m.id === mission.pickupLocationId)?.name || 'Unknown';
                let totalCargo = 0;
                mission.deferredCargo.forEach(c => totalCargo += c.quantity);

                if (gameState.currentLocationId === mission.pickupLocationId) {
                    firstObj = { type: 'LOGISTICS_LOAD' };
                    customObjectiveLabel = `Load up cargo for delivery`;
                    current = 0;
                    target = totalCargo;
                } else {
                    firstObj = { type: 'TRAVEL_TO', target: mission.pickupLocationId };
                    customObjectiveLabel = `Travel to ${pickupLocName}`;
                    current = 0;
                    target = 1;
                }
            } else if (mission.objectives) {
                // Find first uncompleted AND UNLOCKED objective
                firstObj = mission.objectives.find(obj => {
                    // Check for Sequential Dependency Gating
                    if (obj.dependsOn) {
                        const depProgress = progress.objectives[obj.dependsOn];
                        if (!depProgress || depProgress.current < depProgress.target) {
                            return false; // Objective is locked, skip rendering it to the sticky bar
                        }
                    }

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

            const objectiveLabel = customObjectiveLabel || this._getObjectiveLabel(firstObj);
            
            let displayStr = `[${current}/${target}]`;
            let percent = 0;
            
            if (firstObj) {
                if (firstObj.type === 'LOGISTICS_LOAD') {
                    percent = 0;
                }
                else if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(firstObj.type)) {
                    displayStr = `[${current}/${target}]`;
                    percent = Math.min(100, (current / (target || 100)) * 100);
                }
                else if (['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(firstObj.type)) {
                    displayStr = `[ <span class="text-cyan-400 font-bold">⌬ ${formatShortCredits(current)} / ${formatShortCredits(target)}</span> ]`;
                    percent = Math.min(100, (current / target) * 100);
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

            // Inject as HTML to support the cyan credit styling
            objectiveTextEl.innerHTML = `${objectiveLabel}`;
            objectiveProgressEl.innerHTML = displayStr;

            const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            
            const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === gameState.currentLocationId;
            const isReady = progress.isCompletable && isAtCorrectLocation && !isLogisticsPickupPhase;
            
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
            stickyBarEl.style.pointerEvents = 'auto';
        } else {
            this._hideStickyBarWithFade(stickyBarEl);
        }
    }

    _getObjectiveLabel(obj) {
        if (!obj) return 'Objective';
        if (obj.type === 'DELIVER_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             if (obj.target && DB.MARKETS.find(m => m.id === obj.target)) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                 return `Deliver ${name} to ${locName}`;
             }
             return `Deliver ${name}`;
        }
        if (obj.type === 'collect_item' || obj.type === 'COLLECT_ITEM') {
            const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.targetLoc || obj.target))?.name || 'Item';
            if (obj.target && DB.MARKETS.find(m => m.id === obj.target)) {
                const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                return `Collect ${name} on ${locName}`;
            }
            return `Collect ${name}`;
        }
        if (obj.type === 'have_item' || obj.type === 'HAVE_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             return `Procure ${name}`;
        }
        if (obj.type === 'trade_item' || obj.type === 'TRADE_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === obj.goodId)?.name || 'Item';
             const action = obj.tradeType === 'buy' ? 'Buy' : 'Sell';
             if (obj.target && DB.MARKETS.find(m => m.id === obj.target)) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                 return `${action} ${name} on ${locName}`;
             }
             return `${action} ${name}`;
        }
        if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') {
             const name = DB.MARKETS.find(m => m.id === obj.target)?.name || 'Location';
             return `Travel to ${name}`;
        }
        if (['have_debt', 'HAVE_DEBT'].includes(obj.type)) return 'Clear All Debt';
        if (['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(obj.type)) {
             return `Amass <span class="text-cyan-400 font-bold">⌬ ${formatShortCredits(obj.value || obj.quantity)}</span>`;
        }
        
        if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(obj.type)) return 'Refuel Ship';
        if (['have_hull_pct', 'HAVE_HULL_PCT'].includes(obj.type)) return 'Repair Hull';
        if (['have_cargo_pct', 'HAVE_CARGO_PCT'].includes(obj.type)) return 'Cargo Usage';
        if (['visit_screen', 'VISIT_SCREEN'].includes(obj.type)) {
            const screenTarget = obj.screenId ? obj.screenId.charAt(0).toUpperCase() + obj.screenId.slice(1).toLowerCase() : 'Screen';
            return `Visit ${screenTarget} Screen`;
        }
        if (obj.type === 'own_ship_class' || obj.type === 'OWN_SHIP_CLASS') {
            return `Acquire Class ${obj.target} Vessel`;
        }
        if (obj.type === 'action' || obj.type === 'ACTION') {
            return (obj.target || 'Complete Action').toUpperCase();
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

        const gameState = this.manager.lastKnownState;
        const { missions, currentLocationId, player } = gameState;
        
        const isActive = missions.activeMissionIds.includes(missionId);
        const progress = missions.missionProgress[missionId];
        const isCompletable = progress ? progress.isCompletable : false;

        const isLocationValid = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === currentLocationId;
        const canComplete = isActive && isCompletable && isLocationValid;

        // --- ACT INTERMISSION INTERCEPT (PHASE 3) ---
        if (ACT_CINEMATIC_CONFIG && ACT_CINEMATIC_CONFIG[missionId]) {
            // Target the core mutable state, not the disconnected snapshot
            const coreState = this.manager.simulationService?.gameState;
            const targetPlayer = coreState ? coreState.player : player;
            
            if (!targetPlayer.viewedIntermissions) targetPlayer.viewedIntermissions = [];
            
            if (!targetPlayer.viewedIntermissions.includes(missionId)) {
                // Mark as viewed on the core state to satisfy the "once only, ever" constraint
                targetPlayer.viewedIntermissions.push(missionId);
                
                // Force background save immediately to ensure persistence without redrawing UI
                if (coreState && this.manager.simulationService) {
                    this.manager.simulationService.saveGame();
                }

                // Execute sequence, delaying standard modal instantiation
                if (this.manager.eventControl && typeof this.manager.eventControl.playActIntermissionSequence === 'function') {
                    this.manager.eventControl.playActIntermissionSequence(
                        missionId,
                        ACT_CINEMATIC_CONFIG[missionId],
                        () => {
                            // Render standard modal post-sequence
                            if (canComplete) {
                                this._showMissionCompletionModal(mission);
                            } else {
                                this._showMissionDetailsModal(mission);
                            }
                        }
                    );
                    return; // Halt standard execution path
                }
            }
        }
        // --- END INTERCEPT ---

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
        
        const progress = missions.missionProgress[mission.id] || { objectives: {} };
        const isCompletable = progress ? progress.isCompletable : false;
        
        const isLogisticsPickupPhase = mission.deferredCargo && mission.deferredCargo.length > 0 && !progress.cargoLoaded;
        const isAtPickupLocation = isLogisticsPickupPhase && mission.pickupLocationId === currentLocationId;
        
        const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === currentLocationId;
        
        let shouldBeDisabled = false;
        let isShipClassGated = false;
        let shipClassGateText = '';
        
        if (!isActive && missions.activeMissionIds.length >= 4) {
            shouldBeDisabled = true;
        }

        if (mission.id === 'mission_tutorial_02' && tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId !== 'mission_2_4') {
            shouldBeDisabled = true;
        }

        // Fleet Check Gatekeeping for specific missions requiring certain ship classes (e.g., M25)
        if (mission.id === 'mission_25' && !isActive) {
            const classRanks = { 'C': 1, 'B': 2, 'A': 3, 'S': 4, 'O': 5, 'Z': 6, 'F': 0 };
            let highestRank = 0;
            for (const shipId of gameState.player.ownedShipIds) {
                const shipDef = DB.SHIPS[shipId] || {};
                if (shipDef && shipDef.class) {
                    const rank = classRanks[shipDef.class.toUpperCase()] || 0;
                    if (rank > highestRank) highestRank = rank;
                }
            }
            if (highestRank < classRanks['B']) {
                shouldBeDisabled = true;
                isShipClassGated = true;
                shipClassGateText = 'REQUIRES CLASS B VESSEL';
            }
        }

        const parsedDescription = this._parseMissionText(mission.description, gameState);
        const parsedTitle = this._parseMissionText(mission.name, gameState);

        const options = {
            portraitId: mission.portraitId,
            portraitName: mission.portraitName,
            dismissOutside: true, 
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('.modal-content');
                
                modalContent.classList.remove('modal-blur-fade-out');
                modal.classList.remove('backdrop-fade-out-slow', 'dismiss-disabled');

                modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
                const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                modalContent.classList.add(hostClass);
                
                // Split Portrait Injection
                if (mission.portraitId === 'split_audita_kiern') {
                    const portraitEl = modal.querySelector('.portrait-thumbnail');
                    if (portraitEl && typeof window.getPortraitStyle === 'function') {
                        const auditaStyle = window.getPortraitStyle('Audita_1');
                        const kiernStyle = window.getPortraitStyle('Venusian_Syndicate_4');
                        
                        portraitEl.style.background = 'none';
                        portraitEl.innerHTML = `
                            <div style="position: absolute; inset: 0; display: flex; border-radius: inherit; overflow: hidden; background: #000;">
                                <div style="flex: 1; position: relative; overflow: hidden;">
                                    <div style="${auditaStyle}; position: absolute; top:0; left:0; width: 200%; height: 100%;"></div>
                                </div>
                                <div style="width: 3px; background: rgba(255,255,255,0.8); z-index: 10; box-shadow: 0 0 8px rgba(255,255,255,1);"></div>
                                <div style="flex: 1; position: relative; overflow: hidden;">
                                    <div style="${kiernStyle}; position: absolute; top:0; right:0; width: 200%; height: 100%;"></div>
                                </div>
                            </div>
                        `;
                    }
                }

                const typeEl = modal.querySelector('#mission-modal-type');
                if (typeEl) {
                    typeEl.textContent = mission.type;
                    typeEl.style.display = 'block';
                    typeEl.style.fontSize = '0.65rem';
                }

                // --- TELEMETRY DASHBOARD (CSS GRID) ---
                const objectivesEl = modal.querySelector('#mission-modal-objectives');
                const rewardsEl = modal.querySelector('#mission-modal-rewards');
                if (rewardsEl) rewardsEl.style.display = 'none';

                let flexColumns = [];
                let animDelayIdx = 0;

                const visibleRewards = mission.rewards ? mission.rewards.filter(r => r.type.toLowerCase() !== 'deduct_credits') : [];
                const hasPayout = visibleRewards.length > 0 || !!mission.officerReward;

                // 1. GRANTED
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
                            inboundItems.push(`<span class="credits-text-pulsing">${formatCredits(action.amount, true)}</span>`);
                        }
                        if (action.type === 'GRANT_ITEM' && action.items) {
                            action.items.forEach(cargo => {
                                const name = DB.COMMODITIES.find(c => c.id === cargo.goodId)?.name || 'ITEM';
                                inboundItems.push(`<span class="t-qty">${cargo.quantity}x</span> <span class="t-subject">${name.toUpperCase()}</span>`);
                            });
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
                            <div class="telemetry-header">GRANTED</div>
                            <div class="telemetry-content">${grantedStr}</div>
                        </div>
                    `);
                }

                // 2. PAYOUT
                let payoutPanelHtml = '';
                if (hasPayout) {
                    let rewsList = '';
                    if (visibleRewards.length > 0) {
                        rewsList += visibleRewards.map(r => {
                            const delay = animDelayIdx++ * 0.05;
                            let content = '';
                            if(r.type.toLowerCase() === 'credits') {
                                content = `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                            } else if(r.type.toLowerCase() === 'upgrade' || r.type.toLowerCase() === 'grant_upgrade') {
                                let upgName = GameAttributes.getDefinition(r.id || r.upgradeId || r.target)?.name;
                                if (!upgName) {
                                    const fallbacks = { 'syndicate_badge_1': 'Syndicate Badge I', 'radar_mod_1': 'Radar Mod I', 'UPG_GUILD_BADGE_2': 'Guild Badge II', 'UPG_SYNDICATE_BADGE_2': 'Syndicate Badge II' };
                                    upgName = fallbacks[r.id || r.upgradeId || r.target] || 'SHIP UPGRADE';
                                }
                                
                                let color = '#60a5fa'; // Default blue
                                const lowerName = upgName.toLowerCase();
                                if (lowerName.includes('syndicate')) color = '#ef4444';
                                else if (lowerName.includes('guild')) color = '#eab308';
                                else if (lowerName.includes('radar')) color = '#a855f7';
                                
                                content = `<span style="font-family: 'Teko', sans-serif; font-size: 0.9em; color: ${color}; text-shadow: 0 0 5px ${color};">${upgName.toUpperCase()}</span>`;
                            } else if(r.type.toLowerCase() === 'license' || r.type.toLowerCase() === 'unlock_tier' || r.type.toLowerCase() === 'reveal_tier') {
                                const tierVal = r.value || r.amount || (r.licenseId ? parseInt(r.licenseId.match(/\d+/)[0], 10) : 1);
                                const colorClass = tierVal === 2 ? 'text-green-400' : (tierVal === 3 ? 'text-blue-400' : 'text-emerald-400');
                                content = `<span class="t-subject ${colorClass}">TIER ${tierVal} LICENSE</span>`;
                            } else if (r.type.toLowerCase() === 'fill_fleet_fuel') {
                                content = `<span class="t-subject text-blue-400 font-bold" style="-webkit-text-stroke: 1px black;">FUEL STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'fill_fleet_repair') {
                                content = `<span class="t-subject text-emerald-400 font-bold" style="-webkit-text-stroke: 1px black;">MAINTENANCE STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'set_flag') {
                                if (r.flagId === 'helped_belt_family') {
                                    content = `<span class="t-subject">GRATITUDE</span>`;
                                } else {
                                    content = `<span class="t-subject">REPUTATION</span>`;
                                }
                            } else if (r.type.toLowerCase() === 'grant_ship' || r.type.toLowerCase() === 'ship') {
                                const shipName = DB.SHIPS[r.shipId || r.target]?.name || 'NEW VESSEL';
                                content = `<span class="t-subject text-green-400">${shipName.toUpperCase()}</span>`;
                            } else if (r.type.toLowerCase() === 'unlock_location') {
                                const locName = DB.MARKETS.find(m => m.id === r.locationId)?.name || 'NEW SECTOR';
                                content = `<span class="t-subject text-purple-400">ACCESS: ${locName.toUpperCase()}</span>`;
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
                
                if (payoutPanelHtml) flexColumns.push(payoutPanelHtml);

                // Analyze Locations for DESTINATION panel
                let uniqueDestinations = new Set();
                if (mission.objectives) {
                    mission.objectives.forEach(obj => {
                        if (['DELIVER_ITEM', 'travel_to', 'TRAVEL_TO', 'trade_item', 'TRADE_ITEM', 'COLLECT_ITEM', 'collect_item'].includes(obj.type)) {
                            if (obj.target && DB.MARKETS.some(m => m.id === obj.target)) {
                                uniqueDestinations.add(obj.target);
                            }
                        }
                    });
                }

                // 3. DIRECTIVE
                if (mission.objectives && mission.objectives.length > 0) {
                    const obsList = mission.objectives.filter(obj => {
                        // SEQUENTIAL GATING: Hide objective if its dependency isn't met
                        if (obj.dependsOn) {
                            const depProgress = progress.objectives[obj.dependsOn];
                            if (!depProgress || depProgress.current < depProgress.target) {
                                return false; // Skip rendering
                            }
                        }
                        return true;
                    }).map(obj => {
                        const delay = animDelayIdx++ * 0.05;
                        let text = this._getObjectiveDescription(obj, false);
                        
                        if (!['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(obj.type)) {
                            text = text.replace(/(\b\d+[xX]?\b)/g, '<span class="t-qty">$1</span>');
                        }
                        
                        if (obj.type === 'DELIVER_ITEM') {
                            const objKey = obj.id || obj.goodId || obj.target;
                            const depositedAmt = progress?.objectives?.[objKey]?.deposited || 0;
                            const targetQty = obj.quantity || obj.value || 1;
                            if (depositedAmt > 0) {
                                text += `<br><span class="text-blue-400 font-bold">[DEPOSITED: ${depositedAmt}/${targetQty}]</span>`;
                            }
                        }
                        
                        if (obj.type === 'COLLECT_ITEM' || obj.type === 'collect_item') {
                            const objKey = obj.id || obj.goodId || obj.target;
                            const collectedAmt = progress?.objectives?.[objKey]?.collected || 0;
                            const targetQty = obj.quantity || obj.value || 1;
                            if (collectedAmt > 0) {
                                text += `<br><span class="text-blue-400 font-bold">[COLLECTED: ${collectedAmt}/${targetQty}]</span>`;
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

                // 4. DESTINATION (Shows all unique objective locations)
                if (uniqueDestinations.size > 0) {
                    const destNames = Array.from(uniqueDestinations).map(id => DB.MARKETS.find(m => m.id === id)?.name || 'UNKNOWN').join(', ');
                    const delay = animDelayIdx++ * 0.05;
                    flexColumns.push(`
                        <div class="telemetry-panel panel-destination">
                            <div class="telemetry-header">DESTINATION</div>
                            <div class="telemetry-content">
                                <div class="telemetry-item" style="animation-delay: ${delay}s"><span class="t-subject">${destNames.toUpperCase()}</span></div>
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

                // --- SCROLLABILITY WRAPPER ---
                const descEl = modal.querySelector('#mission-modal-description');
                let outerWrapper = modal.querySelector('.mission-scroll-outer');
                let wrapper = modal.querySelector('.mission-scroll-wrapper');
                let indicator = modal.querySelector('.scroll-indicator-arrow');

                if (!wrapper && descEl && objectivesEl) {
                    outerWrapper = document.createElement('div');
                    outerWrapper.className = 'mission-scroll-outer w-full relative mb-2';
                    
                    wrapper = document.createElement('div');
                    wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto custom-scrollbar px-1 mb-2';
                    wrapper.style.maxHeight = '304px'; 
                    
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

                if (wrapper && indicator) {
                    wrapper.onscroll = () => {
                        const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                        indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                    };
                    
                    wrapper.scrollTop = 0; 
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

                const buttonsEl = modal.querySelector('#mission-modal-buttons');
                const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";
                
                if (isActive) {
                    const isAbandonable = mission.isAbandonable !== false;
                    let navButtonHtml = '';
                    let depositButtonHtml = '';
                    let collectButtonHtml = '';
                    let actionButtonHtml = '';
                    
                    if (isCompletable && !isAtCorrectLocation && mission.completion.locationId !== 'any' && !isLogisticsPickupPhase) {
                        navButtonHtml = `<button id="mission-navigate-btn" data-target-loc="${mission.completion.locationId}" class="btn w-full mt-2 btn-pulse-green" style="${btnStyles}">NAVIGATE >></button>`;
                    }
                    else if (isLogisticsPickupPhase && !isAtPickupLocation) {
                        navButtonHtml = `<button id="mission-navigate-btn" data-target-loc="${mission.pickupLocationId}" class="btn w-full mt-2 btn-pulse-green" style="${btnStyles}">NAVIGATE >></button>`;
                    }
                    
                    let canCollect = false;

                    if (isAtCorrectLocation || true) {
                        let canDeposit = false;
                        if (mission.objectives) {
                            mission.objectives.forEach(obj => {
                                if (obj.type === 'DELIVER_ITEM') {
                                    const itemId = obj.goodId || obj.target;
                                    const objKey = obj.id || obj.goodId || obj.target;
                                    const targetQty = obj.quantity || obj.value || 1;
                                    const depositedAmt = progress?.objectives?.[objKey]?.deposited || 0;
                                    
                                    // --- LOCATION GATING FOR BUTTON ---
                                    const isObjLocationSpecific = obj.target && DB.MARKETS.some(m => m.id === obj.target);
                                    if (isObjLocationSpecific && obj.target !== gameState.currentLocationId) {
                                        return; // We are not at the right place to deposit for this specific objective
                                    }
                                    
                                    // --- DEPENDENCY CHECK ---
                                    let isUnlocked = true;
                                    if (obj.dependsOn) {
                                        const depProgress = progress?.objectives?.[obj.dependsOn];
                                        if (!depProgress || depProgress.current <= depositedAmt) {
                                            isUnlocked = false;
                                        }
                                    }
                                    // ----------------------------------
                                    
                                    if (isUnlocked && (targetQty - depositedAmt > 0)) {
                                        for (const shipId of gameState.player.ownedShipIds) {
                                            if (gameState.player.inventories[shipId]?.[itemId]?.quantity > 0) {
                                                canDeposit = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                                
                                // EVALUATE COLLECTION UI
                                if (obj.type === 'COLLECT_ITEM' || obj.type === 'collect_item') {
                                    const objKey = obj.id || obj.goodId || obj.targetLoc || obj.target;
                                    const targetQty = obj.quantity || obj.value || 1;
                                    const collectedAmt = progress?.objectives?.[objKey]?.collected || 0;
                                    const targetLocation = obj.targetLoc || obj.target;

                                    const isObjLocationSpecific = targetLocation && DB.MARKETS.some(m => m.id === targetLocation);
                                    if (isObjLocationSpecific && targetLocation !== gameState.currentLocationId) {
                                        return; 
                                    }

                                    let isUnlocked = true;
                                    if (obj.dependsOn) {
                                        const depProgress = progress.objectives[obj.dependsOn];
                                        if (!depProgress || depProgress.current < depProgress.target) {
                                            isUnlocked = false;
                                        }
                                    }

                                    if (isUnlocked && (targetQty - collectedAmt > 0)) {
                                        canCollect = true;
                                    }
                                }

                                // EVALUATE ACTION UI
                                if (obj.type === 'ACTION' || obj.type === 'action') {
                                    const objKey = obj.id || obj.target;
                                    const targetQty = obj.quantity || obj.value || 1;
                                    const completedAmt = progress?.objectives?.[objKey]?.current || 0;
                                    
                                    let isUnlocked = true;
                                    let requiredLocId = null;
                                    
                                    if (obj.dependsOn) {
                                        const depProgress = progress.objectives[obj.dependsOn];
                                        if (!depProgress || depProgress.current < depProgress.target) {
                                            isUnlocked = false;
                                        }
                                        
                                        // Infer location from a TRAVEL_TO dependency if present
                                        const depObj = mission.objectives.find(o => (o.id === obj.dependsOn || o.target === obj.dependsOn));
                                        if (depObj && (depObj.type === 'TRAVEL_TO' || depObj.type === 'travel_to')) {
                                            requiredLocId = depObj.target;
                                        }
                                    }
                                    
                                    // Explicit location override if provided
                                    if (obj.targetLoc) requiredLocId = obj.targetLoc;
                                    
                                    if (requiredLocId && requiredLocId !== gameState.currentLocationId) {
                                        isUnlocked = false;
                                    }

                                    if (isUnlocked && (targetQty - completedAmt > 0)) {
                                        const btnLabel = (obj.target || 'EXECUTE ACTION').toUpperCase();
                                        actionButtonHtml += `<button id="mission-action-execute-btn-${objKey}" data-action-id="${objKey}" class="btn w-full mt-2 bg-purple-600/80 hover:bg-purple-500/80 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)] text-white font-bold mission-action-execute-btn" style="${btnStyles}">${btnLabel}</button>`;
                                    }
                                }
                            });
                        }
                        
                        if (canDeposit) {
                            depositButtonHtml = `<button id="mission-deposit-btn" class="btn w-full mt-2 bg-amber-600/80 hover:bg-amber-500/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-white font-bold" style="${btnStyles}">DEPOSIT FREIGHT</button>`;
                        }
                    }
                    
                    if (canCollect) {
                        collectButtonHtml = `<button id="mission-collect-btn" class="btn w-full mt-2 bg-blue-600/80 hover:bg-blue-500/80 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.6)] text-white font-bold" style="${btnStyles}">COLLECT FREIGHT</button>`;
                    }
                    
                    if (isLogisticsPickupPhase && isAtPickupLocation) {
                        depositButtonHtml = `<button id="mission-load-cargo-btn" data-mission-id="${mission.id}" class="btn w-full mt-2 bg-amber-600/80 hover:bg-amber-500/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-white font-bold" style="${btnStyles}">LOAD CARGO</button>`;
                    }
                    
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500" style="${btnStyles}" data-action="abandon-mission" data-mission-id="${mission.id}" ${!isAbandonable ? 'disabled' : ''}>Abandon Mission</button>${depositButtonHtml}${collectButtonHtml}${actionButtonHtml}${navButtonHtml}`;

                    // Bind ACTION button listeners dynamically
                    const actionBtns = modal.querySelectorAll('.mission-action-execute-btn');
                    actionBtns.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            if (this.manager.simulationService && this.manager.simulationService.gameState) {
                                const coreState = this.manager.simulationService.gameState;
                                const prog = coreState.missions.missionProgress[mission.id];
                                const actionId = btn.dataset.actionId;
                                const objDef = mission.objectives.find(o => o.id === actionId || o.target === actionId);
                                
                                if (!prog.objectives[actionId]) {
                                    prog.objectives[actionId] = { current: 0, target: objDef ? (objDef.quantity || objDef.value || 1) : 1 };
                                }
                                prog.objectives[actionId].current = objDef ? (objDef.quantity || objDef.value || 1) : 1; 
                                
                                const rect = btn.getBoundingClientRect();
                                const x = e.clientX || rect.left + (rect.width / 2);
                                const y = e.clientY || rect.top;
                                this.manager.createFloatingText(`ACTION COMPLETED`, x, y, '#c084fc');
                                
                                this.manager.simulationService.missionService.checkTriggers();
                                coreState.setState({}); 
                                this.manager.render();
                                closeHandler();
                            }
                        });
                    });

                } else {
                     let btnText = 'Accept';
                     if (isShipClassGated) {
                         btnText = shipClassGateText;
                     } else if (shouldBeDisabled && missions.activeMissionIds.length >= 4) {
                         btnText = 'Mission Log Full (4/4)';
                     }
                     
                     buttonsEl.innerHTML = `<button class="btn w-full mission-action-btn" style="${btnStyles}" data-action="accept-mission" data-mission-id="${mission.id}" ${shouldBeDisabled ? 'disabled' : ''}>${btnText}</button>`;
                     
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
                        const targetLoc = navBtn.dataset.targetLoc;
                        setTimeout(() => {
                            this.manager.showLaunchModal(targetLoc);
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
                                const rect = depositBtn.getBoundingClientRect();
                                const x = e.clientX || rect.left + (rect.width / 2);
                                const y = e.clientY || rect.top;
                                
                                this.manager.createFloatingText(`+${depositedAmt}`, x, y, '#ffffff');
                            }

                            closeHandler();
                        }
                    });
                }
                
                const collectBtn = modal.querySelector('#mission-collect-btn');
                if (collectBtn) {
                    collectBtn.addEventListener('click', (e) => {
                        if (this.manager.simulationService) {
                            const collectedAmt = this.manager.simulationService.missionService.collectMissionCargo(mission.id);
                            
                            if (collectedAmt > 0) {
                                const rect = collectBtn.getBoundingClientRect();
                                const x = e.clientX || rect.left + (rect.width / 2);
                                const y = e.clientY || rect.top;
                                this.manager.createFloatingText(`+${collectedAmt}`, x, y, '#60a5fa');
                            }

                            closeHandler();
                        }
                    });
                }
                
                const loadCargoBtn = modal.querySelector('#mission-load-cargo-btn');
                if (loadCargoBtn) {
                    loadCargoBtn.addEventListener('click', (e) => {
                        if (this.manager.simulationService && this.manager.simulationService.missionService) {
                            this.manager.simulationService.missionService.loadDeferredCargo(mission.id);
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
        if (obj.type === 'DELIVER_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             let text = `DELIVER ${obj.quantity || 1}x ${name.toUpperCase()}`;
             if (obj.target && !omitLocation && DB.MARKETS.find(m => m.id === obj.target)) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                 text += ` TO ${locName.toUpperCase()}`;
             }
             return text;
        }
        if (obj.type === 'collect_item' || obj.type === 'COLLECT_ITEM') {
            const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.targetLoc || obj.target))?.name || 'Item';
            if (obj.target && !omitLocation && DB.MARKETS.find(m => m.id === obj.target)) {
                const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                return `COLLECT ${obj.quantity || 1}x ${name.toUpperCase()} ON ${locName.toUpperCase()}`;
            }
            return `COLLECT ${obj.quantity || 1}x ${name.toUpperCase()}`;
        }
        if (obj.type === 'have_item' || obj.type === 'HAVE_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             return `PROCURE ${obj.quantity || 1}x ${name.toUpperCase()}`;
        }
        if (obj.type === 'trade_item' || obj.type === 'TRADE_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === obj.goodId)?.name || 'Item';
             const action = obj.tradeType === 'buy' ? 'BUY' : 'SELL';
             if (obj.target && !omitLocation && DB.MARKETS.find(m => m.id === obj.target)) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                 return `${action} ${name} on ${locName}`;
             }
             return `${action} ${name}`;
        }
        if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') {
             if (omitLocation) return `ESTABLISH PRESENCE`;
             const name = DB.MARKETS.find(m => m.id === obj.target)?.name || 'Location';
             return `TRAVEL TO ${name.toUpperCase()}`;
        }
        if (['have_debt', 'HAVE_DEBT'].includes(obj.type)) return 'CLEAR ALL DEBT';
        if (['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(obj.type)) {
             return `AMASS <span class="text-cyan-400 font-bold">⌬ ${formatShortCredits(obj.value || obj.quantity)}</span>`;
        }
        if (obj.type === 'have_fuel_tank' || obj.type === 'HAVE_FUEL_TANK') {
            return `REFUEL SHIP`;
        }
        if (obj.type === 'have_hull_pct' || obj.type === 'HAVE_HULL_PCT') {
            return `REPAIR HULL`;
        }
        if (obj.type === 'visit_screen' || obj.type === 'VISIT_SCREEN') {
            const screenTarget = obj.screenId ? obj.screenId.charAt(0).toUpperCase() + obj.screenId.slice(1).toLowerCase() : 'Screen';
            return `VISIT THE ${screenTarget.toUpperCase()} SCREEN`;
        }
        if (obj.type === 'own_ship_class' || obj.type === 'OWN_SHIP_CLASS') {
            return `ACQUIRE CLASS ${obj.target} VESSEL`;
        }
        if (obj.type === 'action' || obj.type === 'ACTION') {
            return (obj.target || 'COMPLETE ACTION').toUpperCase();
        }
        return `COMPLETE OBJECTIVE`;
    }

    /**
     * Instantiates and queues the mission completion modal, handling dynamic rewards, 
     * cinematic intercepts, and custom UI sequences.
     * @param {Object} mission - The mission definition object from the database.
     * @sideeffects Mutates the DOM via ModalEngine, triggers CinematicService playback for specific missions.
     */
    _showMissionCompletionModal(mission) {
        const gameState = this.manager.lastKnownState;
        
        let rewardVolume = 0;
        
        // UPGRADE DETECTION ENHANCEMENT: Checks base rewards and choice-based branching rewards
        let hasUpgradeReward = false;
        if (mission.rewards && mission.rewards.some(r => r.type.toLowerCase() === 'upgrade' || r.type.toLowerCase() === 'grant_upgrade')) {
            hasUpgradeReward = true;
        }
        if (mission.completion && mission.completion.choices) {
            mission.completion.choices.forEach(c => {
                if (c.rewards && c.rewards.some(r => r.type.toLowerCase() === 'upgrade' || r.type.toLowerCase() === 'grant_upgrade')) {
                    hasUpgradeReward = true;
                }
            });
        }
        
        const licenseReward = mission.rewards ? mission.rewards.find(r => r.type.toLowerCase() === 'license' || r.type.toLowerCase() === 'unlock_tier') : null;

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

        const activePortraitId = mission.completion.portraitId || mission.portraitId;
        const activePortraitName = mission.completion.portraitName !== undefined ? mission.completion.portraitName : mission.portraitName;

        const options = {
           portraitId: activePortraitId,
           portraitName: activePortraitName,
           portraitFilter: mission.completion.portraitFilter,
           dismissOutside: true,
           customSetup: (modal, closeHandler) => {
               const modalContent = modal.querySelector('.modal-content');
               
               modalContent.classList.remove('modal-blur-fade-out');
               modal.classList.remove('backdrop-fade-out-slow', 'dismiss-disabled');

               modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
               const activeHost = mission.completion.host || mission.host;
               const hostClass = `host-${activeHost.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
               modalContent.classList.add(hostClass);
               
               // Split Portrait Injection
               if (activePortraitId === 'split_audita_kiern') {
                   const portraitEl = modal.querySelector('.portrait-thumbnail');
                   if (portraitEl && typeof window.getPortraitStyle === 'function') {
                       const auditaStyle = window.getPortraitStyle('Audita_1');
                       const kiernStyle = window.getPortraitStyle('Venusian_Syndicate_4');
                       
                       portraitEl.style.background = 'none';
                       portraitEl.innerHTML = `
                           <div style="position: absolute; inset: 0; display: flex; border-radius: inherit; overflow: hidden; background: #000;">
                               <div style="flex: 1; position: relative; overflow: hidden;">
                                   <div style="${auditaStyle}; position: absolute; top:0; left:0; width: 200%; height: 100%;"></div>
                               </div>
                               <div style="width: 3px; background: rgba(255,255,255,0.8); z-index: 10; box-shadow: 0 0 8px rgba(255,255,255,1);"></div>
                               <div style="flex: 1; position: relative; overflow: hidden;">
                                   <div style="${kiernStyle}; position: absolute; top:0; right:0; width: 200%; height: 100%;"></div>
                               </div>
                           </div>
                       `;
                   }
               }

               modal.querySelector('#mission-modal-title').textContent = parsedTitle;
               
               const typeEl = modal.querySelector('#mission-modal-type');
               if (typeEl) {
                   typeEl.style.display = 'none';
               }
               
               modal.querySelector('#mission-modal-description').innerHTML = parsedText;

               const objectivesEl = modal.querySelector('#mission-modal-objectives');
               objectivesEl.style.display = 'none';

               const rewardsEl = modal.querySelector('#mission-modal-rewards');
               const visibleRewards = mission.rewards ? mission.rewards.filter(r => r.type.toLowerCase() !== 'deduct_credits') : [];
               const hasStandardRewards = visibleRewards.length > 0;
               const hasOfficerReward = !!mission.officerReward;
               
               if (hasStandardRewards || hasOfficerReward) {
                   let rewardsHtml = '';
                   if (hasStandardRewards) {
                       rewardsHtml += visibleRewards.map((r, i) => {
                            const delay = i * 0.1;
                            let content = '';
                            if(r.type.toLowerCase() === 'credits') {
                                content = `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                            } else if(r.type.toLowerCase() === 'upgrade' || r.type.toLowerCase() === 'grant_upgrade') {
                                let upgName = GameAttributes.getDefinition(r.id || r.upgradeId || r.target)?.name;
                                if (!upgName) {
                                    const fallbacks = { 'syndicate_badge_1': 'Syndicate Badge I', 'radar_mod_1': 'Radar Mod I', 'UPG_GUILD_BADGE_2': 'Guild Badge II', 'UPG_SYNDICATE_BADGE_2': 'Syndicate Badge II' };
                                    upgName = fallbacks[r.id || r.upgradeId || r.target] || 'SHIP UPGRADE';
                                }
                                
                                let color = '#60a5fa'; // Default blue
                                const lowerName = upgName.toLowerCase();
                                if (lowerName.includes('syndicate')) color = '#ef4444';
                                else if (lowerName.includes('guild')) color = '#eab308';
                                else if (lowerName.includes('radar')) color = '#a855f7';
                                
                                content = `<span style="font-family: 'Teko', sans-serif; font-size: 0.9em; color: ${color}; text-shadow: 0 0 5px ${color};">${upgName.toUpperCase()}</span>`;
                            } else if(r.type.toLowerCase() === 'license' || r.type.toLowerCase() === 'unlock_tier' || r.type.toLowerCase() === 'reveal_tier') {
                                const tierVal = r.value || r.amount || (r.licenseId ? parseInt(r.licenseId.match(/\d+/)[0], 10) : 1);
                                const colorClass = tierVal === 2 ? 'text-green-400' : (tierVal === 3 ? 'text-blue-400' : 'text-emerald-400');
                                content = `<span class="t-subject ${colorClass}">TIER ${tierVal} LICENSE</span>`;
                            } else if (r.type.toLowerCase() === 'fill_fleet_fuel') {
                                content = `<span class="t-subject text-blue-400 font-bold" style="-webkit-text-stroke: 1px black;">FUEL STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'fill_fleet_repair') {
                                content = `<span class="t-subject text-emerald-400 font-bold" style="-webkit-text-stroke: 1px black;">MAINTENANCE STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'set_flag') {
                                if (r.flagId === 'helped_belt_family') {
                                    content = `<span class="t-subject">GRATITUDE</span>`;
                                } else {
                                    content = `<span class="t-subject">REPUTATION</span>`;
                                }
                            } else if (r.type.toLowerCase() === 'grant_ship' || r.type.toLowerCase() === 'ship') {
                                const shipName = DB.SHIPS[r.shipId || r.target]?.name || 'NEW VESSEL';
                                content = `<span class="t-subject text-green-400">${shipName.toUpperCase()}</span>`;
                            } else if (r.type.toLowerCase() === 'unlock_location') {
                                const locName = DB.MARKETS.find(m => m.id === r.locationId)?.name || 'NEW SECTOR';
                                content = `<span class="t-subject text-purple-400">ACCESS: ${locName.toUpperCase()}</span>`;
                            } else {
                                content = `<span class="t-subject">${r.type.toUpperCase()}</span>`;
                            }
                            return `<div class="hero-payout-item w-full flex justify-center items-center text-center my-1 text-lg font-bold" style="animation-delay: ${delay}s">${content}</div>`;
                       }).join('');
                   }
                   
                   if (hasOfficerReward) {
                        const offDef = OFFICERS[mission.officerReward];
                        if (offDef) {
                            const delay = (visibleRewards.length || 0) * 0.1;
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

               // --- SCROLLABILITY WRAPPER ---
               const descEl = modal.querySelector('#mission-modal-description');
               let outerWrapper = modal.querySelector('.mission-scroll-outer');
               let wrapper = modal.querySelector('.mission-scroll-wrapper');
               let indicator = modal.querySelector('.scroll-indicator-arrow');

               if (!wrapper && descEl) {
                    outerWrapper = document.createElement('div');
                    outerWrapper.className = 'mission-scroll-outer w-full relative mb-2';
                    
                    wrapper = document.createElement('div');
                    wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto custom-scrollbar px-1 mb-2';
                    wrapper.style.maxHeight = '304px'; 
                    
                    descEl.parentNode.insertBefore(outerWrapper, descEl);
                    outerWrapper.appendChild(wrapper);
                    
                    indicator = document.createElement('div');
                    indicator.className = 'scroll-indicator-arrow';
                    indicator.innerHTML = '&#8964;';
                    indicator.style.transition = 'opacity 0.2s ease-in-out';
                    outerWrapper.appendChild(indicator);
               }

               // Ensure elements are unconditionally inside the wrapper
               if (wrapper) {
                   if (descEl) wrapper.appendChild(descEl);
                   if (objectivesEl) wrapper.appendChild(objectivesEl);
                   if (rewardsEl) wrapper.appendChild(rewardsEl);
                   
                   wrapper.onscroll = () => {
                       const distanceToBottom = wrapper.scrollHeight - Math.ceil(wrapper.scrollTop) - wrapper.clientHeight;
                       indicator.style.opacity = distanceToBottom < 15 ? '0' : '1';
                   };
                   
                   wrapper.scrollTop = 0; 
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

               const buttonsEl = modal.querySelector('#mission-modal-buttons');
               buttonsEl.innerHTML = '';
               
               const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";

               // Refactored shared execution sequence for completion buttons
               const executeCompletion = (e) => {
                   
                   // Dynamic Float Text for Credit Deduction Sequence
                   let deductedAmount = 0;
                   if (mission.rewards) {
                       const deductReward = mission.rewards.find(r => r.type === 'DEDUCT_CREDITS' || r.type === 'deduct_credits');
                       if (deductReward) deductedAmount = deductReward.amount || 0;
                   }
                   if (deductedAmount > 0 && e) {
                       const btn = e.target ? (e.target.closest('button') || e.target) : document.body;
                       const rect = btn.getBoundingClientRect ? btn.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
                       const x = e.clientX || rect.left + (rect.width / 2);
                       const y = e.clientY || rect.top;
                       if (this.manager.createFloatingText) {
                           this.manager.createFloatingText(`-${formatCredits(deductedAmount, false)}`, x, y, '#ef4444');
                       }
                   }

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

                       const uiManager = this.manager;
                       const originalRender = uiManager.render;
                       
                       // Temporarily hijack render to intercept sticky bar and tracking star updates quietly
                       uiManager.render = function(...args) {
                           const newState = args[0] || uiManager.lastKnownState;
                           uiManager.lastKnownState = newState;

                           if (uiManager.missionControl) {
                               uiManager.missionControl.renderStickyBar(newState);
                           }

                           const activeTrackedId = newState.missions.trackedMissionId;
                           const screen = uiManager.cache.missionsScreen;
                           if (screen) {
                               screen.querySelectorAll('.mission-track-star').forEach(star => {
                                   if (star.dataset.missionId === activeTrackedId) {
                                       star.classList.add('active');
                                   } else {
                                       star.classList.remove('active');
                                   }
                               });
                           }
                       };

                       if (this.manager.simulationService) {
                           this.manager.simulationService.missionService.completeMission(mission.id);
                       }
                       
                       uiManager.render = originalRender;
                       closeHandler(); // close current completion modal

                       // License Sequence Intercept
                       if (licenseReward) {
                           let tierNum = 2;
                           if (licenseReward.type.toLowerCase() === 'unlock_tier') {
                               tierNum = licenseReward.value || licenseReward.amount || 2;
                           } else if (licenseReward.licenseId) {
                               const tierMatch = licenseReward.licenseId.match(/t(\d)_license/);
                               tierNum = tierMatch ? parseInt(tierMatch[1], 10) : 2;
                           }
                           
                           const licenseDef = DB.LICENSES ? DB.LICENSES[`t${tierNum}_license`] : null;
                           const tierComms = DB.COMMODITIES.filter(c => c.tier === tierNum).map(c => c.name);
                           const bodyText = `Unlocked ${tierComms.join(' and ')} trading.`;

                           await startLicenseAnimation(tierNum);
                           
                           const textHtml = `
                               <div class="text-center w-full flex flex-col items-center justify-center p-2">
                                   <div class="license-header-text license-header-t${tierNum}">LICENSE ACQUIRED</div>
                                   <br>
                                   <div class="license-subheader-text license-text-t${tierNum} mb-2">${licenseDef ? licenseDef.name.toUpperCase() : `TIER ${tierNum} LICENSE`}</div>
                                   <div class="license-body-text">${bodyText}</div>
                               </div>
                           `;

                           uiManager.queueModal('event-modal', '', textHtml, null, {
                               dismissInside: false,
                               dismissOutside: false,
                               theme: `license-t${tierNum}`,
                               customSetup: (licModal, licCloseHandler) => {
                                   const licModalContent = licModal.querySelector('.modal-content');
                                   // FIX: Remove sticky exit class from previous singleton usages
                                   licModalContent.classList.remove('license-modal-blur-out');
                                   licModalContent.classList.add('license-modal-blur-in');

                                   // Hide standard title
                                   const titleEl = licModal.querySelector('.modal-title');
                                   if (titleEl) titleEl.style.display = 'none';

                                   const btnContainer = licModal.querySelector('#event-button-container');
                                   btnContainer.innerHTML = `<button type="button" id="accept-license-btn" class="btn w-full license-btn license-btn-t${tierNum}" style="padding-top: 0.5rem; padding-bottom: 0.5rem; min-height: 32px;">ACCEPT LICENSE</button>`;
                                   
                                   licModal.querySelector('#accept-license-btn').onclick = async () => {
                                       licModalContent.classList.remove('license-modal-blur-in');
                                       licModalContent.classList.add('license-modal-blur-out');
                                       
                                       setTimeout(async () => {
                                           // FIX: Purge the class so it's clean for the next modal
                                           licModalContent.classList.remove('license-modal-blur-out');
                                           licCloseHandler();
                                           await endLicenseAnimation(tierNum);
                                           
                                           // Execute state mutation via the properly injected, fully mutable GameState reference
                                           if (uiManager.simulationService && uiManager.simulationService.gameState) {
                                               const coreState = uiManager.simulationService.gameState;
                                               if (tierNum === 2) {
                                                   coreState.player.revealedTier = Math.max(coreState.player.revealedTier || 1, 2);
                                               }
                                               const licId = `t${tierNum}_license`;
                                               if (!coreState.player.unlockedLicenseIds.includes(licId)) {
                                                   coreState.player.unlockedLicenseIds.push(licId);
                                               }
                                               coreState.setState({}); // Persist and broadcast
                                               
                                               // Unblur background now
                                               if (stickyBarEl) {
                                                   stickyBarEl.style.transition = 'none';
                                                   stickyBarEl.style.filter = 'none';
                                                   stickyBarEl.style.webkitFilter = 'none';
                                               }
                                               
                                               // Force render standard view with NEW state
                                               uiManager.render(coreState.getState());
                                           }
                                       }, 800); // Allow time for blur fade out
                                   };
                               }
                           });
                           
                           // Force process the queue immediately to show license overlay over the unblurred UI
                           if (uiManager.modalEngine) {
                               uiManager.modalEngine.processModalQueue();
                           }
                           
                       } else if (hasUpgradeReward && this.manager.simulationService) {
                           // Switch to Hangar Screen first so the orchestration logic has a viable visual target
                           this.manager.simulationService.setScreen(NAV_IDS.SHIP, SCREEN_IDS.HANGAR);
                           
                           if (stickyBarEl) {
                               stickyBarEl.style.transition = 'none';
                               stickyBarEl.style.filter = 'none';
                               stickyBarEl.style.webkitFilter = 'none';
                           }
                           
                           if (uiManager.lastKnownState) {
                               uiManager.render(uiManager.lastKnownState);
                           }

                           // FIX: Explicitly tell the Modal Engine to process its queue so the Upgrade Installation Modal appears instantly
                           if (uiManager.modalEngine && uiManager.modalEngine.modalQueue.length > 0) {
                               uiManager.modalEngine.processModalQueue();
                           }
                       } else {
                           // Standard unblur and render loop
                           if (stickyBarEl) {
                               stickyBarEl.style.transition = 'none';
                               stickyBarEl.style.filter = 'none';
                               stickyBarEl.style.webkitFilter = 'none';
                           }
                           if (uiManager.lastKnownState) {
                               uiManager.render(uiManager.lastKnownState);
                           }
                           
                           // Ensure any miscellaneous queued items are flushed
                           if (uiManager.modalEngine && uiManager.modalEngine.modalQueue.length > 0) {
                               uiManager.modalEngine.processModalQueue();
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
                   }, 1500); 
               };

               // --- LOGIC FOR BRANCHING COMPLETION CHOICES ---
               if (mission.completion.choices && mission.completion.choices.length > 0) {
                   mission.completion.choices.forEach((choice) => {
                       const choiceBtn = document.createElement('button');
                       choiceBtn.className = `btn w-full mb-2 ${choice.buttonClass || 'mission-action-btn host-btn-pulse'}`;
                       if (choice.buttonStyle) {
                           choiceBtn.style.cssText = btnStyles + choice.buttonStyle;
                       } else {
                           choiceBtn.style.cssText = btnStyles;
                       }
                       choiceBtn.textContent = choice.buttonText;
                       
                       choiceBtn.onclick = (e) => {
                           Array.from(buttonsEl.querySelectorAll('button')).forEach(b => b.disabled = true);
                           
                           // Custom Narrative/Animation sequence for Act II Climax decision
                           if (mission.id === 'mission_32') {
                               const whiteOverlay = document.createElement('div');
                               whiteOverlay.style.position = 'fixed';
                               whiteOverlay.style.inset = '0';
                               whiteOverlay.style.backgroundColor = '#ffffff';
                               whiteOverlay.style.zIndex = '999999';
                               whiteOverlay.style.opacity = '0';
                               whiteOverlay.style.transition = 'opacity 3s ease-in-out';
                               whiteOverlay.style.pointerEvents = 'all';
                               document.body.appendChild(whiteOverlay);
                               
                               requestAnimationFrame(() => {
                                   whiteOverlay.style.opacity = '1';
                               });
                               
                               setTimeout(() => {
                                   // Deep copy to securely prevent reference loss or mutations during timeouts
                                   const delayedRewards = JSON.parse(JSON.stringify(choice.rewards || []));
                                   mission.rewards = []; // Clear immediate rewards to delay floats
                                   executeCompletion(e);
                                   
                                   setTimeout(() => {
                                       whiteOverlay.style.transition = 'opacity 2s ease-in-out';
                                       whiteOverlay.style.opacity = '0';
                                       setTimeout(() => {
                                           whiteOverlay.remove();
                                           if (this.manager.simulationService) {
                                               // Target navigation to Hangar so the modal & robot arm animations have valid DOM targets
                                               this.manager.simulationService.setScreen(NAV_IDS.SHIP, SCREEN_IDS.HANGAR);
                                               
                                               // Ensure Hangar DOM is fully painted synchronously BEFORE injecting the modal
                                               this.manager.simulationService.gameState.setState({});
                                               
                                               // Grant rewards (injects the upgrade modal into the freshly built DOM)
                                               this.manager.simulationService._grantRewards(delayedRewards, mission.name);
                                               
                                               // CRITICAL FIX: Removed trailing setState({}) here so it doesn't immediately wipe out the injected modal.
                                               
                                               // EXPLICITLY process the modal queue so the Upgrade Installation Modal triggers instantly
                                               if (this.manager.modalEngine && this.manager.modalEngine.modalQueue.length > 0) {
                                                   this.manager.modalEngine.processModalQueue();
                                               }
                                           }
                                       }, 2000);
                                   }, 2000);
                               }, 3000);
                           } else {
                               mission.rewards = choice.rewards;
                               executeCompletion(e);
                           }
                       };
                       buttonsEl.appendChild(choiceBtn);
                   });
               } else {
                   const completeBtn = document.createElement('button');
                   completeBtn.className = hasSpace ? 'btn w-full mission-action-btn host-btn-pulse' : 'btn w-full bg-slate-700 text-gray-400 border-gray-600';
                   completeBtn.textContent = hasSpace ? mission.completion.buttonText : 'INSUFFICIENT CARGO SPACE';
                   completeBtn.style.cssText = btnStyles;
                   completeBtn.disabled = !hasSpace;

                   completeBtn.onclick = async (e) => {
                       completeBtn.disabled = true;
                       
                       if (mission.id === 'mission_41_guild' || mission.id === 'mission_41_syndicate') {
                           
                           // 1. Prepare UI Teardown Helpers
                           const toggleBackgroundUI = (opacity, pointerEvents) => {
                               const elements = [
                                   document.getElementById('mission-sticky-bar'),
                                   document.getElementById('btn-econ-weather'),
                                   document.getElementById('global-help-anchor'),
                                   document.getElementById('btn-game-menu'),
                                   document.getElementById('btn-achievements')
                               ];
                               elements.forEach(el => {
                                   if (el) {
                                       el.style.transition = 'opacity 0.2s ease';
                                       el.style.opacity = opacity;
                                       el.style.pointerEvents = pointerEvents;
                                   }
                               });
                           };

                           toggleBackgroundUI('0', 'none');

                           // Force close generic tooltips if open
                           const tooltip = document.getElementById('generic-tooltip');
                           if (tooltip) tooltip.style.opacity = '0';

                           // 2. Instantly create the absolute blackout overlay
                           const blackOverlay = document.createElement('div');
                           blackOverlay.className = 'fixed inset-0 flex flex-col items-center justify-center bg-black pointer-events-auto opacity-0';
                           blackOverlay.style.zIndex = '99999'; // Safely under CinematicService's 100000
                           document.body.appendChild(blackOverlay);

                           // 3. Fade in overlay using Web Animations API for guaranteed synchronization
                           const fadeIn = blackOverlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1500, fill: 'forwards', easing: 'ease-in-out' });
                           
                           fadeIn.finished.then(() => {
                               // 4. Trigger UI teardown behind the black screen
                               executeCompletion(e);
                               
                               // 5. Invoke CinematicService precisely
                               CinematicService.playVideo('sol_station_ silhouette').then(async () => {
                                   
                                   // Ensure teardown has processed (1.5s is the executeCompletion internal timer)
                                   await new Promise(r => setTimeout(r, 1500));
                                   
                                   // 6. Crossfade the black mask back out to reveal the resolved UI state
                                   const fadeOut = blackOverlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards', easing: 'ease-in-out' });
                                   await fadeOut.finished;
                                   
                                   blackOverlay.remove();
                                   toggleBackgroundUI('1', 'auto');
                                   
                               }).catch(err => {
                                   blackOverlay.remove();
                                   toggleBackgroundUI('1', 'auto');
                               });
                           });

                       } else {
                           executeCompletion(e);
                       }
                   };
                   buttonsEl.appendChild(completeBtn);
               }
               
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
        
        if (!price || price === 0) {
            // Gracefully replace pricing statements with "nothing" narratives.
            result = result.replace(/You paid <span class="credits-text-pulsing">⌬ \[credit price\]<\/span> for this intel\./g, "You paid nothing for this intel.");
            result = result.replace(/This intel was secured for \[⌬ credit price\]\./g, "This intel was secured for nothing.");
            result = result.replace(/This access was \[⌬ credit price\]\./g, "This access was granted.");
            
            // Standard tag replacements just in case
            result = result.replace(/<span class="credits-text-pulsing">⌬ \[credit price\]<\/span>/g, 'nothing');
            result = result.replace(/\[⌬ credit price\]/g, 'nothing');
        } else {
            // Normal pricing string handling
            const priceStr = formatCredits(-price, true);
            result = result.replace(/<span class="credits-text-pulsing">⌬ \[credit price\]<\/span>/g, `<span class="text-glow-red">${priceStr}</span>`);
            result = result.replace(/\[⌬ credit price\]/g, `<span class="text-glow-red">${priceStr}</span>`);
        }

         return result;
    }

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