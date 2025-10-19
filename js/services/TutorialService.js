// js/services/TutorialService.js
/**
 * @fileoverview Manages the tutorial system, including displaying toasts,
 * tracking progress, and checking completion conditions.
 */
import { DB } from '../data/database.js';
import { TUTORIAL_ACTION_TYPES, SCREEN_IDS } from '../data/constants.js';

export class TutorialService {
    /**
     * @param {import('./GameState.js').GameState} gameState - The game state instance.
     * @param {import('./UIManager.js').UIManager} uiManager - The UI manager instance.
     * @param {import('./LoggingService.js').Logger} logger - The logger instance.
     * @param {import('./SimulationService.js').SimulationService} simulationService - The simulation service facade.
     */
    constructor(gameState, uiManager, logger, simulationService) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.simulationService = simulationService; // Facade needed for active ship name

        this.toastQueue = [];
        this.isToastVisible = false;
        this.toastTimeout = null;
    }

    /**
     * Starts a specific tutorial batch by ID.
     * @param {string} batchId - The ID of the tutorial batch to start.
     */
    startBatch(batchId) {
        const batchData = DB.TUTORIAL_DATA[batchId];
        if (!batchData || this.gameState.tutorials.seenBatchIds.includes(batchId)) return;

        this.gameState.tutorials.activeBatchId = batchId;
        this.gameState.tutorials.activeStepId = batchData.steps[0].stepId;
        this.gameState.tutorials.navLock = batchData.navLock || null; // Apply initial nav lock if present
        this.gameState.setState({}); // Update state to trigger UI changes
        this.showCurrentStep();
        this.logger.info('TutorialService', `Started tutorial batch: ${batchId}`);
    }

    /**
     * Checks the current game state against the completion conditions of the active tutorial step.
     * @param {object} trigger - The action or event that triggered this check (e.g., { type: 'ACTION', action: 'buy-ship' }).
     */
    checkState(trigger) {
        const { activeBatchId, activeStepId } = this.gameState.tutorials;
        if (!activeBatchId || !activeStepId) return;

        const batchData = DB.TUTORIAL_DATA[activeBatchId];
        const stepData = batchData.steps.find(s => s.stepId === activeStepId);

        if (!stepData || stepData.completion.type !== trigger.type) return;

        let conditionMet = false;
        switch (trigger.type) {
            case TUTORIAL_ACTION_TYPES.SCREEN_LOAD:
                conditionMet = (trigger.screenId === stepData.completion.screenId);
                break;
            case TUTORIAL_ACTION_TYPES.ACTION:
                conditionMet = (trigger.action === stepData.completion.action);
                // Additional checks for specific actions if needed
                 if (trigger.action === 'sell-item' && stepData.completion.goodId) {
                    conditionMet = conditionMet && (trigger.goodId === stepData.completion.goodId);
                 }
                 if (trigger.action === 'accept-mission' && stepData.completion.missionId) {
                     conditionMet = conditionMet && (trigger.missionId === stepData.completion.missionId);
                 }
                  if (trigger.action === 'complete-mission' && stepData.completion.missionId) {
                     conditionMet = conditionMet && (trigger.missionId === stepData.completion.missionId);
                 }
                break;
            case TUTORIAL_ACTION_TYPES.INFO:
                // INFO steps are completed by clicking "Next" (handled by advanceStep)
                break;
        }

        if (conditionMet) {
            this.logger.info('TutorialService', `Condition met for step: ${activeStepId}`);
            this.advanceStep();
        }
    }

    /**
     * Advances the tutorial to the next step or completes the batch.
     */
    advanceStep() {
        const { activeBatchId, activeStepId } = this.gameState.tutorials;
        if (!activeBatchId || !activeStepId) return;

        const batchData = DB.TUTORIAL_DATA[activeBatchId];
        const currentStep = batchData.steps.find(s => s.stepId === activeStepId);

        if (!currentStep) return;

        const nextStepId = currentStep.nextStepId;
        if (nextStepId) {
            const nextStep = batchData.steps.find(s => s.stepId === nextStepId);
            this.gameState.tutorials.activeStepId = nextStepId;
            // Update navLock based on the *next* step
            this.gameState.tutorials.navLock = nextStep ? nextStep.navLock : null;
             this.gameState.setState({});
            this.showCurrentStep();
            this.logger.info('TutorialService', `Advanced to step: ${nextStepId}`);
        } else {
            this.completeBatch(activeBatchId);
        }
    }

    /**
     * Marks a tutorial batch as completed.
     * @param {string} batchId - The ID of the batch to complete.
     */
    completeBatch(batchId) {
        this.hideTutorialOverlay();
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.navLock = null; // Clear nav lock
        if (!this.gameState.tutorials.seenBatchIds.includes(batchId)) {
            this.gameState.tutorials.seenBatchIds.push(batchId);
        }
        this.logger.info('TutorialService', `Completed tutorial batch: ${batchId}`);
        this.gameState.setState({});

        // Check if we need to resume the intro sequence
        if (batchId === 'intro_hangar' || batchId === 'intro_finance') {
             this.simulationService.introService.continueAfterTutorial(batchId);
        }
    }

    /**
     * Skips the currently active tutorial batch.
     */
    skipBatch() {
        const { activeBatchId } = this.gameState.tutorials;
        if (!activeBatchId) return;

        this.hideTutorialOverlay();
        if (!this.gameState.tutorials.skippedTutorialBatches.includes(activeBatchId)) {
            this.gameState.tutorials.skippedTutorialBatches.push(activeBatchId);
        }
        this.logger.info('TutorialService', `Skipped tutorial batch: ${activeBatchId}`);
        this.completeBatch(activeBatchId); // Use completeBatch to clean up state
    }

    /**
     * Displays the tutorial overlay for the current active step.
     */
    showCurrentStep() {
        const { activeBatchId, activeStepId } = this.gameState.tutorials;
        if (!activeBatchId || !activeStepId) return;

        const batchData = DB.TUTORIAL_DATA[activeBatchId];
        const stepData = batchData.steps.find(s => s.stepId === activeStepId);
        if (!stepData) return;

        // Dynamic text replacement
        let text = stepData.text;
        const activeShipName = DB.SHIPS[this.gameState.player.activeShipId]?.name || 'Your Ship';
        text = text.replace('{shipName}', `<span class="hl-yellow">${activeShipName}</span>`);
         text = text.replace('{playerName}', `<span class="hl-yellow">${this.gameState.player.name}</span>`);

        const overlay = document.getElementById('tutorial-overlay');
        const content = document.getElementById('tutorial-content');
        const skipButton = document.getElementById('tutorial-skip');

        content.innerHTML = `
            <h3>${batchData.title}</h3>
            <p>${text}</p>
            ${stepData.completion.type === TUTORIAL_ACTION_TYPES.INFO ? `<button class="btn btn-primary mt-2" data-action="next-tutorial-step">${stepData.buttonText || 'Next'}</button>` : ''}
        `;
        
        // Positioning
        const position = stepData.position || { desktop: 'bottom-center', mobile: 'bottom-center' };
        const positionClass = window.innerWidth < 768 ? position.mobile : position.desktop;
        overlay.className = `tutorial-overlay visible ${positionClass}`;

        // Skippable?
        skipButton.style.display = stepData.isSkippable ? 'block' : 'none';

        // Unlock purchase if needed (specific for hangar tutorial)
        const purchaseButtons = document.querySelectorAll('[data-action="buy-ship"]');
        if (stepData.unlockPurchase) {
            purchaseButtons.forEach(btn => btn.disabled = false);
        } else if (activeBatchId === 'intro_hangar' && activeStepId !== 'hangar_2') {
             purchaseButtons.forEach(btn => btn.disabled = true);
        }
        
        // Handle specific element enabling/disabling for navLock
        this._applyNavLockHighlights();
    }

    /**
     * Hides the tutorial overlay.
     */
    hideTutorialOverlay() {
        const overlay = document.getElementById('tutorial-overlay');
        overlay.className = 'tutorial-overlay'; // Remove visible and position classes
        // Clear highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        document.querySelectorAll('.tutorial-disabled').forEach(el => el.classList.remove('tutorial-disabled'));
    }

    /**
     * Applies visual highlights and disables elements based on the current navLock state.
     * @private
     */
    _applyNavLockHighlights() {
        const navLock = this.gameState.tutorials.navLock;
        
        // Remove previous highlights/disabled states first
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        document.querySelectorAll('.tutorial-disabled').forEach(el => el.classList.remove('tutorial-disabled'));

        if (!navLock) return;

        // Disable everything initially if a lock is active
        document.querySelectorAll('button, a, input, [data-action]').forEach(el => {
             // Don't disable elements within the tutorial overlay itself
            if (!el.closest('#tutorial-overlay')) {
                el.classList.add('tutorial-disabled');
            }
        });

        // Enable and highlight specific elements
        let query = '';
        if (navLock.navId && navLock.screenId) {
            // Target the specific sub-nav button
            query = `button[data-action="set-screen"][data-nav-id="${navLock.navId}"][data-screen-id="${navLock.screenId}"]`;
        } else if (navLock.navId) {
            // Target the main nav button
             query = `button[data-action="set-nav"][data-nav-id="${navLock.navId}"]`; // Assuming set-nav action exists
        } else if (navLock.enabledElementQuery) {
            // Target a specific element defined in the step
            query = navLock.enabledElementQuery;
        }

        if (query) {
            document.querySelectorAll(query).forEach(el => {
                el.classList.remove('tutorial-disabled');
                el.classList.add('tutorial-highlight');
            });
        }
        
        // Always ensure tutorial buttons are enabled
         document.querySelectorAll('#tutorial-overlay button').forEach(el => {
            el.classList.remove('tutorial-disabled');
         });
    }

    /**
     * Displays a short informational toast message.
     * @param {string} title - The title of the toast.
     * @param {string} message - The body text of the toast.
     * @param {number} [duration=5000] - How long the toast should be visible in ms.
     */
    showToast(title, message, duration = 5000) {
        this.toastQueue.push({ title, message, duration });
        this._processToastQueue();
    }

    /**
     * Processes the toast queue, showing the next toast if none are visible.
     * @private
     */
    _processToastQueue() {
        if (this.isToastVisible || this.toastQueue.length === 0) {
            return;
        }

        this.isToastVisible = true;
        const { title, message, duration } = this.toastQueue.shift();

        const toastElement = document.getElementById('tutorial-toast');
        const titleElement = document.getElementById('tutorial-toast-title');
        const messageElement = document.getElementById('tutorial-toast-message');

        titleElement.textContent = title;
        messageElement.innerHTML = message; // Use innerHTML for simple formatting
        toastElement.classList.add('visible');

        clearTimeout(this.toastTimeout); // Clear any existing timeout
        this.toastTimeout = setTimeout(() => {
            this.hideToast();
        }, duration);
    }

    /**
     * Hides the currently visible toast.
     */
    hideToast() {
        const toastElement = document.getElementById('tutorial-toast');
        toastElement.classList.remove('visible');
        this.isToastVisible = false;
        // Check if there are more toasts waiting
        setTimeout(() => this._processToastQueue(), 500); // Delay before showing next
    }
    
    // --- [[START]] Added for Metal Update V1 ---
    /**
     * Triggers the one-time tutorial toast for Metal Scrap.
     * Called by PlayerActionService when scrap is first gained.
     */
    triggerScrapTutorial() {
        // The check for hasSeenScrapTutorial flag happens in PlayerActionService
        this.showToast(
            'NEW RESOURCE: METAL SCRAP',
            "Repairing your hull now generates Metal Scrap. This is a special resource that <b>doesn't use cargo space</b>. You can sell it for credits at any station via the <b>Market > Materials</b> tab.",
            8000 // Slightly longer duration
        );
         this.logger.info('TutorialService', 'Triggered Metal Scrap tutorial toast.');
    }
    // --- [[END]] Added for Metal Update V1 ---
}