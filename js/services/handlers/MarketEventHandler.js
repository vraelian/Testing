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

        // --- UI JUICE: Min/Max View Toggle Shake (Directional Momentum) ---
        // Bound globally to intercept the state change routed by the main EventManager.
        document.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.card-toggle-btn');
            if (toggleBtn) {
                const goodId = toggleBtn.dataset.goodId;
                if (goodId) {
                    // 15ms allows the UIManager DOM wipe to finish while appearing instant.
                    // The spring animation will run concurrently with the CSS height transition.
                    setTimeout(() => {
                        const cardContainer = document.getElementById(`item-card-container-${goodId}`);
                        if (cardContainer) {
                            // Check the newly rendered state to determine the direction of momentum
                            const isMinimized = cardContainer.classList.contains('minimized');
                            const bounceClass = isMinimized ? 'card-spring-bounce-up' : 'card-spring-bounce-down';
                            this._triggerAnimation(cardContainer, bounceClass, 750);
                        }
                    }, 15); 
                }
            }
        });
    }

    /**
     * Utility to trigger reflow-safe CSS animations for tactile UI feedback.
     * @param {HTMLElement} element The target DOM element.
     * @param {string} className The CSS animation class to apply.
     * @param {number} duration The duration of the animation in milliseconds.
     * @private
     */
    _triggerAnimation(element, className, duration) {
        if (!element) return;
        
        element.classList.remove(className);
        void element.offsetWidth; // Force DOM reflow
        element.classList.add(className);
        
        setTimeout(() => {
            if (element) element.classList.remove(className);
        }, duration);
    }

    /**
     * Applies a prolonged scale state to an input, refreshing the timeout if spammed.
     * @param {HTMLElement} inputEl The input element to scale.
     * @private
     */
    _triggerProlongedPop(inputEl) {
        if (!inputEl) return;
        inputEl.classList.add('is-popped');
        
        if (inputEl.dataset.popTimeout) {
            clearTimeout(parseInt(inputEl.dataset.popTimeout));
        }
        
        inputEl.dataset.popTimeout = setTimeout(() => {
            inputEl.classList.remove('is-popped');
        }, 225); // 50% slower return to normal size
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

            this._updateMaxButtonState(controls, quantity, mode, goodId);

            // --- UI JUICE: Prolonged Stepper Rattle on Input ---
            this._triggerProlongedPop(qtyInput);
        }
    }

    /**
     * Handles click events within the market transaction controls.
     * Now async to support mechanical animation delays prior to state mutation.
     * @param {Event} e The click event object.
     * @param {HTMLElement} actionTarget The DOM element with the data-action attribute.
     */
    async handleClick(e, actionTarget) {
        const { action } = actionTarget.dataset;

        switch (action) {
            case 'toggle-trade-mode':
            case 'confirm-trade':
            case 'set-max-trade':
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT:
                await this._performMarketAction(actionTarget, action, e);
                break;
        }
    }

    /**
     * Refactored helper to execute post-trade visual and state updates cleanly,
     * allowing for deferred execution after intercept modals.
     * @private
     */
    _processTradeResult(result, mode, goodId, quantity, state, e, cardContainer, animClass) {
        if (result !== false && result !== undefined) {
            let delta = result;
            if (mode === 'sell' && typeof result !== 'number') {
                delta = this.uiManager.getItemPrice(state, goodId) * quantity;
            }
            const value = (mode === 'buy') ? this.uiManager.getItemPrice(state, goodId) * quantity : delta;
            
            const text = mode === 'buy' ? `-${formatCredits(value, false)}` : `+${formatCredits(value, false)}`;
            const color = mode === 'buy' ? '#f87171' : '#34d399';
            this.uiManager.createFloatingText(text, e.clientX, e.clientY, color);

            if (mode === 'sell') {
                const actionData = { type: 'ACTION', action: 'sell-item', goodId };
                this.simulationService.tutorialService?.checkState?.(actionData);
            }

            // --- UI JUICE: Massive Inventory Popping (Delayed for UI Render) ---
            setTimeout(() => {
                const availNode = document.getElementById(`m-stock-${goodId}`);
                const ownNode = document.getElementById(`p-inv-${goodId}`);
                
                if (mode === 'buy' && ownNode) {
                    this._triggerAnimation(ownNode, 'inventory-pop', 1300);
                } else if (mode === 'sell' && availNode) {
                    this._triggerAnimation(availNode, 'inventory-pop', 1300);
                }
            }, 50);

        } else {
            // Instantly clean up the downstroke if an error/warning modal is thrown
            if (cardContainer) cardContainer.classList.remove(animClass);
        }

        // Final safety net cleanup in case the element gets orphaned
        setTimeout(() => {
            if (cardContainer && cardContainer.parentNode) {
                cardContainer.classList.remove(animClass);
            }
        }, 100);
    }

    /**
     * Executes a specific market action based on the clicked element.
     * @param {HTMLElement} target - The element that was clicked.
     * @param {string} action - The specific action to perform.
     * @param {Event} [e] - The original click event, for effects.
     * @private
     */
    async _performMarketAction(target, action, e) {
        // Fix for sticky hover/focus states on mobile Safari/WebKit
        if (target && typeof target.blur === 'function') {
            target.blur();
        }

        const controls = target.closest('.transaction-controls');
        if (!controls) return;

        const { goodId, mode } = controls.dataset;
        const qtyInput = controls.querySelector('input');
        const state = this.gameState.getState();
        const cardContainer = target.closest('.item-card-container');

        switch (action) {
            case 'toggle-trade-mode': {
                const newMode = mode === 'buy' ? 'sell' : 'buy';
                controls.dataset.mode = newMode;
                const currentQty = parseInt(qtyInput.value) || 0;
                this.uiManager.updateMarketCardDisplay(goodId, currentQty, newMode);

                this._updateMaxButtonState(controls, currentQty, newMode, goodId);

                // --- UI JUICE: Toggle Aura & Scan-line ---
                const toggleSwitch = target.closest('.toggle-switch');
                this._triggerAnimation(toggleSwitch, 'toggle-radiate', 400);

                const innerCard = cardContainer.querySelector('.rounded-lg');
                if (innerCard) {
                    // Reset if spammed
                    const existingScanline = innerCard.querySelector('.scanline-overlay');
                    if (existingScanline) existingScanline.remove();

                    const scanline = document.createElement('div');
                    scanline.className = `scanline-overlay scanline-${newMode}`;
                    innerCard.appendChild(scanline);

                    setTimeout(() => {
                        if (scanline.parentNode) scanline.remove();
                    }, 400);
                }
                break;
            }
            case 'confirm-trade': {
                const quantity = parseInt(qtyInput.value) || 0;
                if (quantity <= 0) return;

                const animClass = 'confirm-lever';
                let cardRect = null;
                let cardRadius = '21px'; // Fallback to CSS var default
                let glowColor = '#00d2ff'; // Fallback cyan

                if (cardContainer) {
                    // Capture dimensions before any DOM wipe
                    cardRect = cardContainer.getBoundingClientRect();
                    const innerCard = cardContainer.querySelector('.rounded-lg');
                    
                    if (innerCard) {
                        const computedStyle = window.getComputedStyle(innerCard);
                        cardRadius = computedStyle.borderTopLeftRadius || '21px';
                        
                        // Extract specific commodity gradient color for matching glow
                        const gradColor = computedStyle.getPropertyValue('--market-card-gradient-color1').trim();
                        if (gradColor) glowColor = gradColor;
                    }

                    // Apply specific color overrides based on commodity ID/name
                    const normalizedId = goodId.toLowerCase().replace(/-/g, '_');
                    if (normalizedId.includes('hydroponics')) glowColor = '#065f46'; // darker green
                    else if (normalizedId.includes('cryo')) glowColor = '#0891b2'; // bluer turquoise
                    else if (normalizedId.includes('sentient') || normalizedId.includes('ai')) glowColor = '#800000'; // maroon
                    else if (normalizedId.includes('antimatter')) glowColor = '#4c1d95'; // dark purple
                    else if (normalizedId.includes('folded')) glowColor = '#ea580c'; // orange
                    
                    // Force reflow for downstroke animation
                    cardContainer.classList.remove(animClass);
                    void cardContainer.offsetWidth;
                    cardContainer.classList.add(animClass);

                    // --- UI JUICE: Dynamic Commodity-Colored Radiation Spawn ---
                    const glow = document.createElement('div');
                    glow.className = 'confirm-cyan-glow-overlay';
                    // Shrink by 4px and shift inward to hide the inner edge behind the card
                    glow.style.left = `${cardRect.left + 2}px`;
                    glow.style.top = `${cardRect.top + 2}px`;
                    glow.style.width = `${cardRect.width - 4}px`;
                    glow.style.height = `${cardRect.height - 4}px`;
                    glow.style.borderRadius = cardRadius;
                    glow.style.setProperty('--dynamic-glow-color', glowColor);
                    
                    document.body.appendChild(glow);
                    
                    setTimeout(() => {
                        if (glow.parentNode) glow.parentNode.removeChild(glow);
                    }, 1300);
                    
                    // 15ms minimum frame delay ensures extreme responsiveness while allowing CSS to paint
                    await new Promise(resolve => setTimeout(resolve, 15));
                }

                // --- THIRD-PARTY CARGO INFRACTION CHECK FOR SELLS ---
                if (mode === 'sell') {
                    let fleetOwnedQty = 0;
                    state.player.ownedShipIds.forEach(shipId => {
                        fleetOwnedQty += state.player.inventories[shipId]?.[goodId]?.quantity || 0;
                    });
                    
                    const projectedInventory = fleetOwnedQty - quantity;
                    
                    if (this.simulationService.missionService) {
                        const protection = this.simulationService.missionService.getProtectedBaseline(goodId);
                        
                        if (projectedInventory < protection.baseline) {
                            // Clean up downstroke safely before showing modal
                            if (cardContainer) cardContainer.classList.remove(animClass);
                            
                            this.uiManager.queueModal('event-modal', 'Warning: Third-Party Cargo', 
                                'You are attempting to sell third-party cargo. The associated mission(s) will be abandoned and the value of the cargo will be added to your debt if you proceed!', 
                                null, 
                                {
                                    dismissInside: false,
                                    dismissOutside: false,
                                    customSetup: (modal, closeHandler) => {
                                        const btnContainer = modal.querySelector('#event-button-container');
                                        btnContainer.innerHTML = `
                                            <button id="proceed-infraction" class="btn" style="border: 1px solid #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.1);">PROCEED</button>
                                            <button id="cancel-infraction" class="btn">CANCEL</button>
                                        `;
                                        modal.querySelector('#proceed-infraction').onclick = () => {
                                            // 1. Penalize missions
                                            protection.missions.forEach(mId => this.simulationService.missionService.penalizeThirdPartyInfraction(mId));
                                            
                                            // 2. Execute sale
                                            const result = this.simulationService.sellItem(goodId, quantity);
                                            this._processTradeResult(result, mode, goodId, quantity, state, e, cardContainer, animClass);
                                            
                                            // 3. Render changes globally
                                            this.uiManager.render(this.gameState.getState());
                                            closeHandler();
                                        };
                                        modal.querySelector('#cancel-infraction').onclick = closeHandler;
                                    }
                                });
                            return; // Halt immediate execution pending user selection
                        }
                    }
                }

                // Normal execution
                const result = (mode === 'buy')
                    ? this.simulationService.buyItem(goodId, quantity)
                    : this.simulationService.sellItem(goodId, quantity);

                this._processTradeResult(result, mode, goodId, quantity, state, e, cardContainer, animClass);
                break;
            }
            case 'set-max-trade': {
                if (mode === 'sell') {
                    let fleetOwnedQty = 0;
                    state.player.ownedShipIds.forEach(shipId => {
                        fleetOwnedQty += state.player.inventories[shipId]?.[goodId]?.quantity || 0;
                    });
                    qtyInput.value = fleetOwnedQty;
                } else { 
                    let fleetAvailableSpace = 0;
                    state.player.ownedShipIds.forEach(shipId => {
                        const stats = this.simulationService.getEffectiveShipStats(shipId);
                        const used = calculateInventoryUsed(state.player.inventories[shipId]);
                        fleetAvailableSpace += Math.max(0, stats.cargoCapacity - used);
                    });
                    
                    const price = this.uiManager.getItemPrice(state, goodId);
                    const canAfford = price > 0 ? Math.floor(state.player.credits / price) : Infinity;
                    const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
                    qtyInput.value = Math.max(0, Math.min(fleetAvailableSpace, canAfford, stock));
                }
                
                const newQuantity = parseInt(qtyInput.value) || 0;
                this.uiManager.updateMarketCardDisplay(goodId, newQuantity, mode);
                this._updateMaxButtonState(controls, newQuantity, mode, goodId);

                // --- UI JUICE: Super Slam Flash (Spammable Transition) ---
                if (cardContainer) {
                    cardContainer.classList.add('is-max-flared');

                    if (cardContainer.dataset.maxFlareTimeout) {
                        clearTimeout(parseInt(cardContainer.dataset.maxFlareTimeout));
                    }

                    // Release the flash slightly after to trigger the CSS opacity transition
                    cardContainer.dataset.maxFlareTimeout = setTimeout(() => {
                        cardContainer.classList.remove('is-max-flared');
                    }, 50); 
                }
                break;
            }
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT: {
                let val = parseInt(qtyInput.value) || 0;
                const newQuantity = (action === ACTION_IDS.INCREMENT) ? val + 1 : Math.max(0, val - 1);
                qtyInput.value = newQuantity;
                this.uiManager.updateMarketCardDisplay(goodId, newQuantity, mode);
                this._updateMaxButtonState(controls, newQuantity, mode, goodId);

                // --- UI JUICE: Prolonged Stepper Rattle & Arrow Glow ---
                this._triggerProlongedPop(qtyInput);
                
                if (target) {
                    target.classList.add('stepper-glow');
                    if (target.dataset.glowTimeout) {
                        clearTimeout(parseInt(target.dataset.glowTimeout));
                    }
                    target.dataset.glowTimeout = setTimeout(() => {
                        target.classList.remove('stepper-glow');
                    }, 300);
                }
                
                break;
            }
        }
    }

    /**
     * Checks if the current quantity equals the max possible quantity
     * and updates the 'MAX' button's .pressed state.
     * @param {HTMLElement} controls - The .transaction-controls element.
     * @param {number} currentQty - The current quantity from the input field.
     * @param {string} mode - The current trade mode ('buy' or 'sell').
     * @param {string} goodId - The ID of the commodity.
     * @private
     */
    _updateMaxButtonState(controls, currentQty, mode, goodId) {
        const state = this.gameState.getState();
        let maxQty = 0;

        if (mode === 'sell') {
            state.player.ownedShipIds.forEach(shipId => {
                maxQty += state.player.inventories[shipId]?.[goodId]?.quantity || 0;
            });
        } else { 
            let fleetAvailableSpace = 0;
            state.player.ownedShipIds.forEach(shipId => {
                const stats = this.simulationService.getEffectiveShipStats(shipId);
                const used = calculateInventoryUsed(state.player.inventories[shipId]);
                fleetAvailableSpace += Math.max(0, stats.cargoCapacity - used);
            });
            
            const price = this.uiManager.getItemPrice(state, goodId);
            const canAfford = price > 0 ? Math.floor(state.player.credits / price) : Infinity;
            const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
            maxQty = Math.max(0, Math.min(fleetAvailableSpace, canAfford, stock));
        }

        const maxBtn = controls.querySelector('.max-btn');
        if (currentQty > 0 && currentQty === maxQty) {
            maxBtn.classList.add('pressed');
        } else {
            maxBtn.classList.remove('pressed');
        }
    }
}