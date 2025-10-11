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
        this.simulationService = simulationServiceFacade; // Renamed to avoid confusion
    }

    /**
     * Kicks off the interactive new game introduction sequence.
     */
    start() {
        if (!this.gameState.introSequenceActive) return;
        this.logger.info.state(this.gameState.day, 'INTRO_START', 'Starting new game introduction sequence.');
        // Set the initial state for the intro: No ship, ready for the tutorial purchase.
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};
        this.gameState.player.introStep = 0;
        this._showNextModal();
    }

    /**
     * Handles all delegated click events during the intro sequence to manage its flow.
     * @param {Event} e - The click event object.
     */
    handleIntroClick(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const targetId = button.id;
        
        if (targetId === 'intro-next-btn') {
            button.disabled = true;
            this._showNextModal();
        } else if (targetId === 'intro-submit-btn') {
            button.disabled = true;
            const input = document.getElementById('signature-input');
            const playerName = input.value.trim();
            const sanitizedPlayerName = playerName.replace(/[^a-zA-Z0-9 ]/g, '');
    
            if (!sanitizedPlayerName || sanitizedPlayerName.length === 0) {
                this.uiManager.queueModal('event-modal', 'Invalid Signature', "The Merchant's Guild requires a valid name on the contract. Please provide your legal mark.", () => {
                    // This callback runs after the "Invalid Signature" modal is closed.
                    // We need to re-show the signature modal without advancing the step.
                    this.gameState.player.introStep--; // Decrement to counteract the increment in _showNextModal
                    this._showNextModal();
                });
            } else {
                this.gameState.player.name = sanitizedPlayerName;
                this.gameState.player.debt = 25000;
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.monthlyInterestAmount = 390;
    
                this.logger.info.state(this.gameState.day, 'LOAN_ACCEPTED', `Player ${sanitizedPlayerName} accepted Guild loan.`, {
                    debt: 25000,
                    name: sanitizedPlayerName
                });
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
            options.customSetup = (modal, closeHandler) => { this._setupInteractiveModal(modal, step, closeHandler); };
            if (step.id === 'signature') {
                options.specialClass = 'keyboard-ignore';
            }
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
                    e.target.disabled = true;
                    closeHandler();
                };
                btnContainer.appendChild(button);
            };
        }

        this.uiManager.queueModal(modalId, step.title, step.description, () => this.gameState.player.introStep++, options);
    }

    /**
     * Performs custom setup for interactive modals in the intro.
     * @param {HTMLElement} modal
     * @param {object} step
     * @param {function} closeHandler
     * @private
     */
    _setupInteractiveModal(modal, step, closeHandler) {
        const buttonContainer = modal.querySelector(`#${step.id}-button-container`);
        buttonContainer.innerHTML = '';
        const button = document.createElement('button');
        button.className = 'btn px-6 py-2';
        button.innerHTML = step.buttonText;
        button.onclick = (e) => {
            e.target.disabled = true;
            closeHandler();
        };
        buttonContainer.appendChild(button);

        if (step.id === 'signature') {
            const input = modal.querySelector('#signature-input');
            input.value = '';
            button.id = 'intro-submit-btn';
            button.disabled = true;
            
            button.onclick = closeHandler;

            input.oninput = () => {
                button.disabled = input.value.trim() === '';
            };
        } else {
            button.id = 'intro-next-btn';
        }
    }

    /**
     * Manages the animated sequence for loan processing.
     * @private
     */
    _startProcessingSequence() {
        const showApprovalModal = () => {
            const title = 'Loan Approved';
            const description = `Dear ${this.gameState.player.name},<br><br>Your line of credit has been <b>approved</b>.<br><br><span class="credits-text-pulsing">⌬ 25,000</span> is ready to transfer to your account.`;
            const hangarTransition = (event) => {
                const button = event.target;
                if(button) button.disabled = true;
                
                this.uiManager.createFloatingText(`+${formatCredits(25000, false)}`, event.clientX, event.clientY, '#34d399');
                
                this.gameState.player.credits += 25000;
                this.logger.info.player(this.gameState.day, 'CREDITS_TRANSFER', 'Accepted loan transfer of ⌬25,000');

                setTimeout(() => {
                    this.uiManager.showGameContainer();
                    this.uiManager.render(this.gameState.getState());
                    this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
                    this.simulationService.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_HANGAR' });
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