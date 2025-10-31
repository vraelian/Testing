// js/services/bot/personas/BotPersona.js
/**
 * @fileoverview This file contains the BotPersona base class.
 * A "Persona" is the "brain" of a bot. It defines the bot's high-level
 * decision-making logic. On each update tick, the BotService will ask
 * the active persona what it wants to do.
 *
 * The Persona's job is NOT to execute actions, but to manage a queue
 * of "Goals." For example, a persona might decide "I am low on money,"
 * so it adds a new "Goal_AcquireCredits" to its goal queue.
 */

export class BotPersona {
    /**
     * @param {import('../../GameState.js').GameState} gameState
     * @param {import('../../SimulationService.js').SimulationService} simulationService
     * @param {import('../../LoggingService.js').Logger} logger
     */
    constructor(gameState, simulationService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.logger = logger;
        this.personaId = 'BASE_PERSONA';

        /**
         * The queue of high-level goals. The persona will always work
         * on the goal at the front of the queue (this.activeGoal).
         * @type {import('../goals/BotGoal.js').BotGoal[]}
         */
        this.goalQueue = [];

        // --- [[START]] GEMINI MODIFICATION ---
        /**
         * @type {object}
         * @description Tracks performance metrics for the summary report.
         * This is initialized by the BotService when a simulation starts.
         */
        this.metrics = {};
        /** @type {number} */
        this.simulationStartDay = 0;
        // --- [[END]] GEMINI MODIFICATION ---
    }

    /**
     * The main update tick, called by BotService.
     * This is the core "brain" loop for the persona.
     * @returns {Promise<void>}
     */
    async update() {
        // 1. Get the active goal (the one at the front of the queue)
        let activeGoal = this.goalQueue[0];

        // 2. If there is no active goal, ask the persona to decide on one.
        if (!activeGoal) {
            activeGoal = this.findNewGoal();
            if (activeGoal) {
                this.addGoal(activeGoal);
            } else {
                // This persona has nothing to do.
                this.logger.info.system(this.personaId, this.gameState.day, 'IDLE', 'No active goals and no new goals found. Bot is idle.');
                // We might want to advance time here later, but for now, just wait.
                await new Promise(resolve => setTimeout(resolve, 100)); // Prevent runaway loop
                return;
            }
        }

        // 3. Process the active goal.
        if (activeGoal) {
            // The goal's "process" method will handle its own internal
            // state and action queue.
            await activeGoal.process();

            // 4. If the goal is completed, remove it from the queue.
            if (activeGoal.isCompleted()) {
                this.logger.info.system(this.persona.personaId, this.gameState.day, 'GOAL_COMPLETE', `Completed goal: ${activeGoal.goalId}`);
                this.goalQueue.shift(); // Remove the completed goal
            }
        }
    }

    /**
     * The decision-making logic for the persona.
     * This method is overridden by each specific persona.
     * It should return a new Goal object or null if no goal is found.
     * @returns {import('../goals/BotGoal.js').BotGoal | null}
     */
    findNewGoal() {
        // --- OVERRIDE IN CHILD CLASS ---
        // Example:
        // if (this.gameState.player.credits < 100000) {
        //    return new Goal_AcquireCredits(1000000);
        // }
        // if (this.gameState.player.activeShipId !== 'hauler_c1') {
        //    return new Goal_BuyNewShip('hauler_c1');
        // }
        // return new Goal_ExecuteSimpleTrade();
        
        this.logger.warn(this.personaId, 'findNewGoal() is not implemented.');
        return null;
    }

    /**
     * Adds a new goal to the persona's queue.
     * @param {import('../goals/BotGoal.js').BotGoal} goal
     */
    addGoal(goal) {
        this.logger.info.system(this.persona.personaId, this.gameState.day, 'GOAL_NEW', `Adding new goal: ${goal.goalId}`);
        this.goalQueue.push(goal);
    }

    /**
     * Called by BotService to stop the simulation.
     */
    stop() {
        // Base implementation does nothing, but can be overridden
        // if a persona needs to interrupt a long-running process.
    }

    /**
     * Called by BotService when the simulation ends.
     * This is where a persona would log its specific summary report.
     */
    logSummaryReport() {
        // --- OVERRIDE IN CHILD CLASS ---
        this.logger.info.system(this.personaId, this.gameState.day, 'REPORT', 'Base persona has no summary to report.');
    }
}