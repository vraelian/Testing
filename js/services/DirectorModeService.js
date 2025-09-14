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
        this.toolkitActionState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            originalX: 0,
            originalY: 0,
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
            title: 'Director\'s Toolkit',
            draggable: false // Disable internal dragging
        });

        const handle = document.createElement('div');
        handle.className = 'drag-handle';
        this.uiManager.cache.directorToolkit.appendChild(handle);

        this.actions = {
            addFrame: () => this.addCue({ type: 'Frame' }),
            addArrow: () => this.addCue({ type: 'Arrow' }),
            addSpotlight: () => this.addCue({ type: 'Spotlight' }),
            deleteCue: () => this.deleteSelectedCue(),
            copyConfig: () => this.copyConfigToClipboard(),
        };

        const creationFolder = this.toolkit.addFolder('Creation');
        creationFolder.add(this.actions, 'addFrame').name('Add Frame');
        creationFolder.add(this.actions, 'addArrow').name('Add Arrow');
        creationFolder.add(this.actions, 'addSpotlight').name('Add Spotlight');
        
        this.toolkit.addFolder('Cue Properties');
        this.toolkit.addFolder('Style');
        
        this.toolkit.add(this.actions, 'deleteCue').name('Delete Selected');
        this.copyButton = this.toolkit.add(this.actions, 'copyConfig').name('Copy Config to Clipboard');
        this.copyButton.disable(); // Disabled by default
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
            width: type === 'Arrow' ? 100 : 150,
            height: type === 'Arrow' ? 50 : 150,
            rotation: 0,
            style: {
                fill: 'rgba(253, 224, 71, 0.0)',
                stroke: '#fde047',
                strokeWidth: 3,
                opacity: 1,
                animation: 'None',
                animationSpeed: 2, // seconds
                glowColor: '#fde047',
                glowIntensity: 10 // pixels
            }
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
        this.cueControllers.forEach(controller => controller.destroy());
        this.cueControllers = [];
        const cueFolder = this.toolkit.folders.find(f => f._title === 'Cue Properties');
        const styleFolder = this.toolkit.folders.find(f => f._title === 'Style');
        [...cueFolder.children, ...styleFolder.children].forEach(c => c.destroy());

        if (this.selectedCue) {
            const cue = this.selectedCue;
            const stepIdController = cueFolder.add(cue, 'tutorialStepId').name('Step ID');
            stepIdController.onChange(() => this.validateExport());
            
            this.cueControllers.push(stepIdController);
            this.cueControllers.push(cueFolder.add(cue, 'x', 0, window.innerWidth).name('X').listen());
            this.cueControllers.push(cueFolder.add(cue, 'y', 0, window.innerHeight).name('Y').listen());
            this.cueControllers.push(cueFolder.add(cue, 'width', 10, 500).name('Width').listen());
            this.cueControllers.push(cueFolder.add(cue, 'height', 10, 500).name('Height').listen());
            
            if (cue.type === 'Arrow') {
                 this.cueControllers.push(cueFolder.add(cue, 'rotation', 0, 360, 1).name('Rotation').listen());
            }

            this.cueControllers.push(styleFolder.addColor(cue.style, 'fill').name('Fill Color'));
            this.cueControllers.push(styleFolder.addColor(cue.style, 'stroke').name('Stroke Color'));
            this.cueControllers.push(styleFolder.add(cue.style, 'strokeWidth', 0, 10, 1).name('Stroke Width'));
            this.cueControllers.push(styleFolder.add(cue.style, 'opacity', 0, 1, 0.1).name('Opacity'));
            const animController = styleFolder.add(cue.style, 'animation', ['None', 'Pulse', 'Glow']).name('Animation');

            animController.onChange(() => this.updateToolkit()); // Re-build to show/hide relevant controls
            this.cueControllers.push(animController);

            if (cue.style.animation !== 'None') {
                this.cueControllers.push(styleFolder.add(cue.style, 'animationSpeed', 0.5, 5, 0.1).name('Speed (s)'));
            }
            if (cue.style.animation === 'Glow') {
                this.cueControllers.push(styleFolder.addColor(cue.style, 'glowColor').name('Glow Color'));
                this.cueControllers.push(styleFolder.add(cue.style, 'glowIntensity', 1, 30, 1).name('Glow Intensity'));
            }

            this.cueControllers.forEach(c => c.onChange(() => this.render()));
        }
        this.validateExport();
    }

    /**
     * Handles all user input events when Director Mode is active.
     * @param {Event} e The input event object (e.g., click, mousedown, mousemove).
     */
    handleInput(e) {
        if (!this.isActive || !e.target || typeof e.target.closest !== 'function') return;

        const target = e.target;
        const isDragHandle = target.classList.contains('drag-handle');
        const cueElement = target.closest('.director-cue');
        const toolkitEl = this.uiManager.cache.directorToolkit;

        switch (e.type) {
            case 'mousedown':
                if (isDragHandle) {
                    this.toolkitActionState.isDragging = true;
                    this.toolkitActionState.startX = e.clientX;
                    this.toolkitActionState.startY = e.clientY;
                    const rect = toolkitEl.getBoundingClientRect();
                    this.toolkitActionState.originalX = rect.left;
                    this.toolkitActionState.originalY = rect.top;
                    e.preventDefault();
                } else if (cueElement) {
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
                if (this.toolkitActionState.isDragging) {
                    const dx = e.clientX - this.toolkitActionState.startX;
                    const dy = e.clientY - this.toolkitActionState.startY;
                    toolkitEl.style.left = `${this.toolkitActionState.originalX + dx}px`;
                    toolkitEl.style.top = `${this.toolkitActionState.originalY + dy}px`;
                    toolkitEl.style.right = 'auto';
                    toolkitEl.style.bottom = 'auto';
                } else if (this.actionState.isDragging || this.actionState.isResizing) {
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
                }
                break;
            case 'mouseup':
            case 'mouseleave':
                this.actionState.isDragging = false;
                this.actionState.isResizing = false;
                this.toolkitActionState.isDragging = false;
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
            el.style.opacity = cue.style.opacity;

            if (cue.style.animation !== 'None') {
                el.classList.add(`anim-${cue.style.animation.toLowerCase()}`);
                el.style.setProperty('--glow-color', cue.style.glowColor);
                el.style.setProperty('--glow-intensity', `${cue.style.glowIntensity}px`);
                el.style.setProperty('--anim-speed', `${cue.style.animationSpeed}s`);
            }

            let content = '';
            if (cue.type === 'Frame') {
                content = `<div class="cue-frame" style="border-color: ${cue.style.stroke}; border-width: ${cue.style.strokeWidth}px; background-color: ${cue.style.fill};"></div>`;
            } else if (cue.type === 'Arrow') {
                content = `
                    <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" style="overflow: visible;">
                        <defs>
                            <marker id="arrowhead-${cue.id}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="${cue.style.stroke}" />
                            </marker>
                        </defs>
                        <line x1="0" y1="25" x2="90" y2="25" stroke="${cue.style.stroke}" stroke-width="${cue.style.strokeWidth}" marker-end="url(#arrowhead-${cue.id})" />
                    </svg>
                `;
            } else if (cue.type === 'Spotlight') {
                content = `<div class="cue-spotlight" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 20px 10px ${cue.style.stroke}; border-radius: 50%;"></div>`
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
     * Checks if any cue has a Step ID and enables/disables the export button accordingly.
     */
    validateExport() {
        const canExport = this.cues.some(c => c.tutorialStepId && c.tutorialStepId.trim() !== '');
        if (canExport) {
            this.copyButton.enable();
        } else {
            this.copyButton.disable();
        }
    }

    /**
     * Gathers the configuration of all cues and copies it to the clipboard as a JSON string.
     */
    copyConfigToClipboard() {
        const config = this.cues.reduce((acc, cue) => {
            if (cue.tutorialStepId && cue.tutorialStepId.trim() !== '') {
                const stepId = cue.tutorialStepId.trim();
                if (!acc[stepId]) {
                    acc[stepId] = [];
                }
                const { id, ...cueConfig } = cue; 
                acc[stepId].push(cueConfig);
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