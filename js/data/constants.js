// js/data/constants.js
/**
 * @fileoverview This file contains centralized constant values and enumerations used throughout the game.
 * Consolidating these values here makes the codebase easier to manage, read, and modify, as it provides
 * a single source of truth for frequently used identifiers and game balance numbers.
 */

/**
 * Unique identifiers for each primary screen in the game's UI.
 * @enum {string}
 */
export const SCREEN_IDS = Object.freeze({
    MAP: 'map',
    NAVIGATION: 'navigation',
    SERVICES: 'services',
    MARKET: 'market',
    CARGO: 'cargo',
    HANGAR: 'hangar',
    MISSIONS: 'missions',
    FINANCE: 'finance',
    INTEL: 'intel',
});

/**
 * Unique identifiers for the main navigation tabs.
 * @enum {string}
 */
export const NAV_IDS = Object.freeze({
    SHIP: 'ship',
    STARPORT: 'starport',
    DATA: 'data',
});

// --- [[START]] VIRTUAL WORKBENCH (Phase 2) ---
/**
 * Unique identifiers for each type of ship available in the game.
 * Values are mapped to the 'GAME ID' column from the ship database.
 * @enum {string}
 */
export const SHIP_IDS = Object.freeze({
    WANDERER: 'Wanderer.Ship',
    STALWART: 'Stalwart.Ship',
    MULE: 'Mule.Ship',
    PATHFINDER: 'Pathfinder.Ship',
    NOMAD: 'Nomad.Ship',
    VINDICATOR: 'Vindicator.Ship',
    AEGIS: 'Aegis.Ship',
    ODYSSEY: 'Odyssey.Ship',
    MAJESTIC: 'luxury_s2', // Obsolete
    TITAN_HAULER: 'Titan.Ship',
    VOID_CHASER: 'rare_s2', // Obsolete
    GUARDIAN: 'Guardian.Ship',
    STARGAZER: 'rare_s4', // Obsolete
    BEHEMOTH: 'Behemoth.Ship',
});
// --- [[END]] VIRTUAL WORKBENCH (Phase 2) ---

/**
 * Unique identifiers for each type of commodity that can be traded.
 * @enum {string}
 */
export const COMMODITY_IDS = Object.freeze({
    WATER_ICE: 'water_ice',
    PLASTEEL: 'plasteel',
    HYDROPONICS: 'hydroponics',
    CYBERNETICS: 'cybernetics',
    PROPELLANT: 'propellant',
    PROCESSORS: 'processors',
    GRAPHENE_LATTICES: 'graphene_lattices',
    CRYO_PODS: 'cryo_pods',
    ATMO_PROCESSORS: 'atmos_processors',
    CLONED_ORGANS: 'cloned_organs',
    XENO_GEOLOGICALS: 'xeno_geologicals',
    SENTIENT_AI: 'sentient_ai',
    ANTIMATTER: 'antimatter',
    FOLDED_DRIVES: 'folded_drives',
});

/**
 * Unique identifiers for each travel destination (market location).
 * @enum {string}
 */
export const LOCATION_IDS = Object.freeze({
    EARTH: 'loc_earth',
    LUNA: 'loc_luna',
    MARS: 'loc_mars',
    VENUS: 'loc_venus',
    BELT: 'loc_belt',
    SATURN: 'loc_saturn',
    JUPITER: 'loc_jupiter',
    URANUS: 'loc_uranus',
    NEPTUNE: 'loc_neptune',
    PLUTO: 'loc_pluto',
    EXCHANGE: 'loc_exchange',
    KEPLER: 'loc_kepler',
});

/**
 * Unique identifiers for player perks, which provide passive bonuses.
 * @enum {string}
 */
export const PERK_IDS = Object.freeze({
    TRADEMASTER: 'trademaster',
    NAVIGATOR: 'navigator',
    VENETIAN_SYNDICATE: 'venetian_syndicate',
    MERCHANT_GUILD_SHIP: 'merchant_guild_ship',
});

/**
 * Unique identifiers for actions triggered by user interaction with UI elements.
 * These are typically assigned to `data-action` attributes in the HTML.
 * @enum {string}
 */
export const ACTION_IDS = Object.freeze({
    DEBUG_SIMPLE_START: 'debug-simple-start',
    SET_SCREEN: 'set-screen',
    TRAVEL: 'travel',
    BUY_SHIP: 'buy-ship',
    SELL_SHIP: 'sell-ship',
    SELECT_SHIP: 'select-ship',
    PAY_DEBT: 'pay-debt',
    TAKE_LOAN: 'take-loan',
    PURCHASE_INTEL: 'purchase-intel',
    ACQUIRE_LICENSE: 'acquire-license',
    BUY_ITEM: 'buy-item',
    SELL_ITEM: 'sell-item',
    SET_MAX_BUY: 'set-max-buy',
    SET_MAX_SELL: 'set-max-sell',
    INCREMENT: 'increment',
    DECREMENT: 'decrement',
    SHOW_PRICE_GRAPH: 'show-price-graph',
    SHOW_FINANCE_GRAPH: 'show-finance-graph',
    TOGGLE_MARKET_CARD_VIEW: 'toggle-market-card-view',
    TOGGLE_HANGAR_MODE: 'toggle-hangar-mode',
    SET_HANGAR_PAGE: 'set-hangar-page',
});

/**
 * Defines the types of conditions that can trigger or complete a tutorial step.
 * @enum {string}
 */
export const TUTORIAL_ACTION_TYPES = Object.freeze({
    SCREEN_LOAD: 'SCREEN_LOAD',
    ACTION: 'ACTION',
    INFO: 'INFO',
});

/**
 * Defines the categories of game attribute effects.
 * Used by GameAttributes.js to classify logic.
 * @enum {string}
 */
export const ATTRIBUTE_TYPES = Object.freeze({
    MOD_PRICE: 'MOD_PRICE',             // Modifies buy/sell prices
    MOD_FUEL_COST: 'MOD_FUEL_COST',     // Modifies fuel consumption
    MOD_TRAVEL_TIME: 'MOD_TRAVEL_TIME', // Modifies travel duration
    MOD_HULL_DECAY: 'MOD_HULL_DECAY',   // Modifies passive or active hull decay
    MOD_SERVICE_COST: 'MOD_SERVICE_COST', // Modifies repair/refuel costs
    TRIGGER_ON_TRAVEL: 'TRIGGER_ON_TRAVEL', // Triggered after a trip
    TRIGGER_ON_TRADE: 'TRIGGER_ON_TRADE',   // Triggered after a trade
    PASSIVE_EFFECT: 'PASSIVE_EFFECT',   // Generic passive tag
    RESTRICTION: 'RESTRICTION'          // Prevents actions (e.g. Bespoke)
});

/**
 * A collection of core game balance numbers and rules.
 */
export const GAME_RULES = Object.freeze({
    STARTING_CREDITS: 5000,
    STARTING_DEBT_INTEREST: 125,
    REPAIR_COST_PER_HP: 75,
    REPAIR_AMOUNT_PER_TICK: 5,
    FUEL_SCALAR: 3,
    INTEREST_INTERVAL: 30,
    PASSIVE_REPAIR_RATE: 0.02,
    HULL_DECAY_PER_TRAVEL_DAY: 1 / 7,
    SHIP_SELL_MODIFIER: 0.75,
    RARE_SHIP_CHANCE: 0.3,
    PRICE_HISTORY_LENGTH: 65,
    FINANCE_HISTORY_LENGTH: 25,
    DAILY_PRICE_VOLATILITY: 0.25,
    MEAN_REVERSION_STRENGTH: 0.04,
    MARKET_PRESSURE_DECAY: 0.70,
    LOCAL_PRICE_MOD_STRENGTH: 0.5,
    LOAN_GARNISHMENT_DAYS: 1095,
    LOAN_GARNISHMENT_PERCENT: 0.14,
    RANDOM_EVENT_CHANCE: 0.07,
});

/**
 * Defines the wealth milestones that trigger the reveal of new commodity tiers.
 */
export const WEALTH_MILESTONES = [
    { threshold: 50000, revealsTier: 2 },
    { threshold: 450000, revealsTier: 3 },
    { threshold: 4000000, revealsTier: 4 },
    { threshold: 35000000, revealsTier: 5 },
    { threshold: 300000000, revealsTier: 6 },
    { threshold: 2500000000, revealsTier: 7 }
];

/**
 * The key used to store and retrieve the game state from the browser's localStorage.
 * @type {string}
 */
export const SAVE_KEY = 'orbitalTraderSave_v2';