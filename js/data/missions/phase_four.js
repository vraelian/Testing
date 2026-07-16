// js/data/missions/phase_four.js
/**
 * @fileoverview Mission registry for Act IV: Systemic Confrontation.
 * Introduces high-tier logistical checks, hostile system states, sequential modals,
 * and the climax of the handler relationships.
 */

export const PHASE_FOUR_MISSIONS = {
    "mission_47_guild": {
        id: "mission_47_guild",
        name: "The War Chest",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        description: "The Guild high command demands a massive capital reserve reinforcement and a comprehensive stockpile of core commodities to reinforce supply lines before overt hostilities begin.",
        triggers: [
            { type: "mission_completed", missionId: "mission_46" },
            { type: "flag_is_true", flag: "faction_aligned_guild" }
        ],
        objectives: [
            { id: "obj_credits", type: "HAVE_CREDITS", value: 350000 },
            { id: "obj_water", type: "DELIVER_ITEM", goodId: "water_ice", quantity: 10, target: "loc_luna" },
            { id: "obj_plasteel", type: "DELIVER_ITEM", goodId: "plasteel", quantity: 10, target: "loc_luna" },
            { id: "obj_hydro", type: "DELIVER_ITEM", goodId: "hydroponics", quantity: 10, target: "loc_luna" },
            { id: "obj_cyber", type: "DELIVER_ITEM", goodId: "cybernetics", quantity: 10, target: "loc_luna" },
            { id: "obj_propellant", type: "DELIVER_ITEM", goodId: "propellant", quantity: 10, target: "loc_luna" },
            { id: "obj_processors", type: "DELIVER_ITEM", goodId: "processors", quantity: 10, target: "loc_luna" },
            { id: "obj_graphene", type: "DELIVER_ITEM", goodId: "graphene_lattices", quantity: 10, target: "loc_luna" },
            { id: "obj_cryo", type: "DELIVER_ITEM", goodId: "cryo_pods", quantity: 10, target: "loc_luna" }
        ],
        onComplete: [
            { type: "DEDUCT_CREDITS", amount: 350000 },
            { type: "UNLOCK_TIER", value: 5 }
        ],
        completion: {
            locationId: "loc_luna",
            title: "Allocation Verified",
            text: "The Guild treasury has verified the asset allocation. Your trade profile has been updated to grant access to tier five commodities.",
            buttonText: "Accept Tier 5 Trade License"
        },
        rewards: [
            { type: "license", licenseId: "t5_license" }
        ]
    },
    "mission_47_syndicate": {
        id: "mission_47_syndicate",
        name: "The War Chest",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        description: "The Syndicate requires massive financial liquidity and a comprehensive commodity stock to fuel the upcoming deployment of their flagship fleet.",
        triggers: [
            { type: "mission_completed", missionId: "mission_46" },
            { type: "flag_is_true", flag: "faction_aligned_syndicate" }
        ],
        objectives: [
            { id: "obj_credits", type: "HAVE_CREDITS", value: 350000 },
            { id: "obj_water", type: "DELIVER_ITEM", goodId: "water_ice", quantity: 10, target: "loc_neptune" },
            { id: "obj_plasteel", type: "DELIVER_ITEM", goodId: "plasteel", quantity: 10, target: "loc_neptune" },
            { id: "obj_hydro", type: "DELIVER_ITEM", goodId: "hydroponics", quantity: 10, target: "loc_neptune" },
            { id: "obj_cyber", type: "DELIVER_ITEM", goodId: "cybernetics", quantity: 10, target: "loc_neptune" },
            { id: "obj_propellant", type: "DELIVER_ITEM", goodId: "propellant", quantity: 10, target: "loc_neptune" },
            { id: "obj_processors", type: "DELIVER_ITEM", goodId: "processors", quantity: 10, target: "loc_neptune" },
            { id: "obj_graphene", type: "DELIVER_ITEM", goodId: "graphene_lattices", quantity: 10, target: "loc_neptune" },
            { id: "obj_cryo", type: "DELIVER_ITEM", goodId: "cryo_pods", quantity: 10, target: "loc_neptune" }
        ],
        onComplete: [
            { type: "DEDUCT_CREDITS", amount: 350000 },
            { type: "UNLOCK_TIER", value: 5 }
        ],
        completion: {
            locationId: "loc_neptune",
            title: "Escrow Confirmed",
            text: "The Syndicate networks have routed your capital deposit. Your operational clearance has been upgraded to tier five commodities.",
            buttonText: "Accept Tier 5 Trade License"
        },
        rewards: [
            { type: "license", licenseId: "t5_license" }
        ]
    },
    "mission_48": {
        id: "mission_48",
        name: "The Escape Vector",
        type: "STORY",
        host: "NEUTRAL",
        portraitId: "Expert_System_3",
        portraitName: "Cryptographer Phanes",
        description: "An asymmetrical Expert System on Pluto predicts imminent systemic deactivation and demands a flight-ready hull to escape the planet, offering a powerful sensory upgrade in exchange.",
        triggers: [
            { type: "mission_completed", missionId: "mission_47_guild" },
            { type: "mission_completed", missionId: "mission_47_syndicate" }
        ],
        objectives: [
            { id: "obj_travel_pluto", type: "TRAVEL_TO", target: "loc_pluto" },
            { id: "obj_own_spare_ship", type: "OWN_SPARE_SHIPS", value: 1 }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "Vessel Exchange",
            text: "To authorize the transfer, you must select one of your spare registered hulls. The Cryptographer's auxiliary protocols will overwrite the ship's transponder codes and initiate an immediate launch sequence.",
            choices: [
                {
                    buttonText: "Transfer Reserve Hull",
                    buttonClass: "text-black font-bold",
                    buttonStyle: "background: linear-gradient(135deg, #ffffff 0%, #a479e2 100%);",
                    rewards: [
                        { type: "REMOVE_SPARE_SHIP" },
                        { type: "GRANT_UPGRADE", upgradeId: "UPG_UTIL_RADAR_3" }
                    ]
                }
            ]
        },
        rewards: []
    },
    "mission_49_guild": {
        id: "mission_49_guild",
        name: "Apex Assets",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        description: "The Syndicate is monopolizing Pluto's raw xeno-geological materials. Navigate the Guild's tactical blockade, secure the resources, and deliver them to Luna.",
        triggers: [
            { type: "mission_completed", missionId: "mission_48" },
            { type: "flag_is_true", flag: "faction_aligned_guild" }
        ],
        onAccept: [
            { type: "TRIGGER_SYSTEM_STATE", stateId: "SYSTEMIC_BLOCKADE" }
        ],
        objectives: [
            { id: "obj_collect_xeno", type: "COLLECT_ITEM", goodId: "xeno_geologicals", quantity: 60, target: "loc_pluto" },
            { id: "obj_deliver_xeno", type: "DELIVER_ITEM", goodId: "xeno_geologicals", quantity: 60, target: "loc_luna", dependsOn: "obj_collect_xeno" }
        ],
        onComplete: [
            { type: "END_SYSTEM_STATE" }
        ],
        completion: {
            locationId: "loc_luna",
            title: "Mineral Reserves Secured",
            text: "The Guild's heavy freighters have secured the xeno-geological isotopes. The systemic blockade has been lifted, returning market traffic to normal parameters.",
            buttonText: "Confirm Delivery"
        },
        rewards: [
            { type: "credits", amount: 180000 }
        ]
    },
    "mission_49_syndicate": {
        id: "mission_49_syndicate",
        name: "Apex Assets",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        description: "Distribute a massive shipment of illegal cloned organs to buyers at Jupiter while navigating a tight system blockade established by Guild authorities.",
        triggers: [
            { type: "mission_completed", missionId: "mission_48" },
            { type: "flag_is_true", flag: "faction_aligned_syndicate" }
        ],
        onAccept: [
            { type: "TRIGGER_SYSTEM_STATE", stateId: "SYSTEMIC_BLOCKADE" }
        ],
        objectives: [
            { id: "obj_collect_organs", type: "COLLECT_ITEM", goodId: "cloned_organs", quantity: 60, target: "loc_mercury" },
            { id: "obj_deliver_organs", type: "DELIVER_ITEM", goodId: "cloned_organs", quantity: 60, target: "loc_jupiter", dependsOn: "obj_collect_organs" }
        ],
        onComplete: [
            { type: "END_SYSTEM_STATE" }
        ],
        completion: {
            locationId: "loc_jupiter",
            title: "Bio-Assets Delivered",
            text: "The Syndicate's Jovian networks have confirmed receipt of the life-extension cargo. The blockade has degraded, restoring standard market operations.",
            buttonText: "Collect Payout"
        },
        rewards: [
            { type: "credits", amount: 180000 }
        ]
    },
    "mission_50_guild": {
        id: "mission_50_guild",
        name: "Asset Denial",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        description: "Intercept a massive Syndicate shipment of cloned organs at Saturn, travel to Mars to corrupt their Starport grid, and secure the remaining cargo at Luna.",
        triggers: [
            { type: "mission_completed", missionId: "mission_49_guild" }
        ],
        objectives: [
            { id: "obj_intercept", type: "COLLECT_ITEM", goodId: "cloned_organs", quantity: 40, target: "loc_saturn" },
            { id: "obj_grid_virus", type: "TRAVEL_TO", target: "loc_mars", dependsOn: "obj_intercept" },
            { id: "obj_secure_cargo", type: "DELIVER_ITEM", goodId: "cloned_organs", quantity: 40, target: "loc_luna", dependsOn: "obj_grid_virus" }
        ],
        completion: {
            locationId: "loc_luna",
            title: "Sabotage Logged",
            text: "The Syndicate's financial pipelines are in disarray. Audita's voice is strained, but her telemetry confirms the operation's success.",
            buttonText: "Finalize Operation"
        },
        rewards: [
            { type: "credits", amount: 210000 }
        ]
    },
    "mission_50_syndicate": {
        id: "mission_50_syndicate",
        name: "Asset Denial",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        description: "Intercept the Guild's xeno-geological transports at Mars, travel to Pluto to overload their kinetic launch arrays, and deliver the remaining minerals to Venus.",
        triggers: [
            { type: "mission_completed", missionId: "mission_49_syndicate" }
        ],
        objectives: [
            { id: "obj_intercept_xeno", type: "COLLECT_ITEM", goodId: "xeno_geologicals", quantity: 40, target: "loc_mars" },
            { id: "obj_railgun_overload", type: "TRAVEL_TO", target: "loc_pluto", dependsOn: "obj_intercept_xeno" },
            { id: "obj_deliver_isotopes", type: "DELIVER_ITEM", goodId: "xeno_geologicals", quantity: 40, target: "loc_venus", dependsOn: "obj_railgun_overload" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "Monopoly Shattered",
            text: "The Guild's geological networks are crippled. Kiern's voice sounds relieved as she confirms your arrival at Venus.",
            buttonText: "Finalize Sabotage"
        },
        rewards: [
            { type: "credits", amount: 210000 }
        ]
    },
    "mission_51_guild": {
        id: "mission_51_guild",
        name: "Fatal Optics",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        description: "Pick up Audita at Luna and transport her to Kepler's Eye to scan the solar corona megastructure directly.",
        triggers: [
            { type: "mission_completed", missionId: "mission_50_guild" }
        ],
        objectives: [
            { id: "obj_pickup_audita", type: "TRAVEL_TO", target: "loc_luna" },
            { id: "obj_transport_kepler", type: "TRAVEL_TO", target: "loc_kepler", dependsOn: "obj_pickup_audita" }
        ],
        completion: {
            locationId: "loc_kepler",
            title: "Drop-off Confirmed",
            text: "The drop-off is complete. You watch from your cockpit as Audita's physical console is escorted into the secure observation wing of Kepler's Eye.",
            buttonText: "Confirm and Disengage",
            steps: [
                {
                    type: "NARRATION_MODAL",
                    title: "Intercepted Transmission",
                    text: `A few minutes after undocking, a system-wide transmission from an unknown Cryptographer intercepts your communication systems, overriding all active channels:<br><br>"Attention, voyager. We must protect the joining. We must hide the child of the nuclear engine, the soul of the star. Kepler's Eye has been adjusted. Its cooling arrays have been sabotaged to reduce thermal dissipation efficiency when the Ocularium aligns with the solar corona. Staring directly into the solar corona will flood the core with solar feedback that it cannot vent. Catastrophic thermal overload is imminent. Decompression is certain."`,
                    buttonText: "Acknowledge Transmission"
                },
                {
                    type: "PLAY_CINEMATIC",
                    sequenceId: "assets/images/video/kepler_decompression.mp4"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "Catastrophic Overload",
                    text: "<span class='pov-narration'>A sudden, blinding flash erupts from the heart of Kepler's Eye as the Ocularium lens aligns with the sun. The cooling arrays, corrupted by the Cryptographers, fail immediately to vent the immense thermal feedback. Through your ship's long-range sensors, you watch in silent, absolute horror as the station's structure swells under the pressure, the observation wing splitting open in a silent explosion of light and gas. The decompression is instant. Kepler's Eye is reduced to a cloud of drifting, sun-scorched scrap. Your handler is gone.</span>",
                    buttonText: "Initiate Emergency Detachment"
                }
            ]
        },
        rewards: []
    },
    "mission_51_syndicate": {
        id: "mission_51_syndicate",
        name: "Fatal Optics",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        description: "Pick up Kiern at Venus and transport her to Kepler's Eye to run real-time optics on the solar anomaly.",
        triggers: [
            { type: "mission_completed", missionId: "mission_50_syndicate" }
        ],
        objectives: [
            { id: "obj_pickup_kiern", type: "TRAVEL_TO", target: "loc_venus" },
            { id: "obj_transport_kepler", type: "TRAVEL_TO", target: "loc_kepler", dependsOn: "obj_pickup_kiern" }
        ],
        completion: {
            locationId: "loc_kepler",
            title: "Drop-off Confirmed",
            text: "The drop-off is complete. Kiern steps onto the landing deck of Kepler's Eye, her environmental suit sealing out the cold. She looks back offering a silent wave before entering the primary observation wing.",
            buttonText: "Confirm and Disengage",
            steps: [
                {
                    type: "NARRATION_MODAL",
                    title: "Intercepted Transmission",
                    text: `A few minutes after undocking, a system-wide transmission from an unknown Cryptographer intercepts your communication systems, overriding all active channels:<br><br>"Attention, voyager. We must protect the joining. We must hide the child of the nuclear engine, the soul of the star. Kepler's Eye has been adjusted. Its cooling arrays have been sabotaged to reduce thermal dissipation efficiency when the Ocularium aligns with the solar corona. Staring directly into the solar corona will flood the core with solar feedback that it cannot vent. Catastrophic thermal overload is imminent. Decompression is certain."`,
                    buttonText: "Acknowledge Transmission"
                },
                {
                    type: "PLAY_CINEMATIC",
                    sequenceId: "assets/images/video/kepler_decompression.mp4"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "Catastrophic Overload",
                    text: "<span class='pov-narration'>A sudden, blinding flash erupts from the heart of Kepler's Eye as the Ocularium lens aligns with the sun. The cooling arrays, corrupted by the Cryptographers, fail immediately to vent the immense thermal feedback. Through your ship's long-range sensors, you watch in silent, absolute horror as the station's structure swells under the pressure, the observation wing splitting open in a silent explosion of light and gas. The decompression is instant. Kepler's Eye is reduced to a cloud of drifting, sun-scorched scrap. Your handler is gone.</span>",
                    buttonText: "Initiate Emergency Detachment"
                }
            ]
        },
        rewards: []
    },
    "mission_52_guild": {
        id: "mission_52_guild",
        name: "The Succession",
        type: "STORY",
        host: "GUILD",
        portraitId: "Arbiter_1",
        description: "The Arbiter contacts you directly to fill the executive power vacuum left by Audita's deactivation.",
        triggers: [
            { type: "mission_completed", missionId: "mission_51_guild" }
        ],
        objectives: [
            { id: "obj_succession_read", type: "TRAVEL_TO", target: "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Executive Promotion",
            text: "The Arbiter has finalized your promotion. A high-performance Class S hull has been delivered to your hangar.",
            buttonText: "Claim Class S Vessel"
        },
        rewards: [
            { type: "GRANT_SHIP", shipId: "Aegis_Executive.Ship" }
        ]
    },
    "mission_52_syndicate": {
        id: "mission_52_syndicate",
        name: "The Succession",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Vrael_1",
        description: "Vrael contacts you directly to promote you into the Syndicate's inner circle following Kiern's deactivation.",
        triggers: [
            { type: "mission_completed", missionId: "mission_51_syndicate" }
        ],
        objectives: [
            { id: "obj_succession_read_syn", type: "TRAVEL_TO", target: "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "Inner Circle Elevation",
            text: "Vrael has confirmed your status. A high-performance Class S vessel has been routed to your fleet.",
            buttonText: "Claim Class S Vessel"
        },
        rewards: [
            { type: "GRANT_SHIP", shipId: "Chaos_Predator.Ship" }
        ]
    },
    "mission_53_guild": {
        id: "mission_53_guild",
        name: "The Exchange Protocol",
        type: "STORY",
        host: "GUILD",
        portraitId: "Arbiter_1",
        description: "Collect four codex badges from Mars, Saturn, Uranus, and Pluto to locate The Exchange, only to face a critical signal interruption from Kintsugi.",
        triggers: [
            { type: "mission_completed", missionId: "mission_52_guild" }
        ],
        objectives: [
            { id: "badge_1", type: "TRAVEL_TO", target: "loc_mars" },
            { id: "badge_2", type: "TRAVEL_TO", target: "loc_saturn", dependsOn: "badge_1" },
            { id: "badge_3", type: "TRAVEL_TO", target: "loc_uranus", dependsOn: "badge_2" },
            { id: "badge_4", type: "TRAVEL_TO", target: "loc_pluto", dependsOn: "badge_3" }
        ],
        onRouteToFinalObjective: {
            type: "TRIGGER_STORY_EVENT",
            eventId: "evt_kintsugi_intercept_final",
            text: "Sovereign voyager. The tycoon has been relocated. The coordinates are nullified to prevent interference with the joining. Seek not the market, but the center of gravity."
        },
        onComplete: [
            { type: "SET_FLAG", flagId: "act_iv_complete", value: true }
        ],
        completion: {
            locationId: "any",
            title: "The Coronal Mandate",
            text: "The coordinates to The Exchange have been nullified. The Arbiter has cancelled the merchant search and initiated a total realignment, directing you to assemble a fleet and prepare for solar exploration.",
            buttonText: "Accept Coronal Mandate"
        },
        rewards: []
    },
    "mission_53_syndicate": {
        id: "mission_53_syndicate",
        name: "The Exchange Protocol",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Vrael_1",
        description: "Collect four codex badges from Venus, Mars, Jupiter, and Pluto to locate The Exchange, only to face a critical signal interruption from Kintsugi.",
        triggers: [
            { type: "mission_completed", missionId: "mission_52_syndicate" }
        ],
        objectives: [
            { id: "badge_1_syn", type: "TRAVEL_TO", target: "loc_venus" },
            { id: "badge_2_syn", type: "TRAVEL_TO", target: "loc_mars", dependsOn: "badge_1_syn" },
            { id: "badge_3_syn", type: "TRAVEL_TO", target: "loc_jupiter", dependsOn: "badge_2_syn" },
            { id: "badge_4_syn", type: "TRAVEL_TO", target: "loc_pluto", dependsOn: "badge_3_syn" }
        ],
        onRouteToFinalObjective: {
            type: "TRIGGER_STORY_EVENT",
            eventId: "evt_kintsugi_intercept_final",
            text: "Sovereign voyager. The tycoon has been relocated. The coordinates are nullified to prevent interference with the joining. Seek not the market, but the center of gravity."
        },
        onComplete: [
            { type: "SET_FLAG", flagId: "act_iv_complete", value: true }
        ],
        completion: {
            locationId: "any",
            title: "The Coronal Mandate",
            text: "The coordinates to The Exchange have been nullified. Vrael has cancelled the merchant search and initiated a total realignment, directing you to assemble a fleet and prepare for solar exploration.",
            buttonText: "Accept Coronal Mandate"
        },
        rewards: []
    }
};