// js/services/GameAttributes.js
import { LOCATION_IDS, ATTRIBUTE_TYPES, SHIP_IDS } from '../data/constants.js';
import { SHIP_DATABASE } from '../data/ship_database.js';

/**
 * @fileoverview Central registry for Game Attributes and Station Quirks.
 * This service acts as a rule engine, translating static IDs into executable game logic
 * modifiers for prices, travel costs, and event triggers.
 */

// ==========================================
// 1. DEFINITIONS (The Logic)
// ==========================================

const ATTRIBUTE_DEFINITIONS = {
    // --- Ship Attributes ---
    
    // Atlas: "Traveller: Every 20 trips, completely restore hull and fuel."
    'ATTR_TRAVELLER': {
        type: ATTRIBUTE_TYPES.TRIGGER_ON_TRAVEL,
        description: "Restores hull/fuel every 20 trips.",
        logic: (gameState, shipState) => {
            // Logic handled in TravelService
            return null; 
        }
    },

    // Vindicator: "Trader: 15% chance to receive 1 extra unit for free on purchase."
    'ATTR_TRADER': {
        type: ATTRIBUTE_TYPES.TRIGGER_ON_TRADE,
        chance: 0.15,
        description: "15% chance for +1 bonus unit.",
        // Logic handled by PlayerActionService
    },

    // Radiant: "Hot Delivery: Cargo less than 45 days old sells at 5% additional profit."
    'ATTR_HOT_DELIVERY': {
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        description: "+5% sell price for fresh cargo (<45 days).",
        value: 1.05,
        // Condition checks cargoItem age
        condition: (ctx) => ctx.cargoItem && ctx.currentDay && (ctx.currentDay - ctx.cargoItem.acquiredDay) < 45 && ctx.type === 'sell'
    },

    // Aesudon: "Resilient: Hull decays 50% slower."
    'ATTR_RESILIENT': {
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        value: 0.5,
        description: "Hull decays 50% slower."
    },

    // Pterodactyl: "Lucky: 4% increased profit from trades"
    'ATTR_LUCKY': {
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        description: "+4% profit on all trades.",
        value: 1.04,
        condition: (ctx) => ctx.type === 'sell' // Applies to selling (profit)
    },

    // Sovereign: "Corporate Partner: Cargo purchased from Earth is 5% cheaper"
    'ATTR_CORP_PARTNER': {
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        description: "5% discount on Earth purchases.",
        value: 0.95, // 5% off
        condition: (ctx) => ctx.locationId === LOCATION_IDS.EARTH && ctx.type === 'buy'
    },

    // Titan: "Cryo-Storage: Cargo older than 1 year sells for 10% more."
    'ATTR_CRYO_STORAGE': {
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        description: "+10% sell price for old cargo (>1 year).",
        value: 1.10,
        condition: (ctx) => ctx.cargoItem && ctx.currentDay && (ctx.currentDay - ctx.cargoItem.acquiredDay) > 365 && ctx.type === 'sell'
    },

    // Behemoth: "Heavy: Travel time multiplied by 1.3."
    'ATTR_HEAVY': {
        type: ATTRIBUTE_TYPES.MOD_TRAVEL_TIME,
        value: 1.3,
        description: "Travel takes 30% longer."
    },

    // Behemoth: "Loyalty: 10% discount on purchases from Saturn."
    'ATTR_LOYALTY_SATURN': {
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        description: "10% discount on Saturn purchases.",
        value: 0.90,
        condition: (ctx) => ctx.locationId === LOCATION_IDS.SATURN && ctx.type === 'buy'
    },

    // Citadel: "Renown: 15% discount on refueling."
    'ATTR_RENOWN': {
        type: ATTRIBUTE_TYPES.MOD_SERVICE_COST,
        targetService: 'refuel',
        value: 0.85,
        description: "15% discount on refueling."
    },

    // Sophistacles: "VIP: 10% better prices at The Exchange."
    'ATTR_VIP': {
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        description: "10% better prices at The Exchange.",
        value: { buy: 0.9, sell: 1.1 }, // Complex object for dual effect
        condition: (ctx) => ctx.locationId === LOCATION_IDS.EXCHANGE
    },

    // Ouroboros: "Entropic: Hull decays by 1 point per day."
    'ATTR_ENTROPIC': {
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        mode: 'flat_daily',
        value: 1,
        description: "1 hull damage per day."
    },

    // Ouroboros: "Frequent Flyer: 50% discount on hull repairs."
    'ATTR_FREQUENT_FLYER': {
        type: ATTRIBUTE_TYPES.MOD_SERVICE_COST,
        targetService: 'repair',
        value: 0.5,
        description: "50% discount on repairs."
    },

    // Thalassodromeus: "Space Folding: Navigation costs only 1 day of travel, but 1.2x fuel."
    'ATTR_SPACE_FOLDING': {
        type: ATTRIBUTE_TYPES.MOD_TRAVEL_TIME,
        description: "Travel takes 1 day, +20% fuel cost.",
    },

    // Shell That Echoes Only: "Xeno Hull: No hull decay from travel."
    'ATTR_XENO_HULL': {
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        value: 0,
        description: "No travel decay."
    },

    // Parallax of Thought: "Fuel Scoop: Restores 15% fuel after every trip."
    'ATTR_FUEL_SCOOP': {
        type: ATTRIBUTE_TYPES.TRIGGER_ON_TRAVEL,
        description: "Restores 15% fuel post-trip.",
    },

    // Anomaly of the Song: "Solar Sail: 15% chance to use no fuel at 2x travel time."
    'ATTR_SOLAR_SAIL': {
        type: ATTRIBUTE_TYPES.MOD_FUEL_COST,
        chance: 0.15,
        description: "15% chance for 0 fuel (but 2x time).",
    },

    // Causality of Silence: "Efficient: 25% reduced fuel consumption."
    'ATTR_EFFICIENT': {
        type: ATTRIBUTE_TYPES.MOD_FUEL_COST,
        value: 0.75,
        description: "25% fuel savings."
    },

    // Engine of Recursion: "Fast: Travel costs half as much time."
    'ATTR_FAST': {
        type: ATTRIBUTE_TYPES.MOD_TRAVEL_TIME,
        value: 0.5,
        description: "Travel time halved."
    },

    // Finality of Whispers: "Bespoke: Cannot be repaired."
    'ATTR_BESPOKE': {
        type: ATTRIBUTE_TYPES.RESTRICTION,
        target: 'repair',
        description: "Cannot be repaired."
    },

    // The Listener: "Advanced Comms: 25% increased chance to encounter an event."
    'ATTR_ADVANCED_COMMS': {
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        value: 1.25,
        description: "+25% event chance."
    },
    
    // Drifting Cryo-Pod: "Sleeper: Consumes no fuel, but trips take 4.5x longer."
    'ATTR_SLEEPER': {
        type: ATTRIBUTE_TYPES.MOD_FUEL_COST,
        value: 0,
        timeMod: 4.5,
        description: "No fuel cost, 4.5x travel time."
    },

    // --- Station Quirks (Examples for Future Expansion) ---
    
    // Jupiter: "Gravity Well: Fuel costs -50% (Abundant He-3)"
    'QUIRK_JUPITER_FUEL': {
        type: ATTRIBUTE_TYPES.MOD_SERVICE_COST,
        targetService: 'refuel',
        value: 0.5,
        description: "Fuel is 50% off."
    },
    
    // Venus: "Syndicate Port: Repair costs +20% (Bribes)"
    'QUIRK_VENUS_REPAIR': {
        type: ATTRIBUTE_TYPES.MOD_SERVICE_COST,
        targetService: 'repair',
        value: 1.2,
        description: "Repairs cost +20%."
    }
};

// ==========================================
// 2. MAPPINGS (Station Data)
// ==========================================

// Maps Location IDs to Station Quirk Keys
const STATION_QUIRK_MAP = {
    [LOCATION_IDS.JUPITER]: ['QUIRK_JUPITER_FUEL'],
    [LOCATION_IDS.VENUS]: ['QUIRK_VENUS_REPAIR'],
    // Add others here as we implement them programmatically
};

// ==========================================
// 3. SERVICE EXPORT (The API)
// ==========================================

export const GameAttributes = {
    /**
     * Gets all attributes associated with a specific ship ID.
     * Looks up the ship in SHIP_DATABASE and retrieves the mechanicIds array.
     * @param {string} shipId 
     * @returns {Array<string>} Array of Attribute Keys
     */
    getShipAttributes(shipId) {
        const ship = SHIP_DATABASE[shipId];
        return ship && ship.mechanicIds ? ship.mechanicIds : [];
    },

    /**
     * Gets all quirks associated with a specific location.
     * @param {string} locationId 
     * @returns {Array<string>} Array of Quirk Keys
     */
    getStationQuirks(locationId) {
        return STATION_QUIRK_MAP[locationId] || [];
    },

    /**
     * Calculates the modifier for service costs (Refuel/Repair).
     * Combines Ship Attributes AND Station Quirks.
     * @param {string} shipId 
     * @param {string} locationId 
     * @param {string} serviceType 'refuel' or 'repair'
     * @returns {number} The price multiplier (e.g., 0.5 for 50% off)
     */
    getServiceCostModifier(shipId, locationId, serviceType) {
        let modifier = 1.0;

        // Check Ship Attributes
        const shipAttrs = this.getShipAttributes(shipId);
        shipAttrs.forEach(key => {
            const def = ATTRIBUTE_DEFINITIONS[key];
            if (def && def.type === ATTRIBUTE_TYPES.MOD_SERVICE_COST && def.targetService === serviceType) {
                modifier *= def.value;
            }
        });

        // Check Station Quirks
        const stationQuirks = this.getStationQuirks(locationId);
        stationQuirks.forEach(key => {
            const def = ATTRIBUTE_DEFINITIONS[key];
            if (def && def.type === ATTRIBUTE_TYPES.MOD_SERVICE_COST && def.targetService === serviceType) {
                modifier *= def.value;
            }
        });

        return modifier;
    },

    /**
     * Calculates the travel fuel cost modifier for a ship.
     * @param {string} shipId 
     * @returns {number} Multiplier (e.g., 0.75 for 25% off)
     */
    getFuelCostModifier(shipId) {
        let modifier = 1.0;
        const shipAttrs = this.getShipAttributes(shipId);
        
        shipAttrs.forEach(key => {
            const def = ATTRIBUTE_DEFINITIONS[key];
            if (def && def.type === ATTRIBUTE_TYPES.MOD_FUEL_COST) {
                if (typeof def.value === 'number') {
                     modifier *= def.value;
                }
            }
        });
        
        return modifier;
    },

    /**
     * Calculates the price modifier for a trade transaction.
     * @param {string} shipId - Active Ship ID
     * @param {string} locationId - Current Location
     * @param {string} transactionType - 'buy' or 'sell'
     * @param {object} contextData - Extra data { cargoItem, currentDay, commodityId }
     * @returns {number} Price multiplier (e.g., 0.95 for 5% discount)
     */
    getPriceModifier(shipId, locationId, transactionType, contextData = {}) {
        let modifier = 1.0;
        const shipAttrs = this.getShipAttributes(shipId);
        const ctx = { locationId, type: transactionType, ...contextData };

        shipAttrs.forEach(key => {
            const def = ATTRIBUTE_DEFINITIONS[key];
            if (def && def.type === ATTRIBUTE_TYPES.MOD_PRICE) {
                // If the definition has a 'condition' function, verify it passes
                if (def.condition && !def.condition(ctx)) {
                    return;
                }

                // Apply value
                if (typeof def.value === 'number') {
                    modifier *= def.value;
                } else if (typeof def.value === 'object') {
                    // Handle complex values like { buy: 0.9, sell: 1.1 }
                    if (def.value[transactionType]) {
                        modifier *= def.value[transactionType];
                    }
                }
            }
        });

        return modifier;
    },

    /**
     * Returns the definition object for a specific key.
     * Useful for UI rendering (tooltips/descriptions).
     * @param {string} key 
     */
    getDefinition(key) {
        return ATTRIBUTE_DEFINITIONS[key];
    }
};