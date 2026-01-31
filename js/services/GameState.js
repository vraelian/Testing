// js/services/GameState.js
import { GAME_RULES, SAVE_KEY, SHIP_IDS, LOCATION_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';
import { DB } from '../data/database.js';
import { skewedRandom } from '../utils.js';

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
        // this.saveGame(); // NOTE: Saving is currently disabled.
    }
    
    /**
     * Returns a deep copy of the current game state to prevent direct mutation.
     * @returns {object} A JSON-serialized and parsed copy of the game state.
     */
    getState() {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * Saves the current game state to localStorage.
     * NOTE: This functionality is currently disabled.
     */
    saveGame() {
        // try {
        //     const stateToSave = { ...this };
        //     delete stateToSave.subscribers;
        //     localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        // } catch (error) {
        //     console.error("Error saving game state:", error);
        // }
    }

    /**
     * Loads the game state from localStorage.
     * NOTE: This functionality is currently disabled and will always start a new game.
     * @returns {boolean} True if a game was successfully loaded, false otherwise.
     */
    loadGame() {
        return false;
        // try {
        //     const serializedState = localStorage.getItem(SAVE_KEY);
        //     if (serializedState === null) return false;
            
        //     const loadedState = JSON.parse(serializedState);
        //     Object.assign(this, loadedState);
        //     this.TRAVEL_DATA = procedurallyGenerateTravelData(DB.MARKETS);
        //     this._notify();
        //     return true;
        // } catch (error) {
        //     console.warn("Could not parse save data. Starting new game.", error);
        //     localStorage.removeItem(SAVE_KEY);
        //     return false;
        // }
    }

    /**
     * Initializes the game state for a new game session, setting all player, market,
     * and other dynamic data to their default starting values.
     * @param {string} playerName - The name entered by the player.
     */
    startNewGame(playerName) {
        const initialState = {
            day: 1, lastInterestChargeDay: 1, lastMarketUpdateDay: 1, currentLocationId: LOCATION_IDS.MARS, activeNav: NAV_IDS.SHIP, activeScreen: SCREEN_IDS.NAVIGATION, isGameOver: false,
            subNavCollapsed: false,
            introSequenceActive: true,
            lastActiveScreen: {
                [NAV_IDS.SHIP]: SCREEN_IDS.MAP,
                [NAV_IDS.STARPORT]: SCREEN_IDS.MARKET,
                [NAV_IDS.DATA]: SCREEN_IDS.MISSIONS,
            },
            pendingTravel: null,
            player: {
                name: playerName, playerTitle: 'Captain', playerAge: 24, lastBirthdayYear: DB.DATE_CONFIG.START_YEAR, birthdayProfitBonus: 0,
                introStep: 0,
                credits: 3000, debt: 0, monthlyInterestAmount: 0,
                loanStartDate: null, seenGarnishmentWarning: false,
                revealedTier: 1,
                unlockedLicenseIds: [],
                unlockedLocationIds: DB.MARKETS.map(m => m.id).filter(id => 
                    id !== LOCATION_IDS.EXCHANGE && 
                    id !== LOCATION_IDS.KEPLER &&
                    id !== LOCATION_IDS.SUN && 
                    id !== LOCATION_IDS.MERCURY
                ),
                seenCommodityMilestones: [], financeLog: [],
                activePerks: {}, seenEvents: [], activeShipId: SHIP_IDS.WANDERER, ownedShipIds: [SHIP_IDS.WANDERER],
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
            // Removed obsolete `intel` property
            // Added new GDD properties
            intelMarket: {},
            activeIntelDeal: null,
            // --- END VIRTUAL WORKBENCH ---

            // --- SOL STATION (PHASE 1 IMPLEMENTATION) ---
            solStation: {
                entropy: 0,          // 0-100% Station Entropy
                mode: 'DEFAULT',     // Current operation mode
                caches: {},          // Storage for Tier 1-6 commodities { commodityId: amount }
                officers: [],        // Array of assigned officers
                lastWeeklyBurn: 0,   // Timestamp (day) of last consumption
                bank: {              // Accrued resources
                    credits: 0,
                    antimatter: 0
                }
            },
            // --- END SOL STATION ---

            tutorials: {
                activeBatchId: null,
                activeStepId: null,
                seenBatchIds: [],
                skippedTutorialBatches: [],
                navLock: null
            },
            missions: {
                activeMissionId: null,
                completedMissionIds: [],
                missionProgress: {},
                activeMissionObjectivesMet: false
            },
            uiState: {
                marketCardMinimized: {},
                hangarShipyardToggleState: 'shipyard',
                hangarActiveIndex: 0,
                shipyardActiveIndex: 0,
                // --- VIRTUAL WORKBENCH (A) ---
                // Add state to track the active intel tab
                activeIntelTab: 'intel-codex-content', // Matches DOM ID
                servicesTab: 'supply' // Added: Tracks Services Screen sub-nav ('supply' or 'tuning')
                // --- END VIRTUAL WORKBENCH ---
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
     * Prices are based on the galactic average with randomness applied.
     * @private
     */
    _seedInitialMarketPrices() {
        DB.MARKETS.forEach(location => {
            this.market.prices[location.id] = {};
            DB.COMMODITIES.forEach(good => {
                let price = this.market.galacticAverages[good.id] * (1 + (Math.random() - 0.5) * 0.15); // +/- 7.5% variance
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