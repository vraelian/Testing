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
        [LOCATION_IDS.SUN]: "Sol Station",
        [LOCATION_IDS.MERCURY]: "Mercurian Station",
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

    // =========================================================================
    // --- COST CALCULATION: FUEL (Dynamic 5% / 1% Logic) ---
    // =========================================================================
    
    // 1. Calculate Base Unit Cost (Cost for 1 Fuel Unit)
    // Standard rate is Fuel Price / 2 for 5 units. So 1 unit = Price / 10.
    let fuelUnitCost = DB.MARKETS.find(m => m.id === currentLocationId).fuelPrice / 10;
    
    // 2. Apply Modifiers to Unit Cost
    // --- VIRTUAL WORKBENCH: STATION QUIRKS ---
    if (currentLocationId === LOCATION_IDS.SATURN || currentLocationId === LOCATION_IDS.PLUTO) {
        fuelUnitCost *= 2.0;
    }
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        fuelUnitCost *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
    }
    
    const fuelAttrMod = GameAttributes.getServiceCostModifier(upgrades, 'refuel');
    fuelUnitCost *= fuelAttrMod;
    
    // --- PHASE 2: AGE PERK ---
    const ageFuelDiscount = player.statModifiers?.fuelCost || 0;
    if (ageFuelDiscount > 0) {
        fuelUnitCost *= (1 - ageFuelDiscount);
    }

    // 3. Determine Dynamic Tick Size (5% vs 1%)
    const currentFuel = shipState.fuel;
    const fuelDeficit = effectiveMaxFuel - currentFuel;
    const fuelDeficitPct = fuelDeficit / effectiveMaxFuel;
    
    let fuelTickAmount = 0;
    if (fuelDeficit > 0) {
        // Precision Mode: If less than 5% deficit, fill 1% at a time. Otherwise 5%.
        if (fuelDeficitPct < 0.05) {
             fuelTickAmount = Math.ceil(effectiveMaxFuel * 0.01);
        } else {
             fuelTickAmount = Math.ceil(effectiveMaxFuel * 0.05);
        }
    }

    // 4. Final Cost Per Tick
    let fuelCostPerTick = Math.max(1, Math.round(fuelUnitCost * fuelTickAmount));

    // =========================================================================
    // --- COST CALCULATION: REPAIR (Dynamic 5% / 1% Logic) ---
    // =========================================================================

    // 1. Calculate Base Unit Cost (Cost for 1 HP)
    let repairUnitCost = GAME_RULES.REPAIR_COST_PER_HP;
    
    // 2. Apply Modifiers to Unit Cost
    // --- VIRTUAL WORKBENCH: STATION QUIRKS ---
    if (currentLocationId === LOCATION_IDS.LUNA) {
        repairUnitCost *= 0.8; 
    }
    if (currentLocationId === LOCATION_IDS.SATURN || currentLocationId === LOCATION_IDS.PLUTO) {
        repairUnitCost *= 2.0;
    }
    if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
        repairUnitCost *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
    }

    const repairAttrMod = GameAttributes.getServiceCostModifier(upgrades, 'repair');
    repairUnitCost *= repairAttrMod;

    // --- PHASE 2: AGE PERK ---
    const ageRepairDiscount = player.statModifiers?.repairCost || 0;
    if (ageRepairDiscount > 0) {
        repairUnitCost *= (1 - ageRepairDiscount);
    }

    // 3. Determine Dynamic Tick Size (5% vs 1%)
    const currentHealth = shipState.health;
    const healthDeficit = effectiveMaxHealth - currentHealth;
    const healthDeficitPct = healthDeficit / effectiveMaxHealth;
    
    let repairTickAmount = 0;
    if (healthDeficit > 0) {
        if (healthDeficitPct < 0.05) {
             repairTickAmount = Math.ceil(effectiveMaxHealth * 0.01);
        } else {
             repairTickAmount = Math.ceil(effectiveMaxHealth * 0.05);
        }
    }

    // 4. Final Cost Per Tick
    let repairCostPerTick = Math.max(1, Math.round(repairUnitCost * repairTickAmount));

    // =========================================================================

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
 * Deterministically filters and selects daily stock using a "Quantity First, Selection Second" logic.
 * * 1. Quantity Roll: Determines shop size (0-5 items) based on fixed distribution.
 * 0:5%, 1:20%, 2:35%, 3:25%, 4:10%, 5:5%
 * * 2. Weighted Selection: Picks unique items to fill the slots based on Tier rarity.
 * Weights: T1(17), T2(11), T3(9), T4(6), T5(4)
 * * @param {object} gameState
 * @returns {string[]} Array of selected upgrade IDs.
 */
function _getDailyStock(gameState) {
    const { day, currentLocationId, player } = gameState;
    const allIds = GameAttributes.getAllUpgradeIds();

    // 1. FILTER CANDIDATES
    // Create a list of all *possible* items allowed to spawn here/now.
    let candidates = allIds.filter(id => {
        // Strict Allowlist
        if (!id.startsWith('UPG_')) return false;

        // Exclude Rewards (Guild/Syndicate) unless Tier 4/5
        if (id.includes('GUILD') || id.includes('SYNDICATE')) {
            if (!id.endsWith('_4') && !id.endsWith('_5')) return false;
        }

        // Wealth Gate for Tier 4/5 (1 Million Credits)
        if (id.endsWith('_4') || id.endsWith('_5')) {
            if (player.credits < 1000000) return false;
        }
        
        return true;
    });

    // 2. DETERMINE SHOP CAPACITY (Quantity Roll)
    // 0: 5%, 1: 20%, 2: 35%, 3: 25%, 4: 10%, 5: 5%
    const quantitySeed = `quantity_${currentLocationId}_${day}`;
    const quantityRoll = _generatePseudoRandom(quantitySeed);
    
    let targetCount = 0;
    if (quantityRoll < 0.05) targetCount = 0;
    else if (quantityRoll < 0.25) targetCount = 1; // 0.05 + 0.20
    else if (quantityRoll < 0.60) targetCount = 2; // 0.25 + 0.35
    else if (quantityRoll < 0.85) targetCount = 3; // 0.60 + 0.25
    else if (quantityRoll < 0.95) targetCount = 4; // 0.85 + 0.10
    else targetCount = 5;

    // 3. ASSIGN WEIGHTS TO CANDIDATES
    // Tier 1: 17, Tier 2: 11, Tier 3: 9, Tier 4: 6, Tier 5: 4
    // Modifiers: Age Perk (+), Uranus Quirk (Advanced x2)
    
    const ageBonusWeight = (gameState.player.statModifiers?.upgradeSpawnRate || 0) * 100;
    const isUranus = currentLocationId === LOCATION_IDS.URANUS;

    let weightedPool = candidates.map(id => {
        let weight = 0;
        
        // Base Weights
        if (id.endsWith('_1')) weight = 17;
        else if (id.endsWith('_2')) weight = 11;
        else if (id.endsWith('_3')) weight = 9;
        else if (id.endsWith('_4')) weight = 6;
        else if (id.endsWith('_5')) weight = 4;
        
        // Age Perk (Additive)
        weight += ageBonusWeight;

        // Uranus Quirk (Advanced Multiplier)
        if (isUranus && (id.endsWith('_3') || id.endsWith('_4') || id.endsWith('_5'))) {
            weight *= 2;
        }

        return { id, weight };
    });

    // 4. SELECT ITEMS
    const selectedIds = [];
    
    // Loop until we fill the slots or run out of candidates
    for (let i = 0; i < targetCount; i++) {
        if (weightedPool.length === 0) break;

        const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
        const selectionSeed = `select_${currentLocationId}_${day}_${i}`;
        let roll = _generatePseudoRandom(selectionSeed) * totalWeight;

        // Weighted Pick
        let selectedIndex = -1;
        for (let j = 0; j < weightedPool.length; j++) {
            roll -= weightedPool[j].weight;
            if (roll < 0) {
                selectedIndex = j;
                break;
            }
        }
        
        // Fallback (rounding errors)
        if (selectedIndex === -1 && weightedPool.length > 0) selectedIndex = weightedPool.length - 1;

        if (selectedIndex !== -1) {
            selectedIds.push(weightedPool[selectedIndex].id);
            // Remove from pool to prevent duplicates
            weightedPool.splice(selectedIndex, 1);
        }
    }

    return selectedIds;
}

/**
 * Generates a deterministic pseudo-random number (0-1) from a string seed.
 * @param {string} seedString 
 * @returns {number} 0.0 to 1.0
 */
function _generatePseudoRandom(seedString) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
        hash |= 0; 
    }
    return (Math.abs(hash) % 1000) / 1000;
}

/**
 * Renders the "Tuning" view (Upgrade Shop).
 * @param {object} gameState
 * @returns {string} HTML content
 * @private
 */
function _renderTuningView(gameState) {
    const availableUpgradeIds = _getDailyStock(gameState);

    // --- VIRTUAL WORKBENCH: SHOP REMOVAL LOGIC ---
    // Filter out items already purchased today at this location.
    const purchaseKey = `${gameState.currentLocationId}_${gameState.day}`;
    const purchasedIds = gameState.market.dailyTuningPurchases?.[purchaseKey] || [];
    const filteredStock = availableUpgradeIds.filter(id => !purchasedIds.includes(id));
    
    // Sort slightly for nicer presentation (Tier I -> II -> III -> IV -> V, then alphabetical)
    filteredStock.sort();

    if (filteredStock.length === 0) {
        return `
            <div class="services-scroll-panel flex-grow min-h-0 flex items-center justify-center">
                <p class="text-gray-500 text-lg">No upgrades available in stock today.</p>
            </div>
        `;
    }
    
    // [[NEW]] LABOR CALCULATION
    const activeShipId = gameState.player.activeShipId;
    const activeShipStatic = DB.SHIPS[activeShipId];
    const laborFee = GameAttributes.getInstallationFee(activeShipStatic ? activeShipStatic.price : 0);

    const upgradesHtml = filteredStock.map(id => {
        const def = GameAttributes.getDefinition(id);
        if (!def) return '';

        // [[FIXED]] Color Logic for shop view to match pills
        const baseColor = def.pillColor || def.color || UPGRADE_COLORS.GREY;
        const styleVars = `
            --item-color: ${baseColor};
            --item-glow: ${baseColor}80;
        `;
        
        const totalCost = def.value + laborFee;
        const canAfford = gameState.player.credits >= totalCost;
        
        return `
            <div class="service-module upgrade-shop-item" style="${styleVars}">
                <div class="flex flex-row items-center gap-4 h-full">
                    <div class="upgrade-icon-strip h-full w-2" style="background-color: var(--item-color); box-shadow: 0 0 8px var(--item-glow);"></div>
                    
                    <div class="flex-grow flex flex-col justify-center overflow-hidden">
                        <div class="upgrade-item-name font-orbitron font-bold engraved-text truncate" 
                             style="color: var(--item-color); text-shadow: 0 0 5px var(--item-glow);">
                             ${def.name}
                        </div>
                        <div class="text-xs text-gray-400 mt-1 leading-tight">${def.description}</div>
                        <div class="text-[10px] text-gray-500 mt-2 font-mono">
                            HARDWARE: ${formatCredits(def.value)}<br>
                            LABOR: ${formatCredits(laborFee)} (5%)
                        </div>
                    </div>

                    <div class="flex flex-col items-end gap-2 min-w-[100px]">
                        <div class="font-mono text-cyan-300 credits-text-pulsing text-xl">${formatCredits(totalCost, true)}</div>
                        <button class="btn btn-sm w-full font-bold uppercase tracking-wider"
                                style="border: 1px solid var(--item-color); color: ${canAfford ? '#fff' : '#666'};"
                                data-action="install_upgrade"
                                data-upgrade-id="${id}"
                                data-cost="${totalCost}" 
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