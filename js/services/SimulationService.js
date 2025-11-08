// js/services/SimulationService.js
/**
 * @fileoverview
 * This is the SimulationService, the core game engine Facade.
 * It is responsible for instantiating and coordinating all specialized sub-services
 * (e.g., MarketService, TravelService, PlayerActionService).
 *
 * It acts as the central point of contact for the EventManager, delegating
 * actions to the appropriate service. It also hosts shared helper methods
 * needed by multiple services.
 *
 * This file was refactored from a "god object" to a lean Facade as per ADR-002.
 */

import { GameState } from './GameState.js';
import { UIManager } from './UIManager.js';
import { Logger } from './LoggingService.js';
import { ACTION_IDS, SCREEN_IDS, NAV_IDS } from '../data/constants.js';
import { DB } from '../data/database.js';

// Import all specialized services
import { MarketService } from './simulation/MarketService.js';
import { TimeService } from './world/TimeService.js';
import { TravelService } from './world/TravelService.js';
import { IntroService } from './game/IntroService.js';
import { PlayerActionService } from './player/PlayerActionService.js';
import { TutorialService } from './TutorialService.js';
import { MissionService } from './MissionService.js';
import { NewsTickerService } from './NewsTickerService.js';
import { IntelService } from './IntelService.js';

// --- VIRTUAL WORKBENCH: IMPORT MODALSERVICE ---
import { ModalService } from './ui/ModalService.js';
// --- END VIRTUAL WORKBENCH ---

export class SimulationService {
    /**
     * @param {GameState} gameState
     * @param {UIManager} uiManager
     * @param {Logger} logger
     * @param {object} services - A container for all instantiated services.
     * @param {import('./DebugService.js').DebugService} debugService
     */
    constructor(gameState, uiManager, logger, services, debugService) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.services = services; // This will be populated by this constructor
        this.debugService = debugService;

        this.logger.log('SimulationService', 'SimulationService constructing...');

        // --- VIRTUAL WORKBENCH: INSTANTIATE MODALSERVICE ---
        /**
         * The dedicated "dumb" service for managing the modal queue.
         * @type {ModalService}
         */
        this.modalService = new ModalService(this.logger);
        // --- END VIRTUAL WORKBENCH ---

        // --- Service Instantiation ---
        // Order matters here to ensure dependencies are available.

        /** @type {MarketService} */
        this.marketService = new MarketService(this.gameState);
        this.services.marketService = this.marketService;

        /** @type {NewsTickerService} */
        this.newsTickerService = new NewsTickerService(this.gameState, DB);
        this.services.newsTickerService = this.newsTickerService;

        // --- VIRTUAL WORKBENCH: INJECT MODALSERVICE INTO INTELSERVICE ---
        /** @type {IntelService} */
        this.intelService = new IntelService(this.gameState, this.marketService, this.newsTickerService, this.modalService, this.logger, DB);
        this.services.intelService = this.intelService;
        // --- END VIRTUAL WORKBENCH ---

        /** @type {TimeService} */
        this.timeService = new TimeService(this.gameState, this.marketService, this.uiManager, this.logger, this, this.intelService);
        this.services.timeService = this.timeService;

        /** @type {TravelService} */
        this.travelService = new TravelService(this.gameState, this.uiManager, this.timeService, this.logger, this);
        this.services.travelService = this.travelService;

        /** @type {MissionService} */
        this.missionService = new MissionService(this.gameState, this.uiManager, this.logger, this);
        this.services.missionService = this.missionService;

        /** @type {PlayerActionService} */
        this.playerActionService = new PlayerActionService(this.gameState, this.uiManager, this.missionService, this.marketService, this.timeService, this.logger, this);
        this.services.playerActionService = this.playerActionService;

        /** @type {IntroService} */
        this.introService = new IntroService(this.gameState, this.uiManager, this.logger, this);
        this.services.introService = this.introService;

        // --- VIRTUAL WORKBENCH: UPDATE TUTORIALSERVICE DEPENDENCIES ---
        /** @type {TutorialService} */
        this.tutorialService = new TutorialService(this.gameState, this, this.logger, this.debugService);
        this.services.tutorialService = this.tutorialService;
        // --- END VIRTUAL WORKBENCH ---

        // --- Inject dependencies into UIManager ---
        this.uiManager.setMissionService(this.missionService);
        this.uiManager.setSimulationService(this);
        this.uiManager.setNewsTickerService(this.newsTickerService);
        this.uiManager.setIntelService(this.intelService); // UIManager needs this for its stub handlers
        this.uiManager.setDebugService(this.debugService);

        // --- Inject dependencies into NewsTickerService ---
        // This is for dynamic message generation (e.g., market status)
        this.newsTickerService.setServices(this.marketService, this);

        this.logger.log('SimulationService', 'All services instantiated and dependencies injected.');
    }

    /**
     * Initializes the game by setting the starting screen.
     */
    initialize() {
        // We defer setting the screen until the intro sequence explicitly asks for it.
        // This prevents a flash of the game UI before the intro modals.
        this.logger.log('SimulationService', 'Simulation initialized.');
    }

    /**
     * Sets the active navigation tab and screen.
     * This is the primary method for changing the view.
     * @param {string} navId - The ID of the main navigation tab (e.g., 'ship').
     * @param {string} screenId - The ID of the screen to display (e.g., 'map').
     */
    setScreen(navId, screenId) {
        const currentState = this.gameState.getState();

        // Prevent navigation if the intro sequence is active (and not on the last step)
        if (currentState.introSequenceActive) {
            this.logger.warn('SimulationService', 'Screen navigation blocked by active intro sequence.');
            return;
        }

        // Prevent navigation if a tutorial lock is active
        const { navLock } = currentState.tutorials;
        if (navLock) {
            if (navLock.navId && navLock.navId !== navId) {
                this.logger.warn('SimulationService', `Navigation to ${navId} blocked by tutorial lock.`);
                return;
            }
            if (navLock.screenId && navLock.screenId !== screenId) {
                this.logger.warn('SimulationService', `Navigation to ${screenId} blocked by tutorial lock.`);
                return;
            }
        }

        const newLastActiveScreen = { ...currentState.lastActiveScreen, [navId]: screenId };

        this.gameState.setState({
            activeNav: navId,
            activeScreen: screenId,
            lastActiveScreen: newLastActiveScreen
        });

        // Notify TutorialService of the navigation change
        this.tutorialService.checkState('nav', { navId, screenId });
    }

    /**
     * Facade method to initiate travel. Delegates to TravelService.
     * @param {string} locationId - The ID of the destination location.
     */
    travelTo(locationId) {
        this.travelService.travelTo(locationId);
    }

    /**
     * Facade method to buy an item. Delegates to PlayerActionService.
     * @param {string} goodId - The ID of the commodity to buy.
     * @param {number} quantity - The amount to buy.
     */
    buyItem(goodId, quantity) {
        this.playerActionService.buyItem(goodId, quantity);
    }

    /**
     * Facade method to sell an item. Delegates to PlayerActionService.
     * @param {string} goodId - The ID of the commodity to sell.
     * @param {number} quantity - The amount to sell.
     */
    sellItem(goodId, quantity) {
        this.playerActionService.sellItem(goodId, quantity);
    }

// --- VIRTUAL WORKBENCH: ADD INTEL STUB ---
    /**
     * Facade method to set the active tab on the Intel screen.
     * @param {string} tabId - The ID of the tab content to show.
     */
    setIntelTab(tabId) {
        this.gameState.setUiState({ activeIntelTab: tabId });
    }
// --- END VIRTUAL WORKBENCH ---

    /**
     * Facade method to push a message to the news ticker.
     * @param {string} message - The text to display.
     * @param {string} type - The message type (e.g., 'SYSTEM', 'FLAVOR').
     * @param {string} [id] - A unique ID to prevent duplicates.
     */
    pushNewsMessage(message, type, id) {
        this.newsTickerService.pushMessage(message, type, id);
    }

    /**
     * Retrieves the shipyard inventory for the current location.
     * This is a helper method used by HangarScreen.js.
     * @returns {Array<[string, number]>} - An array of [shipId, stock] tuples.
     * @private
     */
    _getShipyardInventory() {
        const currentLocationId = this.gameState.getState().currentLocationId;
        const shipyardStock = this.gameState.getState().market.shipyardStock[currentLocationId];
        if (!shipyardStock) return [];

        return Object.entries(shipyardStock).filter(([, stock]) => stock > 0);
    }
}