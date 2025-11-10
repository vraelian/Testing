// js/services/SimulationService.js
/**
 * @fileoverview This file contains the SimulationService class, which acts as the core game engine
 * facade. It instantiates all specialized game logic services and delegates calls to them,
 * providing a single, clean API for the EventManager.
 */
import { DB } from '../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../utils.js';
// VIRTUAL WORKBENCH: Import new playBlockingAnimationAndRemove
import { GAME_RULES, SAVE_KEY, SHIP_IDS, PERK_IDS, ACTION_IDS } from '../data/constants.js';
import { playBlockingAnimationAndRemove } from './ui/AnimationService.js';
// END VIRTUAL WORKBENCH
import { MarketService } from './simulation/MarketService.js';
import { IntroService } from './game/IntroService.js';
import { PlayerActionService } from './player/PlayerActionService.js';
import { TimeService } from './world/TimeService.js';
import { TravelService } from './world/TravelService.js';
// --- VIRTUAL WORKBENCH: IMPORT ---
import { IntelService } from './IntelService.js';
// --- END VIRTUAL WORKBENCH ---

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
    constructor(gameState, uiManager, logger, newsTickerService) { // MODIFIED
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.newsTickerService = newsTickerService; // ADDED
        this.tutorialService = null; // Injected post-instantiation.
        this.missionService = null;  // Injected post-instantiation.
        
        // --- VIRTUAL WORKBENCH: ADD INTEL SERVICE ---
        this.intelService = null; // Will be instantiated below
        // --- END VIRTUAL WORKBENCH ---

        // Instantiate all services
        this.marketService = new MarketService(gameState);
        // MODIFIED: Pass newsTickerService
        this.timeService = new TimeService(gameState, this.marketService, uiManager, logger, newsTickerService); 
        this.travelService = new TravelService(gameState, uiManager, this.timeService, logger, this);
        this.introService = new IntroService(gameState, uiManager, logger, this);
        this.playerActionService = new PlayerActionService(gameState, uiManager, null, this.marketService, this.timeService, logger, this);

        // --- VIRTUAL WORKBENCH: INSTANTIATE AND INJECT INTEL SERVICE ---
        // Must be after dependencies (time, market, news) are created
        this.intelService = new IntelService(gameState, this.timeService, this.marketService, this.newsTickerService, logger);
        
        // Inject intelService into services that depend on it
        this.timeService.intelService = this.intelService;
        this.uiManager.setIntelService(this.intelService); // UIManager will need this setter
        // --- END VIRTUAL WORKBENCH ---

        // Inject cross-dependencies that couldn't be set in constructors
        this.timeService.simulationService = this;
        
        // --- [NEW V2 CHANGE] ---
        // Inject services required by NewsTickerService for dynamic content.
        this.newsTickerService.setServices(this, this.marketService);
        // --- [END NEW V2 CHANGE] ---
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

        // 2. Animate
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting buy animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId);
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Buy animation complete. Executing logic.`);

        // 3. Execute
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

        // 2. Animate
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting sell animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId);
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Sell animation complete. Executing logic.`);

        // 3. Execute
        return this.playerActionService.executeSellShip(shipId, event);
    }

    // --- VIRTUAL WORKBENCH: RE-ORCHESTRATE boardShip ---
    /**
     * Orchestrates boarding a ship: Glows button, waits 1s, sets state, then animates card.
     * @param {string} shipId
     * @param {Event} event - The click event, used to find the button for animation.
     * @returns {Promise<boolean>} True on success, false on failure.
     * @JSDoc
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

        // --- NEW SEQUENCE ---

        // 2. Find the button that was clicked
        const boardButton = event.target.closest('.action-button');
        
        // 3. (NEW) Find the sibling "Sell" button and disable it immediately
        if (boardButton) {
            const sellButton = boardButton.closest('.grid').querySelector('[data-action="sell-ship"]');
            if (sellButton) {
                sellButton.disabled = true;
            }
        }

        // 4. Trigger the BLOCKING 1-second glow on the "Board" button
        if (boardButton) {
            // This is the new BLOCKING helper that waits for the animation to end
            await playBlockingAnimationAndRemove(boardButton, 'is-glowing-button');
        }

        // 5. Execute the state change (this will re-render button to "ACTIVE")
        this.playerActionService.executeSetActiveShip(shipId);
        
        // 6. Check Tutorial
        if (this.gameState.introSequenceActive) {
            this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELECT_SHIP });
        }
        
        // 7. Run the BLOCKING card animation *LAST*
        // We must wait one frame for the UI to re-render *before* we can
        // find the element we want to animate.
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting board animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId, 'is-boarding');
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Board animation complete.`);
        // --- END NEW SEQUENCE ---
        
        return true;
    }
    // --- END VIRTUAL WORKBENCH ---

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
    
    // --- VIRTUAL WORKBENCH: REMOVE OBSOLETE METHOD ---
    // purchaseIntel(cost) { this.playerActionService.purchaseIntel(cost); } // This is now handled by UIManager + IntelService
    // --- END VIRTUAL WORKBENCH ---

    refuelTick() { return this.playerActionService.refuelTick(); }
    repairTick() { return this.playerActionService.repairTick(); }
    
    // TravelService Delegation
    travelTo(locationId) { this.travelService.travelTo(locationId); }
    resumeTravel() { this.travelService.resumeTravel(); }

    // ADDED: NewsTickerService Delegation
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
    // These methods remain in the facade because they are either simple state setters
    // or are helpers required by multiple services.

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

        // --- [NEW V2 CHANGE] ---
        // MODIFICATION: Removed the onLocationChange() call from this function.
        // It will now be called by TravelService when the location *actually* changes.
        // --- [END NEW V2 CHANGE] ---

        if (this.tutorialService) {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: screenId });
        }
    }

    // --- VIRTUAL WORKBENCH: ADD MISSING METHOD ---
    /**
     * Sets the active tab on the Intel screen.
     * @param {string} tabId The ID of the tab content to activate (e.g., 'intel-codex-content').
     * @JSDoc
     */
    setIntelTab(tabId) {
        if (this.gameState.uiState.activeIntelTab !== tabId) {
            this.gameState.uiState.activeIntelTab = tabId;
            this.gameState.setState({ 
                uiState: this.gameState.uiState 
            });
        }
    }
    // --- END VIRTUAL WORKBENCH ---

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
     * This is intended to be called only by automated processes that can
     * reduce credits without a prior "insufficient funds" check (e.g., garnishment, debug).
     * @private
     */
    _checkGameOverConditions() {
        // This is the performant check: it reads directly from the state
        // object instead of creating an expensive deep copy with getState().
        if (this.gameState.player.credits <= 0) {
            this._gameOver("Your credit balance has fallen to zero. With no funds to operate, your trading career has come to an end.");
        }
    }

    // --- HELPER & PRIVATE METHODS (SHARED) ---
    // These are kept here to be accessible by the specialized services that need them.

    addShipToHangar(shipId) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return;
        this.gameState.player.ownedShipIds.push(shipId);
        this.gameState.player.shipStates[shipId] = { health: ship.maxHealth, fuel: ship.maxFuel, hullAlerts: { one: false, two: false } };
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
        return { id: activeId, ...DB.SHIPS[activeId], ...state.player.shipStates[activeId] };
    }

    _getActiveInventory() {
        if (!this.gameState.player.activeShipId) return null;
        return this.gameState.player.inventories[this.gameState.player.activeShipId];
    }
    
    _checkHullWarnings(shipId) {
        const shipState = this.gameState.player.shipStates[shipId];
        const shipStatic = DB.SHIPS[shipId];
        const healthPct = (shipState.health / shipStatic.maxHealth) * 100;
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
                this.gameState.player.credits += reward.amount;
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