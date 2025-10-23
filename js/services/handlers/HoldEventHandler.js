// js/services/handlers/HoldEventHandler.js
/**
 * @fileoverview This file defines the HoldEventHandler class, which manages
 * the "hold-to-act" functionality for UI elements like refueling and repairing.
 * It uses a requestAnimationFrame loop to repeatedly call an action (like
 * refueling) as long as the button is held down.
 *
 * This handler is responsible for:
 * 1. Detecting mousedown/touchstart events on target buttons.
 * 2. Differentiating between a "tap" (one tick) and a "hold" (looping ticks).
 * 3. Calling the appropriate PlayerActionService function on each "tick" of the loop.
 * 4. Stopping the loop on mouseup/touchend/touchcancel/touchmove, OR when a touch drags off the element.
 * 5. Managing all visual feedback (CSS classes) associated with the hold state.
 */

import { formatCredits } from '../../utils.js';

/**
 * Manages hold-to-act (e.g., refuel, repair) interactions on the UI.
 * This class adds event listeners for mousedown/touchstart and mouseup/touchend
 * to specified buttons and executes a callback function repeatedly while held.
 */
export class HoldEventHandler {
    /**
     * @param {import('../player/PlayerActionService.js').PlayerActionService} playerActionService
     * @param {import('../UIManager.js').UIManager} uiManager
     */
    constructor(playerActionService, uiManager) {
        this.playerActionService = playerActionService;
        this.uiManager = uiManager;

        this.refuelBtn = null;
        this.repairBtn = null;

        this.isRefueling = false; // Is true ONLY during a sustained hold loop
        this.isRepairing = false; // Is true ONLY during a sustained hold loop

        /** @type {number} Milliseconds between service ticks */
        this.holdInterval = 400;

        /** @type {number} Milliseconds to wait before a tap becomes a hold */
        this.holdDelay = 400;

        this.lastTickTime = 0;
        this.animationFrameId = null;

        /** @type {string | null} */
        this.activeElementId = null; // Store the ID of the element being held

        /** @type {Object<string, number | null>} */
        this.holdTimers = { // Timers to initiate a hold
            fuel: null,
            repair: null
        };

        /** @type {Object<string, number | null>} */
        this.stopTimers = { // Timers to fade out visuals
            fuel: null,
            repair: null
        };

        // Bind all event handlers in the constructor
        this._boundLoop = this._loop.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this);

        this._boundStartRefueling = this._startRefueling.bind(this);
        this._boundStopRefueling = this._stopRefueling.bind(this);
        this._boundStartRepairing = this._startRepairing.bind(this);
        this._boundStopRepairing = this._stopRepairing.bind(this);
        
        // --- Stepper logic remains unchanged ---
        this.isStepperHolding = false;
        this.stepperInitialDelay = 1000;
        this.stepperRepeatRate = 1000 / 7;
        this.stepperTimeout = null;
        this.stepperInterval = null;
        this.stepperStartTime = null;
        this.stepperTarget = null;
    }

    /**
     * Binds all hold-to-act event listeners to the buttons.
     * Needs to be called *after* the ServicesScreen is rendered.
     */
    bindHoldEvents() {
        this.refuelBtn = document.getElementById('refuel-btn');
        this.repairBtn = document.getElementById('repair-btn');

        if (this.refuelBtn) {
            // Remove any old listeners first
            this.refuelBtn.removeEventListener('mousedown', this._boundStartRefueling);
            this.refuelBtn.removeEventListener('touchstart', this._boundStartRefueling);

            // Add new "start" listeners
            this.refuelBtn.addEventListener('mousedown', this._boundStartRefueling);
            this.refuelBtn.addEventListener('touchstart', this._boundStartRefueling, { passive: false });
        }

        if (this.repairBtn) {
            // Remove any old listeners first
            this.repairBtn.removeEventListener('mousedown', this._boundStartRepairing);
            this.repairBtn.removeEventListener('touchstart', this._boundStartRepairing);

            // Add new "start" listeners
            this.repairBtn.addEventListener('mousedown', this._boundStartRepairing);
            this.repairBtn.addEventListener('touchstart', this._boundStartRepairing, { passive: false });
        }
    }

     /**
     * Handles the touchmove event robustly by checking element IDs,
     * which survive the re-render.
     * @param {TouchEvent} e - The touchmove event.
     * @private
     */
    _handleTouchMove(e) {
        if (!this.activeElementId) return;

        const touch = e.touches[0];
        if (!touch) return;

        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);

        if (!elementUnderTouch) {
            // Finger likely moved off-screen, treat as release
            if (this.activeElementId === 'refuel-btn') this._stopRefueling();
            if (this.activeElementId === 'repair-btn') this._stopRepairing();
            return;
        }

        if (elementUnderTouch.classList.contains('floating-text')) {
            return;
        }

        const currentActiveButton = document.getElementById(this.activeElementId);
        if (elementUnderTouch === currentActiveButton || (currentActiveButton && currentActiveButton.contains(elementUnderTouch))) {
            return; // Finger is still on the button.
        }

        // Finger has definitively moved off the button.
        if (this.activeElementId === 'refuel-btn') this._stopRefueling();
        if (this.activeElementId === 'repair-btn') this._stopRepairing();
    }

    /**
     * The main game loop for handling hold actions.
     * @param {number} timestamp - The current high-resolution timestamp.
     * @private
     */
    _loop(timestamp) {
        if (!this.isRefueling && !this.isRepairing) {
            this.animationFrameId = null;
            return;
        }

        if (timestamp - this.lastTickTime >= this.holdInterval) {
            this.lastTickTime = timestamp;
            let cost = 0;
            let serviceStillActive = false;

            this.refuelBtn = document.getElementById('refuel-btn');
            this.repairBtn = document.getElementById('repair-btn');

            if (this.isRefueling) {
                cost = this.playerActionService.refuelTick();
                this._applyVisuals('fuel'); 
                
                if (cost > 0 && this.refuelBtn) {
                    const rect = this.refuelBtn.getBoundingClientRect();
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
                    serviceStillActive = true;
                } else {
                    this.isRefueling = false;
                }
            }

            if (this.isRepairing) {
                cost = this.playerActionService.repairTick();
                this._applyVisuals('repair');
                
                if (cost > 0 && this.repairBtn) {
                     const rect = this.repairBtn.getBoundingClientRect();
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
                    serviceStillActive = true;
                } else {
                    this.isRepairing = false;
                }
            }

            if (serviceStillActive) {
                 this.animationFrameId = requestAnimationFrame(this._boundLoop);
            } else {
                 this.animationFrameId = null;
                 if (!this.isRefueling && this.activeElementId === 'refuel-btn') this._removeVisualsWithDelay('fuel');
                 if (!this.isRepairing && this.activeElementId === 'repair-btn') this._removeVisualsWithDelay('repair');
            }

        } else {
             this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }


    /**
     * Applies active visual classes to a service module.
     * @param {string} type - 'fuel' or 'repair'
     * @private
     */
    _applyVisuals(type) {
        if (type === 'fuel' && this.stopTimers.fuel) {
            clearTimeout(this.stopTimers.fuel);
            this.stopTimers.fuel = null;
        }
        if (type === 'repair' && this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
            this.stopTimers.repair = null;
        }

        const currentRefuelBtn = document.getElementById('refuel-btn');
        const currentRepairBtn = document.getElementById('repair-btn');
        const btn = type === 'fuel' ? currentRefuelBtn : currentRepairBtn;
        const barId = type ==='fuel' ? 'fuel-bar' : 'repair-bar';

        if (btn) {
            btn.classList.add('holding');
            const serviceModule = btn.closest('.service-module');
            if (serviceModule) serviceModule.classList.add('active-service');

            const progressBarFill = document.getElementById(barId);
            if (progressBarFill) {
                progressBarFill.classList.add('filling');
                const progressBarContainer = progressBarFill.closest('.progress-bar-container');
                if (progressBarContainer) progressBarContainer.classList.add('active-pulse');
            }
        }
    }

    /**
     * Removes active visual classes from a service module after a delay.
     * @param {string} type - 'fuel' or 'repair'
     * @private
     */
    _removeVisualsWithDelay(type) {
        if (type === 'fuel') {
            if (this.stopTimers.fuel) clearTimeout(this.stopTimers.fuel);
            this.stopTimers.fuel = setTimeout(() => {
                this._removeVisuals('fuel');
                this.stopTimers.fuel = null;
            }, 400);
        } else if (type === 'repair') {
            if (this.stopTimers.repair) clearTimeout(this.stopTimers.repair);
             this.stopTimers.repair = setTimeout(() => {
                this._removeVisuals('repair');
                this.stopTimers.repair = null;
            }, 400);
        }
    }

    /**
     * Immediately removes active visual classes (used internally by delayed removal).
     * @param {string} type - 'fuel' or 'repair'
     * @private
     */
     _removeVisuals(type) {
        const currentRefuelBtn = document.getElementById('refuel-btn');
        const currentRepairBtn = document.getElementById('repair-btn');
        const btn = type === 'fuel' ? currentRefuelBtn : currentRepairBtn;
        const barId = type === 'fuel' ? 'fuel-bar' : 'repair-bar';

        if (btn) {
            btn.classList.remove('holding');
            const serviceModule = btn.closest('.service-module');
            if (serviceModule) serviceModule.classList.remove('active-service');

            const progressBarFill = document.getElementById(barId);
            if (progressBarFill) {
                progressBarFill.classList.remove('filling');
                const progressBarContainer = progressBarFill.closest('.progress-bar-container');
                if (progressBarContainer) progressBarContainer.classList.remove('active-pulse');
            }
        }
    }


    /**
     * Starts the tap/hold process for refueling.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRefueling(e) {
        // --- MODIFICATION: Intentional "Toggle Off" / Self-Correction ---
        if (e.button && e.button !== 0) return; // Ignore right-clicks

        if (this.activeElementId === 'refuel-btn') {
            // Button is already active (stuck). This tap is an intentional "stop" request.
            this._stopRefueling();
            return;
        }
        
        // If we're here, fuel wasn't active.
        // Stop the other process just in case it's stuck.
        this._stopRepairing(); 
        // --- End modification ---

        // Only prevent default for touchstart
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        this.refuelBtn = document.getElementById('refuel-btn');
        if (!this.refuelBtn) return;

        this.activeElementId = this.refuelBtn.id;

        // Add "stop" listeners to the global document
        document.addEventListener('mouseup', this._boundStopRefueling);
        document.addEventListener('touchend', this._boundStopRefueling);
        document.addEventListener('touchcancel', this._boundStopRefueling);
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
        }

        const cost = this.playerActionService.refuelTick();

        if (cost <= 0) {
            // If nothing happened, stop immediately and clean up listeners
            this._stopRefueling(); 
            return;
        }

        const rect = this.refuelBtn.getBoundingClientRect();
        this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');

        this._applyVisuals('fuel'); // Apply visuals ONCE on initial tap

        this.holdTimers.fuel = setTimeout(() => {
            // --- Race condition check ---
            // If the button was released (and _stopRefueling was called) before
            // this timer fired, do not start the hold loop.
            if (this.activeElementId !== 'refuel-btn') {
                 this.holdTimers.fuel = null;
                 return;
            }
            // --- End check ---

            this.isRefueling = true;
            this.lastTickTime = performance.now();
            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(this._boundLoop);
            }
            this.holdTimers.fuel = null;
        }, this.holdDelay);
    }

    /**
     * Stops the tap/hold process for refueling.
     * @private
     */
    _stopRefueling() {
        if (this.activeElementId !== 'refuel-btn') {
            return;
        }

        // Remove global "stop" listeners
        document.removeEventListener('mouseup', this._boundStopRefueling);
        document.removeEventListener('touchend', this._boundStopRefueling);
        document.removeEventListener('touchcancel', this._boundStopRefueling);
        document.removeEventListener('touchmove', this._handleTouchMove);

        this.activeElementId = null;
        this.isRefueling = false; // Stop the loop

        if (this.holdTimers.fuel) {
            clearTimeout(this.holdTimers.fuel);
            this.holdTimers.fuel = null;
        }

        this._removeVisualsWithDelay('fuel'); // Remove visuals ONCE
    }

     /**
     * Starts the tap/hold process for repairing.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRepairing(e) {
        // --- MODIFICATION: Intentional "Toggle Off" / Self-Correction ---
        if (e.button && e.button !== 0) return; // Ignore right-clicks

        if (this.activeElementId === 'repair-btn') {
            // Button is already active (stuck). This tap is an intentional "stop" request.
            this._stopRepairing();
            return;
        }

        // If we're here, repair wasn't active.
        // Stop the other process just in case it's stuck.
        this._stopRefueling();
        // --- End modification ---

        // Only prevent default for touchstart
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        this.repairBtn = document.getElementById('repair-btn');
        if (!this.repairBtn) return;

        this.activeElementId = this.repairBtn.id;

        // Add "stop" listeners to the global document
        document.addEventListener('mouseup', this._boundStopRepairing);
        document.addEventListener('touchend', this._boundStopRepairing);
        document.addEventListener('touchcancel', this._boundStopRepairing);
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
        }

        const cost = this.playerActionService.repairTick();

        if (cost <= 0) {
            // If nothing happened, stop immediately and clean up listeners
            this._stopRepairing();
            return;
        }

        const rect = this.repairBtn.getBoundingClientRect();
        this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');

        this._applyVisuals('repair'); // Apply visuals ONCE on initial tap

        this.holdTimers.repair = setTimeout(() => {
            // --- Race condition check ---
            if (this.activeElementId !== 'repair-btn') {
                 this.holdTimers.repair = null;
                 return;
            }
            // --- End check ---

            this.isRepairing = true;
            this.lastTickTime = performance.now();
            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(this._boundLoop);
            }
            this.holdTimers.repair = null;
        }, this.holdDelay);
    }

    /**
     * Stops the tap/hold process for repairing.
     * @private
     */
    _stopRepairing() {
         if (this.activeElementId !== 'repair-btn') {
            return;
        }

        // Remove global "stop" listeners
        document.removeEventListener('mouseup', this._boundStopRepairing);
        // --- CRASH FIX: Added 'this.' ---
        document.removeEventListener('touchend', this._boundStopRepairing); 
        // --- END CRASH FIX ---
        document.removeEventListener('touchcancel', this._boundStopRepairing);
        document.removeEventListener('touchmove', this._handleTouchMove);

        this.activeElementId = null;
        
        this.isRepairing = false; // Stop the loop

        if (this.holdTimers.repair) {
            clearTimeout(this.holdTimers.repair);
            this.holdTimers.repair = null;
        }

        this._removeVisualsWithDelay('repair'); // Remove visuals ONCE
    }

     // --- Stepper Hold Logic (Unchanged) ---
     _startStepperHold(button) {
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

            this._stepperTick();
            this.stepperInterval = setInterval(() => this._stepperTick(), this.stepperRepeatRate);
        }, this.stepperInitialDelay);
    }

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
    }

     _stepperTick() {
        if (!this.stepperTarget) {
            this._stopStepperHold();
            return;
        }

        const { input, direction } = this.stepperTarget;
        const holdDuration = (Date.now() - this.stepperStartTime) / 1000;
        let step = 1;
        if (holdDuration > 5) step = 25;
        else if (holdDuration > 2) step = 5;

        let currentValue = parseInt(input.value, 10) || 0;
        currentValue += step * direction;
        input.value = Math.max(0, currentValue);

        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
}