// js/services/world/TimeService.js
/**
 * @fileoverview Responsible for advancing the game clock and triggering all
 * time-based events like birthdays, debt interest, and market replenishment.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, WEALTH_MILESTONES, ATTRIBUTE_TYPES } from '../../data/constants.js';
import { formatCredits } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js';

export class TimeService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../simulation/MarketService.js').MarketService} marketService
     * @param {import('../UIManager.js').UIManager} uiManager
     * @param {import('../../services/LoggingService.js').Logger} logger
     */
    constructor(gameState, marketService, uiManager, logger) { 
        this.gameState = gameState;
        this.marketService = marketService;
        this.uiManager = uiManager;
        this.logger = logger;
        this.simulationService = null; // To be injected
        
        // --- VIRTUAL WORKBENCH ---
        /** @type {import('../IntelService.js').IntelService | null} */
        this.intelService = null; // To be injected by SimulationService
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Advances game time by a specified number of days, triggering daily, weekly, and monthly events.
     * @param {number} days - The integer number of days to advance.
     */
    advanceDays(days) {
        this.logger.group(`[System] Advancing time by ${days} day(s) from Day ${this.gameState.day}`);

        // Cycle Art Assets on Time Advance
        this.gameState.player.visualSeed = (this.gameState.player.visualSeed || 0) + 1;

        for (let i = 0; i < days; i++) {
            if (this.gameState.isGameOver) {
                this.logger.warn('TimeService', 'Advance days aborted: Game is over.');
                this.logger.groupEnd();
                return;
            }
            this.gameState.day++;

            if (this.simulationService) {
                this.simulationService.pulseNewsTicker();
            }

            // --- VIRTUAL WORKBENCH: Daily Attribute Effects ---
            const activeShipId = this.gameState.player.activeShipId;
            if (activeShipId) {
                const shipAttrs = GameAttributes.getShipAttributes(activeShipId);
                shipAttrs.forEach(attrId => {
                    const def = GameAttributes.getDefinition(attrId);
                    // Handle 'flat_daily' hull decay (e.g. Ouroboros)
                    if (def && def.type === ATTRIBUTE_TYPES.MOD_HULL_DECAY && def.mode === 'flat_daily') {
                        const shipState = this.gameState.player.shipStates[activeShipId];
                        if (shipState && shipState.health > 1) {
                            shipState.health = Math.max(1, shipState.health - def.value);
                        }
                    }
                });
            }
            // --- END VIRTUAL WORKBENCH ---

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
                this.marketService._updateShipyardStock(); 
                this.gameState.lastMarketUpdateDay = this.gameState.day;
            }

            // --- INTEL EXPIRATION ---
            const activeDeal = this.gameState.activeIntelDeal; 
            if (activeDeal && this.gameState.day > activeDeal.expiryDay) {
                const expiredDeal = activeDeal;
                
                this.gameState.activeIntelDeal = null;
                this.logger.info.system('IntelService', this.gameState.day, 'EXPIRED', 'Active intel deal has expired.');

                if (expiredDeal.sourceSaleLocationId && expiredDeal.sourcePacketId) {
                    const saleLocationMarket = this.gameState.intelMarket[expiredDeal.sourceSaleLocationId];
                    if (saleLocationMarket) {
                        this.gameState.intelMarket[expiredDeal.sourceSaleLocationId] = saleLocationMarket.filter(
                            packet => packet.id !== expiredDeal.sourcePacketId
                        );
                        this.logger.info.system('IntelService', this.gameState.day, 'PACKET_CLEANUP', `Removed expired packet ${expiredDeal.sourcePacketId} from ${expiredDeal.sourceSaleLocationId}.`);
                    }
                }
            }

            // --- INTEL REFRESH ---
            if (this.intelService && (this.gameState.day % 120 === 1)) {
                this.intelService.generateIntelRefresh();
            }
            
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
            
            if ((day - this.gameState.lastInterestChargeDay) % GAME_RULES.INTEREST_INTERVAL !== 0) {
                return;
            }

            const garnishedAmount = Math.floor(player.credits * GAME_RULES.LOAN_GARNISHMENT_PERCENT);
            if (garnishedAmount > 0) {
                player.credits -= garnishedAmount;
                this.simulationService._logTransaction('debt', -garnishedAmount, 'Monthly credit garnishment');
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
        return this.gameState.day;
    }
}