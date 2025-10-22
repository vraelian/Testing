// js/services/handlers/HoldEventHandler.js
/**
 * @fileoverview This file defines the HoldEventHandler class, which manages
 * the "hold-to-act" functionality for UI elements like refueling and repairing.
 * It uses a requestAnimationFrame loop to repeatedly call an action (like
 * refueling) as long as the button is held down.
 *
 * This handler is responsible for:
 * 1. Detecting mousedown/touchstart events on target buttons.
 * 2. Initiating a "hold" state and a requestAnimationFrame loop.
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

        this.isRefueling = false;
        this.isRepairing = false;
        
        this.holdInterval = 400; // Milliseconds between service ticks
        this.lastTickTime = 0;
        this.animationFrameId = null;

        /** @type {HTMLElement | null} */
        this.activeElement = null; // Store the element being held

        this.stopTimers = {
            fuel: null,
            repair: null
        };

        this._boundLoop = this._loop.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this); // Bind new move handler
    }

    /**
     * Binds all hold-to-act event listeners to the buttons.
     * This function is called every time the UI is rendered to ensure
     * listeners are attached to the new DOM elements.
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
            // MODIFIED: Removed 'mouseleave' as it's unreliable on touch/simulators
        }

        if (this.repairBtn) {
            this.repairBtn.addEventListener('mousedown', this._startRepairing.bind(this));
            this.repairBtn.addEventListener('touchstart', this._startRepairing.bind(this), { passive: false });
            this.repairBtn.addEventListener('mouseup', this._stopRepairing.bind(this));
            this.repairBtn.addEventListener('touchend', this._stopRepairing.bind(this));
            this.repairBtn.addEventListener('touchcancel', this._stopRepairing.bind(this));
            // MODIFIED: Removed 'mouseleave' as it's unreliable on touch/simulators
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

        // If elementUnderTouch is null, it's a "jitter" or off-screen.
        // In this case, we'll just ignore it and *not* stop the hold.
        if (!elementUnderTouch) {
            return;
        }

        // Check if the element is the active button OR a child of the active button
        if (elementUnderTouch === this.activeElement || this.activeElement.contains(elementUnderTouch)) {
            // Finger is still on the button. Do nothing.
            return;
        }

        // If we are here, the finger has *definitively* moved off the button.
        // Stop the correct service.
        if (this.isRefueling) {
            this._stopRefueling();
        }
        if (this.isRepairing) {
            this._stopRepairing();
        }
    }

    /**
     * The main game loop for handling hold actions.
     * This is called by requestAnimationFrame.
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
                    this.isRefueling = false; // Stop function, but not visuals
                }
            }

            if (this.isRepairing) {
                cost = this.playerActionService.repairTick();
                if (cost > 0) {
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.repairBtn.getBoundingClientRect().x + (this.repairBtn.offsetWidth / 2), this.repairBtn.getBoundingClientRect().y, '#f87171');
                } else {
                    this.isRepairing = false; // Stop function, but not visuals
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
     * Starts the refueling process and visual feedback.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRefueling(e) {
        // MODIFIED: Prevent flicker loop. Only start if not already active.
        if (this.activeElement || (e.button && e.button !== 0)) return;
        e.preventDefault();

        this.activeElement = e.currentTarget; // Set active element

        // MODIFIED: Add touchmove listener only for touch events
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
        }

        if (this.stopTimers.fuel) {
            clearTimeout(this.stopTimers.fuel);
            this.stopTimers.fuel = null;
        }

        // Perform single tick on tap
        const cost = this.playerActionService.refuelTick();
        if (cost > 0) {
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.refuelBtn.getBoundingClientRect().x + (this.refuelBtn.offsetWidth / 2), this.refuelBtn.getBoundingClientRect().y, '#f87171');
            this._applyVisuals('fuel');
        } else {
            this._applyVisuals('fuel'); // Still apply visuals on tap, even if full
            this.isRefueling = false; // But don't start the loop
            return; // Stop if full or no funds
        }

        this.isRefueling = true;
        this.lastTickTime = performance.now();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }

    /**
     * Stops the refueling process and removes visual feedback.
     * @private
     */
    _stopRefueling() {
        // MODIFIED: Only stop if this was the active element.
        if (!this.activeElement || this.activeElement.id !== 'refuel-btn') {
            return;
        }

        // MODIFIED: Always clean up listeners
        document.removeEventListener('touchmove', this._handleTouchMove);
        this.activeElement = null; // Clear active element
        
        this.isRefueling = false;

        if (this.stopTimers.fuel) {
            clearTimeout(this.stopTimers.fuel);
        }
        this.stopTimers.fuel = setTimeout(() => {
            this._removeVisuals('fuel');
            this.stopTimers.fuel = null;
        }, 400); // Keep visuals active for 400ms
    }

    /**
     * Starts the repairing process and visual feedback.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRepairing(e) {
        // MODIFIED: Prevent flicker loop. Only start if not already active.
        if (this.activeElement || (e.button && e.button !== 0)) return;
        e.preventDefault();

        this.activeElement = e.currentTarget; // Set active element

        // MODIFIED: Add touchmove listener only for touch events
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
        }

        if (this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
            this.stopTimers.repair = null;
        }

        // Perform single tick on tap
        const cost = this.playerActionService.repairTick();
        if (cost > 0) {
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.repairBtn.getBoundingClientRect().x + (this.repairBtn.offsetWidth / 2), this.repairBtn.getBoundingClientRect().y, '#f87171');
            this._applyVisuals('repair');
        } else {
            this._applyVisuals('repair'); // Still apply visuals on tap, even if full
            this.isRepairing = false; // But don't start the loop
            return; // Stop if full or no funds
        }

        this.isRepairing = true;
        this.lastTickTime = performance.now();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }

    /**
     * Stops the repairing process and removes visual feedback.
     * @private
     */
    _stopRepairing() {
        // MODIFIED: Only stop if this was the active element.
        if (!this.activeElement || this.activeElement.id !== 'repair-btn') {
            return;
        }
        
        // MODIFIED: Always clean up listeners
        document.removeEventListener('touchmove', this._handleTouchMove);
        this.activeElement = null; // Clear active element

        this.isRepairing = false;

        if (this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
        }
        this.stopTimers.repair = setTimeout(() => {
            this._removeVisuals('repair');
            this.stopTimers.repair = null;
        }, 400); // Keep visuals active for 400ms
    }
}