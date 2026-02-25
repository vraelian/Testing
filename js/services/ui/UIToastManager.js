// js/services/ui/UIToastManager.js
export class UIToastManager {
    /**
     * @param {import('../UIManager.js').UIManager} uiManager
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.activeToast = null;
        this.container = null;
        
        this._injectDOM();
    }

    _injectDOM() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) return;

        if (!document.getElementById('toast-container')) {
            const containerHTML = `<div id="toast-container"></div>`;
            gameContainer.insertAdjacentHTML('beforeend', containerHTML);
        }
        this.container = document.getElementById('toast-container');
    }

    /**
     * Injects the toast into the DOM and triggers the slide animation
     * @param {Object} config { id, type, title, message, actionTarget }
     * @param {Function} onComplete Callback to fire when dismissal animation is completely finished
     */
    showToast(config, onComplete) {
        if (!this.container) return;

        // Force clear any immediate stragglers in the view controller
        this.forceClear();

        const toastEl = document.createElement('div');
        toastEl.className = `toast-message toast-${config.type}`;
        
        // Dataset attributes for Phase 4 routing hookups
        toastEl.dataset.action = 'route-toast';
        toastEl.dataset.target = config.actionTarget || '';
        toastEl.dataset.navTarget = config.navTarget || '';

        // Added the dynamic duration "fuse"
        toastEl.innerHTML = `
            <div class="toast-fuse" style="animation: toast-fuse-burn 4s linear forwards;"></div>
            <div class="toast-content-wrapper">
                <div class="toast-title">${config.title}</div>
                <div class="toast-body">${config.message}</div>
            </div>
            <button type="button" class="toast-dismiss-btn" data-action="dismiss-toast">-</button>
        `;

        this.container.appendChild(toastEl);
        this.activeToast = toastEl;

        // Force browser reflow to ensure transition plays
        void toastEl.offsetWidth;

        toastEl.classList.add('toast-slide-up');

        // Bind manual dismiss button locally to intercept click and prevent routing trigger
        const dismissBtn = toastEl.querySelector('.toast-dismiss-btn');
        dismissBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.hideToast(onComplete);
        });
    }

    /**
     * Triggers the 0.3s CSS slide dismissal animation
     * @param {Function} onComplete 
     */
    hideToast(onComplete) {
        if (!this.activeToast) {
            if (onComplete) onComplete();
            return;
        }

        const toastEl = this.activeToast;
        this.activeToast = null;

        toastEl.classList.remove('toast-slide-up');
        toastEl.classList.add('toast-slide-down');

        // Await CSS transition
        setTimeout(() => {
            if (toastEl.parentNode) {
                toastEl.parentNode.removeChild(toastEl);
            }
            if (onComplete) onComplete();
        }, 300);
    }

    /**
     * Hard interrupt method. Dismisses DOM element immediately without waiting for CSS transitions.
     */
    forceClear() {
        if (this.activeToast) {
            this.activeToast.remove();
            this.activeToast = null;
        }
        // Fail-safe cleanup
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}