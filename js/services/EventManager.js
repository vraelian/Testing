// js/services/EventManager.js
/**
 * @fileoverview This file contains the EventManager class, which is responsible for handling all user input
 * for the application. It binds event listeners to the DOM and translates user interactions (clicks, key presses, etc.)
 * into calls to the SimulationService, acting as the primary bridge between the UI and the game's logic.
 */
import { formatCredits } from '../utils.js';
import { DB } from '../data/database.js';
import { calculateInventoryUsed } from '../utils.js';
import { ACTION_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';

/**
 * @class EventManager
 * @description Listens for and processes all user inputs, delegating actions to the appropriate services.
 */
export class EventManager {
    /**
     * @param {import('./GameState.js').GameState} gameState The central game state object.
     * @param {import('./SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('./UIManager.js').UIManager} uiManager The UI rendering service.
     * @param {import('./TutorialService.js').TutorialService} tutorialService The tutorial management service.
     * @param {import('./DebugService.js').DebugService} [debugService=null] The debugging service.
     */
    constructor(gameState, simulationService, uiManager, tutorialService, debugService = null) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
        this.debugService = debugService;
        
        this.refuelInterval = null;
        this.repairInterval = null;
        this.activeTooltipTarget = null;
    }

    /**
     * Binds all necessary global event listeners to the document body.
     * This includes click delegation, tooltip handling, and hold-to-act button logic.
     */
    bindEvents() {
        document.body.addEventListener('click', (e) => this._handleClick(e));
        document.body.addEventListener('dblclick', (e) => e.preventDefault()); // Prevents double-tap zoom on mobile.
        document.body.addEventListener('mouseover', (e) => this._handleMouseOver(e));
        document.body.addEventListener('mouseout', (e) => this._handleMouseOut(e));
        document.addEventListener('keydown', (e) => this._handleKeyDown(e));

        // Event delegation for "hold-to-act" buttons (Refuel and Repair).
        document.body.addEventListener('mousedown', (e) => {
            const refuelBtn = e.target.closest('#refuel-btn');
            if (refuelBtn) this._startRefueling(refuelBtn);

            const repairBtn = e.target.closest('#repair-btn');
            if (repairBtn) this._startRepairing(repairBtn);
        });
        document.body.addEventListener('touchstart', (e) => {
            const refuelBtn = e.target.closest('#refuel-btn');
            if (refuelBtn) { 
                e.preventDefault(); 
                this._startRefueling(refuelBtn); 
            }

            const repairBtn = e.target.closest('#repair-btn');
            if (repairBtn) { 
                e.preventDefault(); 
                this._startRepairing(repairBtn); 
            }
        });
        // Listen for mouse up/leave or touch end events anywhere to stop the intervals.
        ['mouseup', 'mouseleave', 'touchend'].forEach(evt => {
            document.addEventListener(evt, () => {
                this._stopRefueling();
                this._stopRepairing();
            });
        });

        // Re-render on resize to handle responsive layout changes.
        window.addEventListener('resize', () => {
             this.uiManager.render(this.gameState.getState());
        });
        window.addEventListener('scroll', () => {
            if (this.activeTooltipTarget) {
                this.uiManager.hideGraph();
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
            }
        }, { passive: true });
        
        // Make the mission sticky bar clickable to navigate to the missions screen.
        const missionStickyBar = document.getElementById('mission-sticky-bar');
        if (missionStickyBar) {
            missionStickyBar.addEventListener('click', () => {
                this.simulationService.setScreen(NAV_IDS.ADMIN, SCREEN_IDS.MISSIONS);
            });
        }
    }

    /**
     * Central click handler for the entire application, using event delegation.
     * It determines the action based on the `data-action` attribute of the clicked element.
     * @param {Event} e The click event object.
     * @private
     */
    _handleClick(e) {
        const state = this.gameState.getState();

        // Dismiss any active tooltip if clicking inside it.
        if (e.target.closest('#graph-tooltip') || e.target.closest('#generic-tooltip')) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
            return;
        }

        const actionTarget = e.target.closest('[data-action]');

        // Dismiss active tooltip if clicking outside of its trigger element.
        if (this.activeTooltipTarget && actionTarget !== this.activeTooltipTarget) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
        }

        // --- Priority Action Handling (data-action attributes) ---
        if (actionTarget) {
            if (actionTarget.hasAttribute('disabled')) return;
            const { action, goodId, locationId, shipId, loanDetails, cost, navId, screenId, context, missionId } = actionTarget.dataset;
            let actionData = null; // To be passed to the TutorialService if an action occurs.
            
            switch(action) {
                // Mission Actions
                case 'show-mission-modal':
                    this.uiManager.showMissionModal(missionId);
                    actionData = { type: 'ACTION', action: 'show-mission-modal' };
                    break;
                case 'accept-mission':
                    this.simulationService.missionService.acceptMission(missionId);
                    this.uiManager.hideModal('mission-modal');
                    actionData = { type: 'ACTION', action: 'accept-mission', missionId: missionId };
                    break;
                case 'abandon-mission':
                    this.simulationService.missionService.abandonMission();
                    this.uiManager.hideModal('mission-modal');
                    break;
                case 'complete-mission':
                    this.simulationService.missionService.completeActiveMission();
                    this.uiManager.hideModal('mission-modal');
                    actionData = { type: 'ACTION', action: 'complete-mission' };
                    break;

                // Ship & Navigation Actions
                case 'show-ship-detail':
                    this.uiManager.showShipDetailModal(state, shipId, context);
                    break;
                case ACTION_IDS.SET_SCREEN:
                    this.simulationService.setScreen(navId, screenId);
                    break;
                case ACTION_IDS.TRAVEL:
                    this.simulationService.travelTo(locationId);
                    actionData = { type: 'ACTION', action: ACTION_IDS.TRAVEL };
                    break;
                case ACTION_IDS.BUY_SHIP: 
                    if (this.simulationService.buyShip(shipId)) {
                        const price = DB.SHIPS[shipId].price;
                        this.uiManager.createFloatingText(`-${formatCredits(price, false)}`, e.clientX, e.clientY, '#f87171');
                        actionData = { type: 'ACTION', action: ACTION_IDS.BUY_SHIP };
                        this.uiManager.hideModal('ship-detail-modal');
                    }
                    break;
                case ACTION_IDS.SELL_SHIP:
                    const salePrice = this.simulationService.sellShip(shipId);
                    if (salePrice) {
                        this.uiManager.createFloatingText(`+${formatCredits(salePrice, false)}`, e.clientX, e.clientY, '#34d399');
                        this.uiManager.hideModal('ship-detail-modal');
                    }
                    break;
                case ACTION_IDS.SELECT_SHIP:
                    this.simulationService.setActiveShip(shipId);
                    actionData = { type: 'ACTION', action: ACTION_IDS.SELECT_SHIP };
                    this.uiManager.hideModal('ship-detail-modal');
                    break;

                // Finance & Intel Actions
                case ACTION_IDS.PAY_DEBT: this.simulationService.payOffDebt(); break;
                case ACTION_IDS.TAKE_LOAN: this.simulationService.takeLoan(JSON.parse(loanDetails)); break;
                case ACTION_IDS.PURCHASE_INTEL: this.simulationService.purchaseIntel(parseInt(cost));
                    break;
                case 'show-starport-locked-toast':
                    this.uiManager.showToast('starport-unlock-tooltip', "Pay off your initial loan to access the Starport!");
                    break;
                
                // Market Transaction Controls
                case 'toggle-trade-mode': {
                    const controls = actionTarget.closest('.transaction-controls');
                    if (controls) {
                        const currentMode = controls.getAttribute('data-mode');
                        const newMode = currentMode === 'buy' ? 'sell' : 'buy';
                        controls.setAttribute('data-mode', newMode);
                    }
                    break;
                }
                case 'confirm-trade': {
                    const controls = actionTarget.closest('.transaction-controls');
                    if (!controls) break;

                    const currentMode = controls.getAttribute('data-mode');
                    const qtyInput = controls.querySelector('input');
                    const quantity = parseInt(qtyInput.value, 10) || 0;

                    if (quantity > 0) {
                        const result = (currentMode === 'buy')
                            ? this.simulationService.buyItem(goodId, quantity)
                            : this.simulationService.sellItem(goodId, quantity);

                        if (result) {
                            const value = (currentMode === 'buy') ? this.uiManager.getItemPrice(state, goodId) * quantity : result;
                            const text = currentMode === 'buy' ? `-${formatCredits(value, false)}` : `+${formatCredits(value, false)}`;
                            const color = currentMode === 'buy' ? '#f87171' : '#34d399';
                            this.uiManager.createFloatingText(text, e.clientX, e.clientY, color);
                            if (currentMode === 'buy') {
                                qtyInput.value = '0';
                            }
                            actionData = { type: 'ACTION', action: currentMode === 'buy' ? 'buy-item' : 'sell-item', goodId: goodId };
                        }
                    }
                    break;
                }
                case 'set-max-trade': {
                    const controls = actionTarget.closest('.transaction-controls');
                    if (!controls) break;

                    const currentMode = controls.getAttribute('data-mode');
                    const qtyInput = controls.querySelector('input');
                    const ship = this.simulationService._getActiveShip();
                    const inventory = this.simulationService._getActiveInventory();

                    if (currentMode === 'sell') {
                        qtyInput.value = inventory[goodId] ? inventory[goodId].quantity : 0;
                    } else { // 'buy'
                        const price = this.uiManager.getItemPrice(state, goodId);
                        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
                        const canAfford = price > 0 ? Math.floor(state.player.credits / price) : space;
                        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
                        qtyInput.value = Math.max(0, Math.min(space, canAfford, stock));
                    }
                    break;
                }
                case ACTION_IDS.INCREMENT: 
                case ACTION_IDS.DECREMENT: {
                     const controls = actionTarget.closest('.transaction-controls');
                    if (!controls) break;
                    const qtyInput = controls.querySelector('input');
                    let val = parseInt(qtyInput.value) || 0;
                    qtyInput.value = (action === ACTION_IDS.INCREMENT) ? val + 1 : Math.max(0, val - 1);
                    break;
                }

                // Tooltip & Graph Actions
                 case ACTION_IDS.SHOW_PRICE_GRAPH:
                case ACTION_IDS.SHOW_FINANCE_GRAPH: {
                    if (this.uiManager.isMobile) {
                        this.uiManager.hideGenericTooltip(); // Hide other tooltip.
                        if (this.activeTooltipTarget === actionTarget) {
                            this.uiManager.hideGraph();
                            this.activeTooltipTarget = null;
                        } else {
                            this.uiManager.showGraph(actionTarget, this.gameState.getState());
                            this.activeTooltipTarget = actionTarget;
                        }
                    }
                    break;
                }
            }
            if (actionData) {
                this.tutorialService.checkState(actionData);
            }
            return; // Action was handled, so we stop here.
        }

        // --- Fallback Handlers (Intro, Modals, etc.) ---

        // Handle clicks during the intro sequence.
        if (state.introSequenceActive && !state.tutorials.activeBatchId) {
            this.simulationService.handleIntroClick(e);
            return;
        }

        if (state.isGameOver) return;

        // Dismiss mission modal by clicking the backdrop.
        const missionModal = e.target.closest('#mission-modal');
        if (missionModal && e.target.id === 'mission-modal') {
            this.uiManager.hideModal('mission-modal');
            return;
        }

        // Dismiss ship detail modal by clicking the backdrop.
        const shipDetailModal = e.target.closest('#ship-detail-modal');
        if (shipDetailModal && !e.target.closest('#ship-detail-content')) {
            this.uiManager.hideModal('ship-detail-modal');
            return;
        }
        
        // Handle mobile-specific generic tooltips (tap to show, tap again to hide).
        if (this.uiManager.isMobile) {
            const tooltipTarget = e.target.closest('[data-tooltip]');
            if (tooltipTarget) {
                this.uiManager.hideGraph(); // Hide graph if it's open.
                if (this.activeTooltipTarget === tooltipTarget) {
                    this.uiManager.hideGenericTooltip();
                    this.activeTooltipTarget = null;
                } else {
                    this.uiManager.showGenericTooltip(tooltipTarget, tooltipTarget.dataset.tooltip);
                    this.activeTooltipTarget = tooltipTarget;
                }
                return;
            }
        }

        // Handle lore/tutorial log tooltips on all devices.
        const tutorialTrigger = e.target.closest('.tutorial-container');
        const loreTrigger = e.target.closest('.lore-container');

        const visibleTooltip = document.querySelector('.lore-tooltip.visible, .tutorial-tooltip.visible');
        if (visibleTooltip && !e.target.closest('.lore-tooltip, .tutorial-tooltip')) {
            visibleTooltip.classList.remove('visible');
        }
        
        if (loreTrigger) {
            const tooltip = loreTrigger.querySelector('.lore-tooltip');
            if (tooltip) tooltip.classList.toggle('visible');
            return;
        }

        if (tutorialTrigger) {
            this.uiManager.showTutorialLogModal({
                seenBatches: this.gameState.tutorials.seenBatchIds,
                onSelect: (batchId) => {
                    this.tutorialService.triggerBatch(batchId);
                }
            });
            return;
        }
    }

    /**
     * Handles mouseover events, primarily for showing graphs on desktop.
     * @param {Event} e The mouseover event object.
     * @private
     */
    _handleMouseOver(e) {
        if (this.uiManager.isMobile) return;
        const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
        if (graphTarget) {
            this.uiManager.showGraph(graphTarget, this.gameState.getState());
        }
    }

    /**
     * Handles mouseout events, primarily for hiding graphs on desktop.
     * @param {Event} e The mouseout event object.
     * @private
     */
    _handleMouseOut(e) {
        if (this.uiManager.isMobile) return;
        const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
        if (graphTarget) {
            this.uiManager.hideGraph();
        }
    }
    
    /**
     * Handles keydown events, primarily for debug shortcuts.
     * @param {Event} e The keydown event object.
     * @private
     */
    _handleKeyDown(e) {
        const state = this.gameState.getState();
        if (state.isGameOver || e.ctrlKey || e.metaKey) return;

        // --- Debug/Dev Keys ---
        if (e.code === 'Backquote') {
            if (this.debugService) {
                this.debugService.toggleVisibility();
            }
            return;
        }
    
        let message = '';
        switch(e.key) {
            case '!':
                this.simulationService.debugMarketSkip();
                message = 'Debug: Market Skip';
                break;
            case '@':
                this.simulationService.debugTriggerRandomEvent();
                message = `Debug: Forcing Event ${this.gameState.player.debugEventIndex}`;
                break;
            case '#':
                this.gameState.player.credits += 100000;
                message = 'Debug: +100k Credits.';
                break;
            case '$':
                Object.keys(DB.SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                        this.simulationService.addShipToHangar(shipId);
                    }
                });
                message = 'Debug: All ships added.';
                break;
            case '%':
                this.gameState.player.credits += 1000000000000;
                const activeShip = this.simulationService._getActiveShip();
                const inventory = this.simulationService._getActiveInventory();
                if (activeShip && inventory) {
                    DB.COMMODITIES.forEach(c => {
                        if (calculateInventoryUsed(inventory) < activeShip.cargoCapacity) {
                            inventory[c.id].quantity = (inventory[c.id].quantity || 0) + 1;
                        }
                    });
                }
                message = 'Debug: +1T Credits & 1 of each item.';
                break;
            case '^':
                this.simulationService._advanceDays(366);
                message = `Debug: Time advanced 1 year and 1 day.`;
                break;
        }
    
        if (message) {
            this.uiManager.showToast('debugToast', message);
            this.gameState.setState({});
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Starts the refueling process when the button is held down.
     * @param {HTMLElement} buttonElement - The refuel button element.
     * @private
     */
    _startRefueling(buttonElement) {
        if (this.gameState.isGameOver || this.refuelInterval) return;
        this._refuelTick(buttonElement); 
        // A service tick is called every 1000ms (1 second) while the button is held.
        this.refuelInterval = setInterval(() => this._refuelTick(buttonElement), 1000);
    }

    /**
     * Stops the refueling process.
     * @private
     */
    _stopRefueling() {
        clearInterval(this.refuelInterval);
        this.refuelInterval = null;
    }

    /**
     * Executes a single "tick" of refueling.
     * @param {HTMLElement} buttonElement - The refuel button element, used for positioning the floating text.
     * @private
     */
    _refuelTick(buttonElement) {
        const cost = this.simulationService.refuelTick();
        if (cost > 0) {
            const rect = buttonElement.getBoundingClientRect();
            const x = rect.left + (rect.width / 2) + (Math.random() * 40 - 20);
            const y = rect.top + (Math.random() * 20 - 10);
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, x, y, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRefueling();
        }
    }

    /**
     * Starts the repair process when the button is held down.
     * @param {HTMLElement} buttonElement - The repair button element.
     * @private
     */
    _startRepairing(buttonElement) {
        if (this.gameState.isGameOver || this.repairInterval) return;
        this._repairTick(buttonElement);
        // A service tick is called every 1000ms (1 second) while the button is held.
        this.repairInterval = setInterval(() => this._repairTick(buttonElement), 1000);
    }

    /**
     * Stops the repair process.
     * @private
     */
    _stopRepairing() {
        clearInterval(this.repairInterval);
        this.repairInterval = null;
    }

    /**
     * Executes a single "tick" of repairing.
     * @param {HTMLElement} buttonElement - The repair button element, used for positioning the floating text.
     * @private
     */
    _repairTick(buttonElement) {
        const cost = this.simulationService.repairTick();
        if (cost > 0) {
            const rect = buttonElement.getBoundingClientRect();
            const x = rect.left + (rect.width / 2) + (Math.random() * 40 - 20);
            const y = rect.top + (Math.random() * 20 - 10);
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, x, y, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRepairing();
        }
    }
}