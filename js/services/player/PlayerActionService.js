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
        // Apply Signal Hacker or other buy attributes
        const priceMod = GameAttributes.getPriceModifier(upgrades, 'buy');
        let price = Math.max(1, Math.round(basePrice * priceMod));
        // --- END UPGRADE SYSTEM ---

        let totalCost = price * quantity;

        // --- PHASE 2: AGE PERK (PURCHASE COST) ---
        // Apply "Friends with Benefits" / Age discounts
        const agePurchaseDiscount = state.player.statModifiers?.purchaseCost || 0;
        if (agePurchaseDiscount > 0) {
            totalCost = Math.floor(totalCost * (1 - agePurchaseDiscount));
        }
        // --- END PHASE 2 ---

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (NEPTUNE & BELT DISCOUNT) ---
        // Neptune Quirk: Buying > 50 units of Propellant or Plasteel grants 10% discount.
        if (state.currentLocationId === LOCATION_IDS.NEPTUNE && 
            (goodId === COMMODITY_IDS.PROPELLANT || goodId === COMMODITY_IDS.PLASTEEL) &&
            quantity > 50) {
            
            totalCost = Math.floor(totalCost * 0.90);
            this.uiManager.createFloatingText("BULK DISCOUNT APPLIED", window.innerWidth / 2, window.innerHeight / 2 - 50, '#34d399');
        }

        // Belt Quirk: 5% Discount on Water Ice & Xeno-Geologicals
        if (state.currentLocationId === LOCATION_IDS.BELT &&
            (goodId === COMMODITY_IDS.WATER_ICE || goodId === COMMODITY_IDS.XENO_GEOLOGICALS)) {
            
            totalCost = Math.floor(totalCost * 0.95);
            this.uiManager.createFloatingText("MINER'S DISCOUNT", window.innerWidth / 2, window.innerHeight / 2 - 50, '#34d399');
        }
        // --- END VIRTUAL WORKBENCH ---

        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;

        if (marketStock <= 0) { this.uiManager.queueModal('event-modal', "Sold Out", `This station has no more ${good.name} available.`); return false; }
        if (quantity > marketStock) { this.uiManager.queueModal('event-modal', "Limited Stock", `This station only has ${marketStock} units available.`); return false; }

        // --- UPGRADE SYSTEM: EFFECTIVE STATS CHECK ---
        // Check capacity against the "Effective" stats (includes Aux Storage)
        const activeShipStats = this.simulationService.getEffectiveShipStats(activeShipId);
        const activeInventory = this.simulationService._getActiveInventory();
        
        if (calculateInventoryUsed(activeInventory) + quantity > activeShipStats.cargoCapacity) {
             this.uiManager.queueModal('event-modal', "Cargo Hold Full", "You don't have enough space.");
            return false;
        }
        // --- END UPGRADE SYSTEM ---

         if (state.player.credits < totalCost) { this.uiManager.queueModal('event-modal', "Insufficient Funds", "Your credit balance is too low."); return false; }

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        const stockBeforeBuy = inventoryItem.quantity; 
        inventoryItem.quantity -= quantity;

        // Check for depletion bonus logic
        if (inventoryItem.quantity <= 0) {
            this.marketService.checkDepletion(good, inventoryItem, stockBeforeBuy, state.day);
        }

        // --- VIRTUAL WORKBENCH: ATTR_TRADER Logic ---
        // Vindicator "Trader": 15% chance to receive 1 extra unit for free
        let finalQuantity = quantity;
        // Legacy access safely returns empty if not used, preserving logic structure
        const shipAttributes = GameAttributes.getShipAttributes(activeShipId);
        if (shipAttributes.includes('ATTR_TRADER') && Math.random() < 0.15) {
            finalQuantity += 1;
            this.uiManager.createFloatingText("+1 Bonus!", window.innerWidth/2, window.innerHeight/2, '#34d399');
            this.logger.info.player(state.day, 'ATTR_TRIGGER', `Trader perk triggered: +1 ${good.name}.`);
        }
        // --- END VIRTUAL WORKBENCH ---

        const playerInvItem = activeInventory[goodId];
        playerInvItem.avgCost = ((playerInvItem.quantity * playerInvItem.avgCost) + totalCost) / (playerInvItem.quantity + finalQuantity);
        playerInvItem.quantity += finalQuantity;

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
     * Sells a specified quantity of a commodity to the current market.
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

        const activeInventory = this.simulationService._getActiveInventory();
        const item = activeInventory[goodId];
        if (!item || item.quantity < quantity) {
             this.uiManager.queueModal('event-modal', "Insufficient Inventory", `You do not have ${quantity} units of ${good.name} to sell.`);
            return 0;
        }

        const activeShipId = state.player.activeShipId;
        const shipState = state.player.shipStates[activeShipId];
        const upgrades = shipState.upgrades || [];

        const { totalPrice } = this.uiManager._calculateSaleDetails(goodId, quantity);
        let totalSaleValue = totalPrice;

        // --- UPGRADE SYSTEM: PRICE MODIFIERS ---
        // Apply Guild Badge or other sell attributes
        const priceMod = GameAttributes.getPriceModifier(upgrades, 'sell');
        totalSaleValue = Math.floor(totalSaleValue * priceMod);
        // --- END UPGRADE SYSTEM ---

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (SOL EXPORT YIELD) ---
        // Sol Station Quirk: +25% Sell Price for Graphene Lattices & Plasteel
        if (state.currentLocationId === LOCATION_IDS.SUN &&
            (goodId === COMMODITY_IDS.GRAPHENE_LATTICES || goodId === COMMODITY_IDS.PLASTEEL)) {
            totalSaleValue = Math.floor(totalSaleValue * 1.25);
            this.uiManager.createFloatingText("EXPORT YIELD BONUS", window.innerWidth / 2, window.innerHeight / 2 - 50, '#eab308');
        }
        // --- END VIRTUAL WORKBENCH ---

        const profit = totalSaleValue - (item.avgCost * quantity);
        if (profit > 0) {
            // --- PHASE 2: AGE PERK (PROFIT BONUS) ---
            const ageProfitBonus = state.player.statModifiers?.profitBonus || 0;
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + ageProfitBonus;
            // --- END PHASE 2 ---
            
            totalSaleValue += profit * totalBonus;
        }

        totalSaleValue = Math.floor(totalSaleValue);
        
        this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + totalSaleValue);

        item.quantity -= quantity;
        if (item.quantity === 0) item.avgCost = 0;

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
     * @returns {object} { success: boolean, errorTitle?: string, errorMessage?: string }
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
        if (calculateInventoryUsed(state.player.inventories[shipId]) > 0) {
            return { success: false, errorTitle: "Cannot Sell Ship", errorMessage: "This vessel's cargo hold is not empty." };
        }
    
     const ship = DB.SHIPS[shipId];
        if (!ship) {
            this.logger.error('PlayerActionService', `validateSellShip called with invalid shipId: ${shipId}`);
            return { success: false, errorTitle: "Ship Not Found", errorMessage: "The selected ship does not exist." };
        }
        return { success: true, ship: ship };
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
            const shipState = this.gameState.player.shipStates[shipId]; // Get the state to check upgrades

            if (!ship || !shipState) {
                this.logger.error('PlayerActionService', `executeSellShip called with invalid shipId or state: ${shipId}`);
                return false;
            }
            
            // --- UPGRADE SYSTEM: ECONOMIC RETROFITTING ---
            // Calculate total value: Ship Base Price + Sum of Upgrade Values
            let upgradeValue = 0;
            if (shipState.upgrades && Array.isArray(shipState.upgrades)) {
                shipState.upgrades.forEach(upgradeId => {
                    const def = GameAttributes.getDefinition(upgradeId);
                    if (def) {
                        upgradeValue += def.value;
                    }
                });
            }

            const totalBaseValue = ship.price + upgradeValue;
            const salePrice = Math.floor(totalBaseValue * GAME_RULES.SHIP_SELL_MODIFIER);
            // --- END UPGRADE SYSTEM ---
            
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

            const saleDescription = `You sold the ${shipNameSpan} for <span class="credits-text-pulsing">+${formatCredits(salePrice, true)}</span>.`;
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
        // Kepler's Eye Quirk: 15% Discount on debt repayment.
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
        // Kepler's Eye Quirk: 15% Discount on financing fees.
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
            this.uiManager.createFloatingText(`+${formatCredits(loanData.amount, false)}`, event.clientX, event.clientY, '#34d399'); // Green
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

        // 1. Calculate Base Unit Cost (Cost for 1 Unit of Fuel)
        // Standard rate was "FuelPrice / 2" for 5 units. Thus 1 unit = FuelPrice / 10.
        let unitCost = DB.MARKETS.find(m => m.id === state.currentLocationId).fuelPrice / 10;
        
        // --- VIRTUAL WORKBENCH: STATION QUIRKS (SERVICE COSTS) ---
        // Saturn & Pluto Quirk: 200% Cost
        if (state.currentLocationId === LOCATION_IDS.SATURN || state.currentLocationId === LOCATION_IDS.PLUTO) {
            unitCost *= 2.0;
        }
        // --- END VIRTUAL WORKBENCH ---

        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
             unitCost *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        
        // Apply Fuel Pass Discount
        const attrMod = GameAttributes.getFuelPriceModifier(upgrades);
        unitCost *= attrMod;
        // --- END UPGRADE SYSTEM ---

        // --- PHASE 2: AGE PERK (FUEL COST) ---
        const ageFuelDiscount = state.player.statModifiers?.fuelCost || 0;
        if (ageFuelDiscount > 0) {
            unitCost *= (1 - ageFuelDiscount);
        }
        // --- END PHASE 2 ---

        // 2. Determine Dynamic Tick Amount (5% or 1%)
        const fuelDeficit = effectiveStats.maxFuel - currentFuel;
        const fuelDeficitPct = fuelDeficit / effectiveStats.maxFuel;
        
        let tickAmount = 0;
        // Precision Mode: If < 5% needed, fill 1%. Else, fill 5%.
        if (fuelDeficitPct < 0.05) {
            tickAmount = Math.ceil(effectiveStats.maxFuel * 0.01);
        } else {
            tickAmount = Math.ceil(effectiveStats.maxFuel * 0.05);
        }

        // 3. Final Cost Calculation
        // Ensure minimum 1 credit cost
        let totalCost = Math.max(1, Math.round(unitCost * tickAmount));

        // 4. Transaction
        if (state.player.credits < totalCost) return 0;

        state.player.credits -= totalCost;
        // Cap fuel at maxFuel
        state.player.shipStates[ship.id].fuel = Math.min(effectiveStats.maxFuel, currentFuel + tickAmount);
        
        this.simulationService._logConsolidatedTransaction('fuel', -totalCost, 'Fuel Purchase');

        const refuelBtn = document.getElementById('refuel-btn');
        if (refuelBtn) {
            const rect = refuelBtn.getBoundingClientRect();
             const x = rect.left + rect.width / 2;
            const y = rect.top;
            this.uiManager.createFloatingText(`-${formatCredits(totalCost, false)}`, x, y, '#f87171'); // Red color for cost
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

        // Legacy check
        const shipAttributes = GameAttributes.getShipAttributes(ship.id);
        if (shipAttributes.includes('ATTR_BESPOKE')) {
            // Cannot be repaired
            return 0; 
        }

        // 1. Calculate Base Unit Cost (Cost for 1 HP)
        let unitCost = GAME_RULES.REPAIR_COST_PER_HP;

        // --- VIRTUAL WORKBENCH: STATION QUIRKS (SERVICE COSTS) ---
        // Moon Quirk: 20% Discount
        if (state.currentLocationId === LOCATION_IDS.LUNA) {
            unitCost *= 0.8; 
        }
        // Saturn & Pluto Quirk: 200% Cost
        if (state.currentLocationId === LOCATION_IDS.SATURN || state.currentLocationId === LOCATION_IDS.PLUTO) {
            unitCost *= 2.0;
        }
        // --- END VIRTUAL WORKBENCH ---

        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            unitCost *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }

        // --- UPGRADE SYSTEM: SERVICE ATTRIBUTES ---
        const attrMod = GameAttributes.getServiceCostModifier(upgrades, 'repair');
        unitCost *= attrMod;
        // --- END UPGRADE SYSTEM ---

        // --- PHASE 2: AGE PERK (REPAIR COST) ---
        const ageRepairDiscount = state.player.statModifiers?.repairCost || 0;
        if (ageRepairDiscount > 0) {
            unitCost *= (1 - ageRepairDiscount);
        }
        // --- END PHASE 2 ---

        // 2. Determine Dynamic Tick Amount (5% or 1%)
        const healthDeficit = effectiveStats.maxHealth - currentHealth;
        const healthDeficitPct = healthDeficit / effectiveStats.maxHealth;
        
        let tickAmount = 0;
        if (healthDeficitPct < 0.05) {
            tickAmount = Math.ceil(effectiveStats.maxHealth * 0.01);
        } else {
            tickAmount = Math.ceil(effectiveStats.maxHealth * 0.05);
        }

        // 3. Final Cost Calculation
        let totalCost = Math.max(1, Math.round(unitCost * tickAmount));

        // 4. Transaction
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
            this.uiManager.createFloatingText(`-${formatCredits(totalCost, false)}`, x, y, '#f87171'); // Red color for cost
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

        // 1. Check Ownership
        if (!state.player.ownedShipIds.includes(shipId) || !shipState) {
            return { success: false, error: 'Ship not owned.' };
        }

        // 2. Check Instant Application Rule (Must be Active Ship)
        // This constraint ensures we don't have to recalculate effective stats for inactive ships in background
        if (state.player.activeShipId !== shipId) {
            return { success: false, error: 'Upgrades must be applied to the active ship.' };
        }

        // 3. Check Capacity
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
        // Direct state mutation safe here because we call setState at the end
        if (!state.player.shipStates[shipId].upgrades) {
             state.player.shipStates[shipId].upgrades = [];
        }
        
        state.player.shipStates[shipId].upgrades.push(upgradeId);
        
        this.logger.info.player(state.day, 'UPGRADE_INSTALL', `Installed ${upgradeId} on ${shipId}.`);
        this.gameState.setState({}); // Trigger reactivity
    }
}