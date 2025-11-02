// js/services/world/TravelService.js
/**
 * @fileoverview Handles all aspects of interstellar travel, including
 * initiating trips, calculating costs, and managing the random event system.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, SCREEN_IDS, NAV_IDS, PERK_IDS, LOCATION_IDS } from '../../data/constants.js';
import { applyEffect } from '../eventEffectResolver.js';

export class TravelService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../UIManager.js').UIManager} uiManager
     * @param {import('./TimeService.js').TimeService} timeService
     * @param {import('../../services/LoggingService.js').Logger} logger
     * @param {import('../SimulationService.js').SimulationService} simulationServiceFacade
     */
    constructor(gameState, uiManager, timeService, logger, simulationServiceFacade) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.timeService = timeService;
        this.logger = logger;
        this.simulationService = simulationServiceFacade;
    }

    /**
     * Initiates travel to a new location after validating fuel and other conditions.
     * @param {string} locationId - The ID of the destination market.
     */
    travelTo(locationId) {
        this.uiManager.resetMarketTransactionState();
        const { tutorials } = this.gameState;
        const { navLock } = tutorials;

        if (navLock && navLock.screenId === SCREEN_IDS.NAVIGATION && navLock.enabledElementQuery) {
            if (!navLock.enabledElementQuery.includes(`[data-location-id='${locationId}']`)) {
                return;
            }
        }

        const state = this.gameState.getState();
        if (state.isGameOver || state.pendingTravel) return;
        if (state.currentLocationId === locationId) {
            this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            return;
        }

        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) {
            this.uiManager.queueModal('event-modal', "No Active Ship", "You must have an active vessel to travel.");
            return;
        }
        const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
        let requiredFuel = travelInfo.fuelCost;
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            requiredFuel = Math.round(requiredFuel * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        if (activeShip.maxFuel < requiredFuel) {
            this.uiManager.queueModal('event-modal', "Fuel Capacity Insufficient", `Your ship's fuel tank is too small. This trip requires ${requiredFuel} fuel, but you can only hold ${activeShip.maxFuel}.`);
            return;
        }
        if (activeShip.fuel < requiredFuel) {
            this.uiManager.queueModal('event-modal', "Insufficient Fuel", `You need ${requiredFuel} fuel but only have ${Math.floor(activeShip.fuel)}.`);
            return;
        }

        const isFirstTutorialFlight = state.tutorials.activeBatchId === 'intro_missions' && state.tutorials.activeStepId === 'mission_1_6';
        if (!isFirstTutorialFlight) {
            if (this._checkForRandomEvent(locationId)) {
                return;
            }
        }

        this.initiateTravel(locationId);
    }

    /**
     * Executes the core travel logic: applies fuel costs and hull damage, advances time, and shows the animation.
     * @param {string} locationId - The destination location ID.
     * @param {object} [eventMods={}] - Modifications to travel parameters from a random event.
     */
    initiateTravel(locationId, eventMods = {}) {
        const state = this.gameState.getState();
        const fromId = state.currentLocationId;
        let travelInfo = { ...state.TRAVEL_DATA[fromId][locationId] };
        this.logger.info.player(state.day, 'TRAVEL_START', `Departing from ${fromId} to ${locationId}.`);

        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelInfo.time = Math.round(travelInfo.time * DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
            travelInfo.fuelCost = Math.round(travelInfo.fuelCost * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        if (eventMods.travelTimeAdd) travelInfo.time += eventMods.travelTimeAdd;
        if (eventMods.travelTimeAddPercent) travelInfo.time *= (1 + eventMods.travelTimeAddPercent);
        if (eventMods.setTravelTime) travelInfo.time = eventMods.setTravelTime;
        travelInfo.time = Math.max(1, Math.round(travelInfo.time));

        const activeShip = this.simulationService._getActiveShip();
        const activeShipState = this.gameState.player.shipStates[activeShip.id];
        
        if (activeShip.fuel < travelInfo.fuelCost) {
            this.uiManager.queueModal('event-modal', "Insufficient Fuel", `Trip modifications left you without enough fuel. You need ${travelInfo.fuelCost} but only have ${Math.floor(activeShip.fuel)}.`);
            this.logger.warn('TravelService', `Travel to ${locationId} aborted due to insufficient fuel after event mods.`);
            return;
        }

        if (eventMods.forceEvent) {
            if (this._checkForRandomEvent(locationId, true)) {
                return;
            }
        }

        let travelHullDamage = travelInfo.time * GAME_RULES.HULL_DECAY_PER_TRAVEL_DAY;
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) travelHullDamage *= DB.PERKS[PERK_IDS.NAVIGATOR].hullDecayMod;
        const eventHullDamageValue = activeShip.maxHealth * ((eventMods.eventHullDamagePercent || 0) / 100);
        const totalHullDamageValue = travelHullDamage + eventHullDamageValue;
        
        activeShipState.health -= totalHullDamageValue;
        this.simulationService._checkHullWarnings(activeShip.id);

        if (activeShipState.health <= 0) {
            this._handleShipDestruction(activeShip.id);
            return;
        }
        
        activeShipState.fuel -= travelInfo.fuelCost;
        this.timeService.advanceDays(travelInfo.time);
        if (this.gameState.isGameOver) return;
        
        this.gameState.setState({ currentLocationId: locationId, pendingTravel: null });

        // --- [MODIFICATION] ---
        // Call onLocationChange *after* arrival and state update,
        // but *before* the animation modal. This populates the queue
        // so it's ready the moment the player docks.
        this.simulationService.newsTickerService.onLocationChange();
        // --- [END MODIFICATION] ---

        const fromLocation = DB.MARKETS.find(m => m.id === fromId);
        const destination = DB.MARKETS.find(m => m.id === locationId);
        
        if (!fromLocation || !destination) {
            this.logger.error('TravelService', `Invalid location ID provided for travel animation. From: ${fromId}, To: ${locationId}`);
            this.uiManager.queueModal('event-modal', 'Navigation Error', 'Could not plot a course. The destination is unknown.');
            return;
        }

        const totalHullDamagePercentForDisplay = (totalHullDamageValue / activeShip.maxHealth) * 100;
        
        this.logger.info.player(this.gameState.day, 'TRAVEL_END', `Arrived at ${locationId}.`, {
            fuelUsed: travelInfo.fuelCost,
            hullDamage: totalHullDamagePercentForDisplay.toFixed(2) + '%'
        });

        const finalCallback = () => {
            if (this.gameState.tutorials.activeBatchId === 'intro_missions' && this.gameState.tutorials.activeStepId === 'mission_1_7' && locationId === LOCATION_IDS.LUNA) {
                this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
            } else {
                this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            }
        };
        
        this.uiManager.showTravelAnimation(fromLocation, destination, travelInfo, totalHullDamagePercentForDisplay, finalCallback);
    }
    
    /**
     * Resumes a pending travel action after it was interrupted by an event.
     */
    resumeTravel() {
        if (!this.gameState.pendingTravel) return;
        this.logger.info.system('Game', this.gameState.day, 'TRAVEL_RESUME', 'Resuming travel after event.');
        const { destinationId, ...eventMods } = this.gameState.pendingTravel;
        this.initiateTravel(destinationId, eventMods);
    }

    /**
     * Checks for and triggers a random event based on a probability roll.
     * @param {string} destinationId
     * @param {boolean|number} [force=false]
     * @returns {boolean}
     * @private
     */
    _checkForRandomEvent(destinationId, force = false) {
        if (force === false && Math.random() > GAME_RULES.RANDOM_EVENT_CHANCE) return false;

        const activeShip = this.simulationService._getActiveShip();
        let event;

        if (typeof force === 'number') {
            event = DB.RANDOM_EVENTS[force];
        } else {
             const validEvents = DB.RANDOM_EVENTS.filter(event => 
                event.precondition(this.gameState.getState(), activeShip, this.simulationService._getActiveInventory.bind(this.simulationService))
            );
            if (validEvents.length === 0) return false;
            event = validEvents[Math.floor(Math.random() * validEvents.length)];
        }
        
        if (!event) {
            this.logger.warn('TravelService', `Debug event trigger failed for index: ${force}`);
            return false;
        }
        
        this.logger.info.system('Event', this.gameState.day, 'EVENT_TRIGGER', `Triggered random event: ${event.title}`);
        this.gameState.setState({ pendingTravel: { destinationId } });
        this.uiManager.showRandomEventModal(event, (eventId, choiceIndex) => this._resolveEventChoice(eventId, choiceIndex));
        return true;
    }

    /**
     * Resolves the player's choice in a random event and applies the outcome.
     * @param {string} eventId
     * @param {number} choiceIndex
     * @private
     */
    _resolveEventChoice(eventId, choiceIndex) {
        const event = DB.RANDOM_EVENTS.find(e => e.id === eventId);
        const choice = event.choices[choiceIndex];
        let random = Math.random();
        const chosenOutcome = choice.outcomes.find(o => (random -= o.chance) < 0) || choice.outcomes[choice.outcomes.length - 1];
    
        const effectResult = this._applyEventEffects(chosenOutcome);
    
        let description = chosenOutcome.description;
        if (effectResult && chosenOutcome.descriptions) {
            description = chosenOutcome.descriptions[effectResult.key];
            if (effectResult.amount) {
                description = description.replace('{amount}', effectResult.amount);
            }
        }
    
        this.logger.info.player(this.gameState.day, 'EVENT_CHOICE', `Chose '${choice.title}' for event '${event.title}'.`);
        this.uiManager.queueModal('event-modal', event.title, description, () => this.resumeTravel(), {
            buttonText: 'Continue Journey'
        });
    }

    /**
     * Applies a list of effects from a chosen event outcome by calling the effect resolver.
     * @param {object} outcome
     * @private
     */
    _applyEventEffects(outcome) {
        let result = null;
        outcome.effects.forEach(effect => {
            const effectResult = applyEffect(this.gameState, this.simulationService, effect, outcome);
            if (effectResult) {
                result = effectResult;
            }
        });
        this.gameState.setState({});
        return result;
    }

    /**
     * Handles the destruction of a player ship and the potential game over condition.
     * @param {string} shipId
     * @private
     */
    _handleShipDestruction(shipId) {
        const shipName = DB.SHIPS[shipId].name;
        this.logger.error('TravelService', `Ship ${shipName} was destroyed.`);
        this.gameState.player.ownedShipIds = this.gameState.player.ownedShipIds.filter(id => id !== shipId);
        delete this.gameState.player.shipStates[shipId];
        delete this.gameState.player.inventories[shipId];

        if (this.gameState.player.ownedShipIds.length === 0) {
            this.simulationService._gameOver(`Your last ship, the ${shipName}, was destroyed. Your trading career ends here.`);
        } else {
            this.gameState.player.activeShipId = this.gameState.player.ownedShipIds[0];
            const newShipName = DB.SHIPS[this.gameState.player.activeShipId].name;
            const message = `The ${shipName} suffered a catastrophic hull breach and was destroyed. All cargo was lost.<br><br>You now command your backup vessel, the ${newShipName}.`;
            this.uiManager.queueModal('event-modal', 'Vessel Lost', message);
        }
        this.gameState.setState({});
    }
}