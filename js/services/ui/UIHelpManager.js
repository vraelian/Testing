// js/services/ui/UIHelpManager.js
import { HELP_REGISTRY } from '../../data/helpRegistry.js';

/**
 * @class UIHelpManager
 * @description Domain Controller responsible for the Contextual Help Modal System.
 * Handles DOM injection, micro-pagination, and rendering of contextual tutorial slides.
 */
export class UIHelpManager {
    /**
     * @param {import('../UIManager.js').UIManager} uiManager 
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.currentContext = null;
        this.currentPageIndex = 0;
        this.pages = [];

        this._injectDOM();
        this._cacheDOM();
        this._bindEvents();
    }

    /**
     * Injects the Help System's structural DOM elements directly into the game-container.
     * Uses type="button" to satisfy defensive interaction protocols.
     * @private
     */
    _injectDOM() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) return;

        // Inject the persistent global anchor opposite the debug start button
        const anchorHTML = `<button type="button" id="global-help-anchor" class="global-help-anchor" data-action="toggle-help">?</button>`;
        gameContainer.insertAdjacentHTML('beforeend', anchorHTML);

        // Inject the fixed-aspect-ratio modal skeleton
        const modalHTML = `
            <div id="help-modal-overlay" class="help-modal-overlay hidden">
                <div class="help-modal-container">
                    <div class="help-modal-header">
                        <span class="help-modal-title">DATABANK</span>
                        <button type="button" id="help-modal-close-btn" class="help-modal-close-btn" data-action="close-help">-</button>
                    </div>
                    <div class="help-modal-viewport">
                        <div id="help-slide-track" class="help-slide-track"></div>
                    </div>
                    <div id="help-modal-footer" class="help-modal-footer"></div>
                </div>
            </div>
        `;
        gameContainer.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Caches references to the newly injected DOM elements.
     * @private
     */
    _cacheDOM() {
        this.anchorBtn = document.getElementById('global-help-anchor');
        this.overlay = document.getElementById('help-modal-overlay');
        this.closeBtn = document.getElementById('help-modal-close-btn');
        this.slideTrack = document.getElementById('help-slide-track');
        this.footer = document.getElementById('help-modal-footer');
    }

    /**
     * Binds swipe gesture logic and local UI interactions.
     * @private
     */
    _bindEvents() {
        // Backdrop dismissal 
        if (this.overlay) {
            this.overlay.addEventListener('pointerdown', (e) => {
                if (e.target === this.overlay) {
                    this.hideModal();
                }
            });
        }

        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        if (this.slideTrack) {
            // Touch events for mobile (raw touch events bypass browser pan-x cancellation)
            this.slideTrack.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return; // Ignore multi-touch
                isDragging = true;
                startX = e.touches[0].clientX;
                currentX = e.touches[0].clientX;
                this.slideTrack.style.transition = 'none'; // Remove snap transition during drag
            }, { passive: true });

            this.slideTrack.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                currentX = e.touches[0].clientX;
                const deltaX = currentX - startX;
                
                // Allow vertical bleed to pass through, but handle horizontal visual drag
                const containerWidth = this.slideTrack.clientWidth || 1;
                const deltaPercent = (deltaX / containerWidth) * 100;
                const baseTranslate = -(this.currentPageIndex * 100);
                
                this.slideTrack.style.transform = `translateX(calc(${baseTranslate}% + ${deltaPercent}%))`;
            }, { passive: true });

            const endTouch = () => {
                if (!isDragging) return;
                isDragging = false;
                this.slideTrack.style.transition = 'transform 0.3s ease-in-out';
                
                const deltaX = currentX - startX;
                const threshold = 40; // Pixels required to commit to a slide change
                
                if (deltaX < -threshold && this.currentPageIndex < this.pages.length - 1) {
                    this.nextPage();
                } else if (deltaX > threshold && this.currentPageIndex > 0) {
                    this.prevPage();
                } else {
                    this._applyTransform(); // Snap back if threshold not met
                }
            };

            this.slideTrack.addEventListener('touchend', endTouch);
            this.slideTrack.addEventListener('touchcancel', endTouch);

            // Mouse events for desktop simulation
            this.slideTrack.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.clientX;
                currentX = e.clientX;
                this.slideTrack.style.transition = 'none';
            });
            
            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                currentX = e.clientX;
                const deltaX = currentX - startX;
                const containerWidth = this.slideTrack.clientWidth || 1;
                const deltaPercent = (deltaX / containerWidth) * 100;
                const baseTranslate = -(this.currentPageIndex * 100);
                this.slideTrack.style.transform = `translateX(calc(${baseTranslate}% + ${deltaPercent}%))`;
            });
            
            window.addEventListener('mouseup', endTouch);
        }
    }

    /**
     * Renders and displays the Help Modal specifically for a given context.
     * @param {string} contextId - The registry key mapping to the contextual slides.
     * @param {number} [startingPageIndex=0] - Which slide to auto-paginate to upon opening.
     */
    showModal(contextId, startingPageIndex = 0) {
        if (!HELP_REGISTRY[contextId]) return;

        this.currentContext = contextId;
        this.pages = HELP_REGISTRY[contextId];
        this.currentPageIndex = Math.min(startingPageIndex, this.pages.length - 1);

        this._renderSlides();
        this._updatePagination();
        this._applyTransform();

        this.overlay.classList.remove('hidden');
        this.isVisible = true;
        
        // Ensure anchor toggle icon disappears while modal is active
        if (this.anchorBtn) this.anchorBtn.style.display = 'none';
    }

    /**
     * Hides the Help Modal and restores the global anchor.
     */
    hideModal() {
        if (this.overlay) this.overlay.classList.add('hidden');
        this.isVisible = false;
        if (this.anchorBtn) this.anchorBtn.style.display = 'flex';
    }

    /**
     * Populates the slide track container with the HTML payload.
     * @private
     */
    _renderSlides() {
        if (this.slideTrack) {
            this.slideTrack.innerHTML = this.pages.join('');
        }
    }

    /**
     * Rebuilds the pagination indicator dots based on page count.
     * @private
     */
    _updatePagination() {
        if (!this.footer) return;
        if (this.pages.length <= 1) {
            this.footer.innerHTML = '';
            return;
        }
        
        const dots = this.pages.map((_, index) => {
            return `<div class="help-dot ${index === this.currentPageIndex ? 'active' : ''}"></div>`;
        }).join('');
        
        this.footer.innerHTML = dots;
    }

    /**
     * Translates the slide track via CSS to show the active slide index.
     * @private
     */
    _applyTransform() {
        if (this.slideTrack) {
            const translateX = -(this.currentPageIndex * 100);
            this.slideTrack.style.transform = `translateX(${translateX}%)`;
        }
    }

    /**
     * Advances to the next slide if one exists.
     */
    nextPage() {
        if (this.currentPageIndex < this.pages.length - 1) {
            this.currentPageIndex++;
            this._applyTransform();
            this._updatePagination();
        }
    }

    /**
     * Retreats to the previous slide if one exists.
     */
    prevPage() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this._applyTransform();
            this._updatePagination();
        }
    }
}