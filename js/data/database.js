// js/data/database.js
/**
 * @file This file contains the static game data. In a real-world scenario,
 * this would likely be loaded from a server or a more robust data storage solution.
 * For this project, it's kept in-memory for simplicity.
 */
import { COMMODITY_IDS, LOCATION_IDS, SHIP_IDS, PERK_IDS, MISSION_IDS, TUTORIAL_IDS } from './constants.js';

export const DB = {
    // Game configuration constants
    CONFIG: {
        STARTING_CREDITS: 5000,
        STARTING_SHIP_ID: SHIP_IDS.STARTER_SHIP,
        STARTING_LOCATION: LOCATION_IDS.EARTH,
        STARTING_DAY: 1,
        LOAN_AMOUNT: 20000,
        LOAN_INTEREST_RATE: 0.005, // Daily interest rate
        LOAN_PAYMENT_PER_DAY: 100,
        MAX_LOAN_PAYMENTS: 500,
        INTEL_DEMAND_MOD: 1.3,
        INTEL_DEPRESSION_MOD: 0.7,
    },

    // Ship definitions
    SHIPS: {
        [SHIP_IDS.STARTER_SHIP]: {
            id: SHIP_IDS.STARTER_SHIP,
            name: "Stardust Drifter",
            class: "Light Freighter",
            manufacturer: "Orion Starfreight",
            price: 15000,
            cargoCapacity: 100,
            maxHealth: 100,
            maxFuel: 100,
            lore: "A reliable, if unspectacular, light freighter. The Stardust Drifter is a common sight across the inner solar system, known for its modular design and ease of repair. It's the perfect vessel for a captain starting their career."
        },
        [SHIP_IDS.SHIP_2]: {
            id: SHIP_IDS.SHIP_2,
            name: "Astrohauler",
            class: "Medium Freighter",
            manufacturer: "Ganymede Heavy Industries",
            price: 50000,
            cargoCapacity: 250,
            maxHealth: 150,
            maxFuel: 120,
            lore: "Built to last, the Astrohauler is the workhorse of the asteroid belt. Its reinforced hull and expanded cargo hold make it ideal for hauling raw materials from the Belt to the inner planets."
        },
        [SHIP_IDS.SHIP_3]: {
            id: SHIP_IDS.SHIP_3,
            name: "Stellar Sprinter",
            class: "Fast Courier",
            manufacturer: "Mercury Rocket Works",
            price: 75000,
            cargoCapacity: 80,
            maxHealth: 90,
            maxFuel: 150,
            lore: "Speed is the name of the game for the Stellar Sprinter. What it lacks in cargo space, it more than makes up for in velocity, making it the preferred choice for time-sensitive deliveries and high-value, low-mass goods."
        },
        [SHIP_IDS.SHIP_4]: {
            id: SHIP_IDS.SHIP_4,
            name: "Titan Hauler",
            class: "Heavy Freighter",
            manufacturer: "Titan Shipyards",
            price: 120000,
            cargoCapacity: 500,
            maxHealth: 200,
            maxFuel: 100,
            lore: "A true giant of the spacelanes, the Titan Hauler is designed for maximum capacity. It's slow and cumbersome, but nothing moves more cargo for less fuel. A favorite of bulk traders and industrial consortiums."
        }
    },

    // Commodity definitions
    COMMODITIES: [
        { id: COMMODITY_IDS.WATER, name: 'Water', basePriceRange: [20, 40], tier: 1, styleClass: 'blue' },
        { id: COMMODITY_IDS.FOOD, name: 'Nutrient Paste', basePriceRange: [40, 60], tier: 1, styleClass: 'green' },
        { id: COMMODITY_IDS.MINERALS, name: 'Raw Minerals', basePriceRange: [80, 120], tier: 2, styleClass: 'gray' },
        { id: COMMODITY_IDS.ALLOYS, name: 'Industrial Alloys', basePriceRange: [150, 220], tier: 3, styleClass: 'silver' },
        { id: COMMODITY_IDS.ELECTRONICS, name: 'Electronics', basePriceRange: [250, 350], tier: 4, styleClass: 'yellow' },
        { id: COMMODITY_IDS.MACHINERY, name: 'Heavy Machinery', basePriceRange: [400, 550], tier: 5, styleClass: 'orange' },
        { id: COMMODITY_IDS.MEDICINE, name: 'Medicine', basePriceRange: [500, 700], tier: 6, styleClass: 'cyan' },
        { id: COMMODITY_IDS.LUXURY_GOODS, name: 'Luxury Goods', basePriceRange: [800, 1200], tier: 7, styleClass: 'purple' }
    ],

    // Market / Location definitions
    MARKETS: [
        {
            id: LOCATION_IDS.VENUS,
            name: 'Venus',
            distance: 0.7,
            specialty: 'High-tech manufacturing, research labs',
            fuelPrice: 12,
            bg: "bg-venus",
            navTheme: {
                gradient: 'linear-gradient(135deg, #ffc371, #ff5f6d)',
                textColor: '#ffffff',
                borderColor: '#ffc371'
            },
            launchFlavor: 'The jewel of the inner worlds, a testament to terraforming.',
            arrivalFlavor: "Venusian orbital platforms glitter against the swirling cloudscape. The air in the habitat rings is warm and humid, smelling faintly of ozone and exotic hydroponic blossoms.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 0.8,
                [COMMODITY_IDS.FOOD]: 0.9,
                [COMMODITY_IDS.MINERALS]: 1.2,
                [COMMODITY_IDS.ALLOYS]: 1.1,
                [COMMODITY_IDS.ELECTRONICS]: 1.5,
                [COMMODITY_IDS.MACHINERY]: 1.3,
                [COMMODITY_IDS.MEDICINE]: 1.2,
                [COMMODITY_IDS.LUXURY_GOODS]: 1.4,
            },
        },
        {
            id: LOCATION_IDS.EARTH,
            name: 'Earth',
            distance: 1.0,
            specialty: 'Cradle of humanity, diverse economy',
            fuelPrice: 10,
            bg: "bg-earth",
            navTheme: {
                gradient: 'linear-gradient(135deg, #2980b9, #6dd5fa)',
                textColor: '#ffffff',
                borderColor: '#6dd5fa'
            },
            launchFlavor: 'The blue marble, faded but still beautiful.',
            arrivalFlavor: "The gentle curve of Earth fills your viewport, a familiar tapestry of blue, white, and green. Docking at Armstrong Station, you're greeted by the controlled chaos of humanity's busiest orbital hub.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 1.5,
                [COMMODITY_IDS.FOOD]: 1.5,
                [COMMODITY_IDS.MINERALS]: 0.8,
                [COMMODITY_IDS.ALLOYS]: 0.9,
                [COMMODITY_IDS.ELECTRONICS]: 1.2,
                [COMMODITY_IDS.MACHINERY]: 1.1,
                [COMMODITY_IDS.MEDICINE]: 1.3,
                [COMMODITY_IDS.LUXURY_GOODS]: 1.5,
            },
        },
        {
            id: LOCATION_IDS.LUNA,
            name: 'Luna',
            distance: 1.01,
            parent: LOCATION_IDS.EARTH,
            specialty: 'Helium-3 refining, low-G manufacturing',
            fuelPrice: 15,
            bg: "bg-luna",
            navTheme: {
                gradient: 'linear-gradient(135deg, #bdc3c7, #2c3e50)',
                textColor: '#ffffff',
                borderColor: '#bdc3c7'
            },
            launchFlavor: 'The desolate guardian of Earth.',
            arrivalFlavor: "The stark, cratered landscape of Luna unfolds beneath you. The habitat domes of Tranquility Base gleam in the harsh sunlight, a lonely outpost in the vast silence of space.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 0.7,
                [COMMODITY_IDS.FOOD]: 0.8,
                [COMMODITY_IDS.MINERALS]: 1.4,
                [COMMODITY_IDS.ALLOYS]: 1.3,
                [COMMODITY_IDS.ELECTRONICS]: 0.9,
                [COMMODITY_IDS.MACHINERY]: 1.0,
                [COMMODITY_IDS.MEDICINE]: 0.9,
                [COMMODITY_IDS.LUXURY_GOODS]: 0.8,
            },
        },
        {
            id: LOCATION_IDS.MARS,
            name: 'Mars',
            distance: 1.5,
            specialty: 'Mining operations, terraforming projects',
            fuelPrice: 18,
            bg: "bg-mars",
            navTheme: {
                gradient: 'linear-gradient(135deg, #e67e22, #d35400)',
                textColor: '#ffffff',
                borderColor: '#e67e22'
            },
            launchFlavor: 'The red frontier, full of dust and dreams.',
            arrivalFlavor: "The ochre deserts of Mars stretch to the horizon, dotted with the gleaming pressure domes of colonial outposts. The thin air whistles around the docking arms of Port Olympus.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 0.6,
                [COMMODITY_IDS.FOOD]: 0.7,
                [COMMODITY_IDS.MINERALS]: 1.8,
                [COMMODITY_IDS.ALLOYS]: 1.5,
                [COMMODITY_IDS.ELECTRONICS]: 0.8,
                [COMMODITY_IDS.MACHINERY]: 1.2,
                [COMMODITY_IDS.MEDICINE]: 0.9,
                [COMMODITY_IDS.LUXURY_GOODS]: 0.7,
            },
        },
        {
            id: LOCATION_IDS.BELT,
            name: 'The Belt',
            distance: 2.8,
            specialty: 'Zero-G mining, pirate haven',
            fuelPrice: 25,
            bg: "bg-belt",
            navTheme: {
                gradient: 'linear-gradient(135deg, #34495e, #2c3e50)',
                textColor: '#ffffff',
                borderColor: '#95a5a6'
            },
            launchFlavor: 'A million spinning rocks, a billion hidden dangers.',
            arrivalFlavor: "Navigating the dense asteroid field requires skill. You ease into the hollowed-out rock that serves as the Belt's main trading post. The place is a chaotic maze of tunnels and makeshift docks.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 0.5,
                [COMMODITY_IDS.FOOD]: 0.6,
                [COMMODITY_IDS.MINERALS]: 2.0,
                [COMMODITY_IDS.ALLOYS]: 1.8,
                [COMMODITY_IDS.ELECTRONICS]: 0.7,
                [COMMODITY_IDS.MACHINERY]: 1.0,
                [COMMODITY_IDS.MEDICINE]: 0.8,
                [COMMODITY_IDS.LUXURY_GOODS]: 0.6,
            },
        },
        {
            id: LOCATION_IDS.EXCHANGE,
            name: 'The Exchange',
            distance: 3.5,
            specialty: 'Central trade hub, financial center',
            fuelPrice: 15,
            bg: "bg-exchange",
            navTheme: {
                gradient: 'linear-gradient(135deg, #f1c40f, #f39c12)',
                textColor: '#000000',
                borderColor: '#f1c40f'
            },
            launchFlavor: 'The nexus of commerce, where fortunes are made and lost.',
            arrivalFlavor: "The Exchange is a dazzling sphere of gold and light, a stark contrast to the blackness of space. Inside, the constant hum of market data terminals and shouted negotiations fills the air.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 1.0,
                [COMMODITY_IDS.FOOD]: 1.0,
                [COMMODITY_IDS.MINERALS]: 1.0,
                [COMMODITY_IDS.ALLOYS]: 1.0,
                [COMMODITY_IDS.ELECTRONICS]: 1.0,
                [COMMODITY_IDS.MACHINERY]: 1.0,
                [COMMODITY_IDS.MEDICINE]: 1.0,
                [COMMODITY_IDS.LUXURY_GOODS]: 1.2,
            },
        },
        {
            id: LOCATION_IDS.JUPITER,
            name: 'Jupiter',
            distance: 5.2,
            specialty: 'Gas giant harvesting, scientific research',
            fuelPrice: 8,
            bg: "bg-jupiter",
            navTheme: {
                gradient: 'linear-gradient(135deg, #c69f6a, #8b6b43)',
                textColor: '#ffffff',
                borderColor: '#c69f6a'
            },
            launchFlavor: 'The colossal king of planets, its storms raging for centuries.',
            arrivalFlavor: "The immense, banded face of Jupiter dominates your view. The orbital stations here are built like fortresses to withstand the intense radiation, their interiors humming with the power of fusion reactors.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 1.2,
                [COMMODITY_IDS.FOOD]: 0.8,
                [COMMODITY_IDS.MINERALS]: 0.7,
                [COMMODITY_IDS.ALLOYS]: 0.8,
                [COMMODITY_IDS.ELECTRONICS]: 1.3,
                [COMMODITY_IDS.MACHINERY]: 1.1,
                [COMMODITY_IDS.MEDICINE]: 1.4,
                [COMMODITY_IDS.LUXURY_GOODS]: 1.1,
            },
        },
        {
            id: LOCATION_IDS.SATURN,
            name: 'Saturn',
            distance: 9.5,
            specialty: 'Luxury tourism, cryo-crystal mining',
            fuelPrice: 14,
            bg: "bg-saturn",
            navTheme: {
                gradient: 'linear-gradient(135deg, #e6c589, #d8ac5a)',
                textColor: '#000000',
                borderColor: '#e6c589'
            },
            launchFlavor: 'The ringed beauty, a sight that never gets old.',
            arrivalFlavor: "Drifting through the majestic rings of Saturn is a breathtaking experience. The stations here are elegant and opulent, catering to wealthy tourists who come to witness the celestial spectacle.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 1.1,
                [COMMODITY_IDS.FOOD]: 1.2,
                [COMMODITY_IDS.MINERALS]: 0.9,
                [COMMODITY_IDS.ALLOYS]: 0.9,
                [COMMODITY_IDS.ELECTRONICS]: 1.1,
                [COMMODITY_IDS.MACHINERY]: 0.9,
                [COMMODITY_IDS.MEDICINE]: 1.2,
                [COMMODITY_IDS.LUXURY_GOODS]: 1.8,
            },
        },
        {
            id: LOCATION_IDS.URANUS,
            name: 'Uranus',
            distance: 19.2,
            specialty: 'Exotic gas extraction, deep space observatories',
            fuelPrice: 22,
            bg: "bg-uranus",
            navTheme: {
                gradient: 'linear-gradient(135deg, #a7e0e0, #5c9d9d)',
                textColor: '#000000',
                borderColor: '#a7e0e0'
            },
            launchFlavor: 'The sideways planet, a pale blue enigma.',
            arrivalFlavor: "Uranus hangs in the void like a serene, ghostly orb. The orbital habitats are quiet, populated by scientists and engineers dedicated to plumbing the universe's deepest secrets.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 1.3,
                [COMMODITY_IDS.FOOD]: 1.1,
                [COMMODITY_IDS.MINERALS]: 0.8,
                [COMMODITY_IDS.ALLOYS]: 0.9,
                [COMMODITY_IDS.ELECTRONICS]: 1.4,
                [COMMODITY_IDS.MACHINERY]: 1.2,
                [COMMODITY_IDS.MEDICINE]: 1.5,
                [COMMODITY_IDS.LUXURY_GOODS]: 1.3,
            },
        },
        {
            id: LOCATION_IDS.NEPTUNE,
            name: 'Neptune',
            distance: 30.1,
            specialty: 'Ice mining, restricted military zone',
            fuelPrice: 30,
            bg: "bg-neptune",
            navTheme: {
                gradient: 'linear-gradient(135deg, #4a6a9c, #2a3c5a)',
                textColor: '#ffffff',
                borderColor: '#4a6a9c'
            },
            launchFlavor: 'The last giant, a world of furious, frozen winds.',
            arrivalFlavor: "Neptune's deep blue is mesmerizing and intimidating. The military presence is heavy here, with patrol cruisers crisscrossing the space around the heavily fortified ice-mining installations.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 1.8,
                [COMMODITY_IDS.FOOD]: 1.0,
                [COMMODITY_IDS.MINERALS]: 1.2,
                [COMMODITY_IDS.ALLOYS]: 1.4,
                [COMMODITY_IDS.ELECTRONICS]: 0.8,
                [COMMODITY_IDS.MACHINERY]: 1.5,
                [COMMODITY_IDS.MEDICINE]: 1.1,
                [COMMODITY_IDS.LUXURY_GOODS]: 0.7,
            },
        },
        {
            id: LOCATION_IDS.PLUTO,
            name: 'Pluto',
            distance: 39.5,
            specialty: 'Outcast settlement, black market hub',
            fuelPrice: 50,
            bg: "bg-pluto",
            navTheme: {
                gradient: 'linear-gradient(135deg, #57606f, #2f3542)',
                textColor: '#ffffff',
                borderColor: '#a4b0be'
            },
            launchFlavor: 'At the edge of darkness, where the forgotten dwell.',
            arrivalFlavor: "Pluto is a tiny, frozen point of light against the endless black. The settlement is carved into the ice, a dimly lit warren of tunnels where legality is a flexible concept. You feel a thousand eyes on you the moment you dock.",
            availabilityModifier: {
                [COMMODITY_IDS.WATER]: 0.8,
                [COMMODITY_IDS.FOOD]: 0.9,
                [COMMODITY_IDS.MINERALS]: 1.5,
                [COMMODITY_IDS.ALLOYS]: 1.2,
                [COMMODITY_IDS.ELECTRONICS]: 0.9,
                [COMMODITY_IDS.MACHINERY]: 1.1,
                [COMMODITY_IDS.MEDICINE]: 1.8, // High demand for off-the-books medical supplies
                [COMMODITY_IDS.LUXURY_GOODS]: 1.6, // Smuggled goods fetch a high price
            },
        },
        {
            id: LOCATION_IDS.KEPLER,
            name: 'Kepler-186f',
            distance: 500 * 5.879e+12, // Placeholder for extreme distance
            specialty: 'The first "New Earth", a beacon of hope',
            fuelPrice: 100,
            bg: "bg-kepler",
            navTheme: {
                gradient: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                textColor: '#ffffff',
                borderColor: '#2ecc71'
            },
            launchFlavor: 'Across the void, a new beginning awaits.',
            arrivalFlavor: "After a journey that felt like a lifetime, the vibrant greens and blues of Kepler-186f are a sight for sore eyes. This is a new cradle for humanity, bustling with the energy of colonists building a future among the stars.",
            availabilityModifier: {
                // Represents a developing colony's needs
                [COMMODITY_IDS.WATER]: 1.2,
                [COMMODITY_IDS.FOOD]: 1.3,
                [COMMODITY_IDS.MINERALS]: 0.7,
                [COMMODITY_IDS.ALLOYS]: 0.8,
                [COMMODITY_IDS.ELECTRONICS]: 0.9,
                [COMMODITY_IDS.MACHINERY]: 0.6,
                [COMMODITY_IDS.MEDICINE]: 0.8,
                [COMMODITY_IDS.LUXURY_GOODS]: 0.5,
            },
        }
    ],

    // Player Perks / Milestones
    PERKS: {
        [PERK_IDS.TRADEMASTER]: {
            id: PERK_IDS.TRADEMASTER,
            title: "Trade Master",
            description: "Years of savvy trading have honed your instincts. Gain a 5% bonus on all profitable sales.",
            profitBonus: 0.05
        },
        [PERK_IDS.NEGOTIATOR]: {
            id: PERK_IDS.NEGOTIATOR,
            title: "Master Negotiator",
            description: "You've learned to haggle with the best of them. Reduce fuel and repair costs by 10%.",
            costReduction: 0.10
        },
        [PERK_IDS.EXPLORER]: {
            id: PERK_IDS.EXPLORER,
            title: "Seasoned Explorer",
            description: "You've seen the whole system and then some. Reduce travel times by 10% due to optimized routes.",
            travelTimeReduction: 0.10
        }
    },

    MISSIONS: {
        [MISSION_IDS.TUTORIAL_01]: {
            id: MISSION_IDS.TUTORIAL_01,
            name: "First Delivery",
            host: "Orion Starfreight",
            type: "DELIVERY",
            description: "Orion Starfreight requires a shipment of industrial alloys to be delivered to their orbital facility around Venus. This is a simple, secure contract to get you started.",
            objectives: [{
                type: 'DELIVER',
                goodId: COMMODITY_IDS.ALLOYS,
                quantity: 20,
            }],
            rewards: [{
                type: 'credits',
                amount: 2000
            }],
            isAbandonable: false,
            completion: {
                locationId: LOCATION_IDS.VENUS,
                title: "Delivery Complete",
                text: "Excellent work, captain. The alloys have been received by our fabrication unit. Your payment has been transferred.",
                buttonText: "Receive Payment"
            }
        },
        [MISSION_IDS.TUTORIAL_02]: {
            id: MISSION_IDS.TUTORIAL_02,
            name: "Medical Supplies Run",
            host: "Red Cross",
            type: "URGENT DELIVERY",
            description: "A minor outbreak has occurred in the Martian colonies. The Red Cross needs a shipment of medicine delivered to Mars with haste. Due to the urgency, they're paying a premium.",
            objectives: [{
                type: 'DELIVER',
                goodId: COMMODITY_IDS.MEDICINE,
                quantity: 15,
            }],
            rewards: [{
                type: 'credits',
                amount: 5000
            }],
            isAbandonable: false,
            completion: {
                locationId: LOCATION_IDS.MARS,
                title: "Supplies Received",
                text: "Thank you for the quick delivery, captain. These supplies will be put to immediate use. We appreciate your help in this critical time.",
                buttonText: "Accept Gratitude"
            }
        },
        [MISSION_IDS.MISSION_3]: {
            id: MISSION_IDS.MISSION_3,
            name: "Belt Prospector's Haul",
            host: "Ganymede Heavy Industries",
            type: "BULK HAULAGE",
            description: "One of our contracted prospectors in the Asteroid Belt has hit a motherlode of raw minerals. We need a reliable captain to haul the payload back to our refinery on Luna.",
            objectives: [{
                type: 'DELIVER',
                goodId: COMMODITY_IDS.MINERALS,
                quantity: 150
            }],
            rewards: [{
                type: 'credits',
                amount: 8000
            }],
            completion: {
                locationId: LOCATION_IDS.LUNA,
                title: "Payload Secured",
                text: "A fine haul, captain. Our refinery will be busy for weeks with this. Your payment is cleared.",
                buttonText: "Complete Contract"
            }
        },
    },

    TUTORIAL_DATA: {
        [TUTORIAL_IDS.INTRO_CARGO]: {
            id: TUTORIAL_IDS.INTRO_CARGO,
            title: "Cargo & Inventory",
            skippable: true,
            steps: {
                'cargo_1': {
                    id: 'cargo_1',
                    text: "Welcome to the Cargo Hold. This screen shows all the goods currently stored on your ship, the {shipName}. Let's take a closer look.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    completion: { type: 'INFO' },
                    next: 'cargo_2'
                },
                'cargo_2': {
                    id: 'cargo_2',
                    text: "Each card represents a commodity you own. It shows the quantity and, crucially, the average cost you paid per unit. This is key to calculating your profits.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '.item-card-container', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'cargo_3'
                },
                'cargo_3': {
                    id: 'cargo_3',
                    text: "The bar at the top shows how much of your ship's cargo capacity is currently being used.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '#cargo-capacity-bar-container', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'cargo_4'
                },
                'cargo_4': {
                    id: 'cargo_4',
                    text: "Ready to make some money? Navigate to the Market screen using the sub-navigation bar.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-left' },
                    highlight: { selector: '[data-screen-id="market"]', pulse: true, shape: 'rectangle', padding: 4 },
                    completion: { type: 'ACTION', details: { action: 'set-screen', screenId: 'market' } }
                }
            }
        },
        [TUTORIAL_IDS.INTRO_MARKET]: {
            id: TUTORIAL_IDS.INTRO_MARKET,
            title: "The Market",
            skippable: true,
            steps: {
                'market_1': {
                    id: 'market_1',
                    text: "This is the Market, where you'll buy low and sell high. The left side shows goods for sale at this location.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    completion: { type: 'INFO' },
                    next: 'market_2'
                },
                'market_2': {
                    id: 'market_2',
                    text: "Notice the price indicators. They compare the local price to the galactic average, helping you spot potential deals.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '.indicator-pills', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'market_3'
                },
                'market_3': {
                    id: 'market_3',
                    text: "Let's buy some Industrial Alloys. We'll need them for our first mission. Tap the 'Buy' button to switch to purchase mode.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-right' },
                    highlight: { selector: '#transaction-controls-alloys .btn-buy', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'set-market-mode', goodId: 'alloys', mode: 'buy' } },
                    next: 'market_4'
                },
                'market_4': {
                    id: 'market_4',
                    text: "Now, use the '+' button or tap 'MAX' to set the quantity to 20.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-right' },
                    highlight: { selector: '#transaction-controls-alloys', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'set-market-quantity', goodId: 'alloys', quantity: 20 } },
                    next: 'market_5'
                },
                'market_5': {
                    id: 'market_5',
                    text: "Perfect. Now confirm the purchase.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-right' },
                    highlight: { selector: '#transaction-controls-alloys .btn-confirm', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'confirm-market-transaction', goodId: 'alloys' } },
                }
            }
        },
        [TUTORIAL_IDS.INTRO_MISSIONS]: {
            id: TUTORIAL_IDS.INTRO_MISSIONS,
            title: "Your First Mission",
            skippable: false,
            steps: {
                'mission_1_1': {
                    id: 'mission_1_1',
                    text: "This is the Missions board. Corporations and factions post contracts here. Let's look at your first contract from Orion Starfreight.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '.mission-card[data-mission-id="mission_tutorial_01"]', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'show-mission-modal', missionId: 'mission_tutorial_01' } },
                    next: 'mission_1_2'
                },
                'mission_1_2': {
                    id: 'mission_1_2',
                    text: "This modal shows the mission details: the objective, the reward, and the client. It looks straightforward. Accept the mission.",
                    position: { mobile: 'center', desktop: 'center' },
                    highlight: { selector: '.modal-content[data-mission-id="mission_tutorial_01"] .btn[data-action="accept-mission"]', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'accept-mission', missionId: 'mission_tutorial_01' } },
                },
                'mission_2_1': {
                    id: 'mission_2_1',
                    text: "Excellent. With the mission active, a sticky bar now appears at the bottom of the screen to track your objective. We already have the required alloys.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-left' },
                    highlight: { selector: '#mission-sticky-bar', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'mission_2_2'
                },
                'mission_2_2': {
                    id: 'mission_2_2',
                    text: "Our destination is Venus. Let's go to the Navigation screen.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-left' },
                    highlight: { selector: '[data-screen-id="navigation"]', pulse: true, shape: 'rectangle', padding: 4 },
                    completion: { type: 'ACTION', details: { action: 'set-screen', screenId: 'navigation' } },
                },
                'mission_3_1': {
                    id: 'mission_3_1',
                    text: "Welcome to Navigation. From here, you can travel to any unlocked location in the solar system. Select Venus.",
                    position: { mobile: 'top-center', desktop: 'top-right' },
                    highlight: { selector: '.location-card[data-location-id="venus"]', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'show-launch-modal', locationId: 'venus' } },
                    next: 'mission_3_2'
                },
                'mission_3_2': {
                    id: 'mission_3_2',
                    text: "This is the launch confirmation. It shows travel time and fuel cost. Everything looks good. Press 'Launch'.",
                    position: { mobile: 'center', desktop: 'center' },
                    highlight: { selector: '#launch-modal .btn-launch-glow', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'travel', locationId: 'venus' } },
                },
                'mission_4_1': {
                    id: 'mission_4_1',
                    text: "Welcome to Venus. You'll notice the UI has changed to match the local theme. Since we're at the destination with the required cargo, we can complete the mission.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    completion: { type: 'INFO' },
                    next: 'mission_4_2'
                },
                'mission_4_2': {
                    id: 'mission_4_2',
                    text: "The objective tracker is glowing, indicating you can turn in the mission here. Go back to the Missions screen.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-left' },
                    highlight: { selector: '#mission-sticky-bar .mission-turn-in', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'set-screen', screenId: 'missions' } },
                },
                'mission_5_1': {
                    id: 'mission_5_1',
                    text: "The mission card is also glowing. Open the mission details again.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '.mission-card[data-mission-id="mission_tutorial_01"]', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'show-mission-modal', missionId: 'mission_tutorial_01' } },
                    next: 'mission_5_2'
                },
                'mission_5_2': {
                    id: 'mission_5_2',
                    text: "The modal now shows the completion text. Claim your reward!",
                    position: { mobile: 'center', desktop: 'center' },
                    highlight: { selector: '.modal-content .btn[data-action="complete-mission"]', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'complete-mission', missionId: 'mission_tutorial_01' } },
                }
            }
        },
        [TUTORIAL_IDS.INTRO_FINANCE]: {
            id: TUTORIAL_IDS.INTRO_FINANCE,
            title: "Managing Your Finances",
            skippable: true,
            steps: {
                'finance_1': {
                    id: 'finance_1',
                    text: "This is the Finance screen. Here you can track your income, expenses, and manage your loan.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    completion: { type: 'INFO' },
                    next: 'finance_2'
                },
                'finance_2': {
                    id: 'finance_2',
                    text: "The top section gives you a summary of your net worth. The graph visualizes its change over time.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '#finance-summary-card', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'finance_3'
                },
                'finance_3': {
                    id: 'finance_3',
                    text: "The most important part right now is your loan from the Bank of Sol. You have a significant debt to pay off.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-right' },
                    highlight: { selector: '#loan-details-card', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'finance_4'
                },
                'finance_4': {
                    id: 'finance_4',
                    text: "You can make extra payments anytime to pay it off faster and save on interest. Paying it off is key to unlocking more of the game. Now, let's learn about the Shipyard.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-right' },
                    highlight: { selector: '#loan-payment-controls', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'finance_5'
                },
                'finance_5': {
                    id: 'finance_5',
                    text: "Navigate to the Shipyard.",
                    position: { mobile: 'bottom-center', desktop: 'bottom-left' },
                    highlight: { selector: '[data-screen-id="hangar"]', pulse: true, shape: 'rectangle', padding: 4 },
                    completion: { type: 'ACTION', details: { action: 'set-screen', screenId: 'hangar' } }
                }
            }
        },
        [TUTORIAL_IDS.INTRO_HANGAR]: {
            id: TUTORIAL_IDS.INTRO_HANGAR,
            title: "Hangar & Shipyard",
            skippable: true,
            steps: {
                'hangar_1': {
                    id: 'hangar_1',
                    text: "This screen has two modes. In 'Hangar' mode, you view and manage the ships you own. Notice the 'ACTIVE' tag on your current ship.",
                    position: { mobile: 'top-center', desktop: 'top-right' },
                    highlight: { selector: '#ship-card-starter_ship', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'hangar_2'
                },
                'hangar_2': {
                    id: 'hangar_2',
                    text: "Now, switch to 'Shipyard' mode to see ships available for purchase.",
                    position: { mobile: 'top-center', desktop: 'top-left' },
                    highlight: { selector: '#hangar-shipyard-toggle', pulse: true },
                    completion: { type: 'ACTION', details: { action: 'toggle-hangar-shipyard', mode: 'shipyard' } },
                    next: 'hangar_3'
                },
                'hangar_3': {
                    id: 'hangar_3',
                    text: "The Shipyard is where you can upgrade your fleet. Purchasing a better ship is a major step in any trader's career.",
                    position: { mobile: 'top-center', desktop: 'top-right' },
                    highlight: { selector: '#ship-card-ship_2', pulse: true },
                    completion: { type: 'INFO' },
                    next: 'hangar_4'
                },
                'hangar_4': {
                    id: 'hangar_4',
                    text: "That's it for the basics! You're ready to make your own way in the system. Good luck, Captain. Try exploring the 'Map' screen in the 'Ship' tab next.",
                    position: { mobile: 'top-center', desktop: 'top-center' },
                    buttonText: 'Finish Tutorial',
                    completion: { type: 'INFO' },
                }
            }
        }
    }
};