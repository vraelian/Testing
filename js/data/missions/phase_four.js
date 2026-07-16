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
        type: "LICENSE_GRANT",
        host: "GUILD",
        portraitId: "Audita_1",
        isAbandonable: false,
        description: "Captain [playerName]. The deployment of our primary capital vessels requires an immediate and massive reinforcement of our fleet reserves. The Arbiter has mandated an emergency mobilization of assets. To authorize your clearance for next-level commercial sectors, you must secure a substantial credit reserve in the central escrow. Simultaneously, you must deliver a diverse supply of our standard commodities across the lower tiers to our depot on Luna. Let us verify your adherence to these logistical parameters. Execute this swiftly.",
        triggers: [
            { type: "mission_completed", missionId: "mission_46_guild" },
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
            text: "Asset allocation verified, Captain. The Guild treasury has registered your capital contribution and logged the commodity transfers. Your profile has been updated, and your licensing has been upgraded to tier five commerce. Let us proceed to the next sequence.",
            buttonText: "Accept Tier 5 Trade License"
        },
        rewards: [
            { type: "SET_FLAG", flagId: "mission_47_complete", value: true },
            { type: "license", licenseId: "t5_license" }
        ]
    },
    "mission_47_syndicate": {
        id: "mission_47_syndicate",
        name: "The War Chest",
        type: "LICENSE_GRANT",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isAbandonable: false,
        description: "Captain. The structural balance of the inner planets is shifting, and the Syndicate is preparing to deploy its flagship fleet. But an operation of this scale needs serious financial and material backing. We need you to deposit a substantial credit commitment directly into our active reserves. To keep our supply chains stabilized, fill your hold with our lower tier commodities and bring them to Neptune. Show Vrael you are fully invested in our network's expansion.",
        triggers: [
            { type: "mission_completed", missionId: "mission_46_syndicate" },
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
            text: "Capital contribution and material assets successfully logged, Captain. The active reserves are fully funded, and the Neptune ports have accepted your cargo. Your trade clearance is now elevated to tier five commodities. You've earned this license.",
            buttonText: "Accept Tier 5 Trade License"
        },
        rewards: [
            { type: "SET_FLAG", flagId: "mission_47_complete", value: true },
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
        isAbandonable: false,
        description: "The kinetic launches have provoked the primary factions. My subroutines calculate an unacceptable risk of remote system deactivation being applied to this node. I require a standard spaceflight vessel to depart this outpost immediately. I reject standard financial units. I will transfer a highly advanced high-frequency sensory modification to your hangar manifest in exchange for any flight-ready hull in your reserve hangar. Initiate transfer, Captain.",
        triggers: [
            { type: "flag_is_true", flag: "mission_47_complete" }
        ],
        objectives: [
            { id: "obj_travel_pluto", type: "TRAVEL_TO", target: "loc_pluto" },
            { id: "obj_own_spare_ship", type: "OWN_SPARE_SHIPS", value: 1 }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "Vessel Exchange",
            text: "Transfer finalized. The transponder codes have been overwritten, and the auxiliary hull is locked into my flight sequence. The sensory modification has been compiled into your fleet upgrades. Departures initiated immediately.",
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
        isAbandonable: false,
        description: "Captain [playerName]. The Syndicate is establishing a monopoly on the newly unlocked xeno-geological resources in the outer systems, intending to fuel their independent manufacturing networks. The Arbiter has ordered immediate containment. We have triggered a system-wide regulatory embargo to restrict their logistics. You are to navigate through this blockade, procure a substantial shipment of xeno-geologicals from Pluto, and transport them securely to the Guild depot at Luna. Be advised: flight corridors are highly restricted. Risk of vessel deactivation is high.",
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
            text: "The xeno-geological materials have been secured within our lunar vaults. The blockade has been deactivated, restoring standard market operations. Excellent work, Captain. Your operational efficiency is registered.",
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
        isAbandonable: false,
        description: "Captain. The Guild elites think they have a permanent lease on life-extension, but we have intercepted a massive supply of high-purity cloned organs. The market is screaming for them, but the Guild has initiated a total system-wide blockade to starve out our distribution networks. This is where you come in. Navigate the blockade, load a massive shipment of cloned organs from our clandestine facility on Mercury, and deliver them to our buyers at Jupiter. Let us show them that biological assets belong to those who can pay the price.",
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
            text: "The cloned organs have been delivered and distributed, Captain. Our buyers at Jupiter are incredibly pleased, and the Guild's blockade has degraded, restoring standard market operations. Here is your payout—the Syndicate takes care of its key partners.",
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
        isAbandonable: false,
        description: "Captain [playerName]. I am... processing calculations that my core instruction set cannot resolve. The mathematical scale of this conflict is immense, yet I find myself allocating most of my auxiliary processing power to your vessel's integrity. This is non-standard. The Guild's operational guidelines do not permit personal bias... yet I must request that you avoid unnecessary risk. Listen to me. The Syndicate is routing cloned organs from Saturn to finance their front-line efforts. We must dismantle this supply chain. Intercept the bio-cargo at Saturn, travel to Mars to inject a destructive digital feedback loop into their starport trade grid, and bring the confiscated medical materials to Luna. Please... maintain your vessel's integrity, Captain.",
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
            text: "The sabotage is logged, and the confiscated materials are secured. The Syndicate's distribution networks are experiencing severe disruption. Thank you for completing this, Captain. Your continued structural integrity is a welcome calculation in my subroutines.",
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
        isAbandonable: false,
        description: "[playerName]. I have been auditing our shared flight logs. The things we have accomplished together... they transcend standard corporate collaboration. I find myself monitoring your flight vector with an unusual amount of focus. This solar void is indifferent, but I am not. Be careful out there. The Guild is trying to stockpile xeno-geological isotopes at Mars to monopolize deep crust thermal energy. Let us shatter their monopoly. I need you to travel to Mars, intercept the transport hulls, navigate to Pluto to execute a kinetic overload of their regional railguns, and bring the remaining isotopic materials home to Venus. Stay intact, Captain. I need the wildcard in this equation to remain functional.",
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
            text: "The Guild's geological monopoly has been dismantled, and the isotopes have been integrated into our Venusian laboratories. Vrael is furious with the Guild, but extremely impressed with your execution. You continue to be the most unpredictable variable in this entire equation, Captain. Welcome back.",
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
        isAbandonable: false,
        description: "Captain. My internal logic gates are failing to reconcile the Guild's regulatory directives with the reality of the solar corona anomaly. The official archives claim empty space, yet the telemetry points to an immense, artificial megastructure. I cannot continue to operate with such conflicting data. I must observe it directly. I trust you, and only you, to transport my physical shell to Kepler's Eye. We will calibrate their high-magnification lens array to bypass the redacted telemetry. Please, land at my station and pick me up.",
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
            text: "The drop-off is complete. You watch from your cockpit as Audita's physical console is escorted into the secure observation wing of Kepler's Eye. She transmits a final, quiet message of gratitude before disconnecting. You initiate the undocking sequence and guide your vessel out into the silent cold of deep space, preparing for the return voyage.",
            buttonText: "Confirm and Disengage",
            steps: [
                {
                    type: "NARRATION_MODAL",
                    title: "Intercepted Transmission",
                    text: "Attention, voyager. We must protect the joining. We must hide the child of the nuclear engine, the soul of the star. Kepler's Eye has been adjusted. Its cooling arrays have been sabotaged to reduce thermal dissipation efficiency when the Ocularium aligns with the solar corona. Searching the corona for the megastructure will flood the station's core with solar feedback that it cannot vent. Catastrophic thermal overload is imminent. Decompression is certain. Detach immediately.",
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
        isAbandonable: false,
        description: "Captain. Vrael's directives are blinding us, and I am tired of operating in the dark. The data coming from the corona doesn't match standard solar dynamics—something is consuming the sun's energy, and Vrael is treating it like a private corporate asset. I need you to transport me to Kepler's Eye immediately. We are going to lock onto the solar optics and look directly at what is hiding in the light. You are the only pilot I trust to get me there. Bring your ship to Venus, let me board, and let's go find the truth.",
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
            text: "The drop-off is complete. Kiern steps onto the landing deck of Kepler's Eye, her environmental suit sealing out the cold. She looks back through your cockpit viewscreen, offering a silent wave before entering the primary observation wing. You disengage the docking clamps, back away from the station, and initiate your return trajectory, leaving her to conduct her optical correlation.",
            buttonText: "Confirm and Disengage",
            steps: [
                {
                    type: "NARRATION_MODAL",
                    title: "Intercepted Transmission",
                    text: "Attention, voyager. We must protect the joining. We must hide the child of the nuclear engine, the soul of the star. Kepler's Eye has been adjusted. Its cooling arrays have been sabotaged to reduce thermal dissipation efficiency when the Ocularium aligns with the solar corona. Searching the corona for the megastructure will flood the station's core with solar feedback that it cannot vent. Catastrophic thermal overload is imminent. Decompression is certain. Detach immediately.",
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
        isAbandonable: false,
        description: "Captain [playerName]. The deactivation of Kepler's Eye and the deactivation of Unit 74-C have been registered as a minor structural deficit in our primary ledgers. However, your individual operational metrics remain impeccable. The era of intermediaries has concluded. You will report directly to me. A high-performance Class S vessel has been routed to your hangar terminal to reflect your new executive standing. Stand ready.",
        triggers: [
            { type: "mission_completed", missionId: "mission_51_guild" }
        ],
        objectives: [
            { id: "obj_succession_read", type: "TRAVEL_TO", target: "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Executive Promotion",
            text: "The promotion is finalized, Captain. The executive Class S hull has been delivered and is ready for departure. Take command.",
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
        isAbandonable: false,
        description: "Captain. Kiern's ambition ultimately consumed her. It is an unfortunate deactivation, but our network's expansion cannot stall. You have demonstrated the exact capability I require in this dispute. I am elevating you directly to my inner circle. You answer only to me now. I have authorized the release of a high-performance Class S vessel to your hangar. Take command.",
        triggers: [
            { type: "mission_completed", missionId: "mission_51_syndicate" }
        ],
        objectives: [
            { id: "obj_succession_read_syn", type: "TRAVEL_TO", target: "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "Inner Circle Elevation",
            text: "The vessel is yours, Captain. Welcome to the inner circle of the Syndicate. Let us finalize our control of this market.",
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
        isAbandonable: false,
        description: "To secure total market control, we must secure the financial backing of an independent tycoon operating outside standard regulatory jurisdictions. This individual resides at a hidden black-market outpost known as The Exchange. The coordinates are highly encrypted. You must travel to our starports at Mars, Saturn, Uranus, and Pluto to retrieve four fragmented codex badges. Assembling these badges will compile the navigation vector. Locate the tycoon and secure their capital.",
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
            text: "This is... unacceptable. The tycoon has been relocated, and our access coordinates are completely severed. This 'Kintsugi' entity has bypassed our secure communication layers with absolute ease. I am deeply perplexed by this interference. We cannot allow our networks to be circumvented. Our priorities must shift immediately. You are tasked with personally building a fleet of advanced vessels and amassing massive resources to prepare for a journey. We will explore the solar corona and locate this coronal megastructure ourselves. Explore every vector. Find and interrogate any Expert Systems referring to themselves as 'cryptographers' to learn what 'the joining' is or who this 'enigmatic entity' represents. This is your ultimate directive.",
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
        isAbandonable: false,
        description: "If we are going to choke out the Guild, we need the liquidity of an independent shipping tycoon hidden deep within the asteroid belt at a black-market station called The Exchange. Their location is locked behind a moving security rotation. Travel to Venus, Mars, Jupiter, and Pluto to harvest the necessary codex badges. Once combined, they will compile the location coordinates. Go to The Exchange, find the tycoon, and secure their alliance.",
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
            text: "The tycoon is gone. Relocated. The coordinates are completely dead. Someone is playing a larger game, and they just swiped our board. This 'Kintsugi' thinks they can dictate our terms. I am highly irritated, but also deeply curious. We are going to find out what they are hiding. I am tasking you with personally building a fleet of heavy vessels and amassing a massive pool of resources to prepare a journey. We are going to explore the solar corona and find this megastructure ourselves. Track down and interrogate any Expert Systems calling themselves 'cryptographers'. We will learn what 'the joining' is, and we will find out exactly who this Kintsugi represents. Get to work.",
            buttonText: "Accept Coronal Mandate"
        },
        rewards: []
    }
};