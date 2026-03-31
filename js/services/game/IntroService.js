// js/services/game/IntroService.js
/**
 * @fileoverview Manages the new game introduction sequence, from the initial
 * lore modals to the final tutorial kickoff.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js';

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

                this._startProcessingSequence();
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
            options.specialClass = 'intro-fade-in';
        }

        let modalId = 'event-modal';

        if (step.id === 'charter' || step.id === 'signature') {
            modalId = `${step.id}-modal`;
            options.customSetup = (modal, closeHandler) => { this._setupInteractiveModal(modal, step, closeHandler) };
        } else {
            options.customSetup = (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                if (!btnContainer) return;
                btnContainer.innerHTML = '';

                const button = document.createElement('button');
                button.className = 'btn px-6 py-2';
                if(step.buttonClass) button.classList.add(step.buttonClass);
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
        button.className = 'btn px-6 py-2';
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

                // Route through the meta help modals instead of immediately ending
                setTimeout(() => {
                    this._showMetaHelpModals();
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
     * Executes the sequential meta help modals before allowing the UI to render.
     * @private
     */
    _showMetaHelpModals() {
        // Unhide the game container so the injected Help Modals become visible.
        // Because introSequenceActive is still true, the game UI will not render yet, keeping the background blank.
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
        
        const overlay = document.createElement('div');
        overlay.id = 'starter-ship-selection-overlay';
        overlay.className = 'intro-starfield-bg';
        
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
     * Triggers the 6-second cinematic transition, mutates state, and finalizes the intro.
     * @param {string} shipId 
     */
    async handleStarterPurchase(shipId) {
        if (this._transitioning) return;
        this._transitioning = true;

        const overlay = document.getElementById('starter-ship-selection-overlay');
        const starterContainer = overlay ? overlay.querySelector('.starter-selection-container') : null;
        const narrativeBox = overlay ? overlay.querySelector('.starter-narrative-box') : null;

        // [Phase 1: 0-2s]
        // Immediately dismiss the detail modal so it doesn't flash or complicate the blur stack
        this.uiManager.hideModal('ship-detail-modal');

        // Blur-fade out the underlying UI elements
        if (starterContainer) starterContainer.classList.add('blur-fade-out');
        if (narrativeBox) narrativeBox.classList.add('blur-fade-out');
        
        // Wait 2 seconds for UI to visually dissolve into the background starfield
        await new Promise(res => setTimeout(res, 2000));
        
        // [Phase 2: 2-4s] Starfield Hold 
        // Mechanically hide elements while holding the view on just the starfield
        if (starterContainer) starterContainer.style.display = 'none';
        if (narrativeBox) narrativeBox.style.display = 'none';

        // Mutate State during the blackout window
        const shipStatic = DB.SHIPS[shipId];
        this.gameState.player.credits -= 25000; // Deduct exactly the loan amount
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

        // Prepare the Game UI Container before calling _end() so it does not instantly appear
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            // Suppress the native background/opacity transitions temporarily
            gameContainer.style.transition = 'none';
            gameContainer.style.opacity = '0';
            gameContainer.style.filter = 'blur(10px)';
        }

        // Boot the core game loop, generating the UI layout invisibly
        this._end();

        // Hold for the remaining 2 seconds of the Starfield scene
        await new Promise(res => setTimeout(res, 2000));

        // [Phase 3: 4-6s] Crossfade
        if (overlay) {
            overlay.style.pointerEvents = 'none';
            // Use Web Animations API so UIManager's class wiping doesn't interrupt it
            overlay.animate([
                { opacity: 1, filter: 'blur(0px)' },
                { opacity: 0, filter: 'blur(10px)' }
            ], { duration: 2000, easing: 'ease-in-out', fill: 'forwards' });
        }
        
        if (gameContainer) {
            // Strip the inline overrides so it targets its true default state (Opacity 1)
            gameContainer.style.opacity = '';
            gameContainer.style.filter = '';
            
            // Execute animation independently of CSS classes
            gameContainer.animate([
                { opacity: 0, filter: 'blur(10px)' },
                { opacity: 1, filter: 'blur(0px)' }
            ], { duration: 2000, easing: 'ease-in-out' });
            
            // Final cleanup after crossfade completes
            setTimeout(() => {
                gameContainer.style.transition = ''; // Restore CSS transitions
                if (overlay) overlay.remove();
            }, 2000);
        }
    }

    /**
     * Finalizes the intro sequence and transitions control to the core render loop.
     * @private
     */
    _end() {
        // Drop the hard UI lock
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