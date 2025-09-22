// js/ui/components/HangarScreen.js
/**
 * @fileoverview Renders the Hangar and Shipyard screen using a new carousel-based "Ship Terminal" UI.
 * This component displays owned ships (Hangar) and ships for sale (Shipyard) in an interactive,
 * horizontally-scrolling format, replacing the previous static list view.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';

/**
 * Renders the entire Ship Terminal screen, which includes both Hangar and Shipyard views.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/UIManager.js').UIManager} uiManager - The UI Manager instance, used for local state.
 * @returns {string} The HTML content for the Hangar/Shipyard screen.
 */
export function renderHangarScreen(gameState, uiManager) {
    const { player, tutorials } = gameState;
    const currentShipList = uiManager.hangarMode === 'hangar' ? player.ownedShipIds : _getShipyardInventory(gameState).map(([id]) => id);

    let carouselPagesHtml = '';
    if (currentShipList.length > 0) {
        carouselPagesHtml = currentShipList.map(shipId => _renderShipCarouselPage(gameState, shipId, uiManager.hangarMode)).join('');
    } else {
        carouselPagesHtml = `<div class="carousel-page flex items-center justify-center text-gray-500 font-roboto-mono">No ships available.</div>`;
    }

    const paginationDotsHtml = currentShipList.map((_, index) => {
        const isActive = index === uiManager.hangarCarouselIndex;
        return `<div class="pagination-dot w-2.5 h-2.5 bg-gray-600 rounded-full cursor-pointer transition-all ${isActive ? 'active' : ''}" data-action="set-hangar-carousel-index" data-index="${index}"></div>`;
    }).join('');

    return `
        <div id="ship-terminal" class="w-full h-full rounded-xl flex flex-col overflow-hidden relative mode-${uiManager.hangarMode}">
            <header class="text-center p-4 pt-5 flex-shrink-0 flex flex-col items-center gap-2 z-10">
                <div class="toggle-container">
                    <div id="mode-toggle" class="toggle-switch w-[150px] h-8 cursor-pointer relative">
                        <span id="label-hangar" class="toggle-label hangar font-orbitron text-xs tracking-widest font-bold" data-action="toggle-hangar-mode">Hangar</span>
                        <span id="label-shipyard" class="toggle-label shipyard font-orbitron text-xs tracking-widest font-bold" data-action="toggle-hangar-mode">Shipyard</span>
                    </div>
                </div>
            </header>
            <main id="carousel-main" class="flex-grow flex flex-col min-h-0 z-10">
                <div class="carousel-container flex-grow">
                    ${carouselPagesHtml}
                </div>
                <footer id="pagination-container" class="pagination-indicator flex items-center justify-center gap-3 p-3 mt-auto flex-shrink-0">
                    <div class="flex gap-3 items-center">${paginationDotsHtml}</div>
                </footer>
            </main>
        </div>`;
}

/**
 * Renders a single page (a ship card) for the carousel.
 * @param {object} gameState - The current game state.
 * @param {string} shipId - The ID of the ship to render.
 * @param {string} mode - The current mode ('hangar' or 'shipyard').
 * @returns {string} The HTML for a single carousel page.
 * @private
 */
function _renderShipCarouselPage(gameState, shipId, mode) {
    const { player } = gameState;
    const ship = DB.SHIPS[shipId];
    const shipClassColor = `var(--class-${ship.class.toLowerCase()}-color)`;
    
    const shipyardHtml = _renderShipyardView(player, ship);
    const hangarHtml = _renderHangarView(player, ship);

    return `
        <div class="carousel-page flex flex-col p-4 pt-0 box-border h-full">
            <div class="ship-display-area w-full h-[28vh] flex-shrink-0">
                <div class="ship-image-placeholder w-full h-full rounded-md flex items-center justify-center p-2 text-center font-roboto-mono text-sm">
                    Ship Image Placeholder<br>(${ship.name})
                </div>
                ${mode === 'hangar' ? (ship.id === player.activeShipId ? `<div class="status-badge border-yellow-400 text-yellow-300">ACTIVE</div>` : `<div class="status-badge border-gray-400 text-gray-300">STORED</div>`) : ''}
            </div>
            <div class="ship-info-panel flex-grow overflow-hidden mt-8 w-full flex flex-col">
                ${shipyardHtml}
                ${hangarHtml}
            </div>
            <div class="action-buttons-container mt-auto pt-2 flex-shrink-0">
                ${mode === 'hangar' ? _renderHangarActions(player, ship) : _renderShipyardActions(player, ship)}
            </div>
        </div>`;
}

/**
 * Renders the info panel for the Shipyard view.
 * @param {object} player - The player state object.
 * @param {object} ship - The ship static data from the database.
 * @returns {string} HTML for the shipyard info panel.
 * @private
 */
function _renderShipyardView(player, ship) {
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
 * Renders the info panel for the Hangar view.
 * @param {object} player - The player state object.
 * @param {object} ship - The ship static data from the database.
 * @returns {string} HTML for the hangar info panel.
 * @private
 */
function _renderHangarView(player, ship) {
    const shipState = player.shipStates[ship.id];
    const inventory = player.inventories[ship.id];
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

/**
 * Renders the action buttons for the Hangar view.
 * @param {object} player - The player state object.
 * @param {object} ship - The ship static data from the database.
 * @returns {string} HTML for the hangar action buttons.
 * @private
 */
function _renderHangarActions(player, ship) {
    const isActive = ship.id === player.activeShipId;
    const canSell = player.ownedShipIds.length > 1 && !isActive;
    const salePrice = Math.floor(ship.price * GAME_RULES.SHIP_SELL_MODIFIER);

    return `
        <div class="grid grid-cols-2 gap-3">
            <button class="action-button bg-cyan-800/50 border border-cyan-600 text-cyan-300 justify-center" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${ship.id}" ${isActive ? 'disabled' : ''}>
                <span class="text-xs font-bold">${isActive ? 'CURRENTLY ACTIVE' : 'SET ACTIVE'}</span>
            </button>
            <button class="action-button bg-red-800/50 border border-red-600 text-red-300" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${ship.id}" ${!canSell ? 'disabled' : ''}>
                 <span class="text-xs font-bold">SELL SHIP</span>
                 <span class="price-text font-roboto-mono">${formatCredits(salePrice, false)}</span>
            </button>
        </div>`;
}

/**
 * Renders the action buttons for the Shipyard view.
 * @param {object} player - The player state object.
 * @param {object} ship - The ship static data from the database.
 * @returns {string} HTML for the shipyard action buttons.
 * @private
 */
function _renderShipyardActions(player, ship) {
    const canAfford = player.credits >= ship.price;
    return `
        <div class="flex justify-center">
            <button class="action-button w-3/4 bg-green-800/50 border border-green-600 text-green-300" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${ship.id}" ${!canAfford ? 'disabled' : ''}>
                <span class="text-sm font-bold">PURCHASE</span>
                <span class="price-text font-roboto-mono">${formatCredits(ship.price)}</span>
            </button>
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