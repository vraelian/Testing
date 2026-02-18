{
type: file_update,
fileName: js/data/solProgressionRegistry.js,
fullContent:
// js/data/solProgressionRegistry.js
/**
 * @fileoverview Registry for Sol Station progression levels (1-50).
 * Defines the requirements and additive rewards for each station level up.
 * Adheres to the Registry Pattern for data-driven progression.
 * * VERSION 1 SCOPE: LEVELS 1-10 (The Construction Arc)
 * * Reward Key:
 * - cacheCapacity: Specific integer increase to a commodity's max storage.
 * - amYieldMult: Additive percentage to Antimatter generation (e.g. 0.05 = +5%).
 * - creditYieldMult: Additive percentage to Credit generation.
 * - globalEntropyRed: Subtractive percentage from Base Entropy (e.g. 0.02 = -2%).
 */

export const LEVEL_REGISTRY = {
    // Level 1 is the baseline; progression upgrades begin at Level 2.
    
    2: {
        projectName: "Water Reservoir Integration",
        lore: "Integrating expanded thermal coolant buffers allows the reactor to operate at higher baselines, increasing Antimatter yield.",
        cost: 10000,
        requirements: {
            "water_ice": 200 // T1
        },
        rewards: {
            description: "+60 Water Ice Cap (+30%), +5% Antimatter Yield",
            stats: {
                cacheCapacity: { "water_ice": 60 },
                amYieldMult: 0.05,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    3: {
        projectName: "Hull Plating Reinforcement",
        lore: "Additional Plasteel cladding reduces micrometeoroid damage, lowering baseline entropy and permitting advanced commercial docking.",
        cost: 15000,
        requirements: {
            "plasteel": 180 // T1
        },
        rewards: {
            description: "-2% Global Entropy, Unlocks COMMERCE Mode",
            stats: {
                cacheCapacity: {},
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0.02
            },
            unlocks: ["COMMERCE"]
        }
    },
    4: {
        projectName: "Hydro-Garden Expansion",
        lore: "Expanding the hydroponic rings increases biological life support capacity, preparing the station for a larger crew complement.",
        cost: 25000,
        requirements: {
            "hydroponics": 160 // T2
        },
        rewards: {
            description: "+48 Hydroponics Cap (+30%)",
            stats: {
                cacheCapacity: { "hydroponics": 48 },
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    5: {
        projectName: "Reactor Ignition Sequence",
        lore: "Bringing the secondary fusion cores online. This massive power boost allows for industrial-scale production but requires specialized cybernetic oversight.",
        cost: 40000,
        requirements: {
            "cybernetics": 140 // T2
        },
        rewards: {
            description: "+1 Officer Slot (Total: 2), Unlocks PRODUCTION Mode",
            // Note: Officer slot unlocks are mathematically hardcoded to Level % 5 === 0 in SolStationService logic.
            stats: {
                cacheCapacity: {},
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            },
            unlocks: ["PRODUCTION"]
        }
    },
    6: {
        projectName: "Aux. Silo A (Propellant)",
        lore: "Constructing a dedicated external fuel silo to support increased traffic and refueling operations.",
        cost: 60000,
        requirements: {
            "propellant": 132 // T3
        },
        rewards: {
            description: "+36 Refined Propellant Cap (+30%)",
            stats: {
                cacheCapacity: { "propellant": 36 },
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    7: {
        projectName: "Aux. Silo B (Processors)",
        lore: "Installing a super-cooled server farm to manage the station's increasing computational load.",
        cost: 90000,
        requirements: {
            "processors": 110 // T3
        },
        rewards: {
            description: "+30 Neural Processor Cap (+30%)",
            stats: {
                cacheCapacity: { "processors": 30 },
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    8: {
        projectName: "Cryo-Buffer Extension",
        lore: "Reinforcing the cryo-stasis grid allows for the long-term storage of biological assets without degradation.",
        cost: 130000,
        requirements: {
            "hydroponics": 176 // T2 (Revisiting lower tier for volume)
        },
        rewards: {
            description: "+18 Cryo-Pod Cap (+30%)",
            stats: {
                cacheCapacity: { "cryo_pods": 18 },
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    9: {
        projectName: "Atmo-Scrubber Retrofit",
        lore: "Upgrading the atmospheric scrubbers with industrial-grade filters to handle the toxic byproducts of high-yield production.",
        cost: 180000,
        requirements: {
            "plasteel": 198 // T1 (High volume structural requirement)
        },
        rewards: {
            description: "+12 Atmo-Processor Cap (+30%)",
            stats: {
                cacheCapacity: { "atmos_processors": 12 },
                amYieldMult: 0,
                creditYieldMult: 0,
                globalEntropyRed: 0
            }
        }
    },
    10: {
        projectName: "Directorate Wing Alpha",
        lore: "Constructing the first major administrative wing. This command center coordinates trade fleets, boosting credit efficiency.",
        cost: 250000,
        requirements: {
            "propellant": 144, // T3
            "graphene_lattices": 96 // T4
        },
        rewards: {
            description: "+1 Officer Slot (Total: 3), +10% Credit Yield",
            stats: {
                cacheCapacity: {},
                amYieldMult: 0,
                creditYieldMult: 0.10,
                globalEntropyRed: 0
            }
        }
    }
};
}