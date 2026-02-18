// js/data/solProgressionRegistry.js
/**
 * @fileoverview Registry for Sol Station progression levels (1-50).
 * Defines the requirements and additive rewards for each station level up.
 * Adheres to the Registry Pattern for data-driven progression.
 * * VERSION 1 SCOPE: LEVELS 1-10 (The Construction Arc) + 11-50 Placeholders
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
        requirements: { "water_ice": 200 },
        rewards: {
            description: "+60 Water Ice Cap (+30%), +5% Antimatter Yield",
            stats: { cacheCapacity: { "water_ice": 60 }, amYieldMult: 0.05, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    3: {
        projectName: "Hull Plating Reinforcement",
        lore: "Additional Plasteel cladding reduces micrometeoroid damage, lowering baseline entropy and permitting advanced commercial docking.",
        cost: 15000,
        requirements: { "plasteel": 180 },
        rewards: {
            description: "-2% Global Entropy, Unlocks COMMERCE Mode",
            stats: { cacheCapacity: {}, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0.02 },
            unlocks: ["COMMERCE"]
        }
    },
    4: {
        projectName: "Hydro-Garden Expansion",
        lore: "Expanding the hydroponic rings increases biological life support capacity, preparing the station for a larger crew complement.",
        cost: 25000,
        requirements: { "hydroponics": 160 },
        rewards: {
            description: "+48 Hydroponics Cap (+30%)",
            stats: { cacheCapacity: { "hydroponics": 48 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    5: {
        projectName: "Reactor Ignition Sequence",
        lore: "Bringing the secondary fusion cores online. This massive power boost allows for industrial-scale production but requires specialized cybernetic oversight.",
        cost: 40000,
        requirements: { "cybernetics": 140 },
        rewards: {
            description: "+1 Officer Slot (Total: 2), Unlocks PRODUCTION Mode",
            stats: { cacheCapacity: {}, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 },
            unlocks: ["PRODUCTION"]
        }
    },
    6: {
        projectName: "Aux. Silo A (Propellant)",
        lore: "Constructing a dedicated external fuel silo to support increased traffic and refueling operations.",
        cost: 60000,
        requirements: { "propellant": 132 },
        rewards: {
            description: "+36 Refined Propellant Cap (+30%)",
            stats: { cacheCapacity: { "propellant": 36 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    7: {
        projectName: "Aux. Silo B (Processors)",
        lore: "Installing a super-cooled server farm to manage the station's increasing computational load.",
        cost: 90000,
        requirements: { "processors": 110 },
        rewards: {
            description: "+30 Neural Processor Cap (+30%)",
            stats: { cacheCapacity: { "processors": 30 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    8: {
        projectName: "Cryo-Buffer Extension",
        lore: "Reinforcing the cryo-stasis grid allows for the long-term storage of biological assets without degradation.",
        cost: 130000,
        requirements: { "hydroponics": 176 },
        rewards: {
            description: "+18 Cryo-Pod Cap (+30%)",
            stats: { cacheCapacity: { "cryo_pods": 18 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    9: {
        projectName: "Atmo-Scrubber Retrofit",
        lore: "Upgrading the atmospheric scrubbers with industrial-grade filters to handle the toxic byproducts of high-yield production.",
        cost: 180000,
        requirements: { "plasteel": 198 },
        rewards: {
            description: "+12 Atmo-Processor Cap (+30%)",
            stats: { cacheCapacity: { "atmos_processors": 12 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    10: {
        projectName: "Directorate Wing Alpha",
        lore: "Constructing the first major administrative wing. This command center coordinates trade fleets, boosting credit efficiency.",
        cost: 250000,
        requirements: { "propellant": 144, "graphene_lattices": 96 },
        rewards: {
            description: "+1 Officer Slot (Total: 3), +10% Credit Yield",
            stats: { cacheCapacity: {}, amYieldMult: 0, creditYieldMult: 0.10, globalEntropyRed: 0 }
        }
    },

    // --- EXPANDED PROGRESSION (Levels 11-50) ---
    // Pattern: Costs scale ~1.3x - 1.4x. Requirements rotate.
    // Rewards: Capacity/Yield alternated. Slots at 15, 20, 25...

    11: { projectName: "Station Expansion L11", lore: "Expanding core infrastructure.", cost: 320000, requirements: { "water_ice": 400 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    12: { projectName: "Station Expansion L12", lore: "Reinforcing structural pylons.", cost: 410000, requirements: { "plasteel": 350 }, rewards: { description: "-2% Global Entropy", stats: { globalEntropyRed: 0.02 } } },
    13: { projectName: "Station Expansion L13", lore: "Upgrading life support.", cost: 530000, requirements: { "hydroponics": 300 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    14: { projectName: "Station Expansion L14", lore: "Optimizing network nodes.", cost: 680000, requirements: { "cybernetics": 250 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    15: { projectName: "Directorate Wing Beta", lore: "A major administrative expansion.", cost: 850000, requirements: { "propellant": 300, "processors": 150 }, rewards: { description: "+1 Officer Slot (Total: 4)", stats: {} } },

    16: { projectName: "Station Expansion L16", lore: "Deep space sensors.", cost: 1100000, requirements: { "graphene_lattices": 200 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    17: { projectName: "Station Expansion L17", lore: "Commercial docking bay.", cost: 1400000, requirements: { "water_ice": 600 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    18: { projectName: "Station Expansion L18", lore: "Advanced recycling.", cost: 1800000, requirements: { "plasteel": 500 }, rewards: { description: "-2% Global Entropy", stats: { globalEntropyRed: 0.02 } } },
    19: { projectName: "Station Expansion L19", lore: "Cryo-storage optimization.", cost: 2300000, requirements: { "cryo_pods": 100 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    20: { projectName: "Directorate Wing Gamma", lore: "A command center upgrade.", cost: 3000000, requirements: { "cybernetics": 400, "cloned_organs": 50 }, rewards: { description: "+1 Officer Slot (Total: 5)", stats: {} } },

    21: { projectName: "Station Expansion L21", lore: "Heavy industry fabrication.", cost: 3800000, requirements: { "propellant": 500 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    22: { projectName: "Station Expansion L22", lore: "Hull integrity mesh.", cost: 4800000, requirements: { "graphene_lattices": 300 }, rewards: { description: "-2% Global Entropy", stats: { globalEntropyRed: 0.02 } } },
    23: { projectName: "Station Expansion L23", lore: "Reactor coolant loop.", cost: 6000000, requirements: { "water_ice": 1000 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    24: { projectName: "Station Expansion L24", lore: "Server farm redundancy.", cost: 7500000, requirements: { "processors": 300 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    25: { projectName: "Directorate Wing Delta", lore: "Strategic operations center.", cost: 9500000, requirements: { "plasteel": 1000, "atmos_processors": 100 }, rewards: { description: "+1 Officer Slot (Total: 6)", stats: {} } },

    26: { projectName: "Station Expansion L26", lore: "Luxury habitat ring.", cost: 12000000, requirements: { "hydroponics": 800 }, rewards: { description: "+15% Credit Yield", stats: { creditYieldMult: 0.15 } } },
    27: { projectName: "Station Expansion L27", lore: "Advanced shield harmonics.", cost: 15000000, requirements: { "cybernetics": 600 }, rewards: { description: "-3% Global Entropy", stats: { globalEntropyRed: 0.03 } } },
    28: { projectName: "Station Expansion L28", lore: "Particle accelerator.", cost: 19000000, requirements: { "propellant": 800 }, rewards: { description: "+8% Antimatter Yield", stats: { amYieldMult: 0.08 } } },
    29: { projectName: "Station Expansion L29", lore: "Xeno-research lab.", cost: 24000000, requirements: { "xeno_geologicals": 50 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    30: { projectName: "Directorate Wing Epsilon", lore: "Interstellar logistics hub.", cost: 30000000, requirements: { "graphene_lattices": 500, "sentient_ai": 10 }, rewards: { description: "+1 Officer Slot (Total: 7)", stats: {} } },

    31: { projectName: "Station Expansion L31", lore: "Solar array massive.", cost: 38000000, requirements: { "plasteel": 1500 }, rewards: { description: "+10% Antimatter Yield", stats: { amYieldMult: 0.10 } } },
    32: { projectName: "Station Expansion L32", lore: "Automated repair drones.", cost: 47000000, requirements: { "processors": 500 }, rewards: { description: "-4% Global Entropy", stats: { globalEntropyRed: 0.04 } } },
    33: { projectName: "Station Expansion L33", lore: "Trade federation embassy.", cost: 58000000, requirements: { "water_ice": 2000 }, rewards: { description: "+20% Credit Yield", stats: { creditYieldMult: 0.20 } } },
    34: { projectName: "Station Expansion L34", lore: "Deep storage vaults.", cost: 72000000, requirements: { "propellant": 1200 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    35: { projectName: "Directorate Wing Zeta", lore: "High command nexus.", cost: 90000000, requirements: { "cybernetics": 1000, "cloned_organs": 200 }, rewards: { description: "+1 Officer Slot (Total: 8)", stats: {} } },

    36: { projectName: "Station Expansion L36", lore: "Quantum comms array.", cost: 110000000, requirements: { "graphene_lattices": 800 }, rewards: { description: "+15% Credit Yield", stats: { creditYieldMult: 0.15 } } },
    37: { projectName: "Station Expansion L37", lore: "Antimatter containment V2.", cost: 135000000, requirements: { "plasteel": 2500 }, rewards: { description: "-5% Global Entropy", stats: { globalEntropyRed: 0.05 } } },
    38: { projectName: "Station Expansion L38", lore: "Bio-dome complex.", cost: 165000000, requirements: { "hydroponics": 2000 }, rewards: { description: "+10% Antimatter Yield", stats: { amYieldMult: 0.10 } } },
    39: { projectName: "Station Expansion L39", lore: "AI synthesis core.", cost: 200000000, requirements: { "sentient_ai": 25 }, rewards: { description: "+25% Credit Yield", stats: { creditYieldMult: 0.25 } } },
    40: { projectName: "Directorate Wing Eta", lore: "Orbital governance seat.", cost: 250000000, requirements: { "processors": 1000, "xeno_geologicals": 100 }, rewards: { description: "+1 Officer Slot (Total: 9)", stats: {} } },

    41: { projectName: "Station Expansion L41", lore: "Dyson swarm prototypes.", cost: 310000000, requirements: { "graphene_lattices": 1200 }, rewards: { description: "+15% Antimatter Yield", stats: { amYieldMult: 0.15 } } },
    42: { projectName: "Station Expansion L42", lore: "Adaptive hull geometry.", cost: 380000000, requirements: { "plasteel": 4000 }, rewards: { description: "-5% Global Entropy", stats: { globalEntropyRed: 0.05 } } },
    43: { projectName: "Station Expansion L43", lore: "Inter-system gate.", cost: 460000000, requirements: { "propellant": 3000 }, rewards: { description: "+30% Credit Yield", stats: { creditYieldMult: 0.30 } } },
    44: { projectName: "Station Expansion L44", lore: "Neural uplink grid.", cost: 550000000, requirements: { "cybernetics": 2000 }, rewards: { description: "+10% Antimatter Yield", stats: { amYieldMult: 0.10 } } },
    45: { projectName: "Directorate Wing Theta", lore: "System control authority.", cost: 650000000, requirements: { "sentient_ai": 50, "cloned_organs": 500 }, rewards: { description: "+1 Officer Slot (Total: 10)", stats: {} } },

    46: { projectName: "Station Expansion L46", lore: "Reality anchor.", cost: 770000000, requirements: { "xeno_geologicals": 200 }, rewards: { description: "-10% Global Entropy", stats: { globalEntropyRed: 0.10 } } },
    47: { projectName: "Station Expansion L47", lore: "Market manipulation matrix.", cost: 900000000, requirements: { "processors": 2000 }, rewards: { description: "+50% Credit Yield", stats: { creditYieldMult: 0.50 } } },
    48: { projectName: "Station Expansion L48", lore: "Star-lifting drones.", cost: 1100000000, requirements: { "graphene_lattices": 2000 }, rewards: { description: "+20% Antimatter Yield", stats: { amYieldMult: 0.20 } } },
    49: { projectName: "Station Expansion L49", lore: "Ascension Spire.", cost: 1350000000, requirements: { "plasteel": 8000 }, rewards: { description: "Maximum Efficiency", stats: { globalEntropyRed: 0.10 } } },
    50: { 
        projectName: "The Sol Citadel", 
        lore: "The ultimate expression of orbital dominance. Sol Station is now the capital of the system.", 
        cost: 2000000000, 
        requirements: { "water_ice": 10000, "propellant": 5000, "sentient_ai": 100 }, 
        rewards: { 
            description: "+1 Officer Slot (Total: 11), +100% Credit Yield, +50% Antimatter Yield", 
            stats: { creditYieldMult: 1.0, amYieldMult: 0.50 } 
        } 
    }
};