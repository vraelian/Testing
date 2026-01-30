import { COMMODITY_IDS } from './constants.js';

export const CONSUMABLE_ITEMS = {
    [COMMODITY_IDS.FOLDED_DRIVES]: {
        id: COMMODITY_IDS.FOLDED_DRIVES,
        name: "Folded-Space Drive",
        type: "ARTIFACT",
        isConsumable: true,
        
        // Metadata for the Travel UI
        usageInteraction: {
            type: "TRAVEL_MODIFIER",
            label: "Activate Folded-Space Drive",
            description: "Consume 1 Drive to warp instantly (0 Days, 0 Fuel).",
            triggerLocation: "LAUNCH_MODAL" 
        },

        // Logic handled in TravelService, but defined here for reference
        effects: {
            travelTimeOverride: 0,
            fuelCostOverride: 0,
            consumeOnUse: true
        }
    }
};