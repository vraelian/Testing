// js/services/bot/goals/Goal_ExecuteSimpleTrade.js
/**
 * @fileoverview This file contains the Goal_ExecuteSimpleTrade class.
 * This is a high-level Goal that manages all the actions required
 * to complete a single A-B trade route.
 */

import { BotGoal } from './BotGoal.js';
import { BotAction_Refuel } from '../actions/Action_Refuel.js';
import { BotAction_TravelTo } from '../actions/Action_TravelTo.js';
import { BotAction_BuyItem } from '../actions/Action_BuyItem.js';
import { BotAction_SellItem } from '../actions/Action_SellItem.js';

export class Goal_ExecuteSimpleTrade extends BotGoal {
    /**
     * @param {import('../personas/BotPersona.js').BotPersona} persona - The persona that owns this goal.
     * @param {object} tradeRoute - The trade route object from the brain.
     * @param {string} tradeRoute.goodId
     * @param {string} tradeRoute.buyLocationId
     * @param {string} tradeRoute.sellLocationId
     * @param {number} tradeRoute.buyPrice
     * @param {number} tradeRoute.estimatedPPD
     */
    constructor(persona, tradeRoute) {
        super(persona, `GOAL_SIMPLE_TRADE_${tradeRoute.goodId}`);
        this.tradeRoute = tradeRoute;
    }

    /**
     * Activates the goal and builds its action queue.
     * @override
     */
    activate() {
        super.activate(); // Sets status to 'ACTIVE'

        const { goodId, buyLocationId, sellLocationId } = this.tradeRoute;
        
        // This is the core logic of the goal:
        // It defines the *entire* plan, step-by-step, using our
        // reusable action modules.

        // 1. Ensure we have enough fuel for the *entire* round trip *before* we start.
        // This is a "smarter" way to plan. A simpler plan would be to refuel
        // before each leg, but this is more efficient. We'll add a
        // simple `Action_Refuel` for now. A more complex Goal might calculate
        // the total fuel needed for both legs and pass that to the refuel action.
        // For now, a simple "top-off" at Jupiter is fine.
        this.actionQueue.push(new BotAction_Refuel(this, null)); // null = fill to max

        // 2. Buy the goods.
        // We'll tell it to buy *all* it can, as the trade-finding
        // logic already determined this is the best route.
        const ship = this.simulationService._getActiveShip();
        const buyQuantity = ship ? ship.cargoCapacity : 1; // Buy up to one full cargo load
        this.actionQueue.push(new BotAction_BuyItem(this, goodId, buyQuantity, buyLocationId));

        // 3. Sell the goods.
        // We will refuel again just in case the buy/sell are far apart.
        // This demonstrates how reusable actions create resilient plans.
        this.actionQueue.push(new BotAction_Refuel(this, null));
        
        // Sell *all* of the good we just bought.
        this.actionQueue.push(new BotAction_SellItem(this, goodId, Infinity, sellLocationId));
    }

    /**
     * Processes the goal.
     * The base BotGoal class handles processing the action queue,
     * so we don't need to override this unless we have
     * special logic (e.g., to check if the trade is still valid).
     * @override
     * @returns {Promise<void>}
     */
    async process() {
        // We can add logic here to check if the plan is still valid.
        // For example, if the price at the buy location has suddenly
        // spiked, we might want to abandon the goal.

        // For now, we will just let the base class process the queue.
        await super.process();
    }
}