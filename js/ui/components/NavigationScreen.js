// js/ui/components/NavigationScreen.js
import { DB } from '../../data/database.js';
import { ACTION_IDS, SCREEN_IDS, PERK_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js';

export function renderNavigationScreen(gameState) {
    const { player, currentLocationId, TRAVEL_DATA, systemState, missions } = gameState;
    const currentLocation = DB.MARKETS.find(loc => loc.id === currentLocationId);

    // --- UPGRADE SYSTEM: MODIFIER CALCULATIONS ---
    const activeShipId = player.activeShipId;
    const shipState = player.shipStates[activeShipId];
    const upgrades = shipState ? (shipState.upgrades || []) : [];
    
    // Get Current Fuel for Range Indicator (Phase 4.5)
    const currentFuel = shipState ? Math.floor(shipState.fuel) : 0;

    // 1. Fuel Modifiers (Perk * Upgrade)
    let fuelMod = 1.0;
    if (player.activePerks[PERK_IDS.NAVIGATOR]) {
        fuelMod *= DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod;
    }
    // Apply Engine Mod (Fuel Burn)
    fuelMod *= GameAttributes.getFuelBurnModifier(upgrades);

    // 2. Time Modifiers (Perk * Upgrade)
    let timeMod = 1.0;
    if (player.activePerks[PERK_IDS.NAVIGATOR]) {
        timeMod *= DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod;
    }
    // Apply Engine Mod
    timeMod *= GameAttributes.getTravelTimeModifier(upgrades);

    // 3. Legacy & Z-Class Attributes
    const shipAttributes = GameAttributes.getShipAttributes(activeShipId);
    
    // Z-Class Time Logic
    if (shipAttributes.includes('ATTR_HYPER_CALCULATION')) {
        timeMod *= 0.75; // -25% Travel Time
    }
    if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) {
        timeMod *= 10.0; // 10x Travel Time (Cryo Pod)
    }

    // Legacy Legacy
    const hasSleeper = shipAttributes.includes('ATTR_SLEEPER');
    if (hasSleeper) timeMod *= 4.5;

    // Z-Class Fuel Logic
    if (shipAttributes.includes('ATTR_METABOLIC_BURN')) {
        fuelMod *= 0.5; // -50% Fuel Cost
    }
    
    // --- SYSTEM STATES V3 HOOKS ---
    const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
    if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.travelFuelBurnMod) {
        fuelMod *= activeStateDef.modifiers.travelFuelBurnMod;
    }
    // --- END SYSTEM STATES V3 ---

    const isFreeFuel = shipAttributes.includes('ATTR_NEWTONS_GHOST') || hasSleeper;
    // ---------------------------------------------

    // --- TUTORIAL GUARDRAIL CHECK ---
    const isTut5 = missions?.activeMissionIds?.includes('mission_tutorial_05');
    const isTut6 = missions?.activeMissionIds?.includes('mission_tutorial_06');
    const isTut7 = missions?.activeMissionIds?.includes('mission_tutorial_07');

    return `
        <div class="scroll-panel navigation-scroll-panel">
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            ${DB.MARKETS
                .filter(loc => player.unlockedLocationIds.includes(loc.id))
                .map(location => {
                    const isCurrent = location.id === currentLocationId;
                    
                    // Specific tutorial lockout logic
                    let isLockedOut = false;
                    if (isTut5 && location.id !== 'loc_luna') isLockedOut = true;
                    if (isTut6) isLockedOut = true;
                    if (isTut7 && location.id !== 'loc_mars') isLockedOut = true;
                    
                    const lockoutClass = isLockedOut ? 'opacity-50 grayscale pointer-events-none' : '';
                    const actionData = isLockedOut ? '' : `data-action="show-launch-modal" data-location-id="${location.id}"`;
                    
                    let displayTime = 0;
                    let displayFuel = 0;
                    
                    if (!isCurrent) {
                        const baseData = TRAVEL_DATA[currentLocationId][location.id];
                        
                        // Apply Time Logic (Mod * Base)
                        displayTime = Math.max(1, Math.round(baseData.time * timeMod));
                        
                        // Apply Fuel Logic (Mod * Base)
                        displayFuel = Math.round(baseData.fuelCost * fuelMod);
                        
                        // Z-Class: Solar Harmony (Zero fuel if moving inward)
                        if (shipAttributes.includes('ATTR_SOLAR_HARMONY')) {
                            const fromDist = currentLocation.distance || 0; // Current
                            const toDist = location.distance || 0; // Target
                            if (toDist < fromDist) {
                                displayFuel = 0;
                            }
                        }

                        // Override: Free Fuel attributes (Cryo/Sleeper)
                        if (isFreeFuel) displayFuel = 0;
                    }

                    // Evaluate if Fuel Demand exceeds Fuel Supply
                    const isFuelDimmed = !isCurrent && displayFuel > currentFuel;
                    const dimmingClass = isFuelDimmed ? 'fuel-insufficient' : '';
                    
                    // CSS class and inline overrides for the dimming visual state
                    const fuelIconClass = isFuelDimmed ? '' : 'text-sky-400 drop-shadow-md';
                    const fuelTextClass = isFuelDimmed ? '' : 'text-sky-400';
                    const fuelStyle = isFuelDimmed ? 'color: #915e5e;' : '';
                    const fuelShadowStyle = isFuelDimmed ? 'text-shadow: 0 1px 2px rgba(0,0,0,0.8); color: #915e5e;' : 'text-shadow: 0 1px 3px rgba(0,0,0,0.8);';

                    // --- PHASE 4: TARGET INDICATORS ---
                    let isMissionTarget = false;
                    if (missions && missions.activeMissionIds) {
                        for (const missionId of missions.activeMissionIds) {
                            const mission = DB.MISSIONS[missionId];
                            if (!mission) continue;
                            
                            const progress = missions.missionProgress[missionId] || {};
                            const isLogisticsPickupPhase = mission.deferredCargo && mission.deferredCargo.length > 0 && !progress.cargoLoaded;
                            
                            if (isLogisticsPickupPhase && mission.pickupLocationId === location.id) {
                                isMissionTarget = true;
                                break;
                            }
                            
                            if (!isLogisticsPickupPhase && mission.completion?.locationId === location.id) {
                                isMissionTarget = true;
                                break;
                            }
                            
                            if (mission.objectives) {
                                const hasObjectiveHere = mission.objectives.some(obj => {
                                    if (obj.target !== location.id) return false;
                                    const objKey = obj.id || obj.goodId || obj.target;
                                    const pObj = progress.objectives?.[objKey];
                                    const current = pObj ? pObj.current : 0;
                                    const target = pObj ? pObj.target : (obj.quantity || obj.value || 1);
                                    
                                    return current < target;
                                });
                                if (hasObjectiveHere) {
                                    isMissionTarget = true;
                                    break;
                                }
                            }
                        }
                    }

                    let isIntelTarget = false;

                    // Fallback for older schemas
                    if (gameState.intel?.active?.targetMarketId === location.id ||
                        gameState.activeIntelDeal?.targetMarketId === location.id ||
                        gameState.activeHotIntel?.targetMarketId === location.id) {
                        isIntelTarget = true;
                    }

                    // Check Intel 2.0 Schema
                    if (!isIntelTarget && gameState.intelMarket) {
                        for (const key in gameState.intelMarket) {
                            const packets = gameState.intelMarket[key];
                            if (Array.isArray(packets)) {
                                // An intel packet is active for this location if it was purchased (pricePaid is set)
                                // and points to this location, and hasn't expired.
                                if (packets.some(p => p.dealLocationId === location.id && p.pricePaid !== undefined && (!p.expiryDay || p.expiryDay >= gameState.day))) {
                                    isIntelTarget = true;
                                    break;
                                }
                            }
                        }
                    }

                    let indicatorsHtml = '';
                    if (isMissionTarget || isIntelTarget) {
                        let leftLabel = isMissionTarget ? `<span class="text-amber-400" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 5px rgba(251,191,36,0.6);">MISSION TARGET</span>` : `<span></span>`;
                        let rightLabel = isIntelTarget ? `<span class="text-sky-400" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 5px rgba(56,189,248,0.6);">INTEL TARGET</span>` : ``;
                        
                        // VIRTUAL WORKBENCH: Bypassing generic css boundaries with forced inline absolutes
                        indicatorsHtml = `
                            <div class="w-full flex justify-between px-3 pt-2 pointer-events-none text-[0.65rem] font-bold font-orbitron tracking-widest z-[15]" style="position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important;">
                                ${leftLabel}
                                ${rightLabel}
                            </div>
                        `;
                    }
                    // ----------------------------------

                    const currentStyle = isCurrent ? `style="--theme-glow-color: ${currentLocation?.navTheme.borderColor};"` : '';

                    return `<div class="location-card p-6 rounded-xl text-center flex flex-col ${isCurrent ? 'highlight-current' : ''} ${location.color} ${location.bg} ${lockoutClass} ${dimmingClass}" 
                                     ${actionData} ${currentStyle}>
                        ${indicatorsHtml}
                        <h3 class="flex-grow flex items-center justify-center" style="font-size: calc(1.5rem + 4.5px); font-family: 'Bruno Ace SC', sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${location.name}</h3>
                        <div class="location-card-footer mt-auto pt-3 border-t border-cyan-100/10">
                        ${isCurrent 
                            ? '<p class="text-yellow-300 font-bold mt-2">(Currently Docked)</p>' 
                            : `<div class="flex justify-around items-center text-center">
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V5z" clip-rule="evenodd" /></svg>
                                        <div><span class="font-bold font-roboto-mono text-lg text-gray-400">${displayTime}</span><span class="block text-xs text-gray-500 font-bold tracking-wider">DAYS</span></div>
                                   </div>
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${fuelIconClass}" style="${fuelStyle}" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" /></svg>
                                        <div><span class="font-bold font-roboto-mono text-lg ${fuelTextClass}" style="${fuelShadowStyle}">${displayFuel}</span><span class="block text-xs font-bold tracking-wider ${fuelTextClass}" style="${fuelShadowStyle}">FUEL</span></div>
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