// js/services/handlers/ActionClickHandler.js
/**
 * @fileoverview Handles the primary routing of 'data-action' click events,
 * delegating them to the appropriate services. This module focuses on general
 * actions like navigation, modal triggers, and simple state changes, while
 * more complex interactions are handled by other specialized handlers.
 */
import { DB } from '../../data/database.js';
import { ACTION_IDS, NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { formatCredits } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js'; 

export class ActionClickHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     * @param {import('../TutorialService.js').TutorialService} tutorialService The tutorial management service.
     */
    constructor(gameState, simulationService, uiManager, tutorialService) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
    }

    /**
     * Handles a delegated click event if it matches a data-action.
     * @param {Event} e The click event object.
     * @param {HTMLElement} actionTarget The DOM element with the data-action attribute.
     */
    async handle(e, actionTarget) { 
        const state = this.gameState.getState();
        if (actionTarget.hasAttribute('disabled')) return;

        const { action, ...dataset } = actionTarget.dataset;
        let actionData = null; 

        switch (action) {
            // --- Ship Actions (Hangar/Shipyard) ---
            case ACTION_IDS.BUY_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();
                
                const target = e.target; 

                this.uiManager.showShipTransactionConfirmation(shipId, 'buy', async () => {
                    await this.uiManager.runShipTransactionAnimation(shipId);
                    await this.simulationService.buyShip(shipId, { target });
                    this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.BUY_SHIP });
                });
                break;
            }
            case ACTION_IDS.SELL_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();

                const target = e.target;

                this.uiManager.showShipTransactionConfirmation(shipId, 'sell', async () => {
                    await this.uiManager.runShipTransactionAnimation(shipId);
                    await this.simulationService.sellShip(shipId, { target });
                });
                break;
            }
            case ACTION_IDS.SELECT_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation(); 
                await this.simulationService.boardShip(shipId, e); 
                break;
            }

            // --- VIRTUAL WORKBENCH: SERVICES NAVIGATION (PHASE 1) ---
            case 'set-services-tab': {
                const tabId = dataset.target;
                if (tabId && (tabId === 'supply' || tabId === 'tuning' || tabId === 'station')) {
                    this.gameState.setState({
                        uiState: {
                            ...state.uiState,
                            servicesTab: tabId
                        }
                    });
                }
                break;
            }
            // --- END VIRTUAL WORKBENCH ---

            // --- [[NEW]] SOL STATION ACTIONS (Phase 4) ---
            case 'sol-set-mode':
                if (dataset.mode) {
                    this.uiManager.solStationControl.handleSetMode(dataset.mode);
                }
                break;
            case 'sol-donate':
                if (dataset.goodId) {
                    this.uiManager.solStationControl.handleDonate(dataset.goodId, e);
                }
                break;
            case 'sol-harvest':
                this.uiManager.solStationControl.handleHarvest(e);
                break;
            case 'sol-open-roster':
                this.uiManager.solStationControl.showRosterModal();
                break;
            case 'sol-open-caches': // [[NEW]]
                this.uiManager.solStationControl.showCachesModal();
                break;
            case 'sol-assign':
                if (dataset.officerId) {
                    this.uiManager.solStationControl.handleAssignOfficer(dataset.officerId);
                }
                break;
            case 'sol-unassign':
                if (dataset.slot) {
                    this.uiManager.solStationControl.handleUnassignOfficer(parseInt(dataset.slot));
                }
                break;
            // --- END SOL STATION ACTIONS ---

            // --- VIRTUAL WORKBENCH: PHASE 5 (UPGRADE INSTALLATION) ---
            case 'install_upgrade': {
                const { upgradeId } = dataset;
                if (!upgradeId) return;
                
                const upgradeDef = GameAttributes.getDefinition(upgradeId);
                const player = this.gameState.player;
                const activeShipId = player.activeShipId;
                const activeShipStatic = DB.SHIPS[activeShipId];
                const shipState = player.shipStates[activeShipId];

                const hardwareCost = upgradeDef.value;
                const laborFee = GameAttributes.getInstallationFee(activeShipStatic ? activeShipStatic.price : 0);
                const totalCost = hardwareCost + laborFee;

                if (player.credits < totalCost) {
                    this.uiManager.queueModal('event-modal', 'Insufficient Funds', 'You cannot afford this upgrade and installation fee.');
                    return;
                }

                this.uiManager.showUpgradeInstallationModal(upgradeId, hardwareCost, laborFee, shipState, (replaceIndex) => {
                    
                    if (totalCost > 0) {
                        this.gameState.player.credits -= totalCost;
                        this.uiManager.createFloatingText(`-${formatCredits(totalCost, false)}`, e.clientX, e.clientY, '#f87171');
                    }

                    if (replaceIndex !== -1) {
                        shipState.upgrades.splice(replaceIndex, 1);
                    }

                    this.simulationService.playerActionService.executeInstallUpgrade(activeShipId, upgradeId);

                    this.gameState.uiState.hangarShipyardToggleState = 'hangar';
                    
                    const shipIndex = this.gameState.player.ownedShipIds.indexOf(activeShipId);
                    this.gameState.uiState.hangarActiveIndex = shipIndex !== -1 ? shipIndex : 0;
                    
                    this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
                });
                break;
            }
            
            case 'show_ship_lore': {
                const isHangarMode = state.uiState.hangarShipyardToggleState === 'hangar';
                const currentIndex = isHangarMode ? (state.uiState.hangarActiveIndex || 0) : (state.uiState.shipyardActiveIndex || 0);
                
                let shipId;
                if (isHangarMode) {
                    const shipList = state.player.ownedShipIds;
                    shipId = shipList[currentIndex] || shipList[0];
                } else {
                    const inventory = this.simulationService._getShipyardInventory();
                    if (inventory && inventory.length > 0) {
                        const safeIndex = Math.min(currentIndex, inventory.length - 1);
                        const shipData = inventory[safeIndex];
                        shipId = shipData ? shipData[0] : null;
                    }
                }

                if (shipId && DB.SHIPS[shipId]) {
                    const ship = DB.SHIPS[shipId];
                    const content = `
                        <div class="ship-lore-modal-wrapper">
                            <div class="ship-lore-text">
                                ${ship.lore || ship.description}
                            </div>
                        </div>
                    `;
                    this.uiManager.queueModal('event-modal', ship.name, content, null, {
                        dismissInside: true,
                        dismissOutside: true,
                        footer: null, 
                        contentClass: 'text-left' 
                    });
                }
                break;
            }
    
            case ACTION_IDS.TOGGLE_HANGAR_MODE:
                this.uiManager.hideGenericTooltip(); 
                if (dataset.mode && this.gameState.uiState.hangarShipyardToggleState !== dataset.mode) {
                    this.gameState.uiState.hangarShipyardToggleState = dataset.mode;
                    this.gameState.setState({});
                }
                break;
            case ACTION_IDS.SET_HANGAR_PAGE: {
                const isHangarMode = this.gameState.uiState.hangarShipyardToggleState === 'hangar';
                const currentIndex = isHangarMode ? this.gameState.uiState.hangarActiveIndex : this.gameState.uiState.shipyardActiveIndex;
                const shipList = isHangarMode ? state.player.ownedShipIds : this.simulationService._getShipyardInventory();
                const totalItems = shipList.length;

                let newIndex;
                const JUMP_DISTANCE = 5; 

                if (dataset.jumpDirection) {
                    if (dataset.jumpDirection === 'next') {
                        newIndex = Math.min(totalItems - 1, currentIndex + JUMP_DISTANCE);
                    } else { 
                        newIndex = Math.max(0, currentIndex - JUMP_DISTANCE);
                    }
                } else {
                    newIndex = parseInt(dataset.index, 10);
                }

                if (isNaN(newIndex)) return;

                const carousel = document.getElementById('hangar-carousel');
                if (carousel) {
                    const pagesToSkip = Math.abs(newIndex - currentIndex);
                    const duration = Math.min(0.8, 0.2 + pagesToSkip * 0.1);
                    carousel.style.transitionDuration = `${duration}s`;

                    this.simulationService.setHangarCarouselIndex(newIndex, isHangarMode ? 'hangar' : 'shipyard');

                    setTimeout(() => {
                        if (carousel) carousel.style.transitionDuration = '';
                    }, duration * 1000);
                } else {
                    this.simulationService.setHangarCarouselIndex(newIndex, isHangarMode ? 'hangar' : 'shipyard');
                }
                break;
            }

            case ACTION_IDS.SET_SCREEN: {
                this.uiManager.hideGenericTooltip(); 
                const isSubNavClick = e.target.tagName === 'A' && actionTarget.contains(e.target);

                if (dataset.navId === state.activeNav && !isSubNavClick) {
                    this.gameState.subNavCollapsed = !this.gameState.subNavCollapsed;
                    this.uiManager.render(this.gameState.getState());
                } else {
                    this.gameState.subNavCollapsed = false;
                    this.simulationService.setScreen(dataset.navId, dataset.screenId);
                }
                actionData = { type: 'ACTION', action: ACTION_IDS.SET_SCREEN, navId: dataset.navId, screenId: dataset.screenId };
                break;
            }
            case ACTION_IDS.TRAVEL:
                this.uiManager.hideModal('launch-modal');
                this.simulationService.travelTo(dataset.locationId);
                actionData = { type: 'ACTION', action: ACTION_IDS.TRAVEL };
                break;

            case 'navigate-to-poi': {
                const { locationId } = dataset;
                if (!locationId) return;

                this.uiManager.hideMapDetailModal();
                this.simulationService.setScreen(NAV_IDS.SHIP, SCREEN_IDS.NAVIGATION);

                setTimeout(() => {
                    this.uiManager.showLaunchModal(locationId);
                }, 100);
                
                break;
            }

            case 'set-intel-tab':
                this.uiManager.handleSetIntelTab(actionTarget);
                break;
            case 'show_intel_offer':
                this.uiManager.handleShowIntelOffer(actionTarget);
                break;
            case 'buy_intel':
                this.uiManager.handleBuyIntel(actionTarget, e);
                break;
            case 'show_intel_details':
                this.uiManager.handleShowIntelDetails(actionTarget);
                break;

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
            case 'show-map-modal':
                this.uiManager.showMapDetailModal(dataset.locationId);
                break;
            case 'close-map-modal':
                this.uiManager.hideMapDetailModal();
                break;
            
            case 'show_eula_modal':
                e.preventDefault();
                this.uiManager.showEulaModal();
                break;

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

            case ACTION_IDS.PAY_DEBT:
                this.simulationService.payOffDebt(e);
                break;
            case ACTION_IDS.TAKE_LOAN:
                this.simulationService.takeLoan(JSON.parse(dataset.loanDetails), e);
                break;
            case ACTION_IDS.PURCHASE_INTEL:
                // Deprecated
                break;
            case ACTION_IDS.ACQUIRE_LICENSE:
                this._handleAcquireLicense(dataset.licenseId, e);
                break;

            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                if (dataset.goodId) {
                    this.gameState.uiState.marketCardMinimized[dataset.goodId] = !this.gameState.uiState.marketCardMinimized[dataset.goodId];
                    this.gameState.setState({});
                }
                break;
        }

        if (actionData) {
            this.tutorialService.checkState(actionData);
        }
    }

    _handleAcquireLicense(licenseId, e) {
        const license = DB.LICENSES[licenseId];
        if (!license) return;

        if (license.type === 'purchase') {
            const description = `${license.description}<br><br>Cost: <span class="text-glow-red">${formatCredits(-license.cost, true)}</span>`;
            this.uiManager.queueModal('event-modal', `Purchase ${license.name}?`, description, null, {
                dismissOutside: true,
                customSetup: (modal, closeHandler) => {
                    const btnContainer = modal.querySelector('#event-button-container');
                    btnContainer.innerHTML = `
                        <button id="confirm-license-purchase" class="btn btn-pulse-green">Confirm</button>
                        <button id="cancel-license-purchase" class="btn">Cancel</button>
                    `;
                    modal.querySelector('#confirm-license-purchase').onclick = () => {
                        const result = this.simulationService.purchaseLicense(licenseId);

                        if (result.success) {
                            if (e) {
                                this.uiManager.createFloatingText(`-${formatCredits(license.cost, false)}`, e.clientX, e.clientY, '#f87171');
                            }
                        } else if (result.error === 'INSUFFICIENT_FUNDS') {
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
}