/**
 * Missions_Intro.js
 * * Contains the definitions for the Tutorial and Intro Sequence.
 * Formatted for ingestion by MissionRegistry.
 */

const Missions_Intro = [
    {
        "id": "intro_01_welcome",
        "type": "tutorial",
        "title": "Welcome to Orbital Trading",
        "description": "Initialize your systems and prepare for your first trade.",
        "icon": "assets/icons/ui/holo_chat.png",
        
        // VISUAL CUSTOMIZATION
        "ui_style": {
            "theme": "tutorial_blue",
            "priority": 100, // Show at top
            "modal_type": "conversation" // Tells UI to render as chat vs contract
        },

        // LOGIC GATING
        "prerequisites": {
            "stats": { "min_level": 0 }
            // No previous missions required, this is the start
        },

        // OBJECTIVES (The Engine checks these)
        "objectives": [
            {
                "id": "read_intro",
                "text": "Complete initialization sequence",
                "type": "action", // Requires a button press or event
                "target_event": "TUTORIAL_STEP_1_COMPLETE",
                "count": 1
            }
        ],

        // REWARDS
        "rewards": {
            "credits": 100,
            "xp": 50,
            "unlock_features": ["market_panel"]
        },

        // CHAINING
        "on_complete": {
            "trigger_event": "SHOW_TOAST",
            "trigger_args": ["Systems Online. Market Data Available."],
            "auto_accept_next": "intro_02_first_trade"
        }
    },
    {
        "id": "intro_02_first_trade",
        "type": "tutorial",
        "title": "Market Dynamics",
        "description": "Purchase a commodity from the local market to understand trading mechanics.",
        "icon": "assets/icons/items/crate_generic.png",
        
        "ui_style": {
            "theme": "tutorial_blue",
            "priority": 99
        },

        "prerequisites": {
            "completed_missions": ["intro_01_welcome"]
        },

        "objectives": [
            {
                "id": "buy_item",
                "text": "Purchase 1 unit of any commodity",
                "type": "transaction",
                "target_event": "PLAYER_BOUGHT_ITEM",
                "count": 1
            }
        ],

        "rewards": {
            "credits": 0,
            "xp": 100,
            "items": ["fuel_canister_small"]
        },
        
        "on_complete": {
            "trigger_event": "SHOW_TOAST",
            "trigger_args": ["Trade Complete. Cargo Secure."]
        }
    }
];

// Auto-register if Registry exists (safety check)
if (window.MissionRegistry) {
    window.MissionRegistry.registerPack(Missions_Intro);
}