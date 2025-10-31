// js/services/bot/actions/Action_BuyItem.js
/**
 * @fileoverview This file contains the BotAction_BuyItem class.
 * This is a multi-step action responsible for buying a specific
 * quantity of a good from a specific market.
 *
 * It will:
 * 1. Check if the bot is at the correct location.
 * 2. If not, it will create and run a sub-action (Action_TravelTo)
 * to travel to the market.
 * 3. Once at the market, it will calculate the max amount it can buy
 * (up to the desired quantity) and execute the purchase.
 * 4. It will log the transaction details to the persona's metrics.
 */

import { BotAction } from './BotAction.js';
import { BotAction_TravelTo } from './Action_TravelTo.js';
import { calculateInventoryUsed } from '../../../utils.js';

export class BotAction_BuyItem extends BotAction {
    /**
     * @param {import('../goals/BotGoal.js').BotGoal} goal - The goal that owns this action.
     * @param {string} goodId - The ID of the commodity to buy.
     * @param {number} quantity - The desired quantity to buy.
     * @param {string} locationId - The location ID to buy from.
     */
    constructor(goal, goodId, quantity, locationId) {
        super(goal, `ACTION_BUY_ITEM_${goodId}`);
        this.goodId = goodId;
        this.quantity = quantity;
        this.locationId = locationId;

        /**
         * A slot to hold a sub-action, like traveling.
         * @type {BotAction | null}
         */
        this.subAction = null;
    }

    /**
     * Activates the buy action.
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
        // and the process() method will handle the purchase immediately.
    }

    /**
     * Processes the buy action.
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

        // --- Step 2: We are at the correct location, perform the buy ---
        if (this.gameState.currentLocationId !== this.locationId) {
            // This should not happen if the travel sub-action worked.
            this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: At wrong location after travel.`);
            this.status = 'FAILED';
            return;
        }

        const state = this.gameState.getState();
        const price = state.market.prices[this.locationId][this.goodId];
        
        // Calculate the actual quantity to buy
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!ship || !inventory) {
            this.logger.error(this.persona.personaId, `Action ${this.actionId} FAILED: No active ship/inventory.`);
            this.status = 'FAILED';
            return;
        }
        
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        const canAfford = (price > 0) ? Math.floor(state.player.credits / price) : Infinity;
        const stock = state.market.inventory[this.locationId][this.goodId].quantity;
        
        const actualBuyQty = Math.max(0, Math.min(space, canAfford, stock, this.quantity));

        if (actualBuyQty > 0) {
            // Perform the purchase
            this.simulationService.playerActionService.buyItem(this.goodId, actualBuyQty);
            this.logger.info.system(this.persona.personaId, this.gameState.day, this.goal.goalId, `Bought ${actualBuyQty}x ${this.goodId} @ ${this.locationId}`);
            
            // This action is now complete.
            this.status = 'COMPLETED';
            
        } else if (this.quantity > 0) {
            // We wanted to buy, but couldn't (no stock, no space, no money).
            this.logger.warn(this.persona.personaId, this.gameState.day, this.goal.goalId, `Action ${this.actionId} could not buy ${this.goodId} (Qty: 0, Stock: ${stock}, Space: ${space}, CanAfford: ${canAfford})`);
            // We consider this a "soft" failure. The action is "complete"
            // because it can't do anything more, but the goal might fail.
            // For now, we'll mark it COMPLETED to avoid a loop.
            this.status = 'COMPLETED';
        } else {
            // Desired quantity was 0, so we are done.
            this.status = 'COMPLETED';
        }
    }
}