// js/services/GameAttributes.js

import { UPGRADE_TYPES, ATTRIBUTE_TYPES, LOCATION_IDS } from '../data/constants.js';
import { DB } from '../data/database.js'; 

/**
 * @fileoverview The Upgrade Registry. Defines the metadata (name, cost, description, visual style)
 * for all Ship Upgrades and Station Quirks.
 */

// Explicit Hex Codes to prevent import/runtime resolution issues
const COLORS = {
    BLUE: '#3b82f6',    // Tier 1
    CYAN: '#06b6d4',    // Tier 5 / Utility
    GREEN: '#22c55e',   // Repair
    GOLD: '#eab308',    // Trade / Tier 3
    GREY: '#94a3b8',    // Common
    INDIGO: '#6366f1',  // Tier 2
    EMERALD: '#10b981', // Radar
    SEAFOAM: '#14b8a6', // Repair III
    ORANGE: '#f97316',  // Fuel
    RED: '#ef4444',     // Tier 4 / Combat
    VIOLET: '#8b5cf6',  // Tier 3 / Expensive
    // Alien / Exotic Colors
    ALIEN_BONE: '#e2e8f0',
    ALIEN_VOID: '#1e293b',
    ALIEN_BIO: '#84cc16',
    ALIEN_PSI: '#d946ef',
    ALIEN_BLOOD: '#991b1b'
};

const ATTRIBUTE_DEFINITIONS = {
    // --- STATION QUIRKS (Map Intel) ---
    'QUIRK_SOL_FORGE': {
        name: "Solar Forge",
        description: "+25% Sell Price for Graphene Lattices & Plasteel.",
        type: "STATION_QUIRK",
        color: "#f59e0b"
    },
    'QUIRK_MERCURY_THIRST': {
        name: "Desperate Thirst",
        description: "Pays 40% more for Water Ice.",
        type: "STATION_QUIRK",
        color: "#f87171"
    },
    'QUIRK_VENUS_DATA': {
        name: "Data Haven",
        description: "Intel is 50% cheaper and lasts twice as long.",
        type: "STATION_QUIRK",
        color: "#facc15"
    },
    'QUIRK_EARTH_CONSUMPTION': {
        name: "High Demand",
        description: "Cloned Organs & Xeno-Geologicals sell for 10% more.",
        type: "STATION_QUIRK",
        color: "#60a5fa"
    },
    'QUIRK_LUNA_SHIPYARD': {
        name: "Orbital Shipyards",
        description: "20% discount on all ship repairs.",
        type: "STATION_QUIRK",
        color: "#9ca3af"
    },
    'QUIRK_MARS_COLONY': {
        name: "Colonial Expansion",
        description: "+10% Sell Price for Water Ice and Hydroponics.",
        type: "STATION_QUIRK",
        color: "#fb923c"
    },
    'QUIRK_BELT_ANOMALY': {
        name: "Lawless Zone",
        description: "Pending Declassification...",
        type: "STATION_QUIRK",
        color: "#a16207"
    },
    'QUIRK_EXCHANGE_VOLATILITY': {
        name: "Black Market",
        description: "Prices fluctuate dramatically.",
        type: "STATION_QUIRK",
        color: "#c084fc"
    },
    'QUIRK_JUPITER_REFINERY': {
        name: "Gas Giant Refinery",
        description: "Fuel is sold at a 50% discount.",
        type: "STATION_QUIRK",
        color: "#fb923c"
    },
    'QUIRK_SATURN_LUXURY': {
        name: "Luxury Tax",
        description: "+20% Sell Price for Organs/Cryo Pods. 200% Service Costs.",
        type: "STATION_QUIRK",
        color: "#fde047"
    },
    'QUIRK_URANUS_RESEARCH': {
        name: "Quantum Research",
        description: "Increased chance for advanced ship upgrades in shop.",
        type: "STATION_QUIRK",
        color: "#67e8f9"
    },
    'QUIRK_NEPTUNE_MILITARY': {
        name: "Military Logistics",
        description: "10% Bulk Discount on Propellant & Plasteel (>50 units).",
        type: "STATION_QUIRK",
        color: "#60a5fa"
    },
    'QUIRK_KEPLER_BANK': {
        name: "Financial Hub",
        description: "15% Discount on all financing and debt payments.",
        type: "STATION_QUIRK",
        color: "#ec4899"
    },
    'QUIRK_PLUTO_FRINGE': {
        name: "Fringe Outpost",
        description: "+25% Sell Price on Cybernetics & Antimatter. Low Supply.",
        type: "STATION_QUIRK",
        color: "#a78bfa"
    },

    // --- Z-CLASS & F-CLASS MECHANICS (ALIEN) ---
    // Added 'isAlien: true' to trigger special rendering in HangarScreen
    'ATTR_OSSEOUS_REGROWTH': {
        name: "Osseous Regrowth",
        description: "Regenerates 10% Hull upon arrival at any dock.",
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        color: COLORS.ALIEN_BONE,
        isAlien: true
    },
    'ATTR_SOLAR_HARMONY': {
        name: "Solar Harmony",
        description: "Zero Fuel cost when traveling inward towards the Sun.",
        type: ATTRIBUTE_TYPES.MOD_FUEL_BURN,
        color: COLORS.GOLD,
        isAlien: true
    },
    'ATTR_WHISPER_NETWORK': {
        name: "Whisper Network",
        description: "50% Discount on Intel Packets.",
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        color: COLORS.ALIEN_PSI,
        isAlien: true
    },
    'ATTR_NEWTONS_GHOST': {
        name: "Newton's Ghost",
        description: "Travel costs 0 Fuel but takes 10x longer.",
        type: ATTRIBUTE_TYPES.MOD_FUEL_BURN,
        color: COLORS.ALIEN_VOID,
        isAlien: true
    },
    'ATTR_CRYO_STASIS': {
        name: "Cryo-Stasis",
        description: "Player age does not advance while piloting this ship.",
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        color: COLORS.CYAN,
        isAlien: true
    },
    'ATTR_METABOLIC_BURN': {
        name: "Metabolic Burn",
        description: "Reduces Fuel consumption by 50%.",
        type: ATTRIBUTE_TYPES.MOD_FUEL_BURN,
        color: COLORS.ALIEN_BIO,
        isAlien: true
    },
    'ATTR_FLUID_HULL': {
        name: "Fluid Hull",
        description: "Immune to standard hull decay from travel.",
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        color: COLORS.BLUE,
        isAlien: true
    },
    'ATTR_HYPER_CALCULATION': {
        name: "Hyper-Calculation",
        description: "Reduces Travel Time by 25%.",
        type: ATTRIBUTE_TYPES.MOD_TRAVEL_TIME,
        color: COLORS.INDIGO,
        isAlien: true
    },
    'ATTR_PREDICTIVE_MODELING': {
        name: "Predictive Modeling",
        description: "Increases Sell Price of all goods by 5%.",
        type: ATTRIBUTE_TYPES.MOD_PRICE,
        color: COLORS.GOLD,
        isAlien: true
    },
    'ATTR_SELF_ASSEMBLY': {
        name: "Self-Assembly",
        description: "Passively repairs 5% Hull daily while traveling.",
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        color: COLORS.ORANGE,
        isAlien: true
    },
    'ATTR_NO_DECAY': {
        name: "Iterative Reinforcement",
        description: "Immune to standard hull decay from travel.",
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        color: COLORS.GREY,
        isAlien: true
    },
    // --- CHANGED: Updated description to reflect Arrival Refund ---
    'ATTR_MATTER_ABSORPTION': {
        name: "Matter Absorption",
        description: "Absorbs stellar matter to regenerate 50% of spent fuel upon arrival.",
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        color: COLORS.ALIEN_BLOOD,
        isAlien: true
    },

    // --- LEGACY / EXISTING ATTRIBUTES ---
    'ATTR_RUGGED': {
        name: "Rugged",
        description: "Reduces hull decay from travel by 50%.",
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        mode: 'multiplicative',
        value: 0.5,
        color: COLORS.GREEN
    },
    'ATTR_FUEL_SCOOP': {
        name: "Fuel Scoop",
        description: "Regenerates 15% max fuel after every trip.",
        type: ATTRIBUTE_TYPES.TRIGGER_ON_TRAVEL,
        color: COLORS.GOLD
    },
    'ATTR_TRAVELLER': {
        name: "Traveller",
        description: "Every 20th trip restores full Hull and Fuel.",
        type: ATTRIBUTE_TYPES.TRIGGER_ON_TRAVEL,
        color: COLORS.CYAN
    },
    'ATTR_TRADER': {
        name: "Trader",
        description: "15% chance to gain +1 unit when buying goods.",
        type: ATTRIBUTE_TYPES.TRIGGER_ON_TRADE,
        color: COLORS.GOLD
    },
    'ATTR_BESPOKE': {
        name: "Bespoke",
        description: "Cannot be repaired at standard facilities.",
        type: ATTRIBUTE_TYPES.RESTRICTION,
        color: COLORS.RED
    },
    'ATTR_XENO_HULL': {
        name: "Xeno-Hull",
        description: "Immune to hull decay from travel.",
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        mode: 'override',
        value: 0,
        color: COLORS.VIOLET
    },
    'ATTR_SLEEPER': {
        name: "Sleeper",
        description: "Uses 0 fuel but travel takes 4.5x longer.",
        type: ATTRIBUTE_TYPES.MOD_TRAVEL_TIME,
        mode: 'multiplicative',
        value: 4.5, 
        color: COLORS.GREY
    },
    'ATTR_ADVANCED_COMMS': {
        name: "Adv. Comms",
        description: "Increases chance of finding random events by 25%.",
        type: ATTRIBUTE_TYPES.PASSIVE_EFFECT,
        color: COLORS.BLUE
    },
    'ATTR_SOLAR_SAIL': {
        name: "Solar Sail",
        description: "15% chance for 0 fuel cost (but 2x travel time).",
        type: ATTRIBUTE_TYPES.MOD_FUEL_BURN,
        color: COLORS.GOLD
    },
    'ATTR_RESILIENT': {
        name: "Resilient",
        description: "Reduces hull decay from travel by 50%.",
        type: ATTRIBUTE_TYPES.MOD_HULL_DECAY,
        mode: 'multiplicative',
        value: 0.5,
        color: COLORS.GREEN
    },

    // --- UPGRADES: ENGINE ---
    'UPG_ENG_SPEED_1': {
        name: "Injector I",
        description: "Reduces travel time by 10%, but increases fuel burn by 15%.",
        cost: 5000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_TRAVEL_SPEED,
        value: 5000,
        modifiers: { travelTime: 0.90, fuelBurn: 1.15 },
        color: COLORS.BLUE
    },
    'UPG_ENG_SPEED_2': {
        name: "Injector II",
        description: "Reduces travel time by 20%, but increases fuel burn by 30%.",
        cost: 15000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_TRAVEL_SPEED,
        value: 15000,
        modifiers: { travelTime: 0.80, fuelBurn: 1.30 },
        color: COLORS.INDIGO
    },
    'UPG_ENG_SPEED_3': {
        name: "Injector III",
        description: "Reduces travel time by 30%, but increases fuel burn by 45%.",
        cost: 45000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_TRAVEL_SPEED,
        value: 45000,
        modifiers: { travelTime: 0.70, fuelBurn: 1.45 },
        color: COLORS.VIOLET
    },
    'UPG_ENG_SPEED_4': {
        name: "Injector IV",
        description: "Reduces travel time by 36%, but increases fuel burn by 54%.",
        cost: 12500000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_TRAVEL_SPEED,
        value: 12500000,
        modifiers: { travelTime: 0.64, fuelBurn: 1.54 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_ENG_SPEED_5': {
        name: "Injector V",
        description: "Reduces travel time by 40%, but increases fuel burn by 60%.",
        cost: 25000000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_TRAVEL_SPEED,
        value: 25000000,
        modifiers: { travelTime: 0.60, fuelBurn: 1.60 },
        color: COLORS.VIOLET
    },

    // --- UPGRADES: ECONOMY (REBALANCED) ---
    // Fuel Pass: -10%/-20%/-30%/-40%/-50%
    'UPG_ECO_FUEL_1': {
        name: "Fuel Pass I",
        description: "Reduces refueling cost at stations by 10%.",
        cost: 10000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_FUEL_PRICE,
        value: 10000,
        modifiers: { fuelPrice: 0.90 },
        color: COLORS.ORANGE
    },
    'UPG_ECO_FUEL_2': {
        name: "Fuel Pass II",
        description: "Reduces refueling cost at stations by 20%.",
        cost: 30000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_FUEL_PRICE,
        value: 30000,
        modifiers: { fuelPrice: 0.80 },
        color: COLORS.RED
    },
    'UPG_ECO_FUEL_3': {
        name: "Fuel Pass III",
        description: "Reduces refueling cost at stations by 30%.",
        cost: 90000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_FUEL_PRICE,
        value: 90000,
        modifiers: { fuelPrice: 0.70 },
        color: COLORS.GOLD
    },
    'UPG_ECO_FUEL_4': {
        name: "Fuel Pass IV",
        description: "Reduces refueling cost at stations by 40%.",
        cost: 270000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_FUEL_PRICE,
        value: 270000,
        modifiers: { fuelPrice: 0.60 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_ECO_FUEL_5': {
        name: "Fuel Pass V",
        description: "Reduces refueling cost at stations by 50%.",
        cost: 810000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_FUEL_PRICE,
        value: 810000,
        modifiers: { fuelPrice: 0.50 },
        color: COLORS.ORANGE
    },

    // Repair Pass: -5%/-10%/-15%/-20%/-25%
    'UPG_ECO_REPAIR_1': {
        name: "Repair Pass I",
        description: "Reduces hull repair cost by 5%.",
        cost: 20000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_REPAIR_COST,
        value: 20000,
        modifiers: { repairCost: 0.95 },
        color: COLORS.GREEN
    },
    'UPG_ECO_REPAIR_2': {
        name: "Repair Pass II",
        description: "Reduces hull repair cost by 10%.",
        cost: 60000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_REPAIR_COST,
        value: 60000,
        modifiers: { repairCost: 0.90 },
        color: COLORS.EMERALD
    },
    'UPG_ECO_REPAIR_3': {
        name: "Repair Pass III",
        description: "Reduces hull repair cost by 15%.",
        cost: 180000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_REPAIR_COST,
        value: 180000,
        modifiers: { repairCost: 0.85 },
        color: COLORS.SEAFOAM
    },
    'UPG_ECO_REPAIR_4': {
        name: "Repair Pass IV",
        description: "Reduces hull repair cost by 20%.",
        cost: 540000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_REPAIR_COST,
        value: 540000,
        modifiers: { repairCost: 0.80 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_ECO_REPAIR_5': {
        name: "Repair Pass V",
        description: "Reduces hull repair cost by 25%.",
        cost: 1620000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_REPAIR_COST,
        value: 1620000,
        modifiers: { repairCost: 0.75 },
        color: COLORS.GREEN
    },

    // Signal Hacker: -0.5%/-1.2%/-1.9%/-2.6%/-3.3%
    'UPG_ECO_BUY_1': {
        name: "Signal Hacker I",
        description: "Reduces market purchase prices by 0.5%.",
        cost: 30000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_BUY_PRICE,
        value: 30000,
        modifiers: { buyPrice: 0.995 },
        color: COLORS.CYAN
    },
    'UPG_ECO_BUY_2': {
        name: "Signal Hacker II",
        description: "Reduces market purchase prices by 1.2%.",
        cost: 90000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_BUY_PRICE,
        value: 90000,
        modifiers: { buyPrice: 0.988 },
        color: COLORS.BLUE
    },
    'UPG_ECO_BUY_3': {
        name: "Signal Hacker III",
        description: "Reduces market purchase prices by 1.9%.",
        cost: 270000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_BUY_PRICE,
        value: 270000,
        modifiers: { buyPrice: 0.981 },
        color: COLORS.VIOLET
    },
    'UPG_ECO_BUY_4': {
        name: "Signal Hacker IV",
        description: "Reduces market purchase prices by 2.6%.",
        cost: 810000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_BUY_PRICE,
        value: 810000,
        modifiers: { buyPrice: 0.974 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_ECO_BUY_5': {
        name: "Signal Hacker V",
        description: "Reduces market purchase prices by 3.3%.",
        cost: 2430000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_BUY_PRICE,
        value: 2430000,
        modifiers: { buyPrice: 0.967 },
        color: COLORS.INDIGO
    },

    // Guild Badge: +0.5%/+1.2%/+1.9%/+2.6%/+3.3%
    'UPG_ECO_SELL_1': {
        name: "Guild Badge I",
        description: "Increases market sell prices by 0.5%.",
        cost: 30000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_SELL_PRICE,
        value: 30000,
        modifiers: { sellPrice: 1.005 },
        color: COLORS.GOLD
    },
    'UPG_ECO_SELL_2': {
        name: "Guild Badge II",
        description: "Increases market sell prices by 1.2%.",
        cost: 90000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_SELL_PRICE,
        value: 90000,
        modifiers: { sellPrice: 1.012 },
        color: COLORS.ORANGE
    },
    'UPG_ECO_SELL_3': {
        name: "Guild Badge III",
        description: "Increases market sell prices by 1.9%.",
        cost: 270000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_SELL_PRICE,
        value: 270000,
        modifiers: { sellPrice: 1.019 },
        color: COLORS.RED
    },
    'UPG_ECO_SELL_4': {
        name: "Guild Badge IV",
        description: "Increases market sell prices by 2.6%.",
        cost: 810000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_SELL_PRICE,
        value: 810000,
        modifiers: { sellPrice: 1.026 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_ECO_SELL_5': {
        name: "Guild Badge V",
        description: "Increases market sell prices by 3.3%.",
        cost: 2430000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_SELL_PRICE,
        value: 2430000,
        modifiers: { sellPrice: 1.033 },
        color: COLORS.GOLD
    },
    
    // Syndicate Badge: Unchanged in request, keeping defaults or logic as previous
    'UPG_ECO_DEBT_1': {
        name: "Syndicate Badge I",
        description: "Reduces monthly debt interest by 20%.",
        cost: 5000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_DEBT_INTEREST,
        value: 5000,
        modifiers: { interestRate: 0.80 },
        color: COLORS.GREY
    },
    'UPG_ECO_DEBT_2': {
        name: "Syndicate Badge II",
        description: "Reduces monthly debt interest by 30%.",
        cost: 15000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_DEBT_INTEREST,
        value: 15000,
        modifiers: { interestRate: 0.70 },
        color: COLORS.INDIGO
    },
    'UPG_ECO_DEBT_3': {
        name: "Syndicate Badge III",
        description: "Reduces monthly debt interest by 50%.",
        cost: 45000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_DEBT_INTEREST,
        value: 45000,
        modifiers: { interestRate: 0.50 },
        color: COLORS.VIOLET
    },
    'UPG_ECO_DEBT_4': {
        name: "Syndicate Badge IV",
        description: "Reduces monthly debt interest by 60%.",
        cost: 12500000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_DEBT_INTEREST,
        value: 12500000,
        modifiers: { interestRate: 0.40 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_ECO_DEBT_5': {
        name: "Syndicate Badge V",
        description: "Reduces monthly debt interest by 66%.",
        cost: 25000000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_DEBT_INTEREST,
        value: 25000000,
        modifiers: { interestRate: 0.34 },
        color: COLORS.VIOLET
    },

    // --- UPGRADES: UTILITY (REBALANCED) ---
    // Plating: +10/+25/+55/+85/+115
    'UPG_UTIL_HULL_1': {
        name: "Plating I",
        description: "Increases Max Hull by 10. Reduces event hull damage by 10%.",
        cost: 20000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_MAX_HULL,
        value: 20000,
        modifiers: { maxHull: 10, hullResistance: 0.10 },
        color: COLORS.GREY
    },
    'UPG_UTIL_HULL_2': {
        name: "Plating II",
        description: "Increases Max Hull by 25. Reduces event hull damage by 15%.",
        cost: 80000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_MAX_HULL,
        value: 80000,
        modifiers: { maxHull: 25, hullResistance: 0.15 },
        color: COLORS.INDIGO
    },
    'UPG_UTIL_HULL_3': {
        name: "Plating III",
        description: "Increases Max Hull by 55. Reduces event hull damage by 20%.",
        cost: 320000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_MAX_HULL,
        value: 320000,
        modifiers: { maxHull: 55, hullResistance: 0.20 },
        color: COLORS.VIOLET
    },
    'UPG_UTIL_HULL_4': {
        name: "Plating IV",
        description: "Increases Max Hull by 85. Reduces event hull damage by 25%.",
        cost: 960000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_MAX_HULL,
        value: 960000,
        modifiers: { maxHull: 85, hullResistance: 0.25 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_UTIL_HULL_5': {
        name: "Plating V",
        description: "Increases Max Hull by 115. Reduces event hull damage by 35%.",
        cost: 2880000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_MAX_HULL,
        value: 2880000,
        modifiers: { maxHull: 115, hullResistance: 0.35 },
        color: COLORS.GREY
    },

    // Aux Tank: +30/+60/+90/+120/+150
    'UPG_UTIL_FUEL_1': {
        name: "Aux Tank I",
        description: "Increases Max Fuel by 30.",
        cost: 20000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_MAX_FUEL,
        value: 20000,
        modifiers: { maxFuel: 30 },
        color: COLORS.ORANGE
    },
    'UPG_UTIL_FUEL_2': {
        name: "Aux Tank II",
        description: "Increases Max Fuel by 60.",
        cost: 60000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_MAX_FUEL,
        value: 60000,
        modifiers: { maxFuel: 60 },
        color: COLORS.RED
    },
    'UPG_UTIL_FUEL_3': {
        name: "Aux Tank III",
        description: "Increases Max Fuel by 90.",
        cost: 180000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_MAX_FUEL,
        value: 180000,
        modifiers: { maxFuel: 90 },
        color: COLORS.GOLD
    },
    'UPG_UTIL_FUEL_4': {
        name: "Aux Tank IV",
        description: "Increases Max Fuel by 120.",
        cost: 540000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_MAX_FUEL,
        value: 540000,
        modifiers: { maxFuel: 120 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_UTIL_FUEL_5': {
        name: "Aux Tank V",
        description: "Increases Max Fuel by 150.",
        cost: 1620000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_MAX_FUEL,
        value: 1620000,
        modifiers: { maxFuel: 150 },
        color: COLORS.ORANGE
    },

    // Cargo Expansion: +10/+25/+40/+55/+70
    'UPG_UTIL_CARGO_1': {
        name: "Exp. Hold I",
        description: "Increases Cargo Capacity by 10.",
        cost: 40000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_MAX_CARGO,
        value: 40000,
        modifiers: { maxCargo: 10 },
        color: COLORS.CYAN
    },
    'UPG_UTIL_CARGO_2': {
        name: "Exp. Hold II",
        description: "Increases Cargo Capacity by 25.",
        cost: 120000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_MAX_CARGO,
        value: 120000,
        modifiers: { maxCargo: 25 },
        color: COLORS.BLUE
    },
    'UPG_UTIL_CARGO_3': {
        name: "Exp. Hold III",
        description: "Increases Cargo Capacity by 40.",
        cost: 360000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_MAX_CARGO,
        value: 360000,
        modifiers: { maxCargo: 40 },
        color: COLORS.VIOLET
    },
    'UPG_UTIL_CARGO_4': {
        name: "Exp. Hold IV",
        description: "Increases Cargo Capacity by 55.",
        cost: 1080000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_MAX_CARGO,
        value: 1080000,
        modifiers: { maxCargo: 55 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_UTIL_CARGO_5': {
        name: "Exp. Hold V",
        description: "Increases Cargo Capacity by 70.",
        cost: 3240000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_MAX_CARGO,
        value: 3240000,
        modifiers: { maxCargo: 70 },
        color: COLORS.BLUE
    },

    // Radar Mod: +3%/+5%/+8%/+13%/+20%
    'UPG_UTIL_RADAR_1': {
        name: "Radar Mod I",
        description: "Increases random event chance by 3%.",
        cost: 10000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_EVENT_CHANCE,
        value: 10000,
        modifiers: { eventChance: 0.03 },
        color: COLORS.SEAFOAM
    },
    'UPG_UTIL_RADAR_2': {
        name: "Radar Mod II",
        description: "Increases random event chance by 5%.",
        cost: 30000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_EVENT_CHANCE,
        value: 30000,
        modifiers: { eventChance: 0.05 },
        color: COLORS.EMERALD
    },
    'UPG_UTIL_RADAR_3': {
        name: "Radar Mod III",
        description: "Increases random event chance by 8%.",
        cost: 90000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_EVENT_CHANCE,
        value: 90000,
        modifiers: { eventChance: 0.08 },
        color: COLORS.GREEN
    },
    'UPG_UTIL_RADAR_4': {
        name: "Radar Mod IV",
        description: "Increases random event chance by 13%.",
        cost: 270000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_EVENT_CHANCE,
        value: 270000,
        modifiers: { eventChance: 0.13 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_UTIL_RADAR_5': {
        name: "Radar Mod V",
        description: "Increases random event chance by 20%.",
        cost: 810000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_EVENT_CHANCE,
        value: 810000,
        modifiers: { eventChance: 0.20 },
        color: COLORS.EMERALD
    },

    // Nano-Bots: 0.3%/0.5%/0.8%/1.3%/2%
    'UPG_UTIL_NANO_1': {
        name: "Nano-Bots I",
        description: "Repairs 0.3% of Max Hull daily while traveling.",
        cost: 30000,
        tier: 1,
        type: UPGRADE_TYPES.MOD_PASSIVE_REPAIR,
        value: 30000,
        modifiers: { passiveRepair: 0.003 },
        color: COLORS.CYAN
    },
    'UPG_UTIL_NANO_2': {
        name: "Nano-Bots II",
        description: "Repairs 0.5% of Max Hull daily while traveling.",
        cost: 120000,
        tier: 2,
        type: UPGRADE_TYPES.MOD_PASSIVE_REPAIR,
        value: 120000,
        modifiers: { passiveRepair: 0.005 },
        color: COLORS.BLUE
    },
    'UPG_UTIL_NANO_3': {
        name: "Nano-Bots III",
        description: "Repairs 0.8% of Max Hull daily while traveling.",
        cost: 480000,
        tier: 3,
        type: UPGRADE_TYPES.MOD_PASSIVE_REPAIR,
        value: 480000,
        modifiers: { passiveRepair: 0.008 },
        color: COLORS.INDIGO
    },
    'UPG_UTIL_NANO_4': {
        name: "Nano-Bots IV",
        description: "Repairs 1.3% of Max Hull daily.",
        cost: 1920000,
        tier: 4,
        type: UPGRADE_TYPES.MOD_PASSIVE_REPAIR,
        value: 1920000,
        modifiers: { passiveRepair: 0.013 },
        color: COLORS.RED,
        pillColor: "#ef4444"
    },
    'UPG_UTIL_NANO_5': {
        name: "Nano-Bots V",
        description: "Repairs 2% of Max Hull daily.",
        cost: 7680000,
        tier: 5,
        type: UPGRADE_TYPES.MOD_PASSIVE_REPAIR,
        value: 7680000,
        modifiers: { passiveRepair: 0.02 },
        color: COLORS.SEAFOAM
    }
};

export class GameAttributes {
    /**
     * Retrieves the definition for a given attribute or upgrade ID.
     * @param {string} id 
     * @returns {object|null}
     */
    static getDefinition(id) {
        return ATTRIBUTE_DEFINITIONS[id] || null;
    }

    /**
     * Gets the static ship attributes (Legacy system).
     * @param {string} shipId 
     * @returns {string[]} Array of attribute IDs
     */
    static getShipAttributes(shipId) {
        return DB.SHIPS[shipId]?.mechanicIds || [];
    }

    /**
     * Returns a list of all defined Upgrade IDs.
     * Useful for debug tools and random generation.
     * @returns {string[]} Array of Upgrade IDs.
     */
    static getAllUpgradeIds() {
        return Object.keys(ATTRIBUTE_DEFINITIONS);
    }

    /**
     * Retrieves the station quirk IDs for a specific location.
     * @param {string} locationId 
     * @returns {string[]} Array of Quirk IDs
     */
    static getStationQuirks(locationId) {
        const map = {
            [LOCATION_IDS.SUN]: ['QUIRK_SOL_FORGE'],
            [LOCATION_IDS.MERCURY]: ['QUIRK_MERCURY_THIRST'],
            [LOCATION_IDS.VENUS]: ['QUIRK_VENUS_DATA'],
            [LOCATION_IDS.EARTH]: ['QUIRK_EARTH_CONSUMPTION'],
            [LOCATION_IDS.LUNA]: ['QUIRK_LUNA_SHIPYARD'],
            [LOCATION_IDS.MARS]: ['QUIRK_MARS_COLONY'],
            [LOCATION_IDS.BELT]: ['QUIRK_BELT_ANOMALY'],
            [LOCATION_IDS.EXCHANGE]: ['QUIRK_EXCHANGE_VOLATILITY'],
            [LOCATION_IDS.JUPITER]: ['QUIRK_JUPITER_REFINERY'],
            [LOCATION_IDS.SATURN]: ['QUIRK_SATURN_LUXURY'],
            [LOCATION_IDS.URANUS]: ['QUIRK_URANUS_RESEARCH'],
            [LOCATION_IDS.NEPTUNE]: ['QUIRK_NEPTUNE_MILITARY'],
            [LOCATION_IDS.KEPLER]: ['QUIRK_KEPLER_BANK'],
            [LOCATION_IDS.PLUTO]: ['QUIRK_PLUTO_FRINGE']
        };
        return map[locationId] || [];
    }

    // --- HELPER METHODS FOR CALCULATING MODIFIERS ---

    /**
     * Calculates the "Installation Labor Fee" for an upgrade.
     * Formula: 5% of the ship's base hull value.
     * @param {number} shipBasePrice - The DB price of the target ship.
     * @returns {number} The installation fee.
     */
    static getInstallationFee(shipBasePrice) {
        if (!shipBasePrice || shipBasePrice <= 0) return 0;
        return Math.floor(shipBasePrice * 0.05);
    }

    /**
     * Generic helper to calculate multiplicative modifiers.
     * @param {string[]} upgrades - Array of upgrade IDs.
     * @param {string} type - The modifier type key.
     * @returns {number} Multiplier (default 1.0).
     * @private
     */
    static _getMultiplicativeModifier(upgrades, type) {
        let modifier = 1.0;
        upgrades.forEach(id => {
            const def = ATTRIBUTE_DEFINITIONS[id];
            if (!def) return;
            
            if (def.modifiers && def.modifiers[type] !== undefined) {
                modifier *= def.modifiers[type];
            }
        });
        return modifier;
    }

    /**
     * Generic helper to calculate additive modifiers.
     * @param {string[]} upgrades - Array of upgrade IDs.
     * @param {string} type - The modifier type key.
     * @param {number} baseValue - The starting value (e.g. 1.0 for capacity, 0.0 for rates).
     * @returns {number} Total value (base + sum of modifiers).
     * @private
     */
    static _getAdditiveModifier(upgrades, type, baseValue) {
        let total = baseValue;
        upgrades.forEach(id => {
            const def = ATTRIBUTE_DEFINITIONS[id];
            if (!def) return;

            if (def.modifiers && def.modifiers[type] !== undefined) {
                total += def.modifiers[type];
            }
        });
        return total;
    }

    // --- Specific Modifiers ---

    /**
     * Calculates fuel burn modifier based on installed upgrades (Multiplicative).
     * Used for Travel consumption.
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    static getFuelBurnModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, 'fuelBurn');
    }

    /**
     * Calculates fuel PRICE modifier based on installed upgrades (Multiplicative).
     * Used for station refueling cost.
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    static getFuelPriceModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, 'fuelPrice');
    }

    /**
     * Calculates travel time modifier (Multiplicative).
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    static getTravelTimeModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, 'travelTime');
    }

    /**
     * Calculates random event chance modifier.
     * ADDITIVE logic (Base 0.0 + Bonuses).
     * @param {string[]} upgrades 
     * @returns {number} Flat bonus amount (e.g. 0.03).
     */
    static getEventChanceModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, 'eventChance', 0.0);
    }

    /**
     * Calculates price modifier for buying/selling (Multiplicative).
     * @param {string[]} upgrades 
     * @param {string} transactionType - 'buy' or 'sell'
     * @returns {number} Multiplier.
     */
    static getPriceModifier(upgrades = [], transactionType) {
        const modKey = transactionType === 'buy' ? 'buyPrice' : 'sellPrice';
        return this._getMultiplicativeModifier(upgrades, modKey);
    }

    /**
     * Calculates service cost modifier (Repair/Refuel) (Multiplicative).
     * @param {string[]} upgrades 
     * @param {string} serviceType - 'repair' or 'refuel'
     * @returns {number} Multiplier.
     */
    static getServiceCostModifier(upgrades = [], serviceType) {
        if (serviceType === 'refuel') {
            return this.getFuelPriceModifier(upgrades);
        } else {
            return this._getMultiplicativeModifier(upgrades, 'repairCost');
        }
    }

    /**
     * Calculates Max Hull Capacity Modifier (Additive).
     * Base 1.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Total Multiplier (e.g. 1.20 for +20%).
     */
    static getMaxHullModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, 'maxHull', 0); // Note: Base is 0 for flat additive HP
    }

    /**
     * Calculates Max Fuel Capacity Modifier (Additive).
     * Base 1.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Total Multiplier.
     */
    static getMaxFuelModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, 'maxFuel', 0);
    }

    /**
     * Calculates Max Cargo Capacity Modifier (Additive).
     * Base 1.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Total Multiplier.
     */
    static getMaxCargoModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, 'maxCargo', 0);
    }

    /**
     * Calculates Debt Interest Modifier (Multiplicative).
     * @param {string[]} upgrades 
     * @returns {number} Multiplier.
     */
    static getInterestModifier(upgrades = []) {
        return this._getMultiplicativeModifier(upgrades, 'interestRate');
    }

    /**
     * Calculates Passive Repair Rate (Additive).
     * Base 0.0 + Bonuses.
     * @param {string[]} upgrades 
     * @returns {number} Daily Repair % (e.g. 0.03 for 3%).
     */
    static getPassiveRepairRate(upgrades = []) {
        return this._getAdditiveModifier(upgrades, 'passiveRepair', 0.0);
    }

    /**
     * Calculates total event hull damage mitigation (Additive).
     * Used in eventEffectResolver.
     * @param {string[]} upgrades 
     * @returns {number} Total resistance (e.g. 0.25 for 25% reduction).
     */
    static getHullResistanceModifier(upgrades = []) {
        return this._getAdditiveModifier(upgrades, 'hullResistance', 0.0);
    }

    /**
     * Returns a flattened list of all upgrade definitions (excluding attributes).
     * @returns {object[]}
     */
    static getAllUpgrades() {
        return Object.entries(ATTRIBUTE_DEFINITIONS)
            .filter(([key, def]) => key.startsWith('UPG_'))
            .map(([key, def]) => ({ id: key, ...def }));
    }
}