// js/services/handlers/ActionClickHandler.js
/**
 * @fileoverview Handles the primary routing of 'data-action' click events,
 * delegating them to the appropriate services. This module focuses on general
 * actions like navigation, modal triggers, and simple state changes, while
 * more complex interactions are handled by other specialized handlers.
 */
import { DB } from '../../data/database.js';
import { ACTION_IDS, NAV_IDS, SCREEN_IDS, APP_FEEDBACK_URL } from '../../data/constants.js';
import { formatCredits } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js'; 
import { startLicenseAnimation, endLicenseAnimation } from '../ui/AnimationService.js';

export class ActionClickHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(gameState, simulationService, uiManager) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;

        // --- VIRTUAL WORKBENCH: Global click listener to dismiss primed buttons ---
        document.addEventListener('click', (e) => {
            const primedBtns = document.querySelectorAll('.primed, [data-primed="true"]');
            if (primedBtns.length > 0) {
                const closestTarget = e.target.closest('[data-action="take_loan"], [data-action="pay_debt"], [data-action="skip-tutorial"], [data-action="intro_buy_ship"]');
                primedBtns.forEach(btn => {
                    if (btn !== closestTarget) {
                        delete btn.dataset.primed;
                        btn.classList.remove('primed'); 
                        
                        if (btn.dataset.action === 'skip-tutorial') {
                            btn.innerHTML = '<span style="pointer-events: none;">Skip Tutorial</span>';
                        } else if (btn.dataset.action === 'intro_buy_ship') {
                            btn.innerHTML = '<span style="pointer-events: none;">Purchase</span>';
                            btn.classList.remove('btn-confirm-purchase');
                        }
                    }
                });
            }
        });

        // --- VIRTUAL WORKBENCH: Global input listener for Finance Slider ---
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'debt-slider') {
                const display = document.getElementById('debt-payment-display');
                if (display) {
                    display.innerHTML = formatCredits(-parseInt(e.target.value, 10), true);
                    
                    // Unprime the pay button if sliding to prevent accidental payment of new amount
                    const payBtn = document.querySelector('[data-action="pay_debt"].primed');
                    if (payBtn) {
                        delete payBtn.dataset.primed;
                        payBtn.classList.remove('primed');
                    }
                }
            }
        });
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Handles a delegated click event if it matches a data-action.
     * @param {Event} e The click event object.
     * @param {HTMLElement} actionTarget The DOM element with the data-action attribute.
     */
    async handle(e, actionTarget) { 
        const state = this.gameState.getState();
        if (actionTarget.hasAttribute('disabled')) return;

        const { action, ...dataset } = actionTarget.dataset;

        switch (action) {
            // --- GAME MENU (PHASE 3 & 4) ---
            case 'open-pause-menu':
                this.uiManager.eventControl.showPauseMenu();
                break;
            
            case 'close-pause-menu':
                this.uiManager.eventControl.hidePauseMenu();
                break;

            case 'open-feedback':
                window.open(APP_FEEDBACK_URL, '_blank');
                break;

            case 'manual-save': {
                e.stopPropagation();
                
                // Route through the established SimulationService pipeline
                // This guarantees exportState() serialization and safe IndexedDB/iOS Dual-Writes
                await this.simulationService.saveGame();
                
                // Mutate button to locked Gold State for immediate visual feedback
                actionTarget.className = 'btn w-full py-3 text-lg btn-gold-weighty';
                actionTarget.innerHTML = 'Progress Saved!';
                actionTarget.disabled = true;
                break;
            }

            case 'exit-game-init':
                e.stopPropagation();
                // Mutate button to locked Danger State
                actionTarget.className = 'btn w-full py-3 text-lg bg-red-800 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]';
                actionTarget.innerHTML = 'CONFIRM EXIT?';
                actionTarget.dataset.action = 'exit-game-confirm';
                break;

            case 'exit-game-confirm': {
                e.stopPropagation();
                
                // Construct the absolute blackout shield
                const fader = document.createElement('div');
                fader.className = 'fixed inset-0 bg-black z-[9999] pointer-events-none';
                fader.style.opacity = '0';
                fader.style.transition = 'opacity 1s ease-in-out';
                document.body.appendChild(fader);
                
                // Force layout reflow before opacity change
                void fader.offsetWidth;
                fader.style.opacity = '1';
                
                // Wait for the 1.0s fade to finish, set the persistent state flag, then hard reset
                setTimeout(() => {
                    sessionStorage.setItem('isRebooting', 'true');
                    window.location.reload();
                }, 1000);
                break;
            }
            // --- END GAME MENU ---

            // --- Ship Actions (Hangar/Shipyard) ---
            case ACTION_IDS.BUY_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();
                
                const target = e.target; 

                this.uiManager.showShipTransactionConfirmation(shipId, 'buy', null, async () => {
                    await this.uiManager.runShipTransactionAnimation(shipId);
                    await this.simulationService.buyShip(shipId, { target });
                });
                break;
            }
            
            // --- INTRO SEQUENCE ---
            case ACTION_IDS.INTRO_BUY_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();
                
                if (!actionTarget.dataset.primed) {
                    document.querySelectorAll('.primed, [data-primed="true"]').forEach(btn => {
                        delete btn.dataset.primed;
                        btn.classList.remove('primed');
                        
                        if (btn.dataset.action === 'skip-tutorial') {
                            btn.innerHTML = '<span style="pointer-events: none;">Skip Tutorial</span>';
                        } else if (btn.dataset.action === 'intro_buy_ship') {
                            btn.innerHTML = '<span style="pointer-events: none;">Purchase</span>';
                            btn.classList.remove('btn-confirm-purchase');
                        }
                    });

                    actionTarget.dataset.primed = "true";
                    // Apply both the logic flag and the CSS class that colors it white
                    actionTarget.classList.add('primed', 'btn-confirm-purchase');
                    actionTarget.innerHTML = '<span style="pointer-events: none;">Confirm Purchase?</span>';
                    return; 
                }

                await this.simulationService.introService.handleStarterPurchase(shipId);
                break;
            }
            
            case 'skip-tutorial': {
                e.stopPropagation();
                
                if (!actionTarget.dataset.primed) {
                    document.querySelectorAll('.primed, [data-primed="true"]').forEach(btn => {
                        delete btn.dataset.primed;
                        btn.classList.remove('primed');
                        
                        if (btn.dataset.action === 'skip-tutorial') {
                            btn.innerHTML = '<span style="pointer-events: none;">Skip Tutorial</span>';
                        } else if (btn.dataset.action === 'intro_buy_ship') {
                            btn.innerHTML = '<span style="pointer-events: none;">Purchase</span>';
                            btn.classList.remove('btn-confirm-purchase');
                        }
                    });

                    actionTarget.dataset.primed = "true";
                    actionTarget.classList.add('primed');
                    actionTarget.innerHTML = '<span style="pointer-events: none;">Confirm Skip?</span>';
                    return; 
                }

                if (this.simulationService && this.simulationService.missionService) {
                    this.simulationService.missionService.skipTutorial();
                }
                break;
            }
            // --- END INTRO SEQUENCE ---

            case ACTION_IDS.SELL_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation();

                const target = e.target;

                // Pre-validate to check for cargo forfeit warnings
                const validation = this.simulationService.playerActionService.validateSellShip(shipId);
                if (!validation.success) {
                    this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
                    return;
                }

                // Pass the optional forfeit message to the confirmation modal
                this.uiManager.showShipTransactionConfirmation(shipId, 'sell', validation.forfeitMessage, async () => {
                    await this.uiManager.runShipTransactionAnimation(shipId);
                    await this.simulationService.sellShip(shipId, { target });
                });
                break;
            }
            case ACTION_IDS.SELECT_SHIP: {
                const { shipId } = dataset;
                if (!shipId) return;
                e.stopPropagation(); 
                await this.simulationService.boardShip(shipId, e); 
                break;
            }

            // --- FLEET SERVICING ACTIONS ---
            case 'cycle-ship-left':
            case 'cycle-ship-right': {
                e.preventDefault();
                e.stopPropagation();
                
                const ownedIds = state.player.ownedShipIds;
                if (!ownedIds || ownedIds.length <= 1) return;

                let currentIndex = ownedIds.indexOf(state.player.activeShipId);
                if (currentIndex === -1) currentIndex = 0;

                if (action === 'cycle-ship-left') {
                    currentIndex = (currentIndex - 1 + ownedIds.length) % ownedIds.length;
                } else {
                    currentIndex = (currentIndex + 1) % ownedIds.length;
                }

                this.gameState.player.activeShipId = ownedIds[currentIndex];
                this.gameState.uiState.hangarActiveIndex = currentIndex;
                this.gameState.setState({});
                break;
            }

            // --- VIRTUAL WORKBENCH: SERVICES NAVIGATION ---
            case 'set-services-tab': {
                const tabId = dataset.target;
                if (tabId && (tabId === 'supply' || tabId === 'tuning')) {
                    this.gameState.setState({
                        uiState: {
                            ...state.uiState,
                            servicesTab: tabId
                        }
                    });
                }
                break;
            }

            // --- VIRTUAL WORKBENCH: UPGRADE INSTALLATION ---
            case 'install_upgrade': {
                const { upgradeId } = dataset;
                if (!upgradeId) return;
                
                const upgradeDef = GameAttributes.getDefinition(upgradeId);
                const player = this.gameState.player;
                const activeShipId = player.activeShipId;
                const activeShipStatic = DB.SHIPS[activeShipId];
                const shipState = player.shipStates[activeShipId];

                // FIX F & C: Calculate hardwareCost correctly so totalCost is not NaN
                const hardwareCost = GameAttributes.getUpgradeHardwareCost(upgradeDef.tier || 1, activeShipStatic ? activeShipStatic.price : 0);
                const laborFee = GameAttributes.getInstallationFee(activeShipStatic ? activeShipStatic.price : 0);
                const totalCost = hardwareCost + laborFee;

                if (player.credits < totalCost) {
                    this.uiManager.queueModal('event-modal', 'Insufficient Funds', 'You cannot afford this upgrade and installation fee.');
                    return;
                }

                this.uiManager.hangarControl.showUpgradeInstallationModal(
                    upgradeId, 
                    { source: 'shop', hardwareCost, installationFee: laborFee, eventX: e.clientX, eventY: e.clientY }, 
                    shipState, 
                    async (replaceIndex) => {
                        if (replaceIndex !== -1) {
                            shipState.upgrades.splice(replaceIndex, 1);
                        }
                        this.simulationService.playerActionService.executeInstallUpgrade(activeShipId, upgradeId, totalCost);
                        
                        this.gameState.uiState.hangarShipyardToggleState = 'hangar';
                        const shipIndex = this.gameState.player.ownedShipIds.indexOf(activeShipId);
                        this.gameState.uiState.hangarActiveIndex = shipIndex !== -1 ? shipIndex : 0;

                        await this.uiManager.orchestrateUpgradeSequence(activeShipId);
                    },
                    () => {
                        this.uiManager.render(this.gameState.getState());
                    }
                );
                break;
            }
            
            case 'show_ship_lore': {
                const isHangarMode = state.uiState.hangarShipyardToggleState === 'hangar';
                const currentIndex = isHangarMode ? (state.uiState.hangarActiveIndex || 0) : (state.uiState.shipyardActiveIndex || 0);
                
                let shipId;
                if (isHangarMode) {
                    const shipList = state.player.ownedShipIds;
                    shipId = shipList[currentIndex] || shipList[0];
                } else {
                    const inventory = this.simulationService._getShipyardInventory();
                    if (inventory && inventory.length > 0) {
                        const safeIndex = Math.min(currentIndex, inventory.length - 1);
                        const shipData = inventory[safeIndex];
                        shipId = shipData ? shipData[0] : null;
                    }
                }

                if (shipId && DB.SHIPS[shipId]) {
                    const ship = DB.SHIPS[shipId];
                    const content = `
                        <div class="ship-lore-modal-wrapper">
                            <div class="ship-lore-text">
                                ${ship.lore || ship.description}
                            </div>
                        </div>
                    `;
                    this.uiManager.queueModal('event-modal', ship.name, content, null, {
                        dismissInside: true,
                        dismissOutside: true,
                        footer: null, 
                        contentClass: 'text-left' 
                    });
                }
                break;
            }
    
            case ACTION_IDS.TOGGLE_HANGAR_MODE:
                this.uiManager.hideGenericTooltip(); 
                if (dataset.mode && this.gameState.uiState.hangarShipyardToggleState !== dataset.mode) {
                    this.gameState.uiState.hangarShipyardToggleState = dataset.mode;
                    this.gameState.setState({});
                }
                break;
            case ACTION_IDS.SET_HANGAR_PAGE: {
                const isHangarMode = this.gameState.uiState.hangarShipyardToggleState === 'hangar';
                const currentIndex = isHangarMode ? this.gameState.uiState.hangarActiveIndex : this.gameState.uiState.shipyardActiveIndex;
                const shipList = isHangarMode ? state.player.ownedShipIds : this.simulationService._getShipyardInventory();
                const totalItems = shipList.length;

                let newIndex;
                const JUMP_DISTANCE = 5; 

                if (dataset.jumpDirection) {
                    if (dataset.jumpDirection === 'next') {
                        newIndex = Math.min(totalItems - 1, currentIndex + JUMP_DISTANCE);
                    } else { 
                        newIndex = Math.max(0, currentIndex - JUMP_DISTANCE);
                    }
                } else {
                    newIndex = parseInt(dataset.index, 10);
                }

                if (isNaN(newIndex)) return;

                const carousel = document.getElementById('hangar-carousel');
                if (carousel) {
                    const pagesToSkip = Math.abs(newIndex - currentIndex);
                    const duration = Math.min(0.8, 0.2 + pagesToSkip * 0.1);
                    carousel.style.transitionDuration = `${duration}s`;

                    this.simulationService.setHangarCarouselIndex(newIndex, isHangarMode ? 'hangar' : 'shipyard');

                    setTimeout(() => {
                        if (carousel) carousel.style.transitionDuration = '';
                    }, duration * 1000);
                } else {
                    this.simulationService.setHangarCarouselIndex(newIndex, isHangarMode ? 'hangar' : 'shipyard');
                }
                break;
            }

            case ACTION_IDS.SET_SCREEN: {
                this.uiManager.hideGenericTooltip(); 
                const isSubNavClick = e.target.tagName === 'A' && actionTarget.contains(e.target);

                if (actionTarget.id === 'mission-sticky-bar' || actionTarget.closest('#mission-sticky-bar')) {
                    this.gameState.setState({
                        uiState: {
                            ...state.uiState,
                            activeMissionTab: 'log'
                        }
                    });
                }

                if (dataset.navId === state.activeNav && !isSubNavClick) {
                    this.gameState.subNavCollapsed = !this.gameState.subNavCollapsed;
                    this.uiManager.render(this.gameState.getState());
                } else {
                    this.gameState.subNavCollapsed = false;
                    this.simulationService.setScreen(dataset.navId, dataset.screenId);
                }
                break;
            }
            
            // --- VIRTUAL WORKBENCH: PHASE 4 - HULL WARNING INTERCEPT ---
            case ACTION_IDS.TRAVEL: {
                e.preventDefault(); // Complying with ADR-026 Mars Revert Protocol
                const useFoldedDrive = dataset.useFoldedDrive === 'true';
                const locationId = dataset.locationId;

                const activeShipId = state.player.activeShipId;
                const shipState = state.player.shipStates[activeShipId];
                
                let maxHealth = DB.SHIPS[activeShipId].maxHealth;
                if (this.simulationService.getEffectiveShipStats) {
                    const effStats = this.simulationService.getEffectiveShipStats(activeShipId);
                    if (effStats) maxHealth = effStats.maxHealth;
                }
                
                const hullRatio = shipState.health / maxHealth;

                this.uiManager.hideModal('launch-modal');

                // The Intercept
                if (hullRatio < 0.15) {
                    this.uiManager.eventControl.showCriticalHullWarningModal(locationId, useFoldedDrive);
                    return; // Halt travel sequence
                }

                this.simulationService.travelTo(locationId, useFoldedDrive);
                break;
            }
            // --- END VIRTUAL WORKBENCH ---

            case 'navigate-to-poi': {
                const { locationId } = dataset;
                if (!locationId) return;

                this.uiManager.hideMapDetailModal();
                this.simulationService.setScreen(NAV_IDS.SHIP, SCREEN_IDS.NAVIGATION);

                setTimeout(() => {
                    this.uiManager.showLaunchModal(locationId);
                }, 100);
                
                break;
            }

            case 'switch-mission-tab': {
                const tabId = dataset.target;
                if (tabId === 'terminal' || tabId === 'log') {
                    this.gameState.setState({
                        uiState: {
                            ...state.uiState,
                            activeMissionTab: tabId
                        }
                    });
                }
                break;
            }
            
            case 'track-mission': {
                e.stopPropagation();
                const missionId = dataset.missionId;
                if (!missionId) return;

                // Silently mutate state
                this.gameState.missions.trackedMissionId = missionId;

                // Targeted DOM manipulation to update stars
                const missionList = actionTarget.closest('.missions-scroll-panel');
                if (missionList) {
                    missionList.querySelectorAll('.mission-track-star').forEach(star => {
                        if (star.dataset.missionId === missionId) {
                            star.classList.add('active');
                        } else {
                            star.classList.remove('active');
                        }
                    });
                }

                // Update the sticky bar directly using the updated state snapshot
                if (this.uiManager.missionControl) {
                    this.uiManager.missionControl.renderStickyBar(this.gameState.getState());
                }

                break;
            }

            case 'set-intel-tab':
                this.uiManager.handleSetIntelTab(actionTarget);
                break;
            case 'show_intel_offer':
                this.uiManager.handleShowIntelOffer(actionTarget);
                break;
            case 'buy_intel':
                this.uiManager.handleBuyIntel(actionTarget, e);
                break;
            case 'show_intel_details':
                this.uiManager.handleShowIntelDetails(actionTarget);
                break;

            case 'show-mission-modal':
                this.uiManager.showMissionModal(dataset.missionId);
                break;
            case 'show_cargo_detail':
                this.uiManager.showCargoDetailModal(state, dataset.goodId);
                break;
            case 'show-launch-modal':
                this.uiManager.showLaunchModal(dataset.locationId);
                break;
            case 'show-map-modal':
                this.uiManager.showMapDetailModal(dataset.locationId);
                break;
            case 'close-map-modal':
                this.uiManager.hideMapDetailModal();
                break;
            case 'show-system-states':
                // Trigger the Economic Weather modal
                if (this.uiManager.showEconWeatherModal) {
                    this.uiManager.showEconWeatherModal(state);
                }
                break;
            
            case 'show_eula_modal':
                e.preventDefault();
                this.uiManager.showEulaModal();
                break;

            case 'toggle-help': {
                e.preventDefault();
                // Custom Override during Intro Sequence
                if (state.introSequenceActive) {
                    const modal = document.getElementById('event-modal');
                    const isVisible = modal && !modal.classList.contains('hidden') && !modal.classList.contains('modal-hiding');
                    const titleEl = modal ? (modal.querySelector('#event-title') || modal.querySelector('.modal-title') || modal.querySelector('h3')) : null;
                    
                    if (isVisible && titleEl && titleEl.textContent.includes('Starter Selection')) {
                        this.uiManager.hideModal('event-modal');
                        return;
                    }
                    
                    const helpHtml = `
                        <div class="text-left text-sm text-gray-300">
                            <p class="mb-4">Choosing your first ship is an exciting first step on the road to becoming a wealthy captain.</p>
                            <p class="mb-2">What play style will you choose?</p>
                            <ul class="list-disc pl-5 space-y-2">
                                <li>Will you opt for the <span class="text-sky-400 font-bold">Explorer</span>, prioritizing its larger fuel tank for fewer refueling stops and more continuous travel?</li>
                                <li>Perhaps the <span class="text-emerald-400 font-bold">Balanced</span> Vessel is your choice, offering a heavily armored hull to survive the dangers of the void.</li>
                                <li>Or do you select the <span class="text-amber-400 font-bold">Hauler</span>, increasing its profitability per run thanks to its expanded storage capacity?</li>
                            </ul>
                        </div>
                    `;
                    this.uiManager.queueModal('event-modal', 'Starter Selection', helpHtml, null, { dismissOutside: true });
                    return;
                }
                
                const contextId = this.uiManager.getCurrentHelpContextId(state);
                if (contextId) {
                    this.uiManager.showHelpModal(contextId);
                }
                break;
            }

            case 'close-help': {
                e.preventDefault();
                this.uiManager.hideHelpModal();
                break;
            }

            // --- UNIVERSAL TOAST ROUTING ---
            case 'route-toast': {
                e.stopPropagation();
                const { target, navTarget } = dataset;
                if (navTarget && target) {
                    
                    // 1. Pre-configure the UI state BEFORE triggering the screen transition.
                    // Copy current uiState to apply the correct DOM ID mutations
                    const newUiState = { ...state.uiState };

                    if (target === 'intel') {
                        newUiState.activeIntelTab = 'intel-market-content';
                    } else if (target === 'missions') {
                        newUiState.activeMissionTab = 'terminal';
                    }
                    
                    // 2. Commit the mutated UI state to the live GameState 
                    this.gameState.setState({ uiState: newUiState });

                    // 3. Route to the intended screen (triggers single cohesive render)
                    this.simulationService.setScreen(navTarget, target);

                    // 4. Manually dismiss the toast so it doesn't linger
                    if (this.uiManager.toastManager) {
                        this.uiManager.toastManager.hideToast();
                    }
                }
                break;
            }

            case 'accept-mission': {
                const mission = DB.MISSIONS[dataset.missionId];
                if (mission && mission.onAccept) {
                    mission.onAccept.forEach(action => {
                        if (action.type === 'GRANT_CREDITS') {
                            if (e) {
                                this.uiManager.createFloatingText(`+${formatCredits(action.amount, false)}`, e.clientX, e.clientY, '#4ade80');
                            }
                        } else if (action.type === 'TRIGGER_SYSTEM_STATE') {
                            // --- VIRTUAL WORKBENCH: NARRATIVE SYSTEM STATE HOOK ---
                            if (this.simulationService && this.simulationService.systemStateService) {
                                this.simulationService.systemStateService.applySpecificState(action.stateId);
                            }
                            // --- END VIRTUAL WORKBENCH ---
                        }
                    });
                }

                this.simulationService.missionService.acceptMission(dataset.missionId);
                this.uiManager.hideModal('mission-modal');
                if (this.uiManager.missionControl) {
                    this.gameState.setState({
                        uiState: {
                            ...this.gameState.getState().uiState,
                            activeMissionTab: 'log'
                        }
                    });
                }
                break;
            }
            case 'load-mission-cargo': {
                e.stopPropagation();
                const missionId = dataset.missionId;
                if (missionId && this.simulationService && this.simulationService.missionService) {
                    this.simulationService.missionService.loadDeferredCargo(missionId);
                }
                break;
            }
            case 'abandon-mission':
                this.simulationService.missionService.abandonMission(dataset.missionId);
                this.uiManager.hideModal('mission-modal');
                break;
            case 'complete-mission':
                this.simulationService.missionService.completeMission(dataset.missionId);
                this.uiManager.hideModal('mission-modal');
                break;

            case ACTION_IDS.PAY_DEBT: {
                e.stopPropagation();
                if (!actionTarget.dataset.primed) {
                    document.querySelectorAll('.primed, [data-primed="true"]').forEach(btn => {
                        delete btn.dataset.primed;
                        btn.classList.remove('primed');
                    });
                    
                    actionTarget.dataset.primed = "true";
                    actionTarget.classList.add('primed');
                    return; 
                }

                let payAmount = null;
                if (dataset.inputId) {
                    const slider = document.getElementById(dataset.inputId);
                    if (slider) {
                        payAmount = parseInt(slider.value, 10);
                    }
                }
                this.simulationService.payOffDebt(payAmount !== null ? payAmount : e, e);
                break;
            }
            case ACTION_IDS.TAKE_LOAN: {
                e.stopPropagation();
                if (!actionTarget.dataset.primed) {
                    document.querySelectorAll('.primed, [data-primed="true"]').forEach(btn => {
                        delete btn.dataset.primed;
                        btn.classList.remove('primed');
                    });
                    
                    actionTarget.dataset.primed = "true";
                    actionTarget.classList.add('primed');
                    return; 
                }
                
                this.simulationService.takeLoan(JSON.parse(dataset.loanDetails), e);
                break;
            }
            case ACTION_IDS.PURCHASE_INTEL:
                this.logger.warn('ActionClickHandler', 'Obsolete ACTION_IDS.PURCHASE_INTEL called.');
                break;
            case ACTION_IDS.ACQUIRE_LICENSE:
                this._handleAcquireLicense(dataset.licenseId, e);
                break;

            case ACTION_IDS.TOGGLE_MARKET_CARD_VIEW:
                if (dataset.goodId) {
                    this.gameState.uiState.marketCardMinimized[dataset.goodId] = !this.gameState.uiState.marketCardMinimized[dataset.goodId];
                    this.gameState.setState({});
                }
                break;

            case 'open-sol-dashboard':
                e.preventDefault();
                e.stopPropagation();
                this.uiManager.showSolStationDashboard(state);
                break;

            case 'sol-set-mode': {
                e.preventDefault(); 
                const newMode = dataset.mode;
                if (newMode) {
                    e.stopPropagation(); 
                    this.simulationService.solStationService.setMode(newMode);
                    this.uiManager.solStationControl.update(this.gameState.getState());
                }
                break;
            }

            case 'sol-donate-all': {
                e.preventDefault(); 
                const commId = dataset.commodityId;
                const station = this.gameState.solStation;
                const cache = station.caches[commId];
                
                if (!cache) return;

                let playerStock = 0;
                for (const shipId of this.gameState.player.ownedShipIds) {
                    playerStock += (this.gameState.player.inventories[shipId]?.[commId]?.quantity || 0);
                }

                const spaceAvailable = Math.floor(cache.max - cache.current);
                const donateAmount = Math.min(playerStock, spaceAvailable);

                if (donateAmount > 0) {
                    const donateResult = this.simulationService.solStationService.donateToCache(commId, donateAmount);
                    if (donateResult.success) {
                        this.uiManager.createFloatingText(`-${donateAmount}`, e.clientX, e.clientY, "#ef4444");
                        this.uiManager.solStationControl.update(this.gameState.getState());
                    } else {
                        this.uiManager.createFloatingText(donateResult.message, e.clientX, e.clientY, "#ef4444");
                    }
                } else {
                     this.uiManager.createFloatingText("No cargo or cache full", e.clientX, e.clientY, "#ef4444");
                }
                break;
            }

            case 'sol-claim-output': {
                e.preventDefault(); 
                const type = dataset.type; // 'credits' or 'antimatter'
                const stockpile = this.gameState.solStation.stockpile;
                
                let text = '';
                let color = '#fff';

                if (type === 'credits') {
                    const amount = Math.floor(stockpile.credits);
                    if (amount > 0) {
                        text = `+${amount}`;
                        color = '#06b6d4'; 
                    }
                } else if (type === 'antimatter') {
                    const amount = Math.floor(stockpile.antimatter);
                    if (amount >= 1) {
                        text = `+${amount}`;
                        color = '#a855f7'; 
                    }
                } else if (type === 'fsd') {
                    const amount = Math.floor(this.gameState.solStation.fsdOutput || 0);
                    if (amount >= 1) {
                        text = `+${amount}`;
                        color = '#ea580c';
                    }
                }

                const claimResult = this.simulationService.solStationService.claimStockpile(type);
                
                if (claimResult.success) {
                    this.uiManager.createFloatingText(text || claimResult.message, e.clientX, e.clientY, color);
                    this.uiManager.solStationControl.update(this.gameState.getState());
                } else {
                    this.uiManager.createFloatingText(claimResult.message, e.clientX, e.clientY, "#9ca3af");
                }
                break;
            }

            case 'sol-open-roster': {
                const slotId = dataset.slotId;
                this.uiManager.showOfficerRoster(slotId, state);
                break;
            }

            case 'sol-assign-officer': {
                e.preventDefault(); 
                const targetSlot = dataset.slotId;
                const officerId = dataset.officerId === "null" ? null : dataset.officerId;
                const success = this.simulationService.solStationService.assignOfficer(targetSlot, officerId);
                
                if (success) {
                    this.uiManager.showSolStationDashboard(this.gameState.getState());
                }
                break;
            }
        }
    }

    _handleAcquireLicense(licenseId, e) {
        const license = DB.LICENSES[licenseId];
        if (!license) return;

        if (license.type === 'purchase') {
            const description = `${license.description}<br><br>Cost: <span class="text-glow-red">${formatCredits(-license.cost, true)}</span>`;
            this.uiManager.queueModal('event-modal', `Purchase ${license.name}?`, description, null, {
                dismissOutside: true,
                customSetup: (modal, closeHandler) => {
                    const btnContainer = modal.querySelector('#event-button-container');
                    btnContainer.innerHTML = `
                        <button id="confirm-license-purchase" class="btn btn-pulse-green">Confirm</button>
                        <button id="cancel-license-purchase" class="btn">Cancel</button>
                    `;
                    modal.querySelector('#confirm-license-purchase').onclick = async () => {
                        const playerCredits = this.gameState.player.credits;
                        if (playerCredits < license.cost) {
                            closeHandler();
                            this.uiManager.queueModal('event-modal', 'Purchase Failed', `You cannot afford the ${formatCredits(license.cost)} fee for this license.`);
                            return;
                        }

                        closeHandler();
                        
                        // Begin specific tier cinematic grant
                        const tierMatch = licenseId.match(/t(\d)_license/);
                        const tierNum = tierMatch ? parseInt(tierMatch[1], 10) : 2;
                        const tierComms = DB.COMMODITIES.filter(c => c.tier === tierNum).map(c => c.name);
                        const bodyText = `Unlocked ${tierComms.join(' and ')} trading.`;

                        await startLicenseAnimation(tierNum);
                        
                        const textHtml = `
                            <div class="text-center w-full flex flex-col items-center justify-center p-2">
                                <div class="license-header-text license-header-t${tierNum}">LICENSE ACQUIRED</div>
                                <br>
                                <div class="license-subheader-text license-text-t${tierNum} mb-2">${license.name.toUpperCase()}</div>
                                <div class="license-body-text">${bodyText}</div>
                            </div>
                        `;

                        this.uiManager.queueModal('event-modal', '', textHtml, null, {
                            dismissInside: false,
                            dismissOutside: false,
                            theme: `license-t${tierNum}`,
                            customSetup: (licModal, licCloseHandler) => {
                                const licModalContent = licModal.querySelector('.modal-content');
                                // FIX: Remove sticky exit class from previous singleton usages
                                licModalContent.classList.remove('license-modal-blur-out');
                                licModalContent.classList.add('license-modal-blur-in');

                                const titleEl = licModal.querySelector('.modal-title');
                                if (titleEl) titleEl.style.display = 'none';

                                const licBtnContainer = licModal.querySelector('#event-button-container');
                                licBtnContainer.innerHTML = `<button type="button" id="accept-license-btn" class="btn w-full license-btn license-btn-t${tierNum}" style="padding-top: 0.5rem; padding-bottom: 0.5rem; min-height: 32px;">ACCEPT LICENSE</button>`;
                                
                                licModal.querySelector('#accept-license-btn').onclick = async () => {
                                    licModalContent.classList.remove('license-modal-blur-in');
                                    licModalContent.classList.add('license-modal-blur-out');
                                    
                                    setTimeout(async () => {
                                        // FIX: Purge the class so it's clean for the next modal
                                        licModalContent.classList.remove('license-modal-blur-out');
                                        licCloseHandler();
                                        await endLicenseAnimation(tierNum);

                                        const result = this.simulationService.purchaseLicense(licenseId);
                                        if (result.success) {
                                            if (e) {
                                                this.uiManager.createFloatingText(`-${formatCredits(license.cost, false)}`, e.clientX, e.clientY, '#f87171');
                                            }
                                        }
                                        this.uiManager.render(this.gameState.getState());
                                    }, 800); // 800ms to allow blur fade out
                                };
                            }
                        });
                        
                        if (this.uiManager.modalEngine) {
                            this.uiManager.modalEngine.processModalQueue();
                        }
                    };
                    modal.querySelector('#cancel-license-purchase').onclick = closeHandler;
                }
            });
        } else if (license.type === 'mission') {
            this.uiManager.queueModal('event-modal', license.name, license.guidanceText);
        }
    }
}