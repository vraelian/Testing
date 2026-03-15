// js/data/missions/phase_one.js
/**
 * @fileoverview
 * Defines the Phase 1: Act 1 (The Cog) missions 10-13, focusing on early game logistics,
 * debt, and the first taste of specialized corporate and independent actors.
 */
export const PHASE_ONE_MISSIONS = {
    'mission_10': {
        id: "mission_10",
        name: "The Hook",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], I must remind you that your loan deadline is in three short years. This is no time at all when you factor in the distances between planetary stations. Do not waste time repaying your debt to the Merchant’s Guild. To further assist you, I have some valuable intelligence to share that you might find to be lucrative.<br><br>Review the intel in the Data tab and leverage the opportunity to your benefit. Your success will reflect well on me with the guild.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_09" }
        ],
        objectives: [
            { "id": "travel_earth", "type": "TRAVEL_TO", "target": "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Arrival",
            text: "I see that you’ve made it to the Earth in your [shipName]. Continue to travel for arbitrage, buying low and selling high. Don’t forget to review station details on your map.",
            buttonText: "Understood"
        },
        rewards: []
    },
    'mission_11': {
        id: "mission_11",
        name: "Financial Freedom",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "You are making adequate progress, but the interest on your loan continues to accrue. Your objective is to clear this debt promptly to avoid additional interest or worse, automatic credit garnishment.<br><br>The sooner you can be free of your debt exposure, the faster you can begin to keep your wealth and get your trading career underway. The Guild looks fondly upon those that contribute to the trade network rather than detract from it.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        objectives: [
            { "id": "pay_debt", "type": "HAVE_DEBT", "value": 0 }
        ],
        completion: {
            locationId: "any",
            title: "Debt Cleared",
            text: "Congratulations on paying down your loan. You now qualify for additional financing should you ever need the extra leveraging power for a large trade or some help with finances. The choice is up to you.",
            buttonText: "Understood"
        },
        rewards: [
            { "type": "UPGRADE", "id": "UPG_GUILD_BADGE_1" }
        ]
    },
    'mission_12': {
        id: "mission_12",
        name: "The Storm",
        type: "LOGISTICS",
        host: "INDEPENDENT",
        portraitId: "Dockworker_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hey there. A Guild rep. passed your transponder code my way. We've got a sudden market shift—a micro-meteoroid storm is disrupting supply lines, and the hydroponics farms out in the Asteroid Belt are desperate for Water Ice.<br><br>I've already loaded the cargo into your hold. Just get it to the Belt promptly and the delivery fee is yours.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        grantedCargo: [
            { goodId: 'water_ice', quantity: 25 }
        ],
        objectives: [
            { "id": "deliver_ice", "type": "DELIVER_ITEM", "target": "loc_belt", "goodId": "water_ice", "quantity": 25 }
        ],
        completion: {
            locationId: "loc_belt",
            title: "Delivery Complete",
            text: "The belt farms will distribute the water to the scattered hydroponics farms shortly. The valuable plants cultivated for food and oxygen will persist for a while longer now thanks to you.",
            buttonText: "Understood"
        },
        rewards: [
            { "type": "credits", "amount": 3500 }
        ]
    },
    'mission_13': {
        id: "mission_13",
        name: "High-Society Hardware",
        type: "PROCUREMENT",
        host: "CORPORATE",
        portraitId: "AI_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Greetings, Captain. I represent a medical manufacturing collective on Earth. We are experiencing a critical shortage of Plasteel, which is required for high-end cybernetic enhancements.<br><br>My client is in the market for a reliable supplier. If you can procure the requested amount of freight yourself, deliver it to our Earth facilities for generous compensation. We may have more work for you if you prove to be reliable.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_12" }
        ],
        objectives: [
            { "id": "deliver_plasteel", "type": "DELIVER_ITEM", "target": "loc_earth", "goodId": "plasteel", "quantity": 10 }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Delivery Complete",
            text: "The client is prepared to remit payment once the freight has been unloaded from the [shipName].",
            buttonText: "Understood"
        },
        rewards: [
            { "type": "credits", "amount": 6500 }
        ]
    }
};