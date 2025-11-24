// js/ui/components/HangarScreen.js

import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';
import { AssetService } from '../../services/AssetService.js';

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

    // Only show Access Archive if in Hangar Mode OR if Shipyard has ships.
    const showArchive = isHangarMode || shipList.length > 0;

    return `
        <div class="flex flex-col h-full">
            <div id="ship-terminal-container" class="flex flex-col flex-grow min-h-0 ${modeClass}">
                
                <div class="relative mx-auto my-1 w-max flex justify-center items-center">
                    <div class="toggle-container">
                        <div class="toggle-switch p-1 rounded-md flex w-[180px] h-10">
                            <div class="toggle-label hangar flex-1 text-center py-1 cursor-pointer" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}" data-mode="hangar">HANGAR</div>
                            <div class="toggle-label shipyard flex-1 text-center py-1 cursor-pointer" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}" data-mode="shipyard">SHIPYARD</div>
                        </div>
                    </div>
                    <div class="archive-link ${showArchive ? '' : 'hidden'}" data-action="show_ship_lore">ACCESS<br>ARCHIVE</div>
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
    const shipStatic = DB.SHIPS[shipId];
    const shipDynamic = isHangarMode ? gameState.player.shipStates[shipId] : null;
    const { player } = gameState; 

    // Determine Status Badge
    let statusBadgeHtml = '';
    const isActive = player.activeShipId === shipId; 
    
    // Optimized: Only inject the glow layer DIV if this specific ship is active.
    const activeGlowLayer = (isActive && isHangarMode) ? '<div class="active-ship-glow-layer"></div>' : '';

    if (isHangarMode) {
        statusBadgeHtml = `<div class="status-badge" style="border-color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-border-light)'}; color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-text-secondary)'};">${isActive ? 'ACTIVE' : 'STORED'}</div>`;
    }

    // --- [[START]] MODIFICATION ---
    // Calculate Paths using Modulo Math (via AssetService)
    const imagePath = AssetService.getShipImage(shipId, player.visualSeed);
    const fallbackPath = AssetService.getFallbackImage(shipId);
    const isVariantA = imagePath.endsWith('_A.jpeg');

    // Logic: 
    // 1. Try loading [Ship]_[Variant].jpeg
    // 2. On Error:
    //    a. If we already tried fallback OR the requested variant WAS 'A', give up (hide image, show text).
    //    b. Else, try loading [Ship]_A.jpeg and set a flag.
    const shipImageHtml = `
        <img src="${imagePath}" 
             class="w-full h-full object-cover rounded-lg relative z-10" 
             alt="${shipStatic.name}"
             data-fallback-src="${fallbackPath}"
             data-is-a="${isVariantA}"
             onerror="if (this.getAttribute('data-tried-fallback') === 'true' || this.getAttribute('data-is-a') === 'true') { this.style.display='none'; this.nextElementSibling.style.display='flex'; } else { this.setAttribute('data-tried-fallback', 'true'); this.src=this.getAttribute('data-fallback-src'); }">
        <span class="text-2xl font-orbitron absolute inset-0 hidden items-center justify-center z-0 text-center">[ SHIP HOLOGRAM ]</span>
    `;
    // --- [[END]] MODIFICATION ---

    // Conditional rendering for shipyard layout
    const shipyardLayout = `
        <div class="col-span-3 flex flex-col justify-between">
            <div class="ship-display-area flex-grow flex items-center justify-center relative">
                <div class="ship-image-placeholder w-full rounded-lg flex items-center justify-center relative overflow-hidden">
                    ${shipImageHtml}
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
                <div class="ship-image-placeholder w-full rounded-lg flex items-center justify-center relative overflow-hidden">
                    ${shipImageHtml}
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
                ${activeGlowLayer}
                <div id="ship-card-main-content" class="h-full relative z-10">
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
 * @param {boolean} isHangarMode - True if rendering the hangar view.
 * @returns {string} The HTML for the info panel.
 * @private
 */
function _renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, isHangarMode) {
    const shipClassLower = shipStatic.class.toLowerCase();
    const len = shipStatic.name.length;
    let nameClass = 'text-xl'; 

    if (len > 25) {
        nameClass = 'text-xs leading-tight'; 
    } else if (len > 22) {
        nameClass = 'text-sm leading-tight'; 
    } else if (len > 17) {
        nameClass = 'text-base leading-tight';
    } else {
        nameClass = 'text-xl'; 
    }
    
    const descLen = shipStatic.description.length;
    let descClass = 'text-sm'; 
    let descStyle = '';

    if (descLen > 240) {
        descClass = 'text-xs'; 
    } else if (descLen > 190) {
        descClass = ''; 
        descStyle = 'font-size: 0.8rem; line-height: 1.4;';
    }
    
    // Enforce one line with whitespace-nowrap and overflow-hidden
    const nameStyles = `color: var(--class-${shipClassLower}-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;

    let shadowClass = 'inset-text-shadow'; 
    if (shipStatic.class === 'Z') shadowClass = 'glow-text-z';
    else if (shipStatic.class === 'O') shadowClass = 'glow-text-o';
    else if (shipStatic.class === 'S') shadowClass = 'glow-text-s';

    if (isHangarMode) {
        return `
            <div class="info-panel-content info-panel-hangar flex-col justify-between h-full">
                <div class="info-panel-header">
                    <div class="info-panel-text">
                        <h3 class="${nameClass} font-orbitron ${shadowClass}" style="${nameStyles}">${shipStatic.name}</h3>
                        <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                    </div>
                    ${_renderParamBars(shipStatic, shipDynamic, gameState.player, false, shipId)}
                </div>
                
                <div class="flavor-text-box mt-auto" style="border-color: var(--frame-border-color);">
                    <p class="${descClass} text-gray-300" style="${descStyle}">${shipStatic.description}</p>
                </div>
            </div>
        `;
    } else {
        return `
             <div class="info-panel-content info-panel-shipyard flex-col justify-between h-full">
                <div class="info-panel-header">
                    <div class="info-panel-text">
                        <h3 class="${nameClass} font-orbitron ${shadowClass}" style="${nameStyles}">${shipStatic.name}</h3>
                        <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                        <p class="ship-price-display font-roboto-mono text-2xl credits-text-pulsing">${formatCredits(shipStatic.price, true)}</p>
                    </div>
                    ${_renderParamBars(shipStatic, shipDynamic, gameState.player, true, shipId)}
                </div>

                <div class="flavor-text-box mt-auto" style="border-color: var(--frame-border-color);">
                    <p class="${descClass} text-gray-300" style="${descStyle}">${shipStatic.description}</p>
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
                    <span class="font-bold z-10 relative">${isActive ? 'ACTIVE' : 'BOARD'}</span>
                </button>
                <button class="action-button" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${shipId}" ${!canSell ? 'disabled' : ''} style="background-color: var(--ot-hangar-red-base);">
                    <span class="font-bold z-10 relative">SELL</span>
                    <span class="action-button-price font-roboto-mono credits-text-pulsing z-10 relative">${formatCredits(salePrice, true)}</span>
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
                <span class="font-bold z-10 relative">PURCHASE</span>
            </button>
        `;
    }
}


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
    const currentHull = isShipyard ? shipStatic.maxHealth : shipDynamic?.health ?? 0;
    const currentCargo = isShipyard ? shipStatic.cargoCapacity : calculateInventoryUsed(player.inventories[shipId]);
    const currentFuel = isShipyard ? shipStatic.maxFuel : shipDynamic?.fuel ?? 0;

    const hullPct = shipStatic.maxHealth > 0 ? (currentHull / shipStatic.maxHealth) * 100 : 0;
    const cargoPct = shipStatic.cargoCapacity > 0 ? (currentCargo / shipStatic.cargoCapacity) * 100 : 0;
    const fuelPct = shipStatic.maxFuel > 0 ? (currentFuel / shipStatic.maxFuel) * 100 : 0;
    
    const hullColor = 'var(--ot-green-accent)';
    const cargoColor = '#f59e0b'; 
    const fuelColor = '#3b82f6'; 

    const renderBar = (label, current, max, percentage, color) => {
        const c = Math.floor(current);
        const m = Math.floor(max);
        
        const isMax = (c >= m);
        const displayText = isMax ? m : `${c} / ${m}`;
        const textClass = isMax ? 'max' : 'partial';

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