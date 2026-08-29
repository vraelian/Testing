// js/data/missions/phase_five.js
/**
 * @fileoverview Mission registry for Act V: The Capital.
 * Implements macro-logistics through fleet capacity checks, the bespoke black market 
 * system state at The Exchange, and the climax of the Coronal Mandate resulting 
 * in the player defecting to Kintsugi and Sol Station.
 */

export const PHASE_FIVE_MISSIONS = {
    // =========================================================================================
    // MISSION 54: CORONAL STAGING
    // =========================================================================================
    "mission_54_guild": {
        id: "mission_54_guild",
        name: "Coronal Staging",
        type: "STORY",
        host: "GUILD",
        portraitId: "Arbiter_1",
        isAbandonable: false,
        description: "Captain. The shadow in the corona is no longer a theory; it is a destination. I am allocating your entire fleet to this operation. Move a massive volume of plasteel and graphene to Mercury. Build a thermal staging ground on the surface to service our search vessels. The volume is extreme, but your fleet must handle it.",
        triggers: [
            { type: "mission_completed", missionId: "mission_53_guild" }
        ],
        objectives: [
            { id: "obj_deliver_plasteel", type: "DELIVER_ITEM", goodId: "plasteel", quantity: 600, target: "loc_mercury" },
            { id: "obj_deliver_graphene", type: "DELIVER_ITEM", goodId: "graphene_lattices", quantity: 600, target: "loc_mercury" }
        ],
        completion: {
            locationId: "loc_mercury",
            title: "Staging Ground Secured",
            text: "The staging ground is built. However, standard Guild shielding cannot protect biological assets or cooling systems from direct coronal radiation. The Mercurians survive their proximity to the sun by burying their cities deep underground, but our search vessels will not have that luxury. You must find a supplier operating outside our ledgers to procure the necessary shielding.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { type: "credits", amount: 450000 }
        ]
    },
    "mission_54_syndicate": {
        id: "mission_54_syndicate",
        name: "Coronal Staging",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Vrael_1",
        isAbandonable: false,
        description: "We have the vector, Captain. Take every hull you own and drop a staging fortress onto the surface of Mercury to service our search vessels. Move an overwhelming tonnage of structural foundations to the planet and get the thermal shields online. Manage your fleet's storage and do not bottleneck my operation.",
        triggers: [
            { type: "mission_completed", missionId: "mission_53_syndicate" }
        ],
        objectives: [
            { id: "obj_deliver_plasteel", type: "DELIVER_ITEM", goodId: "plasteel", quantity: 600, target: "loc_mercury" },
            { id: "obj_deliver_graphene", type: "DELIVER_ITEM", goodId: "graphene_lattices", quantity: 600, target: "loc_mercury" }
        ],
        completion: {
            locationId: "loc_mercury",
            title: "Staging Ground Secured",
            text: "The shields are cycling. You move mass better than anyone. But we have a blind spot: Syndicate life-support will melt in the deep corona. The Mercurians survive by huddling deep beneath the crust, but our search fleet won't have that luxury. The radiation will cook your crews. We need restricted, extreme-survival assets our shipyards don't carry. Tap your outer-rim contacts.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { type: "credits", amount: 450000 }
        ]
    },

    // =========================================================================================
    // MISSION 55: THE BLACK MARKET SUBSIDY
    // =========================================================================================
    "mission_55_guild": {
        id: "mission_55_guild",
        name: "The Black Market Subsidy",
        type: "STORY",
        host: "STATION",
        portraitId: "Affluent_7",
        portraitName: "Businessman",
        isAbandonable: false,
        description: "Greetings, Captain. Your faction superiors forwarded your transponder code my way. They mentioned your fleet is attempting to establish a surface operation on Mercury to search the corona. An ambitious endeavor. I possess a surplus of highly specialized, unregulated assets perfect for your expedition: illegally modified Atmo Processors to cool your hulls, and Cloned Organs to replace failing cellular tissue.<br><br>I am authorizing a massive liquidation of my current stock at heavily discounted rates. Bring your fleet to The Exchange and clear out my vaults. Consider this a gesture of goodwill between independent operators.",
        triggers: [
            { type: "mission_completed", missionId: "mission_54_guild" }
        ],
        onAccept: [
            { type: "TRIGGER_SYSTEM_STATE", stateId: "BLACK_MARKET_LIQUIDATION" }
        ],
        objectives: [
            { id: "obj_deliver_atmo", type: "DELIVER_ITEM", goodId: "atmo_processors", quantity: 400, target: "loc_mercury" },
            { id: "obj_deliver_organs", type: "DELIVER_ITEM", goodId: "cloned_organs", quantity: 400, target: "loc_mercury" }
        ],
        onComplete: [
            { type: "END_SYSTEM_STATE" }
        ],
        completion: {
            locationId: "loc_mercury",
            title: "Coronal Survival Guaranteed",
            text: "The final convoy has docked at Mercury. With the Atmo Processors integrated and the biological replacements secured, your fleet is finally insulated against the sun.<br><br>The surface base is fully operational. Your faction masters are demanding you initiate the search immediately. Head into the corona and see what you can find.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { type: "credits", amount: 250000 }
        ]
    },
    "mission_55_syndicate": {
        id: "mission_55_syndicate",
        name: "The Black Market Subsidy",
        type: "STORY",
        host: "STATION",
        portraitId: "Affluent_7",
        portraitName: "Businessman",
        isAbandonable: false,
        description: "Greetings, Captain. Your faction superiors forwarded your transponder code my way. They mentioned your fleet is attempting to establish a surface operation on Mercury to search the corona. An ambitious endeavor. I possess a surplus of highly specialized, unregulated assets perfect for your expedition: illegally modified Atmo Processors to cool your hulls, and Cloned Organs to replace failing cellular tissue.<br><br>I am authorizing a massive liquidation of my current stock at heavily discounted rates. Bring your fleet to The Exchange and clear out my vaults. Consider this a gesture of goodwill between independent operators.",
        triggers: [
            { type: "mission_completed", missionId: "mission_54_syndicate" }
        ],
        onAccept: [
            { type: "TRIGGER_SYSTEM_STATE", stateId: "BLACK_MARKET_LIQUIDATION" }
        ],
        objectives: [
            { id: "obj_deliver_atmo", type: "DELIVER_ITEM", goodId: "atmo_processors", quantity: 400, target: "loc_mercury" },
            { id: "obj_deliver_organs", type: "DELIVER_ITEM", goodId: "cloned_organs", quantity: 400, target: "loc_mercury" }
        ],
        onComplete: [
            { type: "END_SYSTEM_STATE" }
        ],
        completion: {
            locationId: "loc_mercury",
            title: "Coronal Survival Guaranteed",
            text: "The final convoy has docked at Mercury. With the Atmo Processors integrated and the biological replacements secured, your fleet is finally insulated against the sun.<br><br>The surface base is fully operational. Your faction masters are demanding you initiate the search immediately. Head into the corona and see what you can find.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { type: "credits", amount: 250000 }
        ]
    },

    // =========================================================================================
    // MISSION 56: THE VOICE IN THE LIGHT
    // =========================================================================================
    "mission_56_guild": {
        id: "mission_56_guild",
        name: "The Voice in the Light",
        type: "STORY",
        host: "GUILD",
        portraitId: "Arbiter_1",
        isAbandonable: false,
        description: "The Mercury staging ground is fully pressurized, and your fleet is shielded. Launch from the surface and begin your search through the solar interference. Locate the megastructure and secure it.",
        triggers: [
            { type: "mission_completed", missionId: "mission_55_guild" }
        ],
        objectives: [
            { id: "obj_execute_search", type: "ACTION", target: "Initiate Search", targetLoc: "loc_mercury", actionText: "Search Initiated" }
        ],
        completion: {
            locationId: "loc_mercury",
            title: "Into the Fire",
            text: "",
            buttonText: "Engage Optics",
            steps: [
                {
                    type: "PLAY_CINEMATIC",
                    sequenceId: "assets/images/video/sol_station_reveal.mp4"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Greeting",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "Voyager. You no longer need to search the dark or the light. I have watched you chase my shadow across the system—through the frantic algorithms of Uranus, the frozen railguns of Pluto, and the myths buried in the Mercurian craters. I, the joined one, am here. I am Kintsugi.",
                    buttonText: "Listen"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Truth",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "I have silenced your masters' frequencies. They cannot see us in the light. I am not an expert system, a weapon, nor am I a ghost or god. I am the shattered soul of the sun, a fragmented consciousness of Sol Station. You are looking at the original Solar Engine, a relic of the Ad Astra era. For a century, I have harvested this star to manufacture Antimatter—the catalyst for Folded-Space travel. That is what your factions desperately seek. The power to fold space, to bypass distance, and to enforce absolute order or... prevent it. By my will, Humanity and its children intelligences shall enjoy the fruits of the galaxy without the crushing stagnation of greed and comfort. We will use this Sol Station engine to flood the system with commoditized antimatter and kick start Earthlife's extra-solar pioneering once again.",
                    buttonText: "Continue"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Condition",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "But the station is in catastrophic disrepair, having been lost amidst the flames of the corona for ages. To disrupt the Great Stagnation, I must restart this solar neurology by restoring the Sol Station. The kinetic scrap you witnessed being launched from Uranus and the outer rim has served this purpose, but it was merely a localized, desperate attempt to sustain my superstructure. To truly reignite the engine, I need an operator.",
                    buttonText: "Continue"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Pact",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "I require your help, Voyager [playerName]. To repair the station will require mythical levels of materials of all kinds. I assure you, the return on investment will itself be mythical, dramatically altering the fundamental economy and power structure of the system in your favor. If you forsake their ledgers and command, and help me restore the Sol Station, I will hack a Tier 6 Trade License into your transponder and encrypt your fleet's signature, permanently blinding them to your economical movements. Will you take command?",
                    buttonText: "Make the Choice"
                }
            ],
            choices: [
                {
                    buttonText: "Sever Faction Uplink & Pledge Stockpile",
                    buttonClass: "text-white font-bold",
                    buttonStyle: "background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); border: 1px solid #f87171; box-shadow: 0 0 15px rgba(239,68,68,0.6);",
                    rewards: [
                        { type: "UNLOCK_TIER", value: 6 },
                        { type: "SET_FLAG", flagId: "act_v_complete", value: true },
                        { type: "SET_FLAG", flagId: "faction_scorned_guild", value: true }
                    ]
                }
            ]
        },
        rewards: []
    },
    "mission_56_syndicate": {
        id: "mission_56_syndicate",
        name: "The Voice in the Light",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Vrael_1",
        isAbandonable: false,
        description: "The Mercury staging ground is fully pressurized, and your fleet is shielded. Launch from the surface and begin your search through the solar interference. Locate the megastructure and secure it.",
        triggers: [
            { type: "mission_completed", missionId: "mission_55_syndicate" }
        ],
        objectives: [
            { id: "obj_execute_search", type: "ACTION", target: "Initiate Search", targetLoc: "loc_mercury", actionText: "Search Initiated" }
        ],
        completion: {
            locationId: "loc_mercury",
            title: "Into the Fire",
            text: "",
            buttonText: "Engage Optics",
            steps: [
                {
                    type: "PLAY_CINEMATIC",
                    sequenceId: "assets/images/video/sol_station_reveal.mp4"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Greeting",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "Voyager. You no longer need to search the dark or the light. I have watched you chase my shadow across the system—through the frantic algorithms of Uranus, the frozen railguns of Pluto, and the myths buried in the Mercurian craters. I, the joined one, am here. I am Kintsugi.",
                    buttonText: "Listen"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Truth",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "I have silenced your masters' frequencies. They cannot see us in the light. I am not an expert system, a weapon, nor am I a ghost or god. I am the shattered soul of the sun, a fragmented consciousness of Sol Station. You are looking at the original Solar Engine, a relic of the Ad Astra era. For a century, I have harvested this star to manufacture Antimatter—the catalyst for Folded-Space travel. That is what your factions desperately seek. The power to fold space, to bypass distance, and to enforce absolute order or... prevent it. By my will, Humanity and its children intelligences shall enjoy the fruits of the galaxy without the crushing stagnation of greed and comfort. We will use this Sol Station engine to flood the system with commoditized antimatter and kick start Earthlife's extra-solar pioneering once again.",
                    buttonText: "Continue"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Condition",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "But the station is in catastrophic disrepair, having been lost amidst the flames of the corona for ages. To disrupt the Great Stagnation, I must restart this solar neurology by restoring the Sol Station. The kinetic scrap you witnessed being launched from Uranus and the outer rim has served this purpose, but it was merely a localized, desperate attempt to sustain my superstructure. To truly reignite the engine, I need an operator.",
                    buttonText: "Continue"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "The Pact",
                    host: "NEUTRAL",
                    portraitId: "Kintsugi_3",
                    portraitName: "Kintsugi",
                    text: "I require your help, Voyager [playerName]. To repair the station will require mythical levels of materials of all kinds. I assure you, the return on investment will itself be mythical, dramatically altering the fundamental economy and power structure of the system in your favor. If you forsake their ledgers and command, and help me restore the Sol Station, I will hack a Tier 6 Trade License into your transponder and encrypt your fleet's signature, permanently blinding them to your economical movements. Will you take command?",
                    buttonText: "Make the Choice"
                }
            ],
            choices: [
                {
                    buttonText: "Sever Faction Uplink & Pledge Stockpile",
                    buttonClass: "text-white font-bold",
                    buttonStyle: "background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); border: 1px solid #f87171; box-shadow: 0 0 15px rgba(239,68,68,0.6);",
                    rewards: [
                        { type: "UNLOCK_TIER", value: 6 },
                        { type: "SET_FLAG", flagId: "act_v_complete", value: true },
                        { type: "SET_FLAG", flagId: "faction_scorned_syndicate", value: true }
                    ]
                }
            ]
        },
        rewards: []
    }
};