// ./js/services/TutorialService.js
/**
 * @fileoverview Manages the state and flow of interactive tutorials.
 */
import { TUTORIAL_DATA } from '../data/gamedata.js';
import { TUTORIAL_ACTION_TYPES, ACTION_IDS } from '../data/constants.js';

export class TutorialService {
    /**
     * @param {import('./GameState.js').GameState} gameState The game's state.
     * @param {import('./UIManager.js').UIManager} uiManager The UI manager.
     * @param {import('./SimulationService.js').SimulationService} simulationService The game logic simulator.
     * @param {object} navStructure The navigation structure from UIManager.
     */
    constructor(gameState, uiManager, simulationService, navStructure) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.simulationService = simulationService;
        this.activeBatchId = null;
        this.activeStepId = null;

        // Create a map of screenId -> navId for easy lookup
        this.screenToNavMap = {};
        for (const navId in navStructure) {
            for (const screenId in navStructure[navId].screens) {
                this.screenToNavMap[screenId] = navId;
            }
        }
    }

    /**
     * Checks the current game action or state against tutorial triggers and completion conditions.
     * @param {object} [actionData=null] Data about the action that just occurred.
     */
    checkState(actionData = null) {
        if (this.activeBatchId && this.activeStepId) {
            const batch = TUTORIAL_DATA[this.activeBatchId];
            const step = batch.steps.find(s => s.stepId === this.activeStepId);

            if (step && this._matchesCondition(step.completion, actionData)) {
                this.advanceStep();
            }
            return;
        }

        for (const batchId in TUTORIAL_DATA) {
            const batch = TUTORIAL_DATA[batchId];
            const hasBeenSeen = this.gameState.tutorials.seenBatchIds.includes(batchId);
            const isSkipped = this.gameState.tutorials.skippedTutorialBatches.includes(batchId);
            
            // Allow intro tutorials to trigger even if their screen is already loaded
            const isIntroTutorial = batchId.startsWith('intro_');
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
     * Starts a specific tutorial batch by its ID, optionally from a specific step.
     * @param {string} batchId The ID of the tutorial batch to start.
     * @param {string|null} [startStepId=null] The ID of the step to start from. If null, starts from the beginning.
     */
    triggerBatch(batchId, startStepId = null) {
        if (!TUTORIAL_DATA[batchId]) return;
        const batch = TUTORIAL_DATA[batchId];

        // If the tutorial is triggered by a screen load, switch to that screen
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

        this.gameState.setState(this.gameState);
        this.uiManager.render(this.gameState.getState());
        
        const firstStepId = startStepId || batch.steps[0].stepId;
        this._displayStep(firstStepId);

    }

    /**
     * Skips the currently active tutorial batch.
     */
    skipActiveTutorial() {
        if (!this.activeBatchId) return;
        if (!this.gameState.tutorials.skippedTutorialBatches.includes(this.activeBatchId)) {
            this.gameState.tutorials.skippedTutorialBatches.push(this.activeBatchId);
        }
        this._endBatch();
        this.gameState.setState(this.gameState);
    }
    
    /**
     * Advances the tutorial to the next step, or ends it if completed.
     */
    advanceStep() {
        if (!this.activeStepId || !this.activeBatchId) return;

        const batch = TUTORIAL_DATA[this.activeBatchId];
        const currentStep = batch.steps.find(s => s.stepId === this.activeStepId);
        
        this.uiManager.hideTutorialToast();

        if (currentStep && currentStep.nextStepId) {
            this._displayStep(currentStep.nextStepId);
        } else {
            const completedBatchId = this.activeBatchId;
            this._endBatch(); 
            if (this.gameState.introSequenceActive && completedBatchId?.startsWith('intro_')) {
                this.simulationService._continueIntroSequence(completedBatchId);
            }
        }
        
        // Force a full re-render after a step advances. This ensures any UI elements
        // that depend on the tutorial's state (like disabled buttons) are correctly updated.
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Displays a specific tutorial step by its ID and manages navigation locks.
     * @param {string} stepId The ID of the step to display.
     * @private
     */
    _displayStep(stepId) {
        if (!this.activeBatchId) return;
        const batch = TUTORIAL_DATA[this.activeBatchId];
        const step = batch.steps.find(s => s.stepId === stepId);
        if (!step) {
            this._endBatch();
            return;
        }

        // Set NavLock based on tutorial data
        if (batch.navLock) {
            if (step.navLock) {
                this.gameState.tutorials.navLock = step.navLock;
            } else {
                // If no specific lock, lock to the current screen
                const currentScreenId = this.gameState.activeScreen;
                const currentNavId = this.screenToNavMap[currentScreenId];
                this.gameState.tutorials.navLock = { navId: currentNavId, screenId: currentScreenId };
            }
        } else {
            this.gameState.tutorials.navLock = null;
        }

        if (step.completion.action === ACTION_IDS.BUY_ITEM && this.gameState.player.credits < 1000) {
            return;
        }

        this.activeStepId = stepId;
        this.gameState.tutorials.activeStepId = stepId;
        
        this.uiManager.showTutorialToast({
            step: step,
            onSkip: () => this.uiManager.showSkipTutorialModal(() => this.skipActiveTutorial()),
            onNext: () => this.advanceStep(),
            gameState: this.gameState.getState()
        });

        // Re-render to apply the navLock changes immediately
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Cleans up the state when a tutorial batch ends.
     * @private
     */
    _endBatch() {
        this.uiManager.hideTutorialToast();
        this.activeBatchId = null;
        this.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.navLock = null; // Clear the nav lock
    }

    /**
     * Checks if an action matches a tutorial step's completion or trigger condition.
     * @param {object|object[]} condition The condition to check.
     * @param {object} actionData The action performed by the player.
     * @returns {boolean} True if the condition is met.
     * @private
     */
    _matchesCondition(condition, actionData) {
        if (!condition || !actionData) return false;
        if (Array.isArray(condition)) {
            return condition.every(c => this._matchesSingleCondition(c, actionData));
        }
        return this._matchesSingleCondition(condition, actionData);
    }
    
    /**
     * Helper for _matchesCondition to check a single condition object.
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
                return condition.action === actionData.action;
            case TUTORIAL_ACTION_TYPES.INFO: // Always true when checked, relies on manual "Next" click
                return true;
            default:
                return false;
        }
    }
}