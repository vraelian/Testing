// js/data/missions/phase_one.js
/**
 * @fileoverview
 * Defines the Phase 1: Act 1 (The Cog) missions 10-16, focusing on early game logistics,
 * debt, the introduction of higher-level Guild contracts, and the contrast of the transhuman economy.
 */
export const PHASE_ONE_MISSIONS = {
    'mission_10': {
        id: "mission_10",
        name: "Ice Crisis",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], I must remind you that your <b>loan deadline is in three short years</b>. This is no time at all when you factor in the distances between planetary stations. Do not waste time repaying your debt to the Merchant’s Guild. To further assist you, I have some valuable intelligence to share that you might find to be lucrative.<br><br>Review the intel in the Data tab and leverage the opportunity to your benefit. Your success will reflect well on me with the guild.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_tutorial_09" }
        ],
        grantedIntel: [
            { name: "Intel", location: "loc_earth" }
        ],
        objectives: [
            { "id": "travel_earth", "type": "TRAVEL_TO", "target": "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Arrival",
            text: "I see that you’ve made it to the Earth in your [shipName]. Continue to travel for arbitrage, buying low and selling high while fulfilling contracts and building up your network of clients. Don’t forget to review station details on your map.",
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
            { "type": "UPGRADE", "id": "UPG_ECO_SELL_1" }
        ]
    },
    'mission_12': {
        id: "mission_12",
        name: "The Storm",
        type: "LOGISTICS",
        host: "STATION",
        portraitId: "Dockworker_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hey there. A Guild rep. passed your transponder code my way. We've got a sudden market shift—a micro-meteoroid storm is disrupting supply lines, and the hydroponics farms out in the Asteroid Belt are desperate for Water Ice.<br><br>If you can get it to the Belt promptly, then the delivery fee is yours.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        grantedCargo: [
            { goodId: 'water_ice', quantity: 25 }
        ],
        onAccept: [
            { type: 'TRIGGER_SYSTEM_STATE', stateId: 'CORONAL_MASS_EJECTION' }
        ],
        objectives: [
            { "id": "deliver_ice", "type": "DELIVER_ITEM", "target": "loc_belt", "goodId": "water_ice", "quantity": 25 }
        ],
        completion: {
            locationId: "loc_belt",
            title: "Delivery Complete",
            text: "The belt farms will distribute the water to the scattered hydroponics farms shortly. The valuable plants cultivated for food and oxygen will persist for a while longer now thanks to you.",
            buttonText: "Unload the Water Ice"
        },
        rewards: [
            { "type": "credits", "amount": 5500 }
        ]
    },
    'mission_13': {
        id: "mission_13",
        name: "High-Society Hardware",
        type: "PROCUREMENT",
        host: "STATION",
        portraitId: "AI_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Greetings, Captain. I represent a medical manufacturing collective on Earth. We are experiencing a critical shortage of Plasteel, which is required for high-end cybernetic enhancements.<br><br>My client is in the market for a reliable supplier. If you can procure the requested amount of freight yourself, deliver it to our Earth facilities for generous compensation. We may have more work for you if you prove to be reliable.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        objectives: [
            { "id": "deliver_plasteel", "type": "DELIVER_ITEM", "target": "loc_earth", "goodId": "plasteel", "quantity": 10 }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Delivery Complete",
            text: "The client is prepared to remit payment once the freight has been unloaded from the [shipName].",
            buttonText: "Unload the Plasteel"
        },
        rewards: [
            { "type": "credits", "amount": 6500 }
        ]
    },
    'mission_14': {
        id: "mission_14",
        name: "Economies of Scale",
        type: "LOGISTICS",
        host: "GUILD",
        portraitId: "Merchants_Guild_3",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. Your previous handler, Audita, has been reassigned to other assets. I see you've cleared your Guild loan and successfully executed that Earth hardware procurement. Surviving our interest rates is a statistical anomaly. Congratulations.<br><br>Let’s see if your heavy logistics are as good as your accounting. The Guild is constructing a new high-capacity orbital tether above Mars to streamline heavy freighter traffic.<br><br><b>Deliver bulk Plasteel to the Martian starport.</b> Your [shipName] likely cannot hold that all at once, so get comfortable with the transit routes. You will likely need to source the freight from multiple stations. Time is money.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_11" },
            { "type": "mission_completed", "missionId": "mission_13" }
        ],
        objectives: [
            { "id": "deliver_plasteel_bulk", "type": "DELIVER_ITEM", "target": "loc_mars", "goodId": "plasteel", "quantity": 120 }
        ],
        completion: {
            locationId: "loc_mars",
            title: "Contract Fulfilled",
            text: "The Martian dockmasters are ready to confirm receipt of the final Plasteel shipment. The orbital tether construction continues on schedule. The Guild has authorized your payment.",
            buttonText: "Unload the Plasteel"
        },
        rewards: [
            { "type": "credits", "amount": 20000 }
        ]
    },
    'mission_15': {
        id: "mission_15",
        name: "Life Extension",
        type: "PROCUREMENT",
        host: "GUILD",
        portraitId: "Merchants_Guild_3",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], I have a specialized procurement order. A senior board member of the Guild requires a pristine shipment for their personal estate on Luna.<br><br><b>They will need substantial amounts of Water Ice for a localized cryo-therapy life-extension suite, and high-grade Plasteel for structural reinforcements of the estate.</b><br>Do not keep them waiting.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_14" }
        ],
        objectives: [
            { "id": "deliver_ice_luxury", "type": "DELIVER_ITEM", "target": "loc_luna", "goodId": "water_ice", "quantity": 15 },
            { "id": "deliver_plasteel_luxury", "type": "DELIVER_ITEM", "target": "loc_luna", "goodId": "plasteel", "quantity": 15 }
        ],
        completion: {
            locationId: "loc_luna",
            title: "Cryo-Delivery Complete",
            text: "The lunar estate eagerly awaits the supplies to resume construction are prepared to transfer the credits upon delivery.",
            buttonText: "Unload the Freight"
        },
        rewards: [
            { "type": "credits", "amount": 14000 }
        ]
    },
    'mission_16': {
        id: "mission_16",
        name: "Survivor's Guilt",
        type: "PROCUREMENT",
        host: "STATION",
        portraitId: "Dockworker_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hey... [playerName]. Glad to see you're still around. Listen, things are bad here. When you left the Belt, the Guild didn't adjust our quotas. They just squeezed the rest of us harder. We're running critical on life support reserves and structural patching for the habitation modules.<br><br>I know you're busy playing merchant now, but we need a shipment of Water Ice and Plasteel here at the Belt. I can pay you from the habitation stipend the guild affords us Belters on duty.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_15" }
        ],
        objectives: [
            { "id": "deliver_ice_belt", "type": "DELIVER_ITEM", "target": "loc_belt", "goodId": "water_ice", "quantity": 90 },
            { "id": "deliver_plasteel_belt", "type": "DELIVER_ITEM", "target": "loc_belt", "goodId": "plasteel", "quantity": 20 }
        ],
        completion: {
            locationId: "loc_belt",
            title: "Delivery Complete",
            text: "Once you've unloaded all the cargo I can transfer the credits your way. <br><br>Oh and [playerName], don't forget where you came from. Stay safe out there.",
            buttonText: "Unload the Freight"
        },
        rewards: [
            { "type": "credits", "amount": 18000 }
        ]
    }
};