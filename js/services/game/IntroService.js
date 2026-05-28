// js/services/game/IntroService.js
/**
 * @fileoverview Manages the new game introduction sequence, from the initial
 * lore modals to the final tutorial kickoff.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js';
import { starfieldService } from '../ui/StarfieldService.js';

export class IntroService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../UIManager.js').UIManager} uiManager
     * @param {import('../../services/LoggingService.js').Logger} logger
     * @param {import('../SimulationService.js').SimulationService} simulationServiceFacade
     */
    constructor(gameState, uiManager, logger, simulationServiceFacade) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.simulationService = simulationServiceFacade; 
        
        // Strict Lock: Persists until the *next* modal is actively queued
        this._transitioning = false; 

        // Skip Mechanic Variables
        this._timeouts = new Set();
        this._intervals = new Set();
        this._skipListener = this._handleIntroSkipClick.bind(this);
        this.lastTapTime = 0;
        this.tapCount = 0;
        this.skipState = 'hidden';
        this.skipTimerId = null;
        this.hasSkipped = false;
        this.skipBtnElement = null;
    }

    /**
     * Safe timeout wrapper to enable aggressive teardown
     */
    _setTimeout(fn, delay) {
        const timerId = setTimeout(() => {
            this._timeouts.delete(timerId);
            fn();
        }, delay);
        this._timeouts.add(timerId);
        return timerId;
    }

    /**
     * Safe interval wrapper to enable aggressive teardown
     */
    _setInterval(fn, delay) {
        const timerId = setInterval(fn, delay);
        this._intervals.add(timerId);
        return timerId;
    }

    /**
     * Injects the required CSS for the skip button directly to satisfy single-file deployment
     */
    _injectSkipCSS() {
        if (document.getElementById('intro-skip-styles')) return;
        const style = document.createElement('style');
        style.id = 'intro-skip-styles';
        style.textContent = `
            .intro-skip-btn {
                position: fixed;
                bottom: calc(env(safe-area-inset-bottom, 20px) + 20px);
                right: 20px;
                font-family: 'Oxanium', sans-serif;
                font-weight: bold;
                font-size: 18px;
                color: #9ca3af;
                text-shadow: 0 0 8px rgba(156, 163, 175, 0.5);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease, color 0.3s ease, text-shadow 0.3s ease;
                z-index: 9999;
                background: transparent;
                border: none;
                outline: none;
                cursor: pointer;
                letter-spacing: 2px;
            }
            .intro-skip-btn.is-visible {
                opacity: 1;
                pointer-events: auto;
            }
            .intro-skip-btn.is-confirm {
                color: #ffffff;
                text-shadow: 0 0 12px rgba(255, 255, 255, 0.9), 0 0 24px rgba(255, 255, 255, 0.6);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Handles temporal off-target taps to reveal the skip sequence
     */
    _handleIntroSkipClick(e) {
        if (!this.gameState.introSequenceActive) {
            document.body.removeEventListener('pointerdown', this._skipListener);
            return;
        }

        // Block skip activation during cinematic or active modal transitions
        if (this._transitioning) {
            return;
        }

        // Strict Phase Lock: Skip is ONLY allowed on the very first modal (step 0).
        if (this.gameState.player.introStep > 0) {
            document.body.removeEventListener('pointerdown', this._skipListener);
            this._hideSkipButton();
            return;
        }

        // Secondary Guard: Lock out re-activation if already skipped
        if (this.hasSkipped) {
            this._hideSkipButton();
            return;
        }

        // Prevent activation if interacting with actual UI elements
        if (e.target.closest('.modal-content') || 
            e.target.closest('.sev-term-panel') || 
            e.target.closest('.intro-skip-btn') ||
            e.target.closest('button') ||
            e.target.closest('input')) {
            return;
        }

        const now = Date.now();
        if (now - this.lastTapTime < 3000) {
            this.tapCount++;
        } else {
            this.tapCount = 1;
        }
        this.lastTapTime = now;

        if (this.tapCount >= 2 && this.skipState === 'hidden') {
            this._showSkipButton();
        }
    }

    _showSkipButton() {
        if (!this.skipBtnElement) {
            this.skipBtnElement = document.createElement('button');
            this.skipBtnElement.className = 'intro-skip-btn';
            this.skipBtnElement.innerHTML = 'SKIP';
            
            this.skipBtnElement.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (this.skipTimerId) clearTimeout(this.skipTimerId);

                if (this.skipState === 'skip_visible') {
                    this.skipState = 'confirm_visible';
                    this.skipBtnElement.innerHTML = 'CONFIRM?';
                    this.skipBtnElement.classList.add('is-confirm');
                    
                    this.skipTimerId = setTimeout(() => this._hideSkipButton(), 3000);
                } else if (this.skipState === 'confirm_visible') {
                    this._executeSkipRouting();
                }
            };
            document.body.appendChild(this.skipBtnElement);
        }

        this.skipState = 'skip_visible';
        this.skipBtnElement.innerHTML = 'SKIP';
        this.skipBtnElement.classList.remove('is-confirm');
        
        // Force reflow
        void this.skipBtnElement.offsetWidth;
        this.skipBtnElement.classList.add('is-visible');

        if (this.skipTimerId) clearTimeout(this.skipTimerId);
        this.skipTimerId = setTimeout(() => this._hideSkipButton(), 3000);
    }

    _hideSkipButton() {
        this.skipState = 'hidden';
        if (this.skipBtnElement) {
            this.skipBtnElement.classList.remove('is-visible');
        }
    }

    _teardownCurrentScreen() {
        // Clear tracked timers
        for (const timer of this._timeouts) clearTimeout(timer);
        this._timeouts.clear();
        for (const interval of this._intervals) clearInterval(interval);
        this._intervals.clear();

        // Destroy generic modals securely
        this.uiManager.hideModal('event-modal');
        this.uiManager.hideModal('charter-modal');
        this.uiManager.hideModal('signature-modal');
        
        // Destroy specialized intro DOM elements
        const elementsToRemove = [
            'intro-physical-shield',
            'quit-job-text',
            'mars-travel-overlay'
        ];
        elementsToRemove.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        const classesToRemove = ['.sev-term-overlay', '.bg-black.z-\\[150\\]'];
        classesToRemove.forEach(cls => {
            const els = document.querySelectorAll(cls);
            els.forEach(el => el.remove());
        });
    }

    _executeSkipRouting() {
        this.hasSkipped = true;
        // Permanently lock out the mechanic once skip is confirmed
        document.body.removeEventListener('pointerdown', this._skipListener);

        this._hideSkipButton();
        this._teardownCurrentScreen();
        this._transitioning = false;

        const fader = document.createElement('div');
        fader.className = 'fixed inset-0 bg-black z-[150]';
        document.body.appendChild(fader);

        if (!this.gameState.player.name) {
            const sigIndex = DB.INTRO_SEQUENCE_V1.modals.findIndex(m => m.id === 'signature');
            if (sigIndex !== -1) {
                this.gameState.player.introStep = sigIndex;
                fader.remove();
                this._showNextModal();
            }
        } else {
            // Protect state integrity if skipped post-signature but pre-credit transfer
            if (this.gameState.player.credits < 25000) {
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + 25000);
                this.gameState.player.financeLog.push({
                    day: this.gameState.day,
                    type: 'loan',
                    amount: 25000,
                    balance: this.gameState.player.credits,
                    description: 'Merchant Guild Start-up Loan'
                });
            }
            this._showStarterShipSelection(fader);
        }
    }

    /**
     * Kicks off the interactive new game introduction sequence.
     */
    start() {
        if (!this.gameState.introSequenceActive) return;
        this.logger.info.state(this.gameState.day, 'INTRO_START', 'Starting new game introduction sequence.');
        
        this._injectSkipCSS();
        document.body.addEventListener('pointerdown', this._skipListener);

        const econBtn = document.getElementById('btn-econ-weather');
        if (econBtn) econBtn.style.display = 'none';

        const cogBtn = document.getElementById('btn-game-menu');
        if (cogBtn) cogBtn.style.display = 'none';

        if (this.uiManager.helpManager && this.uiManager.helpManager.anchorBtn) {
            this.uiManager.helpManager.anchorBtn.style.display = 'none';
        }
        
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};
        this.gameState.player.introStep = 0;
        
        this._transitioning = true; 
        
        this.uiManager.playIntroCinematic(() => {
            this._transitioning = false;
            this._showNextModal();
        });
    }

    /**
     * Handles all delegated click events during the intro sequence to manage its flow.
     * @param {Event} e - The click event object.
     */
    handleIntroClick(e) {
        if (this._transitioning) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const button = e.target.closest('button');
        if (!button) return;
        
        if (button.id === 'intro-submit-btn') {
            this._transitioning = true;
            button.disabled = true;

            const input = document.getElementById('signature-input');
            const playerName = input.value.trim();
            
            const sanitizedPlayerName = playerName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    
            if (!sanitizedPlayerName || sanitizedPlayerName.length === 0) {
                this.uiManager.hideModal('signature-modal');
                this.uiManager.queueModal('event-modal', 'Invalid Signature', "The Merchant's Guild requires a valid name on the contract. Please provide your legal mark.", () => {
                    this._transitioning = false; 
                    this._showNextModal();       
                });
            } else {
                this.gameState.player.name = sanitizedPlayerName;
                this.gameState.player.debt = 25000;
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.monthlyInterestAmount = 390;
    
                this.logger.info.state(this.gameState.day, 'LOAN_ACCEPTED', `Player ${sanitizedPlayerName} accepted Guild loan.`);
                
                this.uiManager.hideModal('signature-modal');

                if (this.hasSkipped) {
                    this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + 25000);
                    this.gameState.player.financeLog.push({
                        day: this.gameState.day,
                        type: 'loan',
                        amount: 25000,
                        balance: this.gameState.player.credits,
                        description: 'Merchant Guild Start-up Loan'
                    });
                    this.logger.info.player(this.gameState.day, 'CREDITS_TRANSFER', 'Accepted loan transfer of ⌬25,000');
                    
                    const fader = document.createElement('div');
                    fader.className = 'fixed inset-0 bg-black z-[150]';
                    document.body.appendChild(fader);
                    this._showStarterShipSelection(fader);
                } else {
                    this._setTimeout(() => {
                        this._startProcessingSequence();
                    }, 2000);
                }
            }
        }
    }

    /**
     * Displays the next modal in the introduction sequence.
     * @private
     */
    _showNextModal() {
        const step = DB.INTRO_SEQUENCE_V1.modals[this.gameState.player.introStep];
        
        if (!step || step.id === 'final') {
            this._end();
            return;
        }

        this._transitioning = false;

        const options = {
            buttonClass: step.buttonClass,
            contentClass: step.contentClass,
        };
        
        if (this.gameState.player.introStep === 0) {
            options.specialClass = 'intro-blur-fade-in-4s intro-backdrop-clear';
            options.exitClass = 'intro-blur-fade-out-3s';
            starfieldService.mount();
            starfieldService.triggerEntry();

            const shield = document.createElement('div');
            shield.id = 'intro-physical-shield';
            shield.className = 'fixed inset-0 z-[9999]';
            document.body.appendChild(shield);
            this._setTimeout(() => {
                if (document.body.contains(shield)) shield.remove();
            }, 9000);

        } else if (step.id !== 'charter' && step.id !== 'signature') {
            options.specialClass = 'intro-backdrop-clear';
        }

        let modalId = 'event-modal';

        if (step.id === 'charter' || step.id === 'signature') {
            modalId = `${step.id}-modal`;
            options.specialClass = 'modal-backdrop-grey guild-backdrop';
            options.contentClass = 'modal-theme-guild-charter';

            if (step.id === 'charter') {
                starfieldService.triggerQuickExit();
            }

            options.customSetup = (modal, closeHandler) => { this._setupInteractiveModal(modal, step, closeHandler) };
        } else {
            options.customSetup = (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                if (!btnContainer) return;
                btnContainer.innerHTML = '';

                const button = document.createElement('button');
                button.className = 'btn px-6 py-2';
                
                if(step.buttonClass) button.classList.add(...step.buttonClass.split(' ').filter(Boolean));
                
                button.id = 'intro-next-btn';
                button.innerHTML = step.buttonText;
                
                let isFirstModalLocked = (this.gameState.player.introStep === 0);
                
                if (isFirstModalLocked) {
                    button.style.pointerEvents = 'none'; 
                    this._setTimeout(() => {
                        if (document.body.contains(button)) {
                            isFirstModalLocked = false;
                            button.style.pointerEvents = 'auto';
                        }
                    }, 9000); 
                }

                button.onclick = (e) => {
                    e.preventDefault();
                    if (isFirstModalLocked || this._transitioning) return;
                    
                    this._transitioning = true; 
                    button.disabled = true;
                    button.onclick = null; 
                    
                    closeHandler();             
                };

                btnContainer.appendChild(button);
            };
        }

        const onModalClose = () => {
            this.gameState.player.introStep++;
            this._showNextModal();
        };

        this.uiManager.queueModal(modalId, step.title, step.description, onModalClose, options);
    }

    /**
     * Performs custom setup for interactive modals in the intro.
     * @private
     */
    _setupInteractiveModal(modal, step, closeHandler) {
        const buttonContainer = modal.querySelector(`#${step.id}-button-container`);
        buttonContainer.innerHTML = '';
        const button = document.createElement('button');
        button.className = 'btn px-6 py-2 btn-gold-weighty';
        button.innerHTML = step.buttonText;
        
        const safeCloseHandler = (e) => {
            if (e) e.preventDefault();
            if (this._transitioning) return;

            this._transitioning = true;
            if (e && e.target) {
                e.target.disabled = true;
                e.target.onclick = null; 
            }
            closeHandler();
        };

        if (step.id === 'signature') {
            const input = modal.querySelector('#signature-input');
            input.value = '';
            button.id = 'intro-submit-btn'; 
            button.disabled = true;
            
            button.onclick = null; 

            input.oninput = () => {
                button.disabled = input.value.trim() === '';
            };
        } else {
            button.id = 'intro-next-btn';
            button.onclick = safeCloseHandler;
        }
        
        buttonContainer.appendChild(button);
    }

    /**
     * Manages the animated sequence for loan processing and triggers the game launch.
     * @private
     */
    _startProcessingSequence() {
        const showApprovalModal = () => {
            this._transitioning = false;

            const title = `<span class="hl font-orbitron text-[26px] text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] block text-center w-full">APPLICATION APPROVED</span>`;
            const description = `
                <div style="font-size: calc(1rem + 2pt);">
                    <div class="font-roboto-mono text-left space-y-2">
                        <p><span class="text-gray-400">APPLICANT:</span> ${this.gameState.player.name}</p>
                        <p><span class="text-gray-400">STATUS:</span> <span class="text-green-400 font-bold tracking-widest drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">AUTHORIZED</span></p>
                        <p><span class="text-gray-400">FUNDS:</span> <span class="credits-text-pulsing text-cyan-400 font-bold text-[17px] drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]">⌬ 25,000</span></p>
                    </div>
                    <div class="my-6 text-white text-center italic" style="text-shadow: 0 0 5px rgba(255,255,255,0.4);">
                        "Dear ${this.gameState.player.name}, you have been approved for a loan in the amount of twenty-five thousand credits. Based on your positive credit history, we have decided to waive your initial financing fee."
                    </div>
                    <div class="border-t border-slate-600 my-4"></div>
                    <p class="text-sm text-gray-400 text-justify">The Merchant's Guild has authorized the immediate disbursement of funds to your account. By accepting this transfer, you formally finalize the binding charter.</p>
                </div>
            `;
            
            const hangarTransition = (event) => {
                this._transitioning = true;
                if(event && event.target) event.target.disabled = true;
                
                this.uiManager.createFloatingText(
                    `<span style="font-size: 200%; text-shadow: 0 0 10px #34d399;">+${formatCredits(25000, false)}</span>`, 
                    event.clientX, 
                    event.clientY, 
                    '#34d399', 
                    3950, 
                    true
                );
                
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + 25000);

                this.gameState.player.financeLog.push({
                    day: this.gameState.day,
                    type: 'loan',
                    amount: 25000,
                    balance: this.gameState.player.credits,
                    description: 'Merchant Guild Start-up Loan'
                });

                this.logger.info.player(this.gameState.day, 'CREDITS_TRANSFER', 'Accepted loan transfer of ⌬25,000');

                this._setTimeout(() => {
                    this._showResignationModal();
                }, 3500);
            };

            this.uiManager.queueModal('event-modal', title, description, null, {
                contentClass: 'text-center modal-theme-guild-charter',
                specialClass: 'modal-backdrop-grey guild-backdrop',
                customSetup: (modal, closeHandler) => {
                    const btnContainer = modal.querySelector('#event-button-container');
                    btnContainer.innerHTML = '';
                    const button = document.createElement('button');
                    button.className = 'btn px-6 py-2 btn-gold-weighty';
                    button.innerHTML = 'Accept Transfer';
                    
                    button.onclick = (event) => {
                        if (this._transitioning) return;
                        this._transitioning = true; 
                        
                        hangarTransition(event);
                        closeHandler();
                    };
                  
                     btnContainer.appendChild(button);
                }
            });
        };
        
        this.uiManager.showProcessingAnimation(this.gameState.player.name, showApprovalModal);
    }

    /**
     * Executes the interactive resignation sequence ("Severance Terminal").
     * @private
     */
    _showResignationModal() {
        this._transitioning = false;

        const quitText = document.createElement('div');
        quitText.id = 'quit-job-text';
        quitText.className = 'fixed font-orbitron font-bold text-white text-[21px] z-[100] tracking-widest pointer-events-none text-center quit-job-pulse';
        quitText.style.top = '10vh';
        quitText.style.left = '50%';
        quitText.innerHTML = 'QUIT YOUR JOB!';
        document.body.appendChild(quitText);

        const overlay = document.createElement('div');
        overlay.className = 'sev-term-overlay';
        
        const panel = document.createElement('div');
        panel.className = 'sev-term-panel opacity-0'; 

        const textContainer = document.createElement('div');
        textContainer.id = 'sev-text-container';
        textContainer.className = 'min-h-[290px] relative z-10';

        const actuatorBtn = document.createElement('button');
        actuatorBtn.id = 'sev-action-btn';
        actuatorBtn.className = 'sev-actuator-btn opacity-0 pointer-events-none relative z-10 rounded-lg';
        
        const btnText = document.createElement('span');
        btnText.id = 'sev-btn-text';
        btnText.className = 'sev-btn-text';
        btnText.innerHTML = 'TERMINATE CONTRACT';
        
        actuatorBtn.appendChild(btnText);

        const warningWrapper = document.createElement('div');
        warningWrapper.className = 'h-[24px] mt-4 w-full relative z-10';
        
        const warningMsg = document.createElement('div');
        warningMsg.id = 'sev-warning-msg';
        warningMsg.className = 'opacity-0 text-center font-bold text-[15px] text-[#fbbf24] font-roboto-mono transition-opacity duration-500';
        warningMsg.innerHTML = 'WARNING: PENSION WILL BE FORFEITED';
        
        warningWrapper.appendChild(warningMsg);

        panel.appendChild(textContainer);
        panel.appendChild(actuatorBtn);
        panel.appendChild(warningWrapper);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        panel.classList.add('sev-crt-turn-on');

        let currentPhase = 0;

        this._setTimeout(() => {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'font-orbitron text-[22px] text-[#d97706] text-center tracking-[0.2em] uppercase mb-8 pb-3 border-b border-current opacity-80 font-bold';
            const headerSpan = document.createElement('span');
            headerDiv.appendChild(headerSpan);
            textContainer.appendChild(headerDiv);

            const textToType = "Belt Delta Mining Co.";
            let charIndex = 0;
            const typeInterval = 1500 / textToType.length; 
            const typer = this._setInterval(() => {
                headerSpan.textContent += textToType[charIndex];
                charIndex++;
                if (charIndex >= textToType.length) {
                    clearInterval(typer);
                    this._intervals.delete(typer);
                }
            }, typeInterval);

            this._setTimeout(() => {
                const terminalLines = [
                    `<div id="secure-link-line" class='font-roboto-mono mb-8 font-bold tracking-widest text-[13px] text-center opacity-90'>SECURE TERMINAL LINK ESTABLISHED</div>`,
                    `<div class='font-roboto-mono flex justify-between py-3 border-b border-current border-opacity-30 text-[15px]'><span class='opacity-70'>[ EMPLOYEE ID ]</span><span class='text-[#cffafe] font-bold'>${this.gameState.player.name}</span></div>`,
                    `<div class='font-roboto-mono flex justify-between py-3 border-b border-current border-opacity-30 text-[15px]'><span class='opacity-70'>[ PACKAGES ROUTED ]</span><span class='text-[#cffafe]'>1,932,320</span></div>`,
                    `<div class='font-roboto-mono flex justify-between py-3 border-b border-current border-opacity-30 text-[15px]'><span class='opacity-70'>[ CYCLES LOGGED ]</span><span class='text-[#cffafe]'>2,849</span></div>`
                ];

                const timings = [0, 4000, 5800, 7600]; 

                terminalLines.forEach((line, i) => {
                    const lineDiv = document.createElement('div');
                    lineDiv.className = 'sev-type-line';
                    lineDiv.innerHTML = line;
                    textContainer.appendChild(lineDiv);

                    this._setTimeout(() => {
                        lineDiv.classList.add('sev-line-visible');
                        
                        if (i === 0) {
                            const linkEl = document.getElementById('secure-link-line');
                            if (linkEl) linkEl.classList.add('sev-rhythmic-pulse');
                        }
                        
                        if (i === 3) {
                            this._setTimeout(() => {
                                currentPhase = 1;
                                actuatorBtn.classList.remove('pointer-events-none');
                                actuatorBtn.style.animation = 'sevBtnFadeIn 1.5s ease-out forwards';
                            }, 1800); 
                        }
                    }, timings[i]);
                });
            }, 1500); 
        }, 1300); 

        actuatorBtn.onclick = (e) => {
            if (this._transitioning) return;

            if (currentPhase === 1) {
                currentPhase = 2;
                actuatorBtn.classList.add('confirm-phase');
                
                warningMsg.classList.remove('opacity-0');
                warningMsg.classList.add('animate-pulse');
                
                btnText.innerHTML = 'CONFIRM?';
            } else if (currentPhase === 2) {
                currentPhase = 3;
                this._transitioning = true;
                actuatorBtn.style.pointerEvents = 'none';
                btnText.innerHTML = 'EXECUTING...';
                
                if (quitText) {
                    quitText.style.animation = 'quitJobFadeOut 0.6s ease-out forwards';
                }

                panel.classList.remove('sev-crt-turn-on');
                void panel.offsetWidth;
                panel.classList.add('sev-crt-shutdown');

                this._setTimeout(() => {
                    panel.remove();

                    const finalSpan = document.createElement('span');
                    finalSpan.className = 'text-[#f97316] font-orbitron text-xl tracking-widest text-center px-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]';
                    finalSpan.style.animation = 'sevLineFade 1s ease-out forwards';
                    finalSpan.innerHTML = '> PENSION FORFEITED. TERMINATION COMPLETE <';
                    overlay.appendChild(finalSpan);

                    this._setTimeout(() => {
                        overlay.style.transition = 'all 3s ease-out';
                        overlay.style.opacity = '0';
                        overlay.style.filter = 'blur(12px)';

                        this._setTimeout(() => {
                            const fader = document.createElement('div');
                            fader.className = 'fixed inset-0 bg-black z-[150]';
                            fader.style.opacity = '0';
                            fader.style.transition = 'opacity 0.5s ease-in-out';
                            document.body.appendChild(fader);
                            
                            void fader.offsetWidth;
                            fader.style.opacity = '1';

                            this._setTimeout(() => {
                                overlay.remove();
                                if (quitText && quitText.parentNode) quitText.remove();
                                
                                this._triggerMarsTravelSequence(fader);
                            }, 500); 
                            
                        }, 3000); 
                    }, 3000); 
                }, 1300); 
            }
        };
    }

    /**
     * Executes the Mars Travel Starfield visual sequence over exactly 6000ms.
     * Integrates fades and high-speed warp.
     * @private
     * @param {HTMLElement} fader - The black overlay div shielding the transition
     */
    _triggerMarsTravelSequence(fader) {
        this.uiManager.showGameContainer();
        
        starfieldService.mount();
        starfieldService.triggerEntry();
        this._setTimeout(() => starfieldService.setEngageWarp(), 50);
        
        const overlay = document.createElement('div');
        overlay.id = 'mars-travel-overlay';
        overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center pointer-events-none';
        overlay.innerHTML = `<span class='text-white font-orbitron text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] text-center px-4'>Traveling to the Martian Shipyards...</span>`;
        document.body.appendChild(overlay);

        fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).onfinish = () => {
            
            this._setTimeout(() => {
                
                fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).onfinish = () => {
                    overlay.remove();
                    starfieldService.triggerQuickExit();
                    
                    fader.style.zIndex = '10000'; 
                    
                    this._transitioning = false;
                    this._showMetaHelpModals(fader);
                };

            }, 2000); 
        };
    }

    /**
     * Executes the sequential meta help modals before allowing the UI to render.
     * @private
     * @param {HTMLElement} fader - The black overlay div shielding the transition
     */
    _showMetaHelpModals(fader) {
        this.uiManager.showGameContainer();

        this.uiManager.showHelpModal('meta-tutorial', 0, () => {
            this._setTimeout(() => {
                this.uiManager.showHelpModal('meta-autosave', 0, () => {
                    this._showStarterShipSelection(fader);
                });
            }, 1000);
        });
    }

    /**
     * Generates and displays the bespoke starter ship selection screen dynamically over the game UI.
     * @public - Accessible by DebugService
     * @param {HTMLElement} fader - The black overlay div shielding the transition
     */
    _showStarterShipSelection(fader) {
        this._transitioning = false;
        
        this.uiManager.showGameContainer();

        const econBtn = document.getElementById('btn-econ-weather');
        if (econBtn) econBtn.style.display = 'none';

        if (this.uiManager.helpManager && this.uiManager.helpManager.anchorBtn) {
            this.uiManager.helpManager.anchorBtn.style.display = 'flex';
        }
        
        starfieldService.mount();
        starfieldService.triggerEntry();

        const overlay = document.createElement('div');
        overlay.id = 'starter-ship-selection-overlay';
        
        overlay.className = 'fixed inset-0 z-[40] flex flex-col items-center justify-center intro-blur-fade-in';
        overlay.style.background = 'transparent'; 
        
        const starterShips = [
            {
                id: 'Wanderer.Ship',
                roleClass: 'text-sky-400',
                borderClass: 'border-pulse-explorer'
            },
            {
                id: 'Stalwart.Ship',
                roleClass: 'text-emerald-400',
                borderClass: 'border-pulse-balanced'
            },
            {
                id: 'Mule.Ship',
                roleClass: 'text-amber-400',
                borderClass: 'border-pulse-hauler'
            }
        ];

        const container = document.createElement('div');
        container.className = 'starter-selection-container';

        starterShips.forEach(shipInfo => {
            const shipStatic = DB.SHIPS[shipInfo.id];
            const btn = document.createElement('button');
            btn.className = `starter-thumbnail-btn ${shipInfo.borderClass}`;
            btn.type = 'button';
            
            let imgSrc = AssetService.getShipImage(shipInfo.id, this.gameState.player.visualSeed);
            
            if (shipInfo.id === 'Wanderer.Ship') imgSrc = 'assets/images/ships/Wanderer/Wanderer_F.webp';
            if (shipInfo.id === 'Mule.Ship') imgSrc = 'assets/images/ships/Mule/Mule_H.webp';
            if (shipInfo.id === 'Nomad.Ship') imgSrc = 'assets/images/ships/Nomad/Nomad_A.webp';
            
            if (!imgSrc || imgSrc === '') imgSrc = AssetService.getFallbackImage(shipInfo.id);

            btn.innerHTML = `
                <div style="overflow: hidden; aspect-ratio: 1/1; width: 100%; border-radius: 4px; display: flex; justify-content: center; align-items: center; border: 1px solid #4b5563;">
                    <img src="${imgSrc}" alt="${shipStatic.name}" style="transform: scale(1.3); object-fit: cover; width: 100%; height: 100%;" />
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 0.5rem;">
                    <span class="ship-name">${shipStatic.name}</span>
                    <span class="ship-role ${shipInfo.roleClass}">${shipStatic.role}</span>
                </div>
            `;
            
            btn.onclick = (e) => {
                e.preventDefault();
                this.uiManager.showShipDetailModal(this.gameState, shipInfo.id, 'intro_shipyard');
            };
            
            container.appendChild(btn);
        });

        const narrativeBox = document.createElement('div');
        narrativeBox.className = 'starter-narrative-box';
        narrativeBox.style.fontSize = 'calc(1rem + 3pt)';
        narrativeBox.innerHTML = "Now that you've got some credits, it's time to purchase your first ship. Make your selection carefully to begin your journey.";

        overlay.appendChild(container);
        overlay.appendChild(narrativeBox);

        document.body.appendChild(overlay);

        if (fader) {
            fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).onfinish = () => {
                fader.remove();
            };
        }
    }

    /**
     * Handles the intercepted purchase action from the starter ship selection modal.
     * Orchestrates the final Flight School cinematic block and state initialization.
     * @param {string} shipId 
     */
    async handleStarterPurchase(shipId) {
        if (this._transitioning) return;
        this._transitioning = true;

        if (this.uiManager.helpManager && this.uiManager.helpManager.anchorBtn) {
            this.uiManager.helpManager.anchorBtn.style.display = 'none';
        }

        const overlay = document.getElementById('starter-ship-selection-overlay');
        
        this.uiManager.hideModal('ship-detail-modal');

        this.uiManager.createFloatingText(
            `<span style="font-size: 200%; font-weight: bold; text-shadow: 0 0 10px #ef4444;">-25k</span>`,
            window.innerWidth / 2,
            window.innerHeight / 2,
            '#ef4444',
            2000,
            true
        );

        const fader = document.createElement('div');
        fader.className = 'fixed inset-0 bg-black z-[150]'; 
        fader.style.opacity = '0';
        document.body.appendChild(fader);

        // Mutate Player State quietly
        const shipStatic = DB.SHIPS[shipId];
        this.gameState.player.credits -= 25000; 
        this.gameState.player.ownedShipIds.push(shipId);
        this.gameState.player.activeShipId = shipId;
        this.gameState.player.shipStates[shipId] = {
            health: shipStatic.maxHealth,
            fuel: shipStatic.maxFuel,
            upgrades: []
        };
        
        this.gameState.player.inventories[shipId] = {};
        DB.COMMODITIES.forEach(c => {
            this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
        });

        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.transition = 'none';
            gameContainer.style.opacity = '0';
        }

        if (!this.hasSkipped) {
            // Standard Cinematic Route
            await fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).finished;

            if (overlay) overlay.style.display = 'none';

            starfieldService.mount();
            starfieldService.triggerEntry(); 

            const textOverlay = document.createElement('div');
            textOverlay.className = 'fixed inset-0 z-[100] flex items-center justify-center pointer-events-none';
            textOverlay.innerHTML = `<span class='text-white font-orbitron text-xl tracking-widest text-center px-4'>Months later...<br><br><br>Flight School is complete.</span>`;
            document.body.appendChild(textOverlay);

            await fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).finished;

            await new Promise(res => setTimeout(res, 4000));

            await fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).finished;

            textOverlay.remove();
            starfieldService.triggerQuickExit();
            if (overlay) overlay.remove();

            this._end();

            if (gameContainer) gameContainer.style.opacity = '';

            await fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).finished;

            fader.remove();
            if (gameContainer) gameContainer.style.transition = '';
        } else {
            // Total Cinematic Bypass Route
            await fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'forwards' }).finished;
            
            if (overlay) overlay.remove();
            starfieldService.triggerQuickExit();
            
            this._end();
            
            if (gameContainer) gameContainer.style.opacity = '';
            
            await fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).finished;
            fader.remove();
            
            if (gameContainer) gameContainer.style.transition = '';
        }
    }

    /**
     * Finalizes the intro sequence and transitions control to the core render loop.
     * @private
     */
    _end() {
        this.gameState.introSequenceActive = false;
        this._transitioning = false;
        
        document.body.removeEventListener('pointerdown', this._skipListener);

        this.logger.info.state(this.gameState.day, 'INTRO_END', 'Introduction sequence complete. Booting to Missions.');
        
        const econBtn = document.getElementById('btn-econ-weather');
        if (econBtn) econBtn.style.display = '';

        const cogBtn = document.getElementById('btn-game-menu');
        if (cogBtn) cogBtn.style.display = '';

        this.gameState.uiState.hangarShipyardToggleState = 'hangar';

        this.uiManager.showGameContainer();
        
        this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
        
        this.uiManager.render(this.gameState.getState());
    }
}