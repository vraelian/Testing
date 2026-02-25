// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { COMMODITY_IDS } from '../data/constants.js';
import { LEVEL_REGISTRY } from '../data/solProgressionRegistry.js';

// Converted hardcoded configuration to the mathematical floor
export const LEVEL_1_BASELINE = {
    MAX_ANTIMATTER_STOCKPILE: 150,
    BASE_DECAY_K: 0.0000021, 
    EFFICIENCY_CLIFF: 0.5, 
    REAL_TIME_SECONDS_PER_DAY: 120,
    
    // BASELINE COMMODITY CAPACITIES (The Floor)
    baseCapacity: {
        [COMMODITY_IDS.WATER_ICE]: 200,
        [COMMODITY_IDS.PLASTEEL]: 180,
        [COMMODITY_IDS.HYDROPONICS]: 160,
        [COMMODITY_IDS.CYBERNETICS]: 140,
        [COMMODITY_IDS.PROPELLANT]: 120,
        [COMMODITY_IDS.PROCESSORS]: 100,
        [COMMODITY_IDS.GRAPHENE_LATTICES]: 80,
        [COMMODITY_IDS.CRYO_PODS]: 60,
        [COMMODITY_IDS.ATMO_PROCESSORS]: 40,
        [COMMODITY_IDS.CLONED_ORGANS]: 20,
        [COMMODITY_IDS.XENO_GEOLOGICALS]: 10,
        [COMMODITY_IDS.SENTIENT_AI]: 5
    },

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
        this.pendingUniverseDays = 0; 
        this.heartbeatInterval = null;
    }

    setTimeService(timeService) {
        this.timeService = timeService;
        if (this.gameState && this.gameState.currentLocationId === 'sol') {
            this.startLocalLiveLoop();
        }
    }

    catchUpDays(currentDay) {
        const station = this.gameState.solStation;
        if (!station || !station.unlocked) return;

        this._syncUnlocksWithLevel(station);

        console.group(`[SOL_MATH_DEBUG] catchUpDays`);
        console.log(`Current Day: ${currentDay}`);

        if (typeof station.lastProcessedDay === 'undefined') {
            console.log(`First visit. Initializing lastProcessedDay to 1 to simulate past activity.`);
            station.lastProcessedDay = 1;
            if (station.lastUpdateTime) delete station.lastUpdateTime;
        }

        const daysMissed = currentDay - station.lastProcessedDay;
        console.log(`Days Missed: ${daysMissed}`);

        if (daysMissed <= 0) {
            console.log(`No days missed. Aborting catchUp.`);
            console.groupEnd();
            return;
        }

        const dt = daysMissed * LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY;
        console.log(`Calculated delta-time (dt) in seconds: ${dt}`);
        
        const projectedState = this._calculateExactState(station, dt);
        Object.assign(station, projectedState);
        
        station.lastProcessedDay = currentDay;
        this.logger.info.system('SolStation', currentDay, 'SOL_BATCH', `Sol Station caught up ${daysMissed} missed days.`);
        console.groupEnd();
    }

    startLocalLiveLoop() {
        if (this.trackingActive) return;
        
        // Ensure state is valid before starting loop
        if (this.gameState.solStation) {
            this._syncUnlocksWithLevel(this.gameState.solStation);
        }

        this.trackingActive = true;
        this.lastCommitTime = Date.now();
        this.localTimeAccumulator = 0;
        
        const station = this.gameState.solStation;
        if (station && station.unlocked && typeof station.lastProcessedDay === 'undefined') {
            station.lastProcessedDay = this.gameState.day;
        }
        
        this.logger.info.system('SolStation', this.gameState.day, 'SOL_TRACK', `Sol Station tracking started (Universe Execution Deferred).`);

        this.heartbeatInterval = setInterval(() => {
            this.commitLiveTime();
            this.commitPendingUniverseDays();
        }, 1000);
    }

    stopLocalLiveLoop() {
        if (!this.trackingActive) return;
        this.commitLiveTime();
        this.trackingActive = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.gameState.solStation && this.gameState.solStation.unlocked) {
            this.gameState.solStation.lastProcessedDay = this.gameState.day;
        }
        
        this.logger.info.system('SolStation', this.gameState.day, 'SOL_TRACK', `Sol Station tracking terminated.`);
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
            if (this.localTimeAccumulator >= LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY) {
                const daysToAdvance = Math.floor(this.localTimeAccumulator / LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY);
                this.localTimeAccumulator -= (daysToAdvance * LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY);
                
                station.lastProcessedDay += daysToAdvance;
                
                // Universe day increment deferred strictly to TimeService to prevent double-incrementation
                this.pendingUniverseDays += daysToAdvance;
                
                this.gameState.setState({});
            }
        }
    }

    commitPendingUniverseDays() {
        if (this.pendingUniverseDays > 0 && this.timeService) {
            const daysToProcess = this.pendingUniverseDays;
            this.pendingUniverseDays = 0; 
            this.timeService.advanceDays(daysToProcess);
            this.logger.info.system('SolStation', this.gameState.day, 'SOL_CATCHUP', `Universe caught up ${daysToProcess} deferred days.`);
        }
    }

    getPerSecondRates() {
        const liveState = this.gameState.solStation;
        if (!liveState || !liveState.unlocked) return { k: 0, creditsPerSec: 0, amPerSec: 0 };
        
        const modeConfig = LEVEL_1_BASELINE.MODES[liveState.mode] || LEVEL_1_BASELINE.MODES.STABILITY;
        const officerBuffs = this._calculateOfficerBuffs(liveState.officers);
        const levelBuffs = this._calculateLevelBuffs(liveState.level || 1);
        
        const globalEntropyMult = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs, levelBuffs);
        const k_global = LEVEL_1_BASELINE.BASE_DECAY_K * globalEntropyMult;
        
        // Sanitize health to prevent NaN propagation
        const safeHealth = isNaN(liveState.health) ? 0 : liveState.health;
        const x0 = safeHealth / 100;
        let efficiency = x0 >= LEVEL_1_BASELINE.EFFICIENCY_CLIFF ? x0 : 2 * Math.pow(x0, 2);

        const creditsPerSec = modeConfig.yieldCredits * (1 + officerBuffs.creditMult + levelBuffs.creditMult) * efficiency;
        const amPerSec = modeConfig.yieldAm * (1 + officerBuffs.amMult + levelBuffs.amMult) * efficiency;
        
        return { 
            k: isNaN(k_global) ? 0 : k_global, 
            creditsPerSec: isNaN(creditsPerSec) ? 0 : creditsPerSec, 
            amPerSec: isNaN(amPerSec) ? 0 : amPerSec 
        };
    }

    _syncTime() {
        if (this.trackingActive) {
            this.commitLiveTime();
        } else {
            this.catchUpDays(this.gameState.day);
        }
    }

    // --- HELPER: Strict Unlock Sync Logic ---
    _syncUnlocksWithLevel(station) {
        if (!station.unlockedModes) station.unlockedModes = ["STABILITY"];
        
        const level = station.level || 1;

        // COMMERCE: Level 3+
        if (level >= 3) {
            if (!station.unlockedModes.includes("COMMERCE")) station.unlockedModes.push("COMMERCE");
        } else {
            // STRICT REMOVAL if level is too low (Fixes legacy saves)
            station.unlockedModes = station.unlockedModes.filter(m => m !== "COMMERCE");
            // If active mode was removed, reset to Stability
            if (station.mode === "COMMERCE") station.mode = "STABILITY";
        }

        // PRODUCTION: Level 5+
        if (level >= 5) {
            if (!station.unlockedModes.includes("PRODUCTION")) station.unlockedModes.push("PRODUCTION");
        } else {
            // STRICT REMOVAL
            station.unlockedModes = station.unlockedModes.filter(m => m !== "PRODUCTION");
            // If active mode was removed, reset to Stability
            if (station.mode === "PRODUCTION") station.mode = "STABILITY";
        }
    }

    _calculateExactState(currentState, dt) {
        const newState = JSON.parse(JSON.stringify(currentState));
        
        // --- 1. STRICT SLOT ENFORCEMENT ---
        // Formula: 1 + floor(level / 5).
        const currentLevel = newState.level || 1;
        const targetSlots = 1 + Math.floor(currentLevel / 5);
        
        // Cap max slots to prevent UI overflow (e.g. 12 max)
        const maxAllowed = 12;
        const slotsToHave = Math.min(targetSlots, maxAllowed);

        // Ensure array is initialized
        if (!newState.officers) newState.officers = [];
        
        // STRICT ALIGNMENT:
        if (newState.officers.length < slotsToHave) {
            // Grow: Add slots if level permits
            while (newState.officers.length < slotsToHave) {
                newState.officers.push({ 
                    slotId: newState.officers.length + 1, 
                    assignedOfficerId: null 
                });
            }
        } else if (newState.officers.length > slotsToHave) {
            // Shrink: Remove slots if level does NOT permit (fixes legacy saves)
            newState.officers = newState.officers.slice(0, slotsToHave);
        }

        if (dt <= 0) return newState;

        const modeConfig = LEVEL_1_BASELINE.MODES[newState.mode] || LEVEL_1_BASELINE.MODES.STABILITY;
        const officerBuffs = this._calculateOfficerBuffs(newState.officers);
        const levelBuffs = this._calculateLevelBuffs(newState.level || 1);
        
        // Decoupled Integral Global Entropy
        const globalEntropyMult = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs, levelBuffs);
        const k_global = LEVEL_1_BASELINE.BASE_DECAY_K * globalEntropyMult;

        let totalFillRatio = 0;
        let activeCaches = 0;

        const validCaches = Object.entries(newState.caches || {}).filter(([id, cache]) => {
            return id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER && cache;
        });

        validCaches.forEach(([id, c]) => {
            // Establish Baseline Max using LEVEL_1_BASELINE or legacy backup
            if (!c.baseMax) {
                c.baseMax = LEVEL_1_BASELINE.baseCapacity[id] || 100;
            }
            
            // Calculate effective max capacity
            const actualMax = c.baseMax + (levelBuffs.capacityMods[id] || 0) + (officerBuffs.capacityMods[id] || 0);
            c.max = actualMax;
            
            // Immediately clamp current to prevent overflow if max dropped due to un-slotting
            if (c.current > actualMax) {
                c.current = actualMax; 
            }

            const safeCurrent = isNaN(c.current) ? 0 : c.current;
            const safeMax = isNaN(actualMax) || actualMax <= 0 ? 1 : actualMax;
            
            // Decoupled Specific Cache Decay using targeted friction
            const specificBurnRed = officerBuffs.consumptionMods[id] || 0;
            const k_specific = k_global * Math.max(0, (1 - specificBurnRed));
            
            c.current = safeCurrent * Math.exp(-k_specific * dt);
            
            totalFillRatio += (c.current / safeMax);
            activeCaches++;
        });
        
        let x0 = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;
        if (isNaN(x0)) x0 = 0;

        if (dt > 2.0) {
            console.log(`[SOL_MATH_DEBUG] _calculateExactState | dt=${dt.toFixed(2)}s | x0=${x0.toFixed(4)} | k_global=${k_global}`);
        }

        const x1 = x0 * Math.exp(-k_global * dt);
        newState.health = x1 * 100;

        const yieldCredits = modeConfig.yieldCredits * (1 + officerBuffs.creditMult + levelBuffs.creditMult);
        const yieldAm = modeConfig.yieldAm * (1 + officerBuffs.amMult + levelBuffs.amMult);

        const generatedCredits = this._calculateYieldIntegral(yieldCredits, x0, k_global, dt);
        const generatedAm = this._calculateYieldIntegral(yieldAm, x0, k_global, dt);

        if (dt > 2.0) {
            console.log(`[SOL_MATH_DEBUG] _calculateExactState | Gen Credits: ${generatedCredits.toFixed(2)} | Final x1: ${x1.toFixed(4)}`);
        }

        const safeGeneratedCredits = isNaN(generatedCredits) ? 0 : generatedCredits;
        const safeGeneratedAm = isNaN(generatedAm) ? 0 : generatedAm;
        const safeCurrentCredits = isNaN(newState.stockpile.credits) ? 0 : newState.stockpile.credits;
        const safeCurrentAm = isNaN(newState.stockpile.antimatter) ? 0 : newState.stockpile.antimatter;

        newState.stockpile.credits = safeCurrentCredits + safeGeneratedCredits;
        newState.stockpile.antimatter = Math.min(
            LEVEL_1_BASELINE.MAX_ANTIMATTER_STOCKPILE, 
            safeCurrentAm + safeGeneratedAm
        );

        newState.currentEfficiency = x1 >= LEVEL_1_BASELINE.EFFICIENCY_CLIFF ? x1 : 2 * Math.pow(x1, 2);

        return newState;
    }

    _calculateYieldIntegral(yieldRate, x0, k, dt) {
        if (k === 0) {
            const eff = x0 >= LEVEL_1_BASELINE.EFFICIENCY_CLIFF ? x0 : 2 * Math.pow(x0, 2);
            return yieldRate * eff * dt;
        }

        const x1 = x0 * Math.exp(-k * dt);

        if (x1 >= LEVEL_1_BASELINE.EFFICIENCY_CLIFF) {
            return yieldRate * (x0 / k) * (1 - Math.exp(-k * dt));
        } else if (x0 < LEVEL_1_BASELINE.EFFICIENCY_CLIFF) {
            return (yieldRate * Math.pow(x0, 2) / k) * (1 - Math.exp(-2 * k * dt));
        } else {
            const t_cross = -Math.log(LEVEL_1_BASELINE.EFFICIENCY_CLIFF / x0) / k;
            const genBefore = yieldRate * (x0 / k) * (1 - Math.exp(-k * t_cross));
            
            const dt_remaining = dt - t_cross;
            const genAfter = (yieldRate * Math.pow(LEVEL_1_BASELINE.EFFICIENCY_CLIFF, 2) / k) * (1 - Math.exp(-2 * k * dt_remaining));
            
            return genBefore + genAfter;
        }
    }

    getDeathSpiralThreshold() {
        const station = this.gameState.solStation;
        const modeConfig = LEVEL_1_BASELINE.MODES[station.mode];
        const officerBuffs = this.getOfficerBuffs();
        const levelBuffs = this._calculateLevelBuffs(station.level || 1);
        
        const entropyMult = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs, levelBuffs);
        const k_global = modeConfig.decayK * entropyMult;
        
        const commerceYield = LEVEL_1_BASELINE.MODES.COMMERCE.yieldCredits * (1 + officerBuffs.creditMult + levelBuffs.creditMult);
        if (commerceYield <= 0) return LEVEL_1_BASELINE.EFFICIENCY_CLIFF;

        const averageCacheSize = 5000; 
        const threshold = (k_global * averageCacheSize * 45) / (2 * commerceYield);
        
        return Math.max(0, Math.min(threshold, LEVEL_1_BASELINE.EFFICIENCY_CLIFF));
    }

    getLiveState() {
        return this.gameState.solStation;
    }

    // --- BUFF CALCULATION ENGINES ---

    _calculateOfficerBuffs(officersList) {
        let total = { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: {} };
        if (!officersList) return total;

        officersList.forEach(slot => {
            if (slot.assignedOfficerId && OFFICERS[slot.assignedOfficerId]) {
                const b = OFFICERS[slot.assignedOfficerId].buffs;
                total.entropy += (b.entropy || 0);
                total.creditMult += (b.creditMult || 0);
                total.amMult += (b.amMult || 0);
                
                if (b.capacityMods) {
                    Object.entries(b.capacityMods).forEach(([res, val]) => {
                        total.capacityMods[res] = (total.capacityMods[res] || 0) + val;
                    });
                }
                if (b.consumptionMods) {
                    Object.entries(b.consumptionMods).forEach(([res, val]) => {
                        total.consumptionMods[res] = (total.consumptionMods[res] || 0) + val;
                    });
                }
            }
        });
        return total;
    }

    _calculateLevelBuffs(level) {
        let total = { creditMult: 0, amMult: 0, globalEntropyRed: 0, capacityMods: {} };
        for (let i = 2; i <= level; i++) {
            const reg = LEVEL_REGISTRY[i];
            if (reg && reg.rewards && reg.rewards.stats) {
                const s = reg.rewards.stats;
                total.creditMult += (s.creditYieldMult || 0);
                total.amMult += (s.amYieldMult || 0);
                total.globalEntropyRed += (s.globalEntropyRed || 0);
                if (s.cacheCapacity) {
                    Object.entries(s.cacheCapacity).forEach(([res, val]) => {
                        total.capacityMods[res] = (total.capacityMods[res] || 0) + val;
                    });
                }
            }
        }
        return total;
    }

    getOfficerBuffs() {
        return this._calculateOfficerBuffs(this.gameState.solStation.officers);
    }

    _calculateEntropyFromBuffs(baseModeMult, officerBuffs, levelBuffs = {globalEntropyRed: 0}) {
        let multiplier = baseModeMult;
        multiplier += officerBuffs.entropy; 
        multiplier -= levelBuffs.globalEntropyRed;
        return Math.max(0.1, multiplier);
    }

    calculateEntropy(baseModeMult) {
        const station = this.gameState.solStation;
        return this._calculateEntropyFromBuffs(baseModeMult, this.getOfficerBuffs(), this._calculateLevelBuffs(station.level || 1));
    }

    setMode(newModeId) {
        this._syncTime();
        
        if (LEVEL_1_BASELINE.MODES[newModeId]) {
            this.gameState.solStation.mode = newModeId;
            this.logger.info.player(this.gameState.day, 'STATION_MODE', `Sol Station mode switched to ${newModeId}`);
            this.gameState.setState({});
        }
    }

    // --- INTERACTION & DONATION PIPELINES ---

    donateToCache(commodityId, quantity) {
        this._syncTime(); 

        // Enforce strictly integer inputs for cache transfers
        quantity = Math.floor(quantity);

        const station = this.gameState.solStation;
        const cache = station.caches[commodityId];

        if (!cache) return { success: false, message: "Invalid cache commodity." };

        let totalFleetStock = 0;
        for (const shipId of this.gameState.player.ownedShipIds) {
            totalFleetStock += (this.gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0);
        }

        if (totalFleetStock < quantity) {
            return { success: false, message: "Insufficient fleet cargo." };
        }
        
        // Strictly evaluate remaining floor capacity
        const spaceAvailable = Math.floor(cache.max - cache.current);
        if (quantity > spaceAvailable) {
            return { success: false, message: `Cache full. Can only accept ${Math.floor(spaceAvailable)} units.` };
        }

        const activeShipId = this.gameState.player.activeShipId;
        const shipInventories = [];
        
        for (const shipId of this.gameState.player.ownedShipIds) {
            const qty = this.gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0;
            shipInventories.push({ shipId, qty });
        }

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

        cache.current += quantity;

        let totalFillRatio = 0;
        let activeCaches = 0;
        const validCacheEntries = Object.entries(station.caches).filter(([id, c]) => {
            return id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER && c.max > 0;
        });

        for (const [id, c] of validCacheEntries) {
            const safeCurrent = isNaN(c.current) ? 0 : c.current;
            const safeMax = isNaN(c.max) || c.max <= 0 ? 1 : c.max;
            totalFillRatio += (safeCurrent / safeMax);
            activeCaches++;
        }
        
        const averageFill = activeCaches > 0 ? (totalFillRatio / activeCaches) : 0;
        station.health = averageFill * 100;

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

    // --- PROGRESSION PROJECTS ---

    contributeToProject(resourceId, quantity) {
        this._syncTime();
        
        const station = this.gameState.solStation;
        const nextLevelData = LEVEL_REGISTRY[station.level + 1];
        
        if (!nextLevelData) return { success: false, message: "Maximum level reached." };
        if (!nextLevelData.requirements[resourceId]) return { success: false, message: "Resource not required for active project." };
        
        const currentlyBanked = station.activeProjectBank[resourceId] || 0;
        const requiredAmount = nextLevelData.requirements[resourceId];
        
        if (currentlyBanked >= requiredAmount) return { success: false, message: "Requirement already met." };
        
        let qtyToTake = Math.min(quantity, requiredAmount - currentlyBanked);
        
        if (resourceId === 'credits') {
            if (this.gameState.player.credits < qtyToTake) return { success: false, message: "Insufficient credits." };
            this.gameState.player.credits -= qtyToTake;
            station.activeProjectBank[resourceId] = currentlyBanked + qtyToTake;
        } else {
            let totalFleetStock = 0;
            for (const shipId of this.gameState.player.ownedShipIds) {
                totalFleetStock += (this.gameState.player.inventories[shipId]?.[resourceId]?.quantity || 0);
            }

            if (totalFleetStock < qtyToTake) {
                return { success: false, message: "Insufficient fleet cargo." };
            }

            const activeShipId = this.gameState.player.activeShipId;
            const shipInventories = [];
            for (const shipId of this.gameState.player.ownedShipIds) {
                const qty = this.gameState.player.inventories[shipId]?.[resourceId]?.quantity || 0;
                shipInventories.push({ shipId, qty });
            }

            shipInventories.sort((a, b) => {
                if (a.shipId === activeShipId) return -1;
                if (b.shipId === activeShipId) return 1;
                return b.qty - a.qty; 
            });

            let remainingToDonate = qtyToTake;
            for (const shipData of shipInventories) {
                if (remainingToDonate <= 0) break;
                const toRemove = Math.min(remainingToDonate, shipData.qty);
                if (toRemove > 0) {
                    const invItem = this.gameState.player.inventories[shipData.shipId][resourceId];
                    invItem.quantity -= toRemove;
                    if (invItem.quantity === 0) invItem.avgCost = 0;
                    remainingToDonate -= toRemove;
                }
            }
            
            station.activeProjectBank[resourceId] = currentlyBanked + qtyToTake;
        }

        this.logger.info.player(this.gameState.day, 'STATION_PROJECT', `Contributed ${qtyToTake} ${resourceId} to Project.`);
        
        this.gameState.setState({});
        return { success: true, message: `Contributed ${qtyToTake} to project.` };
    }
    
    completeActiveProject() {
        const station = this.gameState.solStation;
        const nextLevelData = LEVEL_REGISTRY[station.level + 1];
        if (!nextLevelData) return { success: false };
        
        // Validation check
        for (const [resId, reqQty] of Object.entries(nextLevelData.requirements)) {
            if ((station.activeProjectBank[resId] || 0) < reqQty) {
                return { success: false, message: "Project requirements not met." };
            }
        }
        
        this.applyLevelUp();
        return { success: true };
    }
    
    applyLevelUp() {
        const station = this.gameState.solStation;
        
        station.activeProjectBank = {}; 
        station.level++;
        
        this._syncUnlocksWithLevel(station);
        
        // --- UPDATED SLOT LOGIC (Strict Alignment) ---
        // Slots = 1 + floor(level/5)
        const maxSlots = 1 + Math.floor(station.level / 5);
        const slotsToHave = Math.min(maxSlots, 12);
        
        if (station.officers.length < slotsToHave) {
             while (station.officers.length < slotsToHave) {
                station.officers.push({ slotId: station.officers.length + 1, assignedOfficerId: null });
             }
        }
        
        this.logger.info.system('SolStation', this.gameState.day, 'LEVEL_UP', `Sol Station upgraded to Level ${station.level}!`);
    }

    // --- LOAD BEARING OFFICER MANAGEMENT ---

    /**
     * Projects the mathematical fallout of removing an officer from a slot.
     * Required by UI intercept for severe consequences like venting overflow inventory.
     * @param {number|string} slotId 
     * @returns {object} { safe: boolean, ventedCargo: object, netEntropyChange: number }
     */
    validateUnslotOfficer(slotId) {
        const station = this.gameState.solStation;
        const slotIndex = station.officers.findIndex(s => s.slotId === parseInt(slotId));
        
        if (slotIndex === -1 || !station.officers[slotIndex].assignedOfficerId) {
            return { safe: true, ventedCargo: {}, netEntropyChange: 0 };
        }

        const currentOfficerBuffs = this._calculateOfficerBuffs(station.officers);
        const levelBuffs = this._calculateLevelBuffs(station.level || 1);
        
        // Simulate removing the officer
        const simulatedOfficers = JSON.parse(JSON.stringify(station.officers));
        simulatedOfficers[slotIndex].assignedOfficerId = null;
        const newOfficerBuffs = this._calculateOfficerBuffs(simulatedOfficers);

        const modeMult = LEVEL_1_BASELINE.MODES[station.mode].entropyMult;
        const currentEntropy = this._calculateEntropyFromBuffs(modeMult, currentOfficerBuffs, levelBuffs);
        const newEntropy = this._calculateEntropyFromBuffs(modeMult, newOfficerBuffs, levelBuffs);
        
        const netEntropyChange = (newEntropy - currentEntropy); 

        const ventedCargo = {};
        let isSafe = true;

        Object.entries(station.caches).forEach(([id, c]) => {
            const baseMax = c.baseMax || LEVEL_1_BASELINE.baseCapacity[id] || 100;
            const newMax = baseMax + (levelBuffs.capacityMods[id] || 0) + (newOfficerBuffs.capacityMods[id] || 0);
            
            if (c.current > newMax) {
                ventedCargo[id] = Math.floor(c.current - newMax);
                isSafe = false; // Overflow triggers explicit UI intervention
            }
        });

        // E.g., a net entropy increase of 0.1 represents +10% base entropy
        if (netEntropyChange >= 0.1) {
            isSafe = false;
        }

        return { safe: isSafe, ventedCargo, netEntropyChange };
    }

    /**
     * Executes officer assignment or removal.
     * Includes an optional 'force' flag for un-slotting bypassing validation (if player approved).
     * @param {number|string} slotId 
     * @param {string|null} officerId 
     * @param {boolean} force - Override safety checks on removal
     * @returns {object} Standard payload, can return `requiresConfirmation` if validation fails.
     */
    assignOfficer(slotId, officerId, force = false) {
        this._syncTime();

        const station = this.gameState.solStation;
        const slotIndex = station.officers.findIndex(s => s.slotId === parseInt(slotId));
        
        if (slotIndex === -1) return { success: false, message: "Invalid slot." };

        // Intercept Removal
        if (!officerId && !force) {
            const validation = this.validateUnslotOfficer(slotId);
            if (!validation.safe) {
                return { success: false, requiresConfirmation: true, payload: validation };
            }
        }

        station.officers[slotIndex].assignedOfficerId = officerId;
        
        // Immediately enforce new capacities after un-slotting to execute venting
        if (!officerId) {
            const levelBuffs = this._calculateLevelBuffs(station.level || 1);
            const officerBuffs = this._calculateOfficerBuffs(station.officers);
            
            Object.entries(station.caches).forEach(([id, c]) => {
                const baseMax = c.baseMax || LEVEL_1_BASELINE.baseCapacity[id] || 100;
                const newMax = baseMax + (levelBuffs.capacityMods[id] || 0) + (officerBuffs.capacityMods[id] || 0);
                c.max = newMax;
                if (c.current > newMax) {
                    c.current = newMax; // Executes the permanent destruction of vented cargo
                }
            });
        }

        const officerName = officerId ? (OFFICERS[officerId]?.name || officerId) : "None";
        const action = officerId ? "assigned" : "unassigned";
        
        this.logger.info.player(this.gameState.day, 'OFFICER_ASSIGN', `Officer ${officerName} ${action} to Slot ${slotId}.`);
        this.gameState.setState({});
        return { success: true };
    }

    getProjectedOutput() {
        const liveState = this.getLiveState();
        if(!liveState || !liveState.unlocked) return { credits: 0, antimatter: 0, entropy: 1 };
        
        const modeConfig = LEVEL_1_BASELINE.MODES[liveState.mode] || LEVEL_1_BASELINE.MODES.STABILITY;
        
        const safeHealth = isNaN(liveState.health) ? 0 : liveState.health;
        const x0 = safeHealth / 100;
        let efficiency = x0;
        if (x0 < LEVEL_1_BASELINE.EFFICIENCY_CLIFF) efficiency = 2 * Math.pow(x0, 2);

        const officerBuffs = this._calculateOfficerBuffs(liveState.officers);
        const levelBuffs = this._calculateLevelBuffs(liveState.level || 1);
        const entropyMult = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs, levelBuffs);

        const yieldCreditsBase = modeConfig.yieldCredits * (1 + officerBuffs.creditMult + levelBuffs.creditMult);
        const yieldAmBase = modeConfig.yieldAm * (1 + officerBuffs.amMult + levelBuffs.amMult);

        const credits = Math.floor(yieldCreditsBase * LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY * efficiency);
        const antimatter = (yieldAmBase * LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY * efficiency).toFixed(2);

        return { credits, antimatter, entropy: entropyMult };
    }
}