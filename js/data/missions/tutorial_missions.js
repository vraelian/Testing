// js/data/missions/tutorial_missions.js
/**
 * @fileoverview
 * Defines the introductory 9-part tutorial mission arc.
 */
export const TUTORIAL_MISSIONS = {
    'mission_tutorial_01': {
        id: "mission_tutorial_01",
        name: "Mission Terminal",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], welcome to the industry. I am <b>Audita</b>, your Merchant's Guild liaison. Your loan repayment journey begins now.<br><br>The easiest way to earn credits is by completing missions. Begin by accepting the mission within this terminal. Upon acceptance, the mission log will automatically open, allowing you to review your newly active mission.",
        triggers: [],
        objectives: [], // Empty to trigger "accept and turn-in" mechanics silently
        navLock: { 
            navIds: ['data'], 
            screenIds: ['missions'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Mission Terminal",
            text: "The mission log is where you manage your active missions. You are limited to 4 missions at once. Most missions have specific requirements such as gathering a certain quantity of items and delivering them to a designated location. To monitor the progress of a specific mission, select the star icon on its mission card. The mission's progress will then be displayed in the mission bar at the bottom of the screen. Select this bar for a shortcut to the mission log.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_02': {
        id: "mission_tutorial_02",
        name: "Finance",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "Use the finance screen to monitor your transactions and manage your loan. You have three years before your guild debt is due; after that, your credits will be garnished to recover the loan amount. Accept this mission, then visit the finance screen. Return here afterwards.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_01" }
        ],
        objectives: [
            { "id": "visit_finance", "type": "VISIT_SCREEN", "navId": "data", "screenId": "finance" }
        ],
        navLock: { 
            navIds: ['data'], 
            screenIds: ['missions', 'finance'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Debt",
            text: "When you possess a loan, interest accrues monthly. Pay off your debt as soon as possible to minimize the cost of borrowing credits!",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_03': {
        id: "mission_tutorial_03",
        name: "Intel",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "The intel screen serves as the hub for both your codex and the intel market. The codex tracks your progress and contains key story information, so remember to check it periodically for updates. The intel market offers guaranteed opportunities at other locations, but these are time-sensitive. Therefore, always factor in travel distances before committing to a purchase. Navigate to the intel screen, and then return here afterwards for mission completion.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_02" }
        ],
        objectives: [
            { "id": "visit_intel", "type": "VISIT_SCREEN", "navId": "data", "screenId": "intel" }
        ],
        navLock: { 
            navIds: ['data'], 
            screenIds: ['missions', 'intel'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Market Intelligence",
            text: "You can only purchase one piece of intelligence (intel) at a time. The market for this intel can fluctuate, sometimes offering bargains and other times seeing price increases. It is important to ensure you have sufficient cargo space available to capitalize on the intel you acquire.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_04': {
        id: "mission_tutorial_04",
        name: "Map",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "The solar system map displays all travel destinations. Every location features a unique station, each with distinct market dynamics. Available ships for purchase, ship upgrades, supply, demand, prices, and intel all vary by location. By selecting a point of interest on the map, you can view critical market data for that station, which is essential for successful arbitrage. Review the map screen and then return here to complete the mission.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_03" }
        ],
        objectives: [
            { "id": "visit_map", "type": "VISIT_SCREEN", "navId": "ship", "screenId": "map" }
        ],
        navLock: { 
            navIds: ['data', 'ship'], 
            screenIds: ['missions', 'map'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Solar System Map",
            text: "Your map will also indicate the target of your current mission or intel. Refer to it often to inform your trading and travel!",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_05': {
        id: "mission_tutorial_05",
        name: "Navigation",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "The navigation screen serves as your primary launch interface. Each station's card provides details about the required travel time and fuel cost. Accept this mission then visit the navigation screen, select 'The Moon,' and begin your journey. This mission will be completed on the Moon!",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_04" }
        ],
        objectives: [
            { "id": "travel_luna", "type": "TRAVEL_TO", "target": "loc_luna" }
        ],
        navLock: { 
            navIds: ['data', 'ship'], 
            screenIds: ['missions', 'map', 'navigation'] 
        },
        completion: {
            locationId: "loc_luna",
            title: "Maiden Voyage",
            text: "Your new ship, the [shipName], has successfully completed its first voyage! As a result of the trip, you've used some fuel and the hull has experienced minor wear. We will address these factors shortly.",
            buttonText: "I'm Captain Now"
        },
        rewards: []
    },
    'mission_tutorial_06': {
        id: "mission_tutorial_06",
        name: "Cargo",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "A fleet is composed of multiple ships. The cargo screen allows you to see the combined cargo of your fleets, along with its total cost basis and total value. Proceed to the cargo screen now and then return here to complete this mission.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_05" }
        ],
        objectives: [
            { "id": "visit_cargo", "type": "VISIT_SCREEN", "navId": "ship", "screenId": "cargo" }
        ],
        navLock: { 
            navIds: ['data', 'ship'], 
            screenIds: ['missions', 'cargo'] 
        },
        completion: {
            locationId: "loc_luna",
            title: "Cargo Summary",
            text: "You may also review the cost basis and average value of individual commodities on the cargo screen.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_07': {
        id: "mission_tutorial_07",
        name: "Market",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "The most effective method for acquiring credits is engaging in market arbitrage. This involves purchasing items at a low price, transporting them to a different station, and then selling them for a profit. To get started, accept this mission: buy some water ice here on the Moon, travel to Mars, and sell it there. Once the transaction is complete, you can finalize the mission on Mars.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_06" }
        ],
        objectives: [
            { "id": "buy_ice", "type": "TRADE_ITEM", "goodId": "water_ice", "tradeType": "buy", "quantity": 1 },
            { "id": "travel_mars", "type": "TRAVEL_TO", "target": "loc_mars" },
            { "id": "sell_ice", "type": "TRADE_ITEM", "goodId": "water_ice", "tradeType": "sell", "quantity": 1 }
        ],
        navLock: { 
            navIds: ['data', 'starport', 'ship'], 
            screenIds: ['missions', 'market', 'navigation'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "First Trade",
            text: "Every station operates with a distinct market, influencing supply, demand, imports, exports, and prices. Your trading decisions will directly impact these markets, sometimes even causing temporary crashes or inflation in commodity prices. The markets react and/or recover over time. To optimize your profits, leverage the data and intelligence available on the map screen.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_08': {
        id: "mission_tutorial_08",
        name: "Shipyard",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "Shipyards at each station offer different ships for purchase. You can access your hangar, which stores your purchased ships, from any station. The ship you have currently boarded serves as your active, primary vessel and is the central point of contact for all fleet interactions. Accept this mission and visit the shipyard screen here at the Mars starport. Return here afterwards to complete this mission.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_07" }
        ],
        objectives: [
            { "id": "visit_shipyard", "type": "VISIT_SCREEN", "navId": "starport", "screenId": "hangar" }
        ],
        navLock: { 
            navIds: ['data', 'starport'], 
            screenIds: ['missions', 'hangar'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Tour the Shipyard",
            text: "Your ships are valuable assets, each with attributes like fuel capacity, hull integrity, and cargo volume that directly impact your gameplay. Upgrade your fleet to maximize your profit!",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_09': {
        id: "mission_tutorial_09",
        name: "Starport Services",
        type: "TUTORIAL",
        host: "GUILD",
        isRepeatable: false,
        isAbandonable: false,
        description: "Stations offer fuel and repair services for a fee, and valuable ship upgrades are available at the tuning shop. Accept this mission, then proceed to the services screen to fully refuel and repair your ship. Once complete, return here to finish the mission.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_08" }
        ],
        objectives: [
            { "id": "visit_services", "type": "VISIT_SCREEN", "navId": "starport", "screenId": "services" },
            { "id": "max_hull", "type": "HAVE_HULL_PCT", "value": 100 },
            { "id": "max_fuel", "type": "HAVE_FUEL_TANK", "value": 40 }
        ],
        navLock: { 
            navIds: ['data', 'starport'], 
            screenIds: ['missions', 'services'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Tutorial Complete!",
            text: "A ship can accommodate a maximum of three permanent upgrades simultaneously. Once installed, these upgrades cannot be removed without being destroyed. Additionally, the installation cost for an upgrade is dependent on the overall value of the ship it is being applied to.",
            buttonText: "Complete Tutorial",
            clearNavLock: true // Unlocks navigation after finishing the whole tutorial block
        },
        rewards: []
    }
};