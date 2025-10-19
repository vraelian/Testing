// js/services/handlers/MarketEventHandler.js
/**
 * @fileoverview Handles user interactions specifically within the market commodity cards,
 * such as toggling buy/sell modes, adjusting quantities, and confirming trades.
 */
import { DB } from '../../data/database.js';
import { COMMODITY_IDS } from '../../data/constants.js';
import { formatNumber } from '../../utils.js';

export class MarketEventHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState - The game state instance.
     * @param {import('../SimulationService.js').SimulationService} simulationService - The simulation service facade.
     * @param {import('../UIManager.js').UIManager} uiManager - The UI manager instance.
     */
    constructor(gameState, simulationService, uiManager) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
    }

    /**
     * Handles click events on market card controls.
     * @param {Event} event - The click event object.
     * @param {HTMLElement} target - The element that was clicked.
     */
    handleClick(event, target) {
        const action = target.dataset.action;
        const goodId = target.dataset.goodId;
        // --- [[START]] Modified for Metal Update V1 ---
        const itemType = target.dataset.itemType; // 'commodity' or 'material'
        // --- [[END]] Modified for Metal Update V1 ---
        const controlsContainer = target.closest('.transaction-controls');
        if (!controlsContainer || !goodId) return;

        const qtyInput = controlsContainer.querySelector(`#qty-${goodId}`);
        if (!qtyInput) return; // Ensure input exists

        let currentQty = parseInt(qtyInput.value) || 0;

        switch (action) {
            case 'toggle-trade-mode':
                // --- [[START]] Modified for Metal Update V1 ---
                // Materials don't have a toggle
                if (itemType === 'material') return;
                // --- [[END]] Modified for Metal Update V1 ---
                this.handleToggleMode(controlsContainer);
                break;
            case 'increment':
                currentQty++;
                qtyInput.value = currentQty;
                this.updateEffectivePrice(goodId, itemType, currentQty, controlsContainer.dataset.mode); // [[MODIFIED]] Added itemType
                break;
            case 'decrement':
                currentQty = Math.max(0, currentQty - 1);
                qtyInput.value = currentQty;
                this.updateEffectivePrice(goodId, itemType, currentQty, controlsContainer.dataset.mode); // [[MODIFIED]] Added itemType
                break;
            case 'set-max-trade':
                this.handleSetMaxTrade(goodId, itemType, qtyInput, controlsContainer.dataset.mode); // [[MODIFIED]] Added itemType
                break;
            case 'confirm-trade':
                this.handleConfirmTrade(goodId, itemType, currentQty, controlsContainer.dataset.mode, event); // [[MODIFIED]] Added itemType
                qtyInput.value = 0; // Reset qty after trade
                this.updateEffectivePrice(goodId, itemType, 0, controlsContainer.dataset.mode); // Reset effective price display // [[MODIFIED]] Added itemType
                break;
        }
        
        // --- [[START]] Modified for Metal Update V1 ---
        // Save state only for commodities
        if (itemType === 'commodity') {
             this.uiManager.saveMarketTransactionState(goodId, controlsContainer.dataset.mode, qtyInput.value);
        }
        // --- [[END]] Modified for Metal Update V1 ---
    }
    
    /**
     * Handles direct input into the quantity field.
     * @param {Event} event - The input event object.
     */
    handleInput(event) {
        const target = event.target;
        if (!target.id.startsWith('qty-')) return;

        const goodId = target.id.split('-')[1];
        const controlsContainer = target.closest('.transaction-controls');
        if (!controlsContainer) return;
        
        // --- [[START]] Modified for Metal Update V1 ---
        const itemType = controlsContainer.dataset.itemType;
        // --- [[END]] Modified for Metal Update V1 ---

        let value = parseInt(target.value);
        
        // Sanitize input: Ensure non-negative integer
        if (isNaN(value) || value < 0) {
            value = 0;
            target.value = value;
        }

        const max = this.getMaxQuantity(goodId, itemType, controlsContainer.dataset.mode); // [[MODIFIED]] Added itemType
        if (value > max) {
            value = max;
            target.value = value;
        }
        
        this.updateEffectivePrice(goodId, itemType, value, controlsContainer.dataset.mode); // [[MODIFIED]] Added itemType
        
        // --- [[START]] Modified for Metal Update V1 ---
        // Save state only for commodities
        if (itemType === 'commodity') {
            this.uiManager.saveMarketTransactionState(goodId, controlsContainer.dataset.mode, target.value);
        }
        // --- [[END]] Modified for Metal Update V1 ---
    }

    /**
     * Toggles the buy/sell mode for a commodity card.
     * @param {HTMLElement} controlsContainer - The container for the transaction controls.
     */
    handleToggleMode(controlsContainer) {
        const currentMode = controlsContainer.dataset.mode;
        const newMode = currentMode === 'buy' ? 'sell' : 'buy';
        controlsContainer.dataset.mode = newMode;

        const goodId = controlsContainer.dataset.goodId;
        const qtyInput = controlsContainer.querySelector(`#qty-${goodId}`);
        const avgCostDisplay = document.getElementById(`avg-cost-${goodId}`);
        
        // Reset quantity on mode toggle
        if (qtyInput) qtyInput.value = 0;
        
        // Update effective price display for 0 quantity
        this.updateEffectivePrice(goodId, 'commodity', 0, newMode); // Assume commodity if toggle exists

        // Show/hide avg cost display
        if (avgCostDisplay) {
            if (newMode === 'sell') {
                avgCostDisplay.classList.add('visible');
            } else {
                avgCostDisplay.classList.remove('visible');
            }
        }
        
        // Save state
        this.uiManager.saveMarketTransactionState(goodId, newMode, '0');
    }
    
    /**
     * Sets the quantity input to the maximum possible for the current mode.
     * @param {string} goodId - The ID of the commodity or material.
     * @param {string} itemType - 'commodity' or 'material'.
     * @param {HTMLInputElement} qtyInput - The quantity input element.
     * @param {string} mode - The current trade mode ('buy' or 'sell').
     */
    handleSetMaxTrade(goodId, itemType, qtyInput, mode) { // [[MODIFIED]] Added itemType
        const maxQty = this.getMaxQuantity(goodId, itemType, mode); // [[MODIFIED]] Added itemType
        qtyInput.value = maxQty;
        this.updateEffectivePrice(goodId, itemType, maxQty, mode); // [[MODIFIED]] Added itemType
        
        // --- [[START]] Modified for Metal Update V1 ---
        // Save state only for commodities
        if (itemType === 'commodity') {
            this.uiManager.saveMarketTransactionState(goodId, mode, qtyInput.value);
        }
        // --- [[END]] Modified for Metal Update V1 ---
    }

    /**
     * Confirms the trade (buy or sell) for the specified quantity.
     * @param {string} goodId - The ID of the commodity or material.
     * @param {string} itemType - 'commodity' or 'material'.
     * @param {number} quantity - The quantity to trade.
     * @param {string} mode - The trade mode ('buy' or 'sell').
     * @param {Event} event - The click event.
     */
    handleConfirmTrade(goodId, itemType, quantity, mode, event) { // [[MODIFIED]] Added itemType
        if (quantity <= 0) return;

        // --- [[START]] Modified for Metal Update V1 ---
        if (itemType === 'material') {
            // Materials can only be sold
            if (mode === 'sell') {
                this.simulationService.sellMaterial(goodId, quantity, event);
            }
        } else if (itemType === 'commodity') {
            // Existing commodity logic
            if (mode === 'buy') {
                this.simulationService.buyItem(goodId, quantity);
            } else { // sell
                this.simulationService.sellItem(goodId, quantity, event);
                // Check tutorial progression
                if (this.gameState.tutorials.activeBatchId === 'intro_missions' &&
                    this.gameState.tutorials.activeStepId === 'mission_2_2' &&
                    goodId === COMMODITY_IDS.PLASTEEL) {
                    this.simulationService.tutorialService.checkState({ type: 'ACTION', action: 'sell-item', goodId: COMMODITY_IDS.PLASTEEL });
                }
            }
        }
        // --- [[END]] Modified for Metal Update V1 ---
    }
    
    /**
     * Calculates and updates the displayed effective price including diminishing returns.
     * @param {string} goodId - The ID of the commodity or material.
     * @param {string} itemType - 'commodity' or 'material'.
     * @param {number} quantity - The quantity being considered.
     * @param {string} mode - The current trade mode ('buy' or 'sell').
     */
    updateEffectivePrice(goodId, itemType, quantity, mode) { // [[MODIFIED]] Added itemType
        const effectivePriceDisplay = document.getElementById(`effective-price-display-${goodId}`);
        const priceDisplay = document.getElementById(`price-display-${goodId}`);
        const avgCostDisplay = document.getElementById(`avg-cost-${goodId}`);

        if (!effectivePriceDisplay || !priceDisplay) return;
        if (quantity <= 0) {
            effectivePriceDisplay.textContent = '';
            priceDisplay.classList.remove('profit-text', 'loss-text');
            priceDisplay.classList.add('price-text');
            priceDisplay.textContent = formatCredits(this.uiManager.getItemPrice(this.gameState.getState(), goodId));
            return;
        }
        
        // --- [[START]] Modified for Metal Update V1 ---
        // Materials have a fixed sell price, no diminishing returns or profit/loss display needed yet.
        if (itemType === 'material') {
            const material = DB.COMMODITIES.find(c => c.id === goodId);
            if (!material) return;
            const totalValue = material.basePriceRange[0] * quantity;
            effectivePriceDisplay.textContent = `Total: ${formatCredits(totalValue)}`;
            priceDisplay.classList.remove('profit-text', 'loss-text');
            priceDisplay.classList.add('price-text'); // Ensure it's the standard price color
            priceDisplay.textContent = formatCredits(material.basePriceRange[0]); // Display per-unit price
            return; // Skip commodity-specific logic
        }
        // --- [[END]] Modified for Metal Update V1 ---

        // Commodity-specific logic:
        const { totalPrice, effectivePricePerUnit } = this.uiManager._calculateSaleDetails(goodId, quantity);
        const basePrice = this.uiManager.getItemPrice(this.gameState.getState(), goodId);

        if (mode === 'buy') {
            effectivePriceDisplay.textContent = `Total: ${formatCredits(basePrice * quantity)}`;
            priceDisplay.classList.remove('profit-text', 'loss-text');
            priceDisplay.classList.add('price-text');
            priceDisplay.textContent = formatCredits(basePrice);
        } else { // sell
            effectivePriceDisplay.textContent = `Total: ${formatCredits(totalPrice)} (Eff: ${formatCredits(effectivePricePerUnit)}/unit)`;
            
            // Update price display for profit/loss
            const playerItem = this.gameState.player.inventories[this.gameState.player.activeShipId]?.[goodId];
            if (playerItem && playerItem.quantity > 0) {
                const profitPerUnit = effectivePricePerUnit - playerItem.avgCost;
                priceDisplay.textContent = formatCredits(effectivePricePerUnit); // Show effective price per unit
                
                if (profitPerUnit > 0) {
                    priceDisplay.classList.remove('price-text', 'loss-text');
                    priceDisplay.classList.add('profit-text');
                } else if (profitPerUnit < 0) {
                    priceDisplay.classList.remove('price-text', 'profit-text');
                    priceDisplay.classList.add('loss-text');
                } else {
                    priceDisplay.classList.remove('profit-text', 'loss-text');
                    priceDisplay.classList.add('price-text');
                }
            } else {
                // If no avg cost, just show base sell price styling
                priceDisplay.classList.remove('profit-text', 'loss-text');
                priceDisplay.classList.add('price-text');
                priceDisplay.textContent = formatCredits(effectivePricePerUnit);
            }
        }
    }

    /**
     * Calculates the maximum quantity that can be bought or sold.
     * @param {string} goodId - The ID of the commodity or material.
     * @param {string} itemType - 'commodity' or 'material'.
     * @param {string} mode - The trade mode ('buy' or 'sell').
     * @returns {number} The maximum possible quantity.
     */
    getMaxQuantity(goodId, itemType, mode) { // [[MODIFIED]] Added itemType
        const state = this.gameState.getState();
        const { player, market, currentLocationId } = state;
        const activeShip = this.simulationService._getActiveShip(state);
        const activeInventory = this.simulationService._getActiveInventory(state);
        
        // --- [[START]] Modified for Metal Update V1 ---
        if (itemType === 'material') {
             // Materials can only be sold, max is player's current amount (rounded down for safety with floats)
            return (mode === 'sell') ? Math.floor(player.metalScrap) : 0;
        }
        // --- [[END]] Modified for Metal Update V1 ---

        // Commodity logic:
        const playerItem = activeInventory[goodId];
        const marketStock = market.inventory[currentLocationId]?.[goodId];
        const price = this.uiManager.getItemPrice(state, goodId);
        
        if (mode === 'buy') {
            const spaceAvailable = activeShip.cargoCapacity - calculateInventoryUsed(activeInventory);
            const affordQty = price > 0 ? Math.floor(player.credits / price) : Infinity;
            return Math.min(marketStock.quantity, spaceAvailable, affordQty);
        } else { // sell
            return playerItem ? playerItem.quantity : 0;
        }
    }
}