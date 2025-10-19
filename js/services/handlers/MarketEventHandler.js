// js/services/handlers/MarketEventHandler.js
/**
 * @fileoverview Handles all user interactions within the market commodity and material cards,
 * including buy/sell mode toggling, quantity adjustments, and trade confirmations.
 */
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS,MATERIAL_IDS } from '../../data/constants.js';

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
            // Phase 4b: Check item type. Currently, only commodities support live price updates.
            const { goodId, mode, itemType } = controls.dataset;
            const quantity = parseInt(qtyInput.value, 10) || 0;

            if (itemType === 'commodity') {
                this.uiManager.updateMarketCardDisplay(goodId, quantity, mode);
            }
            // Note: Material cards (like scrap) do not need live price updates
            // as their sell price is fixed and doesn't use the complex profit calculation.
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

        // Phase 4b: Destructure itemType. Default to 'commodity' if not present.
        const { goodId, mode, itemType = 'commodity' } = controls.dataset;
        const qtyInput = controls.querySelector('input');
        const state = this.gameState.getState();

        switch (action) {
            case 'toggle-trade-mode': {
                // This action is only present on commodity cards
                if (itemType === 'commodity') {
                    const newMode = mode === 'buy' ? 'sell' : 'buy';
                    controls.dataset.mode = newMode;
                    this.uiManager.updateMarketCardDisplay(goodId, parseInt(qtyInput.value) || 0, newMode);
                }
                break;
            }
            case 'confirm-trade': {
                const quantity = parseInt(qtyInput.value) || 0;
                if (quantity <= 0) return;

                let result;
                let value;
                let text;
                let color;

                if (mode === 'buy') {
                    // Only commodities can be bought
                    result = this.simulationService.buyItem(goodId, quantity);
                    if (result) {
                        value = this.uiManager.getItemPrice(state, goodId) * quantity;
                        text = `-${formatCredits(value, false)}`;
                        color = '#f87171'; // Red
                    }
                } else { // mode === 'sell'
                    // Phase 4b: Differentiate sell logic
                    if (itemType === 'material') {
                        result = this.simulationService.sellMaterial(goodId, quantity);
                        if (result && result.totalValue > 0) {
                            value = result.totalValue;
                            text = `+${formatCredits(value, false)}`;
                            color = '#34d399'; // Green
                        }
                    } else { // 'commodity'
                        result = this.simulationService.sellItem(goodId, quantity);
                        if (result) {
                            value = result; // sellItem returns the total sale value
                            text = `+${formatCredits(value, false)}`;
                            color = '#34d399'; // Green

                            // Check for tutorial completion on relevant actions
                            const actionData = { type: 'ACTION', action: 'sell-item', goodId };
                            this.simulationService.tutorialService.checkState(actionData);
                        }
                    }
                }

                if (result) {
                    this.uiManager.createFloatingText(text, e.clientX, e.clientY, color);
                }
                break;
            }
            case 'set-max-trade': {
                const ship = this.simulationService._getActiveShip();
                const inventory = this.simulationService._getActiveInventory();
                let newMax = 0;

                if (mode === 'sell') {
                    // Phase 4b: Differentiate MAX logic
                    if (itemType === 'material') {
                        if (goodId === MATERIAL_IDS.METAL_SCRAP) {
                            newMax = state.player.metalScrap;
                        }
                    } else { // 'commodity'
                        newMax = inventory[goodId]?.quantity || 0;
                    }
                } else { // 'buy'
                    // Only commodities can be bought
                    const price = this.uiManager.getItemPrice(state, goodId);
                    const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
                    const canAfford = price > 0 ? Math.floor(state.player.credits / price) : Infinity;
                    const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
                    newMax = Math.max(0, Math.min(space, canAfford, stock));
                }

                qtyInput.value = newMax;
                if (itemType === 'commodity') {
                    this.uiManager.updateMarketCardDisplay(goodId, newMax, mode);
                }
                break;
            }
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT: {
                let val = parseInt(qtyInput.value) || 0;
                let step = 1;
                // Phase 4b: Add large step for materials
                if (itemType === 'material') {
                    step = e.shiftKey ? 100 : e.altKey ? 10 : 1;
                }
                
                if (action === ACTION_IDS.INCREMENT) {
                    val += step;
                } else {
                    val = Math.max(0, val - step);
                }
                
                qtyInput.value = val;
                
                if (itemType === 'commodity') {
                    this.uiManager.updateMarketCardDisplay(goodId, val, mode);
                }
                break;
            }
        }
    }
}