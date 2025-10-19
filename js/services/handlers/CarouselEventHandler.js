// js/services/handlers/CarouselEventHandler.js
/**
 * @fileoverview Provides a reusable class to handle swipe (touch) gestures on a carousel element.
 */
export class CarouselEventHandler {
    /**
     * @param {HTMLElement} carousel The carousel element to attach swipe listeners to.
     * @param {Function} onSwipe A callback function to execute on a successful swipe.
     * It receives the direction ('left' or 'right') as an argument.
     * @param {number} [threshold=50] The minimum horizontal distance (in pixels) to trigger a swipe.
     */
    constructor(carousel, onSwipe, threshold = 50) {
        if (!carousel || typeof onSwipe !== 'function') {
            console.error('CarouselEventHandler: Invalid carousel element or onSwipe callback.');
            return;
        }

        this.carousel = carousel;
        this.onSwipe = onSwipe;
        this.threshold = threshold;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.isSwiping = false;
        this.swipeStartTime = 0;
        this.SWIPE_TIME_LIMIT = 500; // Max time for a swipe (ms)

        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        this.attachListeners();
    }

    /**
     * Attaches touch event listeners to the carousel element.
     */
    attachListeners() {
        this.carousel.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.carousel.addEventListener('touchmove', this.onTouchMove, { passive: true });
        this.carousel.addEventListener('touchend', this.onTouchEnd, { passive: true });
        this.carousel.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    }

    /**
     * Removes touch event listeners from the carousel element.
     */
    destroy() {
        this.carousel.removeEventListener('touchstart', this.onTouchStart);
        this.carousel.removeEventListener('touchmove', this.onTouchMove);
        this.carousel.removeEventListener('touchend', this.onTouchEnd);
        this.carousel.removeEventListener('touchcancel', this.onTouchEnd);
    }

    /**
     * Handles the touchstart event.
     * @param {TouchEvent} e The TouchEvent object.
     */
    onTouchStart(e) {
        // Only track single-finger touches
        if (e.touches.length > 1) {
            this.isSwiping = false;
            return;
        }
        this.touchStartX = e.touches[0].clientX;
        this.touchEndX = this.touchStartX; // Reset endX on new touch
        this.isSwiping = true;
        this.swipeStartTime = Date.now();
    }

    /**
     * Handles the touchmove event.
     * @param {TouchEvent} e The TouchEvent object.
     */
    onTouchMove(e) {
        if (!this.isSwiping || e.touches.length > 1) {
            return;
        }
        this.touchEndX = e.touches[0].clientX;
    }

    /**
     * Handles the touchend event.
     * @param {TouchEvent} e The TouchEvent object.
     */
    onTouchEnd(e) {
        // Do not register swipe if multiple fingers were used at any point
        // or if the touch event ended with more than 0 fingers (e.g., pinch)
        if (!this.isSwiping || (e.touches.length > 0 && e.type !== 'touchcancel')) {
            this.isSwiping = false;
            return;
        }

        this.isSwiping = false;
        const swipeDist = this.touchEndX - this.touchStartX;
        const swipeTime = Date.now() - this.swipeStartTime;

        if (swipeTime > this.SWIPE_TIME_LIMIT) {
            return; // Swipe was too slow
        }

        // Check if the swipe distance meets the threshold
        if (Math.abs(swipeDist) >= this.threshold) {
            if (swipeDist < 0) {
                // Swiped left (next item)
                this.onSwipe('left');
            } else {
                // Swiped right (previous item)
                this.onSwipe('right');
            }
        }
    }
}