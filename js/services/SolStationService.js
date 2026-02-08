// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { COMMODITY_IDS } from '../data/constants.js';

/**
 * Constants defining the station's operational parameters.
 * Rates are defined PER REAL-TIME SECOND.
 * 1 Game Day = 120 Real Time Seconds.
 */
const REAL_TIME_SECONDS_PER_DAY = 120;
const MAX_ANTIMATTER_STOCKPILE = 150;

const MODES = {
    STABILITY: { 
        id: 'STABILITY', 
        creditsPerSec: 35, 
        amPerSec: 0.12, 
        decayPerSec: 0.00025, // -0.025%
        entropyMult: 1 
    },
    COMMERCE: { 
        id: 'COMMERCE', 
        creditsPerSec: 140, 
        amPerSec: 0.12, 
        decayPerSec: 0.00075, // -0.075%
        entropyMult: 3 
    },
    PRODUCTION: { 
        id: 'PRODUCTION', 
        creditsPerSec: 35, 
        amPerSec: 0.48, 
        decayPerSec: 0.0012, // -0.12%
        entropyMult: 4 
    }
};

/**
 * @class SolStationService
 * @description Manages the Sol Station endgame engine. Handles entropy decay,
 * resource consumption, and output generation.
 * Now manages its own "Heartbeat" simulation loop when the player is on-site.
 */
export class SolStationService {
    /**
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./LoggingService.js').Logger} logger
     */
    constructor(gameState, logger) {
        this.gameState = gameState;
        this.logger = logger;
        this.simulationInterval = null;
        this.lastTickTime = 0;
    }

    /**
     * Starts the background real-time simulation loop.
     * Should be called when the player arrives at the Sol Station location.
     */
    startRealTimeSimulation() {
        if (this.simulationInterval) return; // Already running

        this.logger.info.system('SolStation', this.gameState.day, 'SIM_START', 'Station real-time simulation active.');
        this.lastTickTime = performance.now();

        // 1-second heartbeat (1000ms)
        this.simulationInterval = setInterval(() => {
            const now = performance.now();
            const deltaTime = (now - this.lastTickTime) / 1000; // Seconds since last tick
            this.lastTickTime = now;
            
            // Clamp delta to prevent massive jumps if tab was inactive
            const safeDelta = Math.min(deltaTime, 5); 
            
            this.processRealTimeTick(safeDelta);
        }, 1000);
    }

    /**
     * Stops the background real-time simulation loop.
     * Should be called when the player leaves the Sol Station location.
     */
    stopRealTimeSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
            this.logger.info.system('SolStation', this.gameState.day, 'SIM_STOP', 'Station real-time simulation paused.');
        }
    }

    /**
     * Processes a "Batch" of time (e.g., sleeping, traveling).
     * Converts days into total active seconds and applies the per-second rates.
     * @param {number} days - The number of days to simulate.
     */
    processTimeStep(days = 1) {
        const station = this.gameState.solStation;
        
        // If not unlocked, the station does not operate.
        if (!station.unlocked) return;

        // Convert days to "simulation seconds" to ensure math consistency
        const totalSeconds = days * REAL_TIME_SECONDS_PER_DAY;
        
        this._executeLogic(totalSeconds, days);
    }

    /**
     * Executes a micro-tick for the Real-Time simulation.
     * @param {number} secondsPassed - Actual real-time seconds elapsed.
     */
    processRealTimeTick(secondsPassed) {
        const station = this.gameState.solStation;
        if (!station.unlocked) return;

        // Calculate fraction of a day for logging/tracking purposes
        const dayFraction = secondsPassed / REAL_TIME_SECONDS_PER_DAY;
        
        this._executeLogic(secondsPassed, dayFraction);
    }

    /**
     * Core logic engine.
     * @param {number} seconds - The duration of the operation in real-time seconds.
     * @param {number} daysEquivalent - The duration in game days (for entropy scaling).
     * @private
     */
    _executeLogic(seconds, daysEquivalent) {
        const station = this.gameState.solStation;
        const modeConfig = MODES[station.mode];
        const officerBuffs = this.getOfficerBuffs();
        
        // 1. Calculate Entropy
        // Entropy scales with *Days Passed* specifically, to keep decay meaningful over long periods
        const entropy = this.calculateEntropy(modeConfig.entropyMult);

        // 2. Decay Caches
        let totalFillRatio = 0;
        let activeCaches = 0;

        for (const [commodityId, cache] of Object.entries(station.caches)) {
            // Rate is "Percentage of Total Stock" per second
            // Decay = Max Capacity * RatePerSec * Seconds * Entropy Scalar
            const baseDecay = cache.max * modeConfig.decayPerSec * seconds;
            
            // Entropy accelerates decay
            const actualDecay = baseDecay * entropy;

            if (cache.current > 0) {
                cache.current = Math.max(0, cache.current - actualDecay);
            }

            totalFillRatio += (cache.current / cache.max);
            activeCaches++;
        }

        // 3. Update Health
        const averageFill = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;
        station.health = Math.round(averageFill * 100);

        // 4. Generate Output (If Health > 0)
        if (station.health > 0) {
            // Efficiency Logic: < 50% Health = Squared drop
            let efficiency = averageFill;
            if (averageFill < 0.5) {
                efficiency = Math.pow(averageFill, 2); 
            }

            // Calculate Base Outputs (Per Second * Seconds Passed)
            let creditGen = modeConfig.creditsPerSec * seconds;
            let amGen = modeConfig.amPerSec * seconds;

            // Apply Officer Buffs (Additively)
            // Example: +10% buff = 1.1 multiplier
            creditGen *= (1 + officerBuffs.creditMult);
            amGen *= (1 + officerBuffs.amMult);

            // Apply Efficiency
            creditGen *= efficiency;
            amGen *= efficiency;

            // Apply to Stockpile
            station.stockpile.credits += creditGen;
            
            if (station.stockpile.antimatter < MAX_ANTIMATTER_STOCKPILE) {
                station.stockpile.antimatter = Math.min(MAX_ANTIMATTER_STOCKPILE, station.stockpile.antimatter + amGen);
            }

            // Log operational warnings only on significant time steps (full days)
            if (daysEquivalent >= 1 && station.health < 20) {
                this.logger.info.system('SolStation', this.gameState.day, 'CRITICAL', `Station health critical (${station.health}%). Efficiency plummeting.`);
            }
        }
    }

    /**
     * Calculates the final entropy multiplier.
     * @param {number} baseModeMult 
     */
    calculateEntropy(baseModeMult) {
        let multiplier = baseModeMult;
        const buffs = this.getOfficerBuffs();
        multiplier += buffs.entropy; // Officer buffs are usually negative here (reducing entropy)
        return Math.max(0.1, multiplier);
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

    setMode(newModeId) {
        if (MODES[newModeId]) {
            this.gameState.solStation.mode = newModeId;
            this.logger.info.player(this.gameState.day, 'STATION_MODE', `Sol Station mode switched to ${newModeId}`);
            this.gameState.setState({});
        }
    }

    donateToCache(commodityId, quantity) {
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

        // Recalculate Health immediately
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

    claimStockpile(type = null) {
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

    /**
     * Helper to get the current output estimates per day for the UI (Projections).
     * Calculates based on 120 seconds (1 day).
     */
    getProjectedOutput() {
        const station = this.gameState.solStation;
        const modeConfig = MODES[station.mode];
        const averageFill = station.health / 100;
        const buffs = this.getOfficerBuffs();

        let efficiency = averageFill;
        if (averageFill < 0.5) efficiency = Math.pow(averageFill, 2);

        // Daily Estimate = RatePerSec * 120 * Efficiency * Buffs
        const credits = Math.floor(modeConfig.creditsPerSec * REAL_TIME_SECONDS_PER_DAY * (1 + buffs.creditMult) * efficiency);
        const antimatter = (modeConfig.amPerSec * REAL_TIME_SECONDS_PER_DAY * (1 + buffs.amMult) * efficiency).toFixed(2);
        const entropy = this.calculateEntropy(modeConfig.entropyMult);

        return { credits, antimatter, entropy };
    }

    assignOfficer(slotId, officerId) {
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
}