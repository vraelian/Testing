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
        description: "Hello, Captain. I am Kiern, Research Director for the Venusian Syndicate. I have noted your recent logistical endeavors. The Syndicate has highly lucrative work available for an aspiring operator such as yourself, provided you aren't owned by the Merchant's Guild.<br><br>But first, you must prove you are more than a debtor. <b>Amass a net worth of ⌬ 60,000</b> to demonstrate your merit in arbitrage, then <b>meet me at the Venusian cloud-cities</b>. I have forwarded a piece of intel as an act of good faith.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_17" } ],
        grantedIntel: [ { name: "Syndicate Tip", location: "loc_venus" } ],
        objectives: [
            { "id": "have_60k", "type": "HAVE_CREDITS", "value": 60000 },
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
    }
};