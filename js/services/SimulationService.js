// js/services/SimulationService.js
/**
 * @fileoverview
 * This file contains the SimulationService class, which acts as the main
 * facade for the game's core logic. It initializes and coordinates all
 * specialized services, ensuring a clean separation of concerns.
 *
 * This class is the primary entry point for the EventManager and provides
 * a simplified API for the rest of the application to interact with complex
 * game subsystems.
 */

import { GameState } from './GameState.js';
import { UIManager } from './UIManager.js';
import { EventManager } from './EventManager.js';
import { DB } from '../data/database.js';
import { SCREEN_IDS, NAV_IDS, SHIP_IDS, GAME_RULES, LOCATION_IDS } from '../data/constants.js';
import { formatCredits, calculateInventoryUsed, formatNumber } from '../utils.js';
import { Logger } from './LoggingService.js';
import { DebugService } from './DebugService.js';

// Import specialized services
import { MarketService } from './simulation/MarketService.js';
import { TimeService } from './world/TimeService.js';
import { TravelService } from './world/TravelService.js';
import { IntroService } from './game/IntroService.js';
import { PlayerActionService } from './player/PlayerActionService.js';
import { TutorialService } from './TutorialService.js';
import { MissionService } from './MissionService.js';
// --- [[START]] Added for Metal Update V1 ---
import { EffectsManager } from '../effects/EffectsManager.js';
// --- [[END]] Added for Metal Update V1 ---

/**
 * @class SimulationService
 * @description The central facade for managing the game simulation. It
 * coordinates all specialized services and acts as the main interface
 * between the event layer (EventManager) and the game logic.
 */
export class SimulationService {
    /**
     * @param {GameState} gameState - The single source of truth for game state.
     * @param {UIManager} uiManager - The manager for all DOM rendering.
     * @param {Logger} logger - The centralized logging utility.
     */
    constructor(gameState, uiManager, logger) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;

        // --- [[START]] Modified for Metal Update V1 ---
        // EffectsManager is instantiated here at the facade level
        this.effectsManager = new EffectsManager();
        // --- [[END]] Modified for Metal Update V1 ---

        // Instantiate specialized services
        this.marketService = new MarketService(gameState, logger);
        this.timeService = new TimeService(gameState, this.marketService, uiManager, logger, this);
        this.travelService = new TravelService(gameState, uiManager, this.timeService, logger, this);
        this.missionService = new MissionService(gameState, uiManager, logger, this);
        this.tutorialService = new TutorialService(gameState, uiManager, logger, this);
        
        // --- [[START]] Modified for Metal Update V1 ---
        // PlayerActionService now receives the tutorialService instance
        this.playerActionService = new PlayerActionService(gameState, uiManager, this.missionService, this.marketService, this.timeService, logger, this, this.tutorialService);
        // --- [[END]] Modified for Metal Update V1 ---

        this.introService = new IntroService(gameState, uiManager, logger, this, this.tutorialService);

        this.lastTransactionTime = 0;
        this.consolidatedTransaction = { type: null, amount: 0, description: '' };
        this.lastTradeTime = 0;
        this.consolidatedTrade = { good: '', quantity: 0, total: 0 };
    }

    /**
     * Initializes the simulation, starting a new game or loading from save.
     */
    initialize() {
        if (!this.gameState.loadGame()) {
            this.logger.info('SimulationService', 'No save game found. Starting new game.');
        } else {
            this.logger.info('SimulationService', 'Save game loaded.');
        }
        // Always render, whether new game or loaded
        this.uiManager.render(this.gameState.activeScreen);
    }

    /**
     * Sets the active screen and navigation tab.
     * @param {string} navId - The NAV_ID of the main navigation tab.
     * @param {string} screenId - The SCREEN_ID of the sub-screen.
     */
    setScreen(navId, screenId) {
        if (this.gameState.isGameOver) return;
        this.gameState.activeNav = navId;
        this.gameState.activeScreen = screenId;
        this.gameState.lastActiveScreen[navId] = screenId;
        
        if (this.gameState.tutorials.activeBatchId === 'intro_missions' && screenId === 'navigation') {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: 'navigation' });
        }
        if (this.gameState.tutorials.activeBatchId === 'intro_missions' && screenId === 'market') {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: 'market' });
        }
         if (this.gameState.tutorials.activeBatchId === 'intro_missions' && screenId === 'missions') {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: 'missions' });
        }

        this.gameState.setState({});
    }

    /**
     * Facade method to initiate travel to a new location.
     * @param {string} locationId - The ID of the destination.
     */
    travelTo(locationId) {
        this.travelService.travelTo(locationId);
    }
    
    /**
     * Facade method to purchase a commodity.
     * @param {string} goodId - The COMMODITY_ID of the item.
     * @param {number} quantity - The amount to buy.
     */
    buyItem(goodId, quantity) {
        this.playerActionService.buyItem(goodId, quantity);
    }

    /**
     * Facade method to sell a commodity.
     * @param {string} goodId - The COMMODITY_ID of the item.
     * @param {number} quantity - The amount to sell.
     * @param {Event} event - The click event for placing floating text.
     */
    sellItem(goodId, quantity, event) {
        const totalSaleValue = this.playerActionService.sellItem(goodId, quantity);
        if (totalSaleValue > 0 && event) {
            this.effectsManager.floatingText(`+${formatCredits(totalSaleValue, false)}`, 'positive', event.clientX, event.clientY);
        }
    }

    // --- [[START]] Added for Metal Update V1 ---
    /**
     * Sells a specified quantity of a special material (like Metal Scrap).
     * @param {string} materialId - The ID of the material to sell (e.g., 'metal-scrap').
     * @param {number} quantity - The amount to sell.
     * @param {Event} [event] - The click event for placing floating text.
     * @returns {boolean} - True if the sale was successful, false otherwise.
     */
    sellMaterial(materialId, quantity, event) {
        if (quantity <= 0) return false;

        // Note: DB.MATERIALS was added in Phase 1
        const material = DB.MATERIALS[materialId];
        if (!material) {
            this.logger.error('SimulationService', `sellMaterial called with invalid materialId: ${materialId}`);
            return false;
        }

        if (this.gameState.player.metalScrap < quantity) {
            this.uiManager.queueModal('event-modal', "Insufficient Materials", `You do not have ${quantity} tons of ${material.name} to sell.`);
            return false;
        }

        const totalSaleValue = Math.floor(quantity * material.sellValue);
        
        // Use precise subtraction for floating point numbers (GDD QA Test P2-08)
        this.gameState.player.metalScrap = parseFloat((this.gameState.player.metalScrap - quantity).toFixed(4));
        this.gameState.player.credits += totalSaleValue;

        this.logger.info.player(this.gameState.day, 'SELL_MATERIAL', `Sold ${quantity}x ${material.name} for ${formatCredits(totalSaleValue)}`);
        this._logTransaction('material', totalSaleValue, `Sold ${quantity}T ${material.name}`);
        
        // Use the new floatingText signature (which will be implemented in the next file)
        if (event) {
            this.effectsManager.floatingText(`+${formatCredits(totalSaleValue, false)}`, 'positive', event.clientX, event.clientY);
        } else {
            this.effectsManager.floatingText(`+${formatCredits(totalSaleValue, false)}`, 'positive');
        }

        this.gameState.setState({});
        return true;
    }
    // --- [[END]] Added for Metal Update V1 ---

    /**
     * Facade method to purchase a ship.
     * @param {string} shipId - The ID of the ship.
     * @param {Event} event - The click event for placing floating text.
     */
    buyShip(shipId, event) {
        this.playerActionService.buyShip(shipId, event);
    }
    
    /**
     * Facade method to sell a ship.
     * @param {string} shipId - The ID of the ship.
     * @param {Event} event - The click event for placing floating text.
     */
    sellShip(shipId, event) {
        this.playerActionService.sellShip(shipId, event);
    }

    /**
     * Facade method to set the active ship.
     * @param {string} shipId - The ID of the ship.
     */
    setActiveShip(shipId) {
        this.playerActionService.setActiveShip(shipId);
    }

    /**
     * Facade method to pay off the player's debt.
     */
    payOffDebt() {
        this.playerActionService.payOffDebt();
    }
    
    /**
     * Facade method for the player to take a loan.
     * @param {object} loanData - The loan details.
     */
    takeLoan(loanData) {
        this.playerActionService.takeLoan(loanData);
    }
    
    /**
     * Facade method to purchase a license.
     * @param {string} licenseId - The ID of the license.
     */
    purchaseLicense(licenseId) {
        const result = this.playerActionService.purchaseLicense(licenseId);
        if (!result.success) {
            switch (result.error) {
                case 'INSUFFICIENT_FUNDS':
                    this.uiManager.queueModal('event-modal', "Insufficient Funds", "You cannot afford this license.");
                    break;
                case 'ALREADY_OWNED':
                    this.uiManager.queueModal('event-modal', "License Held", "You already possess this license.");
                    break;
                default:
                    this.logger.warn('SimulationService', `Unhandled license purchase error: ${result.error}`);
            }
        } else {
             this.uiManager.queueModal('event-modal', "License Acquired", `You have successfully purchased the ${DB.LICENSES[licenseId].name}.`);
        }
    }
    
    /**
     * Facade method to purchase market intel.
     * @param {number} cost - The credit cost of the intel.
     */
    purchaseIntel(cost) {
        this.playerActionService.purchaseIntel(cost);
    }

    /**
     * Facade method for a single tick of refueling.
     * @param {Event} event - The mousedown event.
     */
    refuelTick(event) {
        const cost = this.playerActionService.refuelTick();
        if (cost > 0 && event) {
            this.effectsManager.floatingText(`-${formatCredits(cost, false)}`, 'negative', event.clientX, event.clientY - 20, 1000);
        }
    }

    /**
     * Facade method for a single tick of repairing.
     * @param {Event} event - The mousedown event.
     */
    repairTick(event) {
        const cost = this.playerActionService.repairTick();
        if (cost > 0 && event) {
            this.effectsManager.floatingText(`-${formatCredits(cost, false)}`, 'negative', event.clientX, event.clientY - 20, 1000);
        }
    }

    /**
     * Toggles the minimized state of a market card.
     * @param {string} goodId - The COMMODITY_ID of the item card.
     */
    toggleMarketCardView(goodId) {
        const currentState = this.gameState.uiState.marketCardMinimized[goodId] || false;
        this.gameState.uiState.marketCardMinimized[goodId] = !currentState;
        this.gameState.setState({});
    }
    
    /**
     * Sets the view mode for the hangar (Hangar vs. Shipyard).
     * @param {string} mode - 'hangar' or 'shipyard'.
     */
    setHangarShipyardMode(mode) {
        if (this.gameState.uiState.hangarShipyardToggleState !== mode) {
            this.gameState.uiState.hangarShipyardToggleState = mode;
            this.gameState.setState({});
        }
    }

    /**
     * Sets the active page in the Hangar/Shipyard carousel.
     * @param {string} direction - 'next' or 'prev'.
     */
    setHangarPage(direction) {
        const mode = this.gameState.uiState.hangarShipyardToggleState;
        const state = this.gameState.getState();
        let currentIndex = state.uiState[mode === 'hangar' ? 'hangarActiveIndex' : 'shipyardActiveIndex'];
        const inventory = (mode === 'hangar') ? state.player.ownedShipIds : this._getShipyardInventory(state);
        const maxIndex = Math.max(0, inventory.length - 1);

        if (direction === 'next') {
            currentIndex = Math.min(maxIndex, currentIndex + 1);
        } else if (direction === 'prev') {
            currentIndex = Math.max(0, currentIndex - 1);
        }

        if (mode === 'hangar') {
            this.gameState.uiState.hangarActiveIndex = currentIndex;
        } else {
            this.gameState.uiState.shipyardActiveIndex = currentIndex;
        }
        this.gameState.setState({});
    }

    /**
     * Adds a newly acquired ship to the player's hangar.
     * @param {string} shipId - The ID of the ship.
     */
    addShipToHangar(shipId) {
        if (this.gameState.player.ownedShipIds.includes(shipId)) return;

        this.gameState.player.ownedShipIds.push(shipId);
        const shipData = DB.SHIPS[shipId];
        this.gameState.player.shipStates[shipId] = {
            health: shipData.maxHealth,
            fuel: shipData.maxFuel,
            hullAlerts: { one: false, two: false }
        };
        this.gameState.player.inventories[shipId] = {};
        DB.COMMODITIES.forEach(c => {
            this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
        });
        
        // After adding, set the hangar carousel to show this new ship
        const newIndex = this.gameState.player.ownedShipIds.length - 1;
        this.gameState.uiState.hangarActiveIndex = newIndex;
        this.gameState.setState({});
    }

    // --- Private Helper Methods ---

    /**
     * Retrieves the player's currently active ship object from the database.
     * @param {object} [state=this.gameState.getState()] - Optional state object.
     * @returns {object} The active ship's data.
     * @private
     */
    _getActiveShip(state = this.gameState.getState()) {
        const activeShipId = state.player.activeShipId;
        const shipData = DB.SHIPS[activeShipId];
        const shipState = state.player.shipStates[activeShipId];
        return { ...shipData, ...shipState, id: activeShipId };
    }
    
    /**
     * Retrieves the inventory of the player's currently active ship.
     * @param {object} [state=this.gameState.getState()] - Optional state object.
     * @returns {object} The active ship's inventory.
     * @private
     */
    _getActiveInventory(state = this.gameState.getState()) {
        return state.player.inventories[state.player.activeShipId];
    }
    
    /**
     * Retrieves the list of ships available for purchase at the current location.
     * @param {object} [state=this.gameState.getState()] - Optional state object.
     * @returns {Array<object>} A list of ship objects.
     * @private
     */
    _getShipyardInventory(state = this.gameState.getState()) {
        const stock = state.market.shipyardStock[state.currentLocationId];
        if (!stock || stock.day !== state.day) {
            this.logger.warn('SimulationService', `Shipyard stock for ${state.currentLocationId} is stale or missing. Regenerating.`);
            this.marketService._updateShipyardStock(state.currentLocationId, state.day);
        }
        return this.gameState.market.shipyardStock[state.currentLocationId].shipsForSale
            .map(id => DB.SHIPS[id])
            .filter(ship => !state.player.ownedShipIds.includes(ship.id));
    }
    
    /**
     * Checks and updates hull integrity warnings.
     * @param {string} shipId - The ID of the ship to check.
     * @private
     */
    _checkHullWarnings(shipId) {
        const ship = this._getActiveShip();
        const hullPercent = (ship.health / ship.maxHealth) * 100;
        const alerts = this.gameState.player.shipStates[shipId].hullAlerts;
        
        if (hullPercent <= 50 && !alerts.one) {
            alerts.one = true;
            this.uiManager.queueModal('event-modal', "Hull Integrity Warning", "Hull integrity at 50%. Recommend immediate repairs to avoid critical failure.");
        } else if (hullPercent > 50 && alerts.one) {
            alerts.one = false;
        }
        
        if (hullPercent <= 25 && !alerts.two) {
            alerts.two = true;
            this.uiManager.queueModal('event-modal', "HULL INTEGRITY CRITICAL", "Hull integrity at 25%. Catastrophic failure imminent. Dock at the nearest station for emergency repairs.");
        } else if (hullPercent > 25 && alerts.two) {
            alerts.two = false;
        }
    }

    /**
     * Logs a financial transaction to the player's finance log.
     * @param {string} type - The category of the transaction.
     * @param {number} amount - The credit amount (positive for income, negative for expense).
     * @param {string} description - A brief note about the transaction.
     * @private
     */
    _logTransaction(type, amount, description) {
        const log = this.gameState.player.financeLog;
        log.unshift({
            day: this.gameState.day,
            type: type,
            amount: amount,
            description: description,
            balance: this.gameState.player.credits
        });
        if (log.length > GAME_RULES.FINANCE_HISTORY_LENGTH) {
            log.pop();
        }
    }

    /**
     * Consolidates multiple rapid transactions (like refuel/repair) into a single log entry.
     * @param {string} type - The category of the transaction.
     * @param {number} amount - The credit amount (always negative).
     * @param {string} description - A brief note about the transaction.
     * @private
     */
    _logConsolidatedTransaction(type, amount, description) {
        const now = Date.now();
        if (now - this.lastTransactionTime < 1000 && this.consolidatedTransaction.type === type) {
            this.consolidatedTransaction.amount += amount;
            this.gameState.player.financeLog[0].amount = this.consolidatedTransaction.amount;
            this.gameState.player.financeLog[0].balance = this.gameState.player.credits;
        } else {
            this.consolidatedTransaction = { type, amount, description };
            this._logTransaction(type, amount, description);
        }
        this.lastTransactionTime = now;
    }
    
    /**
     * Consolidates multiple rapid trades into a single log entry.
     * @param {string} good - The name of the commodity.
     * @param {number} quantity - The amount traded.
     * @param {number} total - The total credit value (negative for buys, positive for sells).
     * @private
     */
    _logConsolidatedTrade(good, quantity, total) {
        const now = Date.now();
        const type = total > 0 ? 'sell' : 'buy';
        const description = total > 0 ? `Sold ${good}` : `Bought ${good}`;

        if (now - this.lastTradeTime < 1500 && this.consolidatedTrade.good === good && (total > 0 === this.consolidatedTrade.total > 0)) {
            this.consolidatedTrade.quantity += quantity;
            this.consolidatedTrade.total += total;
            const logEntry = this.gameState.player.financeLog[0];
            logEntry.amount = this.consolidatedTrade.total;
            logEntry.description = `${total > 0 ? 'Sold' : 'Bought'} ${this.consolidatedTrade.quantity}x ${good}`;
            logEntry.balance = this.gameState.player.credits;
        } else {
            this.consolidatedTrade = { good, quantity, total };
            this._logTransaction(type, total, `${description} ${quantity}x`);
        }
        this.lastTradeTime = now;
    }
}