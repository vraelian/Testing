// js/services/EventManager.js
/**
 * @fileoverview
 * The EventManager is the universal input layer for the application.
 * It sets up all global event listeners (click, hover, hold) and delegates
 * the event handling to specialized, context-specific handler modules.
 * This decoupled approach keeps the core logic clean and organized.
 */

import { GameState } from './GameState.js';
import { SimulationService } from './SimulationService.js';
import { UIManager } from './UIManager.js';
import { TutorialService } from './TutorialService.js';
import { DebugService } from './DebugService.js';
import { Logger } from './LoggingService.js';
import { ACTION_IDS } from '../data/constants.js';

// Import all specialized event handlers
import { ActionClickHandler } from './handlers/ActionClickHandler.js';
import { MarketEventHandler } from './handlers/MarketEventHandler.js';
import { HoldEventHandler } from './handlers/HoldEventHandler.js';
import { CarouselEventHandler } from './handlers/CarouselEventHandler.js';
import { TooltipHandler } from './handlers/TooltipHandler.js';

// --- VIRTUAL WORKBENCH: IMPORT TOOLTIPSERVICE ---
import { TooltipService } from './ui/TooltipService.js';
// --- END VIRTUAL WORKBENCH ---

export class EventManager {
    /**
     * @param {GameState} gameState
     * @param {SimulationService} simulationService
     * @param {UIManager} uiManager
     * @param {TutorialService} tutorialService
     * @param {DebugService} debugService
     * @param {Logger} logger
     */
    constructor(gameState, simulationService, uiManager, tutorialService, debugService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
        this.debugService = debugService;
        this.logger = logger;

        // --- VIRTUAL WORKBENCH: INSTANTIATE TOOLTIPSERVICE ---
        /**
         * The dedicated service for managing graph and generic tooltips.
         * @type {TooltipService}
         */
        this.tooltipService = new TooltipService();
        // --- END VIRTUAL WORKBENCH ---

        // Instantiate all specialized handlers
        // These handlers are "stateful" and manage their own internal logic
        // in response to events.
        this.actionClickHandler = new ActionClickHandler(gameState, simulationService, uiManager, tutorialService);
        this.marketEventHandler = new MarketEventHandler(gameState, simulationService, uiManager);
        this.holdEventHandler = new HoldEventHandler(simulationService.playerActionService, uiManager);
        this.carouselEventHandler = new CarouselEventHandler(gameState, simulationService, uiManager);

        // --- VIRTUAL WORKBENCH: INJECT TOOLTIPSERVICE ---
        /**
         * The handler for all hover/click tooltip-related events.
         * It is now injected with the TooltipService, not the UIManager.
         * @type {TooltipHandler}
         */
        this.tooltipHandler = new TooltipHandler(gameState, this.tooltipService);
        // --- END VIRTUAL WORKBENCH ---

        // Bind 'this' context for global listeners
        this._handleClick = this._handleClick.bind(this);
        this._handleMouseOver = this._handleMouseOver.bind(this);
        this._handleMouseOut = this._handleMouseOut.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleInput = this._handleInput.bind(this);

        this.logger.log('EventManager', 'Event Manager initialized.');
    }

    /**
     * Binds all global event listeners to the document.
     * This is the entry point for all user interactions.
     */
    bindEvents() {
        document.addEventListener('click', this._handleClick);
        document.addEventListener('mouseover', this._handleMouseOver);
        document.addEventListener('mouseout', this._handleMouseOut);
        document.addEventListener('keydown', this._handleKeyDown);
        document.addEventListener('input', this._handleInput);

        // Bind "hold" events separately as they need a different capture model
        // See ADR-004
        this.holdEventHandler.bindHoldEvents();

        // Bind carousel drag/swipe events
        this.carouselEventHandler.bindDragEvents();

        this.logger.log('EventManager', 'Global event listeners bound.');
    }

    /**
     * The central delegated click handler for the entire application.
     * @param {Event} e - The native click event.
     * @private
     */
    _handleClick(e) {
        // Find the closest ancestor with a data-action attribute
        const target = e.target.closest('[data-action]');
        if (!target) {
            // Check for modal backdrop click
            const modalId = this.uiManager.getModalIdFromEvent(e);
            if (modalId) {
                this.uiManager.hideModal(modalId);
            }
            return;
        }

        const action = target.dataset.action;
        if (!action) return;

        // Stop propagation for click events to prevent multi-triggering
        e.stopPropagation();

        // Check for tutorial block
        if (this.tutorialService.isBlocked(action, target)) {
            this.logger.warn('EventManager', `Action '${action}' blocked by active tutorial.`);
            this.tutorialService.triggerHint(target);
            return;
        }

        // Delegate to the appropriate handler based on the action
        switch (action) {
            case ACTION_IDS.SHOW_PRICE_GRAPH:
            case ACTION_IDS.SHOW_FINANCE_GRAPH:
            case ACTION_IDS.TOGGLE_TOOLTIP:
                // --- VIRTUAL WORKBENCH: DELEGATE TO TOOLTIPHANDLER ---
                this.tooltipHandler.handleClick(e, target, action);
                // --- END VIRTUAL WORKBENCH ---
                break;

            case ACTION_IDS.TOGGLE_TRADE_MODE:
            case ACTION_IDS.DECREMENT:
            case ACTION_IDS.INCREMENT:
            case ACTION_IDS.CONFIRM_TRADE:
            case ACTION_IDS.SET_MAX_TRADE:
            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                this.marketEventHandler.handleClick(e, target, action);
                break;

            // --- VIRTUAL WORKBENCH: CONSOLIDATE HANDLERS ---
            // Removed carousel-specific cases, now handled by ActionClickHandler
            case ACTION_IDS.SET_SCREEN:
            case ACTION_IDS.SET_HANGAR_PAGE:
            case ACTION_IDS.TOGGLE_HANGAR_MODE:
            case ACTION_IDS.BUY_SHIP:
            case ACTION_IDS.SELL_SHIP:
            case ACTION_IDS.SELECT_SHIP:
            case ACTION_IDS.TRAVEL:
            case ACTION_IDS.SHOW_LAUNCH_MODAL:
            case ACTION_IDS.SHOW_SHIP_DETAIL:
            case ACTION_IDS.ACCEPT_MISSION:
            case ACTION_IDS.ABANDON_MISSION:
            case ACTION_IDS.COMPLETE_MISSION:
            case ACTION_IDS.SHOW_MISSION_MODAL:
            case ACTION_IDS.PAY_DEBT:
            case ACTION_IDS.TAKE_LOAN:
            case ACTION_IDS.ACQUIRE_LICENSE:
            case ACTION_IDS.SHOW_LORE:
            // --- VIRTUAL WORKBENCH: TYPO FIX ---
            case ACTION_IDS.SHOW_EULA: // [[START]] VIRTUAL WORKBENCH (Add EULA Action)
            // --- END VIRTUAL WORKBENCH: TYPO FIX ---
            case ACTION_IDS.SHOW_CARGO_DETAIL:
            case ACTION_IDS.TUTORIAL_SKIP:
            case ACTION_IDS.TUTORIAL_NEXT:
            case ACTION_IDS.TUTORIAL_REPLAY:
            case ACTION_IDS.SET_INTEL_TAB:
            case ACTION_IDS.SHOW_INTEL_OFFER:
            case ACTION_IDS.BUY_INTEL:
            case ACTION_IDS.SHOW_INTEL_DETAILS:
            // --- VIRTUAL WORKBENCH: ADD INTEL HANDLERS ---
                // All other general actions are handled by the ActionClickHandler
                this.actionClickHandler.handle(target);
                break;
            // --- END VIRTUAL WORKBENCH ---

            default:
                this.logger.warn('EventManager', `No handler defined for action: ${action}`);
        }
    }

    /**
     * Central delegated handler for 'mouseover' events.
     * @param {Event} e - The native mouseover event.
     * @private
     */
    _handleMouseOver(e) {
        // --- VIRTUAL WORKBENCH: DELEGATE TO TOOLTIPHANDLER ---
        // Delegate all mouseover logic to the specialized handler
        this.tooltipHandler.handleMouseOver(e);
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Central delegated handler for 'mouseout' events.
     * @param {Event} e - The native mouseout event.
     * @private
     */
    _handleMouseOut(e) {
        // --- VIRTUAL WORKBENCH: DELEGATE TO TOOLTIPHANDLER ---
        // Delegate all mouseout logic to the specialized handler
        this.tooltipHandler.handleMouseOut(e);
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Central delegated handler for 'input' events.
     * @param {Event} e - The native input event.
     * @private
     */
    _handleInput(e) {
        const target = e.target;
        if (!target) return;

        // Check for tutorial block
        if (this.tutorialService.isBlocked('input', target)) {
            this.logger.warn('EventManager', `Input blocked by active tutorial.`);
            // Optionally provide feedback
            return;
        }

        // Delegate to the market handler if it's a quantity input
        if (target.id && target.id.startsWith('qty-')) {
            this.marketEventHandler.handleInput(e, target);
        }
    }

    /**
     * Global keydown handler.
     * @param {KeyboardEvent} e - The native keydown event.
     * @private
     */
    _handleKeyDown(e) {
        // Open/Close Debug Panel
        if (e.key === '`') {
            e.preventDefault();
            this.debugService.togglePanel();
        }
    }
}