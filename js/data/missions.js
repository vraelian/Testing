// js/data/missions.js
/**
 * @fileoverview
 * Defines all static mission data for the game.
 */
import { COMMODITY_IDS, LOCATION_IDS } from './constants.js';

export const MISSIONS = {
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
    },
    'mission_license_t3': {
         id: "mission_license_t3", name: "Guild Certification", type: "LICENSE_GRANT", host: "GUILD", isRepeatable: false, isAbandonable: false, description: "The Merchant's Guild requires you to certify your trade proficiency. Accepting this contract formally recognizes your status and grants you access to Tier 3 commodities.", prerequisites: [{ "type": "revealed_tier", "tier": 3 }], objectives: [], completion: {}, rewards: [{ "type": "license", "licenseId": "t3_license" }]
    },
    'mission_license_t5': {
         id: "mission_license_t5", name: "Governor's Contract", type: "LICENSE_GRANT", host: "STATION", isRepeatable: false, isAbandonable: false, description: "The planetary governor requires a sign of your commitment to local industry. This contract solidifies your standing and unlocks access to Tier 5 commodities.", prerequisites: [{ "type": "revealed_tier", "tier": 5 }], objectives: [], completion: {}, rewards: [{ "type": "license", "licenseId": "t5_license" }]
    },
    'mission_license_t7': {
         id: "mission_license_t7", name: "Legendary Run", type: "LICENSE_GRANT", host: "UNKNOWN", isRepeatable: false, isAbandonable: false, description: "Your name is spoken in the farthest corners of the system. Only a legend of your stature may be granted the right to trade the most advanced technologies known.", prerequisites: [{ "type": "revealed_tier", "tier": 7 }], objectives: [], completion: {}, rewards: [{ "type": "license", "licenseId": "t7_license" }]
    }
};