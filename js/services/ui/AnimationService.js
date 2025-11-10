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

// --- [[START]] VIRTUAL WORKBENCH ---
/**
 * Applies a CSS class to an element and automatically removes it
 * when the animation completes. This is a non-blocking "fire-and-forget"
 * animation, unlike playBlockingAnimation.
 *
 * @param {HTMLElement | null} element - The DOM element to animate.
 * @param {string} animationClass - The CSS class that triggers the animation.
 * @JSDoc
 */
export function playAndRemoveAnimation(element, animationClass) {
    // Failsafe: If no element is provided, do nothing.
    if (!element) {
        console.warn('playAndRemoveAnimation: No element provided.');
        return;
    }

    const onAnimationEnd = () => {
        element.removeEventListener('animationend', onAnimationEnd);
        element.classList.remove(animationClass);
    };

    element.addEventListener('animationend', onAnimationEnd, { once: true });
    element.classList.add(animationClass);
}
// --- [[END]] VIRTUAL WORKBENCH ---