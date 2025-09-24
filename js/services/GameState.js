// js/services/GameState.js

import { DB } from '../data/database.js';
import { SAVE_KEY, LOCATION_IDS, NAV_IDS, SCREEN_IDS, SHIP_IDS, COMMODITY_IDS } from '../data/constants.js';

/**
 * @class GameState
 * @description Manages the central state of the game, including player data, market conditions,
 * and UI state. It also handles saving and loading game progress to localStorage.
 */
export class GameState {
    constructor(logger) {
        this.logger = logger;
        this._state = this._getInitialState();
        this.subscribers = [];
    }

    /**
     * Initializes the default state for a new game.
     * @returns {object} The initial game state object.
     * @private
     */
    _getInitialState() {
        const initialState = {
            day: 1,
            lastMarketUpdateDay: 1,
            lastInterestChargeDay: 1,
            introSequenceActive: true,
            currentLocationId: LOCATION_IDS.MARS,
            activeNav: NAV_IDS.SHIP,
            activeScreen: SCREEN_IDS.STATUS,
            lastActiveScreen: {
                [NAV_IDS.SHIP]: SCREEN_IDS.STATUS,
                [NAV_IDS.STARPORT]: SCREEN_IDS.MARKET,
                [NAV_IDS.DATA]: SCREEN_IDS.MISSIONS
            },
            subNavCollapsed: false,
            isGameOver: false,
            pendingTravel: null, // Stores destination if interrupted by event
            player: {
                name: "Player",
                playerAge: 25,
                lastBirthdayYear: DB.DATE_CONFIG.START_YEAR,
                birthdayProfitBonus: 0,
                playerTitle: 'Spacer',
                credits: 0,
                debt: 0,
                monthlyInterestAmount: 0,
                loanStartDate: null,
                seenGarnishmentWarning: false,
                activeShipId: SHIP_IDS.WANDERER,
                ownedShipIds: [SHIP_IDS.WANDERER],
                shipStates: {},
                inventories: {},
                financeLog: [],
                unlockedLocationIds: [LOCATION_IDS.MARS, LOCATION_IDS.EARTH, LOCATION_IDS.LUNA],
                unlockedLicenseIds: [],
                activePerks: {},
                seenEvents: [],
                revealedTier: 1,
                introStep: 0,
                debugEventIndex: 0 // for cycling through events
            },
            market: {
                prices: {},
                priceHistory: {},
                inventory: {},
                galacticAverages: {},
                systemState: { id: 'NORMAL', name: 'Normal', activeUntilDay: 99999 },
                shipyardStock: {}
            },
            intel: {
                available: {},
                active: null
            },
            missions: {
                available: {},
                activeMissionId: null,
                completedMissionIds: [],
                missionProgress: {},
                activeMissionObjectivesMet: false,
            },
            tutorials: {
                activeBatchId: null,
                activeStepId: null,
                seenTutorialBatches: [],
                skippedTutorialBatches: [],
                navLock: null // { navId: '...', screenId: '...', enabledElementQuery: '...' }
            },
            uiState: {
                hangarScreen: {
                    mode: 'shipyard', // 'hangar' or 'shipyard'
                    currentIndex: 0
                }
            },
            TRAVEL_DATA: this._calculateTravelData()
        };

        // Initialize ship states and inventories for owned ships
        initialState.player.ownedShipIds.forEach(shipId => {
            const ship = DB.SHIPS[shipId];
            initialState.player.shipStates[shipId] = {
                health: ship.maxHealth,
                fuel: ship.maxFuel,
                hullAlerts: { one: false, two: false }
            };
            initialState.player.inventories[shipId] = {};
        });
        
        // Initialize inventories for all commodities
        DB.COMMODITIES.forEach(c => {
            initialState.player.ownedShipIds.forEach(shipId => {
                initialState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
            });
        });
        
        // Initialize market data for all locations and commodities
        DB.MARKETS.forEach(market => {
            initialState.market.prices[market.id] = {};
            initialState.market.priceHistory[market.id] = {};
            initialState.market.inventory[market.id] = {};
            initialState.intel.available[market.id] = true;
            initialState.missions.available[market.id] = [];
            initialState.market.shipyardStock[market.id] = { day: 0, shipsForSale: [] };

            DB.COMMODITIES.forEach(good => {
                const price = Math.round((good.basePriceRange[0] + good.basePriceRange[1]) / 2);
                initialState.market.prices[market.id][good.id] = price;
                initialState.market.priceHistory[market.id][good.id] = [{ day: 1, price: price }];
                const baseQuantity = Math.round((good.canonicalAvailability[0] + good.canonicalAvailability[1]) / 2);
                const marketModifier = market.availabilityModifier[good.id] || 1;
                initialState.market.inventory[market.id][good.id] = { 
                    quantity: Math.round(baseQuantity * marketModifier),
                    marketPressure: 0,
                    lastPlayerInteractionTimestamp: 0
                };
            });
        });

        // Calculate initial galactic averages
        DB.COMMODITIES.forEach(good => {
            let total = 0;
            DB.MARKETS.forEach(market => {
                total += initialState.market.prices[market.id][good.id];
            });
            initialState.market.galacticAverages[good.id] = Math.round(total / DB.MARKETS.length);
        });

        return initialState;
    }

    /**
     * Retrieves the full current state object.
     * @returns {object} A deep copy of the current game state.
     */
    getState() {
        return JSON.parse(JSON.stringify(this._state));
    }

    /**
     * Updates the game state with new values and notifies subscribers.
     * @param {object} newState - An object containing the properties of the state to update.
     */
    setState(newState) {
        Object.assign(this._state, newState);
        this.notifySubscribers();
    }

    /**
     * Registers a callback function to be called whenever the state changes.
     * @param {function} callback - The function to subscribe to state updates.
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /**
     * Calls all registered subscriber functions, passing them the current state.
     */
    notifySubscribers() {
        const currentState = this.getState();
        this.subscribers.forEach(callback => callback(currentState));
    }

    /**
     * Saves the current game state to localStorage.
     */
    saveGame() {
        try {
            const stateToSave = this.getState();
            localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
            this.logger.info.system('Game', this._state.day, 'SAVED', 'Game state saved successfully.');
        } catch (error) {
            this.logger.error('GameState', `Failed to save game: ${error.message}`);
        }
    }

    /**
     * Loads the game state from localStorage, migrating old data structures if necessary.
     * @returns {boolean} True if a saved game was successfully loaded, false otherwise.
     */
    loadGame() {
        try {
            const savedStateJSON = localStorage.getItem(SAVE_KEY);
            if (!savedStateJSON) {
                this.logger.info.system('Game', 'No saved game found.');
                return false;
            }

            const savedState = JSON.parse(savedStateJSON);
            const migratedState = this._migrateSavedData(savedState);
            
            this._state = migratedState;
            this.logger.info.system('Game', this._state.day, 'LOADED', 'Game state loaded successfully.');
            return true;
        } catch (error) {
            this.logger.error('GameState', `Failed to load game: ${error.message}`);
            localStorage.removeItem(SAVE_KEY); // Clear corrupted save data.
            return false;
        }
    }
    
    /**
     * Resets the game state to its initial default values.
     */
    resetGame() {
        this._state = this._getInitialState();
        localStorage.removeItem(SAVE_KEY);
        this.logger.info.system('Game', 'RESET', 'Game state has been reset.');
        this.notifySubscribers();
    }
    
    /**
     * Ensures that saved data from older versions is compatible with the current version.
     * This function adds missing properties that were introduced in newer updates.
     * @param {object} savedState - The raw state object loaded from localStorage.
     * @returns {object} The state object, updated to be compatible with the current game version.
     * @private
     */
    _migrateSavedData(savedState) {
        const defaultState = this._getInitialState();

        // Recursively merge properties to ensure deep objects are also handled.
        const merge = (target, source) => {
            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                        if (!target.hasOwnProperty(key) || typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
                            target[key] = {}; // Ensure target key exists and is an object
                        }
                        merge(target[key], source[key]);
                    } else if (!target.hasOwnProperty(key)) {
                        target[key] = source[key]; // Add missing property
                    }
                }
            }
        };

        merge(savedState, defaultState);

        return savedState;
    }


    /**
     * Pre-calculates travel time and fuel cost between all locations based on their coordinates.
     * @returns {object} A nested object with travel data, e.g., { mars: { earth: { time: 5, fuel: 10 } } }.
     * @private
     */
    _calculateTravelData() {
        const travelData = {};
        const locations = DB.MARKETS;
        for (let i = 0; i < locations.length; i++) {
            travelData[locations[i].id] = {};
            for (let j = 0; j < locations.length; j++) {
                if (i === j) continue;
                const from = locations[i];
                const to = locations[j];
                const distance = Math.sqrt(
                    Math.pow(to.coords.x - from.coords.x, 2) +
                    Math.pow(to.coords.y - from.coords.y, 2) +
                    Math.pow(to.coords.z - from.coords.z, 2)
                );
                travelData[from.id][to.id] = {
                    time: Math.round(distance * DB.DATE_CONFIG.DAYS_PER_AU),
                    fuelCost: Math.round(distance * DB.DATE_CONFIG.FUEL_PER_AU),
                };
            }
        }
        return travelData;
    }

    // Direct property access through getters
    get day() { return this._state.day; }
    get currentLocationId() { return this._state.currentLocationId; }
    get activeNav() { return this._state.activeNav; }
    get activeScreen() { return this._state.activeScreen; }
    get lastActiveScreen() { return this._state.lastActiveScreen; }
    get subNavCollapsed() { return this._state.subNavCollapsed; }
    get player() { return this._state.player; }
    get market() { return this._state.market; }
    get missions() { return this._state.missions; }
    get tutorials() { return this._state.tutorials; }
    get intel() { return this._state.intel; }
    get isGameOver() { return this._state.isGameOver; }
    get introSequenceActive() { return this._state.introSequenceActive; }
    get pendingTravel() { return this._state.pendingTravel; }
    get uiState() { return this._state.uiState; }
    get TRAVEL_DATA() { return this._state.TRAVEL_DATA; }
}