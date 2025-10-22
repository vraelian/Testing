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
        
        this.holdInterval = 100; // Milliseconds between service ticks
        this.lastTickTime = 0;
        this.animationFrameId = null;

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
            this.refuelBtn.addEventListener('touchstart', this._startRefueling.bind(this), { passive: true });
            this.refuelBtn.addEventListener('mouseup', this._stopRefueling.bind(this));
            this.refuelBtn.addEventListener('touchend', this._stopRefueling.bind(this));
            this.refuelBtn.addEventListener('mouseleave', this._stopRefueling.bind(this));
        }

        if (this.repairBtn) {
            this.repairBtn.addEventListener('mousedown', this._startRepairing.bind(this));
            this.repairBtn.addEventListener('touchstart', this._startRepairing.bind(this), { passive: true });
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
     * Starts the refueling process and visual feedback.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRefueling(e) {
        if (this.isRefueling || (e.button && e.button !== 0)) return;
        e.preventDefault();

        this.isRefueling = true;
        this.lastTickTime = performance.now();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }

        // --- Add Visual Feedback ---
        if (this.refuelBtn) {
            this.refuelBtn.classList.add('holding');
            const serviceModule = this.refuelBtn.closest('.service-module');
            if (serviceModule) serviceModule.classList.add('active-service');
            
            const progressBarFill = document.getElementById('fuel-bar');
            if (progressBarFill) {
                progressBarFill.classList.add('filling');
                const progressBarContainer = progressBarFill.closest('.progress-bar-container');
                if (progressBarContainer) progressBarContainer.classList.add('active-pulse');
            }
        }
        // --- End Visual Feedback ---
    }

    /**
     * Stops the refueling process and removes visual feedback.
     * @private
     */
    _stopRefueling() {
        if (!this.isRefueling) return;
        this.isRefueling = false;

        // --- Remove Visual Feedback ---
        if (this.refuelBtn) {
            this.refuelBtn.classList.remove('holding');
            const serviceModule = this.refuelBtn.closest('.service-module');
            if (serviceModule) serviceModule.classList.remove('active-service');

            const progressBarFill = document.getElementById('fuel-bar');
            if (progressBarFill) {
                progressBarFill.classList.remove('filling');
                const progressBarContainer = progressBarFill.closest('.progress-bar-container');
                if (progressBarContainer) progressBarContainer.classList.remove('active-pulse');
            }
        }
        // --- End Visual Feedback ---
    }

    /**
     * Starts the repairing process and visual feedback.
     * @param {Event} e - The mousedown or touchstart event.
     * @private
     */
    _startRepairing(e) {
        if (this.isRepairing || (e.button && e.button !== 0)) return;
        e.preventDefault();

        this.isRepairing = true;
        this.lastTickTime = performance.now();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }

        // --- Add Visual Feedback ---
        if (this.repairBtn) {
            this.repairBtn.classList.add('holding');
            const serviceModule = this.repairBtn.closest('.service-module');
            if (serviceModule) serviceModule.classList.add('active-service');
            
            const progressBarFill = document.getElementById('repair-bar');
            if (progressBarFill) {
                progressBarFill.classList.add('filling');
                const progressBarContainer = progressBarFill.closest('.progress-bar-container');
                if (progressBarContainer) progressBarContainer.classList.add('active-pulse');
            }
        }
        // --- End Visual Feedback ---
    }

    /**
     * Stops the repairing process and removes visual feedback.
     * @private
     */
    _stopRepairing() {
        if (!this.isRepairing) return;
        this.isRepairing = false;

        // --- Remove Visual Feedback ---
        if (this.repairBtn) {
            this.repairBtn.classList.remove('holding');
            const serviceModule = this.repairBtn.closest('.service-module');
            if (serviceModule) serviceModule.classList.remove('active-service');

            const progressBarFill = document.getElementById('repair-bar');
            if (progressBarFill) {
                progressBarFill.classList.remove('filling');
                const progressBarContainer = progressBarFill.closest('.progress-bar-container');
                if (progressBarContainer) progressBarContainer.classList.remove('active-pulse');
            }
        }
        // --- End Visual Feedback ---
    }
}