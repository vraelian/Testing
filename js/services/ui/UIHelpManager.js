// js/services/ui/UIHelpManager.js
import { HELP_REGISTRY } from '../../data/helpRegistry.js';

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

    _injectDOM() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) return;

        const anchorHTML = `<button type="button" id="global-help-anchor" class="global-help-anchor" data-action="toggle-help">?</button>`;
        gameContainer.insertAdjacentHTML('beforeend', anchorHTML);

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
        gameContainer.insertAdjacentHTML('beforeend', modalHTML);
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

        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        if (this.slideTrack) {
            this.slideTrack.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                isDragging = true;
                startX = e.touches[0].clientX;
                currentX = e.touches[0].clientX;
                this.slideTrack.style.transition = 'none';
            }, { passive: true });

            this.slideTrack.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                currentX = e.touches[0].clientX;
                const deltaX = currentX - startX;
                
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
                const threshold = 40; 
                
                if (deltaX < -threshold && this.currentPageIndex < this.pages.length - 1) {
                    this.nextPage();
                } else if (deltaX > threshold && this.currentPageIndex > 0) {
                    this.prevPage();
                } else {
                    this._applyTransform();
                }
            };

            this.slideTrack.addEventListener('touchend', endTouch);
            this.slideTrack.addEventListener('touchcancel', endTouch);

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

    showModal(contextId, startingPageIndex = 0) {
        if (!HELP_REGISTRY || !HELP_REGISTRY[contextId]) return;

        this.currentContext = contextId;
        this.pages = HELP_REGISTRY[contextId];
        this.currentPageIndex = Math.min(startingPageIndex, this.pages.length - 1);

        this._renderSlides();
        this._updatePagination();
        this._applyTransform();

        if (this.anchorBtn) this.anchorBtn.style.display = 'none';

        if (this.overlay) {
            this.overlay.classList.remove('help-anim-out');
            this.overlay.classList.remove('hidden');
            this.overlay.classList.add('help-anim-in');
        }

        this.isVisible = true;
    }

    hideModal() {
        if (!this.isVisible) return; 
        this.isVisible = false;
        
        if (this.overlay) {
            this.overlay.classList.remove('help-anim-in');
            this.overlay.classList.add('help-anim-out');
            
            setTimeout(() => {
                if (!this.isVisible) {
                    this.overlay.classList.add('hidden');
                    this.overlay.classList.remove('help-anim-out');
                    if (this.anchorBtn) this.anchorBtn.style.display = 'flex';
                }
            }, 400); 
        } else {
            if (this.anchorBtn) this.anchorBtn.style.display = 'flex';
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