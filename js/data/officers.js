/**
 * @fileoverview Registry of all Sol Station Directorate officers.
 * Officers are acquired via missions and provide passive buffs to the station when assigned.
 */

export const OFFICERS = {
    // --- OPERATIONS (Entropy Reduction) ---
    "off_ops_alpha": {
        id: "off_ops_alpha",
        name: "Cmdr. Harken",
        role: "Operations",
        description: "A veteran of the Jupiter run. Specialized in structural integrity and decay mitigation.",
        buffs: { entropy: -0.05, creditMult: 0, amMult: 0 } // -5% Decay
    },
    "off_ops_beta": {
        id: "off_ops_beta",
        name: "Lt. Syla",
        role: "Operations",
        description: "Former station architect. Her maintenance algorithms are highly efficient.",
        buffs: { entropy: -0.10, creditMult: 0, amMult: 0 } // -10% Decay
    },

    // --- LOGISTICS (Credit Yield) ---
    "off_log_alpha": {
        id: "off_log_alpha",
        name: "Broker Krell",
        role: "Logistics",
        description: "A ruthless negotiator who squeezes every credit out of station commerce.",
        buffs: { entropy: 0, creditMult: 0.15, amMult: 0 } // +15% Credits
    },
    "off_log_beta": {
        id: "off_log_beta",
        name: "Quartermaster Vance",
        role: "Logistics",
        description: "Optimizes supply chains to maximize commercial throughput.",
        buffs: { entropy: 0, creditMult: 0.25, amMult: 0 } // +25% Credits
    },

    // --- ENGINEERING (Antimatter Yield) ---
    "off_eng_alpha": {
        id: "off_eng_alpha",
        name: "Dr. Aris",
        role: "Engineering",
        description: "Particle physicist obsessed with maximizing collider efficiency.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0.10 } // +10% Antimatter
    },
    "off_eng_beta": {
        id: "off_eng_beta",
        name: "Chief O'Rin",
        role: "Engineering",
        description: "Pushing the reactor beyond safety limits is his specialty.",
        buffs: { entropy: 0.05, creditMult: 0, amMult: 0.30 } // +30% Antimatter, but +5% Decay (Trade-off)
    }
};