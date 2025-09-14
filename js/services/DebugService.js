// js/services/DebugService.js
/**
 * @fileoverview This file contains the DebugService class, which is responsible for creating and managing
 * the lil-gui developer panel for real-time testing and manipulation of the game state.
 */
import { DB } from '../data/database.js';
import { LOCATION_IDS } from '../data/constants.js';
import { Logger } from './LoggingService.js';

/**
 * A simple bot that plays the game to stress-test the economy and find bugs.
 * @class AutomatedPlayer
 */
class AutomatedPlayer {
    /**
     * @param {import('./GameState.js').GameState} gameState The central game state object.
     * @param {import('./SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, simulationService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.logger = logger;
        this.isRunning = false;
        this.stopRequested = false;
    }

    /**
     * Starts the automated play simulation.
     * @param {object} config - Configuration for the simulation run.
     * @param {number} config.daysToRun - The number of in-game days to simulate.
     * @param {function} updateCallback - A function to call with progress updates.
     */
    async runSimulation({ daysToRun }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('AutomatedPlayer', 'AUTOTRADER-01 is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;

        this.logger.info.system('Bot', startDay, 'SIMULATION_START', `Starting simulation for ${daysToRun} days.`);

        while (this.gameState.day < endDay && !this.stopRequested) {
            const activeShip = this.simulationService._getActiveShip();
            if (activeShip) {
                const fuelPct = (activeShip.fuel / activeShip.maxFuel) * 100;
                const healthPct = (activeShip.health / activeShip.maxHealth) * 100;

                if (fuelPct < 30) {
                    this.logger.info.system('Bot', this.gameState.day, 'REFUEL', `Low fuel (${fuelPct.toFixed(1)}%). Refueling.`);
                    this.simulationService.botRefuel();
                }
                if (healthPct < 30) {
                    this.logger.info.system('Bot', this.gameState.day, 'REPAIR', `Low hull integrity (${healthPct.toFixed(1)}%). Repairing.`);
                    this.simulationService.botRepair();
                }
            }

            const bestTrade = this._findBestTradeRoute();

            if (bestTrade) {
                this.logger.group(`[Bot] [Day ${this.gameState.day}] Executing Trade Route: ${bestTrade.goodId}`);
                // Travel to buy location
                if (this.gameState.currentLocationId !== bestTrade.buyLocationId) {
                    this.simulationService.initiateTravel(bestTrade.buyLocationId);
                }
                // Buy
                const buyQty = this._calculateMaxBuy(bestTrade.goodId, bestTrade.buyPrice);
                if(buyQty > 0) this.simulationService.buyItem(bestTrade.goodId, buyQty);

                // Travel to sell location
                if (this.gameState.currentLocationId !== bestTrade.sellLocationId) {
                    this.simulationService.initiateTravel(bestTrade.sellLocationId);
                }

                // Sell
                const sellQty = this.simulationService._getActiveInventory()[bestTrade.goodId]?.quantity || 0;
                if(sellQty > 0) this.simulationService.sellItem(bestTrade.goodId, sellQty);
                this.logger.groupEnd();
            } else {
                // No profitable trades, advance time to wait for market changes.
                this.simulationService._advanceDays(1);
            }
            updateCallback(this.gameState.day, endDay);
            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to prevent browser freeze
        }

        this.logger.info.system('Bot', this.gameState.day, 'SIMULATION_END', 'Simulation finished.');
        this.isRunning = false;
    }

    /**
     * Stops the currently running simulation.
     */
    stop() {
        this.stopRequested = true;
    }

    /**
     * Calculates the maximum quantity of an item the bot can buy.
     * @private
     */
    _calculateMaxBuy(goodId, price) {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        const space = ship.cargoCapacity - Object.values(inventory).reduce((acc, item) => acc + item.quantity, 0);
        const canAfford = price > 0 ? Math.floor(state.player.credits / price) : space;
        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
        return Math.max(0, Math.min(space, canAfford, stock));
    }

    /**
     * Scans all markets to find the most profitable trade route.
     * @private
     */
    _findBestTradeRoute() {
        const state = this.gameState.getState();
        let bestTrade = null;
        let maxProfitPerDay = 0;

        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier);

        for (const good of availableCommodities) {
            for (const buyLocation of DB.MARKETS) {
                if (!state.player.unlockedLocationIds.includes(buyLocation.id)) continue;

                for (const sellLocation of DB.MARKETS) {
                    if (buyLocation.id === sellLocation.id || !state.player.unlockedLocationIds.includes(sellLocation.id)) continue;

                    const buyPrice = state.market.prices[buyLocation.id][good.id];
                    const sellPrice = state.market.prices[sellLocation.id][good.id];
                    const profitPerUnit = sellPrice - buyPrice;

                    if (profitPerUnit > 0) {
                        const travelTimeToBuy = state.TRAVEL_DATA[state.currentLocationId]?.[buyLocation.id]?.time || 0;
                        const travelTimeToSell = state.TRAVEL_DATA[buyLocation.id]?.[sellLocation.id]?.time || 0;
                        const totalTime = travelTimeToBuy + travelTimeToSell + 1; // +1 for transaction time
                        const profitPerDay = profitPerUnit / totalTime;

                        if (profitPerDay > maxProfitPerDay) {
                            maxProfitPerDay = profitPerDay;
                            bestTrade = {
                                goodId: good.id,
                                buyLocationId: buyLocation.id,
                                sellLocationId: sellLocation.id,
                                buyPrice,
                                sellPrice,
                                profitPerUnit
                            };
                        }
                    }
                }
            }
        }
        return bestTrade;
    }
}

export class DebugService {
    /**
     * @param {import('./GameState.js').GameState} gameState The central game state object.
     * @param {import('./SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('./UIManager.js').UIManager} uiManager The UI rendering service.
     * @param {import('./DirectorModeService.js').DirectorModeService} directorModeService The visual tutorial editor service.
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, simulationService, uiManager, directorModeService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.directorModeService = directorModeService;
        this.logger = logger;
        this.gui = null;
        this.active = false;
        this.actions = {};
        this.debugState = {}; // Holds state for GUI controllers
        this.bot = new AutomatedPlayer(gameState, simulationService, logger);
    }

    /**
     * Initializes the debug panel, creating the lil-gui instance and setting up all the controls.
     */
    init() {
        if (this.gui) return;
        this.gui = new lil.GUI();
        this.gui.domElement.style.display = 'none';
        this._registerDebugActions();
        this.buildGui();
    }

    /**
     * Handles key presses forwarded from the EventManager.
     * @param {string} key - The key that was pressed.
     */
    handleKeyPress(key) {
        const action = Object.values(this.actions).find(a => a.key === key);
        if (action && action.handler) {
            action.handler();
        }
    }

    /**
     * Toggles the visibility of the debug panel UI.
     */
    toggleVisibility() {
        if (!this.gui) return;
        this.active = !this.active;
        this.gui.domElement.style.display = this.active ? 'block' : 'none';
    }

    /**
     * Gathers log history and current game state, formats it, and copies it to the clipboard.
     */
    generateBugReport() {
        const logHistory = this.logger.getLogHistory();
        const gameState = this.gameState.getState();
        
        // Exclude bulky data from the state snapshot for a cleaner report
        delete gameState.TRAVEL_DATA;
        delete gameState.market.priceHistory;

        const report = `
ORBITAL TRADING - BUG REPORT
==============================
Date: ${new Date().toISOString()}

--- GAME STATE SNAPSHOT ---
${JSON.stringify(gameState, null, 2)}

--- RECENT LOG HISTORY ---
${logHistory}
        `;
        
        navigator.clipboard.writeText(report.trim())
            .then(() => {
                this.uiManager.createFloatingText('Bug Report Copied to Clipboard!', window.innerWidth / 2, window.innerHeight / 2, '#4ade80');
            })
            .catch(err => {
                this.logger.error('DebugService', 'Failed to copy bug report.', err);
            });
    }


    /**
     * Creates the data-driven registry of all available debug actions.
     * @private
     */
    _registerDebugActions() {
        this.actions = {
            // --- Game Flow Actions ---
            godMode: {
                name: 'God Mode',
                type: 'button',
                handler: () => this.simulationService.debugGodMode()
            },
            directorMode: {
                name: 'Director Mode',
                type: 'button',
                handler: () => this.directorModeService.toggleVisibility()
            },
            // --- Player Actions ---
            addCredits: {
                name: 'Add Credits',
                type: 'button',
                handler: () => {
                    this.gameState.player.credits += this.debugState.creditsToAdd;
                    this.simulationService._checkMilestones();
                    this.uiManager.render(this.gameState.getState());
                }
            },
            payDebt: {
                name: 'Pay Off Debt',
                type: 'button',
                handler: () => this.simulationService.payOffDebt()
            },
            teleport: {
                name: 'Teleport',
                type: 'button',
                handler: () => {
                    if (this.debugState.selectedLocation) {
                        this.gameState.currentLocationId = this.debugState.selectedLocation;
                        this.gameState.setState({});
                    }
                }
            },
            unlockAll: {
                name: 'Unlock All',
                type: 'button',
                handler: () => {
                    this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);
                    this.gameState.player.revealedTier = 7;
                    this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
                    this.gameState.setState({});
                }
            },
            grantAllShips: {
                name: 'Grant All Ships',
                type: 'button',
                handler: () => {
                    Object.keys(DB.SHIPS).forEach(shipId => {
                        if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                            this.simulationService.addShipToHangar(shipId);
                        }
                    });
                    this.gameState.setState({});
                }
            },

            // --- World Actions ---
            advanceTime: {
                name: 'Advance Days',
                type: 'button',
                handler: () => this.simulationService._advanceDays(this.debugState.daysToAdvance)
            },

            // --- Economy Actions ---
            evolvePrices: {
                name: 'Evolve Prices (7d)',
                type: 'button',
                handler: () => this.simulationService.marketService.evolveMarketPrices()
            },
            replenishStock: {
                name: 'Replenish All Stock',
                type: 'button',
                handler: () => {
                    this.simulationService.marketService.replenishMarketInventory();
                    this.gameState.setState({});
                }
            },

            // --- Trigger Actions ---
            triggerRandomEvent: {
                name: 'Trigger Random Event',
                type: 'button',
                handler: () => {
                    const dest = DB.MARKETS.find(m => m.id !== this.gameState.currentLocationId)?.id;
                    if (dest) {
                        this.simulationService._checkForRandomEvent(dest, this.debugState.selectedRandomEvent);
                    }
                }
            },
            triggerAgeEvent: {
                name: 'Trigger Age Event',
                type: 'button',
                handler: () => {
                    const event = DB.AGE_EVENTS.find(e => e.id === this.debugState.selectedAgeEvent);
                    if (event) {
                        this.uiManager.showAgeEventModal(event, (choice) => this.simulationService._applyPerk(choice));
                    }
                }
            },
            triggerMission: {
                name: 'Trigger Mission',
                type: 'button',
                handler: () => {
                    if (this.debugState.selectedMission) {
                        this.simulationService.missionService.acceptMission(this.debugState.selectedMission);
                    }
                }
            },
            // --- Bot Actions ---
            startBot: {
                name: 'Start AUTOTRADER-01',
                type: 'button',
                handler: () => {
                    const progressController = this.gui.controllers.find(c => c.property === 'botProgress');
                    this.bot.runSimulation({ daysToRun: this.debugState.botDaysToRun }, (current, end) => {
                        if(progressController) progressController.setValue(`${current} / ${end}`).updateDisplay();
                    });
                }
            },
            stopBot: {
                name: 'Stop AUTOTRADER-01',
                type: 'button',
                handler: () => this.bot.stop()
            }
        };
    }

    /**
     * Constructs the lil-gui panel from the action registry.
     * @private
     */
    buildGui() {
        // --- Game Flow Folder ---
        const flowFolder = this.gui.addFolder('Game Flow');
        flowFolder.add(this.actions.godMode, 'handler').name(this.actions.godMode.name);
        flowFolder.add(this.actions.directorMode, 'handler').name(this.actions.directorMode.name);

        // --- Player Folder ---
        const playerFolder = this.gui.addFolder('Player');
        this.debugState.creditsToAdd = 100000;
        playerFolder.add(this.debugState, 'creditsToAdd').name('Credits Amount');
        playerFolder.add(this.actions.addCredits, 'handler').name('Add Credits');
        playerFolder.add(this.actions.payDebt, 'handler').name(this.actions.payDebt.name);
        const locationOptions = DB.MARKETS.reduce((acc, loc) => ({...acc, [loc.name]: loc.id }), {});
        this.debugState.selectedLocation = this.gameState.currentLocationId;
        playerFolder.add(this.debugState, 'selectedLocation', locationOptions).name('Location');
        playerFolder.add(this.actions.teleport, 'handler').name('Teleport');

        // --- World Folder ---
        const worldFolder = this.gui.addFolder('World & Time');
        this.debugState.daysToAdvance = 7;
        worldFolder.add(this.debugState, 'daysToAdvance', 1, 365, 1).name('Days to Advance');
        worldFolder.add(this.actions.advanceTime, 'handler').name('Advance Time');

        // --- Economy Folder ---
        const economyFolder = this.gui.addFolder('Economy');
        economyFolder.add(this.actions.evolvePrices, 'handler').name(this.actions.evolvePrices.name);
        economyFolder.add(this.actions.replenishStock, 'handler').name(this.actions.replenishStock.name);
        economyFolder.add(this.actions.unlockAll, 'handler').name('Unlock Tiers/Locations');
        economyFolder.add(this.actions.grantAllShips, 'handler').name('Grant All Ships');

        // --- Triggers Folder ---
        const triggerFolder = this.gui.addFolder('Triggers');
        const randomEventOptions = DB.RANDOM_EVENTS.reduce((acc, event, index) => ({...acc, [event.title]: index }), {});
        this.debugState.selectedRandomEvent = 0;
        triggerFolder.add(this.debugState, 'selectedRandomEvent', randomEventOptions).name('Random Event');
        triggerFolder.add(this.actions.triggerRandomEvent, 'handler').name('Trigger Event');
        const ageEventOptions = DB.AGE_EVENTS.reduce((acc, event) => ({...acc, [event.title]: event.id }), {});
        this.debugState.selectedAgeEvent = DB.AGE_EVENTS[0].id;
        triggerFolder.add(this.debugState, 'selectedAgeEvent', ageEventOptions).name('Age Event');
        triggerFolder.add(this.actions.triggerAgeEvent, 'handler').name('Trigger Event');
        const missionOptions = Object.values(DB.MISSIONS).reduce((acc, m) => ({...acc, [m.name]: m.id}), {});
        this.debugState.selectedMission = Object.keys(missionOptions)[0];
        triggerFolder.add(this.debugState, 'selectedMission', missionOptions).name('Mission');
        triggerFolder.add(this.actions.triggerMission, 'handler').name('Accept Mission');

        // --- Automation & Logging Folder ---
        const automationFolder = this.gui.addFolder('Automation & Logging');
        this.debugState.logLevel = 'INFO';
        automationFolder.add(this.debugState, 'logLevel', ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE']).name('Log Level').onChange(v => this.logger.setLevel(v));
        automationFolder.add(this, 'generateBugReport').name('Generate Bug Report');
        this.debugState.botDaysToRun = 365;
        this.debugState.botProgress = 'Idle';
        automationFolder.add(this.debugState, 'botDaysToRun', 1, 10000, 1).name('Simulation Days');
        automationFolder.add(this.actions.startBot, 'handler').name(this.actions.startBot.name);
        automationFolder.add(this.actions.stopBot, 'handler').name(this.actions.stopBot.name);
        automationFolder.add(this.debugState, 'botProgress').name('Progress').listen();
        
        this.gui.folders.forEach(folder => folder.close());
    }
}