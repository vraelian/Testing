// js/data/officers.js
/**
 * @fileoverview Registry of all Sol Station Directorate officers.
 * Officers are acquired via missions and events, providing passive buffs to the station when assigned.
 * Includes support for expanded modifiers: capacityMods and consumptionMods, as well as UI properties like rarity and lore.
 */

export const OFFICERS = {
    // --- I. THE GENERALISTS (Common / Low Uncommon) ---
    "off_eclasia": {
        id: "off_eclasia",
        name: "Eclasia",
        role: "Resource Warden",
        rarity: "common",
        description: "Safe baseline arbitrage. Her strict audits ensure no credits are lost to systemic inefficiency.",
        lore: "Audits mining yields to prevent embezzlement by labor crews. Carries an encrypted ledger capable of freezing corporate assets instantaneously.",
        buffs: { entropy: 0, creditMult: 0.10, amMult: 0, capacityMods: {}, consumptionMods: {} }
    },
    "off_eapuria": {
        id: "off_eapuria",
        name: "Eapuria",
        role: "Colony Administrator",
        rarity: "common",
        description: "Eases the early feeding loop for the most consumed good. Scales up the station's ice reservoirs.",
        lore: "Manages a remote mining outpost on the edge of the system. Brews synthetic alcohol to maintain morale among the workers.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: { "water_ice": 1000 }, consumptionMods: {} }
    },
    "off_qualisus": {
        id: "off_qualisus",
        name: "Qualisus",
        role: "Systems Architect",
        rarity: "common",
        description: "Slightly slows the bleeding. His redundant backups prevent catastrophic structural cascades.",
        lore: "Designs the redundant computer networks that run station infrastructure. Fears a total system collapse and keeps analog backups.",
        buffs: { entropy: -0.05, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: {} }
    },
    "off_dorae": {
        id: "off_dorae",
        name: "Dorae",
        role: "Franchise Owner",
        rarity: "common",
        description: "Provides a simple logistical buffer for orbital fuel reserves.",
        lore: "Operates a successful chain of refueling depots across the outer rim. Aggressive towards competitors who attempt to undercut set fuel prices.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: { "propellant": 500 }, consumptionMods: {} }
    },
    "off_harklinore": {
        id: "off_harklinore",
        name: "Harklinore",
        role: "Consortium Lead",
        rarity: "common",
        description: "Increases the storage ceiling for the primary hull-repair commodity based on his corporate mining ties.",
        lore: "Represents a unified block of mining corporations in Guild senate hearings. Collects rare geological samples from industrially fractured moons.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: { "plasteel": 500 }, consumptionMods: {} }
    },
    "off_melini": {
        id: "off_melini",
        name: "Melini",
        role: "Fleet Commodore",
        rarity: "common",
        description: "Her expert convoy routing reduces the station's orbital thruster fuel burn.",
        lore: "Coordinates the Guild's massive automated convoy routes to avoid hazardous spatial anomalies. Plays classical violin over the fleet comms during downtime.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "propellant": 0.10 } }
    },
    "off_nepydoria": {
        id: "off_nepydoria",
        name: "Nepydoria",
        role: "Extraction Director",
        rarity: "common",
        description: "Highly efficient processing of raw asteroid materials saves Tier 5 resources.",
        lore: "Oversees the strip-mining operations of captured asteroids. Donates anonymously to environmental restoration funds on Earth.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "xeno_geologicals": 0.15 } }
    },
    "off_perfurine": {
        id: "off_perfurine",
        name: "Perfurine",
        role: "Bio-Dome Curator",
        rarity: "common",
        description: "Expands the internal gardens, providing a safe buffer for organic supplies.",
        lore: "Maintains the delicate ecosystem of the luxury station parks. Imports real soil from Earth at exorbitant personal cost.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: { "hydroponics": 500 }, consumptionMods: {} }
    },
    "off_petrinor": {
        id: "off_petrinor",
        name: "Petrinor",
        role: "Flight Director",
        rarity: "uncommon",
        description: "A tiny, penalty-free bump to Antimatter synthesis through flawless telemetry alignment.",
        lore: "Monitors the real-time telemetry of thousands of active flights. Communicates exclusively in hexadecimal when stressed.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0.05, capacityMods: {}, consumptionMods: {} }
    },
    "off_simmerick": {
        id: "off_simmerick",
        name: "Simmerick",
        role: "Research Director",
        rarity: "uncommon",
        description: "Pushes the reactor slightly harder to test his efficiency theories, causing minor degradation.",
        lore: "Leads experimental projects to improve ion drive efficiency. Believes that FTL travel is a solvable mathematical riddle.",
        buffs: { entropy: 0.02, creditMult: 0, amMult: 0.10, capacityMods: {}, consumptionMods: {} }
    },
    "off_oepureem": {
        id: "off_oepureem",
        name: "Oepureem",
        role: "High Marshal",
        rarity: "uncommon",
        description: "Absolute authority means zero waste. A flat, tiny reduction in burn across the board.",
        lore: "Commands the station's customs and internal audit divisions with absolute authority. Possesses a deep hatred for the chaotic economic influence of the Syndicate.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "water_ice": 0.05, "plasteel": 0.05, "hydroponics": 0.05, "propellant": 0.05, "cybernetics": 0.05, "processors": 0.05, "graphene_lattices": 0.05, "cryo_pods": 0.05, "atmo_processors": 0.05, "cloned_organs": 0.05, "xeno_geologicals": 0.05, "sentient_ai": 0.05 } }
    },
    "off_zidola": {
        id: "off_zidola",
        name: "Zidola",
        role: "Surveillance Chief",
        rarity: "uncommon",
        description: "Her obsessive attention to detail roots out minor systemic inefficiencies and cargo embezzlement.",
        lore: "Known for an obsession with detail in reviewing security footage. Enjoys vacationing on Europa to escape the digital noise.",
        buffs: { entropy: -0.02, creditMult: 0.05, amMult: 0, capacityMods: {}, consumptionMods: {} }
    },

    // --- II. THE SPECIALISTS (Uncommon / Rare) ---
    "off_rosarian": {
        id: "off_rosarian",
        name: "Rosarian",
        role: "Refinery Overseer",
        rarity: "rare",
        description: "Heavily anchors cooling needs, but the intense heat of his operations melts advanced components.",
        lore: "Manages the volatile chemical reactions of fuel refinement plants. Views fire as a living entity that must be tamed.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "water_ice": 0.35, "cybernetics": -0.20, "processors": -0.20, "graphene_lattices": -0.20, "cryo_pods": -0.20, "atmo_processors": -0.20, "cloned_organs": -0.20, "xeno_geologicals": -0.20, "sentient_ai": -0.20 } }
    },
    "off_luzicia": {
        id: "off_luzicia",
        name: "Luzicia",
        role: "Physics Head",
        rarity: "rare",
        description: "Speeds up the endgame AM grind, but the solar anomalies she exploits cause faster station degradation.",
        lore: "Studies the gravitational anomalies of the sun to improve energy harvesting. Refuses to communicate with non-scientific personnel.",
        buffs: { entropy: 0.10, creditMult: 0, amMult: 0.25, capacityMods: {}, consumptionMods: {} }
    },
    "off_disophlonese": {
        id: "off_disophlonese",
        name: "Disophlonese",
        role: "Regional Viceroy",
        rarity: "rare",
        description: "Massively reduces decay, but slashes storage space, requiring high-frequency, low-volume cargo drops.",
        lore: "Administers Guild law across a vast and sparsely populated sector of space. Developing a philosophy based on the silence of the vacuum.",
        buffs: { entropy: -0.15, creditMult: 0, amMult: 0, capacityMods: { "water_ice": -500, "plasteel": -500, "hydroponics": -500, "propellant": -500, "cybernetics": -500, "processors": -500, "graphene_lattices": -100, "cryo_pods": -100, "atmo_processors": -100, "cloned_organs": -20, "xeno_geologicals": -20, "sentient_ai": -10 }, consumptionMods: {} }
    },
    "off_myrnos": {
        id: "off_myrnos",
        name: "Myrnos",
        role: "Convoy Marshal",
        rarity: "uncommon",
        description: "Densely packs structural cargo with architectural precision, though the concentrated heavy mass accelerates orbit decay.",
        lore: "Calculates precise orbital trajectories to maximize fuel efficiency for heavy cargo haulers. Obsessed with the logistical perfection of ancient Roman aqueducts.",
        buffs: { entropy: 0.10, creditMult: 0, amMult: 0, capacityMods: { "plasteel": 1500, "cybernetics": 1500 }, consumptionMods: {} }
    },
    "off_hallast": {
        id: "off_hallast",
        name: "Hallast",
        role: "Naval Architect",
        rarity: "rare",
        description: "Excellent for long-term structural health, but his zero-g refits disrupt commercial docking bays.",
        lore: "Designs the skeletal frames of the next generation of heavy lifters. Suffers from bone density loss due to a life in zero-g.",
        buffs: { entropy: 0, creditMult: -0.10, amMult: 0, capacityMods: {}, consumptionMods: { "plasteel": 0.25 } }
    },
    "off_kimridon": {
        id: "off_kimridon",
        name: "Kimridon",
        role: "Fabrication Chief",
        rarity: "rare",
        description: "Prints money, but uses up vast amounts of computational power for his secret metal sculptures.",
        lore: "Controls the nanotech vats that print ship components. Creates abstract sculptures out of scrap metal in secret.",
        buffs: { entropy: 0, creditMult: 0.20, amMult: 0, capacityMods: {}, consumptionMods: { "processors": -0.30 } }
    },
    "off_droysia": {
        id: "off_droysia",
        name: "Droysia",
        role: "Chief Geneticist",
        rarity: "rare",
        description: "Radiation-resistant crops save massive amounts of organic supplies, but the ambient radiation eats at the station hull.",
        lore: "Engineers crops capable of growing in high-radiation environments. Has modified their own DNA to require less sleep.",
        buffs: { entropy: 0.15, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "hydroponics": 0.35, "cloned_organs": 0.35 } }
    },
    "off_lysander": {
        id: "off_lysander",
        name: "Lysander",
        role: "Terraforming Lead",
        rarity: "uncommon",
        description: "Perfectly balances the air scrubbers, but requires significantly more water to run the humidity simulations.",
        lore: "Models atmospheric changes for planetary rehabilitation over centuries. Names every simulation after a distinct emotion.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "atmo_processors": 0.35, "water_ice": -0.15 } }
    },
    "off_xanadu": {
        id: "off_xanadu",
        name: "Xanadu",
        role: "System Governor",
        rarity: "rare",
        description: "Heavy market regulation drives massive commercial profit, but completely stifles the creative scientific environment needed for AM synthesis.",
        lore: "Administers strict trade embargoes and corporate sanctions for the entire Jovian sector with zero tolerance for deviation. Composes symphonies based on the electromagnetic hum of Jupiter.",
        buffs: { entropy: 0.05, creditMult: 0.30, amMult: -0.15, capacityMods: {}, consumptionMods: {} }
    },
    "off_pryderi": {
        id: "off_pryderi",
        name: "Pryderi",
        role: "Apex Director",
        rarity: "very_rare",
        description: "Incredible wealth generation, but his corporate mergers require massive systemic payouts and resource expenditures to maintain.",
        lore: "Holds final authority on all inter-corporate mergers and acquisitions within the Guild. Collects fossilized dinosaur bones retrieved from Earth.",
        buffs: { entropy: 0, creditMult: 0.40, amMult: 0, capacityMods: {}, consumptionMods: { "water_ice": -0.30, "plasteel": -0.30, "hydroponics": -0.30, "propellant": -0.30, "cybernetics": -0.30, "processors": -0.30, "graphene_lattices": -0.30, "cryo_pods": -0.30, "atmo_processors": -0.30, "cloned_organs": -0.30, "xeno_geologicals": -0.30, "sentient_ai": -0.30 } }
    },
    "off_kaelith": {
        id: "off_kaelith",
        name: "Kaelith",
        role: "Grand Strategist",
        rarity: "rare",
        description: "Predicts system stresses before they happen, slowing decay beautifully, but her obsession with market simulations hurts actual commercial yield.",
        lore: "Simulates hostile corporate takeovers against the Syndicate to predict market crashes before they happen. Fascinated by the irrational concept of gambling.",
        buffs: { entropy: -0.20, creditMult: -0.15, amMult: 0, capacityMods: {}, consumptionMods: {} }
    },
    "off_orestes": {
        id: "off_orestes",
        name: "Orestes",
        role: "Void Chancellor",
        rarity: "rare",
        description: "Expands storage specifically for the most esoteric, ancient, and endgame items.",
        lore: "Dictates the foreign policy and trade rights of the outer rim settlements. Refuses to speak directly to anyone under the age of sixty.",
        buffs: { entropy: 0.15, creditMult: 0, amMult: 0, capacityMods: { "sentient_ai": 1000, "cryo_pods": 1000 }, consumptionMods: {} }
    },
    "off_mnemosyne": {
        id: "off_mnemosyne",
        name: "Mnemosyne",
        role: "Chief Neural Architect",
        rarity: "rare",
        description: "Saves from hauling extremely expensive tech components, but her nostalgia-driven network drops commercial efficiency.",
        lore: "Designs the consciousness frameworks for the next generation of sentient capital ships. Experiences nostalgia for data formats that no longer exist.",
        buffs: { entropy: 0, creditMult: -0.10, amMult: 0, capacityMods: {}, consumptionMods: { "sentient_ai": 0.30, "processors": 0.30 } }
    },
    "off_cassander": {
        id: "off_cassander",
        name: "Cassander",
        role: "Trade Sovereign",
        rarity: "rare",
        description: "Artificial scarcity fills his pockets, but his modified scout ships take up massive amounts of hangar space, reducing basic storage.",
        lore: "Possesses the power to embargo entire space stations with a single digital signature. Races modified scout ships through debris fields for sport.",
        buffs: { entropy: 0, creditMult: 0.25, amMult: 0, capacityMods: { "water_ice": -800, "plasteel": -800, "hydroponics": -800, "propellant": -800 }, consumptionMods: {} }
    },
    "off_themis": {
        id: "off_themis",
        name: "Themis",
        role: "High Inquisitor",
        rarity: "very_rare",
        description: "Eliminates all corporate theft, phenomenally improving resource retention. However, her aggressive investigations terrify merchants, crippling income.",
        lore: "Investigates extreme corporate fraud and embezzlement within the upper ranks of the Merchant's Guild. Deletes its own personality files weekly to remain impartial.",
        buffs: { entropy: 0, creditMult: -0.40, amMult: 0, capacityMods: {}, consumptionMods: { "water_ice": 0.25, "plasteel": 0.25, "hydroponics": 0.25, "propellant": 0.25, "cybernetics": 0.25, "processors": 0.25, "graphene_lattices": 0.25, "cryo_pods": 0.25, "atmo_processors": 0.25, "cloned_organs": 0.25, "xeno_geologicals": 0.25, "sentient_ai": 0.25 } }
    },
    "off_chronos": {
        id: "off_chronos",
        name: "Chronos",
        role: "Prime Logistics Officer",
        rarity: "rare",
        description: "Perfect mathematical efficiency scales everything up equally—including the station's inevitable demise.",
        lore: "Optimizes the movement of every grain of rice in the sector to prevent famine. Finds beauty in the mathematical efficiency of starvation.",
        buffs: { entropy: 0.15, creditMult: 0.15, amMult: 0.15, capacityMods: {}, consumptionMods: {} }
    },
    "off_argus": {
        id: "off_argus",
        name: "Argus",
        role: "Panopticon Overseer",
        rarity: "rare",
        description: "Sees every microscopic hull fracture before it spreads. Needs massive computational storage to process the camera feeds.",
        lore: "Processes visual data from every public camera in the inner system simultaneously. Watches old pre-collapse cinema to understand human deceit.",
        buffs: { entropy: -0.10, creditMult: 0, amMult: 0, capacityMods: { "processors": 1000 }, consumptionMods: {} }
    },
    "off_helios": {
        id: "off_helios",
        name: "Helios",
        role: "Energy Sovereign",
        rarity: "very_rare",
        description: "Opening the arrays to 'hear the sun' grants absurd AM synthesis but bakes the station's outer plating.",
        lore: "Monopolizes the solar collection arrays orbiting near Mercury. Claims to hear the voice of the sun during solar flares.",
        buffs: { entropy: 0.25, creditMult: 0, amMult: 0.35, capacityMods: {}, consumptionMods: {} }
    },
    "off_metis": {
        id: "off_metis",
        name: "Metis",
        role: "Media Mogul",
        rarity: "very_rare",
        description: "Spins Sol Station as a luxury destination, bringing in massive wealth, but the influx of tourists causes logistical chaos and disrupts AM colliders.",
        lore: "Controls the news feeds that shape public opinion across the solar system. Writes fiction under a pseudonym to experience creativity.",
        buffs: { entropy: 0.20, creditMult: 0.50, amMult: -0.20, capacityMods: {}, consumptionMods: {} }
    },

    // --- III. THE HYPER-RARE MAVERICKS (Rule Breakers) ---
    "off_hyperion": {
        id: "off_hyperion",
        name: "Hyperion",
        role: "Antimatter Baron",
        rarity: "hyper_rare",
        description: "Generates AM at an absurd rate, but cuts storage in half and nearly doubles decay. For local inner-system loops only.",
        lore: "Controls the limited supply of FTL fuel remnants saved from the Ad Astra era. Wears a suit lined with lead to signal status.",
        buffs: { entropy: 0.75, creditMult: 0, amMult: 1.50, capacityMods: { "water_ice": -1000, "plasteel": -1000, "hydroponics": -1000, "propellant": -1000, "cybernetics": -1000, "processors": -1000, "graphene_lattices": -500, "cryo_pods": -500, "atmo_processors": -500, "cloned_organs": -100, "xeno_geologicals": -100, "sentient_ai": -50 }, consumptionMods: {} }
    },
    "off_atlas": {
        id: "off_atlas",
        name: "Atlas",
        role: "Infrastructure Apex",
        rarity: "hyper_rare",
        description: "The Macro-Management savior. Produces almost nothing, but his structural micro-management creates enough physical storage buffer to survive deep outer-rim trips unattended.",
        lore: "Literally holds the station together by micro-managing structural stress in real-time. Fears the silence that would come with a total power failure.",
        buffs: { entropy: 0, creditMult: -0.75, amMult: -0.75, capacityMods: { "water_ice": 2500, "plasteel": 2500, "hydroponics": 2500, "propellant": 2500, "cybernetics": 2500, "processors": 2500 }, consumptionMods: {} }
    },
    "off_nemesis": {
        id: "off_nemesis",
        name: "Nemesis",
        role: "Syndicate Shadow",
        rarity: "hyper_rare",
        description: "Effectively halts the burn of hyper-expensive goods, but guzzles basic resources like a black hole to mask her operations.",
        lore: "Orchestrates system-wide black market fluctuations from the shadows. Never appears in person and uses multiple body doubles.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0, capacityMods: {}, consumptionMods: { "water_ice": -1.50, "plasteel": -1.50, "hydroponics": -1.50, "propellant": -1.50, "cybernetics": -1.50, "processors": -1.50, "cloned_organs": 0.35, "xeno_geologicals": 0.35, "sentient_ai": 0.35 } }
    },
    "off_aurelius": {
        id: "off_aurelius",
        name: "Aurelius",
        role: "Corporate Monarch",
        rarity: "hyper_rare",
        description: "Liquidates physical health for raw, immediate wealth. Prints money, but requires dumping massive fleet cargo holds into the station daily to keep it alive.",
        lore: "Rules a sovereign corporate state that operates independent of Guild oversight. Seeks a cure for the psychological weight of immortality.",
        buffs: { entropy: 0, creditMult: 1.50, amMult: -0.50, capacityMods: {}, consumptionMods: { "water_ice": -1.50, "plasteel": -1.50, "hydroponics": -1.50, "propellant": -1.50, "cybernetics": -1.50, "processors": -1.50, "graphene_lattices": -1.50, "cryo_pods": -1.50, "atmo_processors": -1.50, "cloned_organs": -1.50, "xeno_geologicals": -1.50, "sentient_ai": -1.50 } }
    },
    "off_lethe": {
        id: "off_lethe",
        name: "Lethe",
        role: "Legacy Guardian",
        rarity: "hyper_rare",
        description: "The Pause Button. Protecting the cryo-tombs drops the station to minimum viable power. Decay drops to a crawl, and production stops.",
        lore: "Protects the cryo-tombs of the sleeping ultra-rich waiting for the future. Reads bedtime stories to the frozen bodies in the vault.",
        buffs: { entropy: -0.75, creditMult: -1.00, amMult: -1.00, capacityMods: {}, consumptionMods: {} }
    },

    // --- IV. THE NOOB-TRAPS (Misleading Efficiencies) ---
    "off_tyche": {
        id: "off_tyche",
        name: "Tyche",
        role: "Banking Magnate",
        rarity: "rare",
        description: "Siphons off a quarter of the station's total yield to pay off her private planetary debts. The loss in yield drastically outweighs the cargo saved from her decay reduction.",
        lore: "Owns the private debt of three separate planetary governments. Cultivates poisonous flowers in a private zero-g garden.",
        buffs: { entropy: -0.15, creditMult: -0.25, amMult: -0.25, capacityMods: {}, consumptionMods: {} }
    },
    "off_tantalus": {
        id: "off_tantalus",
        name: "Tantalus",
        role: "Resource Tycoon",
        rarity: "very_rare",
        description: "The increased entropy scales against the massive new volume. Burns significantly more cargo overall just to keep the larger caches full, draining bank accounts to feed his hoarding.",
        lore: "Hoards strategic stockpiles of water ice to artificially drive up prices. Fears dying of thirst despite owning entire glaciers.",
        buffs: { entropy: 0.25, creditMult: 0, amMult: 0, capacityMods: { "water_ice": 3000, "plasteel": 3000, "hydroponics": 3000, "propellant": 3000, "cybernetics": 3000, "processors": 3000, "graphene_lattices": 3000, "cryo_pods": 3000, "atmo_processors": 3000, "cloned_organs": 3000, "xeno_geologicals": 3000, "sentient_ai": 3000 }, consumptionMods: {} }
    },
    "off_rhea": {
        id: "off_rhea",
        name: "Rhea",
        role: "Bio-Engineering CEO",
        rarity: "very_rare",
        description: "Because Rhea refuses to use her own products, the station quietly chews through your most expensive, hard-to-find cargo at a bankrupting pace to sustain the AM boost.",
        lore: "Holds the patents for the most popular synthetic organ replacements in the market. Refuses to use their own products out of paranoia.",
        buffs: { entropy: 0, creditMult: 0, amMult: 0.40, capacityMods: {}, consumptionMods: { "cloned_organs": -1.50, "cybernetics": -1.50 } }
    },

    // --- V. THE JOKE OFFICER (Hard Mode) ---
    "off_valerion": {
        id: "off_valerion",
        name: "Valerion",
        role: "Board Chairman",
        rarity: "hyper_rare",
        description: "Pure, unadulterated sabotage. Spends millions of the budget on illicit treatments, bleeding caches dry while halting all production. Slot at your own peril.",
        lore: "Controls the voting shares of the three largest mining conglomerates in the system. Spends millions annually on illegal stem-cell rejuvenation treatments.",
        buffs: { entropy: 5.00, creditMult: -0.95, amMult: -0.95, capacityMods: {}, consumptionMods: {} }
    }
};