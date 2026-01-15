// js/services/GameAttributes.js
import { LOCATION_IDS, UPGRADE_TYPES, UPGRADE_COLORS, ATTRIBUTE_TYPES } from '../data/constants.js';

/**
 * @fileoverview The Upgrade Registry (formerly GameAttributes).
 * This service defines the available Ship Upgrades, their metadata, and their effects.
 */

// ==========================================
// 1. UPGRADE DEFINITIONS (The Registry)
// ==========================================

const UPGRADE_DEFINITIONS = {
    // --- Engine Mods (Speed vs Fuel) ---
    'UPGRADE_ENGINE_I': {
        id: 'UPGRADE_ENGINE_I',
        name: 'Engine Mod',
        value: 5000,
        pillColor: UPGRADE_COLORS.BLUE,
        description: 'Calibrated thrusters increase travel speed by 5% with a 15% increase in fuel consumption.',
        statText: 'Travel Speed +5%, Fuel Cost +15%',
        modifiers: { [UPGRADE_TYPES.MOD_TRAVEL_SPEED]: 0.95, [UPGRADE_TYPES.MOD_FUEL_COST]: 1.15 }
    },
    'UPGRADE_ENGINE_II': {
        id: 'UPGRADE_ENGINE_II',
        name: 'Engine Mod II',
        value: 15000,
        pillColor: UPGRADE_COLORS.BLUE,
        description: 'High-performance injectors boost ship speed by 10% while requiring 30% more fuel per trip.',
        statText: 'Travel Speed +10%, Fuel Cost +30%',
        modifiers: { [UPGRADE_TYPES.MOD_TRAVEL_SPEED]: 0.90, [UPGRADE_TYPES.MOD_FUEL_COST]: 1.30 }
    },
    'UPGRADE_ENGINE_III': {
        id: 'UPGRADE_ENGINE_III',
        name: 'Engine Mod III',
        value: 45000,
        pillColor: UPGRADE_COLORS.BLUE,
        description: 'Experimental overcharged drives maximize travel speed by 25% for a 45% increase in fuel costs.',
        statText: 'Travel Speed +25%, Fuel Cost +45%',
        modifiers: { [UPGRADE_TYPES.MOD_TRAVEL_SPEED]: 0.75, [UPGRADE_TYPES.MOD_FUEL_COST]: 1.45 }
    },

    // --- Signal Hackers (Buy Price Discount) ---
    'UPGRADE_SIGNAL_I': {
        id: 'UPGRADE_SIGNAL_I',
        name: 'Signal Hacker',
        value: 5000,
        pillColor: UPGRADE_COLORS.CYAN,
        description: 'A basic encryption bypass grants a 3% discount on all commodity purchases.',
        statText: 'Market Buy Price -3%',
        modifiers: { [UPGRADE_TYPES.MOD_BUY_PRICE]: 0.97 }
    },
    'UPGRADE_SIGNAL_II': {
        id: 'UPGRADE_SIGNAL_II',
        name: 'Signal Hacker II',
        value: 15000,
        pillColor: UPGRADE_COLORS.CYAN,
        description: 'Advanced market spoofing protocols reduce the cost of all purchased goods by 5%.',
        statText: 'Market Buy Price -5%',
        modifiers: { [UPGRADE_TYPES.MOD_BUY_PRICE]: 0.95 }
    },
    'UPGRADE_SIGNAL_III': {
        id: 'UPGRADE_SIGNAL_III',
        name: 'Signal Hacker III',
        value: 45000,
        pillColor: UPGRADE_COLORS.CYAN,
        description: 'Military-grade signal interceptors secure a 7% reduction in market buy prices system-wide.',
        statText: 'Market Buy Price -7%',
        modifiers: { [UPGRADE_TYPES.MOD_BUY_PRICE]: 0.93 }
    },

    // --- Hull Armor (Max Hull Increase) ---
    'UPGRADE_ARMOR_I': {
        id: 'UPGRADE_ARMOR_I',
        name: 'Hull Armor',
        value: 5000,
        pillColor: UPGRADE_COLORS.GREEN,
        description: 'Reinforced duralium plating increases the vessel\'s maximum hull capacity by 10%.',
        statText: 'Max Hull +10%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_HULL]: 0.10 } // Additive +10%
    },
    'UPGRADE_ARMOR_II': {
        id: 'UPGRADE_ARMOR_II',
        name: 'Hull Armor II',
        value: 15000,
        pillColor: UPGRADE_COLORS.GREEN,
        description: 'Multi-layered composite shielding provides a significant 20% boost to maximum hull integrity.',
        statText: 'Max Hull +20%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_HULL]: 0.20 } // Additive +20%
    },
    'UPGRADE_ARMOR_III': {
        id: 'UPGRADE_ARMOR_III',
        name: 'Hull Armor III',
        value: 45000,
        pillColor: UPGRADE_COLORS.GREEN,
        description: 'Advanced reactive nanoweave armor maximizes ship survivability with a 30% hull capacity increase.',
        statText: 'Max Hull +30%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_HULL]: 0.30 } // Additive +30%
    },

    // --- Auxiliary Tanks (Max Fuel Increase) ---
    'UPGRADE_TANK_I': {
        id: 'UPGRADE_TANK_I',
        name: 'Auxiliary Tank',
        value: 5000,
        pillColor: UPGRADE_COLORS.GOLD,
        description: 'External fuel pods extend the ship\'s maximum range by 10% capacity.',
        statText: 'Max Fuel +10%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_FUEL]: 0.10 } // Additive +10%
    },
    'UPGRADE_TANK_II': {
        id: 'UPGRADE_TANK_II',
        name: 'Auxiliary Tank II',
        value: 15000,
        pillColor: UPGRADE_COLORS.GOLD,
        description: 'Internal pressurized reservoirs provide a 20% increase to total fuel storage efficiency.',
        statText: 'Max Fuel +20%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_FUEL]: 0.20 } // Additive +20%
    },
    'UPGRADE_TANK_III': {
        id: 'UPGRADE_TANK_III',
        name: 'Auxiliary Tank III',
        value: 45000,
        pillColor: UPGRADE_COLORS.GOLD,
        description: 'High-capacity cryo-storage cells expand the vessel\'s fuel reserves by 30%.',
        statText: 'Max Fuel +30%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_FUEL]: 0.30 } // Additive +30%
    },

    // --- Radar Mods (Event Chance Increase) ---
    'UPGRADE_RADAR_I': {
        id: 'UPGRADE_RADAR_I',
        name: 'Radar Mod',
        value: 5000,
        pillColor: UPGRADE_COLORS.GREY,
        description: 'Enhanced sensors improve long-range detection, increasing random event frequency by a flat +3%.',
        statText: 'Event Chance +3%',
        modifiers: { [UPGRADE_TYPES.MOD_EVENT_CHANCE]: 0.03 } // Flat +3%
    },
    'UPGRADE_RADAR_II': {
        id: 'UPGRADE_RADAR_II',
        name: 'Radar Mod II',
        value: 15000,
        pillColor: UPGRADE_COLORS.GREY,
        description: 'Wide-spectrum scanning arrays boost the chance of encountering space-faring events by a flat +6%.',
        statText: 'Event Chance +6%',
        modifiers: { [UPGRADE_TYPES.MOD_EVENT_CHANCE]: 0.06 } // Flat +6%
    },
    'UPGRADE_RADAR_III': {
        id: 'UPGRADE_RADAR_III',
        name: 'Radar Mod III',
        value: 45000,
        pillColor: UPGRADE_COLORS.GREY,
        description: 'Predictive deep-space arrays maximize event discovery with a flat +10% increase in encounter rates.',
        statText: 'Event Chance +10%',
        modifiers: { [UPGRADE_TYPES.MOD_EVENT_CHANCE]: 0.10 } // Flat +10%
    },

    // --- Fuel Pass (Refuel Cost Discount) ---
    'UPGRADE_FUELPASS_I': {
        id: 'UPGRADE_FUELPASS_I',
        name: 'Fuel Pass',
        value: 5000,
        pillColor: UPGRADE_COLORS.INDIGO,
        description: 'A standard fueling subscription secures a baseline 20% discount at all participating starports.',
        statText: 'Refuel Cost -20%',
        modifiers: { [UPGRADE_TYPES.MOD_FUEL_COST]: 0.80 }
    },
    'UPGRADE_FUELPASS_II': {
        id: 'UPGRADE_FUELPASS_II',
        name: 'Fuel Pass II',
        value: 15000,
        pillColor: UPGRADE_COLORS.INDIGO,
        description: 'This premium fueling membership utilizes encrypted credentials to grant 50% off all propellant purchases.',
        statText: 'Refuel Cost -50%',
        modifiers: { [UPGRADE_TYPES.MOD_FUEL_COST]: 0.50 }
    },
    'UPGRADE_FUELPASS_III': {
        id: 'UPGRADE_FUELPASS_III',
        name: 'Fuel Pass III',
        value: 45000,
        pillColor: UPGRADE_COLORS.INDIGO,
        description: 'Elite system-wide fueling clearance provides a permanent 75% discount on all vessel refueling costs.',
        statText: 'Refuel Cost -75%',
        modifiers: { [UPGRADE_TYPES.MOD_FUEL_COST]: 0.25 }
    },

    // --- Repair Pass (Repair Cost Discount) ---
    'UPGRADE_REPAIRPASS_I': {
        id: 'UPGRADE_REPAIRPASS_I',
        name: 'Repair Pass',
        value: 5000,
        pillColor: UPGRADE_COLORS.EMERALD,
        description: 'Standard maintenance coverage grants holders a basic 20% discount on all station repair services.',
        statText: 'Repair Cost -20%',
        modifiers: { [UPGRADE_TYPES.MOD_REPAIR_COST]: 0.80 }
    },
    'UPGRADE_REPAIRPASS_II': {
        id: 'UPGRADE_REPAIRPASS_II',
        name: 'Repair Pass II',
        value: 15000,
        pillColor: UPGRADE_COLORS.EMERALD,
        description: 'Priority dockyard membership utilizes corporate clearance to secure a 50% reduction in repair fees.',
        statText: 'Repair Cost -50%',
        modifiers: { [UPGRADE_TYPES.MOD_REPAIR_COST]: 0.50 }
    },
    'UPGRADE_REPAIRPASS_III': {
        id: 'UPGRADE_REPAIRPASS_III',
        name: 'Repair Pass III',
        value: 45000,
        pillColor: UPGRADE_COLORS.EMERALD,
        description: 'Ultimate platinum-tier coverage provides total system-wide protection with 75% off all hull maintenance.',
        statText: 'Repair Cost -75%',
        modifiers: { [UPGRADE_TYPES.MOD_REPAIR_COST]: 0.25 }
    },

    // --- Nano Machines (Passive Repair in Transit) ---
    'UPGRADE_NANO_I': {
        id: 'UPGRADE_NANO_I',
        name: 'Nano Machines',
        value: 5000,
        pillColor: UPGRADE_COLORS.SEAFOAM,
        description: 'Basic self-repairing drones restore 0.3% of total hull integrity per day in transit.',
        statText: 'Daily Hull Repair +0.3%',
        modifiers: { [UPGRADE_TYPES.MOD_PASSIVE_REPAIR]: 0.003 } // Additive Rate
    },
    'UPGRADE_NANO_II': {
        id: 'UPGRADE_NANO_II',
        name: 'Nano Machines II',
        value: 15000,
        pillColor: UPGRADE_COLORS.SEAFOAM,
        description: 'Advanced micro-repair swarms regenerate 0.7% of the vessel\'s hull daily while traveling.',
        statText: 'Daily Hull Repair +0.7%',
        modifiers: { [UPGRADE_TYPES.MOD_PASSIVE_REPAIR]: 0.007 } // Additive Rate
    },
    'UPGRADE_NANO_III': {
        id: 'UPGRADE_NANO_III',
        name: 'Nano Machines III',
        value: 45000,
        pillColor: UPGRADE_COLORS.SEAFOAM,
        description: 'Superior nanobot hives provide rapid autonomous repair, restoring 1.2% of hull health daily.',
        statText: 'Daily Hull Repair +1.2%',
        modifiers: { [UPGRADE_TYPES.MOD_PASSIVE_REPAIR]: 0.012 } // Additive Rate
    },

    // --- Auxiliary Storage (Cargo Capacity Increase) ---
    'UPGRADE_STORAGE_I': {
        id: 'UPGRADE_STORAGE_I',
        name: 'Auxiliary Storage',
        value: 5000,
        pillColor: UPGRADE_COLORS.ORANGE,
        description: 'Modular storage racks expand the ship\'s total cargo capacity by 10%.',
        statText: 'Max Cargo +10%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_CARGO]: 0.10 } // Additive +10%
    },
    'UPGRADE_STORAGE_II': {
        id: 'UPGRADE_STORAGE_II',
        name: 'Auxiliary Storage II',
        value: 15000,
        pillColor: UPGRADE_COLORS.ORANGE,
        description: 'High-density pallet systems increase the vessel\'s available cargo space by 20%.',
        statText: 'Max Cargo +20%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_CARGO]: 0.20 } // Additive +20%
    },
    'UPGRADE_STORAGE_III': {
        id: 'UPGRADE_STORAGE_III',
        name: 'Auxiliary Storage III',
        value: 45000,
        pillColor: UPGRADE_COLORS.ORANGE,
        description: 'Advanced sub-spatial folding technology maximizes cargo capacity with a 30% increase.',
        statText: 'Max Cargo +30%',
        modifiers: { [UPGRADE_TYPES.MOD_MAX_CARGO]: 0.30 } // Additive +30%
    },

    // --- Guild Badge (Sell Price Bonus) ---
    'UPGRADE_GUILD_I': {
        id: 'UPGRADE_GUILD_I',
        name: 'Guild Badge',
        value: 5000,
        pillColor: UPGRADE_COLORS.RED,
        description: 'Merchant\'s Guild recognition increases the resale value of all commodities by 3%.',
        statText: 'Market Sell Price +3%',
        modifiers: { [UPGRADE_TYPES.MOD_SELL_PRICE]: 1.03 }
    },
    'UPGRADE_GUILD_II': {
        id: 'UPGRADE_GUILD_II',
        name: 'Guild Badge II',
        value: 15000,
        pillColor: UPGRADE_COLORS.RED,
        description: 'Senior Guild credentials secure a 5% bonus on all goods sold at market.',
        statText: 'Market Sell Price +5%',
        modifiers: { [UPGRADE_TYPES.MOD_SELL_PRICE]: 1.05 }
    },
    'UPGRADE_GUILD_III': {
        id: 'UPGRADE_GUILD_III',
        name: 'Guild Badge III',
        value: 45000,
        pillColor: UPGRADE_COLORS.RED,
        description: 'Elite Guild partnership status maximizes profits with a 7% increase to sell prices.',
        statText: 'Market Sell Price +7%',
        modifiers: { [UPGRADE_TYPES.MOD_SELL_PRICE]: 1.07 }
    },

    // --- Syndicate Badge (Debt Interest Reduction) ---
    'UPGRADE_SYNDICATE_I': {
        id: 'UPGRADE_SYNDICATE_I',
        name: 'Syndicate Badge',
        value: 5000,
        pillColor: UPGRADE_COLORS.VIOLET,
        description: 'Syndicate influence reduces the monthly interest rate on your debt by 20%.',
        statText: 'Debt Interest -20%',
        modifiers: { [UPGRADE_TYPES.MOD_DEBT_INTEREST]: 0.80 } // -20%
    },
    'UPGRADE_SYNDICATE_II': {
        id: 'UPGRADE_SYNDICATE_II',
        name: 'Syndicate Badge II',
        value: 15000,
        pillColor: UPGRADE_COLORS.VIOLET,
        description: 'Established Syndicate connections secure a 30% reduction in monthly interest accrual.',
        statText: 'Debt Interest -30%',
        modifiers: { [UPGRADE_TYPES.MOD_DEBT_INTEREST]: 0.70 } // -30%
    },
    'UPGRADE_SYNDICATE_III': {
        id: 'UPGRADE_SYNDICATE_III',
        name: 'Syndicate Badge III',
        value: 45000,
        pillColor: UPGRADE_COLORS.VIOLET,
        description: 'Deep Syndicate ties provide a 50% discount on all monthly debt interest charges.',
        statText: 'Debt Interest -50%',
        modifiers: { [UPGRADE_TYPES.MOD_DEBT_INTEREST]: 0.50 } // -50%
    }
};

// ==========================================
// 2. STATION QUIRKS (Legacy Support)
// ==========================================
const STATION_QUIRK_MAP = {
    // [LOCATION_IDS.JUPITER]: ['QUIRK_JUPITER_FUEL'],
    // [LOCATION_IDS.VENUS]: ['QUIRK_VENUS_REPAIR'],
};

// ==========================================
// 3. SERVICE EXPORT (The API)
// ==========================================

export const GameAttributes = {
    /**
     * Retrieves an upgrade definition by ID.
     * @param {string} id 
     * @returns {object|null}
     */
    getDefinition(id) {
        return UPGRADE_DEFINITIONS[id] || null;
    },

    /**
     * Returns a list of all defined Upgrade IDs.
     * Useful for debug tools and random generation.
     * @returns {string[]} Array of Upgrade IDs.
     */
    getAllUpgradeIds() {
        return Object.keys(UPGRADE_DEFINITIONS);
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Formerly returned ship attributes. Now returns an empty array to prevent legacy logic from firing.
     * @param {string} shipId 
     * @returns {Array} Always empty.
     */
    getShipAttributes(shipId) {
        return [];
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Formerly returned station quirks. Now returns empty.
     * @param {string} locationId 
     * @returns {Array} Always empty.
     */
    getStationQuirks(locationId) {
        return [];
    },

    // --- LOGIC HELPERS ---

    /**
     * Generic helper to calculate multiplicative modifiers.
     * @param {string[]} upgrades - Array of upgrade IDs.
     * @param {string} type - The modifier type key.
     * @returns {number} Multiplier (default 1.0).
     * @private
     */
    _getMultiplicativeModifier(upgrades, type) {
        let modifier = 1.0;
        upgrades.forEach(id => {
            const def = this.getDefinition(id);
            if (def && def.modifiers && def.modifiers[type] !== undefined) {
                modifier *= def.modifiers[type];
            }
        });
        return modifier;
    },

    /**
     * Generic helper to calculate additive modifiers.
     * @param {string[]} upgrades - Array of upgrade IDs.
     * @param {string} type - The modifier type key.
     * @param {number} baseValue - The starting value (e.g. 1.0 for capacity, 0.0 for rates).
     * @returns {number} Total value (base + sum of modifiers).
     * @private
     */
    _getAdditiveModifier(upgrades, type, baseValue) {
        let total = baseValue;
        upgrades.forEach(id => {
            const def = this.getDefinition(id);
            if (def && def.modifiers && def.modifiers[type] !== undefined) {
                total += def.modifiers[type];
            }
        });
        return total;
    },

    // --- Specific Modifiers ---

    /**
     * Calculates fuel cost modifier based on installed upgrades (Multiplicative).
     * Used for both Travel burn and Station refuel price if logic requires.
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    getFuelCostModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, UPGRADE_TYPES.MOD_FUEL_COST);
    },

    /**
     * Calculates travel time modifier (Multiplicative).
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    getTravelTimeModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, UPGRADE_TYPES.MOD_TRAVEL_SPEED);
    },

    /**
     * Calculates random event chance modifier.
     * CHANGED: Now uses ADDITIVE logic (Base 0.0 + Bonuses) to support flat % increases.
     * @param {string[]} upgrades 
     * @returns {number} Flat bonus amount (e.g. 0.03).
     */
    getEventChanceModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, UPGRADE_TYPES.MOD_EVENT_CHANCE, 0.0);
    },

    /**
     * Calculates price modifier for buying/selling (Multiplicative).
     * @param {string[]} upgrades 
     * @param {string} transactionType - 'buy' or 'sell'
     * @returns {number} Multiplier.
     */
    getPriceModifier(upgrades = [], transactionType) {
        const modType = transactionType === 'buy' ? UPGRADE_TYPES.MOD_BUY_PRICE : UPGRADE_TYPES.MOD_SELL_PRICE;
        return this._getMultiplicativeModifier(upgrades, modType);
    },

    /**
     * Calculates service cost modifier (Repair/Refuel) (Multiplicative).
     * @param {string[]} upgrades 
     * @param {string} serviceType - 'repair' or 'refuel'
     * @returns {number} Multiplier.
     */
    getServiceCostModifier(upgrades = [], serviceType) {
        const modType = serviceType === 'refuel' ? UPGRADE_TYPES.MOD_FUEL_COST : UPGRADE_TYPES.MOD_REPAIR_COST;
        return this._getMultiplicativeModifier(upgrades, modType);
    },

    /**
     * Calculates Max Hull Capacity Modifier (Additive).
     * Base 1.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Total Multiplier (e.g. 1.20 for +20%).
     */
    getMaxHullModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, UPGRADE_TYPES.MOD_MAX_HULL, 1.0);
    },

    /**
     * Calculates Max Fuel Capacity Modifier (Additive).
     * Base 1.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Total Multiplier.
     */
    getMaxFuelModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, UPGRADE_TYPES.MOD_MAX_FUEL, 1.0);
    },

    /**
     * Calculates Max Cargo Capacity Modifier (Additive).
     * Base 1.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Total Multiplier.
     */
    getMaxCargoModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, UPGRADE_TYPES.MOD_MAX_CARGO, 1.0);
    },

    /**
     * Calculates Debt Interest Modifier (Multiplicative).
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    getInterestModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, UPGRADE_TYPES.MOD_DEBT_INTEREST);
    },

    /**
     * Calculates Passive Repair Rate (Additive).
     * Base 0.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Daily Repair % (e.g. 0.03 for 3%).
     */
    getPassiveRepairRate(upgrades = []) {
        return this._getAdditiveModifier(upgrades, UPGRADE_TYPES.MOD_PASSIVE_REPAIR, 0.0);
    }
};