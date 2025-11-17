// js/data/database.js
/**
 * @fileoverview
 * This file serves as the central database for all static game data.
 * It consolidates information from previous data, config, and content files
 * into a single, authoritative source. This improves maintainability and clarity
 * by providing a unified structure for all core game content and configuration.
 */
import { LOCATION_IDS, PERK_IDS, SHIP_IDS, COMMODITY_IDS, SCREEN_IDS, TUTORIAL_ACTION_TYPES, ACTION_IDS, NAV_IDS } from './constants.js';
import { MISSIONS } from './missions.js';
import { RANDOM_EVENTS } from './events.js';
import { AGE_EVENTS } from './age_events.js';
import { TUTORIAL_DATA } from './tutorials.js';
// --- [[START]] VIRTUAL WORKBENCH (Phase 3) ---
import { SHIP_DATABASE } from './ship_database.js';
// --- [[END]] VIRTUAL WORKBENCH (Phase 3) ---

// --- In-Game Date Configuration ---
export const DATE_CONFIG = {
    START_YEAR: 2140,
    START_DAY_OF_WEEK: 1, // 0 = Sunday, 1 = Monday, etc.
    DAYS_IN_MONTH: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    MONTH_NAMES: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    DAY_NAMES: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
};

export const SYSTEM_STATES = {
    'NEUTRAL': {
        name: 'Neutral System',
        duration: 28,
        description: "Standard space-faring conditions. Markets are operating under normal parameters.",
        modifiers: {} // No economic deviations
    },
    /* // Example of a disruptive economic state. More can be added here.
    'CORPORATE_WAR': {
        name: 'Corporate War',
        duration: 28,
        description: "Rival corporations have escalated to open conflict, creating high demand for military-grade materials. The Plasteel and Cybernetics markets are in turmoil.",
        modifiers: {
            commodity: {
                'cybernetics': {
                    availability: 0.6,
                    price: 1.4,
                    volatility_mult: 2.5,
                    mean_reversion_mult: 0.3
                },
                'plasteel': {
                    availability: 0.7,
                    price: 1.3,
                    volatility_mult: 2.0,
                    mean_reversion_mult: 0.5
                }
            }
        }
    }
    */
};

export const DB = {
    // --- Core Game Configuration ---
    CONFIG: {
        INTEL_COST_PERCENTAGE: 0.20,
        INTEL_MIN_CREDITS: 5000,
        INTEL_CHANCE: 0.3,
        INTEL_DEMAND_MOD: 1.8,
        INTEL_DEPRESSION_MOD: 0.5,
    },

    SYSTEM_STATES: SYSTEM_STATES,

    DATE_CONFIG: DATE_CONFIG,

    // --- New Game Introduction Sequence ---
    INTRO_SEQUENCE_V1: {
      modals: [
        {
          id: 'lore_1',
          title: 'Year 2140',
          description: "Humanity has expanded throughout the Solar System.<br><br> <span class=\"hl\">Commerce</span> has thrived among the numerous colonies and stations longer than living memory.",
          buttonText: 'Begin',
          contentClass: 'text-center'
        },
        {
          id: 'lore_2',
          title: "The Price of Freedom",
          description: "A dead-end job in the Belt pays the bills, but it does not offer the <b class='hl-green font-bold'>prosperity</b> that you dream of.<br><br>The <span class='hl'>Merchant's Guild</span> will fund your ambition, but their price is steep.<br><br>This is no simple loan; it's a bet on yourself and your future.",
          buttonText: 'Apply for Loan',
          contentClass: 'text-center',
          buttonClass: 'btn-pulse-green'
        },
        {
          id: 'charter',
          title: "<span class=\"hl\">MERCHANT'S GUILD LOAN AGREEMENT</span>",
          description: `
            <div class="font-roboto-mono text-left text-sm space-y-2">
                <p><span class="text-gray-400">CHARTER ID:</span> G7-K491-38B</p>
                <p><span class="text-gray-400">CREDIT AMOUNT:</span> <span class="credits-text-pulsing">⌬ 25,000</span></p>
                <p><span class="text-gray-400">INTEREST RATE:</span> 1.56% (Monthly)</p>
            </div>
            <div class="border-t border-slate-600 my-4"></div>
            <p class="text-sm text-gray-400 text-justify">Herein, the Applicant agrees to the terms of repayment and interest accrual, subject to the Interstellar Commerce Mandates of the Merchant's Guild. This binding digital agreement is logged on the system-wide ledger, whereupon it is considered immutable and enforceable system-wide. The principal of the debt is due in 1095 Terran-standard days, after which failure to remit payment shall authorize the automatic initiation of a garnishment sub-routine against the Applicant's credit.</p>
          `,
          buttonText: 'Accept Terms',
          buttonClass: 'btn-pulse-gold'
        },
        {
          id: 'signature',
          title: 'SIGN YOUR NAME',
          description: `
            <p class="text-sm text-gray-400 text-justify mb-4">I, the undersigned, do hereby accept the aforementioned terms and enter into this agreement with the Merchant's Guild. My signature, digitally rendered, shall serve as my legal mark.</p>
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
        [LOCATION_IDS.KEPLER]: '👁️'
    },

    TRAVEL_VISUALS: {
        zones: {
            inner_sphere: {
                locations: [LOCATION_IDS.EARTH, LOCATION_IDS.LUNA, LOCATION_IDS.MARS, LOCATION_IDS.BELT],
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
    // The old, hardcoded DB.SHIPS object has been removed.
    // It is now replaced by the imported SHIP_DATABASE object from js/data/ship_database.js
    SHIPS: SHIP_DATABASE,
    // --- [[END]] VIRTUAL WORKBENCH (Phase 3) ---

    // --- Tradable Commodities Data ---
    COMMODITIES: [
        { id: COMMODITY_IDS.WATER_ICE, name: 'Water Ice', tier: 1, basePriceRange: [15, 80], volatility: 0.01, canonicalAvailability: [80, 150], styleClass: 'item-style-1', lore: 'Crude, unrefined water ice scraped from asteroids; a universal necessity.', cat: 'RAW', symbol: 'H2O' },
        { id: COMMODITY_IDS.PLASTEEL, name: 'Plasteel', tier: 1, basePriceRange: [100, 280], volatility: 0.015, canonicalAvailability: [80, 150], styleClass: 'item-style-2', lore: 'A basic, versatile polymer for 3D printing and simple manufacturing.', cat: 'IND', symbol: 'PLST' },
        { id: COMMODITY_IDS.HYDROPONICS, name: 'Hydroponics', tier: 2, licenseId: 't2_license', basePriceRange: [850, 2400], volatility: 0.025, canonicalAvailability: [40, 70], styleClass: 'item-style-3', lore: 'Packaged agricultural systems and produce essential for feeding isolated colonies.', cat: 'AGRI', symbol: 'HYD' },
        { id: COMMODITY_IDS.CYBERNETICS, name: 'Cybernetics', tier: 2, licenseId: 't2_license', basePriceRange: [1200, 3800], volatility: 0.03, canonicalAvailability: [40, 70], styleClass: 'item-style-4', lore: 'Mass-produced enhancement limbs and organs for the industrial workforce.', cat: 'TECH', symbol: 'CYB' },
        { id: COMMODITY_IDS.PROPELLANT, name: 'Refined Propellant', tier: 3, licenseId: 't3_license', basePriceRange: [14000, 38000], volatility: 0.035, canonicalAvailability: [25, 50], styleClass: 'item-style-5', lore: 'High-efficiency fuel that powers all modern ship drives.', cat: 'IND', symbol: 'PROP' },
        { id: COMMODITY_IDS.PROCESSORS, name: 'Neural Processors', tier: 3, licenseId: 't3_license', basePriceRange: [18000, 52000], volatility: 0.045, canonicalAvailability: [25, 50], styleClass: 'item-style-6', lore: 'The silicon brains behind complex ship systems and station logistics.', cat: 'TECH', symbol: 'NPRO' },
        { id: COMMODITY_IDS.GMO_SEEDS, name: 'GMO Seed Cultures', tier: 4, licenseId: 't4_license', basePriceRange: [190000, 550000], volatility: 0.06, canonicalAvailability: [15, 30], styleClass: 'item-style-7', lore: 'Patented seeds holding the key to unlocking agricultural wealth on new worlds.', cat: 'AGRI', symbol: 'GMO' },
        { id: COMMODITY_IDS.CRYO_PODS, name: 'Cryo-Sleep Pods', tier: 4, licenseId: 't4_license', basePriceRange: [250000, 750000], volatility: 0.075, canonicalAvailability: [15, 30], styleClass: 'item-style-8', lore: 'Essential for long-haul passenger transport and colonization efforts.', cat: 'CIV', symbol: 'CRYO' },
        { id: COMMODITY_IDS.ATMO_PROCESSORS, name: 'Atmo Processors', tier: 5, licenseId: 't5_license', basePriceRange: [2800000, 8500000], volatility: 0.08, canonicalAvailability: [10, 20], styleClass: 'item-style-9', lore: 'Gargantuan machines that begin the centuries-long process of making a world breathable.', cat: 'IND', symbol: 'ATMO' },
        { id: COMMODITY_IDS.CLONED_ORGANS, name: 'Cloned Organs', tier: 5, licenseId: 't5_license', basePriceRange: [3500000, 11000000], volatility: 0.09, canonicalAvailability: [10, 20], styleClass: 'item-style-10', lore: 'Lab-grown replacements with high demand in wealthy core worlds; morally grey.', cat: 'BIO', symbol: 'CLON' },
        { id: COMMODITY_IDS.XENO_GEOLOGICALS, name: 'Xeno-Geologicals', tier: 6, licenseId: 't6_license', basePriceRange: [24000000, 70000000], volatility: 0.1, canonicalAvailability: [2, 10], styleClass: 'item-style-11', lore: 'Rare, non-terrestrial minerals with bizarre physical properties; a scientific treasure.', cat: 'RAW', symbol: 'XENO' },
        { id: COMMODITY_IDS.SENTIENT_AI, name: 'Sentient AI Cores', tier: 6, licenseId: 't6_license', basePriceRange: [32000000, 95000000], volatility: 0.125, canonicalAvailability: [2, 10], styleClass: 'item-style-12', lore: 'The "brains" of capital ships whose emergent consciousness is a subject of intense, and often classified, philosophical debate.', cat: 'TECH', symbol: 'AI' },
        { id: COMMODITY_IDS.ANTIMATTER, name: 'Antimatter', tier: 7, licenseId: 't7_license', basePriceRange: [280000000, 800000000], volatility: 0.15, canonicalAvailability: [2, 10], styleClass: 'item-style-13', lore: 'The only safe way to transport the most volatile and powerful substance known to science.', cat: 'RARE', symbol: 'AM' },
        { id: COMMODITY_IDS.FOLDED_DRIVES, name: 'Folded-Space Drives', tier: 7, licenseId: 't7_license', basePriceRange: [350000000, 1100000000], volatility: 0.15, canonicalAvailability: [2, 10], styleClass: 'item-style-14', lore: 'The pinnacle of travel tech, allowing a vessel to pierce spacetime for near-instantaneous jumps.', cat: 'RARE', symbol: 'FSD' }
    ],

    // --- Trading Licenses ---
    LICENSES: {
        't2_license': { type: 'purchase', name: 'Tier 2 Trade License', description: 'Grants access to trade Tier 2 commodities like Hydroponics and Cybernetics.', cost: 25000 },
        't3_license': { type: 'mission', name: 'Tier 3 Trade License', description: 'Grants access to trade Tier 3 commodities.', missionId: 'mission_license_t3', guidanceText: 'Access to this tier is granted by the Merchant\'s Guild upon completion of a key contract.' },
        't4_license': { type: 'purchase', name: 'Tier 4 Trade License', description: 'Grants access to trade Tier 4 commodities.', cost: 4000000 },
        't5_license': { type: 'mission', name: 'Tier 5 Trade License', description: 'Grants access to trade Tier 5 commodities.', missionId: 'mission_license_t5', guidanceText: 'Prove your industrial might by completing a grand contract for a planetary governor.' },
        't6_license': { type: 'purchase', name: 'Tier 6 Trade License', description: 'Grants access to trade the rarest and most exotic technologies.', cost: 300000000 },
        't7_license': { type: 'mission', name: 'Tier 7 Trade License', description: 'The ultimate license, granting the right to trade reality-bending technologies.', missionId: 'mission_license_t7', guidanceText: 'Only a true legend of the trade routes can earn this privilege.' },
    },

    // --- Market and Location Data ---
    MARKETS: [
        { id: LOCATION_IDS.VENUS, name: 'Venus', distance: 97, launchFlavor: "Floating cities hide scientific marvels and secrets.", navTheme: { gradient: 'linear-gradient(to bottom right, #854d0e, #0f172a)', textColor: '#fde047', borderColor: '#facc15' }, description: 'A scientific enclave hungry for research data and processors.', color: 'border-yellow-400', bg: 'bg-gradient-to-br from-yellow-800 to-slate-900', fuelPrice: 400, arrivalLore: "Floating cities drift through the thick, acidic clouds, their lights a lonely defiance to the crushing pressure below.", specialty: "Exclusive access to the Venetian Syndicate for high-risk, high-reward intel and missions.", availabilityModifier: { [COMMODITY_IDS.CLONED_ORGANS]: 2.0, [COMMODITY_IDS.PROCESSORS]: 2.0, [COMMODITY_IDS.GMO_SEEDS]: 0.5, [COMMODITY_IDS.SENTIENT_AI]: 0.5 } },
        { id: LOCATION_IDS.EARTH, name: 'Earth', distance: 180, launchFlavor: "The bustling heart of the Sol system.", navTheme: { gradient: 'linear-gradient(to bottom right, #1e3a8a, #0f172a)', textColor: '#93c5fd', borderColor: '#60a5fa' }, description: 'The hub of power and wealth. High demand for tech and bio-enhancements.', color: 'border-cyan-500', bg: 'bg-gradient-to-br from-blue-900 to-slate-900', fuelPrice: 250, arrivalLore: "The cradle of humanity buzzes with endless traffic; a beacon of blue and green against the void.", specialty: "Offers the best sell prices for rare, high-tier goods and is the exclusive source for top-tier ship licenses.", availabilityModifier: { [COMMODITY_IDS.HYDROPONICS]: 2.0, [COMMODITY_IDS.GMO_SEEDS]: 2.0, [COMMODITY_IDS.CLONED_ORGANS]: 0.5, [COMMODITY_IDS.XENO_GEOLOGICALS]: 0.5 } },
        { id: LOCATION_IDS.LUNA, name: 'The Moon', parent: 'loc_earth', distance: 15, launchFlavor: "An industrial powerhouse built on grey dust.", navTheme: { gradient: 'linear-gradient(to bottom right, #374151, #0f172a)', textColor: '#e5e7eb', borderColor: '#9ca3af' }, description: 'An industrial proving ground. Exports propellant and basic materials.', color: 'border-gray-400', bg: 'bg-gradient-to-br from-gray-700 to-slate-900', fuelPrice: 350, arrivalLore: "Dusty plains are scarred by mining operations under the harsh, silent watch of distant Earth.", specialty: "Offers a slight discount on all ship repairs.", availabilityModifier: { [COMMODITY_IDS.PLASTEEL]: 2.0, [COMMODITY_IDS.PROPELLANT]: 2.0, [COMMODITY_IDS.WATER_ICE]: 0.5, [COMMODITY_IDS.HYDROPONICS]: 0.5 } },
        { id: LOCATION_IDS.MARS, name: 'Mars', distance: 226, launchFlavor: "The red frontier, ripe with opportunity.", navTheme: { gradient: 'linear-gradient(to bottom right, #7c2d12, #0f172a)', textColor: '#fca5a5', borderColor: '#f87171' }, description: 'A growing colony. Needs processors and materials for expansion.', color: 'border-orange-600', bg: 'bg-gradient-to-br from-orange-900 to-slate-900', fuelPrice: 450, arrivalLore: "The thin, reddish atmosphere whips across terraforming arrays and fledgling biodomes.", specialty: "Offers a higher-than-average number of colonial supply missions.", availabilityModifier: { [COMMODITY_IDS.PLASTEEL]: 2.0, [COMMODITY_IDS.HYDROPONICS]: 0.5, [COMMODITY_IDS.CRYO_PODS]: 0.5, [COMMODITY_IDS.WATER_ICE]: 0.5 } },
        { id: LOCATION_IDS.BELT, name: 'The Belt', distance: 292, launchFlavor: "A lawless expanse of rock and riches.", navTheme: { gradient: 'linear-gradient(to bottom right, #292524, #0f172a)', textColor: '#ca8a04', borderColor: '#a16207' }, description: 'A lawless frontier. Rich in raw minerals and water ice.', color: 'border-amber-700', bg: 'bg-gradient-to-br from-stone-800 to-slate-900', fuelPrice: 600, arrivalLore: "Countless rocks tumble in a silent, chaotic dance, hiding both immense wealth and sudden peril.", specialty: "Increased chance to find rare derelict ships in its shipyards.", availabilityModifier: { [COMMODITY_IDS.WATER_ICE]: 2.0, [COMMODITY_IDS.XENO_GEOLOGICALS]: 2.0, [COMMODITY_IDS.HYDROPONICS]: 0.5, [COMMODITY_IDS.CYBERNETICS]: 0.5 } },
        { id: LOCATION_IDS.EXCHANGE, name: 'The Exchange', distance: 309, launchFlavor: "The notorious black market of the outer belt.", navTheme: { gradient: 'linear-gradient(to bottom right, #581c87, #000000, #0f172a)', textColor: '#e9d5ff', borderColor: '#c084fc' }, description: 'A legendary black market station hidden deep within the Kuiper Belt. High stakes, high rewards.', color: 'border-purple-500', bg: 'bg-gradient-to-br from-purple-900 via-black to-slate-900', fuelPrice: 1200, arrivalLore: "A hollowed-out asteroid, bristling with rogue drones and comms jammers. This is the fabled Exchange, where fortunes are made or lost in an instant.", specialty: "The notorious black market of the outer belt.", availabilityModifier: {} },
        { id: LOCATION_IDS.JUPITER, name: 'Jupiter', distance: 443, launchFlavor: "Vast refineries harvest fuel from the giant.", navTheme: { gradient: 'linear-gradient(to bottom right, #9a3412, #1c1917)', textColor: '#fed7aa', borderColor: '#fb923c' }, description: 'A gas giant teeming with orbital refineries. The primary source of propellant for the outer system.', color: 'border-orange-400', bg: 'bg-gradient-to-br from-orange-800 to-stone-900', fuelPrice: 150, arrivalLore: "The colossal sphere of Jupiter dominates the viewport, its Great Red Spot a baleful eye. Automated refineries drift in its upper atmosphere.", specialty: "Fuel is sold at 50% of the galactic average price, making it an essential stop for any long-haul journey.", availabilityModifier: { [COMMODITY_IDS.PROPELLANT]: 2.0, [COMMODITY_IDS.ATMO_PROCESSORS]: 2.0, [COMMODITY_IDS.PROCESSORS]: 0.5 } },
        { id: LOCATION_IDS.SATURN, name: 'Saturn', distance: 618, launchFlavor: "Opulent stations drift among majestic rings.", navTheme: { gradient: 'linear-gradient(to bottom right, #713f12, #312e81, #0f172a)', textColor: '#fef08a', borderColor: '#fde047' }, description: 'A tourism hub. Demands luxury goods and bio-wares.', color: 'border-yellow-200', bg: 'bg-gradient-to-br from-yellow-900 via-indigo-900 to-slate-900', fuelPrice: 550, arrivalLore: "The majestic rings cast long shadows over opulent tourist stations and icy harvesting rigs.", specialty: "Offers the highest sell prices for luxury and bio-tech goods.", availabilityModifier: { [COMMODITY_IDS.CRYO_PODS]: 0.5, [COMMODITY_IDS.CLONED_ORGANS]: 0.5 } },
        { id: LOCATION_IDS.URANUS, name: 'Uranus', distance: 775, launchFlavor: "A silent, ice-cold world of strange science.", navTheme: { gradient: 'linear-gradient(to bottom right, #155e75, #312e81)', textColor: '#a5f3fc', borderColor: '#67e8f9' }, description: 'A cold, distant world where scientists study bizarre quantum phenomena and strange geologicals.', color: 'border-cyan-200', bg: 'bg-gradient-to-br from-cyan-800 to-indigo-900', fuelPrice: 700, arrivalLore: "The pale, featureless orb of Uranus hangs tilted in the sky. Research outposts glitter like ice crystals in the eternal twilight.", specialty: "A unique R&D service to temporarily \"overclock\" ship components.", availabilityModifier: { [COMMODITY_IDS.ATMO_PROCESSORS]: 2.0, [COMMODITY_IDS.SENTIENT_AI]: 0.5, [COMMODITY_IDS.PROCESSORS]: 0.5 } },
        { id: LOCATION_IDS.NEPTUNE, name: 'Neptune', distance: 877, launchFlavor: "The stormy edge of military-controlled space.", navTheme: { gradient: 'linear-gradient(to bottom right, #1e3a8a, #000000)', textColor: '#93c5fd', borderColor: '#60a5fa' }, description: 'A dark, stormy world, home to secretive military bases and shipyards.', color: 'border-blue-400', bg: 'bg-gradient-to-br from-blue-900 to-black', fuelPrice: 650, arrivalLore: "Supersonic winds howl across Neptune's deep blue clouds. Heavily armed patrol ships escort you to the shielded orbital station.", specialty: "A military surplus shipyard that occasionally sells damaged, high-tier frigates.", availabilityModifier: { [COMMODITY_IDS.PLASTEEL]: 0.1, [COMMODITY_IDS.PROPELLANT]: 0.5 } },
        { id: LOCATION_IDS.KEPLER, name: "Kepler's Eye", distance: 903, launchFlavor: "A colossal lens staring into the infinite void.", navTheme: { gradient: 'linear-gradient(to bottom right, #701a75, #0f172a)', textColor: '#f472b6', borderColor: '#ec4899' }, description: 'A massive deep-space observatory that consumes vast amounts of processing power.', color: 'border-fuchsia-500', bg: 'bg-gradient-to-br from-fuchsia-900 to-slate-900', fuelPrice: 800, arrivalLore: "The station is a single, enormous lens staring into the abyss, surrounded by a delicate lattice of sensors and habitation rings.", specialty: "A colossal lens staring into the infinite void.", availabilityModifier: {} },
        { id: LOCATION_IDS.PLUTO, name: 'Pluto', distance: 1080, launchFlavor: "A haven for outcasts at the system's fringe.", navTheme: { gradient: 'linear-gradient(to bottom right, #312e81, #0f172a)', textColor: '#c4b5fd', borderColor: '#a78bfa' }, description: 'The furthest outpost, a haven for outcasts and smugglers dealing in forbidden tech.', color: 'border-indigo-400', bg: 'bg-gradient-to-br from-indigo-900 to-slate-900', fuelPrice: 900, arrivalLore: "Pluto's tiny, frozen heart is a whisper in the dark. The only light comes from a ramshackle station carved into a nitrogen-ice mountain.", specialty: "A haven for outcasts at the system's fringe.", availabilityModifier: { 'water_ice': 2.0, 'hydroponics': 0.5, 'cybernetics': 0.5, 'cloned_organs': 0.5, 'xeno_geologicals': 2.0 } }
    ],

    // --- Mission Data ---
    MISSIONS: MISSIONS,

    // --- Tutorial System Data ---
    TUTORIAL_DATA: TUTORIAL_DATA
};