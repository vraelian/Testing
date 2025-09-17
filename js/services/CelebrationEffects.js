// js/services/CelebrationEffects.js
/**
 * @fileoverview This file contains the JavaScript logic for triggering the celebration effects.
 * @JSDoc
 * @description To implement, create an instance of this CelebrationEffects class within your UIManager.
 * Pass the required DOM element references to its constructor. Then, call the public methods
 * (e.g., `uiManager.effects.triggerSystemSurge('gold', 'Mission Complete')`) from your
 * SimulationService or EventManager where appropriate.
 */
export class CelebrationEffects {
    /**
     * @JSDoc
     * @constructor
     * @param {object} elements - A map of required DOM elements.
     * @param {HTMLElement} elements.body - The document.body element.
     * @param {HTMLElement} elements.gameContainer - The main game container element to which the glow class is applied.
     * @param {HTMLElement} elements.creditDisplay - The specific <span> element for the credit text.
     * @param {HTMLElement} elements.overlay - The main #celebration-overlay element.
     * @param {HTMLElement} elements.surgeText - The #surge-text element inside the overlay.
     */
    constructor(elements) {
        this.elements = elements;
        this.isSurgeActive = false;

        // A map of theme names to their color values for the System Surge effect.
        this.themes = {
            gold: { color: 'rgba(253, 224, 71, 0.7)', glow: '#fde047' },
            green: { color: 'rgba(74, 222, 128, 0.7)', glow: '#4ade80' },
            red: { color: 'rgba(248, 113, 113, 0.7)', glow: '#ef4444' },
            blue: { color: 'rgba(96, 165, 250, 0.7)', glow: '#60a5fa' }
        };
    }

    /**
     * @JSDoc
     * @method triggerCreditGlow
     * @description Triggers the credit glow and enlargement animation on the credit display.
     * Also animates the number changing for a more dynamic feel.
     * @param {number} startCredits - The credit value before the gain.
     * @param {number} endCredits - The final credit value to display.
     */
    triggerCreditGlow(startCredits, endCredits) {
        if (this.elements.gameContainer.classList.contains('credit-glow-active')) return;

        this.elements.gameContainer.classList.add('credit-glow-active');

        let currentCredits = startCredits;
        const duration = 1000; // Animate number change over 1 second
        const stepTime = 20;
        const steps = duration / stepTime;
        const increment = (endCredits - startCredits) / steps;

        const counter = setInterval(() => {
            currentCredits += increment;
            if (currentCredits >= endCredits) {
                currentCredits = endCredits;
                clearInterval(counter);
            }
            this.elements.creditDisplay.textContent = `⌬ ${Math.floor(currentCredits).toLocaleString()}`;
        }, stepTime);

        setTimeout(() => {
            this.elements.gameContainer.classList.remove('credit-glow-active');
            this.elements.creditDisplay.textContent = `⌬ ${Math.floor(endCredits).toLocaleString()}`;
        }, 2500); // Total animation duration is 2.5s
    }

    /**
     * @JSDoc
     * @method triggerSystemSurge
     * @description Triggers the full-screen celebration effect with a specific theme and text.
     * @param {string} themeName - The name of the theme to use ('gold', 'green', 'red', 'blue').
     * @param {string} text - The text to display in the center of the screen.
     */
    triggerSystemSurge(themeName, text) {
        if (this.isSurgeActive) return;
        this.isSurgeActive = true;

        const themeColors = this.themes[themeName];
        if (!themeColors) {
            console.warn(`Invalid surge theme: ${themeName}`);
            this.isSurgeActive = false;
            return;
        }

        this.elements.surgeText.textContent = text;
        this.elements.overlay.style.setProperty('--surge-color', themeColors.color);
        this.elements.overlay.style.setProperty('--surge-glow', themeColors.glow);

        this.elements.body.classList.add('system-surge-active');
        this._createParticles(30);

        const onsetAndHoldDuration = 1550 + 2000; // 1.55s onset + 2s hold

        setTimeout(() => {
            this.elements.body.classList.remove('system-surge-active');
            this.elements.body.classList.add('system-surge-fading');

            setTimeout(() => {
                this.elements.body.classList.remove('system-surge-fading');
                this.isSurgeActive = false;
            }, 3000); // Fade-out duration

        }, onsetAndHoldDuration);
    }

    /**
     * @JSDoc
     * @method _createParticles
     * @private
     * @description Creates and animates a specified number of particle elements for the System Surge effect.
     * @param {number} count - The number of particles to create.
     */
    _createParticles(count) {
        const totalDuration = 1550 + 2000 + 3000;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 5 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 1.5}s`;
            particle.style.animationDuration = `${Math.random() * 3 + 4}s`;
            this.elements.overlay.appendChild(particle);

            setTimeout(() => particle.remove(), totalDuration);
        }
    }
}