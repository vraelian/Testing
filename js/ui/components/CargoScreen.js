// js/ui/components/CargoScreen.js
/**
 * @fileoverview
 * This file contains the rendering logic for the Cargo screen.
 * It displays the contents of the active ship's cargo hold.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

/**
 * Renders the entire Cargo screen.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Cargo screen.
 */
export function renderCargoScreen(gameState) {
    const inventory = gameState.player.inventories[gameState.player.activeShipId];
    const ownedGoods = Object.entries(inventory).filter(([, item]) => item.quantity > 0);
    
    let content;
    if (ownedGoods.length > 0) {
        content = `<div class="flex justify-center flex-wrap gap-4">
            ${ownedGoods.map(([goodId, item]) => {
                const good = DB.COMMODITIES.find(c => c.id === goodId);
                const tooltipText = `${good.lore}\n\nAvg. Cost: ${formatCredits(item.avgCost, false)}`;
                return `<div class="p-2 rounded-lg border-2 ${good.styleClass} cargo-item-tooltip" style="filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.4));" data-tooltip="${tooltipText}"><div class="font-semibold text-sm commodity-name text-outline">${good.name}</div><div class="text-lg text-center text-cyan-300 text-outline">(${item.quantity})</div></div>`;
            }).join('')}
        </div>`;
    } else {
        content = '<p class="text-center text-gray-500 text-lg">Your cargo hold is empty.</p>';
    }

    return `
        <div class="mt-8 pt-6">
            <h3 class="text-2xl font-orbitron text-center mb-4">Active Ship Cargo Manifest</h3>
            ${content}
        </div>`;
}