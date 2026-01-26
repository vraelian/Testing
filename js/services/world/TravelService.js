// js/services/world/TravelService.js

/**
 * @fileoverview Handles all aspects of interstellar travel, including
 * initiating trips, calculating costs, and managing the random event system.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, SCREEN_IDS, NAV_IDS, PERK_IDS, LOCATION_IDS, ATTRIBUTE_TYPES, EVENT_CONSTANTS } from '../../data/constants.js';
import { applyEffect } from '../eventEffectResolver.js';
import { GameAttributes } from '../../services/GameAttributes.js';
import { RandomEventService } from '../RandomEventService.js';
import { formatCredits } from '../../utils.js';

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
        
        // Instantiate Event Engine
        this.randomEventService = new RandomEventService(); 
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

        // --- UPGRADE SYSTEM & Z-CLASS LOGIC ---
        const effectiveStats = this.simulationService.getEffectiveShipStats(activeShip.id);
        const effectiveMaxFuel = effectiveStats.maxFuel;
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        const shipState = state.player.shipStates[activeShip.id];
        const upgrades = shipState.upgrades || [];

        const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
        let requiredFuel = travelInfo.fuelCost;
        
        // 1. Apply Perk Modifier
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            requiredFuel = Math.round(requiredFuel * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        // 2. Apply Attribute/Upgrade Modifier
        const attrFuelMod = GameAttributes.getFuelBurnModifier(upgrades);
        requiredFuel = Math.round(requiredFuel * attrFuelMod);

        // --- Z-CLASS VALIDATION OVERRIDES ---
        
        // ATTR_METABOLIC_BURN: 50% Fuel Cost
        if (shipAttributes.includes('ATTR_METABOLIC_BURN')) {
            requiredFuel = Math.round(requiredFuel * 0.5);
        }

        // ATTR_SOLAR_HARMONY: 0 Fuel if traveling inward
        if (shipAttributes.includes('ATTR_SOLAR_HARMONY')) {
            const fromDist = DB.MARKETS.find(m => m.id === state.currentLocationId)?.distance || 0;
            const toDist = DB.MARKETS.find(m => m.id === locationId)?.distance || 0;
            if (toDist < fromDist) {
                requiredFuel = 0;
            }
        }

        // ATTR_NEWTONS_GHOST: 0 Fuel always (Cryo Pod)
        if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) {
            requiredFuel = 0;
        }

        // --- END Z-CLASS OVERRIDES ---

        if (effectiveMaxFuel < requiredFuel) {
            this.uiManager.queueModal('event-modal', "Fuel Capacity Insufficient", `Your ship's fuel tank is too small. This trip requires ${requiredFuel} fuel, but you can only hold ${effectiveMaxFuel}.`);
            return;
        }
        if (state.player.shipStates[activeShip.id].fuel < requiredFuel) {
            this.uiManager.queueModal('event-modal', "Insufficient Fuel", `You need ${requiredFuel} fuel but only have ${Math.floor(state.player.shipStates[activeShip.id].fuel)}.`);
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
     */
    initiateTravel(locationId, eventMods = {}) {
        const state = this.gameState.getState();
        const fromId = state.currentLocationId;
        let travelInfo = { ...state.TRAVEL_DATA[fromId][locationId] };
        this.logger.info.player(state.day, 'TRAVEL_START', `Departing from ${fromId} to ${locationId}.`);

        const activeShip = this.simulationService._getActiveShip();
        const activeShipState = this.gameState.player.shipStates[activeShip.id];
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        const upgrades = activeShipState.upgrades || [];

        // --- UPGRADE SYSTEM: Attribute Logic (Time & Fuel) ---
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelInfo.time = Math.round(travelInfo.time * DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
            travelInfo.fuelCost = Math.round(travelInfo.fuelCost * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        const attrFuelMod = GameAttributes.getFuelBurnModifier(upgrades);
        const attrTimeMod = GameAttributes.getTravelTimeModifier(upgrades);
        
        travelInfo.fuelCost = Math.round(travelInfo.fuelCost * attrFuelMod);
        travelInfo.time = Math.max(1, Math.round(travelInfo.time * attrTimeMod));

        // --- Z-CLASS EXECUTION LOGIC ---

        // ATTR_METABOLIC_BURN
        if (shipAttributes.includes('ATTR_METABOLIC_BURN')) {
            travelInfo.fuelCost = Math.round(travelInfo.fuelCost * 0.5);
        }

        // ATTR_HYPER_CALCULATION (-25% Time)
        if (shipAttributes.includes('ATTR_HYPER_CALCULATION')) {
            travelInfo.time = Math.max(1, Math.round(travelInfo.time * 0.75));
        }

        // ATTR_SOLAR_HARMONY (0 Fuel Inward)
        if (shipAttributes.includes('ATTR_SOLAR_HARMONY')) {
            const fromDist = DB.MARKETS.find(m => m.id === fromId)?.distance || 0;
            const toDist = DB.MARKETS.find(m => m.id === locationId)?.distance || 0;
            if (toDist < fromDist) {
                travelInfo.fuelCost = 0;
                this.uiManager.createFloatingText("Solar Harmony Active", window.innerWidth / 2, window.innerHeight / 2, '#fbbf24');
            }
        }

        // ATTR_NEWTONS_GHOST (0 Fuel, 10x Time)
        if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) {
            travelInfo.fuelCost = 0;
            travelInfo.time *= 10;
        }

        // Legacy: Sleeper
        shipAttributes.forEach(attrId => {
            const def = GameAttributes.getDefinition(attrId);
            if (def.type === ATTRIBUTE_TYPES.MOD_TRAVEL_TIME) {
                // Prevent double dipping if handled above, but legacy logic kept for safety
                if (attrId !== 'ATTR_HYPER_CALCULATION' && def.value) travelInfo.time *= def.value;
            }
            if (attrId === 'ATTR_SLEEPER') {
                travelInfo.time *= 4.5;
                travelInfo.fuelCost = 0;
            }
        });

        if (shipAttributes.includes('ATTR_SOLAR_SAIL')) {
            if (Math.random() < 0.15) {
                travelInfo.fuelCost = 0;
                travelInfo.time *= 2;
                this.uiManager.createFloatingText("Solar Winds Caught!", window.innerWidth / 2, window.innerHeight / 2, '#60a5fa');
            }
        }

        // --- PHASE 2: AGE PERK (TRAVEL SPEED) ---
        const speedBonus = state.player.statModifiers?.travelSpeed || 0;
        if (speedBonus > 0) {
            travelInfo.time = travelInfo.time / (1 + speedBonus);
        }

        if (eventMods.travelTimeAdd) travelInfo.time += eventMods.travelTimeAdd;
        if (eventMods.travelTimeAddPercent) travelInfo.time *= (1 + eventMods.travelTimeAddPercent);
        if (eventMods.setTravelTime) travelInfo.time = eventMods.setTravelTime;
        travelInfo.time = Math.max(1, Math.round(travelInfo.time));
        travelInfo.fuelCost = Math.round(travelInfo.fuelCost);

        if (activeShipState.fuel < travelInfo.fuelCost) {
            this.uiManager.queueModal('event-modal', "Insufficient Fuel", `Trip modifications left you without enough fuel. You need ${travelInfo.fuelCost} but only have ${Math.floor(activeShipState.fuel)}.`);
            return;
        }

        if (eventMods.forceEvent) {
            if (this._checkForRandomEvent(locationId, true)) {
                return;
            }
        }

        let travelHullDamage = travelInfo.time * GAME_RULES.HULL_DECAY_PER_TRAVEL_DAY;
        
        // --- Z-CLASS HULL LOGIC ---
        if (shipAttributes.includes('ATTR_XENO_HULL') || 
            shipAttributes.includes('ATTR_FLUID_HULL') || 
            shipAttributes.includes('ATTR_NO_DECAY')) {
            travelHullDamage = 0;
        } else if (shipAttributes.includes('ATTR_RESILIENT')) {
            travelHullDamage *= 0.5;
        }
        
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) travelHullDamage *= DB.PERKS[PERK_IDS.NAVIGATOR].hullDecayMod;
        
        const effectiveStats = this.simulationService.getEffectiveShipStats(activeShip.id);
        const eventHullDamageValue = effectiveStats.maxHealth * ((eventMods.eventHullDamagePercent || 0) / 100);
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
        
        this.simulationService.newsTickerService.onLocationChange(locationId);
        
        if (typeof this.gameState.player.tripCount === 'undefined') {
            this.gameState.player.tripCount = 0;
        }
        this.gameState.player.tripCount++;

        // --- Z-CLASS POST-TRAVEL LOGIC ---

        // ATTR_TRAVELLER (Atlas)
        if (shipAttributes.includes('ATTR_TRAVELLER') && this.gameState.player.tripCount % 20 === 0) {
            activeShipState.health = effectiveStats.maxHealth;
            activeShipState.fuel = effectiveStats.maxFuel;
            this.logger.info.player(state.day, 'ATTR_TRIGGER', 'Atlas systems engaged: Hull and Fuel fully restored.');
            this.uiManager.createFloatingText("Systems Restored", window.innerWidth / 2, window.innerHeight / 2, '#34d399');
        }

        // ATTR_OSSEOUS_REGROWTH (Shell That Echoes)
        if (shipAttributes.includes('ATTR_OSSEOUS_REGROWTH')) {
            const healAmount = effectiveStats.maxHealth * 0.10;
            if (activeShipState.health < effectiveStats.maxHealth) {
                activeShipState.health = Math.min(effectiveStats.maxHealth, activeShipState.health + healAmount);
                this.uiManager.createFloatingText("Hull Regenerated", window.innerWidth / 2, window.innerHeight / 2, '#e2e8f0');
            }
        }

        // ATTR_FUEL_SCOOP (Atlas)
        if (shipAttributes.includes('ATTR_FUEL_SCOOP')) {
            const fuelRestore = effectiveStats.maxFuel * 0.15;
            activeShipState.fuel = Math.min(effectiveStats.maxFuel, activeShipState.fuel + fuelRestore);
        }

        // ATTR_MATTER_ABSORPTION (Finality of Whispers) - CHANGED: Refund 50% of cost
        if (shipAttributes.includes('ATTR_MATTER_ABSORPTION')) {
            const refund = travelInfo.fuelCost * 0.5;
            if (refund > 0) {
                activeShipState.fuel = Math.min(effectiveStats.maxFuel, activeShipState.fuel + refund);
                this.uiManager.createFloatingText(`Fuel Refunded: +${Math.round(refund)}`, window.innerWidth / 2, window.innerHeight / 2 + 30, '#991b1b');
            }
        }
        
        this.gameState.setState({ currentLocationId: locationId, pendingTravel: null });

        const fromLocation = DB.MARKETS.find(m => m.id === fromId);
        const destination = DB.MARKETS.find(m => m.id === locationId);
        
        if (!fromLocation || !destination) {
            this.logger.error('TravelService', `Invalid location ID provided for travel animation. From: ${fromId}, To: ${locationId}`);
            this.uiManager.queueModal('event-modal', 'Navigation Error', 'Could not plot a course. The destination is unknown.');
            return;
        }

        const totalHullDamagePercentForDisplay = (totalHullDamageValue / effectiveStats.maxHealth) * 100;
        
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
     * Uses Event System 2.0 (RandomEventService).
     * @param {string} destinationId
     * @param {boolean|number} [force=false]
     * @returns {boolean}
     * @private
     */
    _checkForRandomEvent(destinationId, force = false) {
        // --- UPGRADE SYSTEM: Event Modifier ---
        const activeShip = this.simulationService._getActiveShip();
        const shipState = this.gameState.player.shipStates[activeShip.id];
        const upgrades = shipState.upgrades || [];
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        
        let eventChance = GAME_RULES.RANDOM_EVENT_CHANCE;

        // Apply Upgrade Modifier (Radar Mod - Additive)
        const chanceMod = GameAttributes.getEventChanceModifier(upgrades);
        eventChance += chanceMod;

        // ATTR_ADVANCED_COMMS: +25% chance
        if (shipAttributes.includes('ATTR_ADVANCED_COMMS')) {
            eventChance *= 1.25;
        }
        // --- END UPGRADE SYSTEM ---

        if (force === false && Math.random() > eventChance) return false;

        let event;

        if (typeof force === 'number') {
            event = DB.RANDOM_EVENTS[force];
        } else {
            const contextTags = [EVENT_CONSTANTS.TAGS.SPACE]; 
            event = this.randomEventService.tryTriggerEvent(this.gameState, this.simulationService, contextTags);
        }
        
        if (!event) return false;
        
        this.logger.info.system('Event', this.gameState.day, 'EVENT_TRIGGER', `Triggered random event: ${event.title}`);
        this.gameState.setState({ pendingTravel: { destinationId } });
        
        this.uiManager.showRandomEventModal(event, (choiceId) => this._resolveEventChoice(event.id, choiceId));
        return true;
    }

    /**
     * Resolves the player's choice in a random event and applies the outcome using RandomEventService.
     * @param {string} eventId
     * @param {string} choiceId
     * @private
     */
    _resolveEventChoice(eventId, choiceId) {
        const result = this.randomEventService.resolveChoice(eventId, choiceId, this.gameState, this.simulationService);

        if (!result) {
            this.logger.error('TravelService', 'Event resolution returned null.');
            this.resumeTravel();
            return;
        }

        let effectsHtml = '';
        if (result.effects && result.effects.length > 0) {
            effectsHtml = '<ul class="list-none text-sm text-gray-400 mt-4 space-y-1">';
            result.effects.forEach(eff => {
                let effectText = '';
                switch (eff.type) {
                    case 'EFF_CREDITS':
                        effectText = `Credits: ${eff.value > 0 ? '+' : ''}${formatCredits(eff.value)}`;
                        break;
                    case 'EFF_FUEL':
                        effectText = `Fuel: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)}`;
                        break;
                    case 'EFF_HULL':
                        effectText = `Hull: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)}`;
                        break;
                    case 'EFF_TRAVEL_TIME':
                    case 'EFF_MODIFY_TRAVEL':
                        effectText = `Travel Time: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)} Days`;
                        break;
                    case 'EFF_ADD_ITEM':
                        effectText = `Received: ${Math.round(eff.value)}x ${eff.target}`; 
                        break;
                    case 'EFF_REMOVE_ITEM':
                        effectText = `Removed: ${Math.round(eff.value)}x ${eff.target}`;
                        break;
                    case 'EFF_LOSE_RANDOM_CARGO':
                         effectText = `Cargo Lost: ${Math.round(eff.value * 100)}%`;
                         break;
                    default:
                        effectText = `Effect Applied`;
                }
                effectsHtml += `<li>${effectText}</li>`;
            });
            effectsHtml += '</ul>';
        }
    
        this.logger.info.player(this.gameState.day, 'EVENT_CHOICE', `Chose outcome: ${result.outcomeId}`);
        
        this.uiManager.queueModal('event-result-modal', result.title, result.text + effectsHtml, () => this._postEventCheck(), {
            dismissOutside: true,
            buttonText: 'Continue Journey'
        });
    }

    /**
     * Checks for critical failures (Hull or Fuel depletion) after an event outcome.
     * If failed, aborts the travel. If healthy, resumes travel.
     * @private
     */
    _postEventCheck() {
        const ship = this.simulationService._getActiveShip();
        if (!ship) { 
            this.resumeTravel(); 
            return; 
        }

        // 1. Check Destruction (Hull <= 0)
        if (ship.health <= 0) {
            this.gameState.pendingTravel = null;
            this._handleShipDestruction(ship.id);
            return;
        }

        // 2. Check Fuel Depletion (Fuel <= 0) -> Tow Back Logic
        if (ship.fuel <= 0) {
            this.gameState.pendingTravel = null;
            
            this.gameState.player.shipStates[ship.id].fuel = 0;
            
            this.logger.info.player(this.gameState.day, 'TRAVEL_ABORT', `Ship ran out of fuel after event. Towed back to port.`);
            
            const originName = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId)?.name || "Port";
            
            this.uiManager.queueModal(
                'event-modal', 
                'Fuel Depleted', 
                `Your engines sputter and die, leaving you drifting in the void. <br><br>After days of signaling, a passing freighter tows you back to <b>${originName}</b>. The rescue fees have left you with an empty tank.`
            );
            
            this.gameState.setState({});
            return;
        }

        // 3. All Systems Nominal - Proceed
        this.resumeTravel();
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