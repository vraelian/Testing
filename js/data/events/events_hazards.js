/**
 * @fileoverview
 * Event Category: HAZARDS
 * Focus: Navigational threats, environmental dangers, and celestial phenomena.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_HAZARDS = [
    // =========================================================================
    // CATEGORY II: HAZARDS (Navigational Threats)
    // =========================================================================
    {
        id: 'evt_hazard_meteoroid',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.HAZARD],
        weight: 10,
        requirements: [],
        template: {
            title: 'Debris Field',
            description: 'Long-range radar paints a cloud of "gravel" directly in your path—remnants of a collision moving at 15 km/s. You can burn hard to go around, or shield up and tank it.'
        },
        choices: [
            {
                id: 'choice_evade',
                text: 'Evasive Maneuvers (-Fuel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_evade' }] }
            },
            {
                id: 'choice_tank',
                text: 'Brace for Impact (-Hull)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_tank' }] }
            },
            {
                id: 'choice_drift',
                text: 'Drift Through (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_drift' }] }
            }
        ],
        outcomes: {
            'out_evade': {
                title: 'Evasion Successful',
                text: 'You slam the throttle forward, vectoring hard "up" relative to the ecliptic. It consumes fuel, but you clear the cloud.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.15 } }]
            },
            'out_tank': {
                title: 'Impact Sustained',
                text: 'It sounds like hail on a tin roof. Impacts pit the hull and shatter sensors.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.15 } }]
            },
            'out_drift': {
                title: 'Navigation Complete',
                text: 'You kill your velocity and gently drift through the widening gaps. It is safe, but agonizingly slow.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }]
            }
        }
    },
    {
        id: 'evt_hazard_flare',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Coronal Mass Ejection',
            description: 'The radiation alarm screams. A massive solar flare has erupted. You need to harden the ship or find cover immediately.'
        },
        choices: [
            {
                id: 'choice_harden',
                text: 'Harden Shields (-10 Plasteel * Scale)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_harden' }] }
            },
            {
                id: 'choice_shadow',
                text: 'Seek Shadow (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_shadow' }] }
            },
            {
                id: 'choice_run',
                text: 'Run Silent (Risk Cargo)',
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
            'out_harden': {
                title: 'Shields Holding',
                text: 'You rig extra Plasteel plating over the emitter arrays. The radiation storm washes over you, but the interior remains safe.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }]
            },
            'out_shadow': {
                title: 'Storm Passed',
                text: 'You divert to a nearby asteroid. You wait there for days until the particle count drops.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }]
            },
            'out_run_success': {
                title: 'Outrun',
                text: 'You pushed the engines to the redline and managed to stay just ahead of the worst wavefront.',
                effects: []
            },
            'out_run_fail': {
                title: 'Radiation Leak',
                text: 'Hard radiation pierces the cargo bay, ionizing a portion of your manifest.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.35 }]
            }
        }
    },
    {
        id: 'evt_hazard_gravity',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Gravity Well',
            description: 'A navigational error brought you too close to a gas giant\'s gravity well. The tidal forces are dragging you off course.'
        },
        choices: [
            {
                id: 'choice_burn',
                text: 'Corrective Burn (-Fuel)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_burn' }] }
            },
            {
                id: 'choice_decay',
                text: 'Orbital Decay (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_decay' }] }
            },
            {
                id: 'choice_slingshot',
                text: 'Slingshot (Req: Navigator)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_PERK, target: PERK_IDS.NAVIGATOR, operator: 'EQ', value: 1 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_slingshot' }] }
            }
        ],
        outcomes: {
            'out_burn': {
                title: 'Orbit Corrected',
                text: 'You burn directly against the gravity vector. The engines scream, consuming reaction mass at a terrifying rate.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.25 } }]
            },
            'out_decay': {
                title: 'Decay & Recovery',
                text: 'You surrender to the physics, letting the planet pull you into a long, elliptical orbit before flinging you back out.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }]
            },
            'out_slingshot': {
                title: 'Gravity Assist',
                text: 'You dip deeper into the well, using the Oberth effect to steal momentum. You exit faster than you entered.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: -0.15 } }]
            }
        }
    },
    {
        id: 'evt_hazard_magnetic',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Sensor Blindness',
            description: 'You\'ve entered a region of intense magnetic flux. The lidar is whited out. You can try to filter the signal with high-end hardware or wait it out.'
        },
        choices: [
            {
                id: 'choice_filter',
                text: 'Filter Signal (-10 Processors * Scale)',
                requirements: [
                    { type: EVENT_CONSTANTS.CONDITIONS.WEALTH_TIER, operator: 'GTE', value: 3 },
                    { type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }
                ],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_filter' }] }
            },
            {
                id: 'choice_wait',
                text: 'All Stop (Trip Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_wait' }] }
            },
            {
                id: 'choice_blind',
                text: 'Fly Blind (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_blind_success', weight: 70 },
                        { outcomeId: 'out_blind_fail', weight: 30 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_filter': {
                title: 'Signal Clear',
                text: 'The new Processors work overtime, filtering the noise from the data. The sensor picture snaps into focus.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: { base: 0, scaleWith: 'SHIP_CLASS_SCALAR', factor: 10 } }]
            },
            'out_wait': {
                title: 'Storm Waited Out',
                text: 'It is too dangerous. You cut velocity and wait for the magnetic storm to drift past.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_blind_success': {
                title: 'Pure Luck',
                text: 'You flew by feel and luck. The hull remains intact.',
                effects: []
            },
            'out_blind_fail': {
                title: 'Collision Alert',
                text: 'You never saw it coming. A chunk of ice the size of a car slams into your prow.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.30 } }]
            }
        }
    }
];