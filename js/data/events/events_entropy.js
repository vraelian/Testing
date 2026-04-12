// js/data/events/events_entropy.js
/**
 * @fileoverview
 * Event Category: ENTROPY
 * Focus: Mechanical failures, system glitches, and wear-and-tear.
 * UPDATED: Thermal Overload (Sacrifice Scenario), Injector Misfire (Rebalanced Legacy).
 * [[ERROR FIX]]: Purged evt_entropy_structure permanently.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_ENTROPY = [
    {
        id: 'evt_entropy_thermal',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Thermal Overload',
            description: 'A primary thermal scrubber seizes mid-transit. Core heat is spiking to lethal levels, threatening to cook the crew.'
        },
        choices: [
            {
                id: 'choice_vent',
                text: 'Vent Cargo Bay (Purge Assorted Goods)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_vent' }] }
            },
            {
                id: 'choice_override',
                text: 'Override Safeties (Severe Hull Damage)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_override' }] }
            }
        ],
        outcomes: {
            'out_vent': {
                title: 'Cargo Purged',
                text: 'You blow the bay doors, using the vacuum to flash-freeze the section. Half your cargo is sucked into the void.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, isCurrentPercent: true, value: 50 }]
            },
            'out_override': {
                title: 'Heat Damage',
                text: 'You override the safety interlocks and let the heat bleed into the hull plating. The metal warps and blisters.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -45 }]
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
            description: 'A violent stutter reverberates through the deck. Diagnostics show the primary plasma injector is choking on slag buildup, threatening to starve the engine.'
        },
        choices: [
            {
                id: 'choice_recalibrate',
                text: 'Attempt Recalibration (High Risk, High Reward)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_recalibrate_success', weight: 50 },
                        { outcomeId: 'out_recalibrate_fail', weight: 50 }
                    ]
                }
            },
            {
                id: 'choice_push',
                text: 'Push the Engine (Hull Damage, Gain Status)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_push' }] }
            }
        ],
        outcomes: {
            'out_recalibrate_success': {
                title: 'Harmonics Aligned',
                text: 'You perfectly balance the plasma flow. The engine runs so cleanly that your fuel tanks are essentially topped off for the rest of the jump.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.FULL_REFUEL, value: 1 }]
            },
            'out_recalibrate_fail': {
                title: 'Total Fuel Dump',
                text: 'The recalibration fails catastrophically, forcing an emergency dump of all remaining plasma to prevent an explosion.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, isCurrentPercent: true, value: -100 }]
            },
            'out_push': {
                title: 'Structural Stress',
                text: 'You force the engine to keep firing through the stutter. The vibration causes severe hull damage and tears a seal in the fuel line.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -20 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_plasma_leak', value: 1 }
                ]
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
    }
];