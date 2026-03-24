// js/services/simulation/MarketService.js
/**
 * @fileoverview This file contains the MarketService class, which handles the simulation
 * of the in-game economy. This includes evolving commodity prices over time based on
 * volatility and market pressure, replenishing market inventories with persistence,
 * and managing system-wide economic states.
 */
import { GAME_RULES, COMMODITY_IDS, LOCATION_IDS } from '../../data/constants.js'; 
import { DB } from '../../data/database.js';
import { skewedRandom } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js';
import { AssetService } from '../../services/AssetService.js'; 

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
     * Wipes all player-driven market pressure and interactions, resetting the simulation to a baseline state.
     * Used during extreme time skips (indentured servitude).
     */
    wipePlayerInfluence() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                const inventoryItem = this.gameState.market.inventory[market.id]?.[c.id];
                if (inventoryItem) {
                    inventoryItem.marketPressure = 0;
                    inventoryItem.lastPlayerInteractionTimestamp = 0;
                    inventoryItem.priceLockEndDay = 0;
                    inventoryItem.isDepleted = false;
                    inventoryItem.isSaturated = false;
                    inventoryItem.depletionDay = 0;
                    inventoryItem.depletionBonusDay = 0;
                    inventoryItem.hoverUntilDay = 0;
                    inventoryItem.rivalArbitrage = { isActive: false, endDay: 0 };
                    
                    // Hard reset quantity to a neutral baseline
                    inventoryItem.quantity = this._calculateBaselineStock(market, c);
                }
            });
        });
        
        // Evolve once to immediately align prices against the new baseline
        this.evolveMarketPrices();
    }

    // --- VIRTUAL WORKBENCH: UPDATED getPrice ---

    /**
     * Gets the effective price for a commodity at a location.
     * Checks for active intel deal overrides first.
     * Optionally applies player-specific modifiers (e.g. Signal Hacker).
     * @param {string} locationId The ID of the location.
     * @param {string} commodityId The ID of the commodity.
     * @param {boolean} [applyModifiers=false] If true, applies active ship upgrade modifiers (Buy Price).
     * @returns {number} The effective price.
     */
    getPrice(locationId, commodityId, applyModifiers = false) {
        const state = this.gameState.getState();
        const deal = state.activeIntelDeal;
        let basePrice = this.gameState.market.prices[locationId]?.[commodityId] || 0;

        // --- VIRTUAL WORKBENCH: DYNAMIC MARKET CONDITIONS ---
        // Apply temporary massive multipliers dynamically here, NOT in state evolution
        const inventoryItem = this.gameState.market.inventory[locationId]?.[commodityId];
        if (inventoryItem) {
            if (inventoryItem.isDepleted) {
                const location = DB.MARKETS.find(m => m.id === locationId);
                const panicMult = location?.ecoProfile?.panicMult ?? 1.5;
                basePrice *= panicMult;
            }
            if (inventoryItem.isSaturated) {
                basePrice *= 0.25;
            }
        }
        
        // Direct System State commodity price overrides
        if (this._currentSystemState?.modifiers?.commodity?.[commodityId]?.price) {
            basePrice *= this._currentSystemState.modifiers.commodity[commodityId].price;
        }
        // --- END DYNAMIC MARKET CONDITIONS ---

        let price = basePrice;

        // 1. Intel Deal Override Check
        if (deal &&
            deal.locationId === locationId &&
            deal.commodityId === commodityId) {
            
            // If a deal is active, use the price (which is being fluctuated daily in evolveMarketPrices 
            // around the overridePrice).
            price = this.gameState.market.prices[locationId]?.[commodityId] || deal.overridePrice;
        }

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (PRICE BOOSTS) ---
        // Earth Quirk: +10% Sell Price for Cloned Organs & Xeno-Geologicals
        if (locationId === LOCATION_IDS.EARTH && 
            (commodityId === COMMODITY_IDS.CLONED_ORGANS || commodityId === COMMODITY_IDS.XENO_GEOLOGICALS)) {
            price = price * 1.10;
        }

        // Mars Quirk: +10% Sell Price for Water Ice & Hydroponics
        if (locationId === LOCATION_IDS.MARS &&
            (commodityId === COMMODITY_IDS.WATER_ICE || commodityId === COMMODITY_IDS.HYDROPONICS)) {
            price = price * 1.10;
        }

        // Saturn Quirk: +20% Sell Price for Cloned Organs & Cryo-Sleep Pods
        if (locationId === LOCATION_IDS.SATURN &&
            (commodityId === COMMODITY_IDS.CLONED_ORGANS || commodityId === COMMODITY_IDS.CRYO_PODS)) {
            price = price * 1.20;
        }

        // Pluto Quirk: +25% Sell Price for Cybernetics & Antimatter
        if (locationId === LOCATION_IDS.PLUTO &&
            (commodityId === COMMODITY_IDS.CYBERNETICS || commodityId === COMMODITY_IDS.ANTIMATTER)) {
            price = price * 1.25;
        }

        // Mercury Quirk: +40% Sell Price for Water Ice
        if (locationId === LOCATION_IDS.MERCURY &&
            commodityId === COMMODITY_IDS.WATER_ICE) {
            price = price * 1.40;
        }

        // Sol Quirk: +25% Sell Price for Graphene Lattices & Plasteel
        if (locationId === LOCATION_IDS.SUN &&
            (commodityId === COMMODITY_IDS.PLASTEEL || commodityId === COMMODITY_IDS.GRAPHENE_LATTICES)) {
            price = price * 1.25;
        }
        // --- END VIRTUAL WORKBENCH ---

        // 2. Upgrade Modifiers (Signal Hacker)
        if (applyModifiers) {
             const activeShipId = this.gameState.player.activeShipId;
             // Safety check: Ensure we have a valid ship state to read upgrades from
             if (activeShipId && this.gameState.player.shipStates[activeShipId]) {
                 const upgrades = this.gameState.player.shipStates[activeShipId].upgrades || [];
                 // Fetch the 'buy' modifier (e.g., 0.97 for Signal Hacker I)
                 const mod = GameAttributes.getPriceModifier(upgrades, 'buy');
                 price = price * mod;
             }
        }

        // --- PHASE 2: HOT INTEL INTEGRATION ---
        const activeHotIntel = state.activeHotIntel;
        if (activeHotIntel && 
            activeHotIntel.locationId === locationId && 
            activeHotIntel.commodityId === commodityId) {
            price = price * activeHotIntel.discountMultiplier;
        }

        // Ensure price never drops below 1
        return Math.max(1, Math.round(price));
    }

    /**
     * Retrieves the pre-calculated galactic average price for a commodity.
     * @param {string} commodityId The ID of the commodity.
     * @returns {number} The galactic average price.
     */
    getGalacticAverage(commodityId) {
        return this.gameState.market.galacticAverages[commodityId] || 0;
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

                // Enforce Intel Price Lock
                const activeDeal = this.gameState.activeIntelDeal;
                if (activeDeal &&
                     activeDeal.locationId === location.id &&
                     activeDeal.commodityId === commodity.id)
                {
                    const basePrice = activeDeal.overridePrice;
                    const fluctuation = 0.03; // 3%
                    const minPrice = basePrice * (1 - fluctuation);
                    const maxPrice = basePrice * (1 + fluctuation);
                    
                    const fluctuatedPrice = Math.random() * (maxPrice - minPrice) + minPrice;
                    
                    this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(fluctuatedPrice));
                    return; 
                }

                const inventoryItem = this.gameState.market.inventory[location.id][commodity.id];
                const price = this.gameState.market.prices[location.id][commodity.id];
                const avg = this.gameState.market.galacticAverages[commodity.id];

                const modifier = location.availabilityModifier?.[commodity.id] ?? 1.0;

                // --- SYSTEM STATES V3 HOOKS (Prices) ---
                const systemState = this.gameState.systemState;
                const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
                const isTargetLocation = systemState && systemState.targetLocations?.includes(location.id);

                let basePriceMod = 1.0;
                let activeStateMeanReversionMod = 1.0;

                if (activeStateDef && activeStateDef.modifiers) {
                    const mods = activeStateDef.modifiers;
                    if (mods.meanReversionMod) activeStateMeanReversionMod = mods.meanReversionMod;
                    
                    if (mods.affectedCommodities?.includes(commodity.id) && mods.basePriceInflate) {
                        basePriceMod *= mods.basePriceInflate;
                    }
                    if (isTargetLocation) {
                        if (mods.localBasePriceInflate) basePriceMod *= mods.localBasePriceInflate;
                        if (mods.localBasePriceMod) basePriceMod *= mods.localBasePriceMod;
                    }
                }
                // --- END SYSTEM STATES V3 ---

                const targetPriceOffset = (1.0 - modifier) * avg;
                const localBaseline = (avg * basePriceMod) + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);

                let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY;
                
                if (location.id === LOCATION_IDS.EXCHANGE) {
                    volatility *= 3.0; // 3x Price Volatility at The Exchange
                }

                let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH * activeStateMeanReversionMod;
                
                if (location.ecoProfile?.meanReversionMod) {
                    meanReversion *= location.ecoProfile.meanReversionMod;
                }

                const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodity.id];
                if (commodityMods) {
                    if (commodityMods.volatility_mult) volatility *= commodityMods.volatility_mult;
                    if (commodityMods.mean_reversion_mult) meanReversion *= commodityMods.meanReversion_mult;
                }

                const priceRange = commodity.basePriceRange[1] - commodity.basePriceRange[0];
                const randomFluctuation = (Math.random() - 0.5) * priceRange * volatility;
                
                let reversionEffect = (localBaseline - price) * meanReversion;

                // Variable Reversion Delay (Price Lock)
                if (this.gameState.day < inventoryItem.priceLockEndDay) {
                    reversionEffect = 0;
                }

                if (inventoryItem.rivalArbitrage.isActive && this.gameState.day < inventoryItem.rivalArbitrage.endDay) {
                    reversionEffect = (localBaseline - price) * 0.20;
                } else if (inventoryItem.rivalArbitrage.isActive) {
                    inventoryItem.rivalArbitrage.isActive = false;
                }

                if (inventoryItem.hoverUntilDay > this.gameState.day) {
                     reversionEffect *= 0.1;
                } else if (inventoryItem.hoverUntilDay > 0) {
                    inventoryItem.hoverUntilDay = 0;
                }

                // Delayed Player Pressure
                let pressureEffect = 0;
                const PLAYER_PRESSURE_STRENGTH = 0.50; 
                
                if (this.gameState.day >= inventoryItem.lastPlayerInteractionTimestamp + 7) {
                    if (inventoryItem.lastPlayerInteractionTimestamp > 0) {
                         pressureEffect = (localBaseline * inventoryItem.marketPressure * -1) * PLAYER_PRESSURE_STRENGTH;
                    }
                }

                // Calculate the true simulation baseline price (Modifiers removed from here)
                let newPrice = price + randomFluctuation + reversionEffect + pressureEffect;
                const finalRoundedPrice = Math.max(1, Math.round(newPrice));
                
                this.gameState.market.prices[location.id][commodity.id] = finalRoundedPrice;

                // TELEMETRY: Gated execution
                if (this.gameState.uiState?.enableEconomicTelemetry) {
                    const priceShiftPct = Math.abs(finalRoundedPrice - price) / price;
                    const isSignificant = priceShiftPct > 0.05 || inventoryItem.isDepleted || inventoryItem.isSaturated;
                    const isVerbose = this.gameState.uiState?.verboseTickLogging !== false; // Default to true if unset

                    if (isVerbose || isSignificant) {
                        if (!this.gameState.telemetry) this.gameState.telemetry = { ticks: [], trades: [], impacts: [] };
                        
                        this.gameState.telemetry.ticks.push({
                            day: this.gameState.day,
                            type: 'EVOLVE_TICK',
                            locationId: location.id,
                            commodityId: commodity.id,
                            oldPrice: price,
                            newPrice: finalRoundedPrice,
                            localBaseline: Number(localBaseline.toFixed(2)),
                            reversionEffect: Number(reversionEffect.toFixed(2)),
                            pressureEffect: Number(pressureEffect.toFixed(2)),
                            currentStock: inventoryItem.quantity,
                            marketPressure: Number(inventoryItem.marketPressure.toFixed(4)),
                            isDepleted: inventoryItem.isDepleted || false,
                            isSaturated: inventoryItem.isSaturated || false
                        });

                        if (this.gameState.telemetry.ticks.length > 2000) this.gameState.telemetry.ticks.shift();
                    }
                }

                let decayMod = 1.0;
                if (inventoryItem.marketPressure > 0 && location.ecoProfile?.recoveryMod) {
                    decayMod = 1.0 / location.ecoProfile.recoveryMod;
                }

                inventoryItem.marketPressure *= (GAME_RULES.MARKET_PRESSURE_DECAY * decayMod);
                if (Math.abs(inventoryItem.marketPressure) < 0.001) {
                    inventoryItem.marketPressure = 0;
                }
            });
            this._recordPriceHistory(location.id);
        });
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock using a hybrid model.
     */
    replenishMarketInventory() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                if (c.tier > this.gameState.player.revealedTier) return;

                const inventoryItem = this.gameState.market.inventory[market.id][c.id];

                // --- SYSTEM STATES V3 HOOKS (Replenishment) ---
                const systemState = this.gameState.systemState;
                const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
                const isTargetLocation = systemState && systemState.targetLocations?.includes(market.id);

                let targetStockMod = 1.0;
                
                let replenishRate = market.ecoProfile?.commodityReplenishRates?.[c.id] ?? market.ecoProfile?.replenishRate ?? 0.10;

                if (activeStateDef && activeStateDef.modifiers) {
                    const mods = activeStateDef.modifiers;
                    if (mods.replenishmentRateMod !== undefined) replenishRate = mods.replenishmentRateMod;
                    if (isTargetLocation && mods.localReplenishmentMod !== undefined) replenishRate = mods.localReplenishmentMod;

                    if (mods.targetStockTiers?.includes(c.tier) && mods.targetStockMod) targetStockMod *= mods.targetStockMod;
                    if (mods.affectedCommodities?.includes(c.id) && mods.targetStockMod) targetStockMod *= mods.targetStockMod;
                    if (mods.meanReversionMod && mods.targetStockMod) targetStockMod *= mods.targetStockMod;
                    
                    if (isTargetLocation && mods.localTargetStockMod) targetStockMod *= mods.localTargetStockMod;
                }
                // --- END SYSTEM STATES V3 ---

                if (inventoryItem.lastPlayerInteractionTimestamp > 0 && (this.gameState.day - inventoryItem.lastPlayerInteractionTimestamp) > 365) {
                    inventoryItem.quantity = this._calculateBaselineStock(market, c) * targetStockMod;
                    inventoryItem.lastPlayerInteractionTimestamp = 0;
                    inventoryItem.marketPressure = 0;
                    inventoryItem.depletionDay = 0; 
                    inventoryItem.priceLockEndDay = 0; 
                    inventoryItem.isDepleted = false;
                    inventoryItem.isSaturated = false; 
                } else {
                    const [minAvail, maxAvail] = c.canonicalAvailability;
                    const baseMeanStock = (minAvail + maxAvail) / 2 * (market.availabilityModifier?.[c.id] ?? 1.0);
                    
                    let pressureForAdaptation = inventoryItem.marketPressure;
                    if (pressureForAdaptation < 0 && this.gameState.day < inventoryItem.lastPlayerInteractionTimestamp + 7) {
                        pressureForAdaptation = 0; 
                    }

                    if (pressureForAdaptation > 0) {
                        pressureForAdaptation = 0;
                    }

                    const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5); 
                    
                    const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;

                    const targetStock = baseMeanStock * marketAdaptationFactor * (1 + supplyBonus) * targetStockMod;

                    const difference = targetStock - inventoryItem.quantity;
                    const replenishAmount = difference * replenishRate; 
                    
                    let emergencyStock = 0;
                    if (inventoryItem.isDepleted) {
                        emergencyStock = skewedRandom(1, 5);
                    } else if (inventoryItem.quantity <= 0) {
                        emergencyStock = skewedRandom(1, 5);
                    }

                    inventoryItem.quantity += (replenishAmount + emergencyStock);

                    if (inventoryItem.isDepleted && inventoryItem.quantity >= (targetStock * 0.60)) {
                        inventoryItem.isDepleted = false;
                    }

                    if (inventoryItem.isSaturated && inventoryItem.quantity <= (targetStock * 2.0)) {
                        inventoryItem.isSaturated = false;
                    }
                }

                if (!market.ecoProfile?.disableFluctuation) {
                    const fluctuationPercent = (Math.random() * 0.15 + 0.15); 
                    const fluctuationDirection = Math.random() < 0.5 ? -1 : 1;
                    const finalFluctuation = 1 + (fluctuationPercent * fluctuationDirection);
                    inventoryItem.quantity *= finalFluctuation;
                }
                
                if (this._currentSystemState?.modifiers?.commodity?.[c.id]?.availability) {
                    inventoryItem.quantity *= this._currentSystemState.modifiers.commodity[c.id].availability;
                }
                
                inventoryItem.quantity = Math.max(0, Math.round(inventoryItem.quantity));
            });
        });
    }

    /**
     * Applies a dynamic price adjustment to a commodity based on the volume of a player's transaction.
     * @param {string} goodId - The ID of the commodity traded.
     * @param {number} quantity - The amount traded.
     * @param {string} transactionType - 'buy' or 'sell'.
     */
    applyMarketImpact(goodId, quantity, transactionType) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const market = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        const inventoryItem = this.gameState.market.inventory[this.gameState.currentLocationId][goodId];
        
        let pressureMod = market?.ecoProfile?.dampeners?.[goodId] ?? market?.ecoProfile?.pressureMod ?? 1.0;

        const pressureChange = (((quantity / (good.canonicalAvailability[1] || 100)) * good.tier) / 10) * pressureMod;
        
        if (transactionType === 'buy') {
            inventoryItem.marketPressure -= pressureChange;
        } else { 
            inventoryItem.marketPressure += pressureChange;
            
            const [minAvail, maxAvail] = good.canonicalAvailability;
            const modifier = market.availabilityModifier?.[goodId] ?? 1.0;
            const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
            
            let pressureForAdaptation = inventoryItem.marketPressure;
            if (pressureForAdaptation > 0) pressureForAdaptation = 0; 
            
            const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
            const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
            const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));
            
            if (inventoryItem.quantity > (targetStock * 3.0)) {
                inventoryItem.isSaturated = true;
                if (this.gameState.systemState && this.gameState.systemState.economyFootprints) {
                    this.gameState.systemState.economyFootprints.push({
                        day: this.gameState.day, type: 'SATURATION', locationId: this.gameState.currentLocationId, commodityId: good.id
                    });
                }
            }
        }

        const baseLock = 60;
        const distanceBonus = (market?.distance || 0) * 0.20;
        const targetLock = baseLock + distanceBonus;
        const jitter = targetLock * 0.10; 
        
        const lockDuration = Math.floor(targetLock + (Math.random() * (jitter * 2) - jitter));
        inventoryItem.priceLockEndDay = this.gameState.day + lockDuration;

        inventoryItem.lastPlayerInteractionTimestamp = this.gameState.day;

        // TELEMETRY: Gated execution
        if (this.gameState.uiState?.enableEconomicTelemetry) {
            if (!this.gameState.telemetry) this.gameState.telemetry = { ticks: [], trades: [], impacts: [] };
            
            this.gameState.telemetry.impacts.push({
                day: this.gameState.day,
                type: 'MARKET_IMPACT',
                locationId: market.id,
                commodityId: goodId,
                action: transactionType,
                quantityTraded: quantity,
                pressureChange: Number(pressureChange.toFixed(4)),
                resultingPressure: Number(inventoryItem.marketPressure.toFixed(4)),
                lockDuration: lockDuration,
                isSaturated: inventoryItem.isSaturated || false
            });

            if (this.gameState.telemetry.impacts.length > 1000) this.gameState.telemetry.impacts.shift();
        }
    }

    /**
     * Checks if a purchase triggers a market depletion event.
     * @param {object} good - The static commodity data (from DB).
     * @param {object} inventoryItem - The dynamic inventory item from gameState.
     * @param {number} stockBeforeBuy - The quantity of the item *before* the player's purchase.
     * @param {number} currentDay - The current game day.
     */
    checkDepletion(good, inventoryItem, stockBeforeBuy, currentDay) {
        const market = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        const [minAvail, maxAvail] = good.canonicalAvailability;
        const modifier = market.availabilityModifier?.[good.id] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        let pressureForAdaptation = inventoryItem.marketPressure;
        if (pressureForAdaptation > 0) pressureForAdaptation = 0; 
        
        const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor);
        
        const depletionThreshold = targetStock * 0.08;
        const depletionBuyQuantity = stockBeforeBuy; 

        if (depletionBuyQuantity >= depletionThreshold && currentDay > (inventoryItem.depletionBonusDay + 365)) {
            inventoryItem.isDepleted = true; 
            inventoryItem.depletionDay = currentDay;
            inventoryItem.depletionBonusDay = currentDay; 

            if (this.gameState.systemState && this.gameState.systemState.economyFootprints) {
                this.gameState.systemState.economyFootprints.push({
                    day: currentDay, type: 'DEPLETION', locationId: this.gameState.currentLocationId, commodityId: good.id
                });
            }
        }
    }

    /**
     * Calculates the baseline (initial or reset) stock for a commodity at a specific location.
     * @private
     */
    _calculateBaselineStock(market, commodity) {
        const [min, max] = commodity.canonicalAvailability;
        const modifier = market.availabilityModifier?.[commodity.id] ?? 1.0;
        return Math.floor(skewedRandom(min, max) * modifier);
    }

    /**
     * Records the current day's price for each commodity to its historical data log for graphing.
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

    /**
     * Updates the shipyard stock for all unlocked locations on a weekly basis.
     * @private
     */
    _updateShipyardStock() {
        const { player } = this.gameState;
        player.unlockedLocationIds.forEach(locationId => {
            const stock = this.gameState.market.shipyardStock[locationId];
            if (stock && stock.day === this.gameState.day) return;
            const commonShips = Object.entries(DB.SHIPS).filter(([id, ship]) => !ship.isRare && ship.saleLocationId === locationId && !player.ownedShipIds.includes(id));
            const rareShips = Object.entries(DB.SHIPS).filter(([id, ship]) => ship.isRare && ship.saleLocationId === locationId && !player.ownedShipIds.includes(id));
            const shipsForSaleIds = [...commonShips.map(entry => entry[0])];
            
            const spawnRateBonus = this.gameState.player.statModifiers?.shipSpawnRate || 0;
            const finalSpawnChance = GAME_RULES.RARE_SHIP_CHANCE + spawnRateBonus;

            rareShips.forEach(([id, ship]) => {
                if (Math.random() < finalSpawnChance) {
                    shipsForSaleIds.push(id);
                }
            });
            this.gameState.market.shipyardStock[locationId] = {
                day: this.gameState.day,
                shipsForSale: shipsForSaleIds
            };

            const spawnRequests = shipsForSaleIds.map(shipId => ({ type: 'ship', id: shipId, seed: player.visualSeed }));
            AssetService.hydrateAssets(spawnRequests);
        });
    }

    // --- GRAPH UI DATA GENERATION METHODS ---

    /**
     * Calculates the baseline target price for a commodity at a location without daily fluctuations.
     * Required for rendering procedural baselines on the UI graph.
     * @param {string} locationId 
     * @param {string} commodityId 
     * @returns {number}
     */
    getLocalTargetPrice(locationId, commodityId) {
        const location = DB.MARKETS.find(m => m.id === locationId);
        if (!location) return 0;
        
        const avg = this.gameState.market.galacticAverages[commodityId] || 0;
        const modifier = location.availabilityModifier?.[commodityId] ?? 1.0;
        
        // Evaluate System States
        const systemState = this.gameState.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        const isTargetLocation = systemState && systemState.targetLocations?.includes(locationId);

        let basePriceMod = 1.0;
        if (activeStateDef && activeStateDef.modifiers) {
            const mods = activeStateDef.modifiers;
            if (mods.affectedCommodities?.includes(commodityId) && mods.basePriceInflate) {
                basePriceMod *= mods.basePriceInflate;
            }
            if (isTargetLocation) {
                if (mods.localBasePriceInflate) basePriceMod *= mods.localBasePriceInflate;
                if (mods.localBasePriceMod) basePriceMod *= mods.localBasePriceMod;
            }
        }

        const targetPriceOffset = (1.0 - modifier) * avg;
        return (avg * basePriceMod) + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);
    }

    /**
     * Evaluates when a market achieves Glut (oversaturation) for UI warnings.
     * @param {string} locationId 
     * @param {string} commodityId 
     * @returns {number} The quantity threshold for market glut.
     */
    getGlutThreshold(locationId, commodityId) {
        const location = DB.MARKETS.find(m => m.id === locationId);
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        if (!location || !commodity) return Infinity;

        const [minAvail, maxAvail] = commodity.canonicalAvailability;
        const modifier = location.availabilityModifier?.[commodityId] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        const inventoryItem = this.gameState.market.inventory[locationId]?.[commodityId];
        let pressureForAdaptation = inventoryItem ? inventoryItem.marketPressure : 0;
        
        // Match the logic in applyMarketImpact
        if (pressureForAdaptation > 0) pressureForAdaptation = 0; 
        
        const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
        const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
        
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));
        
        // 3.0x multiplier aligns with the saturation trigger in applyMarketImpact
        return targetStock * 3.0; 
    }

    /**
     * Extrapolates forward market trajectory and combines it with recent historical data.
     * Required by UIMarketControl to render the market forecast graph.
     * @param {string} locationId 
     * @param {string} commodityId 
     * @param {number} historyDays 
     * @param {number} projectedDays 
     * @returns {Array} Array of point objects: { day, price, isLocked }
     */
    generateCurveData(locationId, commodityId, historyDays, projectedDays) {
        const currentDay = this.gameState.day;
        const history = this.gameState.market.priceHistory[locationId]?.[commodityId] || [];
        
        const startDay = Math.max(1, currentDay - historyDays);
        const historicalData = history.filter(entry => entry.day >= startDay).map(entry => ({
            day: entry.day,
            price: entry.price,
            isLocked: false // History assumes standard fluctuation unless manually logged
        }));

        let lastPrice = historicalData.length > 0 
            ? historicalData[historicalData.length - 1].price 
            : (this.gameState.market.prices[locationId]?.[commodityId] || 0);
            
        // Ensure at least one point exists to anchor the projection
        if (historicalData.length === 0) {
            historicalData.push({ day: currentDay, price: lastPrice, isLocked: false });
        }
        
        const localBaseline = this.getLocalTargetPrice(locationId, commodityId);
        const inventoryItem = this.gameState.market.inventory[locationId]?.[commodityId];
        const lockEndDay = inventoryItem ? inventoryItem.priceLockEndDay : 0;
        
        let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH;
        const location = DB.MARKETS.find(m => m.id === locationId);
        if (location?.ecoProfile?.meanReversionMod) {
            meanReversion *= location.ecoProfile.meanReversionMod;
        }

        const projection = [];
        let currentProjPrice = lastPrice;
        
        let activePressure = inventoryItem ? inventoryItem.marketPressure : 0;
        const PLAYER_PRESSURE_STRENGTH = 0.50; 
        let daysSinceInteraction = inventoryItem ? (currentDay - inventoryItem.lastPlayerInteractionTimestamp) : 999;
        
        // Procedurally generate future points using current decay/reversion math
        for (let i = 1; i <= projectedDays; i++) {
            const projDay = currentDay + i;
            let isLocked = projDay < lockEndDay;
            
            if (!isLocked) {
                // Determine reversion pull towards local baseline
                let reversionEffect = (localBaseline - currentProjPrice) * meanReversion;
                
                // Determine delayed supply pressure impact
                let pressureEffect = 0;
                daysSinceInteraction++;
                if (daysSinceInteraction >= 7 && inventoryItem && inventoryItem.lastPlayerInteractionTimestamp > 0) {
                     pressureEffect = (localBaseline * activePressure * -1) * PLAYER_PRESSURE_STRENGTH;
                }
                
                currentProjPrice += (reversionEffect + pressureEffect);
            }
            
            projection.push({
                day: projDay,
                price: Math.max(1, Math.round(currentProjPrice)),
                isLocked: isLocked
            });
            
            // Age out pressure bounds slightly to curve the line properly
            let decayMod = 1.0;
            if (activePressure > 0 && location?.ecoProfile?.recoveryMod) {
                decayMod = 1.0 / location.ecoProfile.recoveryMod;
            }
            activePressure *= (GAME_RULES.MARKET_PRESSURE_DECAY * decayMod);
        }

        return [...historicalData, ...projection];
    }
}