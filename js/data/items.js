// js/data/items.js
import { COMMODITY_IDS } from './constants.js';

export const CONSUMABLES = {
    [COMMODITY_IDS.FOLDED_DRIVES]: {
        id: COMMODITY_IDS.FOLDED_DRIVES,
        name: 'Folded-Space Drive',
        effectType: 'INSTANT_TRAVEL',
        description: 'Consuming this drive folds space-time, allowing for instant travel to any known location without fuel cost.',
        consumeOnUse: true
    }
};