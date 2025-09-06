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
                const baseline = avg;

                let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY;
                let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH;

                const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodity.id];
                if (commodityMods) {
                    if (commodityMods.volatility_mult) volatility *= commodityMods.volatility_mult;
                    if (commodityMods.mean_reversion_mult) meanReversion *= commodityMods.mean_reversion_mult;
                }

                const priceRange = commodity.basePriceRange[1] - commodity.basePriceRange[0];
                const randomFluctuation = (Math.random() - 0.5) * priceRange * volatility;
                
                let reversionEffect = (baseline - price) * meanReversion;

                if (inventoryItem.rivalArbitrage.isActive && this.gameState.day < inventoryItem.rivalArbitrage.endDay) {
                    reversionEffect = (baseline - price) * 0.20;
                } else if (inventoryItem.rivalArbitrage.isActive) {
                    inventoryItem.rivalArbitrage.isActive = false;
                }

                if (inventoryItem.hoverUntilDay > this.gameState.day) {
                    reversionEffect *= 0.1;
                } else if (inventoryItem.hoverUntilDay > 0) {
                    inventoryItem.hoverUntilDay = 0;
                }

                const pressureEffect = baseline * inventoryItem.marketPressure * -1;
                let newPrice = price + randomFluctuation + reversionEffect + pressureEffect;
                
                if (this._currentSystemState?.modifiers?.commodity?.[commodity.id]?.price) {
                    newPrice *= this._currentSystemState.modifiers.commodity[commodity.id].price;
                }
                
                this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(newPrice));

                inventoryItem.marketPressure *= GAME_RULES.MARKET_PRESSURE_DECAY;
                if (Math.abs(inventoryItem.marketPressure) < 0.001) {
                    inventoryItem.marketPressure = 0;
                }
            });
            this._recordPriceHistory(location.id);
        });
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock using the Inter-Market Logistics Flow model.
     */
    replenishMarketInventory() {
        DB.COMMODITIES.forEach(c => {
            if (c.tier > this.gameState.player.revealedTier) return;

            const producers = [];
            const consumers = [];
            const neutrals = [];

            DB.MARKETS.forEach(m => {
                const modifier = m.availabilityModifier?.[c.id] ?? 1.0;
                if (modifier >= 1.5) producers.push(m);
                else if (modifier <= 0.5) consumers.push(m);
                else neutrals.push(m);
            });

            let totalExport = 0;
            producers.forEach(p => {
                const inventoryItem = this.gameState.market.inventory[p.id][c.id];
                const maxStock = c.canonicalAvailability[1] * (p.availabilityModifier?.[c.id] ?? 1.0);
                const productionRate = 0.25; // Producers generate 25% of max stock per week
                const exportRate = 0.30; // Producers ship out 30% of their current stock
                
                inventoryItem.quantity += Math.ceil(maxStock * productionRate);
                const amountToExport = Math.floor(inventoryItem.quantity * exportRate);
                inventoryItem.quantity -= amountToExport;
                totalExport += amountToExport;
                inventoryItem.quantity = Math.min(maxStock * 1.2, inventoryItem.quantity); // Cap at 120%
            });

            if (consumers.length > 0) {
                const importShare = Math.floor(totalExport / consumers.length);
                consumers.forEach(con => {
                    const inventoryItem = this.gameState.market.inventory[con.id][c.id];
                    const maxStock = c.canonicalAvailability[1] * (con.availabilityModifier?.[c.id] ?? 1.0);
                    
                    const consumptionRate = 0.15; // Consumers use 15% of their stock per week
                    inventoryItem.quantity -= Math.floor(inventoryItem.quantity * consumptionRate);

                    inventoryItem.quantity += importShare;
                    inventoryItem.quantity = Math.min(maxStock, inventoryItem.quantity); // Consumers cap at 100%
                });
            }

            neutrals.forEach(n => {
                const inventoryItem = this.gameState.market.inventory[n.id][c.id];
                const maxStock = c.canonicalAvailability[1] * (n.availabilityModifier?.[c.id] ?? 1.0);
                const replenishRate = 0.06;
                if (inventoryItem.quantity < maxStock) {
                    inventoryItem.quantity = Math.min(maxStock, inventoryItem.quantity + Math.ceil(maxStock * replenishRate));
                }
            });

            // Apply Market Adaptation and System State modifiers globally after logistics
            DB.MARKETS.forEach(market => {
                const inventoryItem = this.gameState.market.inventory[market.id][c.id];
                
                // Market Adaptation due to player pressure
                if (inventoryItem.marketPressure > 0.5 && inventoryItem.lastPlayerInteractionTimestamp > 0) {
                     const maxStock = c.canonicalAvailability[1] * (market.availabilityModifier?.[c.id] ?? 1.0);
                     inventoryItem.quantity = Math.min(inventoryItem.quantity, maxStock * 0.5); // Reduce effective max stock
                }
                
                // System State modifiers
                if (this._currentSystemState?.modifiers?.commodity?.[c.id]?.availability) {
                    inventoryItem.quantity = Math.floor(inventoryItem.quantity * this._currentSystemState.modifiers.commodity[c.id].availability);
                }
            });
        });
    }

    _calculateBaselineStock(market, commodity) {
        const [min, max] = commodity.canonicalAvailability;
        const modifier = market.availabilityModifier?.[commodity.id] ?? 1.0;
        return Math.floor(skewedRandom(min, max) * modifier);
    }

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