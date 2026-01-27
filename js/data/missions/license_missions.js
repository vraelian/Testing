// js/data/missions/license_missions.js
/**
 * @fileoverview
 * Defines license granting mission data.
 */
export const LICENSE_MISSIONS = {
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