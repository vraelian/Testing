// js/services/ui/ModalService.js
/**
 * @fileoverview
 * This service manages the global modal queue and presentation logic.
 * It is a "dumb" presenter, meaning it only handles the showing, hiding,
 * and queuing of modals. It does not contain the logic for generating
 * the content of specific modals (like ship details or cargo details).
 * Extracted from UIManager.js as part of the Phase 4 refactor.
 */

export class ModalService {
    /**
     * @param {import('../LoggingService.js').Logger} logger
     */
    constructor(logger) {
        this.logger = logger;
        /** @type {Array<object>} */
        this.modalQueue = [];
    }

    /**
     * Adds a modal to the queue for display.
     * If no modal is active, it processes this one immediately.
     * @param {string} modalId - The HTML ID of the modal backdrop.
     * @param {string | null} title - The title text (or null).
     * @param {string | null} description - The description text/HTML (or null).
     * @param {function | null} [callback=null] - A callback to run on modal close.
     * @param {object} [options={}] - An options object for configuration.
     * @param {string} [options.specialClass] - A class to add to the modal.
     * @param {boolean} [options.nonDismissible] - Prevents dismissal.
     * @param {string} [options.theme] - A theme (e.g., locationId) for styling.
     * @param {string} [options.dismissInside] - GDD: Allow dismiss on content click.
     * @param {string} [options.dismissOutside] - GDD: Allow dismiss on backdrop click.
     * @param {function} [options.customSetup] - A function to run to set up modal content.
     * @param {string | null} [options.footer] - Custom HTML for the footer. `null` means no footer.
     * @param {string} [options.buttonText] - Text for the default button.
     * @param {string} [options.buttonClass] - Classes for the default button.
     * @param {string} [options.contentClass] - Classes for the content/description element.
     */
    queueModal(modalId, title, description, callback = null, options = {}) {
        this.modalQueue.push({ modalId, title, description, callback, options });
        if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
            this.processModalQueue();
        }
    }

    /**
     * Processes the next modal in the queue.
     * This is the core modal presentation logic.
     * @private
     */
    processModalQueue() {
        if (this.modalQueue.length === 0) return;

        const { modalId, title, description, callback, options } = this.modalQueue.shift();
        const modal = document.getElementById(modalId);
        if (!modal) {
            this.logger.error('ModalService', `Modal element with ID '${modalId}' not found. Aborting.`);
            return this.processModalQueue(); // Process next
        }

        // Apply options
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

        // Find title/description elements
        const titleElId = modalId === 'mission-modal' ? 'mission-modal-title' : modalId.replace('-modal', '-title');
        const descElId = modalId === 'mission-modal' ? 'mission-modal-description' : modalId.replace('-modal', '-description');
        const titleEl = modal.querySelector(`#${titleElId}`);
        const descEl = modal.querySelector(`#${descElId}`) || modal.querySelector(`#${modalId.replace('-modal', '-scenario')}`);

        if (titleEl && title !== null) titleEl.innerHTML = title;
        if (descEl && description !== null) {
            descEl.innerHTML = description;
            // Reset and apply classes
            descEl.className = 'my-4 text-gray-300';
            if (modalId !== 'mission-modal') {
                descEl.classList.add('mb-6', 'text-lg');
            }
            if (modalId === 'event-modal' || modalId === 'random-event-modal') {
                descEl.classList.add('text-center');
            }
            if (options.contentClass) {
                if (options.contentClass.includes('text-left') || options.contentClass.includes('text-right') || options.contentClass.includes('text-justify')) {
                    descEl.classList.remove('text-center');
                }
                descEl.classList.add(...options.contentClass.split(' ').filter(Boolean));
            }
        }

        // --- Close Handler ---
        const closeHandler = () => {
            this.hideModal(modalId);
            if (callback) callback();
            this.processModalQueue();
        };

        // --- Setup Content / Buttons ---
        if (options.customSetup) {
            // Run custom setup logic (e.g., for mission or ship modals)
            options.customSetup(modal, closeHandler);
        } else {
            // Standard setup (for simple event modals)
            const btnContainer = modal.querySelector('#' + modalId.replace('-modal', '-button-container'));
            let button;

            if (options.footer) {
                // Custom footer HTML provided
                if (btnContainer) {
                    btnContainer.innerHTML = options.footer;
                    // Find any buttons *inside* the new footer and attach handlers
                    btnContainer.querySelectorAll('button[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            // Let the main EventManager handle the action, but
                            // ensure the modal closes for all *other* actions.
                            // The 'buy_intel' action is handled separately by IntelService.
                            if (btn.dataset.action !== 'buy_intel') {
                                closeHandler();
                            }
                        });
                    });
                }
            } else if (options.footer === null) {
                // Explicitly no footer
                if (btnContainer) btnContainer.innerHTML = '';
            } else {
                // Original default button logic
                if (btnContainer) {
                    btnContainer.innerHTML = ''; // Clear
                    button = document.createElement('button');
                    btnContainer.appendChild(button);
                } else {
                    button = modal.querySelector('button'); // Find first
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
     * Hides a modal and cleans up its classes.
     * @param {string} modalId - The HTML ID of the modal to hide.
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('modal-hiding');
            modal.addEventListener('animationend', () => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible', 'dismiss-disabled', 'intro-fade-in');
                
                // Cleanup GDD attributes
                delete modal.dataset.theme;
                delete modal.dataset.dismissInside;
                delete modal.dataset.dismissOutside;

                // After hiding, check if we should process the next modal
                if (this.modalQueue.length > 0 && !document.querySelector('.modal-backdrop:not(.hidden)')) {
                    this.processModalQueue();
                }
            }, { once: true });
        }
    }
}