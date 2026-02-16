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
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../UIManager.js').UIManager} uiManager
     * @param {import('../MissionService.js').MissionService} missionService
     * @param {import('../simulation/MarketService.js').MarketService} marketService
     * @param {import('../world/TimeService.js').TimeService} timeService
     * @param {import('../../services/LoggingService.js').Logger} logger
     * @param {import('../SimulationService.js').SimulationService} simulationServiceFacade
     */
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

    /**
     * Handles the purchase of a specified quantity of a commodity from the current market.
     * @param {string} goodId - The COMMODITY_ID of the item to purchase.
     * @param {number} quantity - The integer amount to buy.
     * @returns {boolean} - True if the purchase was successful, false otherwise.
     */
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
        
        // --- UPGRADE SYSTEM: PRICE MODIFIERS ---
        const priceMod = GameAttributes.getPriceModifier(upgrades, 'buy');
        let price = Math.max(1, Math.round(basePrice * priceMod));
        // --- END UPGRADE SYSTEM ---

        let totalCost = price * quantity;

        // --- PHASE 2: AGE PERK (PURCHASE COST) ---
        const agePurchaseDiscount = state.player.statModifiers?.purchaseCost || 0;
        if (agePurchaseDiscount > 0) {
            totalCost = Math.floor(totalCost * (1 - agePurchaseDiscount));
        }
        // --- END PHASE 2 ---

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (NEPTUNE & BELT DISCOUNT) ---
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
        // --- END VIRTUAL WORKBENCH ---

        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;

        if (marketStock <= 0) { this.uiManager.queueModal('event-modal', "Sold Out", `This station has no more ${good.name} available.`); return false; }
        if (quantity > marketStock) { this.uiManager.queueModal('event-modal', "Limited Stock", `This station only has ${marketStock} units available.`); return false; }

        // --- FLEET OVERFLOW SYSTEM: CAPACITY CHECK ---
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
        // --- END FLEET OVERFLOW SYSTEM ---

         if (state.player.credits < totalCost) { this.uiManager.queueModal('event-modal', "Insufficient Funds", "Your credit balance is too low."); return false; }

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        const stockBeforeBuy = inventoryItem.quantity; 
        inventoryItem.quantity -= quantity;

        if (inventoryItem.quantity <= 0) {
            this.marketService.checkDepletion(good, inventoryItem, stockBeforeBuy, state.day);
        }

        // --- VIRTUAL WORKBENCH: ATTR_TRADER Logic ---
        let finalQuantity = quantity;
        const shipAttributes = GameAttributes.getShipAttributes(activeShipId);
        if (shipAttributes.includes('ATTR_TRADER') && Math.random() < 0.15) {
            finalQuantity += 1;
            this.uiManager.createFloatingText("+1 Bonus!", window.innerWidth/2, window.innerHeight/2, '#34d399');
            this.logger.info.player(state.day, 'ATTR_TRIGGER', `Trader perk triggered: +1 ${good.name}.`);
        }
        // --- END VIRTUAL WORKBENCH ---

        // --- FLEET OVERFLOW SYSTEM: DISTRIBUTION LOGIC ---
        // Sort: Active ship first, then remaining inactive ships by max capacity descending
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
        // --- END FLEET OVERFLOW SYSTEM ---

        this.gameState.player.credits -= totalCost;
        this.logger.info.player(state.day, 'BUY', `Bought ${quantity}x ${good.name} for ${formatCredits(totalCost)}`);
        this.simulationService._logConsolidatedTrade(good.name, quantity, -totalCost);
        this.timeService._checkMilestones();
        this.missionService.checkTriggers();

        this.marketService.applyMarketImpact(goodId, quantity, 'buy');

        this.gameState.uiState.lastTransactionTimestamp = Date.now();
        this.gameState.setState({});
        return true;
    }

    /**
     * Sells a specified quantity of a commodity from the fleet to the current market.
     * @param {string} goodId - The COMMODITY_ID of the item to sell.
     * @param {number} quantity - The integer amount to sell.
     * @returns {number} - The total value of the sale, or 0 if failed.
     */
    sellItem(goodId, quantity) {
        const state = this.gameState.getState();
        if (state.isGameOver || quantity <= 0) return 0;

        const good = DB.COMMODITIES.find(c=>c.id===goodId);
        if (good.licenseId && !state.player.unlockedLicenseIds.includes(good.licenseId)) {
            this.uiManager.queueModal('event-modal', "License Required", `You do not have the required license to trade ${good.name}.`);
            return 0;
        }

        // --- FLEET OVERFLOW SYSTEM: INVENTORY CHECK ---
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
        // --- END FLEET OVERFLOW SYSTEM ---

        const activeShipId = state.player.activeShipId;
        const shipState = state.player.shipStates[activeShipId];
        const upgrades = shipState.upgrades || [];

        const { totalPrice } = this.uiManager._calculateSaleDetails(goodId, quantity);
        let totalSaleValue = totalPrice;

        // --- UPGRADE SYSTEM: PRICE MODIFIERS ---
        const priceMod = GameAttributes.getPriceModifier(upgrades, 'sell');
        totalSaleValue = Math.floor(totalSaleValue * priceMod);
        // --- END UPGRADE SYSTEM ---

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (SOL EXPORT YIELD) ---
        if (state.currentLocationId === LOCATION_IDS.SUN &&
            (goodId === COMMODITY_IDS.GRAPHENE_LATTICES || goodId === COMMODITY_IDS.PLASTEEL)) {
            totalSaleValue = Math.floor(totalSaleValue * 1.25);
            this.uiManager.createFloatingText("EXPORT YIELD BONUS", window.innerWidth / 2, window.innerHeight / 2 - 50, '#eab308');
        }
        // --- END VIRTUAL WORKBENCH ---

        // --- FLEET OVERFLOW SYSTEM: DRAIN LOGIC ---
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
        // --- END FLEET OVERFLOW SYSTEM ---

        const profit = totalSaleValue - totalCostBasis;
        if (profit > 0) {
            // --- PHASE 2: AGE PERK (PROFIT BONUS) ---
            const ageProfitBonus = state.player.statModifiers?.profitBonus || 0;
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + ageProfitBonus;
            // --- END PHASE 2 ---
            
            totalSaleValue += profit * totalBonus;
        }

        totalSaleValue = Math.floor(totalSaleValue);
        
        this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + totalSaleValue);

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        inventoryItem.quantity += quantity;

        this.logger.info.player(state.day, 'SELL', `Sold ${quantity}x ${good.name} for ${formatCredits(totalSaleValue)}`);
        this.simulationService._logConsolidatedTrade(good.name, quantity, totalSaleValue);

        this.timeService._checkMilestones();
        this.missionService.checkTriggers();

        this.marketService.applyMarketImpact(goodId, quantity, 'sell');

        this.gameState.uiState.lastTransactionTimestamp = Date.now();
        this.gameState.setState({});

        return totalSaleValue;
    }

    /**
     * Validates if a ship purchase is possible.
     * @param {string} shipId - The ID of the ship to buy.
     * @returns {object} { success: boolean, errorTitle?: string, errorMessage?: string }
     */
     validateBuyShip(shipId) {
        if (this.isTransactionInProgress) {
            return { success: false, errorTitle: "Transaction in Progress", errorMessage: "Please wait for the current transaction to complete." };
        }
        const ship = DB.SHIPS[shipId];
        if (!ship) {
            this.logger.error('PlayerActionService', `validateBuyShip called with invalid shipId: ${shipId}`);
            return { success: false, errorTitle: "Ship Not Found", errorMessage: "The selected ship does not exist in the database." };
        }

        // --- PHASE 2: AGE PERK (SHIP PRICE) ---
        let effectivePrice = ship.price;
        const discount = this.gameState.player.statModifiers?.shipPrice || 0;
        if (discount > 0) {
            effectivePrice = Math.floor(ship.price * (1 - discount));
        }
        // --- END PHASE 2 ---

        if (this.gameState.player.credits < effectivePrice) {
             return { success: false, errorTitle: "Insufficient Funds", errorMessage: "You cannot afford this ship." };
        }
        return { success: true };
    }

    /**
     * Executes the purchase of a new ship (Assumes validation passed).
     * @param {string} shipId - The ID of the ship to buy.
     * @param {Event} [event] - The click event for placing floating text.
     * @returns {object|null} - The purchased ship object.
     */
    executeBuyShip(shipId, event) {
        this.isTransactionInProgress = true;

        try {
            const ship = DB.SHIPS[shipId];
            if (!ship) {
                this.logger.error('PlayerActionService', `executeBuyShip called with invalid shipId: ${shipId}`);
                return null;
            }

            // --- PHASE 2: AGE PERK (SHIP PRICE) ---
            let effectivePrice = ship.price;
            const discount = this.gameState.player.statModifiers?.shipPrice || 0;
            if (discount > 0) {
                effectivePrice = Math.floor(ship.price * (1 - discount));
            }
            // --- END PHASE 2 ---

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

    /**
     * Validates if a ship sale is possible.
     * @param {string} shipId - The ID of the ship to sell.
     * @returns {object} { success: boolean, errorTitle?: string, errorMessage?: string, requiresForfeit?: boolean, forfeitMessage?: string }
     */
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

        // --- PHASE 4: FLEET OVERFLOW SYSTEM (SALE VALIDATION) ---
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
                success: true, // It is allowed, but requires warning
                ship: ship, 
                requiresForfeit: true, 
                forfeitMessage: `This ship has ${cargoToMove} units of cargo aboard, but the rest of your fleet only has space for ${availableSpace} units.<br>Selling this ship will permanently destroy the excess cargo.`
            };
        }
        // --- END PHASE 4 ---

        return { success: true, ship: ship, requiresForfeit: false };
    }

    /**
     * Executes the sale of a ship (Assumes validation passed).
     * @param {string} shipId - The ID of the ship to sell.
     * @param {Event} [event] - The click event for placing floating text.
     * @returns {number|false} - The sale price.
     */
    executeSellShip(shipId, event) {
        this.isTransactionInProgress = true;

        try {
            const ship = DB.SHIPS[shipId];
            const shipState = this.gameState.player.shipStates[shipId];

            if (!ship || !shipState) {
                this.logger.error('PlayerActionService', `executeSellShip called with invalid shipId or state: ${shipId}`);
                return false;
            }

            // --- PHASE 4: FLEET OVERFLOW SYSTEM (AUTO-TRANSFER CARGO) ---
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
                        // Prioritize Active Ship, then descending max capacity
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
                            // Calculate blended average cost for the receiving ship
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
            // --- END AUTO-TRANSFER ---
            
            // --- PERCENTAGE-BASED UPGRADE PRICING ---
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
            delete this.gameState.player.inventories[shipId]; // Remaining un-transferred cargo is naturally deleted here

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

            // Dynamic post-sale cargo statement based on precise outcomes
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

    /**
     * Validates if setting a ship as active is possible.
     * @param {string} shipId - The ID of the ship to make active.
     * @returns {object} { success: boolean, errorTitle?: string, errorMessage?: string }
     */
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


    /**
     * Executes setting the player's currently active ship (Assumes validation passed).
     * @param {string} shipId - The ID of the ship to make active.
     */
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


    /**
     * Pays off the player's entire outstanding debt.
     * @param {Event} [event] - The click event for placing floating text.
     */
    payOffDebt(event) {
        if (this.gameState.isGameOver) return;
        const { player, currentLocationId } = this.gameState;
        
        let paymentRequired = player.debt;
        
        // --- VIRTUAL WORKBENCH: STATION QUIRKS (KEPLER DEBT DISCOUNT) ---
        if (currentLocationId === LOCATION_IDS.KEPLER) {
            paymentRequired = Math.floor(player.debt * 0.85);
        }
        // --- END VIRTUAL WORKBENCH ---

        if (player.credits < paymentRequired) {
            const extraText = (currentLocationId === LOCATION_IDS.KEPLER) ? 
                ` Even with the Kepler discount (${formatCredits(paymentRequired)}), you are short.` : "";
            this.uiManager.queueModal('event-modal', "Insufficient Funds", `You can't afford to pay off your entire debt.${extraText}`);
            return;
        }

        player.credits -= paymentRequired;

        if (event) {
             this.uiManager.createFloatingText(`-${formatCredits(paymentRequired, false)}`, event.clientX, event.clientY, '#f87171');
        }

        this.logger.info.player(this.gameState.day, 'DEBT_PAID', `Paid off ${formatCredits(player.debt)} in debt (Cost: ${formatCredits(paymentRequired)}).`);
        this.simulationService._logTransaction('loan', -paymentRequired, `Paid off debt`);
        player.debt = 0;
        player.monthlyInterestAmount = 0;
        player.loanStartDate = null;

        this.timeService._checkMilestones();
        this.gameState.setState({});
    }

    /**
     * Allows the player to take out a loan, adding to their debt.
     * @param {object} loanData - Contains amount, fee, and interest for the loan.
     * @param {Event} [event] - The click event for placing floating text.
     */
    takeLoan(loanData, event) {
        const { player, day, currentLocationId } = this.gameState;
        if (player.debt > 0) {
            this.uiManager.queueModal('event-modal', "Loan Unavailable", `You must pay off your existing debt first.`);
            return;
        }
        
        let finalFee = loanData.fee;
        
        // --- VIRTUAL WORKBENCH: STATION QUIRKS (KEPLER FINANCING DISCOUNT) ---
        if (currentLocationId === LOCATION_IDS.KEPLER) {
            finalFee = Math.floor(loanData.fee * 0.85);
        }
        // --- END VIRTUAL WORKBENCH ---

        if (player.credits < finalFee) {
            this.uiManager.queueModal('event-modal', "Unable to Secure Loan", `The financing fee is ${formatCredits(finalFee)}, but you only have ${formatCredits(player.credits)}.`);
            return;
        }

        player.credits -= finalFee;
        this.simulationService._logTransaction('loan', -finalFee, `Financing fee for ${formatCredits(loanData.amount)} loan`);
        
        player.credits = Math.min(Number.MAX_SAFE_INTEGER, player.credits + loanData.amount);

        if (event) {
            this.uiManager.createFloatingText(`+${formatCredits(loanData.amount, false)}`, event.clientX, event.clientY, '#34d399');
        }

        this.simulationService._logTransaction('loan', loanData.amount, `Acquired ${formatCredits(loanData.amount)} loan`);

        player.debt += loanData.amount;
        player.monthlyInterestAmount = loanData.interest;
        player.loanStartDate = day;
        player.seenGarnishmentWarning = false;

        const loanDesc = `You've acquired a loan of <span class="credits-text-pulsing">${formatCredits(loanData.amount, true)}</span>.<br>A financing fee of <span class="text-glow-red">${formatCredits(-finalFee, true)}</span> was deducted.`;
        
        this.uiManager.queueModal('event-modal', "Loan Acquired", loanDesc);
        this.logger.info.player(day, 'LOAN_TAKEN', `Took a loan for ${formatCredits(loanData.amount)}.`);
        this.gameState.setState({});
    }

    /**
     * Purchases a trade license for a specific commodity tier.
     * @param {string} licenseId - The ID of the license to purchase.
     * @returns {object} A structured object indicating success or failure with a specific error code.
     */
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
        this.gameState.setState({});

        return { success: true };
    }

    /**
     * Purchases market intel, providing a temporary trade advantage.
     * @param {number} cost - The credit cost of the intel.
     */
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
  
         this.gameState.setState({});
    }

    /**
     * Processes one "tick" of refueling while the button is held, costing credits and adding fuel.
     * @returns {number} - The cost of the fuel tick, or 0 if no fuel was added.
     */
    refuelTick() {
        const state = this.gameState;
        const ship = this.simulationService._getActiveShip();
        if (!ship) return 0;

        // --- UPGRADE SYSTEM: DYNAMIC STATS CHECK ---
        const effectiveStats = this.simulationService.getEffectiveShipStats(ship.id);
        const currentFuel = state.player.shipStates[ship.id].fuel;
        
        // Prevent overfilling
        if (currentFuel >= effectiveStats.maxFuel) return 0;
        // --- END UPGRADE SYSTEM ---

        const shipState = state.player.shipStates[ship.id];
        const upgrades = shipState.upgrades || [];

        let unitCost = DB.MARKETS.find(m => m.id === state.currentLocationId).fuelPrice / 10;
        
        // --- VIRTUAL WORKBENCH: STATION QUIRKS (SERVICE COSTS) ---
        if (state.currentLocationId === LOCATION_IDS.SATURN || state.currentLocationId === LOCATION_IDS.PLUTO) {
            unitCost *= 2.0;
        }
        // --- END VIRTUAL WORKBENCH ---

        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
             unitCost *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        
        const attrMod = GameAttributes.getFuelPriceModifier(upgrades);
        unitCost *= attrMod;

        // --- PHASE 2: AGE PERK (FUEL COST) ---
        const ageFuelDiscount = state.player.statModifiers?.fuelCost || 0;
        if (ageFuelDiscount > 0) {
            unitCost *= (1 - ageFuelDiscount);
        }
        // --- END PHASE 2 ---

        const fuelDeficit = effectiveStats.maxFuel - currentFuel;
        const fuelDeficitPct = fuelDeficit / effectiveStats.maxFuel;
        
        let tickAmount = 0;
        if (fuelDeficitPct < 0.05) {
            tickAmount = Math.ceil(effectiveStats.maxFuel * 0.01);
        } else {
            tickAmount = Math.ceil(effectiveStats.maxFuel * 0.05);
        }

        let totalCost = Math.max(1, Math.round(unitCost * tickAmount));

        if (state.player.credits < totalCost) return 0;

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

    /**
     * Processes one "tick" of repairing while the button is held, costing credits and restoring health.
     * @returns {number} - The cost of the repair tick, or 0 if no repairs were made.
     */
    repairTick() {
        const state = this.gameState;
        const ship = this.simulationService._getActiveShip();
        if (!ship) return 0;

        // --- UPGRADE SYSTEM: DYNAMIC STATS CHECK ---
        const effectiveStats = this.simulationService.getEffectiveShipStats(ship.id);
        const currentHealth = state.player.shipStates[ship.id].health;
        
        if (currentHealth >= effectiveStats.maxHealth) return 0;
        // --- END UPGRADE SYSTEM ---

        const shipState = state.player.shipStates[ship.id];
        const upgrades = shipState.upgrades || [];

        const shipAttributes = GameAttributes.getShipAttributes(ship.id);
        if (shipAttributes.includes('ATTR_BESPOKE')) {
            return 0; 
        }

        let unitCost = GAME_RULES.REPAIR_COST_PER_HP;

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (SERVICE COSTS) ---
        if (state.currentLocationId === LOCATION_IDS.LUNA) {
            unitCost *= 0.8; 
        }
        if (state.currentLocationId === LOCATION_IDS.SATURN || state.currentLocationId === LOCATION_IDS.PLUTO) {
            unitCost *= 2.0;
        }
        // --- END VIRTUAL WORKBENCH ---

        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            unitCost *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }

        const attrMod = GameAttributes.getServiceCostModifier(upgrades, 'repair');
        unitCost *= attrMod;

        // --- PHASE 2: AGE PERK (REPAIR COST) ---
        const ageRepairDiscount = state.player.statModifiers?.repairCost || 0;
        if (ageRepairDiscount > 0) {
            unitCost *= (1 - ageRepairDiscount);
        }
        // --- END PHASE 2 ---

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
        
        // --- PHASE 4: DRYDOCKING (TIME-COST REPAIRS) ---
        this.timeService.advanceDays(1);
        if (this.gameState.isGameOver) return totalCost;
        // --- END PHASE 4 ---

        this.simulationService._logConsolidatedTransaction('repair', -totalCost, 'Hull Repairs');
        this.simulationService._checkHullWarnings(ship.id);

        const repairBtn = document.getElementById('repair-btn');
        if (repairBtn) {
             const rect = repairBtn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top;
            this.uiManager.createFloatingText(`-${formatCredits(totalCost, false)}`, x, y, '#f87171');
        }

        this.gameState.setState({}); 
        return totalCost;
    }

    /**
     * Validates if an upgrade can be installed on a ship.
     * Checks: Ownership, Active Status (Instant App Rule), Capacity.
     * @param {string} shipId 
     * @param {string} upgradeId 
     * @returns {object} { success: boolean, error?: string }
     */
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

    /**
     * Installs an upgrade onto a ship.
     * Assumes validation has passed.
     * @param {string} shipId 
     * @param {string} upgradeId 
     */
    executeInstallUpgrade(shipId, upgradeId) {
        const state = this.gameState;
        if (!state.player.shipStates[shipId].upgrades) {
             state.player.shipStates[shipId].upgrades = [];
        }
        
        state.player.shipStates[shipId].upgrades.push(upgradeId);
        
        this.logger.info.player(state.day, 'UPGRADE_INSTALL', `Installed ${upgradeId} on ${shipId}.`);
        this.gameState.setState({});
    }
}