// js/services/bot/personas/Persona_HonestTrader.js
/**
 * @fileoverview This file contains the Persona_HonestTrader class.
 * This is the first "modern" persona built on the new Goal/Action
 * framework.
 *
 * This bot's "brain" is simple:
 * 1. It only ever runs simple A-B trades.
 * 2. It has "perfect information" (it reads directly from the
 * game state) to find the absolute best trade route.
 * 3. It will serve as the "ideal" baseline to which we can
 * compare the "HumanTrader" (imperfect info) persona later.
 */

import { BotPersona } from './BotPersona.js';
import { Goal_ExecuteSimpleTrade } from '../goals/Goal_ExecuteSimpleTrade.js';
import { DB } from '../../../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../../../utils.js';

export class Persona_HonestTrader extends BotPersona {
    /**
     * @param {import('../../GameState.js').GameState} gameState
     * @param {import('../../SimulationService.js').SimulationService} simulationService
     * @param {import('../../LoggingService.js').Logger} logger
     */
    constructor(gameState, simulationService, logger) {
        super(gameState, simulationService, logger);
        this.personaId = 'HONEST_TRADER';
        this.MIN_PROFIT_MARGIN = 0.15; // 15% minimum profit margin
    }

    /**
     * The decision-making logic for the Honest Trader.
     * It finds the best simple trade and creates a goal for it.
     * @override
     * @returns {import('../goals/BotGoal.js').BotGoal | null}
     */
    findNewGoal() {
        const bestTrade = this._findBestSimpleTrade();

        if (bestTrade) {
            this.logger.info.system(this.personaId, this.gameState.day, 'NEW_GOAL', `Found new trade. Buy ${bestTrade.goodId} @ ${bestTrade.buyLocationId} -> Sell @ ${bestTrade.sellLocationId}. Est. PPD: ${formatCredits(bestTrade.estimatedPPD)}.`);
            return new Goal_ExecuteSimpleTrade(this, bestTrade);
        } else {
            this.logger.info.system(this.personaId, this.gameState.day, 'IDLE', 'No profitable simple trades found meeting ${this.MIN_PROFIT_MARGIN * 100}% margin.');
            return null; // Bot will be idle
        }
    }

    /**
     * Finds the best simple A-B (non-manipulation) trade route.
     * This is ported from the legacy bot and uses "perfect" information.
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
            // Don't trade if we are already holding some of this good.
            if (inventory[good.id] && inventory[good.id].quantity > 0) {
                continue;
            }

            for (const buyLocation of DB.MARKETS) {
                if (!state.player.unlockedLocationIds.includes(buyLocation.id)) continue;

                const buyStock = state.market.inventory[buyLocation.id][good.id].quantity;
                if (buyStock <= 0) {
                    continue; // Can't buy if it's out of stock
                }

                for (const sellLocation of DB.MARKETS) {
                    if (buyLocation.id === sellLocation.id || !state.player.unlockedLocationIds.includes(sellLocation.id)) continue;

                    // Can't sell to a market that is depleted (stock 0)
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
                        
                        if (travelTimeToSell === 0) continue; // Skip if no travel data
                        
                        // +2 for transaction time (1 day to buy, 1 day to sell)
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
            `Strategy Run: ${this.personaId}`,
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