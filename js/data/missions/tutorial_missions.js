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
        description: "Captain [playerName], welcome to the industry. I am <b>Audita</b>, your <b>Merchant's Guild</b> liaison. My primary task is ensuring you repay your <br>⌬ 25,000 credit loan.<br><br>You can earn credits by completing missions and trading industrial goods in the market.<br><br><b>Accept</b> this mission below to add it to your log and begin.",
        triggers: [],
        objectives: [], // Empty to trigger "accept and turn-in" mechanics silently
        navLock: { 
            navIds: ['data'], 
            screenIds: ['missions'] 
        },
        completion: {
            locationId: "loc_mars",
            title: "Mission Log",
            text: "When you accept a mission from the <b>Mission Terminal</b>, it moves to the <b>Mission Log</b>.<br><br>Missions will have a variety of different objectives to complete, such as delivering commodities to a designated location.<br><br>To track the progress of a specific mission, select the star icon on its mission card.",
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
        description: "Your financial obligations and transaction history are logged in the <b>Finance</b> tab. Note that your debt is due within three years. The Guild does not grant extensions and your <i>credits will be garnished</i> eventually if you fail to pay in time.<br><br>Take a look at the finance screen to satisfy this mission objective, then return here to the mission screen to complete it.",
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
            text: "As long as you have debt <i>interest will accrue monthly</i>.<br><br>Pay off your debts <i>as soon as possible</i> to minimize the cost of borrowing credits!",
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
        description: "The Intel screen houses your <b>Codex</b> and the <b>Intel Market</b>.<br><br>The Codex contains key story information. The Intel Market sells time-sensitive, guaranteed trade opportunities.<br><br>Tour the <b>Intel</b> screen, then return here.",
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
            text: "You may only possess one piece of market intelligence at a time. Intel may reveal bargains or profit opportunities.",
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
        description: "The Guild has authorized your access to a live iteration of the Solar System <b>Map</b>. We expect you to utilize this map to identify profitable arbitrage routes between stations, each of which possesses unique market dynamics, behaviors, and ships for sale.<br><br>By selecting a point of interest on the map, you can <i>view valuable market data</i> for that station.<br><br>Review the map screen on the <b>Ship</b> tab and then return here to complete the mission.",
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
        description: "The <b>Navigation</b> screen is where space flight begins. Select <b>The Moon</b> to begin your journey.<br><br>This mission will be completed on the Moon.",
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
        description: "The <b>Cargo</b> screen tracks your fleet's current inventory, average cost basis, and total market value.<br><br>Inspect your cargo hold, which is empty for now, then return here.",
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
        description: "Arbitrage involves <b>purchasing items at a low price, transporting them to a different station, and then selling them for more than they cost, thereby earning a profit</b>.<br><br>To complete this mission you will need to buy some ice here at the Moon <b>Market</b> on the <b>Starport</b> tab, travel to Mars, and then <i>sell it at the Martian station</i>.<br><br>Profit is not the priority for this exercise.",
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
            text: "<b>Every station has a unique market with different supply and demand which will affect prices.</b><br><br> Your trading decisions will directly impact these markets, sometimes even causing temporary crashes or inflation in prices. The markets will react and recover over time as you travel.<br><br>To optimize your trades, review the <b>Station Details</b> on the map screen.",
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
        description: "Each station's <b>Shipyard</b> offers different vessels for purchase.<br><br>The <b>Hangar</b> is your personal ship storage and is accessible from any station.<br><br>Tour the Martian Shipyard, then return here.",
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
            text: "A ship's <b>fuel capacity, hull integrity, and cargo capacity</b> directly influences your trading. Upgrade your fleet with the best ships to maximize your profit!",
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
        description: "Stations provide fueling, repairs, and permanent ship upgrades for a fee.<br><br>The Guild has issued a one-time subsidy to cover your expenses from your recent trip. Visit the <b>Services</b> screen to fully repair and refuel your ship now.",
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
            text: "Station services will have valuable ship upgrades for sale that improve performance. A ship may possess up to three upgrades.<br><br>The installation cost for an upgrade is determined by a ship's <b>class</b>.",
            buttonText: "Complete Tutorial",
            clearNavLock: true // Unlocks navigation after finishing the whole tutorial block
        },
        rewards: []
    }
};