// js/data/events/events_bureaucracy.js
/**
 * @fileoverview
 * Event Category: BUREAUCRACY
 * Focus: Legal challenges, corporate audits, tariffs, and quarantine protocols.
 * UPDATED: Purged evt_bureau_audit & evt_bureau_tariff. Medical Liner (Event Chain) & Override (Event Chain) Added.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_BUREAUCRACY = [
    {
        id: 'evt_bureau_quarantine',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Contaminant Alert',
            description: 'Station buoys detect dangerous levels of "radiation fleas"—ionized particulate coating your hull from unmaintained exhaust wash. Access denied.'
        },
        choices: [
            {
                id: 'choice_service',
                text: 'Hire Drone Decon Service (Pay Credits)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_service' }] }
            },
            {
                id: 'choice_chem',
                text: 'Chemical Flush (Pay Propellant)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROPELLANT, operator: 'GTE', value: 15 }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_chem' }] }
            },
            {
                id: 'choice_manual',
                text: 'Manual Vacuum Purge (Risk Cargo & Status)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_manual_success', weight: 30 },
                        { outcomeId: 'out_manual_fail', weight: 70 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_service': {
                title: 'Decon Complete',
                text: 'You pay for a remote drone service. It sprays your hull with harsh foam and clears your flag.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: -10 }]
            },
            'out_chem': {
                title: 'Chemical Scrub',
                text: 'You flush the hull with volatile Propellant. It strips the paint, but kills the contamination.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROPELLANT, value: 15 }]
            },
            'out_manual_success': {
                title: 'Purge Successful',
                text: 'You vent the affected sections to hard vacuum, freezing the particulate without damaging your systems.',
                effects: []
            },
            'out_manual_fail': {
                title: 'Purge Failure',
                text: 'The rapid depressurization severely fractures the hull plates and causes massive cargo loss.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, isCurrentPercent: true, value: 25 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_micro_fractures', value: 1 }
                ]
            }
        }
    },
    {
        id: 'evt_bureau_license',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Expired Credential',
            description: 'A bureaucratic sweep flags your primary Pilot\'s License as expired.'
        },
        choices: [
            {
                id: 'choice_spoof',
                text: 'Spoof Data Registry (Pay Processors)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 10 }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_spoof' }] }
            },
            {
                id: 'choice_fine',
                text: 'Pay Retroactive Fine (Pay Credits)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_fine' }] }
            },
            {
                id: 'choice_arbitration',
                text: 'Engage Arbitration AI (High Risk, Reward)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_arbitration_success', weight: 20 },
                        { outcomeId: 'out_arbitration_fail', weight: 80 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_spoof': {
                title: 'Records Falsified',
                text: 'You use Processors to brute-force a timestamp correction. The record now shows you renewed it yesterday.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 10 }]
            },
            'out_fine': {
                title: 'Fine Paid',
                text: 'You quietly transfer the credits to clear the flag.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: -5 }]
            },
            'out_arbitration_success': {
                title: 'Charge Dismissed',
                text: 'The Arbitration AI finds a loophole in the filing and not only dismisses the charge, but awards you a settlement.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: 2 }]
            },
            'out_arbitration_fail': {
                title: 'Digital Lockdown',
                text: 'The AI rejects your appeal and initiates a punitive digital lockdown. Your ship is stalled, your clearance is revoked, and all future services are surcharged.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: 20 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_revoked_clearance', value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_service_surcharges', value: 1 }
                ]
            }
        }
    },
    {
        id: 'evt_customs_override',
        tags: [],
        weight: 0,
        requirements: [],
        template: {
            title: 'Customs Intercept',
            description: 'Guild Customs tracked the unlogged cache\'s silent ping. They override your nav-computer and forcefully engage magnetic boarding clamps.'
        },
        choices: [
            {
                id: 'choice_dump',
                text: 'Dump Cache to Void',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_dump' }] }
            },
            {
                id: 'choice_resist',
                text: 'Resist Impound Protocol (Severe Hull Stress)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_resist' }] }
            }
        ],
        outcomes: {
            'out_dump': {
                title: 'Evidence Destroyed',
                text: 'You blow the airlock and vent the illicit goods just as the inspectors board.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, isCurrentPercent: true, value: 100 }]
            },
            'out_resist': {
                title: 'Clamps Sheared',
                text: 'You thrust hard against the boarding clamps. The hull screams and buckles as you tear free, earning you a permanent mark on corporate registries.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -30 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_corporate_blacklist', value: 1 }
                ]
            }
        }
    },
    {
        id: 'evt_medical_liner',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.CLONED_ORGANS, operator: 'GTE', value: 15 }],
        template: {
            title: 'The Medical Liner',
            description: 'A luxury liner broadcasts a pan-pan for emergency medical supplies to handle an onboard crisis.'
        },
        choices: [
            {
                id: 'choice_donate',
                text: 'Donate Cloned Organs (Lose Cargo)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_donate' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore Distress Signal (Move On)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_donate': {
                title: 'Cargo Transferred',
                text: 'You jettison the organ containers in specialized pods for the liner to catch. They immediately break radio silence to focus on their patients.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.CLONED_ORGANS, value: 15 },
                    { type: EVENT_CONSTANTS.EFFECTS.QUEUE_EVENT, target: 'evt_medical_liner_thanks', value: 3 }
                ]
            },
            'out_ignore': {
                title: 'Course Maintained',
                text: 'You keep your transponder dark and move on.',
                effects: []
            }
        }
    },
    {
        id: 'evt_medical_liner_thanks',
        tags: [],
        weight: 0,
        requirements: [],
        template: {
            title: 'An Encrypted Hail',
            description: 'The captain of the medical liner you assisted weeks ago hails you on an encrypted channel to express gratitude for saving their passengers.'
        },
        choices: [
            {
                id: 'choice_auto',
                text: 'Accept Transmission',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_auto' }] }
            }
        ],
        outcomes: {
            'out_auto': {
                title: 'Rewards Transmitted',
                text: 'They transmit a highly lucrative market tip and authorize a massive fuel voucher at the nearest depot.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.FULL_REFUEL, value: 1 }
                ]
            }
        }
    },
    {
        id: 'evt_bureau_blockade',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 8,
        requirements: [],
        template: {
            title: 'Sector Blockade',
            description: 'A corporate military flotilla has established a hard blockade across this sector. "Turn back, freighter. This lane is closed by order of the Board."'
        },
        choices: [
            {
                id: 'choice_bypass_hack',
                text: 'Spoof Clearance Codes (-10 Processors * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_bypass_hack' }] }
            },
            {
                id: 'choice_bypass_perk',
                text: 'Syndicate Connections (Req: Venetian Syndicate)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_PERK, target: PERK_IDS.VENETIAN_SYNDICATE, operator: 'EQ', value: 1 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_bypass_perk' }] }
            },
            {
                id: 'choice_bribe',
                text: 'Bribe Commander (-9% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_bribe' }] }
            },
            {
                id: 'choice_run',
                text: 'Run the Blockade (Risk Hull & Redirect)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_run_success', weight: 30 },
                        { outcomeId: 'out_run_fail', weight: 70 }
                    ]
                }
            },
            {
                id: 'choice_turn',
                text: 'Comply & Divert (Redirect & -Fuel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_turn_away' }] }
            }
        ],
        outcomes: {
            'out_bypass_hack': {
                title: 'Clearance Accepted',
                text: 'You pump raw processing power into a transponder spoof. The military sensors read you as a corporate supply vessel and wave you through.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }]
            },
            'out_bypass_perk': {
                title: 'Syndicate Access',
                text: 'You transmit a highly encrypted handshake. The commander realizes who you represent and quietly clears a path for you.',
                effects: []
            },
            'out_bribe': {
                title: 'Toll Extracted',
                text: 'You quietly transfer a massive sum to an anonymous account. The blockade "temporarily fails" in your sector, allowing you to pass.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, isCurrentPercent: true, value: -9 }]
            },
            'out_run_success': {
                title: 'Slipped Through',
                text: 'You kill your main drive and drift through a gap in the patrol net like a ghost. They never saw you.',
                effects: []
            },
            'out_run_fail': {
                title: 'Warning Shots',
                text: 'They spot you immediately. Warning shots rake your hull, forcing you to abort the jump and flee to the nearest safe port.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -25 },
                    { type: EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL, value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, isCurrentPercent: true, value: -20 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 20 }
                ]
            },
            'out_turn_away': {
                title: 'Diverted Course',
                text: 'You begrudgingly alter course and burn extra fuel to find a detour, abandoning your original destination.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL, value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, isCurrentPercent: true, value: -10 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 15 }
                ]
            }
        }
    }
];