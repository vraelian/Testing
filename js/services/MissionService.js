// js/services/MissionService.js
/**
 * @fileoverview Manages the state and flow of player missions.
 * Orchestrates the MissionObjectiveEvaluator and MissionTriggerEvaluator.
 */
import { DB } from '../data/database.js';
import { formatCredits } from '../utils.js';
import { MissionObjectiveEvaluator } from './mission/MissionObjectiveEvaluator.js';
import { MissionTriggerEvaluator } from './mission/MissionTriggerEvaluator.js';

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
        const mission = DB.MISSIONS[missionId];
        if (!mission) return false;
        
        // Support both old 'prerequisites' and new 'triggers' fields
        const constraints = mission.triggers || mission.prerequisites;
        
        return this.triggerEvaluator.checkAll(constraints, this.gameState);
    }
    
    /**
     * Gets a list of all missions that are currently available to the player.
     * A mission is available if it's not active, not completed, and its triggers are met.
     * EXCLUDES 'DEBUG' TYPE MISSIONS.
     * @returns {Array<object>} An array of available mission objects.
     */
    getAvailableMissions() {
        const { activeMissionIds, completedMissionIds } = this.gameState.missions;
        return Object.values(DB.MISSIONS).filter(mission => {
            const isAvailable =
                !activeMissionIds.includes(mission.id) &&
                !completedMissionIds.includes(mission.id) &&
                mission.type !== 'DEBUG' && // [FIX] Hide debug missions from standard terminal
                this.arePrerequisitesMet(mission.id);
            return isAvailable;
        });
    }

    /**
     * Accepts a new mission, setting it as active.
     * @param {string} missionId The ID of the mission to accept.
     * @param {boolean} [force=false] If true, bypasses checks.
     */
    acceptMission(missionId, force = false) {
        const mission = DB.MISSIONS[missionId];
        
        // 1. Validation (skipped if forced)
        if (!force) {
            // Check max missions (4)
            if (this.gameState.missions.activeMissionIds.length >= 4) {
                this.logger.warn('MissionService', `Cannot accept ${missionId}: Mission log full (4/4).`);
                return;
            }
            if (!mission || !this.arePrerequisitesMet(missionId)) {
                return;
            }
        }

        // 2. Handle Existing (Prevent Duplicate)
        if (this.gameState.missions.activeMissionIds.includes(missionId)) {
            return; 
        }

        // 3. Initialize State
        this.gameState.missions.activeMissionIds.push(missionId);
        
        // Initialize progress with isCompletable flag
        this.gameState.missions.missionProgress[missionId] = {
            objectives: {},
            isCompletable: false
        };

        // Auto-track logic: If no mission is being tracked, track this one.
        if (!this.gameState.missions.trackedMissionId) {
            this.gameState.missions.trackedMissionId = missionId;
        }
        
        this.logger.info.player(this.gameState.day, 'MISSION_ACCEPT', `Accepted mission: ${missionId} ${force ? '(FORCED)' : ''}`);
        
        // 4. Grant Start Items
        if (this.simulationService) {
            this.simulationService.grantMissionCargo(missionId);
        }

        // 5. Apply Navigation Locks if specified
        if (mission.navLock && this.simulationService) {
            this.simulationService.setNavigationLock(
                mission.navLock.navIds || [],
                mission.navLock.screenIds || []
            );
        }
        
        // 6. Initial Check & Render
        this.checkTriggers(); 

        // If the mission has no objectives, complete it immediately.
        if (!mission.objectives || mission.objectives.length === 0) {
            this.completeMission(missionId, force);
        } else {
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Abandons a specific active mission.
     * @param {string} missionId - The ID of the mission to abandon.
     */
    abandonMission(missionId) {
        if (!missionId || !this.gameState.missions.activeMissionIds.includes(missionId)) return;

        const mission = DB.MISSIONS[missionId];

        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        // We do NOT delete from missionProgress to preserve partial progress if re-accepted.
        // But we DO reset isCompletable to be safe.
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        // Logic: If abandoned mission was tracked, clear tracking or pick next.
        if (this.gameState.missions.trackedMissionId === missionId) {
            // Pick next active mission or null
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
     * [[UPDATED]] Supports silent execution for render loop integration.
     * @param {boolean} [suppressNotify=false] - If true, mutates state but skips setState/render to avoid loops.
     */
    checkTriggers(suppressNotify = false) {
        const { activeMissionIds } = this.gameState.missions;
        if (!activeMissionIds || activeMissionIds.length === 0) return;
    
        let stateChanged = false;

        activeMissionIds.forEach(missionId => {
            const mission = DB.MISSIONS[missionId];
            if (!mission) return;

            let allObjectivesMet = true;
            let progressChanged = false;
            
            // Ensure progress object exists
            if (!this.gameState.missions.missionProgress[missionId]) {
                this.gameState.missions.missionProgress[missionId] = { objectives: {}, isCompletable: false };
            }
            const progress = this.gameState.missions.missionProgress[missionId];

            if (mission.objectives) {
                mission.objectives.forEach(obj => {
                    const result = this.objectiveEvaluator.evaluate(obj, this.gameState, this.simulationService);
                    
                    // Identify the objective (fallback to legacy goodId if no specific ID)
                    const objKey = obj.id || obj.goodId || obj.target;
                    
                    if (!progress.objectives[objKey]) {
                        progress.objectives[objKey] = { current: 0, target: result.target };
                    }

                    // Check for value change
                    if (progress.objectives[objKey].current !== result.current) {
                        progress.objectives[objKey].current = result.current;
                        progress.objectives[objKey].target = result.target; // Update target just in case
                        progressChanged = true;
                    }

                    // Check for Met status
                    if (!result.isMet) {
                        allObjectivesMet = false;
                    }
                });
            } else {
                // No objectives = auto meet
                allObjectivesMet = true;
            }

            // Update Completion Status
            if (progress.isCompletable !== allObjectivesMet) {
                progress.isCompletable = allObjectivesMet;
                stateChanged = true;
                if (allObjectivesMet && !suppressNotify) {
                    this.logger.info.player(this.gameState.day, 'OBJECTIVES_MET', `All objectives for mission ${missionId} are met.`);
                }
            }

            if (progressChanged) stateChanged = true;
        });
    
        // Only update state and re-render if there's a change AND we aren't suppressing notifications.
        if (stateChanged && !suppressNotify) {
            this.gameState.setState({}); // Set the new state
            this.uiManager.render(this.gameState.getState()); // Trigger a full re-render
            this.uiManager.flashObjectiveProgress();
        }
    }

    /**
     * Completes a specific active mission.
     * @param {string} missionId - The ID of the mission to complete.
     * @param {boolean} [force=false] If true, bypasses "Objectives Met" check.
     */
    completeMission(missionId, force = false) {
        if (!this.gameState.missions.activeMissionIds.includes(missionId)) return;
        
        const mission = DB.MISSIONS[missionId];
        const progress = this.gameState.missions.missionProgress[missionId];
        
        // Check Conditions
        const isCompletable = progress ? progress.isCompletable : false;
        const noObjectives = !mission.objectives || mission.objectives.length === 0;
        
        if (!isCompletable && !noObjectives && !force) {
            return; // Can't complete yet
        }

        // 1. Deduct objective items (if applicable) using Sequential Fleet Drain
        if (mission.objectives) {
            mission.objectives.forEach(obj => {
                // Only deduct if it's an item delivery type
                if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
                    const itemId = obj.goodId || obj.target;
                    let remainingToRemove = obj.quantity || 1;
                    
                    if (remainingToRemove > 0) {
                        const activeShipId = this.gameState.player.activeShipId;
                        const shipInventories = [];
                        
                        for (const shipId of this.gameState.player.ownedShipIds) {
                            const qty = this.gameState.player.inventories[shipId]?.[itemId]?.quantity || 0;
                            // Sort heuristic requires maxCapacity
                            const maxCapacity = this.simulationService ? 
                                this.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                                (DB.SHIPS[shipId]?.cargoCapacity || 100);
                            
                            shipInventories.push({ shipId, qty, maxCapacity });
                        }

                        // Sort: Active ship first, then remaining inactive ships by max capacity descending
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
        this.logger.info.player(this.gameState.day, 'MISSION_COMPLETE', `Completed mission: ${missionId} ${force ? '(FORCED)' : ''}`);

        // 3. Update mission state
        this.gameState.missions.completedMissionIds.push(missionId);
        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        // Auto-Track Logic: If the completed mission was being tracked, auto-track the next one in the list.
        if (this.gameState.missions.trackedMissionId === missionId) {
            const nextMissionId = this.gameState.missions.activeMissionIds[0];
            this.gameState.missions.trackedMissionId = nextMissionId || null;
        }

        // Clear Navigation Locks if the completed mission had them
        if (mission.navLock && this.simulationService) {
            this.simulationService.clearNavigationLock();
        }

        // 4. Update state and re-render
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }
}