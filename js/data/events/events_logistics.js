/**
 * @fileoverview
 * Event Category: LOGISTICS
 * Focus: Cargo management, storage failures, and spoilage.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_LOGISTICS = [
    // =========================================================================
    // CATEGORY V: LOGISTICS (Cargo & Storage)
    // =========================================================================
    {
        id: 'evt_logistics_containment',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'LT', value: 9999 }],
        template: {
            title: 'Mag-Lock Failure',
            description: 'A cargo pod is vibrating loose. If you don\'t secure it, it will tear itself free—and might take a chunk of the hull with it.'
        },
        choices: [
            {
                id: 'choice_foam',
                text: 'Secure with Foam (-5 Plasteel * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 1 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 5 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_foam' }] }
            },
            {
                id: 'choice_jettison',
                text: 'Jettison Pod (Lose Cargo)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_jettison' }] }
            },
            {
                id: 'choice_hold',
                text: 'Hold it Together (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_hold_success', weight: 70 },
                        { outcomeId: 'out_hold_fail', weight: 30 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_foam': {
                title: 'Cargo Secured',
                text: 'You spray industrial foam into the clamp mechanism. It hardens instantly, welding the pod to the frame.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 5 } }]
            },
            'out_jettison': {
                title: 'Cargo Ejected',
                text: 'You blow the emergency bolts. The pod tumbles away into the dark.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.15 }]
            },
            'out_hold_success': {
                title: 'Locks Holding',
                text: 'The clamps groan and spark, but they hold for the duration.',
                effects: []
            },
            'out_hold_fail': {
                title: 'Containment Breach',
                text: 'The clamp fails. The pod shears off, ripping through the dorsal plating.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.25 } },
                    { type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.30 }
                ]
            }
        }
    },
    {
        id: 'evt_logistics_spoilage',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'LT', value: 9999 }],
        template: {
            title: 'Temp Rising',
            description: 'The refrigeration unit in Bay 4 is dying. Your perishable cargo will rot if you don\'t act fast.'
        },
        choices: [
            {
                id: 'choice_ice',
                text: 'Add Coolant (-15 Ice * Scale)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.WATER_ICE, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ice' }] }
            },
            {
                id: 'choice_power',
                text: 'Power Boost (-Fuel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_power' }] }
            },
            {
                id: 'choice_vent',
                text: 'Vent to Vacuum (Lose Cargo)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_vent' }] }
            }
        ],
        outcomes: {
            'out_ice': {
                title: 'Temp Stabilized',
                text: 'You feed Water Ice into the heat exchanger. The temp drops back to safe levels.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.WATER_ICE, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }]
            },
            'out_power': {
                title: 'Power Diverted',
                text: 'You divert main engine power to the cryo-units. Your engines run inefficiently.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.20 } }]
            },
            'out_vent': {
                title: 'Partial Loss',
                text: 'You open the airlock, flash-freezing the cargo. Some is sucked out, but the rest is saved.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.10 }]
            }
        }
    },
    {
        id: 'evt_logistics_shift',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.HAZARD],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'LT', value: 9999 }],
        template: {
            title: 'Imbalance',
            description: 'A hard maneuver caused the cargo to shift. The ship\'s center of mass is off, causing a dangerous wobble.'
        },
        choices: [
            {
                id: 'choice_restack',
                text: 'EVA Re-Stack (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_restack' }] }
            },
            {
                id: 'choice_thrust',
                text: 'Thrust Compensation (-Fuel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_thrust' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore (-Hull)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_restack': {
                title: 'Cargo Secured',
                text: 'You spend a day in zero-G, manually winching containers back into place.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_thrust': {
                title: 'Thrusters Compensating',
                text: 'You let the thrusters fight the wobble. They fire constantly to keep the ship straight.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.25 } }]
            },
            'out_ignore': {
                title: 'Structural Stress',
                text: 'The constant oscillation stresses the ship\'s frame until rivets start popping.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.20 } }]
            }
        }
    },
    {
        id: 'evt_logistics_bloom',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'LT', value: 9999 }],
        template: {
            title: 'The Bloom',
            description: 'Humidity sensors detect a rapid algal bloom in the cargo hold. It is eating the packaging and will soon eat the cargo.'
        },
        choices: [
            {
                id: 'choice_fumigate',
                text: 'Fumigate (-15 Propellant * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROPELLANT, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_fumigate' }] }
            },
            {
                id: 'choice_vac',
                text: 'Vacuum Sterilize (Lose Cargo)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_vac' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore (Lose More Cargo)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_fumigate': {
                title: 'Sterilization Complete',
                text: 'You flood the hold with toxic Propellant vapor. It kills the bloom instantly.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROPELLANT, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }]
            },
            'out_vac': {
                title: 'Vacuum Exposure',
                text: 'You vent the atmosphere. The sudden pressure drop ruptures some containers.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.15 }]
            },
            'out_ignore': {
                title: 'Cargo Spoiled',
                text: 'By the time you arrive, a quarter of the shipment is covered in green slime.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.35 }]
            }
        }
    }
];