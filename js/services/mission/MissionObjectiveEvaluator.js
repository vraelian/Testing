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
     * @param {import('../SimulationService.js').SimulationService} [simulationService] - Optional access to derived stats.
     * @returns {object} { current: number, target: number, isMet: boolean }
     */
    evaluate(objective, gameState, simulationService) {
        let current = 0;
        
        // [[FIX]] Allow 0 as a valid target (e.g. Empty Hold = 0 items)
        // Previous logic `val || 1` treated 0 as falsey and defaulted to 1.
        let val = objective.quantity !== undefined ? objective.quantity : objective.value;
        let target = val !== undefined ? val : 1; 

        let isMet = false;
        
        const comparator = objective.comparator || '>='; 

        // Helper to get ship stats (Effective > Base)
        const getShipStats = (shipId) => {
            if (simulationService) {
                return simulationService.getEffectiveShipStats(shipId);
            }
            return DB.SHIPS[shipId];
        };

        switch (objective.type) {
            // --- RESOURCE / INVENTORY CHECKS ---
            case 'have_item':
            case 'DELIVER_ITEM': {
                const itemId = objective.goodId || objective.target;
                let totalQty = 0;
                // --- FLEET OVERFLOW SYSTEM: Aggregate across entire fleet ---
                for (const shipId of gameState.player.ownedShipIds) {
                    const inventory = gameState.player.inventories[shipId];
                    if (inventory && inventory[itemId]) {
                        totalQty += (inventory[itemId].quantity || 0);
                    }
                }
                current = totalQty;
                break;
            }

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

            case 'have_hull_pct':
            case 'HAVE_HULL_PCT':
                const activeShipId = gameState.player.activeShipId;
                const hShipState = gameState.player.shipStates[activeShipId];
                const hShipDef = getShipStats(activeShipId);
                
                if (hShipState && hShipDef && hShipDef.maxHealth > 0) {
                    current = Math.floor((hShipState.health / hShipDef.maxHealth) * 100);
                } else {
                    current = 0;
                }
                break;

            // --- FLEET OVERFLOW SYSTEM: Aggregate Fleet Cargo Percentage ---
            case 'have_cargo_pct':
            case 'HAVE_CARGO_PCT': {
                let fleetTotalUsed = 0;
                let fleetTotalCapacity = 0;

                for (const shipId of gameState.player.ownedShipIds) {
                    const cShipDef = getShipStats(shipId); 
                    const cInventory = gameState.player.inventories[shipId];
                    
                    if (cShipDef && cInventory && cShipDef.cargoCapacity > 0) {
                        fleetTotalCapacity += cShipDef.cargoCapacity;
                        fleetTotalUsed += Object.values(cInventory).reduce((sum, item) => sum + (item.quantity || 0), 0);
                    }
                }

                if (fleetTotalCapacity > 0) {
                    current = Math.floor((fleetTotalUsed / fleetTotalCapacity) * 100);
                } else {
                    current = 0;
                }
                break;
            }

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
        // Ensure current is a number to prevent "null" display
        if (typeof current !== 'number' || isNaN(current)) {
            current = 0;
        }

        switch (comparator) {
            case '>=':
                if (current >= target) {
                    current = target; // Visual cap
                    isMet = true;
                }
                break;
            case '<=':
                // For "Less Than" (e.g. Empty Hold), we do NOT cap visual progress.
                // 50% used vs target 0% -> Display "50% / <= 0%" (Fail)
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
                if (current >= target) isMet = true;
        }

        return { current, target, isMet };
    }
}