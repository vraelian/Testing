// js/ui/components/HangarScreen.js
/**
 * @fileoverview
 * This file contains the rendering logic for the Hangar screen.
 * It is responsible for displaying both the player's owned ships (Hangar)
 * and the ships available for purchase at the current location (Shipyard).
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';

/**
 * Renders the entire Hangar screen, adapting for mobile or desktop layouts.
 * @param {object} gameState - The current state of the game.
 * @param {boolean} isMobile - A flag indicating if the mobile layout should be used.
 * @returns {string} The HTML content for the Hangar screen.
 */
export function renderHangarScreen(gameState, isMobile) {
    if (isMobile) {
        return _renderHangarScreenMobile(gameState);
    } else {
        return _renderHangarScreenDesktop(gameState);
    }
}

/**
 * Renders the mobile version of the Hangar screen.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the mobile Hangar screen.
 * @private
 */
function _renderHangarScreenMobile(gameState) {
    const { player } = gameState;
    const shipsForSale = _getShipyardInventory(gameState);

    const shipyardHtml = shipsForSale.length > 0
        ? shipsForSale.map(([id]) => _getHangarItemHtmlMobile(gameState, id, 'shipyard')).join('')
        : '<p class="text-center text-gray-500 text-sm p-4">No new ships available.</p>';

    const hangarHtml = player.ownedShipIds.length > 0
        ? player.ownedShipIds.map(id => _getHangarItemHtmlMobile(gameState, id, 'hangar')).join('')
        : '<p class="text-center text-gray-500 text-sm p-4">Your hangar is empty.</p>';

    return `
        <div class="flex flex-col gap-6">
            <div id="starport-shipyard-panel-mobile">
                <h2 class="text-2xl font-orbitron text-cyan-300 mb-2 text-center">Shipyard</h2>
                <div class="starport-panel-mobile space-y-2">${shipyardHtml}</div>
            </div>
            <div id="starport-hangar-panel-mobile">
                <h2 class="text-2xl font-orbitron text-cyan-300 mb-2 text-center">Hangar</h2>
                <div class="starport-panel-mobile space-y-2">${hangarHtml}</div>
            </div>
        </div>`;
}

/**
 * Renders the desktop version of the Hangar screen.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the desktop Hangar screen.
 * @private
 */
function _renderHangarScreenDesktop(gameState) {
    const { player, tutorials } = gameState;
    const shipsForSale = _getShipyardInventory(gameState);
    const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
    let shipyardHtml;

    if (shipsForSale.length > 0) {
        shipyardHtml = shipsForSale.map(([id, ship]) => {
            const canAfford = player.credits >= ship.price;
            const isDisabled = !canAfford || isHangarTutStep1Active;
            return `<div class="ship-card p-4 flex flex-col space-y-3"><div class="flex justify-between items-start"><div><h3 class="text-xl font-orbitron text-cyan-300">${ship.name}</h3><p class="text-sm text-gray-400">Class ${ship.class}</p></div><div class="text-right"><p class="text-lg font-bold text-cyan-300">${formatCredits(ship.price)}</p></div></div><p class="text-sm text-gray-400 flex-grow">${ship.lore}</p><div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2"><div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${ship.maxHealth}</span></div><div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${ship.maxFuel}</span></div><div><span class="text-gray-500">Cargo:</span> <span class="text-amber-400">${ship.cargoCapacity}</span></div></div><button class="btn w-full mt-2" 
             data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${id}" ${isDisabled ? 'disabled' : ''}>Purchase</button></div>`;
        }).join('');
    } else {
        shipyardHtml = '<p class="text-center text-gray-500">No new ships available at this location.</p>';
    }

    const hangarHtml = player.ownedShipIds.length > 0
        ? player.ownedShipIds.map(id => {
            const shipStatic = DB.SHIPS[id];
            const shipDynamic = player.shipStates[id];
            const shipInventory = player.inventories[id];
            const cargoUsed = calculateInventoryUsed(shipInventory);
            const isActive = id === player.activeShipId;
            const canSell = player.ownedShipIds.length > 1 && !isActive;
            const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);
            return `<div class="ship-card p-4 flex flex-col space-y-3 ${isActive ? 'border-yellow-400' : ''}"><h3 class="text-xl font-orbitron ${isActive ? 'text-yellow-300' : 'text-cyan-300'} hanger-ship-name" data-tooltip="${shipStatic.lore}">${shipStatic.name}</h3><p class="text-sm text-gray-400 flex-grow">Class ${shipStatic.class}</p><div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2"><div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${Math.floor(shipDynamic.health)}/${shipStatic.maxHealth}</span></div><div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${Math.floor(shipDynamic.fuel)}/${shipStatic.maxFuel}</span></div><div><span class="text-amber-400">${cargoUsed}/${shipStatic.cargoCapacity}</span></div></div><div class="grid grid-cols-2 gap-2 mt-2">${isActive ? '<button class="btn" disabled>ACTIVE</button>' : `<button class="btn" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${id}">Board</button>`}<button class="btn" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${id}" ${!canSell ? 'disabled' : ''}>Sell (${formatCredits(salePrice, false)})</button></div></div>`;
        }).join('')
        : '<p class="text-center text-gray-500">Your hangar is empty.</p>';

    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 relative">
            <div id="starport-shipyard-panel">
                <h2 class="text-3xl font-orbitron text-cyan-300 mb-4 text-center">Shipyard</h2>
                <div class="starport-panel space-y-4">${shipyardHtml}</div>
            </div>
            <div class="w-full my-4 border-t-2 border-slate-600 lg:hidden"></div>
            <div class="absolute left-1/2 top-0 h-full w-px bg-slate-600 hidden lg:block"></div>
            <div id="starport-hangar-panel">
                <h2 class="text-3xl font-orbitron text-cyan-300 mb-4 text-center">Hangar</h2>
                <div class="starport-panel space-y-4">${hangarHtml}</div>
            </div>
        </div>`;
}

/**
 * Generates the HTML for a single ship item in the mobile hangar/shipyard list.
 * @param {object} gameState - The current state of the game.
 * @param {string} shipId - The ID of the ship to render.
 * @param {string} context - 'shipyard' or 'hangar'.
 * @returns {string} The HTML for the list item.
 * @private
 */
function _getHangarItemHtmlMobile(gameState, shipId, context) {
    const { player, tutorials } = gameState;
    const shipStatic = DB.SHIPS[shipId];
    let statusText, statusColor;

    if (context === 'shipyard') {
        statusText = formatCredits(shipStatic.price);
        statusColor = player.credits >= shipStatic.price ? 'text-cyan-300' : 'text-red-400';
    } else { // context === 'hangar'
        const isActive = shipId === player.activeShipId;
        statusText = isActive ? 'ACTIVE' : 'STORED';
        statusColor = isActive ? 'text-yellow-300' : 'text-gray-400';
    }

    const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
    const isDisabled = isHangarTutStep1Active && context === 'shipyard';

    return `
        <div class="ship-list-item-mobile p-3 flex justify-between items-center ${isDisabled ? 'disabled' : ''}" data-action="show-ship-detail" data-ship-id="${shipId}" data-context="${context}">
            <div>
                <p class="font-orbitron ${statusColor}">${shipStatic.name}</p>
                <p class="text-xs text-gray-500">Class ${shipStatic.class}</p>
            </div>
            <div class="font-roboto-mono text-right text-sm ${statusColor}">
                ${statusText}
            </div>
        </div>`;
}

/**
 * Determines the list of ships available for sale at the current location.
 * @param {object} gameState The current game state.
 * @returns {Array<Array<string, object>>} A list of ship entries, [id, shipObject].
 * @private
 */
function _getShipyardInventory(gameState) {
    const { player, currentLocationId, market, introSequenceActive } = gameState;
    if (introSequenceActive) {
        if (player.ownedShipIds.length > 0) {
            return [];
        } else {
            const introShipIds = [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE];
            return introShipIds.map(id => ([id, DB.SHIPS[id]]));
        }
    } else {
        const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
        return shipsForSaleIds
            .map(id => ([id, DB.SHIPS[id]]))
            .filter(([id, ship]) => !player.ownedShipIds.includes(id));
    }
}