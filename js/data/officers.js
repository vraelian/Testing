// js/data/officers.js
/**
 * @fileoverview Registry of all Sol Station Directorate officers.
 * Officers are acquired via missions and provide passive buffs to the station when assigned.
 * Includes support for expanded modifiers: capacityMods and consumptionMods, as well as UI properties like rarity and lore.
 */

export const OFFICERS = {
    // --- OPERATIONS (Entropy Reduction) ---
    "off_ops_alpha": {
        id: "off_ops_alpha",
        name: "Cmdr. Harken",
        role: "Operations",
        rarity: "valuable",
        description: "A veteran of the Jupiter run. Specialized in structural integrity and decay mitigation.",
        lore: "Lost his original command during the Jovian blockades. Now channels his meticulous obsession with protocol into station structural integrity, ensuring every bulkhead holds.",
        buffs: { entropy: -0.05, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: {} } // -5% Decay
    },
    "off_ops_beta": {
        id: "off_ops_beta",
        name: "Lt. Syla",
        role: "Operations",
        rarity: "uncommon",
        description: "Former station architect. Her maintenance algorithms are highly efficient at preserving Plasteel.",
        lore: "A former black-market architect who designed hidden bays for smugglers. She understands orbital stresses better than the Guild's own supercomputers.",
        buffs: { entropy: -0.05, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "plasteel": 0.15 } } // -5% Decay, -15% Plasteel Burn
    },

    // --- LOGISTICS (Credit Yield) ---
    "off_log_alpha": {
        id: "off_log_alpha",
        name: "Broker Krell",
        role: "Logistics",
        rarity: "rare",
        description: "A ruthless negotiator who squeezes every credit out of station commerce.",
        lore: "Exiled from the Venusian Exchange for being 'too cutthroat.' Krell's financial models operate on quantum probabilities, squeezing unimaginable profit from standard routes.",
        buffs: { entropy: 0, creditMult: 0.15, amMult: 0, capacityMods: {}, consumptionMods: {} } // +15% Credits
    },
    "off_log_beta": {
        id: "off_log_beta",
        name: "Quartermaster Vance",
        role: "Logistics",
        rarity: "valuable",
        description: "Optimizes supply chains to maximize commercial throughput and expand Ice storage.",
        lore: "Used to manage supply drops for outer-rim terraforming projects. Can fit twice as much water ice into a reservoir than the manufacturer's maximum limits.",
        buffs: { entropy: 0, creditMult: 0.10, amMult: 0, capacityMods: { "water_ice": 25000 }, consumptionMods: {} } // +10% Credits, +25k Ice Capacity
    },

    // --- ENGINEERING (Antimatter Yield) ---
    "off_eng_alpha": {
        id: "off_eng_alpha",
        name: "Dr. Aris",
        role: "Engineering",
        rarity: "rare",
        description: "Particle physicist obsessed with maximizing collider efficiency.",
        lore: "Authored the controversial 'Aris Conjecture' regarding folding space. Aris is legally barred from operating drives but remains unparalleled at synthesizing Antimatter.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0.10, capacityMods: {}, consumptionMods: {} } // +10% Antimatter
    },
    "off_eng_beta": {
        id: "off_eng_beta",
        name: "Chief O'Rin",
        role: "Engineering",
        rarity: "hyper_rare",
        description: "Pushing the reactor beyond safety limits is his specialty.",
        lore: "A mad genius who treats safety regulations as mere suggestions. He can push a reactor to extraordinary outputs, provided the station doesn't shake itself apart in the process.",
        buffs: { entropy: 0.05, creditMult: 0, amMult: 0.30, capacityMods: {}, consumptionMods: {} } // +30% Antimatter, but +5% Decay (Trade-off)
    },

    // --- TEST OFFICERS (Sol Station V1 Testing) ---
    "off_test_logistics": {
        id: "off_test_logistics",
        name: "Chief Halloway",
        role: "Logistics",
        rarity: "common",
        description: "[TEST] A specialist in hydrological storage solutions.",
        lore: "Halloway spent twenty years managing water reserves on Ganymede. He brings that same efficient stacking protocol to Sol Station.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: { "water_ice": 60 }, consumptionMods: {} } // +30% Base Cap (Level 1)
    },
    "off_test_engineer": {
        id: "off_test_engineer",
        name: "Eng. Vance",
        role: "Engineering",
        rarity: "rare",
        description: "[TEST] An expert in entropy reduction, but expensive to maintain.",
        lore: "Vance's methods are incredibly effective at stabilizing the station's decay, but his salary requirements eat into the station's bottom line.",
        buffs: { entropy: -0.10, creditMult: -0.05, amMult: 0, capacityMods: {}, consumptionMods: {} } // -10% Entropy, -5% Credits
    }
};