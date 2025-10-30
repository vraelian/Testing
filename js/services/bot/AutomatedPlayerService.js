// js/services/bot/AutomatedPlayerService.js
/**
 * @fileoverview This file contains the AutomatedPlayer class.
 * This bot is designed to stress-test the in-game economy by simulating
 * an advanced player who actively participates in market manipulation.
 * It operates as a state machine, forming long-term plans to crash
 * markets and exploit those self-created opportunities.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES } from '../../data/constants.js';
import { calculateInventoryUsed } from '../../utils.js';

/**
 * Defines the operational states for the bot's state machine.
 * @enum {string}
 */
const BotState = {
    IDLE: 'IDLE',                                 // Bot is deciding what to do next.
    SEEKING_MANIPULATION: 'SEEKING_MANIPULATION', // Bot is actively looking for a new market to crash.
    PREPARING_CRASH: 'PREPARING_CRASH',           // Bot is traveling and buying goods in preparation for a crash.
    EXECUTING_CRASH: 'EXECUTING_CRASH',           // Bot is at the target market, selling goods to crash the price.
    EXECUTING_EXPLOIT: 'EXECUTING_EXPLOIT',       // Bot is exploiting a known crashed market (self-created or found).
    TIME_WASTER: 'TIME_WASTER',                   // Bot is running a simple A-B trade to pass time.
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
         * type: 'EXPLOIT',
         * goodId: 'plasteel',
         * exploitLocationId: 'mars' // Location A (exploit)
         * }
         */
        this.currentObjective = null;

        /**
         * @type {Array<object>}
         * @description The bot's "memory" of markets it has crashed.
         * Example: { goodId: 'plasteel', locationId: 'mars', priceLockEndDay: 450 }
         */
        this.plannedObjectives = [];
    }

    /**
     * Starts the automated play simulation.
     * @param {object} config - Configuration for the simulation run.
     * @param {number} config.daysToRun - The number of in-game days to simulate.
     * @param {function} updateCallback - A function to call with progress updates.
     */
    async runSimulation({ daysToRun }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('AutomatedPlayer', 'AUTOTRADER-01 is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;

        this.logger.info.system('Bot', startDay, 'SIMULATION_START', `Starting advanced simulation for ${daysToRun} days.`);

        while (this.gameState.day < endDay && !this.stopRequested) {
            // --- 1. Handle Maintenance ---
            this._handleMaintenance();

            // --- 2. Execute State Logic ---
            await this._decideNextAction();

            // --- 3. Update UI & Pause ---
            updateCallback(this.gameState.day, endDay);
            await new Promise(resolve => setTimeout(resolve, 10)); // Tiny pause
        }

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
        switch (this.botState) {
            case BotState.IDLE:
                await this._evaluateOpportunities();
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
            case BotState.TIME_WASTER:
                await this._executeTimeWaster();
                break;
        }
    }

    /**
     * [State: IDLE]
     * Bot decides what to do. Priority is exploiting known opportunities.
     * If none exist, it seeks to create one.
     * @private
     */
    async _evaluateOpportunities() {
        const exploit = this._findExploitOpportunity();
        if (exploit) {
            this.currentObjective = exploit;
            this.botState = BotState.EXECUTING_EXPLOIT;
            this.logger.info.bot(this.gameState.day, 'OBJECTIVE', `Found exploit: Buy ${exploit.goodId} @ ${exploit.exploitLocationId}`);
        } else {
            this.botState = BotState.SEEKING_MANIPULATION;
            this.logger.info.bot(this.gameState.day, 'OBJECTIVE', `No exploits. Seeking new market to crash.`);
        }
    }

    /**
     * [State: SEEKING_MANIPULATION]
     * Bot scans for the best market to crash (A) and a place to buy goods from (B).
     * @private
     */
    async _findCrashOpportunity() {
        // This is a complex calculation: find a good, find a cheap place to buy it (B),
        // and find an *exporter* to sell it at (A) to maximize the crash.
        // For simplicity, we'll find a good to crash, then find a place to buy it.

        const state = this.gameState.getState();
        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier && c.tier > 1); // Ignore T1
        if (availableCommodities.length === 0) {
            this.botState = BotState.TIME_WASTER; // No goods to manipulate
            return;
        }

        let bestCrashPlan = null;
        let maxPotential = 0;

        for (const good of availableCommodities) {
            // Find the best (cheapest) place to buy this good
            const buyLocation = this._findCheapestMarket(good.id);
            if (!buyLocation) continue;

            // Find the best (export) location to *crash* this good
            // This is a market that already has a low price, so we can crash it further.
            const crashLocation = this._findBestCrashTarget(good.id, buyLocation.id);
            if (!crashLocation) continue;

            // We found a potential plan. How good is it?
            // Simple heuristic: Tier of good * (profit from simple trade)
            // This prioritizes high-tier goods on profitable routes.
            const potential = good.tier * (crashLocation.price - buyLocation.price);
            if (potential > maxPotential) {
                maxPotential = potential;
                bestCrashPlan = {
                    type: 'CRASH',
                    goodId: good.id,
                    buyFromLocationId: buyLocation.id,
                    crashLocationId: crashLocation.id,
                };
            }
        }

        if (bestCrashPlan) {
            this.currentObjective = bestCrashPlan;
            this.botState = BotState.PREPARING_CRASH;
            this.logger.info.bot(this.gameState.day, 'PLAN', `New crash plan: Buy ${bestCrashPlan.goodId} @ ${bestCrashPlan.buyFromLocationId}, Crash @ ${bestCrashPlan.crashLocationId}`);
        } else {
            // No good manipulation routes, just run a simple trade
            this.botState = BotState.TIME_WASTER;
            this.logger.info.bot(this.gameState.day, 'PLAN', `No good crash plans. Running simple trade.`);
        }
    }

    /**
     * [State: PREPARING_CRASH]
     * Bot travels to buy location (B) and fills cargo.
     * @private
     */
    async _executePreparation() {
        const { goodId, buyFromLocationId } = this.currentObjective;

        // 1. Travel to buy location
        if (this.gameState.currentLocationId !== buyFromLocationId) {
            this.logger.info.bot(this.gameState.day, 'PREP', `Traveling to ${buyFromLocationId} to buy ${goodId}`);
            this.simulationService.travelService.initiateTravel(buyFromLocationId);
        }

        // 2. Buy max cargo
        const price = this.gameState.market.prices[buyFromLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);
        if (buyQty > 0) {
            this.simulationService.playerActionService.buyItem(goodId, buyQty);
            this.logger.info.bot(this.gameState.day, 'PREP', `Bought ${buyQty}x ${goodId}`);
            this.botState = BotState.EXECUTING_CRASH;
        } else {
            // Can't buy. Abort plan.
            this.logger.warn('AutomatedPlayer', `PREP_FAIL: Arrived at ${buyFromLocationId} but could not buy ${goodId}. Aborting.`);
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

        // 1. Travel to crash location
        if (this.gameState.currentLocationId !== crashLocationId) {
            this.logger.info.bot(this.gameState.day, 'CRASH', `Traveling to ${crashLocationId} to crash ${goodId}`);
            this.simulationService.travelService.initiateTravel(crashLocationId);
        }

        // 2. Sell entire cargo
        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            this.simulationService.playerActionService.sellItem(goodId, sellQty);
            this.logger.info.bot(this.gameState.day, 'CRASH', `CRASHED MARKET: Sold ${sellQty}x ${goodId} at ${crashLocationId}`);

            // 3. Add to memory
            const inventoryItem = this.gameState.market.inventory[crashLocationId][goodId];
            this.plannedObjectives.push({
                goodId: goodId,
                locationId: crashLocationId,
                priceLockEndDay: inventoryItem.priceLockEndDay,
                crashedOnDay: this.gameState.day,
            });

            this.currentObjective = null;
            this.botState = BotState.TIME_WASTER; // Go pass time
        } else {
            // Arrived with no cargo? Abort.
            this.logger.warn('AutomatedPlayer', `CRASH_FAIL: Arrived at ${crashLocationId} but have no ${goodId} to sell. Aborting.`);
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

        // 1. Travel to exploit location
        if (this.gameState.currentLocationId !== exploitLocationId) {
            this.logger.info.bot(this.gameState.day, 'EXPLOIT', `Traveling to ${exploitLocationId} to buy cheap ${goodId}`);
            this.simulationService.travelService.initiateTravel(exploitLocationId);
        }

        // 2. Buy max cargo
        const price = this.gameState.market.prices[exploitLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);

        if (buyQty > 0) {
            this.simulationService.playerActionService.buyItem(goodId, buyQty);
            this.logger.info.bot(this.gameState.day, 'EXPLOIT', `Exploited market: Bought ${buyQty}x ${goodId} at ${exploitLocationId}`);
        } else {
            // Market may have recovered or stock is 0.
            this.logger.warn('AutomatedPlayer', `EXPLOIT_FAIL: Arrived at ${exploitLocationId} but could not buy ${goodId}.`);
        }

        // 3. Remove from memory (so we don't try again)
        this.plannedObjectives = this.plannedObjectives.filter(obj => !(obj.goodId === goodId && obj.locationId === exploitLocationId));
        this.currentObjective = null;
        this.botState = BotState.IDLE; // Go back to deciding
    }

    /**
     * [State: TIME_WASTER]
     * Bot finds and executes a simple A-B trade to pass time.
     * @private
     */
    async _executeTimeWaster() {
        const simpleTrade = this._findBestSimpleTrade();
        if (simpleTrade) {
            this.logger.info.bot(this.gameState.day, 'TIME_WASTER', `Running simple trade: ${simpleTrade.goodId} from ${simpleTrade.buyLocationId} to ${simpleTrade.sellLocationId}`);

            // Go to buy location
            if (this.gameState.currentLocationId !== simpleTrade.buyLocationId) {
                this.simulationService.travelService.initiateTravel(simpleTrade.buyLocationId);
            }
            // Buy
            const buyQty = this._calculateMaxBuy(simpleTrade.goodId, simpleTrade.buyPrice);
            if (buyQty > 0) this.simulationService.playerActionService.buyItem(simpleTrade.goodId, buyQty);

            // Go to sell location
            if (this.gameState.currentLocationId !== simpleTrade.sellLocationId) {
                this.simulationService.travelService.initiateTravel(simpleTrade.sellLocationId);
            }
            // Sell
            const sellQty = this.simulationService._getActiveInventory()[simpleTrade.goodId]?.quantity || 0;
            if (sellQty > 0) this.simulationService.playerActionService.sellItem(simpleTrade.goodId, sellQty);
        } else {
            // No trades, just wait
            this.simulationService.timeService.advanceDays(1);
        }

        this.botState = BotState.IDLE; // Re-evaluate opportunities
    }


    // --- "BRAIN" HELPER FUNCTIONS ---

    /**
     * Finds markets that are *already* crashed.
     * Priority 1: Markets the bot crashed itself and are ready (7+ days).
     * Priority 2: Any other market that is significantly below its baseline.
     * @returns {object | null} An exploit objective, or null.
     * @private
     */
    _findExploitOpportunity() {
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

        // 2. Find "natural" or "other" opportunities
        let bestNaturalExploit = null;
        let maxDiscount = 0;

        for (const location of DB.MARKETS) {
            if (!state.player.unlockedLocationIds.includes(location.id)) continue;
            for (const good of DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier)) {
                const avg = state.market.galacticAverages[good.id];
                const modifier = location.availabilityModifier?.[good.id] ?? 1.0;
                const targetPriceOffset = (1.0 - modifier) * avg;
                const localBaseline = avg + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);
                const currentPrice = state.market.prices[location.id][good.id];
                const discount = (localBaseline - currentPrice) / localBaseline; // % discount

                // Is it significantly cheap (e.g., > 30% discount) and has stock?
                if (discount > 0.30 && state.market.inventory[location.id][good.id].quantity > 10) {
                    if (discount > maxDiscount) {
                        maxDiscount = discount;
                        bestNaturalExploit = { type: 'EXPLOIT', goodId: good.id, exploitLocationId: location.id };
                    }
                }
            }
        }
        return bestNaturalExploit;
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
                        const travelTimeToBuy = state.TRAVEL_DATA[state.currentLocationId]?.[buyLocation.id]?.time || 0;
                        const travelTimeToSell = state.TRAVEL_DATA[buyLocation.id]?.[sellLocation.id]?.time || 0;
                        const totalTime = travelTimeToBuy + travelTimeToSell + 1; // +1 for transaction time
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

    // --- UTILITY FUNCTIONS (Moved from DebugService) ---

    /**
     * Checks fuel and health and repairs/refuels if necessary.
     * @private
     */
    _handleMaintenance() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;

        const fuelPct = (this.gameState.player.shipStates[activeShip.id].fuel / activeShip.maxFuel) * 100;
        const healthPct = (this.gameState.player.shipStates[activeShip.id].health / activeShip.maxHealth) * 100;

        if (fuelPct < 30) {
            this.logger.info.bot(this.gameState.day, 'REFUEL', `Low fuel (${fuelPct.toFixed(1)}%). Refueling.`);
            this._botRefuel();
        }
        if (healthPct < 30) {
            this.logger.info.bot(this.gameState.day, 'REPAIR', `Low hull integrity (${healthPct.toFixed(1)}%). Repairing.`);
            this._botRepair();
        }
    }

    /**
     * @private
     */
    _botRefuel() {
        const ship = this.simulationService._getActiveShip();
        if (!ship) return;
        const fuelNeeded = ship.maxFuel - this.gameState.player.shipStates[ship.id].fuel;
        if (fuelNeeded <= 0) return;
        const currentMarket = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        let fuelPrice = currentMarket.fuelPrice / 2;
        const totalCost = (fuelNeeded / 5) * fuelPrice;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].fuel = ship.maxFuel;
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
        const totalCost = healthNeeded * GAME_RULES.REPAIR_COST_PER_HP;
        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].health = ship.maxHealth;
        }
    }

    /**
     * @private
     */
    _calculateMaxBuy(goodId, price) {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        const canAfford = price > 0 ? Math.floor(state.player.credits / price) : space;
        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
        return Math.max(0, Math.min(space, canAfford, stock));
    }
}