// js/services/player/PlayerActionService.js
/**
 * @fileoverview Manages all direct, player-initiated actions that have an
 * immediate effect, such as buying/selling commodities, purchasing ships,
 * and using station services.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { GAME_RULES, PERK_IDS, ACTION_IDS, LOCATION_IDS, COMMODITY_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js';

export class PlayerActionService {
    constructor(gameState, uiManager, missionService, marketService, timeService, logger, simulationServiceFacade) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.missionService = missionService;
        this.marketService = marketService;
        this.timeService = timeService;
        this.logger = logger;
        this.simulationService = simulationServiceFacade;
        this.isTransactionInProgress = false;
    }

    buyItem(goodId, quantity) {
        const state = this.gameState.getState();
        if (state.isGameOver || quantity <= 0) return false;

        const good = DB.COMMODITIES.find(c=>c.id===goodId);
        if (good.licenseId && !state.player.unlockedLicenseIds.includes(good.licenseId)) {
            this.uiManager.queueModal('event-modal', "License Required", `You do not have the required license to trade ${good.name}.`);
            return false;
        }

        const basePrice = this.uiManager.getItemPrice(state, goodId);
        const activeShipId = state.player.activeShipId;
        const shipState = state.player.shipStates[activeShipId];
        const upgrades = shipState.upgrades || [];
        
        const priceMod = GameAttributes.getPriceModifier(upgrades, 'buy');
        let price = Math.max(1, Math.round(basePrice * priceMod));

        let totalCost = price * quantity;

        const agePurchaseDiscount = state.player.statModifiers?.purchaseCost || 0;
        if (agePurchaseDiscount > 0) {
            totalCost = Math.floor(totalCost * (1 - agePurchaseDiscount));
        }

        const systemState = state.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;

        if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.survivalGoodsDiscountMod) {
            if (activeStateDef.modifiers.affectedCommodities?.includes(goodId)) {
                totalCost = Math.floor(totalCost * activeStateDef.modifiers.survivalGoodsDiscountMod);
            }
        }

        if (state.currentLocationId === LOCATION_IDS.NEPTUNE && 
            (goodId === COMMODITY_IDS.PROPELLANT || goodId === COMMODITY_IDS.PLASTEEL) &&
            quantity > 50) {
            
            totalCost = Math.floor(totalCost * 0.90);
            this.uiManager.createFloatingText("BULK DISCOUNT APPLIED", window.innerWidth / 2, window.innerHeight / 2 - 50, '#34d399');
        }

        if (state.currentLocationId === LOCATION_IDS.BELT &&
            (goodId === COMMODITY_IDS.WATER_ICE || goodId === COMMODITY_IDS.XENO_GEOLOGICALS)) {
            
            totalCost = Math.floor(totalCost * 0.95);
            this.uiManager.createFloatingText("MINER'S DISCOUNT", window.innerWidth / 2, window.innerHeight / 2 - 50, '#34d399');
        }

        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;

        if (marketStock <= 0) { this.uiManager.queueModal('event-modal', "Sold Out", `This station has no more ${good.name} available.`); return false; }
        if (quantity > marketStock) { this.uiManager.queueModal('event-modal', "Limited Stock", `This station only has ${marketStock} units available.`); return false; }

        let totalAvailableCapacity = 0;
        const shipCapacities = [];
        
        for (const shipId of state.player.ownedShipIds) {
            const stats = this.simulationService.getEffectiveShipStats(shipId);
            const used = calculateInventoryUsed(state.player.inventories[shipId]);
            const available = stats.cargoCapacity - used;
            totalAvailableCapacity += available;
            shipCapacities.push({ shipId, maxCapacity: stats.cargoCapacity, available });
        }

        if (quantity > totalAvailableCapacity) {
             this.uiManager.queueModal('event-modal', "Fleet Cargo Full", "Your fleet does not have enough cargo space for this transaction.");
            return false;
        }

         if (state.player.credits < totalCost) { this.uiManager.queueModal('event-modal', "Insufficient Funds", "Your credit balance is too low."); return false; }

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        const stockBeforeBuy = inventoryItem.quantity; 
        inventoryItem.quantity -= quantity;

        if (inventoryItem.quantity <= 0) {
            this.marketService.checkDepletion(good, inventoryItem, stockBeforeBuy, state.day);
        }

        let finalQuantity = quantity;
        const shipAttributes = GameAttributes.getShipAttributes(activeShipId);
        if (shipAttributes.includes('ATTR_TRADER') && Math.random() < 0.15) {
            finalQuantity += 1;
            this.uiManager.createFloatingText("+1 Bonus!", window.innerWidth/2, window.innerHeight/2, '#34d399');
            this.logger.info.player(state.day, 'ATTR_TRIGGER', `Trader perk triggered: +1 ${good.name}.`);
        }

        shipCapacities.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.maxCapacity - a.maxCapacity;
        });

        let remainingToBuy = finalQuantity;
        const batchAvgCost = totalCost / finalQuantity;

        for (const shipData of shipCapacities) {
            if (remainingToBuy <= 0) break;
            const toAdd = Math.min(remainingToBuy, shipData.available);
            if (toAdd > 0) {
                const invItem = this.gameState.player.inventories[shipData.shipId][goodId];
                invItem.avgCost = ((invItem.quantity * invItem.avgCost) + (toAdd * batchAvgCost)) / (invItem.quantity + toAdd);
                invItem.quantity += toAdd;
                remainingToBuy -= toAdd;
            }
        }

        this.gameState.player.credits -= totalCost;
        this.logger.info.player(state.day, 'BUY', `Bought ${quantity}x ${good.name} for ${formatCredits(totalCost)}`);
        this.simulationService._logConsolidatedTrade(good.name, quantity, -totalCost);
        
        // Patch to force inject locationId
        const logBuy = this.gameState.player.financeLog;
        if (logBuy && logBuy.length > 0) {
            logBuy[logBuy.length - 1].locationId = state.currentLocationId;
        }
        
        this.missionService.checkTriggers();

        this.marketService.applyMarketImpact(goodId, quantity, 'buy');

        this.gameState.uiState.lastTransactionTimestamp = Date.now();

        if (state.uiState?.enableEconomicTelemetry) {
            if (!this.gameState.telemetry) this.gameState.telemetry = { ticks: [], trades: [], impacts: [] };
            
            this.gameState.telemetry.trades.push({
                day: state.day,
                type: 'PLAYER_TRADE',
                action: 'BUY',
                locationId: state.currentLocationId,
                commodityId: goodId,
                quantity: finalQuantity,
                baseUnitCost: basePrice,
                executionUnitCost: Number((totalCost / finalQuantity).toFixed(2)),
                totalTransactionValue: -totalCost
            });
            
            if (this.gameState.telemetry.trades.length > 1000) this.gameState.telemetry.trades.shift();
        }

        // --- ACHIEVEMENTS: BUY TRACKING HOOKS ---
        if (this.simulationService.achievementService) {
            const ach = this.simulationService.achievementService;
            if (goodId === COMMODITY_IDS.ANTIMATTER) ach.increment('tradeAntimatter', 1);
            if (state.currentLocationId === LOCATION_IDS.EARTH) ach.increment('tradesAt_loc_earth', 1);
            if (state.currentLocationId === LOCATION_IDS.EXCHANGE) ach.increment('tradesAt_loc_exchange', 1);
            ach.increment('totalTradesExecuted', 1);

            if (state.activeIntelDeal && state.activeIntelDeal.commodityId === goodId && state.activeIntelDeal.dealLocationId === state.currentLocationId) {
                ach.increment('intelDealsExecuted', 1);
            }

            const m = this.gameState.state.achievements.metrics.monoTradeId;
            if (m === undefined || m === null || m === goodId) {
                this.gameState.state.achievements.metrics.monoTradeId = goodId;
            } else {
                this.gameState.state.achievements.metrics.monoTradeId = 'FAILED';
            }
        }

        this.gameState.setState({});
        return true;
    }

    sellItem(goodId, quantity) {
        const state = this.gameState.getState();
        if (state.isGameOver || quantity <= 0) return 0;

        const good = DB.COMMODITIES.find(c=>c.id===goodId);
        if (good.licenseId && !state.player.unlockedLicenseIds.includes(good.licenseId)) {
            this.uiManager.queueModal('event-modal', "License Required", `You do not have the required license to trade ${good.name}.`);
            return 0;
        }

        let fleetQty = 0;
        const shipInventories = [];
        
        for (const shipId of state.player.ownedShipIds) {
            const qty = state.player.inventories[shipId]?.[goodId]?.quantity || 0;
            fleetQty += qty;
            shipInventories.push({ 
                shipId, 
                qty, 
                maxCapacity: this.simulationService.getEffectiveShipStats(shipId).cargoCapacity 
            });
        }

        if (quantity > fleetQty) {
             this.uiManager.queueModal('event-modal', "Insufficient Inventory", `Your fleet does not have ${quantity} units of ${good.name} to sell.`);
            return 0;
        }

        const activeShipId = state.player.activeShipId;
        const shipState = state.player.shipStates[activeShipId];
        const upgrades = shipState.upgrades || [];

        const { totalPrice } = this.uiManager._calculateSaleDetails(goodId, quantity);
        let totalSaleValue = totalPrice;

        const priceMod = GameAttributes.getPriceModifier(upgrades, 'sell');
        totalSaleValue = Math.floor(totalSaleValue * priceMod);

        const systemState = state.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;

        if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.sellPriceBonusMod) {
            totalSaleValue = Math.floor(totalSaleValue * activeStateDef.modifiers.sellPriceBonusMod);
        }

        if (state.currentLocationId === LOCATION_IDS.SUN &&
            (goodId === COMMODITY_IDS.GRAPHENE_LATTICES || goodId === COMMODITY_IDS.PLASTEEL)) {
            totalSaleValue = Math.floor(totalSaleValue * 1.25);
            this.uiManager.createFloatingText("EXPORT YIELD BONUS", window.innerWidth / 2, window.innerHeight / 2 - 50, '#eab308');
        }

        shipInventories.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.maxCapacity - a.maxCapacity;
        });

        let remainingToSell = quantity;
        let totalCostBasis = 0;

        for (const shipData of shipInventories) {
            if (remainingToSell <= 0) break;
            const toRemove = Math.min(remainingToSell, shipData.qty);
            if (toRemove > 0) {
                const invItem = this.gameState.player.inventories[shipData.shipId][goodId];
                totalCostBasis += (toRemove * invItem.avgCost);
                invItem.quantity -= toRemove;
                if (invItem.quantity === 0) invItem.avgCost = 0;
                remainingToSell -= toRemove;
            }
        }

        const profit = totalSaleValue - totalCostBasis;
        if (profit > 0) {
            const ageProfitBonus = state.player.statModifiers?.profitBonus || 0;
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + ageProfitBonus;
            
            totalSaleValue += profit * totalBonus;
        }

        totalSaleValue = Math.floor(totalSaleValue);
        
        this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + totalSaleValue);

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        inventoryItem.quantity += quantity;

        this.logger.info.player(state.day, 'SELL', `Sold ${quantity}x ${good.name} for ${formatCredits(totalSaleValue)}`);
        this.simulationService._logConsolidatedTrade(good.name, quantity, totalSaleValue);

        // Patch to force inject locationId
        const logSell = this.gameState.player.financeLog;
        if (logSell && logSell.length > 0) {
            logSell[logSell.length - 1].locationId = state.currentLocationId;
        }

        this.missionService.checkTriggers();

        this.marketService.applyMarketImpact(goodId, quantity, 'sell');

        this.gameState.uiState.lastTransactionTimestamp = Date.now();

        if (state.uiState?.enableEconomicTelemetry) {
            if (!this.gameState.telemetry) this.gameState.telemetry = { ticks: [], trades: [], impacts: [] };
            
            this.gameState.telemetry.trades.push({
                day: state.day,
                type: 'PLAYER_TRADE',
                action: 'SELL',
                locationId: state.currentLocationId,
                commodityId: goodId,
                quantity: quantity,
                baseUnitValue: Number((totalPrice / quantity).toFixed(2)),
                executionUnitValue: Number((totalSaleValue / quantity).toFixed(2)),
                totalTransactionValue: totalSaleValue
            });

            if (this.gameState.telemetry.trades.length > 1000) this.gameState.telemetry.trades.shift();
        }

        // --- ACHIEVEMENTS: SELL TRACKING HOOKS ---
        if (this.simulationService.achievementService) {
            const ach = this.simulationService.achievementService;
            if (goodId === COMMODITY_IDS.ANTIMATTER) ach.increment('tradeAntimatter', 1);
            
            const outerRim = ['loc_jupiter', 'loc_saturn', 'loc_uranus', 'loc_neptune', 'loc_kepler', 'loc_pluto'];
            if (goodId === COMMODITY_IDS.WATER_ICE && outerRim.includes(state.currentLocationId)) {
                ach.increment('soldWaterOuter', quantity);
            }

            if (state.currentLocationId === LOCATION_IDS.EARTH) ach.increment('tradesAt_loc_earth', 1);
            if (state.currentLocationId === LOCATION_IDS.EXCHANGE) ach.increment('tradesAt_loc_exchange', 1);
            ach.increment('totalTradesExecuted', 1);

            if (profit > 0) {
                const currentPeak = this.gameState.state.achievements.metrics.highestSingleTradeProfit || 0;
                if (profit > currentPeak) ach.increment('highestSingleTradeProfit', Math.floor(profit), true);
            }

            if (state.activeIntelDeal && state.activeIntelDeal.commodityId === goodId && state.activeIntelDeal.dealLocationId === state.currentLocationId) {
                ach.increment('intelDealsExecuted', 1);
            }

            const currentCredits = this.gameState.player.credits;
            const prevTycoon = this.gameState.state.achievements.metrics.peakCredits_Tycoon || 0;
            if (currentCredits > prevTycoon) ach.increment('peakCredits_Tycoon', currentCredits, true);
            const prevBillion = this.gameState.state.achievements.metrics.peakCredits_Billion || 0;
            if (currentCredits > prevBillion) ach.increment('peakCredits_Billion', currentCredits, true);

            const galAvg = state.market.galacticAverages[goodId] || 0;
            const avgCostBasis = totalCostBasis / quantity;
            if (avgCostBasis <= (galAvg * 0.5) && (totalSaleValue / quantity) >= (galAvg * 1.5)) {
                ach.increment('centuryDeals', 1);
            }

            const m = this.gameState.state.achievements.metrics.monoTradeId;
            if (m === undefined || m === null || m === goodId) {
                this.gameState.state.achievements.metrics.monoTradeId = goodId;
            } else {
                this.gameState.state.achievements.metrics.monoTradeId = 'FAILED';
            }
        }

        this.gameState.setState({});

        return totalSaleValue;
    }

     validateBuyShip(shipId) {
        if (this.isTransactionInProgress) {
            return { success: false, errorTitle: "Transaction in Progress", errorMessage: "Please wait for the current transaction to complete." };
        }
        const ship = DB.SHIPS[shipId];
        if (!ship) {
            this.logger.error('PlayerActionService', `validateBuyShip called with invalid shipId: ${shipId}`);
            return { success: false, errorTitle: "Ship Not Found", errorMessage: "The selected ship does not exist in the database." };
        }

        let effectivePrice = ship.price;
        const discount = this.gameState.player.statModifiers?.shipPrice || 0;
        if (discount > 0) {
            effectivePrice = Math.floor(ship.price * (1 - discount));
        }

        const systemState = this.gameState.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;

        if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.shipyardPriceMod) {
            effectivePrice = Math.floor(effectivePrice * activeStateDef.modifiers.shipyardPriceMod);
        }

        if (this.gameState.player.credits < effectivePrice) {
             return { success: false, errorTitle: "Insufficient Funds", errorMessage: "You cannot afford this ship." };
        }
        return { success: true };
    }

    executeBuyShip(shipId, event) {
        this.isTransactionInProgress = true;

        try {
            const ship = DB.SHIPS[shipId];
            if (!ship) {
                this.logger.error('PlayerActionService', `executeBuyShip called with invalid shipId: ${shipId}`);
                return null;
            }

            let effectivePrice = ship.price;
            const discount = this.gameState.player.statModifiers?.shipPrice || 0;
            if (discount > 0) {
                effectivePrice = Math.floor(ship.price * (1 - discount));
            }

            const systemState = this.gameState.systemState;
            const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;

            if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.shipyardPriceMod) {
                effectivePrice = Math.floor(effectivePrice * activeStateDef.modifiers.shipyardPriceMod);
            }

            this.gameState.player.credits -= effectivePrice;
            this.logger.info.player(this.gameState.day, 'SHIP_PURCHASE', `Purchased ${ship.name} for ${formatCredits(effectivePrice)}.`);
            if (event) {
                this.uiManager.createFloatingText(`-${formatCredits(effectivePrice, false)}`, event.clientX, event.clientY, '#f87171');
            }
            this.simulationService._logTransaction('ship', -effectivePrice, `Purchased ${ship.name}`);
            this.simulationService.addShipToHangar(shipId);

            const shipyardInventory = this.simulationService._getShipyardInventory();
            const currentShipyardIndex = this.gameState.uiState.shipyardActiveIndex || 0;
            const newShipyardIndex = Math.min(currentShipyardIndex, Math.max(0, shipyardInventory.length - 1));

            if (this.gameState.tutorials.activeBatchId === 'intro_hangar') {
                this.simulationService.setHangarShipyardMode('hangar');
                this.simulationService.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.BUY_SHIP });
            }

            const colorVar = `var(--class-${ship.class.toLowerCase()}-color)`;
            
            let shadowClass = '';
            if (ship.class === 'Z') shadowClass = 'glow-text-z';
            else if (ship.class === 'O') shadowClass = 'glow-text-o';
            else if (ship.class === 'S') shadowClass = 'glow-text-s';

            const shipNameSpan = `<span class="${shadowClass}" style="color: ${colorVar}; font-weight: bold;">${ship.name}</span>`;

            const purchaseDescription = `You purchased the ${shipNameSpan} for <span class="text-glow-red">${formatCredits(-effectivePrice, true)}</span>. This ship has been stored in your Hangar.`;
            this.uiManager.queueModal('event-modal', "Vessel Purchased", purchaseDescription);

            // --- ACHIEVEMENTS: SHIP BUY HOOKS ---
            if (this.simulationService.achievementService) {
                const ach = this.simulationService.achievementService;
                const fleetSize = this.gameState.player.ownedShipIds.length;
                const prevMax = this.gameState.state.achievements.metrics.maxFleetSize || 0;
                if (fleetSize > prevMax) ach.increment('maxFleetSize', fleetSize, true);

                if (ship.class) {
                    ach.increment(`ownedClass_${ship.class.toUpperCase()}`, 1, true);
                }
            }

            this.gameState.setState({
                uiState: {
                    ...this.gameState.uiState,
                    shipyardActiveIndex: newShipyardIndex,
                    lastTransactionTimestamp: Date.now()
                }
            });
            return ship;
        } finally {
            setTimeout(() => { this.isTransactionInProgress = false; }, 100);
        }
    }

    validateSellShip(shipId) {
        if (this.isTransactionInProgress) {
            return { success: false, errorTitle: "Transaction in Progress", errorMessage: "Please wait for the current transaction to complete." };
        }
        const state = this.gameState.getState();
        if (state.player.ownedShipIds.length <= 1) {
             return { success: false, errorTitle: "Action Blocked", errorMessage: "You cannot sell your last remaining ship." };
        }
        if (shipId === state.player.activeShipId) {
            return { success: false, errorTitle: "Action Blocked", errorMessage: "You cannot sell your active ship." };
        }
        
        const ship = DB.SHIPS[shipId];
        if (!ship) {
            this.logger.error('PlayerActionService', `validateSellShip called with invalid shipId: ${shipId}`);
            return { success: false, errorTitle: "Ship Not Found", errorMessage: "The selected ship does not exist." };
        }

        let cargoToMove = calculateInventoryUsed(state.player.inventories[shipId]);
        let availableSpace = 0;

        state.player.ownedShipIds.forEach(id => {
            if (id !== shipId) {
                const stats = this.simulationService.getEffectiveShipStats(id);
                const used = calculateInventoryUsed(state.player.inventories[id]);
                availableSpace += Math.max(0, stats.cargoCapacity - used);
            }
        });

        if (cargoToMove > 0 && cargoToMove > availableSpace) {
            return { 
                success: true,
                ship: ship, 
                requiresForfeit: true, 
                forfeitMessage: `This ship has ${cargoToMove} units of cargo aboard, but the rest of your fleet only has space for ${availableSpace} units.<br>Selling this ship will permanently destroy the excess cargo.`
            };
        }

        return { success: true, ship: ship, requiresForfeit: false };
    }

    executeSellShip(shipId, event) {
        this.isTransactionInProgress = true;

        try {
            const ship = DB.SHIPS[shipId];
            const shipState = this.gameState.player.shipStates[shipId];

            if (!ship || !shipState) {
                this.logger.error('PlayerActionService', `executeSellShip called with invalid shipId or state: ${shipId}`);
                return false;
            }

            const inventoryToMove = this.gameState.player.inventories[shipId];
            let transferredSome = false;
            let forfeitedSome = false;

            if (inventoryToMove) {
                const remainingFleet = this.gameState.player.ownedShipIds
                    .filter(id => id !== shipId)
                    .map(id => ({
                        id,
                        maxCapacity: this.simulationService.getEffectiveShipStats(id).cargoCapacity
                    }))
                    .sort((a, b) => {
                        if (a.id === this.gameState.player.activeShipId) return -1;
                        if (b.id === this.gameState.player.activeShipId) return 1;
                        return b.maxCapacity - a.maxCapacity;
                    });

                for (const [goodId, item] of Object.entries(inventoryToMove)) {
                    let remainingToTransfer = item.quantity;
                    if (remainingToTransfer <= 0) continue;

                    for (const fleetShip of remainingFleet) {
                        if (remainingToTransfer <= 0) break;
                        
                        const targetInv = this.gameState.player.inventories[fleetShip.id];
                        const currentUsed = calculateInventoryUsed(targetInv);
                        const space = Math.max(0, fleetShip.maxCapacity - currentUsed);
                        
                        const toMove = Math.min(remainingToTransfer, space);
                        if (toMove > 0) {
                            transferredSome = true;
                            if (!targetInv[goodId]) {
                                targetInv[goodId] = { quantity: 0, avgCost: 0 };
                            }
                            const targetItem = targetInv[goodId];
                            targetItem.avgCost = ((targetItem.quantity * targetItem.avgCost) + (toMove * item.avgCost)) / (targetItem.quantity + toMove);
                            targetItem.quantity += toMove;
                            
                            remainingToTransfer -= toMove;
                        }
                    }
                    if (remainingToTransfer > 0) {
                        forfeitedSome = true;
                    }
                }
            }
            
            let upgradeValue = 0;
            if (shipState.upgrades && Array.isArray(shipState.upgrades)) {
                shipState.upgrades.forEach(upgradeId => {
                    const def = GameAttributes.getDefinition(upgradeId);
                    if (def) {
                        upgradeValue += GameAttributes.getUpgradeHardwareCost(def.tier || 1, ship.price);
                    }
                });
            }

            const totalBaseValue = ship.price + upgradeValue;
            const salePrice = Math.floor(totalBaseValue * GAME_RULES.SHIP_SELL_MODIFIER);
            
            this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + salePrice);

            this.logger.info.player(this.gameState.day, 'SHIP_SALE', `Sold ${ship.name} (with upgrades) for ${formatCredits(salePrice)}.`);
            if (event) {
                this.uiManager.createFloatingText(`+${formatCredits(salePrice, false)}`, event.clientX, event.clientY, '#34d399');
            }
            this.simulationService._logTransaction('ship', salePrice, `Sold ${ship.name}`);

            const shipIndex = this.gameState.player.ownedShipIds.indexOf(shipId);
            this.gameState.player.ownedShipIds = this.gameState.player.ownedShipIds.filter(id => id !== shipId);
            delete this.gameState.player.shipStates[shipId];
            delete this.gameState.player.inventories[shipId]; 

            let newActiveIndex = this.gameState.uiState.hangarActiveIndex;
            if (shipIndex < newActiveIndex) {
                newActiveIndex--;
            }
            if (newActiveIndex >= this.gameState.player.ownedShipIds.length) {
                newActiveIndex = Math.max(0, this.gameState.player.ownedShipIds.length - 1);
            }

            const colorVar = `var(--class-${ship.class.toLowerCase()}-color)`;
            
            let shadowClass = '';
            if (ship.class === 'Z') shadowClass = 'glow-text-z';
            else if (ship.class === 'O') shadowClass = 'glow-text-o';
            else if (ship.class === 'S') shadowClass = 'glow-text-s';

            const shipNameSpan = `<span class="${shadowClass}" style="color: ${colorVar}; font-weight: bold;">${ship.name}</span>`;

            let cargoOutcomeText = "";
            if (transferredSome && !forfeitedSome) {
                cargoOutcomeText = "<br>Its cargo has been fully transferred to your fleet.";
            } else if (transferredSome && forfeitedSome) {
                cargoOutcomeText = "<br>Its cargo was partially transferred, but excess was <span class=\"text-red-400 font-bold\">permanently destroyed</span> due to lack of space.";
            } else if (!transferredSome && forfeitedSome) {
                cargoOutcomeText = "<br>All cargo aboard was <span class=\"text-red-400 font-bold\">permanently destroyed</span> due to lack of space in the remaining fleet.";
            }

            const saleDescription = `You sold the ${shipNameSpan} for <span class="credits-text-pulsing">+${formatCredits(salePrice, true)}</span>.${cargoOutcomeText}`;
            this.uiManager.queueModal('event-modal', "Vessel Sold", saleDescription);

            // --- ACHIEVEMENTS: SHIP SELL HOOK ---
            if (this.simulationService.achievementService) {
                this.simulationService.achievementService.increment('shipsSold', 1);
            }

            this.gameState.setState({
                uiState: {
                    ...this.gameState.uiState,
                    hangarActiveIndex: newActiveIndex,
                    lastTransactionTimestamp: Date.now()
                }
            });
            return salePrice;
        } finally {
            setTimeout(() => { this.isTransactionInProgress = false; }, 100);
        }
    }

    validateSetActiveShip(shipId) {
        if (this.isTransactionInProgress) {
            return { success: false, errorTitle: "Transaction in Progress", errorMessage: "Please wait for the current transaction to complete." };
        }
        if (!this.gameState.player.ownedShipIds.includes(shipId)) {
            this.logger.error('PlayerActionService', `validateSetActiveShip called with unowned shipId: ${shipId}`);
            return { success: false, errorTitle: "Ship Not Found", errorMessage: "You do not own this ship." };
        }
        if (this.gameState.player.activeShipId === shipId) {
            return { success: false, errorTitle: "Action Redundant", errorMessage: "This ship is already your active vessel." };
        }
        return { success: true };
    }

    executeSetActiveShip(shipId) {
        if (!this.gameState.player.ownedShipIds.includes(shipId)) return;
        
        this.isTransactionInProgress = true; 

        try {
            this.gameState.player.activeShipId = shipId;
            const newIndex = this.gameState.player.ownedShipIds.indexOf(shipId);
            if (newIndex !== -1) {
                this.gameState.uiState.hangarActiveIndex = newIndex;
            }

            this.logger.info.player(this.gameState.day, 'SET_ACTIVE_SHIP', `Boarded the ${DB.SHIPS[shipId].name}.`);
            
            this.gameState.setState({
                uiState: {
                    ...this.gameState.uiState,
                    lastTransactionTimestamp: Date.now()
                }
            });
        } finally {
            setTimeout(() => { this.isTransactionInProgress = false; }, 100);
        }
    }

    payOffDebt(amount, event) {
        if (this.gameState.isGameOver) return;
        const { player, currentLocationId } = this.gameState;
        
        player.debt = Math.round(player.debt);
        
        let paymentAmount = amount;
        let domEvent = event;
        if (amount instanceof Event || (amount && amount.type)) {
            paymentAmount = null; 
            domEvent = amount;
        }

        let paymentRequired = paymentAmount !== null && paymentAmount !== undefined ? Math.round(paymentAmount) : player.debt;
        if (paymentRequired > player.debt) paymentRequired = player.debt;
        if (paymentRequired <= 0) return;
        
        let actualCost = paymentRequired;
        
        if (currentLocationId === LOCATION_IDS.KEPLER) {
            actualCost = Math.floor(paymentRequired * 0.85);
        }

        if (player.credits < actualCost) {
            const extraText = (currentLocationId === LOCATION_IDS.KEPLER) ? 
                ` Even with the Kepler discount (${formatCredits(actualCost)}), you are short.` : "";
            this.uiManager.queueModal('event-modal', "Insufficient Funds", `You can't afford to pay this amount.${extraText}`);
            return;
        }

        player.credits -= actualCost;
        player.debt -= paymentRequired;

        if (domEvent) {
             this.uiManager.createFloatingText(`-${formatCredits(actualCost, false)}`, domEvent.clientX, domEvent.clientY, '#f87171');
        }

        this.logger.info.player(this.gameState.day, 'DEBT_PAID', `Paid off ${formatCredits(paymentRequired)} in debt (Cost: ${formatCredits(actualCost)}).`);
        this.simulationService._logTransaction('loan', -actualCost, `Paid down debt principal`);
        
        if (player.debt <= 0) {
            player.debt = 0;
            player.monthlyInterestAmount = 0;
            player.loanStartDate = null;
            player.loanDueDate = null;
            player.loanType = 'guild';
            player.repoNextEventDay = null;
            player.lastRepoStrikeDay = null;
            player.seenGarnishmentWarning = false;
        }

        this.missionService.checkTriggers();

        this.gameState.setState({});
    }

    takeLoan(loanData, event) {
        const { player, day, currentLocationId } = this.gameState;
        if (player.debt > 0) {
            this.uiManager.queueModal('event-modal', "Loan Unavailable", `You must pay off your existing debt first.`);
            return;
        }
        
        let finalFee = loanData.fee;
        
        if (currentLocationId === LOCATION_IDS.KEPLER) {
            finalFee = Math.floor(loanData.fee * 0.85);
        }

        if (player.credits < finalFee) {
            this.uiManager.queueModal('event-modal', "Unable to Secure Loan", `The financing fee is ${formatCredits(finalFee)}, but you only have ${formatCredits(player.credits)}.`);
            return;
        }

        player.credits -= finalFee;
        if (finalFee > 0) {
            this.simulationService._logTransaction('loan', -finalFee, `Financing fee for ${formatCredits(loanData.amount)} loan`);
        }
        
        player.credits = Math.min(Number.MAX_SAFE_INTEGER, player.credits + loanData.amount);

        if (event) {
            this.uiManager.createFloatingText(`+${formatCredits(loanData.amount, false)}`, event.clientX, event.clientY, '#34d399');
        }

        this.simulationService._logTransaction('loan', loanData.amount, `Acquired ${formatCredits(loanData.amount)} loan`);

        player.debt += loanData.amount;
        player.monthlyInterestAmount = loanData.interest;
        player.loanStartDate = day;
        player.loanDueDate = day + (loanData.termDays || 1080);
        player.loanType = loanData.type || 'guild';
        player.repoNextEventDay = null;
        player.lastRepoStrikeDay = null;
        player.seenGarnishmentWarning = false;

        let feeText = finalFee > 0 ? `<br>A financing fee of <span class="text-glow-red">${formatCredits(-finalFee, true)}</span> was deducted.` : `<br>No upfront financing fee was required.`;
        const loanDesc = `You've acquired a loan of <span class="credits-text-pulsing">${formatCredits(loanData.amount, true)}</span>.${feeText}`;
        
        this.uiManager.queueModal('event-modal', "Loan Acquired", loanDesc);
        this.logger.info.player(day, 'LOAN_TAKEN', `Took a ${player.loanType} loan for ${formatCredits(loanData.amount)}.`);
        this.gameState.setState({});
    }

    purchaseLicense(licenseId) {
        const license = DB.LICENSES[licenseId];
        const { player, day } = this.gameState;

        if (!license) return { success: false, error: 'INVALID_LICENSE' };
        if (license.type !== 'purchase') return { success: false, error: 'NOT_FOR_PURCHASE' };
        if (player.unlockedLicenseIds.includes(licenseId)) return { success: false, error: 'ALREADY_OWNED' };
        
        if (player.credits < license.cost) {
            return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }

        player.credits -= license.cost;
        player.unlockedLicenseIds.push(licenseId);
        this.logger.info.player(day, 'LICENSE_PURCHASE', `Purchased ${license.name}.`);
        this.simulationService._logTransaction('license', -license.cost, `Purchased ${license.name}`);
        
        if (this.simulationService.achievementService) {
            this.simulationService.achievementService.increment('licensesOwned', player.unlockedLicenseIds.length, true);
        }

        this.gameState.setState({});

        return { success: true };
    }

    purchaseIntel(cost) {
        const { player, currentLocationId, day } = this.gameState;
        if (player.credits < cost) {
            this.uiManager.queueModal('event-modal', "Insufficient Funds", "You can't afford this intel.");
            return;
        }

        player.credits -= cost;
        this.logger.info.player(day, 'INTEL_PURCHASE', `Purchased intel for ${formatCredits(cost)}.`);
        this.simulationService._logTransaction('intel', -cost, 'Purchased market intel');
        this.gameState.intel.available[currentLocationId] = false;

        const otherMarkets = DB.MARKETS.filter(m => m.id !== currentLocationId && player.unlockedLicenseIds.includes(m.id));
        if (otherMarkets.length === 0) return;

        const targetMarket = otherMarkets[Math.floor(Math.random() * otherMarkets.length)];
        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= player.revealedTier);
        const commodity = availableCommodities[Math.floor(Math.random() * availableCommodities.length)];

        if (commodity) {
             this.gameState.intel.active = {
                targetMarketId: targetMarket.id,
                commodityId: commodity.id,
                type: 'demand',
                startDay: day,
                endDay: day + 100
            };
        }
  
        // --- ACHIEVEMENTS: INTEL PURCHASE HOOK ---
        if (this.simulationService.achievementService) {
            this.simulationService.achievementService.increment('intelDealsPurchased', 1);
        }

        this.gameState.setState({});
    }

    refuelTick() {
        const state = this.gameState;
        const ship = this.simulationService._getActiveShip();
        if (!ship) return 0;

        const effectiveStats = this.simulationService.getEffectiveShipStats(ship.id);
        const currentFuel = state.player.shipStates[ship.id].fuel;
        
        if (currentFuel >= effectiveStats.maxFuel) return 0;

        const shipState = state.player.shipStates[ship.id];
        const upgrades = shipState.upgrades || [];
        const statusEffects = shipState.statusEffects || []; 
        const shipDef = DB.SHIPS[ship.id];

        let fuelClassMod = 1;
        if (shipDef) {
            switch(shipDef.class) {
                case 'B': fuelClassMod = 5; break;
                case 'A': fuelClassMod = 25; break;
                case 'S': fuelClassMod = 150; break;
                case 'O':
                case 'Z': fuelClassMod = 500; break;
            }
        }

        let unitCost = ((DB.MARKETS.find(m => m.id === state.currentLocationId).fuelPrice / 10) * 0.50) * fuelClassMod;
        
        if (state.currentLocationId === LOCATION_IDS.SATURN || state.currentLocationId === LOCATION_IDS.PLUTO) {
            unitCost *= 2.0;
        }

        if (state.player.activePerks[PERK_IDS.VENUSIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
             unitCost *= (1 - DB.PERKS[PERK_IDS.VENUSIAN_SYNDICATE].fuelDiscount);
        }
        
        const attrMod = GameAttributes.getFuelPriceModifier(upgrades);
        unitCost *= attrMod;

        const ageFuelDiscount = state.player.statModifiers?.fuelCost || 0;
        if (ageFuelDiscount > 0) {
            unitCost *= (1 - ageFuelDiscount);
        }

        // --- PHASE 4: STATUS EFFECT SURCHARGE ---
        if (statusEffects.some(s => s.id === 'status_service_surcharges')) {
            unitCost *= 3;
        }

        const systemState = state.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        const isTargetLocation = systemState && systemState.targetLocations?.includes(state.currentLocationId);
        
        if (activeStateDef && activeStateDef.modifiers) {
            if (activeStateDef.modifiers.serviceCostMod) unitCost *= activeStateDef.modifiers.serviceCostMod;
            if (isTargetLocation && activeStateDef.modifiers.localServiceCostMod !== undefined) unitCost *= activeStateDef.modifiers.localServiceCostMod;
        }

        let fuelTargetMax = effectiveStats.maxFuel;
        if (statusEffects.some(s => s.id === 'status_contaminated_fuel')) {
            fuelTargetMax = Math.floor(effectiveStats.maxFuel * 0.5); 
        }

        const fuelDeficit = fuelTargetMax - currentFuel;
        const fuelDeficitPct = fuelDeficit / effectiveStats.maxFuel;
        
        let tickAmount = 0;
        if (fuelDeficit > 0) {
            if (fuelDeficitPct < 0.05) {
                 tickAmount = Math.ceil(effectiveStats.maxFuel * 0.01);
            } else {
                 tickAmount = Math.ceil(effectiveStats.maxFuel * 0.05);
            }
            tickAmount = Math.min(tickAmount, fuelDeficit);
        }

        let totalCost = Math.max(1, Math.round(unitCost * tickAmount));

        if (state.player.credits < totalCost || tickAmount <= 0) return 0;

        state.player.credits -= totalCost;
        state.player.shipStates[ship.id].fuel = Math.min(effectiveStats.maxFuel, currentFuel + tickAmount);
        
        this.simulationService._logConsolidatedTransaction('fuel', -totalCost, 'Fuel Purchase');

        const refuelBtn = document.getElementById('refuel-btn');
        if (refuelBtn) {
            const rect = refuelBtn.getBoundingClientRect();
             const x = rect.left + rect.width / 2;
            const y = rect.top;
            this.uiManager.createFloatingText(`-${formatCredits(totalCost, false)}`, x, y, '#f87171');
        }

        this.gameState.setState({}); 
        return totalCost;
    }

    repairTick() {
        const state = this.gameState;
        const ship = this.simulationService._getActiveShip();
        if (!ship) return 0;

        const effectiveStats = this.simulationService.getEffectiveShipStats(ship.id);
        const currentHealth = state.player.shipStates[ship.id].health;
        
        if (currentHealth >= effectiveStats.maxHealth) return 0;

        const shipDef = DB.SHIPS[ship.id];
        const shipState = state.player.shipStates[ship.id];
        const upgrades = shipState.upgrades || [];
        const statusEffects = shipState.statusEffects || [];

        const shipAttributes = GameAttributes.getShipAttributes(ship.id);
        if (shipAttributes.includes('ATTR_BESPOKE')) {
            return 0; 
        }

        let unitCost = shipDef ? Math.max(1, shipDef.price * 0.0029) : 215;

        if (state.currentLocationId === LOCATION_IDS.LUNA) {
            unitCost *= 0.8; 
        }
        if (state.currentLocationId === LOCATION_IDS.SATURN || state.currentLocationId === LOCATION_IDS.PLUTO) {
            unitCost *= 2.0;
        }

        if (state.player.activePerks[PERK_IDS.VENUSIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            unitCost *= (1 - DB.PERKS[PERK_IDS.VENUSIAN_SYNDICATE].repairDiscount);
        }

        const attrMod = GameAttributes.getServiceCostModifier(upgrades, 'repair');
        unitCost *= attrMod;

        const ageRepairDiscount = state.player.statModifiers?.repairCost || 0;
        if (ageRepairDiscount > 0) {
            unitCost *= (1 - ageRepairDiscount);
        }

        // --- PHASE 4: STATUS EFFECT SURCHARGE ---
        if (statusEffects.some(s => s.id === 'status_service_surcharges')) {
            unitCost *= 3;
        }

        const systemState = state.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        const isTargetLocation = systemState && systemState.targetLocations?.includes(state.currentLocationId);

        if (activeStateDef && activeStateDef.modifiers) {
            if (activeStateDef.modifiers.repairCostMod !== undefined) unitCost *= activeStateDef.modifiers.repairCostMod;
            if (activeStateDef.modifiers.serviceCostMod) unitCost *= activeStateDef.modifiers.serviceCostMod;
            if (isTargetLocation && activeStateDef.modifiers.localServiceCostMod !== undefined) unitCost *= activeStateDef.modifiers.localServiceCostMod;
        }

        const healthDeficit = effectiveStats.maxHealth - currentHealth;
        const healthDeficitPct = healthDeficit / effectiveStats.maxHealth;
        
        let tickAmount = 0;
        if (healthDeficitPct < 0.05) {
             tickAmount = Math.ceil(effectiveStats.maxHealth * 0.01);
        } else {
             tickAmount = Math.ceil(effectiveStats.maxHealth * 0.05);
        }

        let totalCost = Math.max(1, Math.round(unitCost * tickAmount));

        if (state.player.credits < totalCost) return 0;
        
        state.player.credits -= totalCost;
        state.player.shipStates[ship.id].health = Math.min(effectiveStats.maxHealth, currentHealth + tickAmount);
        
        this.timeService.advanceDays(1);
        if (this.gameState.isGameOver) return totalCost;

        this.simulationService._logConsolidatedTransaction('repair', -totalCost, 'Hull Repairs');
        this.simulationService._checkHullWarnings(ship.id);

        const repairBtn = document.getElementById('repair-btn');
        if (repairBtn) {
             const rect = repairBtn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top;
            this.uiManager.createFloatingText(`-${formatCredits(totalCost, false)}`, x, y, '#f87171');
        }

        // --- ACHIEVEMENTS: REPAIR HOOK ---
        if (this.simulationService.achievementService) {
            this.simulationService.achievementService.increment('spentOnRepairs', totalCost);
        }

        this.gameState.setState({}); 
        return totalCost;
    }

    validateInstallUpgrade(shipId, upgradeId) {
        const state = this.gameState.getState();
        const shipState = state.player.shipStates[shipId];

        if (!state.player.ownedShipIds.includes(shipId) || !shipState) {
            return { success: false, error: 'Ship not owned.' };
        }

        if (state.player.activeShipId !== shipId) {
            return { success: false, error: 'Upgrades must be applied to the active ship.' };
        }

        const currentUpgrades = shipState.upgrades || [];
        if (currentUpgrades.length >= 3) {
            return { success: false, error: 'Upgrade slots full.' };
        }

        return { success: true };
    }

    executeInstallUpgrade(shipId, upgradeId, totalCost = 0) {
        const livePlayer = this.gameState.player;
        const liveUiState = this.gameState.uiState;
        
        if (!livePlayer.shipStates[shipId].upgrades) {
             livePlayer.shipStates[shipId].upgrades = [];
        }
        
        livePlayer.shipStates[shipId].upgrades.push(upgradeId);
        
        if (totalCost > 0) {
            livePlayer.credits -= totalCost;
            if (!liveUiState.purchasedUpgrades) liveUiState.purchasedUpgrades = [];
            liveUiState.purchasedUpgrades.push(upgradeId);
        }
        
        this.logger.info.player(this.gameState.day, 'UPGRADE_INSTALL', `Installed ${upgradeId} on ${shipId}.`);

        // --- ACHIEVEMENTS: UPGRADE TRACKING HOOKS ---
        if (this.simulationService.achievementService) {
            const ach = this.simulationService.achievementService;
            ach.increment('spentOnUpgrades', totalCost);
            
            const len = livePlayer.shipStates[shipId].upgrades.length;
            const maxU = this.gameState.state.achievements.metrics.maxUpgradesInstalled || 0;
            if (len > maxU) ach.increment('maxUpgradesInstalled', len, true);
        }

        this.gameState.setState({});
    }
}