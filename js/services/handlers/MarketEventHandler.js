// js/services/handlers/MarketEventHandler.js
/**
 * @fileoverview Handles user interactions specifically within the market screen,
 * such as toggling buy/sell modes, adjusting quantities, and confirming trades.
 */
import { DB } from '../../data/database.js';
import { ACTION_IDS } from '../../data/constants.js';
import { updateMarketCardDisplay } from '../../ui/components/MarketScreen.js'; // Import the function
import { calculateInventoryUsed } from '../../utils.js'; // Import utility

/**
 * @class MarketEventHandler
 * @description Manages event handling for the market screen UI components.
 */
export class MarketEventHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(gameState, simulationService, uiManager) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
    }

    /**
     * Handles delegated click events originating from the market screen.
     * @param {Event} e - The click event.
     * @param {HTMLElement} actionTarget - The element with the data-action attribute.
     */
    handleClick(e, actionTarget) {
        const action = actionTarget.dataset.action;
        const goodId = actionTarget.dataset.goodId;

        if (!goodId && ![ACTION_IDS.TOGGLE_MARKET_CARD_VIEW].includes(action)) return; // Only allow card toggle without goodId

        // Check if the action belongs to the market controls
        switch (action) {
            case ACTION_IDS.TOGGLE_TRADE_MODE:
                this._toggleTradeMode(goodId);
                break;
            case ACTION_IDS.DECREMENT:
                this._decrement(goodId);
                break;
            case ACTION_IDS.INCREMENT:
                this._increment(goodId);
                break;
            case ACTION_IDS.CONFIRM_TRADE:
                this._confirmTrade(goodId, e);
                break;
            case ACTION_IDS.SET_MAX_TRADE:
                this._setMaxTrade(goodId);
                break;
            case ACTION_IDS.SHOW_PRICE_GRAPH:
                 this.uiManager.showGraph(actionTarget, this.gameState.getState());
                break;
            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW: {
                 const cardGoodId = actionTarget.dataset.goodId; // Get goodId specifically for this action
                 if (cardGoodId) {
                    this._toggleCardView(cardGoodId, actionTarget);
                 }
                break;
            }
        }
    }

    /**
     * Handles input events, specifically for quantity changes in market cards.
     * @param {Event} e - The input event.
     */
    handleInput(e) {
        const target = e.target;
        if (target.tagName === 'INPUT' && target.id.startsWith('qty-')) {
            const goodId = target.id.split('-')[1];
            const controls = target.closest('.transaction-controls');
            if (controls) {
                const mode = controls.dataset.mode;
                const value = parseInt(target.value, 10) || 0;
                 // Call imported function directly with correct arguments
                 updateMarketCardDisplay(this.uiManager.marketService, this.gameState.getState(), goodId, value, mode);
            }
        }
    }

    /**
     * Toggles the buy/sell mode for a specific commodity card.
     * @param {string} goodId - The ID of the commodity.
     * @private
     */
    _toggleTradeMode(goodId) {
        const controls = document.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
        if (!controls || controls.hasAttribute('disabled')) return;

        const currentMode = controls.dataset.mode;
        const newMode = currentMode === 'buy' ? 'sell' : 'buy';
        controls.dataset.mode = newMode;

        const qtyInput = controls.querySelector(`#qty-${goodId}`);
        // Reset quantity when toggling mode
        qtyInput.value = 0;

        // Call imported function directly with correct arguments
        updateMarketCardDisplay(this.uiManager.marketService, this.gameState.getState(), goodId, 0, newMode);
    }


    /**
     * Decrements the quantity for a specific commodity card.
     * @param {string} goodId - The ID of the commodity.
     * @private
     */
    _decrement(goodId) {
        const controls = document.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
         if (!controls || controls.hasAttribute('disabled')) return;
        const qtyInput = controls.querySelector(`#qty-${goodId}`);
        const mode = controls.dataset.mode;
        let currentQty = parseInt(qtyInput.value, 10) || 0;
        let newQty = Math.max(0, currentQty - 1);
        qtyInput.value = newQty;
         // Call imported function directly with correct arguments
         updateMarketCardDisplay(this.uiManager.marketService, this.gameState.getState(), goodId, newQty, mode);
    }

    /**
     * Increments the quantity for a specific commodity card.
     * @param {string} goodId - The ID of the commodity.
     * @private
     */
    _increment(goodId) {
        const controls = document.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
         if (!controls || controls.hasAttribute('disabled')) return;
        const qtyInput = controls.querySelector(`#qty-${goodId}`);
        const mode = controls.dataset.mode;
        let currentQty = parseInt(qtyInput.value, 10) || 0;
        let newQty = currentQty + 1; // Max quantity check happens later or implicitly by input max attr if set
        qtyInput.value = newQty;
         // Call imported function directly with correct arguments
         updateMarketCardDisplay(this.uiManager.marketService, this.gameState.getState(), goodId, newQty, mode);
    }

    /**
     * Confirms and executes a buy or sell transaction.
     * @param {string} goodId - The ID of the commodity.
     * @param {Event} e - The original click event.
     * @private
     */
    _confirmTrade(goodId, e) {
        const controls = document.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
        if (!controls || controls.hasAttribute('disabled')) return;

        const qtyInput = controls.querySelector(`#qty-${goodId}`);
        const quantity = parseInt(qtyInput.value, 10);
        const mode = controls.dataset.mode;

        if (!quantity || quantity <= 0) return;

        let success = false;
        if (mode === 'buy') {
            success = this.simulationService.buyItem(goodId, quantity); // Correct call
        } else { // sell
            success = this.simulationService.sellItem(goodId, quantity); // Correct call
        }

        if (success) {
             const stateBeforeUpdate = this.gameState.getState(); // Get state *before* resetting qty
            qtyInput.value = 0;
            // Call imported function directly with correct arguments
            updateMarketCardDisplay(this.uiManager.marketService, stateBeforeUpdate, goodId, 0, mode);

            // Trigger floating text effect near the button
            const rect = e.target.getBoundingClientRect();
             // Fetch prices using marketService
             const price = this.uiManager.marketService.getItemPrice(stateBeforeUpdate, goodId, mode === 'sell');
             let totalValue;
             if (mode === 'sell') {
                 // Use the state *before* the update for accurate calculation
                 const { totalPrice } = this.uiManager.marketService._calculateSaleDetails(goodId, quantity);
                 totalValue = totalPrice;
             } else {
                 totalValue = price * quantity;
             }

             const text = mode === 'buy' ? `- ${totalValue} ⌬` : `+ ${totalValue} ⌬`;
             const color = mode === 'buy' ? '#f87171' : '#34d399'; // red for buy, green for sell
            this.uiManager.createFloatingText(text, rect.left + rect.width / 2, rect.top, color);

            // Update UI State to trigger Hangar re-render if needed (e.g., cargo changed)
            this.gameState.uiState.lastTransactionTimestamp = Date.now();
            this.gameState.setState({}); // Notify subscribers of potential state change
        }
    }

    /**
     * Sets the quantity to the maximum possible for buy or sell.
     * @param {string} goodId - The ID of the commodity.
     * @private
     */
    _setMaxTrade(goodId) {
        const controls = document.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
        if (!controls || controls.hasAttribute('disabled')) return;
        const qtyInput = controls.querySelector(`#qty-${goodId}`);
        const mode = controls.dataset.mode;
        const state = this.gameState.getState(); // Use getState for a snapshot
        const playerInv = state.player.inventories[state.player.activeShipId];
        const ship = DB.SHIPS[state.player.activeShipId];
        const good = DB.COMMODITIES.find(c => c.id === goodId);

        let maxQty = 0;
        if (mode === 'buy') {
            const price = this.uiManager.marketService.getItemPrice(state, goodId); // Use marketService method
            const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;
            const affordableQty = price > 0 ? Math.floor(state.player.credits / price) : Infinity;
            const spaceAvailable = ship.cargoCapacity - calculateInventoryUsed(playerInv);
            const canHoldQty = good.size > 0 ? Math.floor(spaceAvailable / good.size) : Infinity;

            maxQty = Math.min(marketStock, affordableQty, canHoldQty);

        } else { // sell
            maxQty = playerInv[goodId]?.quantity || 0;
        }

        maxQty = Math.max(0, maxQty); // Ensure not negative
        qtyInput.value = maxQty;
        // Call imported function directly with correct arguments
        updateMarketCardDisplay(this.uiManager.marketService, state, goodId, maxQty, mode);
    }

    /**
     * Toggles the minimized/maximized view of a market card.
     * @param {string} goodId - The ID of the commodity card.
     * @param {HTMLElement} buttonEl - The button element that was clicked.
     * @private
     */
    _toggleCardView(goodId, buttonEl) {
        const container = buttonEl.closest('.item-card-container');
        if (container) {
             const isMinimized = container.classList.toggle('minimized');
             buttonEl.textContent = isMinimized ? '+' : '−';
             this.gameState.uiState.marketCardMinimized[goodId] = isMinimized;
             // No need to call setState here, as this is purely a visual toggle handled by CSS
        }
    }
}