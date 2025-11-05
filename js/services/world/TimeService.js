// js/services/world/TimeService.js
/**
 * @fileoverview Responsible for advancing the game clock and triggering all
 * time-based events like birthdays, debt interest, and market replenishment.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, WEALTH_MILESTONES } from '../../data/constants.js';
import { formatCredits } from '../../utils.js';

export class TimeService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../simulation/MarketService.js').MarketService} marketService
     * @param {import('../UIManager.js').UIManager} uiManager
     * @param {import('../../services/LoggingService.js').Logger} logger
     */
    constructor(gameState, marketService, uiManager, logger) { // MODIFIED: Removed newsTickerService
        this.gameState = gameState;
        this.marketService = marketService;
        this.uiManager = uiManager;
        this.logger = 
logger;
        // this.newsTickerService = newsTickerService; // REMOVED
        this.simulationService = null; // To be injected
        
        // --- VIRTUAL WORKBENCH ---
        /** @type {import('../IntelService.js').IntelService | null} */
        this.intelService = null; // To be injected by SimulationService
        // --- END VIRTUAL WORKBENCH ---
    }

    // REMOVED: setNewsTickerService method

    /**
   * Advances game time by a specified number of days, triggering daily, weekly, and monthly events.
     * @param {number} days - The integer number of days to advance.
     */
    advanceDays(days) {
        this.logger.group(`[System] Advancing time by ${days} day(s) from Day ${this.gameState.day}`);
        for (let i = 0; i < days; i++) {
            if (this.gameState.isGameOver) {
                this.logger.warn('TimeService', 'Advance days aborted: Game is over.');
this.logger.groupEnd();
                return;
            }
            this.gameState.day++;

            // MODIFIED: Call facade method on SimulationService
            if (this.simulationService) {
                this.simulationService.pulseNewsTicker();
            }

            const dayOfYear = (this.gameState.day - 1) % 365;
            const currentYear = DB.DATE_CONFIG.START_YEAR + Math.floor((this.gameState.day - 1) / 365);

            if (dayOfYear === 11 && currentYear > this.gameState.player.lastBirthdayYear) {
       this.gameState.player.playerAge++;
                this.gameState.player.birthdayProfitBonus += 0.01;
                this.gameState.player.lastBirthdayYear = currentYear;
                this.logger.info.state(this.gameState.day, 'BIRTHDAY', `Player is now age ${this.gameState.player.playerAge}. Profit bonus increased.`);
            }

            this._checkAgeEvents();
            this.marketService.evolveMarketPrices();

            if ((this.gameState.day - this.gameState.lastMarketUpdateDay) >= 7) {
                this.marketService.checkForSystemStateChange();
                this.marketService.replenishMarketInventory();
                this.marketService._updateShipyardStock(); // Correctly call the method on MarketService
                this.gameState.lastMarketUpdateDay = this.gameState.day;
            }

           
 // --- VIRTUAL WORKBENCH: ADD INTEL SYSTEM LOGIC & FIX BUG ---
            
            // Get state once for daily checks
            const state = this.gameState.getState();
            // BUG FIX: The day is at the root of the state, not in 'gameTime'
            const day = state.day;

            // --- NEW LOGIC: CHECK INTEL EXPIRATION ---
        if (state.activeIntelDeal && day > state.activeIntelDeal.expiryDay) {
                // --- BUG FIX (B): Use setState instead of updateState ---
                this.gameState.setState({ activeIntelDeal: null });
                // --- END BUG FIX ---
                this.logger.info.system('IntelService', day, 'EXPIRED', 'Active intel deal has expired.');
            }

            // --- NEW LOGIC: CHECK INTEL REFRESH ---
            // (Runs at the start of day 1, 121, 241, etc.)
            if (this.intelService && (day 
% 120 === 1)) {
                this.intelService.generateIntelRefresh();
            }
            
            // Removed obsolete intel check
            // --- END VIRTUAL WORKBENCH ---
            
            this.gameState.player.ownedShipIds.forEach(shipId => {
         if (shipId !== this.gameState.player.activeShipId) {
                    const ship = DB.SHIPS[shipId];
                    const repairAmount = ship.maxHealth * GAME_RULES.PASSIVE_REPAIR_RATE;
                    this.gameState.player.shipStates[shipId].health = Math.min(ship.maxHealth, this.gameState.player.shipStates[shipId].health + repairAmount);
   }
            });

            if (this.gameState.player.debt > 0 && (this.gameState.day - this.gameState.lastInterestChargeDay) >= GAME_RULES.INTEREST_INTERVAL) {
                const interest = this.gameState.player.monthlyInterestAmount;
                this.gameState.player.debt += interest;
                this.simulationService._logTransaction('loan', interest, 'Monthly interest charge');
                this.logger.info.system('Finance', this.gameState.day, 'INTEREST', `Charged ${formatCredits(interest)} interest on debt.`);
                this.gameState.lastInterestChargeDay = this.gameState.day;
            }

            // Apply garnishment must be called daily
            this._applyGarnishment();
        }
     
        this.logger.groupEnd();
        this.gameState.setState({});
    }

    /**
     * Checks for and triggers age-based narrative events based on game progression.
     * @private
     */
    _checkAgeEvents() {
        DB.AGE_EVENTS.forEach(event => {
            if (this.gameState.player.seenEvents.includes(event.id)) return;
            if ((event.trigger.day && this.gameState.day >= event.trigger.day) || (event.trigger.credits && this.gameState.player.credits >= event.trigger.credits)) {
            this.gameState.player.seenEvents.push(event.id);
                this.logger.info.state(this.gameState.day, 'AGE_EVENT', `Triggered age event: ${event.title}`);
                this.uiManager.showAgeEventModal(event, (choice) => this.simulationService._applyPerk(choice));
            }
        });
    }

    /**
     * Checks if the player's wealth has reached a new milestone, revealing the next tier of commodities.
* @private
     */
    _checkMilestones() {
        const { credits, revealedTier } = this.gameState.player;
        let currentTier = revealedTier;
        let nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === currentTier + 1);

        while (nextMilestone && credits >= nextMilestone.threshold) {
            this.gameState.player.revealedTier = nextMilestone.revealsTier;
            this.logger.info.state(this.gameState.day, 'MILESTONE', `Unlocked Tier ${nextMilestone.revealsTier} commodities.`);
            
            currentTier = nextMilestone.revealsTier;
            nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === currentTier + 1);
        }

        if (this.gameState.player.revealedTier !== revealedTier) {
    this.gameState.setState({});
        }
    }

    /**
     * Applies a monthly credit garnishment if the player's loan is delinquent.
     * @private
     */
    _applyGarnishment() {
        const { player, day } = this.gameState;
        if (player.debt > 0 && player.loanStartDate && (day - player.loanStartDate) >= GAME_RULES.LOAN_GARNISHMENT_DAYS) {
            
            // Garnishment only happens on the 30-day 
interval
            if ((day - this.gameState.lastInterestChargeDay) % GAME_RULES.INTEREST_INTERVAL !== 0) {
                return;
            }

            const garnishedAmount = Math.floor(player.credits * GAME_RULES.LOAN_GARNISHMENT_PERCENT);
            if (garnishedAmount > 0) {
                player.credits -= garnishedAmount;
                this.simulationService._logTransaction('debt', -garnishedAmount, 'Monthly credit garnishment');
                
                // This is the single, non-performative place to check for game over
           this.simulationService._checkGameOverConditions(); 
            }

            if (!player.seenGarnishmentWarning) {
                const msg = "Your loan is delinquent. Your lender is now garnishing 14% of your credits monthly until the debt is paid.";
                this.uiManager.queueModal('event-modal', "Credit Garnishment Notice", msg, null, { buttonClass: 'bg-red-800/80' });
                player.seenGarnishmentWarning = true;
                this.logger.warn('Finance', `Loan delinquent. Garnishment of ${GAME_RULES.LOAN_GARNISHMENT_PERCENT * 100}% initiated.`);
            }
        }
    }

   /**
     * Gets the current game day.
     * @returns {number} The current day.
     * @JSDoc
     */
    getCurrentDay() {
        // This helper is used by IntelService
        return this.gameState.day;
    }
}