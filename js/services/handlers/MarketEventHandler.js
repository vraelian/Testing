// js/services/handlers/MarketEventHandler.js
/**
 * @fileoverview Handles all user interactions within the market commodity cards,
 * including buy/sell mode toggling, quantity adjustments, and trade confirmations.
 */
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS } from '../../data/constants.js';

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
     * Handles real-time input events from the market quantity field.
     * @param {Event} e The input event.
     */
    handleInput(e) {
        const qtyInput = e.target.closest('.transaction-controls input[type="number"]');
        if (qtyInput) {
            const controls = qtyInput.closest('.transaction-controls');
            const { goodId, mode } = controls.dataset;
            const quantity = parseInt(qtyInput.value, 10) || 0;
            this.uiManager.updateMarketCardDisplay(goodId, quantity, mode);
        }
    }

    /**
     * Handles click events within the market transaction controls.
     * @param {Event} e The click event object.
     * @param {HTMLElement} actionTarget The DOM element with the data-action attribute.
     */
    handleClick(e, actionTarget) {
        const { action } = actionTarget.dataset;

        switch (action) {
            case 'toggle-trade-mode':
            case 'confirm-trade':
            case 'set-max-trade':
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT:
                this._performMarketAction(actionTarget, action, e);
                break;
        }
    }

    /**
     * Executes a specific market action based on the clicked element.
     * @param {HTMLElement} target - The element that was clicked.
     * @param {string} action - The specific action to perform.
     * @param {Event} [e] - The original click event, for effects.
     * @private
     */
    _performMarketAction(target, action, e) {
        const controls = target.closest('.transaction-controls');
        if (!controls) return;

        const { goodId, mode } = controls.dataset;
        const qtyInput = controls.querySelector('input');
        const state = this.gameState.getState();

        switch (action) {
            case 'toggle-trade-mode': {
                const newMode = mode === 'buy' ? 'sell' : 'buy';
                controls.dataset.mode = newMode;
                this.uiManager.updateMarketCardDisplay(goodId, parseInt(qtyInput.value) || 0, newMode);
                break;
            }
            case 'confirm-trade': {
                const quantity = parseInt(qtyInput.value) || 0;
                if (quantity <= 0) return;

                const result = (mode === 'buy')
                    ? this.simulationService.buyItem(goodId, quantity)
                    : this.simulationService.sellItem(goodId, quantity);

                if (result) {
                    const value = (mode === 'buy') ? this.uiManager.getItemPrice(state, goodId) * quantity : result;
                    const text = mode === 'buy' ? `-${formatCredits(value, false)}` : `+${formatCredits(value, false)}`;
                    const color = mode === 'buy' ? '#f87171' : '#34d399';
                    this.uiManager.createFloatingText(text, e.clientX, e.clientY, color);

                    // REMOVED tutorial check
                    // Check for tutorial completion on relevant actions
                    // if (mode === 'sell') {
                    //     const actionData = { type: 'ACTION', action: 'sell-item', goodId };
                    //     this.simulationService.tutorialService.checkState(actionData);
                    // }
                }
                break;
            }
            case 'set-max-trade': {
                const ship = this.simulationService._getActiveShip();
                const inventory = this.simulationService._getActiveInventory();
                if (mode === 'sell') {
                    qtyInput.value = inventory[goodId]?.quantity || 0;
                } else { // 'buy'
                    const price = this.uiManager.getItemPrice(state, goodId);
                    const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
                    const canAfford = price > 0 ? Math.floor(state.player.credits / price) : Infinity;
                    const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
                    qtyInput.value = Math.max(0, Math.min(space, canAfford, stock));
                }
                this.uiManager.updateMarketCardDisplay(goodId, parseInt(qtyInput.value) || 0, mode);
                break;
            }
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT: {
                let val = parseInt(qtyInput.value) || 0;
                qtyInput.value = (action === ACTION_IDS.INCREMENT) ? val + 1 : Math.max(0, val - 1);
                this.uiManager.updateMarketCardDisplay(goodId, parseInt(qtyInput.value) || 0, mode);
                break;
            }
        }
    }
}