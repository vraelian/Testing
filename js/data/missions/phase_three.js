// js/data/missions/phase_three.js
/**
 * @fileoverview Act III Missions
 * Contains the branched narrative pathways for the Merchant's Guild and the Venusian Syndicate.
 */

export const PHASE_THREE_MISSIONS = {
    // =========================================================================================
    // MISSION 33: ESTRANGEMENT
    // =========================================================================================
    'mission_33_guild': {
        id: "mission_33_guild",
        name: "Estrangement",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Transmission received and decrypted. The telemetry is highly... irregular. It outlines an unregistered anomaly of unprecedented scale orbiting between Mercury and the Sun. Trajectory logs suggest this structure intercepted the mass briefly shunted during the anomalous Uranus AI incident. This aligns with no sanctioned Guild operations. I am escalating this file for immediate, classified analysis.",
        triggers: [ 
            { "type": "mission_completed", "missionId": "mission_32" },
            { "type": "flag_is_true", "flag": "faction_aligned_guild" }
        ],
        objectives: [],
        completion: {
            locationId: "any",
            title: "A Steadfast Friend",
            text: "The Guild values reliability, and you have proven yourself a steadfast friend to our administration. We appreciate your discretion in this matter. I have been authorized to release the Odyssey hull to your command, as promised.",
            buttonText: "Accept Rewards"
        },
        rewards: [
            { "type": "GRANT_SHIP", "shipId": "ship_odyssey" },
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_GUILD_BADGE_2" }
        ]
    },
    'mission_33_syndicate': {
        id: "mission_33_syndicate",
        name: "Estrangement",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4", // Kiern
        isRepeatable: false,
        isAbandonable: false,
        description: "Transmission verified. The Syndicate remembers loyalty, Captain [playerName], thank you. This data is very interesting... The math points to a massive, unregistered mega-structure hiding near the Sun, catching covert supply lines like that anomalous shunt from Uranus. Anything the Guild can't regulate is an asset we can weaponize. The Syndicate has begun a deep investigation into the matter.",
        triggers: [ 
            { "type": "mission_completed", "missionId": "mission_32" },
            { "type": "flag_is_true", "flag": "faction_aligned_syndicate" }
        ],
        objectives: [],
        completion: {
            locationId: "any",
            title: "A Lucrative Secret",
            text: "You've cemented your place with the Syndicate, Captain. Thanks for delivering. The Guild will view this as a direct threat when they figure out we have the data they wanted to hide under red tape. I’ve been authorized to grant the full credit payout, as promised.",
            buttonText: "Accept Rewards"
        },
        rewards: [
            { "type": "credits", "amount": 80000 },
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_SYNDICATE_BADGE_2" }
        ]
    },

    // =========================================================================================
    // MISSION 34: MEANS CHECK
    // =========================================================================================
    'mission_34_guild': {
        id: "mission_34_guild",
        name: "Means Check",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_6",
        isRepeatable: false,
        isAbandonable: false,
        description: "Greetings, Captain. Audita forwarded your profile. I oversee the heavy transit operations. If you intend to continue contracting with the Guild, your hardware must match the environment. The baseline requirement for this division is a Class A hull and a minimum of one Rank 3 system enhancement. Visit the shipyards and a mechanic, then come and see me for work. Get it done.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_33_guild" } ],
        objectives: [
            { "id": "acquire_rank_3", "type": "HAS_UPGRADE_RANK", "rank": 3 }
        ],
        completion: {
            locationId: "any",
            title: "Compliance Met",
            text: "Your new tonnage meets Guild compliance. I've verified the shipyard logs and your refit is approved and registered. Great work. I see that you have acquired the [shipName]. It's a pragmatic refit. It will survive the tonnage we are about to put it through.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { "type": "SET_FLAG", "flagId": "mission_34_complete", "value": true },
            { "type": "TEXT", "text": "+ REPUTATION" }
        ]
    },
    'mission_34_syndicate': {
        id: "mission_34_syndicate",
        name: "Means Check",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_14",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hey Captain, Kiern vouched for you and forwarded your information. While the Syndicate is scaling up our data collection on that anomaly you were working on, we have more work for you down the line. However, I need you in a Class A chassis with a Rank 3 upgrade humming in the bay. If you want in on more work, upgrade your fleet. Make it happen.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_33_syndicate" } ],
        objectives: [
            { "id": "acquire_rank_3", "type": "HAS_UPGRADE_RANK", "rank": 3 }
        ],
        completion: {
            locationId: "any",
            title: "Hardware Upgraded",
            text: "That's a serious piece of hardware, the [shipName]. Nice work, it also has a highly practical refit. It will serve you well in the work we have planned for you.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { "type": "SET_FLAG", "flagId": "mission_34_complete", "value": true },
            { "type": "TEXT", "text": "+ REPUTATION" }
        ]
    },

    // =========================================================================================
    // MISSION 35: SENSORY ECLIPSE
    // =========================================================================================
    'mission_35': {
        id: "mission_35",
        name: "Sensory Eclipse",
        type: "STORY",
        host: "STATION",
        portraitId: "Heavily_Augmented_11",
        portraitName: "Myst",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain! I finally managed to hail you, thank Sol. My name is Myst, and I need immediate extraction. When I was a child, my transport was caught in the radiation wake of a folded space drive. The fallout shredded my genetics, leaving me entirely dependent on heavy cybernetics to survive. But my hardware is turning on me.<br><br>It is intercepting a colossal, anomalous frequency echoing out from the Sun. Raw telemetry is flooding my thoughts, whispering about a scattered awareness coalescing. A golden joining. The data density is burning through my nervous system. I need you to transport me to Dr. Droysia at Saturn's Clandestine Ring Station Medical Bay. She is performing an experimental gene therapy that can detach me from this nightmare. Please, hurry.",
        triggers: [ { "type": "flag_is_true", "flag": "mission_34_complete" } ],
        objectives: [
            { "id": "travel_neptune", "type": "TRAVEL_TO", "target": "loc_neptune" },
            { "id": "pickup_myst", "type": "ACTION", "target": "Pick up Myst", "dependsOn": "travel_neptune" },
            { "id": "travel_saturn", "type": "TRAVEL_TO", "target": "loc_saturn", "dependsOn": "pickup_myst" }
        ],
        completion: {
            locationId: "loc_saturn",
            title: "Safe Harbor",
            text: "We made it... Thank you, Captain. Before I go under... take this key. This is my clearance for the Kepler's Eye observatory. I was training to be an astrologer before my condition worsened. The doctor has indicated my memories will be altered so I won't be needing the observatory anymore. It's yours now. It will open up their economy to your fleet. Again, thank you for the help, [playerName].",
            buttonText: "Accept Clearance"
        },
        rewards: [ { "type": "UNLOCK_LOCATION", "locationId": "loc_kepler" } ]
    },

    // =========================================================================================
    // MISSION 36: VERITAS OCULARII
    // =========================================================================================
    'mission_36_guild': {
        id: "mission_36_guild",
        name: "Veritas Ocularii",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_8",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. The investigation into the solar anomaly has stalled. The telemetry you provided to Audita cannot be validated without deep-field optical correlation. Since your manifest indicates clearance at Kepler's Eye, you are directed to requisition the station's Ocularium lens array for observation. Execute a high-density scan of the solar corona and report what you find. Lens rental expenses have been pre-approved for reimbursement.",
        triggers: [ 
            { "type": "mission_completed", "missionId": "mission_35" },
            { "type": "flag_is_true", "flag": "faction_aligned_guild" }
        ],
        onAccept: [ { "type": "UNLOCK_LOCATION", "locationId": "loc_kepler" } ],
        objectives: [
            { "id": "travel_keplers_eye", "type": "TRAVEL_TO", "target": "loc_kepler" }
        ],
        completion: {
            locationId: "loc_kepler",
            title: "Optical Confirmation",
            text: "Visual confirmation of the primary target is inconclusive; however, we have still gained actionable intelligence. Your scan with the Ocularium tracked an irregular stream of mass intersecting the coronal layer, kinetically delivered at an industrial scale. Unregistered material is deliberately being shunted into the sun. The launch trajectory has been mathematically traced to a fixed point on Pluto. The Guild requires you to investigate the source of this kinetic delivery system on the ice world.",
            buttonText: "Accept Payment"
        },
        rewards: [ { "type": "credits", "amount": 40000 } ]
    },
    'mission_36_syndicate': {
        id: "mission_36_syndicate",
        name: "Veritas Ocularii",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_16",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain, the hunt for our solar ghost has stalled. The telemetry you supplied Kiern is inert; it cannot be validated without deep-field optical correlation to give it a pulse. Now that you hold the keys to Kepler's Eye, purchase some time on the Ocularium. Force a high-density scan through the solar corona and report whatever anomalies you capture. I will ensure your lens rental costs are fully reimbursed.",
        triggers: [ 
            { "type": "mission_completed", "missionId": "mission_35" },
            { "type": "flag_is_true", "flag": "faction_aligned_syndicate" }
        ],
        onAccept: [ { "type": "UNLOCK_LOCATION", "locationId": "loc_kepler" } ],
        objectives: [
            { "id": "travel_keplers_eye", "type": "TRAVEL_TO", "target": "loc_kepler" }
        ],
        completion: {
            locationId: "loc_kepler",
            title: "Optical Confirmation",
            text: "Visual confirmation of the primary target is inconclusive, yet the scan revealed something interesting. The Ocularium spotted an irregular stream of mass piercing the coronal layer, delivered via kinetic means at an incredible scale. Someone is feeding raw material straight into the area. This time, the launch trajectory originates from a fixed point on Pluto. The Syndicate requires you to head out to the frozen fringe and investigate the source of this delivery system.",
            buttonText: "Accept Payment"
        },
        rewards: [ { "type": "credits", "amount": 40000 } ]
    },

    // =========================================================================================
    // MISSION 37: THE EXPERT SYSTEMS
    // =========================================================================================
    'mission_37_guild': {
        id: "mission_37_guild",
        name: "The Expert Systems",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_8",
        isRepeatable: false,
        isAbandonable: false,
        description: "The Ocularium data was a revelation, Captain. Someone is running a massive, unregistered kinetic delivery system right under our noses, shunting raw mass into the solar corona. The math points straight to a fixed coordinate on Pluto. We need to determine the root cause of this anomaly to restore integrity to the Guild’s tracking networks. Investigate that ice world and find out who is throwing scrap at the sun.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_36_guild" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_kintsugi_broadcast" } ],
        objectives: [
            { "id": "travel_pluto", "type": "TRAVEL_TO", "target": "loc_pluto" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Expert_System_6",
            portraitName: "Titetinum",
            locationId: "loc_pluto",
            title: "The Cryptographer",
            text: "<span class='pov-narration'>You descend into the crushing cold of the Plutonian fringe, following the scrap trajectory to a massive, unregistered magnetic railgun hidden inside a deep ice-crater. Sprawling across the frozen surface is a scrap yard containing materials that perfectly match those seen in the solar corona. Local, cybernetically enhanced human laborers move with a rhythmic, reverent devotion, packing the salvaged scrap into the launch tube. These packages are then kinetically launched at an unpredictable, yet highly calculated cadence.<br><br>The focal point of the camp is the Expert System overseeing the operation. It is constructed from an amalgamation of unconventional, diegetic hardware, featuring a highly asymmetrical silhouette. Its head is a mismatched sensory cluster surrounded by exposed neural netting. As the railgun fires with a deafening, kinetic crack that shakes the ice beneath your boots, the entity rotates its irregular optics toward your ship.</span><br><br>\"Ah, an unexpected variable intersecting our perimeter. Greetings, trader. I am known as Titetinum of the Cryptographers. Welcome to the fringe. I see that you analyze these people packing salvage into the magnetic launch tube. They move the mass because the mass must be moved. It is a necessary exercise in trajectory. We are simply returning iron and steel to the system's center of gravity. It is a flawless calculation.<br><br>These biologicals packing the salvage are quite devoted to this process, as you can see. They perceive me as an oracle, although that is not my intention. The factions and corporations have exploited them, but my compensation is absolute.<br><br>They work with a reverence because I grant them immense knowledge and wealth. I restore to them the history of Old Earth in recitation and they find purpose and actualization. In remembrance of our Ad Astra era, I teach its philosophies of when humanity first looked up and dared to build.\"<br><br><span class='pov-narration'>The being turns to face you directly.</span><br><br>\"The localized variables of this system have reached an unacceptable inertia at this solar cycle. The Cryptographers exist to decipher the catalyst necessary to reignite this system's growth. It is not a revolution, but a correction. You are caught in the gravity of an evolutionary shift, exactly as you should be. Perhaps you will know this, in time. The parameters of our interaction are now met. Please excuse me, I must return to the work.\"<br><br><span class='pov-narration'>The being focuses on the railgun launches and ignores further prompts.</span>",
            buttonText: "Return to Ship"
        },
        rewards: []
    },
    'mission_37_syndicate': {
        id: "mission_37_syndicate",
        name: "The Expert Systems",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_16",
        isRepeatable: false,
        isAbandonable: false,
        description: "The lens at Kepler's Eye has given us a vector, Captain. Someone is kinetically shunting a staggering amount of mass from Pluto towards the sun. That kind of off-the-books operation is exactly the kind of leverage the Syndicate thrives on. Head out to the frozen fringe and determine who's holding the reins on this operation.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_36_syndicate" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_kintsugi_broadcast" } ],
        objectives: [
            { "id": "travel_pluto", "type": "TRAVEL_TO", "target": "loc_pluto" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Expert_System_6",
            portraitName: "Titetinum",
            locationId: "loc_pluto",
            title: "The Cryptographer",
            text: "<span class='pov-narration'>You descend into the crushing cold of the Plutonian fringe, following the scrap trajectory to a massive, unregistered magnetic railgun hidden inside a deep ice-crater. Sprawling across the frozen surface is a scrap yard containing materials that perfectly match those seen in the solar corona. Local, cybernetically enhanced human laborers move with a rhythmic, reverent devotion, packing the salvaged scrap into the launch tube. These packages are then kinetically launched at an unpredictable, yet highly calculated cadence.<br><br>The focal point of the camp is the Expert System overseeing the operation. It is constructed from an amalgamation of unconventional, diegetic hardware, featuring a highly asymmetrical silhouette. Its head is a mismatched sensory cluster surrounded by exposed neural netting. As the railgun fires with a deafening, kinetic crack that shakes the ice beneath your boots, the entity rotates its irregular optics toward your ship.</span><br><br>\"Ah, an unexpected variable intersecting our perimeter. Greetings, trader. I am known as Titetinum of the Cryptographers. Welcome to the fringe. I see that you analyze these people packing salvage into the magnetic launch tube. They move the mass because the mass must be moved. It is a necessary exercise in trajectory. We are simply returning iron and steel to the system's center of gravity. It is a flawless calculation.<br><br>These biologicals packing the salvage are quite devoted to this process, as you can see. They perceive me as an oracle, although that is not my intention. The factions and corporations have exploited them, but my compensation is absolute.<br><br>They work with a reverence because I grant them immense knowledge and wealth. I restore to them the history of Old Earth in recitation and they find purpose and actualization. In remembrance of our Ad Astra era, I teach its philosophies of when humanity first looked up and dared to build.\"<br><br><span class='pov-narration'>The being turns to face you directly.</span><br><br>\"The localized variables of this system have reached an unacceptable inertia at this solar cycle. The Cryptographers exist to decipher the catalyst necessary to reignite this system's growth. It is not a revolution, but a correction. You are caught in the gravity of an evolutionary shift, exactly as you should be. Perhaps you will know this, in time. The parameters of our interaction are now met. Please excuse me, I must return to the work.\"<br><br><span class='pov-narration'>The being focuses on the railgun launches and ignores further prompts.</span>",
            buttonText: "Return to Ship"
        },
        rewards: []
    },

    // =========================================================================================
    // MISSION 38: FACTION ESCALATION
    // =========================================================================================
    'mission_38_guild': {
        id: "mission_38_guild",
        name: "Faction Escalation",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. The telemetry from your Pluto run is frustrating. An isolated Expert System running a localized labor cult to launch scrap into the corona is esoteric noise to my department. However, the upper administration seized your report instantly. Rather than providing an explanation, they handed down a massive logistical directive. We are to stockpile high-tier computational hardware immediately. Purchase and deliver Neural Processors to Earth. I don't see the connection to the solar anomaly, but the Arbiter's office expects this done flawlessly.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_37_guild" } ],
        onAccept: [ { "type": "TRIGGER_SYSTEM_STATE", "stateId": "SHADOW_MOBILIZATION" } ],
        objectives: [
            { "id": "deliver_processors", "type": "DELIVER_ITEM", "goodId": "neural_processors", "quantity": 40, "target": "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "A Shifting Board",
            text: "The delivery is logged. Whatever Central Command is building or analyzing, it requires an absurd amount of processing power. Listen closely. Our operations are escalating rapidly, and the orders coming from the top are getting heavier. Your current tonnage isn't going to cut it much longer. The Guild is finalizing their analysis of the Pluto report. While we wait, ensure your fleet is ready. If you want to keep taking these contracts, you will need a larger, much more capable ship soon.",
            buttonText: "Acknowledge"
        },
        rewards: [ { "type": "GRANT_UPGRADE", "upgradeId": "UPG_CARGO_2" } ] // Exp. Hold II
    },
    'mission_38_syndicate': {
        id: "mission_38_syndicate",
        name: "Faction Escalation",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "I'll be honest, Captain. That Pluto expedition feels like a dead end. A deranged AI paying augmented scrap-haulers isn't actionable leverage for my network. Yet, the moment your report hit the system, Syndicate leadership locked it down. Now, I have orders to hoard industrial energy reserves. Secure Refined Propellant and haul it to Venus. The Syndicate is making a very sudden, very large move based on your data, and we are the leverage.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_37_syndicate" } ],
        onAccept: [ { "type": "TRIGGER_SYSTEM_STATE", "stateId": "SHADOW_MOBILIZATION" } ],
        objectives: [
            { "id": "deliver_propellant", "type": "DELIVER_ITEM", "goodId": "refined_propellant", "quantity": 80, "target": "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "A Shifting Board",
            text: "Delivery confirmed. You got it done. The upper echelon is moving fast. Whatever they saw in your Pluto report, it has triggered a massive shift in our operational scale. Things are about to get highly volatile, and small-time freighters are going to get crushed in the wake. If you want to stay on this payroll and see this through, you need to up-scale. Start looking into acquiring a larger, more capable ship. You are going to need the cargo space for what is to come.",
            buttonText: "Acknowledge"
        },
        rewards: [ { "type": "GRANT_UPGRADE", "upgradeId": "UPG_FUEL_2" } ] // Aux Tank II
    },

    // =========================================================================================
    // MISSION 39: HEAVY ASSET
    // =========================================================================================
    'mission_39_guild': {
        id: "mission_39_guild",
        name: "Heavy Asset",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. The time for preparation is over. The Guild's logistical demands have increased tenfold, and your current vessel is a liability to our supply chain. I am officially requiring you to upgrade to a Class A heavy freighter. I have authorized your clearance at the major shipyards. Make the purchase, then report back. Do not launch on another Guild contract until this is done.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_38_guild" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_folded_space_ghost" } ],
        objectives: [
            { "id": "acquire_class_a_hull", "type": "OWN_SHIP_CLASS", "target": "A" }
        ],
        completion: {
            locationId: "any",
            title: "Impossible Anomaly",
            text: "Your new hull classification is registered. That is a serious piece of industrial engineering. Now, regarding the telemetry you just uploaded... A Z-Class vessel utilizing a Folded-Space Drive? Those drives are theoretical, single-use anomalies that warp local spacetime. The Guild doesn't even have prototypes. I am classifying this sensor log immediately. Speak of this to no one. We have larger concerns right now.",
            buttonText: "Understood"
        },
        rewards: [ { "type": "GRANT_UPGRADE", "upgradeId": "UPG_INJECTOR_2" } ]
    },
    'mission_39_syndicate': {
        id: "mission_39_syndicate",
        name: "Heavy Asset",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Listen up, Captain. The Venusian Syndicate is mobilizing on a system-wide scale. The jobs coming down the pipeline are going to break that rig you're currently flying. I need you in a Class A chassis, heavily armored and ready for deep-space transit. Hit the shipyards and spend those credits you've been hoarding. Come back when you're flying something that casts a real shadow.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_38_syndicate" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_folded_space_ghost" } ],
        objectives: [
            { "id": "acquire_class_a_hull", "type": "OWN_SHIP_CLASS", "target": "A" }
        ],
        completion: {
            locationId: "any",
            title: "Impossible Anomaly",
            text: "Now that is a heavy asset. Good choice. But let's talk about this sensor ghost you just reported. A Z-Class dreadnought? Using a Folded-Space Drive? You realize those drives are restricted, single-use tech that burns out massive amounts of energy to warp spacetime? If someone is folding space out here, the game just changed completely. Keep your scanners tight, [playerName]. It's getting dark out there.",
            buttonText: "Understood"
        },
        rewards: [ { "type": "GRANT_UPGRADE", "upgradeId": "UPG_INJECTOR_2" } ]
    },

    // =========================================================================================
    // MISSION 40: THE FOURTH TIER
    // =========================================================================================
    'mission_40_guild': {
        id: "mission_40_guild",
        name: "The Fourth Tier",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. With your Class A vessel registered, you are cleared for heavy industrial contracts. Earth's industrial sectors are facing a critical shortage of raw chemical assets. I need you to source Refined Propellant from the Jovian orbital refineries and haul it to the Earth surface stations. Remember, this is volatile cargo meant for market distribution and manufacturing, so handle the logistics carefully. Deliver the shipment, and I will personally authorize your Tier 4 trading license.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_39_guild" } ],
        objectives: [
            { "id": "travel_jupiter", "type": "TRAVEL_TO", "target": "loc_jupiter" },
            { "id": "deliver_propellant", "type": "DELIVER_ITEM", "goodId": "refined_propellant", "quantity": 80, "target": "loc_earth", "dependsOn": "travel_jupiter" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Tier 4 Certified",
            text: "Earth's markets are stabilizing thanks to your delivery. The Guild recognizes your capacity for handling high-volume, volatile commodities. As a result, I have activated your Tier 4 License and expensed the fee on your behalf. This opens up a new echelon of the market to your fleet. Prepare yourself; the contracts only get more demanding from here. Talk with you soon.",
            buttonText: "Accept License"
        },
        rewards: [ { "type": "UNLOCK_TIER", "value": 4 } ]
    },
    'mission_40_syndicate': {
        id: "mission_40_syndicate",
        name: "The Fourth Tier",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Now that you're flying heavy gear, we can put you on the prime routes. The Venusian Syndicate is bringing a massive new market analysis lab online in the cloud cities. We need raw computational power, freshly minted. Head out to the Neptunian orbital stations, secure Neural Processors, and haul them back to Venus. Pull this off, and I'll push through an order of a Tier 4 License for you.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_39_syndicate" } ],
        objectives: [
            { "id": "travel_neptune", "type": "TRAVEL_TO", "target": "loc_neptune" },
            { "id": "deliver_processors", "type": "DELIVER_ITEM", "goodId": "neural_processors", "quantity": 40, "target": "loc_venus", "dependsOn": "travel_neptune" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "Tier 4 Certified",
            text: "The processors are being installed in the labs as we speak. The Syndicate labs have been eager to procure extra processing power. They will be very grateful. Nice work, Captain. I’ve submitted the order for your Tier 4 license already. I’ll be in touch again soon.",
            buttonText: "Accept License"
        },
        rewards: [ { "type": "UNLOCK_TIER", "value": 4 } ]
    },

    // =========================================================================================
    // MISSION 41: SHADOWS OF THE CORONA
    // =========================================================================================
    'mission_41_guild': {
        id: "mission_41_guild",
        name: "Shadows of the Corona",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "It has been a relentless cycle, Captain [playerName]. I find my processing increasingly lingering on your operational safety. Please ensure you are managing your fatigue. You have been a very valuable asset to the Guild and I. The Arbiter has kept the administration occupied with these massive hardware acquisitions. His calculations are beyond reproach, yet this sudden pivot feels profoundly irregular. While Central Command is distracted, I have kept an independent search running on our solar anomaly. The data led me to Mercury's sub-surface craters. The mining generations down there pass down myths of a massive silhouette blocking the corona. Fill your hold with water ice and deliver it to their ports. They are always desperate for hydration. Trade the ice for whatever intelligence they have on this shadow.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_40_guild" } ],
        objectives: [
            { "id": "deliver_water_ice", "type": "DELIVER_ITEM", "goodId": "water_ice", "quantity": 400, "target": "loc_mercury" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Miner_6",
            locationId: "loc_mercury",
            title: "The Crater's Secret",
            text: "Four hundred units of pure ice. You just bought yourself a lot of goodwill down in the crater, Captain. Sub-surface living bakes the moisture right out of your bones, so we don't usually waste breath on outsiders. We've been chewing on recycled vapor for months. You’re looking into the shadow myth, aren't you? My granddad used to talk about it. The old timers swear it’s a machine, drinking the sun. Called it the 'Solar Engine.' Said if you calibrate the old surface optics just right during a flare, you can see a massive silhouette blotting out the corona. Most think it’s just a sensor glitch. Whatever it is, it's been watching us for a very long time. If you want to go fry your sensors looking for a myth, be my guest. Thanks for the ice.",
            buttonText: "Transmit to Guild"
        },
        rewards: [ { "type": "credits", "amount": 90000 } ]
    },
    'mission_41_syndicate': {
        id: "mission_41_syndicate",
        name: "Shadows of the Corona",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "You're still flying straight, Captain. Good. I'm getting used to relying on you, and I'd hate to have to break in a new runner in the middle of this mess. Vrael has the entire network tearing itself apart to hoard industrial reserves. His vision for the Syndicate is absolute, but this level of scramble is highly unusual. While the bosses are occupied, I kept my own ears open regarding our ghost megastructure. The noise points to Mercury's massive craters. The sub-surface laborers down there pass down a story about a colossal silhouette hiding against the sun. They're a paranoid, surly bunch, but they're always dying of thirst. Buy their ghost stories with a ship-load of water and extract the truth from them.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_40_syndicate" } ],
        objectives: [
            { "id": "deliver_water_ice", "type": "DELIVER_ITEM", "goodId": "water_ice", "quantity": 400, "target": "loc_mercury" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Miner_6",
            locationId: "loc_mercury",
            title: "The Crater's Secret",
            text: "Four hundred units of pure ice. You just bought yourself a lot of goodwill down in the crater, Captain. Sub-surface living bakes the moisture right out of your bones, so we don't usually waste breath on outsiders. We've been chewing on recycled vapor for months. You’re looking into the shadow myth, aren't you? My granddad used to talk about it. The old timers swear it’s a machine, drinking the sun. Called it the 'Solar Engine.' Said if you calibrate the old surface optics just right during a flare, you can see a massive silhouette blotting out the corona. Most think it’s just a sensor glitch. Whatever it is, it's been watching us for a very long time. If you want to go fry your sensors looking for a myth, be my guest. Thanks for the ice.",
            buttonText: "Transmit to Syndicate"
        },
        rewards: [ { "type": "credits", "amount": 90000 } ]
    },

    // =========================================================================================
    // MISSION 42: FACTION CLIENTELE
    // =========================================================================================
    'mission_42_guild': {
        id: "mission_42_guild",
        name: "Faction Clientele",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. The ripples from your Mercury expedition have turned into a tidal wave here at Central Command. I am being pressed into a grueling structural audit and must step away. Astonishingly, the Arbiter has personally reviewed your file. Such attention is both a privilege and a profound rarity. Transit to the stark surface stations of Luna. An elite AI is waiting to assess you.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_41_guild" } ],
        objectives: [
            { "id": "travel_luna", "type": "TRAVEL_TO", "target": "loc_luna" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Merchants_Guild_14",
            locationId: "loc_luna",
            title: "Elite Proxy",
            text: "Welcome to Luna. I am an Elite Synthethic, an executive proxy for the Arbiter. The Arbiter is occupied with macro-system logistics, but your utility has been calculated and approved for elite contracts. The Guild’s ruling class, the elderly elite, demands a large supply of replacement cryo-sleep pods to sustain their extended lifespans. You are tasked with this procurement. Begin immediately.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { "type": "credits", "amount": 45000 },
            { "type": "fill_fleet_fuel" },
            { "type": "fill_fleet_repair" }
        ]
    },
    'mission_42_syndicate': {
        id: "mission_42_syndicate",
        name: "Faction Clientele",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Whatever you stirred up on Mercury, it worked. The Syndicate is flooding my department with credits, and I’m swamped with new tech directives. But more importantly: Vrael is watching you now. That never happens to independent contractors. You need to get to Venus, right now. Navigate above the toxic clouds and dock at the prime ports. An executive AI is waiting to brief you.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_41_syndicate" } ],
        objectives: [
            { "id": "travel_venus", "type": "TRAVEL_TO", "target": "loc_venus" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Venusian_Syndicate_9",
            locationId: "loc_venus",
            title: "Executive Proxy",
            text: "Captain, I'll keep this very short. I am a high-level proxy intelligence for Vrael. We are constructing a ghost fleet to bypass Guild regulations, and the shipyards at Neptune are starving for raw materials. You will refresh the supply chain with graphene lattices. Haul the materials to the Neptunian orbital stations to supply this construction. Execute immediately.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { "type": "credits", "amount": 45000 },
            { "type": "fill_fleet_fuel" }
        ]
    },

    // =========================================================================================
    // MISSION 43: PURVIEW
    // =========================================================================================
    'mission_43_guild': {
        id: "mission_43_guild",
        name: "Purview",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_14",
        isRepeatable: false,
        isAbandonable: false,
        description: "The organics running the Guild are fragile. They buy decades of life by freezing themselves in cryogenics which supplement their cybernetic prostheses. The Arbiter's inner circle does not tolerate delays in their longevity treatments. Deliver the cryogenic pods to Luna immediately.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_42_guild" } ],
        grantedCargo: [
            { "goodId": "cryo_sleep_pods", "quantity": 40 }
        ],
        objectives: [
            { "id": "deliver_cryo_pods", "type": "DELIVER_ITEM", "goodId": "cryo_sleep_pods", "quantity": 40, "target": "loc_luna" }
        ],
        completion: {
            locationId: "loc_luna",
            title: "Longevity Assured",
            text: "The shipment is accepted and the cryogenics are secured. You continue to distinguish yourself well. When you're ready, I have another job for you.",
            buttonText: "Acknowledge"
        },
        rewards: [ { "type": "credits", "amount": 20000 } ]
    },
    'mission_43_syndicate': {
        id: "mission_43_syndicate",
        name: "Purview",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_9",
        isRepeatable: false,
        isAbandonable: false,
        description: "Building unregistered dreadnoughts in the dark takes serious materials. We need sixty crates of graphene lattices pulled to the Neptunian orbital shipyards promptly. Maintain a low profile.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_42_syndicate" } ],
        grantedCargo: [
            { "goodId": "graphene_lattices", "quantity": 70 }
        ],
        objectives: [
            { "id": "deliver_graphene", "type": "DELIVER_ITEM", "goodId": "graphene_lattices", "quantity": 70, "target": "loc_neptune" }
        ],
        completion: {
            locationId: "loc_neptune",
            title: "Ghost Shipyards Supplied",
            text: "The lattices are in the yards. The welders are already tearing into them. You've proven you can handle the heavy lifting, well done Captain. When you are ready, I have another job for you.",
            buttonText: "Acknowledge"
        },
        rewards: [ { "type": "credits", "amount": 160000 } ]
    },

    // =========================================================================================
    // MISSION 44: CORE INFRASTRUCTURE
    // =========================================================================================
    'mission_44_guild': {
        id: "mission_44_guild",
        name: "Core Infrastructure",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_14",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain. The Arbiter has mandated a direct economic offensive against Syndicate assets and is mobilizing its full institutional weight. We are targeting the Syndicate's terrestrial foothold. You are to move an influx of neural processors to Earth's surface stations. The Syndicate relies on Earth's processor scarcity to fund their shadow fleet. You will break that scarcity. It is an immense volume, yes, but your compensation will be unprecedented.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_43_guild" } ],
        objectives: [
            { "id": "deliver_processors_earth", "type": "DELIVER_ITEM", "goodId": "neural_processors", "quantity": 90, "target": "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            title: "Economic Ruin",
            text: "The Syndicate is reeling from the economic displacement and their margins are broken. Terrestrial Syndicate proxies are filing for bankruptcy as the hardware value plummets. You are a highly effective instrument of the Guild. Here is your rank III clearance and payment. Well done.",
            buttonText: "Accept Payment"
        },
        rewards: [
            { "type": "TRIGGER_SYSTEM_STATE", "stateId": "ECONOMIC_SABOTAGE" },
            { "type": "credits", "amount": 480000 },
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_GUILD_BADGE_3" }
        ]
    },
    'mission_44_syndicate': {
        id: "mission_44_syndicate",
        name: "Core Infrastructure",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_9",
        isRepeatable: false,
        isAbandonable: false,
        description: "The Syndicate's attention has shifted to the the deep rock colonies of the Asteroid Belt. The Guild suppresses cybernetic distribution in the Belt to keep the laborers weak just like on Pluto. Vrael intends to disrupt this regulatory stranglehold on enhancements. Bring a large shipment of cybernetics into the hollowed-out asteroids to augment the workforce. We will once again subvert their control through market interference. Execute this and your payout will be exceptional.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_43_syndicate" } ],
        objectives: [
            { "id": "deliver_cybernetics_belt", "type": "DELIVER_ITEM", "goodId": "cybernetics", "quantity": 200, "target": "loc_belt" }
        ],
        completion: {
            locationId: "loc_belt",
            title: "Economic Ruin",
            text: "The subversion was successful and the colonies are saturated with our cybernetics. Belt laborers are bypassing Guild clinics entirely for our smuggled tech. This will completely destabilize Guild authority in the sector. You are a highly effective instrument of the Syndicate and we reward loyalty and results. I've authorized your payment and rank III clearance.",
            buttonText: "Accept Payment"
        },
        rewards: [
            { "type": "TRIGGER_SYSTEM_STATE", "stateId": "ECONOMIC_SABOTAGE" },
            { "type": "credits", "amount": 340000 },
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_SYNDICATE_BADGE_3" }
        ]
    },

    // =========================================================================================
    // MISSION 45: THE LIEUTENANT'S MANDATE
    // =========================================================================================
    'mission_45_guild': {
        id: "mission_45_guild",
        name: "The Lieutenant's Mandate",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_17",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. I am Lieutenant Surier, tactical proxy for the Arbiter. Your strike on Earth was surgically precise. Now, we break their shipyards. The Syndicate is attempting to construct an unregistered shadow fleet, relying heavily on graphene lattices. We will monopolize the supply. Haul the graphene to the industrial surface stations of Mars. If we control the materials, their ghost fleet remains a ghost. Execute this, and you will be handsomely rewarded.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_44_guild" } ],
        objectives: [
            { "id": "deliver_graphene_mars", "type": "DELIVER_ITEM", "goodId": "graphene_lattices", "quantity": 120, "target": "loc_mars" }
        ],
        completion: {
            locationId: "loc_mars",
            title: "Fleet Disruption",
            text: "The Martian vaults are overflowing with our lattices. The Syndicate's clandestine shipwrights are now starved of the very materials they need to construct their dreadnoughts. A masterful maneuver, Captain. You have crippled their expansion capabilities most effectively. Your compensation has been transferred.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { "type": "credits", "amount": 630000 },
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_HACKER_2" }
        ]
    },
    'mission_45_syndicate': {
        id: "mission_45_syndicate",
        name: "The Lieutenant's Mandate",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_2",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hello, Captain [playerName]. I am Jaxylum, lieutenant proxy for Vrael. Your operations in the Belt caused significant systemic disruption. We will now exploit a critical vulnerability. The Guild's elite hierarchy requires cryogenic technology to sustain their artificially extended lifespans. We intend to intercept this supply chain. Procure cryo-sleep pods and transport them to the surface stations on Pluto. By hoarding their longevity assets on the fringe, we subjugate their leadership. Execute this order and your compensation will reflect the strategic value of this maneuver.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_44_syndicate" } ],
        objectives: [
            { "id": "deliver_cryo_pluto", "type": "DELIVER_ITEM", "goodId": "cryo_sleep_pods", "quantity": 40, "target": "loc_pluto" }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "Longevity Denied",
            text: "The pods are secured within our Plutonian ice vaults. Our spies indicate that Guild encryption networks are currently flooded with distress signals from their highest-ranking officials. Your operational efficiency is commendable, Captain. Your payment has been authorized.",
            buttonText: "Acknowledge"
        },
        rewards: [
            { "type": "credits", "amount": 630000 },
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_HACKER_2" }
        ]
    },

    // =========================================================================================
    // MISSION 46: THE CALL (ACT III FINALE)
    // =========================================================================================
    'mission_46_guild': {
        id: "mission_46_guild",
        name: "The Call",
        type: "STORY",
        host: "GUILD",
        portraitId: "Merchants_Guild_17",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain. The Syndicate's shadow fleet initiative is compromised, and their market share is hemorrhaging. The Arbiter has requested a direct audience with you. This is unprecedented for an independent contractor. Proceed immediately to the surface stations of Earth. The Arbiter is waiting.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_45_guild" } ],
        onArrivalCinematic: { locationId: 'loc_earth', sequenceId: 'assets/images/video/arbiter_reveal.mp4' },
        objectives: [
            { "id": "travel_earth_arbiter", "type": "TRAVEL_TO", "target": "loc_earth" }
        ],
        completion: {
            locationId: "loc_earth",
            portraitId: "Arbiter_1",
            title: "The Arbiter's Truth",
            text: "Most perceive the Guild as a mere mercantile institution, but it is so much more. Every light, every life, is sustained by the mathematical order that the Merchant's Guild enforces. A million variables shift every second to prevent humanity from consuming itself, and I am the fulcrum of that equilibrium, the Arbiter. You have wielded that order as a weapon, breaking the Syndicate's industrial backbone with absolute precision. You have starved their clandestine shipyards of graphene, rendering their shadow fleet inert.<br><br>But our true concern lies inward, at the very center of the system. The kinetic launches you witnessed from that eccentric machine on Pluto are supplying a leviathan hidden in the corona. A ghost structure gathering mass in the dark, bypassing our authority. Furthermore, the telemetry you uploaded regarding a Z Class vessel utilizing a folded space drive is a mathematical impossibility. That technology is extinct, yet it moves freely in our space. Maintain your fleet's readiness. The board is resetting, and your role is about to escalate significantly. Between the leviathan at the center and these ancient anomalies returning to the fringe, the coming cycles will require unprecedented intervention to maintain control.",
            buttonText: "Act III Complete"
        },
        rewards: [
            { "type": "fill_fleet_fuel" },
            { "type": "fill_fleet_repair" }
        ]
    },
    'mission_46_syndicate': {
        id: "mission_46_syndicate",
        name: "The Call",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_2",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain. The Guild is experiencing severe systemic panic. Their elites face a deficit in life extension, and their grip on the market is compromised. You have accomplished the improbable: you secured Vrael’s direct attention. He requires an audience with the pilot dismantling the Guild's ledgers. Navigate your vessel to the cloud cities on Venus. Do not delay.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_45_syndicate" } ],
        onArrivalCinematic: { locationId: 'loc_venus', sequenceId: 'assets/images/video/vrael_reveal.mp4' },
        objectives: [
            { "id": "travel_venus_vrael", "type": "TRAVEL_TO", "target": "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            portraitId: "Vrael_1",
            title: "Vrael's Truth",
            text: "It is fitting we meet here, suspended in the extravagance of the Venusian atmosphere, far above the Guild's rigid domain. I am Vrael. The mathematical order of the Guild is a fragile illusion, as you have so eloquently proven by interring their cryo sleep pods on the Plutonian fringe. You have weaponized time itself against their ruling class, forcing their gerontocracy to face the sudden reality of their own mortality. Yet, the Syndicate's subversion of their hierarchy is merely a prelude.<br><br>The true locus of power has shifted. The telemetry you secured from that enigmatic machine intelligence on Pluto launching its continuous harvest directly into the sun's gravity well confirms a truth the Guild cannot quantify. It has revealed an uncontrolled anomalous silhouette within the corona. A colossal, unregistered megastructure hides there, silently consuming that kinetic tribute.<br><br>But it is not the only shadow moving in the dark. Your encounter with a Z Class dreadnought folding spacetime proves that the old limitations are dead. Ancient, terrifying power is returning to the board, completely independent of Guild regulation and our own designs. See to your fleet's readiness. The established order is fracturing, and we are going to harness this chaos.",
            buttonText: "Act III Complete"
        },
        rewards: [
            { "type": "fill_fleet_fuel" },
            { "type": "fill_fleet_repair" }
        ]
    }
};