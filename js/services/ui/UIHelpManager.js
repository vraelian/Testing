// js/services/ui/UIHelpManager.js
import { HELP_REGISTRY } from '../../data/helpRegistry.js';

export class UIHelpManager {
    /**
     * @param {import('../UIManager.js').UIManager} uiManager 
     */
    constructor(uiManager) {
        try {
            this.uiManager = uiManager;
            this.isVisible = false;
            this.currentContext = null;
            this.currentPageIndex = 0;
            this.pages = [];
            this.onCloseCallback = null;

            // Interaction state properties
            this.isDragging = false;
            this.startX = 0;
            this.currentX = 0;

            // Bound event handlers to prevent memory leaks and duplication
            this._handleWindowMouseMove = this._handleWindowMouseMove.bind(this);
            this._handleWindowMouseUp = this._handleWindowMouseUp.bind(this);
            this._endTouch = this._endTouch.bind(this);

            this._injectDOM();
            this._cacheDOM();
            this._bindEvents();
        } catch (error) {
            console.error("[UIHelpManager] Initialization failed:", error);
        }
    }

    _injectDOM() {
        // Break free of the game-container and inject directly to document.body 
        // to bypass local stacking contexts or opacity constraints.
        if (!document.getElementById('global-help-anchor')) {
            const anchorHTML = `<button type="button" id="global-help-anchor" class="global-help-anchor" data-action="toggle-help">?</button>`;
            document.body.insertAdjacentHTML('beforeend', anchorHTML);
        }

        if (!document.getElementById('help-modal-overlay')) {
            const modalHTML = `
                <div id="help-modal-overlay" class="help-modal-overlay hidden">
                    <div class="help-modal-container">
                        <div class="help-modal-header">
                            <span class="help-modal-title">TUTORIAL</span>
                            <button type="button" id="help-modal-close-btn" class="help-modal-close-btn" data-action="close-help">-</button>
                        </div>
                        <div class="help-modal-viewport">
                            <div id="help-slide-track" class="help-slide-track"></div>
                        </div>
                        <div id="help-modal-footer" class="help-modal-footer"></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    }

    _cacheDOM() {
        this.anchorBtn = document.getElementById('global-help-anchor');
        this.overlay = document.getElementById('help-modal-overlay');
        this.closeBtn = document.getElementById('help-modal-close-btn');
        this.slideTrack = document.getElementById('help-slide-track');
        this.footer = document.getElementById('help-modal-footer');
    }

    _bindEvents() {
        if (this.overlay) {
            this.overlay.addEventListener('pointerdown', (e) => {
                if (e.target === this.overlay) {
                    this.hideModal();
                }
            });
        }

        if (this.slideTrack) {
            this.slideTrack.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                this.isDragging = true;
                this.startX = e.touches[0].clientX;
                this.currentX = e.touches[0].clientX;
                this.slideTrack.style.transition = 'none';
            }, { passive: true });

            this.slideTrack.addEventListener('touchmove', (e) => {
                if (!this.isDragging) return;
                this.currentX = e.touches[0].clientX;
                const deltaX = this.currentX - this.startX;
                
                const containerWidth = this.slideTrack.clientWidth || 1;
                const deltaPercent = (deltaX / containerWidth) * 100;
                const baseTranslate = -(this.currentPageIndex * 100);
                
                this.slideTrack.style.transform = `translateX(calc(${baseTranslate}% + ${deltaPercent}%))`;
            }, { passive: true });

            this.slideTrack.addEventListener('touchend', this._endTouch);
            this.slideTrack.addEventListener('touchcancel', this._endTouch);

            this.slideTrack.addEventListener('mousedown', (e) => {
                this.isDragging = true;
                this.startX = e.clientX;
                this.currentX = e.clientX;
                this.slideTrack.style.transition = 'none';
            });
            
            // Clean up global window listeners to prevent multi-binding
            window.removeEventListener('mousemove', this._handleWindowMouseMove);
            window.removeEventListener('mouseup', this._handleWindowMouseUp);
            
            window.addEventListener('mousemove', this._handleWindowMouseMove);
            window.addEventListener('mouseup', this._handleWindowMouseUp);
        }
    }

    _endTouch() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        if (this.slideTrack) {
            this.slideTrack.style.transition = 'transform 0.3s ease-in-out';
        }
        
        const deltaX = this.currentX - this.startX;
        const threshold = 40; 
        
        if (deltaX < -threshold && this.currentPageIndex < this.pages.length - 1) {
            this.nextPage();
        } else if (deltaX > threshold && this.currentPageIndex > 0) {
            this.prevPage();
        } else {
            this._applyTransform();
        }
    }

    _handleWindowMouseMove(e) {
        if (!this.isDragging || !this.slideTrack) return;
        this.currentX = e.clientX;
        const deltaX = this.currentX - this.startX;
        const containerWidth = this.slideTrack.clientWidth || 1;
        const deltaPercent = (deltaX / containerWidth) * 100;
        const baseTranslate = -(this.currentPageIndex * 100);
        this.slideTrack.style.transform = `translateX(calc(${baseTranslate}% + ${deltaPercent}%))`;
    }

    _handleWindowMouseUp(e) {
        this._endTouch();
    }

    showModal(contextId, startingPageIndex = null, onCloseCallback = null) {
        if (!HELP_REGISTRY || !HELP_REGISTRY[contextId]) return;

        this.currentContext = contextId;
        this.pages = HELP_REGISTRY[contextId];
        
        const startIdx = startingPageIndex !== null && startingPageIndex !== undefined ? startingPageIndex : 0;
        this.currentPageIndex = Math.min(startIdx, this.pages.length - 1);
        
        this.onCloseCallback = onCloseCallback;

        this._renderSlides();
        this._updatePagination();
        this._applyTransform();

        if (this.anchorBtn) {
            // Strip the pulse class upon explicit viewing
            this.anchorBtn.classList.remove('help-anchor-pulse');
            this.anchorBtn.style.display = 'none';
        }

        if (this.overlay) {
            this.overlay.classList.remove('help-anim-out');
            this.overlay.classList.remove('hidden');
            this.overlay.classList.add('help-anim-in');
        }

        this.isVisible = true;
    }

    hideModal() {
        if (!this.isVisible) return; 

        // Push slide memory out to the persistent game state before hiding
        if (this.uiManager && typeof this.uiManager.saveHelpSlideIndex === 'function' && this.currentContext) {
            this.uiManager.saveHelpSlideIndex(this.currentContext, this.currentPageIndex);
        }
        
        this.isVisible = false;
        
        if (this.overlay) {
            this.overlay.classList.remove('help-anim-in');
            this.overlay.classList.add('help-anim-out');
            
            setTimeout(() => {
                if (!this.isVisible) {
                    this.overlay.classList.add('hidden');
                    this.overlay.classList.remove('help-anim-out');
                    if (this.anchorBtn) this.anchorBtn.style.display = 'flex';

                    if (typeof this.onCloseCallback === 'function') {
                        const callback = this.onCloseCallback;
                        this.onCloseCallback = null;
                        callback();
                    }
                }
            }, 400); 
        } else {
            if (this.anchorBtn) this.anchorBtn.style.display = 'flex';
            if (typeof this.onCloseCallback === 'function') {
                const callback = this.onCloseCallback;
                this.onCloseCallback = null;
                callback();
            }
        }
    }

    _renderSlides() {
        if (this.slideTrack) {
            this.slideTrack.innerHTML = this.pages.join('');
        }
    }

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

    _applyTransform() {
        if (this.slideTrack) {
            const translateX = -(this.currentPageIndex * 100);
            this.slideTrack.style.transform = `translateX(${translateX}%)`;
        }
    }

    nextPage() {
        if (this.currentPageIndex < this.pages.length - 1) {
            this.currentPageIndex++;
            this._applyTransform();
            this._updatePagination();
        }
    }

    prevPage() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this._applyTransform();
            this._updatePagination();
        }
    }
}