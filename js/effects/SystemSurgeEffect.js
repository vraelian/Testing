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
     * @param {string} [options.theme='blue'] - The color theme, determines the profile to use.
     */
    constructor(options = {}) {
        super(options);

        const theme = options.theme || 'blue';
        const profile = SystemSurgeEffect.PROFILES[theme] || SystemSurgeEffect.PROFILES.blue;

        // Combine the profile defaults with any specific overrides from the options.
        this.options = {
            ...profile,
            ...options, // Any options passed in will override the profile defaults.
            theme: theme // Ensure the theme is correctly set.
        };

        this.domElements = {};
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
     * @override
     * @description Runs the entire System Surge effect from creation to cleanup.
     * @returns {Promise<void>} A promise that resolves when the effect is finished.
     */
    async play() {
        return new Promise(resolve => {
            this._injectCSS();
            this._createDOM();

            const onsetDuration = this.options.fadeInTime;
            const holdDuration = this.options.lingerTime;
            const fadeDuration = this.options.fadeOutTime;

            setTimeout(() => {
                document.body.classList.add('system-surge-active');
            }, 50);

            setTimeout(() => {
                document.body.classList.remove('system-surge-active');
                document.body.classList.add('system-surge-fading');
            }, onsetDuration + holdDuration);

            setTimeout(() => {
                this._cleanup();
                resolve();
            }, onsetDuration + holdDuration + fadeDuration);
        });
    }

    /**
     * @method _createDOM
     * @protected
     * @override
     * @description Creates the DOM elements for the System Surge effect.
     */
    _createDOM() {
        const themeColors = this.themes[this.options.theme] || this.themes.blue;

        const overlay = document.createElement('div');
        overlay.id = 'celebration-overlay';
        overlay.style.setProperty('--surge-color', themeColors.color);
        overlay.style.setProperty('--surge-glow', themeColors.glow);
        overlay.style.setProperty('--particle-travel-distance', `${this.options.travelDistance}vh`);
        this.domElements.overlay = overlay;

        const surgeLight = document.createElement('div');
        surgeLight.className = 'surge-light';
        this.domElements.surgeLight = surgeLight;

        const surgeText = document.createElement('div');
        surgeText.className = 'surge-text';
        surgeText.textContent = this.options.text;
        surgeText.style.fontSize = this.options.textSize;
        this.domElements.surgeText = surgeText;

        overlay.appendChild(surgeLight);
        overlay.appendChild(surgeText);
        this._createParticles(this.options.particleCount);

        document.body.appendChild(overlay);
    }
    
    /**
     * @method _createParticles
     * @private
     * @description Creates and animates a specified number of particle elements.
     * @param {number} count - The number of particles to create.
     */
    _createParticles(count) {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = `particle particle-shape-${this.options.particleShape}`;
            
            const size = Math.random() * (this.options.particleSize.max - this.options.particleSize.min) + this.options.particleSize.min;
            const speed = Math.random() * (this.options.particleSpeed.max - this.options.particleSpeed.min) + this.options.particleSpeed.min;
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 1.5}s`;
            particle.style.animationDuration = `${speed}s`;
            this.domElements.overlay.appendChild(particle);
        }
    }

    /**
     * @method _injectCSS
     * @protected
     * @override
     * @description Injects the CSS required for the System Surge effect into the document head.
     */
    _injectCSS() {
        const style = document.createElement('style');
        style.id = 'system-surge-styles';
        style.textContent = SystemSurgeEffect.css;
        document.head.appendChild(style);
        this.domElements.style = style;
    }

    /**
     * @method _cleanup
     * @protected
     * @override
     * @description Removes all DOM elements, styles, and body classes added by the effect.
     */
    _cleanup() {
        document.body.classList.remove('system-surge-active', 'system-surge-fading');
        Object.values(this.domElements).forEach(element => element && element.remove());
    }

    /**
     * @property {Object} PROFILES
     * @static
     * @description Static property containing the default parameter profiles for each theme.
     */
    static PROFILES = {
        tan: {
            text: 'LICENSE ACQUIRED',
            textSize: '8vw', particleCount: 74, particleShape: 'sliver',
            particleSize: { min: 1, max: 11 }, particleSpeed: { min: 1, max: 7.5 },
            travelDistance: 110, fadeInTime: 1900, lingerTime: 3150, fadeOutTime: 5000
        },
        silver: {
            text: 'SHIP PURCHASED',
            textSize: '8vw', particleCount: 90, particleShape: 'sliver',
            particleSize: { min: 1, max: 3 }, particleSpeed: { min: 1, max: 4 },
            travelDistance: 100, fadeInTime: 500, lingerTime: 3050, fadeOutTime: 3500
        },
        purple: {
            text: 'WEALTH MILESTONE',
            textSize: '8vw', particleCount: 18, particleShape: 'rectangle',
            particleSize: { min: 1, max: 9 }, particleSpeed: { min: 1.5, max: 4 },
            travelDistance: 100, fadeInTime: 500, lingerTime: 3050, fadeOutTime: 3500
        },
        orange: {
            text: 'ORANGE',
            textSize: '8vw', particleCount: 96, particleShape: 'sliver',
            particleSize: { min: 1, max: 6 }, particleSpeed: { min: 2.5, max: 8.5 },
            travelDistance: 120, fadeInTime: 1750, lingerTime: 3750, fadeOutTime: 3500
        },
        blue: {
            text: 'HAPPY BIRTHDAY',
            textSize: '8vw', particleCount: 50, particleShape: 'circle',
            particleSize: { min: 7, max: 20 }, particleSpeed: { min: 5, max: 8.5 },
            travelDistance: 120, fadeInTime: 1750, lingerTime: 3750, fadeOutTime: 3500
        },
        red: {
            text: 'TOP CLASS',
            textSize: '8vw', particleCount: 115, particleShape: 'rectangle',
            particleSize: { min: 5, max: 6 }, particleSpeed: { min: 1, max: 5.5 },
            travelDistance: 120, fadeInTime: 1750, lingerTime: 3000, fadeOutTime: 5000
        },
        green: {
            text: 'WEALTH MILESTONE',
            textSize: '8vw', particleCount: 200, particleShape: 'sliver',
            particleSize: { min: 1, max: 20 }, particleSpeed: { min: 1, max: 4 },
            travelDistance: 50, fadeInTime: 1750, lingerTime: 3000, fadeOutTime: 5000
        },
        gold: {
            text: 'MISSION COMPLETE',
            textSize: '8vw', particleCount: 62, particleShape: 'circle',
            particleSize: { min: 3, max: 18 }, particleSpeed: { min: 2.5, max: 12 },
            travelDistance: 115, fadeInTime: 1750, lingerTime: 1900, fadeOutTime: 5000
        }
    };

    /**
     * @property {string} css
     * @static
     * @description Static property containing all CSS for this effect.
     */
    static css = `
        #celebration-overlay {
            --surge-color: #00ffff;
            --surge-glow: #00ffff;
            --particle-travel-distance: 105vh;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            opacity: 0;
        }

        .system-surge-active #celebration-overlay {
            opacity: 1;
            transition: opacity 0.2s ease-in;
        }
        .system-surge-fading #celebration-overlay {
            opacity: 0;
            transition: opacity 3s ease-out;
        }

        .surge-light {
            position: absolute;
            bottom: -100%;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to top, var(--surge-color), transparent 60%);
            opacity: 0.6;
            transition: all 2.9s ease-out;
        }
        .system-surge-active .surge-light {
            bottom: 0;
            opacity: 0.6;
            transition-delay: 0.2s;
        }

        .surge-text {
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            color: #fff;
            text-shadow: 0 0 10px #fff, 0 0 25px var(--surge-glow), 0 0 50px var(--surge-glow);
            transform: scale(0.5);
            opacity: 0;
            transition: all 1.15s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }
        .system-surge-active .surge-text {
            transform: scale(1);
            opacity: 1;
            transition-delay: 0.4s;
        }

        .particle {
            position: absolute;
            bottom: -20px;
            background-color: var(--surge-color);
            opacity: 0;
            animation: system-surge-rise 8s ease-in forwards;
            box-shadow: 0 0 8px var(--surge-color);
        }

        .particle-shape-circle {
            border-radius: 50%;
        }
        .particle-shape-star {
            background-color: transparent;
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            border: 1px solid var(--surge-color);
        }
        .particle-shape-sliver {
            width: 2px !important;
            height: 20px !important;
            border-radius: 2px;
        }
        .particle-shape-rectangle {
            height: 12px !important;
            width: 4px !important;
        }

        @keyframes system-surge-rise {
            0% { transform: translateY(0); opacity: 0.9; }
            100% { transform: translateY(calc(-1 * var(--particle-travel-distance))); opacity: 0; }
        }
    `;
}