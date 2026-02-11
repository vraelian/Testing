// js/services/mission/MissionObjectiveEvaluator.js
/**
 * @fileoverview Stateless logic engine for evaluating mission objectives.
 * Determines the current progress and completion status of a given objective against the GameState.
 */
import { DB } from '../../data/database.js';

export class MissionObjectiveEvaluator {
    /**
     * Evaluates a single objective against the current game state.
     * @param {object} objective - The objective schema object (e.g. { type: 'have_item', ... }).
     * @param {import('../GameState.js').GameState} gameState - The current state of the game.
     * @returns {object} { current: number, target: number, isMet: boolean }
     */
    evaluate(objective, gameState) {
        let current = 0;
        let target = objective.quantity || objective.value || 1; // Default target to 1 if not specified
        let isMet = false;

        switch (objective.type) {
            // --- RESOURCE / INVENTORY CHECKS ---
            case 'have_item':
            case 'DELIVER_ITEM': // Alias for future proofing
                const shipId = gameState.player.activeShipId;
                const inventory = gameState.player.inventories[shipId];
                // Support legacy 'goodId' or new 'target' property
                const itemId = objective.goodId || objective.target;
                if (inventory && inventory[itemId]) {
                    current = inventory[itemId].quantity || 0;
                }
                break;

            case 'have_credits':
            case 'WEALTH_CHECK':
                current = gameState.player.credits;
                break;

            // --- WORLD STATE CHECKS ---
            case 'travel_to':
            case 'TRAVEL_TO':
                // For travel, 'current' is binary: 1 if there, 0 if not.
                // We check against the objective.target (locationId).
                const targetLoc = objective.target;
                const atLocation = gameState.currentLocationId === targetLoc;
                current = atLocation ? 1 : 0;
                break;

            // --- PLAYER STATE CHECKS ---
            case 'have_ship':
            case 'OWN_SHIP':
                const requiredShipId = objective.target;
                const ownsShip = gameState.player.ownedShipIds.includes(requiredShipId);
                current = ownsShip ? 1 : 0;
                break;
            
            case 'mission_complete':
            case 'MISSION_COMPLETE':
                const reqMissionId = objective.target;
                const hasCompleted = gameState.missions.completedMissionIds.includes(reqMissionId);
                current = hasCompleted ? 1 : 0;
                break;

            // --- FALLBACK ---
            default:
                console.warn(`[MissionObjectiveEvaluator] Unknown objective type: ${objective.type}`);
                break;
        }

        // Determine satisfaction
        // For simple numeric checks, current >= target.
        // For specific boolean checks (like travel), we rely on the logic above setting current to 1.
        if (current >= target) {
            current = target; // Cap visual progress at 100%
            isMet = true;
        }

        return { current, target, isMet };
    }
}