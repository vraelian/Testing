// js/ui/components/NavigationScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Navigation screen.
 * It displays the available travel destinations as interactive cards, showing the
 * fuel and time costs for each potential journey.
 */
import { DB } from '../../data/database.js';
import { ACTION_IDS, SCREEN_IDS } from '../../data/constants.js';

/**
 * Renders the entire Navigation screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Navigation screen.
 */
export function renderNavigationScreen(gameState) {
    const { player, currentLocationId, TRAVEL_DATA, tutorials } = gameState;
    const { navLock } = tutorials;
    const currentLocation = DB.MARKETS.find(loc => loc.id === currentLocationId);


    // Check if a tutorial is active and has locked navigation.
    const isNavLocked = navLock && navLock.screenId === SCREEN_IDS.NAVIGATION;
    const enabledElementQuery = isNavLocked ? navLock.enabledElementQuery : null;
    
    return `
        <div class="scroll-panel p-1">
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            ${DB.MARKETS
                .filter(loc => player.unlockedLocationIds.includes(loc.id))
                .map(location => {
                    const isCurrent = location.id === currentLocationId;
                    const travelInfo = isCurrent ? null : TRAVEL_DATA[currentLocationId][location.id];

                    // Determine if this card should be disabled due to a tutorial lock.
                    let isDisabled = false;
                    if (isNavLocked && enabledElementQuery) {
                        // A workaround to check if this location card matches the tutorial's enabled element query.
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = `<div data-location-id="${location.id}"></div>`;
                        isDisabled = !tempDiv.querySelector(enabledElementQuery);
                    }
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
                                       <div><span class="font-bold font-roboto-mono text-lg">${travelInfo.time}</span><span class="block text-xs text-gray-400">Days</span></div>
                                   </div>
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" /></svg>
                                       <div><span class="font-bold font-roboto-mono text-lg">${travelInfo.fuelCost}</span><span class="block text-xs text-gray-400">Fuel</span></div>
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