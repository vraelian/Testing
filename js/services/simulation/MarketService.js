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
     * and player-driven market pressure.
     */
    evolveMarketPrices() {
        DB.MARKETS.forEach(location => {
            DB.COMMODITIES.forEach(commodity => {
                if (commodity.tier > this.gameState.player.revealedTier) return;

                const inventoryItem = this.gameState.market.inventory[location.id][commodity.id];
                const price = this.gameState.market.prices[location.id][commodity.id];
                const avg = this.gameState.market.galacticAverages[commodity.id];
                const baseline = avg; // Re-centered on galactic average, ignoring static location modifiers for price.

                /** @description The base volatility for price fluctuations from game rules. */
                let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY;

                /** @description The base strength of the pull towards the galactic average from game rules. */
                let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH;

                // Check for an active system state and get modifiers for the current commodity.
                const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodity.id];

                // If modifiers exist, apply them to the baseline values for this calculation tick.
                if (commodityMods) {
                    if (commodityMods.volatility_mult) {
                        volatility *= commodityMods.volatility_mult;
                    }
                    if (commodityMods.mean_reversion_mult) {
                        meanReversion *= commodityMods.mean_reversion_mult;
                    }
                }

                // A random fluctuation based on the commodity's inherent volatility.
                const priceRange = commodity.basePriceRange[1] - commodity.basePriceRange[0];
                const randomFluctuation = (Math.random() - 0.5) * priceRange * volatility;
                
                let reversionEffect = (baseline - price) * meanReversion;

                // Check for 'Rival Arbitrage' state, which drastically accelerates mean reversion.
                if (inventoryItem.rivalArbitrage.isActive && this.gameState.day < inventoryItem.rivalArbitrage.endDay) {
                    reversionEffect = (baseline - price) * 0.20; // Boosted to 20%
                } else if (inventoryItem.rivalArbitrage.isActive) {
                    inventoryItem.rivalArbitrage.isActive = false; // Reset the state.
                }

                // Check for a 'hover' state, which suppresses strong mean reversion for a few days.
                if (inventoryItem.hoverUntilDay > this.gameState.day) {
                    // While hovering, apply a much weaker reversion effect, allowing the price to fluctuate near its peak/trough.
                    reversionEffect *= 0.1;
                } else if (inventoryItem.hoverUntilDay > 0) {
                    // Reset the hover state once the timer expires.
                    inventoryItem.hoverUntilDay = 0;
                }


                // Apply player-driven market pressure (positive pressure = surplus = lower price).
                const pressureEffect = baseline * inventoryItem.marketPressure * -1;
                
                let newPrice = price + randomFluctuation + reversionEffect + pressureEffect;
                
                // Apply system state modifiers.
                if (this._currentSystemState?.modifiers?.commodity?.[commodity.id]?.price) {
                    newPrice *= this._currentSystemState.modifiers.commodity[commodity.id].price;
                }
                
                this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(newPrice));

                // Decay market pressure over time.
                inventoryItem.marketPressure *= GAME_RULES.MARKET_PRESSURE_DECAY;
                if (Math.abs(inventoryItem.marketPressure) < 0.001) {
                    inventoryItem.marketPressure = 0;
                }
            });
            // Record history for this specific location after its prices have evolved for the day.
            this._recordPriceHistory(location.id);
        });
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock at all markets, respecting market memory.
     */
    replenishMarketInventory() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                 if (c.tier > this.gameState.player.revealedTier) return;

                const inventoryItem = this.gameState.market.inventory[market.id][c.id];
                
                // Market Memory Check: If player hasn't touched this market in 60 days, reset it.
                if (inventoryItem.lastPlayerInteractionTimestamp > 0 && (this.gameState.day - inventoryItem.lastPlayerInteractionTimestamp) > 60) {
                    inventoryItem.quantity = this._calculateBaselineStock(market, c);
                    inventoryItem.lastPlayerInteractionTimestamp = 0; // Reset timestamp
                    inventoryItem.marketPressure = 0; // Reset pressure
                } else {
                    // Standard, slow replenishment.
                    const maxStock = c.canonicalAvailability[1] * (market.availabilityModifier?.[c.id] ?? 1.0);
                    const replenishRate = 0.06; // Replenish 6% of max stock per weekly cycle.
                    if (inventoryItem.quantity < maxStock) {
                        inventoryItem.quantity = Math.min(maxStock, inventoryItem.quantity + Math.ceil(maxStock * replenishRate));
                    }
                }
                
                // Apply system state modifiers.
                if (this._currentSystemState?.modifiers?.commodity?.[c.id]?.availability) {
                    inventoryItem.quantity = Math.floor(inventoryItem.quantity * this._currentSystemState.modifiers.commodity[c.id].availability);
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
     * Can be targeted to a specific market, or will default to the player's current location.
     * @param {string} [marketId=null] - The ID of the market to record history for. Defaults to the current location.
     * @private
     */
    _recordPriceHistory(marketId = null) {
        if (!this.gameState || !this.gameState.market) return;

        const targetMarketId = marketId || this.gameState.currentLocationId;

        if (!this.gameState.market.priceHistory[targetMarketId]) {
            this.gameState.market.priceHistory[targetMarketId] = {};
        }

        DB.COMMODITIES.forEach(good => {
            if (good.tier > this.gameState.player.revealedTier) return;

            if (!this.gameState.market.priceHistory[targetMarketId][good.id]) {
                this.gameState.market.priceHistory[targetMarketId][good.id] = [];
            }

            const history = this.gameState.market.priceHistory[targetMarketId][good.id];
            const currentPrice = this.gameState.market.prices[targetMarketId][good.id];

            const lastEntry = history[history.length - 1];
            if (lastEntry && lastEntry.day === this.gameState.day) {
                if (lastEntry.price !== currentPrice) {
                    lastEntry.price = currentPrice;
                }
            } else {
                history.push({ day: this.gameState.day, price: currentPrice });
            }

            while (history.length > GAME_RULES.PRICE_HISTORY_LENGTH) {
                history.shift();
            }
        });
    }
}