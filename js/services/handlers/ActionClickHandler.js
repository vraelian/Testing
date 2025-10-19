// js/services/handlers/ActionClickHandler.js
import { ACTION_IDS, SCREEN_IDS, NAV_IDS, SHIP_IDS } from '../../data/constants.js';

/**
 * @fileoverview
 * This file centralizes all 'data-action' click event handling.
 * It maps action IDs from clicked DOM elements to specific game state changes
 * or service calls.
 *
 * @class ActionClickHandler
 * @description
 * Static class that provides a centralized handler for all click events
 * decorated with a `data-action` attribute. This delegates tasks to the
 * appropriate services (like PlayerActionService, TravelService, etc.)
 * based on the action ID.
 */
export class ActionClickHandler {
    /**
     * Initializes the click handler with necessary services and game state.
     * @param {object} services - An object containing all injected services (PlayerActionService, TravelService, etc.).
     * @param {GameState} gameState - The main game state object.
     * @param {UIManager} uiManager - The UI manager instance.
     * @param {TutorialService} tutorialService - The tutorial service instance.
     */
    constructor({ playerActionService, travelService, missionService, tutorialService, loggingService }, gameState, uiManager) {
        this.playerActionService = playerActionService;
        this.travelService = travelService;
        this.missionService = missionService;
        this.tutorialService = tutorialService;
        this.loggingService = loggingService;
        this.gameState = gameState;
        this.uiManager = uiManager;
    }

    /**
     * The primary handler for all delegated click events.
     * It reads the `data-action` attribute from the clicked element
     * and executes the corresponding game logic.
     * @param {Event} event - The click event object.
     */
    handleActionClick(event) {
        const action = event.target.dataset.action;
        if (!action) return;

        // Stop propagation for nested actions if necessary
        event.stopPropagation();

        // Check for tutorial locks
        if (this.tutorialService.isActionLocked(action, event.target)) {
            console.warn(`Action "${action}" is locked by tutorial.`);
            this.tutorialService.showLockedActionToast(action);
            return;
        }

        const goodId = event.target.dataset.goodId;
        const locationId = event.target.dataset.locationId;
        const shipId = event.target.dataset.shipId;

        switch (action) {
            // --- Navigation ---
            case ACTION_IDS.NAV_SHIP:
                this.gameState.setState({ activeNav: NAV_IDS.SHIP, activeScreen: this.gameState.lastActiveScreen[NAV_IDS.SHIP] });
                break;
            case ACTION_IDS.NAV_STARPORT:
                this.gameState.setState({ activeNav: NAV_IDS.STARPORT, activeScreen: this.gameState.lastActiveScreen[NAV_IDS.STARPORT] });
                break;
            case ACTION_IDS.NAV_DATA:
                this.gameState.setState({ activeNav: NAV_IDS.DATA, activeScreen: this.gameState.lastActiveScreen[NAV_IDS.DATA] });
                break;

            // --- Sub-Navigation ---
            case ACTION_IDS.SCREEN_MAP:
                this.gameState.setState({ activeScreen: SCREEN_IDS.MAP });
                this.gameState.lastActiveScreen[NAV_IDS.SHIP] = SCREEN_IDS.MAP;
                break;
            case ACTION_IDS.SCREEN_CARGO:
                this.gameState.setState({ activeScreen: SCREEN_IDS.CARGO });
                this.gameState.lastActiveScreen[NAV_IDS.SHIP] = SCREEN_IDS.CARGO;
                break;
            case ACTION_IDS.SCREEN_NAV:
                this.gameState.setState({ activeScreen: SCREEN_IDS.NAVIGATION });
                this.gameState.lastActiveScreen[NAV_IDS.SHIP] = SCREEN_IDS.NAVIGATION;
                break;
            case ACTION_IDS.SCREEN_MARKET:
                this.gameState.setState({ activeScreen: SCREEN_IDS.MARKET });
                this.gameState.lastActiveScreen[NAV_IDS.STARPORT] = SCREEN_IDS.MARKET;
                break;
            case ACTION_IDS.SCREEN_SERVICES:
                this.gameState.setState({ activeScreen: SCREEN_IDS.SERVICES });
                this.gameState.lastActiveScreen[NAV_IDS.STARPORT] = SCREEN_IDS.SERVICES;
                break;
            case ACTION_IDS.SCREEN_HANGAR:
                this.gameState.setState({ activeScreen: SCREEN_IDS.HANGAR });
                this.gameState.lastActiveScreen[NAV_IDS.STARPORT] = SCREEN_IDS.HANGAR;
                break;
            case ACTION_IDS.SCREEN_MISSIONS:
                this.gameState.setState({ activeScreen: SCREEN_IDS.MISSIONS });
                this.gameState.lastActiveScreen[NAV_IDS.DATA] = SCREEN_IDS.MISSIONS;
                break;
            case ACTION_IDS.SCREEN_INTEL:
                this.gameState.setState({ activeScreen: SCREEN_IDS.INTEL });
                this.gameState.lastActiveScreen[NAV_IDS.DATA] = SCREEN_IDS.INTEL;
                break;
            case ACTION_IDS.SCREEN_FINANCE:
                this.gameState.setState({ activeScreen: SCREEN_IDS.FINANCE });
                this.gameState.lastActiveScreen[NAV_IDS.DATA] = SCREEN_IDS.FINANCE;
                break;
            
            // --- Hangar / Shipyard Pager ---
            case ACTION_IDS.HANGAR_PAGE_SHIPYARD:
                if (this.gameState.uiState.hangarShipyardToggleState !== 'shipyard') {
                    this.gameState.setState({ uiState: { ...this.gameState.uiState, hangarShipyardToggleState: 'shipyard' } });
                }
                break;
            case ACTION_IDS.HANGAR_PAGE_HANGAR:
                 if (this.gameState.uiState.hangarShipyardToggleState !== 'hangar') {
                    this.gameState.setState({ uiState: { ...this.gameState.uiState, hangarShipyardToggleState: 'hangar' } });
                }
                break;

            // --- [[START]] Market Pager ---
            case 'market-page-materials':
                if (this.gameState.uiState.marketSubScreen !== 'materials') {
                    this.gameState.setState({ uiState: { ...this.gameState.uiState, marketSubScreen: 'materials' } });
                }
                break;
            case 'market-page-commodities':
                if (this.gameState.uiState.marketSubScreen !== 'commodities') {
                    this.gameState.setState({ uiState: { ...this.gameState.uiState, marketSubScreen: 'commodities' } });
                }
                break;
            // --- [[END]] Market Pager ---

            // --- Travel ---
            case ACTION_IDS.TRAVEL_TO:
                this.travelService.initiateTravel(locationId);
                break;
            case ACTION_IDS.CANCEL_TRAVEL:
                this.travelService.cancelTravel();
                break;

            // --- Market ---
            case ACTION_IDS.TOGGLE_TRADE_MODE:
                this.uiManager.marketEventHandler.toggleTradeMode(goodId);
                break;
            case ACTION_IDS.CONFIRM_TRADE:
                this.uiManager.marketEventHandler.confirmTrade(goodId);
                break;
            case ACTION_IDS.SET_MAX_TRADE:
                this.uiManager.marketEventHandler.setMax(goodId);
                break;
            case ACTION_IDS.DECREMENT:
                this.uiManager.marketEventHandler.decrement(goodId);
                break;
            case ACTION_IDS.INCREMENT:
                this.uiManager.marketEventHandler.increment(goodId);
                break;
            case ACTION_IDS.ACQUIRE_LICENSE:
                const licenseId = event.target.dataset.licenseId;
                this.playerActionService.acquireLicense(licenseId);
                break;
            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                this.uiManager.toggleMarketCardView(goodId);
                break;

            // --- Ship Actions ---
            case ACTION_IDS.REPAIR_SHIP:
                this.playerActionService.repairShip(shipId);
                break;
            case ACTION_IDS.REFILL_FUEL:
                this.playerActionService.refillFuel(shipId);
                break;
            case ACTION_IDS.BUY_SHIP:
                this.playerActionService.buyShip(shipId);
                break;
            case ACTION_IDS.SELL_SHIP:
                this.playerActionService.sellShip(shipId);
                break;
            case ACTION_IDS.SET_ACTIVE_SHIP:
                this.playerActionService.setActiveShip(shipId);
                break;

            // --- Finance ---
            case ACTION_IDS.PAY_LOAN:
                this.playerActionService.payLoan();
                break;

            // --- Missions ---
            case ACTION_IDS.ACCEPT_MISSION:
                const missionId = event.target.dataset.missionId;
                this.missionService.acceptMission(missionId);
                break;
            case ACTION_IDS.ABANDON_MISSION:
                this.missionService.abandonMission();
                break;
            case ACTION_IDS.COMPLETE_MISSION:
                this.missionService.completeMission();
                break;
            
            // --- Intel ---
            case ACTION_IDS.BUY_INTEL:
                const intelId = event.target.dataset.intelId;
                this.playerActionService.buyIntel(intelId);
                break;
                
            // --- Tutorial ---
            case ACTION_IDS.TUTORIAL_NEXT_STEP:
                this.tutorialService.nextStep();
                break;
            case ACTION_IDS.TUTORIAL_SKIP_BATCH:
                this.tutorialService.skipTutorialBatch();
                break;
            case ACTION_IDS.TUTORIAL_CLOSE_TOAST:
                this.tutorialService.closeTutorialToast();
                break;

            // --- Modals / Popups ---
            case ACTION_IDS.POPUP_CLOSE:
                this.uiManager.closeAnyModal();
                break;
            case ACTION_IDS.POPUP_CONFIRM:
                this.uiManager.confirmModal();
                break;
            case ACTION_IDS.SHOW_PRICE_GRAPH:
                this.uiManager.showPriceGraph(goodId);
                break;

            // --- Debug ---
            case 'debug-day-plus-1':
                this.loggingService.log('DEBUG: Day +1');
                this.gameState.setState({ day: this.gameState.day + 1 });
                break;
            case 'debug-credits-plus-10k':
                this.loggingService.log('DEBUG: Credits +10k');
                this.gameState.setState({ player: { ...this.gameState.player, credits: this.gameState.player.credits + 10000 } });
                break;
            case 'debug-fuel-minus-10':
                {
                    this.loggingService.log('DEBUG: Fuel -10');
                    const activeShipId = this.gameState.player.activeShipId;
                    const shipState = this.gameState.player.shipStates[activeShipId];
                    const newFuel = Math.max(0, shipState.fuel - 10);
                    this.playerActionService.updateShipState(activeShipId, { fuel: newFuel });
                }
                break;
            case 'debug-health-minus-10':
                {
                    this.loggingService.log('DEBUG: Health -10');
                    const activeShipId = this.gameState.player.activeShipId;
                    const shipState = this.gameState.player.shipStates[activeShipId];
                    const newHealth = Math.max(0, shipState.health - 10);
                    this.playerActionService.updateShipState(activeShipId, { health: newHealth });
                }
                break;
            case 'debug-add-plasteel':
                {
                    this.loggingService.log('DEBUG: Add 10 Plasteel');
                    const inv = this.gameState.player.inventories[this.gameState.player.activeShipId];
                    const newQty = (inv['plasteel']?.quantity || 0) + 10;
                    this.playerActionService.updateCargo('plasteel', newQty, 100);
                }
                break;
            case 'debug-toggle-intro':
                this.loggingService.log('DEBUG: Toggle Intro');
                this.gameState.setState({ introSequenceActive: !this.gameState.introSequenceActive });
                break;
            case 'debug-trigger-event':
                this.loggingService.log('DEBUG: Trigger Event');
                this.uiManager.eventManager.triggerRandomEvent(true); // true = force event
                break;
            case 'debug-next-mission':
                this.loggingService.log('DEBUG: Force Next Mission');
                this.missionService.debugForceNextMission();
                break;
            default:
                console.warn(`Unhandled action: ${action}`);
        }
    }
}