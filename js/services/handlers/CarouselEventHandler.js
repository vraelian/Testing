// js/services/handlers/CarouselEventHandler.js
/**
 * @fileoverview Manages all pointer, touch, and wheel events for the
 * hangar/shipyard carousel, providing a smooth drag-and-swipe interface.
 */
export class CarouselEventHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     */
    constructor(gameState, simulationService) {
        this.gameState = gameState;
        this.simulationService = simulationService;

        this.isScrolling = false;
        this.scrollTimeout = null;
        this.rafId = null; // Track the animation frame request

        this.state = {
            isDragging: false,
            startX: 0,
            startTranslate: 0,
            currentTranslate: 0,
            activeCarousel: null,
            containerWidth: 0,
            pageCount: 0,
            currentIndex: 0,
            moved: false
        };
    }

    /**
     * Handles wheel events (mouse scroll) over the carousel to navigate between pages.
     * @param {WheelEvent} e The wheel event.
     */
    handleWheel(e) {
        if (this.isScrolling) return;

        let direction = e.deltaY > 0 ? 'next' : 'prev';
        this.simulationService.cycleHangarCarousel(direction);

        this.isScrolling = true;
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 300); // Throttle scroll events
    }

    /**
     * Initiates a drag sequence on the carousel.
     * @param {MouseEvent|TouchEvent} e The mousedown or touchstart event.
     */
    handleDragStart(e) {
        const carouselContainer = e.target.closest('.carousel-container');
        const carousel = carouselContainer ? carouselContainer.querySelector('#hangar-carousel') : null;

        if (e.target.closest('.action-button') || !carousel || carousel.children.length <= 1) {
            this.state.isDragging = false;
            return;
        }
        e.preventDefault();

        const gameState = this.gameState.getState();
        const isHangarMode = gameState.uiState.hangarShipyardToggleState === 'hangar';

        this.state.isDragging = true;
        this.state.activeCarousel = carousel;
        this.state.startX = e.pageX ?? e.touches[0].pageX;
        this.state.containerWidth = carousel.parentElement.offsetWidth;
        this.state.pageCount = carousel.children.length;
        this.state.currentIndex = isHangarMode ? (gameState.uiState.hangarActiveIndex || 0) : (gameState.uiState.shipyardActiveIndex || 0);
        this.state.startTranslate = -this.state.currentIndex * this.state.containerWidth;
        this.state.currentTranslate = this.state.startTranslate;
        this.state.moved = false;

        carousel.style.transitionDuration = '0s'; // Make drag instant
        document.body.style.cursor = 'grabbing';
    }

    /**
     * Handles the movement during a carousel drag.
     * @param {MouseEvent|TouchEvent} e The mousemove or touchmove event.
     */
    handleDragMove(e) {
        if (!this.state.isDragging) return;
        e.preventDefault();

        const currentX = e.pageX ?? e.touches[0].pageX;
        const diff = currentX - this.state.startX;
        this.state.currentTranslate = this.state.startTranslate + diff;

        if (Math.abs(diff) > 10) this.state.moved = true;

        if (this.state.activeCarousel) {
            // VIRTUAL WORKBENCH: PERFORMANCE FIX
            // Use requestAnimationFrame to decouple input from rendering.
            // This prevents layout thrashing on high-refresh rate displays.
            if (this.rafId) cancelAnimationFrame(this.rafId);
            
            this.rafId = requestAnimationFrame(() => {
                if (this.state.activeCarousel) {
                    this.state.activeCarousel.style.transform = `translateX(${this.state.currentTranslate}px)`;
                }
            });
        }
    }

    /**
     * Ends the drag sequence and snaps the carousel to the nearest or intended page.
     */
    handleDragEnd() {
        if (!this.state.isDragging) return;
        
        // Cancel any pending frame to prevent overwrite after end
        if (this.rafId) cancelAnimationFrame(this.rafId);

        const { activeCarousel, startTranslate, currentTranslate, currentIndex, containerWidth, pageCount } = this.state;

        this.state.isDragging = false;
        document.body.style.cursor = 'default';

        if (!activeCarousel) return;

        activeCarousel.style.transitionDuration = ''; // Revert to CSS-defined duration for smooth snap

        const movedBy = currentTranslate - startTranslate;
        let newIndex = currentIndex;
        const threshold = containerWidth / 4;

        if (movedBy < -threshold && currentIndex < pageCount - 1) {
            newIndex++;
        } else if (movedBy > threshold && currentIndex > 0) {
            newIndex--;
        }

        const mode = this.gameState.uiState.hangarShipyardToggleState;
        this.simulationService.setHangarCarouselIndex(newIndex, mode);

        // A timeout is used to reset the 'moved' flag, preventing a click event from firing immediately after a drag.
        setTimeout(() => {
            this.state.moved = false;
        }, 50);
    }
    
    /**
     * Returns whether the carousel was moved during the last drag operation.
     * Used by EventManager to suppress clicks after a drag.
     * @returns {boolean}
     */
    wasMoved() {
        return this.state.moved;
    }
}