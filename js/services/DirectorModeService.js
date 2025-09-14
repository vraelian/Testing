// js/services/DirectorModeService.js
/**
 * @fileoverview This file contains the DirectorModeService class, a development-only tool
 * for visually creating and configuring tutorial highlights and cues directly on the game screen.
 */

/**
 * @class DirectorModeService
 * @description Manages the UI and logic for the visual tutorial editor.
 */
export class DirectorModeService {
    /**
     * @param {import('./UIManager.js').UIManager} uiManager The UI rendering service.
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(uiManager, logger) {
        this.uiManager = uiManager;
        this.logger = logger;
        this.isActive = false;

        this.cues = [];
        this.selectedCue = null;
        this.actionState = {
            isDragging: false,
            isResizing: false,
            startX: 0,
            startY: 0,
            originalX: 0,
            originalY: 0,
            originalWidth: 0,
            originalHeight: 0,
        };
        this.toolkit = null;
        this.cueControllers = [];
    }

    /**
     * Toggles the visibility of the Director Mode overlay and toolkit.
     */
    toggleVisibility() {
        this.isActive = !this.isActive;
        const overlay = this.uiManager.cache.directorModeOverlay;
        if (this.isActive) {
            this.uiManager.showDirectorMode();
            overlay.classList.add('interactive');
            if (!this.toolkit) {
                this.buildToolkit();
            }
            this.render();
            this.logger.info.system('DirectorMode', 'SYSTEM', 'ACTIVATED', 'Visual tutorial editor is now active.');
        } else {
            this.uiManager.hideDirectorMode();
            overlay.classList.remove('interactive');
            this.logger.info.system('DirectorMode', 'SYSTEM', 'DEACTIVATED', 'Visual tutorial editor is now inactive.');
        }
    }

    /**
     * Creates the lil-gui toolkit panel for Director Mode.
     */
    buildToolkit() {
        this.toolkit = new lil.GUI({
            container: this.uiManager.cache.directorToolkit,
            title: 'Director\'s Toolkit'
        });

        const actions = {
            addFrame: () => this.addCue({ type: 'Frame' }),
            addArrow: () => this.addCue({ type: 'Arrow' }),
            deleteCue: () => this.deleteSelectedCue(),
            copyConfig: () => this.copyConfigToClipboard(),
        };

        const creationFolder = this.toolkit.addFolder('Creation');
        creationFolder.add(actions, 'addFrame').name('Add Frame');
        creationFolder.add(actions, 'addArrow').name('Add Arrow');
        
        const mainFolder = this.toolkit.addFolder('Cue Properties');
        mainFolder.add(actions, 'deleteCue').name('Delete Selected');
        
        this.toolkit.add(actions, 'copyConfig').name('Copy Config to Clipboard');
    }

    /**
     * Adds a new cue to the canvas.
     * @param {object} options - The initial properties for the new cue.
     * @param {string} options.type - The type of cue to create (e.g., 'Frame', 'Arrow').
     */
    addCue({ type }) {
        const newCue = {
            id: `cue-${Date.now()}`,
            type: type,
            tutorialStepId: '',
            x: 100,
            y: 100,
            width: type === 'Arrow' ? 100 : 200,
            height: type === 'Arrow' ? 50 : 100,
            rotation: 0,
            color: '#fde047',
        };
        this.cues.push(newCue);
        this.selectCue(newCue);
    }

    /**
     * Deletes the currently selected cue.
     */
    deleteSelectedCue() {
        if (!this.selectedCue) return;
        this.cues = this.cues.filter(c => c.id !== this.selectedCue.id);
        this.selectCue(null);
    }

    /**
     * Selects a cue for editing and updates the toolkit.
     * @param {object|null} cueToSelect - The cue object to select, or null to deselect.
     */
    selectCue(cueToSelect) {
        this.selectedCue = cueToSelect;
        this.updateToolkit();
        this.render();
    }
    
    /**
     * Updates the toolkit controllers to reflect the currently selected cue.
     */
    updateToolkit() {
        // Clear previous controllers
        this.cueControllers.forEach(controller => controller.destroy());
        this.cueControllers = [];

        if (this.selectedCue) {
            const cueFolder = this.toolkit.folders.find(f => f._title === 'Cue Properties') || this.toolkit;

            this.cueControllers.push(cueFolder.add(this.selectedCue, 'tutorialStepId').name('Step ID'));
            this.cueControllers.push(cueFolder.add(this.selectedCue, 'x', 0, window.innerWidth).name('X').listen());
            this.cueControllers.push(cueFolder.add(this.selectedCue, 'y', 0, window.innerHeight).name('Y').listen());
            
            if (this.selectedCue.type === 'Arrow') {
                 this.cueControllers.push(cueFolder.add(this.selectedCue, 'rotation', 0, 360, 1).name('Rotation').listen());
            }

            this.cueControllers.push(cueFolder.add(this.selectedCue, 'width', 10, 500).name('Width').listen());
            this.cueControllers.push(cueFolder.add(this.selectedCue, 'height', 10, 500).name('Height').listen());
            this.cueControllers.push(cueFolder.addColor(this.selectedCue, 'color').name('Color'));
        }
    }

    /**
     * Handles all user input events when Director Mode is active.
     * @param {Event} e The input event object (e.g., click, mousedown, mousemove).
     */
    handleInput(e) {
        if (!this.isActive) return;

        const target = e.target;
        const cueElement = target.closest('.director-cue');

        switch (e.type) {
            case 'mousedown':
                if (cueElement) {
                    const cue = this.cues.find(c => c.id === cueElement.dataset.id);
                    this.selectCue(cue);

                    this.actionState.isDragging = true;
                    this.actionState.startX = e.clientX;
                    this.actionState.startY = e.clientY;
                    this.actionState.originalX = cue.x;
                    this.actionState.originalY = cue.y;

                    if (target.classList.contains('resize-handle')) {
                        this.actionState.isDragging = false;
                        this.actionState.isResizing = true;
                        this.actionState.originalWidth = cue.width;
                        this.actionState.originalHeight = cue.height;
                    }
                } else if (!target.closest('.lil-gui')) {
                    this.selectCue(null);
                }
                break;
            case 'mousemove':
                if (!this.selectedCue) return;
                const dx = e.clientX - this.actionState.startX;
                const dy = e.clientY - this.actionState.startY;

                if (this.actionState.isDragging) {
                    this.selectedCue.x = this.actionState.originalX + dx;
                    this.selectedCue.y = this.actionState.originalY + dy;
                } else if (this.actionState.isResizing) {
                    this.selectedCue.width = Math.max(10, this.actionState.originalWidth + dx);
                    this.selectedCue.height = Math.max(10, this.actionState.originalHeight + dy);
                }
                // No need to call render() here as lil-gui's listen() will do it.
                break;
            case 'mouseup':
            case 'mouseleave':
                this.actionState.isDragging = false;
                this.actionState.isResizing = false;
                break;
        }
    }

    /**
     * Renders all visual cues as DOM elements on the overlay.
     */
    render() {
        if (!this.isActive) return;
        const overlay = this.uiManager.cache.directorModeOverlay;
        overlay.innerHTML = ''; // Clear previous render

        this.cues.forEach(cue => {
            const el = document.createElement('div');
            el.className = 'director-cue';
            el.dataset.id = cue.id;
            el.style.left = `${cue.x}px`;
            el.style.top = `${cue.y}px`;
            el.style.width = `${cue.width}px`;
            el.style.height = `${cue.height}px`;
            el.style.transform = `rotate(${cue.rotation}deg)`;

            let content = '';
            if (cue.type === 'Frame') {
                content = `<div class="cue-frame" style="border-color: ${cue.color};"></div>`;
            } else if (cue.type === 'Arrow') {
                content = `
                    <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none">
                        <defs>
                            <marker id="arrowhead-${cue.id}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="${cue.color}" />
                            </marker>
                        </defs>
                        <line x1="0" y1="25" x2="90" y2="25" stroke="${cue.color}" stroke-width="5" marker-end="url(#arrowhead-${cue.id})" />
                    </svg>
                `;
            }

            if (this.selectedCue && this.selectedCue.id === cue.id) {
                el.classList.add('selected');
                el.innerHTML = content + `<div class="resize-handle br"></div>`;
            } else {
                el.innerHTML = content;
            }

            overlay.appendChild(el);
        });
    }

    /**
     * Gathers the configuration of all cues and copies it to the clipboard as a JSON string.
     */
    copyConfigToClipboard() {
        const config = this.cues.reduce((acc, cue) => {
            if (cue.tutorialStepId) {
                if (!acc[cue.tutorialStepId]) {
                    acc[cue.tutorialStepId] = [];
                }
                const { id, ...cueConfig } = cue; 
                acc[cue.tutorialStepId].push(cueConfig);
            }
            return acc;
        }, {});

        const configString = JSON.stringify(config, null, 2);
        navigator.clipboard.writeText(configString).then(() => {
            this.logger.info.system('DirectorMode', 'EXPORT', 'Cue configuration copied to clipboard.');
            this.uiManager.createFloatingText('Config Copied!', window.innerWidth / 2, window.innerHeight / 2, '#4ade80');
        }).catch(err => {
            this.logger.error('DirectorMode', 'Failed to copy config.', err);
        });
    }
}