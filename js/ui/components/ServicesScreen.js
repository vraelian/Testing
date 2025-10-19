// js/ui/components/ServicesScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Station Services screen.
 * It displays options for refueling and repairing the player's active ship, calculating
 * costs based on the current location and any active player perks.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { GAME_RULES, PERK_IDS, LOCATION_IDS } from '../../data/constants.js';

/**
 * Renders the entire Services screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Services screen.
 */
export function renderServicesScreen(gameState) {
    const { player, currentLocationId } = gameState;
    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = player.shipStates[player.activeShipId];
    const currentMarket = DB.MARKETS.find(m => m.id === currentLocationId);
    const theme = currentMarket?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };


    // Calculate fuel price, applying perks if applicable.
    let fuelPrice = currentMarket.fuelPrice / 2;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        fuelPrice *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
    }
    
    // Calculate repair price per tick, applying perks if applicable.
    let costPerRepairTick = (shipStatic.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        costPerRepairTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
    }

    const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
    const healthPct = (shipState.health / shipStatic.maxHealth) * 100;
    
    // Scrap Bar - Initial render values (will be updated by UIManager)
    const initialScrapText = `${Math.floor(player.metalScrap || 0)} TONS`;
    const initialFillPercent = 0; // UIManager will calculate correct fill on render

    return `
        <div class="services-scroll-panel">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-8">
                
                <div id="services-refuel" class="p-4 rounded-lg text-center shadow-lg panel-border border" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                    <h4 class="font-orbitron text-xl mb-2">Refueling</h4>
                    <p class="mb-3">Price: <span class="font-bold">⌬ ${formatCredits(fuelPrice, false)}</span> / 5 units</p>
                    <button id="refuel-btn" class="btn w-full py-3" ${shipState.fuel >= shipStatic.maxFuel ? 'disabled' : ''}>Hold to Refuel</button>
                    <div class="w-full hud-stat-bar mt-2"><div id="fuel-bar" style="width: ${fuelPct}%" class="bg-sky-400"></div></div>
                </div>

                <div id="services-hull-repair" class="p-4 rounded-lg text-center shadow-lg panel-border border" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                    <h4 class="font-orbitron text-xl mb-2">Ship Maintenance</h4>
                    <p class="mb-3">Price: <span class="font-bold">⌬ ${formatCredits(costPerRepairTick, false)}</span> / 5% repair</p>
                    <button id="repair-btn" class="btn w-full py-3" ${shipState.health >= shipStatic.maxHealth ? 'disabled' : ''}>Hold to Repair</button>
                    <div class="w-full hud-stat-bar mt-2"><div id="repair-bar" style="width: ${healthPct}%" class="bg-green-400"></div></div>
                </div>

                <div id="scrap-bar-container" class="md:col-span-2 p-4 rounded-lg shadow-lg panel-border border" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                    <h4 class="font-orbitron text-xl mb-3 text-center">Salvaged Materials</h4>
                    <div id="scrap-bar" class="relative w-full h-8 rounded overflow-hidden"> 
                        <div id="scrap-bar-fill" class="h-full transition-width duration-300 ease-in-out" style="width: ${initialFillPercent}%;"></div>
                        <div id="scrap-bar-text" class="absolute inset-0 flex items-center justify-center font-bold font-orbitron uppercase">${initialScrapText}</div>
                    </div>
                 </div>

            </div>
        </div>`;
}