// js/services/bot/BotService.js
/**
 * @fileoverview This file contains the new BotService class.
 * This service is the high-level manager for all automated player agents ("Personas").
 * It is responsible for instantiating the correct persona based on the user's
 * selection and running the main simulation loop, calling the persona's 'update'
 * method on each tick.
 */

// Import legacy bot wrapper
import { Persona_StressTester } from './personas/Persona_StressTester.js';

// --- [[START]] GEMINI MODIFICATION ---
// Import new modular personas
import { Persona_HonestTrader } from './personas/Persona_HonestTrader.js';
import { Persona_HumanTrader } from './personas/Persona_HumanTrader.js';
// --- [[END]] GEMINI MODIFICATION ---


/**
 * @class BotService
 * @description Manages the lifecycle of automated player personas for testing.
 */
export class BotService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../SimulationService.js').SimulationService} simulationService
     * @param {import('../LoggingService.js').Logger} logger
     */
    constructor(gameState, simulationService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.logger = logger;

        this.isRunning = false;
        this.stopRequested = false;
        
        /** @type {import('./personas/BotPersona.js').BotPersona | Persona_StressTester | null} */
        this.activePersona = null;
    }

    /**
     * Starts a new bot simulation with a specific persona.
     * @param {object} config - Configuration for the simulation run.
     * @param {number} config.daysToRun - The number of in-game days to simulate.
     * @param {string} config.personaId - The ID of the persona to run (e.g., 'PROSPECTOR', 'HUMAN_TRADER').
     * @param {function} updateCallback - A function to call with progress updates.
     */
    async runSimulation({ daysToRun, personaId }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('BotService', 'A bot simulation is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;

        // --- 1. Instantiate the correct Persona ---
        switch (personaId) {
            // --- [[START]] GEMINI MODIFICATION ---
            // --- New Modular Personas ---
            case 'HONEST_TRADER':
                this.activePersona = new Persona_HonestTrader(this.gameState, this.simulationService, this.logger);
                break;
            case 'HUMAN_TRADER':
                this.activePersona = new Persona_HumanTrader(this.gameState, this.simulationService, this.logger);
                break;
            // --- [[END]] GEMINI MODIFICATION ---

            // --- Legacy Persona Wrapper ---
            case 'MIXED':
            case 'MANIPULATOR':
            case 'DEPLETE_ONLY':
            case 'PROSPECTOR':
            default:
                // All old strategy IDs map to the legacy wrapper
                this.activePersona = new Persona_StressTester(this.gameState, this.simulationService, this.logger, personaId);
                break;
        }

        // --- 2. Initialize Metrics for the selected Persona ---
        // This is now standardized for all personas (new and legacy)
        this.activePersona.simulationStartDay = startDay;
        this.activePersona.metrics = {
            totalTrades: 0,
            profitableTrades: 0,
            totalNetProfit: 0,
            totalFuelCost: 0,
            totalRepairCost: 0,
            daysSimulated: 0,
            profitByGood: {},
            // Note: Goal/Objective metrics will be handled differently
            // by legacy vs. new personas, so we leave them out here.
            // The legacy bot adds them manually.
        };
        
        // The legacy bot needs a couple of extra properties set
        if (this.activePersona instanceof Persona_StressTester) {
            const legacyMetrics = {
                objectivesStarted: 0,
                objectivesCompleted: 0,
                objectivesAborted: 0,
                strategyUsed: this.activePersona.legacyBot.activeStrategy
            };
            // Combine the standard metrics with the legacy ones
            this.activePersona.metrics = { ...this.activePersona.metrics, ...legacyMetrics };
            // Assign this new object to the legacy bot instance itself
            this.activePersona.legacyBot.metrics = this.activePersona.metrics;
            this.activePersona.legacyBot.simulationStartDay = startDay;
        }
        
        this.logger.info.system('BotService', startDay, 'SIMULATION_START', `Starting simulation for ${daysToRun} days using persona: ${personaId}.`);

        // --- 3. Run the main simulation loop ---
        while (this.gameState.day < endDay && !this.stopRequested) {
            // Execute one "tick" of the active persona's brain
            await this.activePersona.update();

            // Update UI & Pause
            updateCallback(this.gameState.day, endDay);
            await new Promise(resolve => setTimeout(resolve, 10)); // Tiny pause
        }

        // --- 4. Log Summary Report ---
        if (this.activePersona && typeof this.activePersona.logSummaryReport === 'function') {
            this.activePersona.logSummaryReport();
        }
        
        this.logger.info.system('BotService', this.gameState.day, 'SIMULATION_END', 'Simulation finished.');
        this.isRunning = false;
        this.activePersona = null;
    }

    /**
     * Stops the currently running simulation.
     */
    stop() {
        this.stopRequested = true;
        if (this.activePersona && typeof this.activePersona.stop === 'function') {
            this.activePersona.stop();
        }
        this.logger.info.system('BotService', this.gameState.day, 'SIMULATION_STOP', 'Stop request received.');
    }
}