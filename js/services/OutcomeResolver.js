// js/services/OutcomeResolver.js
/**
 * @fileoverview
 * Service responsible for determining the result of a player's choice.
 * It handles the "Dice Roll" logic, including calculating dynamic weights
 * based on player stats/perks before selecting an outcome.
 */

import { EVENT_CONSTANTS } from '../data/constants.js';

export class OutcomeResolver {
    /**
     * @param {import('./ConditionEvaluator.js').ConditionEvaluator} conditionEvaluator
     */
    constructor(conditionEvaluator) {
        this.conditionEvaluator = conditionEvaluator;
    }

    /**
     * Resolves a choice's resolution block into a single outcome ID.
     * @param {Object} resolutionData - The 'resolution' object from the event choice schema.
     * @param {import('./GameState.js').GameState} gameState - Current game state.
     * @param {import('./SimulationService.js').SimulationService} simulationService
     * @returns {string} The ID of the selected outcome.
     */
    resolve(resolutionData, gameState, simulationService) {
        if (!resolutionData) {
            console.error('[OutcomeResolver] Missing resolution data');
            return null;
        }

        switch (resolutionData.type) {
            case EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC:
                return this._resolveFixed(resolutionData.pool);

            case EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG:
                return this._resolveWeighted(resolutionData.pool, gameState, simulationService);

            case EVENT_CONSTANTS.RESOLVERS.STAT_CHECK:
                // Placeholder for Phase B: Skill vs DC logic
                return this._resolveWeighted(resolutionData.pool, gameState, simulationService);

            default:
                console.warn(`[OutcomeResolver] Unknown resolution type: ${resolutionData.type}`);
                // Fallback: pick the first one
                return resolutionData.pool[0]?.outcomeId || null;
        }
    }

    /**
     * Handles Fixed resolution (always returns the first item).
     * @private
     */
    _resolveFixed(pool) {
        return pool[0]?.outcomeId || null;
    }

    /**
     * Handles Weighted RNG resolution.
     * 1. Calculate effective weight for each outcome (Base + Modifiers).
     * 2. Roll a number between 0 and TotalWeight.
     * 3. Select the outcome corresponding to the roll.
     * @private
     */
    _resolveWeighted(pool, gameState, simulationService) {
        const weightedPool = pool.map(item => {
            // FIX: Enforce numeric conversion to prevent string concatenation bugs
            let finalWeight = Number(item.weight) || 0;

            // Apply dynamic modifiers if they exist
            // Example Modifier: { condition: { type: 'HAS_PERK', target: 'lucky' }, value: 20 }
            if (item.modifiers && Array.isArray(item.modifiers)) {
                item.modifiers.forEach(mod => {
                    if (this.conditionEvaluator.evaluate(mod.condition, gameState, simulationService)) {
                        finalWeight += Number(mod.value) || 0;
                    }
                });
            }

            // Weights cannot be negative
            return {
                outcomeId: item.outcomeId,
                weight: Math.max(0, finalWeight)
            };
        });

        // Calculate total weight
        const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);

        if (totalWeight <= 0) {
            console.warn('[OutcomeResolver] Total weight is 0. Defaulting to first option.');
            return weightedPool[0]?.outcomeId || null;
        }

        // The "Roll"
        let randomValue = Math.random() * totalWeight;
        
        // Debug Log to trace RNG logic
        console.log(`[OutcomeResolver] Rolled: ${randomValue.toFixed(2)} / ${totalWeight} (Weights: ${weightedPool.map(i => i.weight).join(',')})`);

        // Selection Loop
        for (const item of weightedPool) {
            if (randomValue < item.weight) {
                return item.outcomeId;
            }
            randomValue -= item.weight;
        }

        // Fallback (should theoretically not be reached due to math)
        return weightedPool[weightedPool.length - 1].outcomeId;
    }
}