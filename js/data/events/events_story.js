/**
 * @fileoverview
 * Event Category: STORY
 * Focus: Narrative-only events, lore expansion, and flavor text.
 * These events typically have no major mechanical impact but build world-building.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const EVENTS_STORY = [
    // =========================================================================
    // CATEGORY VIII: STORY (Lore & Narrative)
    // =========================================================================
    // Place new story events here.
    // Example:
    /*
    {
        id: 'evt_story_example',
        tags: [EVENT_CONSTANTS.TAGS.SPACE],
        weight: 10,
        requirements: [],
        template: {
            title: 'Stellar Phenomenon',
            description: 'You witness a breathtaking binary star eclipse. It serves as a reminder of why you fly.'
        },
        choices: [
            {
                id: 'choice_watch',
                text: 'Watch',
                resolution: { type: EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC, pool: [{ outcomeId: 'out_watch' }] }
            }
        ],
        outcomes: {
            'out_watch': {
                title: 'Moment of Peace',
                text: 'The view is magnificent.',
                effects: [] // No effects, just flavor
            }
        }
    }
    */
];