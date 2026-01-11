// js/services/world/TravelService.js

/**
 * @fileoverview Handles all aspects of interstellar travel, including
 * initiating trips, calculating costs, and managing the random event system.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, SCREEN_IDS, NAV_IDS, PERK_IDS, LOCATION_IDS, ATTRIBUTE_TYPES } from '../../data/constants.js';
import { applyEffect } from '../eventEffectResolver.js';
import { GameAttributes } from '../../services/GameAttributes.js';

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
        
        // --- VIRTUAL WORKBENCH: Attribute Integration ---
        // 1. Apply Perk Modifier
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            requiredFuel = Math.round(requiredFuel * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        // 2. Apply Ship Attribute Modifiers (e.g., Efficient, Sleeper)
        const attrFuelMod = GameAttributes.getFuelCostModifier(activeShip.id);
        requiredFuel = Math.round(requiredFuel * attrFuelMod);

        // 3. Handle Special "Space Folding" Case (Increases fuel cost)
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        if (shipAttributes.includes('ATTR_SPACE_FOLDING')) {
            requiredFuel = Math.round(requiredFuel * 1.2);
        }
        // --- END VIRTUAL WORKBENCH ---

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

        const activeShip = this.simulationService._getActiveShip();
        const activeShipState = this.gameState.player.shipStates[activeShip.id];
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);

        // --- VIRTUAL WORKBENCH: Attribute Logic (Time & Fuel) ---
        
        // 1. Base Perk Modifiers
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelInfo.time = Math.round(travelInfo.time * DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
            travelInfo.fuelCost = Math.round(travelInfo.fuelCost * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        // 2. Apply Generic Attribute Modifiers
        const attrFuelMod = GameAttributes.getFuelCostModifier(activeShip.id);
        travelInfo.fuelCost = Math.round(travelInfo.fuelCost * attrFuelMod);

        // 3. Handle Time Modifiers & Complex Logic
        shipAttributes.forEach(attrId => {
            const def = GameAttributes.getDefinition(attrId);
            
            // Standard Time Modifiers (Heavy, Fast, Sleeper)
            if (def.type === ATTRIBUTE_TYPES.MOD_TRAVEL_TIME) {
                if (def.value) travelInfo.time *= def.value;
            }
            // Sleeper Special Case (Time x 4.5 handled via def.timeMod if structured, or manual here)
            if (attrId === 'ATTR_SLEEPER') {
                travelInfo.time *= 4.5;
                travelInfo.fuelCost = 0; // Ensure 0 fuel
            }
            // Space Folding (Fixed 1 day, 1.2x Fuel)
            if (attrId === 'ATTR_SPACE_FOLDING') {
                travelInfo.time = 1;
                travelInfo.fuelCost *= 1.2;
            }
        });

        // 4. Handle "Solar Sail" Probability (15% chance: 0 fuel, 2x time)
        if (shipAttributes.includes('ATTR_SOLAR_SAIL')) {
            if (Math.random() < 0.15) {
                travelInfo.fuelCost = 0;
                travelInfo.time *= 2;
                this.uiManager.createFloatingText("Solar Winds Caught!", window.innerWidth / 2, window.innerHeight / 2, '#60a5fa');
            }
        }
        // --- END VIRTUAL WORKBENCH ---

        if (eventMods.travelTimeAdd) travelInfo.time += eventMods.travelTimeAdd;
        if (eventMods.travelTimeAddPercent) travelInfo.time *= (1 + eventMods.travelTimeAddPercent);
        if (eventMods.setTravelTime) travelInfo.time = eventMods.setTravelTime;
        travelInfo.time = Math.max(1, Math.round(travelInfo.time));
        travelInfo.fuelCost = Math.round(travelInfo.fuelCost); // Final integer round

        
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
        
        // --- VIRTUAL WORKBENCH: Hull Decay Attributes ---
        // Xeno Hull (No decay) or Resilient (Half decay)
        if (shipAttributes.includes('ATTR_XENO_HULL')) {
            travelHullDamage = 0;
        } else if (shipAttributes.includes('ATTR_RESILIENT')) {
            travelHullDamage *= 0.5;
        }
        // --- END VIRTUAL WORKBENCH ---

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
        
        // --- [[START]] MODIFICATION ---
        // Call onLocationChange() *before* setState.
        this.simulationService.newsTickerService.onLocationChange(locationId);
        
        // --- VIRTUAL WORKBENCH: Post-Travel Triggers ---
        // Initialize trip count if missing
        if (typeof this.gameState.player.tripCount === 'undefined') {
            this.gameState.player.tripCount = 0;
        }
        this.gameState.player.tripCount++;

        // 1. ATTR_TRAVELLER (Atlas): Restore hull/fuel every 20 trips
        if (shipAttributes.includes('ATTR_TRAVELLER') && this.gameState.player.tripCount % 20 === 0) {
            activeShipState.health = activeShip.maxHealth;
            activeShipState.fuel = activeShip.maxFuel;
            this.logger.info.player(state.day, 'ATTR_TRIGGER', 'Atlas systems engaged: Hull and Fuel fully restored.');
            this.uiManager.createFloatingText("Systems Restored", window.innerWidth / 2, window.innerHeight / 2, '#34d399');
        }

        // 2. ATTR_FUEL_SCOOP (Parallax): Restore 15% fuel
        if (shipAttributes.includes('ATTR_FUEL_SCOOP')) {
            const fuelRestore = activeShip.maxFuel * 0.15;
            activeShipState.fuel = Math.min(activeShip.maxFuel, activeShipState.fuel + fuelRestore);
        }
        // --- END VIRTUAL WORKBENCH ---
        
        this.gameState.setState({ currentLocationId: locationId, pendingTravel: null });
        // --- [[END]] MODIFICATION ---

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
        // --- VIRTUAL WORKBENCH: Attribute Integration ---
        const activeShip = this.simulationService._getActiveShip();
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        let eventChance = GAME_RULES.RANDOM_EVENT_CHANCE;

        // ATTR_ADVANCED_COMMS: +25% chance
        if (shipAttributes.includes('ATTR_ADVANCED_COMMS')) {
            eventChance *= 1.25;
        }
        // --- END VIRTUAL WORKBENCH ---

        if (force === false && Math.random() > eventChance) return false;

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