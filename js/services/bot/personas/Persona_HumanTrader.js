// js/services/bot/personas/Persona_HumanTrader.js
/**
 * @fileoverview This file contains the Persona_HumanTrader class.
 * This is the "Simulated Human" persona. It is the most important
 * persona for balancing the *actual* player experience.
 *
 * This bot's "brain" operates with incomplete and stale information:
 * 1. It instantiates its own "BotMemoryService" to remember prices.
 * 2. It *only* knows the prices at locations it has physically visited.
 * 3. It must decide between "Exploring" (visiting new/old locations
 * to update its memory) and "Exploiting" (running trade routes
 * based on its potentially old data).
 * 4. It logs its performance just like any other bot, allowing a
 * direct A/B comparison against the "HonestTrader" (perfect info)
 * to see if the economy is fair to human-like players.
 */

import { BotPersona } from './BotPersona.js';
import { BotGoal } from '../goals/BotGoal.js';
import { Goal_ExecuteSimpleTrade } from '../goals/Goal_ExecuteSimpleTrade.js';
import { BotAction_TravelTo } from '../actions/Action_TravelTo.js';
import { BotMemoryService } from '../BotMemoryService.js';
import { DB } from '../../../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../../../utils.js';

/**
 * A simple goal for visiting a random market to gather price data.
 */
class Goal_ExploreAndRecord extends BotGoal {
    constructor(persona, locationId) {
        super(persona, `GOAL_EXPLORE_${locationId}`);
        this.locationId = locationId;
    }

    activate() {
        super.activate();
        // The entire goal is just to travel to the location.
        // The persona's main update() loop will handle recording the data.
        this.actionQueue.push(new BotAction_TravelTo(this, this.locationId));
    }
}


export class Persona_HumanTrader extends BotPersona {
    /**
     * @param {import('../../GameState.js').GameState} gameState
     * @param {import('../../SimulationService.js').SimulationService} simulationService
     * @param {import('../../LoggingService.js').Logger} logger
     */
    constructor(gameState, simulationService, logger) {
        super(gameState, simulationService, logger);
        this.personaId = 'HUMAN_TRADER';
        this.MIN_PROFIT_MARGIN = 0.15; // 15% minimum profit margin

        // This persona gets its own memory service
        this.memory = new BotMemoryService(gameState, logger);
    }

    /**
     * The main update tick for the Human Trader.
     * We override this to add a crucial step: RECORDING data.
     * @override
     * @returns {Promise<void>}
     */
    async update() {
        // --- HUMAN TRADER KEY LOGIC ---
        // Before doing anything else, if we are not traveling,
        // we "see" and "remember" the prices at our current location.
        if (this.gameState.pendingTravel === null) {
            const currentPrices = this.gameState.market.prices[this.gameState.currentLocationId];
            this.memory.recordMarketData(this.gameState.currentLocationId, currentPrices);
        }
        // --- END KEY LOGIC ---

        // Now, proceed with the normal goal processing
        await super.update();
    }

    /**
     * The decision-making logic for the Human Trader.
     * @override
     * @returns {import('../goals/BotGoal.js').BotGoal | null}
     */
    findNewGoal() {
        // Decide whether to explore or exploit
        const knownLocations = Object.keys(this.memory.getRememberedMarketData()).length;
        const totalLocations = this.gameState.player.unlockedLocationIds.length;

        // --- 1. Exploration Logic ---
        // If we know less than 50% of locations, or randomly (25% chance), explore.
        const shouldExplore = (knownLocations < (totalLocations / 2)) || (Math.random() < 0.25);

        if (shouldExplore) {
            const unknownLocation = this.gameState.player.unlockedLocationIds.find(locId => {
                return !this.memory.getRememberedMarketData()[locId] && locId !== this.gameState.currentLocationId;
            });
            
            if (unknownLocation) {
                this.logger.info.system(this.personaId, this.gameState.day, 'NEW_GOAL', `Exploring to discover prices at: ${unknownLocation}.`);
                return new Goal_ExploreAndRecord(this, unknownLocation);
            }
        }

        // --- 2. Exploitation Logic ---
        // If not exploring, try to find a trade based on remembered prices.
        const bestTrade = this._findBestRememberedTrade();

        if (bestTrade) {
            this.logger.info.system(this.personaId, this.gameState.day, 'NEW_GOAL', `Found remembered trade. Buy ${bestTrade.goodId} @ ${bestTrade.buyLocationId} (Stale: ${bestTrade.buyDataStaleness}d) -> Sell @ ${bestTrade.sellLocationId} (Stale: ${bestTrade.sellDataStaleness}d).`);
            return new Goal_ExecuteSimpleTrade(this, bestTrade);
        }

        // --- 3. Fallback: Explore ---
        // If we wanted to exploit but found no trades, just go visit a random location to refresh data
        const randomLocation = this.gameState.player.unlockedLocationIds
            .filter(locId => locId !== this.gameState.currentLocationId)
            .sort(() => 0.5 - Math.random())[0]; // Get a random different location

        if (randomLocation) {
            this.logger.info.system(this.personaId, this.gameState.day, 'NEW_GOAL', `No trades found. Visiting random location to refresh data: ${randomLocation}.`);
            return new Goal_ExploreAndRecord(this, randomLocation);
        }

        return null; // Truly idle
    }

    /**
     * Finds the best trade route *using only the bot's memory*.
     * @private
     */
    _findBestRememberedTrade() {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return null;
        
        const cargoCapacity = activeShip.cargoCapacity;
        if (cargoCapacity <= 0) return null;

        let bestTrade = null;
        let maxProfitPerDay = 0;

        const rememberedData = this.memory.getRememberedMarketData();
        const rememberedLocations = Object.keys(rememberedData);
        if (rememberedLocations.length < 2) return null; // Can't trade with < 2 data points

        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier);
        const inventory = this.simulationService._getActiveInventory();

        for (const good of availableCommodities) {
            if (inventory[good.id] && inventory[good.id].quantity > 0) {
                continue; // Skip if already holding
            }

            for (const buyLocationId of rememberedLocations) {
                // We can't know the "live" stock. This is a risk the bot takes.
                const buyPrice = rememberedData[buyLocationId].prices[good.id];
                if (!buyPrice) continue;
                
                for (const sellLocationId of rememberedLocations) {
                    if (buyLocationId === sellLocationId) continue;

                    const sellPrice = rememberedData[sellLocationId].prices[good.id];
                    if (!sellPrice) continue;

                    const profitPerUnit = sellPrice - buyPrice;
                    const profitMargin = (buyPrice > 0) ? (profitPerUnit / buyPrice) : 0;

                    if (profitPerUnit > 0 && profitMargin > this.MIN_PROFIT_MARGIN) {
                        const travelTimeToBuy = state.TRAVEL_DATA[state.currentLocationId]?.[buyLocationId]?.time || 0;
                        const travelTimeToSell = state.TRAVEL_DATA[buyLocationId]?.[sellLocationId]?.time || 0;
                        
                        if (travelTimeToSell === 0) continue; 
                        
                        const totalTime = travelTimeToBuy + travelTimeToSell + 2; 

                        // We *assume* we can buy a full cargo load.
                        // This is a "human" risk. We can't know the live stock.
                        const totalTripProfit = profitPerUnit * cargoCapacity;
                        const profitPerDay = totalTripProfit / totalTime;

                        if (profitPerDay > maxProfitPerDay) {
                            maxProfitPerDay = profitPerDay;
                            bestTrade = {
                                goodId: good.id,
                                buyLocationId: buyLocationId,
                                sellLocationId: sellLocationId,
                                buyPrice,
                                sellPrice,
                                profitPerUnit,
                                estimatedPPD: profitPerDay,
                                // Add staleness for logging
                                buyDataStaleness: state.day - rememberedData[buyLocationId].day,
                                sellDataStaleness: state.day - rememberedData[sellLocationId].day,
                            };
                        }
                    }
                }
            }
        }
        return bestTrade;
    }

    /**
     * Logs a standardized summary report for this persona.
     * @override
     */
    logSummaryReport() {
        // This report is standardized for all new personas
        this.metrics.daysSimulated = this.gameState.day - this.simulationStartDay;
        const { 
            totalTrades, profitableTrades, totalNetProfit, totalFuelCost, 
            totalRepairCost, daysSimulated, profitByGood
        } = this.metrics;
        
        const profitPct = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : 0;
        const profitPerDay = daysSimulated > 0 ? (totalNetProfit / daysSimulated) : 0;

        const header = '=== AUTO-TRADER PERFORMANCE SUMMARY ===';
        this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', header);
        
        const summary = [
            `Strategy Run: ${this.personaId} (Imperfect Info)`,
            `Days Simulated: ${daysSimulated}`,
            `Final Credit Balance: ${formatCredits(this.gameState.player.credits)}`,
            ``,
            `--- Performance ---`,
            `Total Net Profit: ${formatCredits(totalNetProfit)}`,
            `Profit Per Day: ${formatCredits(profitPerDay)}`,
            `Total Trades Completed: ${totalTrades}`,
            `Profitable Trades: ${profitableTrades} (${profitPct}%)`,
            ``,
            `--- Costs ---`,
            `Total Fuel Costs: ${formatCredits(totalFuelCost)}`,
            `Total Repair Costs: ${formatCredits(totalRepairCost)}`,
        ];

        for (const line of summary) {
            this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', `  ${line}`);
        }

        // --- Profit by Good ---
        const profitHeader = `--- Profit Breakdown by Commodity ---`;
        this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', `  ${profitHeader}`);
        
        const sortedGoods = Object.keys(profitByGood || {}).sort((a, b) => profitByGood[b] - profitByGood[a]);
        if (sortedGoods.length === 0) {
             const noData = `No commodity trades recorded.`;
             this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', `    ${noData}`);
        } else {
            for (const goodId of sortedGoods) {
                const profit = profitByGood[goodId];
                const commodityName = DB.COMMODITIES.find(c => c.id === goodId)?.name || goodId;
                const line = `${commodityName}: ${formatCredits(profit)}`;
                this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', `    ${line}`);
            }
        }
        
        const footer = '=======================================';
        this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', footer);
    }
}