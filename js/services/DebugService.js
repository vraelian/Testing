// js/services/DebugService.js
/**
 * @fileoverview This file contains the DebugService class, which is responsible for creating and managing
 * the lil-gui developer panel for real-time testing and manipulation of the game state.
 */
import { DB } from '../data/database.js';
import { LOCATION_IDS, SHIP_IDS, NAV_IDS, SCREEN_IDS, ACTION_IDS, COMMODITY_IDS } from '../data/constants.js';
import { Logger } from './LoggingService.js';
import { calculateInventoryUsed, skewedRandom } from '../utils.js'; 
import { AutomatedPlayer } from './bot/AutomatedPlayerService.js';
import { GameAttributes } from './GameAttributes.js'; 
import { AssetService } from './AssetService.js'; 
import { OFFICERS } from '../data/officers.js'; 

// --- EPHEMERAL DEBUG MISSIONS ---
// These are injected into DB.MISSIONS at runtime for testing purposes.
const DEBUG_MISSIONS = {
    'debug_kitchen_sink': {
        id: 'debug_kitchen_sink',
        name: '[DEBUG] Kitchen Sink Rewards',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Instantly completes to test multiple reward types (Credits, Items, Licenses).',
        triggers: [],
        objectives: [], // Auto-complete
        completion: {
            locationId: null, // Complete anywhere
            title: 'Debug Success',
            text: 'You have received a bounty of debug rewards.',
            buttonText: 'Claim Loot'
        },
        rewards: [
            { type: 'credits', amount: 50000 },
            { type: 'item', goodId: 'fuel', quantity: 100 },
            { type: 'license', licenseId: 't2_license' } 
        ]
    },
    'debug_obj_travel': {
        id: 'debug_obj_travel',
        name: '[DEBUG] Travel Logic (Mars)',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Requires travel to Mars to verify location triggers.',
        triggers: [],
        objectives: [
            { type: 'TRAVEL_TO', target: 'loc_mars' }
        ],
        completion: {
            locationId: 'loc_mars',
            title: 'Arrived at Mars',
            text: 'Travel objective verified.',
            buttonText: 'OK'
        },
        rewards: [{ type: 'credits', amount: 100 }]
    },
    'debug_obj_wealth': {
        id: 'debug_obj_wealth',
        name: '[DEBUG] Wealth Check (>10k)',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Requires player to have > 10,000 credits.',
        triggers: [],
        objectives: [
            { type: 'WEALTH_CHECK', value: 10000 }
        ],
        completion: {
            locationId: null,
            title: 'Wealth Verified',
            text: 'You are wealthy enough.',
            buttonText: 'OK'
        },
        rewards: [{ type: 'credits', amount: 1 }]
    },
    'debug_obj_delivery': {
        id: 'debug_obj_delivery',
        name: '[DEBUG] Delivery (Water Ice)',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Deliver 5 Water Ice. (Cargo provided on accept)',
        triggers: [],
        objectives: [
            { type: 'DELIVER_ITEM', goodId: 'water_ice', quantity: 5 }
        ],
        providedCargo: [{ goodId: 'water_ice', quantity: 5 }],
        completion: {
            locationId: null,
            title: 'Delivery Done',
            text: 'Items deducted correctly?',
            buttonText: 'OK'
        },
        rewards: [{ type: 'credits', amount: 500 }]
    }
};

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
        
        // V4: Bind inspector events to maintain `this` context
        this._boundInspectorClick = this._handleInspectorClick.bind(this);
        this._boundInspectorHover = this._handleInspectorHover.bind(this);
        this._boundInspectorOut = this._handleInspectorOut.bind(this);
        
        // --- State for GUI controllers ---
        this.debugState = {
            creditsToAdd: 100000,
            creditsToReduce: 100000,
            targetAge: 25, 
            selectedLocation: this.gameState.currentLocationId,
            daysToAdvance: 7,
            selectedRandomEvent: DB.RANDOM_EVENTS[0]?.id || '', 
            selectedAgeEvent: DB.AGE_EVENTS[0]?.id || null, 
            // Default to first debug mission if available
            selectedMission: 'debug_kitchen_sink',
            botDaysToRun: 365,
            botStrategy: 'MIXED', 
            botProgress: 'Idle',
            logLevel: 'INFO',
            
            // Ship Debugging
            selectedUpgrade: null, 
            selectedCommodityToAdd: COMMODITY_IDS.WATER_ICE,
            quantityToAdd: 10,
            
            // [[DEBUG FLAG STATE]]
            alwaysTriggerEvents: false,

            // V4 Tutorial Maker State
            inspectorActive: false,
            draftTutorialBatch: {
                id: 'draft_batch',
                title: 'Draft Tutorial',
                triggerType: 'SCREEN_LOAD',
                triggerTarget: 'market',
                triggerValue: 1000, // Used for STATE_CHANGE triggers
                navLock: true,
                steps: []
            },
            draftStepText: 'Instruction text here.',
            draftStepCompletion: 'INFO',
            draftStepTheme: 'default',
            draftStepSpotlight: true,
            draftStepClickThrough: false,
            draftStepSkippable: true
        }; 

        this.bot = new AutomatedPlayer(gameState, simulationService, logger);
    }

    /**
     * Initializes the debug panel.
     */
    init() {
        if (this.gui) return;
        
        // --- INJECTION START ---
        // Inject debug missions into the runtime database
        Object.assign(DB.MISSIONS, DEBUG_MISSIONS);
        this.logger.warn('DebugService', 'Injected Ephemeral Debug Missions into DB.MISSIONS');
        // --- INJECTION END ---

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

    /**
     * Internal helper to unlock all endgame locations and features.
     * @private
     */
    _unlockEndgame() {
        const { player, solStation } = this.gameState;
        
        // Unlock Mercury and Sun if not present
        if (!player.unlockedLocationIds.includes(LOCATION_IDS.MERCURY)) {
            player.unlockedLocationIds.push(LOCATION_IDS.MERCURY);
        }
        if (!player.unlockedLocationIds.includes(LOCATION_IDS.SUN)) {
            player.unlockedLocationIds.push(LOCATION_IDS.SUN);
        }

        // Unlock Sol Station Interface
        if (solStation) {
            solStation.unlocked = true;
        }
    }

    godMode() {
        this.logger.warn('DebugService', 'GOD MODE ACTIVATED.');
        this.gameState.introSequenceActive = false;
        this.simulationService.tutorialService.activeBatchId = null;
        this.simulationService.tutorialService.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.skippedTutorialBatches = Object.keys(DB.TUTORIAL_DATA);

        this.gameState.player.credits = Number.MAX_SAFE_INTEGER;

        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.BEHEMOTH);
        this.gameState.player.activeShipId = SHIP_IDS.BEHEMOTH;

        this.gameState.player.revealedTier = 7;
        this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
        this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);

        // [REQ] Ensure Endgame Unlocks
        this._unlockEndgame();

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
        
        // HYDRATION: Pre-load EVERYTHING for testing purposes
        const seed = this.gameState.player.visualSeed;
        AssetService.hydrateAllShips(seed);
        AssetService.hydrateAllCommodities(seed);

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

    /**
     * Gives a specific item and quantity to the active ship.
     * [REQ] Added for precise debugging.
     */
    giveItemToShip() {
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        const itemId = this.debugState.selectedCommodityToAdd;
        const qty = this.debugState.quantityToAdd;

        if (ship && inventory && itemId) {
            if (!inventory[itemId]) {
                inventory[itemId] = { quantity: 0, avgCost: 0 };
            }
            inventory[itemId].quantity += qty;
            
            this.logger.warn('DebugService', `Added ${qty}x ${itemId} to ${ship.name}.`);
            this.uiManager.createFloatingText(`+${qty} ${itemId}`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
            this.gameState.setState({});
        }
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

    // --- GAME ATTRIBUTES DEBUG METHODS ---
    
    installSelectedUpgrade(upgradeId) {
        if (!upgradeId) return;
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;

        // Force install (bypass cost check in debugging)
        const shipState = this.gameState.player.shipStates[activeShip.id];
        if (!shipState.upgrades) shipState.upgrades = [];
        
        // Don't duplicate if already exists (unless we want to test stacking, but UI might look weird)
        // For now, let's allow stacking as per spec "Upgrades are not unique"
        if (shipState.upgrades.length < 3) {
            shipState.upgrades.push(upgradeId);
            this.logger.info.system('DebugService', `Installed ${upgradeId} on ${activeShip.name}`);
            this.gameState.setState({}); // Re-render
        } else {
            this.logger.warn('DebugService', 'Ship upgrade slots full (3/3). Remove one first.');
        }
    }

    applyRandomUpgrades() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        // 1. Clear existing
        shipState.upgrades = [];

        // 2. Pick 3 random
        const allIds = GameAttributes.getAllUpgradeIds();
        if (allIds.length === 0) return;

        for (let i = 0; i < 3; i++) {
            const randomId = allIds[Math.floor(Math.random() * allIds.length)];
            shipState.upgrades.push(randomId);
        }

        this.logger.info.system('DebugService', `Applied 3 random upgrades to ${activeShip.name}`);
        this.gameState.setState({});
    }

    removeAllUpgrades() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        shipState.upgrades = [];
        this.logger.info.system('DebugService', `Removed all upgrades from ${activeShip.name}`);
        this.gameState.setState({});
    }

    // --- NEW ECONOMIC MANIPULATION TOOLS ---

    resetEconomyMemory() {
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const item = market.inventory[loc.id][c.id];
                if (item) {
                    item.marketPressure = 0;
                    item.lastPlayerInteractionTimestamp = 0;
                    item.priceLockEndDay = 0;
                    item.isDepleted = false;
                    item.depletionDay = 0;
                    item.depletionBonusDay = 0;
                }
            });
        });
        this.uiManager.createFloatingText('Economic Memory Reset', window.innerWidth/2, window.innerHeight/2, '#facc15');
        this.gameState.setState({});
    }

    sootheEconomy() {
        // Force minimum prices (Bullish for player buying)
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const minPrice = c.basePriceRange[0];
                market.prices[loc.id][c.id] = minPrice;
            });
        });
        this.uiManager.createFloatingText('Economy Soothed (Min Prices)', window.innerWidth/2, window.innerHeight/2, '#4ade80');
        this.gameState.setState({});
    }

    riotEconomy() {
        // Force maximum prices (Bearish for player buying, good for selling)
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const maxPrice = c.basePriceRange[1];
                market.prices[loc.id][c.id] = maxPrice;
            });
        });
        this.uiManager.createFloatingText('Economy Rioting (Max Prices)', window.innerWidth/2, window.innerHeight/2, '#ef4444');
        this.gameState.setState({});
    }

    injectStock() {
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const item = market.inventory[loc.id][c.id];
                if (item) {
                    item.quantity += 100;
                }
            });
        });
        this.uiManager.createFloatingText('+100 Stock Injected System-Wide', window.innerWidth/2, window.innerHeight/2, '#facc15');
        this.gameState.setState({});
    }

    /**
     * Fills all Sol Station maintenance caches to max capacity.
     */
    fillSolCaches() {
        if (this.gameState.solStation && this.gameState.solStation.caches) {
            Object.values(this.gameState.solStation.caches).forEach(cache => {
                cache.current = cache.max;
            });
            this.uiManager.createFloatingText('Sol Caches Filled', window.innerWidth/2, window.innerHeight/2, '#facc15');
            this.gameState.setState({});
        }
    }

    // --- V4 TUTORIAL INSPECTOR & MAKER ACTIONS ---
    
    _toggleInspector(isActive) {
        this.debugState.inspectorActive = isActive;
        if (isActive) {
            document.addEventListener('click', this._boundInspectorClick, { capture: true });
            document.addEventListener('mouseover', this._boundInspectorHover, { capture: true });
            document.addEventListener('mouseout', this._boundInspectorOut, { capture: true });
            
            // Inject dynamic stylesheet for visual feedback if missing
            if (!document.getElementById('tut-maker-styles')) {
                const style = document.createElement('style');
                style.id = 'tut-maker-styles';
                style.textContent = '.tut-inspector-hover { outline: 3px dashed #ef4444 !important; outline-offset: 2px !important; cursor: crosshair !important; box-shadow: 0 0 10px #ef4444 !important; z-index: 99999; }';
                document.head.appendChild(style);
            }
            
            this.logger.warn('DebugService', 'Tutorial Maker ACTIVE. Clicks are intercepted to draft steps.');
        } else {
            document.removeEventListener('click', this._boundInspectorClick, { capture: true });
            document.removeEventListener('mouseover', this._boundInspectorHover, { capture: true });
            document.removeEventListener('mouseout', this._boundInspectorOut, { capture: true });
            
            // Clear any stuck hover classes
            document.querySelectorAll('.tut-inspector-hover').forEach(el => el.classList.remove('tut-inspector-hover'));
            this.logger.info.system('DebugService', 'Tutorial Maker INACTIVE.');
        }
    }

    _handleInspectorHover(e) {
        if (e.target.closest('.lil-gui') || e.target.closest('#debug-panel')) return;
        e.target.classList.add('tut-inspector-hover');
    }

    _handleInspectorOut(e) {
        e.target.classList.remove('tut-inspector-hover');
    }

    _handleInspectorClick(e) {
        if (!this.debugState.inspectorActive) return;
        
        // Fix: Exclude the debug menu from inspector clicks
        if (e.target.closest('.lil-gui') || e.target.closest('#debug-panel')) return;
        
        e.preventDefault();
        e.stopPropagation();

        let target = e.target;
        let selector = null;

        while (target && target !== document.body) {
            if (target.hasAttribute('data-tut-target')) {
                selector = `[data-tut-target='${target.getAttribute('data-tut-target')}']`;
                break;
            } else if (target.id && !target.id.includes('screen')) { 
                // Ignore structural background containers
                selector = `#${target.id}`;
                break;
            } else if (target.hasAttribute('data-action')) {
                selector = `[data-action='${target.getAttribute('data-action')}']`;
                break;
            }
            target = target.parentElement;
        }

        if (selector) {
            const stepCount = this.debugState.draftTutorialBatch.steps.length;
            const newStep = {
                stepId: `step_${stepCount + 1}`,
                text: this.debugState.draftStepText,
                completion: { type: this.debugState.draftStepCompletion },
                nextStepId: null, // Linked on export
                isSkippable: this.debugState.draftStepSkippable,
                targetSelector: selector, 
                useSpotlight: this.debugState.draftStepSpotlight,
                allowClickThrough: this.debugState.draftStepClickThrough,
                theme: this.debugState.draftStepTheme
            };

            this.debugState.draftTutorialBatch.steps.push(newStep);
            
            console.log(`[Tutorial Maker] Target Step added:\n${JSON.stringify(newStep, null, 2)}`);
            this.uiManager.createFloatingText(`Target Step ${stepCount + 1} Drafted`, e.clientX, e.clientY, '#4ade80');
            
            // Clean up hover class
            e.target.classList.remove('tut-inspector-hover');
            
        } else {
            console.log(`[Tutorial Maker] No valid targetable element found.`);
            this.uiManager.createFloatingText('Invalid Target. Use Add Safe Zone button instead.', e.clientX, e.clientY, '#f87171');
        }
    }
    
    _addSafeZoneStep() {
        const stepCount = this.debugState.draftTutorialBatch.steps.length;
        const newStep = {
            stepId: `step_${stepCount + 1}`,
            text: this.debugState.draftStepText,
            completion: { type: this.debugState.draftStepCompletion },
            nextStepId: null,
            isSkippable: this.debugState.draftStepSkippable,
            targetSelector: null,
            useSpotlight: this.debugState.draftStepSpotlight,
            allowClickThrough: this.debugState.draftStepClickThrough,
            theme: this.debugState.draftStepTheme
        };

        this.debugState.draftTutorialBatch.steps.push(newStep);
        console.log(`[Tutorial Maker] Safe Zone Step added:\n${JSON.stringify(newStep, null, 2)}`);
        this.uiManager.createFloatingText(`Safe Zone Step ${stepCount + 1} Drafted`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
    }

    _undoLastStep() {
        if (this.debugState.draftTutorialBatch.steps.length > 0) {
            this.debugState.draftTutorialBatch.steps.pop();
            this.uiManager.createFloatingText('Last Step Removed', window.innerWidth/2, window.innerHeight/2, '#facc15');
        }
    }

    _testDraftStep() {
        if (!this.uiManager || !this.uiManager.tutorialManager) return;
        const steps = this.debugState.draftTutorialBatch.steps;
        if (steps.length === 0) {
            this.uiManager.createFloatingText('No steps drafted to test!', window.innerWidth/2, window.innerHeight/2, '#f87171');
            return;
        }
        const stepToTest = steps[steps.length - 1]; 
        
        this.uiManager.tutorialManager.showTutorialToast({
            step: stepToTest,
            onSkip: () => this.uiManager.tutorialManager.hideTutorialToast(),
            onNext: () => this.uiManager.tutorialManager.hideTutorialToast(),
            gameState: this.gameState.getState()
        });
    }
    
    _testFullBatch() {
        const batch = this.debugState.draftTutorialBatch;
        if (batch.steps.length === 0) {
            this.uiManager.createFloatingText('No steps drafted to test!', window.innerWidth/2, window.innerHeight/2, '#f87171');
            return;
        }
        
        // Create a deep copy and properly link the steps sequentially
        const linkedSteps = JSON.parse(JSON.stringify(batch.steps));
        for (let i = 0; i < linkedSteps.length; i++) {
            if (i < linkedSteps.length - 1) {
                linkedSteps[i].nextStepId = linkedSteps[i+1].stepId;
            } else {
                linkedSteps[i].nextStepId = null;
            }
        }
        
        // Inject temporarily into the database
        DB.TUTORIAL_DATA['DRAFT_TEST'] = {
            title: batch.title,
            trigger: { type: 'INFO' }, // Override trigger so it doesn't auto-fire, just manual
            navLock: batch.navLock,
            steps: linkedSteps
        };
        
        // Clear any active tutorials first
        this._resetTutorialState();
        
        // Trigger it
        this.simulationService.tutorialService.triggerBatch('DRAFT_TEST');
        this.uiManager.createFloatingText('Testing Draft Batch', window.innerWidth/2, window.innerHeight/2, '#4ade80');
    }

    _buildExportObject() {
        const batch = this.debugState.draftTutorialBatch;
        
        // Link steps sequentially
        const steps = JSON.parse(JSON.stringify(batch.steps));
        for (let i = 0; i < steps.length; i++) {
            if (i < steps.length - 1) {
                steps[i].nextStepId = steps[i+1].stepId;
            } else {
                steps[i].nextStepId = null;
            }
        }

        return {
            title: batch.title,
            trigger: { 
                type: batch.triggerType, 
                ...(batch.triggerType === 'SCREEN_LOAD' && { screenId: batch.triggerTarget }),
                ...(batch.triggerType === 'ACTION' && { action: batch.triggerTarget }),
                ...(batch.triggerType === 'STATE_CHANGE' && { stateKey: batch.triggerTarget, value: batch.triggerValue })
            },
            navLock: batch.navLock,
            steps: steps
        };
    }

    _exportDraftBatch() {
        if (this.debugState.draftTutorialBatch.steps.length === 0) {
            this.logger.warn('DebugService', 'Cannot export empty batch.');
            return;
        }

        const exportObj = this._buildExportObject();
        const exportString = `"${this.debugState.draftTutorialBatch.id}": ${JSON.stringify(exportObj, null, 4)},`;
        
        if (navigator && navigator.clipboard) {
            navigator.clipboard.writeText(exportString).then(() => {
                this.uiManager.createFloatingText('Batch Exported to Clipboard', window.innerWidth/2, window.innerHeight/2, '#4ade80');
            }).catch(err => console.error('Clipboard error', err));
        }
        console.log(`[Tutorial Maker] Export:\n${exportString}`);
    }
    
    _printDraftToConsole() {
        if (this.debugState.draftTutorialBatch.steps.length === 0) {
            this.logger.warn('DebugService', 'Cannot print empty batch.');
            return;
        }
        
        const exportObj = this._buildExportObject();
        console.log('%c--- TUTORIAL DRAFT ---', 'color: #4ade80; font-weight: bold; font-size: 14px;');
        console.dir(exportObj, { depth: null });
        this.uiManager.createFloatingText('Draft Printed to Console', window.innerWidth/2, window.innerHeight/2, '#4ade80');
    }

    _forceNextTutorialStep() {
        if (this.simulationService && this.simulationService.tutorialService) {
            this.simulationService.tutorialService.advanceStep();
            this.uiManager.createFloatingText('Forced Next Step', window.innerWidth/2, window.innerHeight/2, '#4ade80');
        }
    }

    _resetTutorialState() {
        this.gameState.tutorials.seenBatchIds = [];
        this.gameState.tutorials.skippedTutorialBatches = [];
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null;
        this.gameState.tutorials.navLock = null;
        
        if (this.uiManager && this.uiManager.tutorialManager) {
            this.uiManager.tutorialManager.hideTutorialToast();
        }
        
        this.gameState.setState({});
        this.uiManager.createFloatingText('Tutorials Reset', window.innerWidth/2, window.innerHeight/2, '#facc15');
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
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + this.debugState.creditsToAdd);
                this.simulationService.timeService._checkMilestones();
                this.gameState.setState({});
            }},
            reduceCredits: { name: 'Reduce Credits', type: 'button', handler: () => {
                this.gameState.player.credits -= this.debugState.creditsToReduce;
                this.simulationService._checkGameOverConditions();
                this.gameState.setState({});
            }},
            // --- NEW: Set Age Action ---
            setAge: { name: 'Set Age', type: 'button', handler: () => {
                this.gameState.player.playerAge = this.debugState.targetAge;
                this.logger.warn('DebugService', `Player age manually set to ${this.debugState.targetAge}.`);
                
                // Trigger the birthday event logic for the new age to ensure the modal/bonuses fire
                if (this.simulationService.timeService) {
                    this.simulationService.timeService._handleBirthday(this.debugState.targetAge);
                }

                this.gameState.setState({});
            }},
            // ---------------------------
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
                
                // [REQ] Ensure Endgame Unlocks
                this._unlockEndgame();

                this.gameState.setState({});
                this.uiManager.createFloatingText('Unlocked: Maps, Licenses, Tiers, Sol Station', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            
            // NEW: SOL TESTING BUTTON
            solTesting: { name: 'Sol Testing', type: 'button', handler: () => {
                // 1. Unlock All (including station/endgame)
                this.actions.unlockAll.handler();
                // 2. God Mode
                this.actions.godMode.handler();
                // 3. Teleport to Sun
                this.gameState.currentLocationId = LOCATION_IDS.SUN;
                // 4. [OBSOLETE] startRealTimeSimulation() was removed. The new JIT engine 
                //    automatically calculates the correct state upon arrival.
                this.gameState.setState({});
                this.uiManager.createFloatingText('Sol Testing Initiated', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            
            // NEW: MISSION TESTING BUTTON
            missionTest: { name: 'Mission Test', type: 'button', handler: () => {
                if (this.simulationService && this.simulationService.missionService) {
                    this.simulationService.missionService.injectTestMissions();
                    this.uiManager.createFloatingText('Test Missions Injected', window.innerWidth/2, window.innerHeight/2, '#facc15');
                }
            }},
            
            // --- SOL STATION DEBUG TOOLS ---
            levelUpSolStation: { name: 'Level Up Sol Station', type: 'button', handler: () => {
                if (this.simulationService && this.simulationService.solStationService) {
                    this.simulationService.solStationService.applyLevelUp();
                    this.uiManager.createFloatingText('Sol Level Up', window.innerWidth/2, window.innerHeight/2, '#facc15');
                    this.gameState.setState({});
                }
            }},
            addAllOfficers: { name: 'Add All Officers', type: 'button', handler: () => {
                if (this.gameState.solStation && this.gameState.solStation.roster) {
                    Object.keys(OFFICERS).forEach(id => {
                        if (!this.gameState.solStation.roster.includes(id)) {
                            this.gameState.solStation.roster.push(id);
                        }
                    });
                    this.uiManager.createFloatingText('All Officers Added', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                    this.gameState.setState({});
                }
            }},
            unlockAllOfficerSlots: { name: 'Unlock All Slots', type: 'button', handler: () => {
                if (this.gameState.solStation && this.gameState.solStation.officers) {
                    while(this.gameState.solStation.officers.length < 10) {
                        this.gameState.solStation.officers.push({ slotId: this.gameState.solStation.officers.length + 1, assignedOfficerId: null });
                    }
                    this.uiManager.createFloatingText('All Slots Unlocked', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                    this.gameState.setState({});
                }
            }},
            add1000AllItems: { name: '+1000 All Items', type: 'button', handler: () => {
                const shipId = this.gameState.player.activeShipId;
                if (!shipId) return;
                
                let inv = this.gameState.player.inventories[shipId];
                if (!inv) {
                    this.gameState.player.inventories[shipId] = {};
                    inv = this.gameState.player.inventories[shipId];
                }
                
                DB.COMMODITIES.forEach(c => {
                    if (!inv[c.id]) {
                        inv[c.id] = { quantity: 0, avgCost: 0 };
                    }
                    inv[c.id].quantity += 1000;
                });
                
                this.uiManager.createFloatingText('+1000 Cargo Added', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
            }},
            fillSolCaches: { name: 'Fill Sol Caches', type: 'button', handler: () => this.fillSolCaches() },

            // --- [[END]] PHASE 3 ---
            grantAllShips: { name: 'Grant All Ships', type: 'button', handler: () => {
                Object.keys(DB.SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                         this.simulationService.addShipToHangar(shipId);
                    }
                });
                // HYDRATION: Ensure all added ships are loaded
                AssetService.hydrateAllShips(this.gameState.player.visualSeed);
                this.gameState.setState({});
            }},
            cycleShipPics: { name: 'Cycle Ship Pics', type: 'button', handler: () => {
                this.gameState.player.visualSeed = (this.gameState.player.visualSeed || 0) + 1;
                this.gameState.setState({}); // Force re-render
                this.logger.info.system('Debug', `Cycled ship visual variant. New Seed: ${this.gameState.player.visualSeed}`);
            }},
            
            // --- MODIFIED: Advance Time now forces refresh using the correct method ---
            advanceTime: { name: 'Advance Days', type: 'button', handler: () => {
                this.simulationService.timeService.advanceDays(this.debugState.daysToAdvance);
                // [REQ] Trigger FULL UI re-render (render instead of setState)
                // This ensures components with explicit update loops (like Sol Dashboard) refresh
                this.uiManager.render(this.gameState.getState());
            }},
            // ------------------------------------------------------------------------

            replenishStock: { name: 'Replenish All Stock', type: 'button', handler: () => {
                 this.simulationService.marketService.replenishMarketInventory();
                this.gameState.setState({});
            }},
            
            // --- UPDATED EVENT TRIGGER (UPDATED) ---
            triggerRandomEvent: { name: 'Trigger Random Event', type: 'button', handler: () => {
                // Now uses the Force Trigger method in Simulation Service
                if (this.debugState.selectedRandomEvent) {
                     this.simulationService.forceTriggerEvent(this.debugState.selectedRandomEvent);
                }
            }},
            // ---------------------------------------

            triggerAgeEvent: { name: 'Trigger Age Event', type: 'button', handler: () => {
                const event = DB.AGE_EVENTS.find(e => e.id === this.debugState.selectedAgeEvent);
                if (event) {
                    this.uiManager.showAgeEventModal(event, (choice) => this.simulationService._applyPerk(choice));
                }
            }},
            // --- NEW FORCE MISSION HANDLERS ---
            forceAcceptMission: { name: 'Force Accept Mission', type: 'button', handler: () => {
                if (this.debugState.selectedMission) {
                    this.simulationService.missionService.acceptMission(this.debugState.selectedMission, true); // Force = True
                }
            }},
            forceCompleteMission: { name: 'Force Complete Mission', type: 'button', handler: () => {
                 this.simulationService.missionService.completeActiveMission(true); // Force = True
            }},
            // ----------------------------------

            startBot: { name: 'Start AUTOTRADER-01', type: 'button', handler: () => {
                const progressController = this.gui.controllers.find(c => c.property === 'botProgress');
                
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
            
            // [REQ] Precise Item Giving
            giveItemToShip: { name: 'Give Item', type: 'button', handler: () => this.giveItemToShip() },

            // GAME ATTRIBUTES ACTIONS
            applyRandomUpgrades: { name: 'Apply 3 Random Upgrades', type: 'button', handler: () => this.applyRandomUpgrades() },
            removeAllUpgrades: { name: 'Remove All Upgrades', type: 'button', handler: () => this.removeAllUpgrades() },

            // [REQ] Economy Actions
            resetEconomyMemory: { name: 'Reset Econ Memory', type: 'button', handler: () => this.resetEconomyMemory() },
            sootheEconomy: { name: 'Bullish Economy (Soothe)', type: 'button', handler: () => this.sootheEconomy() },
            riotEconomy: { name: 'Bearish Economy (Riot)', type: 'button', handler: () => this.riotEconomy() },
            injectStock: { name: '+100 Item Avail', type: 'button', handler: () => this.injectStock() },

            // --- V4 TUTORIAL MAKER ACTIONS ---
            addSafeZoneStep: { name: 'Add Safe Zone Step', type: 'button', handler: () => this._addSafeZoneStep() },
            testDraftStep: { name: 'Test Last Step', type: 'button', handler: () => this._testDraftStep() },
            testFullBatch: { name: 'Test Full Batch', type: 'button', handler: () => this._testFullBatch() },
            undoLastStep: { name: 'Undo Last Step', type: 'button', handler: () => this._undoLastStep() },
            clearDraft: { name: 'Clear Draft', type: 'button', handler: () => {
                this.debugState.draftTutorialBatch.steps = [];
                this.uiManager.createFloatingText('Draft Cleared', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            printDraft: { name: 'Print Draft to Console', type: 'button', handler: () => this._printDraftToConsole() },
            exportDraftBatch: { name: 'Export Batch to Clipboard', type: 'button', handler: () => this._exportDraftBatch() },
            forceNextStep: { name: 'Force Next Step', type: 'button', handler: () => this._forceNextTutorialStep() },
            resetTutorials: { name: 'Reset Tutorials', type: 'button', handler: () => this._resetTutorialState() }
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
        // --- CREATE MASTER FOLDERS ---
        const simStateFolder = this.gui.addFolder('Simulation State');
        const toolsFolder = this.gui.addFolder('Tools & Triggers');
        const metaFolder = this.gui.addFolder('Meta & Dev');

        // --- TOOLS & TRIGGERS FOLDER ---
        const flowFolder = toolsFolder.addFolder('Game Flow');
        flowFolder.add(this.actions.godMode, 'handler').name(this.actions.godMode.name);
        flowFolder.add(this.actions.simpleStart, 'handler').name(this.actions.simpleStart.name);
        flowFolder.add(this.actions.skipToHangarTutorial, 'handler').name(this.actions.skipToHangarTutorial.name);
        flowFolder.add(this.actions.unlockAll, 'handler').name('Unlock ALL');
        flowFolder.add(this.actions.solTesting, 'handler').name('Sol Testing');
        flowFolder.add(this.actions.missionTest, 'handler').name('Mission Test');

        // --- SIMULATION STATE FOLDER ---
        const solFolder = simStateFolder.addFolder('Sol Station');
        solFolder.add(this.actions.levelUpSolStation, 'handler').name(this.actions.levelUpSolStation.name);
        solFolder.add(this.actions.addAllOfficers, 'handler').name(this.actions.addAllOfficers.name);
        solFolder.add(this.actions.unlockAllOfficerSlots, 'handler').name(this.actions.unlockAllOfficerSlots.name);
        solFolder.add(this.actions.add1000AllItems, 'handler').name(this.actions.add1000AllItems.name);
        solFolder.add(this.actions.fillSolCaches, 'handler').name(this.actions.fillSolCaches.name);

        const playerFolder = simStateFolder.addFolder('Player');
        playerFolder.add(this.debugState, 'creditsToAdd').name('Credits Amount');
        playerFolder.add(this.actions.addCredits, 'handler').name('Add Credits');
        playerFolder.add(this.debugState, 'creditsToReduce', 100, 1000000, 100).name('Credits to Reduce');
        playerFolder.add(this.actions.reduceCredits, 'handler').name('Reduce Credits');
        playerFolder.add(this.actions.payDebt, 'handler').name(this.actions.payDebt.name);
        playerFolder.add(this.debugState, 'targetAge', 18, 1000, 1).name('Target Age');
        playerFolder.add(this.actions.setAge, 'handler').name('Set Age');

        const shipFolder = simStateFolder.addFolder('Ship');
        shipFolder.add(this.actions.cycleShipPics, 'handler').name(this.actions.cycleShipPics.name);
        
        const commodityOptions = DB.COMMODITIES.reduce((acc, c) => ({...acc, [c.name]: c.id}), {});
        shipFolder.add(this.debugState, 'selectedCommodityToAdd', commodityOptions).name('Item Type');
        shipFolder.add(this.debugState, 'quantityToAdd', 1, 1000, 1).name('Quantity');
        shipFolder.add(this.actions.giveItemToShip, 'handler').name(this.actions.giveItemToShip.name);

        const locationOptions = DB.MARKETS.reduce((acc, loc) => ({...acc, [loc.name]: loc.id }), {});
        shipFolder.add(this.debugState, 'selectedLocation', locationOptions).name('Location');
        shipFolder.add(this.actions.teleport, 'handler').name('Teleport');
        shipFolder.add(this.actions.deductHull20, 'handler').name(this.actions.deductHull20.name);
        shipFolder.add(this.actions.restoreHull, 'handler').name(this.actions.restoreHull.name);
        shipFolder.add(this.actions.destroyShip, 'handler').name(this.actions.destroyShip.name);
        shipFolder.add(this.actions.deductFuel20, 'handler').name(this.actions.deductFuel20.name);
        shipFolder.add(this.actions.restoreFuel, 'handler').name(this.actions.restoreFuel.name);
        shipFolder.add(this.actions.removeAllCargo, 'handler').name(this.actions.removeAllCargo.name);
        shipFolder.add(this.actions.fillShipyard, 'handler').name(this.actions.fillShipyard.name);
        shipFolder.add(this.actions.grantAllShips, 'handler').name('Grant All Ships');

        // --- TOOLS & TRIGGERS FOLDER (Continued) ---
        const attributesFolder = toolsFolder.addFolder('Game Attributes');
        const upgradeIds = GameAttributes.getAllUpgradeIds();
        const upgradeOptions = upgradeIds.reduce((acc, id) => {
            const def = GameAttributes.getDefinition(id);
            acc[def ? def.name : id] = id;
            return acc;
        }, {});

        attributesFolder.add(this.debugState, 'selectedUpgrade', upgradeOptions)
            .name('Install Upgrade')
            .onChange((id) => this.installSelectedUpgrade(id));
            
        attributesFolder.add(this.actions.applyRandomUpgrades, 'handler').name('Apply 3 Random');
        attributesFolder.add(this.actions.removeAllUpgrades, 'handler').name('Remove All');

        const worldFolder = toolsFolder.addFolder('World & Time');
        worldFolder.add(this.debugState, 'daysToAdvance', 1, 365, 1).name('Days to Advance');
        worldFolder.add(this.actions.advanceTime, 'handler').name('Advance Time');

        // --- SIMULATION STATE FOLDER (Continued) ---
        this.economyFolder = simStateFolder.addFolder('Economy'); 
        this.economyFolder.add(this.actions.replenishStock, 'handler').name(this.actions.replenishStock.name);
        this.economyFolder.add(this.actions.resetEconomyMemory, 'handler').name(this.actions.resetEconomyMemory.name);
        this.economyFolder.add(this.actions.sootheEconomy, 'handler').name(this.actions.sootheEconomy.name);
        this.economyFolder.add(this.actions.riotEconomy, 'handler').name(this.actions.riotEconomy.name);
        this.economyFolder.add(this.actions.injectStock, 'handler').name(this.actions.injectStock.name);

        // --- TOOLS & TRIGGERS FOLDER (Continued) ---
        const triggerFolder = toolsFolder.addFolder('Triggers');
        
        const randomEventOptions = DB.RANDOM_EVENTS.reduce((acc, event) => ({...acc, [event.template.title]: event.id }), {});
        triggerFolder.add(this.debugState, 'selectedRandomEvent', randomEventOptions).name('Random Event');
        triggerFolder.add(this.actions.triggerRandomEvent, 'handler').name('Force Trigger Event');

        triggerFolder.add(this.debugState, 'alwaysTriggerEvents')
            .name('Always Trigger (100%)')
            .onChange(val => {
                if (this.simulationService && this.simulationService.travelService) {
                    this.simulationService.travelService.debugAlwaysTriggerEvents = val;
                }
            });
        
        if (DB.AGE_EVENTS.length > 0) {
            const ageEventOptions = DB.AGE_EVENTS.reduce((acc, event) => ({...acc, [event.title]: event.id }), {});
            triggerFolder.add(this.debugState, 'selectedAgeEvent', ageEventOptions).name('Age Event');
            triggerFolder.add(this.actions.triggerAgeEvent, 'handler').name('Trigger Event');
        }
        
        const missionOptions = Object.values(DB.MISSIONS)
            .sort((a, b) => {
                const aIsDebug = a.id.startsWith('debug_');
                const bIsDebug = b.id.startsWith('debug_');
                if (aIsDebug && !bIsDebug) return -1;
                if (!aIsDebug && bIsDebug) return 1;
                return a.name.localeCompare(b.name);
            })
            .reduce((acc, m) => ({...acc, [m.name]: m.id}), {});

        triggerFolder.add(this.debugState, 'selectedMission', missionOptions).name('Mission');
        triggerFolder.add(this.actions.forceAcceptMission, 'handler').name('Force Accept');
        triggerFolder.add(this.actions.forceCompleteMission, 'handler').name('Force Complete');

        // --- META & DEV FOLDER ---
        const tutorialFolder = metaFolder.addFolder('Tutorial Maker');
        tutorialFolder.domElement.classList.add('tutorial-maker-folder');
        
        const combinedTargets = {};
        Object.keys(SCREEN_IDS).forEach(k => combinedTargets[`Screen: ${SCREEN_IDS[k]}`] = SCREEN_IDS[k]);
        Object.keys(ACTION_IDS).forEach(k => combinedTargets[`Action: ${ACTION_IDS[k]}`] = ACTION_IDS[k]);
        combinedTargets['State: credits (credits)'] = 'credits';
        combinedTargets['State: playerAge (playerAge)'] = 'playerAge';
        
        tutorialFolder.add(this.debugState.draftTutorialBatch, 'id').name('Batch ID');
        tutorialFolder.add(this.debugState.draftTutorialBatch, 'title').name('Batch Title');
        tutorialFolder.add(this.debugState.draftTutorialBatch, 'triggerType', ['SCREEN_LOAD', 'ACTION', 'STATE_CHANGE']).name('Trigger Type');
        tutorialFolder.add(this.debugState.draftTutorialBatch, 'triggerTarget', combinedTargets).name('Trigger Target');
        tutorialFolder.add(this.debugState.draftTutorialBatch, 'triggerValue').name('Trigger Value (State)');
        tutorialFolder.add(this.debugState.draftTutorialBatch, 'navLock').name('Batch NavLock');

        tutorialFolder.add(this.debugState, 'draftStepText').name('Next Step Text');
        tutorialFolder.add(this.debugState, 'draftStepCompletion', ['INFO', 'UI_EVENT', 'ACTION']).name('Completion Type');
        tutorialFolder.add(this.debugState, 'draftStepTheme', ['default', 'guild', 'syndicate']).name('Theme');
        tutorialFolder.add(this.debugState, 'draftStepSpotlight').name('Use Spotlight');
        tutorialFolder.add(this.debugState, 'draftStepClickThrough').name('Allow Click Through');
        tutorialFolder.add(this.debugState, 'draftStepSkippable').name('Is Skippable');

        tutorialFolder.add(this.actions.addSafeZoneStep, 'handler').name(this.actions.addSafeZoneStep.name);
        tutorialFolder.add(this.debugState, 'inspectorActive')
            .name('Toggle Target Inspector')
            .onChange((val) => this._toggleInspector(val));
            
        tutorialFolder.add(this.debugState.draftTutorialBatch.steps, 'length').name('Drafted Steps').listen();

        tutorialFolder.add(this.actions.testDraftStep, 'handler').name(this.actions.testDraftStep.name);
        tutorialFolder.add(this.actions.testFullBatch, 'handler').name(this.actions.testFullBatch.name);
        tutorialFolder.add(this.actions.undoLastStep, 'handler').name(this.actions.undoLastStep.name);
        tutorialFolder.add(this.actions.clearDraft, 'handler').name(this.actions.clearDraft.name);
        tutorialFolder.add(this.actions.printDraft, 'handler').name(this.actions.printDraft.name);
        tutorialFolder.add(this.actions.exportDraftBatch, 'handler').name(this.actions.exportDraftBatch.name);

        tutorialFolder.add(this.actions.forceNextStep, 'handler').name(this.actions.forceNextStep.name);
        tutorialFolder.add(this.actions.resetTutorials, 'handler').name(this.actions.resetTutorials.name);

        const automationFolder = metaFolder.addFolder('Automation & Logging');
        automationFolder.add(this, 'toggleDiagnosticOverlay').name('Toggle HUD Diagnostics');
        automationFolder.add(this.debugState, 'logLevel', ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE']).name('Log Level').onChange(v => this.logger.setLevel(v));
        automationFolder.add(this, 'generateBugReport').name('Generate Bug Report');
        
        automationFolder.add(this.debugState, 'botStrategy', ['MIXED', 'HONEST_TRADER', 'MANIPULATOR', 'DEPLETE_ONLY', 'PROSPECTOR']).name('Bot Strategy');
        
        automationFolder.add(this.debugState, 'botDaysToRun', 1, 10000, 1).name('Simulation Days');
        automationFolder.add(this.actions.startBot, 'handler').name(this.actions.startBot.name);
        automationFolder.add(this.actions.stopBot, 'handler').name(this.actions.stopBot.name);
        automationFolder.add(this.debugState, 'botProgress').name('Progress').listen();

        // Close all master folders and sub-folders by default
        this.gui.folders.forEach(masterFolder => {
            masterFolder.close();
            if (masterFolder.folders) {
                masterFolder.folders.forEach(subFolder => subFolder.close());
            }
        });
    }
}