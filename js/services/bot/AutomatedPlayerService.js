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
         * Example:
         * {
         * type: 'CRASH',
         * goodId: 'plasteel',
         * buyFromLocationId: 'moon', // Location B (prep)
         * crashLocationId: 'mars'  // Location A (crash)
         * }
         * {
         * type: 'REFUEL_FOR_TRAVEL',
         * needed: 350,
         * nextState: BotState.PREPARING_CRASH,
         * originalObjective: { ... }
         * }
         */
        this.currentObjective = null;

        /**
         * @type {Array<object>}
         * @description The bot's "memory" of markets it has crashed.
         * Example: { goodId: 'plasteel', locationId: 'mars', priceLockEndDay: 450 }
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
    }

    /**
     * Starts the automated play simulation.
     * @param {object} config - Configuration for the simulation run.
     * @param {number} config.daysToRun - The number of in-game days to simulate.
     * @param {string} [config.strategy] - The strategy for the bot to use.
     * @param {function} updateCallback - A function to call with progress updates.
     */
    async runSimulation({ daysToRun, strategy }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('Bot', 'AUTOTRADER-01 is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        this.activeStrategy = strategy || BotStrategy.MIXED; // Set strategy for this run
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;
        
        // Reset metrics for new run
        this.simulationStartDay = startDay;
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
        // --- 0. Handle Popup Modals (like Age Events) ---
        if (this._handleAgeEventChoice()) {
            return; // An event was handled, stop this tick
        }

        // --- 1. Handle Proactive Maintenance ---
        // This check runs *before* the state switch to interrupt any state
        // if maintenance becomes necessary.
        // It does NOT catch "stranded" scenarios, which are handled by pre-flight checks.
        if (this.botState !== BotState.MAINTENANCE && 
            (!this.currentObjective || this.currentObjective.type !== 'REFUEL_FOR_TRAVEL') &&
            this._needsMaintenance()) {
            this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Low resources detected. Switching to maintenance state.');
            this.botState = BotState.MAINTENANCE;
        }

        // --- 2. Execute State Logic ---
        switch (this.botState) {
            case BotState.IDLE:
                await this._evaluateOpportunities();
                break;
            case BotState.MAINTENANCE:
                await this._executeMaintenance();
                break;
            case BotState.SELLING_HELD_CARGO:
                await this._executeSellHeldCargo();
                break;
            case BotState.SEEKING_MANIPULATION:
                await this._findCrashOpportunity();
                break;
            case BotState.PREPARING_CRASH:
                await this._executePreparation();
                break;
            case BotState.EXECUTING_CRASH:
                await this._executeCrash();
                break;
            case BotState.EXECUTING_EXPLOIT:
                await this._executeExploit();
                break;
            case BotState.SELLING_EXPLOITED_GOODS:
                await this._executeSellExploited();
                break;
            case BotState.TIME_WASTER:
                await this._executeTimeWaster();
                break;
            
            // Depletion Strategy
            case BotState.SEEKING_DEPLETION:
                await this._findDepletionOpportunity();
                break;
            case BotState.EXECUTING_DEPLETION:
                await this._executeDepletion();
                break;
            case BotState.WAITING_FOR_HIKE:
                await this._executeWait();
                break;
            case BotState.EXPLOITING_HIKE:
                await this._executeExploitHike();
                break;
        }
    }

    /**
     * [State: IDLE]
     * Bot decides what to do based on its active strategy.
     * @private
     */
    async _evaluateOpportunities() {
        // --- PHASE 1 REFACTOR: Prioritize selling held cargo ---
        const heldCargoTrade = this._findBestSellLocationForHeldCargo();
        if (heldCargoTrade) {
            this.currentObjective = {
                type: 'SELL_HELD_CARGO',
                ...heldCargoTrade
            };
            this.botState = BotState.SELLING_HELD_CARGO;
            this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[HELD CARGO]: Found profitable sale for ${heldCargoTrade.quantity}x ${heldCargoTrade.goodId} @ ${heldCargoTrade.sellLocationId}. Profit: ${formatCredits(heldCargoTrade.estimatedProfit)}.`);
            this.metrics.objectivesStarted++;
            return;
        }
        // --- END REFACTOR ---

        // 1. Check for ready-to-exploit self-crashed markets
        // (Only if strategy allows manipulation)
        if (this.activeStrategy === BotStrategy.MIXED || this.activeStrategy === BotStrategy.MANIPULATOR) {
            const exploit = this._findReadySelfExploit();
            if (exploit) {
                this.currentObjective = exploit;
                this.botState = BotState.EXECUTING_EXPLOIT;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Found self-created exploit: Buy ${exploit.goodId} @ ${exploit.exploitLocationId}`);
                this.metrics.objectivesStarted++;
                return;
            }
        }

        // 2. Check for persistent objective
        if (this.currentObjective) {
            // Check if the old plan is still valid
            if (this.currentObjective.type === 'CRASH' && this._isCrashPlanStillValid()) {
                // Stick to the plan
                this.botState = BotState.PREPARING_CRASH;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Continuing persistent CRASH loop for ${this.currentObjective.goodId}.`);
                // Note: This is a continuation, not a new objective
                return;
            } else if (this.currentObjective.type !== 'CRASH' && this.currentObjective.type !== 'SIMPLE_TRADE') {
                // This means we just finished an EXPLOIT or SELL_EXPLOITED
                // We need to re-validate the original crash plan
                const goodIdToRevalidate = this.currentObjective.goodId; // Store goodId
                
                // --- PHASE 1 FIX: Check that the returned plan is fully valid ---
                const validPlan = this._findCrashOpportunity(goodIdToRevalidate);
                
                // Check for a complete, valid plan object, not just a truthy value.
                if (validPlan && validPlan.goodId && validPlan.buyFromLocationId && validPlan.crashLocationId) {
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Re-validating and repeating CRASH loop for ${validPlan.goodId}.`);
                    this.currentObjective = validPlan;
                    this.botState = BotState.PREPARING_CRASH;
                    this.metrics.objectivesStarted++;
                    return;
                } else {
                     this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Failed to re-validate loop for ${goodIdToRevalidate}. Plan is no longer viable.`);
                     // Do not proceed, fall through to finding a new objective
                }
                // --- END FIX ---
            }
        }
        
        // 3. No exploit and no valid persistent plan, find a new one based on strategy.
        this.currentObjective = null;

        switch (this.activeStrategy) {
            case BotStrategy.HONEST_TRADER:
                this.botState = BotState.TIME_WASTER; // Will find a *new* simple trade
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', 'Strategy: HONEST_TRADER. Seeking simple trade.');
                break;
            
            case BotStrategy.MANIPULATOR:
                this.botState = BotState.SEEKING_MANIPULATION;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', 'Strategy: MANIPULATOR. Seeking new market crash opportunity.');
                break;
            
            case BotStrategy.DEPLETE_ONLY:
                this.botState = BotState.SEEKING_DEPLETION;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', 'Strategy: DEPLETE_ONLY. Seeking new depletion opportunity.');
                break;
            
            case BotStrategy.PROSPECTOR:
                const simpleTrade = this._findBestSimpleTrade();
                if (simpleTrade) {
                    this.currentObjective = { ...simpleTrade, type: 'SIMPLE_TRADE', hasGoods: false };
                    this.botState = BotState.TIME_WASTER;
                    this.metrics.objectivesStarted++;
                    // --- PHASE 3 LOGGING ---
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[PROSPECTOR]: Found simple trade. Buy ${simpleTrade.goodId} @ ${simpleTrade.buyLocationId} -> Sell @ ${simpleTrade.sellLocationId}. Margin: ${(simpleTrade.profitPerUnit / simpleTrade.buyPrice * 100).toFixed(1)}%. Est. PPD: ${formatCredits(simpleTrade.estimatedPPD)}.`);
                } else {
                    // --- PHASE 3 LOGGING ---
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[PROSPECTOR]: No simple trades found meeting ${this.MIN_PROFIT_MARGIN * 100}% margin. Falling back to manipulation.`);
                    this.botState = BotState.SEEKING_MANIPULATION;
                }
                break;
            
            case BotStrategy.MIXED:
            default:
                // 25% chance to try the Depletion strategy
                if (Math.random() < 0.25) {
                    this.botState = BotState.SEEKING_DEPLETION;
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', 'Strategy: MIXED. Seeking new depletion opportunity.');
                } else {
                    // 75% chance to try the standard Crash strategy
                    this.botState = BotState.SEEKING_MANIPULATION;
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Strategy: MIXED. Seeking new market crash opportunity.`);
                }
                break;
        }
    }

    /**
     * [State: MAINTENANCE]
     * Bot travels to specific locations to refuel (Jupiter) or repair (Luna).
     * Handles both general low-resource maintenance and specific "stranded" refueling.
     * @private
     */
    async _executeMaintenance() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) {
            this.botState = BotState.IDLE; // No ship to maintain
            return;
        }
        const shipState = this.gameState.player.shipStates[activeShip.id];

        // --- Priority 1: Handle "Stranded" Refuel Objective ---
        if (this.currentObjective && this.currentObjective.type === 'REFUEL_FOR_TRAVEL') {
            const { needed, nextState, originalObjective } = this.currentObjective;

            // Check if the 'needed' fuel is impossible for this ship to hold.
            // This breaks the infinite loop seen in the log (needed: 10004, max: 600).
            if (needed > activeShip.maxFuel && shipState.fuel === activeShip.maxFuel) {
                this.logger.error('Bot', `MAINTENANCE_FAIL: Objective requires ${needed} fuel, but ship max is ${activeShip.maxFuel}. Ship is full. Aborting objective to prevent loop.`);
                this.currentObjective = null; // Clear the impossible objective
                this.botState = BotState.IDLE; // Go back to deciding what to do
                this.metrics.objectivesAborted++; // Track failure
                return;
            }

            if (shipState.fuel < needed) {
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', `Executing local refuel to get ${needed} fuel.`);
                // This calls the "stranded" logic: buy expensive local fuel
                // to meet the specific 'needed' amount.
                this._botRefuel(needed); 
                return; // Wait for next tick to re-check
            } else {
                // Success! We have enough fuel.
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Local refuel complete. Resuming original objective.');
                this.currentObjective = originalObjective; // Restore original plan
                this.botState = nextState; // Go back to the state we were in
                return;
            }
        }

        // --- Priority 2: General Low Resources ---
        const fuelPct = (shipState.fuel / activeShip.maxFuel) * 100;
        const healthPct = (shipState.health / activeShip.maxHealth) * 100;

        // General Low Fuel
        if (fuelPct < 30) {
            if (this.gameState.currentLocationId === LOCATION_IDS.JUPITER) {
                // We are at the cheap spot, fill 'er up
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Arrived at Jupiter. Refueling.');
                this._botRefuel(activeShip.maxFuel); // Pass maxFuel to ensure a full tank
            } else {
                // We are not at Jupiter. Check if we can get there.
                const state = this.gameState.getState();
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][LOCATION_IDS.JUPITER];
                const fuelToJupiter = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                
                if (shipState.fuel < fuelToJupiter) {
                    // STRANDED: Buy just enough local fuel to get to Jupiter
                    this.logger.warn('Bot', `Stranded at ${state.currentLocationId}. Buying expensive local fuel just to reach Jupiter.`);
                    this._botRefuel(fuelToJupiter + 5); // Buy just enough + a small buffer
                } else {
                    // We have enough fuel to make the trip.
                    this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', `Fuel ${fuelPct.toFixed(0)}%. Traveling to Jupiter.`);
                    this.simulationService.travelService.initiateTravel(LOCATION_IDS.JUPITER);
                }
            }
            return; // Handle one maintenance task at a time
        }

        // General Low Health
        if (healthPct < 30) {
            if (this.gameState.currentLocationId !== LOCATION_IDS.LUNA) {
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', `Hull ${healthPct.toFixed(0)}%. Traveling to Luna.`);
                this.simulationService.travelService.initiateTravel(LOCATION_IDS.LUNA);
            } else {
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Arrived at Luna. Repairing.');
                this._botRepair();
            }
            return;
        }

        // If both are fine, maintenance is done.
        this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Maintenance complete. Resuming operations.');
        this.botState = BotState.IDLE;
    }


    /**
     * [State: SELLING_HELD_CARGO]
     * Bot travels to the best sell location and sells its cargo.
     * @private
     */
    async _executeSellHeldCargo() {
        const { goodId, sellLocationId, quantity } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        // 1. Travel to sell location
        if (state.currentLocationId !== sellLocationId) {
            // --- PHASE 3 LOGGING ---
            this.logger.info.system('Bot', state.day, 'SELL_HELD', `Traveling to ${sellLocationId} to sell ${quantity}x ${goodId}`);

            // --- Pre-flight check ---
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `SELL_HELD_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${sellLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
                // --- FIX: Create a temporary REFUEL objective to break loop ---
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5, // Add 5 fuel buffer
                    nextState: BotState.SELLING_HELD_CARGO, // State to return to
                    originalObjective: originalObjective // The plan to resume
                };
                this.botState = BotState.MAINTENANCE; 
                return;
            }
            // --- End Fix ---

            this.simulationService.travelService.initiateTravel(sellLocationId);
            return;
        }

        // 2. Sell entire cargo
        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            // --- PHASE 3 LOGGING ---
            this.logger.info.system('Bot', state.day, 'SELL_HELD_SELL', `Sold ${sellQty}x ${goodId}. Profit: ${formatCredits(profit)}`);
            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;

            // Track profit by good
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;
            
            this.metrics.objectivesCompleted++;
        } else {
             // --- PHASE 3 LOGGING ---
            this.logger.warn('Bot', `SELL_HELD_FAIL: Arrived at ${sellLocationId} but have no ${goodId} to sell.`);
             this.metrics.objectivesAborted++;
        }

        // 3. Loop is complete. Go IDLE to re-evaluate.
        this.currentObjective = null;
        this.botState = BotState.IDLE;
    }

    /**
     * [State: SEEKING_MANIPULATION]
     * Bot scans for the top 5 crash plans and picks one.
     * @param {string|null} [specificGoodId=null] - If provided, only finds plans for this good.
     * @returns {object|null} A chosen plan, or null.
     * @private
     */
    async _findCrashOpportunity(specificGoodId = null) {
        const state = this.gameState.getState();
        let availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier && c.tier > 1); // Ignore T1
        
        if (specificGoodId) {
            availableCommodities = availableCommodities.filter(c => c.id === specificGoodId);
        }

        if (availableCommodities.length === 0) {
            if (!specificGoodId) this.botState = BotState.TIME_WASTER; // No goods to manipulate
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
            // Sort by potential and take top 5
            top5Plans.sort((a, b) => b.potential - a.potential);
            const bestPlans = top5Plans.slice(0, 5).map(p => p.plan);
            
            // Randomly select one
            const chosenPlan = bestPlans[Math.floor(Math.random() * bestPlans.length)];
            
            if (specificGoodId) {
                return chosenPlan; // Return the plan for re-validation
            }

            this.currentObjective = chosenPlan;
            this.botState = BotState.PREPARING_CRASH;
            this.metrics.objectivesStarted++;
            this.logger.info.system('Bot', this.gameState.day, 'PLAN', `New crash plan (1 of ${bestPlans.length}): Buy ${chosenPlan.goodId} @ ${chosenPlan.buyFromLocationId}, Crash @ ${chosenPlan.crashLocationId}`);
        } else {
            if (!specificGoodId) {
                // No good manipulation routes, just run a simple trade
                this.botState = BotState.TIME_WASTER;
                this.logger.info.system('Bot', this.gameState.day, 'PLAN', `No good crash plans. Running simple trade.`);
            }
            return null;
        }
    }

    /**
     * [State: PREPARING_CRASH]
     * Bot travels to buy location (B) and fills cargo.
     * @private
     */
    async _executePreparation() {
        const { goodId, buyFromLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        // 1. Travel to buy location
        if (state.currentLocationId !== buyFromLocationId) {
            this.logger.info.system('Bot', state.day, 'PREP', `Traveling to ${buyFromLocationId} to buy ${goodId}`);
            
            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyFromLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `PREP_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${buyFromLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
                // Store the original objective and set temporary maintenance plan
                const originalObjective = this.currentObjective; 
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5, // Add 5 fuel buffer
                    nextState: BotState.PREPARING_CRASH, // State to return to
                    originalObjective: originalObjective // The plan to resume
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            // --- End Fix ---
            
            this.simulationService.travelService.initiateTravel(buyFromLocationId);
            // After travel, the state is new, so we return to let the next tick handle purchase
            return; 
        }

        // 2. Buy max cargo (we are at the buy location)
        const price = state.market.prices[buyFromLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);
        if (buyQty > 0) {
            this.simulationService.playerActionService.buyItem(goodId, buyQty);
            this.logger.info.system('Bot', state.day, 'PREP_BUY', `Bought ${buyQty}x ${goodId} @ ${formatCredits(price)}`);
            this.botState = BotState.EXECUTING_CRASH;
        } else {
            // Can't buy. Abort plan.
            this.logger.warn('Bot', `PREP_FAIL: Arrived at ${buyFromLocationId} but could not buy ${goodId}. Aborting.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
    }

    /**
     * [State: EXECUTING_CRASH]
     * Bot travels to crash location (A) and sells cargo.
     * @private
     */
    async _executeCrash() {
        const { goodId, crashLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        // 1. Travel to crash location
        if (state.currentLocationId !== crashLocationId) {
            this.logger.info.system('Bot', state.day, 'CRASH', `Traveling to ${crashLocationId} to crash ${goodId}`);

            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][crashLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `CRASH_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${crashLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
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
            // --- End Fix ---

            this.simulationService.travelService.initiateTravel(crashLocationId);
            return; // Let next tick handle sale
        }

        // 2. Sell entire cargo
        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);
            
            this.logger.info.system('Bot', state.day, 'CRASH_SELL', `CRASHED: Sold ${sellQty}x ${goodId}. Profit: ${formatCredits(profit)}`);
            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            
            // Track profit by good
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

            // 3. Add to memory
            const inventoryItem = this.gameState.market.inventory[crashLocationId][goodId];
            this.plannedObjectives.push({
                goodId: goodId,
                locationId: crashLocationId,
                priceLockEndDay: inventoryItem.priceLockEndDay,
                crashedOnDay: this.gameState.day,
            });

            // 4. Go directly to EXPLOIT state
            this.currentObjective.type = 'EXPLOIT';
            this.currentObjective.exploitLocationId = this.currentObjective.crashLocationId;
            delete this.currentObjective.buyFromLocationId;
            delete this.currentObjective.crashLocationId;

            this.botState = BotState.EXECUTING_EXPLOIT;
        } else {
            // Arrived with no cargo? Abort.
            this.logger.warn('Bot', `CRASH_FAIL: Arrived at ${crashLocationId} but have no ${goodId} to sell. Aborting.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
    }

    /**
     * [State: EXECUTING_EXPLOIT]
     * Bot travels to a known crashed market and buys the cheap goods.
     * @private
     */
    async _executeExploit() {
        const { goodId, exploitLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        // 1. Travel to exploit location
        if (state.currentLocationId !== exploitLocationId) {
            this.logger.info.system('Bot', state.day, 'EXPLOIT', `Traveling to ${exploitLocationId} to buy cheap ${goodId}`);

            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][exploitLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `EXPLOIT_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${exploitLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
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
            // --- End Fix ---

            this.simulationService.travelService.initiateTravel(exploitLocationId);
            return;
        }

        // 2. Buy max cargo
        const price = state.market.prices[exploitLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);

        if (buyQty > 0) {
            this.simulationService.playerActionService.buyItem(goodId, buyQty);
            this.logger.info.system('Bot', state.day, 'EXPLOIT_BUY', `EXPLOITED: Bought ${buyQty}x ${goodId} @ ${formatCredits(price)}`);
            
            // 3. Find a place to sell the goods we just bought
            const sellLocation = this._findBestSellLocation(goodId, exploitLocationId);

            if (sellLocation) {
                this.logger.info.system('Bot', state.day, 'EXPLOIT_PLAN', `Goods secured. Now traveling to ${sellLocation.id} to sell.`);
                this.currentObjective.type = 'SELL_EXPLOITED';
                this.currentObjective.sellToLocationId = sellLocation.id; 
                this.botState = BotState.SELLING_EXPLOITED_GOODS;
            } else {
                this.logger.warn('Bot', `EXPLOIT_FAIL: No market found to sell ${goodId}. Dumping objective.`);
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
            }

        } else {
            // Market may have recovered or stock is 0.
            this.logger.warn('Bot', `EXPLOIT_FAIL: Arrived at ${exploitLocationId} but could not buy ${goodId}.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }

        // 4. Remove from memory (so we don't try again immediately)
        this.plannedObjectives = this.plannedObjectives.filter(obj => !(obj.goodId === goodId && obj.locationId === exploitLocationId));
    }

    /**
     * [State: SELLING_EXPLOITED_GOODS]
     * Bot travels to the best sell location and sells its cargo.
     * @private
     */
    async _executeSellExploited() {
        const { goodId, sellToLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        // 1. Travel to sell location
        if (state.currentLocationId !== sellToLocationId) {
            this.logger.info.system('Bot', state.day, 'SELL_EXPLOIT', `Traveling to ${sellToLocationId} to sell ${goodId}`);

            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellToLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `SELL_EXPLOIT_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${sellToLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
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
            // --- End Fix ---

            this.simulationService.travelService.initiateTravel(sellToLocationId);
            return;
        }

        // 2. Sell entire cargo
        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.logger.info.system('Bot', state.day, 'SELL_EXPLOIT_SELL', `Sold ${sellQty}x ${goodId}. Profit: ${formatCredits(profit)}`);
            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;

            // Track profit by good
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

        } else {
            this.logger.warn('Bot', `SELL_EXPLOIT_FAIL: Arrived at ${sellToLocationId} but have no ${goodId} to sell.`);
        }

        // 3. Loop is complete. Go IDLE to re-evaluate (will pick up persistence).
        this.botState = BotState.IDLE;
        this.metrics.objectivesCompleted++;
    }


    /**
     * [State: TIME_WASTER]
     * Bot finds and executes a simple A-B trade to pass time.
     * --- [PHASE 1A] This is now a stateful function that executes a stored plan ---
     * @private
     */
    async _executeTimeWaster() {
        // If we're in this state, we're either executing a simple trade
        // or we need to find one (if strategy is HONEST_TRADER).

        // 1. Find a plan if we don't have one
        if (!this.currentObjective || this.currentObjective.type !== 'SIMPLE_TRADE') {
            const simpleTrade = this._findBestSimpleTrade();
            if (simpleTrade) {
                this.currentObjective = { ...simpleTrade, type: 'SIMPLE_TRADE', hasGoods: false };
                this.metrics.objectivesStarted++;
                // --- PHASE 3 LOGGING ---
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[TRADE]: New simple trade. Buy ${simpleTrade.goodId} @ ${simpleTrade.buyLocationId} -> Sell @ ${simpleTrade.sellLocationId}. Margin: ${(simpleTrade.profitPerUnit / simpleTrade.buyPrice * 100).toFixed(1)}%. Est. PPD: ${formatCredits(simpleTrade.estimatedPPD)}.`);
            } else {
                // No trades found. Wait one day and go back to IDLE.
                this.logger.info.system('Bot', this.gameState.day, 'TIME_WASTER', 'No profitable simple trades found. Waiting 1 day.');
                this.simulationService.timeService.advanceDays(1);
                this.botState = BotState.IDLE;
                return;
            }
        }

        // 2. Execute the plan
        const { goodId, buyLocationId, sellLocationId, buyPrice, hasGoods } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        // --- STAGE 1: GO TO BUY LOCATION & BUY ---
        if (!hasGoods) {
            // 2a. Travel to buy location
            if (state.currentLocationId !== buyLocationId) {
                // --- PHASE 3 LOGGING ---
                this.logger.info.system('Bot', state.day, 'TRADE_BUY', `Traveling to ${buyLocationId} to buy ${goodId}`);
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                
                if (activeShip.fuel < requiredFuel) {
                    this.logger.warn('Bot', `TIME_WASTER_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${buyLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
                    // --- FIX: Create a temporary REFUEL objective ---
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
            
            // 2b. Buy
            // --- PHASE 1.1 FIX: Re-check quantity on arrival ---
            const currentStock = state.market.inventory[state.currentLocationId][goodId].quantity;
            if (currentStock <= 0) {
                this.logger.warn('Bot', `TIME_WASTER_FAIL: Arrived at ${buyLocationId} but ${goodId} is now out of stock. Aborting.`);
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }
            // --- END FIX ---
            
            const buyQty = this._calculateMaxBuy(goodId, buyPrice);
            if (buyQty > 0) {
                this.simulationService.playerActionService.buyItem(goodId, buyQty);
                // --- PHASE 3 LOGGING ---
                this.logger.info.system('Bot', state.day, 'TRADE_BUY', `Bought ${buyQty}x ${goodId} @ ${formatCredits(buyPrice)}`);
                this.currentObjective.hasGoods = true; // Mark as having bought goods
                // Proceed immediately to sell step logic
            } else {
                // Can't buy (no space, no money). Abort plan.
                // --- PHASE 3 LOGGING ---
                this.logger.warn('Bot', `TIME_WASTER_FAIL: Arrived at ${buyLocationId} but could not buy ${goodId} (Price: ${formatCredits(buyPrice)}, Stock: ${currentStock}). Aborting.`);
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }
        }

        // --- STAGE 2: GO TO SELL LOCATION & SELL ---
        if (this.currentObjective.hasGoods) {
             // 2c. Travel to sell location
            if (state.currentLocationId !== sellLocationId) {
                // --- PHASE 3 LOGGING ---
                this.logger.info.system('Bot', state.day, 'TRADE_SELL', `Traveling to ${sellLocationId} to sell ${goodId}`);
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

                if (activeShip.fuel < requiredFuel) {
                    this.logger.warn('Bot', `TIME_WASTER_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${sellLocationId} (needs ${requiredFuel}). Forcing maintenance.`);
                    // --- FIX: Create a temporary REFUEL objective ---
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
            
            // 2d. Sell
            const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
            if (sellQty > 0) {
                const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
                const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
                const profit = saleValue - (avgCost * sellQty);
                
                // --- PHASE 3 LOGGING ---
                this.logger.info.system('Bot', state.day, 'TRADE_SELL', `Sold ${sellQty}x ${goodId}. Profit: ${formatCredits(profit)}`);
                this.metrics.totalTrades++;
                this.metrics.totalNetProfit += profit;
                if (profit > 0) this.metrics.profitableTrades++;

                // Track profit by good
                if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
                this.metrics.profitByGood[goodId] += profit;

                this.metrics.objectivesCompleted++;
            } else {
                this.logger.warn('Bot', `TIME_WASTER_FAIL: Arrived at ${sellLocationId} but have no ${goodId} to sell.`);
                this.metrics.objectivesAborted++;
            }

            // 3. Plan is complete. Go IDLE.
            this.currentObjective = null;
            this.botState = BotState.IDLE;
        }
    }

    /**
     * [State: SEEKING_DEPLETION]
     * Looks for a market to buy out to trigger the depletion bonus.
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
                
                // Check cooldown
                if (state.day <= (inventoryItem.depletionBonusDay + 365)) {
                    continue;
                }

                // Replicate targetStock logic to find threshold
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
                
                // Check if stock is above threshold, and we can afford/hold it all
                if (stock >= depletionThreshold && 
                    state.player.credits >= (stock * price) &&
                    ship.cargoCapacity >= stock) {
                    
                    // Potential = tier * stock. Prioritize high-tier, high-volume.
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
            this.logger.info.system('Bot', this.gameState.day, 'PLAN', `New depletion plan (1 of ${bestPlans.length}): Buy out ${chosenPlan.amountToBuy}x ${chosenPlan.goodId} at ${chosenPlan.locationId}`);
        } else {
            // No opportunity found
            if (this.activeStrategy === BotStrategy.DEPLETE_ONLY) {
                // If this is our only strategy, just wait and try again
                this.logger.info.system('Bot', this.gameState.day, 'PLAN', 'No depletion opportunities. Waiting 1 day.');
                this.simulationService.timeService.advanceDays(1);
                this.botState = BotState.IDLE; // Will re-run this state
            } else {
                // Fall back to a crash plan (if MIXED)
                this.botState = BotState.SEEKING_MANIPULATION;
            }
        }
    }

    /**
     * [State: EXECUTING_DEPLETION]
     * Travels to target, buys out stock, sells it, and enters wait state.
     * @private
     */
    async _executeDepletion() {
        const { goodId, locationId, amountToBuy } = this.currentObjective;
        const state = this.gameState.getState();

        // 1. Travel to depletion location
        if (state.currentLocationId !== locationId) {
            this.logger.info.system('Bot', state.day, 'DEPLETE', `Traveling to ${locationId} to buy out ${goodId}`);
            
            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `DEPLETE_FAIL: Not enough fuel (${activeShip.fuel}) to travel to ${locationId} (needs ${requiredFuel}). Forcing maintenance.`);
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
            // --- End Fix ---

            this.simulationService.travelService.initiateTravel(locationId);
            return;
        }

        // 2. Buy out the stock
        const boughtQty = this.simulationService.playerActionService.buyItem(goodId, amountToBuy);
        if (!boughtQty || boughtQty < amountToBuy) {
            this.logger.warn('Bot', `DEPLETE_FAIL: Failed to buy out ${goodId} at ${locationId}. Aborting.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }

        this.logger.info.system('Bot', state.day, 'DEPLETE_BUY', `Successfully bought out ${amountToBuy}x ${goodId}. Depletion bonus triggered.`);

        // 3. Sell the cargo immediately to free up space
        const sellLocation = this._findBestSellLocation(goodId, locationId);
        if (sellLocation) {
            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocation.id];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `DEPLETE_FAIL: Not enough fuel (${activeShip.fuel}) to travel to sell location ${sellLocation.id} (needs ${requiredFuel}). Forcing maintenance.`);
                // --- FIX: Create a temporary REFUEL objective ---
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_DEPLETION, // Return to this state
                    originalObjective: originalObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            // --- End Fix ---
            
            this.simulationService.travelService.initiateTravel(sellLocation.id);
            // We must return here to let the travel happen.
            // The bot will re-enter this state, fail the travel check, and proceed to sell.
            return;
        }

        // 4. Enter waiting state (if we couldn't sell, we just wait)
        this.currentObjective.waitStartDay = this.gameState.day;
        this.botState = BotState.WAITING_FOR_HIKE;
    }

    /**
     * [State: WAITING_FOR_HIKE]
     * Passes time until the 7-day price hike is active.
     * @private
     */
    async _executeWait() {
        if (this.gameState.day > this.currentObjective.waitStartDay + 7) {
            this.logger.info.system('Bot', this.gameState.day, 'DEPLETE', 'Wait complete. Price hike is active. Beginning exploitation.');
            this.botState = BotState.EXPLOITING_HIKE;
            this.currentObjective.exploitRuns = 0; // Initialize run counter
        } else {
            // --- FIX: Just advance time, don't run a full trade loop ---
            this.simulationService.timeService.advanceDays(1);
            this.botState = BotState.WAITING_FOR_HIKE; // Stay in this state
        }
    }

    /**
     * [State: EXPLOITING_HIKE]
     * Buys goods from a cheap market (B) and sells at the price-hiked market (A).
     * @private
     */
    async _executeExploitHike() {
        const { goodId, locationId } = this.currentObjective; // locationId is (A)
        const state = this.gameState.getState();

        // Find cheapest place to buy (B)
        const buyLocation = this._findCheapestMarket(goodId);
        if (!buyLocation || buyLocation.id === locationId) {
            this.logger.warn('Bot', `HIKE_FAIL: No cheap market found to buy ${goodId}. Aborting exploit.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }
        
        // Go to buy location (B)
        if (state.currentLocationId !== buyLocation.id) {
            // --- FIX: Pre-flight check ---
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyLocation.id];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                this.logger.warn('Bot', `HIKE_FAIL: Not enough fuel (${activeShip.fuel}) to travel to buy location ${buyLocation.id} (needs ${requiredFuel}). Forcing maintenance.`);
                // --- FIX: Create a temporary REFUEL objective ---
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
            // --- End Fix ---
            this.simulationService.travelService.initiateTravel(buyLocation.id);
            return;
        }
        
        // Buy max
        const buyQty = this._calculateMaxBuy(goodId, buyLocation.price);
        if (buyQty > 0) this.simulationService.playerActionService.buyItem(goodId, buyQty);
        
        // Go to hiked location (A)
        if (state.currentLocationId !== locationId) {
             // --- FIX: Pre-flight check ---
             const activeShip = this.simulationService._getActiveShip();
             const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
             const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
             if (activeShip.fuel < requiredFuel) {
                 this.logger.warn('Bot', `HIKE_FAIL: Not enough fuel (${activeShip.fuel}) to travel to hiked location ${locationId} (needs ${requiredFuel}). Forcing maintenance.`);
                 // --- FIX: Create a temporary REFUEL objective ---
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
             // --- End Fix ---
            this.simulationService.travelService.initiateTravel(locationId);
            return;
        }

        // Sell all
        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        
        // --- FIX: Check for 0 stock before selling ---
        const hikedStock = state.market.inventory[locationId][goodId].quantity;
        if (sellQty > 0 && hikedStock > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.logger.info.system('Bot', state.day, 'HIKE_EXPLOIT_SELL', `Sold ${sellQty}x ${goodId} at hiked price. Profit: ${formatCredits(profit)}`);
            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            
            // Track profit by good
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

        } else if (sellQty > 0 && hikedStock <= 0) {
            this.logger.warn('Bot', `HIKE_FAIL: Arrived at hiked market ${locationId} but stock is 0. Aborting sale and loop.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }
        // --- End Fix ---

        // Check if we should loop
        this.currentObjective.exploitRuns++;
        const inventoryItem = state.market.inventory[locationId][goodId];
        if (this.currentObjective.exploitRuns < 2 && state.day < (inventoryItem.depletionDay + 7)) {
            // Repeat the exploit
            this.botState = BotState.EXPLOITING_HIKE;
        } else {
            // Done
            this.logger.info.system('Bot', state.day, 'HIKE_COMPLETE', 'Depletion exploit complete.');
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
        
        // Handle case where properties might be missing from a bad objective
        if (!goodId || !buyFromLocationId || !crashLocationId) {
            return false;
        }

        const state = this.gameState.getState();
        const buyPrice = state.market.prices[buyFromLocationId][goodId];
        const sellPrice = state.market.prices[crashLocationId][goodId];
        // Simple check: is it still profitable to run this loop?
        return (sellPrice - buyPrice) > 0;
    }

    /**
     * Finds markets that the bot *itself* has crashed and are ready to exploit.
     * @returns {object | null} An exploit objective, or null.
     * @private
     */
    _findReadySelfExploit() {
        const state = this.gameState.getState();

        // 1. Clean memory and find self-created opportunities
        this.plannedObjectives = this.plannedObjectives.filter(obj => obj.priceLockEndDay > state.day); // Clean expired
        for (const obj of this.plannedObjectives) {
            // Is it ready to exploit (7-day delay passed)?
            if (state.day > obj.crashedOnDay + 7) {
                // Is stock high enough to buy?
                const stock = state.market.inventory[obj.locationId][obj.goodId].quantity;
                if (stock > 10) { // Arbitrary "worth it" amount
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
                
                // Find the best market to sell this specific good
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
        
        // Only return if the sale is profitable
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
            
            // --- FIX: Check for stock > 0 ---
            const stock = state.market.inventory[location.id][goodId].quantity;
            const price = state.market.prices[location.id][goodId];
            if (price > maxPrice && stock > 0) {
                maxPrice = price;
                bestSell = { id: location.id, price: price };
            }
            // --- End Fix ---
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
        let bestModifier = Infinity; // We want the lowest (exporter) modifier

        for (const location of DB.MARKETS) {
            if (location.id === buyLocationId || !state.player.unlockedLocationIds.includes(location.id)) continue;

            const modifier = location.availabilityModifier?.[goodId] ?? 1.0;
            // We want an exporter (modifier > 1) or neutral (modifier == 1)
            // But for finding the *best*, we just find the lowest *price* (which modifier causes)
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
     * --- [PHASE 2] This logic is now smarter, factoring in cargo size and full round trip time ---
     * @private
     */
    _findBestSimpleTrade() {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return null; // No ship, no trades
        
        const cargoCapacity = activeShip.cargoCapacity;
        if (cargoCapacity <= 0) return null; // No cargo, no trades

        let bestTrade = null;
        let maxProfitPerDay = 0;

        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier);
        const inventory = this.simulationService._getActiveInventory();

        for (const good of availableCommodities) {
            // --- PHASE 1 REFACTOR: Check if bot is already holding this good ---
            // If so, simple trade logic should ignore it, as SELLING_HELD_CARGO will handle it.
            if (inventory[good.id] && inventory[good.id].quantity > 0) {
                continue;
            }
            // --- END REFACTOR ---

            for (const buyLocation of DB.MARKETS) {
                if (!state.player.unlockedLocationIds.includes(buyLocation.id)) continue;

                // --- PHASE 1.1 FIX: Check buy stock quantity ---
                const buyStock = state.market.inventory[buyLocation.id][good.id].quantity;
                if (buyStock <= 0) {
                    continue; // Can't buy if it's out of stock
                }
                // --- END FIX ---

                for (const sellLocation of DB.MARKETS) {
                    if (buyLocation.id === sellLocation.id || !state.player.unlockedLocationIds.includes(sellLocation.id)) continue;

                    // --- PHASE 1.1 FIX: Check sell stock quantity ---
                    // We check sell stock > 0 because we can't sell to a market that has 0 *demand* (is depleted)
                    const sellStock = state.market.inventory[sellLocation.id][good.id].quantity;
                    if (sellStock <= 0) {
                        continue;
                    }
                    // --- END FIX ---

                    const buyPrice = state.market.prices[buyLocation.id][good.id];
                    const sellPrice = state.market.prices[sellLocation.id][good.id];
                    const profitPerUnit = sellPrice - buyPrice;

                    // --- PHASE 2.1 FIX: Check profit margin ---
                    const profitMargin = (buyPrice > 0) ? (profitPerUnit / buyPrice) : 0;

                    if (profitPerUnit > 0 && profitMargin > this.MIN_PROFIT_MARGIN) {
                        const travelTimeToBuy = state.TRAVEL_DATA[state.currentLocationId]?.[buyLocation.id]?.time || 0;
                        const travelTimeToSell = state.TRAVEL_DATA[buyLocation.id]?.[sellLocation.id]?.time || 0;
                        
                        // Skip if no travel data
                        if (travelTimeToSell === 0) continue; 
                        
                        // +2 for transaction time (1 day to buy, 1 day to sell)
                        const totalTime = travelTimeToBuy + travelTimeToSell + 2; 

                        // --- PHASE 1.1 FIX: Base profit calc on actual available stock ---
                        const buyQty = Math.min(cargoCapacity, buyStock);
                        const totalTripProfit = profitPerUnit * buyQty;
                        // --- END FIX ---
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
                    // --- END FIX ---
                }
            }
        }
        return bestTrade;
    }

    /**
     * Handles pop-up modals, specifically Age Events.
     * --- [PHASE 1B] This is now a generic, future-proof handler ---
     * @returns {boolean} True if a modal was handled, false otherwise.
     * @private
     */
    _handleAgeEventChoice() {
        const modal = document.getElementById('age-event-modal');
        if (!modal || modal.classList.contains('hidden')) {
            return false; // No event is active
        }

        const title = document.getElementById('age-event-title').textContent;
        this.logger.info.system('Bot', this.gameState.day, 'EVENT_CHOICE', `Handling age event: ${title}`);

        const buttons = Array.from(modal.querySelectorAll('button'));
        if (buttons.length === 0) {
            return false; // No buttons to click
        }

        // Keywords for "best" choices, in order of priority
        const profitKeywords = ['trademaster', 'merchant\'s guild', 'free ship', 'credits', 'profit'];
        // Keywords for "neutral" choices
        const neutralKeywords = ['continue', 'ignore', 'dismiss', 'accept'];
        
        let chosenButton = null;

        // 1. Try to find a profit-based choice
        for (const btn of buttons) {
            const btnText = btn.textContent.toLowerCase();
            if (profitKeywords.some(kw => btnText.includes(kw))) {
                chosenButton = btn;
                break;
            }
        }

        // 2. If no profit choice, try to find a neutral/continue choice
        if (!chosenButton) {
             for (const btn of buttons) {
                const btnText = btn.textContent.toLowerCase();
                if (neutralKeywords.some(kw => btnText.includes(kw))) {
                    chosenButton = btn;
                    break;
                }
            }
        }
        
        // 3. If still no match, just click the first button to not get stuck
        if (!chosenButton) {
            this.logger.warn('Bot', `EVENT_CHOICE: No preferred keyword found for "${title}". Clicking first available button.`);
            chosenButton = buttons[0];
        }
        
        chosenButton.click();
        return true;
    }
    
    /**
     * Logs a summary report of the bot's performance to the console and game log.
     * --- [PHASE 2] Now includes Profit Per Day ---
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
        this.logger.info.system('Bot', this.gameState.day, 'REPORT', header);
        
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
            this.logger.info.system('Bot', this.gameState.day, 'REPORT', `  ${line}`); // Indent for log clarity
        }

        // --- Profit by Good ---
        const profitHeader = `--- Profit Breakdown by Commodity ---`;
        console.log(profitHeader);
        this.logger.info.system('Bot', this.gameState.day, 'REPORT', `  ${profitHeader}`);
        
        const sortedGoods = Object.keys(profitByGood).sort((a, b) => profitByGood[b] - profitByGood[a]);
        if (sortedGoods.length === 0) {
             const noData = `No commodity trades recorded.`;
             console.log(noData);
             this.logger.info.system('Bot', this.gameState.day, 'REPORT', `    ${noData}`);
        } else {
            for (const goodId of sortedGoods) {
                const profit = profitByGood[goodId];
                const commodityName = DB.COMMODITIES.find(c => c.id === goodId)?.name || goodId;
                const line = `${commodityName}: ${formatCredits(profit)}`;
                console.log(line);
                this.logger.info.system('Bot', this.gameState.day, 'REPORT', `    ${line}`);
            }
        }
        
        const footer = '=======================================';
        console.log(footer);
        this.logger.info.system('Bot', this.gameState.day, 'REPORT', footer);
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
        
        // Apply Venetian Syndicate discount
        if (this.gameState.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && this.gameState.currentLocationId === LOCATION_IDS.VENUS) {
             fuelPrice *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        fuelPrice = Math.max(1, Math.round(fuelPrice));

        const ticksNeeded = Math.ceil(fuelNeeded / 5); // 5 fuel per tick
        const totalCost = ticksNeeded * fuelPrice;
        const fuelToBuy = ticksNeeded * 5;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].fuel = Math.min(ship.maxFuel, this.gameState.player.shipStates[ship.id].fuel + fuelToBuy);
            this.simulationService._logConsolidatedTransaction('fuel', -totalCost, 'Fuel Purchase');
            this.metrics.totalFuelCost += totalCost;
        } else {
            // Buy as much as possible
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
        
        // Apply Venetian Syndicate discount
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
            // Buy as much as possible
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
     * --- [PHASE 2] Hardened to handle price <= 0 ---
     */
    _calculateMaxBuy(goodId, price) {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!ship || !inventory) return 0; // Bot has no ship
        
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        const canAfford = (price > 0) ? Math.floor(state.player.credits / price) : Infinity;
        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
        return Math.max(0, Math.min(space, canAfford, stock));
    }
}