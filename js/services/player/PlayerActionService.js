// js/services/player/PlayerActionService.js
/**
 * @fileoverview Manages all direct, player-initiated actions that have an
 * immediate effect, such as buying/selling commodities, purchasing ships,
 * and using station services.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { GAME_RULES, PERK_IDS, ACTION_IDS, LOCATION_IDS } from '../../data/constants.js';

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

        const price = this.uiManager.getItemPrice(state, goodId);
        const totalCost = price * quantity;
        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;

        if (marketStock <= 0) { this.uiManager.queueModal('event-modal', "Sold Out", `This station has no more ${good.name} available.`); return false; }
        if (quantity > marketStock) { this.uiManager.queueModal('event-modal', "Limited Stock", `This station only has ${marketStock} units available.`); return false; }

        const activeShip = this.simulationService._getActiveShip();
        const activeInventory = this.simulationService._getActiveInventory();
        if (calculateInventoryUsed(activeInventory) + quantity > activeShip.cargoCapacity) {
             this.uiManager.queueModal('event-modal', "Cargo Hold Full", "You don't have enough space.");
            return false;
        }
         if (state.player.credits < totalCost) { this.uiManager.queueModal('event-modal', "Insufficient Funds", "Your credit balance is too low."); return false; }

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        const stockBeforeBuy = inventoryItem.quantity; // Get stock *before* purchase
        inventoryItem.quantity -= quantity;

        // --- VIRTUAL WORKBENCH: REFACTOR ---
        // Check for depletion bonus logic
        if (inventoryItem.quantity <= 0) {
            // Delegate depletion check to MarketService
            this.marketService.checkDepletion(good, inventoryItem, stockBeforeBuy, state.day);
        }
        // --- END VIRTUAL WORKBENCH ---

        const playerInvItem = activeInventory[goodId];
        playerInvItem.avgCost = ((playerInvItem.quantity * playerInvItem.avgCost) + totalCost) / (playerInvItem.quantity + quantity);
        playerInvItem.quantity += quantity;

        this.gameState.player.credits -= totalCost;
        this.logger.info.player(state.day, 'BUY', `Bought ${quantity}x ${good.name} for ${formatCredits(totalCost)}`);
        this.simulationService._logConsolidatedTrade(good.name, quantity, -totalCost);
        this.timeService._checkMilestones();
        this.missionService.checkTriggers();

        this.marketService.applyMarketImpact(goodId, quantity, 'buy');

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

        const { totalPrice } = this.uiManager._calculateSaleDetails(goodId, quantity);
        let totalSaleValue = totalPrice;

        const profit = totalSaleValue - (item.avgCost * quantity);
        if (profit > 0) {
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + (state.player.birthdayProfitBonus || 0);
            totalSaleValue += profit * totalBonus;
        }

        totalSaleValue = Math.floor(totalSaleValue);
        this.gameState.player.credits += totalSaleValue;
        item.quantity -= quantity;
        if (item.quantity === 0) item.avgCost = 0;

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        inventoryItem.quantity += quantity;

        this.logger.info.player(state.day, 'SELL', `Sold ${quantity}x ${good.name} for ${formatCredits(totalSaleValue)}`);
        this.simulationService._logConsolidatedTrade(good.name, quantity, totalSaleValue);

        this.timeService._checkMilestones();
        this.missionService.checkTriggers();

        this.marketService.applyMarketImpact(goodId, quantity, 'sell');

        this.gameState.setState({});

        return totalSaleValue;
    }

    /**
     * Validates if a ship purchase is possible.
     * @param {string} shipId - The ID of the ship to buy.
     * @returns {object} { success: boolean, errorTitle?: string, errorMessage?: string }
     * @JSDoc
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
        if (this.gameState.player.credits < ship.price) {
            return { success: false, errorTitle: "Insufficient Funds", errorMessage: "You cannot afford this ship." };
        }
        return { success: true };
    }

    /**
     * Executes the purchase of a new ship (Assumes validation passed).
     * This replaces the logic in the original buyShip .
     * @param {string} shipId - The ID of the ship to buy.
     * @param {Event} [event] - The click event for placing floating text.
     * @returns {object|null} - The purchased ship object.
     * @JSDoc
     */
    executeBuyShip(shipId, event) {
        this.isTransactionInProgress = true;

        try {
            const ship = DB.SHIPS[shipId];
            if (!ship) {
                // This check is redundant if validateBuyShip was called, but good practice.
                this.logger.error('PlayerActionService', `executeBuyShip called with invalid shipId: ${shipId}`);
                return null;
            }
            
            this.gameState.player.credits -= ship.price;
            this.logger.info.player(this.gameState.day, 'SHIP_PURCHASE', `Purchased ${ship.name} for ${formatCredits(ship.price)}.`);
            if (event) {
                this.uiManager.createFloatingText(`-${formatCredits(ship.price, false)}`, event.clientX, event.clientY, '#f87171');
            }
            this.simulationService._logTransaction('ship', -ship.price, `Purchased ${ship.name}`);
            this.simulationService.addShipToHangar(shipId);

            // Determine the new active index for the shipyard carousel *after* the purchase.
            const shipyardInventory = this.simulationService._getShipyardInventory();
            const currentShipyardIndex = this.gameState.uiState.shipyardActiveIndex || 0;
            const newShipyardIndex = Math.min(currentShipyardIndex, Math.max(0, shipyardInventory.length - 1));

            if (this.gameState.tutorials.activeBatchId === 'intro_hangar') {
                this.simulationService.setHangarShipyardMode('hangar');
                this.simulationService.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.BUY_SHIP });
            }

            // --- VIRTUAL WORKBENCH: REMOVED FONT-ROBOTO-MONO ---
            const purchaseDescription = `You purchased the ${ship.name} for <span class="text-glow-red">-${formatCredits(ship.price, false)}</span>.`;
            this.uiManager.queueModal('event-modal', "Vessel Purchased", purchaseDescription);
            // --- END VIRTUAL WORKBENCH ---

            this.gameState.setState({
                uiState: {
                     ...this.gameState.uiState,
                    shipyardActiveIndex: newShipyardIndex, // Set the corrected index
                    lastTransactionTimestamp: Date.now()
                }
            });
            return ship;
        } finally {
            setTimeout(() => { this.isTransactionInProgress = false; }, 100); // Reset guard
        }
    }

    /**
     * Validates if a ship sale is possible.
     * @param {string} shipId - The ID of the ship to sell.
     * @returns {object} { success: boolean, errorTitle?: string, errorMessage?: string }
     * @JSDoc
     */
    validateSellShip(shipId) {
        if (this.isTransactionInProgress) {
            return { success: false, errorTitle: "Transaction in Progress", errorMessage: "Please wait for the current transaction to complete." };
        }
        const state = this.gameState.getState(); // Get fresh state for validation
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
     * This replaces the logic in the original sellShip .
     * @param {string} shipId - The ID of the ship to sell.
     * @param {Event} [event] - The click event for placing floating text.
     * @returns {number|false} - The sale price.
     * @JSDoc
     */
    executeSellShip(shipId, event) {
        this.isTransactionInProgress = true;

        try {
            const ship = DB.SHIPS[shipId];
            if (!ship) {
                // This check is redundant if validateSellShip was called, but good practice.
                this.logger.error('PlayerActionService', `executeSellShip called with invalid shipId: ${shipId}`);
                return false;
            }
          
            const salePrice = Math.floor(ship.price * GAME_RULES.SHIP_SELL_MODIFIER);
            this.gameState.player.credits += salePrice;
            this.logger.info.player(this.gameState.day, 'SHIP_SALE', `Sold ${ship.name} for ${formatCredits(salePrice)}.`);
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

            // --- VIRTUAL WORKBENCH: REMOVED FONT-ROBOTO-MONO ---
            const saleDescription = `You sold the ${ship.name} for <span class="credits-text-pulsing">+${formatCredits(salePrice, false)}</span>.`;
            this.uiManager.queueModal('event-modal', "Vessel Sold", saleDescription);
            // --- END VIRTUAL WORKBENCH ---

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
     * Sets the player's currently active ship.
     * @param {string} shipId - The ID of the ship to make active.
     */
    setActiveShip(shipId) {
        // --- VIRTUAL WORKBENCH: LOGIC MOVED FROM SimulationService (Phase 2) ---
        if (!this.gameState.player.ownedShipIds.includes(shipId)) return;
        this.gameState.player.activeShipId = shipId;

        const newIndex = this.gameState.player.ownedShipIds.indexOf(shipId);
        if (newIndex !== -1) {
            this.gameState.uiState.hangarActiveIndex = newIndex;
        }

        this.logger.info.player(this.gameState.day, 'SET_ACTIVE_SHIP', `Boarded the ${DB.SHIPS[shipId].name}.`);

        if (this.gameState.introSequenceActive) {
            this.simulationService.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELECT_SHIP });
        }

        this.gameState.setState({});
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Pays off the player's entire outstanding debt.
     * @param {Event} [event] - The click event for placing floating text.
     */
    payOffDebt(event) {
        if (this.gameState.isGameOver) return;
        const { player } = this.gameState;
        if (player.credits < player.debt) {
            this.uiManager.queueModal('event-modal', "Insufficient Funds", "You can't afford to pay off your entire debt.");
            return;
        }

        const debtAmount = player.debt;
        player.credits -= debtAmount;

        // --- VIRTUAL WORKBENCH: ADDED FLOATING TEXT (Point C) ---
        if (event) {
            this.uiManager.createFloatingText(`-${formatCredits(debtAmount, false)}`, event.clientX, event.clientY, '#f87171'); // Red
        }
        // --- END VIRTUAL WORKBENCH ---

        this.logger.info.player(this.gameState.day, 'DEBT_PAID', `Paid off ${formatCredits(debtAmount)} in debt.`);
        this.simulationService._logTransaction('loan', -debtAmount, `Paid off ${formatCredits(debtAmount)} debt`);
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
        const { player, day } = this.gameState;
        if (player.debt > 0) {
            this.uiManager.queueModal('event-modal', "Loan Unavailable", `You must pay off your existing debt first.`);
            return;
        }
        if (player.credits < loanData.fee) {
            this.uiManager.queueModal('event-modal', "Unable to Secure Loan", `The financing fee is ${formatCredits(loanData.fee)}, but you only have ${formatCredits(player.credits)}.`);
            return;
        }

        player.credits -= loanData.fee;
        this.simulationService._logTransaction('loan', -loanData.fee, `Financing fee for ${formatCredits(loanData.amount)} loan`);
        
        player.credits += loanData.amount;

        // --- VIRTUAL WORKBENCH: ADDED FLOATING TEXT (Point C) ---
        if (event) {
            this.uiManager.createFloatingText(`+${formatCredits(loanData.amount, false)}`, event.clientX, event.clientY, '#34d399'); // Green
        }
        // --- END VIRTUAL WORKBENCH ---

        this.simulationService._logTransaction('loan', loanData.amount, `Acquired ${formatCredits(loanData.amount)} loan`);

        player.debt += loanData.amount;
        player.monthlyInterestAmount = loanData.interest;
        player.loanStartDate = day;
        player.seenGarnishmentWarning = false;

        // --- VIRTUAL WORKBENCH: REMOVED FONT-ROBOTO-MONO ---
        // Added glowing classes and removed font-roboto-mono for consistency
        const loanDesc = `You've acquired a loan of <span class="credits-text-pulsing">${formatCredits(loanData.amount)}</span>.<br>A financing fee of <span class="text-glow-red">${formatCredits(loanData.fee)}</span> was deducted.`;
        // --- END VIRTUAL WORKBENCH ---
        
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
        if (player.credits < license.cost) return { success: false, error: 'INSUFFICIENT_FUNDS' };

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

        const otherMarkets = DB.MARKETS.filter(m => m.id !== currentLocationId && player.unlockedLocationIds.includes(m.id));
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
        if (!ship || ship.fuel >= ship.maxFuel) return 0; // Check if ship exists

        let costPerTick = DB.MARKETS.find(m => m.id === state.currentLocationId).fuelPrice / 2;
        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            costPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        costPerTick = Math.max(1, Math.round(costPerTick)); // Ensure cost is at least 1

        if (state.player.credits < costPerTick) return 0;

        state.player.credits -= costPerTick;
        state.player.shipStates[ship.id].fuel = Math.min(ship.maxFuel, state.player.shipStates[ship.id].fuel + 5);
        this.simulationService._logConsolidatedTransaction('fuel', -costPerTick, 'Fuel Purchase');

        // --- ADDED: Floating Text ---
        const refuelBtn = document.getElementById('refuel-btn');
        if (refuelBtn) {
            const rect = refuelBtn.getBoundingClientRect();
            // Calculate center X, top Y for the text origin
            const x = rect.left + rect.width / 2;
            const y = rect.top;
            this.uiManager.createFloatingText(`-${formatCredits(costPerTick, false)}`, x, y, '#f87171'); // Red color for cost
        }
        // --- END ADDED ---

        this.gameState.setState({}); // Notify state change *after* potentially adding text
        return costPerTick;
    }

    /**
     * Processes one "tick" of repairing while the button is held, costing credits and restoring health.
     * @returns {number} - The cost of the repair tick, or 0 if no repairs were made.
     */
    repairTick() {
        const state = this.gameState;
        const ship = this.simulationService._getActiveShip();
        if (!ship || ship.health >= ship.maxHealth) return 0; // Check if ship exists

        const repairAmount = ship.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100);
        let costPerTick = repairAmount * GAME_RULES.REPAIR_COST_PER_HP;

        if (state.player.activePerks[PERK_IDS.VENETIAN__SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            costPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }
         costPerTick = Math.max(1, Math.round(costPerTick)); // Ensure cost is at least 1

        if (state.player.credits < costPerTick) return 0;

        state.player.credits -= costPerTick;
        state.player.shipStates[ship.id].health = Math.min(ship.maxHealth, state.player.shipStates[ship.id].health + repairAmount);
        this.simulationService._logConsolidatedTransaction('repair', -costPerTick, 'Hull Repairs');
        this.simulationService._checkHullWarnings(ship.id);

        // --- ADDED: Floating Text ---
        const repairBtn = document.getElementById('repair-btn');
        if (repairBtn) {
             const rect = repairBtn.getBoundingClientRect();
             // Calculate center X, top Y for the text origin
            const x = rect.left + rect.width / 2;
            const y = rect.top;
            this.uiManager.createFloatingText(`-${formatCredits(costPerTick, false)}`, x, y, '#f87171'); // Red color for cost
        }
         // --- END ADDED ---

        this.gameState.setState({}); // Notify state change *after* potentially adding text
        return costPerTick;
    }
}