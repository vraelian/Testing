// js/ui/components/StatusScreen.js
/**
 * @fileoverview This file contains the rendering logic for the main Status screen.
 * It serves as the primary dashboard for the player, displaying the current date,
 * and player status information.
 */
import { DB } from '../../data/database.js';
import { getDateFromDay } from '../../utils.js';

/**
 * Renders the entire Status screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Status screen.
 */
export function renderStatusScreen(gameState) {
    const { player, day, currentLocationId } = gameState;
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };

    return `
        <div class="status-scroll-panel">
            <div class="flex flex-col gap-4 bg-black/30 p-4 rounded-lg">
                <div class="h-full p-4 rounded-lg flex items-center justify-between transition-all duration-500 panel-border border" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                    <div class="text-left pl-4">
                        <span class="block text-lg uppercase tracking-widest" style="color: ${theme.textColor}a0;">Day</span>
                        <span class="text-4xl font-bold font-orbitron">${day}</span>
                    </div>
                    <div class="text-right flex flex-col items-end">
                        <p class="text-xs font-roboto-mono text-right" style="color: ${theme.textColor}cc;">${getDateFromDay(day)}</p>
                    </div>
                </div>

                <div class="text-center text-lg font-orbitron flex items-center justify-center gap-2" style="color: ${theme.textColor};">
                    <span>${player.playerTitle} ${player.name}, ${player.playerAge}</span>
                </div>
            </div>
        </div>`;
}