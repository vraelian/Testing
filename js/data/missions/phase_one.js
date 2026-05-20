// js/data/missions/phase_one.js
/**
 * @fileoverview
 * Defines the Phase 1: Act 1 (The Cog) missions 10-16, focusing on early game logistics,
 * debt, the introduction of higher-level Guild contracts, and the contrast of the transhuman economy.
 */
export const PHASE_ONE_MISSIONS = {
    'mission_10': {
        id: "mission_10",
        name: "Oversupply",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], I must remind you that your <b>loan deadline is in three short years</b>. This is no time at all when travel takes months!<br><br><b>Do not wait</b> - repay your debt to the Merchant’s Guild <i>as soon as possible</i>. To help, I have some valuable intelligence to share that you might find to be lucrative.<br><br>Review the intel in the Data tab and <b>leverage a unique opportunity on Earth to your benefit</b>. Your success will reflect well on me with the guild.",
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
            text: "I see that you’ve made it to Earth in your [shipName].<br><br>Continue to travel for arbitrage, buying low and selling high while fulfilling contracts and building up your network of clients. Don’t forget to review station details on your map.<br><br>I will be back in touch shortly.",
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
        description: "Captain [playerName], you are making adequate progress as a new trader; however, the interest on your loan continues to grow. Your objective is to <b>pay off all of your debt</b> to avoid additional interest or worse. You can pay off your loans on the finance screen.<br><br><b>Remember, you will need to trade favorably in the market to earn credits if ever there are no contracts available.</b> Use what you've learned to succeed in arbitrage. The Guild looks fondly upon those that contribute to the trade network rather than detract from it.<br><br>One more thing - take care to avoid the <b>Syndicate</b>.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        objectives: [
            { "id": "pay_debt", "type": "HAVE_DEBT", "value": 0 }
        ],
        completion: {
            locationId: "any",
            title: "Debt Cleared",
            text: "Congratulations on paying down your loan, Captain!<br><br>You now qualify for additional financing should you ever need the extra leveraging power for a large trade or just some general help. The choice is yours.<br><br>I am being called away to deal with a problem concerning a Venusian Syndicate shell company. I have fully unlocked your trade license so new clients should be in touch soon. Take care.",
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
        description: "Hey there. A Guild rep passed your transponder code my way. We've got a sudden market shift—a coronal mass ejection is disrupting supply lines, and the hydroponics farms out in the Asteroid Belt are desperate for water!<br><br>If you can <b>make it out to the Belt amidst the storm to deliver water ice</b>, I'll put in a good word for you on the trade network.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        grantedCargo: [
            { goodId: 'water_ice', quantity: 25 }
        ],
        onAccept: [
            { type: 'TRIGGER_SYSTEM_STATE', stateId: 'CORONAL_MASS_EJECTION' }
        ],
        onComplete: [
            { type: 'TRIGGER_SYSTEM_STATE', stateId: 'NEUTRAL' }
        ],
        objectives: [
            { "id": "deliver_ice", "type": "DELIVER_ITEM", "target": "loc_belt", "goodId": "water_ice", "quantity": 25 }
        ],
        completion: {
            locationId: "loc_belt",
            title: "Delivery Complete",
            text: "The belt farms will distribute the water to the scattered hydroponics farms shortly. The valuable plants cultivated for food and oxygen will persist for a while longer now, thanks to you. We appreciate your help, Captain.",
            buttonText: "Unload the Water Ice"
        },
        rewards: [
            { "type": "credits", "amount": 13000 }
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
        description: "Greetings, Captain.<br><br>I represent a medical manufacturing collective on Earth. We are experiencing a critical shortage of plasteel which is required for high-end cybernetic enhancements.<br><br>My client is seeking a reliable supplier. If you can <b>procure the plasteel yourself and deliver it to our Earth facilities,</b> you will be generously compensated.<br><br>We will have more work for you if you prove to be reliable.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_10" }
        ],
        onComplete: [
            { "type": "reveal_tier", "value": 2 }
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
            { "type": "credits", "amount": 37000 }
        ]
    },
    'mission_14': {
        id: "mission_14",
        name: "Economies of Scale",
        type: "PROCUREMENT",
        host: "GUILD",
        portraitId: "Merchants_Guild_3",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hello Captain [playerName].<br><br>Your previous handler, Audita, has been reassigned to other assets temporarily. I see you've cleared your Guild loan. I imagine our interest rates were a trivial matter for you.<br><br>Anyway, I have a job for you, Captain - The Guild is constructing a new high-capacity orbital tether above Mars to streamline heavy freighter traffic.<br><br><b>Deliver bulk plasteel to the Martian starport to supply the construction project.</b> Your [shipName] likely <i>cannot hold all of the freight at once</i> so get comfortable with the transit routes. You will likely need to source the plasteel from multiple stations.<br>Good luck, time is money.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_11" },
            { "type": "mission_completed", "missionId": "mission_13" }
        ],
        objectives: [
            { "id": "deliver_plasteel_bulk", "type": "DELIVER_ITEM", "target": "loc_mars", "goodId": "plasteel", "quantity": 80 }
        ],
        completion: {
            locationId: "loc_mars",
            title: "Contract Fulfilled",
            text: "The Martian dockmasters are ready to confirm receipt of the final plasteel shipment. The orbital tether construction continues on schedule thanks to you. The Guild has authorized your payment.<br><br>To make future hauls easier, consider the purchase of a larger vessel with greater cargo space.<br><br>I have additional work for you when you're ready, Captain. You will find the order in your mission terminal. ",
            buttonText: "Unload the Plasteel"
        },
        rewards: [
            { "type": "credits", "amount": 34000 }
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
        description: "Captain [playerName], I have a special procurement order for you to fulfill. A very senior board member of the Guild requires a pristine shipment for their personal estate on Luna.<br><br><b>They need substantial amounts of water ice for a cryo-therapy life-extension suite and high-grade plasteel</b> for structural reinforcements of the estate.<br><br>Do not keep them waiting, and do not embarrass me, Captain.",
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
            text: "The lunar estate eagerly awaits the supplies to resume construction and are prepared to transfer payment upon delivery.",
            buttonText: "Unload the Freight"
        },
        rewards: [
            { "type": "credits", "amount": 13000 }
        ]
    },
    'mission_16': {
        id: "mission_16",
        name: "Survivor's Guilt",
        type: "PROCUREMENT",
        host: "STATION",
        portraitId: "Dockworker_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hey... [playerName]. It's been a while since you quit the mine. Glad to see you're still around.<br><br>Listen, things are bad here. When you left the Belt, the Guild didn't adjust our quotas. They just squeezed the rest of us harder. So, we're running critical on life support reserves and structural patching for the habitation modules.<br><br>I know you're busy playing merchant now, but <b>we need a shipment of water ice and plasteel</b> here at the Belt if you can manage it. I can pay you from the habitation stipend that the Guild affords us Belters while on duty.",
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
            text: "Thanks pal, this helps your old crew more than you know. Once you've unloaded all the cargo I can transfer the credits your way. <br><br>Oh and [playerName], don't forget where you came from. Stay safe out there.",
            buttonText: "Unload the Freight"
        },
        rewards: [
            { "type": "credits", "amount": 9000 }
        ]
    },
    'mission_17': {
        id: "mission_17",
        name: "Diplomatic Vector",
        type: "LOGISTICS",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Greetings, Captain.<br><br>I was previously called away for other guild business but have returned to coordinate an expedited operation on behalf of the Guild. You are being entrusted with a diplomatic logistics run sponsored by the system's two <i>largest rival factions, the Merchant's Guild and the Venusian Syndicate</i>. As a neutral third party your involvement will be handsomely rewarded.<br><br>The Merchant's Guild and the Venusian Syndicate have temporarily entered into an emergency joint repair agreement for the orbital stations at Uranus. The stations urgently need building material for repairs. All parties involved need these stations operational as soon as possible to resume regular trade.<br><br><b>Travel to Venus to load up with plasteel and deliver the freight to Uranus.</b> This contract will test the operational limits of the [shipName]. Monitor your fuel reserves closely. You will likely need to stop to refuel along the way.",
        triggers: [
            { "type": "mission_completed", "missionId": "mission_16" }
        ],
        // --- NEW LOGISTICS MECHANICS ---
        pickupLocationId: "loc_venus",
        deferredCargo: [
            { goodId: "plasteel", quantity: 25 }
        ],
        // -------------------------------
        objectives: [
            // The TRAVEL_TO objective is removed because the Logistics UI Phase natively handles the transit and pickup instructions.
            // This array now only contains Phase 2 (Delivery) objectives.
            { "id": "deliver_plasteel_uranus", "type": "DELIVER_ITEM", "target": "loc_uranus", "goodId": "plasteel", "quantity": 25 }
        ],
        completion: {
            locationId: "loc_uranus",
            title: "Delivery Complete",
            text: "The Uranus Dock Authority has approved your access to the Starport depot for delivery. The dockmasters are ready to offload the plasteel for immediate integration into the station superstructure once you've confirmed the freight transfer.<br><br><b>Your clearance granted by the UDA has unlocked tier 2 trading</b>.",
            buttonText: "Unload Freight"
        },
        rewards: [
            { "type": "license", "licenseId": "t2_license" },
            { "type": "credits", "amount": 25000 }
        ]
    }
};