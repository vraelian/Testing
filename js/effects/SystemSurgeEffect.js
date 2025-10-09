// js/effects/SystemSurgeEffect.js
import { BaseEffect } from './BaseEffect.js';

/**
 * @fileoverview Defines the SystemSurgeEffect class, a full-screen celebration effect.
 */

export class SystemSurgeEffect extends BaseEffect {

    /**
     * @constructor
     * @param {object} options - Configuration for the effect.
     * @param {string} [options.text='SYSTEM SURGE'] - The text to display, overrides profile default.
     * @param {string} [options.subtext=''] - The subtext to display below the main text.
     * @param {string} [options.theme='blue'] - The color theme, determines the profile to use.
     */
    constructor(options = {}) {
        super(options);

        // --- MOBILE-FIRST OPTIMIZATIONS ---
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        const theme = options.theme || 'blue';
        const profile = SystemSurgeEffect.PROFILES[theme] || SystemSurgeEffect.PROFILES.blue;

        this.options = {
            ...profile,
            ...options,
            theme: theme
        };

        // Reduce particle count on mobile to lessen performance load.
        if (this.isMobile) {
            this.options.particleCount = Math.floor(this.options.particleCount / 2);
        }

        this.domElements = {};
        this.particles = [];
        this.animationIntervalId = null; // Used for both rAF and setInterval
        this.isPaused = false;

        this._animationLoop = this._animationLoop.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);

        this.themes = {
            gold: { color: 'rgba(255, 223, 0, 0.8)', glow: '#ffd700' },
            green: { color: 'rgba(50, 255, 150, 0.8)', glow: '#32ff96' },
            red: { color: 'rgba(255, 50, 50, 0.8)', glow: '#ff3232' },
            blue: { color: 'rgba(50, 150, 255, 0.8)', glow: '#3296ff' },
            orange: { color: 'rgba(255, 165, 0, 0.8)', glow: '#ffa500' },
            purple: { color: 'rgba(220, 50, 255, 0.8)', glow: '#dc32ff' },
            silver: { color: 'rgba(192, 192, 192, 0.9)', glow: '#c0c0c0' },
            tan: { color: 'rgba(210, 180, 140, 0.9)', glow: '#d2b48c' }
        };
    }

    /**
     * @method play
     * @description Creates DOM, forces reflow, starts CSS transitions, then starts a robust animation loop.
     * Uses setInterval on mobile as a fallback for the heavily throttled requestAnimationFrame.
     * @override
     * @async
     * @returns {Promise<void>} A promise that resolves when the effect is complete.
     */
    async play() {
        return new Promise(resolve => {
            this._createDOM();
            document.addEventListener('visibilitychange', this._handleVisibilityChange);

            if (this.domElements.overlay) {
                const reflow = this.domElements.overlay.offsetHeight;
            }

            document.body.classList.add('system-surge-active');

            this.resume(); // Start the animation loop

            const { fadeInTime, lingerTime, fadeOutTime } = this.options;
            const totalDuration = fadeInTime + lingerTime + fadeOutTime;

            setTimeout(() => {
                document.body.classList.remove('system-surge-active');
                document.body.classList.add('system-surge-fading');
            }, fadeInTime + lingerTime);

            setTimeout(() => {
                this._cleanup();
                resolve();
            }, totalDuration);
        });
    }

    /**
     * @method pause
     * @description Pauses the animation loop.
     */
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        if (this.isMobile) {
            clearInterval(this.animationIntervalId);
        } else {
            cancelAnimationFrame(this.animationIntervalId);
        }
        this.animationIntervalId = null;
    }

    /**
     * @method resume
     * @description Resumes the animation loop.
     */
    resume() {
        if (!this.isPaused && this.animationIntervalId) return;
        this.isPaused = false;
        if (this.isMobile) {
            // Use setInterval for more reliable execution on throttled mobile browsers.
            this.animationIntervalId = setInterval(this._animationLoop, 1000 / 60);
        } else {
            // Use requestAnimationFrame for smoother animation on desktop.
            this.animationIntervalId = requestAnimationFrame(this._animationLoop);
        }
    }

    /**
     * @method _handleVisibilityChange
     * @description Pauses or resumes the animation when the page visibility changes.
     * @private
     */
    _handleVisibilityChange() {
        if (document.hidden) {
            this.pause();
        } else {
            this.resume();
        }
    }

    _createDOM() {
        const themeColors = this.themes[this.options.theme] || this.themes.blue;

        const overlay = document.createElement('div');
        overlay.id = 'celebration-overlay';
        overlay.style.setProperty('--surge-color', themeColors.color);
        overlay.style.setProperty('--surge-glow', themeColors.glow);
        this.domElements.overlay = overlay;

        const surgeLight = document.createElement('div');
        surgeLight.className = 'surge-light';
        this.domElements.surgeLight = surgeLight;

        const textContainer = document.createElement('div');
        textContainer.className = 'surge-text';

        const surgeText = document.createElement('div');
        surgeText.textContent = this.options.text;
        surgeText.style.fontSize = this.options.textSize;
        textContainer.appendChild(surgeText);

        if (this.options.subtext) {
            const surgeSubText = document.createElement('div');
            surgeSubText.textContent = this.options.subtext;
            surgeSubText.style.fontSize = this.options.subtextSize || '6vw';
            surgeSubText.style.opacity = '0.8';
            surgeSubText.style.marginTop = '1rem';
            textContainer.appendChild(surgeSubText);
        }

        this.domElements.surgeText = textContainer;
        
        const canvas = document.createElement('canvas');
        canvas.id = 'particle-canvas';
        this.domElements.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        overlay.appendChild(surgeLight);
        overlay.appendChild(canvas);
        overlay.appendChild(textContainer);
        document.body.appendChild(overlay);

        this._resizeCanvas();
        this._initializeParticles();
        window.addEventListener('resize', this._resizeCanvas.bind(this));
    }

    _resizeCanvas() {
        const canvas = this.domElements.canvas;
        if (canvas) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
    }
    
    _initializeParticles() {
        const canvas = this.domElements.canvas;
        if (!canvas) return;
        this.particles = [];
        for (let i = 0; i < this.options.particleCount; i++) {
            this.particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * (this.options.particleSize.max - this.options.particleSize.min) + this.options.particleSize.min,
                speed: Math.random() * (this.options.particleSpeed.max - this.options.particleSpeed.min) + this.options.particleSpeed.min,
                alpha: 0.5 + Math.random() * 0.5
            });
        }
    }

    _animationLoop() {
        if (!this.ctx || this.isPaused) return;
        
        const canvas = this.domElements.canvas;
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const themeColors = this.themes[this.options.theme] || this.themes.blue;
        this.ctx.fillStyle = themeColors.color;
        
        this.particles.forEach(p => {
            p.y -= p.speed;
            if (p.y < -p.size) {
                p.y = canvas.height + p.size;
                p.x = Math.random() * canvas.width;
            }
            
            this.ctx.globalAlpha = p.alpha;
            this.ctx.beginPath();

            if (this.options.particleShape === 'circle') {
                this.ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            } else if (this.options.particleShape === 'sliver') {
                this.ctx.rect(p.x, p.y, 2, p.size);
            } else {
                this.ctx.rect(p.x - 2, p.y, 4, p.size);
            }
            this.ctx.fill();
        });

        // If using requestAnimationFrame, we need to re-queue the next frame.
        // For setInterval, this is not needed as it loops automatically.
        if (!this.isMobile) {
            this.animationIntervalId = requestAnimationFrame(this._animationLoop);
        }
    }
    
    _cleanup() {
        this.pause(); // Stop the animation loop
        document.removeEventListener('visibilitychange', this._handleVisibilityChange);
        window.removeEventListener('resize', this._resizeCanvas.bind(this));
        document.body.classList.remove('system-surge-active', 'system-surge-fading');
        Object.values(this.domElements).forEach(element => element && element.remove());
    }

    /**
     * @property {Object} PROFILES
     * @static
     */
    static PROFILES = {
        tan: {
            text: 'TRADING LICENSE ACQUIRED',
            textSize: '7vw', particleCount: 20, particleShape: 'sliver',
            particleSize: { min: 2, max: 20 }, particleSpeed: { min: 1, max: 7 },
            fadeInTime: 1900, lingerTime: 3950, fadeOutTime: 3750
        },
        silver: {
            text: 'SHIP PURCHASED',
            textSize: '7vw', particleCount: 20, particleShape: 'sliver',
            particleSize: { min: 1, max: 20 }, particleSpeed: { min: 1, max: 5 },
            fadeInTime: 500, lingerTime: 3900, fadeOutTime: 3500
        },
        purple: {
            text: 'WEALTH MILESTONE ACHIEVED',
            textSize: '7vw', particleCount: 18, particleShape: 'rectangle',
            particleSize: { min: 1, max: 9 }, particleSpeed: { min: 1.5, max: 4 },
            fadeInTime: 500, lingerTime: 4250, fadeOutTime: 3500
        },
        orange: {
            text: 'ORANGE',
            textSize: '7vw', particleCount: 40, particleShape: 'sliver',
            particleSize: { min: 1, max: 6 }, particleSpeed: { min: 2.5, max: 8.5 },
            fadeInTime: 1750, lingerTime: 3250, fadeOutTime: 3500
        },
        blue: {
            text: 'HAPPY BIRTHDAY',
            subtext: 'Age: XX',
            textSize: '7vw', 
            subtextSize: '6vw',
            particleCount: 30, particleShape: 'circle',
            particleSize: { min: 5, max: 20 }, particleSpeed: { min: 4, max: 7.5 },
            fadeInTime: 1750, lingerTime: 4300, fadeOutTime: 5000
        },
        red: {
            text: 'SUPERIOR SHIP ACQUIRED',
            textSize: '7vw', particleCount: 30, particleShape: 'rectangle',
            particleSize: { min: 3, max: 10 }, particleSpeed: { min: 1, max: 3.5 },
            fadeInTime: 1750, lingerTime: 3000, fadeOutTime: 5000
        },
        green: {
            text: 'WEALTH MILESTONE ACHIEVED',
            textSize: '7vw', particleCount: 22, particleShape: 'sliver',
            particleSize: { min: 1, max: 20 }, particleSpeed: { min: 2.5, max: 15.5 },
            fadeInTime: 1750, lingerTime: 3000, fadeOutTime: 5000
        },
        gold: {
            text: 'MISSION COMPLETE',
            textSize: '7vw', particleCount: 62, particleShape: 'circle',
            particleSize: { min: 3, max: 18 }, particleSpeed: { min: 2.5, max: 12 },
            fadeInTime: 1750, lingerTime: 1900, fadeOutTime: 5000
        }
    };
}