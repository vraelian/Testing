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
 * 4. Stopping the loop on mouseup/touchend/mouseleave events.
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

        // MODIFIED: Added timers to manage delayed visual removal
        this.stopTimers = {
            fuel: null,
            repair: null
        };

        this._boundLoop = this._loop.bind(this);
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
            this.refuelBtn.addEventListener('touchstart', this._startRefueling.bind(this), { passive: false }); // passive: false to allow preventDefault
            this.refuelBtn.addEventListener('mouseup', this._stopRefueling.bind(this));
            this.refuelBtn.addEventListener('touchend', this._stopRefueling.bind(this));
            this.refuelBtn.addEventListener('mouseleave', this._stopRefueling.bind(this));
        }

        if (this.repairBtn) {
            this.repairBtn.addEventListener('mousedown', this._startRepairing.bind(this));
            this.repairBtn.addEventListener('touchstart', this._startRepairing.bind(this), { passive: false }); // passive: false to allow preventDefault
            this.repairBtn.addEventListener('mouseup', this._stopRepairing.bind(this));
            this.repairBtn.addEventListener('touchend', this._stopRepairing.bind(this));
            this.repairBtn.addEventListener('mouseleave', this._stopRepairing.bind(this));
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
                    this._stopRefueling(); // Stop if refuelTick returns 0 (e.g., full or no funds)
                }
            }

            if (this.isRepairing) {
                cost = this.playerActionService.repairTick();
                if (cost > 0) {
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.repairBtn.getBoundingClientRect().x + (this.repairBtn.offsetWidth / 2), this.repairBtn.getBoundingClientRect().y, '#f87171');
                } else {
                    this._stopRepairing(); // Stop if repairTick returns 0 (e.g., full or no funds)
                }
            }
        }

        this.animationFrameId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * MODIFIED: Applies active visual classes to a service module.
     * @param {string} type - 'fuel' or 'repair'
     * @private
     */
    _applyVisuals(type) {
        const btn = type === 'fuel' ? this.refuelBtn : this.repairBtn;
        const barId = type === 'fuel' ? 'fuel-bar' : 'repair-bar';

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
     * MODIFIED: Removes active visual classes from a service module.
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
        if (this.isRefueling || (e.button && e.button !== 0)) return;
        e.preventDefault();

        // MODIFIED: Clear any pending stop timer to keep visuals active
        if (this.stopTimers.fuel) {
            clearTimeout(this.stopTimers.fuel);
            this.stopTimers.fuel = null;
        }

        // Perform single tick on tap
        const cost = this.playerActionService.refuelTick();
        if (cost > 0) {
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.refuelBtn.getBoundingClientRect().x + (this.refuelBtn.offsetWidth / 2), this.refuelBtn.getBoundingClientRect().y, '#f87171');
            // MODIFIED: Apply visuals immediately
            this._applyVisuals('fuel');
        } else {
            return; // Stop if full or no funds, prevents hold visual state
        }

        this.isRefueling = true;
        this.lastTickTime = performance.now();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
        
        // MODIFIED: Visual feedback logic moved to _applyVisuals
    }

    /**
     * Stops the refueling process and removes visual feedback.
     * @private
     */
    _stopRefueling() {
        if (!this.isRefueling) return;
        this.isRefueling = false;

        // MODIFIED: Do not remove visuals immediately. Set a timer.
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
        if (this.isRepairing || (e.button && e.button !== 0)) return;
        e.preventDefault();

        // MODIFIED: Clear any pending stop timer to keep visuals active
        if (this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
            this.stopTimers.repair = null;
        }

        // Perform single tick on tap
        const cost = this.playerActionService.repairTick();
        if (cost > 0) {
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, this.repairBtn.getBoundingClientRect().x + (this.repairBtn.offsetWidth / 2), this.repairBtn.getBoundingClientRect().y, '#f87171');
            // MODIFIED: Apply visuals immediately
            this._applyVisuals('repair');
        } else {
            return; // Stop if full or no funds, prevents hold visual state
        }

        this.isRepairing = true;
        this.lastTickTime = performance.now();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }

        // MODIFIED: Visual feedback logic moved to _applyVisuals
    }

    /**
     * Stops the repairing process and removes visual feedback.
     * @private
     */
    _stopRepairing() {
        if (!this.isRepairing) return;
        this.isRepairing = false;

        // MODIFIED: Do not remove visuals immediately. Set a timer.
        if (this.stopTimers.repair) {
            clearTimeout(this.stopTimers.repair);
        }
        this.stopTimers.repair = setTimeout(() => {
            this._removeVisuals('repair');
            this.stopTimers.repair = null;
        }, 400); // Keep visuals active for 400ms
    }
}