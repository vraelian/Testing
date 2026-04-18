// js/data/constants.js
/** //////////////////    VERSION INFO    ///////////////////  */
export const APP_VERSION = '37.78';
export const APP_FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeVqjUEC6nsZlxTQ9-vzz0_fHO0ng8w0AueZaGzkHPoLJIBDA/viewform?usp=header';
/** /////////////////////////////////////////////////////////  */

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
    MERCURY: 'loc_mercury',
    SUN: 'loc_sun',
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
 * Defines the orbital order from the Sun (Index 0) outwards.
 * Used for "Solar Harmony" calculations and Blockade Redirects.
 */
export const ORBITAL_ORDER = [
    LOCATION_IDS.SUN,
    LOCATION_IDS.MERCURY,
    LOCATION_IDS.VENUS,
    LOCATION_IDS.EARTH,
    LOCATION_IDS.LUNA,
    LOCATION_IDS.MARS,
    LOCATION_IDS.BELT,
    LOCATION_IDS.EXCHANGE,
    LOCATION_IDS.JUPITER,
    LOCATION_IDS.SATURN,
    LOCATION_IDS.URANUS,
    LOCATION_IDS.NEPTUNE,
    LOCATION_IDS.KEPLER,
    LOCATION_IDS.PLUTO
];

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
    INTRO_BUY_SHIP: 'intro-buy-ship',
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
    MOD_FUEL_BURN: 'MOD_FUEL_BURN',     // Modifies fuel consumption (Travel)
    MOD_FUEL_PRICE: 'MOD_FUEL_PRICE',   // Modifies fuel cost (Station)
    MOD_TRAVEL_TIME: 'MOD_TRAVEL_TIME', // Modifies travel duration
    MOD_HULL_DECAY: 'MOD_HULL_DECAY',   // Modifies passive or active hull decay
    MOD_SERVICE_COST: 'MOD_SERVICE_COST', // Modifies repair/refuel costs
    TRIGGER_ON_TRAVEL: 'TRIGGER_ON_TRAVEL', // Triggered after a trip
    TRIGGER_ON_TRADE: 'TRIGGER_ON_TRADE',   // Triggered after a trade
    PASSIVE_EFFECT: 'PASSIVE_EFFECT',   // Generic passive tag
    RESTRICTION: 'RESTRICTION'          // Prevents actions (e.g. Bespoke)
});

// --- [[START]] VIRTUAL WORKBENCH: SHIP UPGRADE SYSTEM (Phase 1) ---
export const UPGRADE_TYPES = Object.freeze({
    MOD_TRAVEL_SPEED: 'MOD_TRAVEL_SPEED',       // Engine Mods
    MOD_FUEL_BURN: 'MOD_FUEL_BURN',             // Engine Mods (Penalty) - Travel Consumption
    MOD_FUEL_PRICE: 'MOD_FUEL_PRICE',           // Fuel Pass (Bonus) - Station Price
    MOD_BUY_PRICE: 'MOD_BUY_PRICE',             // Signal Hacker
    MOD_SELL_PRICE: 'MOD_SELL_PRICE',           // Guild Badge
    MOD_MAX_HULL: 'MOD_MAX_HULL',               // Hull Armor
    MOD_MAX_FUEL: 'MOD_MAX_FUEL',               // Aux Tank
    MOD_MAX_CARGO: 'MOD_MAX_CARGO',             // Aux Storage
    MOD_EVENT_CHANCE: 'MOD_EVENT_CHANCE',       // Radar Mod
    MOD_REPAIR_COST: 'MOD_REPAIR_COST',         // Repair Pass
    MOD_PASSIVE_REPAIR: 'MOD_PASSIVE_REPAIR',   // Nano Machines
    MOD_DEBT_INTEREST: 'MOD_DEBT_INTEREST'      // Syndicate Badge
});

// VIRTUAL WORKBENCH: Explicit Hex Codes required for gradient calculations
export const UPGRADE_COLORS = Object.freeze({
    BLUE: '#3b82f6',    // Tailwind Blue 500
    CYAN: '#06b6d4',    // Tailwind Cyan 500
    GREEN: '#22c55e',   // Tailwind Green 500
    GOLD: '#eab308',    // Tailwind Yellow 500
    GREY: '#94a3b8',    // Tailwind Slate 400
    INDIGO: '#6366f1',  // Tailwind Indigo 500
    EMERALD: '#10b981', // Tailwind Emerald 500
    SEAFOAM: '#14b8a6', // Tailwind Teal 500
    ORANGE: '#f97316',  // Tailwind Orange 500
    RED: '#ef4444',     // Tailwind Red 500
    VIOLET: '#8b5cf6'   // Tailwind Violet 500
});

// --- V4 SAVE SYSTEM: SMART ARRAY UNION DEFINITIONS ---
export const UNION_ARRAYS = [
    'unlockedLocationIds', 
    'unlockedLicenseIds', 
    'seenEvents', 
    'seenCommodityMilestones', 
    'seenBatchIds', 
    'skippedTutorialBatches', 
    'officerRoster'
];

// --- [[START]] EVENT SYSTEM 2.0 ---
/**
 * Core constants for the Random Event Engine v2.0.
 * Defines standard tags, condition logic, and outcome resolution types.
 */
export const EVENT_CONSTANTS = Object.freeze({
    // Tags allow the engine to filter events by context (Where are we?)
    TAGS: {
        SPACE: 'TAG_SPACE',       // Deep space travel
        ORBIT: 'TAG_ORBIT',       // In orbit of a planet
        STATION: 'TAG_STATION',   // Docked at a station
        HAZARD: 'TAG_HAZARD',     // Dangerous sectors (e.g. Belt)
        SAFE: 'TAG_SAFE',         // Safe sectors (e.g. Earth/Luna)
        ALIEN: 'TAG_ALIEN',       // Xeno interactions
        TRADE: 'TAG_TRADE',       // Economic opportunities
        COMBAT: 'TAG_COMBAT'      // Hostile encounters
    },

    // Condition Types define "Can this happen?" or "Can I choose this?"
    CONDITIONS: {
        // Resource Checks
        HAS_FUEL: 'COND_HAS_FUEL',
        HAS_CREDITS: 'COND_HAS_CREDITS',
        HAS_HULL: 'COND_HAS_HULL',
        HAS_CARGO_SPACE: 'COND_HAS_CARGO_SPACE',
        HAS_USED_CARGO_SPACE: 'COND_HAS_USED_CARGO_SPACE', // Event System 3.0
        HAS_ITEM: 'COND_HAS_ITEM',
        
        // Player State Checks
        HAS_PERK: 'COND_HAS_PERK',
        HAS_SHIP_CLASS: 'COND_HAS_SHIP_CLASS', // e.g. "Must be Class A"
        WEALTH_TIER: 'COND_WEALTH_TIER',       // e.g. "Must be Tier 3+"
        
        // Global/World Checks
        LOCATION_IS: 'COND_LOCATION_IS',       // Specific location check
        RNG_ROLL: 'COND_RNG_ROLL'              // Flat probability check (0-1)
    },

    // Resolvers define HOW an outcome is selected
    RESOLVERS: {
        WEIGHTED_RNG: 'RESOLVER_WEIGHTED',     // Standard "Dice Roll"
        STAT_CHECK: 'RESOLVER_STAT_CHECK',     // Skill/Stat vs Threshold
        DETERMINISTIC: 'RESOLVER_FIXED'        // Always happens (100%)
    },
    
    // Effect Types define WHAT happens (The output)
    EFFECTS: {
        MODIFY_CREDITS: 'EFF_CREDITS',
        MODIFY_FUEL: 'EFF_FUEL',
        MODIFY_HULL: 'EFF_HULL',
        MODIFY_DEBT: 'EFF_DEBT',
        ADD_ITEM: 'EFF_ADD_ITEM',
        REMOVE_ITEM: 'EFF_REMOVE_ITEM',
        MODIFY_TRAVEL: 'EFF_MODIFY_TRAVEL',    // Change travel time/dest
        UNLOCK_INTEL: 'EFF_UNLOCK_INTEL',      // Give market data
        TRIGGER_FOLLOWUP: 'EFF_TRIGGER_EVENT', // Chain another event
        LOSE_RANDOM_CARGO: 'EFF_LOSE_RANDOM_CARGO', // Specific logic
        ADD_RANDOM_CARGO: 'EFF_ADD_RANDOM_CARGO', // Specific logic
        ADD_UPGRADE: 'EFF_ADD_UPGRADE', // Grants a specific ship upgrade
        FULL_REFUEL: 'EFF_FULL_REFUEL',  // Sets active ship fuel to 100%
        REDIRECT_TRAVEL: 'EFF_REDIRECT_TRAVEL', // Diverts travel to an intermediate or origin location
        APPLY_STATUS: 'EFF_APPLY_STATUS', // Applies a lingering debuff to the ship
        QUEUE_EVENT: 'EFF_QUEUE_EVENT' // Pushes an untelegraphed event into the FIFO trip queue
    }
});
// --- [[END]] EVENT SYSTEM 2.0 ---

/**
 * Status Effects Registry
 * Defines lingering debuffs applied to ships via events with specific duration ranges.
 */
export const STATUS_EFFECTS = Object.freeze({
    MICRO_FRACTURES: { 
        id: 'status_micro_fractures', 
        name: 'Micro-Fractures', 
        description: 'Base hull decay rate during travel is increased by 20%.', 
        gradientClasses: 'bg-gradient-to-r from-red-900 to-orange-500 border-red-500 text-white' 
    },
    PLASMA_LEAK: { 
        id: 'status_plasma_leak', 
        name: 'Plasma Leak', 
        description: 'Fuel consumption rate increased by 25%.', 
        gradientClasses: 'bg-gradient-to-r from-yellow-300 to-orange-600 border-orange-400 text-black' 
    },
    NAV_COMPUTER_GLITCH: { 
        id: 'status_nav_glitch', 
        name: 'Nav-Computer Glitch', 
        description: 'Travel times randomly fluctuate by +1 to +5 days per jump.', 
        gradientClasses: 'bg-gradient-to-r from-cyan-400 to-indigo-900 border-cyan-300 text-white' 
    },
    THRUST_VECTORING_IMBALANCE: { 
        id: 'status_thrust_imbalance', 
        name: 'Thrust Vectoring Imbalance', 
        description: 'Base travel time across the board increased by 20%.', 
        gradientClasses: 'bg-gradient-to-r from-slate-500 to-red-800 border-slate-400 text-white' 
    },
    CONTAMINATED_FUEL_LINES: { 
        id: 'status_contaminated_fuel', 
        name: 'Contaminated Fuel Lines', 
        description: 'Fuel tank cannot be filled past 50% capacity at stations. Refueling disabled if over 50%.', 
        gradientClasses: 'bg-gradient-to-r from-green-500 to-amber-900 border-green-400 text-white' 
    },
    CORPORATE_BLACKLIST: { 
        id: 'status_corporate_blacklist', 
        name: 'Corporate Blacklist', 
        description: 'Increased chance of Guild audits, customs searches, and corporate cordons.', 
        gradientClasses: 'bg-gradient-to-r from-black to-yellow-500 border-yellow-500 text-white' 
    },
    SERVICE_SURCHARGES: { 
        id: 'status_service_surcharges', 
        name: 'Service Surcharges', 
        description: 'All station service costs (Refuel, Repair) are tripled.', 
        gradientClasses: 'bg-gradient-to-r from-white to-blue-200 border-blue-400 text-blue-900' 
    },
    REVOKED_CLEARANCE: { 
        id: 'status_revoked_clearance', 
        name: 'Revoked Clearance', 
        description: 'Cannot purchase Intel Deals while active.', 
        gradientClasses: 'bg-gradient-to-r from-red-600 to-slate-800 border-red-500 text-white' 
    }
});

/**
 * A collection of core game balance numbers and rules.
 */
export const GAME_RULES = Object.freeze({
    STARTING_CREDITS: 6000,
    STARTING_DEBT_INTEREST: 125,
    REPAIR_COST_PER_HP: 75,
    REPAIR_AMOUNT_PER_TICK: 5,
    FUEL_SCALAR: 2.5, 
    INTEREST_INTERVAL: 30,
    PASSIVE_REPAIR_RATE: 0.02,
    HULL_DECAY_PER_TRAVEL_DAY: (1 / 7) * 1.0605, // Increased base decay rate by 5%
    SHIP_SELL_MODIFIER: 0.75,
    RARE_SHIP_CHANCE: 0.3,
    PRICE_HISTORY_LENGTH: 65,
    FINANCE_HISTORY_LENGTH: 25,
    DAILY_PRICE_VOLATILITY: 0.25,
    MEAN_REVERSION_STRENGTH: 0.025, // Updated for Balance V2 (Stretched recovery)
    MARKET_PRESSURE_DECAY: 0.985,   // Updated for Balance V3 (Supply-tethered slow-burn fallback)
    LOCAL_PRICE_MOD_STRENGTH: 0.5,
    LOAN_GARNISHMENT_DAYS: 1095,
    LOAN_GARNISHMENT_PERCENT: 0.14,
    RANDOM_EVENT_CHANCE: 0.15, 
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