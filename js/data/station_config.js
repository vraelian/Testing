// js/data/station_config.js

export const STATION_CONFIG = {
    // Entropy Rules
    ENTROPY: {
        BASE_DECAY: 0.2,       // Daily base decay %
        EMPTY_CACHE_PENALTY: 2.0, // Added % per empty cache
        MAX_ENTROPY: 100,
        CRITICAL_THRESHOLD: 80, // % where bad things start happening
        STABLE_THRESHOLD: 20    // % where bonus efficiency kicks in
    },

    // Operation Modes
    MODES: {
        DEFAULT: {
            id: 'DEFAULT',
            name: 'Station Keeping',
            decayMod: 1.0,      // Normal Decay
            productionMod: 1.0, // Normal Output
            description: "Standard operation. Balanced decay and production."
        },
        SIPHON: {
            id: 'SIPHON',
            name: 'Solar Siphon',
            decayMod: 2.5,      // +150% Decay (High Risk)
            productionMod: 3.0, // +200% Output (High Reward)
            description: "Aggressive harvesting. drastically increases output but accelerates entropy."
        },
        FORTIFY: {
            id: 'FORTIFY',
            name: 'Shield Fortification',
            decayMod: 0.0,      // No Decay (Maintenance Only)
            productionMod: 0.1, // 10% Output (Minimal Production)
            description: "Defensive posture. halts decay but stifles production."
        }
    },

    // Weekly Consumption (Burn) Requirements
    // Maps Commodity Tier -> Quantity Required
    BURN_RATES: {
        1: 10, // Common Construction Goods
        2: 8,
        3: 6,
        4: 4,
        5: 2,
        6: 1   // Rare Components
    },

    // Production (Per Day at 0% Entropy)
    PRODUCTION: {
        BASE_CREDITS: 100,     // Daily Credit passive income
        BASE_ANTIMATTER: 0.05  // Daily Antimatter generation
    }
};