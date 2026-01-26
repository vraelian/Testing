// js/services/DynamicValueResolver.js
/**
 * @fileoverview
 * Service responsible for calculating numerical values for event effects.
 * It translates abstract formulas (e.g., "Scale with Wealth Tier") into
 * concrete integers (e.g., "Gain 500 Credits").
 */

import { DB } from '../data/database.js';

export class DynamicValueResolver {
    constructor() {
        // Stateless service
    }

    /**
     * Resolves a value definition into a concrete number.
     * @param {number|Object} valueDef - The value schema (number or object).
     * @param {import('./GameState.js').GameState} gameState - Current game state.
     * @returns {number} The calculated value.
     */
    resolve(valueDef, gameState) {
        // 1. Handle simple static numbers (Legacy support & simple events)
        if (typeof valueDef === 'number') {
            return valueDef;
        }

        // 2. Handle Dynamic Objects
        if (typeof valueDef === 'object' && valueDef !== null) {
            return this._calculateDynamicValue(valueDef, gameState);
        }

        console.warn('[DynamicValueResolver] Invalid value definition:', valueDef);
        return 0;
    }

    /**
     * Internal calculation logic.
     * Formula: Base + (ScalerValue * Factor)
     * @private
     */
    _calculateDynamicValue(def, gameState) {
        const base = def.base || 0;
        const factor = def.factor !== undefined ? def.factor : 1;
        const scalerValue = this._getScalerValue(def.scaleWith, gameState);

        // Calculate and floor to ensure integers
        return Math.floor(base + (scalerValue * factor));
    }

    /**
     * Retrieves the reference value to scale against.
     * @private
     */
    _getScalerValue(scaleType, gameState) {
        if (!scaleType) return 0;

        const activeShipId = gameState.player.activeShipId;
        const shipDef = DB.SHIPS[activeShipId];
        const shipState = gameState.player.shipStates[activeShipId];

        switch (scaleType) {
            case 'WEALTH_TIER':
                // Returns 1 to 7 based on game progress
                return gameState.player.revealedTier || 1;

            case 'PLAYER_CREDITS':
                // Returns current wallet balance (Risk: can be 0)
                return gameState.player.credits || 0;

            case 'MAX_FUEL':
                // Returns ship's maximum fuel capacity
                return shipDef ? shipDef.maxFuel : 100;

            case 'MAX_HULL':
                // Returns ship's maximum hull points
                return shipDef ? shipDef.maxHealth : 100;

            case 'CURRENT_FUEL':
                return shipState ? shipState.fuel : 0;

            case 'CURRENT_HULL':
                return shipState ? shipState.health : 0;

            case 'CARGO_CAPACITY':
                return shipDef ? shipDef.cargoCapacity : 10;
            
            case 'DEBT_TOTAL':
                return gameState.player.debt || 0;

            case 'TRIP_DURATION':
                // Safe access to pending travel data
                // [[UPDATED]] - Hardened check to prevent NaN
                if (gameState.pendingTravel && typeof gameState.pendingTravel.days === 'number') {
                     return gameState.pendingTravel.days;
                }
                return 7; // Default fallback
            
            case 'SHIP_CLASS_SCALAR':
                // [[UPDATED]]: Implements ship-size scaling based on Max Hull.
                // Base 100 Hull = 1.0x Multiplier. 
                // e.g. Titan (1000 Hull) = 10.0x Multiplier.
                const baseHull = 100;
                return shipDef ? Math.max(1, shipDef.maxHealth / baseHull) : 1;

            default:
                console.warn(`[DynamicValueResolver] Unknown scale type: ${scaleType}`);
                return 0;
        }
    }
}