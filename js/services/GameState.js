// js/services/GameState.js
import { GAME_RULES, SAVE_KEY, SHIP_IDS, LOCATION_IDS, NAV_IDS, SCREEN_IDS, COMMODITY_IDS } from '../data/constants.js';
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { skewedRandom, deepMerge } from '../utils.js';

/**
 * Procedurally generates the travel data matrix, calculating the time and fuel cost
 * for travel between every pair of locations in the game based on their explicit distances.
 * @param {Array<object>} markets - The array of market objects from the database, including distance property.
 * @returns {object} A nested object where `travelData[fromId][toId]` contains travel info.
 */
function procedurallyGenerateTravelData(markets) {
    const travelData = {};
    const timeScalar = 0.1;  // Controls how much distance affects time
    const fuelScalar = 0.45; // Controls how much distance affects fuel

    markets.forEach(fromMarket => {
        travelData[fromMarket.id] = {};
        markets.forEach(toMarket => {
            if (fromMarket.id === toMarket.id) return;

            const fromDistance = fromMarket.parent ? (markets.find(m => m.id === fromMarket.parent)?.distance || 0) : fromMarket.distance;
            const toDistance = toMarket.parent ? (markets.find(m => m.id === toMarket.parent)?.distance || 0) : toMarket.distance;

            const distance = Math.abs(toDistance - fromDistance);
            
            // Add the moon's own small distance from its parent if it's involved
            const moonCorrection = (fromMarket.parent || toMarket.parent) ? 15 : 0;
            const finalDistance = distance + moonCorrection;

            // Travel time now scales exponentially with distance for a greater impact on long journeys.
            let travelTime = 1 + Math.pow(finalDistance, 1.15) * timeScalar;
            let fuelCost = 2 + finalDistance * fuelScalar;
            
            // Special case for Earth-Luna to make it a quick, early-game trip.
            if ((fromMarket.id === LOCATION_IDS.EARTH && toMarket.id === LOCATION_IDS.LUNA) || (fromMarket.id === LOCATION_IDS.LUNA && toMarket.id === LOCATION_IDS.EARTH)) {
                travelTime = 2 + Math.floor(Math.random() * 2);
                fuelCost = 5 + Math.floor(Math.random() * 2);
            }

            travelData[fromMarket.id][toMarket.id] = {
                time: Math.max(1, Math.round(travelTime)),
                fuelCost: Math.max(1, Math.round(fuelCost)),
            };
        });
    });
    return travelData;
}

/**
 * @class GameState
 * @description Holds all mutable data for the game session, acting as the single source of truth.
 * Static data (e.g., ship base stats, commodity types) is imported from the /data directory.
 * Dynamic data (e.g., player credits, ship health, cargo inventories) is stored and managed here.
 * For example, `DB.SHIPS` contains a ship's max health, while `player.shipStates` in this class
 * contains the *current* health of each ship the player owns.
 */
export class GameState {
    constructor() {
        this.state = {};
        this.subscribers = [];
        this.TRAVEL_DATA = procedurallyGenerateTravelData(DB.MARKETS);
    }

    /**
     * Subscribes a callback function to be executed whenever the game state changes.
     * @param {function} callback - The function to call on state changes.
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /**
     * Notifies all subscribed components that the state has changed.
     * @private
     */
    _notify() {
        this.subscribers.forEach(callback => callback(this));
    }

    /**
     * Updates the game state by merging a partial state object and notifies subscribers.
     * This is the primary method for mutating the game state.
     * @param {object} partialState - An object containing the properties of the state to update.
     */
    setState(partialState) {
        Object.assign(this, partialState);
        this._notify();
    }
    
    /**
     * Returns a deep copy of the current game state to prevent direct mutation.
     * @returns {object} A JSON-serialized and parsed copy of the game state.
     */
    getState() {
        const copy = JSON.parse(JSON.stringify(this));
        
        // V4 FIX: Prevent functions in the subscribers array from being serialized into [null].
        // This ensures the saved state remains purely data-driven.
        delete copy.subscribers;
        
        return copy;
    }

    /**
     * V4 SAVE SYSTEM: Serializes the state and strictly scrubs ephemeral properties
     * to prevent soft-locks when loading (e.g. pending travel loops or broken DOM states).
     * @returns {object} A sanitized, deep copy of the game state.
     */
    exportState() {
        const stateCopy = this.getState();
        
        // --- PHASE 3: STRANDING PROTECTION ---
        // If the player closes the app mid-travel, pendingTravel exists and they are reset to the origin.
        // We must refund the fuel that was deducted at launch to prevent stranding.
        if (stateCopy.pendingTravel && stateCopy.pendingTravel.destinationId) {
            try {
                const originId = stateCopy.currentLocationId;
                const destId = stateCopy.pendingTravel.destinationId;
                const activeShipId = stateCopy.player.activeShipId;
                
                if (this.TRAVEL_DATA[originId] && this.TRAVEL_DATA[originId][destId]) {
                    const baseFuelCost = this.TRAVEL_DATA[originId][destId].fuelCost || 0;
                    const convoyTax = stateCopy.pendingTravel.convoyTaxDeduction || 0;
                    
                    if (stateCopy.player.shipStates[activeShipId]) {
                        stateCopy.player.shipStates[activeShipId].fuel += (baseFuelCost + convoyTax);
                    }
                }
            } catch (e) {
                console.warn("Could not process fuel refund for mid-travel save.", e);
            }
        }

        // Strip ephemeral properties
        stateCopy.pendingTravel = null;
        stateCopy.introSequenceActive = false;

        // Strip tutorial locks to prevent loading into a dead end
        if (stateCopy.tutorials) {
            stateCopy.tutorials.guidedNavPath = { active: false, navIds: [], screenIds: [] };
        }

        // Strip telemetry to prevent massive save file bloat
        delete stateCopy.telemetry;

        // --- PHASE 1: PAYLOAD OPTIMIZATION (INFINITE BLOAT PROTECTION) ---
        // Truncate continuous history arrays to a maximum of 60 trailing entries
        if (stateCopy.player && stateCopy.player.financeLog) {
            stateCopy.player.financeLog = stateCopy.player.financeLog.slice(-60);
        }

        if (stateCopy.market && stateCopy.market.priceHistory) {
            for (const locId in stateCopy.market.priceHistory) {
                for (const commId in stateCopy.market.priceHistory[locId]) {
                    if (Array.isArray(stateCopy.market.priceHistory[locId][commId])) {
                        stateCopy.market.priceHistory[locId][commId] = stateCopy.market.priceHistory[locId][commId].slice(-60);
                    }
                }
            }
        }

        // Truncate Macroeconomic Arrays
        if (stateCopy.systemStates) {
            if (Array.isArray(stateCopy.systemStates.historyLedger)) {
                stateCopy.systemStates.historyLedger = stateCopy.systemStates.historyLedger.slice(-30);
            }
            if (Array.isArray(stateCopy.systemStates.economyFootprints)) {
                stateCopy.systemStates.economyFootprints = stateCopy.systemStates.economyFootprints.slice(-100);
            }
        }

        // Force loaded games to start on the missions screen
        stateCopy.activeNav = NAV_IDS.DATA;
        stateCopy.activeScreen = SCREEN_IDS.MISSIONS;
        
        // Revert UI state to safe defaults
        stateCopy.uiState = {
            marketCardMinimized: {},
            hangarShipyardToggleState: 'shipyard',
            hangarActiveIndex: 0,
            shipyardActiveIndex: 0,
            activeIntelTab: 'intel-codex-content',
            servicesTab: 'supply',
            activeMissionTab: 'terminal',
            enableEconomicTelemetry: false // Prevent telemetry from staying active accidentally across sessions
        };

        return stateCopy;
    }

    /**
     * V4 SAVE SYSTEM: Loads a game utilizing the "Deep Merge" backwards-compatibility strategy.
     * Generates a fully up-to-date state schema, then paints the saved data over it.
     * @param {object} savedPayload - The full payload loaded from IndexedDB.
     * @returns {boolean} True if successfully loaded.
     */
    importMergedState(savedPayload) {
        if (!savedPayload || !savedPayload.state) return false;

        // 1. Generate a fresh, up-to-date state baseline using the player's saved name
        const playerName = savedPayload.state.player?.name || "Captain";
        this.startNewGame(playerName);

        // V4 FIX: Sanitize the incoming payload to strip any corrupted [null] subscriber 
        // arrays generated by previous bugged saves.
        if (savedPayload.state.subscribers) {
            delete savedPayload.state.subscribers;
        }

        // Cache the live event subscribers so they aren't destroyed during the merge operation.
        const activeSubscribers = this.subscribers;

        // --- PHASE 2: HYDRATION HARDENING (ARRAY MUTATION RISK) ---
        // Preemptively clear baseline dynamic arrays before the deep merge. 
        // This prevents "ghost" data from the starter state from merging into the player's saved arrays.
        this.player.ownedShipIds = [];
        this.player.inventories = {};
        this.solStation.officers = [];

        // 2. Deep merge the saved data over the fresh baseline
        const mergedState = deepMerge(this.getState(), savedPayload.state);
        
        // 3. Apply merged state and slot association
        Object.assign(this, mergedState);
        this.slotId = savedPayload.slotId;
        
        // Restore the live subscribers
        this.subscribers = activeSubscribers;

        // --- PHASE 4: SCHEMA NORMALIZATION & PRUNING ---
        this._normalizeShipData();
        this._pruneObsoleteData();

        // 4. Regenerate derived arrays to guarantee map accuracy across patches
        this.TRAVEL_DATA = procedurallyGenerateTravelData(DB.MARKETS);

        this._notify();
        return true;
    }

    /**
     * Ensures all ships in the player's fleet conform to the latest database schema.
     * Resolves the "Wanderer Bias" vulnerability during hydration.
     * @private
     */
    _normalizeShipData() {
        if (!this.player || !this.player.ownedShipIds) return;
        
        this.player.ownedShipIds.forEach(shipId => {
            const dbShip = DB.SHIPS[shipId];
            if (!dbShip) return; // Caught by prune pass if invalid

            // 1. Normalize Ship States
            if (!this.player.shipStates[shipId]) {
                this.player.shipStates[shipId] = this._getInitialShipState(shipId);
            } else {
                // Patch missing arrays/objects on existing ships
                if (!this.player.shipStates[shipId].upgrades) this.player.shipStates[shipId].upgrades = [];
                if (!this.player.shipStates[shipId].hullAlerts) this.player.shipStates[shipId].hullAlerts = { one: false, two: false };
            }

            // 2. Normalize Inventories
            if (!this.player.inventories[shipId]) {
                this.player.inventories[shipId] = {};
            }
            
            // Ensure all valid commodities exist in this ship's inventory
            DB.COMMODITIES.forEach(c => {
                if (!this.player.inventories[shipId][c.id]) {
                    this.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
                }
            });
        });
    }

    /**
     * Scrubs the hydrated state to remove any zombie data (locations, commodities, ships)
     * that have been deleted from the master database in recent patches.
     * @private
     */
    _pruneObsoleteData() {
        // 1. Prune obsolete commodities from player inventories
        const validCommodityIds = new Set(DB.COMMODITIES.map(c => c.id));
        if (this.player && this.player.inventories) {
            for (const shipId in this.player.inventories) {
                for (const commId in this.player.inventories[shipId]) {
                    if (!validCommodityIds.has(commId)) {
                        delete this.player.inventories[shipId][commId];
                    }
                }
            }
        }

        // 2. Prune obsolete locations/commodities from market data
        const validLocationIds = new Set(DB.MARKETS.map(m => m.id));
        if (this.market) {
            // Prune Market Prices
            for (const locId in this.market.prices) {
                if (!validLocationIds.has(locId)) {
                    delete this.market.prices[locId];
                    continue;
                }
                for (const commId in this.market.prices[locId]) {
                    if (!validCommodityIds.has(commId)) delete this.market.prices[locId][commId];
                }
            }
            
            // Prune Market Inventory
            for (const locId in this.market.inventory) {
                if (!validLocationIds.has(locId)) {
                    delete this.market.inventory[locId];
                    continue;
                }
                for (const commId in this.market.inventory[locId]) {
                    if (!validCommodityIds.has(commId)) delete this.market.inventory[locId][commId];
                }
            }

            // Prune Price History
            for (const locId in this.market.priceHistory) {
                if (!validLocationIds.has(locId)) {
                    delete this.market.priceHistory[locId];
                    continue;
                }
                for (const commId in this.market.priceHistory[locId]) {
                    if (!validCommodityIds.has(commId)) delete this.market.priceHistory[locId][commId];
                }
            }
        }

        // 3. Prune obsolete ships from player ownership
        const validShipIds = new Set(Object.keys(DB.SHIPS));
        if (this.player && this.player.ownedShipIds) {
            this.player.ownedShipIds = this.player.ownedShipIds.filter(id => validShipIds.has(id));
            
            // If active ship was deleted, fallback to Wanderer
            if (!validShipIds.has(this.player.activeShipId)) {
                this.player.activeShipId = SHIP_IDS.WANDERER;
                if (!this.player.ownedShipIds.includes(SHIP_IDS.WANDERER)) {
                    this.player.ownedShipIds.push(SHIP_IDS.WANDERER);
                }
            }
        }
    }

    /**
     * Saves the current game state to localStorage.
     * NOTE: This functionality is currently disabled in favor of V4 Save System.
     */
    saveGame() {
        // Obsolete
    }

    /**
     * Loads the game state from localStorage.
     * NOTE: This functionality is currently disabled in favor of V4 Save System.
     * @returns {boolean} True if a game was successfully loaded, false otherwise.
     */
    loadGame() {
        return false;
    }

    /**
     * Initializes the game state for a new game session, setting all player, market,
     * and other dynamic data to their default starting values.
     * @param {string} playerName - The name entered by the player.
     */
    startNewGame(playerName) {
        // --- SOL STATION CACHE INITIALIZATION ---
        // Dynamically create a cache for every commodity except Antimatter (Tier 7)
        // Capacity scales inversely with Tier.
        const solCaches = {};
        const TIER_CAPACITY = {
            1: 5000,
            2: 4000,
            3: 3000,
            4: 2000,
            5: 1000,
            6: 500
        };

        DB.COMMODITIES.forEach(c => {
            if (c.id !== COMMODITY_IDS.ANTIMATTER) {
                // Default to small capacity if tier is undefined or unexpected
                const cap = TIER_CAPACITY[c.tier] || 100;
                
                // Initialize with ~20% fill for flavor
                solCaches[c.id] = { 
                    current: Math.floor(cap * 0.2), 
                    max: cap 
                };
            }
        });

        const initialState = {
            slotId: null, // V4 SYSTEM: Track active save slot
            day: 1, lastInterestChargeDay: 1, lastMarketUpdateDay: 1, currentLocationId: LOCATION_IDS.MARS, activeNav: NAV_IDS.DATA, activeScreen: SCREEN_IDS.MISSIONS, isGameOver: false,
            subNavCollapsed: false,
            introSequenceActive: true,
            lastActiveScreen: {
                [NAV_IDS.SHIP]: SCREEN_IDS.MAP,
                [NAV_IDS.STARPORT]: SCREEN_IDS.MARKET,
                [NAV_IDS.DATA]: SCREEN_IDS.MISSIONS,
            },
            pendingTravel: null,
            
            // --- SYSTEM STATES V3 ---
            systemStates: { // Schema Alignment
                activeId: null, // Will evaluate to NEUTRAL or another active state upon first tick
                remainingDays: 0,
                neutralPauseDays: 0, 
                targetLocations: [],
                historyLedger: [],
                economyFootprints: [] // Tracks specific player trading activity to trigger targeted states
            },
            // --- END SYSTEM STATES V3 ---

            player: {
                name: playerName, playerTitle: 'Captain', playerAge: 24, lastBirthdayYear: DB.DATE_CONFIG.START_YEAR, birthdayProfitBonus: 0,
                introStep: 0,
                credits: 6000, debt: 0, monthlyInterestAmount: 0,
                loanStartDate: null, seenGarnishmentWarning: false,
                // --- VIRTUAL WORKBENCH: CORPORATE DEBT UPDATE ---
                loanType: 'guild', loanDueDate: null, repoNextEventDay: null, lastRepoStrikeDay: null,
                creditLockoutExpiryDate: null,
                // --- END VIRTUAL WORKBENCH ---
                revealedTier: 1,
                unlockedLicenseIds: [],
                unlockedLocationIds: DB.MARKETS.map(m => m.id).filter(id => 
                    id !== LOCATION_IDS.EXCHANGE && 
                    id !== LOCATION_IDS.KEPLER &&
                    id !== LOCATION_IDS.SUN && 
                    id !== LOCATION_IDS.MERCURY
                ),
                seenCommodityMilestones: [], financeLog: [],
                seenAutoSaveNotice: false, // V4 SYSTEM: Notification flag
                activePerks: {}, seenEvents: [], activeShipId: SHIP_IDS.WANDERER, 
                ownedShipIds: [SHIP_IDS.WANDERER],
                officerRoster: Object.keys(OFFICERS), // Expanded officer universe pool tracking, initialized for testing
                unlockedOfficerIds: [], // Added for Officer Acquisition Pipeline
                // --- VIRTUAL WORKBENCH: SHIP STATE UPGRADES ---
                // Added `upgrades: []` to the initial Wanderer state
                shipStates: { [SHIP_IDS.WANDERER]: { health: DB.SHIPS[SHIP_IDS.WANDERER].maxHealth, fuel: DB.SHIPS[SHIP_IDS.WANDERER].maxFuel, hullAlerts: { one: false, two: false }, upgrades: [] } },
                // --- END VIRTUAL WORKBENCH ---
                inventories: { },
                debugEventIndex: 0,
                // --- VIRTUAL WORKBENCH ---
                // Visual Seed: A counter that increments to drive the deterministic asset rotation.
                visualSeed: 0,
                // --- PHASE 1: AGE ENGINE ---
                statModifiers: {
                    profitBonus: 0.0,       // Era 1 (Age 25+)
                    intelCost: 0.0,         // Era 1
                    purchaseCost: 0.0,      // Era 1
                    intelDuration: 0.0,     // Era 1 & 2
                    fuelCost: 0.0,          // Era 1
                    repairCost: 0.0,        // Era 1
                    commoditySupply: 0.0,   // Era 2 (Age 100+)
                    shipPrice: 0.0,         // Era 2
                    travelSpeed: 0.0,       // Era 2
                    shipSpawnRate: 0.0,     // Era 2
                    upgradeSpawnRate: 0.0   // Era 2
                },
                serviceTokens: {
                    fuel: 0, // Era 3 (Age 200+)
                    repair: 0
                }
                // --- END PHASE 1 ---
            },
            market: { prices: {}, inventory: {}, galacticAverages: {}, priceHistory: {}, shipyardStock: {} },
            
            // --- VIRTUAL WORKBENCH ---
            intelMarket: {},
            activeIntelDeal: null,
            activeHotIntel: null,
            lastHotIntelDay: -365,
            // --- END VIRTUAL WORKBENCH ---

            // --- VIRTUAL WORKBENCH: PHASE 1 SOL STATION PROGRESSION ---
            solStation: {
                level: 1,
                activeProject: {},
                unlocked: false, // Default locked until acquired via endgame conditions
                mode: "STABILITY", // Default safe mode
                health: 100, // Aggregate health percentage
                caches: solCaches, // NOW DYNAMICALLY POPULATED
                officers: [
                    { slotId: 1, assignedOfficerId: null },
                    { slotId: 2, assignedOfficerId: null },
                    { slotId: 3, assignedOfficerId: null }
                ],
                stockpile: {
                    credits: 0,
                    antimatter: 0
                },
                activeProjectBank: {
                    "c_water_ice": 0,
                    "credits": 0
                },
                // --- FOLDED SPACE DRIVE MANUFACTURING DEFAULTS ---
                antimatterCache: 0,
                synthesisProgress: 0,
                fsdOutput: 0
                // --- END FSD MANUFACTURING ---
            },
            // --- END VIRTUAL WORKBENCH ---

            tutorials: {
                seenHelpContexts: [],
                helpSlideMemory: {},
                // --- VIRTUAL WORKBENCH: UI GUIDE LOCK ---
                guidedNavPath: {
                    active: true,
                    navIds: ['data'],
                    screenIds: ['missions']
                }
            },
            missions: {
                // --- MISSION SYSTEM 2.0 (Phase 1) ---
                // Renamed from activeMissionId to activeMissionIds (Array)
                // Removed activeMissionObjectivesMet (now tracked per mission in missionProgress)
                activeMissionIds: [], 
                completedMissionIds: [],
                missionProgress: {},
                // [[NEW]] Phase 3: Tracked Mission ID for HUD
                trackedMissionId: null
                // --- END MISSION SYSTEM 2.0 ---
            },
            uiState: {
                marketCardMinimized: {},
                hangarShipyardToggleState: 'shipyard',
                hangarActiveIndex: 0,
                shipyardActiveIndex: 0,
                // --- VIRTUAL WORKBENCH (A) ---
                // Add state to track the active intel tab
                activeIntelTab: 'intel-codex-content', // Matches DOM ID
                servicesTab: 'supply', // Added: Tracks Services Screen sub-nav ('supply' or 'tuning')
                // --- MISSION SYSTEM 2.0 (Phase 3) ---
                activeMissionTab: 'terminal', // 'terminal' | 'log'
                enableEconomicTelemetry: false // Telemetry execution gate
                // --- END VIRTUAL WORKBENCH ---
            },
            telemetry: {
                ticks: [],
                trades: [],
                impacts: []
            }
        };

        initialState.player.inventories[SHIP_IDS.WANDERER] = {};
        DB.COMMODITIES.forEach(c => { initialState.player.inventories[SHIP_IDS.WANDERER][c.id] = { quantity: 0, avgCost: 0 }; });

        // --- VIRTUAL WORKBENCH ---
        // Initialize new intelMarket property
        initialState.intelMarket = {};
        // --- END VIRTUAL WORKBENCH ---

        DB.MARKETS.forEach(m => {
            initialState.market.priceHistory[m.id] = {};
            
            // --- VIRTUAL WORKBENCH ---
            // Removed obsolete intel.available line
            // Added intelMarket initialization per GDD
            initialState.intelMarket[m.id] = [];
            // --- END VIRTUAL WORKBENCH ---

            initialState.market.inventory[m.id] = {};
            initialState.market.shipyardStock[m.id] = { day: 0, shipsForSale: [] };
            DB.COMMODITIES.forEach(c => {
                initialState.market.priceHistory[m.id][c.id] = [];
                
                const [min, max] = c.canonicalAvailability;
                const modifier = m.availabilityModifier?.[c.id] ?? 1.0;
                let quantity = Math.floor(skewedRandom(min, max) * modifier);

                if (m.specialDemand && m.specialDemand[c.id]) quantity = 0;

                initialState.market.inventory[m.id][c.id] = { 
                    quantity: Math.max(0, quantity),
                    marketPressure: 0.0,
                    lastPlayerInteractionTimestamp: 0,
                    priceLockEndDay: 0,
                    hoverUntilDay: 0,
                    rivalArbitrage: { isActive: false, endDay: 0 },
                    isDepleted: false,
                    depletionDay: 0,
                    depletionBonusDay: 0
                };
            });
        });

        Object.assign(this, initialState);
        this._calculateGalacticAverages();
        this._seedInitialMarketPrices();
        this.setState({});
    }

    /**
     * Calculates the baseline galactic average price for all commodities.
     * This is used as a reference point for market price fluctuations.
     * @private
     */
    _calculateGalacticAverages() {
        this.market.galacticAverages = {};
        DB.COMMODITIES.forEach(good => {
            this.market.galacticAverages[good.id] = (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
        });
    }

    /**
     * Seeds the initial market prices for all commodities at all locations.
     * Prices are based on the target Local Baseline with randomness applied to prevent universal inflation.
     * @private
     */
    _seedInitialMarketPrices() {
        DB.MARKETS.forEach(location => {
            this.market.prices[location.id] = {};
            DB.COMMODITIES.forEach(good => {
                const avg = this.market.galacticAverages[good.id] || 0;
                const modifier = location.availabilityModifier?.[good.id] ?? 1.0;
                const targetPriceOffset = (1.0 - modifier) * avg;
                const localBaseline = avg + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);
                
                let price = localBaseline * (1 + (Math.random() - 0.5) * 0.15); // +/- 7.5% variance around true baseline
                this.market.prices[location.id][good.id] = Math.max(1, Math.round(price));
            });
        });
    }

    /**
     * Helper to generate a fresh state object for a new ship.
     * Ensures all dynamic properties (including upgrades) are initialized.
     * @param {string} shipId 
     * @returns {object}
     */
    _getInitialShipState(shipId) {
        const ship = DB.SHIPS[shipId];
        return {
            health: ship ? ship.maxHealth : 100,
            fuel: ship ? ship.maxFuel : 40,
            hullAlerts: { one: false, two: false },
            upgrades: [] // Initialize empty upgrades array
        };
    }
}