// js/data/events/events_hazards.js
/**
 * @fileoverview
 * Event Category: HAZARDS
 * Focus: Navigational threats, environmental dangers, and celestial phenomena.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_HAZARDS = [
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
                text: 'You divert to a nearby asteroid. You wait in its shadow until the particle count drops.',
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
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, isCurrentPercent: true, value: 35 }]
            }
        }
    },
    {
        id: 'evt_hazard_gravity',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [
            { type: EVENT_CONSTANTS.CONDITIONS.LOCATION_IS, operator: 'IN', value: ['loc_earth', 'loc_mars', 'loc_venus', 'loc_pluto'] }
        ],
        template: {
            title: 'The Gravity Well',
            description: 'Navigational thrusters misfire during orbital departure, dragging your vector dangerously close to the atmosphere.'
        },
        choices: [
            {
                id: 'choice_burn',
                text: 'Deep Burn (Massive Fuel Drain)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_burn' }] }
            },
            {
                id: 'choice_arrestor',
                text: 'Emergency Arrestor Catch (Return to Origin, Extreme Damage)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_arrestor' }] }
            }
        ],
        outcomes: {
            'out_burn': {
                title: 'Orbit Corrected',
                text: 'You burn directly against the gravity vector. The engines scream, consuming your reserves at a terrifying rate, but you break free.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, isCurrentPercent: true, value: -90 }]
            },
            'out_arrestor': {
                title: 'Travel Aborted',
                text: 'You deploy the emergency atmospheric arrestors. The ship violently decelerates, ripping hull plates away, and falls back into the origin port.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL, value: 1 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -85 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, isCurrentPercent: true, value: -10 }
                ]
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
            description: 'You enter a dense region of polarized cosmic dust. Abrasive particulate causes static buildup, blinding lidar and collision warnings.'
        },
        choices: [
            {
                id: 'choice_fly',
                text: 'Fly by Telemetry (High Risk, High Reward)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_fly_success', weight: 30 },
                        { outcomeId: 'out_fly_fail', weight: 70 }
                    ]
                }
            },
            {
                id: 'choice_wait',
                text: 'Hold Position & Wait (Time Delay, Fuel Burn)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_wait' }] }
            }
        ],
        outcomes: {
            'out_fly_success': {
                title: 'Clear Vector',
                text: 'Trusting your instruments pays off. You ride the magnetic currents out of the dust cloud, cutting your travel time significantly.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: -50 }]
            },
            'out_fly_fail': {
                title: 'Collision Alert',
                text: 'You never saw it coming. A chunk of debris slams into your prow, damaging sensors and severely delaying your journey.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -50 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 30 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_nav_glitch', value: 1 }
                ]
            },
            'out_wait': {
                title: 'Storm Waited Out',
                text: 'It is too dangerous. You hold position and burn fuel to maintain orientation until the cloud disperses.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 20 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, isCurrentPercent: true, value: -10 }
                ]
            }
        }
    },
    {
        id: 'evt_hazard_kessler',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.HAZARD],
        weight: 8,
        requirements: [],
        template: {
            title: 'Kessler Survivor',
            description: 'A massive cloud of hyper-velocity micro-debris completely blocks the transit vector.'
        },
        choices: [
            {
                id: 'choice_crawl',
                text: 'Crawl Through (Time Delay, Minor Damage)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_crawl' }] }
            },
            {
                id: 'choice_gun',
                text: 'Gun It (Severe Damage, Gain Status)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_gun' }] }
            }
        ],
        outcomes: {
            'out_crawl': {
                title: 'Navigated Safely',
                text: 'You drop to maneuvering thrusters and painstakingly weave through the shrapnel. It takes time, and your hull still takes a beating.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -15 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, isCurrentPercent: true, value: 20 },
                    { type: EVENT_CONSTANTS.EFFECTS.QUEUE_EVENT, target: 'evt_kessler_mechanic', value: 0 } 
                ]
            },
            'out_gun': {
                title: 'Punched Through',
                text: 'You hit the thrusters and blast through the debris field. You save time, but the micro-impacts severely compromise your hull integrity.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, isCurrentPercent: true, value: -25 },
                    { type: EVENT_CONSTANTS.EFFECTS.APPLY_STATUS, target: 'status_micro_fractures', value: 1 }
                ]
            }
        }
    },
    {
        id: 'evt_kessler_mechanic',
        tags: [],
        weight: 0,
        requirements: [],
        template: {
            title: 'Shipyard Inspection',
            description: 'A shipyard mechanic inspects the micro-pitting on your hull from your recent encounter with the Kessler debris.'
        },
        choices: [
            {
                id: 'choice_accept',
                text: 'Accept Prototype Armor',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_accept_t2', weight: 50 },
                        { outcomeId: 'out_accept_t3', weight: 50 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_accept_t2': {
                title: 'Armor Upgraded',
                text: '"I\'ve never seen pitting quite like this," she mutters. "Let me test a new reinforcement alloy on your ship. It\'s on the house."',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE, target: 'UPG_UTIL_HULL_2', value: 1 }]
            },
            'out_accept_t3': {
                title: 'Armor Upgraded',
                text: '"I\'ve never seen pitting quite like this," she mutters. "Let me test a new reinforcement alloy on your ship. It\'s on the house."',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE, target: 'UPG_UTIL_HULL_3', value: 1 }]
            }
        }
    }
];