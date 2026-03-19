// js/services/simulation/MarketService.js
/**
 * @fileoverview Manages the economic simulation, including evolving commodity prices,
 * replenishing inventories, and calculating dynamic target baselines driven by 
 * player footprint and system states.
 */
import { GAME_RULES, COMMODITY_IDS, LOCATION_IDS } from '../../data/constants.js'; 
import { DB } from '../../data/database.js';
import { skewedRandom } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js';
import { AssetService } from '../../services/AssetService.js'; 

// Initialize Global Telemetry Buffer
if (typeof window !== 'undefined' && !window.__ECON_TELEMETRY__) {
    window.__ECON_TELEMETRY__ = {
        dailyState: [],
        tradeShocks: [],
        botProgression: []
    };
}

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
     */
    wipePlayerInfluence() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                const inventoryItem = this.gameState.market.inventory[market.id]?.[c.id];
                if (inventoryItem) {
                    inventoryItem.marketPressure = 0;
                    inventoryItem.lastPlayerInteractionTimestamp = 0;
                    inventoryItem.priceLockEndDay = 0;
                    inventoryItem.memoryExpirationDays = 0;
                    inventoryItem.isDepleted = false;
                    inventoryItem.isSaturated = false;
                    inventoryItem.pendingOvernightSnap = false;
                    inventoryItem.depletionDay = 0;
                    inventoryItem.depletionBonusDay = 0;
                    inventoryItem.saturationDay = 0;
                    inventoryItem.hoverUntilDay = 0;
                    inventoryItem.rivalArbitrage = { isActive: false, endDay: 0 };
                    
                    inventoryItem.quantity = this._calculateBaselineStock(market, c);
                }
            });
        });
        
        this.evolveMarketPrices();
    }

    /**
     * Gets the effective price for a commodity at a location, applying standard modifiers.
     * @param {string} locationId 
     * @param {string} commodityId 
     * @param {boolean} [applyModifiers=false] 
     * @returns {number} 
     */
    getPrice(locationId, commodityId, applyModifiers = false) {
        const deal = this.gameState.getState().activeIntelDeal;
        let price = this.gameState.market.prices[locationId]?.[commodityId] || 0;

        if (deal && deal.locationId === locationId && deal.commodityId === commodityId) {
            price = deal.overridePrice;
        }

        if (locationId === LOCATION_IDS.EARTH && (commodityId === COMMODITY_IDS.CLONED_ORGANS || commodityId === COMMODITY_IDS.XENO_GEOLOGICALS)) price *= 1.10;
        if (locationId === LOCATION_IDS.MARS && (commodityId === COMMODITY_IDS.WATER_ICE || commodityId === COMMODITY_IDS.HYDROPONICS)) price *= 1.10;
        if (locationId === LOCATION_IDS.SATURN && (commodityId === COMMODITY_IDS.CLONED_ORGANS || commodityId === COMMODITY_IDS.CRYO_PODS)) price *= 1.20;
        if (locationId === LOCATION_IDS.PLUTO && (commodityId === COMMODITY_IDS.CYBERNETICS || commodityId === COMMODITY_IDS.ANTIMATTER)) price *= 1.25;
        if (locationId === LOCATION_IDS.MERCURY && commodityId === COMMODITY_IDS.WATER_ICE) price *= 1.40;
        if (locationId === LOCATION_IDS.SUN && (commodityId === COMMODITY_IDS.PLASTEEL || commodityId === COMMODITY_IDS.GRAPHENE_LATTICES)) price *= 1.25;

        if (applyModifiers) {
             const activeShipId = this.gameState.player.activeShipId;
             if (activeShipId && this.gameState.player.shipStates[activeShipId]) {
                 const upgrades = this.gameState.player.shipStates[activeShipId].upgrades || [];
                 const mod = GameAttributes.getPriceModifier(upgrades, 'buy');
                 price *= mod;
             }
        }

        return Math.max(1, Math.round(price));
    }

    /**
     * Retrieves the pre-calculated galactic average price for a commodity.
     */
    getGalacticAverage(commodityId) {
        return this.gameState.market.galacticAverages[commodityId] || 0;
    }

    /**
     * Checks if the current system-wide economic state should change.
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
     * Simulates market price changes during the overnight progression.
     * Integrates structural snaps for panic states triggered during the prior day.
     * Applies the Relativistic Distance Scalar to freeze outer rim economies.
     */
    evolveMarketPrices() {
        DB.MARKETS.forEach(location => {
            const distanceScalar = Math.max(1, (location.distance || 1) / GAME_RULES.BASE_TRANSIT_DISTANCE);

            DB.COMMODITIES.forEach(commodity => {
                if (commodity.tier > this.gameState.player.revealedTier) return;

                const activeDeal = this.gameState.activeIntelDeal;
                if (activeDeal && activeDeal.locationId === location.id && activeDeal.commodityId === commodity.id) {
                    const basePrice = activeDeal.overridePrice;
                    const fluctuation = 0.03; 
                    const minPrice = basePrice * (1 - fluctuation);
                    const maxPrice = basePrice * (1 + fluctuation);
                    const fluctuatedPrice = Math.random() * (maxPrice - minPrice) + minPrice;
                    this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(fluctuatedPrice));
                    return; 
                }

                const inventoryItem = this.gameState.market.inventory[location.id][commodity.id];
                const price = this.gameState.market.prices[location.id][commodity.id];
                
                const localBaseline = this.getLocalTargetPrice(location.id, commodity.id);

                let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY;
                if (location.id === LOCATION_IDS.EXCHANGE) volatility *= 3.0;

                let activeStateMeanReversionMod = 1.0;
                const systemState = this.gameState.systemState;
                const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
                if (activeStateDef && activeStateDef.modifiers?.meanReversionMod) {
                    activeStateMeanReversionMod = activeStateDef.modifiers.meanReversionMod;
                }

                let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH * activeStateMeanReversionMod;
                if (location.ecoProfile?.meanReversionMod) meanReversion *= location.ecoProfile.meanReversionMod;

                // --- RELATIVISTIC MEAN REVERSION ---
                meanReversion /= distanceScalar;

                const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodity.id];
                if (commodityMods) {
                    if (commodityMods.volatility_mult) volatility *= commodityMods.volatility_mult;
                    if (commodityMods.mean_reversion_mult) meanReversion *= commodityMods.meanReversion_mult;
                }

                const priceRange = commodity.basePriceRange[1] - commodity.basePriceRange[0];
                const randomFluctuation = (Math.random() - 0.5) * priceRange * volatility;
                
                let reversionEffect = (localBaseline - price) * meanReversion;

                if (this.gameState.day < inventoryItem.priceLockEndDay && !inventoryItem.isDepleted && !inventoryItem.isSaturated) {
                    reversionEffect = 0;
                }

                if (inventoryItem.rivalArbitrage.isActive && this.gameState.day < inventoryItem.rivalArbitrage.endDay) {
                    reversionEffect = (localBaseline - price) * 0.20;
                } else if (inventoryItem.rivalArbitrage.isActive) {
                    inventoryItem.rivalArbitrage.isActive = false;
                }

                if (inventoryItem.hoverUntilDay > this.gameState.day) reversionEffect *= 0.1;

                let newPrice = price + randomFluctuation + reversionEffect;

                // Execute Structural Snap (Overnight Correction)
                if (inventoryItem.pendingOvernightSnap) {
                    newPrice = localBaseline;
                    inventoryItem.pendingOvernightSnap = false; // Clear flag after snapping
                }
                
                if (this._currentSystemState?.modifiers?.commodity?.[commodity.id]?.price) {
                     newPrice *= this._currentSystemState.modifiers.commodity[commodity.id].price;
                }
                
                this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(newPrice));

                let decayMod = 1.0;
                if (inventoryItem.marketPressure > 0 && location.ecoProfile?.recoveryMod) {
                    decayMod = 1.0 / location.ecoProfile.recoveryMod;
                }

                // --- RELATIVISTIC MARKET MEMORY (DECAY) ---
                const baseDecayRate = 1 - (GAME_RULES.MARKET_PRESSURE_DECAY * decayMod);
                const scaledDecayRate = baseDecayRate / distanceScalar;
                inventoryItem.marketPressure *= (1 - scaledDecayRate);
                
                if (Math.abs(inventoryItem.marketPressure) < 0.001) inventoryItem.marketPressure = 0;

                // --- PHASE 1 TELEMETRY LOGGING (Passive State) ---
                if (typeof window !== 'undefined' && window.__ECON_TELEMETRY__) {
                    const modifier = location.availabilityModifier?.[commodity.id] ?? 1.0;
                    const [minAvail, maxAvail] = commodity.canonicalAvailability;
                    const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
                    const marketAdaptationFactor = 1 - Math.max(-2.0, Math.min(0.5, inventoryItem.marketPressure * 0.5));
                    const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
                    const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));

                    window.__ECON_TELEMETRY__.dailyState.push({
                        day: this.gameState.day,
                        locationId: location.id,
                        commodityId: commodity.id,
                        currentPrice: Math.max(1, Math.round(newPrice)),
                        localTargetPrice: localBaseline,
                        quantity: inventoryItem.quantity,
                        targetStock: targetStock,
                        marketPressure: inventoryItem.marketPressure,
                        isDepleted: inventoryItem.isDepleted,
                        isSaturated: inventoryItem.isSaturated,
                        priceLockEndDay: inventoryItem.priceLockEndDay || 0,
                        systemState: this._currentSystemState?.id || 'NONE'
                    });
                }
            });
            this._recordPriceHistory(location.id);
        });
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock and evaluates multi-year memory decay.
     * Applies the Relativistic Distance Scalar to choke automated goods flow to the outer rim.
     */
    replenishMarketInventory() {
        DB.MARKETS.forEach(market => {
            const distanceScalar = Math.max(1, (market.distance || 1) / GAME_RULES.BASE_TRANSIT_DISTANCE);

            DB.COMMODITIES.forEach(c => {
                if (c.tier > this.gameState.player.revealedTier) return;

                const inventoryItem = this.gameState.market.inventory[market.id][c.id];
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

                // --- RELATIVISTIC REPLENISHMENT ---
                replenishRate /= distanceScalar;

                // Memory Decay Evaluation (1 to 4 years threshold check)
                const memoryExpiration = inventoryItem.memoryExpirationDays || (inventoryItem.lastPlayerInteractionTimestamp + 365);
                
                if (inventoryItem.lastPlayerInteractionTimestamp > 0 && this.gameState.day >= memoryExpiration) {
                    inventoryItem.quantity = this._calculateBaselineStock(market, c) * targetStockMod;
                    inventoryItem.lastPlayerInteractionTimestamp = 0;
                    inventoryItem.memoryExpirationDays = 0;
                    inventoryItem.marketPressure = 0;
                    inventoryItem.depletionDay = 0; 
                    inventoryItem.priceLockEndDay = 0; 
                    inventoryItem.isDepleted = false;
                    inventoryItem.isSaturated = false; 
                    inventoryItem.pendingOvernightSnap = false;
                } else {
                    const [minAvail, maxAvail] = c.canonicalAvailability;
                    const baseMeanStock = (minAvail + maxAvail) / 2 * (market.availabilityModifier?.[c.id] ?? 1.0);
                    
                    let pressureForAdaptation = inventoryItem.marketPressure;
                    
                    if (this.gameState.day < inventoryItem.lastPlayerInteractionTimestamp + 7) {
                        pressureForAdaptation = 0; 
                    }

                    const marketAdaptationFactor = 1 - Math.max(-2.0, Math.min(0.5, pressureForAdaptation * 0.5)); 
                    const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
                    
                    const targetStock = baseMeanStock * marketAdaptationFactor * (1 + supplyBonus) * targetStockMod;
                    const difference = targetStock - inventoryItem.quantity;
                    const replenishAmount = difference * replenishRate; 
                    
                    let emergencyStock = 0;
                    if (inventoryItem.isDepleted || inventoryItem.quantity <= 0) {
                        emergencyStock = skewedRandom(1, 5);
                    }

                    inventoryItem.quantity += (replenishAmount + emergencyStock);

                    if (inventoryItem.isDepleted && inventoryItem.quantity >= (targetStock * 0.60)) inventoryItem.isDepleted = false;
                    if (inventoryItem.isSaturated && inventoryItem.quantity <= (targetStock * 2.0)) inventoryItem.isSaturated = false;
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
     * Applies dynamic volume pressure and calculates future adaptation targets.
     */
    applyMarketImpact(goodId, quantity, transactionType) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const market = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        const inventoryItem = this.gameState.market.inventory[this.gameState.currentLocationId][goodId];
        
        const preTradePressure = inventoryItem.marketPressure; // Phase 2: Elasticity Logging
        
        let pressureMod = market?.ecoProfile?.dampeners?.[goodId] ?? market?.ecoProfile?.pressureMod ?? 1.0;
        const pressureChange = (((Math.abs(quantity) / (good.canonicalAvailability[1] || 100)) * good.tier) / 10) * pressureMod;
        
        let isSatBreached = false;
        let glutThresholdValue = 0;

        if (transactionType === 'buy') {
            inventoryItem.marketPressure -= pressureChange;
        } else {
            inventoryItem.marketPressure += pressureChange;
            
            const [minAvail, maxAvail] = good.canonicalAvailability;
            const modifier = market.availabilityModifier?.[goodId] ?? 1.0;
            const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
            
            let pressureForAdaptation = inventoryItem.marketPressure;
            
            const marketAdaptationFactor = 1 - Math.max(-2.0, Math.min(0.5, pressureForAdaptation * 0.5));
            const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
            const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));
            
            glutThresholdValue = targetStock * 3.0;

            if (inventoryItem.quantity > glutThresholdValue) {
                if (!inventoryItem.isSaturated) isSatBreached = true;
                inventoryItem.isSaturated = true;
                inventoryItem.saturationDay = this.gameState.day;
                inventoryItem.pendingOvernightSnap = true; // Flag for next day evolution
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
        
        // Randomize Memory Decay between 1 and 4 years (365 to 1460 days)
        if (!inventoryItem.memoryExpirationDays || inventoryItem.memoryExpirationDays <= this.gameState.day) {
            const memoryDuration = Math.floor(Math.random() * (1460 - 365 + 1)) + 365;
            inventoryItem.memoryExpirationDays = this.gameState.day + memoryDuration;
        }
        
        inventoryItem.lastPlayerInteractionTimestamp = this.gameState.day;

        // --- PHASE 2 TELEMETRY LOGGING (Saturation/Pressure Shocks) ---
        if (typeof window !== 'undefined' && window.__ECON_TELEMETRY__) {
            const immediateFutureTarget = this.getLocalTargetPrice(this.gameState.currentLocationId, goodId);
            
            window.__ECON_TELEMETRY__.tradeShocks.push({
                day: this.gameState.day,
                locationId: this.gameState.currentLocationId,
                commodityId: goodId,
                transactionType: transactionType,
                volumeTransacted: Math.abs(quantity),
                preTradePressure: preTradePressure,
                postTradePressure: inventoryItem.marketPressure,
                pressureDelta: pressureChange,
                projectedTargetPriceOffset: immediateFutureTarget,
                thresholdValue: transactionType === 'sell' ? glutThresholdValue : null,
                thresholdBreached: isSatBreached,
                multiplierEngaged: isSatBreached ? 0.25 : 1.0,
                priceLockEndDay: inventoryItem.priceLockEndDay
            });
        }
    }

    /**
     * Checks if a purchase triggers a market depletion panic.
     */
    checkDepletion(good, inventoryItem, stockBeforeBuy, currentDay) {
        const market = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        const [minAvail, maxAvail] = good.canonicalAvailability;
        const modifier = market.availabilityModifier?.[good.id] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        let pressureForAdaptation = inventoryItem.marketPressure;
        
        const marketAdaptationFactor = 1 - Math.max(-2.0, Math.min(0.5, pressureForAdaptation * 0.5));
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor);
        
        const depletionThreshold = targetStock * 0.08;
        const depletionBuyQuantity = stockBeforeBuy; 

        let isDepBreached = false;
        let panicMult = market.ecoProfile?.panicMult ?? 1.5;

        if (depletionBuyQuantity >= depletionThreshold && currentDay > (inventoryItem.depletionBonusDay + 365)) {
            if (!inventoryItem.isDepleted) isDepBreached = true;
            inventoryItem.isDepleted = true; 
            inventoryItem.depletionDay = currentDay; 
            inventoryItem.depletionBonusDay = currentDay; 
            inventoryItem.pendingOvernightSnap = true; // Flag for next day evolution

            if (this.gameState.systemState && this.gameState.systemState.economyFootprints) {
                this.gameState.systemState.economyFootprints.push({
                    day: currentDay, type: 'DEPLETION', locationId: this.gameState.currentLocationId, commodityId: good.id
                });
            }
        }

        // --- PHASE 2 TELEMETRY LOGGING (Depletion Shocks) ---
        if (typeof window !== 'undefined' && window.__ECON_TELEMETRY__) {
            window.__ECON_TELEMETRY__.tradeShocks.push({
                day: currentDay,
                locationId: this.gameState.currentLocationId,
                commodityId: good.id,
                transactionType: 'buy_depletion_check',
                volumeTransacted: stockBeforeBuy,
                preTradePressure: null,
                postTradePressure: null,
                pressureDelta: null,
                projectedTargetPriceOffset: null,
                thresholdValue: depletionThreshold,
                thresholdBreached: isDepBreached,
                multiplierEngaged: isDepBreached ? panicMult : 1.0,
                priceLockEndDay: null
            });
        }
    }

    /**
     * Calculates the threshold for Asymmetric Saturation (Glut).
     */
    getGlutThreshold(locationId, commodityId) {
        const good = DB.COMMODITIES.find(c => c.id === commodityId);
        const market = DB.MARKETS.find(m => m.id === locationId);
        const inventoryItem = this.gameState.market.inventory[locationId][commodityId];
        
        const [minAvail, maxAvail] = good.canonicalAvailability;
        const modifier = market.availabilityModifier?.[commodityId] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        let pressureForAdaptation = inventoryItem.marketPressure;
        
        const marketAdaptationFactor = 1 - Math.max(-2.0, Math.min(0.5, pressureForAdaptation * 0.5));
        const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));
        
        return targetStock * 3.0;
    }

    /**
     * Calculates the Local Target Price, fully integrating the player's supply/demand footprint 
     * to serve as a living baseline for simulation and UI graphs.
     */
    getLocalTargetPrice(locationId, commodityId, simulatedQty = 0, simulatedMode = null, isProjecting = false) {
        const avg = this.getGalacticAverage(commodityId);
        const market = DB.MARKETS.find(m => m.id === locationId);
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        const inventoryItem = this.gameState.market.inventory[locationId][commodityId];
        
        let basePriceMod = 1.0;
        const systemState = this.gameState.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        const isTargetLocation = systemState && systemState.targetLocations?.includes(locationId);

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

        const modifier = market.availabilityModifier?.[commodityId] ?? 1.0;
        const targetPriceOffset = (1.0 - modifier) * avg;
        let target = (avg * basePriceMod) + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);

        // AVAILABILITY EFFECT (SUPPLY VS DEMAND RATIO)
        const [minAvail, maxAvail] = commodity.canonicalAvailability;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        let pressureForAdaptation = inventoryItem.marketPressure;
        
        if (isProjecting && simulatedQty > 0) {
            const pressureMod = market?.ecoProfile?.dampeners?.[commodityId] ?? market?.ecoProfile?.pressureMod ?? 1.0;
            const pressureChange = (((Math.abs(simulatedQty) / (maxAvail || 100)) * commodity.tier) / 10) * pressureMod;
            if (simulatedMode === 'buy') {
                pressureForAdaptation -= pressureChange;
            } else {
                pressureForAdaptation += pressureChange;
            }
        }

        if (this.gameState.day < inventoryItem.lastPlayerInteractionTimestamp + 7 && !isProjecting) {
            pressureForAdaptation = 0; 
        }
        
        const marketAdaptationFactor = 1 - Math.max(-2.0, Math.min(0.5, pressureForAdaptation * 0.5));
        const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor * (1 + supplyBonus));

        let currentStock = inventoryItem.quantity;
        if (isProjecting) {
            if (simulatedMode === 'sell') currentStock += simulatedQty;
            if (simulatedMode === 'buy') currentStock = Math.max(0, currentStock - simulatedQty);
        }

        const availabilityRatio = currentStock / targetStock;
        const availabilityMultiplier = Math.max(0.1, Math.min(3.0, 1 + ((1 - availabilityRatio) * 0.50)));
        target *= availabilityMultiplier;

        // STRUCTURAL PANIC MODIFIERS
        let isSimulatedDepleted = inventoryItem.isDepleted;
        let isSimulatedSaturated = inventoryItem.isSaturated;

        if (isProjecting && simulatedQty > 0) {
            if (simulatedMode === 'buy' && simulatedQty >= (targetStock * 0.08)) isSimulatedDepleted = true;
            if (simulatedMode === 'sell' && currentStock > (targetStock * 3.0)) isSimulatedSaturated = true;
        }

        if (isSimulatedDepleted) {
            let priceHikeMultiplier = market.ecoProfile?.panicMult ?? 1.5;
            target *= priceHikeMultiplier;
        }
        if (isSimulatedSaturated) {
            target *= 0.25;
        }

        return target;
    }

    /**
     * Generates mathematical curve data for historical and projected prices.
     * Incorporates the Relativistic Distance Scalar to ensure UI graphs accurately reflect outer-rim freeze.
     */
    generateCurveData(locationId, commodityId, historyDays, projectedDays, simulatedQty = 0, simulatedMode = 'sell') {
        const currentDay = this.gameState.day;
        const inventoryItem = this.gameState.market.inventory[locationId][commodityId];
        const currentPrice = this.gameState.market.prices[locationId][commodityId];
        
        const market = DB.MARKETS.find(m => m.id === locationId);
        const distanceScalar = Math.max(1, (market?.distance || 1) / GAME_RULES.BASE_TRANSIT_DISTANCE);

        // --- RELATIVISTIC MEAN REVERSION (Dampened by distance for projections) ---
        const meanReversion = (GAME_RULES.MEAN_REVERSION_STRENGTH || 0.025) / distanceScalar;

        let priceLockEnd = inventoryItem.priceLockEndDay || 0;
        
        const curveData = [];
        
        const historicalBaseline = this.getLocalTargetPrice(locationId, commodityId, 0, null, false);
        for (let i = historyDays; i > 0; i--) {
            const dayOffset = -i;
            const pastDay = currentDay + dayOffset;
            const divergence = (currentPrice - historicalBaseline) / Math.pow(1 - meanReversion, Math.abs(dayOffset));
            const cappedDivergence = Math.max(-historicalBaseline * 0.9, Math.min(historicalBaseline * 4, divergence));
            const pastPrice = Math.max(1, historicalBaseline + cappedDivergence);
            
            curveData.push({
                day: pastDay,
                price: pastPrice,
                isLocked: false
            });
        }
        
        curveData.push({
            day: currentDay,
            price: currentPrice,
            isLocked: currentDay < priceLockEnd
        });

        let projectedPrice = currentPrice;
        let projectedLockEnd = priceLockEnd;

        const futureBaseline = this.getLocalTargetPrice(locationId, commodityId, simulatedQty, simulatedMode, true);

        if (simulatedQty > 0) {
            const good = DB.COMMODITIES.find(c => c.id === commodityId);
            const currentMarketStock = inventoryItem.quantity;
            
            const [minAvail, maxAvail] = good.canonicalAvailability;
            const modifier = market.availabilityModifier?.[good.id] ?? 1.0;
            const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
            const targetStock = Math.max(1, baseMeanStock); 
            
            const glutThreshold = targetStock * 3.0;

            if (simulatedMode === 'sell') {
                const pressureMod = market?.ecoProfile?.dampeners?.[commodityId] ?? market?.ecoProfile?.pressureMod ?? 1.0;
                const pressureChange = (((Math.abs(simulatedQty) / (good.canonicalAvailability[1] || 100)) * good.tier) / 10) * pressureMod;
                projectedLockEnd = Math.max(projectedLockEnd, currentDay + Math.floor(7 * pressureChange)); 
                
                if ((simulatedQty + currentMarketStock) > glutThreshold) {
                    projectedPrice = futureBaseline; 
                    projectedLockEnd = Math.max(projectedLockEnd, currentDay + 30);
                }
            } else if (simulatedMode === 'buy') {
                const depletionThreshold = targetStock * 0.08;
                if (simulatedQty >= depletionThreshold) {
                    projectedPrice = futureBaseline; 
                }
            }
        }
        
        for (let i = 1; i <= projectedDays; i++) {
            const futureDay = currentDay + i;
            let isLocked = false;

            if (futureDay <= projectedLockEnd && projectedPrice !== futureBaseline) {
                isLocked = true;
            } else {
                projectedPrice += (futureBaseline - projectedPrice) * meanReversion;
            }
            
            curveData.push({
                day: futureDay,
                price: Math.max(1, projectedPrice),
                isLocked: isLocked
            });
        }
        
        return curveData;
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
}