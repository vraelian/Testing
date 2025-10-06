// js/services/GameState.js
/**
 * @fileoverview Manages the application's state, providing a single source of truth.
 * Adheres to a unidirectional data flow model: state is updated, then subscribers are notified to re-render.
 */
import { DB } from '../data/database.js';
import { DATE_CONFIG } from '../data/database.js';
import { LOCATION_IDS, SHIP_IDS, COMMODITY_IDS, GAME_RULES } from '../data/constants.js';

class GameState {
    constructor() {
        this.state = this.getInitialState();
        this.subscribers = [];
        this.gameStateHistory = [];
        this.maxHistoryLength = 50;
    }

    getInitialState() {
        return {
            player: {
                name: null,
                credits: 25000,
                debt: 25000,
                locationId: LOCATION_IDS.MARS,
                perks: [],
                title: 'Captain',
                licenses: [],
                wealthMilestone: 0,
                ships: [],
                activeShipId: null,
                totalDistanceTraveled: 0
            },
            gameDate: {
                day: 1,
                month: 1,
                year: DATE_CONFIG.START_YEAR
            },
            market: {},
            log: [],
            activeModals: [],
            isTraveling: false,
            travelData: null,
            currentLocation: DB.MARKETS.find(m => m.id === LOCATION_IDS.MARS),
            activeShip: null,
            activeInventory: {},
            lastRandomEventDay: 0,
            activeMissions: {},
            completedMissions: [],
            logHistory: [],
            systemState: {
                currentState: 'NEUTRAL',
                daysRemaining: 28,
                history: ['NEUTRAL']
            },
            intel: [],
            ui: {
                activeNavId: 'starport',
                activeScreenId: 'hangar',
                isModalOpen: false,
                isContextMenuOpen: false,
                contextMenu: {},
                activeSystemSurgeEffect: null,
                isSidebarCollapsed: false,
            },
            settings: {
                disableRandomEvents: false,
                autoSave: true,
            },
            tutorial: {
                isActive: true,
                currentBatch: 'intro_hangar',
                currentStepId: 'hangar_1',
                completedBatches: []
            },
        };
    }

    /**
     * Subscribes a listener function to state changes.
     * @param {Function} callback - The function to call when the state changes.
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /**
     * Notifies all subscribers of a state change.
     * @private
     */
    _notify() {
        this.subscribers.forEach(callback => callback(this.state));
    }

    /**
     * Updates the state and notifies subscribers. This is the primary method for state mutation.
     * @param {Partial<GameState['state']>} newState - An object representing the part of the state to update.
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this._notify();
    }

    /**
     * Retrieves the current state.
     * @returns {GameState['state']} The current game state.
     */
    getState() {
        return this.state;
    }

    /**
     * Retrieves a specific ship by its ID.
     * @param {string} shipId - The ID of the ship to retrieve.
     * @returns {object | undefined} The ship object or undefined if not found.
     */
    getShipById(shipId) {
        return DB.SHIPS[shipId];
    }

    /**
     * Retrieves a specific market by its ID.
     * @param {string} locationId - The ID of the location.
     * @returns {object | undefined} The market object or undefined if not found.
     */
    getMarketById(locationId) {
        return DB.MARKETS.find(market => market.id === locationId);
    }

    /**
     * Retrieves a specific commodity by its ID.
     * @param {string} goodId - The ID of the commodity.
     * @returns {object | undefined} The commodity object or undefined if not found.
     */
    getCommodityById(goodId) {
        return DB.COMMODITIES.find(g => g.id === goodId);
    }

    /**
     * Retrieves a specific mission by its ID.
     * @param {string} missionId - The ID of the mission.
     * @returns {object | undefined} The mission object or undefined if not found.
     */
    getMissionById(missionId) {
        return DB.MISSIONS[missionId];
    }

    /**
     * Adds a log entry to the game's log history.
     * @param {string} message - The message to log.
     * @param {string} [type='info'] - The type of log entry (e.g., 'info', 'warning', 'success').
     */
    addLog(message, type = 'info') {
        const timestamp = this.getFormattedDate();
        const newLog = { timestamp, message, type, id: Date.now() }; // Add unique ID
        const logHistory = [newLog, ...this.state.logHistory.slice(0, 99)]; // Keep log to 100 entries
        this.setState({ logHistory });
    }

    /**
     * Generates travel data between two locations.
     * Incorporates new logic for travel zones.
     * @param {string} fromLocationId - The starting location ID.
     * @param {string} toLocationId - The destination location ID.
     * @returns {{time: number, fuel: number, hullDecay: number, distance: number}} - The calculated travel data.
     */
    procedurallyGenerateTravelData(fromLocationId, toLocationId) {
        const fromMarket = this.getMarketById(fromLocationId);
        const toMarket = this.getMarketById(toLocationId);

        if (!fromMarket || !toMarket) {
            console.error("Invalid location ID provided for travel data generation.");
            return { time: 0, fuel: 0, hullDecay: 0, distance: 0 };
        }

        const innerSphere = [LOCATION_IDS.EARTH, LOCATION_IDS.LUNA, LOCATION_IDS.MARS, LOCATION_IDS.BELT];
        const outerReaches = [LOCATION_IDS.URANUS, LOCATION_IDS.NEPTUNE, LOCATION_IDS.PLUTO, LOCATION_IDS.EXCHANGE];

        const isInInnerSphere = (id) => innerSphere.includes(id);
        const isInOuterReaches = (id) => outerReaches.includes(id);

        let distance = Math.abs(DB.MARKETS.indexOf(fromMarket) - DB.MARKETS.indexOf(toMarket)) * 10;
        let timeMultiplier = 3.5;
        let fuelMultiplier = GAME_RULES.FUEL_SCALAR;

        // Adjust multipliers based on travel zones
        if (isInInnerSphere(fromLocationId) && isInInnerSphere(toLocationId)) {
            timeMultiplier = 2.8; // Faster travel within the core
            fuelMultiplier *= 0.9;
        } else if (isInOuterReaches(fromLocationId) || isInOuterReaches(toLocationId)) {
            timeMultiplier = 4.5; // Slower travel to/from the outer reaches
            fuelMultiplier *= 1.2;
        }

        // Special case for Earth-Luna quick trip
        if ((fromLocationId === LOCATION_IDS.EARTH && toLocationId === LOCATION_IDS.LUNA) ||
            (fromLocationId === LOCATION_IDS.LUNA && toLocationId === LOCATION_IDS.EARTH)) {
            distance = 2;
            timeMultiplier = 1.5;
        }

        const baseTime = Math.round(distance * timeMultiplier) + 1;
        const time = Math.max(1, baseTime + Math.floor(Math.random() * 5) - 2); // Add some variance

        const baseFuel = Math.round(distance * fuelMultiplier);
        const fuel = Math.max(5, baseFuel);

        const hullDecay = Math.max(1, Math.ceil(distance / 20));

        return { time, fuel, hullDecay, distance };
    }

    /**
     * Formats the current game date into a readable string.
     * @returns {string} The formatted date string (e.g., "Jan 1, 2140").
     */
    getFormattedDate() {
        const { day, month, year } = this.state.gameDate;
        const monthName = DATE_CONFIG.MONTH_NAMES[month - 1].substring(0, 3);
        return `${monthName} ${day}, ${year}`;
    }

    /**
     * Formats the current game date with the day of the week.
     * @returns {string} The formatted date string (e.g., "Monday, Jan 1, 2140").
     */
    getFormattedDateWithDay() {
        const { day, month, year } = this.state.gameDate;
        const date = new Date(year, month - 1, day);
        const dayName = DATE_CONFIG.DAY_NAMES[date.getDay()];
        const monthName = DATE_CONFIG.MONTH_NAMES[month - 1];
        return `${dayName}, ${monthName} ${day}, ${year}`;
    }
}

export default new GameState();