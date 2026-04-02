// js/data/database.js
import { LOCATION_IDS, PERK_IDS, SHIP_IDS, COMMODITY_IDS, SCREEN_IDS, TUTORIAL_ACTION_TYPES, ACTION_IDS, NAV_IDS } from './constants.js';
import { MISSION_REGISTRY } from './missions/missionRegistry.js';
import { RANDOM_EVENTS } from './events.js';
import { AGE_EVENTS } from './age_events.js';
// --- [[START]] VIRTUAL WORKBENCH (Phase 3) ---
import { SHIP_DATABASE } from './ship_database.js';
// --- [[END]] VIRTUAL WORKBENCH (Phase 3) ---
// --- [[START]] VIRTUAL WORKBENCH (Phase 6) ---
import { CONSUMABLES } from './items.js';
// --- [[END]] VIRTUAL WORKBENCH (Phase 6) ---
// --- SYSTEM STATES V3 ---
import { SYSTEM_STATE_REGISTRY } from './systemStateRegistry.js';
// --- END SYSTEM STATES V3 ---

// --- In-Game Date Configuration ---
export const DATE_CONFIG = {
    START_YEAR: 2220,
    START_DAY_OF_WEEK: 1, // 0 = Sunday, 1 = Monday, etc.
    DAYS_IN_MONTH: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    MONTH_NAMES: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    DAY_NAMES: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
};

export const DB = {
    // --- Core Game Configuration ---
    CONFIG: {
        INTEL_COST_PERCENTAGE: 0.10,
        INTEL_MIN_CREDITS: 5000,
        INTEL_CHANCE: 0.3,
        INTEL_DEMAND_MOD: 1.8,
        INTEL_DEPRESSION_MOD: 0.5,
    },

    SYSTEM_STATES: SYSTEM_STATE_REGISTRY,

    DATE_CONFIG: DATE_CONFIG,

    // --- New Game Introduction Sequence ---
    INTRO_SEQUENCE_V1: {
      modals: [
        {
          id: 'lore_1',
          title: 'Year 2220',
          description: `<div class="w-full aspect-video border border-gray-600 mb-4 rounded overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.5)] bg-black flex items-center justify-center">
                            <img src="assets/images/modals/intro/intro_1.webp" class="w-full h-full object-cover transition-opacity duration-300" 
                            onerror="this.parentElement.innerHTML='Image Data Missing'; this.parentElement.className='w-full aspect-video bg-gray-800 border border-gray-600 mb-4 flex items-center justify-center text-gray-500 rounded'">
                        </div>
                        Humanity has expanded throughout the Solar System.<br><br> <span class="hl">Commerce</span> has thrived among the numerous colonies and stations longer than living memory.`,
          buttonText: 'Begin',
          contentClass: 'text-center',
          buttonClass: 'btn-intro-cyan delayed-fade-in-8s'
        },
        {
          id: 'lore_2',
          title: "The Price of Freedom",
          description: `<div class="w-full aspect-video border border-gray-600 mb-4 rounded overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.5)] bg-black flex items-center justify-center">
                            <img src="assets/images/modals/intro/intro_2.webp" class="w-full h-full object-cover transition-opacity duration-300" 
                            onerror="this.parentElement.innerHTML='Image Data Missing'; this.parentElement.className='w-full aspect-video bg-gray-800 border border-gray-600 mb-4 flex items-center justify-center text-gray-500 rounded'">
                        </div>
                        You are a logistics specialist for a corporate mining company in the Asteroid Belt. You've traded your youth for endless shifts in the dark, with little to show for it.<br><br>This dead-end grind pays the bills, but it will never yield the <b class='hl-green font-bold'>prosperity</b> that you dream of. The <span class='hl'>Merchant's Guild</span> could fund your ambition, but their price is steep.<br><br>You choose to bet on yourself and borrow the credits for a ship, quit your job, and chart your own course.`,
          buttonText: 'Apply for Loan',
          contentClass: 'text-center',
          buttonClass: 'btn-pulse-green'
        },
        {
          id: 'charter',
          title: "<span class=\"hl font-orbitron text-[26px] text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] block text-center w-full\">MERCHANT'S GUILD<br>LOAN AGREEMENT</span>",
          description: `
            <div class="font-roboto-mono text-left text-sm space-y-2">
                <p><span class="text-gray-400">CHARTER ID:</span> G7-K491-38B</p>
                <p><span class="text-gray-400">CREDIT AMOUNT:</span> <span class="credits-text-pulsing text-cyan-400 font-bold text-[15px] drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]">⌬ 25,000</span></p>
                <p><span class="text-gray-400">INTEREST RATE:</span> <span class="text-red-500">1.56%</span> (Monthly)</p>
            </div>
            <div class="border-t border-slate-600 my-4"></div>
            <p class="text-sm text-gray-400 text-justify">Herein, the Applicant agrees to the terms of repayment and interest accrual, subject to the Interstellar Commerce Mandates of the Merchant's Guild. This binding digital agreement is logged on the system-wide ledger, whereupon it is considered immutable and enforceable system-wide. The principal of the debt is due in 1095 Terran-standard days, after which failure to remit payment shall authorize the automatic initiation of a garnishment sub-routine against the Applicant's credit.</p>
          `,
          buttonText: 'Accept Terms',
          buttonClass: 'btn-pulse-gold'
        },
        {
            id: 'signature',
            title: "<span class=\"hl font-orbitron text-[26px] text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] block text-center w-full\">SIGNATURE REQUIRED</span>",
            description: `
            <p class="text-[15px] text-gray-400 text-justify mb-4">I, the undersigned, do hereby accept the aforementioned terms and enter into this agreement with the Merchant's Guild. My signature, digitally rendered, shall serve as my legal mark.</p>
            <div class="text-yellow-500 text-center font-roboto-mono mt-4">
                <p>INTEREST: <span class="text-red-500 font-bold">⌬ 390</span> / MONTH</p>
                <p>DUE DATE: 3 YEARS</p>
            </div>
          `,
          buttonText: 'Submit Application'
        },
        {
            id: 'final',
            title: 'Low On Credits!',
            description: "Interest on your debt grows every month. It's time to make some <b class='hl-yellow font-bold'>credits</b>. Let's view the <b>Mission Terminal</b> here on <b>Mars</b>!",
            buttonText: 'View Missions'
        }
      ]
    },

    // --- Visual Representations for Locations ---
    LOCATION_VISUALS: {
        [LOCATION_IDS.EARTH]: '🌍',
        [LOCATION_IDS.LUNA]: '🌕',
        [LOCATION_IDS.MARS]: '🔴',
        [LOCATION_IDS.VENUS]: '🟡',
        [LOCATION_IDS.BELT]: '🪨',
        [LOCATION_IDS.SATURN]: '🪐',
        [LOCATION_IDS.JUPITER]: '🟠',
        [LOCATION_IDS.URANUS]: '🔵',
        [LOCATION_IDS.NEPTUNE]: '🟣',
        [LOCATION_IDS.PLUTO]: '🪩',
        [LOCATION_IDS.EXCHANGE]: '🏴‍☠️',
        [LOCATION_IDS.KEPLER]: '👁️',
        [LOCATION_IDS.SUN]: '☀️',
        [LOCATION_IDS.MERCURY]: '🥵'
    },

    TRAVEL_VISUALS: {
        zones: {
            inner_sphere: {
                locations: [LOCATION_IDS.SUN, LOCATION_IDS.MERCURY, LOCATION_IDS.EARTH, LOCATION_IDS.LUNA, LOCATION_IDS.MARS, LOCATION_IDS.BELT],
                gradient: ['#0f172a', '#1e3a8a']
            },
            outer_reaches: {
                locations: [LOCATION_IDS.JUPITER, LOCATION_IDS.SATURN, LOCATION_IDS.URANUS, LOCATION_IDS.NEPTUNE],
                gradient: ['#0f172a', '#312e81']
            }
        },
        objects: {
            'earth_to_mars': [{ type: 'planet', emoji: '🌕', position: { x: 0.5, y: 0.3 }, scale: 0.8, speed: 0.3 }],
            'belt_to_jupiter': [{ type: 'asteroid_field', count: 15, speed: 0.2 }]
        }
    },

    // --- Player Perks and Their Effects ---
    PERKS: {
        [PERK_IDS.TRADEMASTER]: { profitBonus: 0.05 },
        [PERK_IDS.NAVIGATOR]: { fuelMod: 0.9, hullDecayMod: 0.9, travelTimeMod: 0.9 },
        [PERK_IDS.VENETIAN_SYNDICATE]: { fuelDiscount: 0.25, repairDiscount: 0.25 }
    },

    // --- Narrative Events Triggered by Game Progression ---
    AGE_EVENTS: AGE_EVENTS,

    // --- Random Events Encountered During Travel ---
    RANDOM_EVENTS: RANDOM_EVENTS,

    // --- [[START]] VIRTUAL WORKBENCH (Phase 3) ---
    SHIPS: SHIP_DATABASE,
    // --- [[END]] VIRTUAL WORKBENCH (Phase 3) ---
    
    // --- [[START]] VIRTUAL WORKBENCH (Phase 6) ---
    ITEMS: CONSUMABLES,
    // --- [[END]] VIRTUAL WORKBENCH (Phase 6) ---

    // --- Tradable Commodities Data ---
    COMMODITIES: [
        { id: COMMODITY_IDS.WATER_ICE, name: 'Water Ice', tier: 1, basePriceRange: [15, 80], volatility: 0.01, canonicalAvailability: [250, 450], styleClass: 'item-style-1', lore: 'Crude, unrefined water ice scraped from asteroids; a universal necessity.', cat: 'RAW', symbol: 'H2O' },
        { id: COMMODITY_IDS.PLASTEEL, name: 'Plasteel', tier: 1, basePriceRange: [320, 640], volatility: 0.015, canonicalAvailability: [250, 450], styleClass: 'item-style-2', lore: 'A basic, versatile polymer for 3D printing and simple manufacturing.', cat: 'IND', symbol: 'PLST' },
        
        { id: COMMODITY_IDS.HYDROPONICS, name: 'Hydroponics', tier: 2, licenseId: 't2_license', basePriceRange: [1200, 2500], volatility: 0.025, canonicalAvailability: [150, 250], styleClass: 'item-style-3', lore: 'Packaged agricultural systems and produce essential for feeding isolated colonies.', cat: 'AGRI', symbol: 'HYD' },
        { id: COMMODITY_IDS.CYBERNETICS, name: 'Cybernetics', tier: 2, licenseId: 't2_license', basePriceRange: [4000, 8000], volatility: 0.03, canonicalAvailability: [150, 250], styleClass: 'item-style-4', lore: 'Mass-produced enhancement limbs and organs for the industrial workforce.', cat: 'TECH', symbol: 'CYB' },
        
        { id: COMMODITY_IDS.PROPELLANT, name: 'Refined Propellant', tier: 3, licenseId: 't3_license', basePriceRange: [12000, 25000], volatility: 0.035, canonicalAvailability: [100, 180], styleClass: 'item-style-5', lore: 'High-efficiency fuel that powers all modern ship drives.', cat: 'IND', symbol: 'PROP' },
        { id: COMMODITY_IDS.PROCESSORS, name: 'Neural Processors', tier: 3, licenseId: 't3_license', basePriceRange: [35000, 70000], volatility: 0.045, canonicalAvailability: [100, 180], styleClass: 'item-style-6', lore: 'The silicon brains behind complex ship systems and station logistics.', cat: 'TECH', symbol: 'NPRO' },
        
        { id: COMMODITY_IDS.GRAPHENE_LATTICES, name: 'Graphene Lattices', tier: 4, licenseId: 't4_license', basePriceRange: [100000, 200000], volatility: 0.05, canonicalAvailability: [60, 120], styleClass: 'item-style-7', lore: 'Ultra-light, diamond-hard carbon sheets produced in zero-G foundries. The structural backbone of every orbital habitat.', cat: 'IND', symbol: 'GRPH' },
        { id: COMMODITY_IDS.CRYO_PODS, name: 'Cryo-Sleep Pods', tier: 4, licenseId: 't4_license', basePriceRange: [300000, 600000], volatility: 0.075, canonicalAvailability: [60, 120], styleClass: 'item-style-8', lore: 'Essential for long-haul passenger transport and colonization efforts.', cat: 'CIV', symbol: 'CRYO' },
        
        { id: COMMODITY_IDS.ATMO_PROCESSORS, name: 'Atmo Processors', tier: 5, licenseId: 't5_license', basePriceRange: [800000, 1500000], volatility: 0.08, canonicalAvailability: [30, 70], styleClass: 'item-style-9', lore: 'Gargantuan machines that begin the centuries-long process of making a world breathable.', cat: 'IND', symbol: 'ATMO' },
        { id: COMMODITY_IDS.CLONED_ORGANS, name: 'Cloned Organs', tier: 5, licenseId: 't5_license', basePriceRange: [2000000, 4000000], volatility: 0.09, canonicalAvailability: [30, 70], styleClass: 'item-style-10', lore: 'Lab-grown replacements with high demand in wealthy core worlds; morally grey.', cat: 'BIO', symbol: 'CLON' },
        
        { id: COMMODITY_IDS.XENO_GEOLOGICALS, name: 'Xeno-Geologicals', tier: 6, licenseId: 't6_license', basePriceRange: [6000000, 12000000], volatility: 0.1, canonicalAvailability: [20, 48], styleClass: 'item-style-11', lore: 'Rare, non-terrestrial minerals with bizarre physical properties; a scientific treasure.', cat: 'RAW', symbol: 'XENO' },
        { id: COMMODITY_IDS.SENTIENT_AI, name: 'Sentient AI Cores', tier: 6, licenseId: 't6_license', basePriceRange: [15000000, 30000000], volatility: 0.125, canonicalAvailability: [10, 24], styleClass: 'item-style-12', lore: 'The "brains" of capital ships whose emergent consciousness is a subject of intense, and often classified, philosophical debate.', cat: 'TECH', symbol: 'AI' },
        
        // Tier 7 (Sol Station Outputs) - Generated, rarely bought, purely for massive cashing out.
        { id: COMMODITY_IDS.ANTIMATTER, name: 'Antimatter', tier: 7, licenseId: 't7_license', basePriceRange: [50000000, 100000000], volatility: 0.15, canonicalAvailability: [5, 12], styleClass: 'item-style-13', lore: 'The only safe way to transport the most volatile and powerful substance known to science.', cat: 'RARE', symbol: 'AM' },
        { id: COMMODITY_IDS.FOLDED_DRIVES, name: 'Folded-Space Drives', tier: 7, licenseId: 't7_license', basePriceRange: [150000000, 300000000], volatility: 0.15, canonicalAvailability: [1, 2], styleClass: 'item-style-14', lore: 'The pinnacle of travel tech, allowing a vessel to pierce spacetime for near-instantaneous jumps.', cat: 'RARE', symbol: 'FSD' }
    ],

    // --- Trading Licenses ---
    LICENSES: {
        't2_license': { type: 'mission', name: 'Tier 2 Trade License', description: 'Grants access to trade Tier 2 commodities like Hydroponics and Cybernetics.', missionId: 'mission_17', guidanceText: 'Trading higher value commodities requires a <b>Tier 2 License</b>.<br><br>Perhaps a contact in your network may be able to help.' },
        't3_license': { type: 'mission', name: 'Tier 3 Trade License', description: 'Grants access to trade Tier 3 commodities.', missionId: 'mission_license_t3', guidanceText: 'Access to this tier is granted by the Merchant\'s Guild upon completion of a key contract.' },
        't4_license': { type: 'purchase', name: 'Tier 4 Trade License', description: 'Grants access to trade Tier 4 commodities.', cost: 35000000 },
        't5_license': { type: 'mission', name: 'Tier 5 Trade License', description: 'Grants access to trade Tier 5 commodities.', missionId: 'mission_license_t5', guidanceText: 'Prove your industrial might by completing a grand contract for a planetary governor.' },
        't6_license': { type: 'purchase', name: 'Tier 6 Trade License', description: 'Grants access to trade the rarest and most exotic technologies.', cost: 1200000000 },
        't7_license': { type: 'mission', name: 'Tier 7 Trade License', description: 'The ultimate license, granting the right to trade reality-bending technologies.', missionId: 'mission_license_t7', guidanceText: 'Only a true legend of the trade routes can earn this privilege.' },
    },

    // --- Market and Location Data ---
    MARKETS: [
        { 
            id: LOCATION_IDS.SUN, 
            name: 'Sol Station', 
            distance: 45, 
            launchFlavor: "Plunge inward toward the corona, where extreme thermal stress threatens any hull daring enough to reach the massive solar harvester.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #f59e0b, #9a3412)', textColor: '#fef3c7', borderColor: '#f59e0b' }, 
            description: "This perilous forge consumes endless structural materials to generate the system's most valuable and volatile commodity.", 
            color: 'border-yellow-500', 
            bg: 'bg-gradient-to-br from-yellow-600 to-orange-900', 
            fuelPrice: 50, 
            arrivalLore: [
                "The blinding brilliance of the primordial star dominates the viewport as your ship groans under the immense heat radiating from the colossal solar engine.",
                "Solar flares lick at the edges of your shielding as the awe-inspiring silhouette of the massive harvesting array eclipses the sun.",
                "Warning klaxons wail as thermal stress tests the limits of your hull against the furious backdrop of the solar corona.",
                "The terrifying majesty of the star fills every monitor, reducing your vessel to a mere speck against the roaring plasma storms."
            ], 
            specialty: "• +25% Sell Price: Plasteel & Graphene<br>• Massive structural import capacity<br>• Premium Endgame Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.GRAPHENE_LATTICES]: 0.5,
                [COMMODITY_IDS.PLASTEEL]: 0.5,
                [COMMODITY_IDS.ANTIMATTER]: 2.0
            },
            ecoProfile: { 
                commodityReplenishRates: { [COMMODITY_IDS.PLASTEEL]: 0.03, [COMMODITY_IDS.GRAPHENE_LATTICES]: 0.03 }, 
                dampeners: { [COMMODITY_IDS.PLASTEEL]: 0.5, [COMMODITY_IDS.GRAPHENE_LATTICES]: 0.5 } 
            },
            intelProfile: { costMod: 1.30, minDiscount: 0.30, maxDiscount: 0.60, focusCats: ['RARE', 'BIO', 'TECH'] }
        },
        { 
            id: LOCATION_IDS.MERCURY, 
            name: 'Mercury', 
            distance: 58, 
            launchFlavor: "Navigate the sun's blistering glare to reach the heavily cratered surface of the system's innermost rock.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #7f1d1d, #44403c)', textColor: '#e7e5e4', borderColor: '#a8a29e' }, 
            description: "Desperate for water to sustain its subterranean workforce, this scorched outpost operates a highly volatile, fast-moving market.", 
            color: 'border-stone-400', 
            bg: 'bg-gradient-to-br from-stone-600 to-red-900', 
            fuelPrice: 500, 
            arrivalLore: [
                "Searing solar radiation washes over a bleak, grey landscape scarred by strip-mining and deep, shadowed craters.",
                "A fractured horizon of scorched stone and deep fissures rolls beneath you as you approach the subterranean entry gates.",
                "The oppressive proximity of the sun bakes the cracked surface of this tidally locked mining colony.",
                "Plumes of automated dust extractors are the only movement on this blindingly bright, merciless rock."
            ], 
            specialty: "• +40% Sell Price: Water Ice<br>• Extreme Water Ice volatility<br>• Fast-expiring Fringe Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.WATER_ICE]: 0.1,
                [COMMODITY_IDS.PLASTEEL]: 2.0
            },
            ecoProfile: { replenishRate: 0.05, panicMult: 2.0, commodityReplenishRates: { [COMMODITY_IDS.PLASTEEL]: 0.15 } },
            intelProfile: { costMod: 0.75, durationMod: 0.90 }
        },
        { 
            id: LOCATION_IDS.VENUS, 
            name: 'Venus', 
            distance: 97, 
            launchFlavor: "Descend through a dense, acidic atmosphere to dock at the opulent, floating cloud-cities of the Syndicate.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #854d0e, #0f172a)', textColor: '#fde047', borderColor: '#facc15' }, 
            description: "An extravagant haven of scientific research where erratic technology markets and heavily discounted corporate data streams reward the bold.", 
            color: 'border-yellow-400', 
            bg: 'bg-gradient-to-br from-yellow-800 to-slate-900', 
            fuelPrice: 400, 
            arrivalLore: [
                "Gilded platforms drift gracefully through violently swirling, toxic yellow clouds, projecting an aura of untouchable wealth.",
                "Lightning arcs through the crushing, acidic atmosphere, illuminating the luxurious underbellies of suspended habitats.",
                "Opulent spires pierce the thick, corrosive fog, offering a stark contrast between the lethal environment and the syndicate's extravagance.",
                "The golden haze of the cloud-deck parts to reveal sprawling, buoyant estates anchored securely above the planetary inferno."
            ], 
            specialty: "• 50% Intel Discount & 30% Longer Duration<br>• Highly volatile Tech market<br>• Focused on Data & Tech Goods", 
            availabilityModifier: { 
                [COMMODITY_IDS.CLONED_ORGANS]: 2.0, 
                [COMMODITY_IDS.PROCESSORS]: 2.0, 
                [COMMODITY_IDS.SENTIENT_AI]: 0.5,
                [COMMODITY_IDS.ATMO_PROCESSORS]: 0.5
            },
            ecoProfile: { pressureMod: 1.15 },
            intelProfile: { costMod: 0.50, durationMod: 1.30, focusCats: ['TECH'] }
        },
        { 
            id: LOCATION_IDS.EARTH, 
            name: 'Earth', 
            distance: 180, 
            launchFlavor: "Plot a highly regulated transit vector toward the serene, meticulously gardened homeworld.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #1e3a8a, #0f172a)', textColor: '#93c5fd', borderColor: '#60a5fa' }, 
            description: "The wealthy, post-scarcity cradle of humanity boasts incredibly stable prices and an insatiable corporate appetite for bio-wares.", 
            color: 'border-cyan-500', 
            bg: 'bg-gradient-to-br from-blue-900 to-slate-900', 
            fuelPrice: 250, 
            arrivalLore: [
                "The vibrant blue and green marble hums with a staggering, luminous web of ceaseless orbital traffic.",
                "Pristine, geo-engineered continents and tranquil oceans rotate beneath a gleaming mesh of orbital luxury stations.",
                "Endless streams of cargo haulers and sleek yachts navigate the pristine, heavily regulated orbitals of the ancestral world.",
                "The atmosphere below is perfectly filtered, a pristine garden maintained by vast networks of silent, planetary logic engines."
            ], 
            specialty: "• +10% Sell Price: Organs & Xeno-Geology<br>• Highly stable, inelastic prices<br>• Premium Corp-Espionage Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.HYDROPONICS]: 2.0, 
                [COMMODITY_IDS.CYBERNETICS]: 2.0, 
                [COMMODITY_IDS.CLONED_ORGANS]: 0.5, 
                [COMMODITY_IDS.XENO_GEOLOGICALS]: 0.5 
            },
            ecoProfile: { pressureMod: 0.70 },
            intelProfile: { costMod: 1.15, durationMod: 1.20, focusCats: ['BIO', 'TECH'] }
        },
        { 
            id: LOCATION_IDS.LUNA, 
            name: 'The Moon', 
            parent: 'loc_earth', 
            distance: 15, 
            launchFlavor: "Drop into the shadow of Earth to dock with its tirelessly churning, dust-covered satellite.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #374151, #0f172a)', textColor: '#e5e7eb', borderColor: '#9ca3af' }, 
            description: "A bustling industrial hub specializing in rapid raw material turnover and heavily discounted shipyard services.", 
            color: 'border-gray-400', 
            bg: 'bg-gradient-to-br from-gray-700 to-slate-900', 
            fuelPrice: 350, 
            arrivalLore: [
                "Sprawling grey plains are dominated by massive, utilitarian drydocks and ceaseless, dust-kicking extraction crawlers.",
                "The stark, airless landscape is illuminated by the harsh, flickering glare of industrial foundries and orbital shipyards.",
                "Endless grids of processing plants and cargo rails scar the surface of the pale, silent moon.",
                "A constellation of landing lights guides you toward a colossal, subterranean logistics hub buried deep within the lunar rock."
            ], 
            specialty: "• 20% Discount on Ship Repairs<br>• Fast raw material restock<br>• Reliable Industrial Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.PLASTEEL]: 2.0, 
                [COMMODITY_IDS.GRAPHENE_LATTICES]: 2.0, 
                [COMMODITY_IDS.WATER_ICE]: 0.5, 
                [COMMODITY_IDS.HYDROPONICS]: 0.5 
            },
            ecoProfile: { replenishRate: 0.12 },
            intelProfile: { focusCats: ['IND', 'RAW'] }
        },
        { 
            id: LOCATION_IDS.MARS, 
            name: 'Mars', 
            distance: 226, 
            launchFlavor: "Chart a course across the inner system to the rust-red sphere of endless corporate expansion.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #7c2d12, #0f172a)', textColor: '#fca5a5', borderColor: '#f87171' }, 
            description: "A rapidly expanding colonial frontier eager to pay a premium for water and structural plastics.", 
            color: 'border-orange-600', 
            bg: 'bg-gradient-to-br from-orange-900 to-slate-900', 
            fuelPrice: 450, 
            arrivalLore: [
                "Sprawling industrial foundries and immense habitation structures pierce the thin, reddish atmosphere and sweeping desert dunes.",
                "A vast, rust-colored desert stretches out below, interrupted only by the sprawling geometry of expanding corporate colonies.",
                "Massive dust storms sweep across the plains, obscuring the colossal industrial habitats that cling to the red rock.",
                "The pale sun glints off the reinforced glass of immense agricultural domes dotting the harsh, arid landscape."
            ], 
            specialty: "• +10% Sell Price: Water & Hydroponics<br>• Slow agricultural restock<br>• Standard Market Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.PLASTEEL]: 0.3, 
                [COMMODITY_IDS.XENO_GEOLOGICALS]: 2.0, 
                [COMMODITY_IDS.WATER_ICE]: 0.5, 
                [COMMODITY_IDS.HYDROPONICS]: 0.5 
            },
            ecoProfile: { commodityReplenishRates: { [COMMODITY_IDS.HYDROPONICS]: 0.08, [COMMODITY_IDS.WATER_ICE]: 0.08 } },
            intelProfile: {}
        },
        { 
            id: LOCATION_IDS.BELT, 
            name: 'The Belt', 
            distance: 292, 
            launchFlavor: "Navigate cautiously through a dense, unpredictable expanse of tumbling rock and unsanctioned transit signals.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #292524, #0f172a)', textColor: '#ca8a04', borderColor: '#a16207' }, 
            description: "A sprawling expanse of unrefined wealth where rapid material extraction drives a wildly unpredictable and fractured economy.", 
            color: 'border-amber-700', 
            bg: 'bg-gradient-to-br from-stone-800 to-slate-900', 
            fuelPrice: 600, 
            arrivalLore: [
                "Countless jagged asteroids dance in silent, deadly orbits, concealing rugged mining rigs and hidden dangers.",
                "Shadows shift rapidly across the tumbling debris field as automated drills carve into the icy bellies of passing rocks.",
                "Your vessel carefully threads the needle through a dense, chaotic storm of grinding, mineral-rich fragments.",
                "A haphazard network of tethered rocks and makeshift processing platforms emerges from the dense, spinning void."
            ], 
            specialty: "• Rapid raw material restock<br>• Erratic, chaotic Intel market", 
            availabilityModifier: { 
                [COMMODITY_IDS.WATER_ICE]: 2.0, 
                [COMMODITY_IDS.XENO_GEOLOGICALS]: 2.0, 
                [COMMODITY_IDS.HYDROPONICS]: 0.5, 
                [COMMODITY_IDS.CYBERNETICS]: 0.5 
            },
            ecoProfile: { replenishRate: 0.15 },
            intelProfile: { minDiscount: 0.05, maxDiscount: 0.60, durationMod: 0.50, costMod: 0.80 }
        },
        { 
            id: LOCATION_IDS.EXCHANGE, 
            name: 'The Exchange', 
            distance: 309, 
            launchFlavor: "Disengage primary transponders and drift quietly into the deepest, unmapped recesses of the outer asteroid belt.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #581c87, #000000, #0f172a)', textColor: '#e9d5ff', borderColor: '#c084fc' }, 
            description: "A deeply concealed hub of shadow commerce where staggering fortunes are wagered on volatile, unsanctioned trade goods.", 
            color: 'border-purple-500', 
            bg: 'bg-gradient-to-br from-purple-900 via-black to-slate-900', 
            fuelPrice: 1200, 
            arrivalLore: [
                "A colossal, hollowed-out asteroid bristles with intense sensory baffles, radiating an aura of absolute, paranoid secrecy.",
                "The jagged surface of the shadowy trade hub remains utterly dark to standard scanners, existing only as a void against the stars.",
                "Endless streams of unmarked vessels slide silently into the yawning, unlit hangar bays of this massive rock.",
                "A labyrinth of heavily encrypted approach vectors and silent docking clamps surrounds the deeply isolated market hub."
            ], 
            specialty: "• 3x Price Volatility<br>• Extremely fragile market (crashes easily)<br>• Black Market Smuggler Intel", 
            availabilityModifier: {
                [COMMODITY_IDS.SENTIENT_AI]: 2.0,
                [COMMODITY_IDS.CLONED_ORGANS]: 2.0,
                [COMMODITY_IDS.ANTIMATTER]: 0.5,
                [COMMODITY_IDS.XENO_GEOLOGICALS]: 0.5
            },
            ecoProfile: { pressureMod: 1.30 },
            intelProfile: { focusCats: ['TECH', 'BIO', 'RARE'] }
        },
        { 
            id: LOCATION_IDS.JUPITER, 
            name: 'Jupiter', 
            distance: 443, 
            launchFlavor: "Undertake a long haul to the system's largest gravity well and its sprawling network of orbital refineries.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #9a3412, #1c1917)', textColor: '#fed7aa', borderColor: '#fb923c' }, 
            description: "A titan of industry built on massive subsidies, offering a remarkably stable and heavily discounted propellant market.", 
            color: 'border-orange-400', 
            bg: 'bg-gradient-to-br from-orange-800 to-stone-900', 
            fuelPrice: 150, 
            arrivalLore: [
                "The gas giant's churning, multicolored bands and baleful storm systems loom ominously over automated fuel siphons.",
                "A terrifying expanse of swirling ammonia clouds completely devours the horizon, anchoring a web of delicate orbital extractors.",
                "The sheer scale of the banded planet induces vertigo as your ship joins the endless line of bulk propellant haulers.",
                "Silent lightning flashes within the colossal, bruised atmosphere below the endless, skeletal rigging of the industrial rings."
            ], 
            specialty: "• 50% Discount on Fuel<br>• Highly stable Fuel market<br>• Industrial-focused Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.PROPELLANT]: 2.0, 
                [COMMODITY_IDS.PLASTEEL]: 0.5, 
                [COMMODITY_IDS.ATMO_PROCESSORS]: 0.5 
            },
            ecoProfile: { dampeners: { [COMMODITY_IDS.PROPELLANT]: 0.20 }, commodityReplenishRates: { [COMMODITY_IDS.PROPELLANT]: 0.20 } },
            intelProfile: { focusCats: ['IND'] }
        },
        { 
            id: LOCATION_IDS.SATURN, 
            name: 'Saturn', 
            distance: 618, 
            launchFlavor: "Traverse the cold void toward the magnificent planetary rings and heavily taxed commercial airspace.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #713f12, #312e81, #0f172a)', textColor: '#fef08a', borderColor: '#fde047' }, 
            description: "An opulent tourist destination with steep service fees but exceptional payouts for luxury and biological goods to sustain the elite.", 
            color: 'border-yellow-200', 
            bg: 'bg-gradient-to-br from-yellow-900 via-indigo-900 to-slate-900', 
            fuelPrice: 550, 
            arrivalLore: [
                "Golden, icy rings cast striking shadows across extravagant resort stations designed to pamper the wealthiest planetary executives.",
                "Millions of glittering ice particles drift past the sweeping, transparent promenades of high-orbit luxury habitats.",
                "The breathtaking rings provide a stunning, serene backdrop to the sprawling architectural vanity projects of the corporate elite.",
                "Delicate, crystalline habitats float serenely between the majestic bands of ice and dust, radiating untouchable prosperity."
            ], 
            specialty: "• +20% Sell Price: Organs & Cryo Pods<br>• 200% Cost for Repairs & Fuel<br>• Premium Luxury Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.CYBERNETICS]: 2.0,
                [COMMODITY_IDS.CRYO_PODS]: 0.5, 
                [COMMODITY_IDS.CLONED_ORGANS]: 0.5 
            },
            ecoProfile: { recoveryMod: 1.25 },
            intelProfile: { costMod: 1.25, minDiscount: 0.25, focusCats: ['CIV', 'BIO'] }
        },
        { 
            id: LOCATION_IDS.URANUS, 
            name: 'Uranus', 
            distance: 775, 
            launchFlavor: "Endure a grueling, icy transit into the remote depths of the system to reach the tilted, pale-blue sphere of isolated quantum research.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #155e75, #312e81)', textColor: '#a5f3fc', borderColor: '#67e8f9' }, 
            description: "A distant research collective where highly classified quantum technologies frequently slip into standard trade flows.", 
            color: 'border-cyan-200', 
            bg: 'bg-gradient-to-br from-cyan-800 to-indigo-900', 
            fuelPrice: 700, 
            arrivalLore: [
                "Featureless, pale blue clouds provide a silent backdrop for fragile, glittering outposts suspended in eternal twilight.",
                "The tilted, icy giant hangs silently in the deep dark, orbited by humming arrays of esoteric sensory equipment.",
                "Delicate rings of dark dust frame the freezing, cyan atmosphere of this deeply isolated scientific enclave.",
                "A profound, chilling stillness surrounds the distant, pale orb and its sparse network of high-energy research platforms."
            ], 
            specialty: "• High chance of Advanced Upgrades<br>• Standard market elasticity<br>• Tech & Rare-focused Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.PROCESSORS]: 2.0, 
                [COMMODITY_IDS.SENTIENT_AI]: 0.5, 
                [COMMODITY_IDS.ATMO_PROCESSORS]: 0.5 
            },
            ecoProfile: {},
            intelProfile: { focusCats: ['TECH', 'RARE'] }
        },
        { 
            id: LOCATION_IDS.NEPTUNE, 
            name: 'Neptune', 
            distance: 877, 
            launchFlavor: "Approach the stormy, military-controlled fringes of the outer system with all transponders broadcasting clearly.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #1e3a8a, #000000)', textColor: '#93c5fd', borderColor: '#60a5fa' }, 
            description: "A rigid, unfluctuating military economy offering bulk discounts on essentials to independent captains brave enough to dock.", 
            color: 'border-blue-400', 
            bg: 'bg-gradient-to-br from-blue-900 to-black', 
            fuelPrice: 650, 
            arrivalLore: [
                "Strict formations of Guild escorts guide you through supersonic, dark blue winds toward a heavily reinforced orbital staging ground.",
                "The violent, azure storms of the planet swirl far below the rigid, utilitarian geometry of a high-security staging ground.",
                "Massive, armored bulkheads slide open to receive your vessel against a backdrop of freezing, indigo atmospheric tempests.",
                "Countless security scans sweep your hull as you approach the imposing, unadorned architecture of the Guild's deepest perimeter."
            ], 
            specialty: "• 10% Bulk Discount: Fuel & Plasteel (>50)<br>• Rigid, unfluctuating prices<br>• Tactical Military Intel", 
            availabilityModifier: { 
                [COMMODITY_IDS.CRYO_PODS]: 2.0,
                [COMMODITY_IDS.GRAPHENE_LATTICES]: 2.0,
                [COMMODITY_IDS.PLASTEEL]: 0.5, 
                [COMMODITY_IDS.PROPELLANT]: 0.5 
            },
            ecoProfile: { disableFluctuation: true, meanReversionMod: 1.25 },
            intelProfile: { focusCats: ['CIV', 'IND'] }
        },
        { 
            id: LOCATION_IDS.KEPLER, 
            name: "Kepler's Eye", 
            distance: 903, 
            launchFlavor: "Drift far into the deep-space void toward a solitary, free-floating outpost of profound observation.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #701a75, #0f172a)', textColor: '#f472b6', borderColor: '#ec4899' }, 
            description: "A unique, free-floating intelligence hub where institutional financing is heavily discounted and exclusive market data flows in abundance.", 
            color: 'border-fuchsia-500', 
            bg: 'bg-gradient-to-br from-fuchsia-900 to-slate-900', 
            fuelPrice: 800, 
            arrivalLore: [
                "A breathtaking, colossal glass lens dominates the structure, staring unblinkingly into the cosmic abyss.",
                "Surrounded entirely by the deep black of the outer system, the massive observatory turns its silent gaze toward the unknown.",
                "A fragile lattice of sensory equipment and habitation rings clings to the edges of the largest optical array ever constructed.",
                "The structure feels impossibly lonely, a fragile needle of light and glass piercing the infinite dark of the solar boundary."
            ], 
            specialty: "• 15% Discount on Debt & Financing<br>• Double Intel Packet generation", 
            availabilityModifier: {
                [COMMODITY_IDS.ANTIMATTER]: 2.0,
                [COMMODITY_IDS.FOLDED_DRIVES]: 0.5,
                [COMMODITY_IDS.PROCESSORS]: 0.5
            },
            ecoProfile: {},
            intelProfile: { packetMultiplier: 2 }
        },
        { 
            id: LOCATION_IDS.PLUTO, 
            name: 'Pluto', 
            distance: 1080, 
            launchFlavor: "Commit to the longest, darkest journey to the very edge of human habitation and the solar boundary.", 
            navTheme: { gradient: 'linear-gradient(to bottom right, #312e81, #0f172a)', textColor: '#c4b5fd', borderColor: '#a78bfa' }, 
            description: "A remote fringe market prone to extreme panic pricing, desperate for structural tech but offering deep discounts on classified market data.", 
            color: 'border-indigo-400', 
            bg: 'bg-gradient-to-br from-indigo-900 to-slate-900', 
            fuelPrice: 900, 
            arrivalLore: [
                "A tiny, frozen rock barely illuminated by the distant sun harbors a ramshackle outpost carved straight into nitrogen ice.",
                "The faint, starlight-level illumination barely reveals the jagged, frozen mountains surrounding this desperate edge-world colony.",
                "Deep within a glacial valley, the faint thermal glow of a struggling habitat marks the absolute limit of civilized space.",
                "You dock in utter silence, the sprawling, icy plains outside bathed in the terrifying, perpetual twilight of the Kuiper Belt."
            ], 
            specialty: "• +25% Sell Price: Cybernetics & Antimatter<br>• Extreme price panic on depletion<br>• Jackpot Smuggler Intel (Deep Discounts)", 
            availabilityModifier: { 
                [COMMODITY_IDS.GRAPHENE_LATTICES]: 2.0, 
                [COMMODITY_IDS.XENO_GEOLOGICALS]: 2.0, 
                [COMMODITY_IDS.ANTIMATTER]: 0.5,
                [COMMODITY_IDS.CYBERNETICS]: 0.5 
            },
            ecoProfile: { replenishRate: 0.05, panicMult: 2.0 },
            intelProfile: { minDiscount: 0.40, maxDiscount: 0.75, focusCats: ['BIO', 'TECH', 'RARE'] }
        }
    ],

    // --- Mission Data ---
    MISSIONS: MISSION_REGISTRY
};