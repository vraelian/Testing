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
        description: "Hello, Captain [playerName].<br><br>I am <b>Kiern</b>, Research Director for the <b>Venusian Syndicate</b>. I have noted your recent logistical endeavors and I'm impressed. The Syndicate has highly lucrative work available for an aspiring operator such as yourself, provided you aren't owned by the Merchant's Guild.<br><br>But first, you must prove you are more than a debtor. <b>Amass a larger net worth</b> to demonstrate your merit in arbitrage, then <b>meet me at the Venusian cloud-cities</b>. I have forwarded a piece of intel as an act of good faith.",
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
        description: "Captain, in case you haven't realized this yet, the Merchant's Guild is not what it seems. Their precious 'order' carries a cost that they readily socialize across the lower castes.<br><br>For example, the guild relies on organic indentured labor to extract ice from Pluto. It is a slow and stable market at the fringes for which they wield an oppressive grip. I want to see you disrupt their monopoly to improve the lives of the workforce on this world.<br><br><b>Procure cybernetics and flood the Plutonian market with them.</b> The sudden availability of cheap augmentation will shatter local labor values. Do not concern yourself with the immediate profit margin; the Syndicate will compensate you handsomely for the disruption.",
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
        description: "<b>ATTENTION NEW CAPTAINS:</b><br><br>Jupiter Atmo Refineries welcomes you to the trade network! To celebrate our Q3 production surplus, we are offering a one-time <b>COMPLIMENTARY FLEET REFUEL</b> to newly licensed logistics operators.<br><br><b>Dock at any authorized Jovian orbital station</b> to claim your stipend.<br><br><i>Jupiter Atmo Refineries: Fueling the Long Watch.</i>",
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
        description: "Greetings Captain [playerName]!<br><br>The medical manufacturing collective I work for requires your logistical expertise once again. We have established a remote, sub-surface laboratory deep within a crater on <b>Mercury</b> to conduct highly sensitive biological research.<br><br><b>We urgently require hydroponics to sustain the lab's operations.</b><br><br>The Guild is currently imposing an embargo that is heavily complicating trade routes but we will compensate you generously for navigating these constraints. I have provided you with the coordinates for the lab on Mercury.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_19" } ],
        onAccept: [ 
            { "type": "UNLOCK_LOCATION", "locationId": "loc_mercury" },
            { "type": "TRIGGER_SYSTEM_STATE", "stateId": "GUILD_EMBARGO" }
        ],
        onComplete: [ 
            { "type": "END_SYSTEM_STATE" }
        ],
        objectives: [ 
            { "id": "procure_hydroponics", "type": "HAVE_ITEM", "goodId": "hydroponics", "quantity": 15, "latch": true },
            { "id": "travel_mercury", "type": "TRAVEL_TO", "target": "loc_mercury", "dependsOn": "procure_hydroponics" }
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
        description: "Captain [playerName], to balance the ledger regarding your recent indiscretion on Mercury, the Guild requires your immediate participation in correcting a local water ice quota deficit. You are being tasked to travel to Mercury and purchase ice in bulk and deliver the it to the Guild Moon depot promptly.<br><br>I will remit payment following the requisition. Thank you for your attention to this matter.",
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