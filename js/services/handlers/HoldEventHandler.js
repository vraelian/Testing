// js/services/handlers/HoldEventHandler.js
/**
 * @fileoverview Manages "hold-to-act" functionality, specifically for the
 * refueling and repairing services which require continuous action while a
 * button is pressed.
 */
import { formatCredits } from '../../utils.js';

export class HoldEventHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../SimulationService.js').SimulationService} simulationService The core game logic engine.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(gameState, simulationService, uiManager) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;

        this.refuelInterval = null;
        this.repairInterval = null;
    }

    /**
     * Initiates a hold action based on the event target.
     * @param {Event} e The mousedown or touchstart event.
     */
    handleHoldStart(e) {
        if (e.target.closest('#refuel-btn')) {
            this._startRefueling(e.type === 'touchstart');
        }
        if (e.target.closest('#repair-btn')) {
            this._startRepairing(e.type === 'touchstart');
        }
    }

    /**
     * Clears all active hold intervals, stopping any continuous actions.
     */
    handleHoldEnd() {
        this._stopRefueling();
        this._stopRepairing();
    }

    _startRefueling(isTouch = false) {
        if (this.gameState.isGameOver || this.refuelInterval) return;
        this._refuelTick();
        this.refuelInterval = setInterval(() => this._refuelTick(), isTouch ? 200 : 1000);
    }

    _stopRefueling() {
        clearInterval(this.refuelInterval);
        this.refuelInterval = null;
    }

    _refuelTick() {
        const cost = this.simulationService.refuelTick();
        const button = this.uiManager.cache.servicesScreen?.querySelector('#refuel-btn');
        if (cost > 0 && button) {
            const rect = button.getBoundingClientRect();
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRefueling();
        }
    }

    _startRepairing(isTouch = false) {
        if (this.gameState.isGameOver || this.repairInterval) return;
        this._repairTick();
        this.repairInterval = setInterval(() => this._repairTick(), isTouch ? 200 : 1000);
    }

    _stopRepairing() {
        clearInterval(this.repairInterval);
        this.repairInterval = null;
    }

    _repairTick() {
        const cost = this.simulationService.repairTick();
        const button = this.uiManager.cache.servicesScreen?.querySelector('#repair-btn');
        if (cost > 0 && button) {
            const rect = button.getBoundingClientRect();
            this.uiManager.createFloatingText(`-${formatCredits(cost, false)}`, rect.left + (rect.width / 2), rect.top, '#f87171');
            this.uiManager.updateServicesScreen(this.gameState.getState());
        } else {
            this._stopRepairing();
        }
    }
}