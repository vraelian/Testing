// js/services/bot/actions/Action_SellItem.js
/**
 * @fileoverview This file contains the BotAction_SellItem class.
 * This is a multi-step action responsible for selling a specific
 * quantity of a good at a specific market.
 *
 * It will:
 * 1. Check if the bot is at the correct location.
 * 2. If not, it will create and run a sub-action (Action_TravelTo)
 * to travel to the market.
 * 3. Once at the market, it will sell the desired quantity (or
 * whatever is available in the cargo) and execute the sale.
 * 4. It will log the profit details to the persona's metrics.
 */

import { BotAction } from './BotAction.js';
import { BotAction_TravelTo } from './Action_TravelTo.js';

export class BotAction_SellItem extends BotAction {
    /**
     * @param {import('../goals/BotGoal.js').BotGoal} goal - The goal that owns this action.
     * @param {string} goodId - The ID of the commodity to sell.
     * @param {number} quantity - The desired quantity to sell (will sell all if cargo has less).
     * @param {string} locationId - The location ID to sell at.
     */
    constructor(goal, goodId, quantity, locationId) {
        super(goal, `ACTION_SELL_ITEM_${goodId}`);
        this.goodId = goodId;
        this.quantity = quantity; // This is the *desired* quantity
        this.locationId = locationId;

        /**
         * A slot to hold a sub-action, like traveling.
         * @type {BotAction | null}
         */
        this.subAction = null;
    }

    /**
     * Activates the sell action.
     * @override
     */
    activate() {
        super.activate(); // Sets status to 'ACTIVE'

        // Check if we are already at the location.
        if (this.gameState.currentLocationId !== this.locationId) {
            // If not, our first step is to travel.
            this.subAction = new BotAction_TravelTo(this.goal, this.locationId);
            this.subAction.activate();
        }
        // If we are already at the location, subAction remains null,
        // and the process() method will handle the sale immediately.
    }

    /**
     * Processes the sell action.
     * @override
     * @returns {Promise<void>}
     */
    async process() {
        if (this.status !== 'ACTIVE') {
            return;
        }

        // --- Step 1: Handle any sub-actions (like traveling) ---
        if (this.subAction) {
            await this.subAction.process();

            if (this.subAction.isCompleted()) {
                // Travel is done.
                this.subAction = null;
            } else if (this.subAction.isFailed()) {
                // Travel failed, so this action fails.
                this.logger.warn(this.persona.personaId, `Action ${this.actionId} FAILED because sub-action ${this.subAction.actionId} failed.`);
                this.status = 'FAILED';
                return;
            } else {
                // Sub-action is still in progress (e.g., traveling),
                // so we wait for the next tick.
                return;
            }
        }

        // --- Step 2: We are at the correct location, perform the sell ---
        if (this.gameState.currentLocationId !== this.locationId) {
            this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: At wrong location after travel.`);
            this.status = 'FAILED';
            return;
        }

        const inventory = this.simulationService._getActiveInventory();
        if (!inventory) {
            this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: No active inventory.`);
            this.status = 'FAILED';
            return;
        }

        const itemInCargo = inventory[this.goodId];
        const availableQty = itemInCargo ? itemInCargo.quantity : 0;
        
        if (availableQty <= 0) {
            this.logger.warn(this.persona.personaId, this.gameState.day, this.goal.goalId, `Action ${this.actionId} complete (nothing to sell).`);
            this.status = 'COMPLETED';
            return;
        }

        // Sell the desired quantity or the total available, whichever is less.
        const actualSellQty = Math.min(availableQty, this.quantity);
        const avgCost = itemInCargo.avgCost;

        // Perform the sale
        const saleValue = this.simulationService.playerActionService.sellItem(this.goodId, actualSellQty);
        const profit = saleValue - (avgCost * actualSellQty);

        this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Sold ${actualSellQty}x ${this.goodId} @ ${this.locationId}. Profit: ${profit}`);

        // --- Step 3: Log metrics to the Persona ---
        const metrics = this.persona.metrics;
        metrics.totalTrades++;
        metrics.totalNetProfit += profit;
        if (profit > 0) {
            metrics.profitableTrades++;
        }

        // Track profit by good
        if (!metrics.profitByGood[this.goodId]) {
            metrics.profitByGood[this.goodId] = 0;
        }
        metrics.profitByGood[this.goodId] += profit;

        // This action is now complete.
        this.status = 'COMPLETED';
    }
}