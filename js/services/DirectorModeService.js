// js/services/DirectorModeService.js
/**
 * @fileoverview This file contains the DirectorModeService class, a development-only tool
 * for visually creating and configuring tutorial highlights and cues directly on the game screen.
 */

// A library of pre-defined SVG icons for use in tutorials.
const ICON_LIBRARY = {
    mouse_pointer: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.62,1.38a1,1,0,0,0-1.24,0L1,13.21a1,1,0,0,0,0,1.41l1.41,1.41a1,1,0,0,0,1.41,0L12,7.83l5.18,5.18a1,1,0,0,0,1.41,0l1.41-1.41a1,1,0,0,0,0-1.41Z"/></svg>',
    click: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.62,1.38a1,1,0,0,0-1.24,0L1,13.21a1,1,0,0,0,0,1.41l1.41,1.41a1,1,0,0,0,1.41,0L12,7.83l5.18,5.18a1,1,0,0,0,1.41,0l1.41-1.41a1,1,0,0,0,0-1.41Z"/><path fill="currentColor" d="M19.47,20.53a1,1,0,0,1-1.42,0l-3.18-3.18a1,1,0,0,1,1.42-1.42l3.18,3.18a1,1,0,0,1,0,1.42Z"/><path fill="currentColor" d="M19.47,15.47a1,1,0,0,1-1.42,0l-1-1a1,1,0,0,1,1.42-1.42l1,1a1,1,0,0,1,0,1.42Z"/></svg>',
    tap: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.5,13.23A1,1,0,0,0,19.22,13l-4.2-2.1a1,1,0,0,0-1-.13L9.09,13.15a1,1,0,0,0-.59.91v5.09a1,1,0,0,0,.5,0.86l4.4,2.54a1,1,0,0,0,1,0l4.4-2.54A1,1,0,0,0,20.5,19.15ZM15,20.12l-3-1.72v-3.41l3,1.52Zm4.5-3.87-3,1.72-1.5-.76,3-2.23,1.5,1.13Z"/><path fill="currentColor" d="M16.44,4.24,15,3.5l-2,3.46L14.44,8Z"/><path fill="currentColor" d="M19,8.46l-2-3.46L15.56,6,17,6.76Z"/><path fill="currentColor" d="m11.56,6-1.44-.76L11.56,1.8Z"/><path fill="currentColor" d="M9.12,5.24,7.56,6,6.12,5.24,7.56,1.8Z"/></svg>',
    swipe: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 13l4-4l4 4M3 8l4-4l4 4"/><path fill="currentColor" d="M18.5,13.23A1,1,0,0,0,17.22,13l-4.2-2.1a1,1,0,0,0-1-.13l-4.93,2.38a1,1,0,0,0-.59.91v5.09a1,1,0,0,0,.5,0.86l4.4,2.54a1,1,0,0,0,1,0l4.4-2.54A1,1,0,0,0,18.5,19.15Z"/></svg>',
    checkmark: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" /></svg>',
    cross: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20,6.91L17.09,4L12,9.09L6.91,4L4,6.91L9.09,12L4,17.09L6.91,20L12,14.91L17.09,20L20,17.09L14.91,12L20,6.91Z" /></svg>',
    exclamation: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 4h2v12h-2z M11 18h2v2h-2z"/></svg>',
    question_mark: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,17.25A1.25,1.25 0 0,0 13.25,16A1.25,1.25 0 0,0 12,14.75A1.25,1.25 0 0,0 10.75,16A1.25,1.25 0 0,0 12,17.25M12,6.5A3.5,3.5 0 0,0 8.5,10H10.5A1.5,1.5 0 0,1 12,8.5A1.5,1.5 0 0,1 13.5,10C13.5,11.5 11,11.75 11,14H13C13,12.5 15.5,12.25 15.5,10A3.5,3.5 0 0,0 12,6.5Z" /></svg>',
};

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
        this.isPickerActive = false;

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
        this.pickerButton = null;

        // --- Store direct references to GUI folders ---
        this.cuePropertiesFolder = null;
        this.styleFolder = null;
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
            addShape: () => this.addCue({ type: 'Shape' }),
            addArrow: () => this.addCue({ type: 'Arrow' }),
            addIcon: () => this.addCue({ type: 'Icon' }),
            togglePicker: () => this.togglePickerMode(),
            deleteCue: () => this.deleteSelectedCue(),
            copyConfig: () => this.copyConfigToClipboard(),
        };

        const creationFolder = this.toolkit.addFolder('Creation');
        creationFolder.add(this.actions, 'addShape').name('Add Shape');
        creationFolder.add(this.actions, 'addArrow').name('Add Arrow');
        creationFolder.add(this.actions, 'addIcon').name('Add Icon');
        
        const advancedFolder = this.toolkit.addFolder('Advanced');
        this.pickerButton = advancedFolder.add(this.actions, 'togglePicker').name('Start Picking Element');
        
        // Store references to the folders for reliable access later
        this.cuePropertiesFolder = this.toolkit.addFolder('Cue Properties');
        this.styleFolder = this.toolkit.addFolder('Style');
        
        this.toolkit.add(this.actions, 'deleteCue').name('Delete Selected');
        this.copyButton = this.toolkit.add(this.actions, 'copyConfig').name('Copy Config to Clipboard');
        this.copyButton.disable(); // Disabled by default
    }

    /**
     * Toggles the element picker mode on and off.
     */
    togglePickerMode() {
        this.isPickerActive = !this.isPickerActive;
        this.pickerButton.name(this.isPickerActive ? 'Stop Picking (ESC)' : 'Start Picking Element');
        
        const overlay = this.uiManager.cache.directorModeOverlay;
        if (this.isPickerActive) {
            overlay.style.pointerEvents = 'none'; // Make overlay click-through
            overlay.classList.add('picker-active'); // For visual feedback (blur)
            this.logger.info.system('DirectorMode', 'SYSTEM', 'PICKER_ON', 'Element picker is active. Click an element to anchor a cue.');
        } else {
            overlay.style.pointerEvents = 'all'; // Make overlay interactive again
            overlay.classList.remove('picker-active');
            this.logger.info.system('DirectorMode', 'SYSTEM', 'PICKER_OFF', 'Element picker is inactive.');
        }
    }

    /**
     * Captures a clicked element, generates a selector for it, and anchors the selected cue.
     * @param {HTMLElement} target The DOM element that was clicked.
     */
    captureElement(target) {
        if (!this.selectedCue) {
            this.logger.warn('DirectorMode', 'Picker Error: No cue selected to anchor.');
            this.togglePickerMode(); // Turn picker off
            return;
        }

        let selector = '';
        if (target.id) {
            selector = `#${target.id}`;
        } else if (target.dataset.action) {
            selector = `[data-action="${target.dataset.action}"]`;
             if (target.dataset.goodId) selector += `[data-good-id="${target.dataset.goodId}"]`;
             if (target.dataset.shipId) selector += `[data-ship-id="${target.dataset.shipId}"]`;
        } else {
            // Fallback for elements without stable identifiers, including SVG elements
            const className = typeof target.className === 'string' ? target.className : (target.className?.baseVal || '');
            selector = target.tagName.toLowerCase() + (className ? '.' + className.split(' ').join('.') : '');
        }

        this.logger.info.system('DirectorMode', 'ANCHOR', `Anchored cue ${this.selectedCue.id} to element: ${selector}`);
        this.selectedCue.anchorTarget = selector;
        this.selectedCue.positionMode = 'anchored'; 
        
        this.updateToolkit(); 
        this.togglePickerMode(); // Automatically turn off picker after selection
        this.render();
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
            // Deprecating static position in favor of anchoring
            x: 100, 
            y: 100,
            width: 150,
            height: 150,
            // New anchoring properties
            positionMode: 'absolute', // 'absolute' or 'anchored'
            anchorTarget: null,       // CSS selector for the target element
            // Optional fine-tuning controls
            offsetX: 0,
            offsetY: 0,
            scaleWidth: 1.0,
            scaleHeight: 1.0,
            rotation: 0,
            style: {
                fill: 'rgba(253, 224, 71, 0.2)',
                stroke: '#fde047',
                strokeWidth: 3,
                opacity: 1,
                animation: 'None',
                animationSpeed: 2, // seconds
                glowColor: '#fde047',
                glowIntensity: 10, // pixels
                borderRadius: 0,
                boxShadow: 'none'
            }
        };

        if (type === 'Shape') {
            newCue.shapeType = 'Rectangle';
        } else if (type === 'Icon') {
            newCue.iconName = 'mouse_pointer';
        } else if (type === 'Arrow') {
            newCue.width = 100;
            newCue.height = 50;
        }

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

        // Use direct folder references
        const cueFolder = this.cuePropertiesFolder;
        const styleFolder = this.styleFolder;

        if (!cueFolder || !styleFolder) return;

        [...cueFolder.children, ...styleFolder.children].forEach(c => c.destroy());

        if (this.selectedCue) {
            const cue = this.selectedCue;

            const stepIdController = cueFolder.add(cue, 'tutorialStepId').name('Step ID');
            stepIdController.onChange(() => this.validateExport());
            this.cueControllers.push(stepIdController);

            const posModeController = cueFolder.add(cue, 'positionMode', ['absolute', 'anchored']).name('Positioning');
            posModeController.onChange(() => this.updateToolkit());
            this.cueControllers.push(posModeController);

            if (cue.positionMode === 'anchored') {
                this.cueControllers.push(cueFolder.add(cue, 'anchorTarget').name('Anchor Selector').listen());
                this.cueControllers.push(cueFolder.add(cue, 'offsetX', -200, 200, 1).name('Offset X').listen());
                this.cueControllers.push(cueFolder.add(cue, 'offsetY', -200, 200, 1).name('Offset Y').listen());
                this.cueControllers.push(cueFolder.add(cue, 'scaleWidth', 0.1, 5, 0.1).name('Scale Width').listen());
                this.cueControllers.push(cueFolder.add(cue, 'scaleHeight', 0.1, 5, 0.1).name('Scale Height').listen());
            } else {
                this.cueControllers.push(cueFolder.add(cue, 'x', 0, window.innerWidth).name('X').listen());
                this.cueControllers.push(cueFolder.add(cue, 'y', 0, window.innerHeight).name('Y').listen());
                this.cueControllers.push(cueFolder.add(cue, 'width', 10, 500).name('Width').listen());
                this.cueControllers.push(cueFolder.add(cue, 'height', 10, 500).name('Height').listen());
            }

            this.cueControllers.push(cueFolder.add(cue, 'rotation', 0, 360, 1).name('Rotation').listen());
            
            if (cue.type === 'Shape') {
                this.cueControllers.push(cueFolder.add(cue, 'shapeType', ['Rectangle', 'Ellipse']).name('Shape'));
                this.cueControllers.push(styleFolder.add(cue.style, 'borderRadius', 0, 100, 1).name('Border Radius'));
            } else if (cue.type === 'Icon') {
                this.cueControllers.push(cueFolder.add(cue, 'iconName', Object.keys(ICON_LIBRARY)).name('Icon'));
            }

            this.cueControllers.push(styleFolder.addColor(cue.style, 'fill').name('Fill Color'));
            this.cueControllers.push(styleFolder.addColor(cue.style, 'stroke').name('Stroke Color'));
            this.cueControllers.push(styleFolder.add(cue.style, 'strokeWidth', 0, 10, 1).name('Stroke Width'));
            this.cueControllers.push(styleFolder.add(cue.style, 'opacity', 0, 1, 0.1).name('Opacity'));
            this.cueControllers.push(styleFolder.add(cue.style, 'boxShadow').name('Box Shadow'));
            
            const animController = styleFolder.add(cue.style, 'animation', ['None', 'Pulse', 'Glow']).name('Animation');
            animController.onChange(() => this.updateToolkit());
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
                    this.actionState.originalWidth = cue.width;
                    this.actionState.originalHeight = cue.height;

                    if (target.classList.contains('resize-handle')) {
                        this.actionState.isDragging = false;
                        this.actionState.isResizing = true;
                        this.actionState.handle = target.dataset.handle;
                    }
                } else if (!target.closest('.lil-gui') && !this.isPickerActive) {
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
                } else if (this.selectedCue && (this.actionState.isDragging || this.actionState.isResizing)) {
                    const dx = e.clientX - this.actionState.startX;
                    const dy = e.clientY - this.actionState.startY;

                    if (this.actionState.isDragging) {
                        this.selectedCue.x = this.actionState.originalX + dx;
                        this.selectedCue.y = this.actionState.originalY + dy;
                    } else if (this.actionState.isResizing) {
                        // This logic is simplified and will be replaced with proper 8-point logic.
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
            
            if (cue.positionMode === 'anchored' && cue.anchorTarget) {
                const anchorEl = document.querySelector(cue.anchorTarget);
                if (anchorEl) {
                    const rect = anchorEl.getBoundingClientRect();
                    // Simple positioning for now, will add offsets later
                    el.style.left = `${rect.left}px`;
                    el.style.top = `${rect.top}px`;
                    el.style.width = `${rect.width}px`;
                    el.style.height = `${rect.height}px`;
                } else {
                     // Fallback if anchor not found
                    el.style.left = `${cue.x}px`;
                    el.style.top = `${cue.y}px`;
                    el.style.width = `${cue.width}px`;
                    el.style.height = `${cue.height}px`;
                }
            } else {
                el.style.left = `${cue.x}px`;
                el.style.top = `${cue.y}px`;
                el.style.width = `${cue.width}px`;
                el.style.height = `${cue.height}px`;
            }

            el.style.transform = `rotate(${cue.rotation}deg)`;
            el.style.opacity = cue.style.opacity;
            el.style.boxShadow = cue.style.boxShadow;

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
            } else if (cue.type === 'Icon') {
                content = ICON_LIBRARY[cue.iconName] || '';
                el.style.color = cue.style.fill; // Use fill color for icon color
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
            }

            el.innerHTML = content;

            // Apply animation styles directly to the child element (SVG or icon) for better performance
            const animatedChild = el.querySelector('svg') || el;
            if (cue.style.animation !== 'None') {
                animatedChild.classList.add(`anim-${cue.style.animation.toLowerCase()}`);
                animatedChild.style.setProperty('--glow-color', cue.style.glowColor);
                animatedChild.style.setProperty('--glow-intensity', `${cue.style.glowIntensity}px`);
                animatedChild.style.setProperty('--anim-speed', `${cue.style.animationSpeed}s`);
            }


            if (this.selectedCue && this.selectedCue.id === cue.id) {
                el.classList.add('selected');
                const handles = `
                    <div class="resize-handle n" data-handle="n"></div><div class="resize-handle ne" data-handle="ne"></div>
                    <div class="resize-handle e" data-handle="e"></div><div class="resize-handle se" data-handle="se"></div>
                    <div class="resize-handle s" data-handle="s"></div><div class="resize-handle sw" data-handle="sw"></div>
                    <div class="resize-handle w" data-handle="w"></div><div class="resize-handle nw" data-handle="nw"></div>
                    <div class="rotate-handle" data-handle="rotate"></div>
                `;
                el.innerHTML += handles;
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