// js/services/simulation/MarketService.js
/**
 * @fileoverview This file contains the MarketService class, which handles the simulation
 * of the in-game economy. This includes evolving commodity prices over time based on
 * volatility and market pressure, replenishing market inventories with persistence,
 * and managing system-wide economic states.
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
        this._currentSystemState = null;
        this._systemStateExpirationDay = 0;
        this.lastCalculatedPressures = {}; // Cache for tooltip data
    }

    /**
     * Retrieves the most recently calculated market pressure values for a specific commodity.
     * @param {string} locationId - The ID of the market location.
     * @param {string} commodityId - The ID of the commodity.
     * @returns {object|null} An object containing the pressure values, or null if not found.
     */
    getMarketPressures(locationId, commodityId) {
        return this.lastCalculatedPressures[locationId]?.[commodityId] || null;
    }


    /**
     * Checks if the current system-wide economic state should change and applies a new one if necessary.
     */
    checkForSystemStateChange() {
        if (this.gameState.day > this._systemStateExpirationDay) {
            const systemStates = Object.keys(DB.SYSTEM_STATES);
            const selectedStateKey = systemStates[Math.floor(Math.random() * systemStates.length)];
            this._currentSystemState = DB.SYSTEM_STATES[selectedStateKey];
            this._systemStateExpirationDay = this.gameState.day + this._currentSystemState.duration;
        }
    }

    /**
     * Simulates one week of market price changes for all commodities at all locations.
     * Prices fluctuate based on individual volatility, a tendency to revert to a baseline average,
     * and player-driven market pressure. It also caches these pressure calculations for the UI.
     */
    evolveMarketPrices() {
        DB.MARKETS.forEach(location => {
            if (!this.lastCalculatedPressures[location.id]) {
                this.lastCalculatedPressures[location.id] = {};
            }

            DB.COMMODITIES.forEach(commodity => {
                if (commodity.unlockLevel > this.gameState.player.unlockedCommodityLevel) return;

                const inventoryItem = this.gameState.market.inventory[location.id][commodity.id];
                const price = this.gameState.market.prices[location.id][commodity.id];

                // A random fluctuation based on the commodity's inherent volatility.
                const volatility = (Math.random() - 0.5) * 2 * commodity.volatility;

                // Apply player-driven market pressure (positive pressure = surplus = lower price).
                const pressureEffect = price * inventoryItem.marketPressure * -1;
                
                let newPrice = price + (price * volatility) + pressureEffect;
                
                // Apply system state modifiers.
                if (this._currentSystemState?.modifiers?.commodity[commodity.id]?.price) {
                    newPrice *= this._currentSystemState.modifiers.commodity[commodity.id].price;
                }
                
                // Cache the raw pressure values for the tooltip before applying the new price.
                this.lastCalculatedPressures[location.id][commodity.id] = {
                    volatility: (price * volatility),
                    localTrading: pressureEffect
                };

                this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(newPrice));

                // Decay market pressure over time.
                inventoryItem.marketPressure *= GAME_RULES.MARKET_PRESSURE_DECAY;
                if (Math.abs(inventoryItem.marketPressure) < 0.001) {
                    inventoryItem.marketPressure = 0;
                }
            });
        });
        this._recordPriceHistory();
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock at all markets, respecting market memory.
     */
    replenishMarketInventory() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                 if (c.unlockLevel > this.gameState.player.unlockedCommodityLevel) return;

                const inventoryItem = this.gameState.market.inventory[market.id][c.id];
                
                // Market Memory Check: If player hasn't touched this market in 60 days, reset it.
                if (inventoryItem.lastPlayerInteractionTimestamp > 0 && (this.gameState.day - inventoryItem.lastPlayerInteractionTimestamp) > 60) {
                    inventoryItem.quantity = this._calculateBaselineStock(market, c);
                    inventoryItem.lastPlayerInteractionTimestamp = 0; // Reset timestamp
                    inventoryItem.marketPressure = 0; // Reset pressure
                } else {
                    // Standard, slow replenishment.
                    const maxStock = c.canonicalAvailability[1] * (market.availabilityModifier?.[c.id] ?? 1.0);
                    const replenishRate = 0.1; // Replenish 10% of max stock per weekly cycle.
                    if (inventoryItem.quantity < maxStock) {
                        inventoryItem.quantity = Math.min(maxStock, inventoryItem.quantity + Math.ceil(maxStock * replenishRate));
                    }
                }
                
                // Apply system state modifiers.
                if (this._currentSystemState?.modifiers?.commodity[c.id]?.availability) {
                    inventoryItem.quantity = Math.floor(inventoryItem.quantity * this._currentSystemState.modifiers.commodity[c.id].availability);
                }

                // Ensure locations with special demand for an item never have it in stock to sell.
                if (market.specialDemand && market.specialDemand[c.id]) {
                    inventoryItem.quantity = 0;
                }
            });
        });
    }

    /**
     * Calculates the baseline (initial or reset) stock for a commodity at a specific location.
     * @param {object} market - The market object from the database.
     * @param {object} commodity - The commodity object from the database.
     * @returns {number} The calculated baseline stock quantity.
     * @private
     */
    _calculateBaselineStock(market, commodity) {
        const [min, max] = commodity.canonicalAvailability;
        const modifier = market.availabilityModifier?.[commodity.id] ?? 1.0;
        return Math.floor(skewedRandom(min, max) * modifier);
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