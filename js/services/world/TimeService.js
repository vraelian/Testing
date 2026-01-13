// js/services/world/TimeService.js
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
    constructor(gameState, marketService, uiManager, logger, newsTickerService) { // Received newsTickerService from SimService
        this.gameState = gameState;
        this.marketService = marketService;
        this.uiManager = uiManager;
        this.logger = logger;
        this.newsTickerService = newsTickerService;
        this.simulationService = null; // Injected by SimulationService
        this.intelService = null;      // Injected by SimulationService
    }

    /**
     * Advances the game world by a specified number of days.
     * detailed mechanics like passive repairs, interest, and random events are handled here.
     * @param {number} days - The number of days to advance.
     */
    advanceDays(days) {
        this.logger.group(`[System] Advancing time by ${days} day(s) from Day ${this.gameState.day}`);
        
        // Update visual seed for procedural rotations
        this.gameState.player.visualSeed = (this.gameState.player.visualSeed || 0) + 1;

        // Pre-fetch active ship data for the loop
        const activeShipId = this.gameState.player.activeShipId;
        const activeShipState = this.gameState.player.shipStates[activeShipId];
        const activeUpgrades = activeShipState ? (activeShipState.upgrades || []) : [];

        for (let i = 0; i < days; i++) {
            if (this.gameState.isGameOver) {
                this.logger.groupEnd();
                return;
            }
            this.gameState.day++;

            // Pulse News Ticker
            if (this.simulationService) {
                this.simulationService.pulseNewsTicker();
            }

            // --- UPGRADE SYSTEM: Passive Repair (Nano Machines) ---
            // Only applies to the ACTIVE ship while traveling (advanceDays is driven by travel)
            // Use Additive Rate (e.g. 0.01 + 0.02 = 0.03)
            const passiveRepairRate = GameAttributes.getPassiveRepairRate(activeUpgrades);
            
            if (passiveRepairRate > 0 && this.simulationService) {
                const effectiveStats = this.simulationService.getEffectiveShipStats(activeShipId);
                if (activeShipState.health < effectiveStats.maxHealth) {
                    const healAmount = effectiveStats.maxHealth * passiveRepairRate;
                    activeShipState.health = Math.min(
                        effectiveStats.maxHealth, 
                        activeShipState.health + healAmount
                    );
                }
            }
            // --- END UPGRADE SYSTEM ---

            // --- Legacy Attribute Support (Flat Decay) ---
            // Keeps compatibility for any old "Flat Daily" decay attributes if they exist
            const shipAttrs = GameAttributes.getShipAttributes(activeShipId); 
            shipAttrs.forEach(attrId => {
                const def = GameAttributes.getDefinition(attrId);
                if (def && def.type === ATTRIBUTE_TYPES.MOD_HULL_DECAY && def.mode === 'flat_daily') {
                    if (activeShipState.health > 1) {
                        activeShipState.health = Math.max(1, activeShipState.health - def.value);
                    }
                }
            });

            // Age & Milestone Checks
            const dayOfYear = (this.gameState.day - 1) % 365;
            const currentYear = DB.DATE_CONFIG.START_YEAR + Math.floor((this.gameState.day - 1) / 365);
            
            if (dayOfYear === 11 && currentYear > this.gameState.player.lastBirthdayYear) {
                this.gameState.player.playerAge++;
                this.gameState.player.birthdayProfitBonus += 0.01; // 1% extra profit per year
                this.gameState.player.lastBirthdayYear = currentYear;
                this.uiManager.queueModal('event-modal', 'Happy Birthday!', `You turned ${this.gameState.player.playerAge}. Your experience grants you a permanent +1% profit bonus on all trades.`);
            }

            this._checkAgeEvents();
            this.marketService.evolveMarketPrices();

            // Weekly Market Updates
            if ((this.gameState.day - this.gameState.lastMarketUpdateDay) >= 7) {
                this.marketService.checkForSystemStateChange();
                this.marketService.replenishMarketInventory();
                this.marketService._updateShipyardStock(); 
                this.gameState.lastMarketUpdateDay = this.gameState.day;
            }

            // Intel Expiration
            const activeDeal = this.gameState.activeIntelDeal; 
            if (activeDeal && this.gameState.day > activeDeal.expiryDay) {
                const expiredDeal = activeDeal;
                this.gameState.activeIntelDeal = null;
                // Remove the expired packet from the source market to prevent re-buying immediately
                if (expiredDeal.sourceSaleLocationId && expiredDeal.sourcePacketId) {
                    const saleLocationMarket = this.gameState.intelMarket[expiredDeal.sourceSaleLocationId];
                    if (saleLocationMarket) {
                        this.gameState.intelMarket[expiredDeal.sourceSaleLocationId] = saleLocationMarket.filter(
                            packet => packet.id !== expiredDeal.sourcePacketId
                        );
                    }
                }
                this.simulationService.pushNewsMessage(`Intel on ${DB.COMMODITIES.find(c => c.id === expiredDeal.commodityId).name} at ${DB.MARKETS.find(m => m.id === expiredDeal.targetMarketId).name} has expired.`, 'INTEL');
            }

            // Periodic Intel Generation
            if (this.intelService && (this.gameState.day % 120 === 1)) {
                this.intelService.generateIntelRefresh();
            }
            
            // Passive Repair for INACTIVE ships (Hangar)
            // Stored ships repair slowly over time (Base Game Rule)
            this.gameState.player.ownedShipIds.forEach(shipId => {
                if (shipId !== this.gameState.player.activeShipId) {
                    const ship = DB.SHIPS[shipId]; 
                    // Inactive ships use base stats for simplicity/performance
                    const repairAmount = ship.maxHealth * GAME_RULES.PASSIVE_REPAIR_RATE;
                    this.gameState.player.shipStates[shipId].health = Math.min(ship.maxHealth, this.gameState.player.shipStates[shipId].health + repairAmount);
                }
            });

            // --- UPGRADE SYSTEM: Debt Interest (Syndicate Badge) ---
            if (this.gameState.player.debt > 0 && (this.gameState.day - this.gameState.lastInterestChargeDay) >= GAME_RULES.INTEREST_INTERVAL) {
                const rawInterest = this.gameState.player.monthlyInterestAmount;
                
                // Apply Multiplicative Modifier (e.g. 0.80 for 20% off)
                const interestMod = GameAttributes.getInterestModifier(activeUpgrades);
                const finalInterest = Math.floor(rawInterest * interestMod);

                this.gameState.player.debt += finalInterest;
                
                // Log the transaction
                if (this.simulationService) {
                    this.simulationService._logTransaction('loan', finalInterest, 'Monthly interest charge');
                }
                
                this.logger.info.system('Finance', this.gameState.day, 'INTEREST', `Charged ${formatCredits(finalInterest)} interest on debt (Base: ${rawInterest}, Mod: ${interestMod}).`);
                this.gameState.lastInterestChargeDay = this.gameState.day;
            }
            // --- END UPGRADE SYSTEM ---

            this._applyGarnishment();
        }
        
        this.logger.groupEnd();
        this.gameState.setState({});
    }

    _checkAgeEvents() {
        DB.AGE_EVENTS.forEach(event => {
            if (this.gameState.player.seenEvents.includes(event.id)) return;

            // Trigger conditions
            if ((event.trigger.day && this.gameState.day >= event.trigger.day) || 
                (event.trigger.credits && this.gameState.player.credits >= event.trigger.credits)) {
                
                this.gameState.player.seenEvents.push(event.id);
                this.uiManager.showAgeEventModal(event, (choice) => {
                    if (this.simulationService) {
                        this.simulationService._applyPerk(choice);
                    }
                });
            }
        });
    }

    _checkMilestones() {
        const { credits, revealedTier } = this.gameState.player;
        let currentTier = revealedTier;
        
        // Find the next milestone
        let nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === currentTier + 1);
        
        // Check if we passed it (and potentially subsequent ones)
        while (nextMilestone && credits >= nextMilestone.threshold) {
            this.gameState.player.revealedTier = nextMilestone.revealsTier;
            
            // Notify
            this.logger.info.player(this.gameState.day, 'MILESTONE', `Wealth milestone reached! Tier ${nextMilestone.revealsTier} commodities unlocked.`);
            this.uiManager.queueModal('event-modal', 'Market Update', `Your increasing wealth has granted you access to Tier ${nextMilestone.revealsTier} commodities.`);
            
            currentTier = nextMilestone.revealsTier;
            nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === currentTier + 1);
        }
        
        if (this.gameState.player.revealedTier !== revealedTier) {
            this.gameState.setState({});
        }
    }

    _applyGarnishment() {
        const { player, day } = this.gameState;
        if (player.debt > 0 && player.loanStartDate && (day - player.loanStartDate) >= GAME_RULES.LOAN_GARNISHMENT_DAYS) {
            // Apply garnishment on the same cycle as interest
            if ((day - this.gameState.lastInterestChargeDay) % GAME_RULES.INTEREST_INTERVAL !== 0) return;

            const garnishedAmount = Math.floor(player.credits * GAME_RULES.LOAN_GARNISHMENT_PERCENT);
            if (garnishedAmount > 0) {
                player.credits -= garnishedAmount;
                if (this.simulationService) {
                    this.simulationService._logTransaction('debt', -garnishedAmount, 'Monthly credit garnishment');
                    this.simulationService._checkGameOverConditions(); 
                }
            }

            if (!player.seenGarnishmentWarning) {
                const msg = "Your loan is delinquent. Your lender is now garnishing 14% of your credits monthly until the debt is paid.";
                this.uiManager.queueModal('event-modal', "Credit Garnishment Notice", msg, null, { buttonClass: 'bg-red-800/80' });
                player.seenGarnishmentWarning = true;
            }
        }
    }
    
    getCurrentDay() {
        return this.gameState.day;
    }
}