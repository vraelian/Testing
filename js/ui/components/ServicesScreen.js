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

    // --- Crash Fix: Check if activeShipId exists and its state data is available ---
    if (!player.activeShipId || !gameState.player.shipStates[player.activeShipId]) {
        return '<p class="text-center text-gray-500 text-lg mt-8">No active ship available for servicing.</p>';
    }
    // --- End Crash Fix ---

    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = gameState.player.shipStates[player.activeShipId]; // Now safe to access

    // --- Calculate Refuel Cost (logic mirrored from PlayerActionService.refuelTick) ---
    let fuelCostPerTick = DB.MARKETS.find(m => m.id === currentLocationId).fuelPrice / 2;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        fuelCostPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
    }
    fuelCostPerTick = Math.round(fuelCostPerTick);

    // --- Calculate Repair Cost (logic mirrored from PlayerActionService.repairTick) ---
    let repairCostPerTick = (shipStatic.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        repairCostPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
    }
    repairCostPerTick = Math.round(repairCostPerTick);

    // --- Calculate Percentages ---
    const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
    const healthPct = (shipState.health / shipStatic.maxHealth) * 100;

    // --- Determine UI States ---
    const isFuelFull = shipState.fuel >= shipStatic.maxFuel;
    const isHealthFull = shipState.health >= shipStatic.maxHealth;

    const canAffordRefuel = player.credits >= fuelCostPerTick;
    const canAffordRepair = player.credits >= repairCostPerTick;

    const isDisabledRefuel = isFuelFull || !canAffordRefuel;
    const isDisabledRepair = isHealthFull || !canAffordRepair;
    
    return `
        <div class="services-scroll-panel">
            <div class="flex flex-col md:flex-row justify-center items-center gap-8 max-w-4xl mx-auto mt-8">
              <div
                class="service-module w-full max-w-sm"
                style="--resource-color-rgb: 8, 217, 214; --resource-color: #08d9d6;"
              >
                <div class="bar-housing">
                  <div class="progress-bar-container w-full h-20 rounded-lg border border-gray-800 overflow-hidden relative">
                    <div class="absolute inset-0 z-10 flex justify-between items-center p-1.5 px-4 text-sm pointer-events-none">
                      <span class="font-electrolize font-bold tracking-wider uppercase text-cyan-300 text-outline" style="--glow-color: #08d9d6;">Fuel</span>
                      <span class="font-mono font-bold text-white text-outline" style="--glow-color: #08d9d6;">
                        ${Math.round(shipState.fuel)} / ${shipStatic.maxFuel}
                      </span>
                    </div>
                    <div id="fuel-bar" class="progress-bar-fill h-full rounded-md" style="width: ${fuelPct}%; background-color: #08d9d6; --glow-color: #08d9d6; background-image: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent); background-size: 40px 40px;"></div>
                  </div>
                  </div>
                <div class="control-deck flex justify-center items-center gap-4">
                  <div class="price-display-module w-32 h-12 flex justify-between items-center px-4">
                    <span class="price-label text-sm engraved-text">COST</span>
                    <span class="price-digits text-base ${canAffordRefuel ? 'credit-text' : 'text-red-500 shadow-red-500'}">
                        ${formatCredits(fuelCostPerTick, false)}
                    </span>
                  </div>
                  <button id="refuel-btn" class="industrial-button w-32 h-12 flex justify-center items-center text-center p-2 text-base font-orbitron uppercase tracking-wider transition-all duration-100 ease-in-out focus:outline-none" ${isDisabledRefuel ? 'disabled' : ''}>
                      <span class="engraved-text">${isFuelFull ? 'MAX' : 'Refuel'}</span>
                  </button>
                  </div>
              </div>

              <div
                class="service-module w-full max-w-sm"
                style="--resource-color-rgb: 34, 197, 94; --resource-color: #22c55e;"
              >
                <div class="bar-housing">
                  <div class="progress-bar-container w-full h-20 rounded-lg border border-gray-800 overflow-hidden relative">
                    <div class="absolute inset-0 z-10 flex justify-between items-center p-1.5 px-4 text-sm pointer-events-none">
                      <span class="font-electrolize font-bold tracking-wider uppercase text-cyan-300 text-outline" style="--glow-color: #22c55e;">Hull Integrity</span>
                      <span class="font-mono font-bold text-white text-outline" style="--glow-color: #22c5M">
                        ${Math.round(shipState.health)} / ${shipStatic.maxHealth}
                      </span>
                    </div>
                    <div id="repair-bar" class="progress-bar-fill h-full rounded-md" style="width: ${healthPct}%; background-color: #22c55e; --glow-color: #22c55e; background-image: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent); background-size: 40px 40px;"></div>
                  </div>
                  </div>
                <div class="control-deck flex justify-center items-center gap-4">
                  <div class="price-display-module w-32 h-12 flex justify-between items-center px-4">
                    <span class="price-label text-sm engraved-text">COST</span>
                    <span class="price-digits text-base ${canAffordRepair ? 'credit-text' : 'text-red-500 shadow-red-500'}">
                        ${formatCredits(repairCostPerTick, false)}
                    </span>
                  </div>
                  <button id="repair-btn" class="industrial-button w-32 h-12 flex justify-center items-center text-center p-2 text-base font-orbitron uppercase tracking-wider transition-all duration-100 ease-in-out focus:outline-none" ${isDisabledRepair ? 'disabled' : ''}>
                      <span class="engraved-text">${isHealthFull ? 'MAX' : 'Repair'}</span>
                  </button>
                  </div>
              </div>
            </div>
        </div>`;
}