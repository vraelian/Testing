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

        if (document.body.classList.contains('cinematic-active')) {
            if (stickyBarEl) {
                stickyBarEl.style.transition = 'none';
                stickyBarEl.style.display = 'none';
                stickyBarEl.style.opacity = '0';
                stickyBarEl.style.pointerEvents = 'none';
            }
            return;
        }

        const contentEl = stickyBarEl.querySelector('.sticky-content');
        const objectiveTextEl = this.manager.cache.stickyObjectiveText;
        const objectiveProgressEl = this.manager.cache.stickyObjectiveProgress;

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
            
            if (!isLogisticsPickupPhase && (!mission.objectives || mission.objectives.length === 0) && !progress.isCompletable) {
                this._hideStickyBarWithFade(stickyBarEl);
                return;
            }

            const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            // 1. IS READY TO COMPLETE
            if (progress.isCompletable && !isLogisticsPickupPhase) {
                const isAtCorrectLocation = !mission.completion?.locationId || mission.completion?.locationId === 'any' || mission.completion?.locationId === gameState.currentLocationId;
                
                const turnInClass = isAtCorrectLocation ? ' mission-turn-in' : '';
                const expectedClass = `sticky-content ${hostClass}${turnInClass} flex items-center justify-center`;
                if (contentEl.className !== expectedClass) contentEl.className = expectedClass;

                if (isAtCorrectLocation) {
                    if (objectiveTextEl.innerHTML !== `READY TO COMPLETE!`) {
                        objectiveTextEl.innerHTML = `READY TO COMPLETE!`;
                        objectiveTextEl.style.width = '100%';
                        objectiveTextEl.style.textAlign = 'center';
                        objectiveProgressEl.innerHTML = ``;
                        objectiveProgressEl.style.display = 'none';
                        contentEl.style.setProperty('--sticky-progress', `100%`);
                    }
                } else {
                    const locName = DB.MARKETS.find(m => m.id === mission.completion.locationId)?.name || 'UNKNOWN';
                    const expectedText = `RETURN TO ${locName.toUpperCase()}`;
                    if (objectiveTextEl.innerHTML !== expectedText) {
                        objectiveTextEl.innerHTML = expectedText;
                        objectiveTextEl.style.width = '100%';
                        objectiveTextEl.style.textAlign = 'center';
                        objectiveProgressEl.innerHTML = ``;
                        objectiveProgressEl.style.display = 'none';
                        contentEl.style.setProperty('--sticky-progress', `100%`);
                    }
                }

                if (stickyBarEl.style.display !== 'block') {
                    stickyBarEl.style.transition = 'none';
                    stickyBarEl.style.display = 'block';
                    stickyBarEl.style.opacity = '1';
                    stickyBarEl.style.pointerEvents = 'auto';
                }
                return; 
            }

            // 2. IS LOGISTICS PICKUP PHASE
            if (isLogisticsPickupPhase) {
                const expectedClass = `sticky-content ${hostClass}`;
                if (contentEl.className !== expectedClass) contentEl.className = expectedClass;

                const pickupLocName = DB.MARKETS.find(m => m.id === mission.pickupLocationId)?.name || 'Unknown';
                const expectedText = (gameState.currentLocationId === mission.pickupLocationId) ? `Load up cargo for delivery` : `Travel to ${pickupLocName}`;
                const expectedProgress = (gameState.currentLocationId === mission.pickupLocationId) ? `[AWAITING]` : `[EN ROUTE]`;

                if (objectiveTextEl.innerHTML !== expectedText || objectiveProgressEl.innerHTML !== expectedProgress) {
                    objectiveTextEl.innerHTML = expectedText;
                    objectiveProgressEl.innerHTML = expectedProgress;
                    objectiveTextEl.style.width = '';
                    objectiveTextEl.style.textAlign = '';
                    objectiveProgressEl.style.display = '';
                    contentEl.style.setProperty('--sticky-progress', `0%`);
                }
                
                if (stickyBarEl.style.display !== 'block') {
                    stickyBarEl.style.transition = 'none';
                    stickyBarEl.style.display = 'block';
                    stickyBarEl.style.opacity = '1';
                    stickyBarEl.style.pointerEvents = 'auto';
                }
                return;
            }

            // 3. INCOMPLETE OBJECTIVE
            let firstObj = null;
            if (mission.objectives && mission.objectives.length > 0) {
                firstObj = mission.objectives.find(obj => {
                    if (obj.dependsOn) {
                        const depProgress = progress.objectives[obj.dependsOn];
                        if (!depProgress || depProgress.current < depProgress.target) {
                            return false; 
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
            }

            if (firstObj) {
                const objKey = firstObj.id || firstObj.goodId || firstObj.target;
                let current = 0;
                let target = firstObj.quantity || firstObj.value || 1;
                
                if (progress.objectives[objKey]) {
                    current = progress.objectives[objKey].current;
                    target = progress.objectives[objKey].target;
                }
                
                const objectiveLabel = this._getObjectiveLabel(firstObj);
                let displayStr = `[${current}/${target}]`;
                let percent = Math.min(100, (current / target) * 100);

                if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(firstObj.type)) {
                    displayStr = `[${current}/${target}]`;
                    percent = Math.min(100, (current / (target || 100)) * 100);
                }
                else if (['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(firstObj.type)) {
                    displayStr = `[ <span class="text-cyan-400 font-bold">⌬ ${formatShortCredits(current)} / ${formatShortCredits(target)}</span> ]`;
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

                const expectedClass = `sticky-content ${hostClass}`;
                if (contentEl.className !== expectedClass) contentEl.className = expectedClass;

                if (objectiveTextEl.innerHTML !== objectiveLabel || objectiveProgressEl.innerHTML !== displayStr) {
                    objectiveTextEl.style.width = '';
                    objectiveTextEl.style.textAlign = '';
                    objectiveProgressEl.style.display = '';

                    objectiveTextEl.innerHTML = objectiveLabel;
                    objectiveProgressEl.innerHTML = displayStr;
                    contentEl.style.setProperty('--sticky-progress', `${percent}%`);
                }
                
                if (stickyBarEl.style.display !== 'block') {
                    stickyBarEl.style.transition = 'none';
                    stickyBarEl.style.display = 'block';
                    stickyBarEl.style.opacity = '1';
                    stickyBarEl.style.pointerEvents = 'auto';
                }
            } else {
                this._hideStickyBarWithFade(stickyBarEl);
            }
        } else {
            this._hideStickyBarWithFade(stickyBarEl);
        }
    }

    _getObjectiveLabel(obj) {
        if (!obj) return 'Objective';
        if (obj.text) return obj.text;
        
        if (obj.type === 'DELIVER_ITEM') {
             const name = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name || 'Item';
             if (obj.target && DB.MARKETS.find(m => m.id === obj.target)) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                 return `Deliver ${name} to ${locName}`;
             }
             return `Deliver ${name}`;
        }
        if (obj.type === 'DELIVER_SHIP' || obj.type === 'deliver_ship') {
             if (obj.target && DB.MARKETS.find(m => m.id === obj.target)) {
                 const locName = DB.MARKETS.find(m => m.id === obj.target).name;
                 return `Deliver ship to ${locName}`;
             }
             return `Deliver ship`;
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
             if (typeof omitLocation !== 'undefined' && omitLocation) return `ESTABLISH PRESENCE`;
             const name = DB.MARKETS.find(m => m.id === obj.target)?.name || 'Location';
             return `Travel to ${name}`;
        }
        if (['have_debt', 'HAVE_DEBT'].includes(obj.type)) return 'Clear All Debt';
        if (['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(obj.type)) {
             return `Amass <span class="text-cyan-400 font-bold">⌬ ${formatShortCredits(obj.value || obj.quantity)}</span>`;
        }
        if (obj.type === 'have_fuel_tank' || obj.type === 'HAVE_FUEL_TANK') {
            return `REFUEL SHIP`;
        }
        if (obj.type === 'have_hull_pct' || obj.type === 'HAVE_HULL_PCT') {
            return `REPAIR HULL`;
        }
        if (obj.type === 'visit_screen' || obj.type === 'VISIT_SCREEN') {
            const screenTarget = obj.screenId ? obj.screenId.charAt(0).toUpperCase() + obj.screenId.slice(1).toLowerCase() : 'Screen';
            return `Visit ${screenTarget} Screen`;
        }
        if (['own_ship_class', 'OWN_SHIP_CLASS'].includes(obj.type)) {
            return `Acquire Class ${obj.target} Vessel`;
        }
        if (['own_spare_ships', 'OWN_SPARE_SHIPS'].includes(obj.type)) {
            return `Acquire Reserve Hull`;
        }
        if (['has_upgrade_rank', 'HAS_UPGRADE_RANK'].includes(obj.type)) {
            return `Install Rank ${obj.rank} SHIP UPGRADE`;
        }
        if (['action', 'ACTION'].includes(obj.type)) {
            return obj.target || 'Complete Action';
        }
        return `COMPLETE OBJECTIVE`;
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

        const isLocationValid = !mission.completion?.locationId || mission.completion?.locationId === 'any' || mission.completion?.locationId === currentLocationId;
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
        
        const isAtCorrectLocation = !mission.completion?.locationId || mission.completion?.locationId === 'any' || mission.completion?.locationId === currentLocationId;
        
        let shouldBeDisabled = false;
        let isShipClassGated = false;
        let shipClassGateText = '';
        
        if (!isActive && missions.activeMissionIds.length >= 4) {
            shouldBeDisabled = true;
        }

        if (mission.id === 'mission_tutorial_02' && tutorials?.activeBatchId === 'intro_missions' && tutorials?.activeStepId !== 'mission_2_4') {
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

                // Filter out backend flags and negative credits for visual presentation
                const visibleRewards = mission.rewards ? mission.rewards.filter(r => {
                    const t = r.type.toLowerCase();
                    if (t === 'deduct_credits') return false;
                    if (t === 'set_flag' && r.flagId && r.flagId.startsWith('mission_')) return false;
                    if (t === 'trigger_system_state' || t === 'end_system_state') return false;
                    return true;
                }) : [];
                
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
                                content = `<span class="t-subject text-blue-400 font-bold">FUEL STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'fill_fleet_repair') {
                                content = `<span class="t-subject text-emerald-400 font-bold">MAINTENANCE STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'set_flag') {
                                if (r.flagId === 'helped_belt_family') {
                                    content = `<span class="t-subject">GRATITUDE</span>`;
                                } else {
                                    content = `<span class="t-subject">REPUTATION</span>`;
                                }
                            } else if (r.type.toLowerCase() === 'text') {
                                content = `<span class="t-subject font-bold text-emerald-400">${r.text}</span>`;
                            } else if (r.type.toLowerCase() === 'grant_ship') {
                                const shipName = DB.SHIPS[r.shipId]?.name || 'NEW VESSEL';
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
                        if (['DELIVER_ITEM', 'DELIVER_SHIP', 'deliver_ship', 'travel_to', 'TRAVEL_TO', 'trade_item', 'TRADE_ITEM', 'COLLECT_ITEM', 'collect_item'].includes(obj.type)) {
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
                        let text = this._getObjectiveLabel(obj);
                        
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

                // Uniform wrapper construction block guaranteeing child un-orphaning
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
                const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";
                
                if (isActive) {
                    const isAbandonable = mission.isAbandonable !== false;
                    let navButtonHtml = '';
                    let depositButtonHtml = '';
                    let collectButtonHtml = '';
                    let actionButtonHtml = '';
                    
                    if (isCompletable && !isAtCorrectLocation && mission.completion?.locationId !== 'any' && !isLogisticsPickupPhase) {
                        navButtonHtml = `<button id="mission-navigate-btn" data-target-loc="${mission.completion?.locationId}" class="btn w-full mt-2 btn-pulse-green" style="${btnStyles}">NAVIGATE >></button>`;
                    }
                    else if (isLogisticsPickupPhase && !isAtPickupLocation) {
                        navButtonHtml = `<button id="mission-navigate-btn" data-target-loc="${mission.pickupLocationId}" class="btn w-full mt-2 btn-pulse-green" style="${btnStyles}">NAVIGATE >></button>`;
                    }
                    
                    let canCollect = false;
                    let canTransferVessel = false;
                    let transferVesselObjKey = null;

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
                                
                                if (obj.type === 'DELIVER_SHIP' || obj.type === 'deliver_ship') {
                                    const objKey = obj.id || obj.target;
                                    const targetQty = obj.quantity || obj.value || 1;
                                    const depositedAmt = progress?.objectives?.[objKey]?.deposited || 0;
                                    
                                    const isObjLocationSpecific = obj.target && DB.MARKETS.some(m => m.id === obj.target);
                                    if (isObjLocationSpecific && obj.target !== gameState.currentLocationId) {
                                        return; 
                                    }
                                    
                                    let isUnlocked = true;
                                    if (obj.dependsOn) {
                                        const depProgress = progress?.objectives?.[obj.dependsOn];
                                        if (!depProgress || depProgress.current <= depositedAmt) {
                                            isUnlocked = false;
                                        }
                                    }
                                    
                                    if (isUnlocked && (targetQty - depositedAmt > 0)) {
                                        canTransferVessel = true;
                                        transferVesselObjKey = objKey;
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
                    
                    let transferVesselButtonHtml = '';
                    if (canTransferVessel) {
                        const hasSpare = gameState.player.ownedShipIds.length > 1;
                        transferVesselButtonHtml = `<button id="mission-transfer-vessel-btn" data-mission-id="${mission.id}" data-obj-key="${transferVesselObjKey}" class="btn w-full mt-2 bg-cyan-600/80 hover:bg-cyan-500/80 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed" style="${btnStyles}" ${!hasSpare ? 'disabled' : ''}>Transfer Vessel</button>`;
                    }
                    
                    if (isLogisticsPickupPhase && isAtPickupLocation) {
                        depositButtonHtml = `<button id="mission-load-cargo-btn" data-mission-id="${mission.id}" class="btn w-full mt-2 bg-amber-600/80 hover:bg-amber-500/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-white font-bold" style="${btnStyles}">LOAD CARGO</button>`;
                    }
                    
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-800/80" style="${btnStyles}" data-action="abandon-mission" data-mission-id="${mission.id}" ${!isAbandonable ? 'disabled' : ''}>Abandon Mission</button>${depositButtonHtml}${collectButtonHtml}${transferVesselButtonHtml}${actionButtonHtml}${navButtonHtml}`;

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
                                
                                const actionLabel = (objDef && objDef.actionText) ? objDef.actionText : ((objDef && objDef.target && objDef.target.toLowerCase().includes('pick up')) ? 'PASSENGER BOARDED' : 'ACTION COMPLETED');
                                this.manager.createFloatingText(actionLabel, x, y, '#c084fc');
                                
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
                
                const transferVesselBtn = modal.querySelector('#mission-transfer-vessel-btn');
                if (transferVesselBtn) {
                    transferVesselBtn.addEventListener('click', (e) => {
                        if (this.manager.simulationService && this.manager.simulationService.gameState) {
                            const coreState = this.manager.simulationService.gameState;
                            const playerShips = coreState.player.ownedShipIds.map(id => {
                                const stats = this.manager.simulationService.getEffectiveShipStats(id);
                                return { id, name: stats.name, class: stats.class, value: stats.price || 0 };
                            });
                            
                            if (playerShips.length <= 1) return;
                            
                            // Create modal UI for Transfer Vessel
                            const transferModal = document.createElement('div');
                            transferModal.className = 'fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 font-mono text-sm';
                            
                            const getClassTheme = (c) => {
                                switch(c) {
                                    case 'C': return { color: '#ffffff', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(255,255,255,0.15) 50%, rgba(156,163,175,0.4) 100%)' };
                                    case 'B': return { color: '#4ade80', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(74,222,128,0.15) 50%, rgba(156,163,175,0.4) 100%)' };
                                    case 'A': return { color: '#60a5fa', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(96,165,250,0.15) 50%, rgba(192,132,252,0.4) 100%)' };
                                    case 'S': return { color: '#facc15', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(250,204,21,0.15) 50%, rgba(180,83,9,0.4) 100%)' };
                                    case 'O': return { color: '#fb923c', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(251,146,60,0.15) 50%, rgba(239,68,68,0.4) 100%)' };
                                    case 'Z': return { color: '#ef4444', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(239,68,68,0.2) 50%, rgba(0,0,0,0.9) 100%)' };
                                    default: return { color: '#a1a1aa', gradient: 'linear-gradient(90deg, rgba(31,41,55,1) 0%, rgba(161,161,170,0.15) 50%, rgba(31,41,55,1) 100%)' };
                                }
                            };

                            let shipListHtml = '';
                            playerShips.forEach((ship, idx) => {
                                const theme = getClassTheme(ship.class);
                                shipListHtml += `<div class="transfer-ship-row py-3 px-4 mb-3 border border-gray-600 hover:border-cyan-400 cursor-pointer rounded-lg transition-all duration-200" data-ship-id="${ship.id}" style="background: ${theme.gradient}; font-size: 15px;">
                                    <div class="grid grid-cols-[8fr_3fr_5fr] items-center gap-2">
                                        <div class="overflow-hidden whitespace-nowrap mask-text-edges relative" style="-webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%); mask-image: linear-gradient(to right, black 85%, transparent 100%);">
                                            <span class="ship-name-scroll inline-block font-bold" style="color: ${theme.color}; text-shadow: 0 0 5px ${theme.color}80;">${ship.name}</span>
                                        </div>
                                        <div class="text-gray-400 text-center border-l border-gray-600/50 pl-2">Class ${ship.class}</div>
                                        <div class="text-cyan-400 font-bold tracking-wide text-right">⌬ ${formatShortCredits(ship.value)}</div>
                                    </div>
                                </div>`;
                            });
                            
                            transferModal.innerHTML = `
                                <style>
                                    @keyframes scroll-text-anim {
                                        0%, 25% { transform: translateX(0); }
                                        75%, 100% { transform: translateX(var(--scroll-dist)); }
                                    }
                                </style>
                                <div class="bg-gray-900 border border-cyan-500 rounded-xl p-5 w-full max-w-md shadow-[0_0_25px_rgba(34,211,238,0.25)]">
                                    <h2 class="text-cyan-400 text-lg font-bold mb-5 uppercase text-center border-b border-cyan-500/50 pb-2">Select Ship to Transfer</h2>
                                    <div class="mb-5 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar overflow-x-hidden">
                                        ${shipListHtml}
                                    </div>
                                    <div class="flex gap-3">
                                        <button id="transfer-cancel-btn" class="btn flex-1 bg-gray-700 hover:bg-gray-600 border-gray-500 text-white rounded-lg py-2">CANCEL</button>
                                        <button id="transfer-confirm-btn" class="btn flex-1 bg-cyan-700 border-cyan-500 text-white opacity-50 cursor-not-allowed rounded-lg py-2 transition-all duration-300" disabled>CONFIRM</button>
                                    </div>
                                </div>
                            `;
                            document.body.appendChild(transferModal);
                            
                            // Apply scrolling animation to overflowing ship names
                            setTimeout(() => {
                                transferModal.querySelectorAll('.ship-name-scroll').forEach(el => {
                                    if (el.scrollWidth > el.parentElement.clientWidth) {
                                        const distance = el.scrollWidth - el.parentElement.clientWidth + 10;
                                        el.style.setProperty('--scroll-dist', `-${distance}px`);
                                        el.style.animation = `scroll-text-anim ${distance * 0.05 + 3}s linear infinite`;
                                    }
                                });
                            }, 50);
                            
                            let selectedShipId = null;
                            const rows = transferModal.querySelectorAll('.transfer-ship-row');
                            const confirmBtn = transferModal.querySelector('#transfer-confirm-btn');
                            
                            rows.forEach(row => {
                                row.addEventListener('click', () => {
                                    rows.forEach(r => {
                                        r.classList.remove('border-cyan-400', 'ring-1', 'ring-cyan-400');
                                        r.classList.add('border-gray-600');
                                        r.style.filter = 'brightness(1)';
                                    });
                                    row.classList.remove('border-gray-600');
                                    row.classList.add('border-cyan-400', 'ring-1', 'ring-cyan-400');
                                    row.style.filter = 'brightness(1.2)';
                                    selectedShipId = row.dataset.shipId;
                                    confirmBtn.disabled = false;
                                    confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                                    confirmBtn.classList.add('hover:bg-cyan-600', 'shadow-[0_0_15px_rgba(34,211,238,0.4)]');
                                });
                            });
                            
                            transferModal.querySelector('#transfer-cancel-btn').addEventListener('click', () => {
                                transferModal.remove();
                            });
                            
                            confirmBtn.addEventListener('click', () => {
                                if (!selectedShipId) return;
                                
                                const shipName = playerShips.find(s => s.id === selectedShipId)?.name || 'Vessel';
                                const confirmOverlay = document.createElement('div');
                                confirmOverlay.className = 'fixed inset-0 z-[610] flex items-center justify-center p-4 bg-black/90 font-mono';
                                confirmOverlay.innerHTML = `
                                    <div class="bg-gray-900 border border-red-500 rounded-xl p-6 w-full max-w-sm text-center shadow-[0_0_40px_rgba(239,68,68,0.35)]" style="font-size: 16px;">
                                        <div class="text-red-400 font-bold mb-6 text-lg">Transfer ${shipName} - Are you sure?</div>
                                        <div class="flex gap-3">
                                            <button id="final-cancel-btn" class="btn flex-1 bg-gray-700 hover:bg-gray-600 border-gray-500 text-white rounded-lg py-2">Cancel</button>
                                            <button id="final-confirm-btn" class="btn flex-1 bg-red-700 hover:bg-red-600 border-red-500 text-white font-bold rounded-lg py-2 shadow-[0_0_15px_rgba(239,68,68,0.4)]">Confirm</button>
                                        </div>
                                    </div>
                                `;
                                transferModal.appendChild(confirmOverlay);
                                
                                confirmOverlay.querySelector('#final-cancel-btn').addEventListener('click', () => {
                                    confirmOverlay.remove();
                                });
                                
                                confirmOverlay.querySelector('#final-confirm-btn').addEventListener('click', () => {
                                    // EXECUTE TRANSFER
                                    const idx = coreState.player.ownedShipIds.indexOf(selectedShipId);
                                    if (idx > -1) {
                                        coreState.player.ownedShipIds.splice(idx, 1);
                                        // Handle primary ship change if needed
                                        if (coreState.player.shipId === selectedShipId) {
                                            coreState.player.shipId = coreState.player.ownedShipIds[0];
                                        }
                                        
                                        // Clean up inventory mapping if necessary (optional but good practice)
                                        delete coreState.player.inventories[selectedShipId];
                                        
                                        // Update mission progress
                                        const objKey = transferVesselBtn.dataset.objKey;
                                        const prog = coreState.missions.missionProgress[mission.id];
                                        if (!prog.objectives[objKey]) {
                                            prog.objectives[objKey] = { deposited: 0, current: 0, target: 1 };
                                        }
                                        prog.objectives[objKey].deposited = 1;
                                        prog.objectives[objKey].current = 1;
                                        
                                        const rect = transferVesselBtn.getBoundingClientRect();
                                        const x = rect.left + (rect.width / 2);
                                        const y = rect.top;
                                        this.manager.createFloatingText('TRANSFERRED VESSEL', x, y, '#ffffff');
                                        
                                        this.manager.simulationService.missionService.checkTriggers();
                                        coreState.setState({});
                                        this.manager.render();
                                        transferModal.remove();
                                        closeHandler();
                                    }
                                });
                            });
                        }
                    });
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
        if (mission.id === 'mission_tutorial_01' && tutorials?.activeStepId === 'mission_1_1') {
            shouldBeDisabled = true;
        }
        this.manager.queueModal('mission-modal', parsedTitle, parsedDescription, null, options);
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
        const hasUpgradeReward = mission.rewards && mission.rewards.some(r => r.type.toLowerCase() === 'upgrade' || r.type.toLowerCase() === 'grant_upgrade');
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

        const parsedTitle = this._parseMissionText(mission.completion?.title || mission.name, gameState);
        const parsedText = this._parseMissionText(mission.completion?.text || mission.description, gameState);

        const activePortraitId = mission.completion?.portraitId || mission.portraitId;
        const activePortraitName = mission.completion?.portraitName !== undefined ? mission.completion.portraitName : mission.portraitName;

        const options = {
           portraitId: activePortraitId,
           portraitName: activePortraitName,
           portraitFilter: mission.completion?.portraitFilter,
           dismissOutside: true,
           customSetup: (modal, closeHandler) => {
               const modalContent = modal.querySelector('.modal-content');
               
               modalContent.classList.remove('modal-blur-fade-out');
               modal.classList.remove('backdrop-fade-out-slow', 'dismiss-disabled');

               modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
               const activeHost = mission.completion?.host || mission.host || 'UNKNOWN';
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
               
               // Filter out backend flags and negative credits for visual presentation
               const visibleRewards = mission.rewards ? mission.rewards.filter(r => {
                   const t = r.type.toLowerCase();
                   if (t === 'deduct_credits') return false;
                   if (t === 'set_flag' && r.flagId && r.flagId.startsWith('mission_')) return false;
                   if (t === 'trigger_system_state' || t === 'end_system_state') return false;
                   return true;
               }) : [];

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
                                content = `<span class="t-subject text-blue-400 font-bold">FUEL STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'fill_fleet_repair') {
                                content = `<span class="t-subject text-emerald-400 font-bold">MAINTENANCE STIPEND</span>`;
                            } else if (r.type.toLowerCase() === 'set_flag') {
                                if (r.flagId === 'helped_belt_family') {
                                    content = `<span class="t-subject">GRATITUDE</span>`;
                                } else {
                                    content = `<span class="t-subject">REPUTATION</span>`;
                                }
                            } else if (r.type.toLowerCase() === 'text') {
                                content = `<span class="t-subject font-bold text-emerald-400">${r.text}</span>`;
                            } else if (r.type.toLowerCase() === 'grant_random_ship') {
                                content = `<span class="t-subject text-green-400">CLASS-${r.shipClass || 'S'} VESSEL</span>`;
                            } else if (r.type.toLowerCase() === 'grant_ship') {
                                const shipName = DB.SHIPS[r.shipId]?.name || 'NEW VESSEL';
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

               // Uniform wrapper construction block guaranteeing child un-orphaning
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

                       if (this.manager.modalEngine && this.manager.modalEngine.modalQueue.length > 0) {
                           this.manager.modalEngine.processModalQueue();
                       }

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

                       // Unlock Location Reward Floating Text
                       const unlockLocReward = mission.rewards?.find(r => r.type.toLowerCase() === 'unlock_location');
                       if (unlockLocReward && unlockLocReward.locationId === 'loc_exchange') {
                           setTimeout(() => {
                               const x = window.innerWidth / 2;
                               const y = window.innerHeight / 2;
                               uiManager.createFloatingText('The Exchange Unlocked', x, y, '#c084fc', 3000);
                           }, 300);
                       }

                       // Ship Reward Intercept
                       const randomShipReward = mission.rewards?.find(r => r.type.toLowerCase() === 'grant_random_ship');
                       if (randomShipReward && randomShipReward.grantedShipId && !licenseReward) {
                           setTimeout(() => {
                               if (uiManager.simulationService && uiManager.simulationService.gameState) {
                                   const coreState = uiManager.simulationService.gameState;
                                   
                                   // Change screen to Hangar
                                   coreState.activeNav = NAV_IDS.STARPORT;
                                   coreState.activeScreen = SCREEN_IDS.HANGAR;
                                   coreState.lastActiveScreen[NAV_IDS.STARPORT] = SCREEN_IDS.HANGAR;
                                   
                                   // Focus the newly acquired ship in the hangar carousel
                                   if (!coreState.uiState) coreState.uiState = {};
                                   coreState.uiState.hangarShipyardToggleState = 'hangar';
                                   
                                   const newShipIndex = coreState.player.ownedShipIds.indexOf(randomShipReward.grantedShipId);
                                   if (newShipIndex !== -1) {
                                       coreState.uiState.hangarActiveIndex = newShipIndex;
                                   }
                                   
                                   coreState.setState({});
                               }
                           }, 500);
                       }

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
                                               
                                               // Unblur and restore background now
                                               if (stickyBarEl) {
                                                   stickyBarEl.style.display = 'block';
                                                   stickyBarEl.style.transition = 'none';
                                                   stickyBarEl.style.opacity = '1';
                                                   stickyBarEl.style.filter = 'none';
                                                   stickyBarEl.style.webkitFilter = 'none';
                                               }
                                               
                                               // Force render standard view with NEW state
                                               uiManager.render(coreState.getState());
                                           } else {
                                                if (stickyBarEl) {
                                                   stickyBarEl.style.display = 'block';
                                                   stickyBarEl.style.transition = 'none';
                                                   stickyBarEl.style.opacity = '1';
                                                   stickyBarEl.style.filter = 'none';
                                                   stickyBarEl.style.webkitFilter = 'none';
                                               }
                                               uiManager.render();
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
                           // Standard upgrade sequence transition
                           if (stickyBarEl) {
                               stickyBarEl.style.transition = 'none';
                               stickyBarEl.style.filter = 'none';
                               stickyBarEl.style.webkitFilter = 'none';
                           }
                           
                           // Bypassed direct sequence orchestration. SimulationService._grantRewards handles it upon resolution.
                           if (uiManager.lastKnownState) {
                               uiManager.render(uiManager.lastKnownState);
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
               if (mission.completion?.choices && mission.completion.choices.length > 0) {
                   mission.completion.choices.forEach((choice) => {
                       const choiceBtn = document.createElement('button');
                       choiceBtn.className = `btn w-full mb-2 ${choice.buttonClass || 'mission-action-btn host-btn-pulse'}`;
                       if (choice.buttonStyle) {
                           choiceBtn.style.cssText = btnStyles + choice.buttonStyle;
                       } else {
                           choiceBtn.style.cssText = btnStyles;
                       }
                       choiceBtn.textContent = choice.buttonText;
                       
                       // SPARE SHIP CHECK
                       const requiresSpareShip = choice.rewards && choice.rewards.some(r => r.type === 'REMOVE_SPARE_SHIP');
                       const hasSpareShip = this.manager.lastKnownState.player.ownedShipIds.length > 1;
                       
                       if (requiresSpareShip && !hasSpareShip) {
                           choiceBtn.disabled = true;
                           choiceBtn.classList.add('opacity-50', 'cursor-not-allowed');
                           choiceBtn.textContent = 'RESERVE HULL REQUIRED';
                       }

                       choiceBtn.onclick = (e) => {
                           if (requiresSpareShip && !hasSpareShip) return;
                           Array.from(buttonsEl.querySelectorAll('button')).forEach(b => b.disabled = true);
                           
                           const processChoice = () => {
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
                                   
                                   // Immediately initiate the UI teardown sequence visually
                                   modal.dataset.dismissOutside = 'false';
                                   modal.classList.add('dismiss-disabled');
                                   modalContent.classList.add('modal-blur-fade-out');
                                   modal.classList.add('backdrop-fade-out-slow');
    
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
    
                                   setTimeout(() => {
                                       // Mask the DOM instantly under the opaque white screen
                                       modal.classList.add('hidden');
                                       modal.classList.remove('modal-visible', 'dismiss-disabled', 'modal-blur-fade-out', 'backdrop-fade-out-slow');
                                       delete modal.dataset.theme;
                                       delete modal.dataset.dismissInside;
                                       delete modal.dataset.dismissOutside;
    
                                       if (this.manager.modalEngine && this.manager.modalEngine.processModalQueue) {
                                           this.manager.modalEngine.processModalQueue();
                                       }
    
                                       if (card) card.remove();
                                       
                                       // Begin fading out the white screen
                                       whiteOverlay.style.transition = 'opacity 2s ease-in-out';
                                       whiteOverlay.style.opacity = '0';
                                       
                                       setTimeout(() => {
                                           whiteOverlay.remove();
                                           
                                           mission.rewards = choice.rewards;
                                           
                                           if (this.manager.simulationService) {
                                               const uiManager = this.manager;
                                               const originalRender = uiManager.render;
                                               
                                               // Temporarily hijack render to intercept sticky bar artifacts
                                               uiManager.render = function(...args) {
                                                   const newState = args[0] || uiManager.lastKnownState;
                                                   uiManager.lastKnownState = newState;
                                                   if (uiManager.missionControl) {
                                                       uiManager.missionControl.renderStickyBar(newState);
                                                   }
                                               };
                                               
                                               // Complete the mission to trigger the delayed rewards
                                               this.manager.simulationService.missionService.completeMission(mission.id);
                                               
                                               uiManager.render = originalRender;
                                               
                                               // Manually inject specific blue 'Ship Acquired' floating text adjacent to the credit text
                                               const hasOdyssey = choice.rewards.some(r => r.type === 'GRANT_SHIP' && r.shipId === 'Odyssey.Ship');
                                               if (hasOdyssey) {
                                                   const btn = e.target ? (e.target.closest('button') || e.target) : document.body;
                                                   const rect = btn.getBoundingClientRect ? btn.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
                                                   const x = e.clientX || rect.left + (rect.width / 2);
                                                   const y = e.clientY || rect.top;
    
                                                   // Adjacent to the credit text (+ 40y)
                                                   this.manager.createFloatingText(`+ Odyssey`, x, y + 40, '#60a5fa');
                                               }
                                               
                                               if (stickyBarEl) {
                                                   stickyBarEl.style.transition = 'none';
                                                   stickyBarEl.style.filter = 'none';
                                                   stickyBarEl.style.webkitFilter = 'none';
                                               }
                                               
                                               // Explicit render pass with the newly mutated state to guarantee the navigation bar updates instantly
                                               if (this.manager.simulationService && this.manager.simulationService.gameState) {
                                                   this.manager.render(this.manager.simulationService.gameState.getState());
                                               } else {
                                                   this.manager.render();
                                               }
                                           }
                                           closeHandler(); // Resolve modal closure cleanly
                                       }, 2000);
                                   }, 3000);
                               } else if (mission.completion?.steps && mission.completion.steps.length > 0) {
                                   if (this.manager.modalEngine && typeof this.manager.modalEngine.destroyModalInstant === 'function') {
                                       this.manager.modalEngine.destroyModalInstant('mission-modal');
                                   } else {
                                       const modalEl = document.getElementById('mission-modal');
                                       if (modalEl) {
                                           modalEl.classList.add('hidden');
                                           modalEl.classList.remove('modal-visible', 'dismiss-disabled', 'modal-blur-fade-out', 'backdrop-fade-out-slow');
                                       }
                                   }
                                   this._processCompletionSteps(mission, mission.completion.steps, 0, () => {
                                       mission.rewards = choice.rewards;
                                       executeCompletion(e);
                                   });
                               } else {
                                   mission.rewards = choice.rewards;
                                   executeCompletion(e);
                               }
                           };

                           if (requiresSpareShip) {
                               this._handleReserveHullTransfer(() => {
                                   processChoice();
                               });
                           } else {
                               processChoice();
                           }
                       };
                       buttonsEl.appendChild(choiceBtn);
                   });
               } else {
                   const completeBtn = document.createElement('button');
                   completeBtn.className = hasSpace ? 'btn w-full mission-action-btn host-btn-pulse' : 'btn w-full bg-slate-700 text-gray-400 border-gray-600';
                   completeBtn.textContent = hasSpace ? (mission.completion?.buttonText || 'Complete') : 'INSUFFICIENT CARGO SPACE';
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

                       } else if (mission.completion?.steps && mission.completion.steps.length > 0) {
                           if (this.manager.modalEngine && typeof this.manager.modalEngine.destroyModalInstant === 'function') {
                               this.manager.modalEngine.destroyModalInstant('mission-modal');
                           } else {
                               const modalEl = document.getElementById('mission-modal');
                               if (modalEl) {
                                   modalEl.classList.add('hidden');
                                   modalEl.classList.remove('modal-visible', 'dismiss-disabled', 'modal-blur-fade-out', 'backdrop-fade-out-slow');
                               }
                           }
                           this._processCompletionSteps(mission, mission.completion.steps, 0, () => {
                               executeCompletion(e);
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
            .replaceAll('[location name]', locationName); 
        
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
             .replaceAll('[location name]', locationName)
            .replaceAll('[commodity name]', commodityName)
            .replaceAll('[discount amount %]', discountStr);

        result = result.replace(/\[durationDays\]\s*days/g, durationStr); 
        result = result.replaceAll('[durationDays]', durationStr); 
        
        if (!price || price === 0) {
            // Gracefully replace pricing statements with "nothing" narratives.
            result = result.replace(/You paid <span class="credits-text-pulsing">⌬ \[credit price\]<\/span> for this intel\./g, "You paid nothing for this intel.");
            result = result.replace(/This intel was secured for \[⌬ credit price\]\./g, "This intel was secured for nothing.");
            result = result.replace(/This access was \[⌬ credit price\]\./g, "This access was granted.");
            
            // Standard tag replacements just in case
            result = result.replace(/<span class="credits-text-pulsing">⌬ \[credit price\]<\/span>/g, 'nothing');
            result = result.replaceAll('[⌬ credit price]', 'nothing');
        } else {
            // Normal pricing string handling
            const priceStr = formatCredits(-price, true);
            result = result.replace(/<span class="credits-text-pulsing">⌬ \[credit price\]<\/span>/g, `<span class="text-glow-red">${priceStr}</span>`);
            result = result.replaceAll('[⌬ credit price]', `<span class="text-glow-red">${priceStr}</span>`);
        }

         return result;
    }

    _parseMissionText(text, gameState) {
        if (!text) return '';
        let parsedText = text;
        
        if (parsedText.includes('[playerName]')) {
            const pName = gameState.player?.name || 'Captain';
            parsedText = parsedText.replaceAll('[playerName]', pName);
        }
        
        if (parsedText.includes('[shipName]')) {
            const activeId = gameState.player?.activeShipId;
            const shipName = activeId && DB.SHIPS[activeId] ? DB.SHIPS[activeId].name : 'Vessel';
            parsedText = parsedText.replaceAll('[shipName]', shipName);
        }
        
        return parsedText;
    }

    _processCompletionSteps(mission, steps, index, finalCallback) {
        if (!steps || index >= steps.length) {
            if (finalCallback) finalCallback();
            return;
        }

        const step = steps[index];
        const next = () => this._processCompletionSteps(mission, steps, index + 1, finalCallback);

        const executeStep = () => {
            if (step.type === 'NARRATION_MODAL') {
                this.manager.queueModal('mission-modal', step.title, step.text, next, {
                    portraitId: step.portraitId || mission.portraitId,
                    portraitName: step.portraitName || mission.portraitName,
                    portraitFilter: step.portraitFilter || mission.portraitFilter,
                    dismissOutside: false,
                    noModalVisible: !!step.crtEffect, // Bypass standard fade-in for CRT sequence
                    customSetup: (modal, closeHandler) => {
                        const modalContent = modal.querySelector('.modal-content');
                        
                        modalContent.classList.remove('modal-blur-fade-out');
                        modal.classList.remove('backdrop-fade-out-slow', 'dismiss-disabled');

                        modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
                        const activeHost = step.host || mission.completion?.host || mission.host || 'UNKNOWN';
                        const hostClass = `host-${activeHost.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                        modalContent.classList.add(hostClass);

                        // Inject Filter Override Surgically
                        const portraitEl = modal.querySelector('.portrait-thumbnail');
                        if (portraitEl) {
                            const pFilter = step.portraitFilter || mission.completion?.portraitFilter || mission.portraitFilter || 'none';
                            portraitEl.style.filter = pFilter;
                            portraitEl.style.webkitFilter = pFilter;
                        }

                        // Hide unnecessary mission parts
                        const typeEl = modal.querySelector('#mission-modal-type');
                        if (typeEl) typeEl.style.display = 'none';

                        const objectivesEl = modal.querySelector('#mission-modal-objectives');
                        if (objectivesEl) objectivesEl.style.display = 'none';

                        const rewardsEl = modal.querySelector('#mission-modal-rewards');
                        if (rewardsEl) rewardsEl.style.display = 'none';

                        // Populate Title and Description FIRST before touching the wrapper
                        modal.querySelector('#mission-modal-title').textContent = step.title;
                        const targetDescEl = modal.querySelector('#mission-modal-description');
                        if (targetDescEl) {
                            targetDescEl.innerHTML = step.text;
                        }

                        // Handle CRT Effect Invocation
                        if (step.crtEffect) {
                            modalContent.classList.remove('sev-crt-shutdown');
                            modalContent.classList.add('sev-crt-turn-on');
                            modalContent.style.animationDuration = '0.4s';
                            if (modalContent._crtTimeout) clearTimeout(modalContent._crtTimeout);
                            modalContent._crtTimeout = setTimeout(() => {
                                modalContent.classList.remove('sev-crt-turn-on');
                                modalContent.style.animationDuration = '';
                            }, 400);
                        }

                        // Scroll Wrapper Configuration
                        let outerWrapper = modal.querySelector('.mission-scroll-outer');
                        let wrapper = modal.querySelector('.mission-scroll-wrapper');
                        let indicator = modal.querySelector('.scroll-indicator-arrow');

                        if (!wrapper && targetDescEl) {
                            outerWrapper = document.createElement('div');
                            outerWrapper.className = 'mission-scroll-outer w-full relative mb-2 mt-2';
                            
                            wrapper = document.createElement('div');
                            wrapper.className = 'mission-scroll-wrapper w-full overflow-y-auto custom-scrollbar px-1 mb-2 flex flex-col items-center';
                            wrapper.style.maxHeight = '304px'; 
                            
                            targetDescEl.parentNode.insertBefore(outerWrapper, targetDescEl);
                            outerWrapper.appendChild(wrapper);
                            
                            indicator = document.createElement('div');
                            indicator.className = 'scroll-indicator-arrow';
                            indicator.innerHTML = '&#8964;';
                            indicator.style.transition = 'opacity 0.2s ease-in-out';
                            outerWrapper.appendChild(indicator);
                        }

                        if (wrapper) {
                            // Clear any leftover custom images from previous steps
                            wrapper.querySelectorAll('.step-custom-image').forEach(el => el.remove());

                            // Re-append to guarantee correct visual stacking order
                            if (step.customImage) {
                                const imgDiv = document.createElement('div');
                                imgDiv.className = 'w-full flex justify-center mb-4 mt-1 shrink-0 step-custom-image';
                                imgDiv.innerHTML = `<img src="${step.customImage}" class="rounded border border-gray-600 shadow-[0_0_15px_rgba(0,0,0,0.8)]" style="max-height: 160px; object-fit: cover; width: 100%;">`;
                                wrapper.appendChild(imgDiv);
                            }

                            // Unconditionally secure all core blocks back inside the wrapper
                            if (targetDescEl) wrapper.appendChild(targetDescEl);
                            if (objectivesEl) wrapper.appendChild(objectivesEl);
                            if (rewardsEl) wrapper.appendChild(rewardsEl);

                            if (indicator) {
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
                        }

                        // Buttons setup
                        const buttonsEl = modal.querySelector('#mission-modal-buttons');
                        const btnStyles = "padding-top: 0.3rem; padding-bottom: 0.3rem; min-height: 28px;";
                        const btnText = step.buttonText || "Understood";
                        
                        buttonsEl.innerHTML = '';
                        
                        const confirmBtn = document.createElement('button');
                        confirmBtn.className = 'btn w-full mission-action-btn host-btn-pulse';
                        confirmBtn.style.cssText = btnStyles;
                        confirmBtn.textContent = btnText;
                        
                        confirmBtn.onclick = (e) => {
                            e.preventDefault();
                            confirmBtn.disabled = true;
                            
                            if (step.crtEffect) {
                                modalContent.classList.remove('sev-crt-turn-on');
                                modalContent.classList.add('sev-crt-shutdown');
                                modalContent.style.animationDuration = '0.35s';
                                setTimeout(() => {
                                    if (this.manager.modalEngine && typeof this.manager.modalEngine.destroyModalInstant === 'function') {
                                        this.manager.modalEngine.destroyModalInstant('mission-modal');
                                    }
                                    closeHandler();
                                }, 340);
                            } else {
                                modalContent.classList.add('modal-blur-fade-out');
                                modal.classList.add('backdrop-fade-out-slow');
                                setTimeout(() => {
                                    if (this.manager.modalEngine && typeof this.manager.modalEngine.destroyModalInstant === 'function') {
                                        this.manager.modalEngine.destroyModalInstant('mission-modal');
                                    }
                                    closeHandler();
                                }, 800);
                            }
                        };
                        
                        buttonsEl.appendChild(confirmBtn);
                    }
                });
                
                this.manager.modalEngine.processModalQueue();
                
            } else if (step.type === 'PLAY_CINEMATIC') {
                const blackOverlay = document.createElement('div');
                blackOverlay.className = 'fixed inset-0 z-[99999] pointer-events-none transition-opacity duration-1000 bg-black opacity-100';
                document.body.appendChild(blackOverlay);
                
                CinematicService.playVideo(step.sequenceId).then(async () => {
                    await new Promise(r => setTimeout(r, 1000));
                    
                    if (step.sequenceId === 'assets/images/video/kepler_rud.mp4') {
                        const coreState = this.manager.simulationService?.gameState || this.manager.lastKnownState;
                        if (coreState) {
                            coreState.currentLocationId = 'loc_neptune';
                            if (coreState.player && coreState.player.unlockedLocationIds) {
                                coreState.player.unlockedLocationIds = coreState.player.unlockedLocationIds.filter(id => id !== 'loc_kepler');
                            }
                            if (this.manager.simulationService) {
                                this.manager.simulationService.saveGame();
                            }
                        }
                    }

                    blackOverlay.style.opacity = '0';
                    setTimeout(() => blackOverlay.remove(), 1000);
                    next();
                }).catch(err => {
                    this.manager.logger.error('UIMissionControl', 'Cinematic playback failed', err);
                    blackOverlay.style.opacity = '0';
                    setTimeout(() => blackOverlay.remove(), 1000);
                    next();
                });
            } else {
                next();
            }
        };

        // Delay execution if specified (e.g., waiting for cinematic fade-ins)
        if (step.delay) {
            setTimeout(executeStep, step.delay);
        } else {
            executeStep();
        }
    }

    _handleReserveHullTransfer(callback) {
        const gameState = this.manager.lastKnownState;
        const fleet = gameState.player.ownedShipIds;
        const activeShipId = gameState.player.activeShipId;
        
        const reserveShips = fleet.filter(id => id !== activeShipId);
        
        const modal = document.getElementById('reserve-hull-modal');
        if (!modal) return;
        
        const listEl = modal.querySelector('#reserve-hull-list');
        const confirmBtn = modal.querySelector('#reserve-hull-confirm-btn');
        const cancelBtn = modal.querySelector('#reserve-hull-cancel-btn');
        
        listEl.innerHTML = '';
        let selectedShipId = null;
        
        reserveShips.forEach(shipId => {
            const shipDef = DB.SHIPS[shipId];
            const state = gameState.player.shipStates[shipId];
            
            const item = document.createElement('div');
            item.className = 'p-3 border border-gray-700 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-700/50 transition-colors flex justify-between items-center mb-2';
            item.innerHTML = `
                <div>
                    <div class="font-bold text-white">${shipDef.name}</div>
                    <div class="text-xs text-gray-400">Class ${shipDef.class} | Hull: ${Math.floor(state.health)}</div>
                </div>
                <div class="selection-indicator w-4 h-4 rounded-full border border-gray-500 flex-shrink-0"></div>
            `;
            
            item.onclick = () => {
                Array.from(listEl.children).forEach(c => {
                    c.classList.remove('border-purple-400', 'bg-purple-900/30');
                    c.querySelector('.selection-indicator').classList.remove('bg-purple-400', 'border-purple-400');
                    c.querySelector('.selection-indicator').classList.add('border-gray-500');
                });
                
                item.classList.add('border-purple-400', 'bg-purple-900/30');
                item.querySelector('.selection-indicator').classList.remove('border-gray-500');
                item.querySelector('.selection-indicator').classList.add('bg-purple-400', 'border-purple-400');
                
                selectedShipId = shipId;
                confirmBtn.disabled = false;
            };
            
            listEl.appendChild(item);
        });
        
        confirmBtn.disabled = true;
        
        const closeAndClean = () => {
            modal.classList.add('hidden');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            const missionModal = document.getElementById('mission-modal');
            if (missionModal) {
                Array.from(missionModal.querySelectorAll('button')).forEach(b => {
                    if (b.dataset.action !== 'accept-mission' && b.dataset.action !== 'skip-tutorial') {
                        b.disabled = false;
                    }
                });
            }
        };
        
        cancelBtn.onclick = () => {
            closeAndClean();
        };
        
        confirmBtn.onclick = () => {
            if (selectedShipId) {
                // Permanently delete the hull record
                gameState.player.ownedShipIds = gameState.player.ownedShipIds.filter(id => id !== selectedShipId);
                delete gameState.player.shipStates[selectedShipId];
                delete gameState.player.inventories[selectedShipId];
                
                modal.classList.add('hidden');
                
                // Immediately update state and visually update fleet references
                if (this.manager.simulationService) {
                    this.manager.simulationService.gameState.setState({});
                }
                
                if (callback) callback();
            }
        };
        
        modal.classList.remove('hidden');
    }
}