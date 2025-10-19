// js/services/handlers/MarketEventHandler.js
/**
 * @fileoverview Handles all user interactions within the market commodity cards,
 * including buy/sell mode toggling, quantity adjustments, and trade confirmations.
 * This handler is forked to support both 'commodity' and 'material' item types.
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
            const { goodId, mode, itemType = 'commodity' } = controls.dataset;

            // Only commodities have the complex effective price display that needs updating.
            // Materials have a simple static display.
            if (itemType === 'commodity') {
                const quantity = parseInt(qtyInput.value, 10) || 0;
                this.uiManager.updateMarketCardDisplay(goodId, quantity, mode);
            }
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

        const { goodId } = controls.dataset;
        const itemType = controls.dataset.itemType || 'commodity'; // Default to commodity for existing cards
        const mode = controls.dataset.mode;
        const qtyInput = controls.querySelector('input');
        const state = this.gameState.getState();

        switch (action) {
            case 'toggle-trade-mode': {
                // This action only exists for commodities.
                if (itemType === 'commodity') {
                    const newMode = mode === 'buy' ? 'sell' : 'buy';
                    controls.dataset.mode = newMode;
                    this.uiManager.updateMarketCardDisplay(goodId, parseInt(qtyInput.value) || 0, newMode);
                }
                break;
            }
            case 'confirm-trade': {
                if (itemType === 'commodity') {
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

                        // Check for tutorial completion on relevant actions
                        if (mode === 'sell') {
                            const actionData = { type: 'ACTION', action: 'sell-item', goodId };
                            this.simulationService.tutorialService.checkState(actionData);
                        }
                    }
                } else if (itemType === 'material') {
                    const quantity = parseFloat(qtyInput.value) || 0;
                    if (quantity <= 0) return;

                    // 'sellMaterial' is expected to be on simulationService from Phase 2
                    const result = this.simulationService.sellMaterial(goodId, quantity);

                    if (result.success) {
                        const text = `+${formatCredits(result.value, false)}`;
                        this.uiManager.createFloatingText(text, e.clientX, e.clientY, '#34d399');
                        qtyInput.value = '0.00'; // Reset input after successful sale
                    }
                }
                break;
            }
            case 'set-max-trade': {
                if (itemType === 'commodity') {
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
                } else if (itemType === 'material') {
                    // Material card is always in 'sell' mode
                    // 'metalScrap' is expected to be on player state from Phase 1
                    qtyInput.value = (state.player.metalScrap || 0).toFixed(2);
                }
                break;
            }
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT: {
                if (itemType === 'commodity') {
                    let val = parseInt(qtyInput.value) || 0;
                    qtyInput.value = (action === ACTION_IDS.INCREMENT) ? val + 1 : Math.max(0, val - 1);
                    this.uiManager.updateMarketCardDisplay(goodId, parseInt(qtyInput.value) || 0, mode);
                } else if (itemType === 'material') {
                    let val = parseFloat(qtyInput.value) || 0;
                    // Materials increment by 1.0 units for simplicity
                    let newVal = (action === ACTION_IDS.INCREMENT) ? val + 1 : Math.max(0, val - 1);
                    
                    // Ensure the value does not exceed player's inventory when incrementing
                    const maxScrap = state.player.metalScrap || 0;
                    if (action === ACTION_IDS.INCREMENT && newVal > maxScrap) {
                         newVal = maxScrap;
                    }
                    
                    qtyInput.value = newVal.toFixed(2);
                }
                break;
            }
        }
    }
}