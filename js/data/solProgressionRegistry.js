// js/data/solProgressionRegistry.js
/**
 * @fileoverview Registry for Sol Station progression levels (1-50).
 * Defines the requirements and additive rewards for each station level up.
 * Adheres to the Registry Pattern for data-driven progression.
 * * VERSION 2 SCOPE: LEVELS 1-50 (Exponential Endgame Vacuum - Volumetrically Scaled)
 * * Reward Key:
 * - cacheCapacity: Specific integer increase to a commodity's max storage.
 * - amYieldMult: Additive percentage to Antimatter generation (e.g. 0.05 = +5%).
 * - creditYieldMult: Additive percentage to Credit generation.
 * - globalEntropyRed: Subtractive percentage from Base Entropy (e.g. 0.02 = -2%).
 */

export const LEVEL_REGISTRY = {
    // Level 1 is the baseline; progression upgrades begin at Level 2.
    
    // --- ESTABLISHMENT PHASE (Levels 1-15) ---
    2: {
        projectName: "Water Reservoir Integration",
        lore: "Integrating expanded thermal coolant buffers allows the reactor to operate at higher baselines, increasing Antimatter yield.",
        cost: 25000,
        requirements: { "water_ice": 50 },
        rewards: {
            description: "+30 Water Ice Cap, +5% Antimatter Yield",
            stats: { cacheCapacity: { "water_ice": 30 }, amYieldMult: 0.05, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    3: {
        projectName: "Hull Plating Reinforcement",
        lore: "Additional Plasteel cladding reduces micrometeoroid damage, lowering baseline entropy and permitting advanced commercial docking.",
        cost: 45000,
        requirements: { "plasteel": 50 },
        rewards: {
            description: "-2% Global Entropy, Unlocks COMMERCE Mode",
            stats: { cacheCapacity: {}, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0.02 },
            unlocks: ["COMMERCE"]
        }
    },
    4: {
        projectName: "Hydro-Garden Expansion",
        lore: "Expanding the hydroponic rings increases biological life support capacity, preparing the station for a larger crew complement.",
        cost: 80000,
        requirements: { "hydroponics": 20, "water_ice": 60 },
        rewards: {
            description: "+20 Hydroponics Cap",
            stats: { cacheCapacity: { "hydroponics": 20 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    5: {
        projectName: "Reactor Ignition Sequence",
        lore: "Bringing the secondary fusion cores online. This massive power boost allows for industrial-scale production but requires specialized cybernetic oversight.",
        cost: 150000,
        requirements: { "cybernetics": 15, "plasteel": 80 },
        rewards: {
            description: "+1 Officer Slot (Total: 2), Unlocks PRODUCTION Mode",
            stats: { cacheCapacity: {}, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 },
            unlocks: ["PRODUCTION"]
        }
    },
    6: {
        projectName: "Aux. Silo A (Propellant)",
        lore: "Constructing a dedicated external fuel silo to support increased traffic and refueling operations.",
        cost: 250000,
        requirements: { "propellant": 20, "water_ice": 100 },
        rewards: {
            description: "+15 Refined Propellant Cap",
            stats: { cacheCapacity: { "propellant": 15 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    7: {
        projectName: "Aux. Silo B (Processors)",
        lore: "Installing a super-cooled server farm to manage the station's increasing computational load.",
        cost: 400000,
        requirements: { "processors": 15, "plasteel": 120 },
        rewards: {
            description: "+15 Neural Processor Cap",
            stats: { cacheCapacity: { "processors": 15 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    8: {
        projectName: "Cryo-Buffer Extension",
        lore: "Reinforcing the cryo-stasis grid allows for the long-term storage of biological assets without degradation.",
        cost: 650000,
        requirements: { "hydroponics": 60, "cybernetics": 30 },
        rewards: {
            description: "+10 Cryo-Pod Cap",
            stats: { cacheCapacity: { "cryo_pods": 10 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    9: {
        projectName: "Atmo-Scrubber Retrofit",
        lore: "Upgrading the atmospheric scrubbers with industrial-grade filters to handle the toxic byproducts of high-yield production.",
        cost: 1000000,
        requirements: { "plasteel": 200, "propellant": 50 },
        rewards: {
            description: "+5 Atmo-Processor Cap",
            stats: { cacheCapacity: { "atmos_processors": 5 }, amYieldMult: 0, creditYieldMult: 0, globalEntropyRed: 0 }
        }
    },
    10: {
        projectName: "Directorate Wing Alpha",
        lore: "Constructing the first major administrative wing. This command center coordinates trade fleets, boosting credit efficiency.",
        cost: 1500000,
        requirements: { "propellant": 30, "graphene_lattices": 5 },
        rewards: {
            description: "+1 Officer Slot (Total: 3), +10% Credit Yield",
            stats: { cacheCapacity: {}, amYieldMult: 0, creditYieldMult: 0.10, globalEntropyRed: 0 }
        }
    },
    11: { projectName: "Station Expansion L11", lore: "Expanding core infrastructure.", cost: 2000000, requirements: { "water_ice": 120, "hydroponics": 20 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    12: { projectName: "Station Expansion L12", lore: "Reinforcing structural pylons.", cost: 2600000, requirements: { "plasteel": 160 }, rewards: { description: "-2% Global Entropy", stats: { globalEntropyRed: 0.02 } } },
    13: { projectName: "Station Expansion L13", lore: "Upgrading life support.", cost: 3300000, requirements: { "cybernetics": 30 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    14: { projectName: "Station Expansion L14", lore: "Optimizing network nodes.", cost: 4100000, requirements: { "propellant": 50 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    15: { projectName: "Directorate Wing Beta", lore: "A major administrative expansion.", cost: 5000000, requirements: { "processors": 30, "cryo_pods": 4 }, rewards: { description: "+1 Officer Slot (Total: 4)", stats: {} } },

    // --- INDUSTRIALIZATION PHASE (Levels 16-35) ---
    16: { projectName: "Station Expansion L16", lore: "Deep space sensors.", cost: 6500000, requirements: { "graphene_lattices": 30 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    17: { projectName: "Station Expansion L17", lore: "Commercial docking bay.", cost: 8200000, requirements: { "water_ice": 300, "plasteel": 300 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    18: { projectName: "Station Expansion L18", lore: "Advanced recycling.", cost: 10200000, requirements: { "hydroponics": 160 }, rewards: { description: "-2% Global Entropy", stats: { globalEntropyRed: 0.02 } } },
    19: { projectName: "Station Expansion L19", lore: "Cryo-storage optimization.", cost: 12500000, requirements: { "cybernetics": 80, "cryo_pods": 10 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    20: { projectName: "Directorate Wing Gamma", lore: "A command center upgrade.", cost: 15000000, requirements: { "cloned_organs": 3, "processors": 60 }, rewards: { description: "+1 Officer Slot (Total: 5)", stats: {} } },

    21: { projectName: "Station Expansion L21", lore: "Heavy industry fabrication.", cost: 20000000, requirements: { "propellant": 160 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    22: { projectName: "Station Expansion L22", lore: "Hull integrity mesh.", cost: 26000000, requirements: { "graphene_lattices": 70 }, rewards: { description: "-2% Global Entropy", stats: { globalEntropyRed: 0.02 } } },
    23: { projectName: "Station Expansion L23", lore: "Reactor coolant loop.", cost: 33000000, requirements: { "water_ice": 600 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    24: { projectName: "Station Expansion L24", lore: "Server farm redundancy.", cost: 41000000, requirements: { "atmos_processors": 5 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    25: { projectName: "Directorate Wing Delta", lore: "Strategic operations center.", cost: 50000000, requirements: { "plasteel": 600, "cloned_organs": 6 }, rewards: { description: "+1 Officer Slot (Total: 6)", stats: {} } },

    26: { projectName: "Station Expansion L26", lore: "Luxury habitat ring.", cost: 65000000, requirements: { "hydroponics": 300 }, rewards: { description: "+15% Credit Yield", stats: { creditYieldMult: 0.15 } } },
    27: { projectName: "Station Expansion L27", lore: "Advanced shield harmonics.", cost: 82000000, requirements: { "cybernetics": 160 }, rewards: { description: "-3% Global Entropy", stats: { globalEntropyRed: 0.03 } } },
    28: { projectName: "Station Expansion L28", lore: "Particle accelerator.", cost: 102000000, requirements: { "propellant": 300 }, rewards: { description: "+8% Antimatter Yield", stats: { amYieldMult: 0.08 } } },
    29: { projectName: "Station Expansion L29", lore: "Xeno-research lab.", cost: 125000000, requirements: { "xeno_geologicals": 3 }, rewards: { description: "+10% Credit Yield", stats: { creditYieldMult: 0.10 } } },
    30: { projectName: "Directorate Wing Epsilon", lore: "Interstellar logistics hub.", cost: 150000000, requirements: { "graphene_lattices": 160, "sentient_ai": 2 }, rewards: { description: "+1 Officer Slot (Total: 7)", stats: {} } },

    31: { projectName: "Station Expansion L31", lore: "Solar array massive.", cost: 190000000, requirements: { "plasteel": 1000 }, rewards: { description: "+10% Antimatter Yield", stats: { amYieldMult: 0.10 } } },
    32: { projectName: "Station Expansion L32", lore: "Automated repair drones.", cost: 240000000, requirements: { "processors": 200 }, rewards: { description: "-4% Global Entropy", stats: { globalEntropyRed: 0.04 } } },
    33: { projectName: "Station Expansion L33", lore: "Trade federation embassy.", cost: 300000000, requirements: { "water_ice": 1600 }, rewards: { description: "+20% Credit Yield", stats: { creditYieldMult: 0.20 } } },
    34: { projectName: "Station Expansion L34", lore: "Deep storage vaults.", cost: 370000000, requirements: { "propellant": 500 }, rewards: { description: "+5% Antimatter Yield", stats: { amYieldMult: 0.05 } } },
    35: { projectName: "Directorate Wing Zeta", lore: "High command nexus.", cost: 450000000, requirements: { "cybernetics": 400, "cloned_organs": 20 }, rewards: { description: "+1 Officer Slot (Total: 8)", stats: {} } },

    // --- DOMINANCE PHASE (Levels 36-50) ---
    36: { projectName: "Station Expansion L36", lore: "Quantum comms array.", cost: 580000000, requirements: { "graphene_lattices": 300 }, rewards: { description: "+15% Credit Yield", stats: { creditYieldMult: 0.15 } } },
    37: { projectName: "Station Expansion L37", lore: "Antimatter containment V2.", cost: 740000000, requirements: { "plasteel": 1600 }, rewards: { description: "-5% Global Entropy", stats: { globalEntropyRed: 0.05 } } },
    38: { projectName: "Station Expansion L38", lore: "Bio-dome complex.", cost: 930000000, requirements: { "hydroponics": 800 }, rewards: { description: "+10% Antimatter Yield", stats: { amYieldMult: 0.10 } } },
    39: { projectName: "Station Expansion L39", lore: "AI synthesis core.", cost: 1150000000, requirements: { "sentient_ai": 6 }, rewards: { description: "+25% Credit Yield", stats: { creditYieldMult: 0.25 } } },
    40: { projectName: "Directorate Wing Eta", lore: "Orbital governance seat.", cost: 1500000000, requirements: { "processors": 600, "xeno_geologicals": 8 }, rewards: { description: "+1 Officer Slot (Total: 9)", stats: {} } },

    41: { projectName: "Station Expansion L41", lore: "Dyson swarm prototypes.", cost: 2000000000, requirements: { "graphene_lattices": 500 }, rewards: { description: "+15% Antimatter Yield", stats: { amYieldMult: 0.15 } } },
    42: { projectName: "Station Expansion L42", lore: "Adaptive hull geometry.", cost: 2800000000, requirements: { "plasteel": 2400 }, rewards: { description: "-5% Global Entropy", stats: { globalEntropyRed: 0.05 } } },
    43: { projectName: "Station Expansion L43", lore: "Inter-system gate.", cost: 3800000000, requirements: { "propellant": 1000 }, rewards: { description: "+30% Credit Yield", stats: { creditYieldMult: 0.30 } } },
    44: { projectName: "Station Expansion L44", lore: "Neural uplink grid.", cost: 5200000000, requirements: { "cybernetics": 1000 }, rewards: { description: "+10% Antimatter Yield", stats: { amYieldMult: 0.10 } } },
    45: { projectName: "Directorate Wing Theta", lore: "System control authority.", cost: 7000000000, requirements: { "sentient_ai": 16, "cloned_organs": 80 }, rewards: { description: "+1 Officer Slot (Total: 10)", stats: {} } },

    46: { projectName: "Station Expansion L46", lore: "Reality anchor.", cost: 9300000000, requirements: { "xeno_geologicals": 24 }, rewards: { description: "-10% Global Entropy", stats: { globalEntropyRed: 0.10 } } },
    47: { projectName: "Station Expansion L47", lore: "Market manipulation matrix.", cost: 12200000000, requirements: { "processors": 1200 }, rewards: { description: "+50% Credit Yield", stats: { creditYieldMult: 0.50 } } },
    48: { projectName: "Station Expansion L48", lore: "Star-lifting drones.", cost: 16000000000, requirements: { "graphene_lattices": 800 }, rewards: { description: "+20% Antimatter Yield", stats: { amYieldMult: 0.20 } } },
    49: { projectName: "Station Expansion L49", lore: "Ascension Spire.", cost: 20500000000, requirements: { "plasteel": 4000 }, rewards: { description: "Maximum Efficiency", stats: { globalEntropyRed: 0.10 } } },
    50: { 
        projectName: "The Sol Citadel", 
        lore: "The ultimate expression of orbital dominance. Sol Station is now the capital of the system.", 
        cost: 25000000000, 
        requirements: { "water_ice": 4000, "propellant": 1600, "sentient_ai": 30 }, 
        rewards: { 
            description: "+1 Officer Slot (Total: 11), +100% Credit Yield, +50% Antimatter Yield", 
            stats: { creditYieldMult: 1.0, amYieldMult: 0.50 } 
        } 
    }
};