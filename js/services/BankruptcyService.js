// js/services/BankruptcyService.js
import { playBankruptcyBlackout } from './ui/AnimationService.js';
import { SHIP_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';

/**
 * @class BankruptcyService
 * @description Orchestrates the "Indentured Servitude" bankruptcy recovery system.
 * Evaluates terminal financial softlocks and executes time-skip penalties (seizing assets, 
 * resetting market influence, and applying credit lockouts) to keep the simulation playable
 * without resorting to a hard Game Over state.
 */
export class BankruptcyService {
    constructor() {
        this.gameState = null;
        this.timeService = null;
        this.marketService = null;
        this.solStationService = null;
        this.uiManager = null;
    }

    /**
     * Dependency injection initialization.
     */
    setServices(gameState, timeService, marketService, solStationService, uiManager) {
        this.gameState = gameState;
        this.timeService = timeService;
        this.marketService = marketService;
        this.solStationService = solStationService;
        this.uiManager = uiManager;
    }

    /**
     * Evaluates if the player is in a terminal economic softlock.
     * Calculates if Total Potential Liquidity is fundamentally exhausted.
     * Triggers only if liquid credits <= 0, cargo is empty across the fleet, fleet size is 1,
     * credit lines are exhausted/locked, and no zero-cost missions exist.
     * @param {object} state - The current GameState.state object.
     * @returns {boolean} True if the player is fundamentally bankrupt.
     */
    isPlayerBankrupt(state) {
        const player = state.player;

        // 1. Liquidity check
        if (player.credits > 0) return false;

        // 2. Fleet size check (player could sell a backup ship)
        if (player.ownedShipIds.length > 1) return false;

        // 3. Cargo check (iterate all owned ships to ensure no cargo is hidden)
        let hasCargo = false;
        for (const shipId of player.ownedShipIds) {
            const inventory = player.inventories[shipId] || {};
            for (const commodityId in inventory) {
                if (inventory[commodityId].quantity > 0) {
                    hasCargo = true;
                    break;
                }
            }
            if (hasCargo) break;
        }
        if (hasCargo) return false;

        // 4. Active debt / Credit Lockout check
        // If debt is 0 and the player is not under a lockout penalty, they can legally take a Guild loan.
        const isCreditLocked = player.creditLockoutExpiryDate && state.day < player.creditLockoutExpiryDate;
        if (player.debt === 0 && !isCreditLocked) {
            return false;
        }

        // 5. Active zero-cost missions check
        // If the player has active missions, they might still earn a payout to recover.
        if (state.missions && state.missions.activeMissionIds && state.missions.activeMissionIds.length > 0) {
            return false;
        }

        // All economic lifelines exhausted.
        return true;
    }

    /**
     * Initiates the UI flow for bankruptcy, intercepting normal simulation interaction
     * and pushing the correct modal template based on the active debt holder.
     */
    triggerBankruptcyFlow() {
        if (!this.uiManager) return;
        
        const player = this.gameState.player;
        let type = 'vagrancy';
        
        if (player.debt > 0) {
            type = player.loanType === 'syndicate' ? 'syndicate' : 'guild';
        }

        // Use UIModalEngine specifically constructed for this flow
        this.uiManager.modalEngine.queueBankruptcyModal(type, (years, payout, shipSeized, locationId) => {
            this.executeTransition(years, payout, shipSeized, locationId);
        });
        this.uiManager.render();
    }

    /**
     * Executes the background simulation state mutations during the blackout animation.
     * Advances the calendar, wipes market influences, decays Sol Station caches, 
     * and processes severance and asset seizure.
     * @param {number} years - Years of servitude to skip.
     * @param {number} payout - Severance capital granted upon return.
     * @param {boolean} shipSeized - Whether the player's primary vessel is repossessed.
     * @param {string|null} locationId - The location the player is remanded to.
     */
    async executeTransition(years, payout, shipSeized, locationId) {
        if (!this.gameState || !this.timeService || !this.marketService || !this.uiManager) return;

        // Call the canvas/div blackout animation
        await playBankruptcyBlackout(async () => {
            const player = this.gameState.player;

            // --- CRITICAL FIX: Clear Travel State to avoid UI getting stuck ---
            this.gameState.pendingTravel = null;
            this.gameState.activeNav = NAV_IDS.DATA;
            this.gameState.activeScreen = SCREEN_IDS.MISSIONS;

            // 1. Execute Time Skip
            this.timeService.advanceYearsSilently(years);

            // 2. Wipe Market Influence
            this.marketService.wipePlayerInfluence();

            // 3. Decay Sol Station Caches
            if (this.solStationService) {
                this.solStationService.decayAbandonedCaches();
            }

            // 4. Financial Reset
            player.debt = 0;
            player.loanStartDate = null;
            player.loanDueDate = null;
            player.loanType = 'guild';
            player.repoNextEventDay = null;
            player.lastRepoStrikeDay = null;
            player.monthlyInterestAmount = 0;
            player.seenGarnishmentWarning = false;
            
            player.credits = payout;

            // Apply the 6-year credit lockout
            player.creditLockoutExpiryDate = this.gameState.day + (6 * 365);

            // 5. Asset Seizure vs Cargo Wipe
            if (shipSeized) {
                player.ownedShipIds = [SHIP_IDS.WANDERER];
                player.activeShipId = SHIP_IDS.WANDERER;
                player.shipStates = {
                    [SHIP_IDS.WANDERER]: this.gameState._getInitialShipState(SHIP_IDS.WANDERER)
                };
                player.inventories = {
                    [SHIP_IDS.WANDERER]: {} 
                };
            } else {
                // Just wipe cargo for existing ships (in case any straggler cargo was missed)
                for (const shipId of player.ownedShipIds) {
                    if (player.inventories[shipId]) {
                        Object.values(player.inventories[shipId]).forEach(inv => {
                            inv.quantity = 0;
                            inv.avgCost = 0;
                        });
                    }
                }
            }

            // 6. Relocation
            if (locationId) {
                this.gameState.currentLocationId = locationId;
            }

            // Reboot News Ticker for the new location context
            if (this.uiManager.simulationService && this.uiManager.simulationService.newsTickerService) {
                this.uiManager.simulationService.newsTickerService.onLocationChange(this.gameState.currentLocationId);
            }

            // Force a deep render update while screen is black
            this.gameState.setState({});
        });
        
        // Show Aftermath Modal once screen fades back in
        this.uiManager.queueModal('event-modal', 'LABOR CONTRACT FULFILLED', `Your period of indentured servitude has ended. Your credit has been blacklisted for 6 years.`, null, { buttonClass: 'bg-cyan-800/80 hover:bg-cyan-700/80' });
        this.uiManager.render();
    }
}