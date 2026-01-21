// js/services/SimulationService.js
/**
 * @fileoverview This file contains the SimulationService class, which acts as the core game engine
 * facade. It instantiates all specialized game logic services and delegates calls to them,
 * providing a single, clean API for the EventManager.
 */
import { DB } from '../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../utils.js';
import { GAME_RULES, SAVE_KEY, SHIP_IDS, PERK_IDS, ACTION_IDS } from '../data/constants.js';
import { playBlockingAnimation, playBlockingAnimationAndRemove } from './ui/AnimationService.js';
import { MarketService } from './simulation/MarketService.js';
import { IntroService } from './game/IntroService.js';
import { PlayerActionService } from './player/PlayerActionService.js';
import { TimeService } from './world/TimeService.js';
import { TravelService } from './world/TravelService.js';
import { IntelService } from './IntelService.js';
import { GameAttributes } from './GameAttributes.js'; 
import { RandomEventService } from './RandomEventService.js'; // IMPORT ADDED

/**
 * @class SimulationService
 * @description Manages the core game loop, player actions, and state changes by delegating to specialized services.
 */
export class SimulationService {
    /**
     * @param {import('./GameState.js').GameState} gameState - The central state object.
     * @param {import('./UIManager.js').UIManager} uiManager - The UI rendering service.
     * @param {import('./LoggingService.js').Logger} logger - The logging utility.
     * @param {import('./NewsTickerService.js').NewsTickerService} newsTickerService - The news ticker service.
     */
    constructor(gameState, uiManager, logger, newsTickerService) { 
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.newsTickerService = newsTickerService; 
        this.tutorialService = null; // Injected post-instantiation.
        this.missionService = null;  // Injected post-instantiation.
        
        this.intelService = null; 

         // Instantiate all services
        this.marketService = new MarketService(gameState);
        this.timeService = new TimeService(gameState, this.marketService, uiManager, logger, newsTickerService); 
        this.travelService = new TravelService(gameState, uiManager, this.timeService, logger, this);
        this.introService = new IntroService(gameState, uiManager, logger, this);
        this.playerActionService = new PlayerActionService(gameState, uiManager, null, this.marketService, this.timeService, logger, this);

        // --- EVENT SYSTEM 2.0 ---
        this.randomEventService = new RandomEventService();
        // ------------------------

        this.intelService = new IntelService(gameState, this.timeService, this.marketService, this.newsTickerService, logger);
        
        // Inject intelService into services that depend on it
        this.timeService.intelService = this.intelService;
        this.uiManager.setIntelService(this.intelService); 

        // Inject cross-dependencies that couldn't be set in constructors
        this.timeService.simulationService = this;
        
        this.newsTickerService.setServices(this, this.marketService);
    }

    /**
     * Injects the TutorialService after all services have been instantiated.
     * @param {import('./TutorialService.js').TutorialService} tutorialService
     */
    setTutorialService(tutorialService) {
        this.tutorialService = tutorialService;
    }

    /**
     * Injects the MissionService after all services have been instantiated.
     * @param {import('./MissionService.js').MissionService} missionService
     */
    setMissionService(missionService) {
        this.missionService = missionService;
        this.playerActionService.missionService = missionService;
    }

    // --- EVENT SYSTEM 2.0 METHODS ---

    /**
     * Forces a specific Random Event to trigger immediately.
     * Used by DebugService.
     * @param {string} eventId 
     */
    forceTriggerEvent(eventId) {
        const rawEventDef = this.randomEventService.getEventById(eventId);
        if (!rawEventDef) {
            this.logger.error('SimulationService', `Cannot force trigger event: ID '${eventId}' not found.`);
            return;
        }

        this.logger.info.system('SimulationService', this.gameState.day, 'EVENT_FORCE', `Debug forcing event: ${rawEventDef.template.title}`);
        
        // Clone and process requirements to determine disabled state
        const eventDef = { ...rawEventDef };
        if (eventDef.choices) {
            eventDef.choices = rawEventDef.choices.map(choice => {
                const isAllowed = this.randomEventService.evaluator.checkAll(
                    choice.requirements, 
                    this.gameState, 
                    this
                );
                return { ...choice, disabled: !isAllowed };
            });
        }
        
        // Pass the event to the UI Manager to display the modal
        // The modal will call back to resolveEventChoice
        this.uiManager.showRandomEventModal(eventDef, (choiceId) => {
            this.resolveEventChoice(eventId, choiceId);
        });
    }

    /**
     * Resolves a player's choice from a Random Event.
     * @param {string} eventId 
     * @param {string} choiceId 
     */
    resolveEventChoice(eventId, choiceId) {
        // 1. Calculate Outcome
        const result = this.randomEventService.resolveChoice(eventId, choiceId, this.gameState, this);
        
        if (!result) return;

        // 2. Apply Effects
        this._applyEventEffects(result.effects);

        // 3. Show Result Modal
        this.uiManager.showEventResultModal(result.text, result.effects);
    }

    /**
     * Applies the calculated effects from an event outcome.
     * @private
     */
    _applyEventEffects(effects) {
        effects.forEach(eff => {
            switch (eff.type) {
                case 'EFF_CREDITS':
                    this.gameState.player.credits += eff.value;
                    break;
                case 'EFF_FUEL':
                    const ship = this._getActiveShip();
                    if(ship) this.gameState.player.shipStates[ship.id].fuel = Math.max(0, Math.min(ship.maxFuel, ship.fuel + eff.value));
                    break;
                case 'EFF_HULL':
                    const s = this._getActiveShip();
                    // value is negative for damage
                    if(s) this.gameState.player.shipStates[s.id].health = Math.max(0, Math.min(s.maxHealth, s.health + eff.value));
                    break;
                case 'EFF_TRAVEL_TIME':
                case 'EFF_MODIFY_TRAVEL':
                     // Check if pendingTravel exists to prevent crash (e.g. debug trigger)
                     if (this.gameState.pendingTravel) {
                        this.gameState.pendingTravel.travelTimeAdd = (this.gameState.pendingTravel.travelTimeAdd || 0) + eff.value;
                    }
                    break;
                case 'EFF_ADD_ITEM':
                    const invAdd = this._getActiveInventory();
                    if(invAdd && invAdd[eff.target]) {
                        invAdd[eff.target].quantity += eff.value;
                    }
                    break;
                case 'EFF_REMOVE_ITEM':
                    const invRem = this._getActiveInventory();
                    if(invRem && invRem[eff.target]) {
                        invRem[eff.target].quantity = Math.max(0, invRem[eff.target].quantity - eff.value);
                    }
                    break;
                case 'EFF_ADD_RANDOM_CARGO':
                    // Add random tier 1-3 commodity logic here if needed, or handle in service
                    break;
                case 'EFF_LOSE_RANDOM_CARGO':
                    // Logic handled in resolver or here
                    break;
            }
        });
        this.gameState.setState({}); // Commit changes
    }

    // --- FACADE METHODS ---
    // These methods provide a clean API to the EventManager and other high-level services,
    // delegating the actual work to the specialized services.

    // IntroService Delegation
    startIntroSequence() { this.introService.start(); }
    handleIntroClick(e) { this.introService.handleIntroClick(e); }
    _continueIntroSequence(batchId) { this.introService.continueAfterTutorial(batchId); }
    
    // PlayerActionService Delegation
    buyItem(goodId, quantity) { return this.playerActionService.buyItem(goodId, quantity); }
    sellItem(goodId, quantity) { return this.playerActionService.sellItem(goodId, quantity); }
    
    /**
     * Orchestrates buying a ship: Validates, plays animation, then executes.
     * @param {string} shipId
     * @param {Event} event
     */
    async buyShip(shipId, event) {
        
        // 1. Validate
        const validation = this.playerActionService.validateBuyShip(shipId);
        if (!validation.success) {
            this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
            return null;
        }

        // 2. Find the button that was clicked
        const purchaseButton = event.target.closest('.action-button');

        // 3. Trigger the BLOCKING 1-second glow
        if (purchaseButton) {
            await playBlockingAnimationAndRemove(purchaseButton, 'is-glowing-green');
        }
        
        // 4. Wait one animation frame to prevent animation race condition
        await new Promise(resolve => requestAnimationFrame(resolve));

        // 5. Animate (Dematerialize)
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting buy animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId);
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Buy animation complete. Executing logic.`);

        // 6. Execute
        return this.playerActionService.executeBuyShip(shipId, event);
    }

    /**
     * Orchestrates selling a ship: Validates, plays animation, then executes.
     * @param {string} shipId
     * @param {Event} event
     */
    async sellShip(shipId, event) {
        // 1. Validate
        const validation = this.playerActionService.validateSellShip(shipId);
        if (!validation.success) {
            this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
            return false;
        }

        // 2. Find the button that was clicked
        const sellButton = event.target.closest('.action-button');

        // 3. Trigger the BLOCKING 1-second glow
        if (sellButton) {
            await playBlockingAnimationAndRemove(sellButton, 'is-glowing-red');
        }
        
        // 4. Wait one animation frame to prevent animation race condition
        await new Promise(resolve => requestAnimationFrame(resolve));

        // 5. Animate (Dematerialize)
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting sell animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId);
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Sell animation complete. Executing logic.`);

        // 6. Execute
        return this.playerActionService.executeSellShip(shipId, event);
    }

    /**
     * Orchestrates boarding a ship: Glows button, waits 1s, sets state, then animates card.
     * @param {string} shipId
     * @param {Event} event - The click event, used to find the button for animation.
     * @returns {Promise<boolean>} True on success, false on failure.
     */
    async boardShip(shipId, event) {
        // 1. Validate
        const validation = this.playerActionService.validateSetActiveShip(shipId);
        if (!validation.success) {
            if (validation.errorTitle !== "Action Redundant") {
                 this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
            }
            return false;
        }

        // 2. Find the button that was clicked
        const boardButton = event.target.closest('.action-button');
        
        // 3. Find the sibling "Sell" button and disable it immediately
        if (boardButton) {
            const sellButton = boardButton.closest('.grid').querySelector('[data-action="sell-ship"]');
            if (sellButton) {
                sellButton.disabled = true;
            }
        }

        // 4. Trigger the BLOCKING 1-second glow on the "Board" button
         if (boardButton) {
            await playBlockingAnimationAndRemove(boardButton, 'is-glowing-button');
        }

        // 5. Execute the state change (this will re-render button to "ACTIVE")
        this.playerActionService.executeSetActiveShip(shipId);
        
        // 6. Check Tutorial
        if (this.gameState.introSequenceActive) {
            this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELECT_SHIP });
        }
   
        // 7. Run the BLOCKING card animation *LAST*
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting board animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId, 'is-boarding');
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Board animation complete.`);
        
        return true;
    }

    /**
     * Pays off the player's entire outstanding debt.
     * @param {Event} [event] - The click event for placing floating text.
     */
    payOffDebt(event) { this.playerActionService.payOffDebt(event); }

    /**
     * Allows the player to take out a loan, adding to their debt.
     * @param {object} loanData - Contains amount, fee, and interest for the loan.
     * @param {Event} [event] - The click event for placing floating text.
     */
    takeLoan(loanData, event) { this.playerActionService.takeLoan(loanData, event); }
    
    purchaseLicense(licenseId) { return this.playerActionService.purchaseLicense(licenseId); }
    
    refuelTick() { return this.playerActionService.refuelTick(); }
    repairTick() { return this.playerActionService.repairTick(); }
    
    // TravelService Delegation
    travelTo(locationId) { this.travelService.travelTo(locationId); }
    resumeTravel() { this.travelService.resumeTravel(); }

    // NewsTickerService Delegation
    /**
     * Pushes a new message to the news ticker.
     * @param {string} text - The message content.
     * @param {string} type - 'SYSTEM', 'INTEL', 'FLAVOR', 'ALERT'
     * @param {boolean} [isPriority=false] - If true, prepends to the front.
     */
    pushNewsMessage(text, type, isPriority = false) {
        if (this.newsTickerService) {
            this.newsTickerService.pushMessage(text, type, isPriority);
        }
    }

    /**
     * Pulses the news ticker for daily updates (e.g., flavor text).
     */
    pulseNewsTicker() {
        if (this.newsTickerService) {
            this.newsTickerService.pulse();
        }
    }

    // --- CORE & SHARED METHODS ---

    /**
     * Sets the active navigation tab and screen.
     * @param {string} navId
     * @param {string} screenId
     */
    setScreen(navId, screenId) {
        const newLastActive = { ...this.gameState.lastActiveScreen, [navId]: screenId };
        this.gameState.setState({ 
            activeNav: navId, 
             activeScreen: screenId,
            lastActiveScreen: newLastActive 
        });

        if (this.tutorialService) {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: screenId });
        }
    }

    /**
     * Sets the active tab on the Intel screen.
     * @param {string} tabId The ID of the tab content to activate (e.g., 'intel-codex-content').
     */
    setIntelTab(tabId) {
        if (this.gameState.uiState.activeIntelTab !== tabId) {
            this.gameState.uiState.activeIntelTab = tabId;
            this.gameState.setState({ 
                uiState: this.gameState.uiState 
            });
        }
    }

    /**
     * Sets the hangar/shipyard toggle state.
     * @param {string} mode - 'hangar' or 'shipyard'.
     */
    setHangarShipyardMode(mode) {
        if (this.gameState.uiState.hangarShipyardToggleState !== mode) {
            this.gameState.uiState.hangarShipyardToggleState = mode;
            this.gameState.setState({});
        }
    }
    
    /**
     * Updates the active index for the hangar or shipyard carousel.
     * @param {number} index
     * @param {string} mode
     */
    setHangarCarouselIndex(index, mode) {
        if (mode === 'hangar') {
            this.gameState.uiState.hangarActiveIndex = index;
        } else {
            this.gameState.uiState.shipyardActiveIndex = index;
        }
        this.gameState.setState({});
    }

    /**
     * Cycles the hangar/shipyard carousel.
     * @param {string} direction - 'next' or 'prev'.
     */
    cycleHangarCarousel(direction) {
        const { uiState, player } = this.gameState;
        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const shipList = isHangarMode ? player.ownedShipIds : this._getShipyardInventory().map(([id]) => id);
        
        if (shipList.length <= 1) return;

        let currentIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        if (direction === 'next') {
            currentIndex = (currentIndex + 1) % shipList.length;
        } else {
            currentIndex = (currentIndex - 1 + shipList.length) % shipList.length;
        }

        this.setHangarCarouselIndex(currentIndex, isHangarMode ? 'hangar' : 'shipyard');
    }

    /**
     * Ends the game and displays a final message.
     * @param {string} message
     * @private
     */
    _gameOver(message) {
        if (this.gameState.isGameOver) return; // Prevent multiple game over triggers
        this.logger.info.state(this.gameState.day, 'GAME_OVER', message);
        this.gameState.setState({ isGameOver: true });
        this.uiManager.queueModal('event-modal', "Game Over", message, () => {
            localStorage.removeItem(SAVE_KEY);
            window.location.reload();
        }, { buttonText: 'Restart' });
    }

    /**
     * Checks for any condition that would end the game, such as bankruptcy.
     * @private
     */
    _checkGameOverConditions() {
        if (this.gameState.player.credits <= 0) {
            this._gameOver("Your credit balance has fallen to zero. With no funds to operate, your trading career has come to an end.");
        }
    }

    // --- HELPER & PRIVATE METHODS (SHARED) ---

    /**
     * Calculates ship stats including upgrade modifiers (e.g. Max Fuel + 20%).
     * This is the single source of truth for "Effective Stats".
     * @param {string} shipId 
     * @returns {object} The ship definition with modified stats.
     */
    getEffectiveShipStats(shipId) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return null;

        const state = this.gameState.getState();
        const shipState = state.player.shipStates[shipId];
        
        // If not owned or no upgrades, return base stats (defensive copy)
        if (!shipState || !shipState.upgrades) return { ...ship };

        const upgrades = shipState.upgrades;
        // Calculate Additive Modifiers (1.0 + 0.1 + 0.1 = 1.2)
        const hullMod = GameAttributes.getMaxHullModifier(upgrades);
        const fuelMod = GameAttributes.getMaxFuelModifier(upgrades);
        const cargoMod = GameAttributes.getMaxCargoModifier(upgrades);

        return {
            ...ship,
            maxHealth: Math.round(ship.maxHealth * hullMod),
            maxFuel: Math.round(ship.maxFuel * fuelMod),
            cargoCapacity: Math.round(ship.cargoCapacity * cargoMod)
        };
    }

    addShipToHangar(shipId) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return;
        this.gameState.player.ownedShipIds.push(shipId);
        
        // Initialize with empty upgrades
        this.gameState.player.shipStates[shipId] = { 
            health: ship.maxHealth, 
            fuel: ship.maxFuel, 
            hullAlerts: { one: false, two: false },
            upgrades: [] // Added upgrade array
        };
        
        if (!this.gameState.player.inventories[shipId]) {
            this.gameState.player.inventories[shipId] = {};
            DB.COMMODITIES.forEach(c => {
                this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
            });
        }
    }

    _applyPerk(choice) {
        this.logger.info.player(this.gameState.day, 'PERK_APPLIED', `Gained perk: ${choice.title}`);
        if (choice.perkId) this.gameState.player.activePerks[choice.perkId] = true;
        if (choice.playerTitle) this.gameState.player.playerTitle = choice.playerTitle;
        if (choice.perkId === PERK_IDS.MERCHANT_GUILD_SHIP) {
            this.addShipToHangar(SHIP_IDS.STALWART);
            this.uiManager.queueModal('event-modal', 'Vessel Delivered', `The Merchant's Guild has delivered a new ${DB.SHIPS[SHIP_IDS.STALWART].name} to your hangar.`);
        }
        this.gameState.setState({});
    }
    
    _getActiveShip() {
        const state = this.gameState;
        const activeId = state.player.activeShipId;
        if (!activeId) return null;
        
        // Return Effective Stats
        const effectiveStats = this.getEffectiveShipStats(activeId);
        return { 
            id: activeId, 
            ...effectiveStats, 
            ...state.player.shipStates[activeId] 
        };
    }

    _getActiveInventory() {
        if (!this.gameState.player.activeShipId) return null;
        return this.gameState.player.inventories[this.gameState.player.activeShipId];
    }
    
    _checkHullWarnings(shipId) {
        const shipState = this.gameState.player.shipStates[shipId];
        const effectiveStats = this.getEffectiveShipStats(shipId);
        
        const healthPct = (shipState.health / effectiveStats.maxHealth) * 100;
        
        if (healthPct <= 15 && !shipState.hullAlerts.two) { shipState.hullAlerts.two = true; } 
        else if (healthPct <= 30 && !shipState.hullAlerts.one) { shipState.hullAlerts.one = true; }
        if (healthPct > 30) shipState.hullAlerts.one = false;
        if (healthPct > 15) shipState.hullAlerts.two = false;
    }

    _logTransaction(type, amount, description) {
        this.gameState.player.financeLog.push({ 
            day: this.gameState.day,
            type: type, 
            amount: amount,
            balance: this.gameState.player.credits,
            description: description
        });
        // Enforce the history limit
        while (this.gameState.player.financeLog.length > GAME_RULES.FINANCE_HISTORY_LENGTH) {
            this.gameState.player.financeLog.shift();
        }
    }

    _logConsolidatedTrade(goodName, quantity, transactionValue) {
        const log = this.gameState.player.financeLog;
        const isBuy = transactionValue < 0;
        const actionWord = isBuy ? 'Bought' : 'Sold';
        const existingEntry = log.find(entry => 
            entry.day === this.gameState.day &&
            entry.type === 'trade' &&
            entry.description.startsWith(`${actionWord}`) &&
             entry.description.endsWith(` ${goodName}`) &&
            ((isBuy && entry.amount < 0) || (!isBuy && entry.amount > 0))
        );
        if (existingEntry) {
            existingEntry.amount += transactionValue;
            existingEntry.balance = this.gameState.player.credits;
            const match = existingEntry.description.match(/\s(\d+)x\s/);
            if (match) {
                const currentQty = parseInt(match[1], 10);
                existingEntry.description = `${actionWord} ${currentQty + quantity}x ${goodName}`;
            }
        } else {
             this._logTransaction('trade', transactionValue, `${actionWord} ${quantity}x ${goodName}`);
        }
    }

    _logConsolidatedTransaction(type, amount, description) {
        const log = this.gameState.player.financeLog;
        const lastEntry = log.length > 0 ? log[log.length - 1] : null;
        if (lastEntry && lastEntry.day === this.gameState.day && lastEntry.type === type) {
            lastEntry.amount += amount;
            lastEntry.balance = this.gameState.player.credits;
        } else {
            this._logTransaction(type, amount, description);
        }
    }

    _getShipyardInventory() {
        const { tutorials, player, currentLocationId, market } = this.gameState;
        if (tutorials.activeBatchId === 'intro_hangar') {
            return player.ownedShipIds.length > 0 ? [] : [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE].map(id => [id, DB.SHIPS[id]]);
        } else {
            const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
            return shipsForSaleIds.map(id => [id, DB.SHIPS[id]]).filter(([id]) => !player.ownedShipIds.includes(id));
        }
    }

    _grantRewards(rewards, sourceName) {
        rewards.forEach(reward => {
            if (reward.type === 'credits') {
              
                // Apply credit cap
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + reward.amount);

                this._logTransaction('mission', reward.amount, `Reward: ${sourceName}`);
                this.uiManager.createFloatingText(`+${formatCredits(reward.amount, false)}`, window.innerWidth / 2, window.innerHeight / 2, '#34d399');
            }
            if (reward.type === 'license') {
                if (!this.gameState.player.unlockedLicenseIds.includes(reward.licenseId)) {
                 
                     this.gameState.player.unlockedLicenseIds.push(reward.licenseId);
                    const license = DB.LICENSES[reward.licenseId];
                    this.uiManager.triggerEffect('systemSurge', { theme: 'tan' });
                    this.logger.info.player(this.gameState.day, 'LICENSE_GRANTED', `Received ${license.name}.`);
                }
            }
        });
    }
    
    grantMissionCargo(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission || !mission.providedCargo) return;
        const inventory = this._getActiveInventory();
        if (!inventory) {
            this.logger.error('SimulationService', 'Cannot grant mission cargo: No active inventory found.');
            return;
        }
        mission.providedCargo.forEach(cargo => {
            if (!inventory[cargo.goodId]) {
                inventory[cargo.goodId] = { quantity: 0, avgCost: 0 };
         
             }
            inventory[cargo.goodId].quantity += cargo.quantity;
            this.logger.info.player(this.gameState.day, 'CARGO_GRANT', `Received ${cargo.quantity}x ${DB.COMMODITIES.find(c=>c.id === cargo.goodId).name} from ${mission.name}.`);
        });
        if (this.missionService) {
            this.missionService.checkTriggers();
        }
    }
}