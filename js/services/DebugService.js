// js/services/DebugService.js
/**
 * @fileoverview This file contains the DebugService class, which is responsible for creating and managing
 * the lil-gui developer panel for real-time testing and manipulation of the game state.
 */
import { DB } from '../data/database.js';
import { LOCATION_IDS, SHIP_IDS, NAV_IDS, SCREEN_IDS, COMMODITY_IDS } from '../data/constants.js';
import { Logger } from './LoggingService.js';
import { calculateInventoryUsed } from '../utils.js';
import { AutomatedPlayer } from './bot/AutomatedPlayerService.js'; // [GEMINI] ADDED IMPORT

// --- [[START]] NEW PRESET MAPPING ---
// Mapping preset names to their new [X%, Y%] values
const TUTORIAL_PRESETS_PERCENT = {
    topCenter: [50, 15], // Example: 50% across, 15% down
    top34Center: [50, 30],
    vertHorizCenter: [50, 50],
    bottom34Center: [50, 70],
    bottomCenter: [50, 85],
    bottomLeft: [15, 85],
    topLeft: [15, 15],
};
// --- [[END]] NEW PRESET MAPPING ---


// [GEMINI] REMOVED ENTIRE 200+ LINE AutomatedPlayer CLASS
// The class definition has been moved to js/services/bot/AutomatedPlayerService.js


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
        
        // --- State for GUI controllers ---
        this.debugState = {
            creditsToAdd: 100000,
            creditsToReduce: 100000,
            selectedLocation: this.gameState.currentLocationId,
            daysToAdvance: 7,
            selectedRandomEvent: 0,
            selectedAgeEvent: DB.AGE_EVENTS[0].id,
            selectedMission: Object.values(DB.MISSIONS)[0]?.id || null,
            botDaysToRun: 365,
            botStrategy: 'MIXED', // [GEMINI] ADDED
            botProgress: 'Idle',
            logLevel: 'INFO',
            // Tutorial Tuner State
            ttStepId: 'None',
            ttAnchor: 'N/A',
            ttPlacement: 'auto',
            ttOffsetDistance: 0,
            ttOffsetSkidding: 0,
            ttPercentX: 50,
            ttPercentY: 50,
            ttWidth: 0,
            ttHeight: 0,
            ttGeneratedCode: ''
        }; 
        // --- End State ---

        this.bot = new AutomatedPlayer(gameState, simulationService, logger);

        // References to GUI controllers and folders for enabling/disabling
        this.tutorialPositionalControllers = {};
    }

    /**
     * Initializes the debug panel.
     */
    init() {
        if (this.gui) return;
        this._cacheDiagElements();
        this.gui = new lil.GUI({ draggable: true, title: 'Debug Menu' });
        this.gui.domElement.id = 'debug-panel';
        this._registerDebugActions();
        this.buildGui();
        this._startDiagLoop();
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
                this.gameState.setState({});
            }},
            reduceCredits: { name: 'Reduce Credits', type: 'button', handler: () => {
                this.gameState.player.credits -= this.debugState.creditsToReduce;
                this.simulationService._checkGameOverConditions();
                this.gameState.setState({});
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
                
                // [GEMINI] MODIFIED: Pass strategy from debugState
                const config = {
                    daysToRun: this.debugState.botDaysToRun,
                    strategy: this.debugState.botStrategy 
                };
                
                this.bot.runSimulation(config, (current, end) => {
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

            // --- [[START]] TUTORIAL TUNER ACTIONS ---
            generateTutorialCode: { name: 'Generate Code', type: 'button', handler: () => this._generateTutorialCode() },
            // --- Presets (Now using keys from TUTORIAL_PRESETS_PERCENT) ---
            presetTopCenter: { name: 'Top Center', type: 'button', handler: () => this._applyTutorialPreset('topCenter') },
            presetTop34Center: { name: 'Top 3/4 Center', type: 'button', handler: () => this._applyTutorialPreset('top34Center') },
            presetVertHorizCenter: { name: 'V/H Center', type: 'button', handler: () => this._applyTutorialPreset('vertHorizCenter') },
            presetBottom34Center: { name: 'Bottom 3/4 Center', type: 'button', handler: () => this._applyTutorialPreset('bottom34Center') },
            presetBottomCenter: { name: 'Bottom Center', type: 'button', handler: () => this._applyTutorialPreset('bottomCenter') },
            presetBottomLeft: { name: 'Bottom Left', type: 'button', handler: () => this._applyTutorialPreset('bottomLeft') },
            presetTopLeft: { name: 'Top Left', type: 'button', handler: () => this._applyTutorialPreset('topLeft') },
            // --- [[END]] TUTORIAL TUNER ACTIONS ---
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
    buildGui() {
        const flowFolder = this.gui.addFolder('Game Flow');
        flowFolder.add(this.actions.godMode, 'handler').name(this.actions.godMode.name);
        flowFolder.add(this.actions.simpleStart, 'handler').name(this.actions.simpleStart.name);
        flowFolder.add(this.actions.skipToHangarTutorial, 'handler').name(this.actions.skipToHangarTutorial.name);

        const playerFolder = this.gui.addFolder('Player');
        playerFolder.add(this.debugState, 'creditsToAdd').name('Credits Amount');
        playerFolder.add(this.actions.addCredits, 'handler').name('Add Credits');
        playerFolder.add(this.debugState, 'creditsToReduce', 100, 1000000, 100).name('Credits to Reduce');
        playerFolder.add(this.actions.reduceCredits, 'handler').name('Reduce Credits');
        playerFolder.add(this.actions.payDebt, 'handler').name(this.actions.payDebt.name);

        const shipFolder = this.gui.addFolder('Ship');
        const locationOptions = DB.MARKETS.reduce((acc, loc) => ({...acc, [loc.name]: loc.id }), {});
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
        worldFolder.add(this.debugState, 'daysToAdvance', 1, 365, 1).name('Days to Advance');
        worldFolder.add(this.actions.advanceTime, 'handler').name('Advance Time');

        const economyFolder = this.gui.addFolder('Economy');
        economyFolder.add(this.actions.replenishStock, 'handler').name(this.actions.replenishStock.name);
        economyFolder.add(this.actions.unlockAll, 'handler').name('Unlock Tiers/Locations');

        const triggerFolder = this.gui.addFolder('Triggers');
        const randomEventOptions = DB.RANDOM_EVENTS.reduce((acc, event, index) => ({...acc, [event.title]: index }), {});
        triggerFolder.add(this.debugState, 'selectedRandomEvent', randomEventOptions).name('Random Event');
        triggerFolder.add(this.actions.triggerRandomEvent, 'handler').name('Trigger Event');
        const ageEventOptions = DB.AGE_EVENTS.reduce((acc, event) => ({...acc, [event.title]: event.id }), {});
        triggerFolder.add(this.debugState, 'selectedAgeEvent', ageEventOptions).name('Age Event');
        triggerFolder.add(this.actions.triggerAgeEvent, 'handler').name('Trigger Event');
        const missionOptions = Object.values(DB.MISSIONS).reduce((acc, m) => ({...acc, [m.name]: m.id}), {});
        if (this.debugState.selectedMission) {
             triggerFolder.add(this.debugState, 'selectedMission', missionOptions).name('Mission');
             triggerFolder.add(this.actions.triggerMission, 'handler').name('Accept Mission');
        }

        // --- [[START]] TUTORIAL TUNER FOLDER ---
        const tutorialFolder = this.gui.addFolder('Tutorial Tuner');
        tutorialFolder.domElement.classList.add('tutorial-tuner-folder');

        tutorialFolder.add(this.debugState, 'ttStepId').name('Step ID').listen().disable();
        tutorialFolder.add(this.debugState, 'ttAnchor').name('Anchor').listen().disable();

        // --- Size Tuners ---
        tutorialFolder.add(this.debugState, 'ttWidth', 0, 800, 10).name('Width (0=auto)').onChange(() => this._handleTutorialTune());
        tutorialFolder.add(this.debugState, 'ttHeight', 0, 800, 10).name('Height (0=auto)').onChange(() => this._handleTutorialTune());

        // --- Position Tuners (Conditional) ---
        // Store references to controllers
        this.tutorialPositionalControllers.percentX = tutorialFolder.add(this.debugState, 'ttPercentX', 0, 100, 1).name('X %').onChange(() => this._handleTutorialTune());
        this.tutorialPositionalControllers.percentY = tutorialFolder.add(this.debugState, 'ttPercentY', 0, 100, 1).name('Y %').onChange(() => this._handleTutorialTune());
        this.tutorialPositionalControllers.placement = tutorialFolder.add(this.debugState, 'ttPlacement').name('Placement (Elem)').onChange(() => this._handleTutorialTune());
        this.tutorialPositionalControllers.distance = tutorialFolder.add(this.debugState, 'ttOffsetDistance', -500, 500, 1).name('Distance (Elem)').onChange(() => this._handleTutorialTune());
        this.tutorialPositionalControllers.skidding = tutorialFolder.add(this.debugState, 'ttOffsetSkidding', -500, 500, 1).name('Skidding (Elem)').onChange(() => this._handleTutorialTune());

        // --- Position Presets ---
        const presetFolder = tutorialFolder.addFolder('Position Presets');
        presetFolder.add(this.actions.presetTopCenter, 'handler').name(this.actions.presetTopCenter.name);
        presetFolder.add(this.actions.presetTop34Center, 'handler').name(this.actions.presetTop34Center.name);
        presetFolder.add(this.actions.presetVertHorizCenter, 'handler').name(this.actions.presetVertHorizCenter.name);
        presetFolder.add(this.actions.presetBottom34Center, 'handler').name(this.actions.presetBottom34Center.name);
        presetFolder.add(this.actions.presetBottomCenter, 'handler').name(this.actions.presetBottomCenter.name);
        presetFolder.add(this.actions.presetBottomLeft, 'handler').name(this.actions.presetBottomLeft.name);
        presetFolder.add(this.actions.presetTopLeft, 'handler').name(this.actions.presetTopLeft.name);
        // ** Store reference to the FOLDER INSTANCE itself **
        this.tutorialPositionalControllers.presetFolder = presetFolder;

        // --- Code Generator ---
        tutorialFolder.add(this.actions.generateTutorialCode, 'handler').name(this.actions.generateTutorialCode.name);
        tutorialFolder.add(this.debugState, 'ttGeneratedCode').name('Code').listen();

        // Initial state update for controls
        this._updateTutorialControlVisibility(false); // Assume initially no step is active
        // --- [[END]] TUTORIAL TUNER FOLDER ---

        const automationFolder = this.gui.addFolder('Automation & Logging');
        automationFolder.add(this, 'toggleDiagnosticOverlay').name('Toggle HUD Diagnostics');
        automationFolder.add(this.debugState, 'logLevel', ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE']).name('Log Level').onChange(v => this.logger.setLevel(v));
        automationFolder.add(this, 'generateBugReport').name('Generate Bug Report');
        
        // --- [GEMINI] MODIFIED: Added PROSPECTOR strategy ---
        automationFolder.add(this.debugState, 'botStrategy', ['MIXED', 'HONEST_TRADER', 'MANIPULATOR', 'DEPLETE_ONLY', 'PROSPECTOR']).name('Bot Strategy');
        // --- End Modification ---
        
        automationFolder.add(this.debugState, 'botDaysToRun', 1, 10000, 1).name('Simulation Days');
        automationFolder.add(this.actions.startBot, 'handler').name(this.actions.startBot.name);
        automationFolder.add(this.actions.stopBot, 'handler').name(this.actions.stopBot.name);
        automationFolder.add(this.debugState, 'botProgress').name('Progress').listen();

        this.gui.folders.forEach(folder => folder.close());
    }

    // --- [[START]] TUTORIAL TUNER METHODS ---

    /**
     * Parses a size value (e.g., 'auto', '300px', 300) into a number for the slider.
     * @param {string|number|undefined} sizeValue - The value from the step definition.
     * @returns {number} A number, with 0 representing 'auto'.
     * @private
     */
    _parseSize(sizeValue) {
        if (!sizeValue || sizeValue === 'auto') return 0;
        if (typeof sizeValue === 'number') return sizeValue;
        if (typeof sizeValue === 'string') {
            const parsed = parseInt(sizeValue, 10);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    /**
     * Applies a position preset to the tuner sliders based on anchoring mode.
     * @param {string} presetKey - Key corresponding to TUTORIAL_PRESETS_PERCENT.
     * @private
     */
    _applyTutorialPreset(presetKey) {
        const isOverlayAnchor = this.debugState.ttAnchor === 'body'; // Using 'body' as proxy for overlay

        if (isOverlayAnchor) {
            const percentValues = TUTORIAL_PRESETS_PERCENT[presetKey];
            if (percentValues) {
                this.debugState.ttPercentX = percentValues[0];
                this.debugState.ttPercentY = percentValues[1];
                this.tutorialPositionalControllers.percentX?.updateDisplay();
                this.tutorialPositionalControllers.percentY?.updateDisplay();
            } else {
                 this.logger.warn('DebugService', `Preset key "${presetKey}" not found for percentage presets.`);
            }
        } else {
            // Placeholder: Need to define offset presets if required for element anchors
            this.logger.warn('DebugService', 'Offset presets not yet defined for element anchors.');
            // Example:
            // const offsetValues = TUTORIAL_PRESETS_OFFSET[presetKey];
            // if (offsetValues) {
            //     this.debugState.ttOffsetSkidding = offsetValues[0];
            //     this.debugState.ttOffsetDistance = offsetValues[1];
            //     this.tutorialPositionalControllers.skidding?.updateDisplay();
            //     this.tutorialPositionalControllers.distance?.updateDisplay();
            // }
        }

        // Trigger UI update
        this._handleTutorialTune();
    }

    /**
     * Shows/hides tutorial tuner controls based on anchor type using lil-gui methods.
     * @param {boolean} isOverlayAnchor - True if the toast should use percentage positioning.
     * @private
     */
    _updateTutorialControlVisibility(isOverlayAnchor) {
         // Helper function using lil-gui's show() / hide()
         const setVisibility = (controller, shouldShow) => {
             if (controller) {
                 controller.show(shouldShow);
             }
         };

         // Percentage controls
         setVisibility(this.tutorialPositionalControllers.percentX, isOverlayAnchor);
         setVisibility(this.tutorialPositionalControllers.percentY, isOverlayAnchor);

         // Popper offset controls
         setVisibility(this.tutorialPositionalControllers.placement, !isOverlayAnchor);
         setVisibility(this.tutorialPositionalControllers.distance, !isOverlayAnchor);
         setVisibility(this.tutorialPositionalControllers.skidding, !isOverlayAnchor);

         // Preset folder visibility (Show only for overlay anchors for now)
         if (this.tutorialPositionalControllers.presetFolder) {
              this.tutorialPositionalControllers.presetFolder.show(isOverlayAnchor);
         }
    }


    /**
     * Populates the Tutorial Tuner with the active step's data.
     * Called by UIManager when a toast is shown.
     * @param {object} step - The tutorial step object.
     */
    setActiveTutorialStep(step) {
        this.logger.info.system('DebugService', `Setting active tutorial step: ${step.stepId}`);
        const isOverlayAnchor = step.anchorElement === 'body'; // Use 'body' to signify overlay anchor

        // Reset generated code
        this.debugState.ttGeneratedCode = '';

        // Update state
        this.debugState.ttStepId = step.stepId;
        this.debugState.ttAnchor = step.anchorElement; // Keep original anchor for info
        this.debugState.ttWidth = this._parseSize(step.size?.width) || 0;
        this.debugState.ttHeight = this._parseSize(step.size?.height) || 0;

        if (isOverlayAnchor) {
            // Use percentage position from step or default to center
            this.debugState.ttPercentX = step.positionX ?? 50;
            this.debugState.ttPercentY = step.positionY ?? 50;
            // Reset/default Popper values for clarity
            this.debugState.ttPlacement = 'auto';
            this.debugState.ttOffsetDistance = 0;
            this.debugState.ttOffsetSkidding = 0;
        } else {
            // Use Popper settings from step or defaults
            const offsetMod = step.popperOptions?.modifiers?.find(m => m.name === 'offset');
            let skidding = 0;
            let distance = 0;

            if (typeof offsetMod?.options?.offset === 'function') {
                this.logger.warn('DebugService', `Offset function used for ${step.stepId}. Tuner defaults to [0, 10].`);
                distance = 10; // Default distance for element anchors
            } else if (Array.isArray(offsetMod?.options?.offset)) {
                skidding = offsetMod.options.offset[0] || 0;
                distance = offsetMod.options.offset[1] || 0;
            } else {
                 distance = 10; // Default distance if no offset defined
            }

            this.debugState.ttPlacement = step.placement || step.popperOptions?.placement || 'auto';
            this.debugState.ttOffsetDistance = distance;
            this.debugState.ttOffsetSkidding = skidding;
            // Reset/default percentage values
            this.debugState.ttPercentX = 50;
            this.debugState.ttPercentY = 50;
        }

        // Update visibility of controls AFTER setting state
        this._updateTutorialControlVisibility(isOverlayAnchor);

        // Manually update displays for all relevant controllers
        // This ensures sliders reflect the loaded step's values
        Object.values(this.tutorialPositionalControllers).forEach(controllerOrFolder => {
             // Check if it's a controller (has updateDisplay) or the folder (doesn't)
             if (controllerOrFolder && typeof controllerOrFolder.updateDisplay === 'function') {
                 controllerOrFolder.updateDisplay();
             }
         });
         // Also update size controllers
         this.gui.controllers.find(c => c.property === 'ttWidth')?.updateDisplay();
         this.gui.controllers.find(c => c.property === 'ttHeight')?.updateDisplay();

    }

    /**
     * Clears and resets the Tutorial Tuner.
     * Called by UIManager when a toast is hidden.
     */
    clearActiveTutorialStep() {
        this.logger.info.system('DebugService', 'Clearing active tutorial step.');

        // Reset all state properties to their defaults
        this.debugState.ttStepId = 'None';
        this.debugState.ttAnchor = 'N/A';
        this.debugState.ttPlacement = 'auto';
        this.debugState.ttOffsetDistance = 0;
        this.debugState.ttOffsetSkidding = 0;
        this.debugState.ttPercentX = 50;
        this.debugState.ttPercentY = 50;
        this.debugState.ttWidth = 0;
        this.debugState.ttHeight = 0;
        this.debugState.ttGeneratedCode = '';

        // Hide conditional controls
        this._updateTutorialControlVisibility(false);
    }

    /**
     * Handles live tuning input from the debug panel.
     * @private
     */
    _handleTutorialTune() {
        if (!this.uiManager) return;

        const isOverlayAnchor = this.debugState.ttAnchor === 'body';
        this.logger.info.system('DebugService', `Tune event (Overlay: ${isOverlayAnchor}): X%=${this.debugState.ttPercentX}, Y%=${this.debugState.ttPercentY}, Place=${this.debugState.ttPlacement}, Dist=${this.debugState.ttOffsetDistance}, Skid=${this.debugState.ttOffsetSkidding}`);

        this.uiManager.updateTutorialPopper({
            isOverlayAnchor: isOverlayAnchor, // Pass mode to UIManager
            // Size
            width: Number(this.debugState.ttWidth) || 0,
            height: Number(this.debugState.ttHeight) || 0,
            // Percentage Position (if overlay)
            percentX: Number(this.debugState.ttPercentX) || 50,
            percentY: Number(this.debugState.ttPercentY) || 50,
            // Popper Position (if element)
            placement: this.debugState.ttPlacement,
            distance: Number(this.debugState.ttOffsetDistance) || 0,
            skidding: Number(this.debugState.ttOffsetSkidding) || 0,
        });
    }

    /**
     * Generates the code string from the current tuner state.
     * Outputs either percentage or Popper options based on anchor type.
     * @private
     */
    _generateTutorialCode() {
        this.logger.info.system('DebugService', 'Generating tutorial code...');
        const isOverlayAnchor = this.debugState.ttAnchor === 'body';

        // Size String (common)
        const hasSize = this.debugState.ttWidth > 0 || this.debugState.ttHeight > 0;
        const widthVal = this.debugState.ttWidth > 0 ? `'${this.debugState.ttWidth}px'` : "'auto'";
        const heightVal = this.debugState.ttHeight > 0 ? `'${this.debugState.ttHeight}px'` : "'auto'";
        const sizeString = hasSize ? `
size: { width: ${widthVal}, height: ${heightVal} },` : '';

        let positionString = '';
        if (isOverlayAnchor) {
            // Generate Percentage Position Code
             // Make sure anchorElement is 'body'
             positionString = `
anchorElement: 'body',`; // Explicitly set anchor
            // Only add percentages if not default (50, 50)
            if (this.debugState.ttPercentX !== 50 || this.debugState.ttPercentY !== 50) {
                 positionString += `
positionX: ${this.debugState.ttPercentX},
positionY: ${this.debugState.ttPercentY},`;
            }

        } else {
            // Generate Popper Options Code
             // Add anchorElement only if it's NOT body
             if (this.debugState.ttAnchor !== 'body') {
                 positionString = `
anchorElement: '${this.debugState.ttAnchor}',`;
             }
            positionString += `
placement: '${this.debugState.ttPlacement}',
popperOptions: {
    modifiers: [
        { name: 'offset', options: { offset: [${this.debugState.ttOffsetSkidding}, ${this.debugState.ttOffsetDistance}] } }
        // Add other modifiers here if needed in the future
    ]
}`;
        }

        // Construct final code, removing potential trailing comma before a closing brace
        let code = `// --- ${this.debugState.ttStepId} ---${sizeString}${positionString}`;
        code = code.replace(/,\s*(\}|$)/g, '$1'); // Regex to remove trailing comma

        this.debugState.ttGeneratedCode = code;
    }

    // --- [[END]] TUTORIAL TUNER METHODS ---
}