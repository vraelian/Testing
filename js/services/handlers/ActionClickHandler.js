// js/services/handlers/ActionClickHandler.js
/**
 * @fileoverview Handles the primary routing of 'data-action' click events,
 * delegating them to the appropriate services. This module focuses on general
 * actions like navigation, modal triggers, and simple state changes, while
 * more complex interactions are handled by other specialized handlers.
 */
import { DB } from '../../data/database.js';
import { ACTION_IDS, NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { formatCredits } from '../../utils.js'; // Added missing import

export class ActionClickHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(gameState, simulationService, uiManager /* REMOVED, tutorialService */) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        // this.tutorialService = tutorialService; // REMOVED
    }

    /**
     * Handles a delegated click event if it matches a data-action.
     * @param {Event} e The click event object.
     * @param {HTMLElement} actionTarget The DOM element with the data-action attribute.
     */
    handle(e, actionTarget) {
        const state = this.gameState.getState();
        if (actionTarget.hasAttribute('disabled')) return;

        const { action, ...dataset } = actionTarget.dataset;
        // let actionData = null; // REMOVED For the TutorialService

        switch (action) {
            // --- Ship Actions (Hangar/Shipyard) ---
            case ACTION_IDS.BUY_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();
                this.simulationService.buyShip(shipId, e);
                // actionData = { type: 'ACTION', action: ACTION_IDS.BUY_SHIP }; // REMOVED
                break;
            }
            case ACTION_IDS.SELL_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();
                this.simulationService.sellShip(shipId, e);
                break;
            }
            case ACTION_IDS.SELECT_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                this.simulationService.setActiveShip(shipId);
                // actionData = { type: 'ACTION', action: ACTION_IDS.SELECT_SHIP }; // REMOVED
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
                const isHangarMode = this.gameState.uiState.hangarShipyardToggleState === 'hangar';
                const currentIndex = isHangarMode ? this.gameState.uiState.hangarActiveIndex : this.gameState.uiState.shipyardActiveIndex;
                const shipList = isHangarMode ? state.player.ownedShipIds : this.simulationService._getShipyardInventory();
                const totalItems = shipList.length;

                let newIndex;
                const JUMP_DISTANCE = 5; // How many pages to jump with half-dots

                if (dataset.jumpDirection) {
                    if (dataset.jumpDirection === 'next') {
                        newIndex = Math.min(totalItems - 1, currentIndex + JUMP_DISTANCE);
                    } else { // 'prev'
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

            // --- Navigation & Screen Changes ---
            case ACTION_IDS.SET_SCREEN:
                if (dataset.navId === state.activeNav && actionTarget.tagName === 'DIV') {
                    this.gameState.subNavCollapsed = !this.gameState.subNavCollapsed;
                    this.uiManager.render(this.gameState.getState());
                } else {
                    this.gameState.subNavCollapsed = false;
                    this.simulationService.setScreen(dataset.navId, dataset.screenId);
                }
                // actionData = { type: 'ACTION', action: ACTION_IDS.SET_SCREEN, navId: dataset.navId, screenId: dataset.screenId }; // REMOVED
                break;
            case ACTION_IDS.TRAVEL:
                this.uiManager.hideModal('launch-modal');
                this.simulationService.travelTo(dataset.locationId);
                // actionData = { type: 'ACTION', action: ACTION_IDS.TRAVEL }; // REMOVED
                break;

            // --- Modals ---
            case 'show-mission-modal':
                this.uiManager.showMissionModal(dataset.missionId);
                // actionData = { type: 'ACTION', action: 'show-mission-modal' }; // REMOVED
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

            // --- Mission Actions ---
            case 'accept-mission':
                this.simulationService.missionService.acceptMission(dataset.missionId);
                this.uiManager.hideModal('mission-modal');
                // actionData = { type: 'ACTION', action: 'accept-mission', missionId: dataset.missionId }; // REMOVED
                break;
            case 'abandon-mission':
                this.simulationService.missionService.abandonMission();
                this.uiManager.hideModal('mission-modal');
                break;
            case 'complete-mission':
                this.simulationService.missionService.completeActiveMission();
                this.uiManager.hideModal('mission-modal');
                // actionData = { type: 'ACTION', action: 'complete-mission' }; // REMOVED
                break;

            // --- Finance & Licenses ---
            case ACTION_IDS.PAY_DEBT:
                this.simulationService.payOffDebt();
                break;
            case ACTION_IDS.TAKE_LOAN:
                this.simulationService.takeLoan(JSON.parse(dataset.loanDetails));
                break;
            case ACTION_IDS.PURCHASE_INTEL:
                this.simulationService.purchaseIntel(parseInt(dataset.cost));
                break;
            case ACTION_IDS.ACQUIRE_LICENSE:
                this._handleAcquireLicense(dataset.licenseId);
                break;

            // --- Market Card Minimization ---
            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                if (dataset.goodId) {
                    this.gameState.uiState.marketCardMinimized[dataset.goodId] = !this.gameState.uiState.marketCardMinimized[dataset.goodId];
                    this.gameState.setState({});
                }
                break;
        }

        // REMOVED tutorial check
        // if (actionData) {
        //     this.tutorialService.checkState(actionData);
        // }
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
}