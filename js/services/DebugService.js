// js/services/DebugService.js
/**
 * @fileoverview This file contains the DebugService class, responsible for providing
 * development and debugging tools accessible via a UI panel (lil-gui). It allows
 * manipulation of game state, triggering events, and visualizing data.
 */
import { DB } from '../data/database.js';
import { GAME_RULES, SCREEN_IDS, NAV_IDS } from '../data/constants.js';
import { formatCredits } from '../utils.js';

/**
 * @class DebugService
 * @description Manages the debug panel and associated cheat/utility functions.
 */
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
        this.isVisible = false;

        // --- State for GUI Controllers ---
        // Mirror CSS variables for synchronized control
        this.state = {
            // General
            bgColor: getComputedStyle(document.documentElement).getPropertyValue('--ot-bg-dark').trim(),
            // Borders
            frameBorderColor: getComputedStyle(document.documentElement).getPropertyValue('--frame-border-color').trim(),
            frameGlowColor: getComputedStyle(document.documentElement).getPropertyValue('--frame-glow-color').trim(),
            frameGlowIntensity: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--frame-glow-intensity').replace('px', ''), 10),
            frameBorderStyle: getComputedStyle(document.documentElement).getPropertyValue('--frame-border-style').trim(),
            frameBorderWidth: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--frame-border-width').replace('px', ''), 10),
            // Panel Theme (Dark)
            panelDarkBg: getComputedStyle(document.documentElement).getPropertyValue('--ot-panel-dark-bg').trim(),
            panelDarkBorder: getComputedStyle(document.documentElement).getPropertyValue('--ot-panel-dark-border').trim(),
            // Text Colors
            textPrimary: getComputedStyle(document.documentElement).getPropertyValue('--ot-text-primary').trim(),
            textSecondary: getComputedStyle(document.documentElement).getPropertyValue('--ot-text-secondary').trim(),
            // Accents
            accentCyanBase: getComputedStyle(document.documentElement).getPropertyValue('--ot-cyan-base').trim(),
            accentGreen: getComputedStyle(document.documentElement).getPropertyValue('--ot-green-accent').trim(),
            accentYellow: getComputedStyle(document.documentElement).getPropertyValue('--ot-yellow-accent').trim(),
            accentRedBase: getComputedStyle(document.documentElement).getPropertyValue('--ot-red-base').trim(),
            // Button Colors
            btnBg: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-bg').trim(),
            btnHoverBg: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-hover-bg').trim(),
            btnActiveBg: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-active-bg').trim(),
            btnBorder: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-border').trim(),
            btnDisabledBg: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-disabled-bg').trim(),
            btnDisabledBorder: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-disabled-border').trim(),
            btnDisabledText: getComputedStyle(document.documentElement).getPropertyValue('--ot-btn-disabled-text').trim(),
            // Scrollbars
            scrollbarThumb: getComputedStyle(document.documentElement).getPropertyValue('--ot-scrollbar-thumb').trim(),
            scrollbarTrack: getComputedStyle(document.documentElement).getPropertyValue('--ot-scrollbar-track').trim(),

            // Game State Specific
            credits: this.gameState.player?.credits || 0,
            day: this.gameState.day || 1,
            selectedEvent: DB.RANDOM_EVENTS[0]?.id || '',
            targetLocation: DB.MARKETS[1]?.id || '', // Default to Luna if Mars is current
            targetShip: DB.SHIPS.hauler_c1.name,
            targetGood: DB.COMMODITIES[0].id,
            targetQuantity: 10,
            targetPriceAdjustment: 0,
        };

        // Store default values for reset functionality
        this.defaults = { ...this.state };
    }

    /**
     * Initializes the lil-gui panel and adds controllers.
     */
    init() {
        this.gui = new lil.GUI({ title: 'Orbital Trading Debug', width: 350 });
        this.gui.domElement.style.display = 'none'; // Initially hidden
        this.gui.domElement.style.position = 'fixed';
        this.gui.domElement.style.top = '10px';
        this.gui.domElement.style.right = '10px';
        this.gui.domElement.style.zIndex = '1000'; // Ensure it's above other elements

        // --- Styles Folder ---
        const stylesFolder = this.gui.addFolder('Theme Styles');
        this._addStyleControllers(stylesFolder);
        stylesFolder.add(this, 'resetStyles').name('Reset Styles');

        // --- Game State Folder ---
        const gameStateFolder = this.gui.addFolder('Game State Cheats');
        this._addGameStateControllers(gameStateFolder);

        // --- Actions Folder ---
        const actionsFolder = this.gui.addFolder('Actions');
        this._addActionControllers(actionsFolder);

        // Update state bindings when game state changes externally
        this.gameState.subscribe(() => {
            this.state.credits = this.gameState.player?.credits || 0;
            this.state.day = this.gameState.day || 1;
            // Only update controllers if the GUI is visible to avoid errors
            if (this.isVisible) {
                this.gui.controllers.forEach(c => c.updateDisplay());
            }
        });
    }

    /**
     * Toggles the visibility of the debug panel.
     */
    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.gui.domElement.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            // Refresh display values when showing
            this.gui.controllers.forEach(c => c.updateDisplay());
        }
    }

    /**
     * Adds controllers for theme style variables.
     * @param {import('lil-gui').GUI} folder - The folder to add controllers to.
     * @private
     */
    _addStyleControllers(folder) {
        folder.addColor(this.state, 'bgColor').name('Background').onChange(v => this._updateCSS('--ot-bg-dark', v));
        // Borders Folder
        const bordersFolder = folder.addFolder('Frames & Borders');
        bordersFolder.addColor(this.state, 'frameBorderColor').name('Border Color').onChange(v => this._updateCSS('--frame-border-color', v));
        bordersFolder.addColor(this.state, 'frameGlowColor').name('Glow Color').onChange(v => this._updateCSS('--frame-glow-color', v));
        bordersFolder.add(this.state, 'frameGlowIntensity', 0, 50, 1).name('Glow Intensity (px)').onChange(v => this._updateCSS('--frame-glow-intensity', `${v}px`));
        bordersFolder.add(this.state, 'frameBorderStyle', ['solid', 'dashed', 'dotted']).name('Border Style').onChange(v => this._updateCSS('--frame-border-style', v));
        bordersFolder.add(this.state, 'frameBorderWidth', 0, 5, 1).name('Border Width (px)').onChange(v => this._updateCSS('--frame-border-width', `${v}px`));
        // Panel Theme
        const panelFolder = folder.addFolder('Dark Panels');
        panelFolder.addColor(this.state, 'panelDarkBg').name('Panel BG').onChange(v => this._updateCSS('--ot-panel-dark-bg', v));
        panelFolder.addColor(this.state, 'panelDarkBorder').name('Panel Border').onChange(v => this._updateCSS('--ot-panel-dark-border', v));
        // Text Colors
        const textFolder = folder.addFolder('Text');
        textFolder.addColor(this.state, 'textPrimary').name('Primary Text').onChange(v => this._updateCSS('--ot-text-primary', v));
        textFolder.addColor(this.state, 'textSecondary').name('Secondary Text').onChange(v => this._updateCSS('--ot-text-secondary', v));
        // Accents
        const accentsFolder = folder.addFolder('Accents');
        accentsFolder.addColor(this.state, 'accentCyanBase').name('Cyan').onChange(v => this._updateCSS('--ot-cyan-base', v));
        accentsFolder.addColor(this.state, 'accentGreen').name('Green').onChange(v => this._updateCSS('--ot-green-accent', v));
        accentsFolder.addColor(this.state, 'accentYellow').name('Yellow').onChange(v => this._updateCSS('--ot-yellow-accent', v));
        accentsFolder.addColor(this.state, 'accentRedBase').name('Red').onChange(v => this._updateCSS('--ot-red-base', v));
        // Buttons
        const buttonsFolder = folder.addFolder('Buttons');
        buttonsFolder.addColor(this.state, 'btnBg').name('BG').onChange(v => this._updateCSS('--ot-btn-bg', v));
        buttonsFolder.addColor(this.state, 'btnHoverBg').name('Hover BG').onChange(v => this._updateCSS('--ot-btn-hover-bg', v));
        buttonsFolder.addColor(this.state, 'btnActiveBg').name('Active BG').onChange(v => this._updateCSS('--ot-btn-active-bg', v));
        buttonsFolder.addColor(this.state, 'btnBorder').name('Border').onChange(v => this._updateCSS('--ot-btn-border', v));
        buttonsFolder.addColor(this.state, 'btnDisabledBg').name('Disabled BG').onChange(v => this._updateCSS('--ot-btn-disabled-bg', v));
        buttonsFolder.addColor(this.state, 'btnDisabledBorder').name('Disabled Border').onChange(v => this._updateCSS('--ot-btn-disabled-border', v));
        buttonsFolder.addColor(this.state, 'btnDisabledText').name('Disabled Text').onChange(v => this._updateCSS('--ot-btn-disabled-text', v));
        // Scrollbars
        const scrollbarFolder = folder.addFolder('Scrollbars');
        scrollbarFolder.addColor(this.state, 'scrollbarThumb').name('Thumb Color').onChange(v => this._updateCSS('--ot-scrollbar-thumb', v));
        scrollbarFolder.addColor(this.state, 'scrollbarTrack').name('Track Color').onChange(v => this._updateCSS('--ot-scrollbar-track', v));
    }

    /**
     * Adds controllers for game state manipulation.
     * @param {import('lil-gui').GUI} folder - The folder to add controllers to.
     * @private
     */
    _addGameStateControllers(folder) {
        folder.add(this.state, 'credits', 0, 100000000, 1000).name('Credits').listen().onChange(v => this.gameState.player.credits = v);
        folder.add(this.state, 'day', 1, 5000, 1).name('Day').listen().onChange(v => this.gameState.day = v);
        folder.add(this, 'advanceDay').name('Advance 1 Day');
        folder.add(this, 'advanceMonth').name('Advance 30 Days');
        folder.add(this, 'resetPlayer').name('Reset Player State');
    }

    /**
     * Adds controllers for triggering game actions.
     * @param {import('lil-gui').GUI} folder - The folder to add controllers to.
     * @private
     */
    _addActionControllers(folder) {
        folder.add(this, 'simpleStart').name('Simple Start (No Intro)');
        // Events
        const eventOptions = DB.RANDOM_EVENTS.reduce((acc, event) => { acc[event.title] = event.id; return acc; }, {});
        folder.add(this.state, 'selectedEvent', eventOptions).name('Select Event');
        folder.add(this, 'triggerSelectedEvent').name('Trigger Event');
        // Travel
        const locationOptions = DB.MARKETS.reduce((acc, loc) => { acc[loc.name] = loc.id; return acc; }, {});
        folder.add(this.state, 'targetLocation', locationOptions).name('Target Location');
        folder.add(this, 'travelToTarget').name('Travel Instantly');
        // Shipyard
        const shipOptions = Object.entries(DB.SHIPS).reduce((acc, [id, ship]) => { acc[ship.name] = id; return acc; }, {});
        folder.add(this.state, 'targetShip', shipOptions).name('Target Ship');
        folder.add(this, 'addShipToHangar').name('Add Ship to Hangar');
        // Cargo
        const goodOptions = DB.COMMODITIES.reduce((acc, good) => { acc[good.name] = good.id; return acc; }, {});
        folder.add(this.state, 'targetGood', goodOptions).name('Target Commodity');
        folder.add(this.state, 'targetQuantity', 1, 1000, 1).name('Quantity');
        folder.add(this, 'addCargoToShip').name('Add Cargo to Active Ship');
        // Market Price
        folder.add(this.state, 'targetPriceAdjustment', -100, 100, 5).name('Price Adjust %');
        folder.add(this, 'adjustMarketPrice').name('Adjust Market Price');
    }


    /**
     * Updates a CSS variable on the root element.
     * @param {string} variable - The CSS variable name (e.g., '--ot-bg-dark').
     * @param {string} value - The new value for the variable.
     * @private
     */
    _updateCSS(variable, value) {
        document.documentElement.style.setProperty(variable, value);
    }

    /**
     * Resets all theme styles to their default values.
     */
    resetStyles() {
        for (const key in this.defaults) {
            if (this.state.hasOwnProperty(key)) {
                this.state[key] = this.defaults[key];
                // Find the corresponding CSS variable name (requires some mapping logic)
                const cssVar = this._mapStateKeyToCSSVar(key);
                if (cssVar) {
                    let value = this.defaults[key];
                    // Add 'px' back for numeric style values
                    if (['frameGlowIntensity', 'frameBorderWidth'].includes(key)) {
                        value = `${value}px`;
                    }
                    this._updateCSS(cssVar, value);
                }
            }
        }
        // Update the GUI display
        this.gui.controllers.forEach(c => c.updateDisplay());
    }

    /**
     * Maps internal state keys back to their CSS variable names.
     * This is the inverse of the mapping done during initialization.
     * @param {string} key - The internal state key (e.g., 'bgColor').
     * @returns {string|null} - The corresponding CSS variable name or null.
     * @private
     */
    _mapStateKeyToCSSVar(key) {
        const mapping = {
            bgColor: '--ot-bg-dark',
            frameBorderColor: '--frame-border-color',
            frameGlowColor: '--frame-glow-color',
            frameGlowIntensity: '--frame-glow-intensity',
            frameBorderStyle: '--frame-border-style',
            frameBorderWidth: '--frame-border-width',
            panelDarkBg: '--ot-panel-dark-bg',
            panelDarkBorder: '--ot-panel-dark-border',
            textPrimary: '--ot-text-primary',
            textSecondary: '--ot-text-secondary',
            accentCyanBase: '--ot-cyan-base',
            accentGreen: '--ot-green-accent',
            accentYellow: '--ot-yellow-accent',
            accentRedBase: '--ot-red-base',
            btnBg: '--ot-btn-bg',
            btnHoverBg: '--ot-btn-hover-bg',
            btnActiveBg: '--ot-btn-active-bg',
            btnBorder: '--ot-btn-border',
            btnDisabledBg: '--ot-btn-disabled-bg',
            btnDisabledBorder: '--ot-btn-disabled-border',
            btnDisabledText: '--ot-btn-disabled-text',
            scrollbarThumb: '--ot-scrollbar-thumb',
            scrollbarTrack: '--ot-scrollbar-track'
        };
        return mapping[key] || null;
    }

    // --- Action Methods ---

    advanceDay() {
        this.simulationService.timeService.advanceDay();
        this.logger.debug.manual('Debug', 'Advanced day by 1.');
    }

    advanceMonth() {
        this.simulationService.timeService.advanceDays(30);
        this.logger.debug.manual('Debug', 'Advanced days by 30.');
    }

    resetPlayer() {
        // Caution: This is a basic reset, might need expansion
        this.gameState.player.credits = GAME_RULES.STARTING_CREDITS;
        this.gameState.player.debt = 0; // Or initial debt if applicable
        this.gameState.player.ownedShipIds = ['starter']; // Assuming 'starter' is the ID
        this.gameState.player.activeShipId = 'starter';
        this.gameState.player.shipStates = { 'starter': { health: DB.SHIPS.starter.maxHealth, fuel: DB.SHIPS.starter.maxFuel, hullAlerts: { one: false, two: false } } };
        this.gameState.player.inventories = { 'starter': {} };
        DB.COMMODITIES.forEach(c => { this.gameState.player.inventories['starter'][c.id] = { quantity: 0, avgCost: 0 }; });
        this.gameState.setState({}); // Notify UI
        this.logger.debug.manual('Debug', 'Player state reset.');
    }

    simpleStart() {
        this.gameState.introSequenceActive = false;
        // REMOVED tutorial skip
        // if (this.simulationService.tutorialService) {
        //     Object.keys(DB.TUTORIAL_DATA).forEach(batchId => {
        //         if (!this.gameState.tutorials.skippedTutorialBatches.includes(batchId)) {
        //             this.gameState.tutorials.skippedTutorialBatches.push(batchId);
        //         }
        //     });
        //     this.simulationService.tutorialService._endBatch(); // Ensure any active tutorial is cleared
        // }
        this.gameState.setState({ introSequenceActive: false }); // Update state
        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR); // Go to hangar after simple start
        this.logger.debug.manual('Debug', 'Simple start activated (Intro skipped).');
    }

    triggerSelectedEvent() {
        const eventId = this.state.selectedEvent;
        const eventData = DB.RANDOM_EVENTS.find(e => e.id === eventId);
        if (eventData && this.simulationService.travelService) {
            // Need to simulate being in travel to trigger event correctly
            this.gameState.pendingTravel = { destinationId: this.state.targetLocation || DB.MARKETS[1].id, remainingDays: 1, startTime: this.gameState.day };
            this.simulationService.travelService._triggerRandomEvent(eventData);
            this.gameState.pendingTravel = null; // Clean up simulated travel state
            this.logger.debug.manual('Debug', `Triggered event: ${eventData.title}`);
        } else {
            this.logger.warn('Debug', `Could not trigger event ID: ${eventId}`);
        }
    }

    travelToTarget() {
        const targetId = this.state.targetLocation;
        if (targetId && this.gameState.currentLocationId !== targetId) {
            this.gameState.currentLocationId = targetId;
            this.gameState.pendingTravel = null; // Ensure any pending travel is cleared
            this.gameState.setState({}); // Update UI
            this.logger.debug.manual('Debug', `Instant travel to ${DB.MARKETS.find(m => m.id === targetId)?.name}`);
        }
    }

    addShipToHangar() {
        const shipId = this.state.targetShip;
        if (shipId && !this.gameState.player.ownedShipIds.includes(shipId)) {
            this.simulationService.addShipToHangar(shipId);
            this.gameState.setState({}); // Update UI
            this.logger.debug.manual('Debug', `Added ship ${DB.SHIPS[shipId]?.name} to hangar.`);
        } else {
             this.logger.warn('Debug', `Ship ${shipId} already owned or invalid.`);
        }
    }

    addCargoToShip() {
        const goodId = this.state.targetGood;
        const quantity = this.state.targetQuantity;
        const activeShipId = this.gameState.player.activeShipId;
        if (!activeShipId) {
             this.logger.warn('Debug', `No active ship to add cargo to.`);
             return;
        }
        const inventory = this.gameState.player.inventories[activeShipId];
        if (goodId && quantity > 0 && inventory) {
             if (!inventory[goodId]) {
                 inventory[goodId] = { quantity: 0, avgCost: 0 };
             }
             inventory[goodId].quantity += quantity;
             // Optionally update avgCost if needed for debug purposes
             this.gameState.setState({});
             this.logger.debug.manual('Debug', `Added ${quantity}x ${DB.COMMODITIES.find(c=>c.id === goodId)?.name} to active ship.`);
        }
    }

    adjustMarketPrice() {
        const goodId = this.state.targetGood;
        const adjustmentPercent = this.state.targetPriceAdjustment;
        const currentLocationId = this.gameState.currentLocationId;

        if (goodId && currentLocationId && this.gameState.market.prices[currentLocationId]?.[goodId]) {
            const currentPrice = this.gameState.market.prices[currentLocationId][goodId];
            const newPrice = Math.max(1, Math.round(currentPrice * (1 + adjustmentPercent / 100)));
            this.gameState.market.prices[currentLocationId][goodId] = newPrice;
            this.gameState.setState({}); // Force UI update
             this.logger.debug.manual('Debug', `Adjusted ${DB.COMMODITIES.find(c=>c.id === goodId)?.name} price at ${DB.MARKETS.find(m => m.id === currentLocationId)?.name} by ${adjustmentPercent}%. New price: ${newPrice}`);
        }
    }
}