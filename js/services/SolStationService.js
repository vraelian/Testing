// js/services/SolStationService.js
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { COMMODITY_IDS } from '../data/constants.js';
import { LEVEL_REGISTRY } from '../data/solProgressionRegistry.js';

/**
 * Baseline parameters for Sol Station Level 1 (before officer or level progression modifiers).
 * * OPERATIONAL MODES MATHEMATICAL PERFORMANCE:
 * Based on 120 Real-Time Seconds = 1 In-Game Day at 100% Efficiency.
 * * STABILITY MODE:
 * - Generation: 1 Antimatter / Day, 2,000 Credits / Day
 * - Consumption: 0.08% Cache Loss / Day (Entropy Multiplier: 1.0x)
 * * COMMERCE MODE:
 * - Generation: 1 Antimatter / Day, 16,000 Credits / Day
 * - Consumption: 0.14% Cache Loss / Day (Entropy Multiplier: 1.75x)
 * * PRODUCTION MODE:
 * - Generation: 6 Antimatter / Day, 2,000 Credits / Day
 * - Consumption: 0.21% Cache Loss / Day (Entropy Multiplier: 2.625x)
 * * SYNTHESIS MODE:
 * - Generation: 0 Antimatter / Day, 0 Credits / Day
 * - Consumption: 0.08% Cache Loss / Day (Entropy Multiplier: 1.0x), plus 10 Antimatter over 30 Days
 */
export const LEVEL_1_BASELINE = {
    MAX_ANTIMATTER_STOCKPILE: 150,
    BASE_DECAY_K: 0.00000667, // Mathematically calibrated to yield exactly 0.08% decay over 120 seconds
    EFFICIENCY_CLIFF: 0.25, // Station operates at peak yield until caches average below 25%
    REAL_TIME_SECONDS_PER_DAY: 120,
    
    // BASELINE COMMODITY CAPACITIES (The Floor)
    baseCapacity: {
        [COMMODITY_IDS.WATER_ICE]: 250,
        [COMMODITY_IDS.PLASTEEL]: 250,
        [COMMODITY_IDS.HYDROPONICS]: 200,
        [COMMODITY_IDS.CYBERNETICS]: 200,
        [COMMODITY_IDS.PROPELLANT]: 150,
        [COMMODITY_IDS.PROCESSORS]: 150,
        [COMMODITY_IDS.GRAPHENE_LATTICES]: 100,
        [COMMODITY_IDS.CRYO_PODS]: 100,
        [COMMODITY_IDS.ATMO_PROCESSORS]: 50,
        [COMMODITY_IDS.CLONED_ORGANS]: 50,
        [COMMODITY_IDS.XENO_GEOLOGICALS]: 25,
        [COMMODITY_IDS.SENTIENT_AI]: 10
    },

    MODES: {
        STABILITY: { 
            id: 'STABILITY', 
            yieldCredits: 2000 / 120, 
            yieldAm: 1 / 120, 
            decayK: 0.00000667, 
            entropyMult: 1 
        },
        COMMERCE: { 
            id: 'COMMERCE', 
            yieldCredits: 16000 / 120, 
            yieldAm: 1 / 120, 
            decayK: 0.00000667, 
            entropyMult: 1.75 
        },
        PRODUCTION: { 
            id: 'PRODUCTION', 
            yieldCredits: 2000 / 120, 
            yieldAm: 6 / 120, 
            decayK: 0.00000667, 
            entropyMult: 2.625 
        },
        SYNTHESIS: { 
            id: 'SYNTHESIS', 
            yieldCredits: 0, 
            yieldAm: 0, 
            decayK: 0.00000667, 
            entropyMult: 1 
        }
    }
};

export class SolStationService {
    /**
     * @param {import('./GameState.js').GameState} gameState 
     * @param {import('./LoggingService.js').Logger} logger 
     */
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

    /**
     * Decays all player-owned Sol Station caches to 0. 
     * Used during multi-year absences where the station's entropy consumes abandoned resources.
     */
    decayAbandonedCaches() {
        const station = this.gameState.solStation;
        if (!station || !station.unlocked) return;
        
        Object.values(station.caches).forEach(cache => {
            if (cache) {
                cache.current = 0;
            }
        });
        
        station.health = 0;
        this.logger.info.system('SolStation', this.gameState.day, 'DECAY_ABANDONED', `All Sol Station caches decayed to 0 due to prolonged absence.`);
    }

    setTimeService(timeService) {
        this.timeService = timeService;
        if (this.gameState && this.gameState.currentLocationId === 'sol') {
            this.startLocalLiveLoop();
        }
    }

    /**
     * Processes universe time that advanced while the player was away from the station
     * or executed via forced skips (like repairs). JIT calculation of entropy and yield.
     * @param {number} currentDay 
     */
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
        
        const oldAm = station.stockpile?.antimatter || 0;
        const projectedState = this._calculateExactState(station, dt);
        Object.assign(station, projectedState);
        const newAm = station.stockpile?.antimatter || 0;

        // --- ACHIEVEMENTS: SYNTHESIS YIELD HOOK ---
        if (newAm > oldAm && this.timeService && this.timeService.simulationService && this.timeService.simulationService.achievementService) {
            this.timeService.simulationService.achievementService.increment('antimatterSynthesizedTotal', newAm - oldAm);
        }
        
        station.lastProcessedDay = currentDay;
        this.logger.info.system('SolStation', currentDay, 'SOL_BATCH', `Sol Station caught up ${daysMissed} missed days.`);
        console.groupEnd();
    }

    /**
     * Initiates the 1-second real-time simulation interval when actively docked at Sol.
     */
    startLocalLiveLoop() {
        if (this.trackingActive) return;
        
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

    /**
     * Halts the real-time simulation interval and locks the final state.
     */
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

    /**
     * Executes mathematical tick calculations based on real-world elapsed time.
     */
    commitLiveTime() {
        if (!this.trackingActive) return;
        
        const now = Date.now();
        const dtRealMs = now - this.lastCommitTime;
        if (dtRealMs <= 0) return;
        
        this.lastCommitTime = now;
        const dt = dtRealMs / 1000;
        const station = this.gameState.solStation;

        if (station && station.unlocked) {
            const oldAm = station.stockpile?.antimatter || 0;
            const newState = this._calculateExactState(station, dt);
            Object.assign(station, newState);
            const newAm = station.stockpile?.antimatter || 0;

            // --- ACHIEVEMENTS: SYNTHESIS YIELD HOOK ---
            if (newAm > oldAm && this.timeService && this.timeService.simulationService && this.timeService.simulationService.achievementService) {
                this.timeService.simulationService.achievementService.increment('antimatterSynthesizedTotal', newAm - oldAm);
            }
            
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

    /**
     * Pushes accumulated deferred days from the live loop into the global TimeService.
     */
    commitPendingUniverseDays() {
        if (this.pendingUniverseDays > 0 && this.timeService) {
            const daysToProcess = this.pendingUniverseDays;
            this.pendingUniverseDays = 0; 
            this.timeService.advanceDays(daysToProcess);
            this.logger.info.system('SolStation', this.gameState.day, 'SOL_CATCHUP', `Universe caught up ${daysToProcess} deferred days.`);
        }
    }

    /**
     * Returns the raw output velocities for rendering purposes in the UI.
     * @returns {object} { k, creditsPerSec, amPerSec }
     */
    getPerSecondRates() {
        const liveState = this.gameState.solStation;
        if (!liveState || !liveState.unlocked) return { k: 0, creditsPerSec: 0, amPerSec: 0 };
        
        const modeConfig = LEVEL_1_BASELINE.MODES[liveState.mode] || LEVEL_1_BASELINE.MODES.STABILITY;
        const officerBuffs = this._calculateOfficerBuffs(liveState.officers);
        const levelBuffs = this._calculateLevelBuffs(liveState.level || 1);
        
        const globalEntropyMult = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs, levelBuffs);
        const k_global = LEVEL_1_BASELINE.BASE_DECAY_K * globalEntropyMult;
        
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

    _syncUnlocksWithLevel(station) {
        if (!station.unlockedModes) station.unlockedModes = ["STABILITY"];
        
        const level = station.level || 1;

        if (level >= 3) {
            if (!station.unlockedModes.includes("COMMERCE")) station.unlockedModes.push("COMMERCE");
        } else {
            station.unlockedModes = station.unlockedModes.filter(m => m !== "COMMERCE");
            if (station.mode === "COMMERCE") station.mode = "STABILITY";
        }

        if (level >= 5) {
            if (!station.unlockedModes.includes("PRODUCTION")) station.unlockedModes.push("PRODUCTION");
        } else {
            station.unlockedModes = station.unlockedModes.filter(m => m !== "PRODUCTION");
            if (station.mode === "PRODUCTION") station.mode = "STABILITY";
        }

        if (level >= 10) {
            if (!station.unlockedModes.includes("SYNTHESIS")) station.unlockedModes.push("SYNTHESIS");
        } else {
            station.unlockedModes = station.unlockedModes.filter(m => m !== "SYNTHESIS");
            if (station.mode === "SYNTHESIS") station.mode = "STABILITY";
        }
    }

    /**
     * Core mathematical simulation engine for Sol Station state projection.
     * Evaluates cache loss, generates yields based on area-under-the-curve efficiency math,
     * and strictly adheres to officer modifications and specific commodity thresholds.
     * @param {object} currentState The pre-simulated station state
     * @param {number} dt Delta Time in real-time seconds
     * @returns {object} The mutated, post-simulation state
     */
    _calculateExactState(currentState, dt) {
        const newState = JSON.parse(JSON.stringify(currentState));
        
        const currentLevel = newState.level || 1;
        const targetSlots = 1 + Math.floor(currentLevel / 5);
        const maxAllowed = 12;
        const slotsToHave = Math.min(targetSlots, maxAllowed);

        if (!newState.officers) newState.officers = [];
        
        if (newState.officers.length < slotsToHave) {
            while (newState.officers.length < slotsToHave) {
                newState.officers.push({ 
                    slotId: newState.officers.length + 1, 
                    assignedOfficerId: null 
                });
            }
        } else if (newState.officers.length > slotsToHave) {
            newState.officers = newState.officers.slice(0, slotsToHave);
        }

        if (dt <= 0) return newState;

        const modeConfig = LEVEL_1_BASELINE.MODES[newState.mode] || LEVEL_1_BASELINE.MODES.STABILITY;
        const officerBuffs = this._calculateOfficerBuffs(newState.officers);
        const levelBuffs = this._calculateLevelBuffs(newState.level || 1);
        
        const globalEntropyMult = this._calculateEntropyFromBuffs(modeConfig.entropyMult, officerBuffs, levelBuffs);
        const k_global = LEVEL_1_BASELINE.BASE_DECAY_K * globalEntropyMult;

        const validCaches = Object.entries(newState.caches || {}).filter(([id, cache]) => {
            return id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER && cache;
        });

        let totalFillRatioStart = 0;
        let totalFillRatioEnd = 0;
        let activeCaches = 0;

        // PASS 1: Calculate pristine starting efficiency (x0) and enforce baseline maxes
        validCaches.forEach(([id, c]) => {
            if (!c.baseMax) {
                c.baseMax = LEVEL_1_BASELINE.baseCapacity[id] || 100;
            }
            
            const actualMax = c.baseMax + (levelBuffs.capacityMods[id] || 0) + (officerBuffs.capacityMods[id] || 0);
            c.max = actualMax;
            
            if (c.current > actualMax) {
                c.current = actualMax; 
            }

            const safeCurrent = isNaN(c.current) ? 0 : c.current;
            const safeMax = isNaN(actualMax) || actualMax <= 0 ? 1 : actualMax;
            
            totalFillRatioStart += (safeCurrent / safeMax);
            activeCaches++;
        });

        let x0 = activeCaches > 0 ? (totalFillRatioStart / activeCaches) : 0;
        if (isNaN(x0)) x0 = 0;

        // PASS 2: Apply specific cache decay, then calculate post-decay efficiency (x1)
        validCaches.forEach(([id, c]) => {
            const specificBurnRed = officerBuffs.consumptionMods[id] || 0;
            const k_specific = k_global * Math.max(0, (1 - specificBurnRed));
            
            const safeCurrent = isNaN(c.current) ? 0 : c.current;
            const safeMax = isNaN(c.max) || c.max <= 0 ? 1 : c.max;
            
            c.current = safeCurrent * Math.exp(-k_specific * dt);
            totalFillRatioEnd += (c.current / safeMax);
        });

        let x1 = activeCaches > 0 ? (totalFillRatioEnd / activeCaches) : 0;
        if (isNaN(x1)) x1 = 0;

        // Decouple Health from generic global projections; tether strictly to cache reality
        newState.health = x1 * 100;

        // Derive the effective 'k' slope between x0 and x1 for the yield integral
        let effective_k = k_global;
        if (dt > 0 && x0 > 0) {
            if (x1 > 0 && x0 !== x1) {
                effective_k = -Math.log(x1 / x0) / dt;
            } else if (x0 === x1) {
                effective_k = 0; 
            }
        }

        if (dt > 2.0) {
            console.log(`[SOL_MATH_DEBUG] _calculateExactState | dt=${dt.toFixed(2)}s | x0=${x0.toFixed(4)} | x1=${x1.toFixed(4)} | k_eff=${effective_k}`);
        }

        const yieldCredits = modeConfig.yieldCredits * (1 + officerBuffs.creditMult + levelBuffs.creditMult);
        const yieldAm = modeConfig.yieldAm * (1 + officerBuffs.amMult + levelBuffs.amMult);

        const generatedCredits = this._calculateYieldIntegral(yieldCredits, x0, effective_k, dt);
        const generatedAm = this._calculateYieldIntegral(yieldAm, x0, effective_k, dt);

        if (dt > 2.0) {
            console.log(`[SOL_MATH_DEBUG] _calculateExactState | Gen Credits: ${generatedCredits.toFixed(2)} | Gen AM: ${generatedAm.toFixed(2)}`);
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

        // PASS 3: Synthesis Manufacturing Loop
        if (newState.mode === 'SYNTHESIS' && newState.level >= 10) {
            // Requirement: 10 AM over 30 Days (1 day = 120s)
            const amPerSec = (10 / 30) / LEVEL_1_BASELINE.REAL_TIME_SECONDS_PER_DAY;
            const wantedAm = amPerSec * dt;
            const actualAm = Math.min(wantedAm, newState.antimatterCache || 0);
            
            newState.antimatterCache -= actualAm;
            
            // 10 AM consumed equals 30 days of synthesis progression.
            // Ratio: 1 AM = 3 Days of Progress.
            newState.synthesisProgress = (newState.synthesisProgress || 0) + (actualAm * 3);
            
            // Yield complete FSDs and rollover the remainder progress
            while (newState.synthesisProgress >= 30) {
                newState.synthesisProgress -= 30;
                newState.fsdOutput = (newState.fsdOutput || 0) + 1;
            }
        }

        newState.currentEfficiency = x1 >= LEVEL_1_BASELINE.EFFICIENCY_CLIFF ? x1 : 2 * Math.pow(x1, 2);

        return newState;
    }

    /**
     * Executes the yield integral spanning the dynamic efficiency slope across Delta Time.
     * @param {number} yieldRate 
     * @param {number} x0 
     * @param {number} k 
     * @param {number} dt 
     * @returns {number} Integral Yield Result
     */
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

        quantity = Math.floor(quantity);

        const station = this.gameState.solStation;
        const isAmCache = (commodityId === COMMODITY_IDS.ANTIMATTER);
        let cacheRef = isAmCache ? { current: station.antimatterCache || 0, max: 250 + Math.max(0, ((station.level - 10) / 40) * 750) } : station.caches[commodityId];

        if (!cacheRef) return { success: false, message: "Invalid cache commodity." };
        if (isAmCache && station.level < 10) return { success: false, message: "Synthesis not unlocked." };

        let totalFleetStock = 0;
        for (const shipId of this.gameState.player.ownedShipIds) {
            totalFleetStock += (this.gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0);
        }

        if (totalFleetStock < quantity) {
            return { success: false, message: "Insufficient fleet cargo." };
        }
        
        const spaceAvailable = Math.floor(cacheRef.max - cacheRef.current);
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

        if (isAmCache) {
            station.antimatterCache = (station.antimatterCache || 0) + quantity;
            this.logger.info.player(this.gameState.day, 'STATION_DONATION', `Donated ${quantity}x Antimatter to Synthesis Cache.`);
        } else {
            station.caches[commodityId].current += quantity;
            
            // Health re-calculation relies strictly on entropy caches, not Synthesis buffer
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
        }

        // --- ACHIEVEMENTS: DONATION HOOK ---
        if (this.timeService && this.timeService.simulationService && this.timeService.simulationService.achievementService) {
            this.timeService.simulationService.achievementService.increment('solDonationsTotal', quantity);
        }

        this.gameState.setState({});
        return { success: true, message: "Resources transferred." };
    }

    claimStockpile(type = null) {
        this._syncTime();

        const station = this.gameState.solStation;
        const stockpile = station.stockpile;
        const inventory = this.gameState.player.inventories[this.gameState.player.activeShipId];
        
        let claimedCredits = 0;
        let claimedAM = 0;
        let claimedFsd = 0;

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

        if ((!type || type === 'fsd') && (station.fsdOutput || 0) >= 1) {
            const amountToTake = Math.floor(station.fsdOutput);
            if (!inventory[COMMODITY_IDS.FOLDED_DRIVES]) {
                inventory[COMMODITY_IDS.FOLDED_DRIVES] = { quantity: 0, avgCost: 0 };
            }
            inventory[COMMODITY_IDS.FOLDED_DRIVES].quantity += amountToTake;
            claimedFsd = amountToTake;
            station.fsdOutput -= amountToTake;
        }

        if (claimedCredits === 0 && claimedAM === 0 && claimedFsd === 0) {
            return { success: false, message: "Nothing to collect." };
        }

        this.gameState.setState({});
        
        const msgParts = [];
        if (claimedCredits > 0) msgParts.push(`${claimedCredits} Cr`);
        if (claimedAM > 0) msgParts.push(`${claimedAM} AM`);
        if (claimedFsd > 0) msgParts.push(`${claimedFsd} FSD`);
        
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
        
        const maxSlots = 1 + Math.floor(station.level / 5);
        const slotsToHave = Math.min(maxSlots, 12);
        
        if (station.officers.length < slotsToHave) {
             while (station.officers.length < slotsToHave) {
                station.officers.push({ slotId: station.officers.length + 1, assignedOfficerId: null });
             }
        }

        // --- ACHIEVEMENTS: SOL LEVEL PROGRESSION HOOKS ---
        if (this.timeService && this.timeService.simulationService && this.timeService.simulationService.achievementService) {
            this.timeService.simulationService.achievementService.increment('peakSolLevel', station.level, true);
            this.timeService.simulationService.achievementService.increment('peakSolLevel50', station.level, true);
        }
        
        this.logger.info.system('SolStation', this.gameState.day, 'LEVEL_UP', `Sol Station upgraded to Level ${station.level}!`);
    }

    // --- LOAD BEARING OFFICER MANAGEMENT ---

    validateUnslotOfficer(slotId) {
        const station = this.gameState.solStation;
        const slotIndex = station.officers.findIndex(s => s.slotId === parseInt(slotId));
        
        if (slotIndex === -1 || !station.officers[slotIndex].assignedOfficerId) {
            return { safe: true, ventedCargo: {}, netEntropyChange: 0 };
        }

        const currentOfficerBuffs = this._calculateOfficerBuffs(station.officers);
        const levelBuffs = this._calculateLevelBuffs(station.level || 1);
        
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
                isSafe = false; 
            }
        });

        if (netEntropyChange >= 0.1) {
            isSafe = false;
        }

        return { safe: isSafe, ventedCargo, netEntropyChange };
    }

    assignOfficer(slotId, officerId, force = false) {
        this._syncTime();

        const station = this.gameState.solStation;
        const slotIndex = station.officers.findIndex(s => s.slotId === parseInt(slotId));
        
        if (slotIndex === -1) return { success: false, message: "Invalid slot." };

        if (!officerId && !force) {
            const validation = this.validateUnslotOfficer(slotId);
            if (!validation.safe) {
                return { success: false, requiresConfirmation: true, payload: validation };
            }
        }

        station.officers[slotIndex].assignedOfficerId = officerId;
        
        if (!officerId) {
            const levelBuffs = this._calculateLevelBuffs(station.level || 1);
            const officerBuffs = this._calculateOfficerBuffs(station.officers);
            
            Object.entries(station.caches).forEach(([id, c]) => {
                const baseMax = c.baseMax || LEVEL_1_BASELINE.baseCapacity[id] || 100;
                const newMax = baseMax + (levelBuffs.capacityMods[id] || 0) + (officerBuffs.capacityMods[id] || 0);
                c.max = newMax;
                if (c.current > newMax) {
                    c.current = newMax; 
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