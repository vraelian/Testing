// js/services/mission/MissionObjectiveEvaluator.js
/**
 * @fileoverview Stateless logic engine for evaluating mission objectives.
 * Determines the current progress and completion status of a given objective against the GameState.
 */
import { DB } from '../../data/database.js';

export class MissionObjectiveEvaluator {
    /**
     * Evaluates a single objective against the current game state.
     * @param {object} objective - The objective schema object.
     * @param {import('../GameState.js').GameState} gameState - The current state of the game.
     * @returns {object} { current: number, target: number, isMet: boolean }
     */
    evaluate(objective, gameState) {
        let current = 0;
        let target = objective.quantity || objective.value || 1; // Default target to 1
        let isMet = false;
        
        // Default comparator is 'Greater Than or Equal' (Standard for "Have X items")
        // New missions (like "Empty Hold") can specify '<='
        const comparator = objective.comparator || '>='; 

        switch (objective.type) {
            // --- RESOURCE / INVENTORY CHECKS ---
            case 'have_item':
            case 'DELIVER_ITEM':
                const shipId = gameState.player.activeShipId;
                const inventory = gameState.player.inventories[shipId];
                const itemId = objective.goodId || objective.target;
                if (inventory && inventory[itemId]) {
                    current = inventory[itemId].quantity || 0;
                }
                break;

            case 'have_credits':
            case 'WEALTH_CHECK':
                current = gameState.player.credits;
                break;

            // --- SHIP STATE CHECKS ---
            case 'have_fuel_tank':
            case 'HAVE_FUEL_TANK':
                const fShipState = gameState.player.shipStates[gameState.player.activeShipId];
                if (fShipState) {
                    current = Math.floor(fShipState.fuel); 
                }
                break;

            // [[NEW]] Checks Hull Health Percentage (0-100)
            case 'have_hull_pct':
            case 'HAVE_HULL_PCT':
                const activeShipId = gameState.player.activeShipId;
                const hShipState = gameState.player.shipStates[activeShipId];
                const shipDef = DB.SHIPS[activeShipId];
                
                if (hShipState && shipDef) {
                    // Calculate percentage integer
                    current = Math.floor((hShipState.health / shipDef.maxHealth) * 100);
                }
                break;

            // [[NEW]] Checks Cargo Usage Percentage (0-100)
            case 'have_cargo_pct':
            case 'HAVE_CARGO_PCT':
                const cShipId = gameState.player.activeShipId;
                const cShipDef = DB.SHIPS[cShipId];
                const cInventory = gameState.player.inventories[cShipId];
                
                if (cShipDef && cInventory) {
                    // Sum all items in hold
                    const totalUsed = Object.values(cInventory).reduce((sum, item) => sum + (item.quantity || 0), 0);
                    // Calculate percentage integer
                    current = Math.floor((totalUsed / cShipDef.maxCargo) * 100);
                }
                break;

            // --- WORLD STATE CHECKS ---
            case 'travel_to':
            case 'TRAVEL_TO':
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

            default:
                console.warn(`[MissionObjectiveEvaluator] Unknown objective type: ${objective.type}`);
                break;
        }

        // --- EVALUATION LOGIC ---
        switch (comparator) {
            case '>=':
                if (current >= target) {
                    current = target; // Visual cap
                    isMet = true;
                }
                break;
            case '<=':
                // For "Less Than", we don't cap 'current' visually because 
                // seeing "0/0" for empty hold is confusing if we actually have 50.
                // We want to see "50/0" (Fail) or "0/0" (Pass).
                if (current <= target) {
                    isMet = true;
                }
                break;
            case '==':
                if (current === target) {
                    isMet = true;
                }
                break;
            default:
                console.warn(`[MissionObjectiveEvaluator] Unknown comparator: ${comparator}`);
                if (current >= target) isMet = true; // Fallback
        }

        return { current, target, isMet };
    }
}