// js/services/bot/personas/Persona_StressTester.js
/**
 * @fileoverview This file contains the Persona_StressTester class.
 * This class is a "wrapper" for the legacy AutomatedPlayerService.
 * It implements the new BotPersona interface but delegates all its
 * logic to the old state machine.
 *
 * This allows us to use the new BotService to run the old, proven
 * stress-test bot while we build new, modular personas in parallel.
 */

import { BotPersona } from './BotPersona.js';
import { AutomatedPlayer } from '../AutomatedPlayerService.js';
// We must import the enum from the legacy service to set the initial state
import { BotState } from '../AutomatedPlayerService.js';

export class Persona_StressTester extends BotPersona {
    /**
     * @param {import('../../GameState.js').GameState} gameState
     * @param {import('../../SimulationService.js').SimulationService} simulationService
     * @param {import('../../LoggingService.js').Logger} logger
     * @param {string} strategy - The specific strategy for the legacy bot (e.g., 'MIXED', 'PROSPECTOR')
     */
    constructor(gameState, simulationService, logger, strategy) {
        // Pass all services to the base class
        super(gameState, simulationService, logger);
        
        this.personaId = `STRESS_TESTER_${strategy}`;
        this.logger.info.system('BotService', null, 'PERSONA_LOAD', `Loading legacy Persona_StressTester with strategy: ${strategy}`);
        
        // Create an instance of the legacy bot
        this.legacyBot = new AutomatedPlayer(gameState, simulationService, logger);
        
        // Manually set the config that would have been set by the old runSimulation method.
        this.legacyBot.activeStrategy = strategy;
        this.legacyBot.botState = BotState.IDLE; // Ensure it starts from IDLE
    }

    /**
     * The main update tick called by BotService.
     * This just delegates to the legacy bot's main state machine.
     * @override
     * @returns {Promise<void>}
     */
    async update() {
        // This persona doesn't use the goal queue.
        // It just runs the legacy bot's main decision loop.
        await this.legacyBot._decideNextAction();
    }

    /**
     * This persona doesn't find new goals; it's a monolithic state machine.
     * @override
     * @returns {null}
     */
    findNewGoal() {
        // This method is not used by this persona.
        return null;
    }

    /**
     * Called by BotService when the simulation ends.
     * This tells the legacy bot to log its final report.
     * @override
     */
    logSummaryReport() {
        // We need to set the days simulated on the legacy bot
        // just before logging the report, as BotService now holds this logic.
        this.legacyBot.metrics.daysSimulated = this.gameState.day - this.legacyBot.simulationStartDay;
        this.legacyBot._logSummaryReport();
    }

    /**
     * Called by BotService to stop the simulation.
     * @override
     */
    stop() {
        this.legacyBot.stop();
    }
}