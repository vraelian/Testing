/**
 * @fileoverview
 * Event Category: SALVAGE
 * Focus: Derelict ships, ancient probes, and debris fields.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_SALVAGE = [
    // =========================================================================
    // CATEGORY VI: SALVAGE (Discovery & Opportunity)
    // =========================================================================
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
                text: 'You grapple the probe and strip it for parts. High-grade electronics!',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 3 }]
            },
            'out_scavenge_fail': {
                title: 'Trap Triggered',
                text: 'A self-destruct charge triggers as you touch it. The explosion rocks your ship.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.20 } }]
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
        id: 'evt_salvage_container',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Free Floating',
            description: 'A sealed shipping container floats alone in the void. It might be goods, or it might be waste.'
        },
        choices: [
            {
                id: 'choice_grapple',
                text: 'Grapple (Req: 10 Cargo Space)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'GTE', value: 10 }],
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_grapple_success', weight: 60 },
                        { outcomeId: 'out_grapple_fail', weight: 40 }
                    ]
                }
            },
            {
                id: 'choice_scan',
                text: 'Detailed Scan (-2 Processors)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 2 }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_scan' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_grapple_success': {
                title: 'Lucky Find',
                text: 'You bring it aboard. It is full of legitimate trade goods!',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO, value: 10 }]
            },
            'out_grapple_fail': {
                title: 'Hazardous Waste',
                text: 'You bring it aboard. It is full of industrial sludge. You have to pay a disposal fee.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.05 } }]
            },
            'out_scan': {
                title: 'Scan Confirmed',
                text: 'You burn high-end sensors to peer inside. It reveals valid cargo, which you collect safely.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO, value: 10 }
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
                text: 'You spend a few hours collecting hull plates. Boring, but profitable.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 5 }
                ]
            },
            'out_deep_success': {
                title: 'Core Salvaged',
                text: 'You find a surviving computer core and some intact cybernetics.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.CYBERNETICS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 }
                ]
            },
            'out_deep_fail': {
                title: 'Collision!',
                text: 'A piece of debris you didn\'t see slams into your engine bell.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.20 } }]
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
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.015 } }]
            },
            'out_investigate_fail': {
                title: 'Malware Detected',
                text: 'As soon as you link up, a virus uploads itself to your finance computer and siphons funds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.05 } }]
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