// js/services/event-effects/effectSpaceRace.js
/**
 * @fileoverview Contains the logic for resolving the "Space Race" random event outcome.
 * This effect calculates a wager, determines a win/loss result based on ship class,
 * and modifies the outcome description to reflect the result.
 */
import { formatCredits } from '../../utils.js';

/**
 * Resolves the "Space Race" event by calculating a wager and determining the winner.
 * The win chance is dependent on the player's active ship class.
 *
 * @param {import('../../services/GameState.js').GameState} gameState - The mutable game state object.
 * @param {import('../../services/SimulationService.js').SimulationService} simulationService - The simulation service instance.
 * @param {object} effectData - The raw effect data, containing `wagerPercentage` and `winChance` map.
 * @param {object} outcome - The chosen outcome object from the database. Its `description` property will be overwritten by this function.
 */
export function resolveSpaceRace(gameState, simulationService, effectData, outcome) {
    const ship = simulationService._getActiveShip();
    const wager = Math.floor(gameState.player.credits * effectData.wagerPercentage);
    const winChance = effectData.winChance[ship.class] || 0.40; // Default chance if class not found.

    if (Math.random() < winChance) {
        // Player wins the race.
        // --- VIRTUAL WORKBENCH: APPLY CREDIT CAP ---
        gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, gameState.player.credits + wager);
        // --- END VIRTUAL WORKBENCH ---
        simulationService._logTransaction('event', wager, 'Won space race wager');
        outcome.description = `Your Class ${ship.class} ship wins! You gain <span class="hl-green">${formatCredits(wager)}</span>.`;
    } else {
        // Player loses the race.
        gameState.player.credits -= wager;
        simulationService._logTransaction('event', -wager, 'Lost space race wager');
        outcome.description = `The luxury ship was too fast. You lose <span class="hl-red">${formatCredits(wager)}</span>.`;
    }
}