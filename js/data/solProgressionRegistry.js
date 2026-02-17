// js/data/solProgressionRegistry.js
/**
 * @fileoverview Registry for Sol Station progression levels (1-50).
 * Defines the requirements and additive rewards for each station level up.
 * Adheres to the Registry Pattern for data-driven progression.
 */

export const LEVEL_REGISTRY = {
    // Level 1 is the baseline; progression upgrades begin at Level 2.
    2: {
        projectName: "Ice Reservoir Integration",
        lore: "Expanding the thermal coolant buffers to allow for slightly higher reactor operating temperatures.",
        requirements: {
            "water_ice": 1000,
            "credits": 50000
        },
        rewards: {
            description: "+10,000 Water Ice Capacity, +5% Antimatter Yield",
            stats: {
                cacheCapacity: { "water_ice": 10000 },
                amYieldMult: 0.05,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    3: {
        projectName: "Hull Plating Reinforcement",
        lore: "Additional Plasteel cladding reduces micrometeoroid damage, lowering baseline entropy and permitting advanced trade operations.",
        requirements: {
            "plasteel": 2500,
            "credits": 150000
        },
        rewards: {
            description: "-2% Global Entropy, Unlocks COMMERCE Mode",
            stats: {
                cacheCapacity: {},
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0.02
            }
        }
    },
    4: {
        projectName: "Advanced Robotics Bay",
        lore: "Automated maintenance drones improve the efficiency of mechanical repairs and part replacements.",
        requirements: {
            "processors": 800,
            "credits": 300000
        },
        rewards: {
            description: "+5,000 Processors Capacity, +10% Credit Yield",
            stats: {
                cacheCapacity: { "processors": 5000 },
                amYieldMult: 0,
                creditYieldMult: 0.10,
                globalEntropyRed: 0
            }
        }
    },
    5: {
        projectName: "Expanded Directorate Quarters",
        lore: "Constructing high-end habitats to attract top-tier administrative and engineering talent to the station.",
        requirements: {
            "cybernetics": 500,
            "credits": 600000
        },
        rewards: {
            description: "+1 Officer Slot, Unlocks PRODUCTION Mode",
            // Note: Officer slot unlocks are mathematically hardcoded to Level % 5 === 0 in the logic layer.
            stats: {
                cacheCapacity: {},
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    }
};