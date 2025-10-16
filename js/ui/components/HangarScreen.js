// js/ui/components/HangarScreen.js
/**
 * @fileoverview Renders the Hangar screen, now a unified "Ship Terminal" with toggleable
 * Hangar and Shipyard views, a central ship display, and a carousel.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';

/**
 * Renders the entire Hangar screen UI.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/SimulationService.js').SimulationService} simulationService - The simulation service.
 * @returns {string} The HTML content for the Hangar screen.
 */
export function renderHangarScreen(gameState, simulationService) {
    const { uiState, player, tutorials } = gameState;

    // Determine the current mode (Hangar or Shipyard)
    const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
    const modeClass = isHangarMode ? 'mode-hangar' : 'mode-shipyard';
    
    const shipList = isHangarMode ? player.ownedShipIds : simulationService._getShipyardInventory().map(([id]) => id);
    
    // Use the active index from the UI state for the carousel
    const activeCarouselIndex = isHangarMode 
        ? (uiState.hangarActiveIndex || 0) 
        : (uiState.shipyardActiveIndex || 0);

    // Ensure index is not out of bounds if ship list changes
    const displayIndex = Math.min(activeCarouselIndex, Math.max(0, shipList.length - 1));

    return `
        <div id="ship-terminal-container" class="flex flex-col h-full ${modeClass}">
            <div class="toggle-container mx-auto my-1">
                <div class="toggle-switch p-1 rounded-md flex w-[180px] h-10">
                    <div class="toggle-label hangar flex-1 text-center py-1 cursor-pointer" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}" data-mode="hangar">HANGAR</div>
                    <div class="toggle-label shipyard flex-1 text-center py-1 cursor-pointer" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}" data-mode="shipyard">SHIPYARD</div>
                </div>
            </div>

            <div class="carousel-container flex-grow overflow-hidden relative">
                <div id="hangar-carousel" class="flex h-full" style="transform: translateX(-${displayIndex * 100}%)">
                    ${shipList.map(shipId => _renderShipCarouselPage(gameState, shipId, isHangarMode)).join('') || _renderEmptyCarouselPage(isHangarMode)}
                </div>
            </div>

            <div id="hangar-pagination" class="flex justify-center items-center p-2 flex-nowrap overflow-x-auto">
                ${shipList.map((_, index) => `<div class="pagination-dot transition-all duration-300 ${index === displayIndex ? 'active' : ''}" data-action="${ACTION_IDS.SET_HANGAR_PAGE}" data-index="${index}"></div>`).join('')}
            </div>
        </div>
    `;
}

/**
 * Renders a placeholder page for when a carousel is empty.
 * @param {boolean} isHangarMode - True if the hangar is empty, false if the shipyard is empty.
 * @returns {string} HTML for the empty page.
 * @private
 */
function _renderEmptyCarouselPage(isHangarMode) {
    const message = isHangarMode ? "Your hangar is empty." : "No ships available in the shipyard.";
    return `
        <div class="carousel-page p-2 md:p-4 w-full">
             <div id="ship-terminal" class="relative h-full rounded-lg border-2" style="border-color: var(--frame-border-color);">
                <div class="flex flex-col items-center justify-center h-full">
                    <p class="text-gray-400">${message}</p>
                </div>
            </div>
        </div>
    `;
}


/**
 * Renders a single page within the ship carousel.
 * @param {object} gameState The current game state.
 * @param {string} shipId The ID of the ship for this page.
 * @param {boolean} isHangarMode True if the view is for the player's hangar.
 * @returns {string} The HTML for a single carousel page.
 * @private
 */
function _renderShipCarouselPage(gameState, shipId, isHangarMode) {
    const shipStatic = DB.SHIPS[shipId];
    const shipDynamic = isHangarMode ? gameState.player.shipStates[shipId] : null;
    const { player } = gameState;

    // Determine Status Badge
    let statusBadgeHtml = '';
    if (isHangarMode) {
        const isActive = player.activeShipId === shipId;
        statusBadgeHtml = `<div class="status-badge" style="border-color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-border-light)'}; color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-text-secondary)'};">${isActive ? 'ACTIVE' : 'STORED'}</div>`;
    }

    // Conditional rendering for shipyard layout
    const shipyardLayout = `
        <div class="col-span-3 flex flex-col justify-between">
            <div class="ship-display-area flex-grow flex items-center justify-center relative">
                <div class="ship-image-placeholder w-full rounded-lg flex items-center justify-center">
                    <span class="text-2xl font-orbitron">[ SHIP HOLOGRAM ]</span>
                </div>
                ${statusBadgeHtml}
            </div>
        </div>
        <div class="col-span-2 flex flex-col justify-between">
            ${_renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, player, isHangarMode)}
            <div class="action-buttons-container pt-2">
                ${_renderActionButtons(shipId, shipStatic, player, isHangarMode, gameState.tutorials)}
            </div>
        </div>
    `;

    const hangarLayout = `
        <div class="col-span-2 flex flex-col justify-between">
            ${_renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, player, isHangarMode)}
        </div>

        <div class="col-span-3 flex flex-col justify-between">
            <div class="ship-display-area flex-grow flex items-center justify-center relative">
                <div class="ship-image-placeholder w-full rounded-lg flex items-center justify-center">
                    <span class="text-2xl font-orbitron">[ SHIP HOLOGRAM ]</span>
                </div>
                ${statusBadgeHtml}
            </div>
            <div class="action-buttons-container pt-2">
                ${_renderActionButtons(shipId, shipStatic, player, isHangarMode, gameState.tutorials)}
            </div>
        </div>
    `;

    return `
        <div class="carousel-page p-2 md:p-4 w-full">
            <div id="ship-terminal" class="relative h-full rounded-lg border-2" style="border-color: var(--frame-border-color);">
                <div id="ship-card-main-content" class="h-full">
                    <div class="ship-card-content-wrapper h-full">
                        ${isHangarMode ? hangarLayout : shipyardLayout}
                    </div>
                </div>
            </div>
        </div>
    `;
}


/**
 * Renders the appropriate info panel (Hangar or Shipyard).
 * @param {object} gameState - The current state of the game.
 * @param {string} shipId - The ID of the ship.
 * @param {object} shipStatic - The static data for the ship.
 * @param {object} shipDynamic - The dynamic state for the ship (hangar only).
 * @param {object} player - The player object.
 * @param {boolean} isHangarMode - True if rendering the hangar view.
 * @returns {string} The HTML for the info panel.
 * @private
 */
function _renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, player, isHangarMode) {
    const shipClassLower = shipStatic.class.toLowerCase();

    if (isHangarMode) {
        return `
            <div class="info-panel-content info-panel-hangar flex-col justify-between h-full">
                <div>
                    <h3 class="text-2xl font-orbitron inset-text-shadow" style="color: var(--class-${shipClassLower}-color);">${shipStatic.name}</h3>
                    <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                </div>
                <div class="hangar-specs my-4">
                    ${_renderSpecBar("Hull", shipDynamic?.health, shipStatic.maxHealth, 'var(--ot-green-accent)')}
                    ${_renderSpecBar("Fuel", shipDynamic?.fuel, shipStatic.maxFuel, 'var(--ot-cyan-base)')}
                    ${_renderSpecBar("Cargo", calculateInventoryUsed(player.inventories[shipId]), shipStatic.cargoCapacity, 'var(--class-s-color)')}
                </div>
                <div class="flavor-text-box mt-auto" style="border-color: var(--frame-border-color);">
                    <p class="text-sm text-gray-300">${shipStatic.lore}</p>
                </div>
            </div>
        `;
    } else {
        return `
             <div class="info-panel-content info-panel-shipyard flex-col justify-between h-full">
                <div>
                    <h3 class="text-2xl font-orbitron inset-text-shadow" style="color: var(--class-${shipClassLower}-color);">${shipStatic.name}</h3>
                    <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                    <p class="ship-price-display font-roboto-mono text-2xl">${formatCredits(shipStatic.price)}</p>
                </div>
                 <div class="grid grid-cols-3 gap-2 my-4">
                    ${_renderSpecCard("Max Hull", shipStatic.maxHealth)}
                    ${_renderSpecCard("Max Fuel", shipStatic.maxFuel)}
                    ${_renderSpecCard("Cargo Hold", shipStatic.cargoCapacity)}
                </div>
                <div class="flavor-text-box mt-auto" style="border-color: var(--frame-border-color);">
                    <p class="text-sm text-gray-300">${shipStatic.lore}</p>
                </div>
            </div>
        `;
    }
}


/**
 * Renders the appropriate action buttons (Hangar or Shipyard).
 * @param {string} shipId - The ID of the ship.
 * @param {object} shipStatic - The static data for the ship.
 * @param {object} player - The player object.
 * @param {boolean} isHangarMode - True if rendering the hangar view.
 * @param {object} tutorials - The current tutorial state.
 * @returns {string} The HTML for the action buttons.
 * @private
 */
function _renderActionButtons(shipId, shipStatic, player, isHangarMode, tutorials) {
    if (isHangarMode) {
        const isActive = player.activeShipId === shipId;
        const canSell = player.ownedShipIds.length > 1 && !isActive;
        const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);
        return `
            <div class="grid grid-cols-2 gap-2">
                <button class="action-button" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${shipId}" ${isActive ? 'disabled' : ''} style="background-color: ${isActive ? '#374151' : 'var(--ot-cyan-base)'}; color: ${isActive ? 'var(--ot-text-secondary)' : 'var(--ot-bg-dark)'};">
                    <span class="font-bold">${isActive ? 'ACTIVE' : 'BOARD'}</span>
                </button>
                <button class="action-button" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${shipId}" ${!canSell ? 'disabled' : ''} style="background-color: var(--ot-hangar-red-base);">
                    <span class="font-bold">SELL</span>
                    <span class="action-button-price font-roboto-mono">${formatCredits(salePrice, true)}</span>
                </button>
            </div>
        `;
    } else { // Shipyard
        const canAfford = player.credits >= shipStatic.price;
        const activeStep = tutorials.activeBatchId ? DB.TUTORIAL_DATA[tutorials.activeBatchId]?.steps.find(s => s.stepId === tutorials.activeStepId) : null;
        const isPurchaseLocked = tutorials.activeBatchId === 'intro_hangar' && !activeStep?.unlockPurchase;
        const isDisabled = !canAfford || isPurchaseLocked;
        
        return `
            <button class="action-button w-full justify-center" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${shipId}" ${isDisabled ? 'disabled' : ''} style="background-color: var(--ot-green-accent);">
                <span class="font-bold">PURCHASE</span>
            </button>
        `;
    }
}


/**
 * Helper to render a single stat bar for the Hangar view.
 * @private
 */
function _renderSpecBar(label, current, max, color) {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    return `
        <div class="spec-readout hangar-specs">
            <span class="text-xs text-right pr-2 text-gray-400">${label}</span>
            <div class="spec-bar"><div class="spec-bar-fill" style="width: ${percentage}%; background-color: ${color}; --bar-color: ${color};"></div></div>
            <span class="text-xs text-left pl-2">${Math.floor(current ?? 0)}/${max}</span>
        </div>
    `;
}

/**
 * Helper to render a single spec card for the Shipyard view.
 * @private
 */
function _renderSpecCard(label, value) {
    return `
        <div class="spec-card">
            <p class="text-xs text-gray-400">${label}</p>
            <p class="text-lg font-bold font-orbitron">${value}</p>
        </div>
    `;
}