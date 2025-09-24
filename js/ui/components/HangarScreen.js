// js/ui/components/HangarScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Hangar screen,
 * featuring a dynamic, carousel-based UI for managing the player's owned ships (Hangar)
 * and viewing ships available for purchase (Shipyard).
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';

// #region Main Rendering Function
/**
 * Renders the entire Hangar/Shipyard screen component.
 * @param {object} gameState - The current state of the game.
 * @param {object} uiState - The current UI state specific to the hangar screen.
 * @returns {string} The HTML content for the Hangar screen.
 */
export function renderHangarScreen(gameState, uiState) {
    const { mode = 'shipyard', currentIndex = 0 } = uiState.hangarScreen || {};
    const shipList = mode === 'hangar'
        ? gameState.player.ownedShipIds
        : _getShipyardInventory(gameState).map(([id]) => id);

    const carouselPagesHtml = shipList.map(id => _renderShipPage(gameState, id, mode)).join('');
    const paginationDotsHtml = shipList.map((_, i) =>
        `<div class="pagination-dot w-2.5 h-2.5 bg-gray-600 rounded-full cursor-pointer transition-all ${i === currentIndex ? 'active' : ''}" data-action="${ACTION_IDS.PAGINATE_HANGAR}" data-index="${i}"></div>`
    ).join('');

    const location = DB.MARKETS.find(l => l.id === gameState.currentLocationId);
    if (location?.navTheme) {
        document.documentElement.style.setProperty('--theme-color-primary', location.navTheme.borderColor);
        document.documentElement.style.setProperty('--theme-color-glow', location.navTheme.glowColor || `${location.navTheme.borderColor}80`);
    }

    return `
        <div id="ship-terminal" class="mode-${mode}">
            <header class="text-center p-4 pt-5 flex-shrink-0 flex flex-col items-center gap-2 z-10">
                <div class="toggle-container">
                    <div id="mode-toggle" class="toggle-switch w-[150px] h-8 cursor-pointer relative" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}">
                        <span class="toggle-label hangar font-orbitron text-xs tracking-widest font-bold">Hangar</span>
                        <span class="toggle-label shipyard font-orbitron text-xs tracking-widest font-bold">Shipyard</span>
                    </div>
                </div>
            </header>
            <main id="carousel-main" class="flex-grow flex flex-col min-h-0 z-10">
                <div class="carousel-container flex-grow">
                    ${carouselPagesHtml}
                </div>
                <footer id="pagination-container" class="pagination-indicator flex items-center justify-center gap-3 p-3 mt-auto flex-shrink-0">
                    <div id="pagination-dots" class="flex gap-3 items-center">
                        ${paginationDotsHtml}
                    </div>
                </footer>
            </main>
        </div>`;
}
// #endregion

// #region Page & View Renderers
/**
 * Renders a single page within the carousel, containing the ship display and info panels.
 * @param {object} gameState - The current state of the game.
 * @param {string} shipId - The ID of the ship for this page.
 * @param {string} mode - The current view mode ('hangar' or 'shipyard').
 * @returns {string} HTML for a single carousel page.
 * @private
 */
function _renderShipPage(gameState, shipId, mode) {
    const ship = DB.SHIPS[shipId];
    const hangarHtml = _renderHangarView(gameState, ship);
    const shipyardHtml = _renderShipyardView(ship);
    const isActiveShip = ship.id === gameState.player.activeShipId;

    return `
        <div class="carousel-page flex flex-col p-4 pt-0 box-border h-full">
            <div class="ship-display-area w-full h-[28vh] flex-shrink-0">
                <div class="ship-image-placeholder w-full h-full rounded-md flex items-center justify-center p-2 text-center font-roboto-mono text-sm">
                    Ship Image Placeholder<br>(${ship.name})
                </div>
                ${mode === 'hangar' ? (isActiveShip ? `<div class="status-badge border-yellow-400 text-yellow-300">ACTIVE</div>` : `<div class="status-badge border-gray-400 text-gray-300">STORED</div>`) : ''}
            </div>
            <div class="ship-info-panel flex-grow overflow-hidden mt-8 w-full flex flex-col">
                ${shipyardHtml}
                ${hangarHtml}
            </div>
            <div class="action-buttons-container mt-auto pt-2 flex-shrink-0">
                ${mode === 'hangar' ? _renderHangarActions(gameState, ship) : _renderShipyardActions(gameState, ship)}
            </div>
        </div>`;
}

/**
 * Renders the detailed info panel for the Shipyard view.
 * @param {object} ship - The static ship data object from the database.
 * @returns {string} HTML for the shipyard info panel.
 * @private
 */
function _renderShipyardView(ship) {
    const shipClassColor = `var(--class-${ship.class.toLowerCase()}-color)`;
    return `
        <div class="info-panel-content info-panel-shipyard flex-col h-full">
            <div class="scrollable-content flex-grow flex flex-col">
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="font-orbitron text-[2.1rem] inset-text-shadow" style="color: ${shipClassColor};">${ship.name}</h3>
                        <p class="text-[1rem] text-gray-400 -mt-1 inset-text-shadow">${ship.role || 'Vessel'}</p>
                    </div>
                    <div class="px-3 py-1 rounded-full text-base font-bold font-roboto-mono border-2" style="transform: scale(0.9); border-color: ${shipClassColor}; color: ${shipClassColor};">CLASS ${ship.class}</div>
                </div>
                <div class="my-4 grid grid-cols-3 gap-2">
                    <div class="spec-card">
                        <div class="text-base text-gray-400">MAX HULL</div>
                        <div class="text-2xl font-bold text-green-400">${ship.maxHealth}</div>
                    </div>
                     <div class="spec-card">
                        <div class="text-base text-gray-400">MAX FUEL</div>
                        <div class="text-2xl font-bold text-blue-400">${ship.maxFuel}</div>
                    </div>
                     <div class="spec-card">
                        <div class="text-base text-gray-400">CAPACITY</div>
                        <div class="text-2xl font-bold text-orange-400">${ship.cargoCapacity}</div>
                    </div>
                </div>
                <div class="flex-grow flex items-end pb-4">
                     <p class="flavor-text-box text-[0.85rem] text-gray-400 italic" style="border-color: ${shipClassColor}80">${ship.lore}</p>
                </div>
            </div>
        </div>`;
}

/**
 * Renders the detailed info panel for the Hangar view.
 * @param {object} gameState - The current state of the game.
 * @param {object} ship - The static ship data object from the database.
 * @returns {string} HTML for the hangar info panel.
 * @private
 */
function _renderHangarView(gameState, ship) {
    const shipState = gameState.player.shipStates[ship.id];
    const inventory = gameState.player.inventories[ship.id] || {};
    const cargoUsed = calculateInventoryUsed(inventory);
    const hullPct = (shipState.health / ship.maxHealth) * 100;
    const fuelPct = (shipState.fuel / ship.maxFuel) * 100;
    const cargoPct = (cargoUsed / ship.cargoCapacity) * 100;
    const statusColor = hullPct > 90 ? 'var(--ot-green-accent)' : hullPct > 60 ? 'var(--class-s-color)' : 'var(--ot-red-accent)';
    let status = "Optimal";
    if (hullPct <= 90) status = "Minor Wear";
    if (hullPct <= 60) status = "Damaged";
    const shipClassColor = `var(--class-${ship.class.toLowerCase()}-color)`;

    return `
        <div class="info-panel-content info-panel-hangar flex-col h-full">
            <div class="scrollable-content flex-grow flex flex-col">
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="font-orbitron text-[1.35rem] inset-text-shadow" style="color: ${shipClassColor};">${ship.name}</h3>
                        <p class="text-[0.82rem] text-gray-400 -mt-1 inset-text-shadow">${ship.role || 'Vessel'}</p>
                    </div>
                    <div class="px-1.5 py-0.5 rounded-full text-[0.65rem] font-bold font-roboto-mono border" style="border-color: ${shipClassColor}; color: ${shipClassColor};">CLASS ${ship.class}</div>
                </div>
                <div class="font-roboto-mono text-sm my-4">
                    <div class="flex justify-center items-center mb-3 text-sm">
                        <span class="text-gray-400 mr-2">STATUS:</span>
                        <span class="px-2 py-0.5 rounded-md border text-xs" style="color:${statusColor}; border-color:${statusColor}80;">${status}</span>
                    </div>
                    <div class="spec-readout hangar-specs">
                        <span class="text-green-400">HULL</span>
                        <div class="w-4/5 mx-auto"><div class="spec-bar"><div class="spec-bar-fill bg-green-400" style="width: ${hullPct}%; --bar-color: #4ade80;"></div></div></div>
                        <span class="text-xs">${Math.floor(shipState.health)}/${ship.maxHealth}</span>
                    </div>
                    <div class="spec-readout hangar-specs">
                        <span class="text-blue-400">FUEL</span>
                        <div class="w-4/5 mx-auto"><div class="spec-bar"><div class="spec-bar-fill bg-blue-400" style="width: ${fuelPct}%; --bar-color: #60a5fa;"></div></div></div>
                        <span class="text-xs">${Math.floor(shipState.fuel)}/${ship.maxFuel}</span>
                    </div>
                    <div class="spec-readout hangar-specs">
                        <span class="text-orange-400">CARGO</span>
                        <div class="w-4/5 mx-auto"><div class="spec-bar"><div class="spec-bar-fill bg-orange-400" style="width: ${cargoPct}%; --bar-color: #f97316;"></div></div></div>
                        <span class="text-xs">${cargoUsed}/${ship.cargoCapacity}</span>
                    </div>
                </div>
                <div class="flex-grow flex items-center">
                    <p class="flavor-text-box text-xs text-gray-400 italic" style="border-color: ${shipClassColor}80">${ship.lore}</p>
                </div>
            </div>
        </div>`;
}
// #endregion

// #region Action Button Renderers
/**
 * Renders the action buttons for the Shipyard view.
 * @param {object} gameState - The current state of the game.
 * @param {object} ship - The static ship data object from the database.
 * @returns {string} HTML for the shipyard action buttons.
 * @private
 */
function _renderShipyardActions(gameState, ship) {
    const canAfford = gameState.player.credits >= ship.price;
    return `
        <div class="flex justify-center">
            <button class="action-button w-3/4 bg-green-800/50 border border-green-600 text-green-300" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${ship.id}" ${!canAfford ? 'disabled' : ''}>
                <span class="text-sm font-bold">PURCHASE</span>
                <span class="price-text font-roboto-mono">⌬ ${ship.price.toLocaleString()}</span>
            </button>
        </div>`;
}

/**
 * Renders the action buttons for the Hangar view.
 * @param {object} gameState - The current state of the game.
 * @param {object} ship - The static ship data object from the database.
 * @returns {string} HTML for the hangar action buttons.
 * @private
 */
function _renderHangarActions(gameState, ship) {
    const isActive = ship.id === gameState.player.activeShipId;
    const canSell = gameState.player.ownedShipIds.length > 1 && !isActive;
    const salePrice = Math.floor(ship.price * GAME_RULES.SHIP_SELL_MODIFIER);
    return `
        <div class="grid grid-cols-2 gap-3">
            <button class="action-button bg-cyan-800/50 border border-cyan-600 text-cyan-300 justify-center" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${ship.id}" ${isActive ? 'disabled' : ''}>
                <span class="text-xs font-bold">${isActive ? 'CURRENTLY ACTIVE' : 'SET ACTIVE'}</span>
            </button>
            <button class="action-button bg-red-800/50 border border-red-600 text-red-300" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${ship.id}" ${!canSell ? 'disabled' : ''}>
                 <span class="text-xs font-bold">SELL SHIP</span>
                 <span class="price-text font-roboto-mono">⌬ ${salePrice.toLocaleString()}</span>
            </button>
        </div>`;
}
// #endregion

// #region Helper Functions
/**
 * Retrieves the list of ships currently available for sale at the docked location.
 * @param {object} gameState The current game state.
 * @returns {Array<Array<string, object>>} A list of ship entries `[id, shipObject]`.
 * @private
 */
function _getShipyardInventory(gameState) {
    const { player, currentLocationId, market, introSequenceActive } = gameState;
    const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
    return shipsForSaleIds
        .map(id => ([id, DB.SHIPS[id]]))
        .filter(([id, ship]) => !player.ownedShipIds.includes(id));
}
// #endregion