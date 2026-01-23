// js/services/ui/UIModalEngine.js
import { SCREEN_IDS, NAV_IDS, ACTION_IDS } from '../../data/constants.js';

export class UIModalEngine {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
        this.modalQueue = [];
    }

    /**
     * Queues a modal for display. If no modal is currently visible, processes the queue immediately.
     * @param {string} modalId - The DOM ID of the modal (e.g., 'event-modal').
     * @param {string} title - The title to display.
     * @param {string} description - The body text/HTML.
     * @param {Function} [callback] - Function to run on close.
     * @param {object} [options] - Configuration options (theme, dismissal, etc.).
     */
    queueModal(modalId, title, description, callback = null, options = {}) {
        this.modalQueue.push({ modalId, title, description, callback, options });
        if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
            this.processModalQueue();
        }
    }

    /**
     * Dequeues and displays the next modal.
     */
    processModalQueue() {
        if (this.modalQueue.length === 0) return;
        const { modalId, title, description, callback, options } = this.modalQueue.shift();
        const modal = document.getElementById(modalId);
        
        if (!modal) {
            this.manager.logger.error('UIModalEngine', `Modal element with ID '${modalId}' not found in the DOM. Aborting modal display.`);
            return this.processModalQueue();
        }

        if (options.specialClass) {
            modal.classList.add(options.specialClass);
        }
        if (options.nonDismissible) {
            modal.classList.add('dismiss-disabled');
        }
        
        if (options.theme) {
            modal.dataset.theme = options.theme;
        } else {
            delete modal.dataset.theme;
        }

        modal.dataset.dismissInside = options.dismissInside || 'false';
        modal.dataset.dismissOutside = options.dismissOutside || 'false';

        // --- TITLE ELEMENT RESOLUTION ---
        // 1. Strict Check: Expects convention [modalId]-title (e.g., 'event-result-title')
        let titleElId = modalId === 'mission-modal' ? 'mission-modal-title' : modalId.replace('-modal', '-title');
        let titleEl = modal.querySelector(`#${titleElId}`);

        // 2. Fallback: If strict ID not found, check for generic 'event-title' if it's an event modal
        if (!titleEl && (modalId.includes('event') || modalId === 'event-result-modal')) {
            titleEl = modal.querySelector('#event-title') || modal.querySelector('#title');
        }

        // 3. Fallback: Try to find a generic class or tag
        if (!titleEl) {
            titleEl = modal.querySelector('.modal-title') || modal.querySelector('h3');
        }

        // --- DESCRIPTION ELEMENT RESOLUTION ---
        const descElId = modalId === 'mission-modal' ? 'mission-modal-description' : modalId.replace('-modal', '-description');
        const descEl = modal.querySelector(`#${descElId}`) || modal.querySelector(`#${modalId.replace('-modal', '-scenario')}`);

        if (titleEl) titleEl.innerHTML = title;
        if (descEl) {
            descEl.innerHTML = description;
            descEl.className = 'my-4 text-gray-300'; 

            if (modalId !== 'mission-modal') {
                descEl.classList.add('mb-6', 'text-lg');
            }

            if (modalId === 'event-modal' || modalId === 'random-event-modal' || modalId === 'event-result-modal') {
                descEl.classList.add('text-center');
            }

            if (options.contentClass) {
                if (options.contentClass.includes('text-left') || options.contentClass.includes('text-right') || options.contentClass.includes('text-justify')) {
                    descEl.classList.remove('text-center');
                }
                descEl.classList.add(...options.contentClass.split(' ').filter(Boolean));
            }
        }

        const closeHandler = () => {
            this.hideModal(modalId);
            if (callback) callback();
            this.processModalQueue();
        };

        if (options.customSetup) {
            options.customSetup(modal, closeHandler);
        } else {
            const btnContainer = modal.querySelector('#' + modalId.replace('-modal', '-button-container'));
            let button;
            
            if (options.footer) {
                if (btnContainer) {
                    btnContainer.innerHTML = options.footer;
                    btnContainer.querySelectorAll('button[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            if (btn.dataset.action === 'buy_intel') {
                                return; 
                            }
                            closeHandler();
                        });
                    });
                }
            } else if (options.footer === null) {
                if (btnContainer) btnContainer.innerHTML = '';
            } else {
                if (btnContainer) {
                    btnContainer.innerHTML = '';
                    button = document.createElement('button');
                    btnContainer.appendChild(button);
                } else {
                    button = modal.querySelector('button');
                }
                if (button) {
                    button.className = 'btn px-6 py-2';
                    if (options.buttonClass) button.classList.add(options.buttonClass);
                    button.innerHTML = options.buttonText || 'Understood';
                    button.onclick = closeHandler;
                }
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    /**
     * Hides a specific modal with an exit animation.
     * @param {string} modalId 
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('modal-hiding');
            modal.addEventListener('animationend', () => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible', 'dismiss-disabled', 'intro-fade-in');
                
                delete modal.dataset.theme;
                delete modal.dataset.dismissInside;
                delete modal.dataset.dismissOutside;

                if (this.modalQueue.length > 0 && !document.querySelector('.modal-backdrop:not(.hidden)')) {
                    this.processModalQueue();
                }
            }, { once: true });
        }
    }

    /**
     * Determines the ID of the modal being clicked, respecting dismissal rules.
     * @param {Event} e 
     * @returns {string|null}
     */
    getModalIdFromEvent(e) {
        const modalBackdrop = e.target.closest('.modal-backdrop');
        if (!modalBackdrop || !modalBackdrop.id || modalBackdrop.classList.contains('dismiss-disabled')) {
            return null;
        }

        const dismissInside = modalBackdrop.dataset.dismissInside === 'true';
        const dismissOutside = modalBackdrop.dataset.dismissOutside === 'true';
        const isBackdropClick = !e.target.closest('.modal-content');
        const isContentClick = e.target.closest('.modal-content');

        if ((dismissOutside && isBackdropClick) || (dismissInside && isContentClick)) {
            if (modalBackdrop.id === 'lore-modal' && e.target.closest('#lore-modal-content')) {
                return modalBackdrop.id;
            }
            if (modalBackdrop.id === 'eula-modal' && e.target.closest('#eula-modal-content')) {
                return modalBackdrop.id;
            }

            if (modalBackdrop.id !== 'lore-modal' &&  modalBackdrop.id !== 'eula-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }
            if (modalBackdrop.id === 'lore-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }
            if (modalBackdrop.id === 'eula-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }
            
            return modalBackdrop.id;
        }
     
        return null;
    }

    /**
     * Helper to check if a click is inside a selector.
     * @param {Event} e 
     * @param {string} selector 
     * @returns {boolean}
     */
    isClickInside(e, selector) {
        return e.target.closest(selector) !== null;
    }

    /**
     * Displays the full-screen processing animation (e.g., for License acquisition).
     * @param {string} playerName 
     * @param {Function} callback 
     */
    showProcessingAnimation(playerName, callback) {
        const modal = this.manager.cache.processingModal;
        if (!modal) return;

        const titleEl = modal.querySelector('#processing-title');
        const progressBar = modal.querySelector('#processing-progress-bar');
        const statusText = modal.querySelector('#processing-status');

        titleEl.textContent = `Processing application for ${playerName}...`;
        progressBar.style.width = '0%';
        statusText.textContent = '';
        modal.classList.remove('hidden');

        setTimeout(() => {
            progressBar.style.width = '100%';
        }, 100);

        setTimeout(() => {
            statusText.textContent = 'Processing complete!';
            setTimeout(() => {
                this.hideModal('processing-modal');
                if (callback) callback();
            }, 1000);
        }, 4000);
    }
}