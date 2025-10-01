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
import { COMMODITY_IDS } from '../data/constants.js';

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
    'credits': (gameState, simulationService, effect) => {
        gameState.player.credits += effect.value;
        simulationService._logTransaction('event', effect.value, 'Received credits from event');
    },
    'fuel': (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        shipState.fuel = Math.max(0, shipState.fuel + effect.value);
    },
    'hull_damage_percent': (gameState, simulationService, effect) => {
        // Damage can be a fixed value or a random value within a range [min, max].
        let dmg = Array.isArray(effect.value) ?
            Math.random() * (effect.value[1] - effect.value[0]) + effect.value[0] : effect.value;
        gameState.pendingTravel.eventHullDamagePercent = (gameState.pendingTravel.eventHullDamagePercent || 0) + dmg;
    },
    'travel_time_add': (gameState, simulationService, effect) => {
        gameState.pendingTravel.travelTimeAdd = (gameState.pendingTravel.travelTimeAdd || 0) + effect.value;
    },
    'travel_time_add_percent': (gameState, simulationService, effect) => {
        gameState.pendingTravel.travelTimeAddPercent = (gameState.pendingTravel.travelTimeAddPercent || 0) + effect.value;
    },
    'set_travel_time': (gameState, simulationService, effect) => {
        gameState.pendingTravel.setTravelTime = effect.value;
    },
    'add_debt': (gameState, simulationService, effect) => {
        if (gameState.player.debt <= 0) {
            gameState.player.loanStartDate = gameState.day;
            gameState.player.weeklyInterestAmount = 0;
        }
        const newInterest = Math.ceil(effect.value * 0.013);
        gameState.player.weeklyInterestAmount += newInterest;
        gameState.player.debt += effect.value;
        simulationService._logTransaction('loan', effect.value, 'Incurred debt from event');
    },
    'add_cargo': (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const inventory = simulationService._getActiveInventory();
        const commodity = DB.COMMODITIES.find(c => c.id === effect.value.id);
        // This effect is conditional: cargo is only added if there is sufficient space.
        if (calculateInventoryUsed(inventory) + effect.value.quantity <= ship.cargoCapacity) {
            inventory[effect.value.id].quantity += effect.value.quantity;
        } else {
            // If there's no space, modify the outcome description to inform the player.
            outcome.description = `You try to tractor the pod, but there's no room in your cargo hold! You're forced to leave the <span class="hl">${commodity.name}</span> behind.`;
        }
    },
    'lose_cargo': (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        inventory[effect.value.id].quantity = Math.max(0, inventory[effect.value.id].quantity - effect.value.quantity);
    },
    'lose_random_cargo_percent': (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        const heldCommodities = Object.entries(inventory).filter(([, item]) => item.quantity > 0);
        if (heldCommodities.length > 0) {
            const [id, item] = heldCommodities[Math.floor(Math.random() * heldCommodities.length)];
            const quantityToLose = Math.ceil(item.quantity * effect.value);
            item.quantity = Math.max(0, item.quantity - quantityToLose);
        }
    },
    'sell_random_cargo_premium': (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        const heldCommodities = Object.entries(inventory).filter(([, item]) => item.quantity > 0);
        if (heldCommodities.length > 0) {
            const [id, item] = heldCommodities[Math.floor(Math.random() * heldCommodities.length)];
            const saleValue = gameState.market.galacticAverages[id] * effect.value * item.quantity;
            gameState.player.credits += saleValue;
            simulationService._logTransaction('trade', saleValue, 'Emergency supply drop sale');
            item.quantity = 0;
        }
    },
    'set_new_random_destination': (gameState, simulationService, effect) => {
        const otherMarkets = DB.MARKETS.filter(m => m.id !== gameState.currentLocationId && gameState.player.unlockedLocationIds.includes(m.id));
        if(otherMarkets.length > 0) {
            gameState.pendingTravel.destinationId = otherMarkets[Math.floor(Math.random() * otherMarkets.length)].id;
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
        console.warn(`No handler found for event effect type: ${effect.type}`);
    }
}