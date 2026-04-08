// js/ui/components/HangarScreen.js

import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SHIP_IDS, GAME_RULES } from '../../data/constants.js';
import { AssetService } from '../../services/AssetService.js';
import { GameAttributes } from '../../services/GameAttributes.js';

// --- VIRTUAL WORKBENCH: UI CONFIG ---
// Fallback configuration for upgrade pills if definition is missing color
const DEFAULT_UPGRADE_STYLE = { label: 'MOD', color: '#94a3b8' };
// Safe character limit for the pill container before clipping likely occurs
const PILL_CONTAINER_SAFE_CHARS = 38;

// Universal list of generic words to strip when abbreviation is active.
const ABBREVIATION_STOP_WORDS = [
    'Auxiliary', 
    'Standard', 
    'Badge', 
    'Pass', 
    'Mod', 
    'Hacker', 
    'Machines', 
    'Hull' 
];

/**
 * Helper to programmatically darken/lighten a hex color.
 * Uses string parsing to prevent channel swapping issues.
 * @param {string} color - Hex code (e.g., "#3b82f6")
 * @param {number} amount - Percentage to darken (negative) or lighten (positive) (e.g., -40)
 * @returns {string} New Hex code
 */
function _adjustColor(color, amount) {
    if (!color || !color.startsWith('#')) return color;
    
    // Remove hash
    const hex = color.replace('#', '');
    
    // Parse individual channels
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));

    // Reconstruct with padding
    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');

    return `#${rr}${gg}${bb}`;
}

/**
 * Helper to abbreviate upgrade labels to prevent clipping.
 * Universal Logic: Filters out generic stop words defined in ABBREVIATION_STOP_WORDS.
 * @param {string} label - The full name of the upgrade
 * @returns {string} The abbreviated label
 */
function _getAbbreviatedLabel(label) {
    if (!label) return '';
    
    // Split into words, filter out stop words, and rejoin
    const abbreviated = label.split(/\s+/)
        .filter(word => !ABBREVIATION_STOP_WORDS.includes(word))
        .join(' ');

    // Fallback: If we stripped everything (unlikely), return original to avoid empty pill
    return abbreviated.length > 0 ? abbreviated : label;
}

/**
 * Generates the CSS variable injection and class names for an upgrade pill.
 * Refactored to separate Data (Variables) from Presentation (CSS Classes).
 * @param {object} definition - The attribute definition object.
 * @param {number} tier - The calculated tier (1-5).
 * @param {string} color - The base hex color.
 * @returns {object} { className, styleVars }
 * @private
 */
function _getUpgradePillStyle(definition, tier, color) {
    // 1. Calculate palette derivatives (Data Layer)
    const dark = _adjustColor(color, -60);
    const mid = _adjustColor(color, -20);
    const light = _adjustColor(color, 40);
    const bright = _adjustColor(color, 80);

    // 2. Determine CSS Class (Visual Layer Hook)
    let cssClass = `pill-tier-${tier}`;
    let extraStyle = '';

    if (definition.isAlien) {
        cssClass = 'pill-alien';
        // Add thin black outline for alien pills (e.g. Osseous Regrowth)
        extraStyle = 'text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;';
    }

    // 3. Generate Variable Injection (The "Style String")
    // We only inject variables. The CSS handles the painting.
    return {
        className: cssClass,
        styleVars: `
            --pill-color: ${color};
            --pill-dark: ${dark};
            --pill-mid: ${mid};
            --pill-light: ${light};
            --pill-bright: ${bright};
            ${extraStyle}
        `
    };
}


/**
 * Renders the entire Hangar screen UI.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/SimulationService.js').SimulationService} simulationService - The simulation service.
 * @returns {string} The HTML content for the Hangar screen.
 */
export function renderHangarScreen(gameState, simulationService) {
    const { uiState, player } = gameState;

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
        <div class="flex flex-col h-full w-full relative">
            <div id="ship-terminal-container" class="flex flex-col flex-grow min-h-0 ${modeClass}">
                
                <div class="relative mx-auto mt-0 mb-0 w-max flex justify-center items-center flex-shrink-0 z-10">
                    <div class="toggle-container">
                        <div class="toggle-switch p-1 rounded-md flex w-[180px] h-10">
                            <div class="toggle-label hangar flex-1 text-center py-1 cursor-pointer" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}" data-mode="hangar">HANGAR</div>
                            <div class="toggle-label shipyard flex-1 text-center py-1 cursor-pointer" data-action="${ACTION_IDS.TOGGLE_HANGAR_MODE}" data-mode="shipyard">SHIPYARD</div>
                        </div>
                    </div>
                    <div class="archive-link ${showArchive ? '' : 'hidden'}" data-action="show_ship_lore">ACCESS<br>ARCHIVE</div>
                </div>

                <div class="carousel-container flex-grow overflow-hidden relative z-0">
                    <div id="hangar-carousel" class="flex h-full w-full" style="transform: translateX(-${displayIndex * 100}%)">
                        ${shipList.map((shipId, index) => _renderShipCarouselPage(gameState, shipId, index, activeCarouselIndex, isHangarMode, simulationService)).join('') || _renderEmptyCarouselPage(isHangarMode)}
                    </div>
                </div>
            </div>
            
            <div id="hangar-pagination-wrapper" class="w-full pt-1 z-10">
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
        <div class="carousel-page">
            <div id="ship-terminal" class="relative w-full rounded-lg border-2" style="border-color: var(--frame-border-color);">
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
 * @param {object} simulationService The simulation service for calculating effective stats.
 * @returns {string} The HTML for a single carousel page.
 * @private
 */
function _renderShipCarouselPage(gameState, shipId, itemIndex, activeIndex, isHangarMode, simulationService) {
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

    let attributesHtml = '';
    
    if (isHangarMode && shipDynamic) {
        const allAttributes = [
            ...(shipStatic.mechanicIds || []),
            ...(shipDynamic.upgrades || [])
        ];

        if (allAttributes.length > 0) {
            const sortedUpgrades = [...allAttributes].sort((a, b) => {
                const getTier = (id) => {
                    const def = GameAttributes.getDefinition(id);
                    if (def && def.tier) return def.tier;
                    if (def && def.isAlien) return 5;
                    if (id.endsWith('_V') || id.endsWith('_5')) return 5;
                    if (id.endsWith('_IV') || id.endsWith('_4')) return 4;
                    if (id.endsWith('_III') || id.endsWith('_3')) return 3;
                    if (id.endsWith('_II') || id.endsWith('_2')) return 2;
                    return 1; 
                };
                
                const tierA = getTier(a);
                const tierB = getTier(b);
                
                if (tierA !== tierB) {
                    return tierA - tierB; 
                }
                return a.localeCompare(b);
            });

            const upgradeDefinitions = sortedUpgrades.map(uid => GameAttributes.getDefinition(uid));
            
            const totalCharLength = upgradeDefinitions.reduce((sum, def) => sum + (def ? def.name.length : 0), 0);
            const useAbbreviation = totalCharLength > PILL_CONTAINER_SAFE_CHARS;

            const pills = sortedUpgrades.map((upgradeId, idx) => {
                const definition = upgradeDefinitions[idx];
                let label = definition ? definition.name : DEFAULT_UPGRADE_STYLE.label;
                const tooltipText = definition ? definition.description : '';
                
                if (useAbbreviation) {
                    label = _getAbbreviatedLabel(label);
                }

                const baseColor = definition ? (definition.pillColor || definition.color || DEFAULT_UPGRADE_STYLE.color) : DEFAULT_UPGRADE_STYLE.color; 
                
                let tier = definition?.tier || 1;
                if (!definition?.tier) {
                    if (upgradeId.endsWith('_V') || upgradeId.endsWith('_5')) tier = 5;
                    else if (upgradeId.endsWith('_IV') || upgradeId.endsWith('_4')) tier = 4;
                    else if (upgradeId.endsWith('_III') || upgradeId.endsWith('_3')) tier = 3;
                    else if (upgradeId.endsWith('_II') || upgradeId.endsWith('_2')) tier = 2;
                }
                
                if (definition && definition.isAlien) tier = 5;

                const styleData = _getUpgradePillStyle(definition || {}, tier, baseColor);

                return `
                    <button class="attribute-pill ${styleData.className}" 
                        data-action="show-attribute-tooltip" 
                        data-attribute-id="${upgradeId}"
                        data-tooltip="${tooltipText}"
                        style="${styleData.styleVars}">
                        ${label}
                    </button>
                `;
            }).join('');

            attributesHtml = `
                <div id="upgrade-pill-container-${shipId}" class="ship-attributes-overlay absolute bottom-3 left-1/2 transform -translate-x-1/2 flex flex-nowrap gap-1 z-20 w-full justify-center pointer-events-none px-1">
                    ${pills}
                </div>
            `;
        }
    }

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

    const infoPanel = _renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, isHangarMode, simulationService);

    const shipyardLayout = `
        <div class="col-span-3 flex flex-col justify-start gap-1 h-full">
            <div class="ship-display-area flex items-center justify-center relative" style="margin-top: 7px;">
                <div class="ship-image-placeholder w-[95%] mx-auto rounded-lg flex items-center justify-center relative overflow-hidden mb-0">
                    ${shipImageHtml}
                </div>
                ${statusBadgeHtml}
            </div>
        </div>
        <div class="col-span-2 flex flex-col justify-start gap-1 h-full">
            ${infoPanel}
            <div class="action-buttons-container mt-auto w-full pt-2" style="margin-bottom: 15px;">
                ${_renderActionButtons(shipId, shipStatic, player, isHangarMode)}
            </div>
        </div>
    `;

    const hangarLayout = `
        <div class="col-span-2 flex flex-col justify-start gap-1 h-full">
            ${infoPanel}
        </div>

        <div class="col-span-3 flex flex-col justify-start gap-1 h-full">
            <div class="ship-display-area flex items-center justify-center relative">
                <div class="ship-image-placeholder w-[95%] mx-auto rounded-lg flex items-center justify-center relative overflow-hidden mb-0">
                    ${shipImageHtml}
                </div>
                ${statusBadgeHtml}
            </div>
            
            <div class="action-buttons-container mt-auto w-full pt-2" style="margin-bottom: 15px;">
                ${_renderActionButtons(shipId, shipStatic, player, isHangarMode)}
            </div>
        </div>
    `;

    return `
        <div class="carousel-page" data-ship-id="${shipId}" data-index="${itemIndex}" data-ship-class="${shipStatic.class}">
            <div id="ship-terminal" class="relative w-full rounded-lg border-2" style="border-color: var(--frame-border-color);">
                ${activeGlowLayer}
                <div id="ship-card-main-content" class="h-full relative z-10 flex flex-col">
                    <div class="ship-card-content-wrapper h-full p-2">
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
function _renderInfoPanel(gameState, shipId, shipStatic, shipDynamic, isHangarMode, simulationService) {
    const shipClassLower = shipStatic.class.toLowerCase();
    
    let shadowClass = 'inset-text-shadow'; 
    if (shipStatic.class === 'Z') shadowClass = 'glow-text-z';
    else if (shipStatic.class === 'O') shadowClass = 'glow-text-o';
    else if (shipStatic.class === 'S') shadowClass = 'glow-text-s';

    const paramBars = _renderParamBars(shipStatic, shipDynamic, gameState.player, !isHangarMode, shipId, simulationService);

    const tooltipContent = shipStatic.description ? shipStatic.description.replace(/"/g, '&quot;') : '';

    if (isHangarMode) {
        return `
            <div class="info-panel-content info-panel-hangar flex-col justify-start w-full">
                <div class="flex w-full items-center justify-between" style="margin-top: 25px;">
                    <div class="flex flex-col justify-center items-start flex-grow pr-2">
                        <h3 class="font-orbitron font-bold ${shadowClass} mb-2" style="color: var(--class-${shipClassLower}-color); font-size: calc(1.32rem + 2pt); line-height: 1.1;">${shipStatic.name}</h3>
                        <div class="flex items-center">
                            <div class="text-[0.9rem] rounded-md px-2 py-0.5 border font-semibold text-gray-300 inline-block shadow-sm" style="background-color: var(--badge-bg); border-color: rgba(255,255,255,0.2);">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</div>
                            <button class="ship-info-icon hangar-lore-trigger cursor-help flex items-center justify-center px-2" data-action="show-lore-tooltip" data-position="center" data-tooltip="${tooltipContent}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="var(--ot-cyan-base)" class="w-8 h-8 opacity-80 hover:opacity-100 transition-opacity pointer-events-none">
                                    <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-4M12 8h.01"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    ${paramBars}
                </div>
            </div>
        `;
    } else {
        const priceStr = formatCredits(shipStatic.price, true);
        const priceClass = priceStr.length > 9 ? 'text-shrink' : '';
        
        return `
             <div class="info-panel-content info-panel-shipyard flex-col justify-start w-full">
                <div class="flex w-full items-center justify-between -mt-2">
                    <div class="flex flex-col justify-center items-start flex-grow pr-2">
                        <h3 class="font-orbitron font-bold ${shadowClass} mb-2" style="color: var(--class-${shipClassLower}-color); font-size: calc(1.32rem + 2pt); line-height: 1.1;">${shipStatic.name}</h3>
                        <div class="flex items-center mb-1">
                            <div class="text-[0.9rem] rounded-md px-2 py-0.5 border font-semibold text-gray-300 inline-block shadow-sm" style="background-color: var(--badge-bg); border-color: rgba(255,255,255,0.2);">Class ${shipStatic.class} ${shipStatic.role || 'Freighter'}</div>
                            <button class="ship-info-icon hangar-lore-trigger cursor-help flex items-center justify-center px-2" data-action="show-lore-tooltip" data-position="center" data-tooltip="${tooltipContent}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="var(--ot-cyan-base)" class="w-8 h-8 opacity-80 hover:opacity-100 transition-opacity pointer-events-none">
                                    <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-4M12 8h.01"/>
                                </svg>
                            </button>
                        </div>
                        <p class="ship-price-display font-roboto-mono credits-text-pulsing ${priceClass}" style="font-size: calc(2.2rem + 2pt); margin-top: 0.1rem;">${priceStr}</p>
                    </div>

                    ${paramBars}
                </div>
            </div>
        `;
    }
}


/**
 * Renders the appropriate action buttons (Hangar or Shipyard).
 * @private
 */
function _renderActionButtons(shipId, shipStatic, player, isHangarMode) {
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
        const isDisabled = !canAfford;
        
        return `
            <button class="action-button w-full justify-center" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${shipId}" ${isDisabled ? 'disabled' : ''} style="background-color: var(--ot-green-accent);">
                <span class="font-bold z-10 relative">PURCHASE</span>
            </button>
        `;
    }
}


/**
 * Renders the HULL, FUEL, and CARGO parameter bars.
 * @private
 */
function _renderParamBars(shipStatic, shipDynamic, player, isShipyard = false, shipId, simulationService) {
    let effectiveStats = shipStatic;
    
    if (!isShipyard && simulationService) {
        effectiveStats = simulationService.getEffectiveShipStats(shipId) || shipStatic;
    }

    const currentHull = isShipyard ? shipStatic.maxHealth : shipDynamic?.health ?? 0;
    const currentCargo = isShipyard ? shipStatic.cargoCapacity : calculateInventoryUsed(player.inventories[shipId]);
    const currentFuel = isShipyard ? shipStatic.maxFuel : shipDynamic?.fuel ?? 0;

    const hullPct = effectiveStats.maxHealth > 0 ? (currentHull / effectiveStats.maxHealth) * 100 : 0;
    const cargoPct = effectiveStats.cargoCapacity > 0 ? (currentCargo / effectiveStats.cargoCapacity) * 100 : 0;
    const fuelPct = effectiveStats.maxFuel > 0 ? (currentFuel / effectiveStats.maxFuel) * 100 : 0;
    
    const hullColor = 'var(--ot-green-accent)';
    const cargoColor = '#f59e0b'; 
    const fuelColor = '#3b82f6'; 

    const renderBar = (label, current, max, percentage, color) => {
        const c = Math.floor(current);
        const m = Math.floor(max);
        const isMax = (c >= m);
        const displayText = isMax ? m : `${c} / ${m}`;
        
        const trackWidth = 100;
        const fillWidth = (percentage / 100) * trackWidth;

        return `
            <div class="param-bar-item">
                <svg viewBox="0 0 100 20" class="param-bar-svg" preserveAspectRatio="xMidYMid meet">
                    <rect x="28" y="-4" width="44" height="11" rx="3" fill="var(--badge-bg)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5" />
                    
                    <text x="50" y="2" text-anchor="middle" dominant-baseline="middle" class="svg-bar-label" fill="var(--ot-text-secondary)">${label}</text>
                    
                    <rect x="0" y="8.4" width="${trackWidth}" height="14" rx="3" class="svg-bar-track" fill="rgba(0,0,0,0.4)" stroke="#000000" stroke-width="0.5" />
                    
                    <rect x="0" y="8.4" width="${fillWidth}" height="14" rx="3" class="svg-bar-fill" fill="${color}" style="transition: width 0.4s ease-out;" stroke="#000000" stroke-width="0.5" />
                    
                    <text x="50" y="16.4" text-anchor="middle" dominant-baseline="middle" class="svg-bar-text" fill="#ffffff">${displayText}</text>
                </svg>
            </div>
        `;
    };

    return `
        <div class="ship-param-bars ${isShipyard ? 'shipyard-bars' : ''}">
            ${renderBar('HULL', currentHull, effectiveStats.maxHealth, hullPct, hullColor)}
            ${renderBar('FUEL', currentFuel, effectiveStats.maxFuel, fuelPct, fuelColor)}
            ${renderBar('CARGO', currentCargo, effectiveStats.cargoCapacity, cargoPct, cargoColor)}
        </div>
    `;
}