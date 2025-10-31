// js/services/bot/actions/Action_Refuel.js
/**
 * @fileoverview This file contains the BotAction_Refuel class.
 * This is a smart, multi-step action responsible for ensuring the
 * ship has a target amount of fuel.
 *
 * It will:
 * 1. Check if it's already at Jupiter.
 * 2. If not, it will travel to Jupiter.
 * 3. If it's "stranded" (not enough fuel to reach Jupiter),
 * it will buy just-enough expensive local fuel to make the trip.
 * 4. Once at Jupiter, it will refuel to the target amount.
 */

import { BotAction } from './BotAction.js';
import { LOCATION_IDS, PERK_IDS } from '../../data/constants.js';
import { DB } from '../../data/database.js';

export class BotAction_Refuel extends BotAction {
    /**
     * @param {import('../goals/BotGoal.js').BotGoal} goal - The goal that owns this action.
     * @param {number | null} targetFuelAmount - The amount of fuel to acquire.
     * If null, refuels to max.
     */
    constructor(goal, targetFuelAmount = null) {
        super(goal, `ACTION_REFUEL`);
        this.targetFuelAmount = targetFuelAmount;

        /**
         * Internal state for this action's own state machine.
         * @type {'INITIAL_CHECK' | 'TRAVELLING_TO_JUPITER' | 'REFUELING_AT_JUPITER'}
         */
        this.internalState = 'INITIAL_CHECK';
    }

    /**
     * Activates the refuel action.
     * @override
     */
    activate() {
        super.activate(); // Sets status to 'ACTIVE'

        const ship = this.simulationService._getActiveShip();
        if (!ship) {
            this.logger.warn(this.persona.personaId, `Action ${this.actionId} FAILED: No active ship.`);
            this.status = 'FAILED';
            return;
        }

        // If no target is specified, set target to max fuel.
        if (this.targetFuelAmount === null) {
            this.targetFuelAmount = ship.maxFuel;
        }

        // Check if we already have enough fuel.
        const currentFuel = this.gameState.player.shipStates[ship.id].fuel;
        if (currentFuel >= this.targetFuelAmount) {
            this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Action ${this.actionId} complete (fuel already sufficient).`);
            this.status = 'COMPLETED';
        }
    }

    /**
     * Processes the refuel action state machine.
     * @override
     * @returns {Promise<void>}
     */
    async process() {
        if (this.status !== 'ACTIVE') {
            return;
        }

        const ship = this.simulationService._getActiveShip();
        if (!ship) {
            this.status = 'FAILED';
            return;
        }
        const shipState = this.gameState.player.shipStates[ship.id];

        switch (this.internalState) {
            case 'INITIAL_CHECK':
                // Check if we are at Jupiter.
                if (this.gameState.currentLocationId === LOCATION_IDS.JUPITER) {
                    // We are at the right place.
                    this.internalState = 'REFUELING_AT_JUPITER';
                } else {
                    // We need to travel to Jupiter.
                    const state = this.gameState.getState();
                    const travelInfo = state.TRAVEL_DATA[state.currentLocationId][LOCATION_IDS.JUPITER];
                    const fuelToJupiter = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

                    if (shipState.fuel < fuelToJupiter) {
                        // STRANDED: Buy just enough local fuel to get to Jupiter.
                        this.logger.warn(this.persona.personaId, `Stranded at ${state.currentLocationId}. Buying expensive local fuel just to reach Jupiter.`);
                        this._performRefuel(fuelToJupiter + 5, true); // true = local prices
                    }
                    
                    // Now travel (either we had enough, or we just bought enough)
                    this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Traveling to ${LOCATION_IDS.JUPITER} for refueling.`);
                    this.simulationService.travelService.initiateTravel(LOCATION_IDS.JUPITER);
                    this.internalState = 'TRAVELLING_TO_JUPITER';
                }
                break;

            case 'TRAVELLING_TO_JUPITER':
                // Wait until travel is complete.
                if (this.gameState.pendingTravel === null) {
                    if (this.gameState.currentLocationId === LOCATION_IDS.JUPITER) {
                        this.internalState = 'REFUELING_AT_JUPITER';
                    } else {
                        this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: Travel ended, but not at Jupiter.`);
                        this.status = 'FAILED';
                    }
                }
                break;

            case 'REFUELING_AT_JUPITER':
                this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Arrived at Jupiter. Refueling to ${this.targetFuelAmount}.`);
                this._performRefuel(this.targetFuelAmount, false); // false = cheap Jupiter prices
                this.status = 'COMPLETED'; // Refueling is synchronous
                break;
        }
    }

    /**
     * Internal refuel logic, adapted from the legacy AutomatedPlayer.
     * This will log costs to the persona's metrics object.
     * @param {number} targetFuelAmount - The amount of fuel to buy.
     * @param {boolean} [useLocalPrice=false] - Whether to use expensive local price (if stranded)
     * @private
     */
    _performRefuel(targetFuelAmount, useLocalPrice = false) {
        const ship = this.simulationService._getActiveShip();
        if (!ship) return;
        
        const finalTargetFuel = Math.min(ship.maxFuel, targetFuelAmount);
        const fuelNeeded = finalTargetFuel - this.gameState.player.shipStates[ship.id].fuel;
        
        if (fuelNeeded <= 0) return;
        
        const currentMarket = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        let fuelPrice = currentMarket.fuelPrice;
        
        // Use cheap Jupiter price (half) unless specified otherwise
        if (this.gameState.currentLocationId === LOCATION_IDS.JUPITER && !useLocalPrice) {
            fuelPrice /= 2;
        }

        // Apply Venetian Syndicate discount (only at Venus, but check anyway)
        if (this.gameState.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && this.gameState.currentLocationId === LOCATION_IDS.VENUS) {
             fuelPrice *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        fuelPrice = Math.max(1, Math.round(fuelPrice));

        const ticksNeeded = Math.ceil(fuelNeeded / 5); // 5 fuel per tick
        const totalCost = ticksNeeded * fuelPrice;
        const fuelToBuy = ticksNeeded * 5;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            this.gameState.player.shipStates[ship.id].fuel = Math.min(ship.maxFuel, this.gameState.player.shipStates[ship.id].fuel + fuelToBuy);
            this.simulationService._logConsolidatedTransaction('fuel', -totalCost, 'Fuel Purchase');
            this.persona.metrics.totalFuelCost += totalCost;
        } else {
            // Buy as much as possible
            const affordableTicks = Math.floor(this.gameState.player.credits / fuelPrice);
            if (affordableTicks > 0) {
                const cost = affordableTicks * fuelPrice;
                this.gameState.player.credits -= cost;
                this.gameState.player.shipStates[ship.id].fuel += (affordableTicks * 5);
                this.simulationService._logConsolidatedTransaction('fuel', -cost, 'Fuel Purchase');
                this.persona.metrics.totalFuelCost += cost;
            }
        }
    }
}