import { starfieldService } from '../services/ui/StarfieldService.js';

/**
 * Manages the navigation screen UI, including destination selection,
 * launch modal interactions, and the travel animation state handoffs.
 * @class NavigationController
 */
class NavigationController {
    constructor() {
        /** @type {HTMLElement|null} */
        this.navigationScreen = document.getElementById('navigation-screen');
        /** @type {HTMLElement|null} */
        this.launchModal = document.getElementById('launch-modal');
        /** @type {HTMLElement|null} */
        this.travelModal = document.getElementById('travel-modal');
        /** @type {HTMLElement|null} */
        this.launchButton = document.getElementById('btn-launch');
        /** @type {HTMLElement|null} */
        this.enterStationButton = document.getElementById('btn-enter-station');
        /** @type {HTMLElement|null} */
        this.modalBackgroundOverlay = document.getElementById('launch-modal-bg');
        
        /** @type {Object|null} */
        this.currentDestination = null;

        this._bindEvents();
    }

    /**
     * Initializes event listeners for the navigation UI elements.
     * @private
     */
    _bindEvents() {
        if (this.modalBackgroundOverlay) {
            this.modalBackgroundOverlay.addEventListener('click', (e) => {
                if (e.target === this.modalBackgroundOverlay) {
                    this.closeLaunchModal();
                }
            });
        }

        if (this.launchButton) {
            this.launchButton.addEventListener('click', () => {
                this.initiateLaunchSequence();
            });
        }

        if (this.enterStationButton) {
            this.enterStationButton.addEventListener('click', () => {
                this.handleStationArrival();
            });
        }
    }

    /**
     * Opens the launch modal for a selected destination and triggers the 
     * background starfield entry animation.
     * @param {Object} destination - The target location data object.
     */
    openLaunchModal(destination) {
        this.currentDestination = destination;
        
        // Populate modal data here (e.g., destination name, travel time, cost)
        // ...

        if (this.launchModal) {
            this.launchModal.classList.remove('hidden');
            this.launchModal.classList.add('visible');
        }

        // Mount starfield behind the modal and trigger the 1s blur-fade-in
        starfieldService.mount(document.body);
        starfieldService.triggerEntry();
    }

    /**
     * Closes the launch modal and triggers the rapid starfield exit animation.
     * Used when the player dismisses the launch sequence before committing.
     */
    closeLaunchModal() {
        this.currentDestination = null;

        if (this.launchModal) {
            this.launchModal.classList.remove('visible');
            this.launchModal.classList.add('hidden');
        }

        // Trigger the 0.4s quick dismissal fade-out
        starfieldService.triggerQuickExit();
    }

    /**
     * Executes the launch sequence. Fades out the launch modal and fades in 
     * the travel animation modal. The starfield remains mounted and running.
     */
    initiateLaunchSequence() {
        if (this.launchModal) {
            // CSS classes handle the fade transitions
            this.launchModal.classList.remove('visible');
            this.launchModal.classList.add('hidden');
        }

        if (this.travelModal) {
            this.travelModal.classList.remove('hidden');
            this.travelModal.classList.add('visible');
            
            // Ensure the travel modal sits above the starfield z-index (50)
            this.travelModal.style.zIndex = '60';
        }

        // Starfield state is deliberately untouched here to persist during travel
        this._startTravelSimulation();
    }

    /**
     * Simulates the travel delay. 
     * @private
     */
    _startTravelSimulation() {
        // Mock travel duration - replace with actual game loop/timer logic
        const travelTimeMs = 3000; 

        setTimeout(() => {
            // Activate the 'Enter Station' button upon arrival
            if (this.enterStationButton) {
                this.enterStationButton.disabled = false;
                this.enterStationButton.classList.add('active');
            }
        }, travelTimeMs);
    }

    /**
     * Handles the transition from the travel modal into the target station.
     * Triggers the arrival starfield exit animation.
     */
    handleStationArrival() {
        if (this.travelModal) {
            this.travelModal.classList.remove('visible');
            this.travelModal.classList.add('hidden');
        }

        // Trigger the 0.6s extended fade-out for station entry
        starfieldService.triggerArrivalExit();

        // Logic to load the new station environment (sol, mercury, etc.)
        // System.loadStation(this.currentDestination);
        
        this.currentDestination = null;
        if (this.enterStationButton) {
            this.enterStationButton.disabled = true;
            this.enterStationButton.classList.remove('active');
        }
    }
}

export const navigationController = new NavigationController();