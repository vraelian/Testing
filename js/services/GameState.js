// js/services/GameState.js
import { GAME_RULES, SAVE_KEY, SHIP_IDS, LOCATION_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';
import { DB } from '../data/database.js';
import { skewedRandom } from '../utils.js';

/**
 * Procedurally generates the travel data matrix, calculating the time and fuel cost
 * for travel between every pair of locations in the game.
 * @param {Array<object>} markets - The array of market objects from the database.
 * @returns {object} A nested object where `travelData[fromId][toId]` contains travel info.
 */
function procedurallyGenerateTravelData(markets) {
    const travelData = {};
    markets.forEach((fromMarket, i) => {
        travelData[fromMarket.id] = {};
        markets.forEach((toMarket, j) => {
            if (i === j) return;
            // Simple index difference is used as a proxy for orbital distance.
            const distance = Math.abs(i - j);
            const fuelTime = distance * 2 + Math.floor(Math.random() * 3);
            let fuelCost = Math.round(fuelTime * GAME_RULES.FUEL_SCALAR * (1 + (j / markets.length) * 0.5));
            let travelTime;
            // Special case for Earth-Luna to make it a quick, early-game trip.
            if ((fromMarket.id === LOCATION_IDS.EARTH && toMarket.id === LOCATION_IDS.LUNA) || (fromMarket.id === LOCATION_IDS.LUNA && toMarket.id === LOCATION_IDS.EARTH)) {
                travelTime = 1 + Math.floor(Math.random() * 3);
            } else {
                travelTime = 15 + (distance * 10) + Math.floor(Math.random() * 5);
            }
            travelData[fromMarket.id][toMarket.id] = { time: travelTime, fuelCost: Math.max(1, fuelCost) };
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
            introSequenceActive: true,
            lastActiveScreen: {
                [NAV_IDS.SHIP]: SCREEN_IDS.STATUS,
                [NAV_IDS.STARPORT]: SCREEN_IDS.MARKET,
                [NAV_IDS.ADMIN]: SCREEN_IDS.MISSIONS,
            },
            pendingTravel: null,
            player: {
                name: playerName, playerTitle: 'Captain', playerAge: 24, lastBirthdayYear: DB.DATE_CONFIG.START_YEAR, birthdayProfitBonus: 0,
                introStep: 0,
                credits: 3000, debt: 0, monthlyInterestAmount: 0,
                loanStartDate: null, seenGarnishmentWarning: false,
                unlockedCommodityLevel: 1, unlockedLocationIds: [LOCATION_IDS.EARTH, LOCATION_IDS.LUNA, LOCATION_IDS.MARS, LOCATION_IDS.VENUS, LOCATION_IDS.BELT, LOCATION_IDS.SATURN],
                seenCommodityMilestones: [], financeLog: [],
                activePerks: {}, seenEvents: [], activeShipId: SHIP_IDS.WANDERER, ownedShipIds: [SHIP_IDS.WANDERER],
                shipStates: { [SHIP_IDS.WANDERER]: { health: DB.SHIPS[SHIP_IDS.WANDERER].maxHealth, fuel: DB.SHIPS[SHIP_IDS.WANDERER].maxFuel, hullAlerts: { one: false, two: false } } },
                inventories: { },
                debugEventIndex: 0
            },
            market: { prices: {}, inventory: {}, galacticAverages: {}, priceHistory: {}, shipyardStock: {} },
            intel: { active: null, available: {} },
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
            }
        };

        initialState.player.inventories[SHIP_IDS.WANDERER] = {};
        DB.COMMODITIES.forEach(c => { initialState.player.inventories[SHIP_IDS.WANDERER][c.id] = { quantity: 0, avgCost: 0 }; });

        DB.MARKETS.forEach(m => {
            initialState.market.priceHistory[m.id] = {};
            initialState.intel.available[m.id] = (Math.random() < 0.3);
            initialState.market.inventory[m.id] = {};
            initialState.market.shipyardStock[m.id] = { day: 0, shipsForSale: [] };
            DB.COMMODITIES.forEach(c => {
                initialState.market.priceHistory[m.id][c.id] = [];
                const avail = this._getTierAvailability(c.tier);
                let quantity = skewedRandom(avail.min, avail.max);
                if (m.modifiers[c.id] && m.modifiers[c.id] > 1.0) quantity = Math.floor(quantity * 1.5);
                if (m.specialDemand && m.specialDemand[c.id]) quantity = 0;
                initialState.market.inventory[m.id][c.id] = { quantity: Math.max(0, quantity) };
            });
        });

        Object.assign(this, initialState);
        this._calculateGalacticAverages();
        this._seedInitialMarketPrices();
        this.setState({});
    }

    /**
     * Returns the minimum and maximum potential stock for a commodity based on its tier.
     * Higher tier commodities are rarer.
     * @param {number} tier - The tier of the commodity.
     * @returns {{min: number, max: number}} An object with min and max stock values.
     * @private
     */
    _getTierAvailability(tier) {
        switch (tier) {
            case 1: return { min: 6, max: 240 };
            case 2: return { min: 4, max: 200 };
            case 3: return { min: 3, max: 120 };
            case 4: return { min: 2, max: 40 };
            case 5: return { min: 1, max: 20 };
            case 6: return { min: 0, max: 20 };
            case 7: return { min: 0, max: 10 };
            default: return { min: 0, max: 5 };
        }
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
     * Prices are based on the galactic average with randomness and location-specific modifiers applied.
     * @private
     */
    _seedInitialMarketPrices() {
        DB.MARKETS.forEach(location => {
            this.market.prices[location.id] = {};
            DB.COMMODITIES.forEach(good => {
                let price = this.market.galacticAverages[good.id] * (1 + (Math.random() - 0.5) * 0.5);
                price *= (location.modifiers[good.id] || 1.0);
                this.market.prices[location.id][good.id] = Math.max(1, Math.round(price));
            });
        });
    }
}