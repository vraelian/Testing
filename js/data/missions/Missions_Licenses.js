/**
 * Missions_Licenses.js
 * * Missions related to acquiring Trade Licenses.
 */

const Missions_Licenses = [
    {
        "id": "license_t3_grant",
        "type": "license",
        "title": "Guild Certification (Tier 3)",
        "description": "The Merchant's Guild requires you to certify your trade proficiency. Accepting this contract formally recognizes your status and grants you access to Tier 3 commodities.",
        "icon": "assets/icons/items/license_t3.png",
        
        "ui_style": {
            "theme": "guild_gold",
            "priority": 50
        },

        "prerequisites": {
            "stats": { "revealed_tier": 3 },
            "excluded_by": ["license_t3_grant"] // Cannot do it twice
        },

        // Instant completion upon acceptance for licenses
        "objectives": [
            {
                "id": "sign_contract",
                "text": "Sign the Guild Contract",
                "target_event": "MISSION_ACCEPTED", // Auto-complete logic needed here later
                "count": 1,
                "auto_complete": true // Special flag for the engine
            }
        ],

        "rewards": {
            "items": ["t3_license"],
            "xp": 500
        },
        
        "on_complete": {
            "trigger_event": "SHOW_TOAST",
            "trigger_args": ["Tier 3 Clearance Granted"]
        }
    },
    {
        "id": "license_t5_grant",
        "type": "license",
        "title": "Governor's Contract (Tier 5)",
        "description": "The planetary governor requires a sign of your commitment to local industry. This contract solidifies your standing and unlocks access to Tier 5 commodities.",
        "icon": "assets/icons/items/license_t5.png",
        
        "ui_style": {
            "theme": "guild_gold",
            "priority": 60
        },

        "prerequisites": {
            "stats": { "revealed_tier": 5 }
        },

        "objectives": [
            {
                "id": "sign_contract",
                "text": "Sign the Governor's Contract",
                "target_event": "MISSION_ACCEPTED",
                "count": 1,
                "auto_complete": true
            }
        ],

        "rewards": {
            "items": ["t5_license"],
            "xp": 2000
        },
        
        "on_complete": {
            "trigger_event": "SHOW_TOAST",
            "trigger_args": ["Tier 5 Clearance Granted"]
        }
    }
];

if (window.MissionRegistry) {
    window.MissionRegistry.registerPack(Missions_Licenses);
}