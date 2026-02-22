// js/services/ui/UITutorialManager.js
import { DB } from '../../data/database.js';

export class UITutorialManager {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
        this.popperInstance = null;
        this.activeHighlightConfig = null;
    }

    /**
     * Displays a tutorial toast/popup.
     * @param {object} params
     * @param {object} params.step - The tutorial step object.
     * @param {Function} params.onSkip - Callback for skip.
     * @param {Function} params.onNext - Callback for next.
     * @param {object} params.gameState - Current game state.
     */
    showTutorialToast({ step, onSkip, onNext, gameState }) {
        const toast = this.manager.cache.tutorialToastContainer;
        const arrow = toast.querySelector('#tt-arrow');
        const isOverlayAnchor = step.anchorElement === 'body';
        let referenceEl;
        
        if (isOverlayAnchor) {
            referenceEl = this.manager.cache.tutorialAnchorOverlay; 
        } else {
            referenceEl = document.querySelector(step.anchorElement);
            if (!referenceEl) {
                this.manager.logger.error('UITutorialManager', `Anchor element "${step.anchorElement}" not found for step "${step.stepId}". Defaulting to overlay.`);
                referenceEl = this.manager.cache.tutorialAnchorOverlay; 
            }
        }
        
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }

        let processedText = step.text;
        if (processedText.includes('{shipName}')) {
            const activeShipId = gameState.player.activeShipId;
            const shipName = activeShipId ? DB.SHIPS[activeShipId].name : 'your ship'; 
            processedText = processedText.replace(/{shipName}/g, shipName);
        }

        if (processedText.includes('{playerName}')) {
            const playerName = gameState.player.name || 'Captain'; 
            processedText = processedText.replace(/{playerName}/g, playerName);
        }

        this.manager.cache.tutorialToastText.innerHTML = processedText;

        const initialWidth = step.size?.width || 'auto';
        const initialHeight = step.size?.height || 'auto';
        toast.style.width = initialWidth;
        toast.style.height = initialHeight;
        
        if (isOverlayAnchor) {
            const posX = step.positionX ?? 50; 
            const posY = step.positionY ?? 50; 
            toast.style.left = `${posX}%`;
            toast.style.top = `${posY}%`;
            toast.style.transform = 'translate(-50%, -50%)'; 
            arrow.style.display = 'none'; 
            toast.removeAttribute('data-popper-placement'); 
            
        } else {
            toast.style.left = ''; 
            toast.style.top = '';
            toast.style.transform = ''; 
            
            arrow.style.display = 'block'; 

            const defaultOptions = { 
                placement: 'auto',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 10] } }, 
                    { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
            };
            
            const stepOffsetMod = step.popperOptions?.modifiers?.find(m => m.name === 'offset');
            let baseModifiers = defaultOptions.modifiers.filter(mod => mod.name !== 'offset'); 
            if (stepOffsetMod) {
                baseModifiers.push(stepOffsetMod); 
            } else {
                baseModifiers.push(defaultOptions.modifiers.find(m => m.name === 'offset')); 
            }
     
            if (step.popperOptions?.modifiers) { /* ... merge other modifiers ... */ }

            const finalOptions = {
                placement: step.placement || step.popperOptions?.placement || defaultOptions.placement,
                modifiers: baseModifiers
            };

            this.popperInstance = Popper.createPopper(referenceEl, toast, finalOptions);
        }

        toast.classList.remove('hidden');
        const isInfoStep = step.completion.type === 'INFO';
        this.manager.cache.tutorialToastNextBtn.classList.toggle('hidden', !isInfoStep);
        if (isInfoStep) {
            this.manager.cache.tutorialToastNextBtn.onclick = onNext;
        }
        const showSkipButton = false; 
        this.manager.cache.tutorialToastSkipBtn.style.display = showSkipButton ? 'block' : 'none';
        this.manager.cache.tutorialToastSkipBtn.onclick = onSkip;
        this.manager.cache.tutorialToastText.scrollTop = 0;
        
        if (this.manager.debugService) {
            this.manager.debugService.setActiveTutorialStep(step); 
        }
    }

    /**
     * Hides the tutorial toast and cleans up Popper instance.
     */
    hideTutorialToast() {
        this.manager.cache.tutorialToastContainer.classList.add('hidden');
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }
        this.applyTutorialHighlight(null);
        
        if (this.manager.debugService) {
            this.manager.debugService.clearActiveTutorialStep();
        }
    }

    /**
     * Dynamically updates the Popper position for the active toast.
     * @param {object} newOptions 
     */
    updateTutorialPopper(newOptions) {
        const toast = this.manager.cache.tutorialToastContainer;
        const arrow = toast.querySelector('#tt-arrow');
        const { isOverlayAnchor, width, height, percentX, percentY, placement, distance, skidding } = newOptions;

        toast.style.width = width > 0 ? `${width}px` : 'auto';
        toast.style.height = height > 0 ? `${height}px` : 'auto';

        if (isOverlayAnchor) {
            if (this.popperInstance) {
                this.popperInstance.destroy();
                this.popperInstance = null;
                toast.removeAttribute('data-popper-placement'); 
                toast.style.transform = ''; 
            }
            
            toast.style.left = `${percentX}%`;
            toast.style.top = `${percentY}%`;
            toast.style.transform = 'translate(-50%, -50%)'; 
            arrow.style.display = 'none';

        } else {
            toast.style.left = ''; 
            toast.style.top = ''; 
            toast.style.transform = ''; 
            arrow.style.display = 'block';

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
                    this.manager.logger.error('UITutorialManager', 'Error updating Popper options:', e);
                });
            } else {
                this.manager.logger.warn('UITutorialManager', 'Popper instance needed but not found during update. Re-trigger toast if anchor type changed.');
            }
        }
    }

    /**
     * Applies the visual highlights (spotlights/arrows) for the tutorial.
     * @param {Array} highlightConfig 
     */
    applyTutorialHighlight(highlightConfig) {
        this.activeHighlightConfig = highlightConfig;
        this._renderHighlightsFromConfig(this.activeHighlightConfig);
    }

    /**
     * Internal renderer for highlight SVG elements.
     * @private
     * @param {Array} highlightConfig 
     */
    _renderHighlightsFromConfig(highlightConfig) {
        const overlay = this.manager.cache.tutorialHighlightOverlay;
        if (!overlay) return;

        overlay.innerHTML = ''; 
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
     * @param {Function} onConfirm 
     */
    showSkipTutorialModal(onConfirm) {
        const modal = this.manager.cache.skipTutorialModal;
        modal.classList.remove('hidden');

        const confirmHandler = () => {
            onConfirm();
            this.manager.hideModal('skip-tutorial-modal');
        };

        const cancelHandler = () => {
            this.manager.hideModal('skip-tutorial-modal');
        };

        this.manager.cache.skipTutorialConfirmBtn.onclick = confirmHandler;
        this.manager.cache.skipTutorialCancelBtn.onclick = cancelHandler;
    }

    /**
     * Shows the Tutorial Log (History) modal.
     * @param {object} params
     * @param {Array} params.seenBatches 
     * @param {Function} params.onSelect 
     */
    showTutorialLogModal({ seenBatches, onSelect }) {
        const logModal = document.getElementById('tutorial-log-modal');
        const list = document.getElementById('tutorial-log-list');

        if (!logModal || !list) {
            this.manager.logger.error('UITutorialManager', 'Tutorial log modal elements not found in DOM.');
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