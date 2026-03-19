// js/services/DebugService.js
import { DB } from '../data/database.js';
import { LOCATION_IDS, SHIP_IDS, NAV_IDS, SCREEN_IDS, COMMODITY_IDS, GAME_RULES } from '../data/constants.js';
import { Logger } from './LoggingService.js';
import { calculateInventoryUsed, skewedRandom } from '../utils.js'; 
import { AutomatedPlayer } from './bot/AutomatedPlayerService.js';
import { GameAttributes } from './GameAttributes.js'; 
import { AssetService } from './AssetService.js'; 
import { OFFICERS } from '../data/officers.js';
import { HELP_REGISTRY } from '../data/helpRegistry.js';

// --- EPHEMERAL DEBUG MISSIONS ---
const DEBUG_MISSIONS = {
    'debug_kitchen_sink': {
        id: 'debug_kitchen_sink',
        name: '[DEBUG] Kitchen Sink Rewards',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Instantly completes to test multiple reward types (Credits, Items, Licenses).',
        triggers: [],
        objectives: [], 
        completion: {
            locationId: null, 
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
        
        this.debugState = {
            creditsToAdd: 100000,
            creditsToReduce: 100000,
            targetAge: 25, 
            selectedLocation: this.gameState.currentLocationId,
            daysToAdvance: 7,
            selectedRandomEvent: DB.RANDOM_EVENTS[0]?.id || '', 
            selectedAgeEvent: DB.AGE_EVENTS[0]?.id || null, 
            selectedMission: 'debug_kitchen_sink',
            selectedSystemState: 'NEUTRAL', 
            botDaysToRun: 365,
            botStrategy: 'MIXED', 
            botProgress: 'Idle',
            logLevel: 'INFO',
            
            selectedUpgrade: null, 
            selectedCommodityToAdd: COMMODITY_IDS.WATER_ICE,
            quantityToAdd: 10,
            alwaysTriggerEvents: false,
            xrayEnabled: false, // Phase 5 Toggle State

            // --- UI GUIDES STATE (Arrays/Booleans) ---
            navLockMain: Object.values(NAV_IDS).reduce((acc, id) => ({ ...acc, [id]: false }), {}),
            navLockSub: Object.values(SCREEN_IDS).reduce((acc, id) => ({ ...acc, [id]: false }), {})
        }; 

        this.bot = new AutomatedPlayer(gameState, simulationService, logger);
    }

    init() {
        if (this.gui) return;
        
        Object.assign(DB.MISSIONS, DEBUG_MISSIONS);
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'Injected Ephemeral Debug Missions into DB.MISSIONS');

        this._cacheDiagElements();
        this.gui = new lil.GUI({ draggable: true, title: 'Debug Menu' });
        this.gui.domElement.id = 'debug-panel';
        this._registerDebugActions();
        this.buildGui();
        this._startDiagLoop();
    }

    handleKeyPress(key) {}

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
                if(this.logger && this.logger.error) this.logger.error('DebugService', 'Failed to copy bug report.', err);
            });
    }

    _markAllTutorialsSeen() {
        if (!this.gameState.tutorials) {
            this.gameState.tutorials = { seenHelpContexts: [] };
        }
        if (HELP_REGISTRY) {
            this.gameState.tutorials.seenHelpContexts = Object.keys(HELP_REGISTRY);
        } else {
            this.gameState.tutorials.seenHelpContexts = [];
        }
        
        if (this.logger && this.logger.info && this.logger.info.system) {
            this.logger.info.system('DebugService', 'All help modal contexts injected into seen state.');
        }
    }

    _unlockEndgame() {
        const { player, solStation } = this.gameState;
        
        if (!player.unlockedLocationIds.includes(LOCATION_IDS.MERCURY)) {
            player.unlockedLocationIds.push(LOCATION_IDS.MERCURY);
        }
        if (!player.unlockedLocationIds.includes(LOCATION_IDS.SUN)) {
            player.unlockedLocationIds.push(LOCATION_IDS.SUN);
        }

        if (solStation) {
            solStation.unlocked = true;
        }
    }

    godMode() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'GOD MODE ACTIVATED.');
        this.gameState.introSequenceActive = false;
        
        this._markAllTutorialsSeen();

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = Number.MAX_SAFE_INTEGER;

        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.BEHEMOTH);
        this.gameState.player.activeShipId = SHIP_IDS.BEHEMOTH;

        this.gameState.player.revealedTier = 7;
        this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
        this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);

        this._unlockEndgame();

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }

    simpleStart() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'SIMPLE START ACTIVATED.');
        this.gameState.introSequenceActive = false;
        
        this._markAllTutorialsSeen();

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.WANDERER);
        this.gameState.player.activeShipId = SHIP_IDS.WANDERER;
        
        const seed = this.gameState.player.visualSeed;
        AssetService.hydrateAllShips(seed);
        AssetService.hydrateAllCommodities(seed);

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }

    skipToStarterSelection() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'SKIP TO STARTER SHIP SELECTION.');
        
        this.gameState.introSequenceActive = true;
        
        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = 25000;
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};

        this.uiManager.showGameContainer();
        
        if (this.simulationService && this.simulationService.introService) {
            this.simulationService.introService._showStarterShipSelection();
        } else {
            import('./game/IntroService.js').then(({IntroService}) => {
                const intro = new IntroService(this.gameState, this.uiManager, this.logger, this.simulationService);
                intro._showStarterShipSelection();
            }).catch(e => {
                console.error("Failed to load IntroService for debug skip", e);
            });
        }
        
        this.gameState.setState({});
    }

    skipToHangarTutorial() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'SKIP TO HANGAR (DEPRECATED - Normal Start).');
        this.gameState.introSequenceActive = true;

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = 25000;
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
        this.gameState.setState({});
    }

    deductHull(amount) {
         const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = Math.max(0, shipState.health - amount);
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Deducted ${amount} hull from ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    restoreHull() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = ship.maxHealth;
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Restored hull for ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    destroyShip() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = 0;
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Destroyed ${ship.name}.`);
            this.simulationService.travelService._handleShipDestruction(ship.id);
        }
    }

    deductFuel(amount) {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.fuel = Math.max(0, shipState.fuel - amount);
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Deducted ${amount} fuel from ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    restoreFuel() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
             const shipState = this.gameState.player.shipStates[ship.id];
            shipState.fuel = ship.maxFuel;
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Restored fuel for ${ship.name}.`);
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
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'All cargo removed from active ship.');
            this.gameState.setState({});
        }
    }

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
            
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Added ${qty}x ${itemId} to ${ship.name}.`);
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
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `SHIPYARD FILLED: All ships added to ${currentLocationId}.`);
            this.gameState.setState({});
        } else {
            if(this.logger && this.logger.error) this.logger.error('DebugService', `Cannot fill shipyard: No stock object for ${currentLocationId}.`);
        }
    }
    
    installSelectedUpgrade(upgradeId) {
        if (!upgradeId) return;
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;

        const shipState = this.gameState.player.shipStates[activeShip.id];
        if (!shipState.upgrades) shipState.upgrades = [];
        
        if (shipState.upgrades.length < 3) {
            shipState.upgrades.push(upgradeId);
            if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system('DebugService', `Installed ${upgradeId} on ${activeShip.name}`);
            this.gameState.setState({}); 
        } else {
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'Ship upgrade slots full (3/3). Remove one first.');
        }
    }

    applyRandomUpgrades() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        shipState.upgrades = [];

        const allIds = GameAttributes.getAllUpgradeIds();
        if (allIds.length === 0) return;

        for (let i = 0; i < 3; i++) {
            const randomId = allIds[Math.floor(Math.random() * allIds.length)];
            shipState.upgrades.push(randomId);
        }

        if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system('DebugService', `Applied 3 random upgrades to ${activeShip.name}`);
        this.gameState.setState({});
    }

    removeAllUpgrades() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        shipState.upgrades = [];
        if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system('DebugService', `Removed all upgrades from ${activeShip.name}`);
        this.gameState.setState({});
    }

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

    fillSolCaches() {
        if (this.gameState.solStation && this.gameState.solStation.caches) {
            Object.values(this.gameState.solStation.caches).forEach(cache => {
                cache.current = cache.max;
            });
            this.uiManager.createFloatingText('Sol Caches Filled', window.innerWidth/2, window.innerHeight/2, '#facc15');
            this.gameState.setState({});
        }
    }

    triggerToast(type) {
        if (!this.simulationService.toastService) return;
        
        this.simulationService.toastService.clearQueueAndHide();
        
        let config;
        switch(type) {
            case 'system':
                config = { type: 'system', title: 'SYSTEM ALERT', message: '[DEBUG] Critical Systems Failure.', navTarget: 'starport', actionTarget: 'services' };
                break;
            case 'finance':
                config = { type: 'finance', title: 'FINANCE ALERT', message: '[DEBUG] Impending loan garnishment.', navTarget: 'data', actionTarget: 'finance' };
                break;
            case 'intel':
                config = { type: 'intel', title: 'INTEL EXPIRED', message: '[DEBUG] Market data has expired.', navTarget: 'data', actionTarget: 'intel' };
                break;
            case 'mission':
                config = { type: 'mission', title: 'MISSIONS AVAILABLE', message: '[DEBUG] New contracts available.', navTarget: 'data', actionTarget: 'missions' };
                break;
            case 'sol':
                config = { type: 'sol', title: 'STATION CRITICAL', message: 'Station supplies are low!', navTarget: 'starport', actionTarget: 'services' };
                break;
        }
        
        if (config) {
            this.simulationService.toastService.toastQueue.push(config);
            this.simulationService.toastService.playNextInQueue();
        }
    }

    _clearAssetsForBankruptcy() {
        const player = this.gameState.player;
        player.ownedShipIds = [SHIP_IDS.WANDERER];
        player.activeShipId = SHIP_IDS.WANDERER;
        player.inventories = { [SHIP_IDS.WANDERER]: {} };
        if (this.gameState.missions) {
            this.gameState.missions.activeMissionIds = [];
        }
    }

    _exportToCsv(filename, dataArray) {
        if (!dataArray || dataArray.length === 0) {
            this.logger.warn('DebugService', `No data to export for ${filename}`);
            this.uiManager.createFloatingText('No Data to Export', window.innerWidth/2, window.innerHeight/2, '#ef4444');
            return;
        }

        const keys = Object.keys(dataArray[0]);
        let csvContent = keys.join(',') + '\n';

        dataArray.forEach(row => {
            const values = keys.map(k => {
                let val = row[k];
                if (val === null || val === undefined) val = '';
                return `"${val}"`;
            });
            csvContent += values.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.uiManager.createFloatingText(`${filename} Exported`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
    }

    exportDailyState() {
        if (window.__ECON_TELEMETRY__) this._exportToCsv('Econ_Daily_State.csv', window.__ECON_TELEMETRY__.dailyState);
    }

    exportTradeShocks() {
        if (window.__ECON_TELEMETRY__) this._exportToCsv('Econ_Trade_Shocks.csv', window.__ECON_TELEMETRY__.tradeShocks);
    }

    exportBotProgression() {
        if (window.__ECON_TELEMETRY__) this._exportToCsv('Bot_Progression.csv', window.__ECON_TELEMETRY__.botProgression);
    }
    
    clearTelemetry() {
        if (window.__ECON_TELEMETRY__) {
            window.__ECON_TELEMETRY__.dailyState = [];
            window.__ECON_TELEMETRY__.tradeShocks = [];
            window.__ECON_TELEMETRY__.botProgression = [];
            this.uiManager.createFloatingText('Telemetry Cleared', window.innerWidth/2, window.innerHeight/2, '#facc15');
        }
    }

    _registerDebugActions() {
        this.actions = {
            godMode: { name: 'God Mode', type: 'button', handler: () => this.godMode() },
            simpleStart: { name: 'Simple Start', type: 'button', handler: () => this.simpleStart() },
            skipToStarterSelection: { name: 'Skip to Ship Select (Intro)', type: 'button', handler: () => this.skipToStarterSelection() },
             skipToHangarTutorial: { name: 'Normal Start Skip', type: 'button', handler: () => this.skipToHangarTutorial() },
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
            setAge: { name: 'Set Age', type: 'button', handler: () => {
                this.gameState.player.playerAge = this.debugState.targetAge;
                if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Player age manually set to ${this.debugState.targetAge}.`);
                
                if (this.simulationService.timeService) {
                    this.simulationService.timeService._handleBirthday(this.debugState.targetAge);
                }

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
                
                this._unlockEndgame();

                this.gameState.setState({});
                this.uiManager.createFloatingText('Unlocked: Maps, Licenses, Tiers, Sol Station', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            
            solTesting: { name: 'Sol Testing', type: 'button', handler: () => {
                this.actions.unlockAll.handler();
                this.actions.godMode.handler();
                this.gameState.currentLocationId = LOCATION_IDS.SUN;
                this.gameState.setState({});
                this.uiManager.createFloatingText('Sol Testing Initiated', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            
            missionTest: { name: 'Mission Test', type: 'button', handler: () => {
                if (this.simulationService && this.simulationService.missionService) {
                    this.simulationService.missionService.injectTestMissions();
                    this.uiManager.createFloatingText('Test Missions Injected', window.innerWidth/2, window.innerHeight/2, '#facc15');
                }
            }},
            
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
            
            testRecruitOfficer: { name: 'Test Recruit Officer', type: 'button', handler: () => {
                const officerIds = Object.keys(OFFICERS);
                if (officerIds.length > 0) {
                    const randomId = officerIds[Math.floor(Math.random() * officerIds.length)];
                    if (this.uiManager && typeof this.uiManager.queueOfficerRecruitmentModal === 'function') {
                        this.uiManager.queueOfficerRecruitmentModal(randomId);
                    }
                }
            }},

            grantAllShips: { name: 'Grant All Ships', type: 'button', handler: () => {
                Object.keys(DB.SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                         this.simulationService.addShipToHangar(shipId);
                    }
                });
                AssetService.hydrateAllShips(this.gameState.player.visualSeed);
                this.gameState.setState({});
            }},
            cycleShipPics: { name: 'Cycle Ship Pics', type: 'button', handler: () => {
                this.gameState.player.visualSeed = (this.gameState.player.visualSeed || 0) + 1;
                this.gameState.setState({}); 
                if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system('Debug', `Cycled ship visual variant. New Seed: ${this.gameState.player.visualSeed}`);
            }},
            
            advanceTime: { name: 'Advance Days', type: 'button', handler: () => {
                this.simulationService.timeService.advanceDays(this.debugState.daysToAdvance);
                this.uiManager.render(this.gameState.getState());
            }},

            replenishStock: { name: 'Replenish All Stock', type: 'button', handler: () => {
                 this.simulationService.marketService.replenishMarketInventory();
                this.gameState.setState({});
            }},
            
            triggerRandomEvent: { name: 'Trigger Random Event', type: 'button', handler: () => {
                if (this.debugState.selectedRandomEvent) {
                     this.simulationService.forceTriggerEvent(this.debugState.selectedRandomEvent);
                }
            }},

            triggerAgeEvent: { name: 'Trigger Age Event', type: 'button', handler: () => {
                const event = DB.AGE_EVENTS.find(e => e.id === this.debugState.selectedAgeEvent);
                if (event) {
                    this.uiManager.showAgeEventModal(event, (choice) => this.simulationService._applyPerk(choice));
                }
            }},
            forceAddTerminalMission: { name: 'Force to Terminal', type: 'button', handler: () => {
                if (this.debugState.selectedMission && this.simulationService && this.simulationService.missionService) {
                    this.simulationService.missionService.forceToTerminal(this.debugState.selectedMission);
                    this.uiManager.createFloatingText('Mission Added to Terminal', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                }
            }},
            forceAcceptMission: { name: 'Force Accept Mission', type: 'button', handler: () => {
                if (this.debugState.selectedMission) {
                    this.simulationService.missionService.acceptMission(this.debugState.selectedMission, true); 
                }
            }},
            forceCompleteMission: { name: 'Force Complete Mission', type: 'button', handler: () => {
                 this.simulationService.missionService.completeActiveMission(true); 
            }},

            triggerSystemToast: { name: 'Toast: System', type: 'button', handler: () => this.triggerToast('system') },
            triggerFinanceToast: { name: 'Toast: Finance', type: 'button', handler: () => this.triggerToast('finance') },
            triggerIntelToast: { name: 'Toast: Intel', type: 'button', handler: () => this.triggerToast('intel') },
            triggerMissionToast: { name: 'Toast: Mission', type: 'button', handler: () => this.triggerToast('mission') },
            triggerSolToast: { name: 'Toast: Sol', type: 'button', handler: () => this.triggerToast('sol') },

            triggerSystemState: { name: 'Force System State', type: 'button', handler: () => {
                const sysService = this.simulationService?.timeService?.systemStateService;
                if (sysService) {
                    if (this.debugState.selectedSystemState === 'NEUTRAL') {
                        sysService.endCurrentState();
                    } else {
                        sysService.triggerState(this.debugState.selectedSystemState);
                    }
                    this.uiManager.showEconWeatherModal(this.gameState.getState());
                    this.gameState.setState({});
                }
            }},
            showEconWeatherUI: { name: 'Show Weather UI', type: 'button', handler: () => {
                this.uiManager.showEconWeatherModal(this.gameState.getState());
            }},

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

            fillShipyard: { name: 'Fill Shipyard w/ All Ships', type: 'button', handler: () => this.fillShipyard() },
            deductHull20: { name: 'Deduct 20 Hull', type: 'button', handler: () => this.deductHull(20) },
            restoreHull: { name: 'Restore Hull', type: 'button', handler: () => this.restoreHull() },
            destroyShip: { name: 'Destroy Current Ship', type: 'button', handler: () => this.destroyShip() },
             deductFuel20: { name: 'Deduct 20 Fuel', type: 'button', handler: () => this.deductFuel(20) },
            restoreFuel: { name: 'Restore Fuel', type: 'button', handler: () => this.restoreFuel() },
            removeAllCargo: { name: 'Remove All Cargo', type: 'button', handler: () => this.removeAllCargo() },
            
            giveItemToShip: { name: 'Give Item', type: 'button', handler: () => this.giveItemToShip() },

            applyRandomUpgrades: { name: 'Apply 3 Random Upgrades', type: 'button', handler: () => this.applyRandomUpgrades() },
            removeAllUpgrades: { name: 'Remove All Upgrades', type: 'button', handler: () => this.removeAllUpgrades() },

            resetEconomyMemory: { name: 'Reset Econ Memory', type: 'button', handler: () => this.resetEconomyMemory() },
            sootheEconomy: { name: 'Bullish Economy (Soothe)', type: 'button', handler: () => this.sootheEconomy() },
            riotEconomy: { name: 'Bearish Economy (Riot)', type: 'button', handler: () => this.riotEconomy() },
            injectStock: { name: '+100 Item Avail', type: 'button', handler: () => this.injectStock() },

            // --- UI GUIDES LOGIC ---
            applyNavLock: { name: 'Apply Nav Lock', type: 'button', handler: () => {
                const selectedNavs = Object.keys(this.debugState.navLockMain).filter(k => this.debugState.navLockMain[k]);
                const selectedScreens = Object.keys(this.debugState.navLockSub).filter(k => this.debugState.navLockSub[k]);
                
                if (selectedNavs.length === 0 && selectedScreens.length === 0) {
                    this.simulationService.setNavigationLock([], []);
                } else {
                    this.simulationService.setNavigationLock(selectedNavs, selectedScreens);
                }
            }},
            clearNavLock: { name: 'Clear Nav Lock', type: 'button', handler: () => {
                Object.keys(this.debugState.navLockMain).forEach(k => this.debugState.navLockMain[k] = false);
                Object.keys(this.debugState.navLockSub).forEach(k => this.debugState.navLockSub[k] = false);
                if (this.gui) {
                    this.gui.controllersRecursive().forEach(c => {
                        if (c.parent && (c.parent._title === 'Allowed Main Navs' || c.parent._title === 'Allowed Sub Navs')) {
                            c.updateDisplay();
                        }
                    });
                }
                this.simulationService.clearNavigationLock();
            }},
            
            // --- BANKRUPTCY EVENTS ---
            forceGuildBankruptcy: { name: 'Force Guild Servitude', type: 'button', handler: () => {
                this.gameState.player.credits = 0;
                this.gameState.player.debt = 50000;
                this.gameState.player.loanType = 'guild';
                this._clearAssetsForBankruptcy();
                this.simulationService.bankruptcyService.triggerBankruptcyFlow();
            }},
            forceSyndicateBankruptcy: { name: 'Force Syndicate Seizure', type: 'button', handler: () => {
                this.gameState.player.credits = 0;
                this.gameState.player.debt = 50000;
                this.gameState.player.loanType = 'syndicate';
                this._clearAssetsForBankruptcy();
                this.simulationService.bankruptcyService.triggerBankruptcyFlow();
            }},
            forceDestituteBankruptcy: { name: 'Force Vagrancy', type: 'button', handler: () => {
                this.gameState.player.credits = 0;
                this.gameState.player.debt = 0;
                this.gameState.player.loanType = 'guild';
                this._clearAssetsForBankruptcy();
                this.simulationService.bankruptcyService.triggerBankruptcyFlow();
            }},
            clearLoanLockoutTimer: { name: 'Clear Credit Lockout', type: 'button', handler: () => {
                this.gameState.player.creditLockoutExpiryDate = null;
                this.gameState.setState({});
                this.uiManager.createFloatingText('Credit Lockout Cleared', window.innerWidth/2, window.innerHeight/2, '#4ade80');
            }}
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
            navScreen: document.getElementById('diag-nav-screen')
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

        if(this.diagElements.winW) this.diagElements.winW.textContent = window.innerWidth;
        if(this.diagElements.winH) this.diagElements.winH.textContent = window.innerHeight;

        if (window.visualViewport) {
            if(this.diagElements.visualVpW) this.diagElements.visualVpW.textContent = Math.round(window.visualViewport.width);
            if(this.diagElements.visualVpH) this.diagElements.visualVpH.textContent = Math.round(window.visualViewport.height);
        }

        if(this.diagElements.gameW) this.diagElements.gameW.textContent = gameContainer.clientWidth;
        if(this.diagElements.gameH) this.diagElements.gameH.textContent = gameContainer.clientHeight;
        if(this.diagElements.bodyW) this.diagElements.bodyW.textContent = document.body.clientWidth;
        if(this.diagElements.bodyH) this.diagElements.bodyH.textContent = document.body.clientHeight;
        if(this.diagElements.pixelRatio) this.diagElements.pixelRatio.textContent = window.devicePixelRatio.toFixed(2);
        if(this.diagElements.displayMode) this.diagElements.displayMode.textContent = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
        if(this.diagElements.day) this.diagElements.day.textContent = state.day;
        if(this.diagElements.navScreen) this.diagElements.navScreen.textContent = `${state.activeNav} / ${state.activeScreen}`;
    }

    buildGui() {
        const flowFolder = this.gui.addFolder('Game Flow');
        flowFolder.add(this.actions.godMode, 'handler').name(this.actions.godMode.name);
        flowFolder.add(this.actions.simpleStart, 'handler').name(this.actions.simpleStart.name);
        flowFolder.add(this.actions.skipToStarterSelection, 'handler').name(this.actions.skipToStarterSelection.name);
        flowFolder.add(this.actions.skipToHangarTutorial, 'handler').name(this.actions.skipToHangarTutorial.name);
        flowFolder.add(this.actions.unlockAll, 'handler').name('Unlock ALL');
        flowFolder.add(this.actions.solTesting, 'handler').name('Sol Testing');
        flowFolder.add(this.actions.missionTest, 'handler').name('Mission Test');
        
        const bankFolder = this.gui.addFolder('Bankruptcy Events');
        bankFolder.add(this.actions.forceGuildBankruptcy, 'handler').name(this.actions.forceGuildBankruptcy.name);
        bankFolder.add(this.actions.forceSyndicateBankruptcy, 'handler').name(this.actions.forceSyndicateBankruptcy.name);
        bankFolder.add(this.actions.forceDestituteBankruptcy, 'handler').name(this.actions.forceDestituteBankruptcy.name);
        bankFolder.add(this.actions.clearLoanLockoutTimer, 'handler').name(this.actions.clearLoanLockoutTimer.name);

        const uiFolder = this.gui.addFolder('UI Guides');
        
        const mainNavFolder = uiFolder.addFolder('Allowed Main Navs');
        Object.values(NAV_IDS).forEach(id => mainNavFolder.add(this.debugState.navLockMain, id).name(id));
        
        const subNavFolder = uiFolder.addFolder('Allowed Sub Navs');
        Object.values(SCREEN_IDS).forEach(id => subNavFolder.add(this.debugState.navLockSub, id).name(id));
        
        uiFolder.add(this.actions.applyNavLock, 'handler').name(this.actions.applyNavLock.name);
        uiFolder.add(this.actions.clearNavLock, 'handler').name(this.actions.clearNavLock.name);

        const solFolder = this.gui.addFolder('Sol Station');
        solFolder.add(this.actions.levelUpSolStation, 'handler').name(this.actions.levelUpSolStation.name);
        solFolder.add(this.actions.addAllOfficers, 'handler').name(this.actions.addAllOfficers.name);
        solFolder.add(this.actions.unlockAllOfficerSlots, 'handler').name(this.actions.unlockAllOfficerSlots.name);
        solFolder.add(this.actions.add1000AllItems, 'handler').name(this.actions.add1000AllItems.name);
        solFolder.add(this.actions.fillSolCaches, 'handler').name(this.actions.fillSolCaches.name);
        solFolder.add(this.actions.testRecruitOfficer, 'handler').name(this.actions.testRecruitOfficer.name);

        const playerFolder = this.gui.addFolder('Player');
        playerFolder.add(this.debugState, 'creditsToAdd').name('Credits Amount');
        playerFolder.add(this.actions.addCredits, 'handler').name('Add Credits');
        playerFolder.add(this.debugState, 'creditsToReduce', 100, 1000000, 100).name('Credits to Reduce');
        playerFolder.add(this.actions.reduceCredits, 'handler').name('Reduce Credits');
        playerFolder.add(this.actions.payDebt, 'handler').name(this.actions.payDebt.name);
        playerFolder.add(this.debugState, 'targetAge', 18, 1000, 1).name('Target Age');
        playerFolder.add(this.actions.setAge, 'handler').name('Set Age');

        const shipFolder = this.gui.addFolder('Ship');
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

        const attributesFolder = this.gui.addFolder('Game Attributes');
        
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

        const worldFolder = this.gui.addFolder('World & Time');
        worldFolder.add(this.debugState, 'daysToAdvance', 1, 365, 1).name('Days to Advance');
        worldFolder.add(this.actions.advanceTime, 'handler').name('Advance Time');

        this.economyFolder = this.gui.addFolder('Economy'); 
        this.economyFolder.add(this.actions.replenishStock, 'handler').name(this.actions.replenishStock.name);
        this.economyFolder.add(this.actions.resetEconomyMemory, 'handler').name(this.actions.resetEconomyMemory.name);
        this.economyFolder.add(this.actions.sootheEconomy, 'handler').name(this.actions.sootheEconomy.name);
        this.economyFolder.add(this.actions.riotEconomy, 'handler').name(this.actions.riotEconomy.name);
        this.economyFolder.add(this.actions.injectStock, 'handler').name(this.actions.injectStock.name);

        const sysStateFolder = this.gui.addFolder('System States');
        const stateOptions = Object.keys(DB.SYSTEM_STATES).reduce((acc, key) => {
            acc[DB.SYSTEM_STATES[key].name] = key;
            return acc;
        }, {});
        sysStateFolder.add(this.debugState, 'selectedSystemState', stateOptions).name('Select State');
        sysStateFolder.add(this.actions.triggerSystemState, 'handler').name(this.actions.triggerSystemState.name);
        sysStateFolder.add(this.actions.showEconWeatherUI, 'handler').name(this.actions.showEconWeatherUI.name);

        const triggerFolder = this.gui.addFolder('Triggers');
        
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
        
        const sortedMissions = Object.values(DB.MISSIONS).map(m => {
            const match = m.id.match(/\d+$/);
            const prefix = match ? `${match[0].padStart(2, '0')} ` : '';
            return { label: `${prefix}${m.name}`, id: m.id };
        }).sort((a, b) => a.label.localeCompare(b.label));

        const missionOptions = {};
        sortedMissions.forEach(m => missionOptions[m.label] = m.id);

        triggerFolder.add(this.debugState, 'selectedMission', missionOptions).name('Mission');
        triggerFolder.add(this.actions.forceAddTerminalMission, 'handler').name('Force to Terminal');
        triggerFolder.add(this.actions.forceAcceptMission, 'handler').name('Force Accept');
        triggerFolder.add(this.actions.forceCompleteMission, 'handler').name('Force Complete');

        triggerFolder.add(this.actions.triggerSystemToast, 'handler').name(this.actions.triggerSystemToast.name);
        triggerFolder.add(this.actions.triggerFinanceToast, 'handler').name(this.actions.triggerFinanceToast.name);
        triggerFolder.add(this.actions.triggerIntelToast, 'handler').name(this.actions.triggerIntelToast.name);
        triggerFolder.add(this.actions.triggerMissionToast, 'handler').name(this.actions.triggerMissionToast.name);
        triggerFolder.add(this.actions.triggerSolToast, 'handler').name(this.actions.triggerSolToast.name);

        const telemetryFolder = this.gui.addFolder('Econ Telemetry (Export)');
        
        // --- PHASE 5: X-RAY TOGGLE ---
        telemetryFolder.add(this.debugState, 'xrayEnabled').name('Enable X-Ray Mode').onChange(val => {
            if (!this.gameState.uiState) this.gameState.uiState = {};
            this.gameState.uiState.xrayEnabled = val;
            this.gameState.setState({}); // Re-render to show/hide overlay immediately
        });

        telemetryFolder.add(this, 'exportDailyState').name('Export Daily State (CSV)');
        telemetryFolder.add(this, 'exportTradeShocks').name('Export Trade Shocks (CSV)');
        telemetryFolder.add(this, 'exportBotProgression').name('Export Bot Progress (CSV)');
        telemetryFolder.add(this, 'clearTelemetry').name('Clear Telemetry Buffer');

        const abMatrixFolder = this.gui.addFolder('A/B Sim Matrix');
        if (GAME_RULES.AVAILABILITY_PRESSURE_STRENGTH !== undefined) {
            abMatrixFolder.add(GAME_RULES, 'AVAILABILITY_PRESSURE_STRENGTH', 0.01, 2.0, 0.01).name('Availability Pressure');
        }
        if (GAME_RULES.MEAN_REVERSION_STRENGTH !== undefined) {
            abMatrixFolder.add(GAME_RULES, 'MEAN_REVERSION_STRENGTH', 0.001, 0.5, 0.001).name('Mean Reversion');
        }
        if (GAME_RULES.LOCAL_PRICE_MOD_STRENGTH !== undefined) {
            abMatrixFolder.add(GAME_RULES, 'LOCAL_PRICE_MOD_STRENGTH', 0.0, 1.0, 0.05).name('Local Target Mod');
        }

        const automationFolder = this.gui.addFolder('Automation & Logging');
        automationFolder.add(this, 'toggleDiagnosticOverlay').name('Toggle HUD Diagnostics');
        automationFolder.add(this.debugState, 'logLevel', ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE']).name('Log Level').onChange(v => { if(this.logger && this.logger.setLevel) this.logger.setLevel(v) });
        automationFolder.add(this, 'generateBugReport').name('Generate Bug Report');
        
        automationFolder.add(this.debugState, 'botStrategy', ['MIXED', 'HONEST_TRADER', 'MANIPULATOR', 'DEPLETE_ONLY', 'PROSPECTOR']).name('Bot Strategy');
        
        automationFolder.add(this.debugState, 'botDaysToRun', 1, 10000, 1).name('Simulation Days');
        automationFolder.add(this.actions.startBot, 'handler').name(this.actions.startBot.name);
        automationFolder.add(this.actions.stopBot, 'handler').name(this.actions.stopBot.name);
        automationFolder.add(this.debugState, 'botProgress').name('Progress').listen();

        this.gui.folders.forEach(folder => folder.close());
    }
}