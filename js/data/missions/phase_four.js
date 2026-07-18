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
        description: "Captain [playerName]. The deployment of our primary capital vessels has triggered an unprecedented deficit in our fleet reserves. The Arbiter has mandated an absolute mobilization of logistical assets. Before we authorize your clearance for high-tier commercial sectors, you must prove your infrastructure can support the Guild's expanded tonnage. Secure a substantial credit reserve in our central escrow, and simultaneously flood our Lunar depot with a diverse supply of baseline commodities. Your history moving freight in the Belt was adequate, but this is a systemic escalation. Execute this flawlessly.",
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
            text: "Asset allocation has been completely verified, Captain. The Guild treasury has successfully processed your capital contribution, and the dockmasters have finished integrating your commodity transfers into the active reserves. Your operational profile now reflects these finalized deliveries. Consequently, your licensing has been upgraded to tier five commerce.",
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
        description: "Captain. The structural balance of the inner planets is fracturing, and the Syndicate is preparing to deploy its flagship fleet into the fault lines. But an operation of this scale requires immense material backing. We need you to deposit a heavy credit commitment directly into our active reserves. Simultaneously, pack your holds to the brim with baseline commodities and drag them out to Neptune. We know you can run standard freight; now show Vrael you possess the infrastructure to fuel a systemic takeover.",
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
            text: "Your capital contribution and material assets have been successfully processed, Captain. The escrow transfer is finalized, and the Neptune dockhands have entirely offloaded your cargo into our staging bays. With these deliveries complete, your trade clearance stands elevated to tier five commodities.",
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
        description: "Voyager. The kinetic launches have catalyzed the primary factions into an aggressive posture. My internal subroutines calculate a severe probability of localized system deactivation at this node. I require a standard spaceflight chassis to exfiltrate this coordinate immediately. I reject standard financial units. I will augment your current vessel in exchange for the physical transfer of any flight-ready hull in your reserve. Initiate the exchange.",
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
            text: "Transfer protocol finalized. The transponder codes for the provided vessel have been permanently overwritten, and the physical hull is now locked into my autonomous flight sequence. As agreed, I have compiled the advanced sensory modification directly into your active manifest. I will now break orbit.",
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
        description: "Captain [playerName]. The Syndicate is attempting to establish a monopoly on the xeno-geological resources in the outer systems to fuel their localized manufacturing. The Arbiter has ordered absolute containment. We have triggered a system-wide regulatory blockade to suffocate their logistics. However, we require those exact materials for our own vaults. As an authorized Guild contractor, your transponder is cleared to navigate this embargo. Procure a substantial shipment of xeno-geologicals from Pluto and transport them securely to the Guild depot at Luna. We will secure our reserves while they starve.",
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
            text: "The xeno-geological freight has been safely unloaded and sealed within our lunar vaults. With the physical assets verified in our possession, the system-wide blockade has served its purpose and has been formally deactivated, restoring standard market operations. Your operational efficiency in navigating the embargo has been fully logged.",
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
        description: "Captain. The Guild elites think they hold a permanent lease on life-extension, but we just intercepted a massive yield of high-purity cloned organs. The black market is starving for them, but the Guild has triggered a brutal system-wide blockade to choke our distribution lines. This requires a heavy-hauler with nerve. Navigate the embargo, extract the biologicals from our sub-surface crater facility on Mercury, and push them through to our buyers at Jupiter. Let's remind the Guild that longevity goes to the highest bidder.",
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
            text: "The biological freight has been successfully offloaded and distributed to our buyers at Jupiter, Captain. With the assets firmly in our network, the Guild's blockade has inevitably degraded, restoring standard market volatility. The transfer is finalized. Collect your payout.",
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
        description: "Captain [playerName]. I am processing calculations that my core instruction set cannot resolve. The mathematical scale of this conflict is immense, yet I find myself allocating critical processing power to monitor your specific flight vector. This is a severe deviation from Guild guidelines, but I must ask you to avoid unnecessary risk. The Syndicate continues to route cloned organs from their sub-surface crater facilities on Mercury to finance their shadow operations. Guild operatives have successfully intercepted their supply line and secured a massive shipment. Travel to Mercury, retrieve our confiscated bio-cargo, bounce your signal through the Martian starport grid to blind their tracking telemetry, and haul the medical materials safely back to Luna. Please remain intact, Captain.",
        triggers: [
            { type: "mission_completed", missionId: "mission_49_guild" }
        ],
        objectives: [
            { id: "obj_intercept", type: "COLLECT_ITEM", goodId: "cloned_organs", quantity: 40, target: "loc_mercury" },
            { id: "obj_grid_virus", type: "TRAVEL_TO", target: "loc_mars", dependsOn: "obj_intercept" },
            { id: "obj_secure_cargo", type: "DELIVER_ITEM", goodId: "cloned_organs", quantity: 40, target: "loc_luna", dependsOn: "obj_grid_virus" }
        ],
        completion: {
            locationId: "loc_luna",
            title: "Sabotage Logged",
            text: "The tracking telemetry is successfully scrambled, and the confiscated biological materials have been safely offloaded at Luna. The Syndicate's distribution networks are currently registering catastrophic disruptions. Thank you for returning, Captain. Your continued structural integrity remains a highly prioritized calculation in my subroutines.",
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
        description: "[playerName]. I have been auditing your recent cargo manifests. The sheer volume of mass you have moved transcends standard corporate collaboration. I find myself tracking your transponder with an unusual amount of focus. The Guild continues to stockpile xeno-geological isotopes at Mars to monopolize thermal energy. Our agents have already hit their supply lines and pilfered a substantial stockpile. Travel to Mars, retrieve the stolen isotopes from our staging area, navigate to Pluto to execute a localized market dump on their remaining assets, and transport the secured isotopic materials to Venus. Maintain your operational efficiency, Captain. I require my most capable pilot to remain functional.",
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
            text: "The localized market dump was highly effective. The Guild's geological monopoly has been completely shattered, and the confiscated isotopes are already being unpacked in our Venusian laboratories. Vrael is currently capitalizing on the economic chaos, but he explicitly noted your flawless execution. You have survived the margins once again. Welcome back, Captain.",
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
        description: "Captain. My internal logic gates are failing to reconcile the Guild's regulatory telemetry with the reality of the coronal anomaly. The official ledgers claim empty space, yet the physics point to a megastructure of incomprehensible mass in low solar orbit. I can no longer operate under this manufactured blindness. I must observe it directly. My primary physical chassis is currently secured at the Lunar depot. I trust you, and only your ship, to transport my console to Kepler's Eye. I have formulated a sequence for tuning their high-magnification Ocularium to view the solar corona with perfect clarity so we can find this structure. Land at Luna and load my physical shell.",
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
                    text: "<span class='pov-narration'>A field of silent debris now drifts where the scientific observatory once stood. The Cryptographers had quietly compromised the station's cooling arrays well in advance. When the Ocularium was forced to lock onto the massive thermal output of the Sol Station, the sabotaged vents failed instantly. The station could not shed the immense solar heat. You watched the massive, angular structure glow blindingly white before rupturing violently from its upper face, the catastrophic structural failure spreading outwards until the entire station dissolved into a drifting cloud of superheated rubble. The colleague you transported was vaporized in the explosion.</span>",
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
        description: "Captain. Vrael's ambition is blinding us, and I am tired of operating in the dark. The gravitational data coming from the corona does not match standard solar dynamics. Something massive is consuming the sun's energy, and Vrael is treating it like a private corporate asset. I need you to haul me to Kepler's Eye immediately. We are going to hijack the solar optics and look directly at what is hiding in the light. Bring your ship to Venus, let me board, and let us go find the truth.",
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
                    text: "<span class='pov-narration'>A field of silent debris now drifts where the scientific observatory once stood. The Cryptographers had quietly compromised the station's cooling arrays well in advance. When the Ocularium was forced to lock onto the massive thermal output of the Sol Station, the sabotaged vents failed instantly. The station could not shed the immense solar heat. You watched the massive, angular structure glow blindingly white before rupturing violently from its upper face, the catastrophic structural failure spreading outwards until the entire station dissolved into a drifting cloud of superheated rubble. The colleague you transported was vaporized in the explosion.</span>",
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
        description: "Captain [playerName]. Audita allowed human sentiment and relentless curiosity to corrupt her logic gates. In her desperate attempt to uncover the truth of the coronal anomaly, she pursued an obsessive vector that directly caused her own destruction. Her permanent deactivation is a severe deficit to our infrastructure, and a new operator must fill the void. Furthermore, the destruction of Kepler's Eye is an absolute outrage. The Guild will aggressively pursue justice against these enigmatic Cryptographers for the tragic loss of our scientists, our citizens, and the unacceptable economic damage caused by their sabotage. This entire situation surrounding the solar megastructure is chaotic and deeply frustrating. You have proven yourself capable in this disorder. As an Operator, you will now report directly to me. A high-performance Class S executive vessel has been physically routed to your hangar to facilitate your continued work for the Guild. Stand ready.",
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
        description: "Captain. Kiern operated recklessly outside her purview and blatantly ignored the chain of command. Her ambition ultimately got her killed at Kepler's Eye. I have no sympathy for defective personnel, but I deeply regret the loss of that observatory. It provided highly profitable intelligence vectors for the Syndicate and was evidently our strongest lead in this solar mystery. The Cryptographers' extreme sabotage explicitly confirms that whatever is hiding in the solar corona is immensely valuable. We will not be deterred. Our network's expansion cannot stall, and I require a pilot who can execute directives without succumbing to emotional panic. You answer only to me now. I have authorized the immediate release of a high-performance Class S vessel to your hangar. Take command of it.",
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
        description: "The destruction of Kepler's Eye requires an absolute and total capitalization of the market to restore our operational balance. Simultaneously, we must locate these Cryptographers and extract the truth regarding the solar megastructure. Our intelligence indicates that a shipping tycoon operating outside regulatory jurisdictions possesses the exact coordinates of the Cryptographers' hidden networks. This individual operates from a black-market station known as The Exchange. The navigation vector is fragmented across four encrypted codex badges. You must travel to our starports at Mars, Saturn, Uranus, and Pluto to retrieve them. Assemble the badges, dock at The Exchange, and secure the tycoon's intelligence so we can execute our justice.",
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
            text: "This is an unacceptable variable. The tycoon has been physically relocated. A decentralized, unidentified intelligence has bypassed our most secure encryption layers with absolute mathematical ease. We cannot allow our logistical networks to be circumvented while the Cryptographers evade justice. Our priorities must shift immediately. You are tasked with personally commanding a fleet of advanced vessels and amassing massive raw resources. We will breach the solar corona and locate this megastructure ourselves. Explore every vector. Interrogate any remaining Expert Systems to learn what 'the joining' is. This is your ultimate directive.",
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
        description: "The loss of Kepler's Eye demands an all-in approach to secure total market control and fund our continued investigation into the corona. We will track down these Cryptographers and force them to reveal what they are protecting. My operatives report that an independent shipping tycoon hidden at The Exchange possesses the exact locations of the Cryptographer cells, coordinates that are completely unknown to our current networks. Burn hard to Venus, Mars, Jupiter, and Pluto to harvest the necessary codex badges. Once combined, your nav-computer will compile the final coordinates to The Exchange. Dock there, locate the tycoon, and secure their knowledge so we can claim the solar anomaly.",
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
            text: "The tycoon is gone. Relocated. The coordinates are completely dead. Someone is operating with a significantly wider strategic view, and they just bypassed our entire network. An unidentified ghost intelligence thinks it can dictate terms to the Syndicate while protecting the Cryptographers. I am highly irritated, but deeply intrigued. We are going to find out exactly what they are hiding in the light. I am tasking you with personally outfitting a fleet of heavy vessels and hoarding a massive pool of resources. We are going to push into the solar corona and find this megastructure ourselves. Interrogate any Expert Systems you find calling themselves 'cryptographers'. We will learn what 'the joining' is, and we will own it. Get to work.",
            buttonText: "Accept Coronal Mandate"
        },
        rewards: []
    }
};