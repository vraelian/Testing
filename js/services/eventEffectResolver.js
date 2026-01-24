// js/services/eventEffectResolver.js
/**
 * @fileoverview This file acts as a resolver for all random event outcomes. It maps effect types
 * to their corresponding handler functions, providing a centralized and extensible way to
 * apply the consequences of player choices during events.
 */
import { resolveSpaceRace } from './event-effects/effectSpaceRace.js';
import { resolveAdriftPassenger } from './event-effects/effectAdriftPassenger.js';
import { calculateInventoryUsed } from '../utils.js';
import { DB } from '../data/database.js';
import { COMMODITY_IDS, EVENT_CONSTANTS } from '../data/constants.js';

/**
 * A map of effect type strings to their corresponding handler functions.
 * Each handler function receives the game state, simulation service, the specific effect object,
 * and the parent outcome object. This allows for complex, conditional logic.
 * @type {Object.<string, function(import('./GameState.js').GameState, import('./SimulationService.js').SimulationService, object, object): (object|void)>}
 */
const effectHandlers = {
    // --- Custom, Complex Event Handlers ---
    'SPACE_RACE': resolveSpaceRace,
    'ADRIFT_PASSENGER': resolveAdriftPassenger,

    // --- Standard, Reusable Effect Handlers ---
    
    // 1. CREDITS
    [EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS]: (gameState, simulationService, effect) => {
        // Effect value is already resolved to an integer (e.g. -500 or +1000)
        const oldValue = gameState.player.credits;
        gameState.player.credits = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, gameState.player.credits + effect.value));
        
        const diff = gameState.player.credits - oldValue;
        if (diff !== 0) {
            simulationService._logTransaction('event', diff, 'Event outcome');
        }
    },

    // 2. FUEL
    [EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        // Effect value is resolved integer (e.g. -15)
        shipState.fuel = Math.max(0, Math.min(ship.maxFuel, shipState.fuel + effect.value));
    },

    // 3. HULL
    [EVENT_CONSTANTS.EFFECTS.MODIFY_HULL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        
        // OLD: Calculated percent on the fly
        // NEW: effect.value is a resolved integer (e.g. -10 damage)
        shipState.health = Math.max(0, Math.min(ship.maxHealth, shipState.health + effect.value));
        
        // REMOVED: Immediate death check. 
        // Logic moved to TravelService._postEventCheck() to allow user to see outcome first.
    },

    // 4. DEBT
    [EVENT_CONSTANTS.EFFECTS.MODIFY_DEBT]: (gameState, simulationService, effect) => {
        if (gameState.player.debt <= 0 && effect.value > 0) {
            gameState.player.loanStartDate = gameState.day;
            gameState.player.weeklyInterestAmount = 0;
        }
        // Assuming simple debt addition. Recalculating interest is complex, relying on daily update.
        gameState.player.debt = Math.max(0, gameState.player.debt + effect.value);
    },

    // 5. ADD ITEM (Specific)
    [EVENT_CONSTANTS.EFFECTS.ADD_ITEM]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const inventory = simulationService._getActiveInventory();
        const commodityId = effect.target; // ID is in target
        const quantity = effect.value;     // Qty is in value
        
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        
        if (calculateInventoryUsed(inventory) + quantity <= ship.cargoCapacity) {
            if (!inventory[commodityId]) {
                inventory[commodityId] = { quantity: 0, avgCost: 0 };
            }
            inventory[commodityId].quantity += quantity;
        } else {
            // Modify outcome text to reflect failure
            if (outcome && commodity) {
                outcome.text += ` (Cargo hold full! Abandoned ${quantity}x ${commodity.name}.)`;
            }
        }
    },

    // 6. REMOVE ITEM (Specific)
    [EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM]: (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        const commodityId = effect.target;
        const quantity = effect.value;

        if (inventory[commodityId]) {
            inventory[commodityId].quantity = Math.max(0, inventory[commodityId].quantity - quantity);
        }
    },

    // 7. TRAVEL TIME (Modify)
    [EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL]: (gameState, simulationService, effect) => {
        // effect.value is resolved number of days (e.g. 1 or 2)
        if (gameState.pendingTravel) {
            gameState.pendingTravel.travelTimeAdd = (gameState.pendingTravel.travelTimeAdd || 0) + effect.value;
        }
    },

    // 8. UNLOCK INTEL
    [EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL]: (gameState, simulationService, effect) => {
        // Generic handler for "Gaining Data"
        // In the future, this could unlock a specific route or price list.
        // For now, we'll simulate it by giving a small amount of XP/Skill (if that existed) or just visual feedback.
        // Or better: Reveal prices for a random location for 7 days.
        const randomLoc = DB.MARKETS[Math.floor(Math.random() * DB.MARKETS.length)];
        if (simulationService.intelService) {
             // Create a temporary intel packet? 
             // For now, let's just assume it was "sold" instantly for credits or acts as a flavor effect
             // that avoids the 'No handler' error.
        }
    },

    // 9. LOSE RANDOM CARGO (Percentage)
    [EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO]: (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        const heldCommodities = Object.entries(inventory).filter(([, item]) => item.quantity > 0);
        
        if (heldCommodities.length > 0) {
            const [id, item] = heldCommodities[Math.floor(Math.random() * heldCommodities.length)];
            // effect.value is a percentage (0.20)
            const quantityToLose = Math.ceil(item.quantity * effect.value);
            item.quantity = Math.max(0, item.quantity - quantityToLose);
            
            const commodity = DB.COMMODITIES.find(c => c.id === id);
            if (commodity) {
                // Return generic info for the UI logger if needed
                return { lostItem: commodity.name, lostQty: quantityToLose };
            }
        }
    },

    // 10. ADD RANDOM CARGO (Quantity)
    [EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const inventory = simulationService._getActiveInventory();
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        
        if (space <= 0) {
             if (outcome) outcome.text += ` (Cargo hold full! Could not salvage goods.)`;
             return;
        }

        // Pick a random trade good (excluding specialized ones if needed, but generic is fine)
        const validCommodities = DB.COMMODITIES.filter(c => c.id !== 'fuel_rod'); // Example filter
        const randomCom = validCommodities[Math.floor(Math.random() * validCommodities.length)];
        
        // Add up to effect.value, constrained by space
        const amountToAdd = Math.min(Math.floor(effect.value), space);
        
        if (amountToAdd > 0) {
            if (!inventory[randomCom.id]) inventory[randomCom.id] = { quantity: 0, avgCost: 0 };
            inventory[randomCom.id].quantity += amountToAdd;
            
            // Append to text for user clarity
            if (outcome) outcome.text += ` (Salvaged ${amountToAdd}x ${randomCom.name})`;
        }
    }
};

/**
 * Acts as a router, calling the appropriate handler function for a given event effect type.
 * @param {import('./GameState.js').GameState} gameState - The mutable game state object.
 * @param {import('./SimulationService.js').SimulationService} simulationService - The simulation service instance.
 * @param {object} effect - The effect object from the event definition in the database.
 * @param {object} outcome - The parent outcome object, which can be modified by the handler (e.g., to change descriptions).
 * @returns {object|void} An optional object from the handler, typically for dynamic description data.
 */
export function applyEffect(gameState, simulationService, effect, outcome) {
    const handler = effectHandlers[effect.type];
    if (handler) {
        return handler(gameState, simulationService, effect, outcome);
    } else {
        console.warn(`No handler found for event effect type: ${effect.type}`, effect);
    }
}