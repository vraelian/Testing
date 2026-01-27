// js/services/game/IntroService.js
/**
 * @fileoverview Manages the new game introduction sequence, from the initial
 * lore modals to the final tutorial kickoff.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { NAV_IDS, SCREEN_IDS, SHIP_IDS } from '../../data/constants.js';

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
        
        // Set the initial state for the intro
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
     * Continues the intro sequence after a tutorial batch is completed.
     * @param {string} completedBatchId - The ID of the tutorial batch that just finished.
     */
    continueAfterTutorial(completedBatchId) {
        if (completedBatchId === 'intro_hangar') {
            this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.FINANCE);
            this.simulationService.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_FINANCE' });
        } else if (completedBatchId === 'intro_finance') {
             this._end();
        }
    }

    /**
     * Displays the next modal in the introduction sequence.
     * @private
     */
    _showNextModal() {
        const step = DB.INTRO_SEQUENCE_V1.modals[this.gameState.player.introStep];
        if (!step) {
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
            
            // Note: The click logic for this button is handled in handleIntroClick
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
     * Manages the animated sequence for loan processing.
     * @private
     */
    _startProcessingSequence() {
        const showApprovalModal = () => {
            // [FIX] UNLOCK HERE: The processing animation is done. 
            // We must release the lock so the "Accept Transfer" button works.
            this._transitioning = false;

            const title = 'Loan Approved';
            const description = `Dear ${this.gameState.player.name},<br><br>Your line of credit has been <b>approved</b>.<br><br><span class="credits-text-pulsing">⌬ 25,000</span> is ready to transfer to your account.`;
            
            const hangarTransition = (event) => {
                this._transitioning = true;
                if(event && event.target) event.target.disabled = true;
                
                this.uiManager.createFloatingText(`+${formatCredits(25000, false)}`, event.clientX, event.clientY, '#34d399');
                
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + 25000);

                this.logger.info.player(this.gameState.day, 'CREDITS_TRANSFER', 'Accepted loan transfer of ⌬25,000');

                setTimeout(() => {
                    this.uiManager.showGameContainer();
                    
                    this.simulationService.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_HANGAR' });
                    
                    this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
                    
                    this._transitioning = false; 
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
     * Finalizes the intro sequence.
     * @private
     */
    _end() {
        this.gameState.introSequenceActive = false;
        this._transitioning = false;
        
        this.logger.info.state(this.gameState.day, 'INTRO_END', 'Introduction sequence complete.');
        const finalStep = DB.INTRO_SEQUENCE_V1.modals.find(s => s.id === 'final');
        const shipName = DB.SHIPS[this.gameState.player.activeShipId].name;
        const buttonText = finalStep.buttonText.replace('{shipName}', shipName);
    
        this.gameState.tutorials.navLock = { navId: NAV_IDS.DATA, screenId: SCREEN_IDS.FINANCE };
    
        this.uiManager.queueModal('event-modal', finalStep.title, finalStep.description, () => {
             this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
             this.simulationService.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_MISSIONS' });
        }, { buttonText: buttonText });
        
        this.uiManager.render(this.gameState.getState());
    }
}