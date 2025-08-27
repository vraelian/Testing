// js/services/event-effects/effectAdriftPassenger.js
/**
 * @fileoverview This file contains the specific logic for resolving the "Adrift Passenger"
 * random event outcome. It demonstrates a conditional effect that changes based on the
 * player's current cargo space and debt status.
 */
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { COMMODITY_IDS } from '../../data/constants.js';
import { DB } from '../../data/database.js';

/**
 * @typedef {import('../../services/GameState.js').GameState} GameState
 * @typedef {import('../../services/SimulationService.js').SimulationService} SimulationService
 */

/**
 * Resolves the "Adrift Passenger" event outcome where the player gives them a fuel cell.
 * The reward is conditional:
 * 1. If the player has enough cargo space, they receive Cybernetics.
 * 2. If not, and they have debt, the passenger pays off a portion of it.
 * 3. If they have no cargo space and no debt, they receive credits instead.
 *
 * @param {GameState} gameState - The mutable game state object.
 * @param {SimulationService} simulationService - The simulation service instance, used here to log transactions.
 * @param {object} outcome - The chosen outcome object from the database.
 * @returns {object} An object containing a `key` to select the correct description and a dynamic `amount` for formatting.
 */
export function resolveAdriftPassenger(gameState, simulationService, outcome) {
    const ship = simulationService._getActiveShip();
    const shipState = gameState.player.shipStates[ship.id];
    const inventory = simulationService._getActiveInventory();

    // The cost of the choice is paid first.
    shipState.fuel = Math.max(0, shipState.fuel - 30);

    // Ensure the awarded commodity exists in the inventory before attempting to modify it.
    if (!inventory[COMMODITY_IDS.CYBERNETICS]) {
        inventory[COMMODITY_IDS.CYBERNETICS] = { quantity: 0, avgCost: 0 };
    }

    // Determine the reward based on player's current state.
    if (calculateInventoryUsed(inventory) + 40 <= ship.cargoCapacity) {
        inventory[COMMODITY_IDS.CYBERNETICS].quantity += 40;
        return { key: 'reward_cybernetics' };
    } else if (gameState.player.debt > 0) {
        const paid = Math.floor(gameState.player.debt * 0.20);
        gameState.player.debt -= paid;
        simulationService._logTransaction('event', paid, 'Passenger paid off debt');
        return { key: 'reward_debt_paid', amount: formatCredits(paid) };
    } else {
        const credits = Math.floor(gameState.player.credits * 0.05);
        gameState.player.credits += credits;
        simulationService._logTransaction('event', credits, 'Passenger payment');
        return { key: 'reward_credits', amount: formatCredits(credits) };
    }
}