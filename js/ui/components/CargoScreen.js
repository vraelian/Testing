// js/ui/components/CargoScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Cargo screen.
 * It is responsible for displaying the contents of the player's active ship's cargo hold.
 * The new design features a grid of small cargo items ('min-cargo') that expand into
 * a detailed modal view ('max-cargo').
 */
import { DB } from '../../data/database.js';
import { formatCredits, getCommodityStyle } from '../../utils.js';
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

    return `<div class="cargo-scroll-panel"><div class="cargo-grid">${cargoItemsHtml}</div></div>`;
}

/**
 * Renders a single small, clickable cargo item for the grid view.
 * @param {object} good - The static data for the commodity from the database.
 * @param {object} item - The player's inventory data for the item (quantity, avgCost).
 * @returns {string} The HTML for a single min-cargo item.
 * @private
 */
function _renderMinCargoItem(good, item) {
    const styles = getCommodityStyle(good.styleClass);

    return `
        <div class="min-cargo-item" 
             style="background: ${styles.gradient}; border: 2px solid ${styles.hex};"
             data-action="show_cargo_detail" 
             data-good-id="${good.id}">
            
            <div class="pt-symbol" style="font-size: 2rem; color: ${styles.hex}; text-shadow: 0 0 5px rgba(0,0,0,0.7);">${good.symbol.toUpperCase()}</div>
            <div class="pt-quantity text-gray-400" style="text-shadow: 1px 1px 3px #000;">(${item.quantity})</div>
        </div>
    `;
}

/**
 * Renders the detailed modal view for a selected cargo item.
 * @param {object} good - The static data for the commodity.
 * @param {object} item - The player's inventory data for the item.
 * @returns {string} The HTML for the max-cargo modal content.
 */
export function _renderMaxCargoModal(good, item) {
    const styles = getCommodityStyle(good.styleClass);

    const categoryMap = {
        RAW: 'Raw Material',
        IND: 'Industrial Product',
        AGRI: 'Agricultural Good',
        TECH: 'Technology',
        CIV: 'Civilian Commodity',
        BIO: 'Bioware',
        RARE: 'Exotic Material'
    };
    const fullCategory = categoryMap[good.cat] || 'Unknown';

    const galacticAvg = (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
    const avgValue = galacticAvg * item.quantity;

    return `
        <div class="max-cargo-card" style="background: ${styles.gradient}; border-color: ${styles.hex};">
            <h3 class="text-2xl font-orbitron text-center">${good.name}</h3>
            <p class="text-sm text-center tier-type-line mb-4" style="color: ${styles.hex};">Tier ${good.tier} ${fullCategory}</p>
            <p class="flavor-text">${good.lore}</p>
            <div class="avg-cost">
                <div>Avg. Cost: <span class="font-bold credits-text-pulsing">${formatCredits(item.avgCost, true)}</span></div>
                <div>Qty Aboard: <span class="font-bold">${item.quantity}</span></div>
                <div>Avg. Value: <span class="font-bold credits-text-pulsing">${formatCredits(avgValue, true)}</span></div>
            </div>
        </div>
    `;
}