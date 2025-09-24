// js/services/EventManager.js
import { ACTION_IDS, SCREEN_IDS } from '../data/constants.js';

export class EventManager {
    constructor(simulationService, uiManager, gameState, logger) {
        this.sim = simulationService;
        this.ui = uiManager;
        this.gameState = gameState;
        this.logger = logger;
        this.isRefueling = false;
        this.isRepairing = false;
        this.refuelInterval = null;
        this.repairInterval = null;
    }

    init() {
        document.body.addEventListener('click', this._handleGlobalClick.bind(this));
        document.getElementById('game-container').addEventListener('click', this._handleClick.bind(this));
        document.getElementById('splash-screen').addEventListener('click', this._handleIntroClick.bind(this));
        
        // Use a more specific container if possible, but body works for tooltip hovering
        document.body.addEventListener('mouseover', this._handleMouseOver.bind(this));
        document.body.addEventListener('mouseout', this._handleMouseOut.bind(this));
        
        // Services screen button listeners for hold actions
        const servicesScreen = document.getElementById('services-screen');
        servicesScreen.addEventListener('mousedown', this._handleServiceMouseDown.bind(this));
        servicesScreen.addEventListener('mouseup', this._stopServiceActions.bind(this));
        servicesScreen.addEventListener('mouseleave', this._stopServiceActions.bind(this));
        servicesScreen.addEventListener('touchstart', this._handleServiceMouseDown.bind(this), { passive: false });
        servicesScreen.addEventListener('touchend', this._stopServiceActions.bind(this));

        // Market screen input listeners
        const marketScreen = document.getElementById('market-screen');
        marketScreen.addEventListener('input', this._handleMarketInput.bind(this));
        marketScreen.addEventListener('click', this._handleMarketClick.bind(this));

        // Hangar screen scroll listener for carousel
        const hangarScreen = document.getElementById('hangar-screen');
        hangarScreen.addEventListener('scroll', this._handleHangarScroll.bind(this), true); // Use capture phase
    }

    _handleGlobalClick(e) {
        const modalId = this.ui.getModalIdFromEvent(e);
        if (modalId) {
            this.ui.hideModal(modalId);
        }
    }

    _handleIntroClick(e) {
        this.sim.handleIntroClick(e);
    }
    
    _handleClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const state = this.gameState.getState();
        
        // Prevent actions if a modal is visible, unless it's a modal button itself
        if (document.querySelector('.modal-backdrop:not(.hidden)') && !target.closest('.modal-content')) {
            // Allow clicks on tutorial elements even when modals might be up for tutorial purposes.
            if (!target.closest('#tutorial-toast-container')) {
                 return;
            }
        }

        switch (action) {
            case ACTION_IDS.SET_SCREEN:
                this.sim.setScreen(target.dataset.navId, target.dataset.screenId);
                break;
            case ACTION_IDS.TRAVEL:
                this.sim.travelTo(target.dataset.locationId);
                this.ui.hideModal('launch-modal');
                break;
            case ACTION_IDS.BUY_SHIP:
                this.sim.buyShip(target.dataset.shipId);
                break;
            case ACTION_IDS.SELL_SHIP:
                this.sim.sellShip(target.dataset.shipId);
                break;
            case ACTION_IDS.SELECT_SHIP:
                this.sim.setActiveShip(target.dataset.shipId);
                break;
            case ACTION_IDS.PAY_DEBT:
                this.sim.payOffDebt();
                break;
            case ACTION_IDS.TAKE_LOAN:
                const loanData = { amount: parseInt(target.dataset.amount, 10), fee: parseInt(target.dataset.fee, 10), interest: parseInt(target.dataset.interest, 10) };
                this.sim.takeLoan(loanData);
                break;
            case ACTION_IDS.PURCHASE_LICENSE:
                this.sim.purchaseLicense(target.dataset.licenseId);
                break;
            case ACTION_IDS.PURCHASE_INTEL:
                this.sim.purchaseIntel(parseInt(target.dataset.cost, 10));
                break;
            case ACTION_IDS.SHOW_SHIP_DETAIL:
                this.ui.showShipDetailModal(state, target.dataset.shipId, target.dataset.context);
                break;
            case ACTION_IDS.SHOW_LAUNCH_MODAL:
                this.ui.showLaunchModal(target.dataset.locationId);
                break;
            case ACTION_IDS.SHOW_CARGO_DETAIL:
                this.ui.showCargoDetailModal(state, target.dataset.goodId);
                break;
            case ACTION_IDS.ACCEPT_MISSION:
                this.ui.hideModal('mission-modal');
                this.sim.missionService.acceptMission(target.dataset.missionId);
                break;
            case ACTION_IDS.ABANDON_MISSION:
                this.ui.hideModal('mission-modal');
                this.sim.missionService.abandonMission(target.dataset.missionId);
                break;
            case ACTION_IDS.COMPLETE_MISSION:
                this.ui.hideModal('mission-modal');
                this.sim.missionService.completeMission(target.dataset.missionId);
                break;
            case ACTION_IDS.SHOW_MISSION_MODAL:
                this.ui.showMissionModal(target.dataset.missionId);
                break;
            case ACTION_IDS.TOGGLE_HANGAR_MODE:
                {
                    const currentMode = this.gameState.uiState.hangarScreen.mode || 'shipyard';
                    const newMode = currentMode === 'hangar' ? 'shipyard' : 'hangar';
                    this.gameState.setState({
                        uiState: {
                            ...this.gameState.uiState,
                            hangarScreen: {
                                mode: newMode,
                                currentIndex: 0 // Reset index when switching modes
                            }
                        }
                    });
                }
                break;
            case ACTION_IDS.PAGINATE_HANGAR:
                {
                    const index = parseInt(target.dataset.index, 10);
                    const carousel = document.querySelector('.carousel-container');
                    if (carousel) {
                        carousel.scrollTo({
                            left: carousel.offsetWidth * index,
                            behavior: 'smooth'
                        });
                    }
                    // The scroll handler will update the state
                }
                break;
        }
    }
    
    _handleHangarScroll(e) {
        if (e.target.matches('.carousel-container')) {
            const carousel = e.target;
            // Debounce or throttle this if performance becomes an issue
            requestAnimationFrame(() => {
                const scrollPos = carousel.scrollLeft;
                const itemWidth = carousel.offsetWidth;
                const newIndex = Math.round(scrollPos / itemWidth);

                const hangarState = this.gameState.uiState.hangarScreen;
                if (hangarState && newIndex !== hangarState.currentIndex) {
                    this.gameState.setState({
                        uiState: {
                            ...this.gameState.uiState,
                            hangarScreen: {
                                ...hangarState,
                                currentIndex: newIndex
                            }
                        }
                    });
                }
            });
        }
    }

    _handleMouseOver(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;

        if (action === ACTION_IDS.SHOW_PRICE_GRAPH) {
            this.ui.showGraph(target, this.gameState.getState());
        } else if (action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
            this.ui.showGraph(target, this.gameState.getState());
        } else if (action === 'toggle-tooltip') {
            const tooltipContent = target.querySelector('.status-tooltip').innerHTML;
            this.ui.showGenericTooltip(target, tooltipContent);
        } else if (target.hasAttribute('data-tooltip')) {
            this.ui.showGenericTooltip(target, target.dataset.tooltip);
        }
    }

    _handleMouseOut(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;

        if (action === ACTION_IDS.SHOW_PRICE_GRAPH || action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
            this.ui.hideGraph();
        } else if (action === 'toggle-tooltip' || target.hasAttribute('data-tooltip')) {
            this.ui.hideGenericTooltip();
        }
    }
    
    _handleServiceMouseDown(e) {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'refuel-btn') {
            this.isRefueling = true;
            this._startRefuelInterval();
        } else if (target.id === 'repair-btn') {
            this.isRepairing = true;
            this._startRepairInterval();
        }
    }
    
    _startRefuelInterval() {
        if (this.refuelInterval) clearInterval(this.refuelInterval);
        this.refuelInterval = setInterval(() => {
            if (!this.isRefueling || this.sim.refuelTick() === 0) {
                this._stopServiceActions();
            }
        }, 100);
    }
    
    _startRepairInterval() {
        if (this.repairInterval) clearInterval(this.repairInterval);
        this.repairInterval = setInterval(() => {
            if (!this.isRepairing || this.sim.repairTick() === 0) {
                this._stopServiceActions();
            }
        }, 100);
    }
    
    _stopServiceActions() {
        this.isRefueling = false;
        this.isRepairing = false;
        clearInterval(this.refuelInterval);
        clearInterval(this.repairInterval);
        this.refuelInterval = null;
        this.repairInterval = null;
    }
    
    _handleMarketInput(e) {
        const input = e.target;
        if (input.tagName === 'INPUT' && input.type === 'number') {
            const card = input.closest('.transaction-controls');
            const goodId = card.dataset.goodId;
            const quantity = parseInt(input.value, 10) || 0;
            const mode = card.dataset.mode;
            this.ui.updateMarketCardDisplay(goodId, quantity, mode);
        }
    }
    
    _handleMarketClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const card = target.closest('.item-card-container');
        if (!card) return;

        const controls = card.querySelector('.transaction-controls');
        const goodId = controls.dataset.goodId;
        const qtyInput = controls.querySelector('input');
        const quantity = parseInt(qtyInput.value, 10);
        const mode = controls.dataset.mode;

        switch (action) {
            case 'buy-item':
                if (quantity > 0 && this.sim.buyItem(goodId, quantity)) {
                    this.ui.createFloatingText(`-${formatCredits(this.ui.getItemPrice(this.gameState.getState(), goodId) * quantity, false)}`, e.clientX, e.clientY, '#f87171');
                }
                break;
            case 'sell-item':
                if (quantity > 0) {
                    const saleValue = this.sim.sellItem(goodId, quantity);
                    if (saleValue > 0) {
                        this.ui.createFloatingText(`+${formatCredits(saleValue, false)}`, e.clientX, e.clientY, '#4ade80');
                    }
                }
                break;
            case 'set-buy-mode':
                controls.dataset.mode = 'buy';
                this.ui.updateMarketCardDisplay(goodId, quantity, 'buy');
                break;
            case 'set-sell-mode':
                controls.dataset.mode = 'sell';
                this.ui.updateMarketCardDisplay(goodId, quantity, 'sell');
                break;
            case 'max-buy':
            case 'max-sell':
                this._handleMaxAction(goodId, action, qtyInput, mode);
                break;
        }
    }
    
    _handleMaxAction(goodId, action, qtyInput, currentMode) {
        const state = this.gameState.getState();
        const activeShip = this.sim._getActiveShip();
        const activeInventory = this.sim._getActiveInventory();
        let maxQty = 0;
        
        if (action === 'max-buy') {
            const cargoSpace = activeShip.cargoCapacity - calculateInventoryUsed(activeInventory);
            const price = this.ui.getItemPrice(state, goodId);
            const affordQty = Math.floor(state.player.credits / price);
            const stockQty = state.market.inventory[state.currentLocationId][goodId].quantity;
            maxQty = Math.min(cargoSpace, affordQty, stockQty);
        } else { // max-sell
            maxQty = activeInventory[goodId] ? activeInventory[goodId].quantity : 0;
        }
        
        qtyInput.value = maxQty;
        // Manually trigger an input event to update the display
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
}