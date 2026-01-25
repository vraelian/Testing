// js/data/events.js
/**
 * @fileoverview
 * Facade for Event System 2.0.
 * Aggregates modular event files into the master RANDOM_EVENTS registry.
 * This file should NOT contain actual event definitions.
 */

import { EVENTS_ENTROPY } from './events/events_entropy.js';
import { EVENTS_HAZARDS } from './events/events_hazards.js';
import { EVENTS_BUREAUCRACY } from './events/events_bureaucracy.js';
import { EVENTS_TRAFFIC } from './events/events_traffic.js';
import { EVENTS_LOGISTICS } from './events/events_logistics.js';
import { EVENTS_SALVAGE } from './events/events_salvage.js';
import { EVENTS_OPPORTUNITY } from './events/events_opportunity.js';
import { EVENTS_STORY } from './events/events_story.js';

export const RANDOM_EVENTS = [
    ...EVENTS_ENTROPY,
    ...EVENTS_HAZARDS,
    ...EVENTS_BUREAUCRACY,
    ...EVENTS_TRAFFIC,
    ...EVENTS_LOGISTICS,
    ...EVENTS_SALVAGE,
    ...EVENTS_OPPORTUNITY,
    ...EVENTS_STORY
];