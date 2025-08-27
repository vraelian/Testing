// js/services/simulation/MarketService.js
/**
 * @fileoverview This file contains the MarketService class, which handles the simulation
 * of the in-game economy. This includes evolving commodity prices over time based on
 * volatility and mean reversion, as well as replenishing market inventories.
 */
import { GAME_RULES } from '../../data/constants.js';
import { DB } from '../../data/database.js';
import { skewedRandom } from '../../utils.js';

/**
 * @class MarketService
 * @description Manages the economic simulation aspects of the game.
 */
export class MarketService {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     */
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Simulates one week of market price changes for all commodities at all locations.
     * Prices fluctuate based on volatility and a tendency to revert to a baseline average.
     */
    evolveMarketPrices() {
        DB.MARKETS.forEach(location => {
            DB.COMMODITIES.forEach(good => {
                if (good.unlockLevel > this.gameState.player.unlockedCommodityLevel) return;

                const price = this.gameState.market.prices[location.id][good.id];
                const avg = this.gameState.market.galacticAverages[good.id];
                const mod = location.modifiers[good.id] || 1.0;
                const baseline = avg * mod;

                // A random fluctuation for daily market noise.
                const volatility = (Math.random() - 0.5) * 2 * GAME_RULES.DAILY_PRICE_VOLATILITY;
                // A pull back towards the location's baseline price.
                const reversion = (baseline - price) * GAME_RULES.MEAN_REVERSION_STRENGTH;
                
                this.gameState.market.prices[location.id][good.id] = Math.max(1, Math.round(price + price * volatility + reversion));
            });
        });
        this._recordPriceHistory();
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock at all markets.
     */
    replenishMarketInventory() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                 if (c.unlockLevel > this.gameState.player.unlockedCommodityLevel) return;

                const inventoryItem = this.gameState.market.inventory[market.id][c.id];
                const avail = this._getTierAvailability(c.tier);
                const maxStock = avail.max;
                const replenishRate = 0.1; // Replenish 10% of max stock per weekly cycle.

                if (inventoryItem.quantity < maxStock) {
                    inventoryItem.quantity = Math.min(maxStock, inventoryItem.quantity + Math.ceil(maxStock * replenishRate));
                }

                // Ensure locations with special demand for an item never have it in stock to sell.
                if (market.specialDemand && market.specialDemand[c.id]) {
                    inventoryItem.quantity = 0;
                }
            });
        });
    }

    /**
     * Returns the minimum and maximum potential stock for a commodity based on its tier.
     * @param {number} tier - The tier of the commodity.
     * @returns {{min: number, max: number}} An object with min and max stock values.
     * @private
     */
    _getTierAvailability(tier) {
        switch (tier) {
            case 1: return { min: 6, max: 240 };
            case 2: return { min: 4, max: 200 };
            case 3: return { min: 3, max: 120 };
            case 4: return { min: 2, max: 40 };
            case 5: return { min: 1, max: 20 };
            case 6: return { min: 0, max: 20 };
            case 7: return { min: 0, max: 10 };
            default: return { min: 0, max: 5 };
        }
    }

    /**
     * Records the current day's price for each commodity to its historical data log for graphing.
     * Trims old entries to maintain a fixed history length.
     * @private
     */
    _recordPriceHistory() {
        if (!this.gameState || !this.gameState.market) return;
        DB.MARKETS.forEach(market => {
            if (!this.gameState.market.priceHistory[market.id]) this.gameState.market.priceHistory[market.id] = {};
            DB.COMMODITIES.forEach(good => {
                if (good.unlockLevel > this.gameState.player.unlockedCommodityLevel) return;
                if (!this.gameState.market.priceHistory[market.id][good.id]) this.gameState.market.priceHistory[market.id][good.id] = [];
                
                const history = this.gameState.market.priceHistory[market.id][good.id];
                const currentPrice = this.gameState.market.prices[market.id][good.id];
                
                history.push({ day: this.gameState.day, price: currentPrice });
                
                // Ensure the history log does not exceed the maximum length defined in game rules.
                while (history.length > GAME_RULES.PRICE_HISTORY_LENGTH) {
                    history.shift();
                }
            });
        });
    }
}