// js/ui/components/NavigationScreen.js
import { DB } from '../../data/database.js';
import { ACTION_IDS, SCREEN_IDS, PERK_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js';

export function renderNavigationScreen(gameState) {
    const { player, currentLocationId, TRAVEL_DATA, tutorials } = gameState;
    const { navLock } = tutorials;
    const currentLocation = DB.MARKETS.find(loc => loc.id === currentLocationId);

    const isNavLocked = navLock && navLock.screenId === SCREEN_IDS.NAVIGATION;
    const enabledElementQuery = isNavLocked ? navLock.enabledElementQuery : null;

    let enabledLocationId = null;
    if (enabledElementQuery) {
        const match = enabledElementQuery.match(/\[data-location-id='(.*?)'\]/);
        if (match && match[1]) {
            enabledLocationId = match[1];
        }
    }

    // --- UPGRADE SYSTEM: MODIFIER CALCULATIONS ---
    const activeShipId = player.activeShipId;
    const shipState = player.shipStates[activeShipId];
    const upgrades = shipState ? (shipState.upgrades || []) : [];

    // 1. Fuel Modifiers (Perk * Upgrade)
    let fuelMod = 1.0;
    if (player.activePerks[PERK_IDS.NAVIGATOR]) {
        fuelMod *= DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod;
    }
    // Apply Engine Mod / Fuel Pass
    fuelMod *= GameAttributes.getFuelCostModifier(upgrades);

    // 2. Time Modifiers (Perk * Upgrade)
    let timeMod = 1.0;
    if (player.activePerks[PERK_IDS.NAVIGATOR]) {
        timeMod *= DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod;
    }
    // Apply Engine Mod
    timeMod *= GameAttributes.getTravelTimeModifier(upgrades);

    // 3. Legacy Attributes
    const shipAttributes = GameAttributes.getShipAttributes(activeShipId);
    const hasSpaceFolding = shipAttributes.includes('ATTR_SPACE_FOLDING');
    const hasSleeper = shipAttributes.includes('ATTR_SLEEPER');
    // ---------------------------------------------

    return `
        <div class="scroll-panel navigation-scroll-panel">
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            ${DB.MARKETS
                .filter(loc => player.unlockedLocationIds.includes(loc.id))
                .map(location => {
                    const isCurrent = location.id === currentLocationId;
                    
                    let displayTime = 0;
                    let displayFuel = 0;
                    
                    if (!isCurrent) {
                        const baseData = TRAVEL_DATA[currentLocationId][location.id];
                        
                        // Apply Time Logic (Mod * Base)
                        displayTime = Math.max(1, Math.round(baseData.time * timeMod));
                        
                        // Legacy Overrides
                        if (hasSpaceFolding) displayTime = 1;
                        if (hasSleeper) displayTime = Math.round(displayTime * 4.5); // Sleeper adds time

                        // Apply Fuel Logic (Mod * Base)
                        displayFuel = Math.round(baseData.fuelCost * fuelMod);
                        
                        // Legacy Overrides
                        if (hasSpaceFolding) displayFuel = Math.round(baseData.fuelCost * 1.2); // Override/Penalty
                        if (hasSleeper) displayFuel = 0; // Sleeper is free
                    }

                    const isDisabled = isNavLocked && enabledLocationId && location.id !== enabledLocationId;
                    const disabledClass = isDisabled ? 'disabled-location' : '';
                    
                    const currentStyle = isCurrent ? `style="--theme-glow-color: ${currentLocation?.navTheme.borderColor};"` : '';

                    return `<div class="location-card p-6 rounded-lg text-center flex flex-col ${isCurrent ? 'highlight-current' : ''} ${location.color} ${location.bg} ${disabledClass}" 
                                     data-action="show-launch-modal" data-location-id="${location.id}" ${isDisabled ? 'disabled' : ''} ${currentStyle}>
                        <h3 class="text-2xl font-orbitron flex-grow">${location.name}</h3>
                        <div class="location-card-footer mt-auto pt-3 border-t border-cyan-100/10">
                        ${isCurrent 
                            ? '<p class="text-yellow-300 font-bold mt-2">(Currently Docked)</p>' 
                            : `<div class="flex justify-around items-center text-center">
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V5z" clip-rule="evenodd" /></svg>
                                        <div><span class="font-bold font-roboto-mono text-lg">${displayTime}</span><span class="block text-xs text-gray-400">Days</span></div>
                                   </div>
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" /></svg>
                                        <div><span class="font-bold font-roboto-mono text-lg">${displayFuel}</span><span class="block text-xs text-gray-400">Fuel</span></div>
                                   </div>
                               </div>`
                        }
                        </div>
                      </div>`;
                }).join('')
            }
            </div>
        </div>`;
}