// js/data/missions/tutorial_missions.js
/**
 * @fileoverview
 * Defines the introductory 9-part tutorial mission arc.
 */
export const TUTORIAL_MISSIONS = {
    'mission_tutorial_01': {
        id: "mission_tutorial_01",
        name: "Welcome to Orbital Trading",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], welcome to the industry. I am <b>Audita</b>, and I’ll be your liaison with the Merchant's Guild. I’ve been assigned to assist you in <b>repaying your ⌬ 25,000 credit loan</b> to the guild.<br><br>The easiest way to earn credits is by completing missions.<br><br>Begin by accepting this mission which will automatically be added to your mission log.",
        triggers: [],
        objectives: [], // Empty to trigger "accept and turn-in" mechanics silently
        navLock: { 
            navIds: ['data'], 
            screenIds: ['missions'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Mission Log",
            text: "The mission log is where you will review and complete missions. Most missions have specific requirements, such as delivering commodities to a designated location.<br><br>To track the progress of a specific mission, select the star icon on its mission card.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_02': {
        id: "mission_tutorial_02",
        name: "Review Your Finances",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "You may review your transaction history and manage your loan on the finance screen, which is accessible in the <b>Data</b> tab on the navigation bar at the top.<br><br><b>You have three years before your guild debt is due</b>, after which your credits will be garnished to recover the loan amount.<br><br>Take a look at the finance screen, then return here.",
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
            text: "While you possess debt interest will accrue monthly.<br><br>Pay off your debt as soon as possible to minimize the cost of borrowing credits!",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_03': {
        id: "mission_tutorial_03",
        name: "Intel and the Codex",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "The intel screen is home to both the codex and the intel market.<br><br>The codex tracks your progress and contains key story information, so remember to check it periodically for updates.<br><br>The intel market offers guaranteed opportunities at other locations, but these are time-sensitive and travel takes time. Carefully consider travel distances before committing to a purchase of information.<br><br>Take a tour of the intel screen and then return here.",
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
            text: "You can only purchase one piece of market intelligence at a time. The benefits of intel vary and may reveal bargains or profit opportunities.<br><br>It is a good idea to have cargo space available to capitalize on the intel that you acquire.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_04': {
        id: "mission_tutorial_04",
        name: "Solar System Map",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "The solar system map displays all of the stations you can trade at. Each station has unique market dynamics and behaviors. Purchaseable ships and their upgrades, supply & demand, commodity prices, and intel all vary by location.<br><br>By selecting a point of interest on the map, you can view valuable market data for that station that is essential for successful arbitrage.<br><br>Review the map screen on the <b>Ship</b> tab and then return here to complete the mission.",
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
            title: "Use the Map Often",
            text: "Your map will also indicate the target of your current mission or intel. Refer to it often to inform your trading and travel.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_05': {
        id: "mission_tutorial_05",
        name: "Navigating Space Flight",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "The navigation screen is where space flight begins. Visit the navigation screen and select <b>The Moon</b> to begin your journey.<br><br>This mission will be completed on the Moon.",
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
            title: "Welcome to Luna",
            text: "Your new ship, the [shipName], has successfully completed its first voyage!<br><br>The flight consumed some fuel and the hull experienced minor wear, but we will address this later.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_06': {
        id: "mission_tutorial_06",
        name: "Inspect the Cargo Hold",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "The cargo screen is useful for reviewing the total cargo of your fleet, its cost basis, and its total value.<br><br>Visit the cargo screen now, then return here.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_05" }
        ],
        objectives: [
            { "id": "visit_cargo", "type": "VISIT_SCREEN", "navId": "ship", "screenId": "cargo" }
        ],
        navLock: { 
            navIds: ['data', 'ship'], 
            screenIds: ['missions', 'cargo', 'map', 'navigation'] 
        },
        completion: {
            locationId: "loc_luna",
            title: "Review Your Cargo",
            text: "You may also review the cost basis and average value of individual commodities on the cargo screen.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_07': {
        id: "mission_tutorial_07",
        name: "Trading in the Market",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Arbitrage involves <b>purchasing items at a low price, transporting them to a different station, and then selling them for less than they cost and earning a profit</b>.<br><br>To complete this mission you will need to buy some ice here at the Moon Market on the <b>Starport</b> tab, travel to Mars, and then sell it at the Martian station.<br><br>Don’t worry about profit for now - this is only practice.",
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
            title: "Station Diversity",
            text: "<b>Every station has a unique market with different supply, demand, imports, exports, and prices.</b><br><br> Your trading decisions will directly impact these markets, sometimes even causing temporary crashes or inflation in prices. The markets will react and recover over time.<br><br>To optimize your trades, review the <b>Station Details</b> on the map screen.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_08': {
        id: "mission_tutorial_08",
        name: "Tour the Shipyard",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "The shipyards at each station will offer different ships for purchase. The best ships are hard to find.<br><br>The hangar is your personal ship storage which is accessible from any station. Your currently boarded ship serves as your active, primary vessel and is the central point of contact for all fleet interactions.<br><br>Visit the shipyard screen here at the Martian starport, then return here.",
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
            title: "Ship Attributes",
            text: "Your ships are valuable assets, each with attributes like fuel capacity, hull integrity, and cargo volume that directly influence your trading. Upgrade your fleet to maximize your profit!",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_tutorial_09': {
        id: "mission_tutorial_09",
        name: "Starport Services",
        type: "TUTORIAL",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Stations offer fuel and repair services for a fee, and valuable ship upgrades can be purchased at the tuning shop.<br><br>Visit the services screen and fully refuel and repair your ship to complete this mission.<br><br>The guild has granted you a one-time service subsidy to cover your expenses.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_08" }
        ],
        onAccept: [
            { type: "GRANT_CREDITS", amount: 7000 }
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
            title: "Ship Tuning",
            text: "A ship can have up to three permanent upgrades at once. Once installed, these upgrades cannot be removed without being destroyed.<br><br>The installation cost for an upgrade is dependent on the overall value of the ship it is being applied to.",
            buttonText: "Complete Tutorial",
            clearNavLock: true // Unlocks navigation after finishing the whole tutorial block
        },
        rewards: [
            { type: "UNLOCK_LORE", loreId: "origin_story" }
        ]
    }
};