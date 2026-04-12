// js/services/handlers/HoldEventHandler.js

import { formatCredits } from '../../utils.js';

export class HoldEventHandler {
    constructor(playerActionService, uiManager) {
        this.playerActionService = playerActionService;
        this.uiManager = uiManager;

        this.refuelBtn = null;
        this.repairBtn = null;

        this.isRefueling = false;
        this.isRepairing = false;

        this.holdInterval = 400;

        this.lastTickTime = 0;
        this.animationFrameId = null;

        this.activeElementId = null;

        this.stopTimers = {
            fuel: null,
            repair: null
        };

        this._boundHandleInteractionStart = this._handleInteractionStart.bind(this);
        this._boundHandleInteractionStop = this._handleInteractionStop.bind(this);
        this._boundHandlePointerMove = this._handlePointerMove.bind(this);

        this._boundLoop = this._loop.bind(this);
        this._boundStartRefueling = this._startRefueling.bind(this);
        this._boundStopRefueling = this._stopRefueling.bind(this);
        this._boundStartRepairing = this._startRepairing.bind(this);
        this._boundStopRepairing = this._stopRepairing.bind(this);
        this._boundStopStepperHold = this._stopStepperHold.bind(this);
        
        this.isStepperHolding = false;
        this.stepperInitialDelay = 400;
        this.stepperRepeatRate = 1000 / 7;
        this.stepperTimeout = null;
        this.stepperInterval = null;
        this.stepperStartTime = null;
        this.stepperTarget = null;
    }

    bindHoldEvents() {
        document.body.removeEventListener('pointerdown', this._boundHandleInteractionStart);
        document.body.addEventListener('pointerdown', this._boundHandleInteractionStart);
        
        window.removeEventListener('pointerup', this._boundHandleInteractionStop, { capture: true });
        window.addEventListener('pointerup', this._boundHandleInteractionStop, { capture: true });
        
        window.removeEventListener('pointercancel', this._boundHandleInteractionStop, { capture: true });
        window.addEventListener('pointercancel', this._boundHandleInteractionStop, { capture: true });
        
        window.removeEventListener('pointermove', this._boundHandlePointerMove);
        window.addEventListener('pointermove', this._boundHandlePointerMove, { passive: false });

        document.body.removeEventListener('mousedown', this._boundHandleInteractionStart);
        document.body.removeEventListener('touchstart', this._boundHandleInteractionStart);
        window.removeEventListener('mouseup', this._boundHandleInteractionStop, { capture: true });
        window.removeEventListener('touchend', this._boundHandleInteractionStop, { capture: true });
        window.removeEventListener('touchcancel', this._boundHandleInteractionStop, { capture: true });
        window.removeEventListener('touchmove', this._boundHandlePointerMove);
    }

    _handleInteractionStart(e) {
        if (this.activeElementId || this.stepperTarget) {
            return;
        }

        const refuelBtn = e.target.closest('#refuel-btn');
        if (refuelBtn) {
            // --- CONTAMINATED FUEL INTERCEPT ---
            if (refuelBtn.dataset.contaminated === 'true') {
                const rect = refuelBtn.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top;
                this.uiManager.createFloatingText('Contaminated Fuel Lines', x, y, '#ef4444', 2000, false);
                return; // Stop hold logic immediately
            }
            
            if (!refuelBtn.disabled) {
                this._startRefueling(e);
                return;
            }
        }

        const repairBtn = e.target.closest('#repair-btn');
        if (repairBtn && !repairBtn.disabled) {
            this._startRepairing(e);
            return;
        }

        const stepperBtn = e.target.closest('.qty-stepper button');
        if (stepperBtn && !stepperBtn.disabled) {
            if (e.pointerType === 'touch') {
                e.preventDefault();
            }
            this._startStepperHold(e, stepperBtn);
            return;
        }
    }

    _handleInteractionStop(e) {
        if (this.activeElementId === 'refuel-btn') {
            this._stopRefueling();
        } else if (this.activeElementId === 'repair-btn') {
            this._stopRepairing();
        } else if (this.stepperTarget) {
            this._stopStepperHold();
        }
    }

    _handlePointerMove(e) {
        if (this.activeElementId !== 'refuel-btn' && this.activeElementId !== 'repair-btn') {
            return;
        }

        if (e.pointerType !== 'touch') {
            return;
        }

        const elementUnderTouch = document.elementFromPoint(e.clientX, e.clientY);

        if (!elementUnderTouch) {
            if (this.activeElementId === 'refuel-btn') this._stopRefueling();
            if (this.activeElementId === 'repair-btn') this._stopRepairing();
            return;
        }

        if (elementUnderTouch.classList.contains('floating-text')) {
            return; 
        }

        const currentActiveButton = document.getElementById(this.activeElementId);
        if (elementUnderTouch === currentActiveButton || (currentActiveButton && currentActiveButton.contains(elementUnderTouch))) {
            return; 
        }

        if (this.activeElementId === 'refuel-btn') this._stopRefueling();
        if (this.activeElementId === 'repair-btn') this._stopRepairing();
    }

    _loop(timestamp) {
        if (!this.isRefueling && !this.isRepairing) {
            this.animationFrameId = null;
            return;
        }

        let serviceStillActive = false; 

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
                    this.isRefueling = false; 
                }
            }

            if (this.isRepairing) {
                cost = this.playerActionService.repairTick();
                this._applyVisuals('repair');
                
                if (cost > 0 && this.repairBtn) {
                    const rect = this.repairBtn.getBoundingClientRect();
                    this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
                    
                    setTimeout(() => {
                        this.uiManager.createFloatingText("+1 Day", rect.left + (rect.width / 2), rect.top - 20, '#60a5fa');
                    }, 150);

                    serviceStillActive = true;
                } else {
                    this.isRepairing = false; 
                }
            }

            if (!serviceStillActive) {
                 if (!this.isRefueling && this.activeElementId === 'refuel-btn') this._removeVisualsWithDelay('fuel');
                 if (!this.isRepairing && this.activeElementId === 'repair-btn') this._removeVisualsWithDelay('repair');
            }
        }

        if (this.isRefueling || this.isRepairing) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        } else {
            this.animationFrameId = null;
        }
    }

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

    _startRefueling(e) {
        if (e.button && e.button !== 0) return; 

        if (e.pointerType === 'touch') {
            e.preventDefault();
        }

        this.refuelBtn = e.target.closest('#refuel-btn');
        if (!this.refuelBtn) return;

        try {
            this.refuelBtn.setPointerCapture(e.pointerId);
        } catch (err) {}

        this.activeElementId = this.refuelBtn.id;
        this.isRefueling = true;

        this._applyVisuals('fuel'); 

        this.lastTickTime = performance.now() - this.holdInterval;
        
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }

    _stopRefueling() {
        if (this.activeElementId !== 'refuel-btn') {
            return;
        }
        
        const btn = document.getElementById(this.activeElementId);
        if (btn && btn.hasPointerCapture(1)) { 
             try {} catch (err) {}
        }

        this.activeElementId = null;
        this.isRefueling = false; 

        this._removeVisualsWithDelay('fuel'); 
    }

    _startRepairing(e) {
        if (e.button && e.button !== 0) return; 

        if (e.pointerType === 'touch') {
            e.preventDefault();
        }

        this.repairBtn = e.target.closest('#repair-btn');
        if (!this.repairBtn) return;

        try {
            this.repairBtn.setPointerCapture(e.pointerId);
        } catch (err) {}

        this.activeElementId = this.repairBtn.id;
        this.isRepairing = true;

        this._applyVisuals('repair');

        this.lastTickTime = performance.now() - this.holdInterval;

        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._boundLoop);
        }
    }

    _stopRepairing() {
         if (this.activeElementId !== 'repair-btn') {
            return;
        }

        this.activeElementId = null;
        this.isRepairing = false; 

        this._removeVisualsWithDelay('repair'); 
    }

     _startStepperHold(e, button) {
        this._stopStepperHold(); 
        this.isStepperHolding = false;

        const controls = button.closest('.transaction-controls');
        if (!controls) return;

        try {
            button.setPointerCapture(e.pointerId);
        } catch (err) {}

        e.preventDefault();

        const qtyStepperEl = button.closest('.qty-stepper');
        const qtyInput = controls.querySelector('input');
        const direction = button.classList.contains('qty-up') ? 1 : -1;
        
        this.stepperTarget = {
            input: qtyInput,
            direction: direction,
            element: qtyStepperEl,
            button: button,
            pointerId: e.pointerId
        };

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
        if (!this.stepperTarget) return;

        if (this.stepperTarget.button && this.stepperTarget.button.hasPointerCapture(this.stepperTarget.pointerId)) {
            try {
                this.stepperTarget.button.releasePointerCapture(this.stepperTarget.pointerId);
            } catch (err) {}
        }

        clearTimeout(this.stepperTimeout);
        clearInterval(this.stepperInterval);

        if (this.stepperTarget.element) {
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