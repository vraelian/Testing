/**
 * UISolStationControl.js
 * * Controller for the Sol Station UI.
 * Handles user interactions (Lever, Buttons) and updates the view via StationRenderer.
 */

import { SolStationService } from '../SolStationService.js';
import { StationRenderer } from '../../ui/renderers/StationRenderer.js';
import { UIModalEngine } from './UIModalEngine.js';

export class UISolStationControl {
    constructor() {
        this.renderer = new StationRenderer();
        this.updateInterval = null;
    }

    initialize() {
        // Initial Render
        const state = SolStationService.getStationState();
        this.renderer.render('main-content-area', state);
        
        this.attachEventListeners();
        this.startUpdateLoop();
    }

    attachEventListeners() {
        // 1. Mode Lever (Toggle Switch)
        const toggle = document.getElementById('sol-mode-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.handleModeToggle();
            });
        }

        // 2. Navigation Buttons
        const btnMaint = document.getElementById('btn-sol-maintenance');
        if (btnMaint) {
            btnMaint.addEventListener('click', () => {
                // Placeholder for Phase 2: Maintenance Modal
                console.log('Open Maintenance Modal'); 
                // UIModalEngine.showMaintenanceModal(); // Future
            });
        }

        const btnDir = document.getElementById('btn-sol-directorate');
        if (btnDir) {
            btnDir.addEventListener('click', () => {
                // Placeholder for Phase 3: Directorate Modal
                console.log('Open Directorate Modal');
            });
        }
        
        const btnTrade = document.getElementById('btn-sol-trade');
        if (btnTrade) {
            btnTrade.addEventListener('click', () => {
               console.log('Open Trade Modal');
            });
        }
    }

    handleModeToggle() {
        const newState = SolStationService.toggleMode(); // Assumes Service has this method
        
        // Immediate UI feedback
        this.updateUI(newState);
        
        // Play Sound (Optional/Future)
        // AudioService.play('switch_toggle');
    }

    startUpdateLoop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        
        // Update UI every second to reflect Entropy/Passive Income changes
        this.updateInterval = setInterval(() => {
            const state = SolStationService.getStationState();
            this.updateUI(state);
        }, 1000);
    }

    stop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
    }

    updateUI(state) {
        // We do a targeted DOM update instead of full re-render to preserve animations
        
        // 1. Update Lever State
        const toggle = document.getElementById('sol-mode-toggle');
        const statusText = document.querySelector('.station-status-text');
        const helpText = document.querySelector('.lever-help-text');
        
        if (toggle && state) {
             const isOverdrive = state.mode === 'overdrive';
             
             // Update Toggle Class
             if (isOverdrive) toggle.classList.add('toggled-on');
             else toggle.classList.remove('toggled-on');

             // Update Labels (Optional, if we want to change text color dynamically)
             const labels = document.querySelectorAll('.lever-label');
             if(labels.length >= 2) {
                 labels[0].classList.toggle('active-text', !isOverdrive);
                 labels[1].classList.toggle('danger-text', isOverdrive);
             }
             
             // Update Status Text
             if(statusText) {
                 statusText.innerHTML = `STATUS: <span class="status-indicator ${isOverdrive ? 'status-critical' : 'status-optimal'}">${isOverdrive ? 'OVERDRIVE' : 'NOMINAL'}</span>`;
             }
             
             // Update Help Text
             if(helpText) {
                 helpText.textContent = isOverdrive ? 'WARNING: ENTROPY ACCELERATED' : 'STATION SYSTEMS STABLE';
             }
        }

        // 2. Update Bars
        const entropyFill = document.querySelector('.entropy-fill');
        const xpFill = document.querySelector('.xp-fill');
        
        if (entropyFill && state.entropy !== undefined) {
            entropyFill.style.width = `${state.entropy}%`;
            const entropyVal = document.querySelector('.metric-value.danger-text');
            if(entropyVal) entropyVal.textContent = `${state.entropy.toFixed(1)}%`;
        }
        
        if (xpFill && state.xpProgress !== undefined) {
            xpFill.style.width = `${state.xpProgress}%`;
        }

        // 3. Update Bank
        // Note: Using a helper or direct select
        const amVal = document.querySelector('.readout-box.antimatter-box .readout-value');
        const crVal = document.querySelector('.readout-box.credits-box .readout-value');
        
        if (amVal && state.antimatter !== undefined) amVal.innerHTML = `${state.antimatter.toLocaleString()} <span class="unit">AM</span>`;
        if (crVal && state.credits !== undefined) crVal.innerHTML = `${state.credits.toLocaleString()} <span class="unit">CR</span>`;
    }
}