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
    }

    /**
     * Kicks off the interactive new game introduction sequence.
     */
    start() {
        if (!this.gameState.introSequenceActive) return;
        this.logger.info.state(this.gameState.day, 'INTRO_START', 'Starting new game introduction sequence.');
        
        // [FIX] Force inline display: none to override CSS ID specificity
        const econBtn = document.getElementById('btn-econ-weather');
        if (econBtn) econBtn.style.display = 'none';

        // --- VIRTUAL WORKBENCH: Hide Pause Menu Cog during Intro ---
        const cogBtn = document.getElementById('btn-game-menu');
        if (cogBtn) cogBtn.style.display = 'none';
        // --- END VIRTUAL WORKBENCH ---

        // Ensure the Help Anchor is completely suppressed early in the intro.
        if (this.uiManager.helpManager && this.uiManager.helpManager.anchorBtn) {
            this.uiManager.helpManager.anchorBtn.style.display = 'none';
        }
        
        // Set the initial state for the intro (strips debug/default items)
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};
        this.gameState.player.introStep = 0;
        
        // Lock UI interactions while cinematic plays
        this._transitioning = true; 
        
        // Trigger the dual-path cinematic, passing the modal initialization as the callback
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
                // Clear the DOM to prevent stacking, then queue the rejection
                this.uiManager.hideModal('signature-modal');
                this.uiManager.queueModal('event-modal', 'Invalid Signature', "The Merchant's Guild requires a valid name on the contract. Please provide your legal mark.", () => {
                    this._transitioning = false; // Safely release lock
                    this._showNextModal();       // Re-present the form cleanly
                });
            } else {
                this.gameState.player.name = sanitizedPlayerName;
                this.gameState.player.debt = 25000;
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.monthlyInterestAmount = 390;
    
                this.logger.info.state(this.gameState.day, 'LOAN_ACCEPTED', `Player ${sanitizedPlayerName} accepted Guild loan.`);
                
                // Explicitly close the signature modal to clear the stage
                this.uiManager.hideModal('signature-modal');

                // Wait for the golden blur animation (1000ms) before popping up the processing modal
                setTimeout(() => {
                    this._startProcessingSequence();
                }, 2000);
            }
        }
    }

    /**
     * Displays the next modal in the introduction sequence.
     * @private
     */
    _showNextModal() {
        const step = DB.INTRO_SEQUENCE_V1.modals[this.gameState.player.introStep];
        
        // Skip the old "final" modal as it relied on the player having a ship from the deprecated tutorial
        if (!step || step.id === 'final') {
            this._end();
            return;
        }

        // Release lock: The next step is ready to be queued.
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

            // --- VIRTUAL WORKBENCH: PHYSICAL INTERACTION SHIELD ---
            // Protects the full visual apparition from being interrupted or spammed.
            // Maintained at 9000ms to guarantee safety post-coalescence (8.5s).
            const shield = document.createElement('div');
            shield.id = 'intro-physical-shield';
            shield.className = 'fixed inset-0 z-[9999]';
            document.body.appendChild(shield);
            setTimeout(() => {
                if (document.body.contains(shield)) shield.remove();
            }, 9000);
            // --- END VIRTUAL WORKBENCH ---

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
                
                // --- VIRTUAL WORKBENCH: THE POINTER SHIELD ---
                let isFirstModalLocked = (this.gameState.player.introStep === 0);
                
                if (isFirstModalLocked) {
                    button.style.pointerEvents = 'none'; // Prevent iOS from targeting it during animation
                    setTimeout(() => {
                        if (document.body.contains(button)) {
                            isFirstModalLocked = false;
                            button.style.pointerEvents = 'auto';
                        }
                    }, 9000); 
                }
                // --- END VIRTUAL WORKBENCH ---

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

        // Recursive Callback:
        // When the modal closes, increment step and queue the next one.
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
                
                // Doubled size and dynamic duration for transition text
                this.uiManager.createFloatingText(
                    `<span style="font-size: 200%; text-shadow: 0 0 10px #34d399;">+${formatCredits(25000, false)}</span>`, 
                    event.clientX, 
                    event.clientY, 
                    '#34d399', 
                    3950, 
                    true
                );
                
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + 25000);

                // --- RECORD LOAN TO LOG ---
                this.gameState.player.financeLog.push({
                    day: this.gameState.day,
                    type: 'loan',
                    amount: 25000,
                    balance: this.gameState.player.credits,
                    description: 'Merchant Guild Start-up Loan'
                });

                this.logger.info.player(this.gameState.day, 'CREDITS_TRANSFER', 'Accepted loan transfer of ⌬25,000');

                // Extended black screen timing logic for income text persist
                setTimeout(() => {
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

        // 1. Retain the Anchor
        const quitText = document.createElement('div');
        quitText.id = 'quit-job-text';
        quitText.className = 'fixed font-orbitron font-bold text-white text-[21px] z-[100] tracking-widest pointer-events-none text-center quit-job-pulse';
        quitText.style.top = '10vh';
        quitText.style.left = '50%';
        quitText.innerHTML = 'QUIT YOUR JOB!';
        document.body.appendChild(quitText);

        // 2. Build the Container
        const overlay = document.createElement('div');
        overlay.className = 'sev-term-overlay';
        
        const panel = document.createElement('div');
        panel.className = 'sev-term-panel opacity-0'; // Will be faded in by CRT Turn On

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

        // Warning wrapper physically guarantees layout height underneath button
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

        // D. Modal opens with reverse CRT effect
        panel.classList.add('sev-crt-turn-on');

        let currentPhase = 0;

        // E. CRT Turn On (1.3s), then Typewriter company name (1.5s)
        setTimeout(() => {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'font-orbitron text-[22px] text-[#d97706] text-center tracking-[0.2em] uppercase mb-8 pb-3 border-b border-current opacity-80 font-bold';
            const headerSpan = document.createElement('span');
            headerDiv.appendChild(headerSpan);
            textContainer.appendChild(headerDiv);

            const textToType = "Belt Delta Mining Co.";
            let charIndex = 0;
            const typeInterval = 1500 / textToType.length; // ~71ms
            const typer = setInterval(() => {
                headerSpan.textContent += textToType[charIndex];
                charIndex++;
                if (charIndex >= textToType.length) clearInterval(typer);
            }, typeInterval);

            // Start line rendering after typewriter
            setTimeout(() => {
                const terminalLines = [
                    `<div id="secure-link-line" class='font-roboto-mono mb-8 font-bold tracking-widest text-[13px] text-center opacity-90'>SECURE TERMINAL LINK ESTABLISHED</div>`,
                    `<div class='font-roboto-mono flex justify-between py-3 border-b border-current border-opacity-30 text-[15px]'><span class='opacity-70'>[ EMPLOYEE ID ]</span><span class='text-[#cffafe] font-bold'>${this.gameState.player.name}</span></div>`,
                    `<div class='font-roboto-mono flex justify-between py-3 border-b border-current border-opacity-30 text-[15px]'><span class='opacity-70'>[ PACKAGES ROUTED ]</span><span class='text-[#cffafe]'>1,932,320</span></div>`,
                    `<div class='font-roboto-mono flex justify-between py-3 border-b border-current border-opacity-30 text-[15px]'><span class='opacity-70'>[ CYCLES LOGGED ]</span><span class='text-[#cffafe]'>2,849</span></div>`
                ];

                const timings = [0, 4000, 5800, 7600]; // 4s pause, 1.8s delays

                terminalLines.forEach((line, i) => {
                    const lineDiv = document.createElement('div');
                    lineDiv.className = 'sev-type-line';
                    lineDiv.innerHTML = line;
                    textContainer.appendChild(lineDiv);

                    setTimeout(() => {
                        lineDiv.classList.add('sev-line-visible');
                        
                        if (i === 0) {
                            const linkEl = document.getElementById('secure-link-line');
                            if (linkEl) linkEl.classList.add('sev-rhythmic-pulse');
                        }
                        
                        if (i === 3) {
                            setTimeout(() => {
                                currentPhase = 1;
                                actuatorBtn.classList.remove('pointer-events-none');
                                actuatorBtn.style.animation = 'sevBtnFadeIn 1.5s ease-out forwards';
                            }, 1800); // Wait 1.8s after 4th line drops
                        }
                    }, timings[i]);
                });
            }, 1500); // 1.5s typewriter duration
        }, 1300); // 1.3s CRT turn on duration

        // 5. Actuation and Closure Logic
        actuatorBtn.onclick = (e) => {
            if (this._transitioning) return;

            if (currentPhase === 1) {
                currentPhase = 2;
                actuatorBtn.classList.add('confirm-phase');
                
                // Warning text strictly appears only at confirmation phase
                warningMsg.classList.remove('opacity-0');
                warningMsg.classList.add('animate-pulse');
                
                btnText.innerHTML = 'CONFIRM?';
            } else if (currentPhase === 2) {
                currentPhase = 3;
                this._transitioning = true;
                actuatorBtn.style.pointerEvents = 'none';
                btnText.innerHTML = 'EXECUTING...';
                
                // C. Smoothly fade away "QUIT YOUR JOB!"
                if (quitText) {
                    quitText.style.animation = 'quitJobFadeOut 0.6s ease-out forwards';
                }

                // Remove CRT Turn On and force reflow to prevent animation conflict
                panel.classList.remove('sev-crt-turn-on');
                void panel.offsetWidth;
                panel.classList.add('sev-crt-shutdown');

                // 6. Post-Closure Cinematic Handoff
                setTimeout(() => {
                    panel.remove();

                    const finalSpan = document.createElement('span');
                    finalSpan.className = 'text-[#f97316] font-orbitron text-xl tracking-widest text-center px-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]';
                    finalSpan.style.animation = 'sevLineFade 1s ease-out forwards';
                    finalSpan.innerHTML = '> PENSION FORFEITED. TERMINATION COMPLETE <';
                    overlay.appendChild(finalSpan);

                    setTimeout(() => {
                        // Blur fade the text out into the void
                        overlay.style.transition = 'all 3s ease-out';
                        overlay.style.opacity = '0';
                        overlay.style.filter = 'blur(12px)';

                        setTimeout(() => {
                            // D. 0.5-second screen fade to black bridging to Mars sequence
                            const fader = document.createElement('div');
                            fader.className = 'fixed inset-0 bg-black z-[150]';
                            fader.style.opacity = '0';
                            fader.style.transition = 'opacity 0.5s ease-in-out';
                            document.body.appendChild(fader);
                            
                            // Force reflow
                            void fader.offsetWidth;
                            fader.style.opacity = '1';

                            setTimeout(() => {
                                overlay.remove();
                                if (quitText && quitText.parentNode) quitText.remove();
                                
                                this._triggerMarsTravelSequence(fader);
                            }, 500); // Wait 0.5s for black screen
                            
                        }, 3000); // Wait 3s for text blur fade
                    }, 3000); // 3s persistence time before fading text
                }, 1300); // Wait 1.3s for CRT shutdown
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
        // Unhide the game container so the injected elements have the proper backdrop
        this.uiManager.showGameContainer();
        
        starfieldService.mount();
        starfieldService.triggerEntry();
        // Force fast travel speed immediately after the entry tries to idle it
        setTimeout(() => starfieldService.setEngageWarp(), 50);
        
        const overlay = document.createElement('div');
        overlay.id = 'mars-travel-overlay';
        overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center pointer-events-none';
        overlay.innerHTML = `<span class='text-white font-orbitron text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] text-center px-4'>Traveling to the Martian Shipyards...</span>`;
        document.body.appendChild(overlay);

        // 1. Fade IN from black over 2s
        fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).onfinish = () => {
            
            // 2. Hold for 2s
            setTimeout(() => {
                
                // 3. Fade OUT to black over 2s
                fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).onfinish = () => {
                    overlay.remove();
                    starfieldService.triggerQuickExit();
                    
                    // Instead of fading out the black screen here, we keep it persistent
                    // We set z-index to 10000. This perfectly sandwiches the fader underneath
                    // the Help Modals (z-index: 10001) but above ALL game UI elements.
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
            setTimeout(() => {
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

        // [FIX] Force inline display: none to override CSS ID specificity
        const econBtn = document.getElementById('btn-econ-weather');
        if (econBtn) econBtn.style.display = 'none';

        // Restore Help Anchor visibility specifically for the selection sequence
        if (this.uiManager.helpManager && this.uiManager.helpManager.anchorBtn) {
            this.uiManager.helpManager.anchorBtn.style.display = 'flex';
        }
        
        // --- INJECT HIGH-FIDELITY STARFIELD ---
        starfieldService.mount();
        starfieldService.triggerEntry();

        const overlay = document.createElement('div');
        overlay.id = 'starter-ship-selection-overlay';
        
        // Lowered to z-[40] to allow the Ship Detail Modal and Help Modal (z-50+) to stack above cleanly
        // Background set to completely transparent so the starfield shines through beautifully
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
            
            // Resolve Fallbacks dynamically via AssetService to prevent hardcoded missing variants
            let imgSrc = AssetService.getFallbackImage(shipInfo.id) || AssetService.getShipImage(shipInfo.id, 0);
            
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

        // --- REVEAL FROM BLACK ---
        // Fades the persistent black fader screen out, revealing the starfield and UI below it.
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

        // Hide tutorial modal button ' ( ? ) ' after ship selection screen is concluded.
        if (this.uiManager.helpManager && this.uiManager.helpManager.anchorBtn) {
            this.uiManager.helpManager.anchorBtn.style.display = 'none';
        }

        const overlay = document.getElementById('starter-ship-selection-overlay');
        
        // Hide the detail modal immediately
        this.uiManager.hideModal('ship-detail-modal');

        // Render dynamic purchase deduction text
        this.uiManager.createFloatingText(
            `<span style="font-size: 200%; font-weight: bold; text-shadow: 0 0 10px #ef4444;">-25k</span>`,
            window.innerWidth / 2,
            window.innerHeight / 2,
            '#ef4444',
            2000,
            true
        );

        // Create the blackout shield for transitions
        const fader = document.createElement('div');
        fader.className = 'fixed inset-0 bg-black z-[150]'; // Acts as a physical click shield
        fader.style.opacity = '0';
        document.body.appendChild(fader);

        // 1. Fade OUT the Ship Selection UI to pure black over 2s
        await fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).finished;

        if (overlay) overlay.style.display = 'none';

        // 2. Setup Subtle Starfield & Cinematic Text
        starfieldService.mount();
        starfieldService.triggerEntry(); 
        // Note: triggerEntry automatically sets idleWarp (subtle movement)

        const textOverlay = document.createElement('div');
        textOverlay.className = 'fixed inset-0 z-[100] flex items-center justify-center pointer-events-none';
        textOverlay.innerHTML = `<span class='text-white font-orbitron text-xl tracking-widest text-center px-4'>Months later...<br><br><br>Flight School is complete.</span>`;
        document.body.appendChild(textOverlay);

        // Mutate Player State quietly behind the blackout
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

        // Suppress visual jarring when the game container is booted
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.transition = 'none';
            gameContainer.style.opacity = '0';
        }

        // 3. Fade IN from black over 2s to reveal subtle starfield and text
        await fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).finished;

        // 4. Hold visual on Flight School for 4s
        await new Promise(res => setTimeout(res, 4000));

        // 5. Fade OUT to black over 2s
        await fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).finished;

        // Clean up cinematic elements
        textOverlay.remove();
        starfieldService.triggerQuickExit();
        if (overlay) overlay.remove();

        // Boot the core game loop, generating the UI layout invisibly
        this._end();

        // Reveal the fully rendered game behind the blackout
        if (gameContainer) gameContainer.style.opacity = '';

        // 6. Fade IN the Game UI from black over 2s
        await fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).finished;

        fader.remove();
        if (gameContainer) gameContainer.style.transition = '';
    }

    /**
     * Finalizes the intro sequence and transitions control to the core render loop.
     * @private
     */
    _end() {
        this.gameState.introSequenceActive = false;
        this._transitioning = false;
        
        this.logger.info.state(this.gameState.day, 'INTRO_END', 'Introduction sequence complete. Booting to Missions.');
        
        // Restore Economic Weather button visibility via inline styles
        const econBtn = document.getElementById('btn-econ-weather');
        if (econBtn) econBtn.style.display = '';

        // --- VIRTUAL WORKBENCH: Restore Pause Menu Cog after Intro ---
        const cogBtn = document.getElementById('btn-game-menu');
        if (cogBtn) cogBtn.style.display = '';
        // --- END VIRTUAL WORKBENCH ---

        // Default the Hangar screen to "Hangar" so they see their newly purchased ship immediately
        this.gameState.uiState.hangarShipyardToggleState = 'hangar';

        // Reveal the main layout
        this.uiManager.showGameContainer();
        
        // Set context to the Missions screen
        this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
        
        // Force the master render cycle to execute, naturally triggering the Help Modal
        this.uiManager.render(this.gameState.getState());
    }
}