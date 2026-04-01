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
            // --- VIRTUAL WORKBENCH: IMMEDIATE UI LOCK ---
            this._transitioning = true;
            button.disabled = true;
            // --- END VIRTUAL WORKBENCH ---

            const input = document.getElementById('signature-input');
            const playerName = input.value.trim();
            
            // --- VIRTUAL WORKBENCH: STRICT SANITIZATION ---
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
            // --- END VIRTUAL WORKBENCH ---
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
            options.specialClass = 'intro-fade-in intro-backdrop-clear';
            starfieldService.mount();
            starfieldService.triggerEntry();
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
                
                // FIX: Support space-separated classes without throwing InvalidCharacterError
                if(step.buttonClass) button.classList.add(...step.buttonClass.split(' ').filter(Boolean));
                
                button.id = 'intro-next-btn';
                button.innerHTML = step.buttonText;
                
                button.onclick = (e) => {
                    if (this._transitioning) { 
                        e.preventDefault(); 
                        return;
                    }
                    this._transitioning = true; 
                    e.target.disabled = true;   
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
            if (this._transitioning) {
                if (e) e.preventDefault();
                return;
            }
            this._transitioning = true;
            if (e && e.target) e.target.disabled = true;
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

            const title = 'Loan Approved';
            const description = `Dear ${this.gameState.player.name},<br><br>Your line of credit has been <b>approved</b>.<br><br><span class="credits-text-pulsing">⌬ 25,000</span> is ready to transfer to your account.`;
            
            const hangarTransition = (event) => {
                this._transitioning = true;
                if(event && event.target) event.target.disabled = true;
                
                this.uiManager.createFloatingText(`+${formatCredits(25000, false)}`, event.clientX, event.clientY, '#34d399');
                
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

                setTimeout(() => {
                    this._showResignationModal();
                }, 2000);
            };

            this.uiManager.queueModal('event-modal', title, description, null, {
                contentClass: 'text-center',
                customSetup: (modal, closeHandler) => {
                    modal.querySelector('.modal-content').classList.add('modal-theme-admin');
     
                    const btnContainer = modal.querySelector('#event-button-container');
                    btnContainer.innerHTML = '';
                    const button = document.createElement('button');
                    button.className = 'btn px-6 py-2';
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
        
        const descriptionHTML = `
            <div class="mb-4 text-center text-gray-500 font-bold tracking-widest text-sm uppercase">Secure Terminal Link Established</div>
            <div class="mb-6 text-green-500 text-left w-full mx-auto bg-black p-5 border border-green-900/30 rounded-sm shadow-[inset_0_0_20px_rgba(0,0,0,1)] font-roboto-mono text-sm">
                <p class="mb-4 text-green-600 border-b border-green-900/50 pb-2 uppercase tracking-widest">>>> Employment Record: ${this.gameState.player.name}</p>
                <p class="mb-2">> Packages Routed..... <span class="text-green-400">1,932,320</span></p>
                <p class="mb-2">> Cycles Logged....... <span class="text-green-400">2,849</span></p>
                <p class="mt-4 text-xs text-green-700 animate-pulse">> AWAITING INPUT...</p>
            </div>
            <div id="resignation-warning-container" class="min-h-[28px] mb-4"></div>
        `;
        
        this.uiManager.queueModal('event-modal', '<span class="text-[23px]">Asteroid Belt Mining Conglomerate Delta Co.</span>', descriptionHTML, null, {
            contentClass: 'modal-theme-drab-gray text-center font-roboto-mono',
            customSetup: (modal, closeHandler) => {
                const quitText = document.createElement('div');
                quitText.id = 'quit-job-text';
                quitText.className = 'fixed font-orbitron font-bold text-white text-3xl z-[100] tracking-widest pointer-events-none text-center quit-job-pulse';
                quitText.style.top = '10vh';
                quitText.style.left = '50%';
                quitText.innerHTML = 'QUIT YOUR JOB!';
                document.body.appendChild(quitText);

                const btnContainer = modal.querySelector('#event-button-container');
                if (btnContainer) {
                    btnContainer.innerHTML = '';
                    const button = document.createElement('button');
                    button.className = 'btn px-6 py-2 bg-orange-700 hover:bg-orange-600 text-white border-orange-500';
                    button.innerHTML = 'TERMINATE CONTRACT';
                    
                    let isConfirming = false;

                    button.onclick = (e) => {
                        if (this._transitioning) return;
                        
                        if (!isConfirming) {
                            isConfirming = true;
                            button.innerHTML = 'CONFIRM TERMINATION';
                            button.classList.remove('bg-orange-700', 'hover:bg-orange-600', 'border-orange-500');
                            button.classList.add('bg-red-900', 'hover:bg-red-800', 'border-red-600', 'text-white');
                            
                            const warningContainer = modal.querySelector('#resignation-warning-container');
                            if (warningContainer) {
                                warningContainer.innerHTML = "<span class='text-orange-500 font-bold text-lg drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]'>CONFIRM FORFEITURE OF PENSION: ⌬ 14 ?</span>";
                            }
                        } else {
                            this._transitioning = true;
                            button.disabled = true;
                            
                            const existingQuitText = document.getElementById('quit-job-text');
                            if (existingQuitText) existingQuitText.remove();
                            
                            // Fade to black over 2 seconds
                            const fader = document.createElement('div');
                            fader.className = 'fixed inset-0 bg-black z-[150]'; // Physical click shield
                            fader.style.opacity = '0';
                            document.body.appendChild(fader);
                            
                            fader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' }).onfinish = () => {
                                closeHandler();
                                this._triggerMarsTravelSequence(fader);
                            };
                        }
                    };
                    
                    btnContainer.appendChild(button);
                }
            }
        });
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
                    
                    // 4. Fade back out of black to reveal meta tutorials
                    fader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, fill: 'forwards' }).onfinish = () => {
                        fader.remove();
                    };
                    
                    this._transitioning = false;
                    this._showMetaHelpModals();
                };

            }, 2000); 
        };
    }

    /**
     * Executes the sequential meta help modals before allowing the UI to render.
     * @private
     */
    _showMetaHelpModals() {
        this.uiManager.showGameContainer();

        this.uiManager.showHelpModal('meta-tutorial', 0, () => {
            setTimeout(() => {
                this.uiManager.showHelpModal('meta-autosave', 0, () => {
                    this._showStarterShipSelection();
                });
            }, 1000);
        });
    }

    /**
     * Generates and displays the bespoke starter ship selection screen dynamically over the game UI.
     * @public - Accessible by DebugService
     */
    _showStarterShipSelection() {
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
        
        // Use a translucent radial gradient overlay so the starfield canvas shines through
        overlay.className = 'fixed inset-0 z-[50] flex flex-col items-center justify-center';
        overlay.style.background = 'radial-gradient(circle, rgba(12, 16, 29, 0.7) 0%, rgba(0, 0, 0, 0.95) 100%)';
        
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
    }

    /**
     * Handles the intercepted purchase action from the starter ship selection modal.
     * Orchestrates the final Flight School cinematic block and state initialization.
     * @param {string} shipId 
     */
    async handleStarterPurchase(shipId) {
        if (this._transitioning) return;
        this._transitioning = true;

        const overlay = document.getElementById('starter-ship-selection-overlay');
        
        // Hide the detail modal immediately
        this.uiManager.hideModal('ship-detail-modal');

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