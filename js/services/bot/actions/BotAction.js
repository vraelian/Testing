// js/services/bot/actions/BotAction.js
/**
 * @fileoverview This file contains the BotAction base class.
 * An "Action" is the smallest, atomic, indivisible task that a bot
 * can perform (e.g., "Travel to Mars," "Buy 10 Plasteel," "Refuel").
 *
 * Actions are managed and executed by a "Goal." An action should be
 * simple and (ideally) not manage other actions. The exception is when
 * an action has a prerequisite, like "Refuel" needing to "Travel" first.
 */

export class BotAction {
    /**
     * @param {import('../goals/BotGoal.js').BotGoal} goal - The goal that owns this action.
     * @param {string} actionId - A unique identifier for the action (e.g., 'ACTION_TRAVEL_TO').
     */
    constructor(goal, actionId = 'BASE_ACTION') {
        this.goal = goal;
        this.actionId = actionId;

        // --- Convenience accessors ---
        this.persona = goal.persona;
        this.gameState = goal.gameState;
        this.simulationService = goal.simulationService;
        this.logger = goal.logger;

        /**
         * The current status of the action.
         * @type {'INACTIVE' | 'ACTIVE' | 'COMPLETED' | 'FAILED'}
         */
        this.status = 'INACTIVE';
    }

    /**
     * Activates the action. Called by the goal right before
     * the first `process()` tick.
     */
    activate() {
        this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Activating action: ${this.actionId}`);
        this.status = 'ACTIVE';
        // --- OVERRIDE IN CHILD CLASS ---
        // Child class should call super.activate() and then
        // perform any one-time setup.
        // Example:
        // this.simulationService.travelService.initiateTravel(this.destinationId);
    }

    /**
     * The main update tick, called by the Goal.
     * This method performs the action's logic.
     * @returns {Promise<void>}
     */
    async process() {
        if (this.status !== 'ACTIVE') {
            return;
        }

        // --- OVERRIDE IN CHILD CLASS ---
        // This is the core logic loop.
        // Example (for a travel action):
        // if (this.gameState.pendingTravel === null) {
        //     this.status = 'COMPLETED';
        // }
        
        // Base action does nothing and completes immediately.
        this.logger.warn(this.actionId, 'process() is not implemented. Completing immediately.');
        this.status = 'COMPLETED';
    }

    /**
     * @returns {boolean} True if the action is complete.
     */
    isCompleted() {
        return this.status === 'COMPLETED';
    }

    /**
     * @returns {boolean} True if the action has failed.
     */
    isFailed() {
        return this.status === 'FAILED';
    }

    /**
     * @returns {boolean} True if the action is currently active.
     */
    isActivated() {
        return this.status === 'ACTIVE' || this.isCompleted() || this.isFailed();
    }
}