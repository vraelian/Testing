// js/services/ui/TutorialRenderer.js
/**
 * @fileoverview
 * This service is responsible for all UI rendering related to the tutorial system.
 * It manages the tutorial toast (positioning, content), the highlight overlay,
 * and the skip modal.
 * Extracted from UIManager.js as part of the Phase 3 refactor.
 */

import { DB } from '../../data/database.js';

export class TutorialRenderer {
    /**
     * Initializes the TutorialRenderer and caches its DOM elements.
     * @param {import('../LoggingService.js').Logger} logger - The logging utility.
     * @param {import('../DebugService.js').DebugService} debugService - The debug service.
     */
    constructor(logger, debugService) {
        this.logger = logger;
        this.debugService = debugService;

        /** @type {object | null} */
        this.activeHighlightConfig = null;
        /** @type {import('@popperjs/core').Instance | null} */
        this.popperInstance = null;

        this._cacheDOM();
    }

    /**
     * Caches all DOM elements required by the tutorial UI.
     * @private
     */
    _cacheDOM() {
        this.cache = {
            // Tutorial Elements
            tutorialAnchorOverlay: document.getElementById('tutorial-anchor-overlay'),
            tutorialToastContainer: document.getElementById('tutorial-toast-container'),
            tutorialToastText: document.getElementById('tutorial-toast-text'),
            tutorialToastSkipBtn: document.getElementById('tutorial-toast-skip-btn'),
            tutorialToastNextBtn: document.getElementById('tutorial-toast-next-btn'),
            skipTutorialModal: document.getElementById('skip-tutorial-modal'),
            skipTutorialConfirmBtn: document.getElementById('skip-tutorial-confirm-btn'),
            skipTutorialCancelBtn: document.getElementById('skip-tutorial-cancel-btn'),
            tutorialHighlightOverlay: document.getElementById('tutorial-highlight-overlay'),
        };
    }

    /**
     * Displays and positions the tutorial toast. Uses either percentage-based positioning
     * relative to an overlay or Popper.js for element anchoring.
     * @param {object} options - Configuration for the toast.
     * @param {object} options.step - The tutorial step data.
     * @param {function} options.onSkip - Callback for skip.
     * @param {function} options.onNext - Callback for next.
     * @param {object} options.gameState - The current game state.
     */
    showTutorialToast({ step, onSkip, onNext, gameState }) {
        const toast = this.cache.tutorialToastContainer;
        if (!toast) {
            this.logger.error('TutorialRenderer', 'tutorialToastContainer not found in DOM.');
            return;
        }
        const arrow = toast.querySelector('#tt-arrow');

        // Use the new overlay if anchor is 'body', otherwise find the element
        const isOverlayAnchor = step.anchorElement === 'body';
        let referenceEl;

        if (isOverlayAnchor) {
            referenceEl = this.cache.tutorialAnchorOverlay; // Use the dedicated overlay
        } else {
            referenceEl = document.querySelector(step.anchorElement);
            if (!referenceEl) {
                this.logger.error('TutorialRenderer', `Anchor element "${step.anchorElement}" not found for step "${step.stepId}". Defaulting to overlay.`);
                referenceEl = this.cache.tutorialAnchorOverlay; // Fallback to overlay
            }
        }

        // Cleanup existing Popper instance if any
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }

        // --- Update Content ---
        let processedText = step.text;
        // b. Fix {shipName} replacement
        if (processedText.includes('{shipName}')) {
            const activeShipId = gameState.player.activeShipId;
            const shipName = activeShipId ? DB.SHIPS[activeShipId].name : 'your ship'; // Fallback
            processedText = processedText.replace(/{shipName}/g, shipName);
        }

        // c. Fix {playerName} replacement
        if (processedText.includes('{playerName}')) {
            const playerName = gameState.player.name || 'Captain'; // Fallback
            processedText = processedText.replace(/{playerName}/g, playerName);
        }

        if (this.cache.tutorialToastText) {
            this.cache.tutorialToastText.innerHTML = processedText;
        }

        // --- Apply Size ---
        const initialWidth = step.size?.width || 'auto';
        const initialHeight = step.size?.height || 'auto';
        toast.style.width = initialWidth;
        toast.style.height = initialHeight;

        // --- Apply Position ---
        if (isOverlayAnchor) {
            // Percentage-based positioning
            const posX = step.positionX ?? 50; // Default to center
            const posY = step.positionY ?? 50; // Default to center
            toast.style.left = `${posX}%`;
            toast.style.top = `${posY}%`;
            // Ensure Popper-related styles/attributes are cleared/reset if switching modes
            toast.style.transform = 'translate(-50%, -50%)'; // Center element on the % point
            if (arrow) arrow.style.display = 'none'; // No arrow for overlay anchor
            toast.removeAttribute('data-popper-placement');

        } else {
            // Element-anchored positioning using Popper.js
            toast.style.left = ''; // Clear direct styles
            toast.style.top = '';
            toast.style.transform = ''; // Clear direct transform

            if (arrow) arrow.style.display = 'block'; // Show arrow

            // Configure Popper.js
            const defaultOptions = {
                placement: 'auto',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 10] } }, // Standard distance
                    { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
            };

            // Merge step-specific Popper options/modifiers
            const stepOffsetMod = step.popperOptions?.modifiers?.find(m => m.name === 'offset');
            let baseModifiers = defaultOptions.modifiers.filter(mod => mod.name !== 'offset');
            if (stepOffsetMod) {
                baseModifiers.push(stepOffsetMod);
            } else {
                baseModifiers.push(defaultOptions.modifiers.find(m => m.name === 'offset'));
            }

            // (Simplified modifier merge - can be expanded if needed)

            const finalOptions = {
                placement: step.placement || step.popperOptions?.placement || defaultOptions.placement,
                modifiers: baseModifiers
            };

            // Create Popper instance
            // Note: Popper.js must be loaded globally (e.g., in index.html)
            if (typeof Popper !== 'undefined') {
                this.popperInstance = Popper.createPopper(referenceEl, toast, finalOptions);
            } else {
                this.logger.error('TutorialRenderer', 'Popper.js is not loaded. Cannot create tutorial toast.');
            }
        }

        // --- Show Toast & Configure Buttons ---
        toast.classList.remove('hidden');
        const isInfoStep = step.completion.type === 'INFO';
        if (this.cache.tutorialToastNextBtn) {
            this.cache.tutorialToastNextBtn.classList.toggle('hidden', !isInfoStep);
            if (isInfoStep) {
                this.cache.tutorialToastNextBtn.onclick = onNext;
            }
        }
        
        const showSkipButton = false; // Configure as needed
        if (this.cache.tutorialToastSkipBtn) {
            this.cache.tutorialToastSkipBtn.style.display = showSkipButton ? 'block' : 'none';
            this.cache.tutorialToastSkipBtn.onclick = onSkip;
        }
        
        if (this.cache.tutorialToastText) {
            this.cache.tutorialToastText.scrollTop = 0;
        }

        // --- Notify DebugService ---
        if (this.debugService) {
            this.debugService.setActiveTutorialStep(step); // Pass the raw step data
        }
    }

    /**
     * Hides the tutorial toast and destroys the associated Popper.js instance.
     */
    hideTutorialToast() {
        if (this.cache.tutorialToastContainer) {
            this.cache.tutorialToastContainer.classList.add('hidden');
        }
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }
        this.applyTutorialHighlight(null);

        // Notify DebugService
        if (this.debugService) {
            this.debugService.clearActiveTutorialStep();
        }
    }

    /**
     * Updates the active tutorial toast position and size in real-time based on debug controls.
     * @param {object} newOptions - Options from DebugService._handleTutorialTune
     */
    updateTutorialPopper(newOptions) {
        const toast = this.cache.tutorialToastContainer;
        if (!toast) return;
        const arrow = toast.querySelector('#tt-arrow');
        const { isOverlayAnchor, width, height, percentX, percentY, placement, distance, skidding } = newOptions;

        // --- Apply Size (Common) ---
        toast.style.width = width > 0 ? `${width}px` : 'auto';
        toast.style.height = height > 0 ? `${height}px` : 'auto';

        // --- Apply Position (Conditional) ---
        if (isOverlayAnchor) {
            // Using Percentage Positioning
            if (this.popperInstance) {
                this.popperInstance.destroy();
                this.popperInstance = null;
                toast.removeAttribute('data-popper-placement');
                toast.style.transform = ''; // Clear Popper transform
            }
            toast.style.left = `${percentX}%`;
            toast.style.top = `${percentY}%`;
            toast.style.transform = 'translate(-50%, -50%)'; // Re-apply centering transform
            if (arrow) arrow.style.display = 'none';

        } else {
            // Using Popper.js Positioning
            toast.style.left = ''; // Clear direct styles
            toast.style.top = '';
            toast.style.transform = ''; // Clear direct transform (Popper will add its own)
            if (arrow) arrow.style.display = 'block';

            const popperUpdateOptions = {
                placement: placement,
                modifiers: [
                    { name: 'offset', options: { offset: [skidding, distance] } },
                    { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
            };

            if (this.popperInstance) {
                this.popperInstance.setOptions(popperUpdateOptions).catch(e => {
                    this.logger.error('TutorialRenderer', 'Error updating Popper options:', e);
                });
            } else {
                this.logger.warn('TutorialRenderer', 'Popper instance needed but not found during update. Re-trigger toast if anchor type changed.');
            }
        }
    }

    /**
     * Applies a highlight configuration to the overlay.
     * @param {object | null} highlightConfig - The configuration object or null to hide.
     */
    applyTutorialHighlight(highlightConfig) {
        this.activeHighlightConfig = highlightConfig;
        this._renderHighlightsFromConfig(this.activeHighlightConfig);
    }

    /**
     * Renders the highlight cues based on the provided config.
     * @param {object | null} highlightConfig - The config object.
     * @private
     */
    _renderHighlightsFromConfig(highlightConfig) {
        const overlay = this.cache.tutorialHighlightOverlay;
        if (!overlay) return;

        overlay.innerHTML = ''; // Clear previous highlights
        if (!highlightConfig) {
            overlay.classList.add('hidden');
            return;
        }

        overlay.classList.remove('hidden');

        highlightConfig.forEach(cue => {
            const el = document.createElement('div');
            el.className = 'tutorial-cue';
            el.style.left = `${cue.x}px`;
            el.style.top = `${cue.y}px`;
            el.style.width = `${cue.width}px`;
            el.style.height = `${cue.height}px`;
            el.style.transform = `rotate(${cue.rotation}deg)`;
            el.style.opacity = cue.style.opacity;

            if (cue.style.animation !== 'None') {
                el.classList.add(`anim-${cue.style.animation.toLowerCase()}`);
            }

            let content = '';
            if (cue.type === 'Shape') {
                content = `
                    <svg width="100%" height="100%" viewBox="0 0 ${cue.width} ${cue.height}" preserveAspectRatio="none" style="overflow: visible;">
                        ${cue.shapeType === 'Rectangle' ?
                            `<rect x="0" y="0" width="100%" height="100%" rx="${cue.style.borderRadius}" ry="${cue.style.borderRadius}" style="fill:${cue.style.fill}; stroke:${cue.style.stroke}; stroke-width:${cue.style.strokeWidth}px;" />` :
                            `<ellipse cx="50%" cy="50%" rx="50%" ry="50%" style="fill:${cue.style.fill}; stroke:${cue.style.stroke}; stroke-width:${cue.style.strokeWidth}px;" />`
                        }
                    </svg>`;
            } else if (cue.type === 'Arrow') {
                content = `
                    <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" style="overflow: visible;">
                        <defs>
                            <marker id="arrowhead-player" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="${cue.style.stroke}" />
                            </marker>
                        </defs>
                        <line x1="0" y1="25" x2="90" y2="25" stroke="${cue.style.stroke}" stroke-width="${cue.style.strokeWidth}" marker-end="url(#arrowhead-player)" />
                    </svg>
                `;
            } else if (cue.type === 'Spotlight') {
                el.style.borderRadius = '50%';
                el.style.boxShadow = `0 0 0 9999px rgba(0,0,0,0.7), 0 0 ${cue.style.glowIntensity || 20}px ${cue.style.glowIntensity || 10}px ${cue.style.glowColor || cue.style.stroke}`;
            }

            el.innerHTML = content;
            // Apply dynamic styles to the animated child, not the parent container
            const animatedChild = el.querySelector('svg');
            if (animatedChild && cue.style.animation !== 'None') {
                animatedChild.classList.add(`anim-${cue.style.animation.toLowerCase()}`);
                animatedChild.style.setProperty('--glow-color', cue.style.glowColor || cue.style.stroke);
                animatedChild.style.setProperty('--anim-speed', `${cue.style.animationSpeed}s`);
                animatedChild.style.setProperty('--glow-intensity', `${cue.style.glowIntensity}px`);
            }

            overlay.appendChild(el);
        });
    }

    /**
     * Shows the "Skip Tutorial" confirmation modal.
     * @param {function} onConfirm - Callback function to execute on confirmation.
     * @param {function} onCancel - Callback function to execute on cancellation.
     */
    showSkipTutorialModal(onConfirm, onCancel) {
        const modal = this.cache.skipTutorialModal;
        if (!modal) {
            this.logger.error('TutorialRenderer', 'skipTutorialModal not found in DOM.');
            return;
        }
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');

        if (this.cache.skipTutorialConfirmBtn) {
            this.cache.skipTutorialConfirmBtn.onclick = onConfirm;
        }
        if (this.cache.skipTutorialCancelBtn) {
            this.cache.skipTutorialCancelBtn.onclick = onCancel;
        }
    }

    /**
     * Hides the "Skip Tutorial" modal.
     */
    hideSkipTutorialModal() {
        const modal = this.cache.skipTutorialModal;
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('modal-hiding');
            modal.addEventListener('animationend', () => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible');
            }, { once: true });
        }
    }

    /**
     * Shows the tutorial log modal for replaying tutorials.
     * @param {object} options
     * @param {string[]} options.seenBatches - Array of seen batch IDs.
     * @param {function} options.onSelect - Callback when a batch is selected.
     */
    showTutorialLogModal({ seenBatches, onSelect }) {
        const logModal = document.getElementById('tutorial-log-modal');
        const list = document.getElementById('tutorial-log-list');

        if (!logModal || !list) {
            this.logger.error('TutorialRenderer', 'Tutorial log modal elements not found in DOM.');
            return;
        }

        list.innerHTML = '';

        if (seenBatches.length === 0) {
            list.innerHTML = `<li class="text-gray-400 p-2 text-center">No tutorials viewed yet.</li>`;
        } else {
            seenBatches.forEach(batchId => {
                const batchData = DB.TUTORIAL_DATA[batchId];
                if (batchData) {
                    const li = document.createElement('li');
                    li.innerHTML = `<button class="btn w-full text-center">${batchData.title}</button>`;
                    li.onclick = () => {
                        logModal.classList.remove('visible');
                        onSelect(batchId);
                    };
                    list.appendChild(li);
                }
            });
        }
        logModal.classList.add('visible');
    }
}