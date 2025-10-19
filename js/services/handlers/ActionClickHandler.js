// js/services/handlers/ActionClickHandler.js
/**
 * @fileoverview Handles general delegated click events based on data-action attributes.
 * Routes actions to the appropriate SimulationService or UIManager method.
 */
import { ACTION_IDS, SCREEN_IDS } from '../../data/constants.js';
import { DB } from '../../data/database.js';

export class ActionClickHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState - The game state instance.
     * @param {import('../SimulationService.js').SimulationService} simulationService - The simulation service facade.
     * @param {import('../UIManager.js').UIManager} uiManager - The UI manager instance.
     * @param {import('../TutorialService.js').TutorialService} tutorialService - The tutorial service instance.
     */
    constructor(gameState, simulationService, uiManager, tutorialService) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
    }

    /**
     * Handles delegated click events on elements with data-action attributes.
     * @param {Event} event - The click event object.
     * @param {HTMLElement} target - The element that was clicked.
     */
    handle(event, target) {
        const action = target.dataset.action;
        const navId = target.dataset.navId;
        const screenId = target.dataset.screenId;
        const locationId = target.dataset.locationId;
        const shipId = target.dataset.shipId;
        const licenseId = target.dataset.licenseId;

        switch (action) {
            case ACTION_IDS.SET_SCREEN:
                if (navId && screenId) {
                    this.simulationService.setScreen(navId, screenId);
                }
                break;
            case ACTION_IDS.TRAVEL:
                if (locationId) {
                    this.simulationService.travelTo(locationId);
                    if (this.gameState.tutorials.activeBatchId === 'intro_missions' && this.gameState.tutorials.activeStepId === 'mission_1_6' && locationId === 'loc_luna') {
                       this.tutorialService.checkState({ type: 'ACTION', action: 'travel' });
                    }
                }
                break;
            case ACTION_IDS.BUY_SHIP:
                if (shipId) {
                    this.simulationService.buyShip(shipId, event);
                }
                break;
            case ACTION_IDS.SELL_SHIP:
                if (shipId) {
                    this.simulationService.sellShip(shipId, event);
                }
                break;
            case ACTION_IDS.SELECT_SHIP:
                if (shipId) {
                    this.simulationService.setActiveShip(shipId);
                }
                break;
            case ACTION_IDS.PAY_DEBT:
                this.simulationService.payOffDebt();
                break;
            case ACTION_IDS.TAKE_LOAN:
                 const loanData = JSON.parse(target.dataset.loan);
                 this.simulationService.takeLoan(loanData);
                break;
            case ACTION_IDS.PURCHASE_INTEL:
                 const intelCost = parseInt(target.dataset.cost);
                 this.simulationService.purchaseIntel(intelCost);
                break;
            case ACTION_IDS.ACQUIRE_LICENSE:
                if (licenseId) {
                    const license = DB.LICENSES[licenseId];
                    if (license && license.type === 'purchase') {
                        this.simulationService.purchaseLicense(licenseId);
                    } else if (license && license.type === 'mission') {
                         this.uiManager.queueModal('event-modal', "License Unavailable", license.guidanceText || `This license is granted via mission completion.`);
                    }
                }
                break;
            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                const goodId = target.dataset.goodId;
                if (goodId) {
                    this.simulationService.toggleMarketCardView(goodId);
                }
                break;
            case ACTION_IDS.TOGGLE_HANGAR_MODE:
                const mode = target.dataset.mode;
                if (mode) {
                    this.simulationService.setHangarShipyardMode(mode);
                }
                break;
            case ACTION_IDS.SET_HANGAR_PAGE:
                const direction = target.dataset.direction;
                if (direction) {
                    this.simulationService.setHangarPage(direction);
                }
                break;

            // --- [[START]] Added for Metal Update V1 ---
            case 'market-page-materials':
                if (this.gameState.uiState.marketSubScreen !== 'materials') {
                    this.gameState.uiState.marketSubScreen = 'materials';
                    this.gameState.setState({}); // Notify UIManager to update pager/carousel
                }
                break;
            case 'market-page-commodities':
                if (this.gameState.uiState.marketSubScreen !== 'commodities') {
                    this.gameState.uiState.marketSubScreen = 'commodities';
                    this.gameState.setState({}); // Notify UIManager to update pager/carousel
                }
                break;
            // --- [[END]] Added for Metal Update V1 ---

            // Tutorial specific actions
            case 'next-tutorial-step':
                this.tutorialService.advanceStep();
                break;
            case 'skip-tutorial-batch':
                this.tutorialService.skipBatch();
                break;
            case 'accept-mission': // Tutorial specific interception
                 const missionId = target.dataset.missionId;
                 if (this.gameState.tutorials.activeBatchId === 'intro_missions') {
                    if (missionId === 'mission_tutorial_01' && this.gameState.tutorials.activeStepId === 'mission_1_3') {
                        this.simulationService.missionService.acceptMission(missionId);
                        this.tutorialService.checkState({ type: 'ACTION', action: 'accept-mission' });
                    } else if (missionId === 'mission_tutorial_02' && this.gameState.tutorials.activeStepId === 'mission_2_4') {
                         this.simulationService.missionService.acceptMission(missionId);
                         this.tutorialService.checkState({ type: 'ACTION', action: 'accept-mission', missionId: 'mission_tutorial_02' });
                    } else {
                        // Regular mission accept if not the specific tutorial step
                         this.simulationService.missionService.acceptMission(missionId);
                    }
                 } else {
                    this.simulationService.missionService.acceptMission(missionId);
                 }
                break;
            case 'complete-mission': // Tutorial specific interception
                if (this.gameState.tutorials.activeBatchId === 'intro_missions') {
                    if (this.gameState.tutorials.activeStepId === 'mission_1_7' && this.gameState.missions.activeMissionId === 'mission_tutorial_01') {
                        this.simulationService.missionService.completeActiveMission();
                        this.tutorialService.checkState({ type: 'ACTION', action: 'complete-mission' });
                    } else if (this.gameState.tutorials.activeStepId === 'mission_3_1' && this.gameState.missions.activeMissionId === 'mission_tutorial_02') {
                        this.simulationService.missionService.completeActiveMission();
                        this.tutorialService.checkState({ type: 'ACTION', action: 'complete-mission', missionId: 'mission_tutorial_02'});
                    } else {
                        this.simulationService.missionService.completeActiveMission();
                    }
                } else {
                     this.simulationService.missionService.completeActiveMission();
                }
                break;
            case 'show-mission-modal': // Tutorial specific interception
                const missionIdToShow = target.dataset.missionId;
                if (this.gameState.tutorials.activeBatchId === 'intro_missions' && this.gameState.tutorials.activeStepId === 'mission_1_2' && missionIdToShow === 'mission_tutorial_01') {
                     this.uiManager.showMissionModal(missionIdToShow);
                     this.tutorialService.checkState({ type: 'ACTION', action: 'show-mission-modal' });
                } else {
                    this.uiManager.showMissionModal(missionIdToShow);
                }
                break;
            // Default: If no specific action matches, log a warning
            default:
                if (action) { // Only log if data-action was present but unhandled
                    console.warn(`ActionClickHandler: Unhandled action "${action}"`);
                }
        }
    }
}