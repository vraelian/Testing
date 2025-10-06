// js/data/database.js
/**
 * @fileoverview
 * This file serves as the central database for all static game data.
 * It consolidates information from previous data, config, and content files
 * into a single, authoritative source. This improves maintainability and clarity
 * by providing a unified structure for all core game content and configuration.
 */
import { LOCATION_IDS, PERK_IDS, SHIP_IDS, COMMODITY_IDS, SCREEN_IDS, TUTORIAL_ACTION_TYPES, ACTION_IDS, NAV_IDS } from './constants.js';

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

    // --- Player Perks and Their Effects ---
    PERKS: {
        [PERK_IDS.TRADEMASTER]: { profitBonus: 0.05 },
        [PERK_IDS.NAVIGATOR]: { fuelMod: 0.9, hullDecayMod: 0.9, travelTimeMod: 0.9 },
        [PERK_IDS.VENETIAN_SYNDICATE]: { fuelDiscount: 0.25, repairDiscount: 0.25 }
    },

    // --- Narrative Events Triggered by Game Progression ---
    AGE_EVENTS: [
        {
            id: 'captain_choice',
            trigger: { day: 366 }, // Triggers after one full year of gameplay.
            title: 'Captain Who?',
            description: "You've successfully navigated many trades and run a tight ship. Your crew depends on you... but what kind of captain will you be?",
            choices: [
                { title: 'Trademaster', description: '5% bonus on all trade profits.', perkId: PERK_IDS.TRADEMASTER, playerTitle: 'Trademaster' },
                { title: 'Navigator', description: '10% reduced fuel usage, hull decay, and travel time.', perkId: PERK_IDS.NAVIGATOR, playerTitle: 'Navigator' }
            ]
        },
        {
            id: 'friends_with_benefits',
            trigger: { credits: 50000 }, // Triggers upon reaching 50,000 credits.
            title: 'Friends with Benefits',
            description: 'An ally in need is an ally indeed.',
            choices: [
                { title: "Join the Merchant's Guild", description: 'Receive a free C-Class freighter.', perkId: PERK_IDS.MERCHANT_GUILD_SHIP },
                { title: 'Join the Venetian Syndicate', description: '75% discount on fuel and repairs at Venus.', perkId: PERK_IDS.VENETIAN_SYNDICATE }
            ]
        }
    ],

    // --- Random Events Encountered During Travel ---
    RANDOM_EVENTS: [
        {
            id: 'distress_call',
            title: 'Distress Call',
            scenario: 'You pick up a distress signal from a small, damaged ship. They are out of fuel and requesting an emergency transfer to restart their reactor.',
            precondition: (gameState, activeShip) => activeShip.fuel >= 20, // Event can only trigger if player has enough fuel to offer.
            choices: [
                {
                    title: 'Offer Aid (20 Fuel)',
                    outcomes: [
                        {
                            chance: 0.75,
                            description: 'The fuel transfer is successful. The grateful captain rewards you with 10,000 credits for your timely assistance.',
                            effects: [ { type: 'fuel', value: -20 }, { type: 'credits', value: 10000 } ]
                        },
                        {
                            chance: 0.25,
                            description: 'As the fuel transfer begins, their reactor overloads! The resulting explosion damages your hull by 15%.',
                            effects: [ { type: 'fuel', value: -20 }, { type: 'hull_damage_percent', value: 15 } ]
                        }
                    ]
                },
                {
                    title: 'Ignore the Call',
                    outcomes: [ { chance: 1.0, description: 'You press on, and the desperate signal fades behind you.', effects: [] } ]
                }
            ]
        },
        {
            id: 'floating_cargo',
            title: 'Floating Cargo Pod',
            scenario: 'Long-range sensors detect an unmarked, sealed cargo pod adrift in the shipping lane. It appears to be intact.',
            precondition: () => true,
            choices: [
                {
                    title: 'Bring it Aboard',
                    outcomes: [
                        {
                            chance: 0.60,
                            description: `The pod contains valuable goods. You gain 25 units of Neural Processors.`,
                            effects: [ { type: 'add_cargo', value: { id: COMMODITY_IDS.PROCESSORS, quantity: 25 } } ]
                        },
                        {
                            chance: 0.40,
                            description: 'It was a trap! The pod is booby-trapped and detonates as your tractor beam locks on, causing 20% hull damage.',
                            effects: [ { type: 'hull_damage_percent', value: 20 } ]
                        }
                    ]
                },
                {
                    title: 'Report it',
                    outcomes: [ { chance: 1.0, description: 'You notify the nearest station of the hazard and receive a small finder\'s fee of 1,000 credits.', effects: [ { type: 'credits', value: 1000 } ] } ]
                }
            ]
        },
        {
            id: 'adrift_passenger',
            title: 'Adrift Passenger',
            scenario: 'You find a spacer in a functioning escape pod. Their beacon is down, and they ask for passage to the nearest civilized port.',
            precondition: (gameState, activeShip) => activeShip.fuel >= 30,
            choices: [
                {
                    title: 'Take Aboard for Payment',
                    outcomes: [ { chance: 1.0, description: 'The passenger is grateful for the rescue and pays you 10,000 credits upon arrival at your destination.', effects: [ { type: 'credits', value: 10000 } ] } ]
                },
                {
                    title: 'Give a Fuel Cell (30 Fuel)',
                    outcomes: [
                        {
                            chance: 1.0,
                            descriptions: {
                                'reward_cybernetics': `In gratitude, the passenger gives you a crate of <span class="hl-green">40 Cybernetics</span>.`,
                                'reward_debt_paid': `Seeing your tight cargo, the passenger pays off 20% of your debt, reducing it by <span class="hl-green">{amount}</span>.`,
                                'reward_credits': `With no room and no debt, the passenger transfers you <span class="hl-green">{amount}</span>.`
                            },
                            effects: [ { type: 'ADRIFT_PASSENGER' } ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'meteoroid_swarm',
            title: 'Micrometeoroid Swarm',
            scenario: 'Alarms blare as you fly into an uncharted micrometeoroid swarm. Your navigation computer suggests two options to minimize damage.',
            precondition: (gameState, activeShip) => activeShip.fuel >= 15,
            choices: [
                {
                    title: 'Evade Aggressively (+15 Fuel)',
                    outcomes: [ { chance: 1.0, description: 'You burn extra fuel to successfully dodge the worst of the swarm, emerging unscathed.', effects: [ { type: 'fuel', value: -15 } ] } ]
                },
                {
                    title: 'Brace for Impact',
                    outcomes: [ { chance: 1.0, description: 'You trust your hull to withstand the impacts, taking a beating but saving fuel.', effects: [ { type: 'hull_damage_percent', value: [10, 25] } ] } ]
                }
            ]
        },
        {
            id: 'engine_malfunction',
            title: 'Engine Malfunction',
            scenario: 'A sickening shudder runs through the ship. A key plasma injector has failed, destabilizing your engine output.',
            precondition: (gameState, activeShip, getActiveInventory) => (getActiveInventory()[COMMODITY_IDS.PLASTEEL]?.quantity || 0) >= 5,
            choices: [
                {
                    title: 'Quick, Risky Fix (5 Plasteel)',
                    outcomes: [
                        {
                            chance: 0.50,
                            description: 'The patch holds! The engine stabilizes and you continue your journey without further incident.',
                            effects: [ { type: 'lose_cargo', value: { id: COMMODITY_IDS.PLASTEEL, quantity: 5 } } ]
                        },
                        {
                            chance: 0.50,
                            description: 'The patch fails catastrophically, causing a small explosion that deals 20% hull damage.',
                            effects: [ { type: 'lose_cargo', value: { id: COMMODITY_IDS.PLASTEEL, quantity: 5 } }, { type: 'hull_damage_percent', value: 20 } ]
                        }
                    ]
                },
                {
                    title: 'Limp to Destination',
                    outcomes: [ { chance: 1.0, description: 'You shut down the faulty injector. The ship is slower, but stable. Your remaining travel time increases by 25%.', effects: [ { type: 'travel_time_add_percent', value: 0.25 } ] } ]
                }
            ]
        },
        {
            id: 'nav_glitch',
            title: 'Navigation Sensor Glitch',
            scenario: 'The nav-console flashes red. Your primary positioning sensors are offline, and you\'re flying blind in the deep dark.',
            precondition: () => true,
            choices: [
                {
                    title: 'Attempt Hard Reboot',
                    outcomes: [
                        {
                            chance: 0.50,
                            description: 'Success! The sensors come back online. In your haste, you find a shortcut, shortening your trip. You will arrive the next day.',
                            effects: [ { type: 'set_travel_time', value: 1 } ]
                        },
                        {
                            chance: 0.50,
                            description: 'The reboot corrupts your course data, sending you on a long, meandering path. This adds 15 days to your journey.',
                            effects: [ { type: 'travel_time_add', value: 15 } ]
                        }
                    ]
                },
                {
                    title: 'Navigate Manually',
                    outcomes: [ { chance: 1.0, description: 'You rely on old-fashioned star charts. It\'s slow but safe, adding 7 days to your trip.', effects: [ { type: 'travel_time_add', value: 7 } ] } ]
                }
            ]
        },
        {
            id: 'life_support_fluctuation',
            title: 'Life Support Fluctuation',
            scenario: 'An alarm indicates unstable oxygen levels. It\'s not critical yet, but the crew is on edge and efficiency is dropping.',
            precondition: (gameState, activeShip) => activeShip.health > (activeShip.maxHealth * 0.25),
            choices: [
                {
                    title: 'Salvage materials from the ship to repair the atmospheric regulators. (This will cost 25% hull damage)',
                    outcomes: [ { chance: 1.0, description: 'You cannibalize some non-essential hull plating to get the regulators working again. The system stabilizes, but the ship\'s integrity is compromised.', effects: [ { type: 'hull_damage_percent', value: 25 } ] } ]
                },
                {
                    title: 'Defer Maintenance Costs',
                    outcomes: [ { chance: 1.0, description: 'You log the issue for later. The cost of repairs and crew hazard pay, 5,000 credits, is added to your debt.', effects: [ { type: 'add_debt', value: 5000 } ] } ]
                }
            ]
        },
        {
            id: 'cargo_rupture',
            title: 'Cargo Hold Rupture',
            scenario: 'A micrometeorite has punched a small hole in the cargo bay. One of your cargo stacks is exposed to hard vacuum.',
            precondition: (gameState, activeShip, getActiveInventory) => {
                const inventory = getActiveInventory();
                if (!inventory) return false;
                return Object.values(inventory).some(item => item.quantity > 0);
            },
            choices: [
                {
                    title: 'Jettison Damaged Cargo',
                    outcomes: [ { chance: 1.0, description: 'You vent the damaged section, losing 10% of a random cargo stack from your hold into the void.', effects: [ { type: 'lose_random_cargo_percent', value: 0.10 } ] } ]
                },
                {
                    title: 'Attempt EVA Repair',
                    outcomes: [
                        {
                            chance: 0.75,
                            description: 'The emergency patch holds! The cargo is safe, but the repair adds 2 days to your trip.',
                            effects: [ { type: 'travel_time_add', value: 2 } ]
                        },
                        {
                            chance: 0.25,
                            description: 'The patch fails to hold. Explosive decompression destroys 50% of the cargo stack, and the repair still adds 2 days to your trip.',
                            effects: [ { type: 'lose_random_cargo_percent', value: 0.50 }, { type: 'travel_time_add', value: 2 } ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'space_race',
            title: 'Space Race Wager',
            scenario: 'A smug-looking luxury ship pulls alongside and its captain, broadcasted on your main screen, challenges you to a "friendly" race to the destination.',
            precondition: (gameState) => gameState.player.credits > 100,
            choices: [
                {
                    title: 'Accept Wager (Bet: 80% of current credits)',
                    outcomes: [
                        {
                            chance: 1.0,
                            description: 'You accept the high-stakes challenge...',
                            effects: [ { type: 'SPACE_RACE', wagerPercentage: 0.80, winChance: { 'S': 0.85, 'A': 0.70, 'B': 0.55, 'C': 0.40, 'O': 0.95 } } ]
                        }
                    ]
                },
                {
                    title: 'Politely Decline',
                    outcomes: [ { chance: 1.0, description: 'You decline the race. The luxury ship performs a flashy maneuver and speeds off, leaving you to travel in peace.', effects: [] } ]
                }
            ]
        },
        {
            id: 'supply_drop',
            title: 'Emergency Supply Drop',
            scenario: 'You intercept a system-wide emergency broadcast. A new outpost is offering a massive premium for an immediate delivery of a specific commodity that you happen to be carrying.',
            precondition: (gameState, activeShip, getActiveInventory) => {
                const inventory = getActiveInventory();
                return inventory && Object.values(inventory).some(item => item.quantity > 0);
            },
            choices: [
                {
                    title: 'Divert Course to Deliver',
                    outcomes: [ { chance: 1.0, description: 'You sell your entire stack of the requested commodity for 3 times its galactic average value. Your course is diverted to a new, random destination, adding 7 days to your trip.', effects: [ { type: 'sell_random_cargo_premium', value: 3 }, { type: 'travel_time_add', value: 7 }, { type: 'set_new_random_destination' } ] } ]
                },
                {
                    title: 'Decline and Continue',
                    outcomes: [ { chance: 1.0, description: 'You stick to your original plan and let someone else handle the emergency supply run.', effects: [] } ]
                }
            ]
        }
    ],

    // --- Ship Data ---
    SHIPS: {
        [SHIP_IDS.WANDERER]: { name: 'Wanderer', class: 'C', price: 25000, maxHealth: 100, cargoCapacity: 30, maxFuel: 100, saleLocationId: null, lore: 'The All-Rounder. A reliable, if unspectacular, light freighter. Its balanced stats make it a good choice for new captains finding their niche.' },
        [SHIP_IDS.STALWART]: { name: 'Stalwart', class: 'C', price: 25000, maxHealth: 150, cargoCapacity: 60, maxFuel: 80, saleLocationId: LOCATION_IDS.MARS, lore: 'The Hauler. A workhorse of the inner worlds. Slow and cumbersome, but boasts an impressive cargo capacity for its price point.' },
        [SHIP_IDS.MULE]: { name: 'Mule', class: 'C', price: 25000, maxHealth: 75, cargoCapacity: 45, maxFuel: 150, saleLocationId: LOCATION_IDS.BELT, lore: 'The Explorer. What it lacks in cargo space, it makes up for with surprising efficiency and robust systems, allowing it to travel further and cheaper than other ships in its class.' },
        [SHIP_IDS.PATHFINDER]: { name: 'Pathfinder', class: 'B', price: 180000, maxHealth: 120, cargoCapacity: 40, maxFuel: 150, saleLocationId: LOCATION_IDS.LUNA, lore: 'Built for the long haul. Its extended fuel tanks and robust sensor suite make it ideal for reaching the outer edges of the system.' },
        [SHIP_IDS.NOMAD]: { name: 'Nomad', class: 'B', price: 280000, maxHealth: 100, cargoCapacity: 35, maxFuel: 140, saleLocationId: LOCATION_IDS.URANUS, lore: 'A vessel designed for self-sufficiency, featuring advanced life support and a small onboard workshop for emergency repairs.' },
        [SHIP_IDS.VINDICATOR]: { name: 'Vindicator', class: 'A', price: 750000, maxHealth: 250, cargoCapacity: 80, maxFuel: 120, saleLocationId: LOCATION_IDS.NEPTUNE, lore: 'A decommissioned military frigate. Fast, tough, and intimidating, with cargo space retrofitted where missile launchers used to be.' },
        [SHIP_IDS.AEGIS]: { name: 'Aegis', class: 'A', price: 1200000, maxHealth: 120, cargoCapacity: 70, maxFuel: 140, saleLocationId: LOCATION_IDS.EARTH, lore: 'Built as a high-threat escort vessel, its hull is exceptionally dense. A flying fortress that can also haul a respectable amount of cargo.' },
        [SHIP_IDS.ODYSSEY]: { name: 'Odyssey', class: 'S', price: 3800000, maxHealth: 100, cargoCapacity: 120, maxFuel: 250, saleLocationId: LOCATION_IDS.SATURN, lore: 'The pinnacle of personal transport. Gleaming chrome, whisper-quiet engines, and a cabin that smells of rich Corinthian leather.' },
        [SHIP_IDS.MAJESTIC]: { name: 'Majestic', class: 'S', price: 7200000, maxHealth: 200, cargoCapacity: 160, maxFuel: 250, saleLocationId: LOCATION_IDS.KEPLER, lore: 'A flying palace favored by corporate magnates. Its speed, range, and capacity make it one of the most versatile ships money can buy.' },
        [SHIP_IDS.TITAN_HAULER]: { name: 'Titan Hauler', class: 'S', price: 1800000, maxHealth: 175, cargoCapacity: 300, maxFuel: 75, saleLocationId: LOCATION_IDS.URANUS, isRare: true, lore: 'A relic of a failed colonization effort, this ship is almost entirely a cargo container with an engine strapped to it.' },
        [SHIP_IDS.VOID_CHASER]: { name: 'Void Chaser', class: 'S', price: 3100000, maxHealth: 50, cargoCapacity: 90, maxFuel: 400, saleLocationId: LOCATION_IDS.BELT, isRare: true, lore: 'A heavily modified smuggling vessel. Its paper-thin hull is a small price to pay for its legendary engine and long-range fuel cells.' },
        [SHIP_IDS.GUARDIAN]: { name: 'Guardian', class: 'S', price: 1500000, maxHealth: 400, cargoCapacity: 75, maxFuel: 150, saleLocationId: LOCATION_IDS.EARTH, isRare: true, lore: 'An experimental military prototype with redundant hull plating, designed to withstand extreme punishment.' },
        [SHIP_IDS.STARGAZER]: { name: 'Stargazer', class: 'S', price: 950000, maxHealth: 100, cargoCapacity: 60, maxFuel: 350, saleLocationId: LOCATION_IDS.JUPITER, isRare: true, lore: 'A deep-space exploration vessel with colossal fuel reserves, intended for journeys far beyond the known systems.' },
        [SHIP_IDS.BEHEMOTH]: { name: 'Behemoth', class: 'O', price: 32000000, maxHealth: 600, cargoCapacity: 500, maxFuel: 600, saleLocationId: LOCATION_IDS.EXCHANGE, isRare: true, lore: 'An orbital-class freighter that dwarfs even the largest stations. It is a legend among traders, rumored to be a mobile black market in its own right.' }
    },

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
        { id: LOCATION_IDS.EARTH, name: 'Earth Orbit', specialty: 'Best prices for selling high-tier goods; exclusive licenses.', launchFlavor: "The bustling heart of the Sol system.", navTheme: { gradient: 'linear-gradient(to bottom right, #1e3a8a, #0f172a)', textColor: '#93c5fd', borderColor: '#60a5fa' }, description: 'The hub of power and wealth. High demand for tech and bio-enhancements.', color: 'border-cyan-500', bg: 'bg-gradient-to-br from-blue-900 to-slate-900', fuelPrice: 250, arrivalLore: "The cradle of humanity buzzes with endless traffic; a beacon of blue and green against the void.", availabilityModifier: { 'hydroponics': 2.0, 'gmo_seeds': 2.0, 'cybernetics': 1.5, 'cloned_organs': 0.1, 'xeno_geologicals': 0.2 } },
        { id: LOCATION_IDS.LUNA, name: 'The Moon', specialty: 'Slightly reduced repair costs.', launchFlavor: "An industrial powerhouse built on grey dust.", navTheme: { gradient: 'linear-gradient(to bottom right, #374151, #0f172a)', textColor: '#e5e7eb', borderColor: '#9ca3af' }, description: 'An industrial proving ground. Exports propellant and basic materials.', color: 'border-gray-400', bg: 'bg-gradient-to-br from-gray-700 to-slate-900', fuelPrice: 350, arrivalLore: "Dusty plains are scarred by mining operations under the harsh, silent watch of distant Earth.", availabilityModifier: { 'plasteel': 2.0, 'propellant': 1.5, 'water_ice': 0.5, 'hydroponics': 0.5 } },
        { id: LOCATION_IDS.MARS, name: 'Mars', specialty: 'Offers more colonial supply missions.', launchFlavor: "The red frontier, ripe with opportunity.", navTheme: { gradient: 'linear-gradient(to bottom right, #7c2d12, #0f172a)', textColor: '#fca5a5', borderColor: '#f87171' }, description: 'A growing colony. Needs processors and materials for expansion.', color: 'border-orange-600', bg: 'bg-gradient-to-br from-orange-900 to-slate-900', fuelPrice: 450, arrivalLore: "The thin, reddish atmosphere whips across terraforming arrays and fledgling biodomes.", availabilityModifier: { 'plasteel': 2.0, 'water_ice': 0.5, 'hydroponics': 0.5, 'cryo_pods': 0.2 } },
        { id: LOCATION_IDS.VENUS, name: 'Venus', specialty: 'Exclusive access to Venetian Syndicate intel missions.', launchFlavor: "Floating cities hide scientific marvels and secrets.", navTheme: { gradient: 'linear-gradient(to bottom right, #854d0e, #0f172a)', textColor: '#fde047', borderColor: '#facc15' }, description: 'A scientific enclave hungry for research data and processors.', color: 'border-yellow-400', bg: 'bg-gradient-to-br from-yellow-800 to-slate-900', fuelPrice: 400, arrivalLore: "Floating cities drift through the thick, acidic clouds, their lights a lonely defiance to the crushing pressure below.", availabilityModifier: { 'cloned_organs': 2.0, 'processors': 1.8, 'gmo_seeds': 0.4, 'sentient_ai': 0.2 } },
        { id: LOCATION_IDS.BELT, name: 'The Asteroid Belt', specialty: 'Increased chance of rare, derelict ships in the shipyard.', launchFlavor: "A lawless expanse of rock and riches.", navTheme: { gradient: 'linear-gradient(to bottom right, #292524, #0f172a)', textColor: '#ca8a04', borderColor: '#ca8a04' }, description: 'A lawless frontier. Rich in raw minerals and water ice.', color: 'border-amber-700', bg: 'bg-gradient-to-br from-stone-800 to-slate-900', fuelPrice: 600, arrivalLore: "Countless rocks tumble in a silent, chaotic dance, hiding both immense wealth and sudden peril.", availabilityModifier: { 'water_ice': 2.5, 'xeno_geologicals': 1.5, 'hydroponics': 0.3, 'cybernetics': 0.3 } },
        { id: LOCATION_IDS.SATURN, name: 'Saturn\'s Rings', specialty: 'Highest sell prices for luxury & bio goods.', launchFlavor: "Opulent stations drift among majestic rings.", navTheme: { gradient: 'linear-gradient(to bottom right, #713f12, #312e81, #0f172a)', textColor: '#fef08a', borderColor: '#fde047' }, description: 'A tourism hub. Demands luxury goods and bio-wares.', color: 'border-yellow-200', bg: 'bg-gradient-to-br from-yellow-900 via-indigo-900 to-slate-900', fuelPrice: 550, arrivalLore: "The majestic rings cast long shadows over opulent tourist stations and icy harvesting rigs.", availabilityModifier: { 'cryo_pods': 0.2, 'cloned_organs': 0.4 } },
        { id: LOCATION_IDS.JUPITER, name: 'Jupiter', specialty: 'Fuel at 50% of the galactic average price.', launchFlavor: "Vast refineries harvest fuel from the giant.", navTheme: { gradient: 'linear-gradient(to bottom right, #9a3412, #1c1917)', textColor: '#fed7aa', borderColor: '#fb923c' }, description: 'A gas giant teeming with orbital refineries. The primary source of propellant for the outer system.', color: 'border-orange-400', bg: 'bg-gradient-to-br from-orange-800 to-stone-900', fuelPrice: 150, arrivalLore: "The colossal sphere of Jupiter dominates the viewport, its Great Red Spot a baleful eye. Automated refineries drift in its upper atmosphere.", availabilityModifier: { 'propellant': 2.5, 'atmo_processors': 1.5, 'processors': 0.5 } },
        { id: LOCATION_IDS.URANUS, name: 'Uranus', specialty: 'R&D service to temporarily overclock ship components.', launchFlavor: "A silent, ice-cold world of strange science.", navTheme: { gradient: 'linear-gradient(to bottom right, #155e75, #312e81)', textColor: '#a5f3fc', borderColor: '#67e8f9' }, description: 'A cold, distant world where scientists study bizarre quantum phenomena and strange geologicals.', color: 'border-cyan-200', bg: 'bg-gradient-to-br from-cyan-800 to-indigo-900', fuelPrice: 700, arrivalLore: "The pale, featureless orb of Uranus hangs tilted in the sky. Research outposts glitter like ice crystals in the eternal twilight.", availabilityModifier: { 'atmo_processors': 2.0, 'sentient_ai': 0.3, 'processors': 0.4 } },
        { id: LOCATION_IDS.NEPTUNE, name: 'Neptune', specialty: 'Military surplus shipyard with rare, damaged ships.', launchFlavor: "The stormy edge of military-controlled space.", navTheme: { gradient: 'linear-gradient(to bottom right, #1e3a8a, #000000)', textColor: '#93c5fd', borderColor: '#60a5fa' }, description: 'A dark, stormy world, home to secretive military bases and shipyards.', color: 'border-blue-400', bg: 'bg-gradient-to-br from-blue-900 to-black', fuelPrice: 650, arrivalLore: "Supersonic winds howl across Neptune's deep blue clouds. Heavily armed patrol ships escort you to the shielded orbital station.", availabilityModifier: { 'plasteel': 0.2, 'propellant': 0.5 } },
        { id: LOCATION_IDS.PLUTO, name: 'Pluto', specialty: 'Black market for rare, high-tier goods.', launchFlavor: "A haven for outcasts at the system's fringe.", navTheme: { gradient: 'linear-gradient(to bottom right, #312e81, #0f172a)', textColor: '#c4b5fd', borderColor: '#a78bfa' }, description: 'The furthest outpost, a haven for outcasts and smugglers dealing in forbidden tech.', color: 'border-indigo-400', bg: 'bg-gradient-to-br from-indigo-900 to-slate-900', fuelPrice: 900, arrivalLore: "Pluto's tiny, frozen heart is a whisper in the dark. The only light comes from a ramshackle station carved into a nitrogen-ice mountain.", availabilityModifier: { 'xeno_geologicals': 2.0, 'antimatter': 1.5, 'hydroponics': 0.5, 'cybernetics': 0.5 } },
        { id: LOCATION_IDS.EXCHANGE, name: 'The Exchange', specialty: 'The only reliable source for Folded-Space Drives.', launchFlavor: "The notorious black market of the outer belt.", navTheme: { gradient: 'linear-gradient(to bottom right, #581c87, #000000, #0f172a)', textColor: '#e9d5ff', borderColor: '#c084fc' }, description: 'A legendary black market station hidden deep within the Kuiper Belt. High stakes, high rewards.', color: 'border-purple-500', bg: 'bg-gradient-to-br from-purple-900 via-black to-slate-900', fuelPrice: 1200, arrivalLore: "A hollowed-out asteroid, bristling with rogue drones and comms jammers. This is the fabled Exchange, where fortunes are made or lost in an instant.", availabilityModifier: { 'folded_drives': 2.0, 'sentient_ai': 0.1 } },
        { id: LOCATION_IDS.KEPLER, name: "Kepler's Eye", specialty: 'Neutral deep-space market with no specialties.', launchFlavor: "A colossal lens staring into the infinite void.", navTheme: { gradient: 'linear-gradient(to bottom right, #701a75, #0f172a)', textColor: '#f472b6', borderColor: '#ec4899' }, description: 'A massive deep-space observatory that consumes vast amounts of processing power.', color: 'border-fuchsia-500', bg: 'bg-gradient-to-br from-fuchsia-900 to-slate-900', fuelPrice: 800, arrivalLore: "The station is a single, enormous lens staring into the abyss, surrounded by a delicate lattice of sensors and habitation rings.", availabilityModifier: {} }
    ],

    // --- Mission Data ---
    MISSIONS: {
        'mission_tutorial_01': {
            id: "mission_tutorial_01",
            name: "Milk Run to Luna",
            type: "DELIVERY",
            host: "STATION",
            isRepeatable: false,
            isAbandonable: false,
            description: "Hey buddy, you're a new captain, right? My hauler's reactor is fried and I'm on the hook for a delivery to Luna.<br><br>Could you deliver this load of <b>Plasteel</b> to the <b>Moon</b> for me? I don't have any credits to spare, but I've padded the manifest.<br><br>Deliver what I owe, keep the rest. You won't have trouble selling it there, trust me.",
            objectives: [
                { "type": "have_item", "goodId": "plasteel", "quantity": 5 }
            ],
            completion: {
                "locationId": "loc_luna",
                "title": "Favor Complete",
                "text": "The freelancer sends his thanks.",
                "buttonText": "Deliver Plasteel"
            },
            rewards: [],
            providedCargo: [ // Cargo given to the player on mission acceptance.
                { "goodId": "plasteel", "quantity": 6 }
            ]
        },
        'mission_tutorial_02': {
            id: "mission_tutorial_02",
            name: "Martian Resupply",
            type: "DELIVERY",
            host: "STATION",
            isRepeatable: false,
            isAbandonable: false,
            description: "A construction crew on Mars has requested a small shipment of plasteel to complete a habitat.",
            prerequisites: [ // This mission only becomes available after 'mission_tutorial_01' is complete.
                { "type": "mission_completed", "missionId": "mission_tutorial_01" }
            ],
            objectives: [
                { "type": "have_item", "goodId": "plasteel", "quantity": 2 }
            ],
            completion: {
                "locationId": "loc_mars",
                "title": "Delivery Complete",
                "text": "The construction foreman thanks you for the Plasteel.",
                "buttonText": "Deliver Plasteel"
            },
            rewards: [
                { "type": "credits", "amount": 7500 }
            ]
        },
        'mission_license_t3': {
             id: "mission_license_t3", name: "Guild Certification", type: "LICENSE_GRANT", host: "GUILD", isRepeatable: false, isAbandonable: false, description: "The Merchant's Guild requires you to certify your trade proficiency. Accepting this contract formally recognizes your status and grants you access to Tier 3 commodities.", prerequisites: [{ "type": "revealed_tier", "tier": 3 }], objectives: [], completion: {}, rewards: [{ "type": "license", "licenseId": "t3_license" }]
        },
        'mission_license_t5': {
             id: "mission_license_t5", name: "Governor's Contract", type: "LICENSE_GRANT", host: "STATION", isRepeatable: false, isAbandonable: false, description: "The planetary governor requires a sign of your commitment to local industry. This contract solidifies your standing and unlocks access to Tier 5 commodities.", prerequisites: [{ "type": "revealed_tier", "tier": 5 }], objectives: [], completion: {}, rewards: [{ "type": "license", "licenseId": "t5_license" }]
        },
        'mission_license_t7': {
             id: "mission_license_t7", name: "Legendary Run", type: "LICENSE_GRANT", host: "UNKNOWN", isRepeatable: false, isAbandonable: false, description: "Your name is spoken in the farthest corners of the system. Only a legend of your stature may be granted the right to trade the most advanced technologies known.", prerequisites: [{ "type": "revealed_tier", "tier": 7 }], objectives: [], completion: {}, rewards: [{ "type": "license", "licenseId": "t7_license" }]
        }
    },

    // --- Tutorial System Data ---
    TUTORIAL_DATA: {
        'intro_hangar': {
            title: 'Your First Ship',
            trigger: { type: TUTORIAL_ACTION_TYPES.ACTION, action: 'INTRO_START_HANGAR' },
            navLock: true, // If true, UI navigation is restricted during this tutorial batch.
            steps: [
                {
                    stepId: 'hangar_1',
                    text: "Welcome to the <b>Shipyard</b> on <b>Mars!</b><br><br>Every station has a port from which you can trade ships and manage your <b>Hangar</b>.",
                    position: { desktop: 'bottom-right', mobile: 'top' },
                    completion: { type: TUTORIAL_ACTION_TYPES.INFO },
                    nextStepId: 'hangar_2',
                    isSkippable: true
                },
                {
                    stepId: 'hangar_2',
                    text: "Now that you've borrowed <b class='hl-yellow font-bold'>extra credits</b>, you can buy your first ship!<br><br>Select one of the options in the <b>Shipyard</b>. Choose carefully...",
                    position: { desktop: 'bottom-right', mobile: 'top' },
                    completion: { type: TUTORIAL_ACTION_TYPES.ACTION, action: ACTION_IDS.BUY_SHIP },
                    nextStepId: 'hangar_3',
                    isSkippable: true
                },
                {
                    stepId: 'hangar_3',
                    text: 'Congratulations! Your new vessel is now in your <b>Hangar</b>. Select it and <b class="hl-yellow font-bold">Board</b> to make it your active ship.',
                    position: { desktop: 'bottom-right', mobile: 'top-center' },
                    completion: { type: TUTORIAL_ACTION_TYPES.ACTION, action: ACTION_IDS.SELECT_SHIP },
                    nextStepId: null,
                    isSkippable: false
                }
            ]
        },
        'intro_finance': {
            title: 'Managing Your Debt',
            trigger: { type: TUTORIAL_ACTION_TYPES.ACTION, action: 'INTRO_START_FINANCE' },
            navLock: true,
            steps: [
                {
                    stepId: 'finance_1',
                    text: "That was a big purchase, but don't worry - you've still got some <b class='hl-yellow font-bold'>credits</b> left over!<br><br>Your transaction history and debts can be viewed on the <b>Finance</b> tab within <b>Data</b>.",
                    position: { desktop: 'bottom-right', mobile: 'top' },
                    completion: { type: TUTORIAL_ACTION_TYPES.INFO },
                    nextStepId: 'finance_2',
                    isSkippable: false
                },
                {
                    stepId: 'finance_2',
                    text: "Dont forget, your debt to the <b class='hl-yellow font-bold'>Merchant's Guild</b> is due in <b class='hl-red font-bold'>3 years</b>.<br><br>You will need to earn <b class='hl-yellow font-bold'>credits</b> to <b>pay off your debt</b>!",
                    position: { desktop: 'bottom-right', mobile: 'top' },
                    completion: { type: TUTORIAL_ACTION_TYPES.INFO },
                    nextStepId: null,
                    isSkippable: false
                }
            ]
        },
        'intro_missions': {
            id: "intro_missions",
            title: "First Steps",
            trigger: { "type": "ACTION", "action": "INTRO_START_MISSIONS" },
            navLock: true,
            steps: [
                { "stepId": "mission_1_1", "text": "This is the <b>Mission Terminal</b>.<br><br>Check the <b>Missions</b> tab often for opportunities to earn <b class='hl-yellow font-bold'>credits</b> and improve your reputation.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "INFO" }, "nextStepId": "mission_1_2", "isSkippable": false },
                { "stepId": "mission_1_2", "text": "A freelancer at the <b>Mars</b> station has put in a <b>Delivery</b> request. Select the mission '<b>Milk Run to Luna</b>' to view more details.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "ACTION", "action": "show-mission-modal" }, "nextStepId": "mission_1_3", "isSkippable": false },
                { "stepId": "mission_1_3", "text": "The freelancer can't pay, but he's giving you the <b>remaining cargo</b>. Accept the contract.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "ACTION", "action": "accept-mission" }, "nextStepId": "mission_1_4", "isSkippable": false },
                { "stepId": "mission_1_4", "text": "Mission accepted!<br><br>The contract is now <b>active</b> and the cargo as been loaded onto your ship, the <b>{shipName}</b>.<br><br>The freelancer has also loaded extra <b>Plasteel</b> which you can sell for <b class='hl-yellow font-bold'>credits</b>.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "INFO" }, "nextStepId": "mission_1_5", "isSkippable": false },
                { "stepId": "mission_1_5", "text": "This mission must be completed on the <b>Moon</b>, but you are presently docked at <b>Mars</b>! Therefore, it's time for the maiden voyage of your new ship, the <b>{shipName}</b>!<br><br>On the <b>nav bar</b> at the top, select the <b>Ship</b> tab, then the <b>Navigation</b> tab.", "position": { "desktop": "bottom-center", "mobile": "top" }, "completion": { "type": "SCREEN_LOAD", "screenId": "navigation" }, "nextStepId": "mission_1_6", "isSkippable": false, "navLock": { "navId": NAV_IDS.SHIP, "screenId": "navigation" } },
                { "stepId": "mission_1_6", "text": "From here you can travel to other stations in the system. This will cost you <b>time</b>, <b class='hl-blue'>fuel</b>, and wear on the <b class='hl-green'>hull</b> of your ship.<br><br>Select the <b>Moon</b> to lift off from <b>Mars</b>.", "position": { "desktop": "top-center", "mobile": "top" }, "completion": { "type": "ACTION", "action": "travel" }, "nextStepId": "mission_1_7", "isSkippable": false, "navLock": { "navId": NAV_IDS.SHIP, "screenId": "navigation", "enabledElementQuery": "[data-location-id='loc_luna']" } },
                { "stepId": "mission_1_7", "text": "You've arrived and docked at the <b>Moon</b> station!<br><br>It's time to deliver the <b>Plasteel</b>. Select the active mission and <b>deliver the Plasteel</b>.", "position": { "desktop": "bottom-center", "mobile": "top" }, "completion": { "type": "ACTION", "action": "complete-mission" }, "nextStepId": "mission_1_8", "isSkippable": false, "navLock": { "navId": NAV_IDS.DATA, "screenId": "missions" } },
                { "stepId": "mission_1_8", "text": "Mission complete!<br><br>However, favors don't pay off <b class='hl-yellow font-bold'>Guild</b> loans. You're going to need more <b class='hl-yellow font-bold'>credits</b>.", "position": { "desktop": "top-center", "mobile": "top" }, "completion": { "type": "INFO" }, "nextStepId": "mission_2_1", "isSkippable": false },
                { "stepId": "mission_1_9", "text": "Well done. Let's find a more profitable contract. Return to the Mission Terminal.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "SCREEN_LOAD", "screenId": "missions" }, "nextStepId": "mission_2_1", "isSkippable": false, "navLock": { "navId": NAV_IDS.DATA, "screenId": "missions" } },
                { "stepId": "mission_2_1", "text": "The <i>best way to make money</i> is to play the markets yourself by <b class='hl-green font-bold'>buying low and selling high</b>.<br><br>Select the <b>Starport</b> tab, then the <b>Market</b> tab.", "position": { "desktop": "top-center", "mobile": "top" }, "completion": { "type": "SCREEN_LOAD", "screenId": "market" }, "nextStepId": "mission_2_2", "isSkippable": false, "navLock": { "navId": NAV_IDS.STARPORT, "screenId": "market" } },
                { "stepId": "mission_2_2", "text": "This is the <b>Moon Market</b>.<br>On each commodity you will find a wealth of information to aid your trading.<br><br>The <b class='hl-green font-bold'>MKT</b> indicator will inform you of <b class='hl-green font-bold'>prices higher or lower than average.</b> Selecting the price will reveal past performance.<br><br>Select the <b class='hl-yellow font-bold'>Buy/Sell toggle</b> to transition to sale mode, and then sell your single unit of <b>Plasteel</b>.", "position": { "desktop": "top-center", "mobile": "top" }, "completion": { "type": "ACTION", "action": "sell-item", "goodId": "plasteel" }, "nextStepId": "mission_2_3", "isSkippable": false },
                { "stepId": "mission_2_3", "text": "<b class='hl-green font-bold'>Pure profit</b>!<br><br>However, you still need more <b class='hl-yellow font-bold'>credits</b>! Return to the <b>Mission Terminal</b> by selecting the <b>Data</b> tab.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "SCREEN_LOAD", "screenId": "missions" }, "nextStepId": "mission_2_4", "isSkippable": false, "navLock": { "navId": NAV_IDS.DATA, "screenId": "missions" } },
                { "stepId": "mission_2_4", "text": "This mission offers a <b class='hl-yellow font-bold'>credit</b> reward.<br><br>Accept the mission, <b>Martian Resupply</b>.", "position": { "desktop": "bottom-right", "mobile": "top" }, "completion": { "type": "ACTION", "action": "accept-mission", "missionId": "mission_tutorial_02" }, "nextStepId": "mission_3_1", "isSkippable": false },
                { "stepId": "mission_3_1", "text": "To complete this mission you will need <b>travel to Mars</b> after you have purchased <b>two Plasteel</b> from any <b>Market</b>.<br><br>After you have acquired the <b>Plasteel</b>, visit the <b>Mission</b> tab on <b>Mars</b> to submit the cargo and complete the mission. ", "position": { "desktop": "top-center", "mobile": "top" }, "completion": { "type": "ACTION", "action": "complete-mission", "missionId": "mission_tutorial_02" }, "nextStepId": "mission_final", "isSkippable": false, "navLock": null },
                { "stepId": "mission_final", "text": "Well done Captain {playerName}, you have successfully completed trades across the <b>Moon</b> and <b>Mars</b>.<br><br>Continue to trade commodities for <b class='hl-green font-bold'>favorable margins</b> and complete missions to unlock additional opportunities.<br><br><b>The Solar System awaits</b>!", "position": { "desktop": "top-center", "mobile": "top" }, "completion": { "type": "INFO" }, "nextStepId": null, "isSkippable": false, "buttonText": "Complete Tutorial", "navLock": null }
            ]
        }
    }
};