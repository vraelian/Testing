// js/services/DebugService.js
/**
 * @fileoverview This file contains the DebugService class, which is responsible for creating and managing
 * the lil-gui developer panel for real-time testing and manipulation of the game state.
 */
import { DB } from '../data/database.js';
import { LOCATION_IDS, SHIP_IDS, NAV_IDS, SCREEN_IDS, COMMODITY_IDS } from '../data/constants.js';
import { Logger } from './LoggingService.js';
import { calculateInventoryUsed } from '../utils.js';

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
                const fuelPct = (this.gameState.player.shipStates[activeShip.id].fuel / activeShip.maxFuel) * 100;
                const healthPct = (this.gameState.player.shipStates[activeShip.id].health / activeShip.maxHealth) * 100;

                if (fuelPct < 30) {
                    this.logger.info.system('Bot', this.gameState.day, 'REFUEL', `Low fuel (${fuelPct.toFixed(1)}%). Refueling.`);
                    this.botRefuel();
                }
                if (healthPct < 30) {
                    this.logger.info.system('Bot', this.gameState.day, 'REPAIR', `Low hull integrity (${healthPct.toFixed(1)}%). Repairing.`);
                    this.botRepair();
                }
            }

            const bestTrade = this._findBestTradeRoute();

            if (bestTrade) {
                this.logger.group(`[Bot] [Day ${this.gameState.day}] Executing Trade Route: ${bestTrade.goodId}`);
                if (this.gameState.currentLocationId !== bestTrade.buyLocationId) {
                    this.simulationService.travelService.initiateTravel(bestTrade.buyLocationId);
                }
                const buyQty = this._calculateMaxBuy(bestTrade.goodId, bestTrade.buyPrice);
                if(buyQty > 0) this.simulationService.playerActionService.buyItem(bestTrade.goodId, buyQty);

                if (this.gameState.currentLocationId !== bestTrade.sellLocationId) {
                    this.simulationService.travelService.initiateTravel(bestTrade.sellLocationId);
                }

                const sellQty = this.simulationService._getActiveInventory()[bestTrade.goodId]?.quantity || 0;
                if(sellQty > 0) this.simulationService.playerActionService.sellItem(bestTrade.goodId, sellQty);
                this.logger.groupEnd();
            } else {
                this.simulationService.timeService.advanceDays(1);
            }
            updateCallback(this.gameState.day, endDay);
            await new Promise(resolve => setTimeout(resolve, 10));
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
     * @private
     */
    botRefuel() {
        const ship = this.simulationService._getActiveShip();
        if (!ship) return;
        const fuelNeeded = ship.maxFuel - this.gameState.player.shipStates[ship.id].fuel;
        if (fuelNeeded <= 0) return;
        const currentMarket = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        let fuelPrice = currentMarket.fuelPrice / 2;
        const totalCost = (fuelNeeded / 5) * fuelPrice;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].fuel = ship.maxFuel;
        }
    }
    
    /**
     * @private
     */
    botRepair() {
        const ship = this.simulationService._getActiveShip();
        if (!ship) return;
        const healthNeeded = ship.maxHealth - this.gameState.player.shipStates[ship.id].health;
        if (healthNeeded <= 0) return;
        const totalCost = healthNeeded * GAME_RULES.REPAIR_COST_PER_HP;
        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].health = ship.maxHealth;
        }
    }

    /**
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
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, simulationService, uiManager, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.logger = logger;
        this.gui = null;
        this.active = false;
        this.diagActive = false;
        this.diagElements = {};
        this.actions = {};
        this.debugState = {}; // Holds state for GUI controllers
        this.bot = new AutomatedPlayer(gameState, simulationService, logger);
    }

    /**
     * Initializes the debug panel.
     */
    init() {
        if (this.gui) return;
        this._cacheDiagElements();
        this.gui = new lil.GUI({ title: 'Debug Menu' });
        this.gui.domElement.id = 'debug-panel';
        this._registerDebugActions();
        this.buildGui();
        this._startDiagLoop();
        this._makeDraggable();
    }

    /**
     * Handles key presses forwarded from the EventManager.
     * @param {string} key
     */
    handleKeyPress(key) {
        // No longer needed as all shortcuts are removed.
    }

    /**
     * Toggles the visibility of the debug panel UI.
     */
    toggleVisibility() {
        if (!this.gui) return;
        this.active = !this.active;
        this.gui.domElement.classList.toggle('debug-visible', this.active);
    }

    toggleDiagnosticOverlay() {
        this.diagActive = !this.diagActive;
        const overlay = document.getElementById('diagnostic-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !this.diagActive);
        }
    }

    /**
     * Gathers and copies a bug report to the clipboard.
     */
    generateBugReport() {
        const logHistory = this.logger.getLogHistory();
        const gameState = this.gameState.getState();
        
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

    // --- GAME FLOW & CHEAT METHODS ---
    godMode() {
        this.logger.warn('DebugService', 'GOD MODE ACTIVATED.');
        this.gameState.introSequenceActive = false;
        this.simulationService.tutorialService.activeBatchId = null;
        this.simulationService.tutorialService.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null; 
        this.gameState.tutorials.skippedTutorialBatches = Object.keys(DB.TUTORIAL_DATA);
        
        this.gameState.player.credits = 1000000000000;
        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.BEHEMOTH);
        this.gameState.player.activeShipId = SHIP_IDS.BEHEMOTH;
        
        this.gameState.player.revealedTier = 7;
        this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
        this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }

    simpleStart() {
        this.logger.warn('DebugService', 'SIMPLE START ACTIVATED.');
        this.gameState.introSequenceActive = false;
        this.simulationService.tutorialService.activeBatchId = null;
        this.simulationService.tutorialService.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.skippedTutorialBatches = Object.keys(DB.TUTORIAL_DATA);
        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.WANDERER);
        this.gameState.player.activeShipId = SHIP_IDS.WANDERER;
        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }
    
    skipToHangarTutorial() {
        this.logger.warn('DebugService', 'SKIP TO HANGAR TUTORIAL ACTIVATED.');
        this.gameState.introSequenceActive = true; 

        this.simulationService.tutorialService.activeBatchId = null;
        this.simulationService.tutorialService.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.skippedTutorialBatches = [];

        this.gameState.player.credits = 25000;
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
        this.simulationService.tutorialService.triggerBatch('intro_hangar', 'hangar_1');
        this.gameState.setState({});
    }

    // --- NEW SHIP-SPECIFIC HANDLERS ---
    deductHull(amount) {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = Math.max(0, shipState.health - amount);
            this.logger.warn('DebugService', `Deducted ${amount} hull from ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    restoreHull() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = ship.maxHealth;
            this.logger.warn('DebugService', `Restored hull for ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    destroyShip() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = 0;
            this.logger.warn('DebugService', `Destroyed ${ship.name}.`);
            this.simulationService.travelService._handleShipDestruction(ship.id);
        }
    }

    deductFuel(amount) {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.fuel = Math.max(0, shipState.fuel - amount);
            this.logger.warn('DebugService', `Deducted ${amount} fuel from ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    restoreFuel() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.fuel = ship.maxFuel;
            this.logger.warn('DebugService', `Restored fuel for ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    removeAllCargo() {
        const inventory = this.simulationService._getActiveInventory();
        if (inventory) {
            for (const goodId in inventory) {
                inventory[goodId].quantity = 0;
                inventory[goodId].avgCost = 0;
            }
            this.logger.warn('DebugService', 'All cargo removed from active ship.');
            this.gameState.setState({});
        }
    }

    fillWithCybernetics() {
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (ship && inventory) {
            this.removeAllCargo();
            const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
            if (!inventory[COMMODITY_IDS.CYBERNETICS]) {
                inventory[COMMODITY_IDS.CYBERNETICS] = { quantity: 0, avgCost: 0 };
            }
            inventory[COMMODITY_IDS.CYBERNETICS].quantity = space;
            this.logger.warn('DebugService', `Filled cargo with ${space} Cybernetics.`);
            this.gameState.setState({});
        }
    }

    grantAllItems() {
        const inventory = this.simulationService._getActiveInventory();
        if (!inventory) {
            this.logger.warn('DebugService', 'Cannot grant items: No active inventory found.');
            return;
        }
        DB.COMMODITIES.forEach(commodity => {
            if (inventory[commodity.id]) {
                inventory[commodity.id].quantity += 1;
            } else {
                inventory[commodity.id] = { quantity: 1, avgCost: 0 };
            }
        });
        this.logger.warn('DebugService', 'Debug: Granted 1x of all commodities.');
        this.gameState.setState({});
    }

    fillShipyard() {
        const { currentLocationId, day } = this.gameState;
        if (this.gameState.market.shipyardStock[currentLocationId]) {
            const allShipIds = Object.keys(DB.SHIPS);
            this.gameState.market.shipyardStock[currentLocationId] = {
                day: day,
                shipsForSale: allShipIds
            };
            this.logger.warn('DebugService', `SHIPYARD FILLED: All ships added to ${currentLocationId}.`);
            this.gameState.setState({});
        } else {
            this.logger.error('DebugService', `Cannot fill shipyard: No stock object for ${currentLocationId}.`);
        }
    }


    /**
     * @private
     */
    _registerDebugActions() {
        this.actions = {
            godMode: { name: 'God Mode', type: 'button', handler: () => this.godMode() },
            simpleStart: { name: 'Simple Start', type: 'button', handler: () => this.simpleStart() },
            skipToHangarTutorial: { name: 'Skip to Hangar Tutorial', type: 'button', handler: () => this.skipToHangarTutorial() },
            addCredits: { name: 'Add Credits', type: 'button', handler: () => {
                this.gameState.player.credits += this.debugState.creditsToAdd;
                this.simulationService.timeService._checkMilestones();
                this.uiManager.render(this.gameState.getState());
            }},
            payDebt: { name: 'Pay Off Debt', type: 'button', handler: () => this.simulationService.playerActionService.payOffDebt() },
            teleport: { name: 'Teleport', type: 'button', handler: () => {
                if (this.debugState.selectedLocation) {
                    this.gameState.currentLocationId = this.debugState.selectedLocation;
                    this.gameState.setState({});
                }
            }},
            unlockAll: { name: 'Unlock All', type: 'button', handler: () => {
                this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);
                this.gameState.player.revealedTier = 7;
                this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
                this.gameState.setState({});
            }},
            grantAllShips: { name: 'Grant All Ships', type: 'button', handler: () => {
                Object.keys(DB.SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                        this.simulationService.addShipToHangar(shipId);
                    }
                });
                this.gameState.setState({});
            }},
            advanceTime: { name: 'Advance Days', type: 'button', handler: () => this.simulationService.timeService.advanceDays(this.debugState.daysToAdvance) },
            replenishStock: { name: 'Replenish All Stock', type: 'button', handler: () => {
                this.simulationService.marketService.replenishMarketInventory();
                this.gameState.setState({});
            }},
            triggerRandomEvent: { name: 'Trigger Random Event', type: 'button', handler: () => {
                const dest = DB.MARKETS.find(m => m.id !== this.gameState.currentLocationId)?.id;
                if (dest) {
                    this.simulationService.travelService._checkForRandomEvent(dest, this.debugState.selectedRandomEvent);
                }
            }},
            triggerAgeEvent: { name: 'Trigger Age Event', type: 'button', handler: () => {
                const event = DB.AGE_EVENTS.find(e => e.id === this.debugState.selectedAgeEvent);
                if (event) {
                    this.uiManager.showAgeEventModal(event, (choice) => this.simulationService._applyPerk(choice));
                }
            }},
            triggerMission: { name: 'Trigger Mission', type: 'button', handler: () => {
                if (this.debugState.selectedMission) {
                    if(this.gameState.missions.activeMissionId) {
                        this.simulationService.missionService.abandonMission();
                    }
                    this.simulationService.missionService.acceptMission(this.debugState.selectedMission);
                }
            }},
            startBot: { name: 'Start AUTOTRADER-01', type: 'button', handler: () => {
                const progressController = this.gui.controllers.find(c => c.property === 'botProgress');
                this.bot.runSimulation({ daysToRun: this.debugState.botDaysToRun }, (current, end) => {
                    if(progressController) progressController.setValue(`${current} / ${end}`).updateDisplay();
                });
            }},
            stopBot: { name: 'Stop AUTOTRADER-01', type: 'button', handler: () => this.bot.stop() },

            // NEW & MOVED SHIP ACTIONS
            fillShipyard: { name: 'Fill Shipyard w/ All Ships', type: 'button', handler: () => this.fillShipyard() },
            deductHull20: { name: 'Deduct 20 Hull', type: 'button', handler: () => this.deductHull(20) },
            restoreHull: { name: 'Restore Hull', type: 'button', handler: () => this.restoreHull() },
            destroyShip: { name: 'Destroy Current Ship', type: 'button', handler: () => this.destroyShip() },
            deductFuel20: { name: 'Deduct 20 Fuel', type: 'button', handler: () => this.deductFuel(20) },
            restoreFuel: { name: 'Restore Fuel', type: 'button', handler: () => this.restoreFuel() },
            removeAllCargo: { name: 'Remove All Cargo', type: 'button', handler: () => this.removeAllCargo() },
            grantAllItems: { name: 'Grant 1x All Items', type: 'button', handler: () => this.grantAllItems() },
            fillWithCybernetics: { name: 'Fill w/ Cybernetics', type: 'button', handler: () => this.fillWithCybernetics() },
        };
    }

    _cacheDiagElements() {
        this.diagElements = {
            winW: document.getElementById('diag-window-w'),
            winH: document.getElementById('diag-window-h'),
            visualVpW: document.getElementById('diag-visual-vp-w'),
            visualVpH: document.getElementById('diag-visual-vp-h'),
            gameW: document.getElementById('diag-game-container-w'),
            gameH: document.getElementById('diag-game-container-h'),
            bodyW: document.getElementById('diag-body-w'),
            bodyH: document.getElementById('diag-body-h'),
            pixelRatio: document.getElementById('diag-pixel-ratio'),
            displayMode: document.getElementById('diag-display-mode'),
            day: document.getElementById('diag-day'),
            navScreen: document.getElementById('diag-nav-screen'),
            tutorialBatch: document.getElementById('diag-tutorial-batch'),
            tutorialStep: document.getElementById('diag-tutorial-step'),
        };
    }
    
    _startDiagLoop() {
        const update = () => {
            this._updateDiagOverlay();
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    _updateDiagOverlay() {
        if (!this.diagActive) return;

        const state = this.gameState.getState();
        const gameContainer = document.getElementById('game-container');

        this.diagElements.winW.textContent = window.innerWidth;
        this.diagElements.winH.textContent = window.innerHeight;
        
        if (window.visualViewport) {
            this.diagElements.visualVpW.textContent = Math.round(window.visualViewport.width);
            this.diagElements.visualVpH.textContent = Math.round(window.visualViewport.height);
        }

        this.diagElements.gameW.textContent = gameContainer.clientWidth;
        this.diagElements.gameH.textContent = gameContainer.clientHeight;
        this.diagElements.bodyW.textContent = document.body.clientWidth;
        this.diagElements.bodyH.textContent = document.body.clientHeight;
        this.diagElements.pixelRatio.textContent = window.devicePixelRatio.toFixed(2);
        this.diagElements.displayMode.textContent = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
        this.diagElements.day.textContent = state.day;
        this.diagElements.navScreen.textContent = `${state.activeNav} / ${state.activeScreen}`;
        this.diagElements.tutorialBatch.textContent = state.tutorials.activeBatchId || 'none';
        this.diagElements.tutorialStep.textContent = state.tutorials.activeStepId || 'none';
    }

    /**
     * @private
     */
    _makeDraggable() {
        const elmnt = this.gui.domElement;
        const titleEl = elmnt.querySelector('.title');
        if (!titleEl) return;

        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        const dragMouseDown = (e) => {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        const elementDrag = (e) => {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            // Remove transform so it doesn't interfere with dragging
            elmnt.style.transform = `scale(0.75)`; 
        };

        const closeDragElement = () => {
            document.onmouseup = null;
            document.onmousemove = null;
        };

        titleEl.onmousedown = dragMouseDown;
    }


    /**
     * @private
     */
    buildGui() {
        const flowFolder = this.gui.addFolder('Game Flow');
        flowFolder.add(this.actions.godMode, 'handler').name(this.actions.godMode.name);
        flowFolder.add(this.actions.simpleStart, 'handler').name(this.actions.simpleStart.name);
        flowFolder.add(this.actions.skipToHangarTutorial, 'handler').name(this.actions.skipToHangarTutorial.name);

        const playerFolder = this.gui.addFolder('Player');
        this.debugState.creditsToAdd = 100000;
        playerFolder.add(this.debugState, 'creditsToAdd').name('Credits Amount');
        playerFolder.add(this.actions.addCredits, 'handler').name('Add Credits');
        playerFolder.add(this.actions.payDebt, 'handler').name(this.actions.payDebt.name);

        const shipFolder = this.gui.addFolder('Ship');
        const locationOptions = DB.MARKETS.reduce((acc, loc) => ({...acc, [loc.name]: loc.id }), {});
        this.debugState.selectedLocation = this.gameState.currentLocationId;
        shipFolder.add(this.debugState, 'selectedLocation', locationOptions).name('Location');
        shipFolder.add(this.actions.teleport, 'handler').name('Teleport');
        shipFolder.add(this.actions.deductHull20, 'handler').name(this.actions.deductHull20.name);
        shipFolder.add(this.actions.restoreHull, 'handler').name(this.actions.restoreHull.name);
        shipFolder.add(this.actions.destroyShip, 'handler').name(this.actions.destroyShip.name);
        shipFolder.add(this.actions.deductFuel20, 'handler').name(this.actions.deductFuel20.name);
        shipFolder.add(this.actions.restoreFuel, 'handler').name(this.actions.restoreFuel.name);
        shipFolder.add(this.actions.removeAllCargo, 'handler').name(this.actions.removeAllCargo.name);
        shipFolder.add(this.actions.grantAllItems, 'handler').name(this.actions.grantAllItems.name);
        shipFolder.add(this.actions.fillWithCybernetics, 'handler').name(this.actions.fillWithCybernetics.name);
        shipFolder.add(this.actions.fillShipyard, 'handler').name(this.actions.fillShipyard.name);
        shipFolder.add(this.actions.grantAllShips, 'handler').name('Grant All Ships');
        
        const worldFolder = this.gui.addFolder('World & Time');
        this.debugState.daysToAdvance = 7;
        worldFolder.add(this.debugState, 'daysToAdvance', 1, 365, 1).name('Days to Advance');
        worldFolder.add(this.actions.advanceTime, 'handler').name('Advance Time');
        
        const economyFolder = this.gui.addFolder('Economy');
        economyFolder.add(this.actions.replenishStock, 'handler').name(this.actions.replenishStock.name);
        economyFolder.add(this.actions.unlockAll, 'handler').name('Unlock Tiers/Locations');

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

        const automationFolder = this.gui.addFolder('Automation & Logging');
        automationFolder.add(this, 'toggleDiagnosticOverlay').name('Toggle HUD Diagnostics');
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