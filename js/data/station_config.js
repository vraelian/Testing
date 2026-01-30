import { COMMODITY_IDS } from './constants.js';

export const STATION_CONFIG = {
    // Core Mechanics
    BASE_DECAY: 0.2, // Daily % entropy decay
    CACHE_PENALTY: 2.0, // Added % decay per empty cache
    MAX_PENALTY: 24.0, // Cap on penalty
    XP_PER_DAY: 1, // Passive XP gain if entropy > 30%
    
    // Leveling Curve: Base 100 XP + 120 XP per subsequent level
    // Returns XP required to complete the CURRENT level
    getXPForLevel: (level) => {
        return 100 + ((level - 1) * 120);
    },

    // Buff Scaling per Level
    LEVEL_BUFFS: {
        DECAY_REDUCTION: 0.005, // -0.5% per level
        OUTPUT_BONUS: 0.0025    // +0.25% per level
    },

    // Operation Modes (Hegelian Synthesis)
    MODES: {
        PRODUCTION: {
            id: 'PRODUCTION',
            label: 'Syndicate (Chaos)',
            flavor: 'Maximum Output',
            color: '#ef4444', // Crimson
            modifiers: { credit: 1.0, antimatter: 2.0, entropy: 3.0 }
        },
        COMMERCE: {
            id: 'COMMERCE',
            label: 'Guild (Order)',
            flavor: 'Trade Optimization',
            color: '#eab308', // Gold
            modifiers: { credit: 2.0, antimatter: 1.0, entropy: 2.0 }
        },
        STABILIZATION: {
            id: 'STABILIZATION',
            label: 'Kintsugi (Evolution)',
            flavor: 'System Repair',
            color: '#06b6d4', // Cyan
            modifiers: { credit: 1.0, antimatter: 1.0, entropy: 1.0 }
        }
    },

    // Weekly Burn Requirements (Consumption per 7 Days)
    // Mapped by Commodity Tier
    WEEKLY_BURN: {
        1: 10,
        2: 8,
        3: 6,
        4: 4,
        5: 2,
        6: 1
    },

    // Default Roster Slots
    INITIAL_ROSTER_SLOTS: 3
};