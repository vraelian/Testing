// js/services/EventManager.js
/**
 * @fileoverview This file contains the EventManager class, which is responsible for handling all user input
 * for the application. It binds event listeners and delegates the logic to specialized handler modules,
 * acting as the primary bridge between the UI and the game's logic.
 */
import { NAV_IDS, SCREEN_IDS, ACTION_IDS } from '../data/constants.js';

// Import all specialized event handlers
import { ActionClickHandler } from './handlers/ActionClickHandler.js';
import { MarketEventHandler } from './handlers/MarketEventHandler.js';
import { HoldEventHandler } from './handlers/HoldEventHandler.js';
import { CarouselEventHandler } from './handlers/CarouselEventHandler.js';
import { TooltipHandler } from './handlers/TooltipHandler.js';

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

        // Instantiate all specialized handlers
        this.actionClickHandler = new ActionClickHandler(gameState, simulationService, uiManager, tutorialService);
        this.marketEventHandler = new MarketEventHandler(gameState, simulationService, uiManager);
        // MODIFIED: Pass the correct service (playerActionService) to the constructor
        this.holdEventHandler = new HoldEventHandler(this.simulationService.playerActionService, uiManager);
        this.carouselEventHandler = new CarouselEventHandler(gameState, simulationService);
        this.tooltipHandler = new TooltipHandler(gameState, uiManager);
    }

    /**
     * Binds all necessary global event listeners to the document body.
     */
    bindEvents() {
        document.body.addEventListener('click', (e) => this._handleClick(e));
        document.body.addEventListener('dblclick', (e) => e.preventDefault());
        document.body.addEventListener('mouseover', (e) => this.tooltipHandler.handleMouseOver(e));
        document.body.addEventListener('mouseout', (e) => this.tooltipHandler.handleMouseOut(e));
        document.addEventListener('keydown', (e) => this._handleKeyDown(e));
        document.body.addEventListener('input', (e) => this.marketEventHandler.handleInput(e));

        document.body.addEventListener('contextmenu', (e) => e.preventDefault());

        document.body.addEventListener('wheel', (e) => {
            if (e.target.closest('.carousel-container')) {
                e.preventDefault();
                this.carouselEventHandler.handleWheel(e);
            }
        }, { passive: false });

        // --- VIRTUAL WORKBENCH MODIFICATION ---
        // Renamed 'startDragOrHold' to 'startCarouselDrag' for clarity.
        // Added a guard clause to prevent starting a carousel drag
        // when a stepper button is pressed. This allows the HoldEventHandler
        // to manage stepper holds without conflict.
        const startCarouselDrag = (e) => {
            // IGNORE presses on stepper buttons
            if (e.target.closest('.qty-stepper button')) {
                return;
            }
            // Proceed with carousel drag start for all other elements
            this.carouselEventHandler.handleDragStart(e);
        };
        // --- END MODIFICATION ---

        document.body.addEventListener('mousedown', startCarouselDrag);
        document.body.addEventListener('touchstart', (e) => {
            // Prevent default touch actions ONLY for specific hold targets to allow scrolling elsewhere
            // (Note: Steppers are intentionally omitted here to allow 'pointerdown' to fire)
            if (e.target.closest('#refuel-btn') || e.target.closest('#repair-btn') || e.target.closest('.carousel-container')) {
                 e.preventDefault();
            }
            startCarouselDrag(e); // Call the modified start function
        }, { passive: false });

        // MODIFIED: Removed call to non-existent holdEventHandler.handleHoldEnd
        const endDragOrHold = () => {
            this.carouselEventHandler.handleDragEnd();
        };
        document.body.addEventListener('mouseup', endDragOrHold);
        document.body.addEventListener('mouseleave', endDragOrHold);
        document.body.addEventListener('touchend', endDragOrHold);
        document.body.addEventListener('touchcancel', endDragOrHold);

        document.body.addEventListener('mousemove', (e) => this.carouselEventHandler.handleDragMove(e));
        document.body.addEventListener('touchmove', (e) => {
            // Prevent default touchmove ONLY if dragging the carousel
             if (this.carouselEventHandler.state.isDragging) {
                 e.preventDefault();
             }
            this.carouselEventHandler.handleDragMove(e);
        }, { passive: false });


        window.addEventListener('resize', () => this.uiManager.render(this.gameState.getState()));

        if (this.uiManager.cache.missionStickyBar) {
            this.uiManager.cache.missionStickyBar.addEventListener('click', () => {
                this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
            });
        }
    }

    /**
     * Central click handler for the entire application, using event delegation.
     * @param {Event} e The click event object.
     * @private
     */
    _handleClick(e) {
        // Suppress click events that are the result of a drag/swipe on the carousel OR a completed hold on a stepper
        if (this.carouselEventHandler.wasMoved() || this.holdEventHandler.isStepperHolding) {
             // Reset stepper hold flag after suppressing click
             if (this.holdEventHandler.isStepperHolding) {
                 this.holdEventHandler.isStepperHolding = false;
             }
            e.preventDefault();
            return;
        }


        const state = this.gameState.getState();
        const actionTarget = e.target.closest('[data-action]');

        // Always delegate to the tooltip handler for managing popups and cleanup
        this.tooltipHandler.handleClick(e);

        if (actionTarget) {
            const action = actionTarget.dataset.action;

            if (action === ACTION_IDS.DEBUG_SIMPLE_START) {
                if (this.debugService) {
                    this.debugService.simpleStart();
                }
                return;
            }

            // --- New Lore Modal Action ---
            if (action === 'show_lore') {
                e.preventDefault();
                const loreId = actionTarget.dataset.loreId;
                if (loreId) {
                    this.uiManager.showLoreModal(loreId);
                }
                return;
            }

            // Delegate to other handlers
            this.actionClickHandler.handle(e, actionTarget);
            this.marketEventHandler.handleClick(e, actionTarget);
            return;
        }

        // --- Fallback Handlers for non-action clicks ---
        if (state.introSequenceActive && !state.tutorials.activeBatchId) {
            this.simulationService.handleIntroClick(e);
            return;
        }
        if (state.isGameOver) return;

        // Check for modal dismissal clicks
        const modalIdToClose = this.uiManager.getModalIdFromEvent(e);
        if (modalIdToClose) {
            // Note: lore-modal dismissal is handled internally in UIManager.showLoreModal
            // to allow for content-area clicks.
            if (modalIdToClose !== 'lore-modal') {
                this.uiManager.hideModal(modalIdToClose);
            }
        }
    }

    /**
     * Handles keydown events, primarily for debug shortcuts.
     * @param {Event} e The keydown event object.
     * @private
     */
    _handleKeyDown(e) {
        if (this.gameState.isGameOver || e.ctrlKey || e.metaKey) return;
        if ((e.key === '`' || e.key === '&') && this.debugService) {
            this.debugService.toggleVisibility();
        }
    }
}