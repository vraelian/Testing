// js/data/missions/phase_two.js
export const PHASE_TWO_MISSIONS = {
    'mission_18': {
        id: "mission_18",
        name: "The Seed Capital",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain. I am Kiern, Research Director for the Venusian Syndicate. I have noted your recent logistical vectors. The Syndicate has highly lucrative work available for an aspiring operator who isn't paralyzed by Guild regulations.<br><br>But first, you must prove you are more than a debtor. <b>Amass a net worth of ⌬ 60,000</b> to demonstrate your merit in arbitrage, then <b>meet me at the Venusian cloud-cities</b>. I have forwarded a piece of intel to assist you.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_17" } ],
        grantedIntel: [ { name: "Syndicate Tip", location: "loc_venus" } ],
        objectives: [
            { "id": "have_60k", "type": "HAVE_CREDITS", "value": 60000 },
            { "id": "travel_venus", "type": "TRAVEL_TO", "target": "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "Welcome to Venus",
            text: "Captain. Your accounts reflect the requested liquidity. You have proven yourself capable of surviving the market; now let us see if you can manipulate it.",
            buttonText: "View Contracts"
        },
        rewards: []
    },
    'mission_19': {
        id: "mission_19",
        name: "The Synthetic Smuggle",
        type: "FACTION",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "The Guild relies on organic indentured labor to extract ice from Pluto. It is slow and agonizingly stable. Let's break their monopoly.<br><br><b>Purchase 15 Cybernetics and flood the Plutonian market with them.</b> The sudden availability of cheap, automated augmentation will shatter local labor values. Do not concern yourself with the immediate profit margin; the Syndicate will compensate you handsomely for the disruption.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_18" } ],
        objectives: [
            { "id": "have_cybernetics", "type": "HAVE_ITEM", "goodId": "cybernetics", "quantity": 15 },
            { "id": "travel_pluto", "type": "TRAVEL_TO", "target": "loc_pluto" },
            { "id": "sell_cybernetics", "type": "TRADE_ITEM", "goodId": "cybernetics", "tradeType": "sell", "quantity": 15, "target": "loc_pluto" }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "A Calculated Fracture",
            text: "Excellent work. The labor camps on Pluto are already in localized revolt. You have helped us introduce a necessary chaos.",
            buttonText: "Accept Payment"
        },
        rewards: [ { "type": "credits", "amount": 35000 } ]
    },
    'mission_20': {
        id: "mission_20",
        name: "Promotional Stipend",
        type: "PROMOTIONAL",
        host: "STATION",
        portraitId: "Business_11",
        isRepeatable: false,
        isAbandonable: false,
        description: "<b>ATTENTION NEW CAPTAINS:</b><br><br>Jupiter Atmo Refineries welcomes you to the trade network! To celebrate our Q3 production surplus, we are offering a one-time <b>COMPLIMENTARY FLEET REFUEL</b> to newly licensed logistics operators.<br><br>Dock at any authorized Jovian orbital tether to claim your stipend.<br><br><i>Jupiter Atmo Refineries: Powering the Long Watch.</i>",
        triggers: [ { "type": "mission_completed", "missionId": "mission_19" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_story_kintsugi_1" } ],
        objectives: [ { "id": "travel_jupiter", "type": "TRAVEL_TO", "target": "loc_jupiter" } ],
        completion: {
            locationId: "loc_jupiter",
            title: "Voucher Accepted",
            text: "Automated docking clamps secured.<br><br>Thank you for visiting Jupiter Atmo Refineries. Your fleet has been fully resupplied at no cost to you.",
            buttonText: "Disengage"
        },
        rewards: [ { "type": "fill_fleet_fuel" } ]
    }
};