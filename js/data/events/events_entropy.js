// js/data/events/events_entropy.js
/**
 * @fileoverview
 * Event Category: ENTROPY
 * Focus: Mechanical failures, system glitches, and wear-and-tear.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_ENTROPY = [
    // =========================================================================
    // CATEGORY I: ENTROPY (Mechanical Failures)
    // =========================================================================
    {
        id: 'evt_entropy_thermal',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Thermal Runaway',
            description: 'A jagged warning klaxon cuts through the bridge silence. The environmental scrubbers in the avionics bay have seized, and waste heat is building up rapidly. The smell of ozone is already drifting through the vents.'
        },
        choices: [
            {
                id: 'choice_coolant',
                text: 'Flush with Coolant (-15 Ice * Scale)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.WATER_ICE, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_coolant_fix' }] }
            },
            {
                id: 'choice_vent',
                text: 'Emergency Venting (Significant Hull Dmg)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_vent_damage' }] }
            },
            {
                id: 'choice_shutdown',
                text: 'System Shutdown (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_shutdown_delay' }] }
            }
        ],
        outcomes: {
            'out_coolant_fix': {
                title: 'Systems Stabilized',
                text: 'You manually override the coolant loops, crushing the blocks of Water Ice into the reservoir. The temperature graph plummets back to the green.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.WATER_ICE, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 15 } }]
            },
            'out_vent_damage': {
                title: 'Emergency Venting',
                text: 'You blow the emergency heat sinks. The superheated gas vents violently, warping the external plating near the exhaust port.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.25 } }]
            },
            'out_shutdown_delay': {
                title: 'Reboot Sequence',
                text: 'You kill the main reactor. The ship drifts for an extended period, radiating heat slowly into the black before it is safe to restart.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }]
            }
        }
    },
    {
        id: 'evt_entropy_injector',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Injector Misfire',
            description: 'A sickening vibration runs through the deck plates. The number three plasma injector is misfiring. You can swap it out, or try to retune it on the fly—but a bad tune could dump your fuel.'
        },
        choices: [
            {
                id: 'choice_replace',
                text: 'Replace Injector (-5 Plasteel * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 1 }, 
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 5 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_replace' }] }
            },
            {
                id: 'choice_tune',
                text: 'Manual Recalibration (Risk Fuel)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_tune_success', weight: 70 },
                        { outcomeId: 'out_tune_fail', weight: 30 }
                    ]
                }
            },
            {
                id: 'choice_push',
                text: 'Push It (Hull Damage)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_push_fail' }] }
            }
        ],
        outcomes: {
            'out_replace': {
                title: 'Maintenance Complete',
                text: 'The new Plasteel housing seats perfectly. The vibration vanishes.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 5 } }]
            },
            'out_tune_success': {
                title: 'Harmonics Aligned',
                text: 'You wrestle with the magnetic field harmonics for hours. Finally, the waveform syncs up.',
                effects: []
            },
            'out_tune_fail': {
                title: 'Fuel Dump',
                text: 'You overcompensated the fuel mix. The vibration stops, but only because you are dumping raw plasma out the exhaust.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.25 } }]
            },
            'out_push_fail': {
                title: 'Structural Stress',
                text: 'The vibration grows violent, rattling teeth and loosening bolts across the entire aft section.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.30 } }]
            }
        }
    },
    {
        id: 'evt_entropy_software',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Logic Loop',
            description: 'The navigation console freezes. A legacy code fragment has triggered a recursive loop in the astrogation buffer. You need high-end hardware to brute-force a solution, or you have to pull the plug.'
        },
        choices: [
            {
                id: 'choice_hardware',
                text: 'Hardware Patch (-10 Processors * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_patch' }] }
            },
            {
                id: 'choice_reboot',
                text: 'Hard Reboot (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_reboot' }] }
            },
            {
                id: 'choice_override',
                text: 'Manual Override (Risk Trip Delay)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_override_success', weight: 80 },
                        { outcomeId: 'out_override_fail', weight: 20 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_patch': {
                title: 'System Restored',
                text: 'The extra compute power chews through the bad code in seconds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }]
            },
            'out_reboot': {
                title: 'Reboot Complete',
                text: 'You pull the main breaker. When the OS reloads, you realize the ship has drifted off-vector.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_override_success': {
                title: 'Override Successful',
                text: 'You bypass the safety protocols and force the last known trajectory. It works.',
                effects: []
            },
            'out_override_fail': {
                title: 'Navigational Error',
                text: 'You forced a bad vector. By the time you realize the error, you have wasted precious time traveling in the wrong direction.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.35 } }]
            }
        }
    },
    {
        id: 'evt_entropy_structure',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.HAZARD],
        weight: 10,
        requirements: [],
        template: {
            title: 'Micro-Fractures',
            description: 'Sensors report a web of micro-fractures spreading along the dorsal cargo spine. If you don\'t reinforce it or slow down, the ship could snap under the G-load.'
        },
        choices: [
            {
                id: 'choice_reinforce',
                text: 'Reinforce (-10 Plasteel * Scale)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_reinforce' }] }
            },
            {
                id: 'choice_slow',
                text: 'Reduce Acceleration (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_slow' }] }
            },
            {
                id: 'choice_maintain',
                text: 'Maintain Velocity (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_maintain_success', weight: 60 },
                        { outcomeId: 'out_maintain_fail', weight: 40 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_reinforce': {
                title: 'Hull Reinforced',
                text: 'You weld Plasteel bracing over the affected area. It is an ugly patch, but stronger than the original.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }]
            },
            'out_slow': {
                title: 'Velocity Reduced',
                text: 'You dial back the engine thrust. The stress eases, but your arrival time slips further away.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }]
            },
            'out_maintain_success': {
                title: 'Holding Together',
                text: 'You watch the stress gauges for the entire trip. Miraculously, the metal groans but doesn\'t buckle.',
                effects: []
            },
            'out_maintain_fail': {
                title: 'Structural Failure',
                text: 'A loud CRACK reverberates through the ship. A primary load-bearer snaps.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.40 } }]
            }
        }
    }
];