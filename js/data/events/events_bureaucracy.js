// js/data/events/events_bureaucracy.js
/**
 * @fileoverview
 * Event Category: BUREAUCRACY
 * Focus: Legal challenges, corporate audits, tariffs, and quarantine protocols.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_BUREAUCRACY = [
    // =========================================================================
    // CATEGORY III: BUREAUCRACY (Corporate & Legal)
    // =========================================================================
    {
        id: 'evt_bureau_audit',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Guild Authority Audit',
            description: '"Unidentified vessel, this is Guild Authority 44-Bravo. Heave to for a mandatory safety standard audit." You know the drill: pay the fee, suffer the delay, or cite the bylaws.'
        },
        choices: [
            {
                id: 'choice_bribe',
                text: 'Expedited Fee (-4% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_bribe' }] }
            },
            {
                id: 'choice_inspect',
                text: 'Full Inspection (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_inspect' }] }
            },
            {
                id: 'choice_bylaws',
                text: 'Cite Bylaws (Req: Trademaster)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_PERK, target: PERK_IDS.TRADEMASTER, operator: 'EQ', value: 1 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_bylaws' }] }
            }
        ],
        outcomes: {
            'out_bribe': {
                title: 'Fee Accepted',
                text: 'You transfer the fee. The inspector suddenly decides your ship looks visibly compliant.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.04 } }]
            },
            'out_inspect': {
                title: 'Bureaucratic Delay',
                text: 'They board you. They check every seal, delaying your journey considerably.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }]
            },
            'out_bylaws': {
                title: 'Inspection Waived',
                text: 'You transmit Guild Statute 12-C regarding "In-Transit Sovereignty." The inspector grumbles and moves on.',
                effects: []
            }
        }
    },
    {
        id: 'evt_bureau_tariff',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Corporate Tariff',
            description: 'Local Corporate Security has claimed this sector as a "Protectorate Zone." All commercial traffic must pay a tariff or divert.'
        },
        choices: [
            {
                id: 'choice_pay',
                text: 'Pay Tariff (-2% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_pay' }] }
            },
            {
                id: 'choice_divert',
                text: 'Divert (-Fuel & Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_divert' }] }
            },
            {
                id: 'choice_run',
                text: 'Run Blockade (Risk Fine)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_run_success', weight: 60 },
                        { outcomeId: 'out_run_fail', weight: 40 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_pay': {
                title: 'Tariff Paid',
                text: 'You pay the toll. It stings, but they grant you a coded squawk that clears your passage.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.02 } }]
            },
            'out_divert': {
                title: 'Detour Plotted',
                text: 'You plot a course through deep space, skirting the edge of their sensor net.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.20 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }
                ]
            },
            'out_run_success': {
                title: 'Blockade Runner',
                text: 'You run silent, masking your thermal signature. You slip through their net.',
                effects: []
            },
            'out_run_fail': {
                title: 'Violation Detected',
                text: 'A patrol drone tags you. "Toll violation detected." They garnish your accounts automatically.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.08 } }]
            }
        }
    },
    {
        id: 'evt_bureau_quarantine',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Contaminant Alert',
            description: 'An automated navigation buoy flags your ship. "Biological contaminant detected on outer hull. Sector access denied pending sterilization."'
        },
        choices: [
            {
                id: 'choice_service',
                text: 'Drone Service (-5% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_service' }] }
            },
            {
                id: 'choice_chem',
                text: 'Chemical Bath (-15 Propellant * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 }, 
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROPELLANT, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_chem' }] }
            },
            {
                id: 'choice_park',
                text: 'Solar Sterilization (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_park' }] }
            }
        ],
        outcomes: {
            'out_service': {
                title: 'Decon Complete',
                text: 'You pay for a remote drone service. It sprays your hull with harsh foam and clears your flag.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.05 } }]
            },
            'out_chem': {
                title: 'Chemical Scrub',
                text: 'You flush the hull with volatile Propellant. It strips the paint, but kills the mold.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROPELLANT, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }]
            },
            'out_park': {
                title: 'Solar Cleanse',
                text: 'You park the ship in a high-radiation orbit and wait for the UV light to kill the spores.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.25 } }]
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
            description: 'You receive a summons. A clerical error has flagged your Pilot\'s License as expired. Operating a heavy freighter without a license carries a hefty fine.'
        },
        choices: [
            {
                id: 'choice_lawyer',
                text: 'Auto-Lawyer (-3% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_lawyer' }] }
            },
            {
                id: 'choice_spoof',
                text: 'Data Spoof (-10 Processors * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_spoof' }] }
            },
            {
                id: 'choice_dispute',
                text: 'Dispute (Risk Fine & Trip Delay)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_dispute_success', weight: 40 }, // Hard legal battle
                        { outcomeId: 'out_dispute_fail', weight: 60 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_lawyer': {
                title: 'Case Dismissed',
                text: 'You hire a digital legal AI. It files an injunction and clears the error in milliseconds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.03 } }]
            },
            'out_spoof': {
                title: 'Records Falsified',
                text: 'You use Processors to brute-force a timestamp correction. The record now shows you renewed it yesterday.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }]
            },
            'out_dispute_success': {
                title: 'Appeal Granted',
                text: 'You argue your case with passion. The AI finds a precedent and dismisses the charge.',
                effects: []
            },
            'out_dispute_fail': {
                title: 'Appeal Denied',
                text: 'The lengthy arbitration process ends with the magistrate AI rejecting your appeal. You pay the reinstatement fee plus the late penalty.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }
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
                text: 'Bribe Commander (-15% Wealth)',
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
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.15 } }]
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
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.25 } },
                    { type: EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL, value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.20 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }
                ]
            },
            'out_turn_away': {
                title: 'Diverted Course',
                text: 'You begrudgingly alter course and burn extra fuel to find a detour, abandoning your original destination.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL, value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }
                ]
            }
        }
    }
];