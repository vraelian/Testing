// js/services/BankruptcyService.js
import { playBankruptcyBlackout } from './ui/AnimationService.js';
import { SHIP_IDS, NAV_IDS, SCREEN_IDS, LOCATION_IDS } from '../data/constants.js';
import { formatCredits } from '../utils.js';

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
     * Triggers only if liquid credits + cargo value cannot cover the cheapest fuel cost to leave,
     * fleet size is 1, credit lines are exhausted/locked, and no zero-cost missions exist.
     * @param {object} state - The current GameState.state object.
     * @returns {boolean} True if the player is fundamentally bankrupt.
     */
    isPlayerBankrupt(state) {
        const player = state.player;
        const locId = state.currentLocationId;
        const activeShipId = player.activeShipId;
        const shipState = player.shipStates[activeShipId];

        // --- VIRTUAL WORKBENCH: IMMEDIATE BANKRUPTCY CHECK ---
        if (player.credits <= 0 && player.ownedShipIds.length === 1) {
            if (!state.missions || !state.missions.activeMissionIds || state.missions.activeMissionIds.length === 0) {
                return true; // Immediate bankruptcy trigger
            }
        }
        // --- END VIRTUAL WORKBENCH ---

        // 1. Calculate the Minimum Cost to Escape
        const travelRoutes = state.TRAVEL_DATA[locId];
        let minFuelNeeded = 10; // Failsafe
        if (travelRoutes) {
            minFuelNeeded = Math.min(...Object.values(travelRoutes).map(route => route.fuelCost));
        }

        // If they already have enough fuel in the tank, they are not softlocked.
        if (shipState && shipState.fuel >= minFuelNeeded) return false;

        // Calculate credit cost to buy the missing fuel
        const localMarket = this.marketService ? this.marketService.getMarketState(locId) : null;
        // Fallback to static DB price if dynamic market state isn't available
        const localFuelPrice = localMarket ? localMarket.fuelPrice : (DB.MARKETS ? DB.MARKETS.find(m => m.id === locId)?.fuelPrice : 5);
        
        const fuelDeficit = minFuelNeeded - (shipState ? shipState.fuel : 0);
        const costToEscape = fuelDeficit * localFuelPrice;

        // 2. Calculate Net Liquidation Value (NLV)
        let totalLiquidCapital = player.credits;

        // Add the local sell value of ALL cargo across the fleet
        for (const shipId of player.ownedShipIds) {
            const inventory = player.inventories[shipId] || {};
            for (const commodityId in inventory) {
                const qty = inventory[commodityId].quantity;
                if (qty > 0) {
                    // Get the exact price the local market will pay for it
                    const sellPrice = this.uiManager ? this.uiManager.getItemPrice(state, commodityId, true) : 0;
                    totalLiquidCapital += (qty * sellPrice);
                }
            }
        }

        // 3. Evaluate Capital vs Escape Cost
        if (totalLiquidCapital >= costToEscape) return false;

        // 4. Fleet size check (player could sell a backup ship)
        if (player.ownedShipIds.length > 1) return false;

        // 5. Active debt / Credit Lockout check
        const isCreditLocked = player.creditLockoutExpiryDate && state.day < player.creditLockoutExpiryDate;
        if (player.debt === 0 && !isCreditLocked) {
            return false;
        }

        // 6. Active zero-cost missions check
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
            
            // Set credits to 0 while in blackout. 
            // Stipend is granted upon waking/acknowledging the modal.
            player.credits = 0;

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
            } else if (this.gameState.currentLocationId === 'transit') {
                // Failsafe: if Vagrancy somehow caught them during an edge case transit, drop them at Earth
                this.gameState.currentLocationId = LOCATION_IDS.EARTH;
            }

            // Reboot News Ticker for the new location context
            if (this.uiManager.simulationService && this.uiManager.simulationService.newsTickerService) {
                this.uiManager.simulationService.newsTickerService.onLocationChange(this.gameState.currentLocationId);
            }

            // Force a deep render update while screen is black
            this.gameState.setState({});
        });
        
        // Show Aftermath Modal once screen fades back in
        const aftermathCallback = () => {
            // Grant the severance/stipend payout
            this.gameState.player.credits += payout;
            
            // Log the transaction safely via SimulationService
            if (this.uiManager.simulationService && typeof this.uiManager.simulationService._logTransaction === 'function') {
                this.uiManager.simulationService._logTransaction('bankruptcy', payout, 'Labor Severance Stipend');
            }

            // Fire the floating green text animation
            if (this.uiManager && typeof this.uiManager.createFloatingText === 'function') {
                this.uiManager.createFloatingText(`+${formatCredits(payout)}`, window.innerWidth / 2, window.innerHeight / 2, '#4ade80');
            }

            this.gameState.setState({});
        };

        this.uiManager.queueModal(
            'event-modal', 
            'LABOR CONTRACT FULFILLED', 
            `Your period of indentured servitude has ended. Your credit has been blacklisted for 6 years.`, 
            aftermathCallback, 
            { buttonClass: 'bg-cyan-800/80 hover:bg-cyan-700/80' }
        );
        this.uiManager.render();
    }
}