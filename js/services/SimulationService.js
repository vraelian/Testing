// js/services/SimulationService.js
/**
 * @fileoverview This file contains the SimulationService class, which acts as the core game engine
 * facade. It instantiates all specialized game logic services and delegates calls to them,
 * providing a single, clean API for the EventManager.
 */
import { DB } from '../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../utils.js';
import { GAME_RULES, SAVE_KEY, SHIP_IDS, PERK_IDS } from '../data/constants.js';
import { MarketService } from './simulation/MarketService.js';
import { IntroService } from './game/IntroService.js';
import { PlayerActionService } from './player/PlayerActionService.js';
import { TimeService } from './world/TimeService.js';
import { TravelService } from './world/TravelService.js';

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

        // Instantiate all services
        this.marketService = new MarketService(gameState);
        // MODIFIED: Pass newsTickerService
        this.timeService = new TimeService(gameState, this.marketService, uiManager, logger, newsTickerService); 
        this.travelService = new TravelService(gameState, uiManager, this.timeService, logger, this);
        this.introService = new IntroService(gameState, uiManager, logger, this);
        this.playerActionService = new PlayerActionService(gameState, uiManager, null, this.marketService, this.timeService, logger, this);

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
    initiateShipTransactionAnimation(shipId, action, event) { this.playerActionService.initiateShipTransactionAnimation(shipId, action, event); }
    buyShip(shipId, event) { return this.playerActionService.buyShip(shipId, event); }
    sellShip(shipId, event) { return this.playerActionService.sellShip(shipId, event); }
    setActiveShip(shipId) { this.playerActionService.setActiveShip(shipId); }
    payOffDebt() { this.playerActionService.payOffDebt(); }
    takeLoan(loanData) { this.playerActionService.takeLoan(loanData); }
    purchaseLicense(licenseId) { return this.playerActionService.purchaseLicense(licenseId); }
    purchaseIntel(cost) { this.playerActionService.purchaseIntel(cost); }
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
        // As per V2 spec, the queue is rebuilt on every location change.
        // The 'navigation' screen is the primary hub screen upon arrival.
        if (screenId === 'navigation') {
            this.newsTickerService.onLocationChange();
        }
        // --- [END NEW V2 CHANGE] ---

        if (this.tutorialService) {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: screenId });
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