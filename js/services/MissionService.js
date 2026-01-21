// js/services/MissionService.js
/**
 * @fileoverview Manages the state and flow of player missions.
 */
import { DB } from '../data/database.js';
import { formatCredits } from '../utils.js';

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
     * @param {string} missionId The ID of the mission to check.
     * @returns {boolean} True if all prerequisites are met, false otherwise.
     */
    arePrerequisitesMet(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission || !mission.prerequisites) {
            return true; // No prerequisites, so it's met.
        }

        return mission.prerequisites.every(prereq => {
            switch (prereq.type) {
                case 'mission_completed':
                    return this.gameState.missions.completedMissionIds.includes(prereq.missionId);
                case 'revealed_tier':
                    return this.gameState.player.revealedTier >= prereq.tier;
                // Future prerequisite types like 'player_level' or 'item_owned' can be added here.
                default:
                    return false; // Unknown prerequisite type fails validation.
            }
        });
    }
    
    /**
     * Gets a list of all missions that are currently available to the player.
     * A mission is available if it's not active, not completed, and its prerequisites are met.
     * @returns {Array<object>} An array of available mission objects.
     */
    getAvailableMissions() {
        const { activeMissionId, completedMissionIds } = this.gameState.missions;
        return Object.values(DB.MISSIONS).filter(mission => {
            const isAvailable =
                mission.id !== activeMissionId &&
                !completedMissionIds.includes(mission.id) &&
                this.arePrerequisitesMet(mission.id);
            return isAvailable;
        });
    }

    /**
     * Accepts a new mission, setting it as the active mission.
     * @param {string} missionId The ID of the mission to accept.
     * @param {boolean} [force=false] If true, bypasses checks and abandons current mission if necessary.
     */
    acceptMission(missionId, force = false) {
        const mission = DB.MISSIONS[missionId];
        
        // 1. Validation (skipped if forced)
        if (!force) {
            if (this.gameState.missions.activeMissionId || !mission || !this.arePrerequisitesMet(missionId)) {
                return;
            }
        }

        // 2. Handle existing mission collision (Force logic)
        if (this.gameState.missions.activeMissionId) {
            if (force) {
                this.abandonMission(); // Clear the way
            } else {
                return; // Should have been caught by validation, but safety first
            }
        }

        // 3. Initialize State
        this.gameState.missions.activeMissionId = missionId;
        this.gameState.missions.missionProgress[missionId] = {
            objectives: {}
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
            this.completeActiveMission();
        } else {
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Abandons the currently active mission.
     */
    abandonMission() {
        const abandonedMissionId = this.gameState.missions.activeMissionId;
        if (!abandonedMissionId) return;

        this.gameState.missions.activeMissionId = null;
        this.gameState.missions.activeMissionObjectivesMet = false;
        this.logger.info.player(this.gameState.day, 'MISSION_ABANDON', `Abandoned mission: ${abandonedMissionId}`);
        // Note: We keep missionProgress so the player doesn't lose partial progress if they re-accept.
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Checks all mission triggers against the current game state.
     * Primarily checks item possession for delivery/acquisition objectives.
     */
    checkTriggers() {
        const { activeMissionId } = this.gameState.missions;
        if (!activeMissionId) {
            if (this.gameState.missions.activeMissionObjectivesMet) {
                this.gameState.missions.activeMissionObjectivesMet = false;
                this.gameState.setState({}); // Notify of change
            }
            return;
        }
    
        const mission = DB.MISSIONS[activeMissionId];
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];
        if (!mission || !inventory) {
            this.gameState.missions.activeMissionObjectivesMet = false;
            return;
        }
    
        let allObjectivesMet = true;
        let progressChanged = false;
    
        mission.objectives.forEach(obj => {
            if (obj.type === 'have_item') {
                const currentQuantity = inventory[obj.goodId]?.quantity || 0;
                const progress = this.gameState.missions.missionProgress[activeMissionId];
    
                if (!progress.objectives[obj.goodId]) {
                    progress.objectives[obj.goodId] = { current: 0 };
                }
    
                if (progress.objectives[obj.goodId].current !== currentQuantity) {
                    progress.objectives[obj.goodId].current = currentQuantity;
                    progressChanged = true;
                }
    
                if (currentQuantity < obj.quantity) {
                    allObjectivesMet = false;
                }
            }
        });
    
        // Only update state and re-render if there's a change.
        if (this.gameState.missions.activeMissionObjectivesMet !== allObjectivesMet || progressChanged) {
            if (allObjectivesMet && !this.gameState.missions.activeMissionObjectivesMet) {
                this.logger.info.player(this.gameState.day, 'OBJECTIVES_MET', `All objectives for mission ${activeMissionId} are met.`);
            }
            this.gameState.missions.activeMissionObjectivesMet = allObjectivesMet;
            this.gameState.setState({}); // Set the new state
            this.uiManager.render(this.gameState.getState()); // Trigger a full re-render
            if (progressChanged) {
                this.uiManager.flashObjectiveProgress();
            }
        }
    }

    /**
     * Completes the active mission, granting rewards and removing objective items.
     * @param {boolean} [force=false] If true, bypasses "Objectives Met" check.
     */
    completeActiveMission(force = false) {
        const { activeMissionId } = this.gameState.missions;
        if (!activeMissionId) return;
        
        // Temporarily set objectivesMet to true for objective-less missions OR if forced
        const originalObjectivesMet = this.gameState.missions.activeMissionObjectivesMet;
        const mission = DB.MISSIONS[activeMissionId];
        
        // Check Conditions
        const metRequirements = this.gameState.missions.activeMissionObjectivesMet;
        const noObjectives = !mission.objectives || mission.objectives.length === 0;
        
        if (!metRequirements && !noObjectives && !force) {
            return; // Can't complete yet
        }

        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];

        // 1. Deduct objective items (Only if strictly met or forced-but-available)
        // Note: If forcing completion without items, this might result in negative inventory if not careful,
        // so we check possession before deducting even on force.
        if (mission.objectives) {
            mission.objectives.forEach(obj => {
                if (obj.type === 'have_item' && inventory[obj.goodId]) {
                    // Safe deduct: don't go below zero even on force
                    const qtyToRemove = Math.min(inventory[obj.goodId].quantity, obj.quantity);
                    inventory[obj.goodId].quantity -= qtyToRemove;
                }
            });
        }

        // 2. Grant rewards via SimulationService
        if (this.simulationService) {
            this.simulationService._grantRewards(mission.rewards, mission.name);
        }
        this.logger.info.player(this.gameState.day, 'MISSION_COMPLETE', `Completed mission: ${activeMissionId} ${force ? '(FORCED)' : ''}`);

        // 3. Update mission state
        this.gameState.missions.completedMissionIds.push(activeMissionId);
        this.gameState.missions.activeMissionId = null;
        this.gameState.missions.activeMissionObjectivesMet = false;

        // 4. Update state and re-render
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }
}