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

/**
 * (NEW) Applies a CSS class, awaits the animation's completion,
 * and then removes the class. This is a BLOCKING "fire-and-forget"
 * that is perfect for sequential effects.
 *
 * @param {HTMLElement | null} element - The DOM element to animate.
 * @param {string} animationClass - The CSS class that triggers the animation.
 * @returns {Promise<void>} A promise that resolves when the animation is complete
 * and the class has been removed.
 * @JSDoc
 */
export async function playBlockingAnimationAndRemove(element, animationClass) {
    return new Promise((resolve) => {
        // Failsafe: If no element is provided, resolve immediately.
        if (!element) {
            console.warn('playBlockingAnimationAndRemove: No element provided.');
            resolve();
             return;
        }

        const onAnimationEnd = () => {
            element.removeEventListener('animationend', onAnimationEnd);
            element.classList.remove(animationClass); // Automatically remove class
             resolve();
        };

        element.addEventListener('animationend', onAnimationEnd, { once: true });
        element.classList.add(animationClass);
    });
}

/**
 * Spawns a temporary floating text element anchored to a target DOM node.
 * Automatically handles its own animation and DOM removal.
 *
 * @param {HTMLElement} targetElement - The element to anchor the text to.
 * @param {string} text - The string to display.
 * @param {string} colorClass - Tailwind classes for styling (e.g., 'text-red-500 font-bold').
 */
export function spawnFloatingText(targetElement, text, colorClass = 'text-white font-bold') {
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const floatEl = document.createElement('div');
    
    floatEl.textContent = text;
    floatEl.className = `fixed pointer-events-none z-50 ${colorClass}`;
    floatEl.style.left = `${rect.left + (rect.width / 2)}px`;
    floatEl.style.top = `${rect.top}px`;
    floatEl.style.transform = 'translate(-50%, -50%)';
    // [[UPDATED]] Duration increased from 1s to 1.5s per user request
    floatEl.style.transition = 'all 1.5s ease-out';
    floatEl.style.opacity = '1';
    
    document.body.appendChild(floatEl);
    
    // Force a reflow to ensure the initial state is painted before animating
    void floatEl.offsetWidth;
    
    // Animate up and fade out
    floatEl.style.top = `${rect.top - 60}px`; // Increased float distance slightly
    floatEl.style.opacity = '0';
    
    // Cleanup after animation completes (1500ms)
    setTimeout(() => {
        if (floatEl.parentNode) {
            floatEl.parentNode.removeChild(floatEl);
        }
    }, 1500);
}

/**
 * Executes a full-screen blackout animation for multi-year transitions.
 * @param {function} callback - Logic to execute while the screen is completely black.
 * @returns {Promise<void>}
 */
export async function playBankruptcyBlackout(callback) {
    // 1. Construct Overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black pointer-events-auto opacity-0';
    
    const text = document.createElement('h2');
    text.className = 'text-3xl md:text-5xl font-orbitron text-gray-400 tracking-widest opacity-0';
    text.textContent = 'Years later...';
    
    overlay.appendChild(text);
    document.body.appendChild(overlay);

    // 2. Fade to Black (2s)
    const fadeIn = overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards', easing: 'ease-in-out' });
    await fadeIn.finished;

    // 3. Fade Text In (1s)
    const textIn = text.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, fill: 'forwards', easing: 'ease-out' });
    await textIn.finished;

    // 4. Execute Background Logic Callback
    if (callback) {
        await callback();
    }

    // 5. Hold Blackout with Text (2s)
    await new Promise(r => setTimeout(r, 2000));

    // 6. Fade everything out (2s)
    const fadeOut = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards', easing: 'ease-in-out' });
    await fadeOut.finished;

    // 7. Cleanup
    overlay.remove();
}
// --- [[END]] VIRTUAL WORKBENCH ---