// js/ui/components/CargoScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Cargo screen.
 * It is responsible for displaying the contents of the player's active ship's cargo hold.
 * The new design features a grid of small cargo items ('min-cargo') that expand into
 * a detailed modal view ('max-cargo').
 */
import { DB } from '../../data/database.js';
import { formatCredits, getCommodityStyle } from '../../utils.js';
import { AssetService } from '../../services/AssetService.js';
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
    const visualSeed = gameState.player.visualSeed; // Required for AssetService

    if (ownedGoods.length === 0) {
        return '<p class="text-center text-gray-500 text-lg">Your cargo hold is empty.</p>';
    }

    const cargoItemsHtml = ownedGoods.map(([goodId, item]) => {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        return _renderMinCargoItem(good, item, visualSeed);
    }).join('');

    return `<div class="cargo-scroll-panel"><div class="cargo-grid">${cargoItemsHtml}</div></div>`;
}

/**
 * Renders a single small, clickable cargo item for the grid view.
 * @param {object} good - The static data for the commodity from the database.
 * @param {object} item - The player's inventory data for the item (quantity, avgCost).
 * @param {number} visualSeed - The player's visual seed for generating consistent art.
 * @returns {string} The HTML for a single min-cargo item.
 * @private
 */
function _renderMinCargoItem(good, item, visualSeed) {
    const styles = getCommodityStyle(good.styleClass);
    const imagePath = AssetService.getCommodityImage(good.name, visualSeed);

    // BACKGROUND STACK: Scrim -> Image -> Fallback Gradient
    const scrimGradient = 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)';
    const backgroundStyle = `background: ${scrimGradient}, url('${imagePath}'), ${styles.gradient};`;

    // ABBREVIATION COLOR & CONTRAST LOGIC
    // Specific overrides for distinct "Very Light" colors + White for legacy support.
    const abbrevColorMap = {
        'CRYO': '#a5f3fc', // Very Light Turquoise
        'ATMO': '#fef08a', // Very Light Gold
        'CLON': '#fbcfe8', // Very Light Pink
        'AI':   '#fecaca', // Very Light Red
        'NPRO': '#ffffff', // White
        'CYB':  '#ffffff'  // White
    };

    const targetSymbol = good.symbol.toUpperCase();
    const isSpecial = abbrevColorMap.hasOwnProperty(targetSymbol);

    const abbrevColor = isSpecial ? abbrevColorMap[targetSymbol] : styles.hex;
    
    // Apply robust black outline to special items; standard shadow to others.
    const abbrevShadow = isSpecial 
        ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' 
        : '0 0 5px rgba(0,0,0,0.9)';

    return `
        <div class="min-cargo-item" 
             style="${backgroundStyle} border: 2px solid ${styles.hex};"
             data-action="show_cargo_detail" 
             data-good-id="${good.id}">
            
            <div class="pt-symbol" style="font-size: 2rem; color: ${abbrevColor}; text-shadow: ${abbrevShadow};">${targetSymbol}</div>
            <div class="pt-quantity">(${item.quantity})</div>
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

    // TIER LINE CONTRAST LOGIC (Universal)
    // Always use White Text with Black Outline for maximum readability
    const tierColor = '#ffffff';
    const tierShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';

    return `
        <div class="max-cargo-card" style="background: ${styles.gradient}; border-color: ${styles.hex};">
            <h3 class="text-2xl font-orbitron text-center">${good.name}</h3>
            <p class="text-sm text-center tier-type-line mb-4" style="color: ${tierColor}; text-shadow: ${tierShadow};">Tier ${good.tier} ${fullCategory}</p>
            <p class="flavor-text">${good.lore}</p>
            <div class="avg-cost">
                <div>Avg. Cost: <span class="font-bold credits-text-pulsing">${formatCredits(item.avgCost, true)}</span></div>
                <div>Qty Aboard: <span class="font-bold">${item.quantity}</span></div>
                <div>Avg. Value: <span class="font-bold credits-text-pulsing">${formatCredits(avgValue, true)}</span></div>
            </div>
        </div>
    `;
}