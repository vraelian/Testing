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
            totalProfit: 0,
            totalFuelCost: 0,
            totalRepairCost: 0,
            daysSimulated: 0
        };
        /** @type {number} */
        this.simulationStartDay = 0;
    }

    /**
     * Starts the automated play simulation.
     * @param {object} config - Configuration for the simulation run.
     * @param {number} config.daysToRun - The number of in-game days to simulate.
     * @param {function} updateCallback - A function to call with progress updates.
     */
    async runSimulation({ daysToRun }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('Bot', 'AUTOTRADER-01 is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;
        
        // Reset metrics for new run
        this.simulationStartDay = startDay;
        this.metrics = {
            totalTrades: 0,
            profitableTrades: 0,
            totalProfit: 0,
            totalFuelCost: 0,
            totalRepairCost: 0,
            daysSimulated: 0
        };

        this.logger.info.system('Bot', startDay, 'SIMULATION_START', `Starting advanced simulation for ${daysToRun} days.`);

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
     * Bot decides what to do.
     * 1. Check if a self-created exploit is ready.
     * 2. Check if a persistent crash loop is still valid.
     * 3. 25% chance to seek a new Depletion strategy.
     * 4. 75% chance to seek a new Crash strategy.
     * @private
     */
    async _evaluateOpportunities() {
        // 1. Check for ready-to-exploit self-crashed markets
        const exploit = this._findReadySelfExploit();
        if (exploit) {
            this.currentObjective = exploit;
            this.botState = BotState.EXECUTING_EXPLOIT;
            this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Found self-created exploit: Buy ${exploit.goodId} @ ${exploit.exploitLocationId}`);
            return;
        }

        // 2. Check for persistent objective
        if (this.currentObjective) {
            // Check if the old plan is still valid
            if (this.currentObjective.type === 'CRASH' && this._isCrashPlanStillValid()) {
                // Stick to the plan
                this.botState = BotState.PREPARING_CRASH;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Continuing persistent CRASH loop for ${this.currentObjective.goodId}.`);
                return;
            } else if (this.currentObjective.type !== 'CRASH') {
                // This means we just finished an EXPLOIT or SELL_EXPLOITED
                // We need to re-validate the original crash plan
                const validPlan = this._findCrashOpportunity(this.currentObjective.goodId);
                if (validPlan) {
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Re-validating and repeating CRASH loop for ${this.currentObjective.goodId}.`);
                    this.currentObjective = validPlan;
                    this.botState = BotState.PREPARING_CRASH;
                    return;
                }
            }
        }
        
        // 3. No exploit and no valid persistent plan, find a new one.
        this.currentObjective = null;

        // 25% chance to try the Depletion strategy
        if (Math.random() < 0.25) {
            this.botState = BotState.SEEKING_DEPLETION;
            this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', 'Seeking new depletion opportunity.');
            return;
        }

        // 75% chance to try the standard Crash strategy
        this.botState = BotState.SEEKING_MANIPULATION;
        this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Seeking new market crash opportunity.`);
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

            // --- BUG FIX ---
            // Check if the 'needed' fuel is impossible for this ship to hold.
            // This breaks the infinite loop seen in the log (needed: 10004, max: 600).
            if (needed > activeShip.maxFuel && shipState.fuel === activeShip.maxFuel) {
                this.logger.error('Bot', `MAINTENANCE_FAIL: Objective requires ${needed} fuel, but ship max is ${activeShip.maxFuel}. Ship is full. Aborting objective to prevent loop.`);
                this.currentObjective = null; // Clear the impossible objective
                this.botState = BotState.IDLE; // Go back to deciding what to do
                return;
            }
            // --- END FIX ---

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
            this.metrics.totalProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;

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
            }

        } else {
            // Market may have recovered or stock is 0.
            this.logger.warn('Bot', `EXPLOIT_FAIL: Arrived at ${exploitLocationId} but could not buy ${goodId}.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
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
            this.metrics.totalProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
        } else {
            this.logger.warn('Bot', `SELL_EXPLOIT_FAIL: Arrived at ${sellToLocationId} but have no ${goodId} to sell.`);
        }

        // 3. Loop is complete. Go IDLE to re-evaluate (will pick up persistence).
        this.botState = BotState.IDLE;
    }


    /**
     * [State: TIME_WASTER]
     * Bot finds and executes a simple A-B trade to pass time.
     * @private
     */
    async _executeTimeWaster() {
        const simpleTrade = this._findBestSimpleTrade();
        if (simpleTrade) {
            this.logger.info.system('Bot', this.gameState.day, 'TIME_WASTER', `Running simple trade: ${simpleTrade.goodId} from ${simpleTrade.buyLocationId} to ${simpleTrade.sellLocationId}`);
            const state = this.gameState.getState();

            // Go to buy location
            if (state.currentLocationId !== simpleTrade.buyLocationId) {
                // --- FIX: Pre-flight check ---
                const activeShip = this.simulationService._getActiveShip();
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][simpleTrade.buyLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                if (activeShip.fuel < requiredFuel) {
                    this.logger.warn('Bot', `TIME_WASTER_FAIL: Not enough fuel to travel to ${simpleTrade.buyLocationId}. Forcing maintenance.`);
                    this.botState = BotState.MAINTENANCE;
                    return;
                }
                // --- End Fix ---
                this.simulationService.travelService.initiateTravel(simpleTrade.buyLocationId);
                return;
            }
            
            // Buy
            const buyQty = this._calculateMaxBuy(simpleTrade.goodId, simpleTrade.buyPrice);
            if (buyQty > 0) {
                this.simulationService.playerActionService.buyItem(simpleTrade.goodId, buyQty);
                this.logger.info.system('Bot', this.gameState.day, 'TRADE_BUY', `Bought ${buyQty}x ${simpleTrade.goodId} @ ${formatCredits(simpleTrade.buyPrice)}`);
            }

            // Go to sell location
            if (this.gameState.currentLocationId !== simpleTrade.sellLocationId) {
                // --- FIX: Pre-flight check ---
                const activeShip = this.simulationService._getActiveShip();
                const travelInfo = this.gameState.getState().TRAVEL_DATA[this.gameState.currentLocationId][simpleTrade.sellLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                if (activeShip.fuel < requiredFuel) {
                    this.logger.warn('Bot', `TIME_WASTER_FAIL: Not enough fuel to travel to ${simpleTrade.sellLocationId}. Forcing maintenance.`);
                    this.botState = BotState.MAINTENANCE;
                    return;
                }
                // --- End Fix ---
                this.simulationService.travelService.initiateTravel(simpleTrade.sellLocationId);
                return;
            }
            
            // Sell
            const sellQty = this.simulationService._getActiveInventory()[simpleTrade.goodId]?.quantity || 0;
            if (sellQty > 0) {
                const avgCost = this.simulationService._getActiveInventory()[simpleTrade.goodId]?.avgCost || 0;
                const saleValue = this.simulationService.playerActionService.sellItem(simpleTrade.goodId, sellQty);
                const profit = saleValue - (avgCost * sellQty);
                
                this.logger.info.system('Bot', this.gameState.day, 'TRADE_SELL', `Sold ${sellQty}x ${simpleTrade.goodId}. Profit: ${formatCredits(profit)}`);
                this.metrics.totalTrades++;
                this.metrics.totalProfit += profit;
                if (profit > 0) this.metrics.profitableTrades++;
            }
        } else {
            // No trades, just wait
            this.simulationService.timeService.advanceDays(1);
        }

        this.botState = BotState.IDLE; // Re-evaluate opportunities
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
            this.logger.info.system('Bot', this.gameState.day, 'PLAN', `New depletion plan (1 of ${bestPlans.length}): Buy out ${chosenPlan.amountToBuy}x ${chosenPlan.goodId} at ${chosenPlan.locationId}`);
        } else {
            // No opportunity found, try a crash instead
            this.botState = BotState.SEEKING_MANIPULATION;
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
                // Abort depletion, just focus on maintenance. Keep the cargo for now.
                this.currentObjective = null; 
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
                this.currentObjective = null;
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
                 this.currentObjective = null;
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
            this.metrics.totalProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            
        } else if (sellQty > 0 && hikedStock <= 0) {
            this.logger.warn('Bot', `HIKE_FAIL: Arrived at hiked market ${locationId} but stock is 0. Aborting sale and loop.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
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
     * This is the bot's old logic, now used for "Time Waster" state.
     * @private
     */
    _findBestSimpleTrade() {
        const state = this.gameState.getState();
        let bestTrade = null;
        let maxProfitPerDay = 0;

        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier);

        for (const good of availableCommodities) {
            for (const buyLocation of DB.MARKETS) {
                if (!state.player.unlockedLocationIds.includes(buyLocation.id)) continue;

                for (const sellLocation of DB.MARKETS) {
                    if (buyLocation.id === sellLocation.id || !state.player.unlockedLocationIds.includes(sellLocation.id)) continue;

                    const buyPrice = state.market.prices[buyLocation.id][good.id];
                    const sellPrice = state.market.prices[sellLocation.id][good.id];
                    const profitPerUnit = sellPrice - buyPrice;

                    if (profitPerUnit > 0) {
                        const travelTime = state.TRAVEL_DATA[buyLocation.id]?.[sellLocation.id]?.time || 0;
                        // Skip if no travel data
                        if (travelTime === 0) continue; 
                        
                        const travelTimeToBuy = state.TRAVEL_DATA[state.currentLocationId]?.[buyLocation.id]?.time || 0;
                        const totalTime = travelTimeToBuy + travelTime + 1; // +1 for transaction time
                        const profitPerDay = profitPerUnit / totalTime;

                        if (profitPerDay > maxProfitPerDay) {
                            maxProfitPerDay = profitPerDay;
                            bestTrade = {
                                goodId: good.id,
                                buyLocationId: buyLocation.id,
                                sellLocationId: sellLocation.id,
                                buyPrice,
                                sellPrice,
                                profitPerUnit
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
            return false; // No event is active
        }

        const title = document.getElementById('age-event-title').textContent;
        this.logger.info.system('Bot', this.gameState.day, 'EVENT_CHOICE', `Handling age event: ${title}`);

        if (title === 'Captain Who?') {
            // Always choose Trademaster for profit
            const trademasterButton = Array.from(modal.querySelectorAll('button h4')).find(h => h.textContent === 'Trademaster');
            if (trademasterButton) {
                trademasterButton.closest('button').click();
                return true;
            }
        } else if (title === 'Friends with Benefits') {
            // Always choose the free ship (pure profit)
            const guildShipButton = Array.from(modal.querySelectorAll('button h4')).find(h => h.textContent === "Join the Merchant's Guild");
            if (guildShipButton) {
                guildShipButton.closest('button').click();
                return true;
            }
        }
        
        // Default: just click the first button
        modal.querySelector('button')?.click();
        return true;
    }
    
    /**
     * Logs a summary report of the bot's performance to the console and game log.
     * @private
     */
    _logSummaryReport() {
        this.metrics.daysSimulated = this.gameState.day - this.simulationStartDay;
        const { totalTrades, profitableTrades, totalProfit, totalFuelCost, totalRepairCost, daysSimulated } = this.metrics;
        const profitPct = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : 0;

        const header = '=== AUTO-TRADER PERFORMANCE SUMMARY ===';
        console.log(header);
        this.logger.info.system('Bot', this.gameState.day, 'REPORT', header);
        
        const summary = [
            `Days Simulated: ${daysSimulated}`,
            `Total Trades Completed: ${totalTrades}`,
            `Profitable Trades: ${profitableTrades} (${profitPct}%)`,
            `Total Net Profit: ${formatCredits(totalProfit)}`,
            `Total Fuel Costs: ${formatCredits(totalFuelCost)}`,
            `Total Repair Costs: ${formatCredits(totalRepairCost)}`,
            `Final Credit Balance: ${formatCredits(this.gameState.player.credits)}`
        ];

        for (const line of summary) {
            console.log(line);
            this.logger.info.system('Bot', this.gameState.day, 'REPORT', `  ${line}`); // Indent for log clarity
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
     */
    _calculateMaxBuy(goodId, price) {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!ship || !inventory) return 0; // Bot has no ship
        
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        const canAfford = price > 0 ? Math.floor(state.player.credits / price) : space;
        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
        return Math.max(0, Math.min(space, canAfford, stock));
    }
}