// js/services/MissionService.js
/**
 * @fileoverview Manages the state and flow of player missions.
 */
import { MISSIONS, COMMODITIES, SHIPS } from '../data/gamedata.js';
import { formatCredits } from '../utils.js';

export class MissionService {
    /**
     * @param {import('./GameState.js').GameState} gameState The central game state.
     * @param {import('./UIManager.js').UIManager} uiManager The UI manager instance.
     */
    constructor(gameState, uiManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
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
     * Accepts a new mission, setting it as the active mission.
     * @param {string} missionId The ID of the mission to accept.
     */
    acceptMission(missionId) {
        if (this.gameState.missions.activeMissionId || !MISSIONS[missionId]) {
            return;
        }
        this.gameState.missions.activeMissionId = missionId;
        this.gameState.missions.missionProgress[missionId] = {
            objectives: {}
        };
        this.simulationService.grantMissionCargo(missionId);
        this.checkTriggers(); // Run an initial check in case objectives are already met.
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Abandons the currently active mission.
     */
    abandonMission() {
        this.gameState.missions.activeMissionId = null;
        this.gameState.missions.activeMissionObjectivesMet = false;
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
    
        const mission = MISSIONS[activeMissionId];
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
     */
    completeActiveMission() {
        const { activeMissionId } = this.gameState.missions;
        if (!activeMissionId || !this.gameState.missions.activeMissionObjectivesMet) return;

        const mission = MISSIONS[activeMissionId];
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];

        // 1. Deduct objective items
        mission.objectives.forEach(obj => {
            if (obj.type === 'have_item' && inventory[obj.goodId]) {
                inventory[obj.goodId].quantity -= obj.quantity;
            }
        });

        // 2. Grant rewards via SimulationService
        if (this.simulationService) {
            this.simulationService._grantRewards(mission.rewards, mission.name);
        }


        // 3. Update mission state
        this.gameState.missions.completedMissionIds.push(activeMissionId);
        this.gameState.missions.activeMissionId = null;
        this.gameState.missions.activeMissionObjectivesMet = false;

        // 4. Update state and re-render
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }
}