// js/data/events/events_salvage.js
/**
 * @fileoverview
 * Event Category: SALVAGE
 * Focus: Derelict ships, ancient probes, and debris fields.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_SALVAGE = [
    {
        id: 'evt_salvage_freight_claim',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'GTE', value: 1 }],
        template: {
            title: 'Salvaged Freight Claim',
            description: 'You discover a free-floating, sealed shipping container bearing a faint corporate registry ping.'
        },
        choices: [
            {
                id: 'choice_grapple',
                text: 'Grapple & Salvage (Take Goods)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_grapple' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore Debris (Move On)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_grapple': {
                title: 'Lucky Find',
                text: 'You bring it aboard and break the seal. The goods are intact and immediately added to your hold.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO, isCurrentPercent: true, value: 75 },
                    { type: EVENT_CONSTANTS.EFFECTS.QUEUE_EVENT, target: 'evt_salvage_auditors', value: 2 }
                ]
            },
            'out_ignore': {
                title: 'Object Avoided',
                text: 'Not worth the risk.',
                effects: []
            }
        }
    },
    {
        id: 'evt_salvage_auditors',
        tags: [],
        weight: 0,
        requirements: [],
        template: {
            title: 'Corporate Insurance Auditors',
            description: 'Corporate insurance auditors have tracked the salvaged container\'s registry ping directly to your hull.'
        },
        choices: [
            {
                id: 'choice_surrender',
                text: 'Surrender Claimed Goods',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_USED_CARGO_SPACE, operator: 'EQ', value: 1 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_surrender' }] }
            },
            {
                id: 'choice_falsify',
                text: 'Falsify Manifest (Pay Fine, Risk Status)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_falsify' }] }
            }
        ],
        outcomes: {
            'out_surrender': {
                title: 'Goods Confiscated',
                text: 'You comply with the audit. The corporate agents aggressively strip your hold of the disputed cargo.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, isCurrentPercent: true, value: 50 }]
            },
            'out_falsify': {
                title: 'Falsified Records',
                text: 'You pay a steep fine to grease the auditor\'s palms and alter the records, but your ship is flagged in their system.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: -5 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_corporate_blacklist', value: 1 }
                ]
            }
        }
    },
    {
        id: 'evt_unlogged_cache',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'GTE', value: 1 }],
        template: {
            title: 'The Unlogged Cache',
            description: 'You locate a dormant, drifting transport container with its transponder completely offline.'
        },
        choices: [
            {
                id: 'choice_extract',
                text: 'Extract Cache (Take Goods)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_extract' }] }
            },
            {
                id: 'choice_maintain',
                text: 'Maintain Course (Move On)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_maintain' }] }
            }
        ],
        outcomes: {
            'out_extract': {
                title: 'Silent Cargo',
                text: 'The goods are highly valuable and untraceable... for now.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO, isCurrentPercent: true, value: 75 },
                    { type: EVENT_CONSTANTS.EFFECTS.QUEUE_EVENT, target: 'evt_customs_override', value: 1 }
                ]
            },
            'out_maintain': {
                title: 'Left Behind',
                text: 'You stay on mission.',
                effects: []
            }
        }
    },
    {
        id: 'evt_ghost_in_machine',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'The Ghost in the Machine',
            description: 'You find a drifting server rack with blinking encryption lights floating among some old debris.'
        },
        choices: [
            {
                id: 'choice_decryption',
                text: 'Attempt Decryption (Gain Credits)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_decryption_safe', weight: 30 },
                        { outcomeId: 'out_decryption_infected', weight: 70 }
                    ]
                }
            },
            {
                id: 'choice_leave',
                text: 'Leave Server (Move On)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_leave' }] }
            }
        ],
        outcomes: {
            'out_decryption_safe': {
                title: 'Clean Extraction',
                text: 'You siphon off the hidden cryptocurrency caches without triggering any countermeasures.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: 5 }]
            },
            'out_decryption_infected': {
                title: 'Funds Extracted',
                text: 'You secure the cryptocurrency, but the server\'s core architecture behaves strangely as it interfaces with your ship.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: 5 },
                    { type: EVENT_CONSTANTS.EFFECTS.QUEUE_EVENT, target: 'evt_logic_bomb', value: 1 }
                ]
            },
            'out_leave': {
                title: 'Course Maintained',
                text: 'You leave the ancient hardware to drift.',
                effects: []
            }
        }
    },
    {
        id: 'evt_logic_bomb',
        tags: [],
        weight: 0,
        requirements: [],
        template: {
            title: 'Embedded Logic Bomb',
            description: 'A dormant virus you picked up from the drifting server rack suddenly executes within your avionics.'
        },
        choices: [
            {
                id: 'choice_auto',
                text: 'Brace for Impact',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_auto' }] }
            }
        ],
        outcomes: {
            'out_auto': {
                title: 'Systems Compromised',
                text: 'The logic bomb scrambles your navigational charts and introduces persistent ghost-data into your HUD.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_nav_glitch', value: 1 }]
            }
        }
    },
    {
        id: 'evt_salvage_probe',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Ad Astra Relic',
            description: 'You spot a dark object tumbling in orbit. It\'s a decaying Ad Astra Initiative survey probe from the expansion era. It might have valuable components, or unexploded ordnance.'
        },
        choices: [
            {
                id: 'choice_scavenge',
                text: 'Scavenge (Req: 5 Cargo Space)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'GTE', value: 5 }],
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_scavenge_success', weight: 80 },
                        { outcomeId: 'out_scavenge_fail', weight: 20 }
                    ]
                }
            },
            {
                id: 'choice_logs',
                text: 'Download Logs (Intel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_logs' }] }
            },
            {
                id: 'choice_leave',
                text: 'Leave',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_leave' }] }
            }
        ],
        outcomes: {
            'out_scavenge_success': {
                title: 'Components Recovered',
                text: 'You grapple the probe and scan it thoroughly, discovering high-grade electronics!',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 3 }]
            },
            'out_scavenge_fail': {
                title: 'Trap Triggered',
                text: 'A self-destruct charge triggers as you touch it. The explosion rocks your ship.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -20 }]
            },
            'out_logs': {
                title: 'Data Decrypted',
                text: 'You recover some old stellar charts from the corrupted memory core.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }]
            },
            'out_leave': {
                title: 'Signal Ignored',
                text: 'You leave the relic alone.',
                effects: []
            }
        }
    },
    {
        id: 'evt_salvage_wreck',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.HAZARD],
        weight: 10,
        requirements: [],
        template: {
            title: 'Graveyard',
            description: 'You drift through a field of shattered hull plates. There is scrap everywhere.'
        },
        choices: [
            {
                id: 'choice_scrap',
                text: 'Harvest Scrap (+Trip Delay, +Plasteel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_scrap' }] }
            },
            {
                id: 'choice_deep',
                text: 'Deep Search (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_deep_success', weight: 70 },
                        { outcomeId: 'out_deep_fail', weight: 30 }
                    ]
                }
            },
            {
                id: 'choice_pass',
                text: 'Pass',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_pass' }] }
            }
        ],
        outcomes: {
            'out_scrap': {
                title: 'Scrap Harvested',
                text: 'You spend valuable time carefully collecting hull plates. Boring, but profitable.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 10 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 5 }
                ]
            },
            'out_deep_success': {
                title: 'Core Salvaged',
                text: 'You find a surviving computer core and some intact cybernetics.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 20 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.CYBERNETICS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 }
                ]
            },
            'out_deep_fail': {
                title: 'Collision!',
                text: 'A piece of debris you didn\'t see slams into your engine bell.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -20 }]
            },
            'out_pass': {
                title: 'Course Maintained',
                text: 'You navigate through without stopping.',
                effects: []
            }
        }
    },
    {
        id: 'evt_salvage_beacon',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Rogue Beacon',
            description: 'A distress beacon pings nearby, but the encryption doesn\'t match Guild protocols. It could be an old cache, or malware.'
        },
        choices: [
            {
                id: 'choice_investigate',
                text: 'Investigate (Risk Wealth)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_investigate_success', weight: 50 },
                        { outcomeId: 'out_investigate_fail', weight: 50 }
                    ]
                }
            },
            {
                id: 'choice_nav',
                text: 'Nav Scan (Req: Navigator)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_PERK, target: PERK_IDS.NAVIGATOR, operator: 'EQ', value: 1 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_nav' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_investigate_success': {
                title: 'Dead Drop Found',
                text: 'It is a dead drop from the last war. You crack the code and find a stash of credits.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: 1.5 }]
            },
            'out_investigate_fail': {
                title: 'Malware Detected',
                text: 'As soon as you link up, a virus uploads itself to your finance computer and siphons funds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: -5 }]
            },
            'out_nav': {
                title: 'Threat Identified',
                text: 'Your advanced sensors flag the signal as a known malware signature. You mark it for deletion and move on.',
                effects: []
            },
            'out_ignore': {
                title: 'Signal Ignored',
                text: 'Not worth the risk.',
                effects: []
            }
        }
    }
];