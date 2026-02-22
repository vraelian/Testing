// js/services/ui/UITutorialManager.js

/**
 * @fileoverview Domain Controller for the interactive tutorial system.
 * Handles dual-mode rendering (Safe Zone vs Targeted), the Ghost Hunter 
 * MutationObserver for virtualized lists, and Spotlight masking.
 */

export class UITutorialManager {
    /**
     * @param {import('../UIManager.js').UIManager} uiManager The master UI Facade.
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
        
        // State tracking for cleanup
        this.popperInstance = null;
        this.mutationObserver = null;
        this.ghostHunterTimeout = null;
        this.activeTargetElement = null;
        this.activeToastElement = null;
        this.activeSpotlightMask = null;

        this._initSafeZone();
    }

    /**
     * Ensures the Safe Zone container exists in the DOM for Mode A rendering.
     * @private
     */
    _initSafeZone() {
        let safeZone = document.getElementById('tt-safe-zone');
        if (!safeZone) {
            safeZone = document.createElement('div');
            safeZone.id = 'tt-safe-zone';
            safeZone.className = 'tt-safe-zone';
            document.body.appendChild(safeZone);
        }
        this.safeZone = safeZone;
    }

    /**
     * Renders a tutorial step based on the V4 Schema.
     * @param {Object} config - { step, onSkip, onNext, gameState }
     */
    showTutorialToast({ step, onSkip, onNext, gameState }) {
        this.hideTutorialToast(); // Clean up any existing toasts

        // 1. Build the Toast DOM Element
        const toast = document.createElement('div');
        toast.className = `tt-window tt-theme-${step.theme || 'default'}`;
        toast.id = 'tutorial-toast-container';

        // Header & Minimize Toggle
        const header = document.createElement('div');
        header.className = 'tt-header';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'tt-toggle-btn';
        toggleBtn.innerHTML = '&minus;';
        toggleBtn.title = "Toggle Minimize";
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            toast.classList.toggle('tt-minimized');
            toggleBtn.innerHTML = toast.classList.contains('tt-minimized') ? '&plus;' : '&minus;';
        };
        header.appendChild(toggleBtn);
        toast.appendChild(header);

        // Body Content
        const body = document.createElement('div');
        body.className = 'tt-scrollable';
        body.innerHTML = step.text;
        toast.appendChild(body);

        // Declarative Advance Arrow (Only for non-action steps)
        if (step.completion && step.completion.type === 'INFO') {
            const nextArrow = document.createElement('button');
            nextArrow.className = 'tt-next-arrow';
            nextArrow.onclick = (e) => {
                e.stopPropagation();
                onNext();
            };
            toast.appendChild(nextArrow);
        }

        this.activeToastElement = toast;

        // 2. Determine Render Mode
        if (!step.targetSelector) {
            // Mode A: Safe Zone Fallback
            this.safeZone.appendChild(toast);
        } else {
            // Mode B: Targeted Anchoring
            const targetEl = document.querySelector(step.targetSelector);
            
            if (targetEl) {
                this._applyTargetedToast(targetEl, step, toast);
            } else {
                this._huntForGhostElement(step, toast);
            }
        }
    }

    /**
     * Applies Spotlight, attaches to DOM, and boots Popper.js for a found element.
     * @private
     */
    _applyTargetedToast(targetEl, step, toast) {
        // Apply Spotlight Shield if requested
        if (step.useSpotlight) {
            this.activeSpotlightMask = document.createElement('div');
            this.activeSpotlightMask.className = 'tut-spotlight-mask';
            
            if (step.allowClickThrough) {
                this.activeSpotlightMask.classList.add('tut-allow-click');
            }
            
            document.body.appendChild(this.activeSpotlightMask);

            // Stacking Context Escape Hatch
            // Detect if the target is buried inside a transform trap (like a carousel)
            let elevateEl = targetEl;
            if (targetEl.closest('.carousel-container')) {
                elevateEl = targetEl.closest('.carousel-container');
            } else if (targetEl.closest('.item-card-container')) {
                elevateEl = targetEl.closest('.item-card-container');
            } else if (targetEl.closest('.mission-card')) {
                elevateEl = targetEl.closest('.mission-card');
            }

            elevateEl.classList.add('tut-spotlight-target');
            this.activeTargetElement = elevateEl; // Track the elevated element for cleanup
        }

        // Setup Popper.js
        const arrow = document.createElement('div');
        arrow.className = 'tt-popper-arrow';
        arrow.setAttribute('data-popper-arrow', '');
        toast.appendChild(arrow);

        document.body.appendChild(toast);

        // Standard Popper v2 initialization
        if (window.Popper) {
            this.popperInstance = window.Popper.createPopper(targetEl, toast, {
                placement: 'auto',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 12] } },
                    { name: 'preventOverflow', options: { padding: 10 } },
                    { name: 'arrow', options: { element: arrow } }
                ],
            });
        } else {
            console.warn("Popper.js not found. Falling back to Safe Zone.");
            this.safeZone.appendChild(toast);
        }
    }

    /**
     * The Ghost Hunter: Waits for virtualized elements to mount via MutationObserver.
     * @private
     */
    _huntForGhostElement(step, toast) {
        console.log(`[Ghost Hunter] Initiating search for: ${step.targetSelector}`);

        // Set 4-second expiration
        this.ghostHunterTimeout = setTimeout(() => {
            console.error(`[Ghost Hunter] Timeout reached. Target not found: ${step.targetSelector}. Aborting step visual.`);
            this.hideTutorialToast();
        }, 4000);

        // Force scroll on known generic carousels if targetIndex is provided
        if (step.targetIndex !== undefined) {
            const carousels = document.querySelectorAll('.carousel-inner');
            carousels.forEach(c => {
                // Rough programmatic scroll to trigger intersection observers
                c.scrollLeft = step.targetIndex * 300; 
            });
        }

        this.mutationObserver = new MutationObserver((mutations, obs) => {
            const targetEl = document.querySelector(step.targetSelector);
            if (targetEl) {
                console.log(`[Ghost Hunter] Target acquired: ${step.targetSelector}`);
                clearTimeout(this.ghostHunterTimeout);
                obs.disconnect();
                this._applyTargetedToast(targetEl, step, toast);
            }
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true // Catch elements removing 'hidden' classes
        });
    }

    /**
     * Triggers the positive feedback visual sequence.
     * Returns a promise to allow the TutorialService to await the animation.
     * @returns {Promise<void>}
     */
    triggerTutorialSuccessShimmer() {
        return new Promise((resolve) => {
            if (this.activeToastElement) {
                this.activeToastElement.classList.add('tt-shimmer-success');
                setTimeout(() => resolve(), 1000);
            } else {
                resolve();
            }
        });
    }

    /**
     * Completely removes all tutorial visual elements and observers from the DOM.
     */
    hideTutorialToast() {
        // Clear Ghost Hunter tools
        if (this.ghostHunterTimeout) {
            clearTimeout(this.ghostHunterTimeout);
            this.ghostHunterTimeout = null;
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        // Destroy Popper
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }

        // Remove DOM Toast
        if (this.activeToastElement && this.activeToastElement.parentNode) {
            this.activeToastElement.parentNode.removeChild(this.activeToastElement);
        }
        this.activeToastElement = null;

        // Clean up Spotlight Mask & Z-Index overrides
        if (this.activeSpotlightMask && this.activeSpotlightMask.parentNode) {
            this.activeSpotlightMask.parentNode.removeChild(this.activeSpotlightMask);
        }
        this.activeSpotlightMask = null;

        if (this.activeTargetElement) {
            this.activeTargetElement.classList.remove('tut-spotlight-target');
            this.activeTargetElement = null;
        }
    }
}