// js/services/ToastService.js
import { GAME_RULES, LOCATION_IDS } from '../data/constants.js';

export class ToastService {
    /**
     * @param {import('./GameState.js').GameState} gameState 
     * @param {import('./UIManager.js').UIManager} uiManager 
     * @param {import('./SimulationService.js').SimulationService} simulationService 
     */
    constructor(gameState, uiManager, simulationService) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.simulationService = simulationService;
        
        this.toastQueue = [];
        this.queueDelayTimer = null;
        this.toastDurationTimer = null;
    }

    /**
     * Called strictly upon arrival at a new location.
     * Evaluates thresholds, culls the queue to 2, and begins playback.
     */
    evaluateArrivalTriggers() {
        this.clearQueueAndHide();

        const triggers = [];
        const state = this.gameState;

        // 0. Sol Station Check (Highest Priority)
        if (state.currentLocationId === LOCATION_IDS.SUN || state.currentLocationId === 'sol') {
            const solStation = state.solStation;
            if (solStation && solStation.caches) {
                const caches = Object.values(solStation.caches);
                if (caches.length > 0) {
                    let totalRatio = 0;
                    caches.forEach(cache => {
                        const current = cache.current || 0;
                        const max = cache.max || 1;
                        totalRatio += (current / max);
                    });
                    const integrity = totalRatio / caches.length;

                    if (integrity < 0.30) {
                        triggers.push({
                            priority: 0,
                            type: 'sol',
                            title: 'STATION CRITICAL',
                            message: 'Station supplies are low!',
                            navTarget: 'starport',
                            actionTarget: 'services'
                        });
                    }
                }
            }
        }

        // 1. Ship Systems Check (Active Ship Only)
        const activeShipId = state.player.activeShipId;
        if (activeShipId) {
            const shipState = state.player.shipStates[activeShipId];
            const shipStatic = this.simulationService.getEffectiveShipStats(activeShipId);

            if (shipState && shipStatic) {
                const fuelPct = shipState.fuel / shipStatic.maxFuel;
                const hullPct = shipState.health / shipStatic.maxHealth;
                
                if (fuelPct < 0.20 || hullPct < 0.20) {
                    let msg = "";
                    if (hullPct < 0.20 && fuelPct < 0.20) msg = "Low Hull Integrity & Fuel Reserves.";
                    else if (hullPct < 0.20) msg = "Low Hull Integrity. Repair recommended.";
                    else msg = "Low Fuel Reserves. Refuel recommended.";
                    
                    triggers.push({
                        priority: 1,
                        type: 'system',
                        title: 'SYSTEM ALERT',
                        message: msg,
                        navTarget: 'starport',
                        actionTarget: 'services'
                    });
                }
            }
        }

        // 2. Finance Check (Loans nearing garnishment)
        if (state.player.debt > 0) {
            let daysRemaining = 199; // Fallback assumes imminent payment if loanDay tracking isn't hydrated
            if (state.player.loanDay !== undefined) {
                daysRemaining = (state.player.loanDay + GAME_RULES.LOAN_GARNISHMENT_DAYS) - state.day;
            }
            
            if (daysRemaining < 200) {
                triggers.push({
                    priority: 2,
                    type: 'finance',
                    title: 'FINANCE ALERT',
                    message: `Active loan payment due in ${Math.max(0, daysRemaining)} days.`,
                    navTarget: 'data',
                    actionTarget: 'finance'
                });
            }
        }

        // 3. Intel Check (Expired during transit)
        if (state.uiState && state.uiState.intelExpiredAlert) {
            state.uiState.intelExpiredAlert = false; // Purge the volatile state flag
            triggers.push({
                priority: 3,
                type: 'intel',
                title: 'INTEL EXPIRED',
                message: 'A purchased intel deal expired during your journey.',
                navTarget: 'data',
                actionTarget: 'intel'
            });
        }

        // 4. Mission Check (Available and log is completely empty)
        if (this.simulationService.missionService) {
            const availableMissions = this.simulationService.missionService.getAvailableMissions();
            const activeMissions = state.missions ? (state.missions.activeMissionIds || []) : [];
            
            if (availableMissions.length > 0 && activeMissions.length === 0) {
                triggers.push({
                    priority: 4,
                    type: 'mission',
                    title: 'MISSIONS AVAILABLE',
                    message: 'New contracts are available at the local terminal.',
                    navTarget: 'data',
                    actionTarget: 'missions'
                });
            }
        }

        // 5. Intel Available Check (Fires ONLY if there are absolutely zero other toasts)
        if (triggers.length === 0) {
            const hasActiveDeal = !!state.activeIntelDeal;
            
            if (!hasActiveDeal) {
                const currentLocIntel = state.intelMarket ? state.intelMarket[state.currentLocationId] : null;
                const hasPurchasableIntel = Array.isArray(currentLocIntel) && currentLocIntel.some(packet => !packet.purchased);
                
                if (hasPurchasableIntel) {
                    triggers.push({
                        priority: 5,
                        type: 'intel',
                        title: 'INTEL AVAILABLE',
                        message: 'Intel is available.',
                        navTarget: 'data',
                        actionTarget: 'intel'
                    });
                }
            }
        }

        if (triggers.length === 0) return;

        // Sort by hierarchy priority (0 is highest)
        triggers.sort((a, b) => a.priority - b.priority);

        // Enforce the "Rule of Two" cap per arrival
        this.toastQueue = triggers.slice(0, 2);

        // 1.0s initial delay before firing the first toast in the queue
        this.queueDelayTimer = setTimeout(() => {
            this.playNextInQueue();
        }, 1000);
    }

    /**
     * Executes the lifecycle of a single toast and queues the next.
     */
    playNextInQueue() {
        if (this.toastQueue.length === 0) return;

        const nextToast = this.toastQueue.shift();

        let completed = false;
        
        const onComplete = () => {
            if (completed) return;
            completed = true;
            
            if (this.toastDurationTimer) {
                clearTimeout(this.toastDurationTimer);
                this.toastDurationTimer = null;
            }
            
            // Mandatory 1.0-second delay between toasts
            this.queueDelayTimer = setTimeout(() => {
                this.playNextInQueue();
            }, 1000);
        };

        this.uiManager.toastManager.showToast(nextToast, onComplete);

        // Toast remains visible for exactly 4.0 seconds (updated via your instruction)
        this.toastDurationTimer = setTimeout(() => {
            this.uiManager.toastManager.hideToast(onComplete);
        }, 4500);
    }

    /**
     * Hard interrupt. Clears all timeouts, purges the queue, and destroys active DOM elements.
     */
    clearQueueAndHide() {
        if (this.queueDelayTimer) {
            clearTimeout(this.queueDelayTimer);
            this.queueDelayTimer = null;
        }
        if (this.toastDurationTimer) {
            clearTimeout(this.toastDurationTimer);
            this.toastDurationTimer = null;
        }
        
        this.toastQueue = [];
        
        if (this.uiManager && this.uiManager.toastManager) {
            this.uiManager.toastManager.forceClear();
        }
    }
}