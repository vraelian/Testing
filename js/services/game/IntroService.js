// js/services/game/IntroService.js
/**
 * @fileoverview Manages the new game introduction sequence, from the initial
 * lore modals to the final tutorial kickoff.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js';
import { playBlockingAnimation } from '../ui/AnimationService.js';

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
        
        // Set the initial state for the intro (strips debug/default items)
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};
        this.gameState.player.introStep = 0;
        
        this._transitioning = false; 
        this._showNextModal();
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
            const input = document.getElementById('signature-input');
            const playerName = input.value.trim();
            const sanitizedPlayerName = playerName.replace(/[^a-zA-Z0-9 ]/g, '');
    
            if (!sanitizedPlayerName || sanitizedPlayerName.length === 0) {
                this.uiManager.queueModal('event-modal', 'Invalid Signature', "The Merchant's Guild requires a valid name on the contract. Please provide your legal mark.", () => {
                    this._showNextModal();
                });
            } else {
                this._transitioning = true;
                button.disabled = true;

                this.gameState.player.name = sanitizedPlayerName;
                this.gameState.player.debt = 25000;
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.monthlyInterestAmount = 390;
    
                this.logger.info.state(this.gameState.day, 'LOAN_ACCEPTED', `Player ${sanitizedPlayerName} accepted Guild loan.`);
                
                // Explicitly close the signature modal to clear the stage
                this.uiManager.hideModal('signature-modal');

                this._startProcessingSequence();
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
     * @private
     */
    _showStarterShipSelection() {
        this.uiManager.showGameContainer();
        
        const overlay = document.createElement('div');
        overlay.id = 'starter-ship-selection-overlay';
        overlay.className = 'intro-starfield-bg';
        
        const starterShips = [
            {
                id: 'Wanderer.Ship',
                roleClass: 'text-sky-400',
                borderClass: 'border-pulse-explorer',
                desc: 'A larger fuel tank means more trips before refilling.'
            },
            {
                id: 'Nomad.Ship',
                roleClass: 'text-emerald-400',
                borderClass: 'border-pulse-balanced',
                desc: 'Sturdy and resilient against wear and tear.'
            },
            {
                id: 'Mule.Ship',
                roleClass: 'text-amber-400',
                borderClass: 'border-pulse-hauler',
                desc: 'At the cost of range, carry just a little more.'
            }
        ];

        const container = document.createElement('div');
        container.className = 'starter-selection-container';

        starterShips.forEach(shipInfo => {
            const shipStatic = DB.SHIPS[shipInfo.id];
            const btn = document.createElement('button');
            btn.className = `starter-thumbnail-btn ${shipInfo.borderClass}`;
            btn.type = 'button';
            
            // Map the specific asset strings for the initial button generation, failing over to the generic getter.
            let imgSrc = AssetService.getShipImage(shipInfo.id, this.gameState.player.visualSeed);
            if (shipInfo.id === 'Wanderer.Ship') imgSrc = 'assets/ships/Wanderer_F.png';
            if (shipInfo.id === 'Mule.Ship') imgSrc = 'assets/ships/Mule_H.png';
            if (shipInfo.id === 'Nomad.Ship') imgSrc = 'assets/ships/Nomad_A.png';
            
            btn.innerHTML = `
                <img src="${imgSrc}" alt="${shipStatic.name}" />
                <span class="ship-name">${shipStatic.name}</span>
                <span class="ship-role ${shipInfo.roleClass}">${shipStatic.role}</span>
                <span class="ship-desc ${shipInfo.roleClass}">${shipInfo.desc}</span>
            `;
            
            btn.onclick = (e) => {
                e.preventDefault();
                this.uiManager.showShipDetailModal(this.gameState, shipInfo.id, 'intro_shipyard');
            };
            
            container.appendChild(btn);
        });

        const narrativeBox = document.createElement('div');
        narrativeBox.className = 'starter-narrative-box';
        narrativeBox.innerHTML = "Now that you've got some credits, it's time to purchase your first ship. Make your selection carefully to begin your journey.";

        overlay.appendChild(container);
        overlay.appendChild(narrativeBox);

        document.body.appendChild(overlay);
    }

    /**
     * Handles the intercepted purchase action from the starter ship selection modal.
     * Triggers the animation, mutates state, and finalizes the intro.
     * @param {string} shipId 
     */
    async handleStarterPurchase(shipId) {
        if (this._transitioning) return;
        this._transitioning = true;

        const modal = document.getElementById('ship-detail-modal');
        const modalContent = modal ? modal.querySelector('.modal-content') : null;

        if (modalContent) {
            // Disable all buttons in modal to prevent double clicks during animation
            modalContent.querySelectorAll('button').forEach(btn => btn.disabled = true);
            await playBlockingAnimation(modalContent, 'is-dematerializing');
        }

        // Execute actual purchase state mutations (deducts 25k, gives ship)
        this.simulationService.playerActionService.executeBuyShip(shipId);

        // Clean up UI - Remove the custom full-screen overlay
        const overlay = document.getElementById('starter-ship-selection-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Hide and reset the standard ship detail modal
        this.uiManager.hideModal('ship-detail-modal');

        // Boot the core game loop
        this._end();
    }

    /**
     * Finalizes the intro sequence and transitions control to the core render loop.
     * @private
     */
    _end() {
        // Drop the hard UI lock
        this.gameState.introSequenceActive = false;
        this._transitioning = false;
        
        this.logger.info.state(this.gameState.day, 'INTRO_END', 'Introduction sequence complete. Booting to Hangar.');
        
        // Default the Hangar screen to "Hangar" so they see their newly purchased ship immediately
        this.gameState.uiState.hangarShipyardToggleState = 'hangar';

        // Reveal the main layout (safe to call again to ensure layout calcs)
        this.uiManager.showGameContainer();
        
        // Set context to the Hangar/Shipyard screen
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
        
        // Force the master render cycle to execute, naturally triggering the Help Modal
        this.uiManager.render(this.gameState.getState());
    }
}