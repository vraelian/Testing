// js/data/events.js
/**
 * @fileoverview
 * Defines the Registry and Schema for Event System 2.0.
 * * ARCHITECTURE NOTE:
 * This file contains the static definitions for all random events.
 * Logic is handled by the RandomEventService, ConditionEvaluator, and OutcomeResolver.
 * * SCHEMA DEFINITION:
 * @typedef {Object} GameEvent
 * @property {string} id - Unique identifier (e.g., 'evt_distress_signal').
 * @property {string[]} tags - Context tags from EVENT_CONSTANTS.TAGS.
 * @property {number} weight - Relative frequency (Default: 10). Higher = More common.
 * @property {EventCondition[]} requirements - List of conditions for the event to spawn.
 * @property {Object} template - Text content.
 * @property {string} template.title - Event title.
 * @property {string} template.description - Main flavor text.
 * @property {EventChoice[]} choices - List of player options.
 * * @typedef {Object} EventCondition
 * @property {string} type - From EVENT_CONSTANTS.CONDITIONS.
 * @property {string} [target] - ID of item/perk/stat being checked.
 * @property {string} operator - 'GT' (>), 'LT' (<), 'EQ' (==), 'GTE' (>=).
 * @property {number|string} value - The threshold value.
 * * @typedef {Object} EventChoice
 * @property {string} id - Unique choice ID (e.g., 'choice_help').
 * @property {string} text - Button text.
 * @property {string} [tooltip] - Hover text explaining risk/reward.
 * @property {EventCondition[]} [requirements] - If failing, choice is hidden/disabled.
 * @property {Object} resolution - How the outcome is determined.
 * @property {string} resolution.type - From EVENT_CONSTANTS.RESOLVERS.
 * @property {EventOutcomePool[]} resolution.pool - Possible results.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from './constants.js';

/**
 * The central registry of all possible random events.
 * @type {GameEvent[]}
 */
export const RANDOM_EVENTS = [
    // =========================================================================
    // CATEGORY I: ENTROPY (Mechanical Failures)
    // =========================================================================
    {
        id: 'evt_entropy_thermal',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Avionics Overheat',
            description: 'A jagged warning klaxon cuts through the bridge silence. The environmental scrubbers in the avionics bay have seized, and waste heat is building up rapidly in the flight computer core. The smell of ozone is already drifting through the vents.'
        },
        choices: [
            {
                id: 'choice_coolant',
                text: 'Flush with Coolant (-5 Water Ice)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.WATER_ICE, operator: 'GTE', value: 5 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_coolant_fix' }] }
            },
            {
                id: 'choice_vent',
                text: 'Emergency Venting (Hull Damage)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_vent_damage' }] }
            },
            {
                id: 'choice_shutdown',
                text: 'System Shutdown (Drift)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_shutdown_delay' }] }
            }
        ],
        outcomes: {
            'out_coolant_fix': {
                text: 'You manually override the coolant loops, crushing the blocks of Water Ice into the reservoir. The temperature graph plummets back to the green.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.WATER_ICE, value: 5 }]
            },
            'out_vent_damage': {
                text: 'You blow the emergency heat sinks. The superheated gas vents violently, warping the external plating near the exhaust port.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.10 } }]
            },
            'out_shutdown_delay': {
                text: 'You kill the main reactor. The ship drifts for days, radiating heat slowly into the black before it is safe to restart.',
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
            title: 'Injector Desync',
            description: 'A sickening vibration runs through the deck plates. The number three plasma injector is misfiring. You can swap it out, or try to retune it on the fly—but a bad tune could dump your fuel.'
        },
        choices: [
            {
                id: 'choice_replace',
                text: 'Replace Injector (-2 Plasteel)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: 2 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_replace' }] }
            },
            {
                id: 'choice_tune',
                text: 'Manual Recalibration (Risk Fuel)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_tune_success', weight: 60 },
                        { outcomeId: 'out_tune_fail', weight: 40 }
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
                text: 'The new Plasteel housing seats perfectly. The vibration vanishes.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 2 }]
            },
            'out_tune_success': {
                text: 'You wrestle with the magnetic field harmonics for hours. Finally, the waveform syncs up.',
                effects: []
            },
            'out_tune_fail': {
                text: 'You overcompensated the fuel mix. The vibration stops, but only because you are dumping raw plasma out the exhaust.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.15 } }]
            },
            'out_push_fail': {
                text: 'The vibration grows violent, rattling teeth and loosening bolts across the entire aft section.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.15 } }]
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
                text: 'Hardware Patch (-2 Processors)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 2 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_patch' }] }
            },
            {
                id: 'choice_reboot',
                text: 'Hard Reboot (Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_reboot' }] }
            },
            {
                id: 'choice_override',
                text: 'Manual Override (Risk Time)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_override_success', weight: 70 },
                        { outcomeId: 'out_override_fail', weight: 30 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_patch': {
                text: 'The extra compute power chews through the bad code in seconds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 }]
            },
            'out_reboot': {
                text: 'You pull the main breaker. When the OS reloads, you realize the ship has drifted off-vector.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.05 } }]
            },
            'out_override_success': {
                text: 'You bypass the safety protocols and force the last known trajectory. It works.',
                effects: []
            },
            'out_override_fail': {
                text: 'You forced a bad vector. By the time you realize the error, you have wasted days traveling in the wrong direction.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }]
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
                text: 'Reinforce (-5 Plasteel)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: 5 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_reinforce' }] }
            },
            {
                id: 'choice_slow',
                text: 'Reduce Acceleration (Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_slow' }] }
            },
            {
                id: 'choice_maintain',
                text: 'Maintain Velocity (Risk Hull)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_maintain_success', weight: 50 },
                        { outcomeId: 'out_maintain_fail', weight: 50 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_reinforce': {
                text: 'You weld Plasteel bracing over the affected area. It is an ugly patch, but stronger than the original.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 5 }]
            },
            'out_slow': {
                text: 'You dial back the engine thrust. The stress eases, but your arrival time slips further away.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }]
            },
            'out_maintain_success': {
                text: 'You watch the stress gauges for the entire trip. Miraculously, the metal groans but doesn\'t buckle.',
                effects: []
            },
            'out_maintain_fail': {
                text: 'A loud CRACK reverberates through the ship. A primary load-bearer snaps.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.20 } }]
            }
        }
    },

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
                text: 'Drift Through (Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_drift' }] }
            }
        ],
        outcomes: {
            'out_evade': {
                text: 'You slam the throttle forward, vectoring hard "up" relative to the ecliptic. It consumes fuel, but you clear the cloud.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.10 } }]
            },
            'out_tank': {
                text: 'It sounds like hail on a tin roof. Impacts pit the hull and shatter sensors.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.10 } }]
            },
            'out_drift': {
                text: 'You kill your velocity and gently drift through the widening gaps. It is safe, but agonizingly slow.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
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
                text: 'Harden Shields (-5 Plasteel)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: 5 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_harden' }] }
            },
            {
                id: 'choice_shadow',
                text: 'Seek Shadow (Delay)',
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
                text: 'You rig extra Plasteel plating over the emitter arrays. The radiation storm washes over you, but the interior remains safe.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 5 }]
            },
            'out_shadow': {
                text: 'You divert to a nearby asteroid. You wait there for days until the particle count drops.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }]
            },
            'out_run_success': {
                text: 'You pushed the engines to the redline and managed to stay just ahead of the worst wavefront.',
                effects: []
            },
            'out_run_fail': {
                text: 'Hard radiation pierces the cargo bay, ionizing a portion of your manifest.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.20 }]
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
                text: 'Orbital Decay (Delay)',
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
                text: 'You burn directly against the gravity vector. The engines scream, consuming reaction mass at a terrifying rate.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.15 } }]
            },
            'out_decay': {
                text: 'You surrender to the physics, letting the planet pull you into a long, elliptical orbit before flinging you back out.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_slingshot': {
                text: 'You dip deeper into the well, using the Oberth effect to steal momentum. You exit faster than you entered.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: -0.10 } }]
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
                text: 'Filter Signal (-2 Processors)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 2 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_filter' }] }
            },
            {
                id: 'choice_wait',
                text: 'All Stop (Delay)',
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
                text: 'The new Processors work overtime, filtering the noise from the data. The sensor picture snaps into focus.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 }]
            },
            'out_wait': {
                text: 'It is too dangerous. You cut velocity and wait for the magnetic storm to drift past.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.05 } }]
            },
            'out_blind_success': {
                text: 'You flew by feel and luck. The hull remains intact.',
                effects: []
            },
            'out_blind_fail': {
                text: 'You never saw it coming. A chunk of ice the size of a car slams into your prow.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.25 } }]
            }
        }
    },

    // =========================================================================
    // CATEGORY III: BUREAUCRACY (Corporate & Legal)
    // =========================================================================
    {
        id: 'evt_bureau_audit',
        tags: [EVENT_CONSTANTS.TAGS.SPACE, EVENT_CONSTANTS.TAGS.TRADE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Inspection Hail',
            description: '"Unidentified vessel, this is Guild Authority 44-Bravo. Heave to for a mandatory safety standard audit." You know the drill: pay the fee, suffer the delay, or cite the bylaws.'
        },
        choices: [
            {
                id: 'choice_bribe',
                text: 'Expedited Fee (-2% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_bribe' }] }
            },
            {
                id: 'choice_inspect',
                text: 'Full Inspection (Delay)',
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
                text: 'You transfer the fee. The inspector suddenly decides your ship looks visibly compliant.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.02 } }]
            },
            'out_inspect': {
                text: 'They board you. They check every seal. It takes a week.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }]
            },
            'out_bylaws': {
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
            title: 'Toll Road',
            description: 'The Martian Syndicate has claimed this sector as a "Protectorate Zone." All commercial traffic must pay a tariff or divert.'
        },
        choices: [
            {
                id: 'choice_pay',
                text: 'Pay Tariff (-1% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_pay' }] }
            },
            {
                id: 'choice_divert',
                text: 'Divert (-Fuel & Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_divert' }] }
            },
            {
                id: 'choice_run',
                text: 'Run Blockade (Risk Fine)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_run_success', weight: 50 },
                        { outcomeId: 'out_run_fail', weight: 50 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_pay': {
                text: 'You pay the toll. It stings, but they grant you a coded squawk that clears your passage.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.01 } }]
            },
            'out_divert': {
                text: 'You plot a course through deep space, skirting the edge of their sensor net.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.15 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } }
                ]
            },
            'out_run_success': {
                text: 'You run silent, masking your thermal signature. You slip through their net.',
                effects: []
            },
            'out_run_fail': {
                text: 'A patrol drone tags you. "Toll violation detected." They garnish your accounts automatically.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.04 } }]
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
                text: 'Drone Service (-3% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_service' }] }
            },
            {
                id: 'choice_chem',
                text: 'Chemical Bath (-5 Propellant)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROPELLANT, operator: 'GTE', value: 5 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_chem' }] }
            },
            {
                id: 'choice_park',
                text: 'Solar Sterilization (Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_park' }] }
            }
        ],
        outcomes: {
            'out_service': {
                text: 'You pay for a remote drone service. It sprays your hull with harsh foam and clears your flag.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.03 } }]
            },
            'out_chem': {
                text: 'You flush the hull with volatile Propellant. It strips the paint, but kills the mold.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROPELLANT, value: 5 }]
            },
            'out_park': {
                text: 'You park the ship in a high-radiation orbit and wait for the UV light to kill the spores.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.20 } }]
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
                text: 'Auto-Lawyer (-2% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_lawyer' }] }
            },
            {
                id: 'choice_spoof',
                text: 'Data Spoof (-2 Processors)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 2 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_spoof' }] }
            },
            {
                id: 'choice_dispute',
                text: 'Dispute (Risk Fine & Delay)',
                resolution: {
                    type: EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG,
                    pool: [
                        { outcomeId: 'out_dispute_success', weight: 40 },
                        { outcomeId: 'out_dispute_fail', weight: 60 }
                    ]
                }
            }
        ],
        outcomes: {
            'out_lawyer': {
                text: 'You hire a digital legal AI. It files an injunction and clears the error in milliseconds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.02 } }]
            },
            'out_spoof': {
                text: 'You use Processors to brute-force a timestamp correction. The record now shows you renewed it yesterday.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 }]
            },
            'out_dispute_success': {
                text: 'You argue your case with passion. The AI finds a precedent and dismisses the charge.',
                effects: []
            },
            'out_dispute_fail': {
                text: 'The magistrate AI rejects your appeal. You pay the reinstatement fee plus the late penalty.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.04 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.05 } }
                ]
            }
        }
    },

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
                text: 'Transfer Fuel (-10%)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_transfer' }] }
            },
            {
                id: 'choice_tow',
                text: 'Tow Service (-Fuel & Delay)',
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
                text: '"Thank you, captain. We don\'t have credits, but here is our scan data for the local market."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }
                ]
            },
            'out_tow': {
                text: 'You drag them to the nearest lane. The Guild pays a standard bounty for assisting distressed vessels.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.15 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.008 } }
                ]
            },
            'out_ignore': {
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
                text: 'Donate Water Ice (-5)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.WATER_ICE, operator: 'GTE', value: 5 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_donate_ice' }] }
            },
            {
                id: 'choice_donate_cyber',
                text: 'Donate Cybernetics (-2)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.CYBERNETICS, operator: 'GTE', value: 2 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_donate_cyber' }] }
            },
            {
                id: 'choice_dock',
                text: 'Dock & Assist (Delay)',
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
                text: '"Payment transferred. You saved a life today, captain."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.WATER_ICE, value: 5 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.015 } }
                ]
            },
            'out_donate_cyber': {
                text: '"Payment transferred. You saved a life today, captain."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.CYBERNETICS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.015 } }
                ]
            },
            'out_dock': {
                text: 'You help stabilize the patient personally. The liner\'s captain shares high-level encryption keys.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.05 } },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 2 }
                ]
            },
            'out_ignore': {
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
            title: 'Encrypted Hail',
            description: 'A stealth-corvette matches your velocity. "I have data on the upcoming market shifts. Guaranteed profitable. Interested?"'
        },
        choices: [
            {
                id: 'choice_buy',
                text: 'Buy Data (-1% Wealth)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_buy' }] }
            },
            {
                id: 'choice_barter',
                text: 'Barter (-2 Processors)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 2 }],
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
                text: 'You transfer the credits. A packet of market data floods your computer.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.01 } },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }
                ]
            },
            'out_barter': {
                text: 'You trade a few high-end chips for the data. "Pleasure doing business."',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }
                ]
            },
            'out_decline': {
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
                text: 'Draft Formation (Gain Fuel, Delay)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_draft' }] }
            },
            {
                id: 'choice_sell',
                text: 'Flash Sale (Lose Cargo, +Credits)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_CARGO_SPACE, operator: 'LT', value: 9999 }], // Hack to ensure we have cargo
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
                text: 'You tuck in behind the massive engine bells. Your fuel consumption drops to near zero, but you are limited to their speed.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: 0.10 } },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.10 } }
                ]
            },
            'out_sell': {
                text: 'You sell a portion of your cargo to the convoy crew. They pay a premium for the convenience.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.10 },
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.012 } }
                ]
            },
            'out_pass': {
                text: 'You overtake the slow convoy.',
                effects: []
            }
        }
    },

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
                text: 'Secure with Foam (-5 Plasteel)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PLASTEEL, operator: 'GTE', value: 5 }],
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
                text: 'You spray industrial foam into the clamp mechanism. It hardens instantly, welding the pod to the frame.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 5 }]
            },
            'out_jettison': {
                text: 'You blow the emergency bolts. The pod tumbles away into the dark.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.10 }]
            },
            'out_hold_success': {
                text: 'The clamps groan and spark, but they hold for the duration.',
                effects: []
            },
            'out_hold_fail': {
                text: 'The clamp fails. The pod shears off, ripping through the dorsal plating.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.20 } },
                    { type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.25 }
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
                text: 'Add Coolant (-5 Water Ice)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.WATER_ICE, operator: 'GTE', value: 5 }],
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
                text: 'You feed Water Ice into the heat exchanger. The temp drops back to safe levels.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.WATER_ICE, value: 5 }]
            },
            'out_power': {
                text: 'You divert main engine power to the cryo-units. Your engines run inefficiently.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.10 } }]
            },
            'out_vent': {
                text: 'You open the airlock, flash-freezing the cargo. Some is sucked out, but the rest is saved.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.05 }]
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
                text: 'EVA Re-Stack (Delay)',
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
                text: 'You spend a day in zero-G, manually winching containers back into place.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.05 } }]
            },
            'out_thrust': {
                text: 'You let the thrusters fight the wobble. They fire constantly to keep the ship straight.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL, value: { scaleWith: 'MAX_FUEL', factor: -0.15 } }]
            },
            'out_ignore': {
                text: 'The constant oscillation stresses the ship\'s frame until rivets start popping.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.10 } }]
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
                text: 'Fumigate (-5 Propellant)',
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROPELLANT, operator: 'GTE', value: 5 }],
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_fumigate' }] }
            },
            {
                id: 'choice_vac',
                text: 'Vacuum Sterilize (Lose Cargo)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_vac' }] }
            },
            {
                id: 'choice_ignore',
                text: 'Ignore (Lose More)',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_ignore' }] }
            }
        ],
        outcomes: {
            'out_fumigate': {
                text: 'You flood the hold with toxic Propellant vapor. It kills the bloom instantly.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROPELLANT, value: 5 }]
            },
            'out_vac': {
                text: 'You vent the atmosphere. The sudden pressure drop ruptures some containers.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.05 }]
            },
            'out_ignore': {
                text: 'By the time you arrive, a quarter of the shipment is covered in green slime.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO, value: 0.25 }]
            }
        }
    },

    // =========================================================================
    // CATEGORY VI: SALVAGE (Discovery & Opportunity)
    // =========================================================================
    {
        id: 'evt_salvage_probe',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Silent Signal',
            description: 'You spot a dark object tumbling in orbit. It\'s a pre-war survey probe. It might have valuable components, or unexploded ordnance.'
        },
        choices: [
            {
                id: 'choice_scavenge',
                text: 'Scavenge (Req: 5 Space)',
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
                text: 'You grapple the probe and strip it for parts. High-grade electronics!',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 3 }]
            },
            'out_scavenge_fail': {
                text: 'A self-destruct charge triggers as you touch it. The explosion rocks your ship.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.10 } }]
            },
            'out_logs': {
                text: 'You recover some old stellar charts from the corrupted memory core.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL, value: 1 }]
            },
            'out_leave': {
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
                text: 'Grapple (Req: 10 Space)',
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
                requirements: [{ type: EVENT_CONSTANTS.CONDITIONS.HAS_ITEM, target: COMMODITY_IDS.PROCESSORS, operator: 'GTE', value: 2 }],
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
                text: 'You bring it aboard. It is full of legitimate trade goods!',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO, value: 10 }]
            },
            'out_grapple_fail': {
                text: 'You bring it aboard. It is full of industrial sludge. You have to pay a disposal fee.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.02 } }]
            },
            'out_scan': {
                text: 'You burn high-end sensors to peer inside. It reveals valid cargo, which you collect safely.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO, value: 10 }
                ]
            },
            'out_ignore': {
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
                text: 'Harvest Scrap (+Time, +Plasteel)',
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
                text: 'You spend a few hours collecting hull plates. Boring, but profitable.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.05 } },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PLASTEEL, value: 5 }
                ]
            },
            'out_deep_success': {
                text: 'You find a surviving computer core and some intact cybernetics.',
                effects: [
                    { type: EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL, value: { scaleWith: 'TRIP_DURATION', factor: 0.15 } },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.CYBERNETICS, value: 2 },
                    { type: EVENT_CONSTANTS.EFFECTS.ADD_ITEM, target: COMMODITY_IDS.PROCESSORS, value: 2 }
                ]
            },
            'out_deep_fail': {
                text: 'A piece of debris you didn\'t see slams into your engine bell.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_HULL, value: { scaleWith: 'MAX_HULL', factor: -0.10 } }]
            },
            'out_pass': {
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
            title: 'Ghost Signal',
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
                text: 'It is a dead drop from the last war. You crack the code and find a stash of credits.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: 0.005 } }]
            },
            'out_investigate_fail': {
                text: 'As soon as you link up, a virus uploads itself to your finance computer and siphons funds.',
                effects: [{ type: EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS, value: { scaleWith: 'PLAYER_CREDITS', factor: -0.02 } }]
            },
            'out_nav': {
                text: 'Your advanced sensors flag the signal as a known malware signature. You mark it for deletion and move on.',
                effects: []
            },
            'out_ignore': {
                text: 'Not worth the risk.',
                effects: []
            }
        }
    }
];