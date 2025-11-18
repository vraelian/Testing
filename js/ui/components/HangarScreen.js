// js/ui/components/HangarScreen.js
/**
 * @fileoverview Renders the Hangar screen, now a unified "Ship Terminal" with toggleable
 * Hangar and Shipyard views, a central ship display, and a carousel.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';
import { SHIP_DATABASE } from '../../data/ship_database.js';

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

    // NOTE: The pagination dots are now rendered dynamically by the UIManager._updateHangarScreen method.
    return `
        <div class="flex flex-col h-full">
            <div id="ship-terminal-container" class="flex flex-col flex-grow min-h-0 ${modeClass}">
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
            </div>
            <div id="hangar-pagination-wrapper">
                <div id="hangar-pagination">
                    {/* This will be populated by UIManager._renderHangarPagination */}
                </div>
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
    const shipStatic = SHIP_DATABASE[shipId];
    // VIRTUAL WORKBENCH: Bug Fix B - We no longer need the destructured 'player' here.
    const shipDynamic = isHangarMode ? gameState.player.shipStates[shipId] : null;
    const { player } = gameState; // Keep this for _renderActionButtons

    // Determine Status Badge
    let statusBadgeHtml = '';
    const isActive = player.activeShipId === shipId; 
    if (isHangarMode) {
        statusBadgeHtml = `<div class="status-badge" style="border-color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-border-light)'}; color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-text-secondary)'};">${isActive ? 'ACTIVE' : 'STORED'}</div>`;
    }

    // Conditional rendering for shipyard layout
    const shipyardLayout = `
        <div class="col-span-3 flex flex-col justify-between">
            <div class="ship-display-area flex-grow flex items-center justify-center relative">
                <button class="ship-info-button" data-action="show_ship_info" data-ship-id="${shipId}">ⓘ</button>
                <div class="ship-image-placeholder w-full rounded-lg flex items-center justify-center">
                    <span class="text-2xl font-orbitron">[ SHIP HOLOGRAM ]</span>
                </div>
                ${statusBadgeHtml}
            </div>
        </div>
        <div class="col-span-2 flex flex-col justify-between">
            ${_renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, isHangarMode)}
            <div class="action-buttons-container pt-2">
                ${_renderActionButtons(shipId, shipStatic, player, isHangarMode, gameState.tutorials)}
            </div>
        </div>
    `;

    const hangarLayout = `
        <div class="col-span-2 flex flex-col justify-between">
            ${_renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, isHangarMode)}
        </div>

        <div class="col-span-3 flex flex-col justify-between">
            <div class="ship-display-area flex-grow flex items-center justify-center relative">
                <button class="ship-info-button" data-action="show_ship_info" data-ship-id="${shipId}">ⓘ</button>
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

    // --- VIRTUAL WORKBENCH: MODIFICATION ---
    // Added the .active-ship class conditionally based on isActive and isHangarMode.
    return `
        <div class="carousel-page p-2 md:p-4 w-full">
            <div id="ship-terminal" class="relative h-full rounded-lg border-2 ${isActive && isHangarMode ? 'active-ship' : ''}" style="border-color: var(--frame-border-color);">
                <div id="ship-card-main-content" class="h-full">
                    <div class="ship-card-content-wrapper h-full">
                        ${isHangarMode ? hangarLayout : shipyardLayout}
                    </div>
                </div>
            
            </div>
        </div>
    `;
    // --- END VIRTUAL WORKBENCH ---
}


/**
 * Renders the appropriate info panel (Hangar or Shipyard).
 * @param {object} gameState - The current state of the game.
 * @param {string} shipId - The ID of the ship.
 * @param {object} shipStatic - The static data for the ship.
 * @param {object} shipDynamic - The dynamic state for the ship (hangar only).
 * @param {boolean} isHangarMode - True if rendering the hangar view.
 * @returns {string} The HTML for the info panel.
 * @private
 */
// VIRTUAL WORKBENCH: Bug Fix B - Removed 'player' from args, will use 'gameState.player'
function _renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, isHangarMode) {
    const shipClassLower = shipStatic.class.toLowerCase();

    // --- VIRTUAL WORKBENCH START ---
    if (isHangarMode) {
        return `
            <div class="info-panel-content info-panel-hangar flex-col justify-between h-full">
                <div class="info-panel-header">
                    <div class="info-panel-text">
                        <h3 class="text-2xl font-orbitron inset-text-shadow" style="color: var(--class-${shipClassLower}-color);">${shipStatic.name}</h3>
                        <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                    </div>
                    ${_renderParamBars(shipStatic, shipDynamic, gameState.player, false, shipId)}
                </div>
                
                <div class="flavor-text-box mt-auto" style="border-color: var(--frame-border-color);">
                    <p class="text-sm text-gray-300">${shipStatic.description}</p>
                </div>
            </div>
        `;
    } else {
        return `
             <div class="info-panel-content info-panel-shipyard flex-col justify-between h-full">
                <div class="info-panel-header">
                    <div class="info-panel-text">
                        <h3 class="text-2xl font-orbitron inset-text-shadow" style="color: var(--class-${shipClassLower}-color);">${shipStatic.name}</h3>
                        <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                        <p class="ship-price-display font-roboto-mono text-2xl credits-text-pulsing">${formatCredits(shipStatic.price, true)}</p>
                    </div>
                    ${_renderParamBars(shipStatic, shipDynamic, gameState.player, true, shipId)}
                </div>

                <div class="flavor-text-box mt-auto" style="border-color: var(--frame-border-color);">
                    <p class="text-sm text-gray-300">${shipStatic.description}</p>
                </div>
            </div>
        `;
    }
    // --- VIRTUAL WORKBENCH END ---
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
                    <span class="action-button-price font-roboto-mono credits-text-pulsing">${formatCredits(salePrice, true)}</span>
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


// --- VIRTUAL WORKBENCH START ---
/**
 * Renders the HULL, CARGO, and FUEL parameter bars.
 * @param {object} shipStatic - The static data for the ship (for max values).
 * @param {object} shipDynamic - The dynamic state (health, fuel). Null for shipyard.
 * @param {object} player - The player object (for cargo).
 * @param {boolean} [isShipyard=false] - Flag to determine style and values.
 * @param {string} shipId - The specific ID of the ship being rendered.
 * @returns {string} HTML for the parameter bars.
 * @private
 */
function _renderParamBars(shipStatic, shipDynamic, player, isShipyard = false, shipId) {
    // --- VIRTUAL WORKBENCH: BUG FIX ---
    // The incorrect line 'const shipId = shipStatic.id;' has been removed.
    // The correct 'shipId' is now passed in as an argument.
    // --- END BUG FIX ---

    // Determine current values
    const currentHull = isShipyard ? shipStatic.maxHealth : shipDynamic?.health ?? 0;
    // VIRTUAL WORKBENCH: Request E - This logic is correct and matches the nav bar.
    // It reads the *entire* player object and keys into the *specific* ship's inventory.
    const currentCargo = isShipyard ? shipStatic.cargoCapacity : calculateInventoryUsed(player.inventories[shipId]);
    const currentFuel = isShipyard ? shipStatic.maxFuel : shipDynamic?.fuel ?? 0;

    // Determine percentages
    const hullPct = shipStatic.maxHealth > 0 ? (currentHull / shipStatic.maxHealth) * 100 : 0;
    const cargoPct = shipStatic.cargoCapacity > 0 ? (currentCargo / shipStatic.cargoCapacity) * 100 : 0;
    const fuelPct = shipStatic.maxFuel > 0 ? (currentFuel / shipStatic.maxFuel) * 100 : 0;
    // Determine colors
    const hullColor = 'var(--ot-green-accent)';
    // VIRTUAL WORKBENCH: Request B - Match nav bar colors
    const cargoColor = '#f59e0b'; // Was 'var(--class-s-color)'
    const fuelColor = '#3b82f6'; // Was 'var(--ot-shipyard-blue-base)'

    /**
     * Helper to render a single bar with its text overlay.
     * @param {string} label - The bar's label (e.g., "HULL").
     * @param {number} current - The current value.
     * @param {number} max - The maximum value.
     * @param {number} percentage - The fill percentage.
     * @param {string} color - The bar's fill color.
     * @returns {string} HTML for a single bar item.
     */
    const renderBar = (label, current, max, percentage, color) => {
        const c = Math.floor(current);
        const m = Math.floor(max);
        
        const isMax = (c >= m);
        const displayText = isMax ? m : `${c} / ${m}`;
        const textClass = isMax ? 'max' : 'partial'; // ADDED: Class for alignment

        return `
            <div class="param-bar-item">
                <span class="param-bar-label">${label}</span>
                <div class="param-bar-track">
                    <div class="param-bar-fill" style="width: ${percentage}%; background-color: ${color}; --bar-color: ${color};"></div>
                    <span class="param-bar-text ${textClass}">${displayText}</span>
                </div>
            </div>
        `;
    };

    return `
        <div class="ship-param-bars ${isShipyard ? 'shipyard-bars' : ''}">
            ${renderBar('HULL', currentHull, shipStatic.maxHealth, hullPct, hullColor)}
            ${renderBar('CARGO', currentCargo, shipStatic.cargoCapacity, cargoPct, cargoColor)}
            ${renderBar('FUEL', currentFuel, shipStatic.maxFuel, fuelPct, fuelColor)}
        </div>
    `;
}
// --- VIRTUAL WORKBENCH END ---