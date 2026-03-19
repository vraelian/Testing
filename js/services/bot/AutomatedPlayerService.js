// js/services/bot/AutomatedPlayerService.js
/**
 * @fileoverview This file contains the AutomatedPlayer class.
 * This bot is designed to stress-test the in-game economy by simulating
 * an advanced player who actively participates in market manipulation.
 * It operates as a state machine, forming long-term plans to crash
 * markets and exploit those self-created opportunities.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, LOCATION_IDS, PERK_IDS } from '../../data/constants.js';
import { calculateInventoryUsed, formatCredits } from '../../utils.js';

/**
 * Defines the operational states for the bot's state machine.
 * @enum {string}
 */
const BotState = {
    IDLE: 'IDLE',                                 // Bot is deciding what to do next.
    MAINTENANCE: 'MAINTENANCE',                   // Bot is refueling or repairing.
    SELLING_HELD_CARGO: 'SELLING_HELD_CARGO',     // Bot is selling cargo it's already holding.
    SEEKING_MANIPULATION: 'SEEKING_MANIPULATION', // Bot is actively looking for a new market to crash.
    PREPARING_CRASH: 'PREPARING_CRASH',           // Bot is traveling and buying goods in preparation for a crash.
    EXECUTING_CRASH: 'EXECUTING_CRASH',           // Bot is at the target market, selling goods to crash the price.
    EXECUTING_EXPLOIT: 'EXECUTING_EXPLOIT',       // Bot is exploiting a known crashed market (self-created or found).
    SELLING_EXPLOITED_GOODS: 'SELLING_EXPLOITED_GOODS', // Bot is selling goods bought at an exploited price.
    TIME_WASTER: 'TIME_WASTER',                   // Bot is running a simple A-B trade to pass time.
    
    // Depletion Strategy States
    SEEKING_DEPLETION: 'SEEKING_DEPLETION',       // Bot is looking for a market to buy out.
    EXECUTING_DEPLETION: 'EXECUTING_DEPLETION',   // Bot is traveling to and buying out the market.
    WAITING_FOR_HIKE: 'WAITING_FOR_HIKE',         // Bot is passing time for the price hike to activate.
    EXPLOITING_HIKE: 'EXPLOITING_HIKE'            // Bot is buying from elsewhere to sell at the hiked price.
};

/**
 * Defines the bot's overarching strategy for a simulation run.
 * @enum {string}
 */
const BotStrategy = {
    MIXED: 'MIXED',               // Default: 75% Crash, 25% Depletion
    HONEST_TRADER: 'HONEST_TRADER', // Only runs simple A-B trades (TIME_WASTER state)
    MANIPULATOR: 'MANIPULATOR',   // Only runs the Crash/Exploit loop
    DEPLETE_ONLY: 'DEPLETE_ONLY',    // Only runs the Depletion/Exploit loop
    PROSPECTOR: 'PROSPECTOR'      // Tries Honest Trader first, falls back to Manipulator
};


/**
 * @class AutomatedPlayer
 * @description A state-driven bot that plays the game to stress-test the economy.
 */
export class AutomatedPlayer {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, simulationService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.logger = logger;

        this.isRunning = false;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        this.activeStrategy = BotStrategy.MIXED; // Default strategy
        this.MIN_PROFIT_MARGIN = 0.15; // PHASE 2: 15% minimum profit margin

        /**
         * @type {object | null}
         * @description Stores the bot's multi-step objective.
         */
        this.currentObjective = null;

        /**
         * @type {Array<object>}
         * @description The bot's "memory" of markets it has crashed.
         */
        this.plannedObjectives = [];
        
        /**
         * @type {object}
         * @description Tracks performance metrics for the summary report.
         */
        this.metrics = {
            totalTrades: 0,
            profitableTrades: 0,
            totalNetProfit: 0,
            totalFuelCost: 0,
            totalRepairCost: 0,
            daysSimulated: 0,
            profitByGood: {},
            objectivesStarted: 0,
            objectivesCompleted: 0,
            objectivesAborted: 0,
            strategyUsed: BotStrategy.MIXED
        };
        /** @type {number} */
        this.simulationStartDay = 0;
        this._lastUpkeepTotal = 0; 
    }

    /**
     * Starts the automated play simulation.
     */
    async runSimulation({ daysToRun, strategy }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('Bot', 'AUTOTRADER-01 is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        this.activeStrategy = strategy || BotStrategy.MIXED; 
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;
        
        this.simulationStartDay = startDay;
        this._lastUpkeepTotal = 0; // PHASE 3 Setup
        
        this.metrics = {
            totalTrades: 0,
            profitableTrades: 0,
            totalNetProfit: 0,
            totalFuelCost: 0,
            totalRepairCost: 0,
            daysSimulated: 0,
            profitByGood: {},
            objectivesStarted: 0,
            objectivesCompleted: 0,
            objectivesAborted: 0,
            strategyUsed: this.activeStrategy
        };

        this.logger.info.system('Bot', startDay, 'SIMULATION_START', `Starting advanced simulation for ${daysToRun} days using strategy: ${this.activeStrategy}.`);

        while (this.gameState.day < endDay && !this.stopRequested) {
            // --- 1. Execute State Logic ---
            await this._decideNextAction();

            // --- PHASE 3: TELEMETRY LOGGING (Macro-Progression) ---
            this._logEconTelemetry();

            // --- 2. Update UI & Pause ---
            updateCallback(this.gameState.day, endDay);
            await new Promise(resolve => setTimeout(resolve, 10)); // Tiny pause
        }

        // --- 3. Log Summary Report ---
        this._logSummaryReport();
        
        this.logger.info.system('Bot', this.gameState.day, 'SIMULATION_END', 'Simulation finished.');
        this.isRunning = false;
    }

    /**
     * Stops the currently running simulation.
     */
    stop() {
        this.stopRequested = true;
    }

    // --- STATE MACHINE & CORE LOGIC ---

    /**
     * The main state machine switch. Directs the bot's actions.
     * @private
     */
    async _decideNextAction() {
        if (this._handleAgeEventChoice()) return;

        if (this.botState !== BotState.MAINTENANCE && 
            (!this.currentObjective || this.currentObjective.type !== 'REFUEL_FOR_TRAVEL') &&
            this._needsMaintenance()) {
            this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Low resources detected. Switching to maintenance state.');
            this.botState = BotState.MAINTENANCE;
        }

        switch (this.botState) {
            case BotState.IDLE: await this._evaluateOpportunities(); break;
            case BotState.MAINTENANCE: await this._executeMaintenance(); break;
            case BotState.SELLING_HELD_CARGO: await this._executeSellHeldCargo(); break;
            case BotState.SEEKING_MANIPULATION: await this._findCrashOpportunity(); break;
            case BotState.PREPARING_CRASH: await this._executePreparation(); break;
            case BotState.EXECUTING_CRASH: await this._executeCrash(); break;
            case BotState.EXECUTING_EXPLOIT: await this._executeExploit(); break;
            case BotState.SELLING_EXPLOITED_GOODS: await this._executeSellExploited(); break;
            case BotState.TIME_WASTER: await this._executeTimeWaster(); break;
            case BotState.SEEKING_DEPLETION: await this._findDepletionOpportunity(); break;
            case BotState.EXECUTING_DEPLETION: await this._executeDepletion(); break;
            case BotState.WAITING_FOR_HIKE: await this._executeWait(); break;
            case BotState.EXPLOITING_HIKE: await this._executeExploitHike(); break;
        }
    }

    /**
     * [PHASE 3] Logs the bot's macro-progression footprint.
     * @private
     */
    _logEconTelemetry() {
        if (typeof window !== 'undefined' && window.__ECON_TELEMETRY__) {
            let fleetValue = 0;
            this.gameState.player.ownedShipIds.forEach(id => {
                 // Fallback to 10000 if basePrice isn't directly on the DB object
                 fleetValue += (DB.SHIPS[id]?.basePrice || 10000); 
            });

            // Calculate daily upkeep drain (delta of total tracked costs)
            const currentUpkeep = this.metrics.totalFuelCost + this.metrics.totalRepairCost;
            const dailyUpkeep = currentUpkeep - (this._lastUpkeepTotal || 0);
            this._lastUpkeepTotal = currentUpkeep;

            window.__ECON_TELEMETRY__.botProgression.push({
                day: this.gameState.day,
                locationId: this.gameState.currentLocationId,
                botState: this.botState,
                liquidCredits: this.gameState.player.credits,
                fleetValue: fleetValue,
                netWorth: this.gameState.player.credits + fleetValue,
                dailyUpkeepPaid: dailyUpkeep,
                totalNetProfit: this.metrics.totalNetProfit
            });
        }
    }

    /**
     * [State: IDLE]
     * Bot decides what to do based on its active strategy.
     * @private
     */
    async _evaluateOpportunities() {
        const heldCargoTrade = this._findBestSellLocationForHeldCargo();
        if (heldCargoTrade) {
            this.currentObjective = { type: 'SELL_HELD_CARGO', ...heldCargoTrade };
            this.botState = BotState.SELLING_HELD_CARGO;
            this.metrics.objectivesStarted++;
            return;
        }

        if (this.activeStrategy === BotStrategy.MIXED || this.activeStrategy === BotStrategy.MANIPULATOR) {
            const exploit = this._findReadySelfExploit();
            if (exploit) {
                this.currentObjective = exploit;
                this.botState = BotState.EXECUTING_EXPLOIT;
                this.metrics.objectivesStarted++;
                return;
            }
        }

        if (this.currentObjective) {
            if (this.currentObjective.type === 'CRASH' && this._isCrashPlanStillValid()) {
                this.botState = BotState.PREPARING_CRASH;
                return;
            } else if (this.currentObjective.type !== 'CRASH' && this.currentObjective.type !== 'SIMPLE_TRADE') {
                const goodIdToRevalidate = this.currentObjective.goodId;
                const validPlan = this._findCrashOpportunity(goodIdToRevalidate);
                if (validPlan && validPlan.goodId && validPlan.buyFromLocationId && validPlan.crashLocationId) {
                    this.currentObjective = validPlan;
                    this.botState = BotState.PREPARING_CRASH;
                    this.metrics.objectivesStarted++;
                    return;
                }
            }
        }
        
        this.currentObjective = null;

        switch (this.activeStrategy) {
            case BotStrategy.HONEST_TRADER:
                this.botState = BotState.TIME_WASTER; 
                break;
            case BotStrategy.MANIPULATOR:
                this.botState = BotState.SEEKING_MANIPULATION;
                break;
            case BotStrategy.DEPLETE_ONLY:
                this.botState = BotState.SEEKING_DEPLETION;
                break;
            case BotStrategy.PROSPECTOR:
                const simpleTrade = this._findBestSimpleTrade();
                if (simpleTrade) {
                    this.currentObjective = { ...simpleTrade, type: 'SIMPLE_TRADE', hasGoods: false };
                    this.botState = BotState.TIME_WASTER;
                    this.metrics.objectivesStarted++;
                } else {
                    this.botState = BotState.SEEKING_MANIPULATION;
                }
                break;
            case BotStrategy.MIXED:
            default:
                if (Math.random() < 0.25) {
                    this.botState = BotState.SEEKING_DEPLETION;
                } else {
                    this.botState = BotState.SEEKING_MANIPULATION;
                }
                break;
        }
    }

    /**
     * [State: MAINTENANCE]
     * @private
     */
    async _executeMaintenance() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) {
            this.botState = BotState.IDLE;
            return;
        }
        const shipState = this.gameState.player.shipStates[activeShip.id];

        if (this.currentObjective && this.currentObjective.type === 'REFUEL_FOR_TRAVEL') {
            const { needed, nextState, originalObjective } = this.currentObjective;

            if (needed > activeShip.maxFuel && shipState.fuel === activeShip.maxFuel) {
                this.currentObjective = null; 
                this.botState = BotState.IDLE; 
                this.metrics.objectivesAborted++; 
                return;
            }

            if (shipState.fuel < needed) {
                this._botRefuel(needed); 
                return; 
            } else {
                this.currentObjective = originalObjective; 
                this.botState = nextState; 
                return;
            }
        }

        const fuelPct = (shipState.fuel / activeShip.maxFuel) * 100;
        const healthPct = (shipState.health / activeShip.maxHealth) * 100;

        if (fuelPct < 30) {
            if (this.gameState.currentLocationId === LOCATION_IDS.JUPITER) {
                this._botRefuel(activeShip.maxFuel); 
            } else {
                const state = this.gameState.getState();
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][LOCATION_IDS.JUPITER];
                const fuelToJupiter = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                
                if (shipState.fuel < fuelToJupiter) {
                    this._botRefuel(fuelToJupiter + 5);
                } else {
                    this.simulationService.travelService.initiateTravel(LOCATION_IDS.JUPITER);
                }
            }
            return; 
        }

        if (healthPct < 30) {
            if (this.gameState.currentLocationId !== LOCATION_IDS.LUNA) {
                this.simulationService.travelService.initiateTravel(LOCATION_IDS.LUNA);
            } else {
                this._botRepair();
            }
            return;
        }

        this.botState = BotState.IDLE;
    }

    /**
     * [State: SELLING_HELD_CARGO]
     * @private
     */
    async _executeSellHeldCargo() {
        const { goodId, sellLocationId, quantity } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        if (state.currentLocationId !== sellLocationId) {
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5, 
                    nextState: BotState.SELLING_HELD_CARGO, 
                    originalObjective: originalObjective 
                };
                this.botState = BotState.MAINTENANCE; 
                return;
            }

            this.simulationService.travelService.initiateTravel(sellLocationId);
            return;
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;
            this.metrics.objectivesCompleted++;
        } else {
             this.metrics.objectivesAborted++;
        }

        this.currentObjective = null;
        this.botState = BotState.IDLE;
    }

    /**
     * [State: SEEKING_MANIPULATION]
     * @private
     */
    async _findCrashOpportunity(specificGoodId = null) {
        const state = this.gameState.getState();
        let availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier && c.tier > 1);
        
        if (specificGoodId) {
            availableCommodities = availableCommodities.filter(c => c.id === specificGoodId);
        }

        if (availableCommodities.length === 0) {
            if (!specificGoodId) this.botState = BotState.TIME_WASTER;
            return null;
        }

        let top5Plans = [];

        for (const good of availableCommodities) {
            const buyLocation = this._findCheapestMarket(good.id);
            if (!buyLocation) continue;

            const crashLocation = this._findBestCrashTarget(good.id, buyLocation.id);
            if (!crashLocation) continue;
            
            const potential = good.tier * (crashLocation.price - buyLocation.price);
            
            if (potential > 0) {
                top5Plans.push({
                    potential,
                    plan: {
                        type: 'CRASH',
                        goodId: good.id,
                        buyFromLocationId: buyLocation.id,
                        crashLocationId: crashLocation.id,
                    }
                });
            }
        }

        if (top5Plans.length > 0) {
            top5Plans.sort((a, b) => b.potential - a.potential);
            const bestPlans = top5Plans.slice(0, 5).map(p => p.plan);
            const chosenPlan = bestPlans[Math.floor(Math.random() * bestPlans.length)];
            
            if (specificGoodId) return chosenPlan; 

            this.currentObjective = chosenPlan;
            this.botState = BotState.PREPARING_CRASH;
            this.metrics.objectivesStarted++;
        } else {
            if (!specificGoodId) this.botState = BotState.TIME_WASTER;
            return null;
        }
    }

    /**
     * [State: PREPARING_CRASH]
     * @private
     */
    async _executePreparation() {
        const { goodId, buyFromLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== buyFromLocationId) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyFromLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective; 
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5, 
                    nextState: BotState.PREPARING_CRASH, 
                    originalObjective: originalObjective 
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            
            this.simulationService.travelService.initiateTravel(buyFromLocationId);
            return; 
        }

        const price = state.market.prices[buyFromLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);
        if (buyQty > 0) {
            this.simulationService.playerActionService.buyItem(goodId, buyQty);
            this.botState = BotState.EXECUTING_CRASH;
        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
    }

    /**
     * [State: EXECUTING_CRASH]
     * @private
     */
    async _executeCrash() {
        const { goodId, crashLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== crashLocationId) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][crashLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective; 
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_CRASH, 
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }

            this.simulationService.travelService.initiateTravel(crashLocationId);
            return; 
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);
            
            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

            const inventoryItem = this.gameState.market.inventory[crashLocationId][goodId];
            this.plannedObjectives.push({
                goodId: goodId,
                locationId: crashLocationId,
                priceLockEndDay: inventoryItem.priceLockEndDay,
                crashedOnDay: this.gameState.day,
            });

            this.currentObjective.type = 'EXPLOIT';
            this.currentObjective.exploitLocationId = this.currentObjective.crashLocationId;
            delete this.currentObjective.buyFromLocationId;
            delete this.currentObjective.crashLocationId;

            this.botState = BotState.EXECUTING_EXPLOIT;
        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
    }

    /**
     * [State: EXECUTING_EXPLOIT]
     * @private
     */
    async _executeExploit() {
        const { goodId, exploitLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== exploitLocationId) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][exploitLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective; 
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_EXPLOIT, 
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }

            this.simulationService.travelService.initiateTravel(exploitLocationId);
            return;
        }

        const price = state.market.prices[exploitLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);

        if (buyQty > 0) {
            this.simulationService.playerActionService.buyItem(goodId, buyQty);
            const sellLocation = this._findBestSellLocation(goodId, exploitLocationId);

            if (sellLocation) {
                this.currentObjective.type = 'SELL_EXPLOITED';
                this.currentObjective.sellToLocationId = sellLocation.id; 
                this.botState = BotState.SELLING_EXPLOITED_GOODS;
            } else {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
            }

        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }

        this.plannedObjectives = this.plannedObjectives.filter(obj => !(obj.goodId === goodId && obj.locationId === exploitLocationId));
    }

    /**
     * [State: SELLING_EXPLOITED_GOODS]
     * @private
     */
    async _executeSellExploited() {
        const { goodId, sellToLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== sellToLocationId) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellToLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective; 
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.SELLING_EXPLOITED_GOODS, 
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }

            this.simulationService.travelService.initiateTravel(sellToLocationId);
            return;
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

        }

        this.botState = BotState.IDLE;
        this.metrics.objectivesCompleted++;
    }


    /**
     * [State: TIME_WASTER]
     * @private
     */
    async _executeTimeWaster() {
        if (!this.currentObjective || this.currentObjective.type !== 'SIMPLE_TRADE') {
            const simpleTrade = this._findBestSimpleTrade();
            if (simpleTrade) {
                this.currentObjective = { ...simpleTrade, type: 'SIMPLE_TRADE', hasGoods: false };
                this.metrics.objectivesStarted++;
            } else {
                this.simulationService.timeService.advanceDays(1);
                this.botState = BotState.IDLE;
                return;
            }
        }

        const { goodId, buyLocationId, sellLocationId, buyPrice, hasGoods } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        if (!hasGoods) {
            if (state.currentLocationId !== buyLocationId) {
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                
                if (activeShip.fuel < requiredFuel) {
                    const originalObjective = this.currentObjective;
                    this.currentObjective = {
                        type: 'REFUEL_FOR_TRAVEL',
                        needed: requiredFuel + 5,
                        nextState: BotState.TIME_WASTER,
                        originalObjective: originalObjective
                    };
                    this.botState = BotState.MAINTENANCE;
                    return;
                }
                this.simulationService.travelService.initiateTravel(buyLocationId);
                return;
            }
            
            const currentStock = state.market.inventory[state.currentLocationId][goodId].quantity;
            if (currentStock <= 0) {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }
            
            const buyQty = this._calculateMaxBuy(goodId, buyPrice);
            if (buyQty > 0) {
                this.simulationService.playerActionService.buyItem(goodId, buyQty);
                this.currentObjective.hasGoods = true; 
            } else {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }
        }

        if (this.currentObjective.hasGoods) {
            if (state.currentLocationId !== sellLocationId) {
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

                if (activeShip.fuel < requiredFuel) {
                    const originalObjective = this.currentObjective;
                    this.currentObjective = {
                        type: 'REFUEL_FOR_TRAVEL',
                        needed: requiredFuel + 5,
                        nextState: BotState.TIME_WASTER,
                        originalObjective: originalObjective
                    };
                    this.botState = BotState.MAINTENANCE;
                    return;
                }
                this.simulationService.travelService.initiateTravel(sellLocationId);
                return;
            }
            
            const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
            if (sellQty > 0) {
                const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
                const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
                const profit = saleValue - (avgCost * sellQty);
                
                this.metrics.totalTrades++;
                this.metrics.totalNetProfit += profit;
                if (profit > 0) this.metrics.profitableTrades++;
                if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
                this.metrics.profitByGood[goodId] += profit;
                this.metrics.objectivesCompleted++;
            } else {
                this.metrics.objectivesAborted++;
            }

            this.currentObjective = null;
            this.botState = BotState.IDLE;
        }
    }

    /**
     * [State: SEEKING_DEPLETION]
     * @private
     */
    async _findDepletionOpportunity() {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        if (!ship) {
            this.botState = BotState.IDLE;
            return;
        }
        
        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier && c.tier > 1);
        let top5Plans = [];

        for (const good of availableCommodities) {
            for (const location of DB.MARKETS) {
                if (!state.player.unlockedLocationIds.includes(location.id)) continue;

                const inventoryItem = state.market.inventory[location.id][good.id];
                
                if (state.day <= (inventoryItem.depletionBonusDay + 365)) continue;

                const [minAvail, maxAvail] = good.canonicalAvailability;
                const modifier = location.availabilityModifier?.[good.id] ?? 1.0;
                const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
                let pressureForAdaptation = inventoryItem.marketPressure;
                if (pressureForAdaptation > 0) pressureForAdaptation = 0;
                const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
                const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor);
                const depletionThreshold = targetStock * 0.08;

                const stock = inventoryItem.quantity;
                const price = state.market.prices[location.id][good.id];
                
                if (stock >= depletionThreshold && 
                    state.player.credits >= (stock * price) &&
                    ship.cargoCapacity >= stock) {
                    
                    top5Plans.push({
                        potential: good.tier * stock,
                        plan: {
                            type: 'DEPLETE',
                            goodId: good.id,
                            locationId: location.id,
                            amountToBuy: stock
                        }
                    });
                }
            }
        }

        if (top5Plans.length > 0) {
            top5Plans.sort((a, b) => b.potential - a.potential);
            const bestPlans = top5Plans.slice(0, 5).map(p => p.plan);
            const chosenPlan = bestPlans[Math.floor(Math.random() * bestPlans.length)];

            this.currentObjective = chosenPlan;
            this.botState = BotState.EXECUTING_DEPLETION;
            this.metrics.objectivesStarted++;
        } else {
            if (this.activeStrategy === BotStrategy.DEPLETE_ONLY) {
                this.simulationService.timeService.advanceDays(1);
                this.botState = BotState.IDLE; 
            } else {
                this.botState = BotState.SEEKING_MANIPULATION;
            }
        }
    }

    /**
     * [State: EXECUTING_DEPLETION]
     * @private
     */
    async _executeDepletion() {
        const { goodId, locationId, amountToBuy } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== locationId) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_DEPLETION,
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }

            this.simulationService.travelService.initiateTravel(locationId);
            return;
        }

        const boughtQty = this.simulationService.playerActionService.buyItem(goodId, amountToBuy);
        if (!boughtQty || boughtQty < amountToBuy) {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }

        const sellLocation = this._findBestSellLocation(goodId, locationId);
        if (sellLocation) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocation.id];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_DEPLETION, 
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            
            this.simulationService.travelService.initiateTravel(sellLocation.id);
            return;
        }

        this.currentObjective.waitStartDay = this.gameState.day;
        this.botState = BotState.WAITING_FOR_HIKE;
    }

    /**
     * [State: WAITING_FOR_HIKE]
     * @private
     */
    async _executeWait() {
        if (this.gameState.day > this.currentObjective.waitStartDay + 7) {
            this.botState = BotState.EXPLOITING_HIKE;
            this.currentObjective.exploitRuns = 0; 
        } else {
            this.simulationService.timeService.advanceDays(1);
            this.botState = BotState.WAITING_FOR_HIKE; 
        }
    }

    /**
     * [State: EXPLOITING_HIKE]
     * @private
     */
    async _executeExploitHike() {
        const { goodId, locationId } = this.currentObjective; 
        const state = this.gameState.getState();

        const buyLocation = this._findCheapestMarket(goodId);
        if (!buyLocation || buyLocation.id === locationId) {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }
        
        if (state.currentLocationId !== buyLocation.id) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyLocation.id];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXPLOITING_HIKE,
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            this.simulationService.travelService.initiateTravel(buyLocation.id);
            return;
        }
        
        const buyQty = this._calculateMaxBuy(goodId, buyLocation.price);
        if (buyQty > 0) this.simulationService.playerActionService.buyItem(goodId, buyQty);
        
        if (state.currentLocationId !== locationId) {
             const activeShip = this.simulationService._getActiveShip();
             const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
             const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
             if (activeShip.fuel < requiredFuel) {
                 const originalObjective = this.currentObjective;
                 this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXPLOITING_HIKE,
                    originalObjective: originalObjective
                 };
                 this.botState = BotState.MAINTENANCE;
                 return;
             }
            this.simulationService.travelService.initiateTravel(locationId);
            return;
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        
        const hikedStock = state.market.inventory[locationId][goodId].quantity;
        if (sellQty > 0 && hikedStock > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

        } else if (sellQty > 0 && hikedStock <= 0) {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }

        this.currentObjective.exploitRuns++;
        const inventoryItem = state.market.inventory[locationId][goodId];
        if (this.currentObjective.exploitRuns < 2 && state.day < (inventoryItem.depletionDay + 7)) {
            this.botState = BotState.EXPLOITING_HIKE;
        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesCompleted++;
        }
    }


    // --- "BRAIN" HELPER FUNCTIONS ---

    /**
     * Checks if the bot's current `CRASH` objective is still profitable.
     * @private
     */
    _isCrashPlanStillValid() {
        if (!this.currentObjective || this.currentObjective.type !== 'CRASH') {
            return false;
        }
        const { goodId, buyFromLocationId, crashLocationId } = this.currentObjective;
        
        if (!goodId || !buyFromLocationId || !crashLocationId) {
            return false;
        }

        const state = this.gameState.getState();
        const buyPrice = state.market.prices[buyFromLocationId][goodId];
        const sellPrice = state.market.prices[crashLocationId][goodId];
        return (sellPrice - buyPrice) > 0;
    }

    /**
     * Finds markets that the bot *itself* has crashed and are ready to exploit.
     * @returns {object | null} An exploit objective, or null.
     * @private
     */
    _findReadySelfExploit() {
        const state = this.gameState.getState();

        this.plannedObjectives = this.plannedObjectives.filter(obj => obj.priceLockEndDay > state.day); 
        for (const obj of this.plannedObjectives) {
            if (state.day > obj.crashedOnDay + 7) {
                const stock = state.market.inventory[obj.locationId][obj.goodId].quantity;
                if (stock > 10) { 
                    return { type: 'EXPLOIT', goodId: obj.goodId, exploitLocationId: obj.locationId };
                }
            }
        }
        return null;
    }

    /**
     * [BRAIN] Finds the best place to sell any cargo the bot is currently holding.
     * @returns {object | null} A trade objective, or null if no profitable sale is found.
     * @private
     */
    _findBestSellLocationForHeldCargo() {
        const state = this.gameState.getState();
        const inventory = this.simulationService._getActiveInventory();
        if (!inventory) return null;

        let bestSale = null;
        let maxProfit = 0;

        for (const goodId in inventory) {
            const item = inventory[goodId];
            if (item && item.quantity > 0) {
                const avgCost = item.avgCost;
                const quantity = item.quantity;
                
                const sellLocation = this._findBestSellLocation(goodId, state.currentLocationId);
                
                if (sellLocation) {
                    const potentialProfit = (sellLocation.price - avgCost) * quantity;
                    
                    if (potentialProfit > maxProfit) {
                        maxProfit = potentialProfit;
                        bestSale = {
                            goodId: goodId,
                            quantity: quantity,
                            avgCost: avgCost,
                            sellLocationId: sellLocation.id,
                            sellPrice: sellLocation.price,
                            estimatedProfit: potentialProfit
                        };
                    }
                }
            }
        }
        
        return (bestSale && bestSale.estimatedProfit > 0) ? bestSale : null;
    }

    /**
     * Finds the absolute cheapest market to buy a specific good.
     * @private
     */
    _findCheapestMarket(goodId) {
        const state = this.gameState.getState();
        let bestBuy = null;
        let minPrice = Infinity;

        for (const location of DB.MARKETS) {
            if (!state.player.unlockedLocationIds.includes(location.id)) continue;
            const price = state.market.prices[location.id][goodId];
            if (price < minPrice && state.market.inventory[location.id][goodId].quantity > 0) {
                minPrice = price;
                bestBuy = { id: location.id, price: price };
            }
        }
        return bestBuy;
    }

    /**
     * Finds the best market to *sell* a good at.
     * This means the highest price, excluding the current location.
     * @private
     */
    _findBestSellLocation(goodId, currentLocationId) {
        const state = this.gameState.getState();
        let bestSell = null;
        let maxPrice = -Infinity;

        for (const location of DB.MARKETS) {
            if (location.id === currentLocationId || !state.player.unlockedLocationIds.includes(location.id)) continue;
            
            const stock = state.market.inventory[location.id][goodId].quantity;
            const price = state.market.prices[location.id][goodId];
            if (price > maxPrice && stock > 0) {
                maxPrice = price;
                bestSell = { id: location.id, price: price };
            }
        }
        return bestSell;
    }


    /**
     * Finds the best market to *sell* a good at *for the purpose of crashing it*.
     * This means an exporter (low modifier) that isn't the place we're buying from.
     * @private
     */
    _findBestCrashTarget(goodId, buyLocationId) {
        const state = this.gameState.getState();
        let bestTarget = null;
        let bestModifier = Infinity; 

        for (const location of DB.MARKETS) {
            if (location.id === buyLocationId || !state.player.unlockedLocationIds.includes(location.id)) continue;

            const modifier = location.availabilityModifier?.[goodId] ?? 1.0;
            const price = state.market.prices[location.id][goodId];
            if (price < bestModifier) {
                bestModifier = price;
                bestTarget = { id: location.id, price: price };
            }
        }
        return bestTarget;
    }

    /**
     * Finds the best simple A-B (non-manipulation) trade route.
     * @private
     */
    _findBestSimpleTrade() {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return null; 
        
        const cargoCapacity = activeShip.cargoCapacity;
        if (cargoCapacity <= 0) return null; 

        let bestTrade = null;
        let maxProfitPerDay = 0;

        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier);
        const inventory = this.simulationService._getActiveInventory();

        for (const good of availableCommodities) {
            if (inventory[good.id] && inventory[good.id].quantity > 0) {
                continue;
            }

            for (const buyLocation of DB.MARKETS) {
                if (!state.player.unlockedLocationIds.includes(buyLocation.id)) continue;

                const buyStock = state.market.inventory[buyLocation.id][good.id].quantity;
                if (buyStock <= 0) {
                    continue; 
                }

                for (const sellLocation of DB.MARKETS) {
                    if (buyLocation.id === sellLocation.id || !state.player.unlockedLocationIds.includes(sellLocation.id)) continue;

                    const sellStock = state.market.inventory[sellLocation.id][good.id].quantity;
                    if (sellStock <= 0) {
                        continue;
                    }

                    const buyPrice = state.market.prices[buyLocation.id][good.id];
                    const sellPrice = state.market.prices[sellLocation.id][good.id];
                    const profitPerUnit = sellPrice - buyPrice;

                    const profitMargin = (buyPrice > 0) ? (profitPerUnit / buyPrice) : 0;

                    if (profitPerUnit > 0 && profitMargin > this.MIN_PROFIT_MARGIN) {
                        const travelTimeToBuy = state.TRAVEL_DATA[state.currentLocationId]?.[buyLocation.id]?.time || 0;
                        const travelTimeToSell = state.TRAVEL_DATA[buyLocation.id]?.[sellLocation.id]?.time || 0;
                        
                        if (travelTimeToSell === 0) continue; 
                        
                        const totalTime = travelTimeToBuy + travelTimeToSell + 2; 

                        const buyQty = Math.min(cargoCapacity, buyStock);
                        const totalTripProfit = profitPerUnit * buyQty;
                        const profitPerDay = totalTripProfit / totalTime;

                        if (profitPerDay > maxProfitPerDay) {
                            maxProfitPerDay = profitPerDay;
                            bestTrade = {
                                goodId: good.id,
                                buyLocationId: buyLocation.id,
                                sellLocationId: sellLocation.id,
                                buyPrice,
                                sellPrice,
                                profitPerUnit,
                                estimatedPPD: profitPerDay
                            };
                        }
                    }
                }
            }
        }
        return bestTrade;
    }

    /**
     * Handles pop-up modals, specifically Age Events.
     * @returns {boolean} True if a modal was handled, false otherwise.
     * @private
     */
    _handleAgeEventChoice() {
        const modal = document.getElementById('age-event-modal');
        if (!modal || modal.classList.contains('hidden')) {
            return false; 
        }

        const title = document.getElementById('age-event-title').textContent;

        const buttons = Array.from(modal.querySelectorAll('button'));
        if (buttons.length === 0) {
            return false; 
        }

        const profitKeywords = ['trademaster', 'merchant\'s guild', 'free ship', 'credits', 'profit'];
        const neutralKeywords = ['continue', 'ignore', 'dismiss', 'accept'];
        
        let chosenButton = null;

        for (const btn of buttons) {
            const btnText = btn.textContent.toLowerCase();
            if (profitKeywords.some(kw => btnText.includes(kw))) {
                chosenButton = btn;
                break;
            }
        }

        if (!chosenButton) {
             for (const btn of buttons) {
                const btnText = btn.textContent.toLowerCase();
                if (neutralKeywords.some(kw => btnText.includes(kw))) {
                    chosenButton = btn;
                    break;
                }
            }
        }
        
        if (!chosenButton) {
            chosenButton = buttons[0];
        }
        
        chosenButton.click();
        return true;
    }
    
    /**
     * Logs a summary report of the bot's performance to the console and game log.
     * @private
     */
    _logSummaryReport() {
        this.metrics.daysSimulated = this.gameState.day - this.simulationStartDay;
        const { 
            totalTrades, profitableTrades, totalNetProfit, totalFuelCost, 
            totalRepairCost, daysSimulated, strategyUsed, objectivesStarted,
            objectivesCompleted, objectivesAborted, profitByGood
        } = this.metrics;
        
        const profitPct = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : 0;
        const profitPerDay = daysSimulated > 0 ? (totalNetProfit / daysSimulated) : 0;

        const header = '=== AUTO-TRADER PERFORMANCE SUMMARY ===';
        console.log(header);
        
        const summary = [
            `Strategy Run: ${strategyUsed}`,
            `Days Simulated: ${daysSimulated}`,
            `Final Credit Balance: ${formatCredits(this.gameState.player.credits)}`,
            ``,
            `--- Performance ---`,
            `Total Net Profit: ${formatCredits(totalNetProfit)}`,
            `Profit Per Day: ${formatCredits(profitPerDay)}`,
            `Objectives (Started/Completed/Aborted): ${objectivesStarted} / ${objectivesCompleted} / ${objectivesAborted}`,
            `Total Trades Completed: ${totalTrades}`,
            `Profitable Trades: ${profitableTrades} (${profitPct}%)`,
            ``,
            `--- Costs ---`,
            `Total Fuel Costs: ${formatCredits(totalFuelCost)}`,
            `Total Repair Costs: ${formatCredits(totalRepairCost)}`,
        ];

        for (const line of summary) {
            console.log(line);
        }

        const profitHeader = `--- Profit Breakdown by Commodity ---`;
        console.log(profitHeader);
        
        const sortedGoods = Object.keys(profitByGood).sort((a, b) => profitByGood[b] - profitByGood[a]);
        if (sortedGoods.length === 0) {
             console.log(`No commodity trades recorded.`);
        } else {
            for (const goodId of sortedGoods) {
                const profit = profitByGood[goodId];
                const commodityName = DB.COMMODITIES.find(c => c.id === goodId)?.name || goodId;
                console.log(`${commodityName}: ${formatCredits(profit)}`);
            }
        }
        
        console.log('=======================================');
    }

    // --- UTILITY FUNCTIONS (Moved from DebugService) ---

    /**
     * Checks if fuel or health are low (general threshold).
     * @returns {boolean} True if maintenance is needed.
     * @private
     */
    _needsMaintenance() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return false;

        const fuelPct = (this.gameState.player.shipStates[activeShip.id].fuel / activeShip.maxFuel) * 100;
        const healthPct = (this.gameState.player.shipStates[activeShip.id].health / activeShip.maxHealth) * 100;

        return fuelPct < 30 || healthPct < 30;
    }

    /**
     * @param {number | null} targetFuelAmount - The amount of fuel to buy. If null, fills the tank.
     * @private
     */
    _botRefuel(targetFuelAmount = null) {
        const ship = this.simulationService._getActiveShip();
        if (!ship) return;
        
        const finalTargetFuel = targetFuelAmount === null ? ship.maxFuel : Math.min(ship.maxFuel, targetFuelAmount);
        const fuelNeeded = finalTargetFuel - this.gameState.player.shipStates[ship.id].fuel;
        
        if (fuelNeeded <= 0) return;
        
        const currentMarket = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        let fuelPrice = currentMarket.fuelPrice / 2; // Base cost
        
        if (this.gameState.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && this.gameState.currentLocationId === LOCATION_IDS.VENUS) {
             fuelPrice *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        fuelPrice = Math.max(1, Math.round(fuelPrice));

        const ticksNeeded = Math.ceil(fuelNeeded / 5); 
        const totalCost = ticksNeeded * fuelPrice;
        const fuelToBuy = ticksNeeded * 5;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].fuel = Math.min(ship.maxFuel, this.gameState.player.shipStates[ship.id].fuel + fuelToBuy);
            this.simulationService._logConsolidatedTransaction('fuel', -totalCost, 'Fuel Purchase');
            this.metrics.totalFuelCost += totalCost;
        } else {
            const affordableTicks = Math.floor(this.gameState.player.credits / fuelPrice);
            if (affordableTicks > 0) {
                const cost = affordableTicks * fuelPrice;
                this.gameState.player.credits -= cost;
                this.gameState.player.shipStates[ship.id].fuel += (affordableTicks * 5);
                this.simulationService._logConsolidatedTransaction('fuel', -cost, 'Fuel Purchase');
                this.metrics.totalFuelCost += cost;
            }
        }
    }

    /**
     * @private
     */
    _botRepair() {
        const ship = this.simulationService._getActiveShip();
        if (!ship) return;
        const healthNeeded = ship.maxHealth - this.gameState.player.shipStates[ship.id].health;
        if (healthNeeded <= 0) return;
        
        const repairAmountPerTick = ship.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100);
        let costPerTick = repairAmountPerTick * GAME_RULES.REPAIR_COST_PER_HP;
        
        if (this.gameState.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && this.gameState.currentLocationId === LOCATION_IDS.VENUS) {
             costPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }
        costPerTick = Math.max(1, Math.round(costPerTick));

        const ticksNeeded = Math.ceil(healthNeeded / repairAmountPerTick);
        const totalCost = ticksNeeded * costPerTick;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].health = ship.maxHealth;
            this.simulationService._logConsolidatedTransaction('repair', -totalCost, 'Hull Repairs');
            this.metrics.totalRepairCost += totalCost;
        } else {
            const affordableTicks = Math.floor(this.gameState.player.credits / costPerTick);
            if (affordableTicks > 0) {
                const cost = affordableTicks * costPerTick;
                this.gameState.player.credits -= cost;
                this.gameState.player.shipStates[ship.id].health += (affordableTicks * repairAmountPerTick);
                this.simulationService._logConsolidatedTransaction('repair', -cost, 'Hull Repairs');
                this.metrics.totalRepairCost += cost;
            }
        }
    }

    /**
     * @private
     */
    _calculateMaxBuy(goodId, price) {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!ship || !inventory) return 0; 
        
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        const canAfford = (price > 0) ? Math.floor(state.player.credits / price) : Infinity;
        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
        return Math.max(0, Math.min(space, canAfford, stock));
    }
}