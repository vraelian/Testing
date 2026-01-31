// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { STATION_CONFIG } from '../data/station_config.js';

/**
 * Service to manage the Sol Station's simulation logic.
 * Handles entropy calculation, commodity consumption (Weekly Burn),
 * production generation, and state updates.
 */
export class SolStationService {
    
    /**
     * Helper to access the current station state.
     * @returns {Object}
     */
    static get state() {
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

        const currentMode = STATION_CONFIG.MODES[state.mode] || STATION_CONFIG.MODES.DEFAULT;

        // 1. Calculate Entropy (Decay)
        this._calculateEntropy(state, currentMode);

        // 2. Calculate Production (Income)
        this._calculateProduction(state, currentMode);

        // 3. Check for Weekly Burn
        if (currentDay > state.lastWeeklyBurn + 7) {
            this._processWeeklyBurn(state, currentDay);
        }

        // 4. Persist changes
        window.gameState.setState({ solStation: { ...state } });
    }

    /**
     * Calculates and applies daily entropy based on Mode and Empty Caches.
     * @param {Object} state 
     * @param {Object} modeConfig 
     */
    static _calculateEntropy(state, modeConfig) {
        let emptyCaches = 0;
        
        // Count empty Tier 1-6 caches
        DB.COMMODITIES.forEach(c => {
            if (c.tier >= 1 && c.tier <= 6) {
                const currentAmount = state.caches[c.id] || 0;
                if (currentAmount <= 0) {
                    emptyCaches++;
                }
            }
        });

        // Base Decay * Mode Modifier
        let dailyDecay = STATION_CONFIG.ENTROPY.BASE_DECAY * modeConfig.decayMod;

        // Add Empty Cache Penalty (Flat % add)
        dailyDecay += (emptyCaches * STATION_CONFIG.ENTROPY.EMPTY_CACHE_PENALTY);

        // Apply decay
        state.entropy = Math.min(STATION_CONFIG.ENTROPY.MAX_ENTROPY, state.entropy + dailyDecay);
        
        // Ensure entropy doesn't drop below 0
        state.entropy = Math.max(0, state.entropy);

        if (dailyDecay > 0) {
            // console.log(`[SolStation] Entropy +${dailyDecay.toFixed(2)}% (Mode: ${modeConfig.name}, Empty: ${emptyCaches})`);
        }
    }

    /**
     * Calculates passive production of Credits and Antimatter.
     * Efficiency scales inversely with Entropy (100% eff at 0 Entropy, 0% eff at 100 Entropy).
     * @param {Object} state 
     * @param {Object} modeConfig 
     */
    static _calculateProduction(state, modeConfig) {
        // Efficiency: 0 Entropy = 1.0, 50 Entropy = 0.5, 100 Entropy = 0.0
        const efficiency = Math.max(0, (100 - state.entropy) / 100);

        // Credits: Base * Mode * Efficiency
        const creditGen = STATION_CONFIG.PRODUCTION.BASE_CREDITS * modeConfig.productionMod * efficiency;
        
        // Antimatter: Base * Mode * Efficiency
        const antimatterGen = STATION_CONFIG.PRODUCTION.BASE_ANTIMATTER * modeConfig.productionMod * efficiency;

        // Accrue to Bank
        state.bank.credits += creditGen;
        state.bank.antimatter += antimatterGen;

        // Round credits for cleanliness, keep AM precise
        state.bank.credits = Math.floor(state.bank.credits * 100) / 100;
        
        // console.log(`[SolStation] Produced: ${creditGen.toFixed(1)} Cr, ${antimatterGen.toFixed(3)} AM (Eff: ${(efficiency*100).toFixed(0)}%)`);
    }

    /**
     * Consumes commodities every 7 days.
     * @param {Object} state 
     * @param {number} currentDay 
     */
    static _processWeeklyBurn(state, currentDay) {
        const burnMap = STATION_CONFIG.BURN_RATES;
        let consumedLog = [];

        DB.COMMODITIES.forEach(c => {
            if (burnMap[c.tier]) {
                const required = burnMap[c.tier];
                const current = state.caches[c.id] || 0;

                if (current >= required) {
                    state.caches[c.id] = current - required;
                    consumedLog.push(`${c.name}: -${required}`);
                } else {
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