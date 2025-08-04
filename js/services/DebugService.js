// js/services/DebugService.js
import { SHIPS, COMMODITIES, MARKETS } from '../data/gamedata.js';
import { DEBUG_KEYS } from '../data/constants.js';

export class DebugService {
    constructor(gameState, simulationService, uiManager) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
    }

    handleKeyPress(key) {
        if (this.gameState.isGameOver) return;
        
        let message = '';
        switch (key) {
            case DEBUG_KEYS.ADD_CREDITS:
                this.gameState.player.credits += 500000000000;
                message = 'Debug: +500B Credits.';
                break;
            case DEBUG_KEYS.FORCE_EVENT:
                const ship = this.simulationService._getActiveShip();
                this.gameState.player.shipStates[ship.id].fuel = ship.maxFuel;

                const possibleDestinations = MARKETS.filter(m => m.id !== this.gameState.currentLocationId && this.gameState.player.unlockedLocationIds.includes(m.id));
                if (possibleDestinations.length > 0) {
                    const randomDestination = possibleDestinations[Math.floor(Math.random() * possibleDestinations.length)];
                    this.simulationService.initiateTravel(randomDestination.id, { forceEvent: true });
                    message = `Debug: Refilled fuel & force-traveling to ${randomDestination.name} with event.`;
                } else {
                    message = `Debug: No available destinations.`;
                }
                break;
            case DEBUG_KEYS.UNLOCK_SHIPS:
                Object.keys(SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                        const newShip = SHIPS[shipId];
                        this.gameState.player.ownedShipIds.push(shipId);
                        this.gameState.player.shipStates[shipId] = { health: newShip.maxHealth, fuel: newShip.maxFuel, hullAlerts: { one: false, two: false } };
                        this.gameState.player.inventories[shipId] = {};
                        COMMODITIES.forEach(c => { this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 }; });
                    }
                });
                message = 'Debug: All ships added.';
                break;
            case DEBUG_KEYS.ADVANCE_YEAR:
                this.simulationService._advanceDays(366);
                message = `Debug: Time advanced 1 year and 1 day.`;
                break;
        }

        if (message) {
            this.uiManager.showToast('debugToast', message);
            this.gameState.setState({});
        }
    }
}