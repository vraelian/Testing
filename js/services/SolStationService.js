// js/services/SolStationService.js
import { DB } from '../data/database.js';

/**
 * Service to manage the Sol Station's simulation logic.
 * Handles entropy calculation, commodity consumption (Weekly Burn),
 * and state updates.
 */
export class SolStationService {
    
    /**
     * Helper to access the current station state.
     * @returns {Object}
     */
    static get state() {
        // Access global window.gameState.state.solStation
        if (!window.gameState || !window.gameState.state || !window.gameState.state.solStation) return null;
        return window.gameState.state.solStation;
    }

    /**
     * Main simulation tick. Called by TimeService on day advance.
     * @param {number} currentDay 
     */
    static handleDailyUpdate(currentDay) {
        const state = this.state;
        if (!state) return;

        // 1. Calculate Entropy
        this._calculateEntropy(state);

        // 2. Check for Weekly Burn
        // We ensure lastWeeklyBurn is set. If 0 (new game), we can treat Day 7 as first burn.
        if (currentDay > state.lastWeeklyBurn + 7) {
            this._processWeeklyBurn(state, currentDay);
        }

        // 3. Persist changes (trigger UI updates)
        // We do a "shallow" update to SolStation to trigger subscribers
        window.gameState.setState({ solStation: { ...state } });
    }

    /**
     * Calculates and applies daily entropy.
     * Base: 0.2%
     * Penalty: +2% per empty cache (Tier 1-6)
     * @param {Object} state 
     */
    static _calculateEntropy(state) {
        const BASE_DECAY = 0.2;
        const EMPTY_PENALTY = 2.0;

        let emptyCaches = 0;
        
        // Check Tiers 1-6
        // We iterate DB.COMMODITIES to find valid cache commodities
        DB.COMMODITIES.forEach(c => {
            if (c.tier >= 1 && c.tier <= 6) {
                const currentAmount = state.caches[c.id] || 0;
                if (currentAmount <= 0) {
                    emptyCaches++;
                }
            }
        });

        const totalDailyDecay = BASE_DECAY + (emptyCaches * EMPTY_PENALTY);
        
        // Apply decay
        state.entropy = Math.min(100, state.entropy + totalDailyDecay);
        
        // Debug Log
        if (totalDailyDecay > BASE_DECAY) {
            // console.log(`[SolStation] Entropy increased by ${totalDailyDecay.toFixed(1)}% (${emptyCaches} empty caches).`);
        }
    }

    /**
     * Consumes commodities every 7 days.
     * @param {Object} state 
     * @param {number} currentDay 
     */
    static _processWeeklyBurn(state, currentDay) {
        // Burn Requirements map (Tier -> Amount)
        const burnMap = {
            1: 10,
            2: 8,
            3: 6,
            4: 4,
            5: 2,
            6: 1
        };

        let consumedLog = [];

        DB.COMMODITIES.forEach(c => {
            if (burnMap[c.tier]) {
                const required = burnMap[c.tier];
                const current = state.caches[c.id] || 0;

                if (current >= required) {
                    state.caches[c.id] = current - required;
                    consumedLog.push(`${c.name}: -${required}`);
                } else {
                    // Not enough? Consume all (empty it)
                    if (current > 0) {
                        consumedLog.push(`${c.name}: -${current} (DEPLETED)`);
                        state.caches[c.id] = 0;
                    }
                }
            }
        });

        state.lastWeeklyBurn = currentDay;
        console.log(`[SolStation] Weekly Burn (Day ${currentDay}):`, consumedLog.join(', '));
    }
}