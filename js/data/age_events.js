// js/data/age_events.js
/**
 * @fileoverview
 * Defines all static narrative "age" events triggered by game progression.
 */
import { PERK_IDS } from './constants.js';

export const AGE_EVENTS = [
    {
        id: 'captain_choice',
        trigger: { day: 366 }, // Triggers after one full year of gameplay.
        title: 'Captain Who?',
        description: "You've successfully navigated many trades and run a tight ship. Your crew depends on you... but what kind of captain will you be?",
        choices: [
            { title: 'Trademaster', description: '5% bonus on all trade profits.', perkId: PERK_IDS.TRADEMASTER, playerTitle: 'Trademaster' },
            { title: 'Navigator', description: '10% reduced fuel usage, hull decay, and travel time.', perkId: PERK_IDS.NAVIGATOR, playerTitle: 'Navigator' }
        ]
    },
    {
        id: 'friends_with_benefits',
        trigger: { credits: 50000 }, // Triggers upon reaching 50,000 credits.
        title: 'Friends with Benefits',
        description: 'An ally in need is an ally indeed.',
        choices: [
            { title: "Join the Merchant's Guild", description: 'Receive a free C-Class freighter.', perkId: PERK_IDS.MERCHANT_GUILD_SHIP },
            { title: 'Join the Venetian Syndicate', description: '75% discount on fuel and repairs at Venus.', perkId: PERK_IDS.VENETIAN_SYNDICATE }
        ]
    }
];