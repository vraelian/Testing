// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { COMMODITY_IDS } from '../data/constants.js';

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
const MAX_ANTIMATTER_STOCKPILE = 150; // Cap for Antimatter storage

// Tuning: How much "Game Time" passes per "Real Time Second" when viewing?
// 0.02 Days per tick = 50 seconds real-time to simulate 1 Game Day.
// At 1000 Credits/Day, this gives ~20 Credits/Second.
const REAL_TIME_DAY_FACTOR = 0.02; 

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
     * Legacy/Batch method for TimeService.
     * Processes exactly 1 day of operations (or specified amount).
     * @param {number} days - The number of days to simulate (default 1).
     */
    processTimeStep(days = 1) {
        const station = this.gameState.solStation;
        
        // If not unlocked, the station does not operate.
        if (!station.unlocked) return;

        const modeConfig = MODES[station.mode];
        const officerBuffs = this.getOfficerBuffs();
        const entropy = this.calculateEntropy(modeConfig.entropyMult);

        // 1. Decay Caches
        let totalFillRatio = 0;
        let activeCaches = 0;

        for (const [commodityId, cache] of Object.entries(station.caches)) {
            // Calculate decay amount: Current * Base Rate * Entropy Multiplier * Days Passed
            // We use floating point math here to support micro-ticks
            let decayAmount = cache.current * BASE_DECAY_RATE * entropy * days;
            
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

            // Calculate Outputs with Officer Buffs & Delta Time
            // We remove Math.floor here to allow fractional accumulation during real-time ticks
            const creditOutput = BASE_CREDIT_OUTPUT * (modeConfig.creditMult + officerBuffs.creditMult) * efficiency * days;
            const amOutput = BASE_AM_OUTPUT * (modeConfig.amMult + officerBuffs.amMult) * efficiency * days;

            // Add to Stockpile (Float addition)
            station.stockpile.credits += creditOutput;

            // Cap Antimatter
            if (station.stockpile.antimatter < MAX_ANTIMATTER_STOCKPILE) {
                station.stockpile.antimatter = Math.min(MAX_ANTIMATTER_STOCKPILE, station.stockpile.antimatter + amOutput);
            }

            // Log operational tick if efficiency is low, to warn player (Only on full day ticks to avoid spam)
            if (days >= 1 && station.health < 20) {
                this.logger.info.system('SolStation', this.gameState.day, 'CRITICAL', `Station health critical (${station.health}%). Efficiency plummeting.`);
            }
        } else {
            // Only log offline on full day ticks
            if (days >= 1) {
                this.logger.info.system('SolStation', this.gameState.day, 'OFFLINE', `Station resources depleted. Systems offline.`);
            }
        }
    }

    /**
     * Executes a micro-tick for the Real-Time display.
     * Uses Delta Time to ensure accurate processing regardless of frame rate.
     * @param {number} secondsPassed - Actual real-time seconds elapsed since last tick.
     */
    processRealTimeTick(secondsPassed = 1) {
        // Safety Clamp: Never simulate more than 15 seconds of real-time at once.
        // This prevents massive decay spikes if the browser tab was suspended for an hour.
        const safeSeconds = Math.min(secondsPassed, 15);
        
        // Convert real-time seconds to game-days
        const gameDays = safeSeconds * REAL_TIME_DAY_FACTOR;
        
        this.processTimeStep(gameDays);
    }

    /**
     * Calculates the final entropy multiplier, accounting for Officer buffs.
     * @param {number} baseModeMult - The multiplier from the active mode.
     * @returns {number} The final entropy scalar.
     */
    calculateEntropy(baseModeMult) {
        let multiplier = baseModeMult;
        
        const buffs = this.getOfficerBuffs();
        multiplier += buffs.entropy; 

        return Math.max(0.1, multiplier); // Entropy cannot drop below 0.1x
    }

    /**
     * Helper to aggregate buffs from all assigned officers.
     * @returns {object} { entropy, creditMult, amMult }
     */
    getOfficerBuffs() {
        const station = this.gameState.solStation;
        let total = { entropy: 0, creditMult: 0, amMult: 0 };
        
        station.officers.forEach(slot => {
            if (slot.assignedOfficerId && OFFICERS[slot.assignedOfficerId]) {
                const b = OFFICERS[slot.assignedOfficerId].buffs;
                total.entropy += b.entropy;
                total.creditMult += b.creditMult;
                total.amMult += b.amMult;
            }
        });

        return total;
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
     * @param {string} commodityId - The ID of the item being donated (also the cache key).
     * @param {number} quantity - Amount to donate.
     * @returns {object} { success: boolean, message: string }
     */
    donateToCache(commodityId, quantity) {
        const station = this.gameState.solStation;
        const cache = station.caches[commodityId];
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];

        // Validation
        if (!cache) return { success: false, message: "Invalid cache commodity." };
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

        this.logger.info.player(this.gameState.day, 'STATION_DONATION', `Donated ${quantity}x ${commodityId} to cache.`);
        this.gameState.setState({});
        
        return { success: true, message: "Resources transferred." };
    }

    /**
     * Transfers accumulated stockpile to player wallet/cargo.
     * @param {string} [type] - Optional: 'credits' or 'antimatter'. If omitted, claims both.
     */
    claimStockpile(type = null) {
        const stockpile = this.gameState.solStation.stockpile;
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];
        
        let claimedCredits = 0;
        let claimedAM = 0;

        // Claim Credits
        if ((!type || type === 'credits') && stockpile.credits > 0) {
            const amount = Math.floor(stockpile.credits);
            this.gameState.player.credits += amount;
            claimedCredits = amount;
            stockpile.credits -= amount; // Subtract the integer amount claimed, leaving any fractional float
            if(stockpile.credits < 0.1) stockpile.credits = 0; // Clean up floating point dust
        }

        // Claim Antimatter (Commodity)
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

    /**
     * Helper to get the current output estimates for the UI.
     */
    getProjectedOutput() {
        const station = this.gameState.solStation;
        const modeConfig = MODES[station.mode];
        const averageFill = station.health / 100;
        
        const buffs = this.getOfficerBuffs();

        let efficiency = averageFill;
        if (averageFill < 0.5) efficiency = Math.pow(averageFill, 2);

        return {
            credits: Math.floor(BASE_CREDIT_OUTPUT * (modeConfig.creditMult + buffs.creditMult) * efficiency),
            antimatter: (BASE_AM_OUTPUT * (modeConfig.amMult + buffs.amMult) * efficiency).toFixed(2),
            entropy: this.calculateEntropy(modeConfig.entropyMult)
        };
    }

    /**
     * Assigns an officer to a specific directorate slot.
     * @param {number|string} slotId - The slot to assign to.
     * @param {string|null} officerId - The officer ID to assign, or null to clear.
     * @returns {boolean} True if successful.
     */
    assignOfficer(slotId, officerId) {
        const station = this.gameState.solStation;
        const slotIndex = station.officers.findIndex(s => s.slotId === parseInt(slotId));
        
        if (slotIndex === -1) {
            this.logger.warn('SolStationService', `Invalid slot ID: ${slotId}`);
            return false;
        }

        const officerName = officerId ? (OFFICERS[officerId]?.name || officerId) : "None";
        const action = officerId ? "assigned" : "unassigned";

        station.officers[slotIndex].assignedOfficerId = officerId;
        
        this.logger.info.player(this.gameState.day, 'OFFICER_ASSIGN', `Officer ${officerName} ${action} to Slot ${slotId}.`);
        this.gameState.setState({}); // Commit and Notify
        return true;
    }
}