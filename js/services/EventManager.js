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
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, simulationService, uiManager, tutorialService, debugService = null, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
        this.debugService = debugService;
        this.logger = logger;
        
        this.refuelInterval = null;
        this.repairInterval = null;
        this.activeTooltipTarget = null;
        this.activeStatusTooltip = null;

        this.carouselState = {
            isDragging: false,
            startX: 0,
            startTranslate: 0,
            currentTranslate: 0,
            activeCarousel: null,
            containerWidth: 0,
            pageCount: 0,
            currentIndex: 0,
            moved: false
        };
    }

    /**
     * Binds all necessary global event listeners to the document body.
     */
    bindEvents() {
        document.body.addEventListener('click', (e) => this._handleClick(e));
        document.body.addEventListener('dblclick', (e) => e.preventDefault());
        document.body.addEventListener('mouseover', (e) => this._handleMouseOver(e));
        document.body.addEventListener('mouseout', (e) => this._handleMouseOut(e));
        document.addEventListener('keydown', (e) => this._handleKeyDown(e));
        document.body.addEventListener('input', (e) => this._handleInput(e));
        
        // --- Hold-to-act and Drag-and-drop Listeners ---
        const startDragOrHold = (e) => {
            if (e.target.closest('#refuel-btn')) this._startRefueling(e.type === 'touchstart');
            if (e.target.closest('#repair-btn')) this._startRepairing(e.type === 'touchstart');
            const carouselContainer = e.target.closest('.carousel-container');
            if (carouselContainer) this._handleCarouselDragStart(e, carouselContainer.querySelector('#hangar-carousel'));
        };

        document.body.addEventListener('mousedown', startDragOrHold);
        document.body.addEventListener('touchstart', (e) => {
            // Prevent default scroll/zoom on touch-hold for buttons
            if (e.target.closest('#refuel-btn') || e.target.closest('#repair-btn')) {
                e.preventDefault();
            }
            startDragOrHold(e);
        }, { passive: false });

        document.body.addEventListener('mousemove', (e) => this._handleCarouselDragMove(e));
        document.body.addEventListener('touchmove', (e) => this._handleCarouselDragMove(e), { passive: false });
        
        const endDragOrHold = (e) => this._handleCarouselDragEnd(e);
        document.body.addEventListener('mouseup', endDragOrHold);
        document.body.addEventListener('mouseleave', endDragOrHold);
        document.body.addEventListener('touchend', endDragOrHold);

        // Stop intervals if mouse leaves the window or interaction ends
        ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
            document.addEventListener(evt, () => {
                this._stopRefueling();
                this._stopRepairing();
            });
        });

        window.addEventListener('resize', () => this.uiManager.render(this.gameState.getState()));
        window.addEventListener('scroll', () => {
            if (this.activeTooltipTarget) {
                this.uiManager.hideGraph();
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
            }
        }, { passive: true });
        
        if (this.uiManager.cache.missionStickyBar) {
            this.uiManager.cache.missionStickyBar.addEventListener('click', () => {
                this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
            });
        }
    }

    /**
     * Handles real-time input events, like typing in the market quantity field.
     * @param {Event} e The input event.
     * @private
     */
    _handleInput(e) {
        const qtyInput = e.target.closest('.transaction-controls input[type="number"]');
        if (qtyInput) {
            const controls = qtyInput.closest('.transaction-controls');
            const { goodId, mode } = controls.dataset;
            const quantity = parseInt(qtyInput.value, 10) || 0;
            this.uiManager.updateMarketCardDisplay(goodId, quantity, mode);
        }
    }

    /**
     * Central click handler for the entire application, using event delegation.
     * @param {Event} e The click event object.
     * @private
     */
    _handleClick(e) {
        if (this.carouselState.moved) {
            e.preventDefault();
            return;
        }
        
        const state = this.gameState.getState();
        const actionTarget = e.target.closest('[data-action]');

        // --- Pre-action UI Cleanup ---
        if (this.activeStatusTooltip && !this.uiManager.isClickInside(e, '[data-action="toggle-tooltip"]')) {
            this.activeStatusTooltip.classList.remove('visible');
            this.activeStatusTooltip = null;
        }
        if (this.uiManager.isClickInside(e, '#graph-tooltip, #generic-tooltip')) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
            return;
        }
        if (this.activeTooltipTarget && actionTarget !== this.activeTooltipTarget) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
        }

        // --- Action Handling ---
        if (actionTarget) {
            this._handleActionClick(e, actionTarget);
            return;
        }

        // --- Fallback Handlers for non-action clicks ---
        if (state.introSequenceActive && !state.tutorials.activeBatchId) {
            this.simulationService.handleIntroClick(e);
            return;
        }
        if (state.isGameOver) return;

        const modalIdToClose = this.uiManager.getModalIdFromEvent(e);
        if (modalIdToClose) {
            this.uiManager.hideModal(modalIdToClose);
            return;
        }
        
        if (this.uiManager.isMobile) {
            this._handleMobileTooltip(e);
        }

        this._handleLoreAndTutorialLog(e);
    }
    
    /**
     * Handles the logic for a clicked element with a `data-action`.
     * @param {Event} e The original click event.
     * @param {HTMLElement} actionTarget The DOM element that was clicked.
     * @private
     */
    _handleActionClick(e, actionTarget) {
        const state = this.gameState.getState();
        if (actionTarget.hasAttribute('disabled')) return;

        const { action, ...dataset } = actionTarget.dataset;
        let actionData = null; // For the TutorialService
        
        switch(action) {
            // --- Ship Actions (Hangar/Shipyard) ---
            case ACTION_IDS.BUY_SHIP:
            case ACTION_IDS.SELL_SHIP:
            case ACTION_IDS.SELECT_SHIP: {
                const { shipId } = dataset;
                if (!shipId) {
                    this.logger.error('EventManager', `Ship action '${action}' triggered but target had no shipId.`, { target: actionTarget });
                    return;
                }
                e.stopPropagation();

                if (action === ACTION_IDS.BUY_SHIP) {
                    const purchasedShip = this.simulationService.buyShip(shipId);
                    if (purchasedShip) {
                        this.uiManager.createFloatingText(`-${formatCredits(purchasedShip.price, false)}`, e.clientX, e.clientY, '#f87171');
                        actionData = { type: 'ACTION', action: ACTION_IDS.BUY_SHIP };
                    }
                } else if (action === ACTION_IDS.SELL_SHIP) {
                    const salePrice = this.simulationService.sellShip(shipId);
                    if (salePrice) {
                        this.uiManager.createFloatingText(`+${formatCredits(salePrice, false)}`, e.clientX, e.clientY, '#34d399');
                    }
                } else if (action === ACTION_IDS.SELECT_SHIP) {
                    this.simulationService.setActiveShip(shipId);
                    actionData = { type: 'ACTION', action: ACTION_IDS.SELECT_SHIP };
                }
                this.uiManager.hideModal('ship-detail-modal'); // Attempt to close modal if open
                break;
            }
            
            // --- Hangar UI ---
            case ACTION_IDS.TOGGLE_HANGAR_MODE:
                if (dataset.mode && this.gameState.uiState.hangarShipyardToggleState !== dataset.mode) {
                    this.gameState.uiState.hangarShipyardToggleState = dataset.mode;
                    this.gameState.setState({});
                }
                break;
            case ACTION_IDS.SET_HANGAR_PAGE: {
                const newIndex = parseInt(dataset.index, 10);
                const isHangarMode = this.gameState.uiState.hangarShipyardToggleState === 'hangar';
                this.simulationService.setHangarCarouselIndex(newIndex, isHangarMode ? 'hangar' : 'shipyard');
                break;
            }

            // --- Navigation & Screen Changes ---
            case ACTION_IDS.SET_SCREEN:
                if (dataset.navId === state.activeNav && actionTarget.tagName === 'DIV') {
                    this.gameState.subNavCollapsed = !this.gameState.subNavCollapsed;
                    this.uiManager.render(this.gameState.getState());
                } else {
                    this.gameState.subNavCollapsed = false;
                    this.simulationService.setScreen(dataset.navId, dataset.screenId);
                }
                actionData = { type: 'ACTION', action: ACTION_IDS.SET_SCREEN, navId: dataset.navId, screenId: dataset.screenId };
                break;
            case ACTION_IDS.TRAVEL:
                this.uiManager.hideModal('launch-modal');
                this.simulationService.travelTo(dataset.locationId);
                actionData = { type: 'ACTION', action: ACTION_IDS.TRAVEL };
                break;
            
            // --- Modals ---
            case 'show-mission-modal':
                this.uiManager.showMissionModal(dataset.missionId);
                actionData = { type: 'ACTION', action: 'show-mission-modal' };
                break;
            case 'show_cargo_detail':
                this.uiManager.showCargoDetailModal(state, dataset.goodId);
                break;
            case 'show-launch-modal':
                this.uiManager.showLaunchModal(dataset.locationId);
                break;

            // --- Mission Actions ---
            case 'accept-mission':
                this.simulationService.missionService.acceptMission(dataset.missionId);
                this.uiManager.hideModal('mission-modal');
                actionData = { type: 'ACTION', action: 'accept-mission', missionId: dataset.missionId };
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

            // --- Finance & Licenses ---
            case ACTION_IDS.PAY_DEBT: this.simulationService.payOffDebt(); break;
            case ACTION_IDS.TAKE_LOAN: this.simulationService.takeLoan(JSON.parse(dataset.loanDetails)); break;
            case ACTION_IDS.PURCHASE_INTEL: this.simulationService.purchaseIntel(parseInt(dataset.cost)); break;
            case ACTION_IDS.ACQUIRE_LICENSE: this._handleAcquireLicense(dataset.licenseId); break;
            
            // --- Market Trading ---
            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                if (dataset.goodId) {
                    this.gameState.uiState.marketCardMinimized[dataset.goodId] = !this.gameState.uiState.marketCardMinimized[dataset.goodId];
                    this.gameState.setState({});
                }
                break;
            case 'toggle-trade-mode': this._handleMarketAction(actionTarget, action); break;
            case 'confirm-trade': this._handleMarketAction(actionTarget, action, e); actionData = { type: 'ACTION', action: `${actionTarget.dataset.mode}-item` }; break;
            case 'set-max-trade': this._handleMarketAction(actionTarget, action); break;
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.DECREMENT: this._handleMarketAction(actionTarget, action); break;

            // --- UI & Tooltips ---
            case 'toggle-tooltip': this._toggleStatusTooltip(actionTarget); return;
            case ACTION_IDS.SHOW_PRICE_GRAPH:
            case ACTION_IDS.SHOW_FINANCE_GRAPH:
                if (this.uiManager.isMobile) {
                    this.uiManager.hideGenericTooltip();
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
        if (actionData) {
            this.tutorialService.checkState(actionData);
        }
    }

    /**
     * Handles all actions related to the market transaction controls.
     * @param {HTMLElement} controlsContainer - The `.transaction-controls` element.
     * @param {string} action - The specific action to perform.
     * @param {Event} [e] - The original click event, for effects.
     * @private
     */
    _handleMarketAction(controlsContainer, action, e) {
        const controls = controlsContainer.closest('.transaction-controls');
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

    /**
     * Handles the UI flow for acquiring a trade license.
     * @param {string} licenseId The ID of the license to acquire.
     * @private
     */
    _handleAcquireLicense(licenseId) {
        const license = DB.LICENSES[licenseId];
        if (!license) return;
    
        if (license.type === 'purchase') {
            const description = `${license.description}<br><br>Cost: <b class='hl-yellow'>${formatCredits(license.cost)}</b>`;
            this.uiManager.queueModal('event-modal', `Purchase ${license.name}?`, description, null, {
                customSetup: (modal, closeHandler) => {
                    const btnContainer = modal.querySelector('#event-button-container');
                    btnContainer.innerHTML = `
                        <button id="confirm-license-purchase" class="btn btn-pulse-green">Confirm</button>
                        <button id="cancel-license-purchase" class="btn">Cancel</button>
                    `;
                    modal.querySelector('#confirm-license-purchase').onclick = () => {
                        const result = this.simulationService.purchaseLicense(licenseId);
                        if (!result.success && result.error === 'INSUFFICIENT_FUNDS') {
                            this.uiManager.queueModal('event-modal', 'Purchase Failed', `You cannot afford the ${formatCredits(license.cost)} fee for this license.`);
                        }
                        closeHandler();
                    };
                    modal.querySelector('#cancel-license-purchase').onclick = closeHandler;
                }
            });
        } else if (license.type === 'mission') {
            this.uiManager.queueModal('event-modal', license.name, license.guidanceText);
        }
    }

    /**
     * Handles mouseover events for desktop tooltips and graphs.
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
     * Handles mouseout events for desktop tooltips and graphs.
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
        if (this.gameState.isGameOver || e.ctrlKey || e.metaKey) return;
        if (e.key === '`' && this.debugService) {
            this.debugService.toggleVisibility();
            return;
        }
        if (this.debugService) {
            this.debugService.handleKeyPress(e.key);
        }
    }
    
    // --- Helper methods for UI interactions ---
    
    _toggleStatusTooltip(target) {
        const tooltip = target.querySelector('.status-tooltip');
        if (!tooltip) return;
        if (this.activeStatusTooltip === tooltip) {
            tooltip.classList.remove('visible');
            this.activeStatusTooltip = null;
        } else {
            if (this.activeStatusTooltip) this.activeStatusTooltip.classList.remove('visible');
            tooltip.classList.add('visible');
            this.activeStatusTooltip = tooltip;
        }
    }

    _handleMobileTooltip(e) {
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget && !tooltipTarget.closest('[data-action="toggle-tooltip"]')) {
            this.uiManager.hideGraph();
            if (this.activeTooltipTarget === tooltipTarget) {
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
            } else {
                this.uiManager.showGenericTooltip(tooltipTarget, tooltipTarget.dataset.tooltip);
                this.activeTooltipTarget = tooltipTarget;
            }
        }
    }

    _handleLoreAndTutorialLog(e) {
        const tutorialTrigger = e.target.closest('.tutorial-container');
        const loreTrigger = e.target.closest('.lore-container');

        const visibleTooltip = document.querySelector('.lore-tooltip.visible, .tutorial-tooltip.visible');
        if (visibleTooltip && !e.target.closest('.lore-tooltip, .tutorial-tooltip')) {
            visibleTooltip.classList.remove('visible');
        }
        
        if (loreTrigger) {
            loreTrigger.querySelector('.lore-tooltip')?.classList.toggle('visible');
        }

        if (tutorialTrigger) {
            this.uiManager.showTutorialLogModal({
                seenBatches: this.gameState.tutorials.seenBatchIds,
                onSelect: (batchId) => this.tutorialService.triggerBatch(batchId)
            });
        }
    }

    // --- Hold-to-act Logic (Refuel/Repair) ---

    _startRefueling(isTouch = false) {
        if (this.gameState.isGameOver || this.refuelInterval) return;
        this._refuelTick(); 
        this.refuelInterval = setInterval(() => this._refuelTick(), isTouch ? 200 : 1000);
    }
    _stopRefueling() {
        clearInterval(this.refuelInterval); this.refuelInterval = null;
    }
    _refuelTick() {
        const cost = this.simulationService.refuelTick();
        const button = this.uiManager.cache.servicesScreen?.querySelector('#refuel-btn');
        if (cost > 0 && button) {
            const rect = button.getBoundingClientRect();
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRefueling();
        }
    }

    _startRepairing(isTouch = false) {
        if (this.gameState.isGameOver || this.repairInterval) return;
        this._repairTick();
        this.repairInterval = setInterval(() => this._repairTick(), isTouch ? 200 : 1000);
    }
    _stopRepairing() {
        clearInterval(this.repairInterval); this.repairInterval = null;
    }
    _repairTick() {
        const cost = this.simulationService.repairTick();
        const button = this.uiManager.cache.servicesScreen?.querySelector('#repair-btn');
        if (cost > 0 && button) {
            const rect = button.getBoundingClientRect();
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRepairing();
        }
    }

    // --- Carousel Drag Logic ---

    _handleCarouselDragStart(e, carousel) {
        if (e.target.closest('.action-button') || !carousel || carousel.children.length <= 1) {
            this.carouselState.isDragging = false;
            return;
        }
        e.preventDefault();

        const state = this.gameState.getState();
        const isHangarMode = state.uiState.hangarShipyardToggleState === 'hangar';
        
        this.carouselState.isDragging = true;
        this.carouselState.activeCarousel = carousel;
        this.carouselState.startX = e.pageX ?? e.touches[0].pageX;
        this.carouselState.containerWidth = carousel.parentElement.offsetWidth;
        this.carouselState.pageCount = carousel.children.length;
        this.carouselState.currentIndex = isHangarMode ? (state.uiState.hangarActiveIndex || 0) : (state.uiState.shipyardActiveIndex || 0);
        this.carouselState.startTranslate = -this.carouselState.currentIndex * this.carouselState.containerWidth;
        this.carouselState.currentTranslate = this.carouselState.startTranslate;
        this.carouselState.moved = false;
        
        carousel.classList.remove('transition-transform', 'duration-300', 'ease-in-out');
        document.body.style.cursor = 'grabbing';
    }

    _handleCarouselDragMove(e) {
        if (!this.carouselState.isDragging) return;
        e.preventDefault();

        const currentX = e.pageX ?? e.touches[0].pageX;
        const diff = currentX - this.carouselState.startX;
        this.carouselState.currentTranslate = this.carouselState.startTranslate + diff;
        
        if (Math.abs(diff) > 10) this.carouselState.moved = true;

        this.carouselState.activeCarousel.style.transform = `translateX(${this.carouselState.currentTranslate}px)`;
    }

    _handleCarouselDragEnd() {
        if (!this.carouselState.isDragging) return;
        
        const { activeCarousel, startTranslate, currentTranslate, currentIndex, containerWidth, pageCount } = this.carouselState;
        this.carouselState.isDragging = false;
        document.body.style.cursor = 'default';
        
        if (!activeCarousel) return;
        activeCarousel.classList.add('transition-transform', 'duration-300', 'ease-in-out');

        const movedBy = currentTranslate - startTranslate;
        let newIndex = currentIndex;
        const threshold = containerWidth / 4;

        if (movedBy < -threshold && currentIndex < pageCount - 1) newIndex++;
        else if (movedBy > threshold && currentIndex > 0) newIndex--;

        if (newIndex !== currentIndex) {
            const mode = this.gameState.uiState.hangarShipyardToggleState;
            this.simulationService.setHangarCarouselIndex(newIndex, mode);
        } else {
            // Snap back to the original position if not moved enough
            activeCarousel.style.transform = `translateX(${startTranslate}px)`;
        }
    }
}