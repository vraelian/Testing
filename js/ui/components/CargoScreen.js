// js/ui/components/CargoScreen.js
/**
 * @fileoverview Renders the cargo screen, displaying the items in the active ship's inventory.
 */
import { DB } from '../../data/database.js';
import { calculateInventoryUsed } from '../../utils.js';

/**
 * Generates the HTML for the cargo screen.
 * @param {object} gameState The current game state.
 * @returns {string} The HTML string for the cargo screen.
 */
export function renderCargoScreen(gameState) {
    const { player } = gameState;
    const activeShipId = player.activeShipId;

    if (!activeShipId) {
        return '<p class="text-center text-xl text-gray-400">No active ship selected.</p>';
    }

    const ship = DB.SHIPS[activeShipId];
    const inventory = player.inventories[activeShipId];
    const cargoUsed = calculateInventoryUsed(inventory);

    const itemsHtml = DB.COMMODITIES
        .filter(commodity => inventory[commodity.id] && inventory[commodity.id].quantity > 0)
        .map(commodity => {
            const item = inventory[commodity.id];
            return `
                <div class="cargo-item-tooltip" data-tooltip="${commodity.name}">
                    <div class="cargo-item-card" style="background-color: ${commodity.colors.bg}; border-color: ${commodity.colors.border};">
                        <div class="base-concept">
                            <div class="pt-header">
                                <span class="pt-number">${String(commodity.id).padStart(3, '0')}</span>
                                <span class="pt-category">${commodity.category}</span>
                            </div>
                            <div class="pt-symbol-wrapper">
                                <div class="pt-symbol" style="-webkit-text-stroke: 1.1px ${commodity.colors.symbolStroke}; color: ${commodity.colors.symbolFill};">${commodity.symbol}</div>
                                <div class="pt-quantity">${item.quantity.toLocaleString()}</div>
                            </div>
                            <div class="pt-name">${commodity.name}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    const emptySlots = ship.cargoCapacity - cargoUsed;
    const emptySlotsHtml = Array.from({ length: emptySlots }, () => `
        <div class="w-[118px] h-[118px] border border-dashed border-slate-700 rounded-lg bg-slate-800/20"></div>
    `).join('');

    const cargoBarHtml = `
        <div class="w-full bg-slate-700 rounded-full h-2.5">
            <div class="bg-amber-500 h-2.5 rounded-full" style="width: ${(cargoUsed / ship.cargoCapacity) * 100}%"></div>
        </div>`;

    return `
        <div class="flex flex-col h-full">
            <div class="text-center mb-4 flex-shrink-0">
                <h2 class="text-3xl font-orbitron text-cyan-300">Active Cargo Hold</h2>
                <p class="text-lg font-roboto-mono text-slate-400">${cargoUsed} / ${ship.cargoCapacity} units used</p>
                <div class="max-w-md mx-auto mt-2">${cargoBarHtml}</div>
            </div>
            <div class="scroll-panel">
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 justify-center">
                    ${itemsHtml}
                    ${emptySlotsHtml}
                </div>
            </div>
        </div>
    `;
}