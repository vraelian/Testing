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
     */
    queueModal(modalId, title, description, callback = null, options = {}) {
        this.modalQueue.push({ modalId, title, description, callback, options });
        // Only trigger processing if NO modal backdrop is currently active/visible.
        if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
            this.processModalQueue();
        }
    }

    /**
     * Dequeues and displays the next modal.
     */
    processModalQueue() {
        if (this.modalQueue.length === 0) return;
        
        // Peek at the active modal state to ensure we don't clobber an animating modal
        if (document.querySelector('.modal-backdrop:not(.hidden)')) {
            return; 
        }

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
        let titleElId = modalId === 'mission-modal' ? 'mission-modal-title' : modalId.replace('-modal', '-title');
        let titleEl = modal.querySelector(`#${titleElId}`);

        if (!titleEl && (modalId.includes('event') || modalId === 'event-result-modal')) {
            titleEl = modal.querySelector('#event-title') || modal.querySelector('#title');
        }

        if (!titleEl) {
            titleEl = modal.querySelector('.modal-title') || modal.querySelector('h3');
        }

        // --- PORTRAIT INJECTION & CLEANUP ---
        
        const existingOldWrapper = modal.querySelector('.portrait-wrapper');
        if (existingOldWrapper) existingOldWrapper.remove();
        
        const existingCommWrapper = modal.querySelector('.comm-link-wrapper');
        if (existingCommWrapper) existingCommWrapper.remove();
        
        const existingPortrait = modal.querySelector('.portrait-thumbnail');
        if (existingPortrait) existingPortrait.remove();

        let headerFlex = modal.querySelector('.modal-header-flex');
        if (headerFlex) {
            headerFlex.classList.remove('modal-header-flex', 'flex', 'flex-row', 'justify-between', 'items-start', 'w-full', 'mb-2', 'gap-4');
        }

        if (titleEl) {
            titleEl.classList.remove('modal-title-group');
            titleEl.style.textAlign = '';
            titleEl.style.flexGrow = '';
            titleEl.style.marginBottom = '';
            titleEl.innerHTML = title;
        }

        if (options.portraitId && typeof window.getPortraitStyle === 'function' && titleEl) {
            const pStyle = window.getPortraitStyle(options.portraitId);
            if (pStyle) {
                const parsedName = options.portraitId.replace(/_\d+$/, '').replace(/_/g, ' ');

                if (modalId === 'mission-modal') {
                    // --- Comm-Link Layout (Missions Only) ---
                    titleEl.style.textAlign = 'center';
                    
                    const wrapperDiv = document.createElement('div');
                    wrapperDiv.className = 'comm-link-wrapper';
                    
                    const pDiv = document.createElement('div');
                    pDiv.className = 'portrait-thumbnail comm-active';
                    pDiv.style.cssText = pStyle;
                    
                    const nameLabel = document.createElement('div');
                    nameLabel.className = 'portrait-name-label comm-label';
                    nameLabel.textContent = parsedName;
                    
                    wrapperDiv.appendChild(pDiv);
                    wrapperDiv.appendChild(nameLabel);
                    
                    const modalContent = modal.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.insertBefore(wrapperDiv, modalContent.firstChild);
                    }
                } else {
                    // --- Standard Side-by-Side Layout (Events, Lore, etc.) ---
                    if (!headerFlex) {
                        headerFlex = document.createElement('div');
                        titleEl.parentNode.insertBefore(headerFlex, titleEl);
                        headerFlex.appendChild(titleEl);
                    }
                    headerFlex.className = 'modal-header-flex flex flex-row justify-between items-start w-full mb-2 gap-4';
                    
                    const wrapperDiv = document.createElement('div');
                    wrapperDiv.className = 'portrait-wrapper';
                    
                    const pDiv = document.createElement('div');
                    pDiv.className = 'portrait-thumbnail';
                    pDiv.style.cssText = pStyle;
                    
                    const nameLabel = document.createElement('div');
                    nameLabel.className = 'portrait-name-label';
                    nameLabel.textContent = parsedName;
                    
                    wrapperDiv.appendChild(pDiv);
                    wrapperDiv.appendChild(nameLabel);
                    headerFlex.insertBefore(wrapperDiv, titleEl);
                    
                    titleEl.classList.add('modal-title-group');
                    titleEl.style.textAlign = 'right';
                    titleEl.style.flexGrow = '1';
                    titleEl.style.marginBottom = '0';
                }
            }
        }

        // --- DESCRIPTION ELEMENT RESOLUTION ---
        const descElId = modalId === 'mission-modal' ? 'mission-modal-description' : modalId.replace('-modal', '-description');
        const descEl = modal.querySelector(`#${descElId}`) || modal.querySelector(`#${modalId.replace('-modal', '-scenario')}`);

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

        // Ensure we start from a clean state.
        modal.classList.remove('hidden');
        modal.classList.remove('modal-hiding'); 
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
                if (!modal.classList.contains('modal-hiding')) {
                    return;
                }

                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible', 'dismiss-disabled', 'intro-fade-in');
                
                delete modal.dataset.theme;
                delete modal.dataset.dismissInside;
                delete modal.dataset.dismissOutside;

                if (this.modalQueue.length > 0) {
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
            if (modalBackdrop.id === 'lore-modal' && e.target.closest('#lore-modal-content')) return modalBackdrop.id;
            if (modalBackdrop.id === 'eula-modal' && e.target.closest('#eula-modal-content')) return modalBackdrop.id;
            if (modalBackdrop.id !== 'lore-modal' &&  modalBackdrop.id !== 'eula-modal' && !e.target.closest('.modal-content')) return modalBackdrop.id;
            if (modalBackdrop.id === 'lore-modal' && !e.target.closest('.modal-content')) return modalBackdrop.id;
            if (modalBackdrop.id === 'eula-modal' && !e.target.closest('.modal-content')) return modalBackdrop.id;
            
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
     * Displays the full-screen processing animation.
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