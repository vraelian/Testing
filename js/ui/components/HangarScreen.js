// js/ui/components/HangarScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Hangar screen.
 * It is responsible for displaying both the player's owned ships (Hangar)
 * and the ships available for purchase at the current location (Shipyard).
 * It also handles switching between desktop and mobile layouts.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';

/**
 * Renders the entire Hangar screen. The component is now responsive and uses the same bar component for both layouts.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/UIManager.js').UIManager} uiManager - The UI Manager instance.
 * @returns {string} The HTML content for the Hangar screen.
 */
export function renderHangarScreen(gameState, uiManager) {
    if (uiManager.hangarMode === 'shipyard') {
        return _renderShipyardView(gameState);
    } else {
        return _renderHangarView(gameState);
    }
}

/**
 * Renders the shipyard view, showing ships for sale.
 * @param {object} gameState The current game state.
 * @returns {string} HTML content for the shipyard view.
 * @private
 */
function _renderShipyardView(gameState) {
    const shipsForSale = _getShipyardInventory(gameState);
    const shipyardHtml = shipsForSale.length > 0
        ? shipsForSale.map(([id]) => _getShipBarHtml(gameState, id, 'shipyard')).join('')
        : '<p class="text-center text-gray-500 text-sm p-4">No new ships available at this location.</p>';

    return `
        <div>
            <button id="temp-hangar-toggle" class="btn btn-sm mb-4">Toggle View (Dev)</button>
            <h2 class="text-3xl font-orbitron text-cyan-300 mb-4 text-center">Shipyard</h2>
            <div class="starport-panel shipyard-panel space-y-4">${shipyardHtml}</div>
        </div>`;
}

/**
 * Renders the hangar view, showing the player's owned ships.
 * @param {object} gameState The current game state.
 * @returns {string} HTML content for the hangar view.
 * @private
 */
function _renderHangarView(gameState) {
    const { player } = gameState;
    const hangarHtml = player.ownedShipIds.length > 0
        ? player.ownedShipIds.map(id => _getShipBarHtml(gameState, id, 'hangar')).join('')
        : '<p class="text-center text-gray-500 text-sm p-4">Your hangar is empty.</p>';

    return `
        <div>
            <button id="temp-hangar-toggle" class="btn btn-sm mb-4">Toggle View (Dev)</button>
            <h2 class="text-3xl font-orbitron text-cyan-300 mb-4 text-center">Hangar</h2>
            <div class="starport-panel hangar-panel space-y-4">${hangarHtml}</div>
        </div>`;
}


/**
 * Generates the HTML for a single ship bar, for either the shipyard or hangar.
 * @param {object} gameState - The current state of the game.
 * @param {string} shipId - The ID of the ship to render.
 * @param {string} context - The context: 'shipyard' or 'hangar'.
 * @returns {string} The HTML for the ship bar.
 * @private
 */
function _getShipBarHtml(gameState, shipId, context) {
    const { player, tutorials } = gameState;
    const shipStatic = DB.SHIPS[shipId];
    const shipClassLower = shipStatic.class.toLowerCase();

    // Common elements
    const nameAndClassHtml = `
        <div class="ship-info">
            <span class="ship-name class-${shipClassLower}">${shipStatic.name}</span>
            <span class="ship-class">Class ${shipStatic.class}</span>
        </div>`;

    let rightSideContent = '';
    let bottomContent = '';
    let sideLabel = '';
    let wrapperClasses = `ship-bar-wrapper bg-class-${shipClassLower} class-${shipClassLower}`;

    if (context === 'shipyard') {
        const canAfford = player.credits >= shipStatic.price;
        const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
        if (!canAfford || isHangarTutStep1Active) {
            wrapperClasses += ' opacity-60 pointer-events-none';
        }
        
        rightSideContent = `<div class="ship-price">${formatCredits(shipStatic.price)}</div>`;
    } else { // context === 'hangar'
        const shipDynamic = player.shipStates[shipId];
        const shipInventory = player.inventories[shipId];
        const cargoUsed = calculateInventoryUsed(shipInventory);
        const cargoPct = (cargoUsed / shipStatic.cargoCapacity) * 100;
        const hullPercent = Math.floor((shipDynamic.health / shipStatic.maxHealth) * 100);
        const fuelPercent = Math.floor((shipDynamic.fuel / shipStatic.maxFuel) * 100);
        const isActive = shipId === player.activeShipId;

        sideLabel = `<div class="status-sidelabel ${isActive ? 'sidelabel-active' : 'sidelabel-stored'}">${isActive ? 'ACTIVE' : 'STORED'}</div>`;
        
        rightSideContent = `
            <div class="ship-stats-text">
                <span class="stat-hull">HULL: <span class="value">${hullPercent}%</span></span>
                <span class="stat-fuel">FUEL: <span class="value">${fuelPercent}%</span></span>
            </div>`;
        
        const cargoSegments = Array.from({ length: Math.max(10, Math.min(25, Math.floor(shipStatic.cargoCapacity / 8))) }, (_, i) => {
            const filledSegments = Math.round((cargoUsed / shipStatic.cargoCapacity) * Math.max(10, Math.min(25, Math.floor(shipStatic.cargoCapacity / 8))));
            return `<div class="segment ${i < filledSegments ? 'filled' : ''}"></div>`;
        }).join('');

        bottomContent = `
            <div class="bottom-line">
                <div class="cargo-bar">${cargoSegments}</div>
                <div class="cargo-text">CARGO: <span class="value">${cargoUsed}/${shipStatic.cargoCapacity}</span></div>
            </div>`;
    }

    return `
        <div class="${wrapperClasses}" data-action="show-ship-detail" data-ship-id="${shipId}" data-context="${context}">
            ${sideLabel}
            <div class="main-content">
                <div class="ship-info-top">
                    ${nameAndClassHtml}
                    ${rightSideContent}
                </div>
                ${bottomContent}
            </div>
        </div>`;
}


/**
 * Retrieves the list of ships currently available for sale at the docked location.
 * @param {object} gameState The current game state.
 * @returns {Array<Array<string, object>>} A list of ship entries, where each entry is an array of `[id, shipObject]`.
 * @private
 */
function _getShipyardInventory(gameState) {
    const { player, currentLocationId, market, introSequenceActive } = gameState;

    // During the intro, show a fixed, limited set of ships for the tutorial purchase.
    if (introSequenceActive) {
        if (player.ownedShipIds.length > 0) {
            return [];
        } else {
            const introShipIds = [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE];
            return introShipIds.map(id => ([id, DB.SHIPS[id]]));
        }
    } else {
        // In normal gameplay, show the dynamically stocked ships for the current location.
        const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
        return shipsForSaleIds
            .map(id => ([id, DB.SHIPS[id]]))
            .filter(([id, ship]) => !player.ownedShipIds.includes(id));
    }
}