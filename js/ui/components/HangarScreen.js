// js/ui/components/HangarScreen.js

import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';
import { AssetService } from '../../services/AssetService.js';
import { GameAttributes } from '../../services/GameAttributes.js';

// --- VIRTUAL WORKBENCH: ATTRIBUTE UI CONFIG ---
// Colors chosen for high readability on solid backgrounds (dark text on bright pastel)
const ATTRIBUTE_UI_CONFIG = {
    'ATTR_TRAVELLER': { label: 'SELF-REPAIR', color: '#34d399' }, // Green
    'ATTR_TRADER': { label: 'TRADER', color: '#facc15' }, // Gold
    'ATTR_HOT_DELIVERY': { label: 'STASIS', color: '#facc15' }, // Gold
    'ATTR_RESILIENT': { label: 'RESILIENT', color: '#34d399' }, // Green
    'ATTR_LUCKY': { label: 'LUCKY', color: '#c084fc' }, // Purple
    'ATTR_CORP_PARTNER': { label: 'PARTNER', color: '#60a5fa' }, // Blue
    'ATTR_CRYO_STORAGE': { label: 'CRYO', color: '#38bdf8' }, // Cyan
    'ATTR_HEAVY': { label: 'HEAVY', color: '#9ca3af' }, // Gray
    'ATTR_LOYALTY_SATURN': { label: 'SATURN-BORN', color: '#60a5fa' }, // Blue
    'ATTR_RENOWN': { label: 'RENOWN', color: '#facc15' }, // Gold
    'ATTR_VIP': { label: 'VIP', color: '#facc15' }, // Gold
    'ATTR_ENTROPIC': { label: 'ENTROPIC', color: '#f87171' }, // Red
    'ATTR_FREQUENT_FLYER': { label: 'FQ-FLYER', color: '#34d399' }, // Green
    'ATTR_SPACE_FOLDING': { label: 'FOLD-DRIVE', color: '#c084fc' }, // Purple
    'ATTR_XENO_HULL': { label: 'XENO', color: '#34d399' }, // Green
    'ATTR_FUEL_SCOOP': { label: 'SCOOP', color: '#38bdf8' }, // Cyan
    'ATTR_SOLAR_SAIL': { label: 'SOLAR', color: '#fbbf24' }, // Amber
    'ATTR_EFFICIENT': { label: 'EFFICIENT', color: '#a3e635' }, // Lime
    'ATTR_FAST': { label: 'FAST', color: '#f87171' }, // Red
    'ATTR_BESPOKE': { label: 'BESPOKE', color: '#e879f9' }, // Pink
    'ATTR_ADVANCED_COMMS': { label: 'COMMS', color: '#818cf8' }, // Indigo
    'ATTR_SLEEPER': { label: 'SLEEPER', color: '#94a3b8' }, // Slate
};
// --- END VIRTUAL WORKBENCH ---

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
                        ${shipList.map((shipId, index) => _renderShipCarouselPage(gameState, shipId, index, activeCarouselIndex, isHangarMode)).join('') || _renderEmptyCarouselPage(isHangarMode)}
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
 * @param {number} itemIndex The index of this ship in the list.
 * @param {number} activeIndex The currently viewed index.
 * @param {boolean} isHangarMode True if the view is for the player's hangar.
 * @returns {string} The HTML for a single carousel page.
 * @private
 */
function _renderShipCarouselPage(gameState, shipId, itemIndex, activeIndex, isHangarMode) {
    const shipStatic = DB.SHIPS[shipId];
    const shipDynamic = isHangarMode ? gameState.player.shipStates[shipId] : null;
    const { player } = gameState; 

    // Determine Status Badge
    let statusBadgeHtml = '';
    const isActive = player.activeShipId === shipId; 
    
    const activeGlowLayer = (isActive && isHangarMode) ? '<div class="active-ship-glow-layer"></div>' : '';

    if (isHangarMode) {
        statusBadgeHtml = `<div class="status-badge" style="border-color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-border-light)'}; color: ${isActive ? 'var(--theme-color-primary)' : 'var(--ot-text-secondary)'};">${isActive ? 'ACTIVE' : 'STORED'}</div>`;
    }

    // --- VIRTUAL WORKBENCH: ATTRIBUTE PILLS (Redesigned) ---
    const activeAttributes = GameAttributes.getShipAttributes(shipId);
    let attributesHtml = '';
    
    if (activeAttributes && activeAttributes.length > 0) {
        // We only render the first 2 attributes to prevent overflow
        const pills = activeAttributes.slice(0, 2).map(attrId => {
            const config = ATTRIBUTE_UI_CONFIG[attrId] || { label: 'SYS', color: '#fff' };
            // Style: Solid background, Dark text, No icons, Status-badge shape
            return `
                <div class="attribute-pill cursor-pointer" 
                     data-action="show-attribute-tooltip" 
                     data-attribute-id="${attrId}"
                     style="
                        background-color: ${config.color}; 
                        color: #1a202c; 
                        border: 1px solid ${config.color};
                        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-family: 'Orbitron', sans-serif;
                        font-size: 0.7rem;
                        font-weight: 700;
                        letter-spacing: 0.05em;
                        pointer-events: auto; /* Ensure clickable over image */
                     ">
                    ${config.label}
                </div>
            `;
        }).join('');

        attributesHtml = `
            <div class="ship-attributes-overlay absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2 z-20 w-full justify-center pointer-events-none">
                ${pills}
            </div>
        `;
    }
    // --- END VIRTUAL WORKBENCH ---

    const distance = Math.abs(itemIndex - activeIndex);
    const inBuffer = distance <= 5;

    const realPath = AssetService.getShipImage(shipId, player.visualSeed);
    const fallbackPath = AssetService.getFallbackImage(shipId);
    
    const src = inBuffer ? realPath : AssetService.PLACEHOLDER;
    const dataSrc = realPath; 
    
    const isVariantA = realPath.endsWith('_A.jpeg');

    const imgStyle = isActive ? 'opacity: 1;' : 'opacity: 0; transition: opacity 0.3s ease-in;';
    const placeholderStyle = isActive ? 'display: none;' : '';

    const shipImageHtml = `
        <div class="relative w-full h-full">
            <img src="${src}" 
                 data-src="${dataSrc}"
                 class="w-full h-full object-cover rounded-lg relative z-10" 
                 alt="${shipStatic.name}"
                 loading="${inBuffer ? 'eager' : 'lazy'}" 
                 data-fallback-src="${fallbackPath}"
                 data-is-a="${isVariantA}"
                 style="${imgStyle}"
                 onload="this.style.opacity='1'; this.nextElementSibling.style.display='none';"
                 onerror="if (this.getAttribute('data-tried-fallback') === 'true' || this.getAttribute('data-is-a') === 'true') { this.style.display='none'; this.nextElementSibling.style.display='flex'; } else { this.setAttribute('data-tried-fallback', 'true'); this.src=this.getAttribute('data-fallback-src'); }">
            <span class="text-2xl font-orbitron absolute inset-0 flex items-center justify-center z-0 text-center text-gray-600" style="${placeholderStyle}">[ SHIP HOLOGRAM ]</span>
            ${attributesHtml}
        </div>
    `;

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
        <div class="carousel-page p-2 md:p-4 w-full" data-ship-id="${shipId}" data-index="${itemIndex}">
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
        const priceStr = formatCredits(shipStatic.price, true);
        const priceClass = priceStr.length > 9 ? 'text-shrink' : '';
        
        return `
             <div class="info-panel-content info-panel-shipyard flex-col justify-between h-full">
                <div class="info-panel-header">
                    <div class="info-panel-text">
                        <h3 class="${nameClass} font-orbitron ${shadowClass}" style="${nameStyles}">${shipStatic.name}</h3>
                        <p class="text-md text-gray-400 inset-text-shadow">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</p>
                        <p class="ship-price-display font-roboto-mono text-2xl credits-text-pulsing ${priceClass}">${priceStr}</p>
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
 * @private
 */
function _renderActionButtons(shipId, shipStatic, player, isHangarMode, tutorials) {
    if (isHangarMode) {
        const isActive = player.activeShipId === shipId;
        const canSell = player.ownedShipIds.length > 1 && !isActive;
        const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);
        
        const salePriceStr = formatCredits(salePrice, true);
        const salePriceClass = salePriceStr.length > 8 ? 'text-shrink-button' : '';

        return `
            <div class="grid grid-cols-2 gap-2">
                <button class="action-button" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${shipId}" ${isActive ? 'disabled' : ''} style="background-color: ${isActive ? '#374151' : 'var(--ot-cyan-base)'}; color: ${isActive ? 'var(--ot-text-secondary)' : 'var(--ot-bg-dark)'};">
                    <span class="font-bold z-10 relative">${isActive ? 'ACTIVE' : 'BOARD'}</span>
                </button>
                <button class="action-button" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${shipId}" ${!canSell ? 'disabled' : ''} style="background-color: var(--ot-hangar-red-base);">
                    <span class="font-bold z-10 relative">SELL</span>
                    <span class="action-button-price font-roboto-mono credits-text-pulsing z-10 relative ${salePriceClass}">${salePriceStr}</span>
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