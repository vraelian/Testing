// js/services/ui/AnimationService.js
/**
 * @fileoverview Provides generic, blocking animation utility functions.
 */

/**
 * Applies a CSS class to an element and returns a Promise
 * that resolves when the element's 'animationend' event fires.
 *
 * @param {HTMLElement | null} element - The DOM element to animate.
 * @param {string} animationClass - The CSS class that triggers the animation.
 * @returns {Promise<void>} A promise that resolves when the animation is complete.
 * @JSDoc
 */
export async function playBlockingAnimation(element, animationClass) {
    return new Promise((resolve) => {
        // Failsafe: If no element is provided, resolve immediately.
        if (!element) {
            console.warn('playBlockingAnimation: No element provided.');
            resolve();
            return;
        }

        const onAnimationEnd = () => {
            element.removeEventListener('animationend', onAnimationEnd);
            // The class remains on the element (due to 'forwards' in CSS).
            // The element will be naturally removed by the state change
            // and UI re-render that follows this promise resolving.
            resolve();
        };

        element.addEventListener('animationend', onAnimationEnd, { once: true });
        element.classList.add(animationClass);
    });
}