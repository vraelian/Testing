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
 * 4. Stopping the loop on mouseup/touchend/touchcancel, OR when a touch drags off the element.
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

        /** @type {HTMLElement | null} */
        this.activeElement = null; // Store the element being held
        
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

        this._boundLoop = this._loop.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this); // Bind new move handler
    }

    /**
     * Binds all hold-to-act event listeners to the buttons.
     */
    bindHoldEvents() {
        this.refuelBtn = document.getElementById('refuel-btn');
        this.repairBtn = document.getElementById('repair-btn');

        if (this.refuelBtn) {
            this.refuelBtn.addEventListener('mousedown', this._startRefueling.bind(this));
            this.refuelBtn.addEventListener('touchstart', this._startRefueling.bind(this), { passive: false });
            this.refuelBtn.addEventListener('mouseup', this._stopRefueling.bind(this));
            this.refuelBtn.addEventListener('touchend', this._stopRefueling.bind(this));
            this.refuelBtn.addEventListener('touchcancel', this._stopRefueling.bind(this));
            // MODIFIED: Removed 'mouseleave' - it causes the "jitter" bug on simulators
        }

        if (this.repairBtn) {
            this.repairBtn.addEventListener('mousedown', this._startRepairing.bind(this));
            this.repairBtn.addEventListener('touchstart', this._startRepairing.bind(this), { passive: false });
            this.repairBtn.addEventListener('mouseup', this._stopRepairing.bind(this));
            this.repairBtn.addEventListener('touchend', this._stopRepairing.bind(this));
            this.repairBtn.addEventListener('touchcancel', this._stopRepairing.bind(this));
            // MODIFIED: Removed 'mouseleave'
        }
    }

    /**
     * MODIFIED: Handles the touchmove event to robustly detect if the user's
     * finger has dragged off the active button, preventing "sticky" buttons.
     * @param {TouchEvent} e - The touchmove event.
     * @private
     */
    _handleTouchMove(e) {
        if (!this.activeElement) return;

        const touch = e.touches[0];
        if (!touch) return;

        // Get the element *currently* under the touch point
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);

        if (!elementUnderTouch) {
            return; // Ignore jitter or off-screen moves
        }

        // *** MODIFICATION ***
        // Ignore floating text elements, as they can appear under the
        // finger and incorrectly trigger a "drag off" event.
        if (elementUnderTouch.classList.contains('floating-text')) {
            return; 
        }

        // Check if the element is the active button OR a child of the active button
        if (elementUnderTouch === this.activeElement || this.activeElement.contains(elementUnderTouch)) {
            return; // Finger is still on the button.
        }

        // Finger has definitively moved off the button.
        // Stop the correct service.
        if (this.isRefueling || this.holdTimers.fuel) {
            this._stopRefueling();
        }
        if (this.isRepairing || this.holdTimers.repair) {
            this._stopRepairing();
        }
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

        if (timestamp - this.lastTickTime > this.holdInterval) {
            this.lastTickTime = timestamp;
            let cost = 0;

            if (this.isRefueling) {
                cost = this.playerActionService.refuelTick();
                if (cost > 0) {
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.refuelBtn.getBoundingClientRect().x + (this.refuelBtn.offsetWidth / 2), this.refuelBtn.getBoundingClientRect().y, '#f87171');
                } else {
                    // MODIFIED: Fix for "Stuck On" (Clue A)
                    // Just stop the loop. Do NOT call _stopRefueling().
                    // Visuals will fade out on user's release (touchend/mouseup).
                    this.isRefueling = false;
                }
            }

            if (this.isRepairing) {
                cost = this.playerActionService.repairTick();
                if (cost > 0) {
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.repairBtn.getBoundingClientRect().x + (this.repairBtn.offsetWidth / 2), this.repairBtn.getBoundingClientRect().y, '#f87171');
                } else {
                    // MODIFIED: Fix for "Stuck On" (Clue A)
                    this.isRepairing = false;
                }
            }
        }

        this.animationFrameId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Applies active visual classes to a service module.
     * @param {string} type - 'fuel' or 'repair'
     * @private
     */
    _applyVisuals(type) {
        // Clear any pending *stop* timer to prevent a fade-out from colliding with a new press
        if (type === 'fuel' && this.stopTimers.fuel) {
            clearTimeout(this.stopTimers.fuel);
            this.stopTimers.fuel = null;
        }
        if (type === 'repair' && this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
            this.stopTimers.repair = null;
        }

        const btn = type === 'fuel' ? this.refuelBtn : this.repairBtn;
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
     * Removes active visual classes from a service module.
     * @param {string} type - 'fuel' or 'repair'
     * @private
     */
    _removeVisuals(type) {
        const btn = type === 'fuel' ? this.refuelBtn : this.repairBtn;
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
     * MODIFIED: Starts the tap/hold process for refueling.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRefueling(e) {
        if (this.activeElement || (e.button && e.button !== 0)) return;
        e.preventDefault();

        this.activeElement = e.currentTarget;
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
        }

        // Perform single tick *immediately*
        const cost = this.playerActionService.refuelTick();

        // MODIFIED: Fix for "Activates on MAX" (Clue B)
        if (cost <= 0) {
            // MAX or no credits. Do nothing. No visuals, no loop.
            // We must clean up the listeners in case this was a drag-off.
            document.removeEventListener('touchmove', this._handleTouchMove);
            this.activeElement = null;
            return;
        }

        // Cost was > 0, so proceed.
        this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.refuelBtn.getBoundingClientRect().x + (this.refuelBtn.offsetWidth / 2), this.refuelBtn.getBoundingClientRect().y, '#f87171');
        this._applyVisuals('fuel');

        // MODIFIED: Fix for "Sticky Tap" (Clue C)
        // Set a timer to see if this is a tap or a hold.
        this.holdTimers.fuel = setTimeout(() => {
            this.isRefueling = true; // It's a hold!
            
            // *** MODIFICATION ***
            // Set lastTickTime to 0 to force the loop to fire a tick
            // on its very first frame, matching the "rapid fire" expectation.
            this.lastTickTime = 0; 
            
            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(this._boundLoop);
            }
            this.holdTimers.fuel = null;
        }, this.holdDelay);
    }

    /**
     * MODIFIED: Stops the tap/hold process for refueling.
     * @private
     */
    _stopRefueling() {
        if (!this.activeElement || this.activeElement.id !== 'refuel-btn') {
            return;
        }

        document.removeEventListener('touchmove', this._handleTouchMove);
        this.activeElement = null;

        // MODIFIED: Fix for "Sticky Tap" (Clue C)
        if (this.holdTimers.fuel) {
            // User released *before* holdDelay. This was a TAP.
            clearTimeout(this.holdTimers.fuel);
            this.holdTimers.fuel = null;
        }

        // This was a HOLD. Stop the loop.
        this.isRefueling = false; 

        // MODIFIED: Fix for "Stuck On" (Clue A)
        // Always set a timer to remove visuals on release.
        if (this.stopTimers.fuel) {
            clearTimeout(this.stopTimers.fuel);
        }
        this.stopTimers.fuel = setTimeout(() => {
            this._removeVisuals('fuel');
            this.stopTimers.fuel = null;
        }, 400); // 400ms fade-out
    }

    /**
     * MODIFIED: Starts the tap/hold process for repairing.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRepairing(e) {
        if (this.activeElement || (e.button && e.button !== 0)) return;
        e.preventDefault();

        this.activeElement = e.currentTarget;
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
        }

        // Perform single tick *immediately*
        const cost = this.playerActionService.repairTick();

        // MODIFIED: Fix for "Activates on MAX" (Clue B)
        if (cost <= 0) {
            document.removeEventListener('touchmove', this._handleTouchMove);
            this.activeElement = null;
            return;
        }

        // Cost was > 0
        this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.repairBtn.getBoundingClientRect().x + (this.repairBtn.offsetWidth / 2), this.repairBtn.getBoundingClientRect().y, '#f87171');
        this._applyVisuals('repair');

        // MODIFIED: Fix for "Sticky Tap" (Clue C)
        this.holdTimers.repair = setTimeout(() => {
            this.isRepairing = true; // It's a hold!

            // *** MODIFICATION ***
            // Set lastTickTime to 0 to force an immediate loop tick.
            this.lastTickTime = 0; 

            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(this._boundLoop);
            }
            this.holdTimers.repair = null;
        }, this.holdDelay);
    }

    /**
     * MODIFIED: Stops the tap/hold process for repairing.
     * @private
     */
    _stopRepairing() {
        if (!this.activeElement || this.activeElement.id !== 'repair-btn') {
            return;
        }

        document.removeEventListener('touchmove', this._handleTouchMove);
        this.activeElement = null;

        // MODIFIED: Fix for "Sticky Tap" (Clue C)
        if (this.holdTimers.repair) {
            // This was a TAP.
            clearTimeout(this.holdTimers.repair);
            this.holdTimers.repair = null;
        }

        // This was a HOLD.
        this.isRepairing = false; 

        // MODIFIED: Fix for "Stuck On" (Clue A)
        if (this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
        }
        this.stopTimers.repair = setTimeout(() => {
            this._removeVisuals('repair');
            this.stopTimers.repair = null;
        }, 400); // 400ms fade-out
    }
}