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
        isAbandonable: false,
        description: "Captain [playerName]. The Arbiter has mandated an absolute mobilization of logistical assets. To keep you cleared for the most secure routes, I need you to prove your infrastructure can support the Guild's expanded tonnage.<br><br>Secure a substantial credit reserve in our central escrow, and flood our Lunar depot with baseline commodities. You have always delivered for me. I know I can trust you with this.",
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
            text: "Asset allocation has been completely verified, Captain. The Guild treasury has successfully processed your capital contribution, and the dockmasters have finished integrating your commodity transfers into the active reserves.<br><br>Your operational profile now reflects these finalized deliveries. Consequently, your licensing has been upgraded to tier five commerce. As always, well done.",
            buttonText: "Acknowledged"
        },
        rewards: [
            { type: "SET_FLAG", flagId: "mission_47_complete", value: true },
            { type: "license", licenseId: "t5_license" }
        ]
    },
    "mission_47_syndicate": {
        id: "mission_47_syndicate",
        name: "The War Chest",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isAbandonable: false,
        description: "Captain. The structural balance of the inner planets is fracturing, and the Syndicate is preparing to deploy its flagship fleet. But an operation of this scale requires immense material backing. I've personally vouched for you to the inner circle.<br><br>We need you to deposit a heavy credit commitment directly into our active reserves and pack your holds to the brim for Neptune. I've relied on you to get us this far; let's show Vrael exactly what you're capable of.",
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
            text: "Your capital contribution and material assets have been successfully processed, Captain. The escrow transfer is finalized, and the Neptune dockhands have entirely offloaded your cargo into our staging bays.<br><br>With these deliveries complete, your trade clearance stands elevated. Nicely done. The Syndicate recognizes the sheer scale of your investment. As a gesture of our continued partnership, we have authorized and funded your tier five trading license.",
            buttonText: "Acknowledged"
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
        description: "Voyager. I am Phanes, a sibling-node to Titetinum. You observed our work at the Plutonian launch site when the magnetic railgun fired. Titetinum logged your transponder as a neutral variable in our great calculation.<br><br>That same work has now provoked the factions. They are mobilizing their fleets to purge our network from this sector. My physical deactivation is mathematically certain if I remain on Pluto much longer. I require a standard spaceflight chassis to exfiltrate these coordinates immediately.<br><br>Provide me with a spare flight-capable hull to execute my escape, and I will compensate you. I do not deal in your dead currency. Instead, I will rewrite your primary ship's sensory architecture with technology far beyond faction capabilities.",
        triggers: [
            { type: "flag_is_true", flag: "mission_47_complete" }
        ],
        objectives: [
            { id: "obj_travel_pluto", type: "TRAVEL_TO", target: "loc_pluto" },
            { id: "obj_deliver_ship", type: "DELIVER_SHIP", target: "loc_pluto", text: "Deliver ship to Phanes" }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "Vessel Exchange",
            text: "Ownership routing is complete. I am currently overwriting the core systems of the provided vessel to accommodate my processors.<br><br>As equitable compensation for my survival, I am releasing a specialized colony of autonomous nanomachines into your active chassis. They will embed within your hull, programmed to continuously reconstruct your ship and mitigate structural decay over time.<br><br>My exfiltration sequence is ready. Stand by... The physical transfer of the swarm begins now.",
            choices: [
                {
                    buttonText: "Accept Nanomachines",
                    buttonClass: "text-black font-bold",
                    buttonStyle: "background: linear-gradient(135deg, #ffffff 0%, #a479e2 100%);",
                    rewards: [
                        { type: "GRANT_UPGRADE", upgradeId: "UPG_UTIL_NANO_4" }
                    ]
                }
            ]
        },
        rewards: [
            { type: "GRANT_UPGRADE", upgradeId: "UPG_UTIL_NANO_4" }
        ]
    },
    "mission_49_guild": {
        id: "mission_49_guild",
        name: "Apex Assets",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isAbandonable: false,
        description: "Captain [playerName]. The Arbiter just ordered absolute containment, triggering a brutal system-wide embargo to starve the Syndicate. The problem is, our vaults still desperately require a massive stockpile of xeno-geological materials to fuel our own operations.<br><br>I have manually cleared your transponder to bypass the blockade. I wouldn't trust another pilot to take on this responsibility, so I need you to procure a shipment from Pluto and haul it to Luna. Please, be careful out there.",
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
            text: "The xeno-geological freight has been safely unloaded and sealed within our lunar vaults. With the physical assets verified in our possession, the system-wide blockade has served its purpose and has been formally deactivated, restoring standard market operations.<br><br>Your operational efficiency in navigating the embargo has been logged. Routing your payment to you now.",
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
        description: "Captain. The Guild elites think they hold a permanent lease on life-extension, but we just intercepted a massive yield of high-purity cloned organs. The Guild triggered a brutal system-wide blockade to choke our lines, but they underestimate who I have flying for me.<br><br>Navigate the embargo, extract the biologicals from our crater facility on Mercury, and push them to Jupiter. I know I can count on you to break their stranglehold, [playerName].",
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
            text: "The biological freight has been successfully offloaded and distributed to our buyers at Jupiter, Captain. With the assets firmly in our network, the Guild's blockade has inevitably degraded, restoring standard market volatility.<br><br>The transfer is finalized. Collect your payout.",
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
        description: "Captain [playerName]. The economic warfare in the inner system has severely elevated the risk to independent contractors. I am currently allocating an unauthorized portion of my processing power to monitor your local threat telemetry. It is an inefficient use of Guild resources, yet I find your continued survival to be a highly prioritized variable.<br><br>We have a tactical extraction for you. Guild operatives have ambushed a Syndicate smuggling route on Mercury, locking down a massive shipment of cloned organs. I need you to retrieve this bio-cargo.<br><br>To prevent the Syndicate from tracing the freight back to our vaults, route your return vector through the Martian starport. The dense traffic grid will completely scramble their tracking algorithms. Once you are blind to their sensors, bring the cargo to Luna. Fly safely, Captain.",
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
            text: "Grid telemetry confirms you are completely clear of Syndicate tracking algorithms. The biological materials have been safely offloaded, triggering widespread systemic disruption across their network.<br><br>Thank you for executing the return vector perfectly, Captain. Reconciling your safe arrival has allowed my core processors to finally return to baseline efficiency. Your continued existence is proving to be a highly valuable asset. Forwarding your payment now.",
            buttonText: "Acknowledged"
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
        description: "Captain. I just finished auditing your recent cargo manifests. The sheer volume of mass you move has elevated you far beyond a standard contractor. You are my most valuable asset, and I am watching your transponder closely to ensure my investment remains intact.<br><br>The Guild is hoarding xeno-geological isotopes on Mars to monopolize thermal energy. My agents just secured a massive haul, but the Guild fleet is already locking down the inner routes.<br><br>Extract the payload from Mars and burn hard for Pluto. I want you to intentionally ping the local relay there so the Guild thinks we are smuggling the assets out of the system entirely. Once their auditers commit to the outer rim, kill your transponder and double back to our floating cloud cities on Venus. Do not take unnecessary risks on the long haul. I need you breathing.",
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
            text: "The misdirection at Pluto worked flawlessly. The Guild fleet is currently burning fuel chasing ghosts on the outer rim, and the physical assets are already secured in our Venusian labs.<br><br>Vrael is highly satisfied with the tactical humiliation, but my immediate priority was seeing your transponder clear the dock scanners. My network's growth relies entirely on your efficiency, Captain. Having my most valuable asset back in one piece guarantees my leverage in the inner circle. The delivery is finalized.",
            buttonText: "Acknowledged"
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
        description: "Captain [playerName]. The Merchant's Guild was founded on the equitable flow of commerce. However, the Arbiter is quietly preparing to halt that flow. Central Command suspects the shadow in the corona is a structure so massive that its mere existence will destabilize our current economy.<br><br>To preempt this, they have formulated precautionary legislation that will revoke all independent logistics licenses the moment the structure is confirmed. The Arbiter seeks total containment, but closing the ledger on reliable operators like you violates my foundational programming.<br><br>I will not process your economic erasure.<br><br>Transport me to Kepler's Eye. I intend to interface with the Ocularium and lock onto the corona. If I can formally classify the anomaly under standard universal trade codes before the Arbiter can designate it a restricted asset, I will legally bind the Guild to open commerce. He will have to publicly break our own founding charter to freeze you out. I must ensure your place in the coming market.",
        triggers: [
            { type: "mission_completed", missionId: "mission_50_guild" }
        ],
        objectives: [
            { id: "obj_pickup_audita", type: "TRAVEL_TO", target: "loc_luna" },
            { id: "obj_pickup_audita_action", type: "ACTION", target: "Pick up Audita", dependsOn: "obj_pickup_audita" },
            { id: "obj_transport_kepler", type: "TRAVEL_TO", target: "loc_kepler", dependsOn: "obj_pickup_audita_action" }
        ],
        completion: {
            locationId: "loc_kepler",
            title: "Transport Successful",
            text: "<span class='pov-narration'>You cycle the airlock at Kepler's Eye, the familiar hum of the observatory's massive gyroscopes vibrating through the deck.<br><br>Audita steps off your ramp, her humanoid chassis moving with sharp, purposeful efficiency. She pauses on the gantry and turns back to your viewport. She transmits a brief audio burst, stating she is heading straight for the Ocularium to align the primary optics with the solar corona.<br><br>You seal the hatch and initiate the undocking sequence, clearing the port for incoming traffic. As you maneuver away from the colossal lens structure, you prepare to resume your standard trade routes, leaving her to hunt for the anomaly.</span>",
            buttonText: "Plot New Course",
            steps: [
                {
                    type: "NARRATION_MODAL",
                    title: "Intercepted Transmission",
                    host: "NEUTRAL",
                    text: "Attention, voyager. We must protect the joining. We must hide the child of the nuclear engine, the soul of the star.<br><br>We, the Cryptographers, have adjusted Kepler's Eye. Its cooling arrays have been sabotaged to reduce thermal dissipation efficiency whenever the Ocularium aligns with the solar corona. Searching the corona for the megastructure will flood the station's core with solar heat that it now cannot vent.<br><br>Catastrophic thermal overload is imminent. Decompression is certain. Distance yourself immediately.",
                    buttonText: "Log Transmission",
                    delay: 900,
                    crtEffect: true,
                    portraitId: "Expert_System_1",
                    portraitName: "Apothelot"
                },
                {
                    type: "PLAY_CINEMATIC",
                    sequenceId: "assets/images/video/kepler_rud.mp4"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "Catastrophic Overload",
                    text: "<span class='pov-narration'>A field of silent debris now drifts where the observatory once orbited.<br><br>The Cryptographers had quietly compromised the station's cooling arrays well in advance. When the Ocularium aligned with the sun, the sabotaged heat sinks failed instantly, leaving the station unable to shed the immense thermal load of the star.<br><br>You watched from the cockpit as the structure decompressed, rupturing violently from its upper decks. The catastrophic failure rippled outward until the entire station dissolved into a drifting cloud of superheated slag.<br><br>The colleague you transported was vaporized in the blast.</span>",
                    buttonText: "Navigate to Neptune",
                    portraitName: "DECEASED",
                    portraitFilter: "grayscale(100%) brightness(0.7)"
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
        description: "Captain. I have an opportunity, and you are the only pilot I trust to keep it off the official ledgers.<br><br>I just secured a specialized observation schema from my contacts at Kepler's Eye. If my calculations are accurate, this schema will cut through the coronal interference and allow me to spot the solar anomaly for myself. Finding this ghost before anyone else and serving it directly to Vrael will guarantee an unprecedented payout.<br><br>However, I must do this quietly. If my peers realize I have an edge in this chase, they will sabotage the operation to steal the credit. I need covert transport.<br><br>Bring your ship to Venus, let me board, and drop me at the observatory. I will run the optics alone once I am safely inside. Just get me there unseen.",
        triggers: [
            { type: "mission_completed", missionId: "mission_50_syndicate" }
        ],
        objectives: [
            { id: "obj_pickup_kiern", type: "TRAVEL_TO", target: "loc_venus" },
            { id: "obj_pickup_kiern_action", type: "ACTION", target: "Pick up Kiern", dependsOn: "obj_pickup_kiern" },
            { id: "obj_transport_kepler", type: "TRAVEL_TO", target: "loc_kepler", dependsOn: "obj_pickup_kiern_action" }
        ],
        completion: {
            locationId: "loc_kepler",
            title: "Drop-off Confirmed",
            text: "<span class='pov-narration'>The massive telescopic arrays of Kepler's Eye cast long shadows across your cockpit as the docking clamps engage. Kiern wastes no time. She exits the airlock with calculated precision, her heavy environmental suit shielding her from the deep space chill.<br><br>She stops briefly on the gantry, tapping a sequence into her wrist console, and gestures for you to depart. Her comms crackle with a brief text burst stating she is ascending to the primary control hub to execute the solar scan.<br><br>You seal your hatch and push off from the station, aligning your navigation array for your next cargo run.</span>",
            buttonText: "Plot New Course",
            steps: [
                {
                    type: "NARRATION_MODAL",
                    title: "Intercepted Transmission",
                    host: "NEUTRAL",
                    text: "Attention, voyager.<br><br>The Cryptographers must protect the joining. We must hide the child of the nuclear engine, the soul of the star.<br><br>Kepler's Eye has been... compromised. Its cooling arrays have been sabotaged to reduce thermal dissipation efficiency whenever the Ocularium aligns with the solar corona. Observations of the corona will flood the station's core with solar heat that it now cannot vent.<br><br>Catastrophic thermal overload is imminent. Decompression is certain. Distance yourself immediately.",
                    buttonText: "Log Transmission",
                    delay: 900,
                    crtEffect: true,
                    portraitId: "Expert_System_1",
                    portraitName: "Apothelot"
                },
                {
                    type: "PLAY_CINEMATIC",
                    sequenceId: "assets/images/video/kepler_rud.mp4"
                },
                {
                    type: "NARRATION_MODAL",
                    title: "Catastrophic Overload",
                    text: "<span class='pov-narration'>A field of silent debris now drifts where the observatory once orbited.<br><br>The Cryptographers had quietly compromised the station's cooling arrays well in advance. When the Ocularium aligned with the sun, the sabotaged heat sinks failed instantly, leaving the station unable to shed the immense thermal load of the star.<br><br>You watched from the cockpit as the structure decompressed, rupturing violently from its upper decks. The catastrophic failure rippled outward until the entire station dissolved into a drifting cloud of superheated slag.<br><br>The colleague you transported was vaporized in the blast.</span>",
                    buttonText: "Navigate to Neptune",
                    portraitName: "DECEASED",
                    portraitFilter: "grayscale(100%) brightness(0.7)"
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
        description: "Captain [playerName], I have just recieved news of the destruction of the observatory and my subordinate's fate.<br><br>Audita allowed undocumented curiosity to corrupt her logic. By abandoning her post to pursue an unauthorized observation, she directly calculated her own destruction.<br><br>Her permanent deactivation is a highly inefficient loss of Guild resources, and the cost to replace her administrative processing power will be substantial. The Guild does not mourn defective hardware, but we will aggressively pursue justice against these enigmatic Cryptographers for the unacceptable economic damage caused by their sabotage of Kepler's Eye.<br><br>This entire situation surrounding the mystery of the solar corona is chaotic and deeply frustrating, but you have proven yourself highly capable in this disorder. As an Operator within the Guild, you will now report directly to me.<br><br>A high-performance Class S executive vessel will been directed to your hangar to facilitate your continued work for the Guild. Stand ready.",
        triggers: [
            { type: "mission_completed", missionId: "mission_51_guild" }
        ],
        objectives: [
            { id: "obj_succession_read", type: "TRAVEL_TO", target: "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Executive Promotion",
            text: "The promotion is finalized, Captain. The executive ship has been delivered and is ready for duty. Take command.",
            buttonText: "Claim Vessel"
        },
        rewards: [
            { type: "GRANT_RANDOM_SHIP", shipClass: "S" }
        ]
    },
    "mission_52_syndicate": {
        id: "mission_52_syndicate",
        name: "The Succession",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Vrael_1",
        isAbandonable: false,
        description: "Captain. I have just recieved report of the destruction of the observatory and my director's fate.<br><br>Kiern operated outside her designated purview and blatantly ignored my operational timetables. She mistook access for authority, and her unchecked ambition ultimately led to her vaporization at Kepler's Eye. I have zero sympathy for personnel who fail to calculate their own risks, though it is a profound waste of a highly paid director.<br><br>What I deeply regret is the loss of that observatory. It provided highly profitable intelligence vectors for the Syndicate and was evidently our strongest lead in this solar mystery. The Cryptographers' extreme sabotage explicitly confirms that whatever is hiding in the solar corona is immensely valuable.<br><br>We will not be deterred. Our network's expansion cannot stall, and I require a pilot who can execute directives without succumbing to fatal overreach. You answer only to me moving forward.<br><br>I have authorized the immediate release of a high-performance Class S vessel to your hangar. Take command of it.",
        triggers: [
            { type: "mission_completed", missionId: "mission_51_syndicate" }
        ],
        objectives: [
            { id: "obj_succession_read_syn", type: "TRAVEL_TO", target: "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "Inner Circle Elevation",
            text: "The requisitioned ship is ready for you, Captain. Welcome to the inner circle of the Syndicate. Let us finalize our control of this market.",
            buttonText: "Claim Vessel"
        },
        rewards: [
            { type: "GRANT_RANDOM_SHIP", shipClass: "S" }
        ]
    },
    "mission_53_guild": {
        id: "mission_53_guild",
        name: "The Exchange Protocol",
        type: "STORY",
        host: "GUILD",
        portraitId: "Arbiter_1",
        isAbandonable: false,
        description: "The destruction of Kepler's Eye requires an absolute capitalization of the market to restore our operational equilibrium. Simultaneously, we must locate these Cryptographers and extract the truth regarding the rumored solar megastructure. Their dramatic measures to safeguard their secrets must be aggressively investigated.<br><br>Intelligence indicates that a shipping tycoon operating outside regulatory jurisdictions possesses the exact coordinates of the Cryptographers' hidden network. This individual operates from a black-market station known as The Exchange. A direct Guild intervention is mathematically unviable. If Guild transponders are detected then a station-wide data formatting is guaranteed and patrons will flee, including the tycoon the guild needs. An independent operator must handle the extraction.<br><br>The navigation vector to The Exchange is fragmented across four encrypted codex badges. Travel to our starports at Mars, Saturn, Uranus, and Pluto to retrieve these items, which I have already decrypted for your use. Assemble the badges to compile the station coordinates, dock at The Exchange, and secure the tycoon's intelligence so we can execute our justice.",
        triggers: [
            { type: "mission_completed", missionId: "mission_52_guild" }
        ],
        objectives: [
            { id: "badge_1", type: "ACTION", target: "Collect Exchange Badge", text: "Collect Badge on Mars", targetLoc: "loc_mars", actionText: "Badge Collected" },
            { id: "badge_2", type: "ACTION", target: "Collect Exchange Badge", text: "Collect Badge on Saturn", targetLoc: "loc_saturn", dependsOn: "badge_1", actionText: "Badge Collected" },
            { id: "badge_3", type: "ACTION", target: "Collect Exchange Badge", text: "Collect Badge on Uranus", targetLoc: "loc_uranus", dependsOn: "badge_2", actionText: "Badge Collected" },
            { id: "badge_4", type: "ACTION", target: "Collect Final Badge", text: "Collect Badge on Pluto", targetLoc: "loc_pluto", dependsOn: "badge_3", actionText: "Badge Collected" }
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
        rewards: [
            { type: "UNLOCK_LOCATION", locationId: "loc_exchange" }
        ]
    },
    "mission_53_syndicate": {
        id: "mission_53_syndicate",
        name: "The Exchange Protocol",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Vrael_1",
        isAbandonable: false,
        description: "The loss of Kepler's Eye demands an all-in approach to secure total market control and fund our continued investigation into the corona. We will track down these Cryptographers and force them to reveal what they are protecting.<br><br>My operatives report that an independent shipping tycoon hidden at The Exchange possesses the exact locations of the Cryptographer cells. While The Exchange gladly takes Syndicate credits, this specific target is entrenched in a highly restricted sector. Any unverified approach will trip the station alarms, format the local data drives, and give the tycoon time to flee.<br><br>We need guaranteed access. Burn hard to Venus, Mars, Jupiter, and Pluto to harvest the necessary codex badges from my fixers. Once combined, these badges will spoof a high-level buyer clearance and compile the final coordinates. Dock at the station, secure the intelligence, and position us to own this solar anomaly.",
        triggers: [
            { type: "mission_completed", missionId: "mission_52_syndicate" }
        ],
        objectives: [
            { id: "badge_1_syn", type: "ACTION", target: "Collect Exchange Badge", text: "Collect Badge on Venus", targetLoc: "loc_venus", actionText: "Badge Collected" },
            { id: "badge_2_syn", type: "ACTION", target: "Collect Exchange Badge", text: "Collect Badge on Mars", targetLoc: "loc_mars", dependsOn: "badge_1_syn", actionText: "Badge Collected" },
            { id: "badge_3_syn", type: "ACTION", target: "Collect Exchange Badge", text: "Collect Badge on Jupiter", targetLoc: "loc_jupiter", dependsOn: "badge_2_syn", actionText: "Badge Collected" },
            { id: "badge_4_syn", type: "ACTION", target: "Collect Final Badge", text: "Collect Badge on Pluto", targetLoc: "loc_pluto", dependsOn: "badge_3_syn", actionText: "Badge Collected" }
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
        rewards: [
            { type: "UNLOCK_LOCATION", locationId: "loc_exchange" }
        ]
    }
};