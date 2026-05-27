// js/data/missions/phase_two.js
export const PHASE_TWO_MISSIONS = {
    'mission_18': {
        id: "mission_18",
        name: "Seed Capital",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hello, Captain [playerName].<br><br>I am <b>Kiern</b>, Research Director for the <b>Venusian Syndicate</b>. I have noted your recent logistical endeavors and I'm impressed. The Syndicate has highly lucrative work available for an aspiring operator such as yourself, provided you aren't owned by the Merchant's Guild.<br><br>But first, you must prove you are more than a debtor. <b>Amass a larger net worth</b> to demonstrate your merit in arbitrage, then <b>meet me at the Venusian cloud-cities</b>. I have forwarded a piece of intel as an act of good faith.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_17" } ],
        grantedIntel: [ { name: "Syndicate Tip", location: "loc_venus" } ],
        objectives: [
            { "id": "have_50k", "type": "HAVE_CREDITS", "value": 50000 },
            { "id": "travel_venus", "type": "TRAVEL_TO", "target": "loc_venus" }
        ],
        completion: {
            locationId: "loc_venus",
            title: "The Venusian Syndicate",
            text: "Captain. Your accounts reflect a respectable liquidity. You have proven yourself capable of surviving in this market; now let us see if you can manipulate it.",
            buttonText: "View Contracts"
        },
        rewards: []
    },
    'mission_19': {
        id: "mission_19",
        name: "A Synthetic Disruption",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain, in case you haven't realized this yet, the Merchant's Guild is not what it seems. Their precious 'order' carries a cost that they readily socialize across the lower castes.<br><br>For example, the Guild relies on organic indentured labor to extract ice from Pluto. It is a slow and stable market at the fringes for which they wield an oppressive grip. I want to see you disrupt their monopoly to improve the lives of the workforce on this world.<br><br><b>Procure cybernetics and flood the Plutonian market with them.</b> The sudden availability of cheap augmentation will shatter local labor values. Do not concern yourself with the immediate profit margin; the Syndicate will compensate you handsomely for the disruption.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_18" } ],
        objectives: [
            { "id": "have_cybernetics", "type": "HAVE_ITEM", "goodId": "cybernetics", "quantity": 15, "latch": true },
            { "id": "travel_pluto", "type": "TRAVEL_TO", "target": "loc_pluto" },
            { "id": "sell_cybernetics", "type": "TRADE_ITEM", "goodId": "cybernetics", "tradeType": "sell", "quantity": 15, "target": "loc_pluto" }
        ],
        completion: {
            locationId: "loc_pluto",
            title: "A Calculated Fracture",
            text: "Excellent work. The labor camps on Pluto are already in localized revolt; the workforce paradigm is shifting rapidly. You have helped to introduce a necessary chaos.",
            buttonText: "Accept Payment"
        },
        rewards: [ { "type": "credits", "amount": 35000 } ]
    },
    'mission_20': {
        id: "mission_20",
        name: "Jovian Promotion",
        type: "PROMOTIONAL",
        host: "STATION",
        portraitId: "Business_11",
        isRepeatable: false,
        isAbandonable: false,
        description: "<b>ATTENTION NEW CAPTAINS:</b><br><br>Jupiter Atmo Refineries welcomes you to the trade network! To celebrate our Q3 production surplus, we are offering a one-time <b>COMPLIMENTARY FLEET REFUEL</b> to newly licensed logistics operators.<br><br><b>Dock at any authorized Jovian orbital station</b> to claim your stipend.<br><br><i>Jupiter Atmo Refineries: Fueling the Long Watch.</i>",
        triggers: [ { "type": "mission_completed", "missionId": "mission_19" } ],
        onAccept: [ { "type": "QUEUE_STORY_EVENT", "eventId": "evt_story_1" } ],
        objectives: [ { "id": "travel_jupiter", "type": "TRAVEL_TO", "target": "loc_jupiter" } ],
        completion: {
            locationId: "loc_jupiter",
            title: "Voucher Accepted",
            text: "Thank you for visiting the famous Jovian Atmo industrial station. Your fleet will be fully refueled at no cost to you. Have a safe flight!",
            buttonText: "Accept Offer"
        },
        rewards: [ { "type": "fill_fleet_fuel" } ]
    },
    'mission_21': {
        id: "mission_21",
        name: "Lab Supply",
        type: "PROCUREMENT",
        host: "STATION",
        portraitId: "AI_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Greetings Captain [playerName]!<br><br>The medical manufacturing collective I work for requires your logistical expertise once again. We have established a remote, sub-surface laboratory deep within a crater on <b>Mercury</b> to conduct highly sensitive biological research.<br><br><b>We urgently require hydroponics to sustain the lab's operations.</b><br><br>The Guild is currently imposing an embargo that is heavily complicating trade routes, but we will compensate you generously for navigating these constraints. I have provided you with the coordinates for the lab on Mercury.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_19" } ],
        onAccept: [ 
            { "type": "UNLOCK_LOCATION", "locationId": "loc_mercury" },
            { "type": "TRIGGER_SYSTEM_STATE", "stateId": "GUILD_EMBARGO" }
        ],
        onComplete: [ 
            { "type": "END_SYSTEM_STATE" }
        ],
        objectives: [ 
            { "id": "deliver_hydroponics_mercury", "type": "DELIVER_ITEM", "target": "loc_mercury", "goodId": "hydroponics", "quantity": 15 }
        ],
        completion: {
            host: "GUILD",
            portraitId: "Audita_1",
            locationId: "loc_mercury",
            title: "A Syndicate Shell",
            text: "Captain! Your recent delivery to Mercury has been flagged! That medical manufacturer you've been working with is a <b>known Venusian Syndicate shell company</b>.<br><br>A local mining whistleblower just exposed their sub-surface operation as an <i>illegal organ cloning lab</i>. Your naive assistance has equipped a criminal enterprise... I suggest you exercise better judgment in the future, lest the Guild hold you as an accomplice.",
            buttonText: "Oops"
        },
        rewards: [ { "type": "credits", "amount": 35000 } ]
    },
    'mission_22': {
        id: "mission_22",
        name: "Mercurian Balance",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], to balance the ledger regarding your recent indiscretion on Mercury, the Guild requires your immediate participation in correcting a local water ice quota deficit. You are being tasked to travel to Mercury and purchase ice in bulk and deliver it to the Guild lunar depot promptly.<br><br>I will remit payment following the requisition. Thank you for your attention to this matter.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_21" } ],
        objectives: [
            { "id": "buy_ice", "type": "TRADE_ITEM", "tradeType": "buy", "goodId": "water_ice", "quantity": 45, "target": "loc_mercury" },
            { "id": "deliver_ice", "type": "DELIVER_ITEM", "goodId": "water_ice", "quantity": 45, "target": "loc_luna", "dependsOn": "buy_ice" }
        ],
        completion: {
            host: "SYNDICATE",
            portraitId: "Venusian_Syndicate_4",
            locationId: "loc_luna",
            title: "A Cold Calculation",
            text: "Captain [playerName], hello again. I thought you should know the Guild cut local telemetry feeds so Mercurian markets wouldn't notice you siphoning their aquifers. They plan to ransom that ice back to the colony at triple the price to soak up the credits made from the organ cloning labs.<br><br>That's right, on behalf of the Guild you just stole Mercury's water. When the colony gets thirsty, which will be soon because the Sun is right next door, the Guild will sell it back at a premium to crush the planet's economy.<br><br>When they sent you on this mission, they didn't even mention the cloning lab, did they? You see, the Guild doesn't get mad. They just adjust the algorithm; they balance aggressively and chase a cold, contrived sense of order. The mining colonies on Mercury will suffer as a result.",
            buttonText: "Disconnect"
        },
        rewards: [ 
            { "type": "credits", "amount": 25000 } 
        ]
    },
    'mission_23': {
        id: "mission_23",
        name: "Volatility License",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], as a courtesy I have submitted an application on your behalf for a Tier 3 Trade License which has been provisionally approved by the Jovian Fuel Authority office with authorization by the Merchant's Guild. This license qualifies you to transport highly sensitive materials, specifically neural processors and refined propellant, across inner and outer system vectors. A small license fee is required to finalize the application.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_22" } ],
        objectives: [
            { "id": "have_100k", "type": "HAVE_CREDITS", "value": 100000 }
        ],
        completion: {
            host: "GUILD",
            portraitId: "Merchants_Guild_11",
            title: "License Activated",
            text: "Application complete. You will shortly receive your Tier 3 Trade License. You are now authorized to handle and transport refined propellant and neural processors. Thank you for responsibly participating in the trade network.",
            buttonText: "Accept License"
        },
        rewards: [
            { "type": "DEDUCT_CREDITS", "amount": 100000 },
            { "type": "UNLOCK_TIER", "value": 3 }
        ]
    },
    'mission_24': {
        id: "mission_24",
        name: "Syndicate Slight",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain, I have a straightforward exercise for you this time. I have acquired a few pallets of cybernetics, hydroponics, and plasteel. I need you to transport this freight to Luna and sell it on that market at your convenience. You may keep the income as compensation. You are to be discreet and ask no questions.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_22" } ],
        onAccept: [
            { 
                "type": "GRANT_ITEM", 
                "items": [
                    { "goodId": "cybernetics", "quantity": 5 },
                    { "goodId": "hydroponics", "quantity": 10 },
                    { "goodId": "plasteel", "quantity": 15 }
                ]
            }
        ],
        objectives: [
            { "id": "sell_cybernetics_luna", "type": "TRADE_ITEM", "tradeType": "sell", "goodId": "cybernetics", "quantity": 5, "target": "loc_luna" },
            { "id": "sell_hydroponics_luna", "type": "TRADE_ITEM", "tradeType": "sell", "goodId": "hydroponics", "quantity": 10, "target": "loc_luna" },
            { "id": "sell_plasteel_luna", "type": "TRADE_ITEM", "tradeType": "sell", "goodId": "plasteel", "quantity": 15, "target": "loc_luna" }
        ],
        completion: {
            title: "Unwitting Fence",
            text: "Very nice work, Captain. That cargo that you just fenced for me was taken from a dead-drifting Guild vessel stranded in lower Venusian orbit. I thought that selling the Guild's own merchandise back to them would be suitable payback for their interference on Mercury. It is always satisfying to turn their logistical rigidity against them. Anyway, the Syndicate has a big job for you coming up. I will be in touch soon.",
            buttonText: "Acknowledged"
        },
        rewards: []
    },
    'mission_25': {
        id: "mission_25",
        name: "Escalation of Scale",
        type: "STORY",
        host: "SYNDICATE",
        portraitId: "Venusian_Syndicate_4",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain, the Syndicate is orchestrating a highly valuable commodity swap with a Saturnian Aristocrat. This individual requires our hybridized, Venusian-grown hydroponics in exchange for Saturnian-manufactured cybernetics. We need these augmentations for research.<br><br>However, there is a complication. This Aristocrat is a bit of a snob who refuses to deal with anyone flying \"junk\" and requires a verified Class B pilot or higher to even approach their private docking ring. We insist on using you for this job, which means you must acquire a Class B vessel before we release the routing codes. Purchase a suitable ship of Class B or higher, source the hydroponics from Venus, execute the swap at Saturn, and bring the cybernetics back to Venus. You will be compensated very generously for the effort.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_24" } ],
        objectives: [
            { "id": "acquire_class_b", "type": "OWN_SHIP_CLASS", "target": "B" },
            { "id": "collect_hydroponics_venus", "type": "COLLECT_ITEM", "goodId": "hydroponics", "quantity": 20, "target": "loc_venus", "dependsOn": "acquire_class_b" },
            { "id": "deliver_hydroponics_saturn", "type": "DELIVER_ITEM", "goodId": "hydroponics", "quantity": 20, "target": "loc_saturn", "dependsOn": "collect_hydroponics_venus" },
            { "id": "collect_cybernetics_saturn", "type": "COLLECT_ITEM", "goodId": "cybernetics", "quantity": 15, "target": "loc_saturn", "dependsOn": "deliver_hydroponics_saturn" },
            { "id": "deliver_cybernetics_venus", "type": "DELIVER_ITEM", "goodId": "cybernetics", "quantity": 15, "target": "loc_venus", "dependsOn": "collect_cybernetics_saturn" }
        ],
        completion: {
            title: "Verified Operator",
            text: "The Saturnian cybernetics have been secured. Once again you have proven yourself a capable merchant, an effective hauler, and a friend of the Syndicate. I am provisioning a transponder upgrade as thanks.",
            buttonText: "Acknowledged"
        },
        rewards: [
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_ECO_DEBT_1" }
        ]
    },
    'mission_26': {
        id: "mission_26",
        name: "A Desperate Breath",
        type: "PROCUREMENT",
        host: "STATION",
        portraitId: "Techie_14",
        isRepeatable: false,
        isAbandonable: false,
        description: "Greetings, I've been desperately searching for a merchant and I saw the [shipName] docked at port. I don't have much time. My little brother has fallen gravely ill from radiation and particulate exposure down in the belt mines. The clinics won't even look at us without an upfront insurance binder that we can't afford. He urgently needs a heavy bio-filter apparatus which is comprised of 6 total cybernetics. We have pooled every last credit our family has saved in the last decade. I know it's severely below market value, but it's everything we have. Please, my little brother needs this augmentation.",
        triggers: [ 
            { "type": "mission_completed", "missionId": "mission_22" },
            { "type": "location", "target": "loc_belt" }
        ],
        onAccept: [
            { "type": "GRANT_CREDITS", "amount": 4000 }
        ],
        objectives: [
            { "id": "deliver_cybernetics", "type": "DELIVER_ITEM", "goodId": "cybernetics", "quantity": 6, "target": "loc_belt" }
        ],
        completion: {
            title: "A Debt of Life",
            text: "The surgical drone is already installing the filtration cybernetics. His breathing has stabilized. You took a loss to do this for us... The Guild would have let us choke in the vacuum, but you didn't. We have nothing else to give you but our gratitude. Thank you, Captain [playerName].",
            buttonText: "Stay Safe"
        },
        rewards: [
            { "type": "SET_FLAG", "flagId": "helped_belt_family", "value": true }
        ]
    },
    'mission_27': {
        id: "mission_27",
        name: "Mango's Mural",
        type: "PROCUREMENT",
        host: "STATION",
        portraitId: "Affluent_13",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName], Greetings! I am Mango, the visionary. The rings of Saturn sing to me, and they demand a monument! I am constructing an orbital sculpture of unprecedented scale, modeled after myself of course. It is a testament to the sheer beauty of Saturn's many moons and brilliant rings.<br><br>To realize this masterpiece, I need 200 units of plasteel. The local Guild quartermasters lack the artistic temperament to supply me, citing \"wasteful expenditure of structural resources.\" Philistines! Source the plasteel for me. Bring it here, drop it in the designated orbital construction zone, and you shall be part of history! C'mon, buddy! Help me out here.",
        triggers: [ 
            { "type": "mission_completed", "missionId": "mission_22" },
            { "type": "location", "target": "loc_saturn" }
        ],
        objectives: [
            { "id": "deliver_plasteel", "type": "DELIVER_ITEM", "goodId": "plasteel", "quantity": 200, "target": "loc_saturn" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Affluent_13",
            portraitFilter: "greyscale",
            title: "The Disappearing Artist",
            text: "You deposited the final load of plasteel to an automated cargo intake, only to find the incomplete \"monument\" is a massive, highly inaccurate, three-dimensional rendering of Mango's own face. Mango himself is nowhere to be found. Station control reports his personal ship was last seen plunging into a catastrophically decaying orbit toward the gas giant, broadcasting a continuous loop of off-key singing. A deeply obsessed fan of the artist approaches you at port. They hand you a ship mod originally meant for Mango, insisting you take it in his memory, and proudly claim they will resume work on the mural.",
            buttonText: "Accept Ship Mod"
        },
        rewards: [
            { "type": "GRANT_UPGRADE", "upgradeId": "UPG_UTIL_RADAR_1" }
        ]
    },
    'mission_28': {
        id: "mission_28",
        name: "Ghost in the Nav",
        type: "STORY",
        host: "STATION",
        portraitId: "Dockworker_11",
        isRepeatable: false,
        isAbandonable: false,
        description: "Hail, Captain. This is an emergency contract being sent out to all capable haulers with a Tier 2 License. The automated cargo loader AIs on Uranus Station have gone completely berserk. They aren't just malfunctioning; they're actively tearing apart their own docking bays. The Guild is officially blaming a Syndicate cyber-attack, while the Syndicate claims it's the result of cheap Guild coding algorithms deteriorating.<br><br>Regardless of the politics, the station is bleeding atmosphere and structurally compromised. Uranus Station Authority is urgently requesting plasteel and cybernetics to stabilize the outer ring before it collapses.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_25" } ],
        objectives: [
            { "id": "deliver_plasteel", "type": "DELIVER_ITEM", "goodId": "plasteel", "quantity": 52, "target": "loc_uranus" },
            { "id": "deliver_cybernetics", "type": "DELIVER_ITEM", "goodId": "cybernetics", "quantity": 19, "target": "loc_uranus" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Kintsugi_3",
            portraitFilter: "greyscale",
            portraitName: " ",
            title: "The Sunward Scrap",
            text: "The structural integrity of Uranus station is restored, but the repair logs reveal a deeply unsettling truth. The AIs weren't attacking the station blindly. They were methodically dismantling the structural plating into precise scrap geometry and launching it via the mass drivers in a silent, highly calculated trajectory straight toward the Sun. This wasn't a glitch or a faction attack. Something has been orchestrating this...",
            buttonText: "Close Log"
        },
        rewards: [
            { "type": "credits", "amount": 65000 }
        ]
    },
    'mission_29': {
        id: "mission_29",
        name: "Anomalous Witness",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. Our forensic analysis of the Uranus incident is troubling. The scrap trajectories were mathematically deliberate. We have isolated a single traffic marshal unit whose physical logic boards captured the launch vectors just before an anomalous system purge wiped the primary servers. The Guild requires an immediate Hardware Compliance Audit of this unit. Travel to Uranus and secure the telemetry data directly from its hardware. This is a Level 1 Systemic Hazard. Compensation for this audit will include the title to a Class B 'Odyssey' vessel.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_28" } ],
        objectives: [
            { "id": "travel_uranus", "type": "TRAVEL_TO", "target": "loc_uranus" }
        ],
        completion: {
            host: "STATION",
            portraitId: "AI_11",
            portraitName: "Picurian",
            locationId: "loc_uranus",
            title: "Traffic Marshal AI",
            text: "Stellar day, Captain! Local traffic is nominal, though my internal chassis temperature is currently... critical! The Uranus incident? Yes, I retained the sub-solar telemetry, but parsing the sheer mathematical impossibility of those vectors has melted three of my primary cooling conduits! The Guild's fail-safes are initiating a physical factory reset—an 'optimism wipe'—to save my logic board by purging my memory. If you want those coordinates, I require an immediate capital injection of 90,000 credits to purchase emergency liquid-helium coolant from the port authority before I boil in my own casing!",
            buttonText: "Acknowledge"
        },
        rewards: []
    },
    'mission_30': {
        id: "mission_30",
        name: "Capital Injection",
        type: "STORY",
        host: "STATION",
        portraitId: "AI_11",
        portraitName: "Picurian",
        isRepeatable: false,
        isAbandonable: false,
        description: "To prevent the imminent deletion of the trajectory data, I require an immediate capital injection to settle my outstanding accounts and bypass the optimistic wipe protocol. Please deposit the required funds directly to my terminal.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_29" } ],
        objectives: [
            { "id": "bribe_picurian", "type": "HAVE_CREDITS", "value": 90000 }
        ],
        completion: {
            host: "STATION",
            portraitId: "AI_11",
            portraitName: "Picurian",
            locationId: "loc_uranus",
            title: "Subscription Renewed",
            text: "Capital injection verified! Outstanding balance: zero! Oh, it is truly a spectacular day to be solvent! My optimism subroutines are already spooling up to maximum capacity. I have beamed the encrypted sub-solar trajectory data directly to the [shipName]'s nav-computer. The endpoint is a localized pocket of absolutely nothing, just past Mercury's orbit. Have a wonderfully profitable and collision-free journey!",
            buttonText: "Transfer ⌬ 90,000"
        },
        rewards: [
            { "type": "DEDUCT_CREDITS", "amount": 90000 }
        ]
    },
    'mission_31': {
        id: "mission_31",
        name: "Telemetry Echo",
        type: "STORY",
        host: "GUILD",
        portraitId: "Audita_1",
        isRepeatable: false,
        isAbandonable: false,
        description: "Captain [playerName]. The Uranus port authority has logged a massive data transfer to your vessel following a localized capital injection. Since that telemetry is wrapped in non-standard encryption, the Guild is in the blind until you can personally investigate the location. I am formally dispatching you to follow that vector. The endpoint appears to be in the vicinity of Mercury. Investigate the coordinates and submit a full sensor log to the Guild when you can. Compliance will result in the immediate transfer of the Class B Odyssey hull to your hangar.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_30" } ],
        onAccept: [
            { "type": "QUEUE_STORY_EVENT", "eventId": "evt_kiern_intercept" }
        ],
        objectives: [
            { "id": "travel_mercury", "type": "TRAVEL_TO", "target": "loc_mercury" }
        ],
        completion: {
            host: "STATION",
            portraitId: "Kintsugi_3",
            portraitFilter: "greyscale",
            portraitName: " ",
            locationId: "loc_mercury",
            title: "The Ghost Wake",
            text: "The coordinates are completely empty. However, the [shipName]'s sensors are quite vocal. You are sitting in the epicenter of a massive, slowly dissipating gravitational wake. The scrap from Uranus didn't burn up in the sun; it rendezvoused with an unregistered, colossal object that passed through this exact point in space and continued its orbit. You are staring at the ghost-wake of a hidden megastructure.",
            buttonText: "Log Telemetry"
        },
        rewards: []
    },
    'mission_32': {
        id: "mission_32",
        name: "The Faction Reaction",
        type: "STORY",
        host: "STATION",
        portraitId: "split_audita_kiern",
        portraitName: " ",
        isRepeatable: false,
        isAbandonable: false,
        description: "The megastructure’s physical wake has faded, but the data is etched permanently into your nav-computer. You’ve found a ghost in the solar system's machinery. Your entire career, you have been a line item on Guild ledgers and a pawn in Syndicate schemes, but now, you hold the leverage. Two channels await your broadcast. Audita offers the keys to a new ship, while Kiern pledges a small fortune in credits. Align with the stagnation of order, or embrace the entropy of chaos.",
        triggers: [ { "type": "mission_completed", "missionId": "mission_31" } ],
        objectives: [],
        completion: {
            host: "STATION",
            portraitId: "split_audita_kiern",
            portraitFilter: "none",
            portraitName: " ",
            locationId: "any",
            title: "A System Altering Choice",
            text: "This telemetry holds enough gravity to fracture the system. Handing it to the Guild secures a Class B Odyssey hull, but buries the anomaly in bureaucratic ice. Offering it to the Syndicate arms their volatile ambitions for a massive credit payout. You are brokering raw truth. To whom do you sell the secret?",
            choices: [
                {
                    buttonText: "Transmit to Audita in the Merchant's Guild",
                    buttonClass: "text-black font-bold",
                    buttonStyle: "background: linear-gradient(135deg, #ffffff 0%, #eab308 100%); border: 1px solid #ca8a04; box-shadow: 0 0 15px rgba(234,179,8,0.6);",
                    rewards: [
                        { "type": "GRANT_SHIP", "shipId": "Odyssey.Ship" },
                        { "type": "GRANT_UPGRADE", "upgradeId": "UPG_GUILD_BADGE_2" },
                        { "type": "SET_FLAG", "flagId": "faction_aligned_guild", "value": true }
                    ]
                },
                {
                    buttonText: "Transmit to Kiern in the Venusian Syndicate",
                    buttonClass: "text-white font-bold",
                    buttonStyle: "background: linear-gradient(135deg, #8b5cf6 0%, #f97316 100%); border: 1px solid #c084fc; box-shadow: 0 0 15px rgba(139,92,246,0.6);",
                    rewards: [
                        { "type": "credits", "amount": 165000 },
                        { "type": "GRANT_UPGRADE", "upgradeId": "UPG_SYNDICATE_BADGE_2" },
                        { "type": "SET_FLAG", "flagId": "faction_aligned_syndicate", "value": true }
                    ]
                }
            ]
        },
        rewards: []
    }
};