// js/services/handlers/HoldEventHandler.js
/**
 * @fileoverview This file defines the HoldEventHandler class, which manages
 * the "hold-to-act" (press and hold) functionality for UI elements.
 *
 * This handler is responsible for:
 * 1. Detecting 'pointerdown' events on target buttons.
 * 2. Immediately starting a "tick loop" (via requestAnimationFrame) on press.
 * 3. Calling the appropriate PlayerActionService function on each "tick" of the loop.
 * 4. Stopping the loop on 'pointerup' or 'pointercancel'.
 * 5. Managing all visual feedback (CSS classes) associated with the hold state.
 *
 * @architecture
 * This class uses a robust, persistent, and delegated event listener model
 * to solve "sticky button" / "toggle" bugs caused by UI re-renders (common in
 * frameworks or when state changes, like on iOS WKWebView).
 *
 * 1.  **Pointer Events**: Uses the modern Pointer Events API (`pointerdown`, `pointerup`,
 * `pointercancel`) for unified handling of mouse and touch.
 *
 * 2.  **Delegated "Start"**: A *single*, *persistent* `pointerdown` listener
 * is attached to `document.body`. This listener never gets destroyed by
 * re-renders. It checks `e.target` to delegate the event to the
 * correct function (e.g., `_startRefueling`).
 *
 * 3.  **Capture-Phase "Stop"**: *Single*, *persistent* `pointerup` and
 * `pointercancel` listeners are attached to the `window` object using
 * `{ capture: true }`.
 * - **Why window?**: It catches the event even if the pointer is released
 * outside the original button.
 * - **Why capture: true?**: This is the crucial part. It ensures this
 * "stop" listener fires during the *capture* phase (traveling *down*
 * from window to target), *before* any other listeners. This prevents
 * the UI re-render from destroying the element and stopping event
 * propagation, which was the root cause of the "sticky" bug.
 *
 * 4.  **State-Based Logic**: The `_start...` and `_stop...` functions DO NOT
 * add or remove event listeners. They *only* set internal state flags
 * (e.g., `this.activeElementId`, `this.isRefueling`). The persistent
 * listeners check this state to decide what to do.
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

        /** @type {boolean} Flag: Is the refueling loop active? */
        this.isRefueling = false;
        /** @type {boolean} Flag: Is the repairing loop active? */
        this.isRepairing = false;

        /** @type {number} Milliseconds between service ticks */
        this.holdInterval = 400;

        /** @type {number} Timestamp of the last loop tick */
        this.lastTickTime = 0;
        /** @type {number | null} ID for the requestAnimationFrame loop */
        this.animationFrameId = null;

        /** @type {string | null} The ID of the element currently being held */
        this.activeElementId = null;

        /**
         * @type {Object<string, number | null>}
         * Timers for fading out visual effects *after* a hold is released.
         */
        this.stopTimers = {
            fuel: null,
            repair: null
        };

        // --- Bind master handlers that will be persistent ---
        this._boundHandleInteractionStart = this._handleInteractionStart.bind(this);
        this._boundHandleInteractionStop = this._handleInteractionStop.bind(this);
        this._boundHandlePointerMove = this._handlePointerMove.bind(this);

        // --- Bind core functions ---
        this._boundLoop = this._loop.bind(this);
        this._boundStartRefueling = this._startRefueling.bind(this);
        this._boundStopRefueling = this._stopRefueling.bind(this);
        this._boundStartRepairing = this._startRepairing.bind(this);
        this._boundStopRepairing = this._stopRepairing.bind(this);
        this._boundStopStepperHold = this._stopStepperHold.bind(this);
        
        // --- Stepper logic ---
        this.isStepperHolding = false;
        this.stepperInitialDelay = 1000;
        this.stepperRepeatRate = 1000 / 7;
        this.stepperTimeout = null;
        this.stepperInterval = null;
        this.stepperStartTime = null;
        this.stepperTarget = null;
    }

    /**
     * Binds all hold-to-act event listeners using delegation.
     * This function should be called ONCE when the application initializes.
     * It adds persistent listeners to the body and window.
     * @see {@link HoldEventHandler} file-level comment for architecture details.
     */
    bindHoldEvents() {
        // --- Use Pointer Events for unified mouse/touch ---

        // Add persistent "start" listener to the document body (delegation)
        document.body.removeEventListener('pointerdown', this._boundHandleInteractionStart);
        document.body.addEventListener('pointerdown', this._boundHandleInteractionStart);
        
        // Add persistent "stop" listeners to the window on the CAPTURE phase
        window.removeEventListener('pointerup', this._boundHandleInteractionStop, { capture: true });
        window.addEventListener('pointerup', this._boundHandleInteractionStop, { capture: true });
        
        window.removeEventListener('pointercancel', this._boundHandleInteractionStop, { capture: true });
        window.addEventListener('pointercancel', this._boundHandleInteractionStop, { capture: true });
        
        // Add persistent "move" listener to the window
        window.removeEventListener('pointermove', this._boundHandlePointerMove);
        window.addEventListener('pointermove', this._boundHandlePointerMove, { passive: false });

        // --- Clean up old mouse/touch listeners (if any) ---
        document.body.removeEventListener('mousedown', this._boundHandleInteractionStart);
        document.body.removeEventListener('touchstart', this._boundHandleInteractionStart);
        window.removeEventListener('mouseup', this._boundHandleInteractionStop, { capture: true });
        window.removeEventListener('touchend', this._boundHandleInteractionStop, { capture: true });
        window.removeEventListener('touchcancel', this._boundHandleInteractionStop, { capture: true });
        window.removeEventListener('touchmove', this._boundHandlePointerMove);
    }

    /**
     * Master "start" handler for pointerdown, bound to document.body.
     * Delegates to the correct specific handler based on the event target.
     * @param {PointerEvent} e - The pointerdown event.
     * @private
     */
    _handleInteractionStart(e) {
        // Do not start a new action if one is already active
        if (this.activeElementId || this.stepperTarget) {
            return;
        }

        const refuelBtn = e.target.closest('#refuel-btn');
        if (refuelBtn && !refuelBtn.disabled) {
            this._startRefueling(e);
            return;
        }

        const repairBtn = e.target.closest('#repair-btn');
        if (repairBtn && !repairBtn.disabled) {
            this._startRepairing(e);
            return;
        }

        const stepperBtn = e.target.closest('.qty-stepper button');
        if (stepperBtn && !stepperBtn.disabled) {
            // For steppers, we still use the old logic
            this._startStepperHold(stepperBtn);
            return;
        }
    }

    /**
     * Master "stop" handler for pointerup/pointercancel, bound to window.
     * Delegates to the correct "stop" function based on the active state.
     * This fires on the CAPTURE phase to prevent re-renders from killing the event.
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _handleInteractionStop(e) {
        // Delegate to the correct stop function based on what is active
        if (this.activeElementId === 'refuel-btn') {
            this._stopRefueling();
        } else if (this.activeElementId === 'repair-btn') {
            this._stopRepairing();
        } else if (this.stepperTarget) {
            this._stopStepperHold();
        }
    }


     /**
     * Master "move" handler for pointermove, bound to window.
     * Stops the action if the pointer moves off the active button.
     * This is primarily for 'touch' pointer types.
     * @param {PointerEvent} e - The pointermove event.
     * @private
     */
    _handlePointerMove(e) {
        // Only run if a service button is being held
        if (this.activeElementId !== 'refuel-btn' && this.activeElementId !== 'repair-btn') {
            return;
        }

        // We only care about touch-like pointers for move-off-to-cancel
        if (e.pointerType !== 'touch') {
            return;
        }

        const elementUnderTouch = document.elementFromPoint(e.clientX, e.clientY);

        if (!elementUnderTouch) {
            // Finger likely moved off-screen, treat as release
            if (this.activeElementId === 'refuel-btn') this._stopRefueling();
            if (this.activeElementId === 'repair-btn') this._stopRepairing();
            return;
        }

        if (elementUnderTouch.classList.contains('floating-text')) {
            return; // Ignore floating text
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
     * Runs via requestAnimationFrame.
     * @param {number} timestamp - The current high-resolution timestamp.
     * @private
     */
    _loop(timestamp) {
        // Stop condition: If no service is active, kill the animation frame.
        if (!this.isRefueling && !this.isRepairing) {
            this.animationFrameId = null;
            return;
        }

        let serviceStillActive = false; // Flag to see if we should continue the loop

        // Check if enough time has passed since the last tick
        if (timestamp - this.lastTickTime >= this.holdInterval) {
            this.lastTickTime = timestamp;
            let cost = 0;

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
                    this.isRefueling = false; // Ran out of money or tank is full
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
                    this.isRepairing = false; // Ran out of money or hull is full
                }
            }

            // If both services stopped (e.g., ran out of money), remove visuals
            if (!serviceStillActive) {
                 if (!this.isRefueling && this.activeElementId === 'refuel-btn') this._removeVisualsWithDelay('fuel');
                 if (!this.isRepairing && this.activeElementId === 'repair-btn') this._removeVisualsWithDelay('repair');
            }
        }

        // Continue animation loop ONLY if a service is still set to 'true'
        // (i.e., hasn't been stopped by a 'stop' event or by running out of money/fuel)
        if (this.isRefueling || this.isRepairing) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        } else {
            this.animationFrameId = null;
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
     * This function *only* sets state. It does NOT add event listeners.
     * @param {PointerEvent} e - The pointerdown event.
     * @private
     */
    _startRefueling(e) {
        if (e.button && e.button !== 0) return; // Ignore right-clicks

        // Prevent default only for touch-like pointers
        if (e.pointerType === 'touch') {
            e.preventDefault();
        }

        this.refuelBtn = e.target.closest('#refuel-btn');
        if (!this.refuelBtn) return;

        // Explicitly set pointer capture for this element
        // This helps ensure 'pointerup' fires reliably
        try {
            this.refuelBtn.setPointerCapture(e.pointerId);
        } catch (err) {
            // This can fail if the element is removed, etc.
        }


        this.activeElementId = this.refuelBtn.id;
        this.isRefueling = true;

        this._applyVisuals('fuel'); 

        // Set last tick time to the past so the loop fires its first tick IMMEDIATELY
        this.lastTickTime = performance.now() - this.holdInterval;
        
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }

    /**
     * Stops the tap/hold process for refueling.
     * This function *only* sets state. It does NOT remove event listeners.
     * @private
     */
    _stopRefueling() {
        if (this.activeElementId !== 'refuel-btn') {
            return;
        }
        
        // Try to release pointer capture if it exists
        const btn = document.getElementById(this.activeElementId);
        if (btn && btn.hasPointerCapture(1)) { // '1' is the primary pointerId for touch/mouse
             try {
                // We don't have the original e.pointerId, but this is a best-effort
             } catch (err) {
                 // ignore
             }
        }

        this.activeElementId = null;
        this.isRefueling = false; // This will stop the loop

        this._removeVisualsWithDelay('fuel'); // Remove visuals ONCE
    }

     /**
     * Starts the tap/hold process for repairing.
     * This function *only* sets state. It does NOT add event listeners.
     * @param {PointerEvent} e - The pointerdown event.
     * @private
     */
    _startRepairing(e) {
        if (e.button && e.button !== 0) return; // Ignore right-clicks

        if (e.pointerType === 'touch') {
            e.preventDefault();
        }

        this.repairBtn = e.target.closest('#repair-btn');
        if (!this.repairBtn) return;

        // Explicitly set pointer capture for this element
        try {
            this.repairBtn.setPointerCapture(e.pointerId);
        } catch (err) {
            // console.warn("Could not set pointer capture:", err.message);
        }


        this.activeElementId = this.repairBtn.id;
        this.isRepairing = true;

        this._applyVisuals('repair');

        // Set last tick time to the past so the loop fires its first tick IMMEDIATELY
        this.lastTickTime = performance.now() - this.holdInterval;

        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }

    /**
     * Stops the tap/hold process for repairing.
     * This function *only* sets state. It does NOT remove event listeners.
     * @private
     */
    _stopRepairing() {
         if (this.activeElementId !== 'repair-btn') {
            return;
        }

        this.activeElementId = null;
        this.isRepairing = false; // This will stop the loop

        this._removeVisualsWithDelay('repair'); // Remove visuals ONCE
    }

     // --- Stepper Hold Logic (Unchanged but works with master stop handler) ---
     _startStepperHold(button) {
        this._stopStepperHold(); // Clear any previous
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
        // This function is now called by the master _handleInteractionStop
        if (!this.stepperTarget) return;

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