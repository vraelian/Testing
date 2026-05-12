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
     * Simple string hashing for deterministic pseudo-random generation.
     * @private
     */
    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    /**
     * Mulberry32 Seeded random number generator [0, 1)
     * @private
     */
    _seededRandom(seed) {
        let t = seed + 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
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
                    inventoryItem.isDepleted = false;
                    inventoryItem.isSaturated = false;
                    inventoryItem.depletionDay = 0;
                    inventoryItem.depletionBonusDay = 0;
                    inventoryItem.hoverUntilDay = 0;
                    inventoryItem.rivalArbitrage = { isActive: false, endDay: 0 };
                    inventoryItem.sessionInteractionDay = 0;
                    inventoryItem.sessionNetVolume = 0;
                    
                    // Hard reset quantity to a neutral baseline
                    inventoryItem.quantity = this._calculateBaselineStock(market, c);
                }
            });
        });
        
        // Evolve once to immediately align prices against the new baseline
        this.evolveMarketPrices();
    }

    /**
     * Helper to apply Location/Station quirks uniformly to base prices.
     * @private
     */
    _applyStationQuirks(price, locationId, commodityId) {
        let modifiedPrice = price;
        if (locationId === LOCATION_IDS.EARTH && (commodityId === COMMODITY_IDS.CLONED_ORGANS || commodityId === COMMODITY_IDS.XENO_GEOLOGICALS)) {
            modifiedPrice *= 1.10;
        }
        if (locationId === LOCATION_IDS.MARS && (commodityId === COMMODITY_IDS.WATER_ICE || commodityId === COMMODITY_IDS.HYDROPONICS)) {
            modifiedPrice *= 1.10;
        }
        if (locationId === LOCATION_IDS.SATURN && (commodityId === COMMODITY_IDS.CLONED_ORGANS || commodityId === COMMODITY_IDS.CRYO_PODS)) {
            modifiedPrice *= 1.20;
        }
        if (locationId === LOCATION_IDS.PLUTO && (commodityId === COMMODITY_IDS.CYBERNETICS || commodityId === COMMODITY_IDS.ANTIMATTER)) {
            modifiedPrice *= 1.25;
        }
        if (locationId === LOCATION_IDS.MERCURY && commodityId === COMMODITY_IDS.WATER_ICE) {
            modifiedPrice *= 1.40;
        }
        if (locationId === LOCATION_IDS.SUN && (commodityId === COMMODITY_IDS.PLASTEEL || commodityId === COMMODITY_IDS.GRAPHENE_LATTICES)) {
            modifiedPrice *= 1.25;
        }
        return modifiedPrice;
    }

    /**
     * Gets the base unit price for a commodity at a location without volumetric slippage.
     * Checks for active intel deal overrides, applies delays to extreme states, 
     * and optionally applies player-specific modifiers (e.g. Signal Hacker).
     * @param {string} locationId The ID of the location.
     * @param {string} commodityId The ID of the commodity.
     * @param {boolean} [applyModifiers=false] If true, applies active ship upgrade modifiers.
     * @param {string} [tradeType='buy'] The transaction direction for applying upgrade modifiers.
     * @returns {number} The effective base price.
     */
    getPrice(locationId, commodityId, applyModifiers = false, tradeType = 'buy') {
        const state = this.gameState.getState();
        const deal = state.activeIntelDeal;
        let basePrice = this.gameState.market.prices[locationId]?.[commodityId] || 0;

        const inventoryItem = this.gameState.market.inventory[locationId]?.[commodityId];
        if (inventoryItem) {
            // No Same-Day Reactions (Delay extreme modifiers by 7 days to match pressure)
            const daysSinceInteraction = this.gameState.day - (inventoryItem.lastPlayerInteractionTimestamp || 0);
            const delayPassed = daysSinceInteraction >= 7;

            if (inventoryItem.isDepleted && delayPassed) {
                const location = DB.MARKETS.find(m => m.id === locationId);
                const panicMult = location?.ecoProfile?.panicMult ?? 1.5;
                basePrice *= panicMult;
            }
            if (inventoryItem.isSaturated && delayPassed) {
                basePrice *= 0.25;
            }
        }
        
        // Direct System State commodity price overrides
        if (this._currentSystemState?.modifiers?.commodity?.[commodityId]?.price) {
            basePrice *= this._currentSystemState.modifiers.commodity[commodityId].price;
        }

        let price = basePrice;

        // 1. Intel Deal Override Check
        if (deal &&
            deal.locationId === locationId &&
            deal.commodityId === commodityId) {
            price = this.gameState.market.prices[locationId]?.[commodityId] || deal.overridePrice;
        }

        // Station Quirks (Price Boosts)
        price = this._applyStationQuirks(price, locationId, commodityId);

        // 2. Upgrade Modifiers (Signal Hacker, etc.)
        if (applyModifiers) {
             const activeShipId = this.gameState.player.activeShipId;
             if (activeShipId && this.gameState.player.shipStates[activeShipId]) {
                 const upgrades = this.gameState.player.shipStates[activeShipId].upgrades || [];
                 const mod = GameAttributes.getPriceModifier(upgrades, tradeType);
                 price = price * mod;
             }
        }

        // HOT INTEL INTEGRATION
        const activeHotIntel = state.activeHotIntel;
        if (activeHotIntel && 
            activeHotIntel.locationId === locationId && 
            activeHotIntel.commodityId === commodityId) {
            price = price * activeHotIntel.discountMultiplier;
        }

        // Tier-Scaled Intrinsic Support (Absolute Retail Floor)
        const commodityDef = DB.COMMODITIES.find(c => c.id === commodityId);
        let absoluteFloor = 1;
        if (commodityDef) {
            const baseMin = commodityDef.basePriceRange[0];
            absoluteFloor = Math.floor(baseMin * (0.05 + (commodityDef.tier * 0.05)));
        }

        return Math.max(absoluteFloor, Math.round(price));
    }

    /**
     * Execution Engine.
     * Evaluates Situational Modifiers to determine the absolute final transaction value. 
     * Ensures UI prediction matches logic execution exactly, without volume-elasticity.
     */
    getExecutionPrice(locationId, commodityId, quantity, transactionType) {
        let baseUnitPrice = this.getPrice(locationId, commodityId, true, transactionType);
        const state = this.gameState.getState();

        // 1. Situational Modifiers (Applied holistically to the base unit price)
        if (transactionType === 'buy') {
            const agePurchaseDiscount = state.player.statModifiers?.purchaseCost || 0;
            if (agePurchaseDiscount > 0) baseUnitPrice *= (1 - agePurchaseDiscount);

            const systemState = state.systemState;
            const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
            if (activeStateDef?.modifiers?.survivalGoodsDiscountMod && activeStateDef.modifiers.affectedCommodities?.includes(commodityId)) {
                baseUnitPrice *= activeStateDef.modifiers.survivalGoodsDiscountMod;
            }

            if (locationId === LOCATION_IDS.BELT && (commodityId === COMMODITY_IDS.WATER_ICE || commodityId === COMMODITY_IDS.XENO_GEOLOGICALS)) {
                baseUnitPrice *= 0.95;
            }
        } else if (transactionType === 'sell') {
            const systemState = state.systemState;
            const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
            if (activeStateDef?.modifiers?.sellPriceBonusMod) {
                baseUnitPrice *= activeStateDef.modifiers.sellPriceBonusMod;
            }

            if (locationId === LOCATION_IDS.SUN && (commodityId === COMMODITY_IDS.GRAPHENE_LATTICES || commodityId === COMMODITY_IDS.PLASTEEL)) {
                baseUnitPrice *= 1.25;
            }
        }

        baseUnitPrice = Math.max(1, baseUnitPrice);

        if (quantity <= 0) return { unitPrice: baseUnitPrice, totalPrice: 0, slippagePct: 0, washPenaltyPct: 0 };

        let totalPrice = baseUnitPrice * quantity;

        // 2. Conditional Bulk Modifiers (Applied to Total)
        if (transactionType === 'buy') {
            if (locationId === LOCATION_IDS.NEPTUNE && (commodityId === COMMODITY_IDS.PROPELLANT || commodityId === COMMODITY_IDS.PLASTEEL) && quantity > 50) {
                totalPrice *= 0.90;
            }
        }

        totalPrice = Math.max(1, Math.floor(totalPrice));
        const finalUnitPrice = totalPrice / quantity;

        return {
            unitPrice: finalUnitPrice,
            totalPrice: totalPrice,
            slippagePct: 0,
            washPenaltyPct: 0
        };
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
    evolveMarketPrices(economySeed = null) {
        DB.MARKETS.forEach(location => {
            DB.COMMODITIES.forEach(commodity => {
                if (commodity.tier > this.gameState.player.revealedTier) return;

                const seedStr = economySeed !== null ? `${location.id}-${commodity.id}-${economySeed}` : null;
                const seedHash = seedStr ? this._hashString(seedStr) : null;
                const randomVal = () => seedHash !== null ? this._seededRandom(seedHash) : Math.random();

                const activeDeal = this.gameState.activeIntelDeal;
                if (activeDeal &&
                     activeDeal.locationId === location.id &&
                     activeDeal.commodityId === commodity.id)
                {
                    const basePrice = activeDeal.overridePrice;
                    const fluctuation = 0.03; 
                    const minPrice = basePrice * (1 - fluctuation);
                    const maxPrice = basePrice * (1 + fluctuation);
                    
                    const fluctuatedPrice = randomVal() * (maxPrice - minPrice) + minPrice;
                    this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(fluctuatedPrice));
                    return; 
                }

                const inventoryItem = this.gameState.market.inventory[location.id][commodity.id];
                const price = this.gameState.market.prices[location.id][commodity.id];
                const avg = this.gameState.market.galacticAverages[commodity.id];
                const modifier = location.availabilityModifier?.[commodity.id] ?? 1.0;

                const systemState = this.gameState.systemStates || this.gameState.systemState;
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

                const targetPriceOffset = (1.0 - modifier) * avg;
                const localBaseline = (avg * basePriceMod) + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);

                let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY;
                if (location.id === LOCATION_IDS.EXCHANGE) volatility *= 3.0; 

                let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH * activeStateMeanReversionMod;
                if (location.ecoProfile?.meanReversionMod) meanReversion *= location.ecoProfile.meanReversionMod;

                const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodity.id];
                if (commodityMods) {
                    if (commodityMods.volatility_mult) volatility *= commodityMods.volatility_mult;
                    if (commodityMods.mean_reversion_mult) meanReversion *= commodityMods.mean_reversion_mult;
                }

                const priceRange = commodity.basePriceRange[1] - commodity.basePriceRange[0];
                let randomFluctuation = (randomVal() - 0.5) * priceRange * volatility;
                
                let reversionEffect = (localBaseline - price) * meanReversion;

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

                let pressureEffect = 0;
                const PLAYER_PRESSURE_STRENGTH = 0.50; 
                
                if (this.gameState.day >= inventoryItem.lastPlayerInteractionTimestamp + 7) {
                    if (inventoryItem.lastPlayerInteractionTimestamp > 0) {
                         pressureEffect = (localBaseline * inventoryItem.marketPressure * -1) * PLAYER_PRESSURE_STRENGTH;
                    }
                }

                let newPrice = price + randomFluctuation + reversionEffect + pressureEffect;
                
                const baseMin = commodity.basePriceRange[0];
                const intrinsicFloor = Math.floor(baseMin * (0.05 + (commodity.tier * 0.05)));
                const finalRoundedPrice = Math.max(intrinsicFloor, Math.round(newPrice));
                
                this.gameState.market.prices[location.id][commodity.id] = finalRoundedPrice;

                // TELEMETRY: Gated execution
                if (this.gameState.uiState?.enableEconomicTelemetry) {
                    const priceShiftPct = Math.abs(finalRoundedPrice - price) / price;
                    const isSignificant = priceShiftPct > 0.05 || inventoryItem.isDepleted || inventoryItem.isSaturated;
                    const isVerbose = this.gameState.uiState?.verboseTickLogging !== false; 

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

                if (inventoryItem.marketPressure !== 0) {
                    if (this.gameState.day >= inventoryItem.lastPlayerInteractionTimestamp + 7) {
                        let decayMod = 1.0;
                        if (inventoryItem.marketPressure > 0 && location.ecoProfile?.recoveryMod) {
                            decayMod = 1.0 / location.ecoProfile.recoveryMod;
                        }

                        let replenishRate = location.ecoProfile?.commodityReplenishRates?.[commodity.id] ?? location.ecoProfile?.replenishRate ?? 0.10;
                        let dailyRestockPercent = replenishRate / 7;
                        let dynamicDecayMultiplier = 1.0 - (dailyRestockPercent * decayMod);

                        inventoryItem.marketPressure *= dynamicDecayMultiplier;
                        
                        if (Math.abs(inventoryItem.marketPressure) < 0.001) {
                            inventoryItem.marketPressure = 0;
                        }
                    }
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

                const systemState = this.gameState.systemStates || this.gameState.systemState;
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

                if (inventoryItem.lastPlayerInteractionTimestamp > 0 && (this.gameState.day - inventoryItem.lastPlayerInteractionTimestamp) > 240) {
                    inventoryItem.quantity = this._calculateBaselineStock(market, c) * targetStockMod;
                    inventoryItem.lastPlayerInteractionTimestamp = 0;
                    inventoryItem.marketPressure = 0;
                    inventoryItem.depletionDay = 0; 
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

                    const dailyReplenishAmount = difference * (replenishRate / 7); 
                    
                    let emergencyStock = 0;
                    if (inventoryItem.quantity <= 0 || inventoryItem.isDepleted) {
                        let daysSinceEvent = 1;
                        if (inventoryItem.isDepleted && inventoryItem.depletionDay > 0) {
                            daysSinceEvent = Math.max(1, this.gameState.day - inventoryItem.depletionDay);
                        }
                        
                        const tierFactor = Math.max(0.5, 7 - c.tier); 
                        const decayFactor = 1 / daysSinceEvent; 
                        
                        emergencyStock = Math.max(0, (skewedRandom(1, 5) * tierFactor * decayFactor));
                        
                        const maxAllowedEmergency = Math.max(0, (targetStock * 0.59) - (inventoryItem.quantity + dailyReplenishAmount));
                        emergencyStock = Math.min(emergencyStock, maxAllowedEmergency);
                    }

                    inventoryItem.quantity += (dailyReplenishAmount + emergencyStock);

                    if (inventoryItem.isDepleted && inventoryItem.quantity >= (targetStock * 0.60)) {
                        inventoryItem.isDepleted = false;
                    }

                    if (inventoryItem.isSaturated && inventoryItem.quantity <= (targetStock * 2.0)) {
                        inventoryItem.isSaturated = false;
                    }
                }

                if (!market.ecoProfile?.disableFluctuation) {
                    const [minAvail, maxAvail] = c.canonicalAvailability;
                    const modifier = market.availabilityModifier?.[c.id] ?? 1.0;
                    const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;

                    const fluctuationPercent = (Math.random() * 0.15 + 0.15); 
                    const fluctuationDirection = Math.random() < 0.5 ? -1 : 1;
                    
                    const noiseAmount = baseMeanStock * fluctuationPercent * fluctuationDirection;
                    inventoryItem.quantity += noiseAmount;
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
        
        // --- PHASE 3: Zero-Sum Session Volume Tracking ---
        if (inventoryItem.sessionInteractionDay !== this.gameState.day) {
            inventoryItem.sessionInteractionDay = this.gameState.day;
            inventoryItem.sessionNetVolume = 0;
        }
        
        inventoryItem.sessionNetVolume += (transactionType === 'buy' ? -quantity : quantity);

        // --- FOOTPRINT LOGGING FIX: Universal Trade Tracking ---
        const sysState = this.gameState.systemStates || this.gameState.systemState;
        if (sysState) {
            if (!sysState.economyFootprints) {
                sysState.economyFootprints = [];
            }
            
            sysState.economyFootprints.push({
                day: this.gameState.day, 
                type: transactionType === 'buy' ? 'BUY' : 'SELL', 
                locationId: this.gameState.currentLocationId, 
                commodityId: good.id
            });
        }
        
        if (transactionType === 'buy') {
            inventoryItem.marketPressure -= pressureChange;
            this.checkDepletion(good, inventoryItem, quantity, this.gameState.day);
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
                if (sysState) {
                    if (!sysState.economyFootprints) sysState.economyFootprints = [];
                    sysState.economyFootprints.push({
                        day: this.gameState.day, type: 'SATURATION', locationId: this.gameState.currentLocationId, commodityId: good.id
                    });
                }
            }
        }
        
        inventoryItem.marketPressure = Math.max(-2.5, Math.min(4.0, inventoryItem.marketPressure));

        // Mark interaction time for the 7-day organic delay
        inventoryItem.lastPlayerInteractionTimestamp = this.gameState.day;

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
                isSaturated: inventoryItem.isSaturated || false
            });

            if (this.gameState.telemetry.impacts.length > 1000) this.gameState.telemetry.impacts.shift();
        }
    }

    /**
     * Checks if a purchase triggers a market depletion event.
     */
    checkDepletion(good, inventoryItem, purchaseQuantity, currentDay) {
        const market = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        const [minAvail, maxAvail] = good.canonicalAvailability;
        const modifier = market.availabilityModifier?.[good.id] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        let pressureForAdaptation = inventoryItem.marketPressure;
        if (pressureForAdaptation > 0) pressureForAdaptation = 0; 
        
        const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor);
        
        const depletionThreshold = targetStock * 0.08;
        const depletionBuyQuantity = purchaseQuantity; 

        if (inventoryItem.quantity <= 0 && depletionBuyQuantity >= depletionThreshold && currentDay > (inventoryItem.depletionBonusDay + 365)) {
            inventoryItem.isDepleted = true; 
            inventoryItem.depletionDay = currentDay;
            inventoryItem.depletionBonusDay = currentDay; 

            const sysState = this.gameState.systemStates || this.gameState.systemState;
            if (sysState) {
                if (!sysState.economyFootprints) sysState.economyFootprints = [];
                sysState.economyFootprints.push({
                    day: currentDay, type: 'DEPLETION', locationId: this.gameState.currentLocationId, commodityId: good.id
                });
            }
        }
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
            
            // Log the fully formed, modified price (accounting for local quirks)
            const currentDisplayPrice = this.getPrice(targetMarketId, good.id, false);

            const lastEntry = history[history.length - 1];
            if (lastEntry && lastEntry.day === this.gameState.day) {
                if (lastEntry.price !== currentDisplayPrice) {
                    lastEntry.price = currentDisplayPrice;
                }
            } else {
                history.push({ day: this.gameState.day, price: currentDisplayPrice });
            }

            while (history.length > GAME_RULES.PRICE_HISTORY_LENGTH) {
                history.shift();
            }
        });
    }

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

    getLocalTargetPrice(locationId, commodityId) {
        const location = DB.MARKETS.find(m => m.id === locationId);
        if (!location) return 0;
        
        const avg = this.gameState.market.galacticAverages[commodityId] || 0;
        const modifier = location.availabilityModifier?.[commodityId] ?? 1.0;
        
        // Evaluate System States
        const systemState = this.gameState.systemStates || this.gameState.systemState;
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

    getGlutThreshold(locationId, commodityId) {
        const location = DB.MARKETS.find(m => m.id === locationId);
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        if (!location || !commodity) return Infinity;

        const [minAvail, maxAvail] = commodity.canonicalAvailability;
        const modifier = location.availabilityModifier?.[commodityId] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        const inventoryItem = this.gameState.market.inventory[locationId]?.[commodityId];
        let pressureForAdaptation = inventoryItem ? inventoryItem.marketPressure : 0;
        
        if (pressureForAdaptation > 0) pressureForAdaptation = 0; 
        
        const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
        const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
        
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));
        return targetStock * 3.0; 
    }

    generateCurveData(locationId, commodityId, historyDays, projectedDays) {
        const currentDay = this.gameState.day;
        const history = this.gameState.market.priceHistory[locationId]?.[commodityId] || [];
        
        const startDay = Math.max(1, currentDay - historyDays);
        const historicalData = history.filter(entry => entry.day >= startDay).map(entry => ({
            day: entry.day,
            price: entry.price,
            isLocked: false 
        }));

        let lastDisplayPrice = historicalData.length > 0 
            ? historicalData[historicalData.length - 1].price 
            : this.getPrice(locationId, commodityId, false);
            
        if (historicalData.length === 0 || historicalData[historicalData.length - 1].day < currentDay) {
            const liveDisplayPrice = this.getPrice(locationId, commodityId, false) || lastDisplayPrice;
            historicalData.push({ day: currentDay, price: liveDisplayPrice, isLocked: false });
        }
        
        const localBaseline = this.getLocalTargetPrice(locationId, commodityId);
        const location = DB.MARKETS.find(m => m.id === locationId);
        
        // Extract systemic mods for forward-simulation
        const systemState = this.gameState.systemStates || this.gameState.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        let activeStateMeanReversionMod = 1.0;
        if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.meanReversionMod) {
            activeStateMeanReversionMod = activeStateDef.modifiers.meanReversionMod;
        }

        let meanReversion = (GAME_RULES.MEAN_REVERSION_STRENGTH || 0.05) * activeStateMeanReversionMod;
        if (location?.ecoProfile?.meanReversionMod) meanReversion *= location.ecoProfile.meanReversionMod;
        const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodityId];
        if (commodityMods && commodityMods.mean_reversion_mult) meanReversion *= commodityMods.mean_reversion_mult;
        
        // Holt's Double Exponential Smoothing (Baseline trend anchor)
        const alpha = 0.3;
        const beta = 0.15;
        let S = historicalData.length > 0 ? historicalData[0].price : localBaseline;
        let T = historicalData.length > 1 ? historicalData[1].price - historicalData[0].price : 0;
        
        for (let i = 1; i < historicalData.length; i++) {
            let X = historicalData[i].price;
            let nextS = alpha * X + (1 - alpha) * (S + T);
            let nextT = beta * (nextS - S) + (1 - beta) * T;
            S = nextS;
            T = nextT;
        }

        const inventoryItem = this.gameState.market.inventory[locationId]?.[commodityId];
        let simPrice = S;
        let simPressure = inventoryItem ? inventoryItem.marketPressure : 0;
        let daysSinceInteraction = inventoryItem ? (currentDay - inventoryItem.lastPlayerInteractionTimestamp) : 999;
        
        const projection = [];
        let currentT = T;
        const phi = 0.85; // Trend dampening
        
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        const baseMin = commodity ? commodity.basePriceRange[0] : 1;
        const tier = commodity ? commodity.tier : 1;
        const intrinsicFloor = Math.floor(baseMin * (0.05 + (tier * 0.05)));
        
        let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY || 0.05;
        if (commodityMods && commodityMods.volatility_mult) {
            volatility *= commodityMods.volatility_mult;
        }
        
        for (let i = 1; i <= projectedDays; i++) {
            const projDay = currentDay + i;
            daysSinceInteraction++;
            
            currentT *= phi;
            
            // Forward simulate market pressure impacts explicitly 7 days out
            let pressureEffect = 0;
            if (daysSinceInteraction >= 7 && inventoryItem && inventoryItem.lastPlayerInteractionTimestamp > 0) {
                 pressureEffect = (localBaseline * simPressure * -1) * 0.50; // PLAYER_PRESSURE_STRENGTH
            }

            let reversionEffect = (localBaseline - simPrice) * meanReversion;

            simPrice += (reversionEffect + pressureEffect + currentT);
            
            // Decay pressure naturally
            if (simPressure !== 0 && daysSinceInteraction >= 7) {
                let decayMod = 1.0;
                if (simPressure > 0 && location?.ecoProfile?.recoveryMod) {
                    decayMod = 1.0 / location.ecoProfile.recoveryMod;
                }
                let replenishRate = location?.ecoProfile?.commodityReplenishRates?.[commodityId] ?? location?.ecoProfile?.replenishRate ?? 0.10;
                let dailyRestockPercent = replenishRate / 7;
                let dynamicDecayMultiplier = 1.0 - (dailyRestockPercent * decayMod);
                simPressure *= dynamicDecayMultiplier;
            }
            
            // Widening variance for the cone
            let variance = (volatility * localBaseline * Math.pow(i, 1.2)) * 0.25; 
            
            let upper = simPrice + variance;
            let lower = simPrice - variance;
            
            // Absolute economic limit clamping for the lower bound cone
            if (lower < intrinsicFloor) lower = intrinsicFloor;
            let clampedMedianPrice = Math.max(intrinsicFloor, simPrice);

            // Ensure the SVG projected data matches the visual quirk modifications
            let displayProjPrice = this._applyStationQuirks(clampedMedianPrice, locationId, commodityId);
            let displayUpper = this._applyStationQuirks(upper, locationId, commodityId);
            let displayLower = this._applyStationQuirks(lower, locationId, commodityId);
            
            projection.push({
                day: projDay,
                price: Math.round(displayProjPrice),
                upper: Math.round(displayUpper),
                lower: Math.round(displayLower),
                isLocked: false
            });
        }

        const curveData = [...historicalData, ...projection];

        let footprints = [];
        const sysState = this.gameState.systemStates || this.gameState.systemState;
        
        if (sysState && sysState.economyFootprints) {
            footprints = sysState.economyFootprints
                .filter(fp => fp.locationId === locationId && fp.commodityId === commodityId)
                .map(fp => ({
                    day: fp.day,
                    type: fp.type
                }));
        }

        return {
            points: curveData,
            footprints: footprints
        };
    }
}