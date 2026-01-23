// js/services/ConditionEvaluator.js
/**
 * @fileoverview
 * Service responsible for evaluating conditions defined in the Event System 2.0 schema.
 * It acts as the gatekeeper, determining if an event can spawn or if a choice is valid.
 */

import { EVENT_CONSTANTS, SHIP_IDS, COMMODITY_IDS } from '../data/constants.js';
import { DB } from '../data/database.js';
import { DynamicValueResolver } from './DynamicValueResolver.js'; // [[UPDATED]]

export class ConditionEvaluator {
    constructor() {
        this.valueResolver = new DynamicValueResolver(); // [[UPDATED]]
    }

    /**
     * Evaluates a single condition or a list of conditions against the current game state.
     * @param {Object|Object[]} conditions - A single condition object or array of them.
     * @param {import('./GameState.js').GameState} gameState - The current state of the game.
     * @param {import('./SimulationService.js').SimulationService} simulationService - Access to helper methods (like inventory calc).
     * @returns {boolean} True if ALL conditions are met (AND logic).
     */
    checkAll(conditions, gameState, simulationService) {
        if (!conditions) return true; // No conditions = always valid
        if (!Array.isArray(conditions)) conditions = [conditions];

        return conditions.every(cond => this.evaluate(cond, gameState, simulationService));
    }

    /**
     * Evaluates a specific condition object.
     * @param {Object} condition - The condition schema object.
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./SimulationService.js').SimulationService} simulationService
     * @returns {boolean}
     */
    evaluate(condition, gameState, simulationService) {
        const { type, operator, value, target } = condition;
        
        let currentValue = null;
        
        // [[UPDATED]]: Resolve dynamic values (e.g. { scaleWith: 'SHIP_CLASS_SCALAR', base: 5 })
        let threshold = this.valueResolver.resolve(value, gameState);

        // 1. Resolve the 'currentValue' based on the condition type
        switch (type) {
            // --- RESOURCE CHECKS ---
            case EVENT_CONSTANTS.CONDITIONS.HAS_FUEL:
                const shipId = gameState.player.activeShipId;
                currentValue = gameState.player.shipStates[shipId]?.fuel || 0;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_CREDITS:
                currentValue = gameState.player.credits;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_HULL:
                const activeShip = gameState.player.shipStates[gameState.player.activeShipId];
                // Checks current Health points, not percentage
                currentValue = activeShip ? activeShip.health : 0; 
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE:
                const shipStats = DB.SHIPS[gameState.player.activeShipId];
                if (!shipStats) return false;
                
                const inventory = simulationService._getActiveInventory();
                const usedSpace = Object.values(inventory).reduce((sum, item) => sum + (item.quantity || 0), 0);
                currentValue = shipStats.cargoCapacity - usedSpace;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_ITEM:
                const activeInv = simulationService._getActiveInventory();
                currentValue = activeInv[target]?.quantity || 0;
                break;

            // --- PLAYER STATE CHECKS ---
            case EVENT_CONSTANTS.CONDITIONS.HAS_PERK:
                // Boolean check: 1 if true, 0 if false
                currentValue = gameState.player.activePerks[target] ? 1 : 0;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_SHIP_CLASS:
                const shipDef = DB.SHIPS[gameState.player.activeShipId];
                // String comparison: 'A' == 'A'
                currentValue = shipDef ? shipDef.class : ''; 
                break;
            
            case EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER:
                currentValue = gameState.player.revealedTier;
                break;

            // --- WORLD CHECKS ---
            case EVENT_CONSTANTS.CONDITIONS.LOCATION_IS:
                currentValue = gameState.currentLocationId;
                // If checking strict equality, threshold is the target location ID (if value is string)
                if (typeof value === 'string') threshold = value; 
                break;

            case EVENT_CONSTANTS.CONDITIONS.RNG_ROLL:
                // A dynamic roll every time it's checked. 
                // e.g., Value 0.5 means "50% chance this condition passes"
                return Math.random() < threshold;

            default:
                console.warn(`[ConditionEvaluator] Unknown condition type: ${type}`);
                return false;
        }

        // 2. Compare 'currentValue' against 'threshold' using the 'operator'
        return this.compare(currentValue, operator, threshold);
    }

    /**
     * Standardized comparison logic.
     * @param {number|string} a - The value from the game state.
     * @param {string} op - The operator code ('GT', 'EQ', etc).
     * @param {number|string} b - The threshold value from the event data.
     */
    compare(a, op, b) {
        switch (op) {
            case 'GT': return a > b;
            case 'GTE': return a >= b;
            case 'LT': return a < b;
            case 'LTE': return a <= b;
            case 'EQ': return a === b;
            case 'NEQ': return a !== b;
            case 'IN': // Check if A is in array B
                return Array.isArray(b) && b.includes(a);
            default:
                console.warn(`[ConditionEvaluator] Unknown operator: ${op}`);
                return false;
        }
    }
}