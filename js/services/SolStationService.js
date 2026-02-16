// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { COMMODITY_IDS } from '../data/constants.js';

export const STATION_CONFIG = {
    MAX_ANTIMATTER_STOCKPILE: 150,
    MAX_CACHE: 100000, 
    BASE_UNIT_PRICE: 45, 
    EFFICIENCY_CLIFF: 0.5, 
    REAL_TIME_SECONDS_PER_DAY: 120, 
    MODES: {
        STABILITY: { 
            id: 'STABILITY', 
            yieldCredits: 35, 
            yieldAm: 0.12, 
            decayK: 0.0000021, 
            entropyMult: 1 
        },
        COMMERCE: { 
            id: 'COMMERCE', 
            yieldCredits: 140, 
            yieldAm: 0.12, 
            decayK: 0.0000021, 
            entropyMult: 4 
        },
        PRODUCTION: { 
            id: 'PRODUCTION', 
            yieldCredits: 35, 
            yieldAm: 0.48, 
            decayK: 0.0000021, 
            entropyMult: 8 
        }
    }
};

export class SolStationService {
    constructor(gameState, logger) {
        this.gameState = gameState;
        this.logger = logger;
        this.timeService = null; 
        
        this.trackingActive = false;
        this.lastCommitTime = 0;
        this.localTimeAccumulator = 0;
        this.pendingUniverseDays = 0; // Tracks days deferred from TimeService
    }

    setTimeService(timeService) {
        this.timeService = timeService;
    }

    catchUpDays(currentDay) {
        const station = this.gameState.solStation;
        if (!station || !station.unlocked) return;

        if (typeof station.lastProcessedDay === 'undefined') {
            station.lastProcessedDay = currentDay;
            if (station.lastUpdateTime) delete station.lastUpdateTime;
            return;
        }

        const daysMissed = currentDay - station.lastProcessedDay;
        if (daysMissed <= 0) return;

        const dt = daysMissed * STATION_CONFIG.REAL_TIME_SECONDS_PER_DAY;
        
        const projectedState = this._calculateExactState(station, dt);
        Object.assign(station, projectedState);
        
        station.lastProcessedDay = currentDay;
        this.logger.info.system(currentDay, 'SOL_BATCH', `Sol Station caught up ${daysMissed} missed days.`);
    }

    startTracking() {
        if (this.trackingActive) return;
        this.trackingActive = true;
        this.lastCommitTime = Date.now();
        this.localTimeAccumulator = 0;
        
        const station = this.gameState.solStation;
        if (station && station.unlocked && typeof station.lastProcessedDay === 'undefined') {
            station.lastProcessedDay = this.gameState.day;
        }
        
        this.logger.info.system(this.gameState.day, 'SOL_TRACK', `Sol Station tracking started (Universe Execution Deferred).`);
    }

    stopTracking() {
        if (!this.trackingActive) return;
        this.commitLiveTime();
        this.trackingActive = false;
        
        if (this.gameState.solStation && this.gameState.solStation.unlocked) {
            this.gameState.solStation.lastProcessedDay = this.gameState.day;
        }
        
        this.logger.info.system(this.gameState.day, 'SOL_TRACK', `Sol Station tracking terminated.`);
    }

    commitLiveTime() {
        if (!this.trackingActive) return;
        
        const now = Date.now();
        const dtRealMs = now - this.lastCommitTime;
        if (dtRealMs <= 0) return;
        
        this.lastCommitTime = now;
        const dt = dtRealMs / 1000;
        const station = this.gameState.solStation;

        if (station && station.unlocked) {
            const newState = this._calculateExactState(station, dt);
            Object.assign(station, newState);
            
            this.localTimeAccumulator += dt;
            if (this.localTimeAccumulator >= STATION_CONFIG.REAL_TIME_SECONDS_PER_DAY) {
                const daysToAdvance = Math.floor(this.localTimeAccumulator / STATION_CONFIG.REAL_TIME_SECONDS_PER_DAY);
                this.localTimeAccumulator -= (daysToAdvance * STATION_CONFIG.REAL_TIME_SECONDS_PER_DAY);
                
                station.lastProcessedDay += daysToAdvance;
                
                // Advance the phantom calendar, but defer execution
                this.gameState.day += daysToAdvance; 
                this.pendingUniverseDays += daysToAdvance;
            }
        }
    }

    commitPendingUniverseDays() {
        if (this.pendingUniverseDays > 0 && this.timeService) {
            const daysToProcess = this.pendingUniverseDays;
            this.pendingUniverseDays = 0; // Clear before execution to prevent recursion loops
            this.timeService.advanceDays(daysToProcess);
            this.logger.info.system(this.gameState.day, 'SOL_CATCHUP', `Universe caught up ${daysToProcess} deferred days.`);
        }
    }

    getPerSecondRates() {
        const liveState = this.gameState.solStation;
        if (!liveState || !liveState.unlocked) return { k: 0, creditsPerSec: 0, amPerSec: 0 };
        
        const modeConfig = STATION_CONFIG.MODES[liveState.mode];
        const buffs = this._calculateOfficerBuffs(liveState.officers);
        const entropy = this._calculateEntropyFromBuffs(modeConfig.entropyMult, buffs);
        const k = modeConfig.decayK * entropy;
        
        const x0 = liveState.health / 100;
        let efficiency = x0 >= STATION_CONFIG.EFFICIENCY_CLIFF ? x0 : 2 * Math.pow(x0, 2);

        const creditsPerSec = modeConfig.yieldCredits * (1 + buffs.creditMult) * efficiency;
        const amPerSec = modeConfig.yieldAm * (1 + buffs.amMult) * efficiency;
        
        return { k, creditsPerSec, amPerSec };
    }

    _syncTime() {
        if (this.trackingActive) {
            this.commitLiveTime();
        } else {
            this.catchUpDays(this.gameState.day);
        }
    }

    _calculateExactState(currentState, dt) {
        const newState = JSON.parse(JSON.stringify(currentState));
        if (dt <= 0) return newState;

        const modeConfig = STATION_CONFIG.MODES[newState.mode];
        const officerBuffs = this._calculateOfficerBuffs(newState.officers);
        const entropy = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs);
        const k = modeConfig.decayK * entropy;

        let totalFillRatio = 0;
        let activeCaches = 0;

        const validCaches = Object.entries(newState.caches).filter(([id, cache]) => {
            return id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER && cache.max > 0;
        });

        validCaches.forEach(([id, c]) => {
            totalFillRatio += (c.current / c.max);
            activeCaches++;
        });
        const x0 = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;

        validCaches.forEach(([id, cache]) => {
            const exactCache = cache.current * Math.exp(-k * dt);
            cache.current = exactCache;
        });

        const x1 = x0 * Math.exp(-k * dt);
        newState.health = Math.round(x1 * 100);

        const yieldCredits = modeConfig.yieldCredits * (1 + officerBuffs.creditMult);
        const yieldAm = modeConfig.yieldAm * (1 + officerBuffs.amMult);

        const generatedCredits = this._calculateYieldIntegral(yieldCredits, x0, k, dt);
        const generatedAm = this._calculateYieldIntegral(yieldAm, x0, k, dt);

        newState.stockpile.credits += generatedCredits;
        newState.stockpile.antimatter = Math.min(
            STATION_CONFIG.MAX_ANTIMATTER_STOCKPILE, 
            newState.stockpile.antimatter + generatedAm
        );

        newState.currentEfficiency = x1 >= STATION_CONFIG.EFFICIENCY_CLIFF ? x1 : 2 * Math.pow(x1, 2);

        return newState;
    }

    _calculateYieldIntegral(yieldRate, x0, k, dt) {
        if (k === 0) {
            const eff = x0 >= STATION_CONFIG.EFFICIENCY_CLIFF ? 1.0 : 2 * Math.pow(x0, 2);
            return yieldRate * eff * dt;
        }

        const x1 = x0 * Math.exp(-k * dt);

        if (x1 >= STATION_CONFIG.EFFICIENCY_CLIFF) {
            return yieldRate * dt;
        } else if (x0 < STATION_CONFIG.EFFICIENCY_CLIFF) {
            return (yieldRate * Math.pow(x0, 2) / k) * (1 - Math.exp(-2 * k * dt));
        } else {
            const t_cross = -Math.log(STATION_CONFIG.EFFICIENCY_CLIFF / x0) / k;
            const genBefore = yieldRate * t_cross;
            
            const dt_remaining = dt - t_cross;
            const genAfter = (yieldRate * Math.pow(STATION_CONFIG.EFFICIENCY_CLIFF, 2) / k) * (1 - Math.exp(-2 * k * dt_remaining));
            
            return genBefore + genAfter;
        }
    }

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

    getLiveState() {
        return this.gameState.solStation;
    }

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

    setMode(newModeId) {
        this._syncTime();
        
        if (STATION_CONFIG.MODES[newModeId]) {
            this.gameState.solStation.mode = newModeId;
            this.logger.info.player(this.gameState.day, 'STATION_MODE', `Sol Station mode switched to ${newModeId}`);
            this.gameState.setState({});
        }
    }

    donateToCache(commodityId, quantity) {
        this._syncTime();

        const station = this.gameState.solStation;
        const cache = station.caches[commodityId];

        if (!cache) return { success: false, message: "Invalid cache commodity." };

        // --- FLEET OVERFLOW SYSTEM: AGGREGATE INVENTORY ---
        let totalFleetStock = 0;
        for (const shipId of this.gameState.player.ownedShipIds) {
            totalFleetStock += (this.gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0);
        }

        if (totalFleetStock < quantity) {
            return { success: false, message: "Insufficient fleet cargo." };
        }
        
        const spaceAvailable = cache.max - cache.current;
        if (quantity > spaceAvailable) {
            return { success: false, message: `Cache full. Can only accept ${Math.floor(spaceAvailable)} units.` };
        }

        // --- FLEET OVERFLOW SYSTEM: SEQUENTIAL DRAIN ---
        const activeShipId = this.gameState.player.activeShipId;
        const shipInventories = [];
        
        for (const shipId of this.gameState.player.ownedShipIds) {
            const qty = this.gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0;
            shipInventories.push({ shipId, qty });
        }

        // Sort: Active ship first, then the remaining ships with the largest stockpile of the requested item
        shipInventories.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.qty - a.qty; 
        });

        let remainingToDonate = quantity;
        for (const shipData of shipInventories) {
            if (remainingToDonate <= 0) break;
            const toRemove = Math.min(remainingToDonate, shipData.qty);
            if (toRemove > 0) {
                const invItem = this.gameState.player.inventories[shipData.shipId][commodityId];
                invItem.quantity -= toRemove;
                if (invItem.quantity === 0) invItem.avgCost = 0;
                remainingToDonate -= toRemove;
            }
        }
        // --- END FLEET OVERFLOW SYSTEM ---

        cache.current += quantity;

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
        this._syncTime();

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
        this._syncTime();

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
        const liveState = this.getLiveState();
        if(!liveState || !liveState.unlocked) return { credits: 0, antimatter: 0, entropy: 1 };
        
        const modeConfig = STATION_CONFIG.MODES[liveState.mode];
        
        const x0 = liveState.health / 100;
        let efficiency = x0;
        if (x0 < STATION_CONFIG.EFFICIENCY_CLIFF) efficiency = 2 * Math.pow(x0, 2);

        const buffs = this._calculateOfficerBuffs(liveState.officers);
        const entropy = this._calculateEntropyFromBuffs(modeConfig.entropyMult, buffs);

        const credits = Math.floor(modeConfig.yieldCredits * STATION_CONFIG.REAL_TIME_SECONDS_PER_DAY * (1 + buffs.creditMult) * efficiency);
        const antimatter = (modeConfig.yieldAm * STATION_CONFIG.REAL_TIME_SECONDS_PER_DAY * (1 + buffs.amMult) * efficiency).toFixed(2);

        return { credits, antimatter, entropy };
    }
}