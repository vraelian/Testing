// js/services/ConditionEvaluator.js
/**
 * @fileoverview
 * Service responsible for evaluating conditions defined in the Event System 2.0 schema.
 * It acts as the gatekeeper, determining if an event can spawn or if a choice is valid.
 */

import { EVENT_CONSTANTS, SHIP_IDS, COMMODITY_IDS } from '../data/constants.js';
import { DB } from '../data/database.js';
import { DynamicValueResolver } from './DynamicValueResolver.js';

export class ConditionEvaluator {
    constructor() {
        this.valueResolver = new DynamicValueResolver(); 
    }

    /**
     * Evaluates a single condition or a list of conditions against the current game state.
     * @param {Object|Object[]} conditions - A single condition object or array of them.
     * @param {import('./GameState.js').GameState} gameState - The current state of the game.
     * @param {import('./SimulationService.js').SimulationService} simulationService - Access to helper methods (like inventory calc).
     * @returns {boolean} True if ALL conditions are met (AND logic).
     */
    checkAll(conditions, gameState, simulationService) {
        if (!conditions) return true; 
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
        let threshold = this.valueResolver.resolve(value, gameState);

        switch (type) {
            // --- STORY FLAGS ---
            case 'flag_is_true':
                return (gameState.player.storyFlags && gameState.player.storyFlags[condition.flag]) === true;

            case 'flag_is_false':
                const flagVal = gameState.player.storyFlags ? gameState.player.storyFlags[condition.flag] : undefined;
                return flagVal === false || flagVal === undefined;

            case 'flag_eq':
                currentValue = gameState.player.storyFlags ? gameState.player.storyFlags[condition.flag] : undefined;
                return this.compare(currentValue, 'EQ', threshold);

            case 'flag_gt':
                currentValue = gameState.player.storyFlags ? (gameState.player.storyFlags[condition.flag] || 0) : 0;
                return this.compare(currentValue, 'GT', threshold);

            case 'flag_gte':
                currentValue = gameState.player.storyFlags ? (gameState.player.storyFlags[condition.flag] || 0) : 0;
                return this.compare(currentValue, 'GTE', threshold);

            case 'flag_lt':
                currentValue = gameState.player.storyFlags ? (gameState.player.storyFlags[condition.flag] || 0) : 0;
                return this.compare(currentValue, 'LT', threshold);

            case 'flag_lte':
                currentValue = gameState.player.storyFlags ? (gameState.player.storyFlags[condition.flag] || 0) : 0;
                return this.compare(currentValue, 'LTE', threshold);

            case 'flag_days_since':
                const stampVal = gameState.player.storyFlags ? (gameState.player.storyFlags[condition.flag] || 0) : 0;
                currentValue = gameState.day - stampVal;
                return this.compare(currentValue, 'GTE', threshold);

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
                currentValue = activeShip ? activeShip.health : 0; 
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE:
                const shipStats = DB.SHIPS[gameState.player.activeShipId];
                if (!shipStats) return false;
                
                const inventory = simulationService._getActiveInventory();
                const usedSpace = Object.values(inventory).reduce((sum, item) => sum + (item.quantity || 0), 0);
                currentValue = shipStats.cargoCapacity - usedSpace;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_USED_CARGO_SPACE:
                let totalUsedSpace = 0;
                gameState.player.ownedShipIds.forEach(id => {
                    const inv = gameState.player.inventories[id];
                    if (inv) {
                        totalUsedSpace += Object.values(inv).reduce((sum, item) => sum + (item.quantity || 0), 0);
                    }
                });
                currentValue = totalUsedSpace > 0 ? 1 : 0;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_ITEM:
                const activeInv = simulationService._getActiveInventory();
                currentValue = activeInv[target]?.quantity || 0;
                break;

            // --- PLAYER STATE CHECKS ---
            case EVENT_CONSTANTS.CONDITIONS.HAS_PERK:
                currentValue = gameState.player.activePerks[target] ? 1 : 0;
                break;

            case EVENT_CONSTANTS.CONDITIONS.HAS_SHIP_CLASS:
                const shipDef = DB.SHIPS[gameState.player.activeShipId];
                currentValue = shipDef ? shipDef.class : ''; 
                break;
            
            case EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER:
                currentValue = gameState.player.revealedTier;
                break;

            // --- WORLD CHECKS ---
            case EVENT_CONSTANTS.CONDITIONS.LOCATION_IS:
                currentValue = gameState.currentLocationId;
                if (typeof value === 'string') threshold = value; 
                break;

            case EVENT_CONSTANTS.CONDITIONS.RNG_ROLL:
                return Math.random() < threshold;

            default:
                console.warn(`[ConditionEvaluator] Unknown condition type: ${type}`);
                return false;
        }

        return this.compare(currentValue, operator, threshold);
    }

    /**
     * Standardized comparison logic.
     */
    compare(a, op, b) {
        switch (op) {
            case 'GT': return a > b;
            case 'GTE': return a >= b;
            case 'LT': return a < b;
            case 'LTE': return a <= b;
            case 'EQ': return a === b;
            case 'NEQ': return a !== b;
            case 'IN': return Array.isArray(b) && b.includes(a);
            default:
                console.warn(`[ConditionEvaluator] Unknown operator: ${op}`);
                return false;
        }
    }
}