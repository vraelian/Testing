// js/services/bot/TelemetryService.js
import { TelemetryStorageService } from '../TelemetryStorageService.js';

/**
 * @class TelemetryService
 * @description Orchestrates the background extraction of active RAM bloat from the GameState 
 * and offloads it to the isolated database vault.
 */
export class TelemetryService {
    constructor(gameState) {
        this.gameState = gameState;
        this.storageService = new TelemetryStorageService();
    }

    /**
     * The background orchestrator routine. Intercepts the arrays, offloads them, 
     * and relies on the GameState to aggressively overwrite the live RAM.
     */
    async flushRoutine() {
        try {
            if (!this.gameState || !this.gameState.telemetry) return;

            // Safely clone and destroy live arrays in the GameState
            const payload = this.gameState.extractAndFlushTelemetry();
            
            // Validate payload before committing to IDB
            if (payload && (payload.ticks.length > 0 || payload.trades.length > 0 || payload.impacts.length > 0)) {
                await this.storageService.appendTelemetry(payload);
            }
        } catch (error) {
            console.error("TelemetryService: Failed to execute automated flush routine.", error);
        }
    }
}