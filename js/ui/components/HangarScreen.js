// js/ui/components/HangarScreen.js
/**
 * @fileoverview Renders the Hangar and Shipyard screen with a modern, interactive UI.
 * This component is responsible for displaying the player's ships and ships for sale,
 * allowing for selection, viewing details, and performing actions like buying or selling.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';

// Helper function to create the main action button based on context.
const _renderActionButton = (gameState, selectedShipId, context) => {
    const { player, tutorials } = gameState;
    const shipStatic = DB.SHIPS[selectedShipId];

    if (context === 'shipyard') {
        const canAfford = player.credits >= shipStatic.price;
        const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
        const isDisabled = !canAfford || isHangarTutStep1Active;
        return `<button class="action-btn purchase-btn" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${selectedShipId}" ${isDisabled ? 'disabled' : ''}>Purchase Ship</button>`;
    } else { // 'hangar'
        const isActive = selectedShipId === player.activeShipId;
        const canSell = player.ownedShipIds.length > 1 && !isActive;
        const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);

        return `
            <div class="hangar-actions">
                ${isActive ? `
                    <button class="action-btn board-btn" disabled>Active Ship</button>
                ` : `
                    <button class="action-btn board-btn" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${selectedShipId}">Board Ship</button>
                `}
                <button class="action-btn sell-btn" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${selectedShipId}" ${!canSell ? 'disabled' : ''}>
                    Sell (${formatCredits(salePrice, false)})
                </button>
            </div>`;
    }
};

// Helper function to render the detailed information panel for the selected ship.
const _renderInfoPanel = (gameState, selectedShipId, context) => {
    const { player } = gameState;
    const shipStatic = DB.SHIPS[selectedShipId];

    if (context === 'shipyard') {
        return `
            <div class="info-panel-content">
                <h3 class="ship-name-info">${shipStatic.name}</h3>
                <p class="ship-class-info">Class ${shipStatic.class}</p>
                <p class="ship-lore">${shipStatic.lore}</p>
                <div class="ship-stats-grid">
                    <div><span>Max Hull</span><span>${shipStatic.maxHealth}</span></div>
                    <div><span>Max Fuel</span><span>${shipStatic.maxFuel}</span></div>
                    <div><span>Cargo</span><span>${shipStatic.cargoCapacity}</span></div>
                </div>
                <div class="ship-price-info">
                    <span>Price</span>
                    <span class="price-value">${formatCredits(shipStatic.price)}</span>
                </div>
            </div>`;
    } else { // 'hangar'
        const shipDynamic = player.shipStates[selectedShipId];
        const shipInventory = player.inventories[selectedShipId];
        const cargoUsed = calculateInventoryUsed(shipInventory);

        return `
            <div class="info-panel-content">
                <h3 class="ship-name-info">${shipStatic.name}</h3>
                <p class="ship-class-info">Class ${shipStatic.class}</p>
                <p class="ship-lore">${shipStatic.lore}</p>
                <div class="ship-stats-grid">
                    <div><span>Hull</span><span>${Math.floor(shipDynamic.health)} / ${shipStatic.maxHealth}</span></div>
                    <div><span>Fuel</span><span>${Math.floor(shipDynamic.fuel)} / ${shipStatic.maxFuel}</span></div>
                    <div><span>Cargo</span><span>${cargoUsed} / ${shipStatic.cargoCapacity}</span></div>
                </div>
            </div>`;
    }
};

// Helper function to render the carousel of available ships.
const _renderShipCarousel = (shipIds, selectedShipId) => {
    if (shipIds.length === 0) {
        return '<div class="carousel-item empty-state">No ships to display.</div>';
    }
    return shipIds.map(id => {
        const shipStatic = DB.SHIPS[id];
        const isActive = id === selectedShipId;
        return `
            <div class="carousel-item ${isActive ? 'active' : ''}" data-action="select-carousel-ship" data-ship-id="${id}">
                <span class="carousel-ship-name">${shipStatic.name}</span>
                <span class="carousel-ship-class">Class ${shipStatic.class}</span>
            </div>
        `;
    }).join('');
};

/**
 * Main render function for the Hangar screen.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/UIManager.js').UIManager} uiManager - The UI Manager instance.
 * @returns {string} The complete HTML for the Hangar screen.
 */
export function renderHangarScreen(gameState, uiManager) {
    const context = uiManager.hangarMode;
    const { player } = gameState;
    
    // Determine the list of ships and the currently selected one.
    const shipList = context === 'shipyard' ? _getShipyardInventory(gameState).map(s => s[0]) : player.ownedShipIds;
    const selectedShipId = gameState.uiState.selectedShipId?.[context] || shipList[0];

    // Get the static data for the selected ship.
    const selectedShipStatic = selectedShipId ? DB.SHIPS[selectedShipId] : null;

    return `
        <div class="ship-terminal-container">
            <div class="terminal-toggle">
                <button class="toggle-btn ${context === 'hangar' ? 'active' : ''}" data-action="set-hangar-mode" data-mode="hangar">Hangar</button>
                <button class="toggle-btn ${context === 'shipyard' ? 'active' : ''}" data-action="set-hangar-mode" data-mode="shipyard">Shipyard</button>
            </div>

            <div class="terminal-main-grid">
                <div class="carousel-container">
                    <div class="carousel-list">
                        ${_renderShipCarousel(shipList, selectedShipId)}
                    </div>
                </div>

                <div class="display-container">
                    <div class="hologram-emitter"></div>
                    <div class="hologram-projection">
                        ${selectedShipStatic ? `<img src="assets/ships/${selectedShipStatic.asset}" alt="${selectedShipStatic.name}" class="hologram-ship-img">` : ''}
                    </div>
                </div>

                <div class="info-panel-container">
                    ${selectedShipId ? _renderInfoPanel(gameState, selectedShipId, context) : ''}
                </div>

                <div class="action-panel-container">
                    ${selectedShipId ? _renderActionButton(gameState, selectedShipId, context) : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Retrieves the list of ships currently available for sale at the docked location.
 * @param {object} gameState The current game state.
 * @returns {Array<Array<string, object>>} A list of ship entries, where each entry is an array of `[id, shipObject]`.
 * @private
 */
function _getShipyardInventory(gameState) {
    const { player, currentLocationId, market, introSequenceActive } = gameState;

    if (introSequenceActive) {
        if (player.ownedShipIds.length > 0) return [];
        const introShipIds = [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE];
        return introShipIds.map(id => ([id, DB.SHIPS[id]]));
    } else {
        const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
        return shipsForSaleIds
            .map(id => ([id, DB.SHIPS[id]]))
            .filter(([id]) => !player.ownedShipIds.includes(id));
    }
}