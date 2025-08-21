// js/services/EventManager.js
import { formatCredits } from '../utils.js';
import { SHIPS, COMMODITIES, MARKETS } from '../data/gamedata.js';
import { calculateInventoryUsed } from '../utils.js';
import { ACTION_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';

export class EventManager {
    constructor(gameState, simulationService, uiManager, tutorialService) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
        
        this.refuelInterval = null;
        this.repairInterval = null;
        this.activeTooltipTarget = null;
    }

    bindEvents() {
        document.body.addEventListener('click', (e) => this._handleClick(e));
        document.body.addEventListener('dblclick', (e) => e.preventDefault()); // Prevent double-tap zoom
        document.body.addEventListener('mouseover', (e) => this._handleMouseOver(e));
        document.body.addEventListener('mouseout', (e) => this._handleMouseOut(e));
        document.addEventListener('keydown', (e) => this._handleKeyDown(e));

        // Refuel and repair buttons will be created dynamically, need to use event delegation
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
        ['mouseup', 'mouseleave', 'touchend'].forEach(evt => {
            document.addEventListener(evt, () => {
                this._stopRefueling();
                this._stopRepairing();
            });
        });
        window.addEventListener('resize', () => {
             // Re-render on resize to handle mobile/desktop layout changes
             this.uiManager.render(this.gameState.getState());
        });
        window.addEventListener('scroll', () => {
            if (this.uiManager.isMobile && this.activeTooltipTarget) {
                this.uiManager.hideGraph();
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
            }
        }, { passive: true });
        
        const missionStickyBar = document.getElementById('mission-sticky-bar');
        if (missionStickyBar) {
            missionStickyBar.addEventListener('click', () => {
                this.simulationService.setScreen(NAV_IDS.ADMIN, SCREEN_IDS.MISSIONS);
            });
        }
    }

    _handleClick(e) {
        const state = this.gameState.getState();

        // --- Priority Action Handling ---
        const actionTarget = e.target.closest('[data-action]');
        if (actionTarget) {
            if (actionTarget.hasAttribute('disabled')) return;
            const { action, goodId, locationId, shipId, loanDetails, cost, navId, screenId, context, missionId } = actionTarget.dataset;
            let actionData = null;
            
            switch(action) {
                case 'show-mission-modal':
                    this.uiManager.showMissionModal(missionId);
                    actionData = { type: 'ACTION', action: 'show-mission-modal' };
                    break; // ensure we hit checkState below
                case 'accept-mission':
                    this.simulationService.missionService.acceptMission(missionId);
                    this.uiManager.hideModal('mission-modal');
                    actionData = { type: 'ACTION', action: 'accept-mission' };
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
                        const price = SHIPS[shipId].price;
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
                case ACTION_IDS.PAY_DEBT: this.simulationService.payOffDebt(); break;
                case ACTION_IDS.TAKE_LOAN: this.simulationService.takeLoan(JSON.parse(loanDetails)); break;
                case ACTION_IDS.PURCHASE_INTEL: this.simulationService.purchaseIntel(parseInt(cost));
                    break;
                case 'show-starport-locked-toast':
                    this.uiManager.showToast('starport-unlock-tooltip', "Pay off your initial loan to access the Starport!");
                    break;
                
                case ACTION_IDS.BUY_ITEM: 
                case ACTION_IDS.SELL_ITEM: {
                    const qtyInput = document.getElementById(`qty-${goodId}`) ||
                        document.getElementById(`qty-${goodId}-mobile`);
                    const quantity = parseInt(qtyInput.value, 10) || 1;
                    if (quantity > 0) {
                        const result = (action === ACTION_IDS.BUY_ITEM)
                            ? this.simulationService.buyItem(goodId, quantity)
                            : this.simulationService.sellItem(goodId, quantity);
                        if (result) {
                            const value = (action === ACTION_IDS.BUY_ITEM) ?
                                this.uiManager.getItemPrice(state, goodId) * quantity : result;
                            const text = action === ACTION_IDS.BUY_ITEM ? `-${formatCredits(value, false)}` : `+${formatCredits(value, false)}`;
                            const color = action === ACTION_IDS.BUY_ITEM ? '#f87171' : '#34d399';
                            this.uiManager.createFloatingText(text, e.clientX, e.clientY, color);
                            qtyInput.value = '1';
                            actionData = { type: 'ACTION', action: action, goodId: goodId };
                        }
                    }
                    break;
                }
                case ACTION_IDS.SET_MAX_BUY: 
                case ACTION_IDS.SET_MAX_SELL: {
                    const qtyInput = document.getElementById(`qty-${goodId}`) ||
                        document.getElementById(`qty-${goodId}-mobile`);
                    const ship = this.simulationService._getActiveShip();
                    const inventory = this.simulationService._getActiveInventory();
                    
                    if (action === ACTION_IDS.SET_MAX_SELL) {
                        qtyInput.value = inventory[goodId] ? inventory[goodId].quantity : 0;
                    } else {
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
                    const qtyInput = document.getElementById(`qty-${goodId}`) ||
                        document.getElementById(`qty-${goodId}-mobile`);
                    let val = parseInt(qtyInput.value) || 0;
                    qtyInput.value = (action === ACTION_IDS.INCREMENT) ? val + 1 : Math.max(1, val - 1);
                    break;
                }
            }
            if (actionData) {
                this.tutorialService.checkState(actionData);
            }
            return; // Action was handled, so we stop here.
        }

        if (state.introSequenceActive && !state.tutorials.activeBatchId) {
            this.simulationService.handleIntroClick(e);
            return;
        }

        if (state.isGameOver) return;

        const missionModal = e.target.closest('#mission-modal');
        if (missionModal && e.target.id === 'mission-modal') {
            this.uiManager.hideModal('mission-modal');
            return;
        }

        // --- Modal Dismissal ---
        const shipDetailModal = e.target.closest('#ship-detail-modal');
        if (shipDetailModal && !e.target.closest('#ship-detail-content')) {
            this.uiManager.hideModal('ship-detail-modal');
            return;
        }


        // --- Mobile Tooltip Handling (only if no action was taken) ---
        if (this.uiManager.isMobile) {
            const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
            const commodityTooltipTarget = e.target.closest('.commodity-name-tooltip');
            const cargoTooltipTarget = e.target.closest('.cargo-item-tooltip');
            const hangerTooltipTarget = e.target.closest('.hanger-ship-name');

            const newTarget = graphTarget || commodityTooltipTarget ||
                cargoTooltipTarget || hangerTooltipTarget;

            if (this.activeTooltipTarget) {
                const isClickingSameTarget = this.activeTooltipTarget === newTarget;
                this.uiManager.hideGraph();
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
                if (isClickingSameTarget) {
                    return;
                }
            }
            
            if (newTarget) {
                if (newTarget.dataset.action?.includes(ACTION_IDS.SHOW_PRICE_GRAPH) || newTarget.dataset.action?.includes(ACTION_IDS.SHOW_FINANCE_GRAPH)) {
                    this.uiManager.showGraph(newTarget, this.gameState.getState());
                } else {
                    const tooltipText = newTarget.dataset.tooltip;
                    if (tooltipText) {
                        this.uiManager.showGenericTooltip(newTarget, tooltipText);
                    }
                }
                this.activeTooltipTarget = newTarget;
                return;
            }
        }
        
        // --- Lore/Tutorial Tooltip Handling (All Devices) ---
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

    _handleMouseOver(e) {
        if (this.uiManager.isMobile) return;
        const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
        if (graphTarget) {
            this.uiManager.showGraph(graphTarget, this.gameState.getState());
        }
    }

    _handleMouseOut(e) {
        if (this.uiManager.isMobile) return;
        const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
        if (graphTarget) {
            this.uiManager.hideGraph();
        }
    }
    
    _handleKeyDown(e) {
        const state = this.gameState.getState();
        if (state.isGameOver || e.ctrlKey || e.metaKey) return;
    
        // --- Debug Keys ---
        let message = '';
        switch(e.key) {
            case '!':
                this.simulationService.debugQuickStart();
                message = 'Debug: Quick Start';
                break;
            case '#':
                this.gameState.player.credits += 100000;
                message = 'Debug: +100k Credits.';
                break;
            case '$':
                Object.keys(SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                        this.simulationService.addShipToHangar(shipId);
                    }
                });
                message = 'Debug: All ships added.';
                break;
            case '@':
                this.simulationService.debugProfitStart();
                message = 'Debug: Skipped to profit tutorial.';
                break;
            case '%':
                this.gameState.player.credits += 1000000000000;
                const activeShip = this.simulationService._getActiveShip();
                const inventory = this.simulationService._getActiveInventory();
                if (activeShip && inventory) {
                    COMMODITIES.forEach(c => {
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

    _startRefueling(buttonElement) {
        if (this.gameState.isGameOver || this.refuelInterval) return;
        this._refuelTick(buttonElement); 
        // The service tick is called every 1000ms (1 second) while the button is held.
        this.refuelInterval = setInterval(() => this._refuelTick(buttonElement), 1000);
    }

    _stopRefueling() {
        clearInterval(this.refuelInterval);
        this.refuelInterval = null;
    }

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

    _startRepairing(buttonElement) {
        if (this.gameState.isGameOver || this.repairInterval) return;
        this._repairTick(buttonElement);
        // The service tick is called every 1000ms (1 second) while the button is held.
        this.repairInterval = setInterval(() => this._repairTick(buttonElement), 1000);
    }

    _stopRepairing() {
        clearInterval(this.repairInterval);
        this.repairInterval = null;
    }

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