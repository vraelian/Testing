// js/ui/components/CargoScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Cargo screen.
 * It is responsible for displaying the contents of the player's active ship's cargo hold.
 * The new design features a grid of small cargo items ('min-cargo') that expand into
 * a detailed modal view ('max-cargo').
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS } from '../../data/constants.js';

/**
 * Renders the entire Cargo screen UI, displaying a grid of items.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Cargo screen.
 */
export function renderCargoScreen(gameState) {
    const inventory = gameState.player.inventories[gameState.player.activeShipId];
    if (!inventory) return '<p class="text-center text-gray-500 text-lg">No active ship.</p>';

    const ownedGoods = Object.entries(inventory).filter(([, item]) => item.quantity > 0);

    if (ownedGoods.length === 0) {
        return '<p class="text-center text-gray-500 text-lg">Your cargo hold is empty.</p>';
    }

    const cargoItemsHtml = ownedGoods.map(([goodId, item]) => {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        return _renderMinCargoItem(good, item);
    }).join('');

    return `<div class="cargo-grid">${cargoItemsHtml}</div>`;
}

/**
 * Renders a single small, clickable cargo item for the grid view.
 * @param {object} good - The static data for the commodity from the database.
 * @param {object} item - The player's inventory data for the item (quantity, avgCost).
 * @returns {string} The HTML for a single min-cargo item.
 * @private
 */
function _renderMinCargoItem(good, item) {
    // Reusing the style map from the previous implementation for visual consistency.
    const styleMap = {
        'item-style-1':  { hex: '#60a5fa', gradient: 'linear-gradient(45deg, #3b82f6, #1e3a8a)' },
        'item-style-2':  { hex: '#a3a3a3', gradient: 'linear-gradient(45deg, #737373, #262626)' },
        'item-style-3':  { hex: '#22c55e', gradient: 'linear-gradient(45deg, #16a34a, #14532d)' },
        'item-style-4':  { hex: '#e5e5e5', gradient: 'linear-gradient(45deg, #d4d4d4, #737373)' },
        'item-style-5':  { hex: '#c084fc', gradient: 'linear-gradient(45deg, #a855f7, #6b21a8)' },
        'item-style-6':  { hex: '#93c5fd', gradient: 'linear-gradient(45deg, #60a5fa, #2563eb)' },
        'item-style-7':  { hex: '#84cc16', gradient: 'linear-gradient(45deg, #a3e635, #4d7c0f)' },
        'item-style-8':  { hex: '#67e8f9', gradient: 'linear-gradient(45deg, #22d3ee, #0891b2)' },
        'item-style-9':  { hex: '#fcd34d', gradient: 'linear-gradient(45deg, #facc15, #b45309)' },
        'item-style-10': { hex: '#fb7185', gradient: 'linear-gradient(45deg, #f43f5e, #9f1239)' },
        'item-style-11': { hex: '#a78bfa', gradient: 'linear-gradient(165deg, #a78bfa, #312e81, #1e3a8a)' },
        'item-style-12': { hex: '#f87171', gradient: 'linear-gradient(45deg, #ef4444, #7f1d1d)' },
        'item-style-13': { hex: '#d8b4fe', gradient: 'linear-gradient(45deg, #a855f7, #3b0764)' },
        'item-style-14': { hex: '#f472b6', gradient: 'linear-gradient(45deg, #ec4899, #831843)' },
    };
    const styles = styleMap[good.styleClass] || { hex: '#a8a29e', gradient: 'linear-gradient(45deg, #52525b, #18181b)' };

    return `
        <div class="min-cargo-item" 
             style="background: ${styles.gradient}; border: 2px solid ${styles.hex};"
             data-action="show_cargo_detail" 
             data-good-id="${good.id}">
            
            <div class="pt-symbol" style="font-size: 2rem; color: ${styles.hex}; text-shadow: 0 0 5px rgba(0,0,0,0.7);">${good.symbol.toUpperCase()}</div>
            <div class="pt-quantity" style="color: #fff; text-shadow: 1px 1px 3px #000;">(${item.quantity})</div>
        </div>
    `;
}