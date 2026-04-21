// js/data/events/storyEventsRegistry.js
/**
 * @fileoverview
 * Registry for deterministic, narrative-driven Story Events.
 * These events bypass the probabilistic random event pool and are 
 * manually queued via game state triggers.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const STORY_EVENTS = {
    // Example Payload
    'evt_story_example': {
        id: 'evt_story_example',
        theme: 'license-t2',
        portraitId: 'Kintsugi_3',
        repeatable: false,
        title: 'Incoming Transmission',
        text: 'TEST TEST TEST',
        confirmText: 'Log Transmission',
        choices: [] 
    }
};