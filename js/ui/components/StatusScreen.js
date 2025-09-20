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
    const { player, day, currentLocationId } = gameState;
    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = player.shipStates[player.activeShipId];
    const inventory = player.inventories[player.activeShipId];
    const cargoUsed = calculateInventoryUsed(inventory);
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };
    const shipClassLower = shipStatic.class.toLowerCase();

    // Active Ship Bar component logic from Hangar screen
    const hullPercent = Math.floor((shipState.health / shipStatic.maxHealth) * 100);
    const fuelPercent = Math.floor((shipState.fuel / shipStatic.maxFuel) * 100);
    const cargoSegments = Array.from({ length: Math.max(10, Math.min(25, Math.floor(shipStatic.cargoCapacity / 8))) }, (_, i) => {
        const filledSegments = Math.round((cargoUsed / shipStatic.cargoCapacity) * Math.max(10, Math.min(25, Math.floor(shipStatic.cargoCapacity / 8))));
        return `<div class="segment ${i < filledSegments ? 'filled' : ''}"></div>`;
    }).join('');

    const activeShipBarHtml = `
        <div class="ship-bar-wrapper bg-class-${shipClassLower} class-${shipClassLower}" style="cursor: default;">
            <div class="status-sidelabel sidelabel-active">ACTIVE</div>
            <div class="main-content">
                <div class="ship-info-top">
                    <div class="ship-info">
                        <span class="ship-name class-${shipClassLower}">${shipStatic.name}</span>
                        <span class="ship-class">Class ${shipStatic.class}</span>
                    </div>
                    <div class="ship-stats-text">
                        <span class="stat-hull">HULL: <span class="value">${hullPercent}%</span></span>
                        <span class="stat-fuel">FUEL: <span class="value">${fuelPercent}%</span></span>
                    </div>
                </div>
                <div class="bottom-line">
                    <div class="cargo-bar">${cargoSegments}</div>
                    <div class="cargo-text">CARGO: <span class="value">${cargoUsed}/${shipStatic.cargoCapacity}</span></div>
                </div>
            </div>
        </div>
    `;

    return `
        <div class="status-scroll-panel">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/30 p-4 rounded-lg mb-6 items-start">
                <div class="md:col-span-2 h-full p-4 rounded-lg flex items-center justify-between transition-all duration-500 panel-border border" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                    <div class="text-left pl-4">
                        <span class="block text-lg uppercase tracking-widest" style="color: ${theme.textColor}a0;">Day</span>
                        <span class="text-4xl font-bold font-orbitron">${day}</span>
                    </div>
                    <div class="text-right flex flex-col items-end">
                        <p class="text-xs font-roboto-mono text-right" style="color: ${theme.textColor}cc;">${getDateFromDay(day)}</p>
                        <div class="mt-2 pt-2 border-t" style="border-color: ${theme.textColor}50;">
                            <div class="text-right">
                                <p class="text-sm tracking-wider" style="color: ${theme.textColor}a0;">Vessel</p>
                                <p>${shipStatic.name}</p>
                                <p>Class: ${shipStatic.class}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="md:col-span-1 flex flex-col gap-4">
                    ${activeShipBarHtml}
                    <div class="text-center text-lg font-orbitron flex items-center justify-center gap-2" style="color: ${theme.textColor};">
                        <span>${player.playerTitle} ${player.name}, ${player.playerAge}</span>
                    </div>
                </div>
            </div>
        </div>`;
}