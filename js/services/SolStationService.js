// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { COMMODITY_IDS } from '../data/constants.js';

/**
 * Phase 1: "Designer Dials" Configuration Block
 * Centralized economy variables to allow safe balancing of the endgame.
 */
export const STATION_CONFIG = {
    MAX_ANTIMATTER_STOCKPILE: 150,
    MAX_CACHE: 100000, // Baseline reference for max cache capacity
    BASE_UNIT_PRICE: 45, // Designer dial for average commodity value
    EFFICIENCY_CLIFF: 0.5, // 50% health threshold for efficiency curve
    MODES: {
        STABILITY: { 
            id: 'STABILITY', 
            yieldCredits: 35, 
            yieldAm: 0.12, 
            decayK: 0.00025, // Base decay rate k
            entropyMult: 1 
        },
        COMMERCE: { 
            id: 'COMMERCE', 
            yieldCredits: 140, 
            yieldAm: 0.12, 
            decayK: 0.00075, 
            entropyMult: 3 
        },
        PRODUCTION: { 
            id: 'PRODUCTION', 
            yieldCredits: 35, 
            yieldAm: 0.48, 
            decayK: 0.0012, 
            entropyMult: 4 
        }
    }
};

/**
 * @class SolStationService
 * @description Manages the Sol Station endgame engine using an O(1) Deterministic 
 * Timestamp-Based Engine (JIT Math), 100% immune to background app suspension.
 */
export class SolStationService {
    /**
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./LoggingService.js').Logger} logger
     */
    constructor(gameState, logger) {
        this.gameState = gameState;
        this.logger = logger;
        // Background interval removed in Phase 2 for JIT evaluation
    }

    /**
     * Phase 2: The Deterministic JIT Math Engine (Timestamp Math)
     * Evaluates exact exponential decay and definite integrals for generation.
     * Pure function logic that projects state forward.
     * * @param {object} currentState - The current station state
     * @param {number} targetTimestamp - Date.now() in ms
     * @returns {object} A new object representing the state at targetTimestamp
     */
    calculateStateAt(currentState, targetTimestamp) {
        // Deep copy state to avoid mutating original during projection
        const newState = JSON.parse(JSON.stringify(currentState));
        
        if (!newState.unlocked) return newState;
        if (!newState.lastUpdateTime) {
            newState.lastUpdateTime = targetTimestamp;
            return newState;
        }

        // Calculate dt in seconds
        const dt = Math.max(0, (targetTimestamp - newState.lastUpdateTime) / 1000);
        if (dt === 0) return newState;

        const modeConfig = STATION_CONFIG.MODES[newState.mode];
        const officerBuffs = this._calculateOfficerBuffs(newState.officers);
        const entropy = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs);
        
        // k represents the exact exponential decay constant
        const k = modeConfig.decayK * entropy;

        let totalFillRatio = 0;
        let activeCaches = 0;

        // Filter valid maintenance caches
        const validCaches = Object.entries(newState.caches).filter(([id, cache]) => {
            return id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER && cache.max > 0;
        });

        // Calculate x0 (Start Health)
        validCaches.forEach(([id, c]) => {
            totalFillRatio += (c.current / c.max);
            activeCaches++;
        });
        const x0 = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;

        // Decay Cache using Exact Exponential formula: C_new = C_old * exp(-k * dt)
        validCaches.forEach(([id, cache]) => {
            const exactCache = cache.current * Math.exp(-k * dt);
            cache.current = exactCache;
        });

        // Calculate x1 (End Health)
        const x1 = x0 * Math.exp(-k * dt);
        newState.health = Math.round(x1 * 100);

        // Exact Stockpile Generation (Integral Calculus)
        // Apply Officer Buffs (Additively)
        const yieldCredits = modeConfig.yieldCredits * (1 + officerBuffs.creditMult);
        const yieldAm = modeConfig.yieldAm * (1 + officerBuffs.amMult);

        const generatedCredits = this._calculateYieldIntegral(yieldCredits, x0, k, dt);
        const generatedAm = this._calculateYieldIntegral(yieldAm, x0, k, dt);

        newState.stockpile.credits += generatedCredits;
        newState.stockpile.antimatter = Math.min(
            STATION_CONFIG.MAX_ANTIMATTER_STOCKPILE, 
            newState.stockpile.antimatter + generatedAm
        );

        // Set instantaneous efficiency for UI/Projections
        newState.currentEfficiency = x1 >= STATION_CONFIG.EFFICIENCY_CLIFF ? x1 : 2 * Math.pow(x1, 2);
        newState.lastUpdateTime = targetTimestamp;

        return newState;
    }

    /**
     * Helper to calculate the definite integral of Yield over time dt.
     * Math: Integral of YieldMax * E(x(t)) dt
     */
    _calculateYieldIntegral(yieldRate, x0, k, dt) {
        if (k === 0) {
            // Fallback to linear if k=0 to prevent division by zero
            const eff = x0 >= STATION_CONFIG.EFFICIENCY_CLIFF ? 1.0 : 2 * Math.pow(x0, 2);
            return yieldRate * eff * dt;
        }

        const x1 = x0 * Math.exp(-k * dt);

        if (x1 >= STATION_CONFIG.EFFICIENCY_CLIFF) {
            // Case A: Health stayed >= 0.5 the whole time (Efficiency = 1.0)
            return yieldRate * dt;
        } else if (x0 < STATION_CONFIG.EFFICIENCY_CLIFF) {
            // Case B: Health started and stayed < 0.5 (Efficiency = 2x^2)
            return (yieldRate * Math.pow(x0, 2) / k) * (1 - Math.exp(-2 * k * dt));
        } else {
            // Case C: Crossed the 0.5 boundary during this offline period
            const t_cross = -Math.log(STATION_CONFIG.EFFICIENCY_CLIFF / x0) / k;
            const genBefore = yieldRate * t_cross;
            
            const dt_remaining = dt - t_cross;
            const genAfter = (yieldRate * Math.pow(STATION_CONFIG.EFFICIENCY_CLIFF, 2) / k) * (1 - Math.exp(-2 * k * dt_remaining));
            
            return genBefore + genAfter;
        }
    }

    /**
     * Phase 3: Expose the "Death Spiral" Threshold
     * The mathematical point where decay replacement costs exceed generation profits.
     * @returns {number} Threshold as a decimal percentage clamped 0 to EFFICIENCY_CLIFF.
     */
    getDeathSpiralThreshold() {
        const station = this.gameState.solStation;
        const modeConfig = STATION_CONFIG.MODES[station.mode];
        const officerBuffs = this.getOfficerBuffs();
        const entropy = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs);
        const k = modeConfig.decayK * entropy;
        
        const commerceYield = STATION_CONFIG.MODES.COMMERCE.yieldCredits * (1 + officerBuffs.creditMult);
        if (commerceYield <= 0) return STATION_CONFIG.EFFICIENCY_CLIFF;

        const threshold = (k * STATION_CONFIG.MAX_CACHE * STATION_CONFIG.BASE_UNIT_PRICE) / (2 * commerceYield);
        
        return Math.max(0, Math.min(threshold, STATION_CONFIG.EFFICIENCY_CLIFF));
    }

    /**
     * Synchronizes the actual GameState to Date.now() using the JIT engine.
     * Called before any state mutations.
     */
    _syncStateJIT() {
        const now = Date.now();
        const station = this.gameState.solStation;
        
        if (!station.unlocked) return;
        
        const projectedState = this.calculateStateAt(station, now);
        Object.assign(station, projectedState);
    }

    /**
     * Phase 4: Service Class Architecture & API
     * Returns mathematically perfect real-time values for the UI without mutating state.
     */
    getLiveState() {
        const station = this.gameState.solStation;
        // Intercept missing timestamps from debug teleports and force a baseline
        if (!station.lastUpdateTime) {
            station.lastUpdateTime = Date.now();
        }
        return this.calculateStateAt(station, Date.now());
    }

    /**
     * Helper methods decoupled to accept state objects dynamically
     */
    _calculateOfficerBuffs(officersList) {
        let total = { entropy: 0, creditMult: 0, amMult: 0 };
        if (!officersList) return total;

        officersList.forEach(slot => {
            if (slot.assignedOfficerId && OFFICERS[slot.assignedOfficerId]) {
                const b = OFFICERS[slot.assignedOfficerId].buffs;
                total.entropy += b.entropy;
                total.creditMult += b.creditMult;
                total.amMult += b.amMult;
            }
        });
        return total;
    }

    getOfficerBuffs() {
        return this._calculateOfficerBuffs(this.gameState.solStation.officers);
    }

    _calculateEntropyFromBuffs(baseModeMult, buffs) {
        let multiplier = baseModeMult;
        multiplier += buffs.entropy; 
        return Math.max(0.1, multiplier);
    }

    calculateEntropy(baseModeMult) {
        return this._calculateEntropyFromBuffs(baseModeMult, this.getOfficerBuffs());
    }

    // ==========================================
    // API Mutations (JIT Synchronized)
    // ==========================================

    setMode(newModeId) {
        this._syncStateJIT(); 
        
        if (STATION_CONFIG.MODES[newModeId]) {
            this.gameState.solStation.mode = newModeId;
            this.logger.info.player(this.gameState.day, 'STATION_MODE', `Sol Station mode switched to ${newModeId}`);
            this.gameState.setState({});
        }
    }

    donateToCache(commodityId, quantity) {
        this._syncStateJIT(); 

        const station = this.gameState.solStation;
        const cache = station.caches[commodityId];
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];

        if (!cache) return { success: false, message: "Invalid cache commodity." };
        if (!inventory[commodityId] || inventory[commodityId].quantity < quantity) {
            return { success: false, message: "Insufficient cargo." };
        }
        
        const spaceAvailable = cache.max - cache.current;
        if (quantity > spaceAvailable) {
            return { success: false, message: `Cache full. Can only accept ${Math.floor(spaceAvailable)} units.` };
        }

        inventory[commodityId].quantity -= quantity;
        cache.current += quantity;

        // Recalculate Health immediately using filtered logic
        let totalFillRatio = 0;
        let activeCaches = 0;
        const validCacheEntries = Object.entries(station.caches).filter(([id, c]) => {
            return id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER && c.max > 0;
        });

        for (const [id, c] of validCacheEntries) {
            totalFillRatio += (c.current / c.max);
            activeCaches++;
        }
        
        const averageFill = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;
        station.health = Math.round(averageFill * 100);

        this.logger.info.player(this.gameState.day, 'STATION_DONATION', `Donated ${quantity}x ${commodityId} to cache.`);
        this.gameState.setState({});
        
        return { success: true, message: "Resources transferred." };
    }

    claimStockpile(type = null) {
        this._syncStateJIT(); 

        const stockpile = this.gameState.solStation.stockpile;
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];
        
        let claimedCredits = 0;
        let claimedAM = 0;

        if ((!type || type === 'credits') && stockpile.credits > 0) {
            const amount = Math.floor(stockpile.credits);
            this.gameState.player.credits += amount;
            claimedCredits = amount;
            stockpile.credits -= amount;
            if(stockpile.credits < 0.1) stockpile.credits = 0;
        }

        if ((!type || type === 'antimatter') && stockpile.antimatter >= 1) {
            const amountToTake = Math.floor(stockpile.antimatter);
            if (!inventory[COMMODITY_IDS.ANTIMATTER]) {
                inventory[COMMODITY_IDS.ANTIMATTER] = { quantity: 0, avgCost: 0 };
            }
            inventory[COMMODITY_IDS.ANTIMATTER].quantity += amountToTake;
            claimedAM = amountToTake;
            stockpile.antimatter -= amountToTake;
        }

        if (claimedCredits === 0 && claimedAM === 0) {
            return { success: false, message: "Nothing to collect." };
        }

        this.gameState.setState({});
        
        const msgParts = [];
        if (claimedCredits > 0) msgParts.push(`${claimedCredits} Cr`);
        if (claimedAM > 0) msgParts.push(`${claimedAM} AM`);
        
        return { success: true, message: `Collected ${msgParts.join(' & ')}.` };
    }

    assignOfficer(slotId, officerId) {
        this._syncStateJIT(); 

        const station = this.gameState.solStation;
        const slotIndex = station.officers.findIndex(s => s.slotId === parseInt(slotId));
        
        if (slotIndex === -1) return false;

        const officerName = officerId ? (OFFICERS[officerId]?.name || officerId) : "None";
        const action = officerId ? "assigned" : "unassigned";

        station.officers[slotIndex].assignedOfficerId = officerId;
        
        this.logger.info.player(this.gameState.day, 'OFFICER_ASSIGN', `Officer ${officerName} ${action} to Slot ${slotId}.`);
        this.gameState.setState({});
        return true;
    }

    getProjectedOutput() {
        // Evaluates based on a full 120-second Game Day
        const REAL_TIME_SECONDS_PER_DAY = 120;
        
        // Generate projections from a perfectly up-to-date JIT state
        const liveState = this.getLiveState();
        const modeConfig = STATION_CONFIG.MODES[liveState.mode];
        
        // Calculate starting efficiency
        const x0 = liveState.health / 100;
        let efficiency = x0;
        if (x0 < STATION_CONFIG.EFFICIENCY_CLIFF) efficiency = 2 * Math.pow(x0, 2);

        const buffs = this._calculateOfficerBuffs(liveState.officers);
        const entropy = this._calculateEntropyFromBuffs(modeConfig.entropyMult, buffs);

        const credits = Math.floor(modeConfig.yieldCredits * REAL_TIME_SECONDS_PER_DAY * (1 + buffs.creditMult) * efficiency);
        const antimatter = (modeConfig.yieldAm * REAL_TIME_SECONDS_PER_DAY * (1 + buffs.amMult) * efficiency).toFixed(2);

        return { credits, antimatter, entropy };
    }
}