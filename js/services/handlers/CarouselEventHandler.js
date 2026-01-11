// js/services/handlers/CarouselEventHandler.js
/**
 * @fileoverview Manages all pointer, touch, and wheel events for the
 * hangar/shipyard carousel, providing a smooth drag-and-swipe interface.
 */

import { AssetService } from '../AssetService.js';

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
        this.rafId = null; 

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
        
        // Predictive Preload
        const currentState = this.gameState.getState();
        const currentMode = currentState.uiState.hangarShipyardToggleState;
        const currentIdx = currentMode === 'hangar' 
            ? (currentState.uiState.hangarActiveIndex || 0) 
            : (currentState.uiState.shipyardActiveIndex || 0);
        
        const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        this._preloadForTarget(targetIdx, currentMode);

        this.simulationService.cycleHangarCarousel(direction);

        this.isScrolling = true;
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 300); 
    }

    /**
     * Initiates a drag sequence on the carousel.
     * @param {MouseEvent|TouchEvent} e The mousedown or touchstart event.
     */
    handleDragStart(e) {
        const carouselContainer = e.target.closest('.carousel-container');
        const carousel = carouselContainer ? carouselContainer.querySelector('#hangar-carousel') : null;

        // --- VIRTUAL WORKBENCH: BUG FIX ---
        // If the target is an actionable element (button, pill, etc.), do NOT start dragging.
        // This ensures the click event is allowed to fire for tooltip/action handling.
        if (e.target.closest('[data-action]') || !carousel || carousel.children.length <= 1) {
            this.state.isDragging = false;
            return;
        }
        // --- END VIRTUAL WORKBENCH ---

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

        carousel.style.transitionDuration = '0s'; 
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
        
        if (this.rafId) cancelAnimationFrame(this.rafId);

        const { activeCarousel, startTranslate, currentTranslate, currentIndex, containerWidth, pageCount } = this.state;

        this.state.isDragging = false;
        document.body.style.cursor = 'default';

        if (!activeCarousel) return;

        activeCarousel.style.transitionDuration = ''; 

        const movedBy = currentTranslate - startTranslate;
        let newIndex = currentIndex;
        const threshold = containerWidth / 4;

        if (movedBy < -threshold && currentIndex < pageCount - 1) {
            newIndex++;
        } else if (movedBy > threshold && currentIndex > 0) {
            newIndex--;
        }

        const mode = this.gameState.uiState.hangarShipyardToggleState;
        
        // Predictive Preload
        this._preloadForTarget(newIndex, mode);

        this.simulationService.setHangarCarouselIndex(newIndex, mode);

        setTimeout(() => {
            this.state.moved = false;
        }, 50);
    }

    /**
     * Helper to identify list and trigger asset preloading for a target index.
     * @private
     */
    _preloadForTarget(targetIndex, mode) {
        const state = this.gameState.getState();
        const player = state.player;
        
        let shipList = [];
        if (mode === 'hangar') {
            shipList = player.ownedShipIds;
        } else {
            if (this.simulationService._getShipyardInventory) {
                shipList = this.simulationService._getShipyardInventory().map(([id]) => id);
            }
        }

        AssetService.preloadBuffer(shipList, targetIndex, 5, player.visualSeed);
    }
    
    /**
     * Returns whether the carousel was moved during the last drag operation.
     */
    wasMoved() {
        return this.state.moved;
    }
}