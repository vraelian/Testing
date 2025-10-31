// js/services/bot/goals/BotGoal.js
/**
 * @fileoverview This file contains the BotGoal base class.
 * A "Goal" is a high-level, multi-step objective that a Persona wants to
 * achieve (e.g., "Acquire 1M credits," "Buy a new ship").
 *
 * A Goal is a state machine itself. It manages a queue of "Actions"
 * (atomic tasks) and executes them in order to achieve the objective.
 */

export class BotGoal {
    /**
     * @param {import('../personas/BotPersona.js').BotPersona} persona - The persona that owns this goal.
     * @param {string} goalId - A unique identifier for the goal (e.g., 'GOAL_ACQUIRE_CREDITS').
     */
    constructor(persona, goalId = 'BASE_GOAL') {
        this.persona = persona;
        this.goalId = goalId;

        // --- Convenience accessors ---
        this.gameState = persona.gameState;
        this.simulationService = persona.simulationService;
        this.logger = persona.logger;

        /**
         * The queue of atomic actions to complete this goal.
         * The goal will always work on the action at the front of the queue.
         * @type {import('../actions/BotAction.js').BotAction[]}
         */
        this.actionQueue = [];

        /**
         * The current status of the goal.
         * @type {'INACTIVE' | 'ACTIVE' | 'COMPLETED' | 'FAILED'}
         */
        this.status = 'INACTIVE';
    }

    /**
     * Activates the goal. This is where the goal should
     * build its initial action queue.
     */
    activate() {
        this.logger.info.system(this.persona.personaId, this.gameState.day, this.goalId, 'Activating goal.');
        this.status = 'ACTIVE';
        // --- OVERRIDE IN CHILD CLASS ---
        // Child class should call super.activate() and then
        // build its action queue.
        // Example:
        // this.actionQueue.push(new Action_TravelTo('loc_mars'));
        // this.actionQueue.push(new Action_BuyItem('plasteel', 10));
    }

    /**
     * The main update tick, called by the Persona.
     * This method processes the current action in the queue.
     * @returns {Promise<void>}
     */
    async process() {
        if (this.status !== 'ACTIVE') {
            return;
        }

        // If the action queue is empty, the goal is complete.
        if (this.actionQueue.length === 0) {
            this.status = 'COMPLETED';
            return;
        }

        // Get the current action
        const currentAction = this.actionQueue[0];

        // Activate the action if it's inactive
        if (!currentAction.isActivated()) {
            currentAction.activate();
        }

        // Process the active action
        await currentAction.process();

        // If the action is completed, remove it from the queue.
        if (currentAction.isCompleted()) {
            this.logger.info.system(this.persona.personaId, this.gameState.day, this.goalId, `Completed action: ${currentAction.actionId}`);
            this.actionQueue.shift(); // Remove completed action
        }
        // If the action failed, we might want to handle that
        else if (currentAction.isFailed()) {
            this.logger.warn(this.persona.personaId, this.gameState.day, this.goalId, `Action failed: ${currentAction.actionId}. Goal is failing.`);
            this.status = 'FAILED';
        }
    }

    /**
     * @returns {boolean} True if the goal is complete.
     */
    isCompleted() {
        return this.status === 'COMPLETED';
    }

    /**
     * @returns {boolean} True if the goal has failed.
     */
    isFailed() {
        return this.status === 'FAILED';
    }

    /**
     * @returns {boolean} True if the goal is active.
     */
    isActive() {
        return this.status === 'ACTIVE';
    }
}