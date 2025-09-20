// js/ui/components/CargoScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Cargo screen.
 * It is responsible for displaying the contents of the player's active ship's cargo hold,
 * including item quantities and tooltips with lore and average cost.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

/**
 * Renders the entire Cargo screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Cargo screen.
 */
export function renderCargoScreen(gameState) {
    const inventory = gameState.player.inventories[gameState.player.activeShipId];
    const ownedGoods = Object.entries(inventory).filter(([, item]) => item.quantity > 0);

    // Maps the commodity's style class to its color scheme and background gradient.
    const styleMap = {
        'item-style-1':  { hex: '#60a5fa', rgb: '96, 165, 250', gradient: 'linear-gradient(45deg, #3b82f6, #1e3a8a)' },
        'item-style-2':  { hex: '#a3a3a3', rgb: '163, 163, 163', gradient: 'linear-gradient(45deg, #737373, #262626)' },
        'item-style-3':  { hex: '#22c55e', rgb: '34, 197, 94', gradient: 'linear-gradient(45deg, #16a34a, #14532d)' },
        'item-style-4':  { hex: '#e5e5e5', rgb: '229, 229, 229', gradient: 'linear-gradient(45deg, #d4d4d4, #737373)' },
        'item-style-5':  { hex: '#c084fc', rgb: '192, 132, 252', gradient: 'linear-gradient(45deg, #a855f7, #6b21a8)' },
        'item-style-6':  { hex: '#93c5fd', rgb: '147, 197, 253', gradient: 'linear-gradient(45deg, #60a5fa, #2563eb)' },
        'item-style-7':  { hex: '#84cc16', rgb: '132, 204, 22', gradient: 'linear-gradient(45deg, #a3e635, #4d7c0f)' },
        'item-style-8':  { hex: '#67e8f9', rgb: '103, 232, 249', gradient: 'linear-gradient(45deg, #22d3ee, #0891b2)' },
        'item-style-9':  { hex: '#fcd34d', rgb: '252, 211, 77', gradient: 'linear-gradient(45deg, #facc15, #b45309)' },
        'item-style-10': { hex: '#fb7185', rgb: '251, 113, 133', gradient: 'linear-gradient(45deg, #f43f5e, #9f1239)' },
        'item-style-11': { hex: '#a78bfa', rgb: '167, 139, 250', gradient: 'linear-gradient(165deg, #a78bfa, #312e81, #1e3a8a)' },
        'item-style-12': { hex: '#f87171', rgb: '248, 113, 113', gradient: 'linear-gradient(45deg, #ef4444, #7f1d1d)' },
        'item-style-13': { hex: '#d8b4fe', rgb: '216, 180, 254', gradient: 'linear-gradient(45deg, #a855f7, #3b0764)' },
        'item-style-14': { hex: '#f472b6', rgb: '244, 114, 182', gradient: 'linear-gradient(45deg, #ec4899, #831843)' },
    };

    const renderColumn = (items) => items.map(([goodId, item]) => {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const styles = styleMap[good.styleClass] || { hex: '#a8a29e', rgb: '168, 162, 158', gradient: 'linear-gradient(45deg, #52525b, #18181b)' };
        const tooltipText = `${good.lore}\\n\\nAvg. Cost: ${formatCredits(item.avgCost, false)}`;

        return `
            <div 
                class="cargo-item-card cargo-item-tooltip" 
                style="background: ${styles.gradient}; border-color: ${styles.hex};" 
                data-tooltip="${tooltipText}">
                <div class="base-concept">
                    <div class="pt-header">
                        <div class="pt-number">TIER ${good.tier}</div>
                        <div class="pt-category">${good.cat}</div>
                    </div>
                    <div class="pt-symbol-wrapper">
                        <div class="pt-symbol">${good.symbol.toUpperCase()}</div>
                        <div class="pt-quantity" style="color: ${styles.hex};">(${item.quantity})</div>
                    </div>
                    <div class="pt-name">${good.name}</div>
                </div>
            </div>`;
    }).join('');

    let content;
    if (ownedGoods.length > 0) {
        const leftColItems = ownedGoods.filter((_, index) => index % 2 === 0);
        const rightColItems = ownedGoods.filter((_, index) => index % 2 !== 0);

        content = `
        <div class="flex flex-row justify-center gap-8">
            <div class="flex flex-col gap-4">${renderColumn(leftColItems)}</div>
            <div class="flex flex-col gap-4">${renderColumn(rightColItems)}</div>
        </div>`;

    } else {
        content = '<p class="text-center text-gray-500 text-lg">Your cargo hold is empty.</p>';
    }

    return `
        <div class="flex flex-col h-full flex-grow min-h-0">
             <div class="cargo-scroll-panel">
                ${content}
            </div>
        </div>`;
}