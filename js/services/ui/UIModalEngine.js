// js/services/ui/UIModalEngine.js
import { SCREEN_IDS, NAV_IDS, ACTION_IDS, LOCATION_IDS } from '../../data/constants.js';
import { OFFICERS } from '../../data/officers.js';
import { starfieldService } from './StarfieldService.js';

export class UIModalEngine {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
        this.modalQueue = [];
        this._injectBankruptcyModals();
        this._injectUpgradeProgressModal();
    }

    /**
     * Injects the static DOM templates for the Bankruptcy flow into the document.
     * @private
     */
    _injectBankruptcyModals() {
        if (document.getElementById('bankruptcy-guild-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="bankruptcy-guild-modal" class="modal-backdrop hidden z-[70]">
                <div class="modal-content modal-theme-warning-yellow">
                    <h3 id="bankruptcy-guild-title" class="text-2xl font-orbitron mb-4 text-yellow-400 text-center"></h3>
                    <div id="bankruptcy-guild-description" class="mb-4 text-lg text-gray-200 text-center"></div>
                    <div id="guild-labor-options" class="flex flex-col gap-3 my-6">
                        <div class="relative">
                            <input type="radio" name="guild-labor" value="mars" id="guild-mars" class="hidden peer" checked>
                            <label for="guild-mars" class="block p-3 border border-yellow-700/50 rounded bg-black/50 cursor-pointer hover:bg-yellow-900/30 peer-checked:bg-yellow-900/60 peer-checked:border-yellow-400 transition-colors text-center">
                                Mars Habitat Construction <br><span class="text-red-500">6 Years Labor</span>, <span class="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)] font-bold">+ ⌬ 10k</span>
                            </label>
                        </div>
                        <div class="relative">
                            <input type="radio" name="guild-labor" value="uranus" id="guild-uranus" class="hidden peer">
                            <label for="guild-uranus" class="block p-3 border border-yellow-700/50 rounded bg-black/50 cursor-pointer hover:bg-yellow-900/30 peer-checked:bg-yellow-900/60 peer-checked:border-yellow-400 transition-colors text-center">
                                Uranus Orbital Assembly <br><span class="text-red-500">8 Years Labor</span>, <span class="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)] font-bold">+ ⌬ 16k</span>
                            </label>
                        </div>
                        <div class="relative">
                            <input type="radio" name="guild-labor" value="mercury" id="guild-mercury" class="hidden peer">
                            <label for="guild-mercury" class="block p-3 border border-yellow-700/50 rounded bg-black/50 cursor-pointer hover:bg-yellow-900/30 peer-checked:bg-yellow-900/60 peer-checked:border-yellow-400 transition-colors text-center">
                                Mercury Sub-Surface Mining <br><span class="text-red-500">10 Years Labor</span>, <span class="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)] font-bold">+ ⌬ 25k</span>
                            </label>
                        </div>
                    </div>
                    <div id="bankruptcy-guild-button-container" class="mt-6 flex justify-center gap-4">
                        <button id="guild-accept-btn" class="btn bg-yellow-900 hover:bg-yellow-800 text-white border-yellow-600">Accept Terms</button>
                    </div>
                </div>
            </div>

            <div id="bankruptcy-syndicate-modal" class="modal-backdrop hidden z-[70]">
                <div class="modal-content modal-theme-glitching-red">
                    <h3 id="bankruptcy-syndicate-title" class="text-2xl font-orbitron mb-4 text-red-500 text-center"></h3>
                    <div id="bankruptcy-syndicate-description" class="mb-6 text-lg text-red-200 text-center"></div>
                    <div class="p-4 border border-red-800 bg-red-950/50 rounded mb-6 text-center font-roboto-mono">
                        <span class="text-red-500">10 Years Labor</span><br>
                        <span class="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)] font-bold">+ ⌬ 25k</span><br>
                        <span class="text-red-600 font-bold mt-2 block">Ship Seized.</span>
                    </div>
                    <div id="bankruptcy-syndicate-button-container" class="mt-6 flex justify-center gap-4">
                        <button id="syndicate-accept-btn" class="btn bg-red-900 hover:bg-red-800 text-white border-red-600">Submit</button>
                    </div>
                </div>
            </div>

            <div id="bankruptcy-vagrancy-modal" class="modal-backdrop hidden z-[70]">
                <div class="modal-content modal-theme-drab-gray">
                    <h3 id="bankruptcy-vagrancy-title" class="text-2xl font-orbitron mb-4 text-gray-400 text-center"></h3>
                    <div id="bankruptcy-vagrancy-description" class="mb-6 text-lg text-gray-300 text-center"></div>
                    <div class="p-4 border border-gray-600 bg-gray-800/50 rounded mb-6 text-center font-roboto-mono">
                        <span class="text-red-500">5 Years Labor</span><br>
                        <span class="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)] font-bold">+ ⌬ 8k</span>
                    </div>
                    <div id="bankruptcy-vagrancy-button-container" class="mt-6 flex justify-center gap-4">
                        <button id="vagrancy-accept-btn" class="btn bg-gray-700 hover:bg-gray-600 text-white border-gray-500">Comply</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', container.innerHTML);
    }

    /**
     * Injects the localized, non-standard DOM template for the Ship Upgrade Progress Modal.
     * Required for Phase 1/2 of the Upgrade Orchestration Sequence.
     * @private
     */
    _injectUpgradeProgressModal() {
        if (document.getElementById('upgrade-progress-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="upgrade-progress-modal" class="modal-backdrop hidden z-[90] upgrade-progress-modal dismiss-disabled">
                <div class="modal-content">
                    <div id="upgrade-progress-text" class="upgrade-progress-text">Installing component...</div>
                    <div class="upgrade-progress-bar">
                        <div id="upgrade-progress-fill" class="upgrade-progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', container.innerHTML);
    }

    /**
     * Queues the appropriate bankruptcy modal and captures the UI selection.
     * @param {string} type - 'guild', 'syndicate', or 'vagrancy'.
     * @param {function} executeCallback - The BankruptcyService.executeTransition function to trigger on confirmation.
     */
    queueBankruptcyModal(type, executeCallback) {
        let modalId, title, description, customSetup;

        if (type === 'guild') {
            modalId = 'bankruptcy-guild-modal';
            title = 'MANDATORY LABOR PROGRAM';
            description = "The Merchant's Guild has detected that you are effectively bankrupt. As a registered debtor to the Guild, your vessel has been impounded. To avoid permanent seizure of your ship, you are ordered to select a mandatory labor program to clear your debt.";
            customSetup = (modal, closeHandler) => {
                const acceptBtn = modal.querySelector('#guild-accept-btn');
                acceptBtn.onclick = () => {
                    const selected = modal.querySelector('input[name="guild-labor"]:checked').value;
                    // FIX: Using robust LOCATION_IDS instead of incomplete strings
                    let years = 6, payout = 10000, location = LOCATION_IDS.MARS;
                    if (selected === 'uranus') { years = 8; payout = 16000; location = LOCATION_IDS.URANUS; }
                    if (selected === 'mercury') { years = 10; payout = 25000; location = LOCATION_IDS.MERCURY; }
                    
                    closeHandler();
                    executeCallback(years, payout, false, location);
                };
            };
        } else if (type === 'syndicate') {
            modalId = 'bankruptcy-syndicate-modal';
            title = 'SYNDICATE ASSET SEIZURE INITIATED';
            description = "The Syndicate has detected that you are bankrupt while you still owe us. We have come to repossess whatever you have left, which appears to be your ship. You're being relocated to the Pluto ice-yards to work off the remainder of your balance.";
            customSetup = (modal, closeHandler) => {
                const acceptBtn = modal.querySelector('#syndicate-accept-btn');
                acceptBtn.onclick = () => {
                    closeHandler();
                    executeCallback(10, 25000, true, LOCATION_IDS.PLUTO); // FIX: Safe ID
                };
            };
        } else {
            modalId = 'bankruptcy-vagrancy-modal';
            title = 'CITATION: STATION VAGRANCY';
            description = "You possess insufficient funds to maintain docking privileges. Local station authorities have remanded you to the public works detail at the local station until you can prove financial solvency.";
            customSetup = (modal, closeHandler) => {
                const acceptBtn = modal.querySelector('#vagrancy-accept-btn');
                acceptBtn.onclick = () => {
                    closeHandler();
                    executeCallback(5, 8000, false, null); // location stays current
                };
            };
        }

        this.queueModal(modalId, title, description, null, {
            nonDismissible: true,
            customSetup: customSetup,
            contentClass: 'text-center' // FIX: Enforces center alignment across modal body
        });
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

        // FIX: Ensure specialClass strings with spaces are split properly to prevent InvalidCharacterError
        if (options.specialClass) {
            modal.classList.add(...options.specialClass.split(' ').filter(Boolean));
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

        // --- VIRTUAL WORKBENCH: GDD BACKDROP DISMISSAL ---
        const backdropDismissHandler = (e) => {
            if (modal.dataset.dismissOutside === 'true' && e.target === modal) {
                modal.removeEventListener('click', backdropDismissHandler);
                closeHandler();
            }
        };
        
        // Clean up previous listeners to prevent memory leaks or duplicate triggers on reused modals
        if (modal._backdropDismissHandler) {
            modal.removeEventListener('click', modal._backdropDismissHandler);
        }
        modal._backdropDismissHandler = backdropDismissHandler;
        modal.addEventListener('click', backdropDismissHandler);
        // --- END VIRTUAL WORKBENCH ---

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
                    if (options.buttonClass) {
                        // FIX: Ensure class definitions with spaces don't crash the DOMTokenList
                        button.classList.add(...options.buttonClass.split(' ').filter(Boolean));
                    }
                    button.innerHTML = options.buttonText || 'Understood';
                    button.onclick = closeHandler;
                }
            }
        }

        // Ensure we start from a clean state.
        modal.classList.remove('hidden');
        modal.classList.remove('modal-hiding'); 
        modal.classList.add('modal-visible');

        // Bind the dynamic scroll indicator arrow for scrollable modal content
        this._bindScrollIndicator(modal);
    }

    /**
     * Binds a scroll listener to manage the visibility of the scroll indicator arrow.
     * Uses visibility toggling to neutralize CSS opacity animation conflicts, and
     * dynamically maps the DOM natively for active scroll containers.
     * @private
     */
    _bindScrollIndicator(modal) {
        requestAnimationFrame(() => {
            const modalContent = modal.querySelector('.modal-content');
            if (!modalContent) return;

            // 1. Hard cleanup of any existing arrows and intervals
            const existingArrows = modalContent.querySelectorAll('.scroll-indicator-arrow');
            existingArrows.forEach(a => a.remove());
            
            if (modalContent._pollInterval) {
                clearInterval(modalContent._pollInterval);
            }

            // 2. Inject fresh arrow initialized via VISIBILITY
            const arrow = document.createElement('div');
            arrow.className = 'scroll-indicator-arrow';
            arrow.innerHTML = '▾'; 
            arrow.style.visibility = 'hidden'; // Core Fix: Layout-level visual suppression
            modalContent.appendChild(arrow);

            // Keep track of dynamically bound containers
            const activeScrollContainers = new Set();

            const scrollHandler = () => {
                let needsArrow = false;
                
                for (const node of activeScrollContainers) {
                    // Safety check: remove listener reference if node was destroyed
                    if (!document.contains(node)) {
                        activeScrollContainers.delete(node);
                        continue;
                    }

                    const cHeight = node.clientHeight;
                    const sHeight = node.scrollHeight;
                    
                    // Must have actual height and overflow by at least 5px
                    if (cHeight === 0 || sHeight <= cHeight + 5) continue;

                    const sTop = node.scrollTop;
                    const distanceToBottom = sHeight - (sTop + cHeight);
                    const threshold = Math.max(sHeight * 0.10, 10); // Bottom 10%
                    
                    if (distanceToBottom > threshold) {
                        needsArrow = true;
                        break; 
                    }
                }
                
                arrow.style.visibility = needsArrow ? 'visible' : 'hidden';
            };

            const scanForContainersAndCheckScroll = () => {
                // Dynamically scan for ANY element inside the modal configured to scroll
                const allNodes = [modalContent, ...modalContent.querySelectorAll('*')];
                
                for (const node of allNodes) {
                    const cHeight = node.clientHeight;
                    const sHeight = node.scrollHeight;

                    // Must have physical dimensions
                    if (cHeight === 0 || sHeight <= cHeight + 5) continue;

                    const style = window.getComputedStyle(node);
                    if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;

                    // If a valid container was found, ensure it is actively tracked
                    if (!activeScrollContainers.has(node)) {
                        node.addEventListener('scroll', scrollHandler, { passive: true });
                        activeScrollContainers.add(node);
                    }
                }
                
                // Immediately check scroll state after a scan completes
                scrollHandler();
            };

            // Clean up old observers
            if (modalContent._resizeObserver) {
                modalContent._resizeObserver.disconnect();
            }
            if (modalContent._mutationObserver) {
                modalContent._mutationObserver.disconnect();
            }

            // Observe modal resizes
            modalContent._resizeObserver = new ResizeObserver(() => scanForContainersAndCheckScroll());
            modalContent._resizeObserver.observe(modalContent);

            // Observe DOM mutations within the modal content (text/images added)
            modalContent._mutationObserver = new MutationObserver(() => scanForContainersAndCheckScroll());
            modalContent._mutationObserver.observe(modalContent, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true 
            });

            // Poll for the first 1.5s to catch late-painting image reflows and fonts
            let pollCount = 0;
            modalContent._pollInterval = setInterval(() => {
                scanForContainersAndCheckScroll();
                pollCount++;
                if (pollCount >= 15) {
                    clearInterval(modalContent._pollInterval);
                }
            }, 100);

            // Run initial check
            scanForContainersAndCheckScroll();
        });
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
                modal.classList.remove('modal-hiding', 'modal-visible', 'dismiss-disabled', 'intro-fade-in', 'intro-backdrop-clear', 'modal-backdrop-grey');
                
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
     * Silently and instantly destroys a modal without CSS fade-out animations.
     * Crucial for masking DOM swaps behind external overlays (e.g. White-out transitions).
     * @param {string} modalId - The ID of the modal to instantly hide.
     */
    destroyModalInstant(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.classList.remove('modal-visible', 'modal-hiding', 'dismiss-disabled', 'intro-fade-in', 'intro-backdrop-clear', 'modal-backdrop-grey');
            
            delete modal.dataset.theme;
            delete modal.dataset.dismissInside;
            delete modal.dataset.dismissOutside;

            // Optional: If there are queued modals, process them.
            // Normally avoided during a global sequence mask.
            if (this.modalQueue.length > 0) {
                this.processModalQueue();
            }
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

    /**
     * Executes the localized Upgrade Progress Modal sequence.
     * Applies a global UI lock and resolves a Promise upon the completion
     * of the 2-second fill animation, allowing external orchestration.
     * @returns {Promise<void>} Resolves when the 2-second bar fill and text swap complete.
     */
    showUpgradeProgressModal() {
        return new Promise((resolve) => {
            // Apply global click lock
            document.body.classList.add('ui-locked');

            const modalId = 'upgrade-progress-modal';
            const modal = document.getElementById(modalId);
            const textEl = document.getElementById('upgrade-progress-text');
            const fillEl = document.getElementById('upgrade-progress-fill');

            if (!modal || !textEl || !fillEl) {
                this.manager.logger.error('UIModalEngine', 'Upgrade progress modal DOM elements not found. Bypassing animation.');
                document.body.classList.remove('ui-locked');
                resolve();
                return;
            }

            // Reset initial state to ensure repeatability 
            textEl.textContent = 'Installing component...';
            
            // Force CSS reflow to restart animation reliably
            fillEl.style.animation = 'none';
            void fillEl.offsetWidth; 
            fillEl.style.animation = 'fillProgressBar 2s linear forwards';

            modal.classList.remove('hidden');
            modal.classList.add('modal-visible');

            // Wait exactly 2000ms for the bar fill to map to CSS timing
            setTimeout(() => {
                // Update dynamic flavor text
                textEl.textContent = 'Ship upgrade complete!';
                
                // Resolve so the external orchestrator can begin the white-out DOM swap
                // Note: The global .ui-locked class remains active intentionally until Phase 4.
                resolve();
            }, 2000);
        });
    }

    /**
     * Builds the DOM for the cinematic officer recruitment sequence (Phase 2).
     * Uses fixed interaction (no outside dismissal) and pre-rendered sprite layers.
     * @param {string} officerId
     */
    buildOfficerRecruitmentDOM(officerId) {
        const officer = OFFICERS[officerId];
        if (!officer) {
            this.manager.logger.error('UIModalEngine', `Cannot build recruitment DOM for invalid officer ID: ${officerId}`);
            return null;
        }

        // Ensure the container exists
        let modalBackdrop = document.getElementById('officer-recruitment-modal');
        if (!modalBackdrop) {
            modalBackdrop = document.createElement('div');
            modalBackdrop.id = 'officer-recruitment-modal';
            modalBackdrop.className = 'modal-backdrop hidden z-[80] dismiss-disabled';
            document.body.appendChild(modalBackdrop);
        }

        // Fetch sprite styling
        let portraitStyle = '';
        if (officer.portraitId && typeof window.getPortraitStyle === 'function') {
            portraitStyle = window.getPortraitStyle(officer.portraitId);
        }

        const nameParts = officer.name.split(' ');
        const displayName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : officer.name;

        modalBackdrop.innerHTML = `
            <div class="officer-recruitment-modal rarity-${officer.rarity || 'common'}">
                <div class="silhouette-layer"></div>
                <div class="detail-layer" style="opacity: 0;">
                    <div class="w-full text-center mt-8 mb-2">
                        <span style="font-family: 'Zorque', sans-serif; text-shadow: 0 0 12px var(--rarity-color);" class="text-[22px] text-white tracking-widest">OFFICER RECRUITED</span>
                    </div>
                    <div class="portrait-image" style="${portraitStyle}"></div>
                    <div class="officer-text-box flex flex-col justify-center w-full px-4">
                        <h2 class="font-orbitron font-bold text-[28px] text-white uppercase mb-1" style="text-shadow: 0 0 10px var(--rarity-color);">${displayName}</h2>
                        <div class="uppercase tracking-widest mb-3 text-[18px]" style="color: var(--rarity-color); font-weight: bold;">${officer.role}</div>
                        <div class="text-[17px] text-gray-300 italic leading-relaxed">"${officer.lore}"</div>
                    </div>
                </div>
                <button type="button" class="btn-recruit" id="btn-recruit-officer" style="display: none;">RECRUIT</button>
            </div>
        `;
        return modalBackdrop;
    }

    /**
     * Executes the cinematic sequence for officer recruitment (Phase 3).
     * @param {HTMLElement} modalContainer - The wrapper containing the recruitment modal.
     * @returns {Promise<void>} Resolves when the player clicks the recruit button and the modal dismisses.
     */
    playRecruitmentCinematic(modalContainer) {
        return new Promise((resolve) => {
            const modalBox = modalContainer.querySelector('.officer-recruitment-modal');
            const silhouette = modalContainer.querySelector('.silhouette-layer');
            const detail = modalContainer.querySelector('.detail-layer');
            const recruitBtn = modalContainer.querySelector('#btn-recruit-officer');

            // Apply global UI lock
            document.body.classList.add('ui-locked');

            // Dim background via Starfield overlay
            starfieldService.mount();
            starfieldService.triggerEntry();

            // Initial states
            modalContainer.style.opacity = '0';
            modalContainer.classList.remove('hidden');

            silhouette.style.opacity = '1';
            detail.style.opacity = '0';
            recruitBtn.style.display = 'none';
            recruitBtn.style.opacity = '0';

            // Fade in modal backdrop
            modalContainer.animate([
                { opacity: 0 },
                { opacity: 1 }
            ], { duration: 1000, fill: 'forwards', easing: 'ease-out' }).onfinish = () => {
                modalContainer.style.opacity = '1';
            };

            // Blur-fade in the modal box
            modalBox.animate([
                { opacity: 0, filter: 'blur(12px)', transform: 'scale(0.9)' },
                { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' }
            ], { duration: 1000, fill: 'forwards', easing: 'ease-out' });

            // Crossfade silhouette to details
            setTimeout(() => {
                silhouette.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], { duration: 2000, fill: 'forwards', easing: 'ease-in-out' });

                detail.animate([
                    { opacity: 0 },
                    { opacity: 1 }
                ], { duration: 2000, fill: 'forwards', easing: 'ease-in-out' });
            }, 1500);

            // Show recruit button
            setTimeout(() => {
                recruitBtn.style.display = 'block';
                recruitBtn.animate([
                    { opacity: 0 },
                    { opacity: 1 }
                ], { duration: 500, fill: 'forwards', easing: 'ease-in-out' });

                // Attach click listener to resolve and hide
                recruitBtn.addEventListener('click', () => {
                    starfieldService.triggerQuickExit();
                    
                    // Fade out container
                    modalContainer.animate([
                        { opacity: 1 },
                        { opacity: 0 }
                    ], { duration: 800, fill: 'forwards', easing: 'ease-out' });

                    // Blur-fade out box
                    modalBox.animate([
                        { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
                        { opacity: 0, filter: 'blur(12px)', transform: 'scale(1.1)' }
                    ], { duration: 800, fill: 'forwards', easing: 'ease-out' }).onfinish = () => {
                        document.body.classList.remove('ui-locked');
                        modalContainer.remove();
                        resolve();
                    };
                }, { once: true });

            }, 3500);
        });
    }
}