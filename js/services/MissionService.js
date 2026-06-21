// js/services/MissionService.js
/**
 * @fileoverview Manages the state and flow of player missions.
 * Orchestrates the MissionObjectiveEvaluator and MissionTriggerEvaluator.
 * UPDATED: Includes COLLECT_ITEM logistics injection and strict DB optional chaining.
 * UPDATED: Act III Location-Triggered Cinematics architecture deployed.
 */
import { DB } from '../data/database.js';
import { formatCredits } from '../utils.js';
import { MissionObjectiveEvaluator } from './mission/MissionObjectiveEvaluator.js';
import { MissionTriggerEvaluator } from './mission/MissionTriggerEvaluator.js';
import { SystemStateService } from './world/SystemStateService.js';

export class MissionService {
    /**
     * @param {import('./GameState.js').GameState} gameState The central game state.
     * @param {import('./UIManager.js').UIManager} uiManager The UI manager instance.
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, uiManager, logger) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.simulationService = null; // Will be injected post-instantiation
        
        // Initialize Logic Engines
        this.objectiveEvaluator = new MissionObjectiveEvaluator();
        this.triggerEvaluator = new MissionTriggerEvaluator();
        
        // Internal flag to allow DEBUG missions to appear in the standard terminal
        this._debugMissionsUnlocked = false; 
        
        // Dynamic set to force-allow specific missions to appear in the terminal
        this._forcedTerminalMissions = new Set();
    }

    /**
     * Injects the SimulationService after all services have been instantiated.
     * @param {import('./SimulationService.js').SimulationService} simulationService
     */
    setSimulationService(simulationService) {
        this.simulationService = simulationService;
    }

    /**
     * Checks if all prerequisites for a given mission are met.
     * Delegates to MissionTriggerEvaluator.
     * @param {string} missionId The ID of the mission to check.
     * @returns {boolean} True if all prerequisites are met, false otherwise.
     */
    arePrerequisitesMet(missionId) {
        const mission = DB.MISSIONS?.[missionId];
        if (!mission) return false;
        
        // Support both old 'prerequisites' and new 'triggers' fields
        const constraints = mission.triggers || mission.prerequisites;
        
        return this.triggerEvaluator.checkAll(constraints, this.gameState);
    }
    
    /**
     * Forces a specific mission to bypass prerequisites and render in the terminal.
     * @param {string} missionId 
     */
    forceToTerminal(missionId) {
        if (!this._forcedTerminalMissions) this._forcedTerminalMissions = new Set();
        this._forcedTerminalMissions.add(missionId);
        this.uiManager.render(this.gameState.getState());
    }
    
    /**
     * Gets a list of all missions that are currently available to the player.
     * @returns {Array<object>} An array of available mission objects.
     */
    getAvailableMissions() {
        const { activeMissionIds, completedMissionIds } = this.gameState.missions;
        return Object.values(DB.MISSIONS || {}).filter(mission => {
            const isForced = this._forcedTerminalMissions && this._forcedTerminalMissions.has(mission.id);
            const isAvailable =
                !activeMissionIds.includes(mission.id) &&
                !completedMissionIds.includes(mission.id) &&
                (mission.type !== 'DEBUG' || this._debugMissionsUnlocked || isForced) &&
                (this.arePrerequisitesMet(mission.id) || isForced);
            return isAvailable;
        });
    }

    /**
     * Exposes debug test missions into the available terminal for UI and fallback testing.
     */
    injectTestMissions() {
        this._debugMissionsUnlocked = true;
        
        if (this.logger && this.logger.warn) {
            this.logger.warn('MissionService', `Exposed test missions to the Mission Terminal.`);
        }
        
        // Force a re-render to update the terminal UI immediately
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Accepts a new mission, setting it as active.
     * @param {string} missionId The ID of the mission to accept.
     * @param {boolean} [force=false] If true, bypasses checks.
     */
    acceptMission(missionId, force = false) {
        const mission = DB.MISSIONS?.[missionId];
        
        // 1. Validation (skipped if forced)
        if (!force) {
            // Check max missions (4)
            if (this.gameState.missions.activeMissionIds.length >= 4) {
                this.logger.warn('MissionService', `Cannot accept ${missionId}: Mission log full (4/4).`);
                return;
            }
            const isForcedTerminal = this._forcedTerminalMissions && this._forcedTerminalMissions.has(missionId);
            if (!mission || (!this.arePrerequisitesMet(missionId) && !isForcedTerminal)) {
                return;
            }
        }

        // 2. Handle Existing (Prevent Duplicate)
        if (this.gameState.missions.activeMissionIds.includes(missionId)) {
            return; 
        }

        // 3. Cargo Space Validation
        let totalGrantedSpace = 0;
        const itemsToGrant = [];

        if (mission.grantedCargo && mission.grantedCargo.length > 0) {
            mission.grantedCargo.forEach(cargo => {
                totalGrantedSpace += cargo.quantity;
                itemsToGrant.push(cargo);
            });
        }
        if (mission.onAccept) {
            mission.onAccept.forEach(action => {
                if (action.type === 'GRANT_ITEM' && action.items) {
                    action.items.forEach(cargo => {
                        totalGrantedSpace += cargo.quantity;
                        itemsToGrant.push(cargo);
                    });
                }
            });
        }

        if (totalGrantedSpace > 0) {
            let fleetAvailableSpace = 0;
            const shipCapacities = [];

            for (const shipId of this.gameState.player.ownedShipIds) {
                let usedSpace = 0;
                if (this.gameState.player.inventories[shipId]) {
                    Object.values(this.gameState.player.inventories[shipId]).forEach(item => {
                        usedSpace += item.quantity;
                    });
                }
                
                const maxCap = this.simulationService ? 
                    this.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                    (DB.SHIPS?.[shipId]?.cargoCapacity || 100);
                    
                const availableSpace = Math.max(0, maxCap - usedSpace);
                fleetAvailableSpace += availableSpace;
                shipCapacities.push({ shipId, availableSpace });
            }
            
            if (fleetAvailableSpace < totalGrantedSpace) {
                const errorMsg = `Cannot accept mission: Insufficient cargo space. You need space in your fleet for ${totalGrantedSpace} units.`;
                if (this.uiManager) {
                    this.uiManager.queueModal('event-modal', 'Insufficient Cargo Space', errorMsg);
                }
                return; // Abort acceptance
            }
            
            this._tempShipCapacities = shipCapacities;
        }

        // 4. Initialize State
        this.gameState.missions.activeMissionIds.push(missionId);
        
        // Remove from forced terminal state if it was there
        if (this._forcedTerminalMissions) {
            this._forcedTerminalMissions.delete(missionId);
        }
        
        // Initialize progress with isCompletable flag AND acceptDay timestamp
        this.gameState.missions.missionProgress[missionId] = {
            objectives: {},
            isCompletable: false,
            acceptDay: this.gameState.day
        };

        // Initialize deferred cargo state for Logistics missions
        if (mission.deferredCargo && mission.deferredCargo.length > 0) {
            this.gameState.missions.missionProgress[missionId].cargoLoaded = false;
        }

        // Auto-track logic: If no mission is being tracked, track this one.
        if (!this.gameState.missions.trackedMissionId) {
            this.gameState.missions.trackedMissionId = missionId;
        }
        
        this.logger.info.player(this.gameState.day, 'MISSION_ACCEPT', `Accepted mission: ${missionId} ${force ? '(FORCED)' : ''}`);
        
        // 5. Grant Start Items
        if (itemsToGrant.length > 0 && this._tempShipCapacities) {
            const activeShipId = this.gameState.player.activeShipId;
            // Sort to prioritize active ship
            this._tempShipCapacities.sort((a, b) => {
                if (a.shipId === activeShipId) return -1;
                if (b.shipId === activeShipId) return 1;
                return b.availableSpace - a.availableSpace;
            });

            itemsToGrant.forEach(cargo => {
                let remainingToDistribute = cargo.quantity;
                for (const shipData of this._tempShipCapacities) {
                    if (remainingToDistribute <= 0) break;
                    const spaceHere = shipData.availableSpace;
                    if (spaceHere > 0) {
                        const amountToPut = Math.min(remainingToDistribute, spaceHere);
                        
                        if (!this.gameState.player.inventories[shipData.shipId]) {
                            this.gameState.player.inventories[shipData.shipId] = {};
                        }
                        if (!this.gameState.player.inventories[shipData.shipId][cargo.goodId]) {
                            this.gameState.player.inventories[shipData.shipId][cargo.goodId] = { quantity: 0, avgCost: 0 };
                        }
                        
                        this.gameState.player.inventories[shipData.shipId][cargo.goodId].quantity += amountToPut;
                        
                        shipData.availableSpace -= amountToPut;
                        remainingToDistribute -= amountToPut;
                    }
                }
            });
            delete this._tempShipCapacities;
        }

        if (this.simulationService && typeof this.simulationService.grantMissionCargo === 'function') {
            this.simulationService.grantMissionCargo(missionId);
        }

        // --- VIRTUAL WORKBENCH: Narrative Intel Granting ---
        if (missionId === 'mission_10' && this.simulationService && this.simulationService.intelService) {
             this.simulationService.intelService.grantNarrativeIntel({
                 commodityId: 'water_ice',
                 dealLocationId: 'loc_earth',
                 discountPercent: 0.80, // Heavy markup to ensure it stands out
                 durationDays: 120, // Long runway for the player to figure out navigation
                 messageKey: 'STORY_HOOK_01'
             });
        } else if (missionId === 'mission_18' && this.simulationService && this.simulationService.intelService) {
             const allowedLocs = this.gameState.player.unlockedLocationIds.filter(loc => loc !== 'loc_pluto');
             const dealLocationId = allowedLocs.length > 0 ? allowedLocs[Math.floor(Math.random() * allowedLocs.length)] : 'loc_earth';
             this.simulationService.intelService.grantNarrativeIntel({
                 commodityId: 'cybernetics', 
                 dealLocationId: dealLocationId, 
                 discountPercent: 0.70, 
                 durationDays: 120 
             });
        }

        // --- NEW: ON ACCEPT ACTIONS (System State Triggers & Credit Grants) ---
        if (mission.onAccept) {
            mission.onAccept.forEach(action => {
                if (action.type === 'TRIGGER_SYSTEM_STATE') {
                    // Refactored to use the injected SimulationService -> SystemStateService connection
                    if (this.simulationService && this.simulationService.systemStateService) {
                        this.simulationService.systemStateService.triggerState(action.stateId);
                    } else {
                        // Fallback in the rare event injection failed
                        this.logger.warn('MissionService', 'SimulationService.systemStateService unavailable. Initializing temporary instance.');
                        const sysStateService = new SystemStateService(this.gameState, this.logger);
                        sysStateService.triggerState(action.stateId);
                    }
                    
                    // Force a re-render so the state is recognized before the modal tries to display it
                    this.gameState.setState({});
                    
                    // Queue the modal to display to the user
                    if (this.uiManager && typeof this.uiManager.showEconWeatherModal === 'function') {
                        setTimeout(() => {
                            this.uiManager.showEconWeatherModal(this.gameState.getState());
                        }, 600); // Slight delay to ensure modal queue is clear of the mission modal
                    }
                } else if (action.type === 'GRANT_CREDITS') {
                    this.gameState.player.credits += action.amount;
                    this.logger.info.player(this.gameState.day, 'MISSION_REWARD', `Granted ⌬ ${formatCredits(action.amount)} upon mission acceptance.`);
                    
                    this.gameState.setState({});
                } else if (action.type === 'QUEUE_STORY_EVENT') {
                    if (this.simulationService) {
                        this.simulationService.queueStoryEvent(action.eventId);
                    }
                } else if (action.type === 'UNLOCK_LOCATION') {
                    if (!this.gameState.player.unlockedLocationIds.includes(action.locationId)) {
                        this.gameState.player.unlockedLocationIds.push(action.locationId);
                        this.logger.info.player(this.gameState.day, 'LOCATION_UNLOCKED', `Unlocked location: ${action.locationId} via mission action.`);
                        this.gameState.setState({});
                    }
                }
            });
        }

        // --- NEW: Auto-Navigate for Intel ---
        if (mission.grantedIntel && mission.grantedIntel.length > 0) {
            if (this.simulationService) {
                this.simulationService.setScreen('data', 'intel');
                this.simulationService.setIntelTab('intel-market-content');
            }
        }

        // 6. Apply Navigation Locks if specified
        if (mission.navLock && this.simulationService) {
            this.simulationService.setNavigationLock(
                mission.navLock.navIds || [],
                mission.navLock.screenIds || []
            );
        }
        
        // 7. Initial Check & Render
        this.checkTriggers(); 

        // If the mission has no objectives, mark it as completable immediately, but do NOT auto-complete it.
        if (!mission.objectives || mission.objectives.length === 0) {
            this.gameState.missions.missionProgress[missionId].isCompletable = true;
        }
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Calculates the baseline amount of a commodity currently protected by active missions.
     * Prevents the player from selling third-party cargo or depositing it for alternative missions.
     * @param {string} goodId 
     * @param {string|null} excludedMissionId Mission ID to omit from protection sum (e.g. when depositing for itself).
     * @returns {{baseline: number, missions: Array<string>}}
     */
    getProtectedBaseline(goodId, excludedMissionId = null) {
        let baseline = 0;
        let protectedMissions = [];
        
        this.gameState.missions.activeMissionIds.forEach(missionId => {
            if (missionId === excludedMissionId) return;
            
            const mission = DB.MISSIONS?.[missionId];
            const progress = this.gameState.missions.missionProgress[missionId];
            
            let missionRequiresThisGood = false;
            let protectedQuantity = 0;

            if (mission && progress) {
                // Check deferred cargo (only protected if it has been loaded)
                if (mission.deferredCargo && progress.cargoLoaded) {
                    const cDef = mission.deferredCargo.find(c => c.goodId === goodId);
                    if (cDef) {
                        missionRequiresThisGood = true;
                        protectedQuantity += cDef.quantity;
                    }
                }
                
                // Check granted cargo (protected immediately)
                if (mission.grantedCargo) {
                    const cDef = mission.grantedCargo.find(c => c.goodId === goodId);
                    if (cDef) {
                        missionRequiresThisGood = true;
                        protectedQuantity += cDef.quantity;
                    }
                }
                
                if (mission.onAccept) {
                    mission.onAccept.forEach(action => {
                        if (action.type === 'GRANT_ITEM' && action.items) {
                            action.items.forEach(cDef => {
                                if (cDef.goodId === goodId) {
                                    missionRequiresThisGood = true;
                                    protectedQuantity += cDef.quantity;
                                }
                            });
                        }
                    });
                }

                if (missionRequiresThisGood) {
                    // Reduce protection by what has already been deposited for this mission
                    let deposited = 0;
                    let sellExemption = 0;
                    if (mission.objectives) {
                        mission.objectives.forEach(obj => {
                            if ((obj.type === 'DELIVER_ITEM' || obj.type === 'have_item' || obj.type === 'HAVE_ITEM') && (obj.goodId === goodId || obj.target === goodId)) {
                                const objKey = obj.id || obj.goodId || obj.target;
                                deposited += (progress.objectives[objKey]?.deposited || 0);
                            }
                            // EXEMPTION: Fencing Missions (Like M24). Selling it IS the objective, so do not protect it from the market.
                            if ((obj.type === 'TRADE_ITEM' || obj.type === 'trade_item') && obj.tradeType === 'sell' && (obj.goodId === goodId || obj.target === goodId)) {
                                sellExemption += (obj.quantity || obj.value || 1);
                            }
                        });
                    }
                    
                    const remainingProtected = Math.max(0, protectedQuantity - deposited - sellExemption);
                    if (remainingProtected > 0) {
                        baseline += remainingProtected;
                        if (!protectedMissions.includes(missionId)) {
                            protectedMissions.push(missionId);
                        }
                    }
                }
            }
        });
        
        return { baseline, missions: protectedMissions };
    }

    /**
     * Executes the punitive consequences for violating the Third-Party Cargo protocol.
     * Abandons the mission and converts cargo value to player debt.
     * @param {string} missionId 
     */
    penalizeThirdPartyInfraction(missionId) {
        const mission = DB.MISSIONS?.[missionId];
        if (!mission) return;
        
        let penaltyValue = 0;
        const cargoArrays = [];
        if (mission.deferredCargo) cargoArrays.push(...mission.deferredCargo);
        if (mission.grantedCargo) cargoArrays.push(...mission.grantedCargo);
        if (mission.onAccept) {
            mission.onAccept.forEach(action => {
                if (action.type === 'GRANT_ITEM' && action.items) {
                    cargoArrays.push(...action.items);
                }
            });
        }
        
        cargoArrays.forEach(c => {
            const commodity = DB.COMMODITIES?.find(comm => comm.id === c.goodId);
            let basePrice = this.gameState.market.galacticAverages[c.goodId];
            if (!basePrice && commodity && commodity.basePriceRange) {
                basePrice = (commodity.basePriceRange[0] + commodity.basePriceRange[1]) / 2;
            }
            penaltyValue += ((basePrice || 0) * c.quantity);
        });

        // FORCE INTEGER TO PREVENT FRACTIONAL DEBT BUGS AND GHOST LOANS
        penaltyValue = Math.round(penaltyValue);

        if (penaltyValue > 0) {
            const interestAmount = Math.ceil(penaltyValue * 0.02); // 2% interest for guild loans

            // Debt Integration (Phase 4): Format infraction as formal Guild Loan
            if (this.gameState.player.debt === 0) {
                this.gameState.player.debt = penaltyValue;
                this.gameState.player.monthlyInterestAmount = interestAmount;
                this.gameState.player.loanType = 'guild';
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.loanDueDate = this.gameState.day + 365;
            } else {
                this.gameState.player.debt += penaltyValue;
                this.gameState.player.monthlyInterestAmount = (this.gameState.player.monthlyInterestAmount || 0) + interestAmount;
            }
            this.logger.warn('MissionService', `Third-Party Cargo Infraction! Added ⌬${formatCredits(penaltyValue)} to debt for mission ${missionId}.`);
        }

        // Force Abandonment Sequence (HARD WIPE STATE TO ALLOW TERMINAL RE-ENTRY)
        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        if (this.gameState.missions.missionProgress[missionId]) {
            delete this.gameState.missions.missionProgress[missionId];
        }
        if (this.gameState.missions.trackedMissionId === missionId) {
            const nextMission = this.gameState.missions.activeMissionIds[0];
            this.gameState.missions.trackedMissionId = nextMission || null;
        }
        if (mission.navLock && this.simulationService) {
            this.simulationService.clearNavigationLock();
        }
        
        this.gameState.setState({});
    }

    /**
     * Attempts to load deferred cargo for a Logistics mission.
     * Evaluates fleet-wide capacity and distributes the cargo dynamically.
     * @param {string} missionId 
     */
    loadDeferredCargo(missionId) {
        if (!this.gameState.missions.activeMissionIds.includes(missionId)) return;
        
        const mission = DB.MISSIONS?.[missionId];
        if (!mission || !mission.deferredCargo || mission.deferredCargo.length === 0) return;

        const progress = this.gameState.missions.missionProgress[missionId];
        if (!progress || progress.cargoLoaded) return; 

        // 1. Calculate Total Required Space
        let totalRequiredSpace = 0;
        mission.deferredCargo.forEach(cargo => totalRequiredSpace += cargo.quantity);

        // 2. Calculate Fleet-Wide Available Space
        let fleetAvailableSpace = 0;
        const shipCapacities = []; 

        for (const shipId of this.gameState.player.ownedShipIds) {
            let usedSpace = 0;
            if (this.gameState.player.inventories[shipId]) {
                Object.values(this.gameState.player.inventories[shipId]).forEach(item => {
                    usedSpace += item.quantity;
                });
            }
            
            const maxCap = this.simulationService ? 
                this.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                (DB.SHIPS?.[shipId]?.cargoCapacity || 100);
            
            const availableSpace = Math.max(0, maxCap - usedSpace);
            fleetAvailableSpace += availableSpace;
            
            shipCapacities.push({ shipId, availableSpace });
        }

        // 3. Evaluate Capacity Threshold
        if (fleetAvailableSpace < totalRequiredSpace) {
            const errorMsg = `Cannot accept freight: Insufficient cargo space. You need space in your cargo hold for ${totalRequiredSpace} units.`;
            if (this.uiManager) {
                this.uiManager.queueModal('event-modal', 'Insufficient Cargo Space', errorMsg);
            }
            return;
        }

        // 4. Distribute Cargo Across Fleet (Prioritize Active Ship)
        const activeShipId = this.gameState.player.activeShipId;
        shipCapacities.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.availableSpace - a.availableSpace;
        });

        mission.deferredCargo.forEach(cargo => {
            let remainingToDistribute = cargo.quantity;

            for (const shipData of shipCapacities) {
                if (remainingToDistribute <= 0) break;

                const spaceHere = shipData.availableSpace;
                if (spaceHere > 0) {
                    const amountToPut = Math.min(remainingToDistribute, spaceHere);
                    
                    if (!this.gameState.player.inventories[shipData.shipId]) {
                        this.gameState.player.inventories[shipData.shipId] = {};
                    }
                    if (!this.gameState.player.inventories[shipData.shipId][cargo.goodId]) {
                        this.gameState.player.inventories[shipData.shipId][cargo.goodId] = { quantity: 0, avgCost: 0 };
                    }
                    
                    this.gameState.player.inventories[shipData.shipId][cargo.goodId].quantity += amountToPut;
                    
                    shipData.availableSpace -= amountToPut;
                    remainingToDistribute -= amountToPut;
                }
            }
        });

        // 5. Update State
        progress.cargoLoaded = true;
        this.logger.info.player(this.gameState.day, 'MISSION_CARGO_LOADED', `Loaded ${totalRequiredSpace} units of deferred cargo for mission ${missionId}.`);

        // 6. Trigger re-evaluation and flush state
        this.checkTriggers();
        this.gameState.setState({});
        if (this.uiManager && typeof this.uiManager.render === 'function') {
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Extracts items specified by COLLECT_ITEM objectives from the target location and assigns them to the player's hold.
     * Evaluates fleet-wide capacity prior to granting the cargo.
     * @param {string} missionId 
     * @returns {number} The total amount of freight successfully collected.
     */
    collectMissionCargo(missionId) {
        if (!this.gameState.missions.activeMissionIds.includes(missionId)) return 0;
        const mission = DB.MISSIONS?.[missionId];
        if (!mission || !mission.objectives) return 0;

        const progress = this.gameState.missions.missionProgress[missionId];
        if (!progress) return 0;

        let totalCollectedThisCall = 0;

        mission.objectives.forEach(obj => {
            if (obj.type === 'COLLECT_ITEM' || obj.type === 'collect_item') {
                const itemId = obj.goodId || obj.target;
                const isObjLocationSpecific = obj.targetLoc && DB.MARKETS?.some(m => m.id === obj.targetLoc) || (obj.target && DB.MARKETS?.some(m => m.id === obj.target));
                const targetLocation = obj.targetLoc || obj.target;

                if (isObjLocationSpecific && targetLocation !== this.gameState.currentLocationId) {
                    return; // Not at the right location to collect this specific item
                }

                const targetQty = obj.quantity || obj.value || 1;
                const objKey = obj.id || obj.goodId || obj.target;

                if (!progress.objectives[objKey]) {
                    progress.objectives[objKey] = { current: 0, target: targetQty, collected: 0 };
                }
                if (progress.objectives[objKey].collected === undefined) {
                    progress.objectives[objKey].collected = 0;
                }

                let collectedSoFar = progress.objectives[objKey].collected;
                let remainingNeeded = targetQty - collectedSoFar;

                // Restrict collection if sequential dependencies are unmet
                if (obj.dependsOn) {
                    const depProgress = progress.objectives?.[obj.dependsOn];
                    if (!depProgress || depProgress.current < depProgress.target) {
                        return; 
                    }
                }

                if (remainingNeeded > 0) {
                    // Check fleet capacity
                    let fleetAvailableSpace = 0;
                    const shipCapacities = [];
                    
                    for (const shipId of this.gameState.player.ownedShipIds) {
                        let usedSpace = 0;
                        if (this.gameState.player.inventories[shipId]) {
                            Object.values(this.gameState.player.inventories[shipId]).forEach(item => {
                                usedSpace += item.quantity;
                            });
                        }
                        const maxCap = this.simulationService ? 
                            this.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                            (DB.SHIPS?.[shipId]?.cargoCapacity || 100);
                        
                        const availableSpace = Math.max(0, maxCap - usedSpace);
                        fleetAvailableSpace += availableSpace;
                        shipCapacities.push({ shipId, availableSpace });
                    }

                    if (fleetAvailableSpace <= 0) {
                        if (this.uiManager) {
                            this.uiManager.queueModal('event-modal', 'Insufficient Cargo Space', `You have no available space in your fleet to collect this freight.`);
                        }
                        return; // Halt this specific objective collection
                    }

                    // Distribute across the fleet prioritizing the active vessel
                    const activeShipId = this.gameState.player.activeShipId;
                    shipCapacities.sort((a, b) => {
                        if (a.shipId === activeShipId) return -1;
                        if (b.shipId === activeShipId) return 1;
                        return b.availableSpace - a.availableSpace;
                    });

                    let amountToCollect = Math.min(remainingNeeded, fleetAvailableSpace);
                    let amountCollectedThisTime = 0;

                    for (const shipData of shipCapacities) {
                        if (amountToCollect <= 0) break;
                        const spaceHere = shipData.availableSpace;
                        if (spaceHere > 0) {
                            const amountToPut = Math.min(amountToCollect, spaceHere);
                            
                            if (!this.gameState.player.inventories[shipData.shipId]) {
                                this.gameState.player.inventories[shipData.shipId] = {};
                            }
                            if (!this.gameState.player.inventories[shipData.shipId][itemId]) {
                                this.gameState.player.inventories[shipData.shipId][itemId] = { quantity: 0, avgCost: 0 };
                            }
                            
                            this.gameState.player.inventories[shipData.shipId][itemId].quantity += amountToPut;
                            
                            amountToCollect -= amountToPut;
                            amountCollectedThisTime += amountToPut;
                        }
                    }

                    if (amountCollectedThisTime > 0) {
                        progress.objectives[objKey].collected += amountCollectedThisTime;
                        totalCollectedThisCall += amountCollectedThisTime;
                        this.logger.info.player(this.gameState.day, 'MISSION_COLLECT', `Collected ${amountCollectedThisTime}x ${itemId} for mission ${missionId}.`);
                    }
                }
            }
        });

        if (totalCollectedThisCall > 0) {
            this.checkTriggers();
            this.gameState.setState({});
            if (this.uiManager && typeof this.uiManager.render === 'function') {
                this.uiManager.render(this.gameState.getState());
            }
        }

        return totalCollectedThisCall;
    }

    /**
     * Skips the entire 9-part tutorial sequence.
     */
    skipTutorial() {
        const tutorialIds = [
            'mission_tutorial_01', 'mission_tutorial_02', 'mission_tutorial_03',
            'mission_tutorial_04', 'mission_tutorial_05', 'mission_tutorial_06',
            'mission_tutorial_07', 'mission_tutorial_08', 'mission_tutorial_09'
        ];

        let subsidyGranted = false;

        tutorialIds.forEach(id => {
            // Remove from active missions if present
            if (this.gameState.missions.activeMissionIds.includes(id)) {
                this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(activeId => activeId !== id);
            }
            
            // Add to completed missions if not already there
            if (!this.gameState.missions.completedMissionIds.includes(id)) {
                this.gameState.missions.completedMissionIds.push(id);
                
                // If we are artificially completing mission 9, give the player the 7k subsidy they would have normally received
                if (id === 'mission_tutorial_09' && !subsidyGranted) {
                    this.gameState.player.credits += 7000;
                    subsidyGranted = true;
                    this.logger.info.player(this.gameState.day, 'MISSION_REWARD', `Granted ⌬ 7,000 subsidy upon skipping tutorial.`);
                }
            }

            // Clean up progress maps
            if (this.gameState.missions.missionProgress[id]) {
                delete this.gameState.missions.missionProgress[id];
            }
            
            // Clear tracking if a tutorial was tracked
            if (this.gameState.missions.trackedMissionId === id) {
                this.gameState.missions.trackedMissionId = null;
            }
        });

        // Release any navigation locks placed by the tutorial
        if (this.simulationService) {
            this.simulationService.clearNavigationLock();
        }

        // Hide the active mission modal
        if (this.uiManager) {
            this.uiManager.hideModal('mission-modal');
        }

        this.logger.info.player(this.gameState.day, 'TUTORIAL_SKIPPED', `Player skipped the tutorial sequence.`);

        // Force UI to terminal view if the active log is now empty
        if (this.gameState.missions.activeMissionIds.length === 0) {
            this.gameState.uiState.activeMissionTab = 'terminal';
        }

        // Push global state update
        this.gameState.setState({});
        if (this.uiManager && typeof this.uiManager.render === 'function') {
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Abandons a specific active mission.
     * @param {string} missionId - The ID of the mission to abandon.
     */
    abandonMission(missionId) {
        if (!missionId || !this.gameState.missions.activeMissionIds.includes(missionId)) return;

        const mission = DB.MISSIONS?.[missionId];

        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        // HARD WIPE STATE: Deleting the progress key entirely forces it back to the terminal.
        if (this.gameState.missions.missionProgress[missionId]) {
            delete this.gameState.missions.missionProgress[missionId];
        }

        // Logic: If abandoned mission was tracked, clear tracking or pick next.
        if (this.gameState.missions.trackedMissionId === missionId) {
            const nextMission = this.gameState.missions.activeMissionIds[0];
            this.gameState.missions.trackedMissionId = nextMission || null;
        }

        // Clear Navigation Locks if the abandoned mission had them
        if (mission && mission.navLock && this.simulationService) {
            this.simulationService.clearNavigationLock();
        }

        this.logger.info.player(this.gameState.day, 'MISSION_ABANDON', `Abandoned mission: ${missionId}`);
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Checks all mission triggers against the current game state.
     * Iterates through ALL active missions and evaluates objectives using the Logic Engine.
     * @param {boolean} [suppressNotify=false] - If true, mutates state but skips setState/render to avoid loops.
     */
    checkTriggers(suppressNotify = false) {
        const { activeMissionIds } = this.gameState.missions;
        if (!activeMissionIds || activeMissionIds.length === 0) return;
    
        let stateChanged = false;

        activeMissionIds.forEach(missionId => {
            const mission = DB.MISSIONS?.[missionId];
            if (!mission) return;

            let allObjectivesMet = true;
            let progressChanged = false;
            
            if (!this.gameState.missions.missionProgress[missionId]) {
                this.gameState.missions.missionProgress[missionId] = { objectives: {}, isCompletable: false, acceptDay: this.gameState.day };
            }
            const progress = this.gameState.missions.missionProgress[missionId];

            if (mission.objectives && mission.objectives.length > 0) {
                mission.objectives.forEach(obj => {
                    const objKey = obj.id || obj.goodId || obj.target;
                    
                    if (!progress.objectives[objKey]) {
                        progress.objectives[objKey] = { current: 0, target: 1, deposited: 0 };
                    }
                    
                    const currentObjProgress = progress.objectives[objKey];
                    const result = this.objectiveEvaluator.evaluate(obj, this.gameState, this.simulationService, currentObjProgress, progress);
                    
                    if (progress.objectives[objKey].current !== result.current || progress.objectives[objKey].target !== result.target) {
                        progress.objectives[objKey].current = result.current;
                        progress.objectives[objKey].target = result.target; 
                        progressChanged = true;
                    }

                    if (!result.isMet) {
                        allObjectivesMet = false;
                    }
                });
            } else {
                // No objectives = auto meet
                allObjectivesMet = true;
            }

            if (progress.isCompletable !== allObjectivesMet) {
                progress.isCompletable = allObjectivesMet;
                stateChanged = true;
                if (allObjectivesMet && !suppressNotify) {
                    this.logger.info.player(this.gameState.day, 'OBJECTIVES_MET', `All objectives for mission ${missionId} are met.`);
                }
            }

            if (progressChanged) stateChanged = true;
        });
    
        if (stateChanged && !suppressNotify) {
            this.gameState.setState({}); 
            this.uiManager.render(this.gameState.getState()); 
            this.uiManager.flashObjectiveProgress();
        }
    }

    /**
     * Attempts to deposit cargo from the player's fleet into the specified mission.
     * Assumes the player is currently at the correct location.
     * @param {string} missionId 
     * @param {boolean} forceInfraction Bypasses the Third-Party Cargo protection check.
     * @returns {number} The total amount of freight deposited.
     */
    depositMissionCargo(missionId, forceInfraction = false) {
        if (!this.gameState.missions.activeMissionIds.includes(missionId)) return 0;
        const mission = DB.MISSIONS?.[missionId];
        if (!mission || !mission.objectives) return 0;

        const progress = this.gameState.missions.missionProgress[missionId];
        if (!progress) return 0;

        // --- PRE-CHECK: Build Drain Plan ---
        const drainPlan = {};
        mission.objectives.forEach(obj => {
            if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM' || obj.type === 'HAVE_ITEM') {
                const itemId = obj.goodId || obj.target;
                
                // --- STRICT LOCATION GATING FOR DEPOSITS ---
                const isObjLocationSpecific = obj.target && DB.MARKETS?.some(m => m.id === obj.target);
                if (isObjLocationSpecific && obj.target !== this.gameState.currentLocationId) {
                    return; // Skip this objective; we are not at its required location
                }
                // ------------------------------------------------

                const targetQty = obj.quantity || obj.value || 1;
                const objKey = obj.id || obj.goodId || obj.target;
                const depositedSoFar = progress.objectives?.[objKey]?.deposited || 0;
                
                let remainingNeeded = Math.max(0, targetQty - depositedSoFar);

                // --- PROVENANCE CAP: Restrict drain to what is authorized by the parent tracker
                if (obj.dependsOn) {
                    const parentObj = mission.objectives.find(o => (o.id || o.goodId || o.target) === obj.dependsOn);
                    const depProgress = progress.objectives?.[obj.dependsOn];
                    
                    const isVolumeParent = parentObj && ['COLLECT_ITEM', 'collect_item', 'DELIVER_ITEM', 'deliver_item', 'HAVE_ITEM', 'have_item', 'TRADE_ITEM', 'trade_item'].includes(parentObj.type);
                    
                    if (isVolumeParent && depProgress && typeof depProgress.current === 'number') {
                        const maxAllowedNow = Math.max(0, depProgress.current - depositedSoFar);
                        remainingNeeded = Math.min(remainingNeeded, maxAllowedNow);
                    } else if (!depProgress || depProgress.current < depProgress.target) {
                        remainingNeeded = 0; // Strictly gate if non-volume parent isn't complete
                    }
                }
                
                if (remainingNeeded > 0) {
                    let fleetOwned = 0;
                    this.gameState.player.ownedShipIds.forEach(shipId => {
                        fleetOwned += (this.gameState.player.inventories[shipId]?.[itemId]?.quantity || 0);
                    });
                    
                    const canDrain = Math.min(remainingNeeded, fleetOwned);
                    if (canDrain > 0) {
                        drainPlan[itemId] = (drainPlan[itemId] || 0) + canDrain;
                    }
                }
            }
        });

        // --- THIRD PARTY CARGO INFRACTION CHECK ---
        if (!forceInfraction) {
            let infractionDetected = false;
            let violatedMissions = new Set();

            for (const [goodId, drainAmount] of Object.entries(drainPlan)) {
                let fleetOwned = 0;
                this.gameState.player.ownedShipIds.forEach(shipId => {
                    fleetOwned += (this.gameState.player.inventories[shipId]?.[goodId]?.quantity || 0);
                });

                const projected = fleetOwned - drainAmount;
                const protection = this.getProtectedBaseline(goodId, missionId);
                
                if (projected < protection.baseline) {
                    infractionDetected = true;
                    protection.missions.forEach(m => violatedMissions.add(m));
                }
            }

            if (infractionDetected) {
                if (this.uiManager) {
                    this.uiManager.queueModal('event-modal', 'Warning: Third-Party Cargo', 
                        'You are attempting to deliver third-party cargo to an alternative contract. The associated mission(s) will be abandoned and the value of the cargo will be added to your debt if you proceed!', 
                        null, 
                        {
                            dismissInside: false,
                            dismissOutside: false,
                            customSetup: (modal, closeHandler) => {
                                const btnContainer = modal.querySelector('#event-button-container');
                                btnContainer.innerHTML = `
                                    <button type="button" id="proceed-infraction" class="btn" style="border: 1px solid #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.1);">PROCEED</button>
                                    <button type="button" id="cancel-infraction" class="btn">CANCEL</button>
                                `;
                                modal.querySelector('#proceed-infraction').onclick = () => {
                                    violatedMissions.forEach(mId => this.penalizeThirdPartyInfraction(mId));
                                    this.depositMissionCargo(missionId, true); // Force execution
                                    closeHandler();
                                };
                                modal.querySelector('#cancel-infraction').onclick = closeHandler;
                            }
                        });
                }
                return 0; // Abort this run pending user choice
            }
        }

        // --- EXECUTE DRAIN ---
        let totalDepositedThisCall = 0;

        mission.objectives.forEach(obj => {
            if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM' || obj.type === 'HAVE_ITEM') {
                const itemId = obj.goodId || obj.target;
                
                // --- STRICT LOCATION GATING FOR DEPOSITS ---
                const isObjLocationSpecific = obj.target && DB.MARKETS?.some(m => m.id === obj.target);
                if (isObjLocationSpecific && obj.target !== this.gameState.currentLocationId) {
                    return; // Skip this objective; we are not at its required location
                }
                // ------------------------------------------------

                const targetQty = obj.quantity || obj.value || 1;
                const objKey = obj.id || obj.goodId || obj.target;
                
                if (!progress.objectives[objKey]) {
                    progress.objectives[objKey] = { current: 0, target: targetQty, deposited: 0 };
                }
                if (progress.objectives[objKey].deposited === undefined) {
                    progress.objectives[objKey].deposited = 0;
                }

                let depositedSoFar = progress.objectives[objKey].deposited;
                let remainingNeeded = targetQty - depositedSoFar;

                // --- PROVENANCE CAP: Execute cap during final inventory pull
                if (obj.dependsOn) {
                    const parentObj = mission.objectives.find(o => (o.id || o.goodId || o.target) === obj.dependsOn);
                    const depProgress = progress.objectives?.[obj.dependsOn];
                    
                    const isVolumeParent = parentObj && ['COLLECT_ITEM', 'collect_item', 'DELIVER_ITEM', 'deliver_item', 'HAVE_ITEM', 'have_item', 'TRADE_ITEM', 'trade_item'].includes(parentObj.type);
                    
                    if (isVolumeParent && depProgress && typeof depProgress.current === 'number') {
                        const maxAllowedNow = Math.max(0, depProgress.current - depositedSoFar);
                        remainingNeeded = Math.min(remainingNeeded, maxAllowedNow);
                    } else if (!depProgress || depProgress.current < depProgress.target) {
                        remainingNeeded = 0; // Strictly gate if non-volume parent isn't complete
                    }
                }

                if (remainingNeeded > 0) {
                    // Collect inventory across fleet
                    const activeShipId = this.gameState.player.activeShipId;
                    const shipInventories = [];
                    
                    for (const shipId of this.gameState.player.ownedShipIds) {
                        const qty = this.gameState.player.inventories[shipId]?.[itemId]?.quantity || 0;
                        shipInventories.push({ shipId, qty });
                    }

                    // Prioritize draining from the active ship first
                    shipInventories.sort((a, b) => {
                        if (a.shipId === activeShipId) return -1;
                        if (b.shipId === activeShipId) return 1;
                        return b.qty - a.qty;
                    });

                    let amountDepositedThisTime = 0;

                    for (const shipData of shipInventories) {
                        if (remainingNeeded <= 0) break;
                        const toRemove = Math.min(remainingNeeded, shipData.qty);
                        if (toRemove > 0) {
                            const invItem = this.gameState.player.inventories[shipData.shipId][itemId];
                            invItem.quantity -= toRemove;
                            if (invItem.quantity === 0) invItem.avgCost = 0;
                            
                            remainingNeeded -= toRemove;
                            amountDepositedThisTime += toRemove;
                        }
                    }

                    if (amountDepositedThisTime > 0) {
                        progress.objectives[objKey].deposited += amountDepositedThisTime;
                        totalDepositedThisCall += amountDepositedThisTime;
                        this.logger.info.player(this.gameState.day, 'MISSION_DEPOSIT', `Deposited ${amountDepositedThisTime}x ${itemId} for mission ${missionId}.`);
                    }
                }
            }
        });

        if (totalDepositedThisCall > 0) {
            this.checkTriggers(); // This will recalculate progress with the newly deposited cargo + remaining hold
            this.gameState.setState({}); // Force update to reflect inventory changes in global UI
            if (this.uiManager && typeof this.uiManager.render === 'function') {
                this.uiManager.render(this.gameState.getState());
            }
        }
        
        return totalDepositedThisCall;
    }

    /**
     * Completes a specific active mission.
     * @param {string} missionId - The ID of the mission to complete.
     * @param {boolean} [force=false] If true, bypasses "Objectives Met" check.
     */
    completeMission(missionId, force = false) {
        if (!this.gameState.missions.activeMissionIds.includes(missionId)) return;
        
        const mission = DB.MISSIONS?.[missionId];
        const progress = this.gameState.missions.missionProgress[missionId];
        
        const isCompletable = progress ? progress.isCompletable : false;
        const noObjectives = !mission.objectives || mission.objectives.length === 0;
        
        if (!isCompletable && !noObjectives && !force) {
            return; // Can't complete yet
        }

        // 1. Deduct objective items
        if (mission.objectives) {
            mission.objectives.forEach(obj => {
                if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM' || obj.type === 'HAVE_ITEM') {
                    const itemId = obj.goodId || obj.target;
                    const objKey = obj.id || obj.goodId || obj.target;
                    const deposited = progress?.objectives?.[objKey]?.deposited || 0;
                    
                    let remainingToRemove = (obj.quantity || 1) - deposited;
                    remainingToRemove = Math.max(0, remainingToRemove); // Floor at 0
                    
                    if (remainingToRemove > 0) {
                        const activeShipId = this.gameState.player.activeShipId;
                        const shipInventories = [];
                        
                        for (const shipId of this.gameState.player.ownedShipIds) {
                            const qty = this.gameState.player.inventories[shipId]?.[itemId]?.quantity || 0;
                            const maxCapacity = this.simulationService ? 
                                this.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                                (DB.SHIPS?.[shipId]?.cargoCapacity || 100);
                            
                            shipInventories.push({ shipId, qty, maxCapacity });
                        }

                        shipInventories.sort((a, b) => {
                            if (a.shipId === activeShipId) return -1;
                            if (b.shipId === activeShipId) return 1;
                            return b.maxCapacity - a.maxCapacity;
                        });

                        for (const shipData of shipInventories) {
                            if (remainingToRemove <= 0) break;
                            const toRemove = Math.min(remainingToRemove, shipData.qty);
                            if (toRemove > 0) {
                                const invItem = this.gameState.player.inventories[shipData.shipId][itemId];
                                invItem.quantity -= toRemove;
                                if (invItem.quantity === 0) invItem.avgCost = 0;
                                remainingToRemove -= toRemove;
                            }
                        }
                    }
                }
            });
        }

        // 2. Grant rewards
        if (this.simulationService) {
            this.simulationService._grantRewards(mission.rewards, mission.name);
        }

        if (mission.rewards) {
            mission.rewards.forEach(reward => {
                if (reward.type === 'DEDUCT_CREDITS') {
                    const amount = reward.amount || reward.value || 0;
                    this.gameState.player.credits = Math.max(0, this.gameState.player.credits - amount);
                    this.logger.info.player(this.gameState.day, 'MISSION_PAYMENT', `Deducted ⌬ ${formatCredits(amount)} for mission ${missionId}.`);
                } else if (reward.type === 'UNLOCK_TIER') {
                    const newTier = Math.max(this.gameState.player.revealedTier || 1, (reward.amount || reward.value || 1));
                    this.gameState.player.revealedTier = newTier;
                    this.logger.info.player(this.gameState.day, 'TIER_UNLOCKED', `Unlocked Trade Tier ${newTier}.`);
                } else if (reward.type === 'SET_FLAG') {
                    if (!this.gameState.storyFlags) this.gameState.storyFlags = {};
                    this.gameState.storyFlags[reward.flagId] = reward.value;
                } else if (reward.type.toLowerCase() === 'grant_upgrade') {
                    const upgradeId = reward.upgradeId || reward.id || reward.target;
                    const activeShipId = this.gameState.player.activeShipId;
                    const shipState = this.gameState.player.shipStates[activeShipId];
                    if (shipState && shipState.upgrades && upgradeId) {
                        if (this.uiManager && this.uiManager.hangarControl) {
                            this.uiManager.hangarControl.showUpgradeInstallationModal(
                                upgradeId,
                                { source: 'mission' },
                                shipState,
                                async (replaceIndex) => {
                                    if (replaceIndex !== -1) {
                                        shipState.upgrades.splice(replaceIndex, 1);
                                    }
                                    shipState.upgrades.push(upgradeId);
                                    this.logger.info.player(this.gameState.day, 'MISSION_REWARD', `Installed mission upgrade ${upgradeId} to ship ${activeShipId}.`);
                                    
                                    this.gameState.uiState.hangarShipyardToggleState = 'hangar';
                                    const shipIndex = this.gameState.player.ownedShipIds.indexOf(activeShipId);
                                    this.gameState.uiState.hangarActiveIndex = shipIndex !== -1 ? shipIndex : 0;
                                    
                                    await this.uiManager.orchestrateUpgradeSequence(activeShipId);
                                    this.gameState.setState({});
                                },
                                () => {
                                    this.uiManager.render(this.gameState.getState());
                                }
                            );
                        } else {
                            if (shipState.upgrades.length >= 3) {
                                shipState.upgrades.shift(); // Remove the oldest upgrade to make room if full
                            }
                            shipState.upgrades.push(upgradeId);
                            this.logger.info.player(this.gameState.day, 'MISSION_REWARD', `Granted ship upgrade ${upgradeId} to ship ${activeShipId}.`);
                        }
                    }
                }
            });
        }
        
        // --- PHASE 4: OFFICER REWARD PIPELINE ---
        if (mission.officerReward) {
            if (!this.gameState.player.unlockedOfficerIds.includes(mission.officerReward)) {
                this.gameState.player.unlockedOfficerIds.push(mission.officerReward);
            }
            if (this.uiManager && typeof this.uiManager.queueOfficerRecruitmentModal === 'function') {
                this.uiManager.queueOfficerRecruitmentModal(mission.officerReward);
            }
        }
        
        // --- EXECUTE ON-COMPLETE ACTIONS ---
        if (mission.onComplete && this.simulationService) {
            mission.onComplete.forEach(action => {
                if (action.type === 'END_SYSTEM_STATE') {
                    if (this.simulationService.systemStateService) {
                        this.simulationService.systemStateService.endCurrentState();
                    }
                } else if (action.type === 'TRIGGER_SYSTEM_STATE') {
                    if (this.simulationService.systemStateService) {
                        this.simulationService.systemStateService.triggerState(action.stateId);
                    } else {
                        const sysStateService = new SystemStateService(this.gameState, this.logger);
                        sysStateService.triggerState(action.stateId);
                    }
                    
                    this.gameState.setState({});
                    
                    if (this.uiManager && typeof this.uiManager.showEconWeatherModal === 'function') {
                        setTimeout(() => {
                            this.uiManager.showEconWeatherModal(this.gameState.getState());
                        }, 600);
                    }
                } else if (action.type === 'reveal_tier') {
                    const newTier = Math.max(this.gameState.player.revealedTier, action.value);
                    if (newTier > this.gameState.player.revealedTier) {
                        this.gameState.player.revealedTier = newTier;
                    }
                } else if (action.type === 'QUEUE_STORY_EVENT') {
                    this.simulationService.queueStoryEvent(action.eventId);
                }
            });
        }

        this.logger.info.player(this.gameState.day, 'MISSION_COMPLETE', `Completed mission: ${missionId} ${force ? '(FORCED)' : ''}`);

        // 3. Update mission state arrays
        this.gameState.missions.completedMissionIds.push(missionId);
        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        // Auto-switch back to the terminal if the log is now completely empty
        if (this.gameState.missions.activeMissionIds.length === 0) {
            this.gameState.uiState.activeMissionTab = 'terminal';
        }

        if (this.gameState.missions.trackedMissionId === missionId) {
            const nextMissionId = this.gameState.missions.activeMissionIds[0];
            this.gameState.missions.trackedMissionId = nextMissionId || null;
        }

        // Navigation Locks: ONLY clear if the mission completion explicitly instructs it.
        // This ensures sequential tutorial locks persist cleanly between turn-ins.
        if (mission.completion && mission.completion.clearNavLock && this.simulationService) {
            this.simulationService.clearNavigationLock();
        }

        // 4. Update state and re-render
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }
}