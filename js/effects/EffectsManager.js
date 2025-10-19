// js/effects/EffectsManager.js
/**
 * @fileoverview Manages the creation and lifecycle of visual effects like
 * floating text, screen flashes, etc.
 */
export class EffectsManager {
    /**
     * Initializes the EffectsManager with a reference to the main game container.
     * @param {HTMLElement} gameContainer - The main container element for the game.
     */
    constructor(gameContainer) {
        this.gameContainer = gameContainer;
    }

    /**
     * Creates floating text that appears at a specific location and fades out.
     * Supports two signatures:
     * 1. (text, x, y, color) for cursor-relative text.
     * 2. (text, color, position) for predefined screen positions.
     * @param {string} text - The text content to display.
     * @param {number|string} xOrColor - The x-coordinate, or a color string.
     * @param {number|string} yOrPosition - The y-coordinate, or a position string like 'center-screen'.
     * @param {string} [color] - The color of the text (e.g., '#ff0000' or 'green'). Only used if x/y are numbers.
     */
    floatingText(text, xOrColor, yOrPosition, color) {
        let x, y, pos, textColor;

        // Argument parsing to support both (text, x, y, color) and (text, color, position)
        if (typeof xOrColor === 'string' && typeof yOrPosition === 'string' && color === undefined) {
            // Overload: floatingText(text, color, position)
            textColor = xOrColor;
            pos = yOrPosition;
        } else if (typeof xOrColor === 'number' && typeof yOrPosition === 'number') {
            // Original: floatingText(text, x, y, color)
            x = xOrColor;
            y = yOrPosition;
            textColor = color;
        } else {
            console.error("Invalid arguments for floatingText", { text, xOrColor, yOrPosition, color });
            return;
        }

        const textElement = document.createElement('div');
        textElement.className = 'floating-text';
        textElement.textContent = text;
        if (textColor) {
            // Use CSS variables for predefined colors, otherwise use the direct value
            if (textColor === 'blue') {
                textElement.style.color = 'var(--color-info)';
            } else if (textColor === 'red') {
                textElement.style.color = 'var(--color-danger)';
            } else if (textColor === 'green') {
                 textElement.style.color = 'var(--color-success)';
            } else {
                textElement.style.color = textColor;
            }
        }

        // Handle positioning
        if (pos === 'center-screen') {
            textElement.classList.add('center-screen');
        } else if (x !== undefined && y !== undefined) {
            textElement.style.left = `${x}px`;
            textElement.style.top = `${y}px`;
        }

        this.gameContainer.appendChild(textElement);

        textElement.addEventListener('animationend', () => {
            if (textElement.parentElement) {
                textElement.parentElement.removeChild(textElement);
            }
        });
    }
}