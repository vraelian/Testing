// js/ui/components/StatusScreen.js
/**
 * @fileoverview This file contains the rendering logic for the main Status screen.
 * It serves as the primary dashboard for the player, displaying the current date,
 * active ship information, and essential ship status metrics like hull, fuel, and cargo.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed, getDateFromDay } from '../../utils.js';

/**
 * Renders the entire Status screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Status screen.
 */
export function renderStatusScreen(gameState) {
    const { player, day } = gameState;
    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = player.shipStates[player.activeShipId];
    const inventory = player.inventories[player.activeShipId];
    const cargoUsed = calculateInventoryUsed(inventory);

    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/30 p-4 rounded-lg mb-6 items-start">
            <div class="md:col-span-2 h-full p-4 rounded-lg flex items-center justify-between transition-all duration-500 panel-border border border-slate-700">
                <div class="text-left pl-4">
                    <span class="block text-lg text-gray-400 uppercase tracking-widest">Day</span>
                    <span class="text-4xl font-bold font-orbitron">${day}</span>
                </div>
                <div class="text-right flex flex-col items-end">
                    <p class="text-xs text-cyan-200/80 mb-2 font-roboto-mono text-right">${getDateFromDay(day)}</p>
                    <div class="mt-2 pt-2 border-t border-slate-500/50">
                        <div class="text-right">
                            <p class="text-gray-400 text-sm tracking-wider">Vessel</p>
                            <p>${shipStatic.name}</p>
                            <p>Class: ${shipStatic.class}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="md:col-span-1 flex flex-col gap-4">
                <div class="ship-hud">
                    <h4 class="font-orbitron text-xl text-center mb-3 text-cyan-300">Ship Status</h4>
                    <div class="flex flex-col gap-y-2 text-sm">
                        <div class="tooltip-container" data-tooltip="Ship integrity. Damaged by travel.">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                                    <span class="text-gray-400">Hull:</span>
                                </div>
                                <span class="font-bold text-green-300">${Math.floor(shipState.health)}%</span>
                            </div>
                        </div>
                        <div class="tooltip-container" data-tooltip="Propulsion system fuel levels.">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path></svg>
                                    <span class="text-gray-400">Fuel:</span>
                                </div>
                                <span class="font-bold text-sky-300">${Math.floor(shipState.fuel)}/${shipStatic.maxFuel}</span>
                            </div>
                        </div>
                        <div class="tooltip-container" data-tooltip="Active ship's current/max cargo space.">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 000 2h6a1 1 0 100-2H6z" /><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2-2H4a2 2 0 01-2-2V5zm2-1a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V5a1 1 0 00-1-1H4z" clip-rule="evenodd" /></svg>
                                    <span class="text-gray-400">Cargo:</span>
                                </div>
                                <span class="font-bold text-amber-300">${cargoUsed}/${shipStatic.cargoCapacity}</span>
                            </div>
                        </div>
                     </div>
                </div>
                <div class="text-center text-lg text-cyan-200 font-orbitron flex items-center justify-center gap-2">
                    <span>${player.playerTitle} ${player.name}, ${player.playerAge}</span>
                </div>
            </div>
        </div>`;
}