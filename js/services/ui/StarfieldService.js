/**
 * Service responsible for managing the lifecycle, rendering, and state transitions 
 * of the starfield background effect across different UI layers.
 * * @class StarfieldService
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
            starCount: 200,
            baseSpeed: 0.5,
            zIndex: 50 // Positioned to render behind modals but above base UI
        };
    }

    /**
     * Injects the starfield container into the DOM and initializes the canvas.
     * Starts the render loop but keeps the layer visually hidden (opacity 0) 
     * until an entry state is triggered.
     * * @param {HTMLElement} [parentElement=document.body] - The DOM node to append the starfield to.
     */
    mount(parentElement = document.body) {
        if (this.container) return; // Prevent multiple mounts

        this.container = document.createElement('div');
        this.container.id = 'starfield-overlay';
        this.container.style.zIndex = this.config.zIndex;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        parentElement.appendChild(this.container);

        this._resizeCanvas();
        window.addEventListener('resize', this._resizeCanvas.bind(this));

        this._initStars();
        this._renderLoop();
    }

    /**
     * Applies the 1-second blur-fade-in CSS class.
     */
    triggerEntry() {
        if (!this.container) return;
        this._resetClasses();
        // Small timeout ensures the DOM registers the base state before applying transition
        requestAnimationFrame(() => {
            this.container.classList.add('starfield-entry');
        });
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
     * Adjusts canvas dimensions to match the viewport.
     * @private
     */
    _resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Populates the initial star array based on configuration.
     * @private
     */
    _initStars() {
        this.stars = [];
        for (let i = 0; i < this.config.starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2,
                speed: (Math.random() * 1) + this.config.baseSpeed
            });
        }
    }

    /**
     * Recursive animation loop for moving and drawing stars.
     * @private
     */
    _renderLoop() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';

        for (let star of this.stars) {
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Move star downward/outward (adjust vector logic to match the specific intro effect)
            star.y += star.speed;

            // Reset star to top if it goes off screen
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        }

        this.animationFrameId = requestAnimationFrame(this._renderLoop.bind(this));
    }
}

export const starfieldService = new StarfieldService();