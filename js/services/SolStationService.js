// js/services/SolStationService.js
import { DB } from '../data/database.js';

/**
 * Constants defining the station's operational parameters.
 */
const MODES = {
    STABILITY: { id: 'STABILITY', entropyMult: 1, amMult: 1, creditMult: 1 },
    COMMERCE: { id: 'COMMERCE', entropyMult: 3, amMult: 1, creditMult: 4 },
    PRODUCTION: { id: 'PRODUCTION', entropyMult: 4, amMult: 4, creditMult: 1 }
};

const BASE_DECAY_RATE = 0.05; // 5% base decay per day
const BASE_CREDIT_OUTPUT = 1000; // Base credits generated per day at 100% health
const BASE_AM_OUTPUT = 0.1; // Base antimatter generated per day at 100% health

/**
 * @class SolStationService
 * @description Manages the Sol Station endgame engine. Handles daily entropy decay,
 * resource consumption, and output generation.
 */
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
     * Processes one day of station operations.
     * 1. Calculates Entropy based on Mode.
     * 2. Consumes resources from caches (Decay).
     * 3. Updates Station Health.
     * 4. Generates Output (Credits/Antimatter) if operational.
     */
    processTick() {
        const station = this.gameState.solStation;
        
        // If not unlocked, the station does not operate.
        if (!station.unlocked) return;

        const modeConfig = MODES[station.mode];
        const entropy = this.calculateEntropy(modeConfig.entropyMult);

        // 1. Decay Caches
        let totalFillRatio = 0;
        let activeCaches = 0;

        for (const [tierKey, cache] of Object.entries(station.caches)) {
            // Calculate decay amount: Current * Base Rate * Entropy Multiplier
            // Minimum decay of 1 unit if cache has items
            let decayAmount = Math.ceil(cache.current * BASE_DECAY_RATE * entropy);
            
            // Apply decay
            if (cache.current > 0) {
                cache.current = Math.max(0, cache.current - decayAmount);
            }

            // Track health metrics
            totalFillRatio += (cache.current / cache.max);
            activeCaches++;
        }

        // 2. Update Health
        // Health is the average fill percentage of all caches
        const averageFill = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;
        station.health = Math.round(averageFill * 100);

        // 3. Generate Output
        // Station goes offline at 0% health
        if (station.health > 0) {
            // Efficiency Logic:
            // 100% Health = 100% Efficiency
            // < 50% Health = Significant drop (Squared curve)
            let efficiency = averageFill;
            if (averageFill < 0.5) {
                efficiency = Math.pow(averageFill, 2); 
            }

            // Calculate Outputs
            const creditOutput = Math.floor(BASE_CREDIT_OUTPUT * modeConfig.creditMult * efficiency);
            const amOutput = BASE_AM_OUTPUT * modeConfig.amMult * efficiency;

            // Add to Stockpile
            station.stockpile.credits += creditOutput;
            station.stockpile.antimatter += amOutput;

            // Log operational tick if efficiency is low, to warn player
            if (station.health < 20) {
                this.logger.info.system('SolStation', this.gameState.day, 'CRITICAL', `Station health critical (${station.health}%). Efficiency plummeting.`);
            }
        } else {
            this.logger.info.system('SolStation', this.gameState.day, 'OFFLINE', `Station resources depleted. Systems offline.`);
        }
    }

    /**
     * Calculates the final entropy multiplier, accounting for Officer buffs (Phase 2).
     * @param {number} baseModeMult - The multiplier from the active mode.
     * @returns {number} The final entropy scalar.
     */
    calculateEntropy(baseModeMult) {
        let multiplier = baseModeMult;
        
        // PHASE 2 TODO: Iterate through station.officers and subtract entropy mitigation buffs.
        // Example: multiplier -= officer.entropyReduction;

        return Math.max(0.1, multiplier); // Entropy cannot drop below 0.1x
    }

    /**
     * Switches the station's operating mode.
     * @param {string} newModeId - 'STABILITY', 'COMMERCE', 'PRODUCTION'
     */
    setMode(newModeId) {
        if (MODES[newModeId]) {
            this.gameState.solStation.mode = newModeId;
            this.logger.info.player(this.gameState.day, 'STATION_MODE', `Sol Station mode switched to ${newModeId}`);
            this.gameState.setState({}); // Commit state
        }
    }

    /**
     * Transfers cargo from the player's active ship to a specific station cache.
     * @param {string} tierKey - 'tier1' through 'tier6'.
     * @param {string} commodityId - The ID of the item being donated.
     * @param {number} quantity - Amount to donate.
     * @returns {object} { success: boolean, message: string }
     */
    donateToCache(tierKey, commodityId, quantity) {
        const station = this.gameState.solStation;
        const cache = station.caches[tierKey];
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];

        // Validation
        if (!cache) return { success: false, message: "Invalid cache tier." };
        if (!inventory[commodityId] || inventory[commodityId].quantity < quantity) {
            return { success: false, message: "Insufficient cargo." };
        }
        
        // Check Capacity
        const spaceAvailable = cache.max - cache.current;
        if (quantity > spaceAvailable) {
            return { success: false, message: `Cache full. Can only accept ${spaceAvailable} units.` };
        }

        // Execute Transfer
        inventory[commodityId].quantity -= quantity;
        cache.current += quantity;

        // Recalculate Health immediately for UI feedback
        let totalFillRatio = 0;
        let activeCaches = 0;
        for (const c of Object.values(station.caches)) {
            totalFillRatio += (c.current / c.max);
            activeCaches++;
        }
        station.health = Math.round((totalFillRatio / activeCaches) * 100);

        this.logger.info.player(this.gameState.day, 'STATION_DONATION', `Donated ${quantity}x ${commodityId} to ${tierKey} cache.`);
        this.gameState.setState({});
        
        return { success: true, message: "Resources transferred." };
    }

    /**
     * Helper to get the current output estimates for the UI.
     */
    getProjectedOutput() {
        const station = this.gameState.solStation;
        const modeConfig = MODES[station.mode];
        const averageFill = station.health / 100;
        
        let efficiency = averageFill;
        if (averageFill < 0.5) efficiency = Math.pow(averageFill, 2);

        return {
            credits: Math.floor(BASE_CREDIT_OUTPUT * modeConfig.creditMult * efficiency),
            antimatter: (BASE_AM_OUTPUT * modeConfig.amMult * efficiency).toFixed(2),
            entropy: this.calculateEntropy(modeConfig.entropyMult)
        };
    }
}