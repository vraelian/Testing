/**
 * @fileoverview
 * Event Category: TRAFFIC
 * Focus: Ship-to-ship encounters, distress signals, and trade convoys.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_TRAFFIC = [
    // =========================================================================
    // CATEGORY IV: TRAFFIC (Encounters & Distress)
    // =========================================================================
    {
        id: 'evt_traffic_stranded',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Mayday',
            description: 'A beat-up hauler hails you. "Reactor is dry. Life support is failing. Can you spare some reaction mass?"'
        },
        choices: [
            {
                id: 'choice_transfer',
                text: 'Transfer Fuel (-20% Fuel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_transfer' }] }
            },
            {
                id: 'choice_tow',
                text: 'Tow Service (-Fuel & Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_tow' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_transfer': {
                title: 'Fuel Transferred',
                text: '"Thank you, captain. We don\'t have credits, but here is our scan data for the local market."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.20 } },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }
                ]
            },
            'out_tow': {
                title: 'Vessel Recovered',
                text: 'You drag them to the nearest lane. The Guild pays a standard bounty for assisting distressed vessels.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.25 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.015 } }
                ]
            },
            'out_ignore': {
                title: 'Hail Ignored',
                text: 'You cut the comms. Their signal fades behind you.',
                effects: []
            }
        }
    },
    {
        id: 'evt_traffic_medical',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Critical Patient',
            description: 'A luxury liner broadcasts a pan-pan. "We have a critical patient and our med-bay is malfunctioning. Requesting immediate medical supplies."'
        },
        choices: [
            {
                id: 'choice_donate_ice',
                text: 'Donate Water Ice (-15 Ice * Scale)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.WATER_ICE, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_donate_ice' }] }
            },
            {
                id: 'choice_donate_cyber',
                text: 'Donate Cybernetics (-2 Cybernetics)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 2 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.CYBERNETICS, operator: 'GTE', value: 2 }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_donate_cyber' }] }
            },
            {
                id: 'choice_dock',
                text: 'Dock & Assist (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_dock' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_donate_ice': {
                title: 'Patient Stabilized',
                text: '"Payment transferred. You saved a life today, captain."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.WATER_ICE, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.03 } }
                ]
            },
            'out_donate_cyber': {
                title: 'Systems Restored',
                text: '"Payment transferred. You saved a life today, captain."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.CYBERNETICS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.03 } }
                ]
            },
            'out_dock': {
                title: 'Medical Assistance',
                text: 'You help stabilize the patient personally. The liner\'s captain shares high-level encryption keys.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 2 }
                ]
            },
            'out_ignore': {
                title: 'Broadcast Ignored',
                text: 'You fly past.',
                effects: []
            }
        }
    },
    {
        id: 'evt_traffic_broker',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Syndicate Broker',
            description: 'A sleek Syndicate interceptor matches your velocity. "I have data on the upcoming market shifts. Guaranteed profitable. Interested?"'
        },
        choices: [
            {
                id: 'choice_buy',
                text: 'Buy Data (-2% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_buy' }] }
            },
            {
                id: 'choice_barter',
                text: 'Barter (-5 Processors)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 5 }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_barter' }] }
            },
            {
                id: 'choice_decline',
                text: 'Decline',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_decline' }] }
            }
        ],
        outcomes: {
            'out_buy': {
                title: 'Data Acquired',
                text: 'You transfer the credits. A packet of market data floods your computer.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.02 } },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }
                ]
            },
            'out_barter': {
                title: 'Exchange Complete',
                text: 'You trade a few high-end chips for the data. "Pleasure doing business."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 5 },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }
                ]
            },
            'out_decline': {
                title: 'Connection Closed',
                text: 'The corvette vanishes into the black.',
                effects: []
            }
        }
    },
    {
        id: 'evt_traffic_convoy',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'The Train',
            description: 'You encounter a massive corporate heavy-freight convoy. You could draft behind them to save fuel, or sell goods to their crews.'
        },
        choices: [
            {
                id: 'choice_draft',
                text: 'Draft Formation (Gain Fuel, Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_draft' }] }
            },
            {
                id: 'choice_sell',
                text: 'Flash Sale (Lose Cargo, +Credits)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'LT', value: 9999 }], 
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_sell' }] }
            },
            {
                id: 'choice_pass',
                text: 'Fly Past',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_pass' }] }
            }
        ],
        outcomes: {
            'out_draft': {
                title: 'Slipstream Entered',
                text: 'You tuck in behind the massive engine bells. Your fuel consumption drops to near zero, but you are limited to their speed.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: 0.15 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }
                ]
            },
            'out_sell': {
                title: 'Transaction Complete',
                text: 'You sell a portion of your cargo to the convoy crew. They pay a premium for the convenience.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.15 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.02 } }
                ]
            },
            'out_pass': {
                title: 'Overtaking',
                text: 'You overtake the slow convoy.',
                effects: []
            }
        }
    }
];