// js/ui/components/ServicesScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Station Services screen.
 * It displays options for refueling and repairing the player's active ship, calculating
 * costs based on the current location and any active player perks.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { GAME_RULES, PERK_IDS, LOCATION_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js';

/**
 * Renders the entire Services screen UI.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/SimulationService.js').SimulationService} simulationService - The simulation service.
 * @returns {string} The HTML content for the Services screen.
 */
export function renderServicesScreen(gameState, simulationService) {
    const { player, currentLocationId } = gameState;

    // VIRTUAL WORKBENCH: Added Starport Name map (Request B)
    const STARPORT_NAMES = {
        [LOCATION_IDS.VENUS]: "Venetian Cloudport",
        [LOCATION_IDS.EARTH]: "Earth Starport",
        [LOCATION_IDS.LUNA]: "Lunar Starport",
        [LOCATION_IDS.MARS]: "Martian Starport",
        [LOCATION_IDS.BELT]: "Belt Station",
        [LOCATION_IDS.EXCHANGE]: "The Exchange",
        [LOCATION_IDS.JUPITER]: "Jupiter Starport",
        [LOCATION_IDS.SATURN]: "Saturn Starport",
        [LOCATION_IDS.URANUS]: "Uranus Starport",
        [LOCATION_IDS.NEPTUNE]: "Neptune Starport",
        [LOCATION_IDS.KEPLER]: "Kepler's Eye",
        [LOCATION_IDS.PLUTO]: "The Fringe",
    };

    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };
    const themeStyleVars = `
        --theme-gradient: ${theme.gradient}; 
        --theme-text-color: ${theme.textColor}; 
        --theme-border-color: ${theme.borderColor};
    `;
    // VIRTUAL WORKBENCH: Use new name map
    const locationName = STARPORT_NAMES[currentLocationId] || 'UNKNOWN STARPORT';

    // --- Crash Fix: Check if activeShipId exists and its state data is available ---
    if (!player.activeShipId || !gameState.player.shipStates[player.activeShipId]) {
        // VIRTUAL WORKBENCH: Updated header fallback
        return `
            <div class="flex flex-col h-full">
                <div class="themed-header-bar mb-4" style="${themeStyleVars}">
                    <div class="themed-header-title">${locationName}</div>
                </div>
                <div class="services-scroll-panel flex-grow min-h-0">
                    <div class="ship-services-panel max-w-4xl mx-auto" style="${themeStyleVars}">
                        <div class="themed-header-bar">
                            <div class="ship-header-title">NO ACTIVE SHIP</div>
                        </div>
                        <div class="p-4 md:p-8">
                            <p class="text-center text-gray-500 text-lg">No active ship available for servicing.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // --- END VIRTUAL WORKBENCH ---
    }
    // --- End Crash Fix ---

    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = gameState.player.shipStates[player.activeShipId]; // Now safe to access
    const shipName = shipStatic?.name || 'NO ACTIVE SHIP'; // VIRTUAL WORKBENCH: Get ship name
    const upgrades = shipState.upgrades || [];

    // --- UPGRADE SYSTEM: Effective Stats ---
    // Use SimulationService to get stats with modifiers (e.g. +20% Fuel from Tanks)
    // If simulationService is missing (legacy safety), fallback to static stats
    let effectiveMaxHealth = shipStatic.maxHealth;
    let effectiveMaxFuel = shipStatic.maxFuel;

    if (simulationService && simulationService.getEffectiveShipStats) {
        const stats = simulationService.getEffectiveShipStats(player.activeShipId);
        if (stats) {
            effectiveMaxHealth = stats.maxHealth;
            effectiveMaxFuel = stats.maxFuel;
        }
    }

    // --- Calculate Refuel Cost ---
    let fuelCostPerTick = DB.MARKETS.find(m => m.id === currentLocationId).fuelPrice / 2;
    // 1. Perk Modifier
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        fuelCostPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
    }
    // 2. Upgrade Modifier (Fuel Pass)
    const fuelAttrMod = GameAttributes.getServiceCostModifier(upgrades, 'refuel');
    fuelCostPerTick *= fuelAttrMod;
    
    fuelCostPerTick = Math.max(1, Math.round(fuelCostPerTick));

    // --- Calculate Repair Cost ---
    // Base cost is derived from Effective Max Health
    let repairCostPerTick = (effectiveMaxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
    // 1. Perk Modifier
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        repairCostPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
    }
    // 2. Upgrade Modifier (Repair Pass)
    const repairAttrMod = GameAttributes.getServiceCostModifier(upgrades, 'repair');
    repairCostPerTick *= repairAttrMod;

    repairCostPerTick = Math.max(1, Math.round(repairCostPerTick));

    // --- Calculate Percentages (Using Effective Max) ---
    const fuelPct = (shipState.fuel / effectiveMaxFuel) * 100;
    const healthPct = (shipState.health / effectiveMaxHealth) * 100;

    // --- Determine UI States ---
    const isFuelFull = shipState.fuel >= effectiveMaxFuel;
    const isHealthFull = shipState.health >= effectiveMaxHealth;

    const canAffordRefuel = player.credits >= fuelCostPerTick;
    const canAffordRepair = player.credits >= repairCostPerTick;

    const isDisabledRefuel = isFuelFull || !canAffordRefuel;
    const isDisabledRepair = isHealthFull || !canAffordRepair;
    
    // VIRTUAL WORKBENCH: Wrapped in flex container, updated header, added new ship header
    return `
        <div class="flex flex-col h-full">
            <div class="themed-header-bar mb-4" style="${themeStyleVars}">
                <div class="themed-header-title">${locationName}</div>
            </div>
            <div class="services-scroll-panel flex-grow min-h-0">
                
                <div class="ship-services-panel max-w-4xl mx-auto" style="${themeStyleVars}">
                    <div class="themed-header-bar">
                        <div class="ship-header-title">${shipName}</div>
                    </div>

                    <div class="flex flex-col md:flex-row justify-center items-center gap-8 p-4 md:p-8">
                      <div
                        class="service-module w-full max-w-sm"
                        style="--resource-color-rgb: 8, 217, 214; --resource-color: #08d9d6; --ot-cyan-base: #08d9d6;"
                      >
                        <div class="bar-housing">
                          <div class="progress-bar-container w-full h-20 rounded-lg border border-gray-800 overflow-hidden relative">
                            <div class="absolute inset-0 z-10 flex justify-between items-center p-1.5 px-4 text-sm pointer-events-none">
                              <span class="font-electrolize font-bold tracking-wider uppercase text-cyan-300 text-outline" style="--glow-color: #08d9d6;">Fuel</span>
                              <span class="font-mono font-bold text-white text-outline" style="--glow-color: #08d9d6;">
                                ${Math.round(shipState.fuel)} / ${effectiveMaxFuel}
                              </span>
                            </div>
                            <div id="fuel-bar" class="progress-bar-fill h-full rounded-md" style="width: ${fuelPct}%; background-color: #08d9d6; --glow-color: #08d9d6; background-image: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent); background-size: 40px 40px;"></div>
                          </div>
                        </div>
                        <div class="control-deck flex justify-center items-center gap-4">
                          <div class="price-display-module w-32 h-12 flex justify-between items-center px-4">
                            <span class="price-label text-sm engraved-text">COST</span>
                            <span class="price-digits text-base ${canAffordRefuel ? 'credits-text-pulsing' : 'text-red-500 shadow-red-500'}">
                              ${formatCredits(fuelCostPerTick, true)}
                            </span>
                          </div>
                          <button id="refuel-btn" class="industrial-button w-32 h-12 flex justify-center items-center text-center p-2 text-base font-orbitron uppercase tracking-wider transition-all duration-100 ease-in-out focus:outline-none" ${isDisabledRefuel ? 'disabled' : ''}>
                            <span class="engraved-text">${isFuelFull ? 'MAX' : 'REFUEL'}</span>
                          </button>
                          </div>
                      </div>

                      <div
                        class="service-module w-full max-w-sm"
                        style="--resource-color-rgb: 22, 163, 74; --resource-color: #16a34a; --ot-green-accent: #16a34a; --ot-green-text-light: #22c55e;"
                      >
                        <div class="bar-housing">
                          <div class="progress-bar-container w-full h-20 rounded-lg border border-gray-800 overflow-hidden relative">
                            <div class="absolute inset-0 z-10 flex justify-between items-center p-1.5 px-4 text-sm pointer-events-none">
                               <span class="font-electrolize font-bold tracking-wider uppercase text-outline" style="color: var(--ot-green-text-light); --glow-color: var(--ot-green-text-light);">HULL INTEGRITY</span>
                              <span class="font-mono font-bold text-white text-outline" style="--glow-color: var(--resource-color);">
                                ${Math.round(shipState.health)} / ${effectiveMaxHealth}
                              </span>
                            </div>
                            <div id="repair-bar" class="progress-bar-fill h-full rounded-md" style="width: ${healthPct}%; background-color: var(--resource-color); --glow-color: var(--resource-color); background-image: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent); background-size: 40px 40px;"></div>
                          </div>
                          </div>
                        <div class="control-deck flex justify-center items-center gap-4">
                          <div class="price-display-module w-32 h-12 flex justify-between items-center px-4">
                            <span class="price-label text-sm engraved-text">COST</span>
                            <span class="price-digits text-base ${canAffordRepair ? 'credits-text-pulsing' : 'text-red-500 shadow-red-500'}">
                              ${formatCredits(repairCostPerTick, true)}
                            </span>
                          </div>
                          <button id="repair-btn" class="industrial-button w-32 h-12 flex justify-center items-center text-center p-2 text-base font-orbitron uppercase tracking-wider transition-all duration-100 ease-in-out focus:outline-none" ${isDisabledRepair ? 'disabled' : ''}>
                              <span class="engraved-text">${isHealthFull ? 'MAX' : 'REPAIR'}</span>
                          </button>
                          </div>
                      </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}