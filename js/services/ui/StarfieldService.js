/**
 * Service responsible for managing the lifecycle, rendering, and state transitions 
 * of the starfield background effect across different UI layers.
 * @class StarfieldService
 */
class StarfieldService {
    constructor() {
        /** @type {HTMLElement|null} */
        this.container = null;
        /** @type {HTMLCanvasElement|null} */
        this.canvas = null;
        /** @type {CanvasRenderingContext2D|null} */
        this.ctx = null;
        /** @type {number|null} */
        this.animationFrameId = null;
        /** @type {Array<Object>} */
        this.stars = [];
        
        // Configuration for the visual effect
        this.config = {
            starCount: 300,
            baseSpeed: 1.5, // Base Z-axis reduction rate
            zIndex: 40 
        };

        // Dynamic Velocity State
        this.currentSpeedMultiplier = 0.2;
        this.targetSpeedMultiplier = 0.2;
    }

    /**
     * Injects the starfield container into the DOM and initializes the canvas.
     * Starts the render loop but keeps the layer visually hidden (opacity 0) 
     * until an entry state is triggered.
     * @param {HTMLElement} [parentElement=document.body] - The DOM node to append the starfield to.
     */
    mount(parentElement = document.body) {
        if (this.container) return; // Prevent multiple mounts

        this.container = document.createElement('div');
        this.container.id = 'starfield-overlay';
        this.container.style.zIndex = this.config.zIndex;
        this.container.style.pointerEvents = 'none';

        this.canvas = document.createElement('canvas');
        this.canvas.style.pointerEvents = 'none'; // Bulletproof click-through for WebKit
        this.ctx = this.canvas.getContext('2d');
        
        this.container.appendChild(this.canvas);
        parentElement.appendChild(this.container);

        this._resizeCanvas();
        window.addEventListener('resize', this._resizeCanvas.bind(this));

        this._initStars();
        this._renderLoop();
    }

    /**
     * Velocity Control: Slow drift for idling/menus
     */
    setIdleWarp() {
        this.targetSpeedMultiplier = 0.2;
    }

    /**
     * Velocity Control: Massive acceleration for travel sequence
     */
    setEngageWarp() {
        this.targetSpeedMultiplier = 12.0;
    }

    /**
     * Velocity Control: Braking sequence for arriving at destination
     */
    setDecelerateWarp() {
        this.targetSpeedMultiplier = 0.2;
    }

    /**
     * Applies the 1-second blur-fade-in CSS class.
     */
    triggerEntry() {
        if (!this.container) return;
        this._resetClasses();
        
        // Force a synchronous DOM reflow so the transition executes cleanly
        void this.container.offsetWidth;
        
        this.container.classList.add('starfield-entry');
        this.setIdleWarp(); // Ensure it begins in idle state
    }

    /**
     * Applies the 0.4-second rapid blur-fade-out CSS class for modal dismissals,
     * followed by complete DOM removal.
     */
    triggerQuickExit() {
        if (!this.container) return;
        this._resetClasses();
        this.container.classList.add('starfield-exit-quick');
        
        setTimeout(() => {
            this.unmount();
        }, 400);
    }

    /**
     * Applies the 0.6-second blur-fade-out CSS class for station arrivals,
     * followed by complete DOM removal.
     */
    triggerArrivalExit() {
        if (!this.container) return;
        this._resetClasses();
        this.container.classList.add('starfield-exit-arrival');
        
        setTimeout(() => {
            this.unmount();
        }, 600);
    }

    /**
     * Ceases the animation loop and entirely removes the starfield nodes from the DOM.
     */
    unmount() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        window.removeEventListener('resize', this._resizeCanvas.bind(this));
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.stars = [];
    }

    /**
     * Clears existing state classes to prevent transition conflicts.
     * @private
     */
    _resetClasses() {
        this.container.classList.remove('starfield-entry', 'starfield-exit-quick', 'starfield-exit-arrival');
    }

    /**
     * Adjusts canvas dimensions to match the viewport, calculating for Retina displays.
     * @private
     */
    _resizeCanvas() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;

        // Lock CSS size to standard viewport dimensions
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;

        // Scale the internal rendering buffer to the hardware pixel density
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
    }

    /**
     * Populates the initial star array based on configuration.
     * @private
     */
    _initStars() {
        this.stars = [];
        for (let i = 0; i < this.config.starCount; i++) {
            this.stars.push(this._createStar());
        }
    }

    /**
     * Generates a 3D coordinate for a star, mapping to the Retina buffer size.
     * @private
     */
    _createStar() {
        const dpr = window.devicePixelRatio || 1;
        return {
            x: (Math.random() - 0.5) * window.innerWidth * dpr * 2,
            y: (Math.random() - 0.5) * window.innerHeight * dpr * 2,
            z: Math.random() * 1000,
            pz: Math.random() * 1000 // Previous Z (used to draw the speed streak)
        };
    }

    /**
     * Recursive animation loop for moving and drawing stars in 3D space.
     * @private
     */
    _renderLoop() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // Smoothly interpolate current speed towards the target speed (The "Punch It" effect)
        this.currentSpeedMultiplier += (this.targetSpeedMultiplier - this.currentSpeedMultiplier) * 0.05;

        this.ctx.strokeStyle = 'rgba(220, 240, 255, 0.9)';
        this.ctx.lineCap = 'round';

        for (let star of this.stars) {
            star.pz = star.z; 
            star.z -= this.config.baseSpeed * this.currentSpeedMultiplier;

            // Reset star to the far distance if it passes the camera plane
            if (star.z <= 1) {
                Object.assign(star, this._createStar());
                star.z = 1000;
                star.pz = 1000;
            }

            // 3D to 2D Projection mapping
            const factor = 400 / star.z;
            const px = cx + star.x * factor;
            const py = cy + star.y * factor;
            
            const pFactor = 400 / star.pz;
            const ppx = cx + star.x * pFactor;
            const ppy = cy + star.y * pFactor;

            // Size scales up as it gets closer to the camera
            const size = Math.max(0.5, (1 - star.z / 1000) * 3.5);

            // Only draw if the projected coordinates are within the native bounds
            if (px >= 0 && px <= this.canvas.width && py >= 0 && py <= this.canvas.height) {
                this.ctx.lineWidth = size;
                this.ctx.beginPath();
                this.ctx.moveTo(ppx, ppy);
                this.ctx.lineTo(px + (px === ppx ? 0.1 : 0), py + (py === ppy ? 0.1 : 0));
                this.ctx.stroke();
            }
        }

        this.animationFrameId = requestAnimationFrame(this._renderLoop.bind(this));
    }
}

export const starfieldService = new StarfieldService();