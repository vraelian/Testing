// js/services/handlers/HoldEventHandler.js
/**
 * @fileoverview Manages "hold-to-act" functionality, for continuous actions like
 * refueling, repairing, and the progressive quantity steppers on the market screen.
 */
import { formatCredits } from '../../utils.js';
import { ACTION_IDS } from '../../data/constants.js';

export class HoldEventHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(gameState, simulationService, uiManager) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;

        this.refuelInterval = null;
        this.repairInterval = null;

        // --- New properties for the stepper hold feature ---
        this.stepperInitialDelay = 1000; // 1-second initial delay
        this.stepperRepeatRate = 1000 / 7; // ~7 times per second

        this.stepperTimeout = null;
        this.stepperInterval = null;
        this.stepperStartTime = null;
        this.stepperTarget = null; // { input, direction, element }
        this.isStepperHolding = false; // Flag to distinguish a hold from a click
    }

    /**
     * Initiates a hold action based on the event target.
     * @param {Event} e The mousedown or touchstart event.
     */
    handleHoldStart(e) {
        if (e.target.closest('#refuel-btn')) {
            this._startRefueling(e.type === 'touchstart');
        }
        if (e.target.closest('#repair-btn')) {
            this._startRepairing(e.type === 'touchstart');
        }

        const stepperButton = e.target.closest('.qty-up, .qty-down');
        if (stepperButton) {
            // Let the click event happen unless a hold is confirmed.
            this._startStepperHold(stepperButton);
        }
    }

    /**
     * Clears all active hold intervals, stopping any continuous actions.
     */
    handleHoldEnd() {
        this._stopRefueling();
        this._stopRepairing();
        this._stopStepperHold();
    }

    // --- Stepper Hold Logic ---

    /**
     * Starts the hold-to-increment/decrement sequence for a market quantity stepper.
     * @param {HTMLElement} button - The stepper button being held (.qty-up or .qty-down).
     * @private
     */
    _startStepperHold(button) {
        // Clear any existing timers to prevent conflicts
        this._stopStepperHold();
        this.isStepperHolding = false;

        const controls = button.closest('.transaction-controls');
        if (!controls) return;
        
        const qtyStepperEl = button.closest('.qty-stepper');
        const qtyInput = controls.querySelector('input');
        const direction = button.classList.contains('qty-up') ? 1 : -1;
        this.stepperTarget = { input: qtyInput, direction: direction, element: qtyStepperEl };

        this.stepperTimeout = setTimeout(() => {
            this.isStepperHolding = true;
            this.stepperStartTime = Date.now();
            
            if (this.stepperTarget && this.stepperTarget.element) {
                this.stepperTarget.element.classList.add('stepper-active');
            }

            this._stepperTick(); // Fire the first tick immediately after the delay
            this.stepperInterval = setInterval(() => this._stepperTick(), this.stepperRepeatRate);
        }, this.stepperInitialDelay);
    }

    /**
     * Stops the stepper hold sequence and clears all associated timers.
     * @private
     */
    _stopStepperHold() {
        clearTimeout(this.stepperTimeout);
        clearInterval(this.stepperInterval);

        if (this.stepperTarget && this.stepperTarget.element) {
            this.stepperTarget.element.classList.remove('stepper-active');
        }

        this.stepperTimeout = null;
        this.stepperInterval = null;
        this.stepperStartTime = null;
        this.stepperTarget = null;
        // The isStepperHolding flag is reset on the next hold start.
    }

    /**
     * Executes a single tick of the quantity stepper, applying progressive acceleration.
     * @private
     */
    _stepperTick() {
        if (!this.stepperTarget) {
            this._stopStepperHold();
            return;
        }

        const { input, direction } = this.stepperTarget;
        // The hold duration starts counting *after* the initial 1s delay
        const holdDuration = (Date.now() - this.stepperStartTime) / 1000;

        let step = 1; // Base increment
        if (holdDuration > 5) { // 1s delay + 5s hold = 6s+ total
            step = 25; // Tier 3 acceleration
        } else if (holdDuration > 2) { // 1s delay + 2s hold = 3s+ total
            step = 5; // Tier 2 acceleration
        }

        let currentValue = parseInt(input.value, 10) || 0;
        currentValue += step * direction;

        input.value = Math.max(0, currentValue); // Ensure value doesn't go below zero

        // Dispatch an 'input' event to trigger the UI update in MarketEventHandler
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }


    // --- Refuel & Repair Logic (Improved Rates) ---

    _startRefueling(isTouch = false) {
        if (this.gameState.isGameOver || this.refuelInterval) return;
        this._refuelTick();
        this.refuelInterval = setInterval(() => this._refuelTick(), isTouch ? 200 : 100);
    }

    _stopRefueling() {
        clearInterval(this.refuelInterval);
        this.refuelInterval = null;
    }

    _refuelTick() {
        const cost = this.simulationService.refuelTick();
        const button = this.uiManager.cache.servicesScreen?.querySelector('#refuel-btn');
        if (cost > 0 && button) {
            const rect = button.getBoundingClientRect();
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRefueling();
        }
    }

    _startRepairing(isTouch = false) {
        if (this.gameState.isGameOver || this.repairInterval) return;
        this._repairTick();
        this.repairInterval = setInterval(() => this._repairTick(), isTouch ? 200 : 100);
    }

    _stopRepairing() {
        clearInterval(this.repairInterval);
        this.repairInterval = null;
    }

    _repairTick() {
        const cost = this.simulationService.repairTick();
        const button = this.uiManager.cache.servicesScreen?.querySelector('#repair-btn');
        if (cost > 0 && button) {
            const rect = button.getBoundingClientRect();
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRepairing();
        }
    }
}