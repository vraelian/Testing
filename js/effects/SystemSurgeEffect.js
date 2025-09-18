import { BaseEffect } from './BaseEffect.js';

/**
 * @fileoverview Defines the SystemSurgeEffect class, a full-screen celebration effect.
 */

export class SystemSurgeEffect extends BaseEffect {

    /**
     * @JSDoc
     * @constructor
     * @param {object} options - Configuration for the effect.
     * @param {string} options.text - The text to display.
     * @param {string} options.theme - The color theme ('gold', 'green', 'red', 'blue').
     */
    constructor(options) {
        super(options);
        this.domElements = {};
        this.themes = {
            gold: { color: 'rgba(253, 224, 71, 0.7)', glow: '#fde047' },
            green: { color: 'rgba(74, 222, 128, 0.7)', glow: '#4ade80' },
            red: { color: 'rgba(248, 113, 113, 0.7)', glow: '#ef4444' },
            blue: { color: 'rgba(96, 165, 250, 0.7)', glow: '#60a5fa' }
        };
    }

    /**
     * @JSDoc
     * @method play
     * @override
     * @description Runs the entire System Surge effect from creation to cleanup.
     * @returns {Promise<void>} A promise that resolves when the effect is finished.
     */
    async play() {
        return new Promise(resolve => {
            this._injectCSS();
            this._createDOM();

            const onsetDuration = 1550; // Longest intro animation
            const holdDuration = 2000;
            const fadeDuration = 3000;

            // Start the effect
            // A short delay to ensure DOM is painted before adding animation class
            setTimeout(() => {
                document.body.classList.add('system-surge-active');
            }, 50);

            // Schedule the transition to fade-out
            setTimeout(() => {
                document.body.classList.remove('system-surge-active');
                document.body.classList.add('system-surge-fading');
            }, onsetDuration + holdDuration);

            // Schedule the final cleanup and resolve the promise
            setTimeout(() => {
                this._cleanup();
                resolve();
            }, onsetDuration + holdDuration + fadeDuration);
        });
    }

    /**
     * @JSDoc
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
        this.domElements.overlay = overlay;

        const surgeLight = document.createElement('div');
        surgeLight.className = 'surge-light';
        this.domElements.surgeLight = surgeLight;

        const surgeText = document.createElement('div');
        surgeText.className = 'surge-text';
        surgeText.id = 'surge-text';
        surgeText.textContent = this.options.text || '';
        this.domElements.surgeText = surgeText;

        overlay.appendChild(surgeLight);
        overlay.appendChild(surgeText);
        this._createParticles(30);

        document.body.appendChild(overlay);
    }
    
    /**
     * @JSDoc
     * @method _createParticles
     * @private
     * @description Creates and animates a specified number of particle elements.
     * @param {number} count - The number of particles to create.
     */
    _createParticles(count) {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 5 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 1.5}s`;
            particle.style.animationDuration = `${Math.random() * 3 + 4}s`;
            this.domElements.overlay.appendChild(particle);
        }
    }


    /**
     * @JSDoc
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
     * @JSDoc
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
     * @JSDoc
     * @property {string} css
     * @static
     * @description Static property containing all CSS for this effect.
     */
    static css = `
        #celebration-overlay {
            --surge-color: #00ffff;
            --surge-glow: #00ffff;
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
            opacity: 0.4;
            transition: all 2.9s ease-out;
        }
        .system-surge-active .surge-light {
            bottom: 0;
            opacity: 0.4;
            transition-delay: 0.2s;
        }

        .surge-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 5vw;
            font-weight: 700;
            color: #fff;
            text-shadow: 0 0 10px #fff, 0 0 20px var(--surge-glow), 0 0 40px var(--surge-glow);
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
            border-radius: 50%;
            opacity: 0;
            animation: system-surge-rise 8s ease-in forwards;
        }

        @keyframes system-surge-rise {
            0% { transform: translateY(0); opacity: 0.7; }
            100% { transform: translateY(-105vh); opacity: 0; }
        }
    `;
}