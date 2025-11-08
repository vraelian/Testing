// js/services/TutorialService.js
/**
 * @fileoverview
 * This service manages the state and flow of all interactive tutorials.
 * It checks game state against triggers, advances steps, and manages
 * tutorial completion state. It delegates all UI rendering to the
 * TutorialRenderer.
 */

import { DB } from '../data/database.js';
import { ACTION_IDS, SCREEN_IDS } from '../data/constants.js';

// --- VIRTUAL WORKBENCH: IMPORT TutorialRenderer ---
import { TutorialRenderer } from '../ui/TutorialRenderer.js';
// --- END VIRTUAL WORKBENCH ---

export class TutorialService {
    /**
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./SimulationService.js').SimulationService} simulationService
     * @param {import('./LoggingService.js').Logger} logger
     * @param {import('./DebugService.js').DebugService} debugService
     */
    constructor(gameState, simulationService, logger, debugService) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.logger = logger;
        // --- VIRTUAL WORKBENCH: REMOVE UIMANAGER, ADD DEBUGSERVICE & RENDERER ---
        this.debugService = debugService;

        /**
         * The dedicated renderer for all tutorial UI components.
         * @type {TutorialRenderer}
         */
        this.tutorialRenderer = new TutorialRenderer(this.logger, this.debugService);
        // --- END VIRTUAL WORKBENCH ---

        this.activeStep = null;
        this.activeBatch = null;

        // Bind 'this' context for callbacks
        this.skipActiveTutorial = this.skipActiveTutorial.bind(this);
        this.advanceStep = this.advanceStep.bind(this);
        this.replayTutorial = this.replayTutorial.bind(this);
    }

    /**
     * Checks the current game state or action against the active tutorial's triggers.
     * This is the main pulse function called by EventManager and SimulationService.
     * @param {string} type - The type of check ('action', 'nav', 'state', 'input').
     * @param {object} [data] - The data associated with the check (e.g., actionId, screenId, gameState).
     */
    checkState(type, data) {
        if (!this.activeStep) return; // No active tutorial step

        const { completion } = this.activeStep;
        if (!completion) return;

        let conditionMet = false;

        switch (type) {
            case 'action':
                if (completion.type === 'action' && completion.actionId === data.actionId) {
                    // Check if the element query matches, if one is provided
                    if (completion.elementQuery) {
                        conditionMet = data.target.matches(completion.elementQuery);
                    } else {
                        conditionMet = true;
                    }
                }
                break;
            case 'nav':
                if (completion.type === 'nav') {
                    if (completion.navId && completion.navId === data.navId) {
                        conditionMet = true;
                    }
                    if (completion.screenId && completion.screenId === data.screenId) {
                        conditionMet = true;
                    }
                }
                break;
            case 'state':
                // This is for more complex state changes, e.g., 'player.credits > 1000'
                // Currently simplified; full implementation would need a state evaluation engine.
                if (completion.type === 'state' && this._evaluateStateCondition(completion.condition, data.gameState)) {
                    conditionMet = true;
                }
                break;
            case 'input':
                if (completion.type === 'input' && data.target.id === completion.elementId) {
                    if (completion.value === 'any') {
                        conditionMet = data.target.value.trim() !== '';
                    } else {
                        conditionMet = data.target.value === completion.value;
                    }
                }
                break;
        }

        if (conditionMet) {
            this.logger.log('TutorialService', `Step '${this.activeStep.stepId}' condition met. Advancing.`);
            this.advanceStep();
        }
    }

    /**
     * Determines if an action is blocked by the active tutorial.
     * @param {string} action - The action ID being attempted.
     * @param {HTMLElement} target - The element being interacted with.
     * @returns {boolean} - True if the action is blocked, false otherwise.
     */
    isBlocked(action, target) {
        if (!this.activeStep) return false; // No active tutorial, nothing blocked

        const { completion, allowProgression } = this.activeStep;
        if (allowProgression) return false; // Step allows any action

        if (completion.type === 'action') {
            // If a specific element is required, block all other actions
            if (completion.elementQuery) {
                return !target.matches(completion.elementQuery);
            }
            // If a specific action ID is required, block all others
            if (completion.actionId) {
                return action !== completion.actionId;
            }
        } else if (completion.type === 'nav') {
            // Block if it's a nav action but not the correct one
            if (action === ACTION_IDS.SET_SCREEN) {
                const { navId, screenId } = target.dataset;
                if (completion.navId && completion.navId !== navId) return true;
                if (completion.screenId && completion.screenId !== screenId) return true;
            }
        } else if (completion.type === 'input') {
            if (target.id !== completion.elementId) {
                return true; // Block input on any other element
            }
        }
        // Add more block logic for other types as needed
        return false; // Default: not blocked
    }

    /**
     * Triggers a visual "hint" (e.g., shake) on the correct tutorial element
     * when the user clicks the wrong thing.
     * @param {HTMLElement} wrongTarget - The element the user incorrectly clicked.
     */
    triggerHint(wrongTarget) {
        if (!this.activeStep) return;

        let query = null;
        const { completion } = this.activeStep;

        if (completion.type === 'action' && completion.elementQuery) {
            query = completion.elementQuery;
        } else if (completion.type === 'nav') {
            if (completion.screenId) {
                query = `[data-action="${ACTION_IDS.SET_SCREEN}"][data-screen-id="${completion.screenId}"]`;
            } else if (completion.navId) {
                query = `[data-action="${ACTION_IDS.SET_SCREEN}"][data-nav-id="${completion.navId}"]`;
            }
        } else if (completion.type === 'input' && completion.elementId) {
            query = `#${completion.elementId}`;
        }

        if (query) {
            const correctElement = document.querySelector(query);
            if (correctElement) {
                correctElement.classList.add('tutorial-hint');
                setTimeout(() => {
                    correctElement.classList.remove('tutorial-hint');
                }, 500); // Duration of the shake animation
            }
        }
    }

    /**
     * Starts a new tutorial batch.
     * @param {string} batchId - The ID of the tutorial batch to start.
     */
    triggerBatch(batchId) {
        const state = this.gameState.getState();
        if (state.tutorials.seenBatchIds.includes(batchId) || state.tutorials.skippedTutorialBatches.includes(batchId)) {
            this.logger.log('TutorialService', `Skipping tutorial batch '${batchId}': already seen or skipped.`);
            return;
        }

        this.activeBatch = DB.TUTORIAL_DATA[batchId];
        if (!this.activeBatch) {
            this.logger.error('TutorialService', `Tutorial batch '${batchId}' not found in database.`);
            return;
        }

        this.logger.log('TutorialService', `Triggering tutorial batch: ${batchId}`);
        this.gameState.setState({
            tutorials: {
                ...state.tutorials,
                activeBatchId: batchId,
                activeStepId: this.activeBatch.steps[0].stepId,
                navLock: this.activeBatch.navLock || null,
            }
        });
        this.activeStep = this.activeBatch.steps[0];
        this._showCurrentStep();

        // If this batch has an associated quest, mark it as started
        if (this.activeBatch.questFlag) {
            // This is a placeholder for a future quest system
        }
    }

    /**
     * Advances the tutorial to the next step or completes the batch.
     */
    advanceStep() {
        if (!this.activeBatch || !this.activeStep) return;

        const currentIndex = this.activeBatch.steps.findIndex(s => s.stepId === this.activeStep.stepId);
        const nextIndex = currentIndex + 1;

        if (nextIndex < this.activeBatch.steps.length) {
            // --- Advance to next step ---
            this.activeStep = this.activeBatch.steps[nextIndex];
            this.gameState.setState({
                tutorials: {
                    ...this.gameState.getState().tutorials,
                    activeStepId: this.activeStep.stepId,
                }
            });
            this._showCurrentStep();
        } else {
            // --- Complete the batch ---
            this.logger.log('TutorialService', `Tutorial batch '${this.activeBatch.id}' completed.`);
            const state = this.gameState.getState();
            const newSeenBatches = [...state.tutorials.seenBatchIds];
            if (!newSeenBatches.includes(this.activeBatch.id)) {
                newSeenBatches.push(this.activeBatch.id);
            }

            this.gameState.setState({
                tutorials: {
                    ...state.tutorials,
                    activeBatchId: null,
                    activeStepId: null,
                    navLock: null,
                    seenBatchIds: newSeenBatches,
                }
            });
            this.activeStep = null;
            this.activeBatch = null;

            // --- VIRTUAL WORKBENCH: HIDE TOAST ---
            this.tutorialRenderer.hideTutorialToast();
            // --- END VIRTUAL WORKBENCH ---

            // Check if this tutorial completion triggers another service
            if (state.introSequenceActive) {
                this.simulationService.introService.continueAfterTutorial();
            }
        }
    }

    /**
     * Skips the currently active tutorial batch.
     */
    skipActiveTutorial() {
        if (!this.activeBatch) return;

        const state = this.gameState.getState();
        const batchId = this.activeBatch.id;

        this.logger.log('TutorialService', `Skipping tutorial batch: ${batchId}`);

        // --- VIRTUAL WORKBENCH: HIDE MODALS ---
        this.tutorialRenderer.hideSkipTutorialModal();
        this.tutorialRenderer.hideTutorialToast();
        // --- END VIRTUAL WORKBENCH ---

        // Add to skipped list
        const newSkippedBatches = [...state.tutorials.skippedTutorialBatches];
        if (!newSkippedBatches.includes(batchId)) {
            newSkippedBatches.push(batchId);
        }

        // Clear active state
        this.gameState.setState({
            tutorials: {
                ...state.tutorials,
                activeBatchId: null,
                activeStepId: null,
                navLock: null,
                skippedTutorialBatches: newSkippedBatches,
            }
        });

        this.activeStep = null;
        this.activeBatch = null;

        // Check if this tutorial skip triggers another service
        if (state.introSequenceActive) {
            this.simulationService.introService.continueAfterTutorial();
        }
    }

    /**
     * Handles the UI request to skip a tutorial (shows confirmation).
     */
    handleSkipRequest() {
        // --- VIRTUAL WORKBENCH: USE RENDERER ---
        this.tutorialRenderer.showSkipTutorialModal(
            () => this.skipActiveTutorial(), // onConfirm
            () => this.tutorialRenderer.hideSkipTutorialModal() // onCancel
        );
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Replays a previously seen tutorial batch.
     * @param {string} batchId - The ID of the batch to replay.
     */
    replayTutorial(batchId) {
        this.logger.log('TutorialService', `Replaying tutorial batch: ${batchId}`);
        // Temporarily remove from seen list to allow 'triggerBatch' to run
        const state = this.gameState.getState();
        this.gameState.setState({
            tutorials: {
                ...state.tutorials,
                seenBatchIds: state.tutorials.seenBatchIds.filter(id => id !== batchId),
            }
        });
        this.triggerBatch(batchId);
    }

    /**
     * Shows the list of seen tutorials for replay.
     */
    showReplayLog() {
        const { seenBatchIds } = this.gameState.getState().tutorials;
        // --- VIRTUAL WORKBENCH: USE RENDERER ---
        this.tutorialRenderer.showTutorialLogModal({
            seenBatches: seenBatchIds,
            onSelect: this.replayTutorial
        });
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Displays the current active tutorial step's UI.
     * @private
     */
    _showCurrentStep() {
        if (!this.activeStep) {
            // --- VIRTUAL WORKBENCH: USE RENDERER ---
            this.tutorialRenderer.hideTutorialToast();
            // --- END VIRTUAL WORKBENCH ---
            return;
        }

        // Apply highlights
        if (this.activeStep.highlights) {
            // --- VIRTUAL WORKBENCH: USE RENDERER ---
            this.tutorialRenderer.applyTutorialHighlight(this.activeStep.highlights);
            // --- END VIRTUAL WORKBENCH ---
        } else {
            // --- VIRTUAL WORKBENCH: USE RENDERER ---
            this.tutorialRenderer.applyTutorialHighlight(null);
            // --- END VIRTUAL WORKBENCH ---
        }

        // Show the toast
        // --- VIRTUAL WORKBENCH: USE RENDERER ---
        this.tutorialRenderer.showTutorialToast({
            step: this.activeStep,
            onSkip: () => this.handleSkipRequest(),
            onNext: this.advanceStep,
            gameState: this.gameState.getState()
        });
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * A helper to evaluate complex state conditions for tutorial triggers.
     * @param {object} condition - The condition object from the tutorial data.
     * @param {object} gameState - The current game state.
     * @returns {boolean} - True if the condition is met.
     * @private
     */
    _evaluateStateCondition(condition, gameState) {
        if (!condition) return false;
        // Example condition: { "path": "player.credits", "op": ">", "value": 1000 }
        try {
            // Simple path resolver (e.g., "player.credits")
            const value = condition.path.split('.').reduce((obj, key) => obj?.[key], gameState);
            if (value === undefined) return false;

            switch (condition.op) {
                case '>': return value > condition.value;
                case '>=': return value >= condition.value;
                case '<': return value < condition.value;
                case '<=': return value <= condition.value;
                case '==': return value == condition.value;
                case '===': return value === condition.value;
                case 'exists': return value !== undefined && value !== null;
                default: return false;
            }
        } catch (error) {
            this.logger.error('TutorialService', `Error evaluating state condition: ${error.message}`);
            return false;
        }
    }
}