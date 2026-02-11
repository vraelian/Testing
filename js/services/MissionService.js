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
     * @returns {Array<object>} An array of available mission objects.
     */
    getAvailableMissions() {
        const { activeMissionIds, completedMissionIds } = this.gameState.missions;
        return Object.values(DB.MISSIONS).filter(mission => {
            const isAvailable =
                !activeMissionIds.includes(mission.id) &&
                !completedMissionIds.includes(mission.id) &&
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
        
        this.logger.info.player(this.gameState.day, 'MISSION_ACCEPT', `Accepted mission: ${missionId} ${force ? '(FORCED)' : ''}`);
        
        // 4. Grant Start Items
        if (this.simulationService) {
            this.simulationService.grantMissionCargo(missionId);
        }
        
        // 5. Initial Check & Render
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

        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        // We do NOT delete from missionProgress to preserve partial progress if re-accepted.
        // But we DO reset isCompletable to be safe.
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        this.logger.info.player(this.gameState.day, 'MISSION_ABANDON', `Abandoned mission: ${missionId}`);
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Checks all mission triggers against the current game state.
     * Iterates through ALL active missions and evaluates objectives using the Logic Engine.
     */
    checkTriggers() {
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
                    // Use the new Evaluator
                    const result = this.objectiveEvaluator.evaluate(obj, this.gameState);
                    
                    // Identify the objective (fallback to legacy goodId if no specific ID)
                    const objKey = obj.id || obj.goodId;
                    
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
                if (allObjectivesMet) {
                    this.logger.info.player(this.gameState.day, 'OBJECTIVES_MET', `All objectives for mission ${missionId} are met.`);
                }
            }

            if (progressChanged) stateChanged = true;
        });
    
        // Only update state and re-render if there's a change.
        if (stateChanged) {
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

        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];

        // 1. Deduct objective items (if applicable)
        if (mission.objectives) {
            mission.objectives.forEach(obj => {
                // Only deduct if it's an item delivery type
                if ((obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') && inventory) {
                    const itemId = obj.goodId || obj.target;
                    if (inventory[itemId]) {
                        const targetQty = obj.quantity || 1;
                        const qtyToRemove = Math.min(inventory[itemId].quantity, targetQty);
                        inventory[itemId].quantity -= qtyToRemove;
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
        
        // Cleanup progress if desired, though keeping it is fine for history. 
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        // 4. Update state and re-render
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }
}