// js/data/missions/phase_two.js
export const PHASE_TWO_MISSIONS = {
    'mission_18': {
        id: "mission_18",
        name: "Seed Capital",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hello, Captain. I am Kiern, Research Director for the Venusian Syndicate. I have noted your recent logistical endeavors. The Syndicate has highly lucrative work available for an aspiring operator such as yourself, provided you aren't owned by the Merchant's Guild.<br><br>But first, you must prove you are more than a debtor. <b>Amass a larger net worth</b> to demonstrate your merit in arbitrage, then <b>meet me at the Venusian cloud-cities</b>. I have forwarded a piece of intel as an act of good faith.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_17" } ],
        grantedIntel: [ { name: "Syndicate Tip", location: "loc_venus" } ],
        objectives: [
            { "id": "have_50k", "type": "HAVE_CREDITS", "value": 50000 },
            { "id": "travel_venus", "type": "TRAVEL_TO", "target": "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "The Venusian Syndicate",
            text: "Captain. Your accounts reflect a respectable liquidity. You have proven yourself capable of surviving in this market; now let us see if you can manipulate it.",
            buttonText: "View Contracts"
        },
        rewards: []
    },
    'mission_19': {
        id: "mission_19",
        name: "A Synthetic Disruption",
        type: "FACTION",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "The Guild relies on organic indentured labor to extract ice from Pluto. It is slow and agonizingly stable. I want to see you disrupt their monopoly.<br><br><b>Procure Cybernetics and flood the Plutonian market with them.</b> The sudden availability of cheap, automated augmentation will shatter local labor values. Do not concern yourself with the immediate profit margin; the Syndicate will compensate you handsomely for the disruption.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_18" } ],
        objectives: [
            { "id": "have_cybernetics", "type": "HAVE_ITEM", "goodId": "cybernetics", "quantity": 15, "latch": true },
            { "id": "travel_pluto", "type": "TRAVEL_TO", "target": "loc_pluto" },
            { "id": "sell_cybernetics", "type": "TRADE_ITEM", "goodId": "cybernetics", "tradeType": "sell", "quantity": 15, "target": "loc_pluto" }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "A Calculated Fracture",
            text: "Excellent work. The labor camps on Pluto are already in localized revolt; the workforce paradigm is shifting rapidly. You have helped to introduce a necessary chaos.",
            buttonText: "Accept Payment"
        },
        rewards: [ { "type": "credits", "amount": 35000 } ]
    },
    'mission_20': {
        id: "mission_20",
        name: "Jovian Promotion",
        type: "PROMOTIONAL",
        host: "STATION",
        portraitId: "Business_11",
        isRepeatable: false,
        isAbandonable: false,
        description: "<b>ATTENTION NEW CAPTAINS:</b><br><br>Jupiter Atmo Refineries welcomes you to the trade network! To celebrate our Q3 production surplus, we are offering a one-time <b>COMPLIMENTARY FLEET REFUEL</b> to newly licensed logistics operators.<br><br>Dock at any authorized Jovian orbital tether to claim your stipend.<br><br><i>Jupiter Atmo Refineries: Powering the Long Watch.</i>",
        triggers: [ { "type": "mission_completed", "missionId": "mission_19" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_story_1" } ],
        objectives: [ { "id": "travel_jupiter", "type": "TRAVEL_TO", "target": "loc_jupiter" } ],
        completion: {
            locationId: "loc_jupiter",
            title: "Voucher Accepted",
            text: "Thank you for visiting the famous Jovian Atmo industrial station. Your fleet will be fully refueled at no cost to you. Have a safe flight!",
            buttonText: "Accept Offer"
        },
        rewards: [ { "type": "fill_fleet_fuel" } ]
    },
    'mission_21': {
        id: "mission_21",
        name: "Lab Supply",
        type: "STORY",
        host: "STATION",
        portraitId: "AI_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain, the nedical manufacturering collective I work for requires your logistical expertise once again. We have established a remote, sub-surface laboratory deep within a crater on Mercury to conduct highly sensitive biological research.<br><br>We urgently require Hydroponics to sustain the lab's operations.<br><br>The Guild is currently imposing an embargo, heavily complicating trade routes, but we will compensate you generously for navigating these artificial constraints.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_20" } ],
        onAccept: [ 
            { "type": "UNLOCK_LOCATION", "locationId": "loc_mercury" },
            { "type": "TRIGGER_SYSTEM_STATE", "stateId": "GUILD_EMBARGO" }
        ],
        onComplete: [ 
            { "type": "END_SYSTEM_STATE" }
        ],
        objectives: [ 
            { "id": "deliver_hydroponics", "type": "DELIVER_ITEM", "goodId": "hydroponics", "quantity": 15, "target": "loc_mercury" } 
        ],
        completion: {
            host: "GUILD",
            portraitId: "Audita_1",
            locationId: "loc_mercury",
            title: "A Syndicate Shell",
            text: "Captain! Your recent delivery to Mercury has been flagged! That medical manufacturer you've been working with is a <b>known Venusian Syndicate shell company</b>.<br><br>A local mining whistleblower just exposed their sub-surface operation as an <i>illegal organ cloning lab</i>. Your naive assistance has equipped a criminal enterprise... I suggest you exercise better judgment in the future, lest the Guild hold you as an accomplice.",
            buttonText: "Oops"
        },
        rewards: [ { "type": "credits", "amount": 35000 } ]
    },
    'mission_22': {
        id: "mission_22",
        name: "Mercurian Balance",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "A quota deficit has been detected in our strategic reserves of ice. The Guild requests that you travel to Mercury and purchase Water Ice in bulk.<br><br>I will remit payment following the requisition, captain.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_21" } ],
        objectives: [
            { "id": "buy_ice", "type": "TRADE_ITEM", "tradeType": "buy", "goodId": "water_ice", "quantity": 60, "target": "loc_mercury" },
            { "id": "deliver_ice", "type": "DELIVER_ITEM", "goodId": "water_ice", "quantity": 60, "target": "loc_luna", "dependsOn": "buy_ice" }
        ],
        completion: {
            host: "SYNDICATE",
            portraitId: "Venusian_Syndicate_4",
            locationId: "loc_luna",
            title: "A Cold Calculation",
            text: "Captain [playerName], hello again. I thought you should know the Guild cut local telemetry feeds so Mercurian markets wouldn't notice you siphoning their aquifers. They plan to ransom that ice back to the colony at triple the price to soak up the organ cloning money.<br><br>That's right, on behalf of the Guild you just stole Mercury's water. When the colony gets thirsty, which will be soon because the Sun is right next door, the Guild will sell it back at a premium to crush the planet's economy.<br><br>When they sent you on this mission, they didn't even mention the cloning lab, did they? You see, the Guild doesn't get mad. They just adjust the algorithm; they balance aggressively and chase a cold, contrived sense of order.",
            buttonText: "Disconnect"
        },
        rewards: [ 
            { "type": "credits", "amount": 25000 } 
        ]
    }
};