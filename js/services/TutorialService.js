// ./js/services/TutorialService.js
/**
 * @fileoverview This file contains the TutorialService class, which manages the state
 * and flow of all interactive tutorials in the game. It checks for trigger conditions,
 * displays tutorial steps, and locks UI navigation to guide the player.
 */
import { DB } from '../data/database.js';
import { TUTORIAL_ACTION_TYPES, ACTION_IDS, NAV_IDS } from '../data/constants.js';

/**
 * @class TutorialService
 * @description Manages the state and flow of interactive tutorials.
 */
export class TutorialService {
    /**
     * @param {import('./GameState.js').GameState} gameState The game's central state object.
     * @param {import('./UIManager.js').UIManager} uiManager The UI manager for rendering updates.
     * @param {import('./SimulationService.js').SimulationService} simulationService The core game logic simulator.
     * @param {object} navStructure The navigation structure from UIManager, used to map screens to nav tabs.
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, uiManager, simulationService, navStructure, logger) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.simulationService = simulationService;
        this.logger = logger;
        this.activeBatchId = null;
        this.activeStepId = null;

        // Create a map of screenId -> navId for easy lookup when tutorials need to force navigation.
        this.screenToNavMap = {};
        for (const navId in navStructure) {
            for (const screenId in navStructure[navId].screens) {
                this.screenToNavMap[screenId] = navId;
            }
        }
    }

    /**
     * Checks the current game action or state against tutorial triggers and step completion conditions.
     * This is the main entry point for the tutorial system, called after player actions or screen loads.
     * @param {object} [actionData=null] Data about the action that just occurred (e.g., { type: 'ACTION', action: 'buy-ship' }).
     */
    checkState(actionData = null) {
        // If a tutorial is currently active, check if the action completes the current step.
        if (this.activeBatchId && this.activeStepId) {
            const batch = DB.TUTORIAL_DATA[this.activeBatchId];
            const step = batch.steps.find(s => s.stepId === this.activeStepId);

            if (step && this._matchesCondition(step.completion, actionData)) {
                this.advanceStep();
            }
            return;
        }

        // If no tutorial is active, check if the action triggers a new tutorial batch.
        for (const batchId in DB.TUTORIAL_DATA) {
            const batch = DB.TUTORIAL_DATA[batchId];
            const hasBeenSeen = this.gameState.tutorials.seenBatchIds.includes(batchId);
            const isSkipped = this.gameState.tutorials.skippedTutorialBatches.includes(batchId);
            
            if (!hasBeenSeen && !isSkipped) {
                const triggerAction = actionData || { type: TUTORIAL_ACTION_TYPES.SCREEN_LOAD, screenId: this.gameState.activeScreen };
                if (this._matchesCondition(batch.trigger, triggerAction)) {
                    this.triggerBatch(batchId);
                    break;
                }
            }
        }
    }

    /**
     * Starts a specific tutorial batch by its ID.
     * @param {string} batchId The unique identifier of the tutorial batch to start.
     * @param {string|null} [startStepId=null] The ID of a specific step to start from. If null, starts from the beginning.
     */
    triggerBatch(batchId, startStepId = null) {
        if (!DB.TUTORIAL_DATA[batchId]) return;
        const batch = DB.TUTORIAL_DATA[batchId];

        // If the tutorial is triggered by loading a specific screen, navigate to that screen first.
        if (batch.trigger.type === TUTORIAL_ACTION_TYPES.SCREEN_LOAD) {
            const targetScreenId = batch.trigger.screenId;
            if (this.gameState.activeScreen !== targetScreenId) {
                const targetNavId = this.screenToNavMap[targetScreenId];
                if (targetNavId) {
                    this.simulationService.setScreen(targetNavId, targetScreenId);
                }
            }
        }

        this.activeBatchId = batchId;
        this.gameState.tutorials.activeBatchId = batchId;
        
        if (!this.gameState.tutorials.seenBatchIds.includes(batchId)) {
            this.gameState.tutorials.seenBatchIds.push(batchId);
        }

        this.logger.info.system('Tutorial', this.gameState.day, 'TUTORIAL_START', `Starting tutorial batch: ${batchId}`);
        this.gameState.setState(this.gameState);
        this.uiManager.render(this.gameState.getState());
        
        const firstStepId = startStepId || batch.steps[0].stepId;
        this._displayStep(firstStepId);
    }

    /**
     * Skips the currently active tutorial batch, preventing it from triggering again.
     */
    skipActiveTutorial() {
        if (!this.activeBatchId) return;
        if (!this.gameState.tutorials.skippedTutorialBatches.includes(this.activeBatchId)) {
            this.gameState.tutorials.skippedTutorialBatches.push(this.activeBatchId);
        }
        this.logger.info.player(this.gameState.day, 'TUTORIAL_SKIP', `Skipped tutorial: ${this.activeBatchId}`);
        this._endBatch();
        this.gameState.setState(this.gameState);
    }
    
    /**
     * Advances the tutorial to the next step in the current batch, or ends the batch if it's the final step.
     */
    advanceStep() {
        if (!this.activeStepId || !this.activeBatchId) return;

        const batch = DB.TUTORIAL_DATA[this.activeBatchId];
        const currentStep = batch.steps.find(s => s.stepId === this.activeStepId);
        
        this.uiManager.hideTutorialToast();

        if (currentStep && currentStep.nextStepId) {
            this._displayStep(currentStep.nextStepId);
        } else {
            const completedBatchId = this.activeBatchId;
            this._endBatch(); 
            // If the completed tutorial was part of the intro sequence, continue the sequence.
            if (this.gameState.introSequenceActive && completedBatchId?.startsWith('intro_')) {
                this.simulationService._continueIntroSequence(completedBatchId);
            }
        }
    }

    /**
     * Displays a specific tutorial step by its ID and manages UI navigation locks.
     * @param {string} stepId The ID of the step to display.
     * @private
     */
    _displayStep(stepId) {
        if (!this.activeBatchId) return;
        const batch = DB.TUTORIAL_DATA[this.activeBatchId];
        const step = batch.steps.find(s => s.stepId === stepId);
        if (!step) {
            this._endBatch();
            return;
        }

        // Apply navigation lock based on tutorial data.
        if (step.hasOwnProperty('navLock')) {
            // A step can explicitly define its own lock (or null to unlock).
            this.gameState.tutorials.navLock = step.navLock;
        } else if (batch.navLock) {
            // Otherwise, inherit the lock from the parent batch.
            const currentScreenId = this.gameState.activeScreen;
            const currentNavId = this.screenToNavMap[currentScreenId];
            this.gameState.tutorials.navLock = { navId: currentNavId, screenId: currentScreenId };
        } else {
            // Ensure navigation is unlocked if no lock is specified.
            this.gameState.tutorials.navLock = null;
        }

        this.activeStepId = stepId;
        this.gameState.tutorials.activeStepId = stepId;
        this.logger.info.system('Tutorial', this.gameState.day, 'STEP_DISPLAY', `Displaying step: ${stepId}`);
        
        this.uiManager.showTutorialToast({
            step: step,
            onSkip: () => this.uiManager.showSkipTutorialModal(() => this.skipActiveTutorial()),
            onNext: () => this.advanceStep(),
            gameState: this.gameState.getState()
        });
        
        // Re-render to apply navLock changes and any other state updates from advancing the step.
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Cleans up the state when a tutorial batch ends.
     * @private
     */
    _endBatch() {
        this.logger.info.system('Tutorial', this.gameState.day, 'TUTORIAL_END', `Ending tutorial batch: ${this.activeBatchId}`);
        this.uiManager.hideTutorialToast();
        this.activeBatchId = null;
        this.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.navLock = null; // Clear any active navigation lock.
    }

    /**
     * Checks if a player action matches a tutorial step's completion or trigger condition.
     * @param {object|object[]} condition The condition object or array of conditions from the database.
     * @param {object} actionData The action performed by the player.
     * @returns {boolean} True if the condition(s) are met.
     * @private
     */
    _matchesCondition(condition, actionData) {
        if (!condition || !actionData) return false;
        // A condition can be an array of multiple sub-conditions that must all be true.
        if (Array.isArray(condition)) {
            return condition.every(c => this._matchesSingleCondition(c, actionData));
        }
        return this._matchesSingleCondition(condition, actionData);
    }
    
    /**
     * Helper for _matchesCondition to check a single condition object against a player action.
     * @param {object} condition The single condition object.
     * @param {object} actionData The action performed by the player.
     * @returns {boolean} True if the single condition is met.
     * @private
     */
    _matchesSingleCondition(condition, actionData) {
        if (condition.type !== actionData.type) return false;
        switch (condition.type) {
            case TUTORIAL_ACTION_TYPES.SCREEN_LOAD:
                return condition.screenId === actionData.screenId;
            case TUTORIAL_ACTION_TYPES.ACTION:
                if (condition.action === ACTION_IDS.SET_SCREEN && actionData.action === ACTION_IDS.SET_SCREEN) {
                    return condition.navId === actionData.navId && condition.screenId === actionData.screenId;
                }
                return condition.action === actionData.action;
            case TUTORIAL_ACTION_TYPES.INFO:
                return true; // Info steps are always completed by the "Next" button, not a game action.
            default:
                return false;
        }
    }
}