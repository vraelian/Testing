/**
 * @fileoverview
 * Event Category: OPPORTUNITY
 * Focus: Rare chances, beneficial encounters, and high-reward risks.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_OPPORTUNITY = [
    // =========================================================================
    // CATEGORY VII: OPPORTUNITY (Beneficial Encounters)
    // =========================================================================
    {
        id: 'evt_opp_server',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 5,
        requirements: [],
        template: {
            title: 'Corrupted Server',
            description: 'You drift past a scorched server rack, likely ejected from a destroyed corporate station. Its backup battery is weak, but the encryption light is still blinking.'
        },
        choices: [
            {
                id: 'choice_decrypt',
                text: 'Attempt Decryption (Risk Trip Delay)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_decrypt_success', weight: 60 },
                        { outcomeId: 'out_decrypt_fail', weight: 40 }
                    ]
                }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_decrypt_success': {
                title: 'Access Granted',
                text: 'You crack the encryption just before the battery dies. It contains a forgotten, anonymous bank transfer authorization.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: 2500 }]
            },
            'out_decrypt_fail': {
                title: 'Data Corruption',
                text: 'The security protocols trigger a localized EMP. The server fries, and your nav-computer needs a hard reboot.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_ignore': {
                title: 'Server Left',
                text: 'You leave the electronic ghost to drift.',
                effects: []
            }
        }
    },
    {
        id: 'evt_opp_noble',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 5,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CREDITS, operator: 'GTE', value: 500 }],
        template: {
            title: 'The Eccentric Noble',
            description: 'A flamboyant private yacht hails you. "My guests are dreadfully bored of this empty void! Do you have any entertaining stories or exotic goods to share?"'
        },
        choices: [
            {
                id: 'choice_entertain',
                text: 'Provide Entertainment (-500 Credits)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CREDITS, operator: 'GTE', value: 500 }],
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_entertain_success', weight: 50 },
                        { outcomeId: 'out_entertain_fail', weight: 50 }
                    ]
                }
            },
            {
                id: 'choice_ignore',
                text: 'Decline',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_entertain_success': {
                title: 'Generous Patron',
                text: 'You spend hours recounting your closest calls. The noble is delighted. "Marvelous! Please, take this for the amusement."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: -500 }, // Initial cost
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: 5000 }  // Reward
                ]
            },
            'out_entertain_fail': {
                title: 'Tough Crowd',
                text: 'You try to entertain them with drinks and stories, but they quickly grow bored and cut the feed. You wasted your resources.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: -500 }]
            },
            'out_ignore': {
                title: 'Connection Closed',
                text: 'You have work to do.',
                effects: []
            }
        }
    },
    {
        id: 'evt_opp_veteran',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 5,
        requirements: [],
        template: {
            title: 'Drifting Veteran',
            description: 'You find an old, heavily modified shuttle drifting with a blown comms relay. The pilot waves frantically from the cockpit window.'
        },
        choices: [
            {
                id: 'choice_assist',
                text: 'Assist Repair (Trip Delay)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_assist_success', weight: 80 },
                        { outcomeId: 'out_assist_fail', weight: 20 }
                    ]
                }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_assist_success': {
                title: 'Gratitude',
                text: 'You help fix the relay. "I have no credits," the old pilot says, "but take this old Fuel Pass. It still works at most corporate stations."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE, target: 'UPG_ECO_FUEL_1' }
                ]
            },
            'out_assist_fail': {
                title: 'Simple Thanks',
                text: 'You fix the relay. The pilot nods thanks and departs immediately. No reward, but a good deed done.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_ignore': {
                title: 'Signal Ignored',
                text: 'You fly past.',
                effects: []
            }
        }
    },
    {
        id: 'evt_opp_crate',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.HAZARD],
        weight: 5,
        requirements: [],
        template: {
            title: 'Sealed Military Crate',
            description: 'A high-security crate floats in a debris field. It has no digital interface, only a manual pressure seal that looks jammed.'
        },
        choices: [
            {
                id: 'choice_force',
                text: 'Force Open (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_force_success', weight: 50 },
                        { outcomeId: 'out_force_fail', weight: 50 }
                    ]
                }
            },
            {
                id: 'choice_ignore',
                text: 'Leave It',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_force_success': {
                title: 'Pristine Tech',
                text: 'You pry the seal open. Inside is a mint-condition set of Hull Plating, still in the factory wrap.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE, target: 'UPG_UTIL_HULL_1' }]
            },
            'out_force_fail': {
                title: 'Explosive Bolt',
                text: 'The anti-tamper mechanism fires an explosive bolt, sending shrapnel into your hull.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.15 } }]
            },
            'out_ignore': {
                title: 'Left Alone',
                text: 'Not worth the risk.',
                effects: []
            }
        }
    },
    {
        id: 'evt_opp_ion',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 5,
        requirements: [],
        template: {
            title: 'Ion Cloud',
            description: 'Your sensors detect a dense, highly charged ion cloud. It is dangerous to fly through, but it is composed of nearly pure, energetic plasma.'
        },
        choices: [
            {
                id: 'choice_scoop',
                text: 'Manual Scoop (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_scoop_success', weight: 60 },
                        { outcomeId: 'out_scoop_fail', weight: 40 }
                    ]
                }
            },
            {
                id: 'choice_avoid',
                text: 'Avoid',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_avoid' }] }
            }
        ],
        outcomes: {
            'out_scoop_success': {
                title: 'Tanks Full',
                text: 'You carefully open the intakes. The energetic plasma floods your system, filling your tanks to capacity in minutes.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.FULL_REFUEL, value: 1 }]
            },
            'out_scoop_fail': {
                title: 'Overload',
                text: 'The ion discharge arcs across your hull, scorching the plating without giving you a chance to collect it.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.10 } }]
            },
            'out_avoid': {
                title: 'Course Correction',
                text: 'You steer clear of the anomaly.',
                effects: []
            }
        }
    },
    {
        id: 'evt_opp_tanker',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 5,
        requirements: [],
        template: {
            title: 'Stranded Tanker',
            description: 'A massive corporate fuel tanker is drifting. "Our main valve is stuck," the captain hails. "If you can help us unstuck it manually, we\'ll make it worth your while."'
        },
        choices: [
            {
                id: 'choice_repair',
                text: 'Help Repair (Trip Delay)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_repair_success', weight: 90 },
                        { outcomeId: 'out_repair_fail', weight: 10 }
                    ]
                }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_repair_success': {
                title: 'Service Rendered',
                text: 'It takes two days of spacewalking to free the valve. "Thank you," the captain says. "Let me top you off." Your fuel gauge hits 100%.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.FULL_REFUEL, value: 1 }
                ]
            },
            'out_repair_fail': {
                title: 'Valve Jammed',
                text: 'You try for days, but the valve is fused solid. You wasted your time.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }]
            },
            'out_ignore': {
                title: 'Offer Declined',
                text: 'You have your own schedule to keep.',
                effects: []
            }
        }
    }
];