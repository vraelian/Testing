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
        const deal = this.gameState.getState().activeIntelDeal;
        let price = this.gameState.market.prices[locationId]?.[commodityId] || 0;

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

    // --- END VIRTUAL WORKBENCH ---

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

                // --- VIRTUAL WORKBENCH (PHASE 2 & User Request) ---
                // Enforce Intel Price Lock
                const activeDeal = this.gameState.activeIntelDeal;
                if (activeDeal &&
                     activeDeal.locationId === location.id &&
                     activeDeal.commodityId === commodity.id)
                {
                    // --- MODIFICATION: Apply 3% fluctuation to the locked price ---
                    const basePrice = activeDeal.overridePrice;
                    const fluctuation = 0.03; // 3%
                    const minPrice = basePrice * (1 - fluctuation);
                    const maxPrice = basePrice * (1 + fluctuation);
                    
                    // Generate a random price within the [minPrice, maxPrice] range
                    const fluctuatedPrice = Math.random() * (maxPrice - minPrice) + minPrice;
                    
                    // Set the new price, ensuring it's at least 1
                    this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(fluctuatedPrice));
                    // --- END MODIFICATION ---

                    // Skip all other evolution logic for this item
                    return; 
                }
                // --- END VIRTUAL WORKBENCH ---

                const inventoryItem = this.gameState.market.inventory[location.id][commodity.id];
                const price = this.gameState.market.prices[location.id][commodity.id];
                const avg = this.gameState.market.galacticAverages[commodity.id];

                // Determine the local baseline price based on import/export modifiers
                const modifier = location.availabilityModifier?.[commodity.id] ?? 1.0;

                // (1.0 - modifier) inverts the logic:
                // Exporter (mod > 1.0) results in a negative offset (lower price)
                // Importer (mod < 1.0) results in a positive offset (higher price)
                const targetPriceOffset = (1.0 - modifier) * avg;

                // The new baseline is the galactic average, pulled towards the local target price
                // by the strength of the modifier.
                const localBaseline = avg + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);

                let volatility = GAME_RULES.DAILY_PRICE_VOLATILITY;
                
                // --- VIRTUAL WORKBENCH: EXCHANGE QUIRK (VOLATILITY) ---
                if (location.id === LOCATION_IDS.EXCHANGE) {
                    volatility *= 3.0; // 3x Price Volatility at The Exchange
                }
                // --- END VIRTUAL WORKBENCH ---

                let meanReversion = GAME_RULES.MEAN_REVERSION_STRENGTH;

                const commodityMods = this._currentSystemState?.modifiers?.commodity?.[commodity.id];
                if (commodityMods) {
                    if (commodityMods.volatility_mult) volatility *= commodityMods.volatility_mult;
                    if (commodityMods.mean_reversion_mult) meanReversion *= commodityMods.mean_reversion_mult;
                }

                const priceRange = commodity.basePriceRange[1] - commodity.basePriceRange[0];
                const randomFluctuation = (Math.random() - 0.5) * priceRange * volatility;
                
                let reversionEffect = (localBaseline - price) * meanReversion;

                // --- NEW: Variable Reversion Delay (Point e) ---
                // If the player has traded this item recently, a "price lock" is in effect,
                // stopping mean reversion. The duration is set randomly on transaction.
                if (this.gameState.day < inventoryItem.priceLockEndDay) {
                    reversionEffect = 0;
                }
                // --- END CHANGE ---

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

                // [GEMINI] --- MODEL FIX: "DELAYED PRESSURE" ---
                // This is now the primary, and only, player-driven price force.
                // It is 0 by default and is only populated by a player trade.
                let pressureEffect = 0;
                const PLAYER_PRESSURE_STRENGTH = 0.50; // Tuned strength
                
                // Add 1-week delay before player's actions impact price
                if (this.gameState.day >= inventoryItem.lastPlayerInteractionTimestamp + 7) {
                    // Check if lastPlayerInteractionTimestamp is > 0 to prevent this from running on Day 7 of a new game
                    if (inventoryItem.lastPlayerInteractionTimestamp > 0) {
                         pressureEffect = (localBaseline * inventoryItem.marketPressure * -1) * PLAYER_PRESSURE_STRENGTH;
                    }
                }
                // [GEMINI] --- END MODEL FIX ---

                // --- NEW: Depletion Price Hike ---
                let priceHikeMultiplier = 1.0;
                if (inventoryItem.isDepleted && this.gameState.day < inventoryItem.depletionDay + 7) {
                    priceHikeMultiplier = 1.5; // 50% more acceleration
                    // We check depletionDay + 7, so this effect lasts for the whole week
                    // We reset the flag *after* it's been used in replenishment
                }
                // --- End Depletion Price Hike ---

                let newPrice = price + randomFluctuation + reversionEffect + (pressureEffect * priceHikeMultiplier);
                
                if (this._currentSystemState?.modifiers?.commodity?.[commodity.id]?.price) {
                     newPrice *= this._currentSystemState.modifiers.commodity[commodity.id].price;
                }
                
                this.gameState.market.prices[location.id][commodity.id] = Math.max(1, Math.round(newPrice));

                // marketPressure still decays, as this is the "timer" for the pressureEffect
                inventoryItem.marketPressure *= GAME_RULES.MARKET_PRESSURE_DECAY;
                if (Math.abs(inventoryItem.marketPressure) < 0.001) {
                    inventoryItem.marketPressure = 0;
                }
            });
            this._recordPriceHistory(location.id);
        });
    }
    
    /**
     * Simulates the weekly replenishment of commodity stock using a hybrid model.
     * Stock gradually moves towards a target influenced by player actions, with a final random fluctuation.
     */
    replenishMarketInventory() {
        DB.MARKETS.forEach(market => {
            DB.COMMODITIES.forEach(c => {
                if (c.tier > this.gameState.player.revealedTier) return;

                const inventoryItem = this.gameState.market.inventory[market.id][c.id];

                // Market Memory: Reset if untouched for 120 days.
                if (inventoryItem.lastPlayerInteractionTimestamp > 0 && (this.gameState.day - inventoryItem.lastPlayerInteractionTimestamp) > 120) {
                    inventoryItem.quantity = this._calculateBaselineStock(market, c);
                    inventoryItem.lastPlayerInteractionTimestamp = 0;
                    inventoryItem.marketPressure = 0;
                    inventoryItem.depletionDay = 0; // Clear depletion day on reset
                    inventoryItem.priceLockEndDay = 0; // <-- ADDED: Clear price lock on reset
                } else {
                    // Phase 1: Establish Dynamic Target Stock
                    const [minAvail, maxAvail] = c.canonicalAvailability;
                    const baseMeanStock = (minAvail + maxAvail) / 2 * (market.availabilityModifier?.[c.id] ?? 1.0);
                    
                    // Market adaptation: high player selling pressure reduces the target stock.
                    let pressureForAdaptation = inventoryItem.marketPressure;
                    // If pressure is negative (player buying), delay its effect for 1 week
                    if (pressureForAdaptation < 0 && this.gameState.day < inventoryItem.lastPlayerInteractionTimestamp + 7) {
                        pressureForAdaptation = 0; // Ignore recouping pressure for the first week
                    }

                    // Only allow negative pressure (player buying) to increase target stock.
                    // Positive pressure (player selling) no longer decreases it.
                    if (pressureForAdaptation > 0) {
                        pressureForAdaptation = 0;
                    }

                    // Market adaptation factor
                    const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5); // Now only ever >= 1.0
                    
                    // --- PHASE 2: AGE PERK (COMMODITY SUPPLY) ---
                    // "Increased commodity supply available at all markets by 2%"
                    const supplyBonus = this.gameState.player.statModifiers?.commoditySupply || 0;
                    // --- END PHASE 2 ---

                    const targetStock = baseMeanStock * marketAdaptationFactor * (1 + supplyBonus);

                    // Phase 2: Gradual Replenishment Towards Target
                    const difference = targetStock - inventoryItem.quantity;
                    const replenishAmount = difference * 0.10; // Move 10% towards the target each week
                    
                    // --- NEW: Emergency Stock Boost ---
                    let emergencyStock = 0;
                    if (inventoryItem.isDepleted) {
                        // If item was depleted, add a small emergency boost
                        emergencyStock = skewedRandom(1, 5);
                        inventoryItem.isDepleted = false; // Reset depletion flag
                        // We DO NOT reset depletionDay, as evolveMarketPrices uses it for 7 days
                    } else if (inventoryItem.quantity <= 0) {
                        // Also boost if it just happens to be 0
                        emergencyStock = skewedRandom(1, 5);
                    }
                    // --- End Emergency Stock Boost ---

                    inventoryItem.quantity += (replenishAmount + emergencyStock);
                }

                // Phase 3: Apply Final Visual Fluctuation
                const fluctuationPercent = (Math.random() * 0.15 + 0.15); // Random value between 0.15 and 0.30
                const fluctuationDirection = Math.random() < 0.5 ? -1 : 1;
                const finalFluctuation = 1 + (fluctuationPercent * fluctuationDirection);
                inventoryItem.quantity *= finalFluctuation;
                
                // Apply system state modifiers if any exist.
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
        const inventoryItem = this.gameState.market.inventory[this.gameState.currentLocationId][goodId];
        
        // This calculation is the core driver of the price change.
        // It sets marketPressure, which is used by pressureEffect after 7 days.
        const pressureChange = ((quantity / (good.canonicalAvailability[1] || 100)) * good.tier) / 10;
        
        if (transactionType === 'buy') {
            inventoryItem.marketPressure -= pressureChange;
        } else { // 'sell'
            inventoryItem.marketPressure += pressureChange;
        }

        // --- NEW: Set Variable Price Lock Duration ---
        const dayOfYear = (this.gameState.day - 1) % 365 + 1;
        let minDuration, maxDuration;

        if (dayOfYear <= 182) { // First half of the year
            minDuration = 75; // 2.5 months
            maxDuration = 120; // 4 months
        } else { // Second half of the year
            minDuration = 105; // 3.5 months
            maxDuration = 195; // 6.5 months
        }

        const lockDuration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
        inventoryItem.priceLockEndDay = this.gameState.day + lockDuration;
        // --- END CHANGE ---

        inventoryItem.lastPlayerInteractionTimestamp = this.gameState.day;
    }

    // --- VIRTUAL WORKBENCH: NEW METHOD ---
    /**
     * Checks if a purchase triggers a market depletion event.
     * This logic is called by PlayerActionService when a good's stock reaches <= 0.
     * @param {object} good - The static commodity data (from DB).
     * @param {object} inventoryItem - The dynamic inventory item from gameState.
     * @param {number} stockBeforeBuy - The quantity of the item *before* the player's purchase.
     * @param {number} currentDay - The current game day.
     */
    checkDepletion(good, inventoryItem, stockBeforeBuy, currentDay) {
        // Calculate target stock to check 8% threshold
        const market = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        const [minAvail, maxAvail] = good.canonicalAvailability;
        const modifier = market.availabilityModifier?.[good.id] ?? 1.0;
        const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
        
        let pressureForAdaptation = inventoryItem.marketPressure;
        if (pressureForAdaptation > 0) pressureForAdaptation = 0; // Only recouping (buy) pressure affects target
        
        const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
        const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor);
        
        const depletionThreshold = targetStock * 0.08;
        
        // The amount purchased was the entire stock that was on hand
        const depletionBuyQuantity = stockBeforeBuy; 

        // Check if buy quantity was >= 8% target and if 1 year has passed since last bonus
        if (depletionBuyQuantity >= depletionThreshold && currentDay > (inventoryItem.depletionBonusDay + 365)) {
            inventoryItem.isDepleted = true; // Set flag for MarketService's evolveMarketPrices
            inventoryItem.depletionDay = currentDay;
            inventoryItem.depletionBonusDay = currentDay; // Set cooldown
        }
    }
    // --- END VIRTUAL WORKBENCH ---

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
            
            // --- PHASE 2: AGE PERK (RARE SHIP SPAWN RATE) ---
            const spawnRateBonus = this.gameState.player.statModifiers?.shipSpawnRate || 0;
            const finalSpawnChance = GAME_RULES.RARE_SHIP_CHANCE + spawnRateBonus;
            // --- END PHASE 2 ---

            rareShips.forEach(([id, ship]) => {
                if (Math.random() < finalSpawnChance) {
                    shipsForSaleIds.push(id);
                }
            });
            this.gameState.market.shipyardStock[locationId] = {
                day: this.gameState.day,
                shipsForSale: shipsForSaleIds
            };

            // --- [[START]] PHASE 4: TRAVEL/SPAWN HYDRATION ---
            // Whenever new stock is generated (e.g. during travel), immediately 
            // hydrate those specific ships so they are ready when the user visits the shipyard.
            const spawnRequests = shipsForSaleIds.map(shipId => ({ type: 'ship', id: shipId, seed: player.visualSeed }));
            AssetService.hydrateAssets(spawnRequests);
            // --- [[END]] PHASE 4: TRAVEL/SPAWN HYDRATION ---
        });
    }
}