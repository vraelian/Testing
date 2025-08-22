// js/ui/components/ServicesScreen.js
/**
 * @fileoverview
 * This file contains the rendering logic for the Station Services screen.
 * It displays options for refueling and repairing the player's active ship.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { GAME_RULES, PERK_IDS, LOCATION_IDS } from '../../data/constants.js';

/**
 * Renders the entire Services screen.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Services screen.
 */
export function renderServicesScreen(gameState) {
    const { player, currentLocationId } = gameState;
    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = player.shipStates[player.activeShipId];
    const currentMarket = DB.MARKETS.find(m => m.id === currentLocationId);

    let fuelPrice = currentMarket.fuelPrice / 2;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        fuelPrice *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
    }
    
    let costPerRepairTick = (shipStatic.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        costPerRepairTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
    }

    const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
    const healthPct = (shipState.health / shipStatic.maxHealth) * 100;
    
    return `
         <div class="text-center mb-4">
            <h3 class="text-2xl font-orbitron">Station Services at ${currentMarket.name}</h3>
            <div id="services-credits-display" class="text-lg text-cyan-300 mt-2"><span class="text-cyan-400">⌬ </span><span class="font-bold text-cyan-300 ml-auto">${formatCredits(player.credits, false)}</span></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div class="bg-black/20 p-4 rounded-lg text-center shadow-lg panel-border border border-slate-700">
                <h4 class="font-orbitron text-xl mb-2">Refueling</h4>
                <p class="mb-3">Price: <span class="font-bold text-cyan-300">${formatCredits(fuelPrice, false)}</span> / 5 units</p>
                <button id="refuel-btn" class="btn btn-green w-full py-3" ${shipState.fuel >= shipStatic.maxFuel ? 'disabled' : ''}>Hold to Refuel</button>
                <div class="w-full hud-stat-bar mt-2"><div id="fuel-bar" style="width: ${fuelPct}%" class="bg-sky-400"></div></div>
            </div>
            <div class="bg-black/20 p-4 rounded-lg text-center shadow-lg panel-border border border-slate-700">
                <h4 class="font-orbitron text-xl mb-2">Ship Maintenance</h4>
                <p class="mb-3">Price: <span class="font-bold text-cyan-300">${formatCredits(costPerRepairTick, false)}</span> / 5% repair</p>
                <button id="repair-btn" class="btn btn-blue w-full py-3" ${shipState.health >= shipStatic.maxHealth ? 'disabled' : ''}>Hold to Repair</button>
                <div class="w-full hud-stat-bar mt-2"><div id="repair-bar" style="width: ${healthPct}%" class="bg-green-400"></div></div>
            </div>
        </div>`;
}