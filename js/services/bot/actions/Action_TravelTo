// js/services/bot/actions/Action_TravelTo.js
/**
 * @fileoverview This file contains the BotAction_TravelTo class.
 * This is a simple, atomic action that handles traveling to a
 * specified location. It activates by initiating travel and
 * completes itself once the travel is finished.
 */

import { BotAction } from './BotAction.js';

export class BotAction_TravelTo extends BotAction {
    /**
     * @param {import('../goals/BotGoal.js').BotGoal} goal - The goal that owns this action.
     * @param {string} destinationId - The location ID to travel to.
     */
    constructor(goal, destinationId) {
        super(goal, `ACTION_TRAVEL_TO_${destinationId}`);
        this.destinationId = destinationId;
    }

    /**
     * Activates the travel action.
     * @override
     */
    activate() {
        if (this.gameState.currentLocationId === this.destinationId) {
            this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Action ${this.actionId} complete (already at destination).`);
            this.status = 'COMPLETED';
            return;
        }

        // Check if travel is possible (basic check, refuel action should be separate)
        const travelInfo = this.gameState.getState().TRAVEL_DATA[this.gameState.currentLocationId][this.destinationId];
        const ship = this.simulationService._getActiveShip();
        
        if (!travelInfo || !ship) {
            this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: Cannot travel (No travel info or no ship).`);
            this.status = 'FAILED';
            return;
        }

        // Note: A "smarter" version of this action could check for fuel.
        // For this architecture, we will make a separate "Action_Refuel"
        // and assume the *Goal* is responsible for queuing it first.
        if (ship.fuel < travelInfo.fuelCost) {
             this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: Not enough fuel. The controlling Goal should have run Action_Refuel first.`);
             this.status = 'FAILED';
             return;
        }

        super.activate(); // Sets status to 'ACTIVE' and logs
        this.simulationService.travelService.initiateTravel(this.destinationId);
    }

    /**
     * Processes the travel action.
     * The action is complete when the game is no longer in a 'pendingTravel' state.
     * @override
     * @returns {Promise<void>}
     */
    async process() {
        if (this.status !== 'ACTIVE') {
            return;
        }

        // Travel is handled by the core game loop (which advances time).
        // We just need to check if the travel state is over.
        if (this.gameState.pendingTravel === null) {
            // We have arrived.
            if (this.gameState.currentLocationId === this.destinationId) {
                this.status = 'COMPLETED';
            } else {
                // This shouldn't happen if activate() worked, but as a safeguard.
                this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: Travel ended, but not at destination.`);
                this.status = 'FAILED';
            }
        }
        // If pendingTravel is not null, we are still traveling.
        // The BotService loop will just call process() again on the next tick.
    }
}