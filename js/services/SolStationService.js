// js/services/SolStationService.js
import { STATION_CONFIG } from '../data/station_config.js';
import { OFFICER_REGISTRY } from '../data/officers/officerRegistry.js';
import { DB } from '../data/database.js';

// Base Production values (Can be tuned here)
const BASE_CREDIT_YIELD = 500; 
const BASE_ANTIMATTER_YIELD = 0.1; // Accumulates over time

export class SolStationService {
    /**
     * @param {import('./GameState.js').GameState} gameState 
     * @param {import('./LoggingService.js').Logger} logger 
     */
    constructor(gameState, logger) {
        this.gameState = gameState;
        this.logger = logger;
    }

    /**
     * The master heartbeat for the Sol Station. Called daily by TimeService.
     */
    processDailyTick() {
        // [FIX] Access state directly from gameState instance, not .state property
        const state = this.gameState.solStation;
        
        // 1. Guard Clause: Station must be unlocked
        if (!state || !state.unlocked) return;

        // 2. Calculate Aggregate Modifiers (Mode + Officers + Level)
        const modifiers = this.calculateModifiers();

        // 3. Process Entropy (Health)
        this._processEntropy(state, modifiers);

        // 4. Process Production (Wealth)
        this._processProduction(state, modifiers);

        // 5. Process Progression (XP)
        this._processProgression(state);

        // 6. Check Weekly Burn Cycle
        this._checkWeeklyBurn(state);
    }

    /**
     * Aggregates all active multipliers from Mode, Level, and Officers.
     * @returns {object} { creditMult, antimatterMult, entropyMult, decayFlatMod }
     */
    calculateModifiers() {
        const state = this.gameState.solStation;
        const modeConfig = STATION_CONFIG.MODES[state.mode];

        // A. Base Modifiers from Mode
        let mods = {
            creditMult: modeConfig.modifiers.credit,
            antimatterMult: modeConfig.modifiers.antimatter,
            entropyMult: modeConfig.modifiers.entropy, // Higher entropyMult means FASTER decay
            decayFlatMod: 0 // Flat reduction to decay (e.g. from Level)
        };

        // B. Level Buffs
        // -0.5% Decay per Level, +0.25% Output per level
        const levelDecayRed = (state.level - 1) * STATION_CONFIG.LEVEL_BUFFS.DECAY_REDUCTION;
        const levelOutputBon = (state.level - 1) * STATION_CONFIG.LEVEL_BUFFS.OUTPUT_BONUS;

        mods.decayFlatMod -= levelDecayRed; 
        mods.creditMult += levelOutputBon;
        mods.antimatterMult += levelOutputBon;

        // C. Officer Buffs
        state.roster.assigned.forEach(officerId => {
            if (!officerId) return;
            const officer = OFFICER_REGISTRY[officerId];
            if (officer && officer.buffs) {
                // Officer Decay Mult is usually negative (e.g. -0.05 for 5% reduction)
                // We apply it as a flat modifier to the decay rate for simplicity in this model
                mods.decayFlatMod += (officer.buffs.entropy_decay_mult || 0);
                mods.creditMult += (officer.buffs.credit_output_mult || 0);
                mods.antimatterMult += (officer.buffs.antimatter_output_mult || 0);
            }
        });

        return mods;
    }

    _processEntropy(state, mods) {
        // Base Decay scaled by Mode
        let dailyDecay = STATION_CONFIG.BASE_DECAY * mods.entropyMult;

        // Apply Flat Modifiers (Level + Officers)
        // e.g. If decay is 0.6%, and Level gives -0.5%, effective is 0.1%
        // But we ensure it doesn't go negative (healing) purely from buffs unless intended
        dailyDecay = Math.max(0.01, dailyDecay + mods.decayFlatMod);

        // Empty Cache Penalties
        let penalty = 0;
        Object.keys(STATION_CONFIG.WEEKLY_BURN).forEach(tier => {
            // Find specific commodities of this tier
            const commodityIds = DB.COMMODITIES.filter(c => c.tier === parseInt(tier)).map(c => c.id);
            
            // If ANY cache of this tier is empty (0), apply penalty? 
            // GDD Rule: "If a commodity cache... hits 0". 
            // Implementation: We iterate the State Caches directly.
            Object.entries(state.caches).forEach(([chemId, qty]) => {
                // We only care about commodities that HAVE a burn requirement. 
                // Implicit check: If it's in state.caches, it's trackable.
                if (qty <= 0) {
                    penalty += STATION_CONFIG.CACHE_PENALTY;
                }
            });
        });

        // Cap Penalty
        penalty = Math.min(penalty, STATION_CONFIG.MAX_PENALTY);

        // Final Calculation
        // If we have stock (penalty === 0), the station AUTOMATICALLY REPAIRS itself
        // "Repair: Automatic consumption... negates decay."
        // Design Logic: If Penalty > 0, we decay. If Penalty == 0, we heal/maintain.
        
        if (penalty > 0) {
            state.entropy = Math.max(0, state.entropy - (dailyDecay + penalty));
        } else {
            // Healing Logic: If all caches full, slowly repair entropy
            state.entropy = Math.min(100, state.entropy + 0.5);
        }
    }

    _processProduction(state, mods) {
        if (state.entropy <= 0) return; // Dead station produces nothing

        // Calculate Yield
        const creditYield = BASE_CREDIT_YIELD * mods.creditMult;
        const antimatterYield = BASE_ANTIMATTER_YIELD * mods.antimatterMult;

        // Add to "The Bank"
        state.accumulated.credits += creditYield;
        state.accumulated.antimatter += antimatterYield;
    }

    _processProgression(state) {
        // XP Gain if health > 30%
        if (state.entropy > 30) {
            state.xp += STATION_CONFIG.XP_PER_DAY;
            
            // Level Up Check
            const requiredXP = STATION_CONFIG.getXPForLevel(state.level);
            if (state.xp >= requiredXP) {
                state.level++;
                state.xp = 0; // Reset or Overflow? GDD implies "Lvl 2 @ 100 XP", let's use overflow
                // actually simpler to reset for now based on "100 XP required" phrasing
                
                this.logger.info.system('Sol Station', this.gameState.day, 'LEVEL UP', `Station reached Level ${state.level}`);
                
                // Unlock Officer Slot? (Every 5 levels)
                if (state.level % 5 === 0) {
                    state.roster.assigned.push(null);
                }
            }
        }
    }

    _checkWeeklyBurn(state) {
        const currentDay = this.gameState.day;
        if (currentDay - state.lastBurnDay >= 7) {
            this.performWeeklyBurn(state);
            state.lastBurnDay = currentDay;
        }
    }

    performWeeklyBurn(state) {
        const burnMap = STATION_CONFIG.WEEKLY_BURN;
        let emptyCachesFound = 0;

        // Iterate all tracked caches
        for (const [chemId, qty] of Object.entries(state.caches)) {
            // Find tier of this chem
            const chemDef = DB.COMMODITIES.find(c => c.id === chemId);
            if (!chemDef) continue;

            const burnAmount = burnMap[chemDef.tier] || 0;
            if (burnAmount > 0) {
                if (state.caches[chemId] >= burnAmount) {
                    state.caches[chemId] -= burnAmount;
                } else {
                    // Partial burn, empty it
                    state.caches[chemId] = 0;
                    emptyCachesFound++;
                }
            }
        }

        if (emptyCachesFound > 0) {
            this.logger.warn('Sol Station', this.gameState.day, 'BURN CYCLE', `${emptyCachesFound} caches depleted.`);
        } else {
            this.logger.info.system('Sol Station', this.gameState.day, 'BURN CYCLE', 'All systems nominal.');
        }
    }

    // --- Public Interaction Methods (called by UI) ---

    setMode(newModeId) {
        if (STATION_CONFIG.MODES[newModeId]) {
            // [FIX] Correct state access
            this.gameState.solStation.mode = newModeId;
            return true;
        }
        return false;
    }

    donateCargo(commodityId, quantity) {
        // [FIX] Correct state access
        const state = this.gameState.solStation;
        if (state.caches.hasOwnProperty(commodityId)) {
            state.caches[commodityId] += quantity;
            return true;
        }
        return false;
    }

    withdrawAccumulated() {
        // [FIX] Correct state access
        const state = this.gameState.solStation;
        const payout = {
            credits: Math.floor(state.accumulated.credits),
            antimatter: Math.floor(state.accumulated.antimatter)
        };

        if (payout.credits > 0 || payout.antimatter > 0) {
            // [FIX] Correct player state access
            this.gameState.player.credits += payout.credits;
            
            // TODO: Add Antimatter to inventory? 
            // For now, assuming Antimatter is just a score/resource or directly added if item exists
            // [FIX] Correct inventory access
            if (this.gameState.player.inventories.hasOwnProperty('antimatter') && payout.antimatter > 0) {
                 // Add logic if Antimatter is a real item in player inv
            }
            
            // Clear Bank
            state.accumulated.credits = 0;
            state.accumulated.antimatter = 0;
            
            return payout;
        }
        return null;
    }
}