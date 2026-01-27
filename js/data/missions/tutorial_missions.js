// js/data/missions/tutorial_missions.js
/**
 * @fileoverview
 * Defines tutorial-specific mission data.
 */
export const TUTORIAL_MISSIONS = {
    'mission_tutorial_01': {
        id: "mission_tutorial_01",
        name: "Milk Run to Luna",
        type: "DELIVERY",
        host: "STATION",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hey buddy, you're a new captain, right? My hauler's reactor is fried and I'm on the hook for a delivery to Luna.<br><br>Could you deliver this load of <b>Plasteel</b> to the <b>Moon</b> for me? I don't have any credits to spare, but I've padded the manifest.<br><br>Deliver what I owe, keep the rest. You won't have trouble selling it there, trust me.",
        objectives: [
            { "type": "have_item", "goodId": "plasteel", "quantity": 5 }
        ],
        completion: {
            "locationId": "loc_luna",
            "title": "Favor Complete",
            "text": "The freelancer sends his thanks.",
            "buttonText": "Deliver Plasteel"
        },
        rewards: [],
        providedCargo: [ // Cargo given to the player on mission acceptance.
            { "goodId": "plasteel", "quantity": 6 }
        ]
    },
    'mission_tutorial_02': {
        id: "mission_tutorial_02",
        name: "Martian Resupply",
        type: "DELIVERY",
        host: "STATION",
        isRepeatable: false,
        isAbandonable: false,
        description: "A construction crew on Mars has requested a small shipment of plasteel to complete a habitat.",
        prerequisites: [ // This mission only becomes available after 'mission_tutorial_01' is complete.
            { "type": "mission_completed", "missionId": "mission_tutorial_01" }
        ],
        objectives: [
            { "type": "have_item", "goodId": "plasteel", "quantity": 2 }
        ],
        completion: {
            "locationId": "loc_mars",
            "title": "Delivery Complete",
            "text": "The construction foreman thanks you for the Plasteel.",
            "buttonText": "Deliver Plasteel"
        },
        rewards: [
            { "type": "credits", "amount": 7500 }
        ]
    }
};