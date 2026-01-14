// js/ui/components/ServicesScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Station Services screen.
 * It displays options for refueling and repairing the player's active ship, calculating
 * costs based on the current location and any active player perks.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { GAME_RULES, PERK_IDS, LOCATION_IDS, UPGRADE_COLORS, NAV_IDS, SCREEN_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js';

/**
 * Renders the entire Services screen UI.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/SimulationService.js').SimulationService} simulationService - The simulation service.
 * @returns {string} The HTML content for the Services screen.
 */
export function renderServicesScreen(gameState, simulationService) {
    const { player, currentLocationId } = gameState;
    const { servicesTab = 'supply' } = gameState.uiState; // Default to 'supply'

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
    const locationName = STARPORT_NAMES[currentLocationId] || 'UNKNOWN STARPORT';

    // --- Sub-Nav Render ---
    const supplyActive = servicesTab === 'supply' ? 'active' : '';
    const tuningActive = servicesTab === 'tuning' ? 'active' : '';
    
    const supplyStyle = servicesTab === 'supply' ? `style="background: ${theme.gradient}; color: ${theme.textColor}; border-color: ${theme.borderColor}; box-shadow: 0 0 10px rgba(0,0,0,0.5);"` : '';
    const tuningStyle = servicesTab === 'tuning' ? `style="background: ${theme.gradient}; color: ${theme.textColor}; border-color: ${theme.borderColor}; box-shadow: 0 0 10px rgba(0,0,0,0.5);"` : '';

    const subNavHtml = `
        <div class="sub-nav-bar" style="margin-bottom: 0.5rem; display: flex; gap: 0.5rem; justify-content: center;">
            <button class="sub-nav-button ${supplyActive}" ${supplyStyle} data-action="set-services-tab" data-target="supply">SUPPLY</button>
            <button class="sub-nav-button ${tuningActive}" ${tuningStyle} data-action="set-services-tab" data-target="tuning">TUNING</button>
        </div>
    `;

    // --- View Routing ---
    if (servicesTab === 'tuning') {
        return `
            <div class="flex flex-col h-full">
                ${subNavHtml}
                <div class="themed-header-bar mb-4" style="${themeStyleVars}">
                    <div class="themed-header-title">${locationName}</div>
                </div>
                ${_renderTuningView(gameState)}
            </div>
        `;
    }

    // --- Fallback / Default View (Supply) ---
    if (!player.activeShipId || !gameState.player.shipStates[player.activeShipId]) {
        return `
            <div class="flex flex-col h-full">
                ${subNavHtml}
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
    }

    const shipStatic = DB.SHIPS[player.activeShipId];
    const shipState = gameState.player.shipStates[player.activeShipId];
    const shipName = shipStatic?.name || 'NO ACTIVE SHIP';
    const upgrades = shipState.upgrades || [];
    const shipClassColorVar = shipStatic ? `var(--class-${shipStatic.class.toLowerCase()}-color)` : '#f0f0f0';

    // --- UPGRADE SYSTEM: Effective Stats ---
    let effectiveMaxHealth = shipStatic.maxHealth;
    let effectiveMaxFuel = shipStatic.maxFuel;

    if (simulationService && simulationService.getEffectiveShipStats) {
        const stats = simulationService.getEffectiveShipStats(player.activeShipId);
        if (stats) {
            effectiveMaxHealth = stats.maxHealth;
            effectiveMaxFuel = stats.maxFuel;
        }
    }

    // --- Calculate Costs ---
    let fuelCostPerTick = DB.MARKETS.find(m => m.id === currentLocationId).fuelPrice / 2;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        fuelCostPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
    }
    const fuelAttrMod = GameAttributes.getServiceCostModifier(upgrades, 'refuel');
    fuelCostPerTick *= fuelAttrMod;
    fuelCostPerTick = Math.max(1, Math.round(fuelCostPerTick));

    let repairCostPerTick = (effectiveMaxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        repairCostPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
    }
    const repairAttrMod = GameAttributes.getServiceCostModifier(upgrades, 'repair');
    repairCostPerTick *= repairAttrMod;
    repairCostPerTick = Math.max(1, Math.round(repairCostPerTick));

    // --- Calculate Percentages ---
    const fuelPct = (shipState.fuel / effectiveMaxFuel) * 100;
    const healthPct = (shipState.health / effectiveMaxHealth) * 100;

    const isFuelFull = shipState.fuel >= effectiveMaxFuel;
    const isHealthFull = shipState.health >= effectiveMaxHealth;
    const canAffordRefuel = player.credits >= fuelCostPerTick;
    const canAffordRepair = player.credits >= repairCostPerTick;
    const isDisabledRefuel = isFuelFull || !canAffordRefuel;
    const isDisabledRepair = isHealthFull || !canAffordRepair;
    
    return `
        <div class="flex flex-col h-full">
            ${subNavHtml}
            <div class="themed-header-bar mb-4" style="${themeStyleVars}">
                <div class="themed-header-title">${locationName}</div>
            </div>
            <div class="services-scroll-panel flex-grow min-h-0">
                
                <div class="ship-services-panel max-w-4xl mx-auto" style="${themeStyleVars}">
                    <div class="themed-header-bar">
                        <div class="ship-header-title" style="color: ${shipClassColorVar}; text-shadow: 0 0 5px ${shipClassColorVar}80;">${shipName}</div>
                    </div>

                    <div class="flex flex-col md:flex-row justify-center items-center gap-8 p-4 md:p-8">
                      <div class="service-module w-full max-w-sm" style="--resource-color-rgb: 8, 217, 214; --resource-color: #08d9d6; --ot-cyan-base: #08d9d6;">
                        <div class="bar-housing">
                          <div class="progress-bar-container w-full h-14 rounded-lg border border-gray-800 overflow-hidden relative">
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

                      <div class="service-module w-full max-w-sm" style="--resource-color-rgb: 22, 163, 74; --resource-color: #16a34a; --ot-green-accent: #16a34a; --ot-green-text-light: #22c55e;">
                        <div class="bar-housing">
                          <div class="progress-bar-container w-full h-14 rounded-lg border border-gray-800 overflow-hidden relative">
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

/**
 * Deterministically filters the available upgrades based on Day and Location.
 * Implements "Exploration Economy" rates: Tier 1 (30%), Tier 2 (15%), Tier 3 (8%).
 * @param {object} gameState
 * @returns {string[]} Array of available upgrade IDs.
 */
function _getDailyStock(gameState) {
    const { day, currentLocationId } = gameState;
    const allIds = GameAttributes.getAllUpgradeIds();

    return allIds.filter(id => {
        // 1. Exclude Rewards (Guild/Syndicate) - 0% Chance
        if (id.includes('GUILD') || id.includes('SYNDICATE')) return false;

        // 2. Determine Chance based on Tier Suffix
        let threshold = 0.30; // Tier 1 Default
        if (id.endsWith('_II')) threshold = 0.15;
        if (id.endsWith('_III')) threshold = 0.08;

        // 3. Deterministic Hashing (Day + Location + UpgradeID)
        const seedString = `${day}_${currentLocationId}_${id}`;
        
        // Simple hash function to generate a pseudo-random number 0-1
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
            hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        const random = (Math.abs(hash) % 1000) / 1000;
        
        return random < threshold;
    });
}

/**
 * Renders the "Tuning" view (Upgrade Shop).
 * @param {object} gameState
 * @returns {string} HTML content
 * @private
 */
function _renderTuningView(gameState) {
    const availableUpgradeIds = _getDailyStock(gameState);
    
    // Sort slightly for nicer presentation (Tier I -> II -> III, then alphabetical)
    availableUpgradeIds.sort();

    if (availableUpgradeIds.length === 0) {
        return `
            <div class="services-scroll-panel flex-grow min-h-0 flex items-center justify-center">
                <p class="text-gray-500 text-lg">No upgrades available in stock today.</p>
            </div>
        `;
    }

    const upgradesHtml = availableUpgradeIds.map(id => {
        const def = GameAttributes.getDefinition(id);
        if (!def) return '';

        const baseColor = def.pillColor || UPGRADE_COLORS.GREY;
        const styleVars = `
            --item-color: ${baseColor};
            --item-glow: ${baseColor}80;
        `;

        const canAfford = gameState.player.credits >= def.value;
        
        return `
            <div class="service-module upgrade-shop-item" style="${styleVars}">
                <div class="flex flex-row items-center gap-4 h-full">
                    <div class="upgrade-icon-strip h-full w-2" style="background-color: var(--item-color); box-shadow: 0 0 8px var(--item-glow);"></div>
                    
                    <div class="flex-grow flex flex-col justify-center overflow-hidden">
                        <div class="font-orbitron font-bold text-lg engraved-text truncate" 
                             style="color: var(--item-color); text-shadow: 0 0 5px var(--item-glow);">
                             ${def.name}
                        </div>
                        <div class="text-xs text-gray-400 mt-1 leading-tight">${def.description}</div>
                    </div>

                    <div class="flex flex-col items-end gap-2 min-w-[100px]">
                        <div class="font-mono text-cyan-300 credits-text-pulsing text-2xl">${formatCredits(def.value, true)}</div>
                        <button class="btn btn-sm w-full font-bold uppercase tracking-wider"
                                style="border: 1px solid var(--item-color); color: ${canAfford ? '#fff' : '#666'};"
                                data-action="install_upgrade"
                                data-upgrade-id="${id}"
                                data-cost="${def.value}"
                                ${!canAfford ? 'disabled' : ''}>
                            INSTALL
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="tuning-scroll-panel services-scroll-panel flex-grow min-h-0">
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto p-2 pb-8">
                ${upgradesHtml}
             </div>
        </div>
    `;
}