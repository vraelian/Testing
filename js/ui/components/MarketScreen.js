// js/ui/components/MarketScreen.js
/**
 * @fileoverview
 * This file contains the rendering logic for the Market screen.
 * It is responsible for displaying all available commodities for trade.
 */
// --- [[START]] Modified for Metal Update V1 ---
import { DB } from '../../data/database.js';
import { formatCredits, renderIndicatorPills, formatNumber } from '../../utils.js';
// --- [[END]] Modified for Metal Update V1 ---
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';

/**
 * Renders the entire Market screen, including the pager and carousel for sub-screens.
 * @param {object} gameState - The current state of the game.
 * @param {boolean} isMobile - A flag indicating if the mobile layout should be used.
 * @param {function} getItemPrice - A reference to the UIManager's getItemPrice function.
 * @param {object} marketTransactionState - The saved state of the transaction modules.
 * @returns {string} The HTML content for the Market screen.
 */
export function renderMarketScreen(gameState, isMobile, getItemPrice, marketTransactionState) {
    
    // --- [[START]] Modified for Metal Update V1 ---

    // --- Render Commodities Sub-Screen ---
    const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= gameState.player.revealedTier && !c.isNonStandard);
    const commoditiesHtml = availableCommodities.map(good => {
        return _getMarketItemHtml(good, gameState, getItemPrice, marketTransactionState);
    }).join('');

    // --- Render Materials Sub-Screen ---
    const materialsHtml = _renderMaterialsList(gameState, getItemPrice, marketTransactionState);

    // --- Assemble Full Screen ---
    return `
        <div id="market-pager-container" class="toggle-container">
            <button class="btn" data-action="market-page-materials" id="market-page-btn-materials">
                Materials
            </button>
            <button class="btn btn-primary" data-action="market-page-commodities" id="market-page-btn-commodities">
                Commodities
            </button>
        </div>

        <div id="market-carousel-container">
            <div id="market-carousel-slider">
                <div id="market-materials-screen" class="market-sub-screen scroll-panel">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        ${materialsHtml}
                    </div>
                </div>
                <div id="market-commodities-screen" class="market-sub-screen scroll-panel">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        ${commoditiesHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    // --- [[END]] Modified for Metal Update V1 ---
}

/**
 * Generates the HTML for a single commodity card on the market screen.
 * @param {object} good - The commodity data from the database.
 * @param {object} gameState - The current game state.
 * @param {function} getItemPrice - A function to calculate the item's current price.
 * @param {object} marketTransactionState - The saved state of the transaction modules.
 * @returns {string} The HTML string for the commodity card.
 * @private
 */
function _getMarketItemHtml(good, gameState, getItemPrice, marketTransactionState) {
    const { player, market, currentLocationId, tutorials, uiState } = gameState;
    const playerItem = player.inventories[player.activeShipId]?.[good.id];
    const price = getItemPrice(gameState, good.id);
    const sellPrice = getItemPrice(gameState, good.id, true);
    const galacticAvg = market.galacticAverages[good.id];
    const marketStock = market.inventory[currentLocationId]?.[good.id];
    
    const hasLicense = !good.licenseId || player.unlockedLicenseIds.includes(good.licenseId);

    const isPlasteelTutStep = tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId === 'mission_2_2';
    const isMarketLockedForMission = tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId === 'mission_2_3';
    const isLockedForTutorial = (isPlasteelTutStep && good.id !== COMMODITY_IDS.PLASTEEL) || isMarketLockedForMission;

    const nameTooltip = `data-tooltip="${good.lore}"`;
    const playerInvDisplay = playerItem && playerItem.quantity > 0 ? playerItem.quantity : '0';
    const isMinimized = uiState.marketCardMinimized[good.id];

    // Use the new centralized utility function to render indicators for the initial view.
    const indicatorHtml = renderIndicatorPills({ price, sellPrice, galacticAvg, playerItem });
    const avgCostHtml = playerItem && playerItem.quantity > 0 ? `<div class="avg-cost-display" id="avg-cost-${good.id}">Avg. Cost: ${formatCredits(playerItem.avgCost, false)}</div>` : '';

    let transactionControlsHtml;
    if (hasLicense) {
        // Correctly set initial mode based on saved state, otherwise default to 'buy'
        const initialMode = marketTransactionState[good.id]?.mode || 'buy';

        // --- [[START]] Modified for Metal Update V1 ---
        // Added data-item-type="commodity" to all controls
        transactionControlsHtml = `
             <div class="transaction-controls" data-mode="${initialMode}" data-good-id="${good.id}" data-item-type="commodity" ${isLockedForTutorial ? 'disabled' : ''}>
                <div class="toggle-switch" data-action="toggle-trade-mode" data-good-id="${good.id}" data-item-type="commodity">
                    <div class="toggle-thumb"></div>
                    <div class="toggle-labels"><span class="label-buy">Buy</span><span class="label-sell">Sell</span></div>
                </div>
                <div class="qty-stepper">
                    <button class="qty-down" data-action="decrement" data-good-id="${good.id}" data-item-type="commodity">▼</button>
                    <input type="number" value="0" id="qty-${good.id}" min="0">
                    <button class="qty-up" data-action="increment" data-good-id="${good.id}" data-item-type="commodity">▲</button>
                </div>
                <div class="action-group">
                    <button class="btn confirm-btn" data-action="confirm-trade" data-good-id="${good.id}" data-item-type="commodity">Confirm</button>
                    <button class="btn max-btn" data-action="set-max-trade" data-good-id="${good.id}" data-item-type="commodity">Max</button>
                </div>
            </div>`;
        // --- [[END]] Modified for Metal Update V1 ---
    } else {
        transactionControlsHtml = `
            <div class="transaction-controls absolute inset-0 flex items-center justify-center p-4">
                <button class="btn w-full h-full text-center" data-action="${ACTION_IDS.ACQUIRE_LICENSE}" data-license-id="${good.licenseId}">Acquire License</button>
            </div>`;
    }

    const ownedQtyText = playerItem?.quantity > 0 ? ` (${playerItem.quantity})` : '';

    return `
    <div class="item-card-container ${!hasLicense ? 'locked' : ''} ${isMinimized ? 'minimized' : ''}" id="item-card-container-${good.id}">
        <div class="rounded-lg border ${good.styleClass} transition-colors shadow-md">
            <button class="card-toggle-btn" data-action="${ACTION_IDS.TOGGLE_MARKET_CARD_VIEW}" data-good-id="${good.id}">${isMinimized ? '+' : '−'}</button>
            
            <div class="max-view-content">
                <p class="font-bold commodity-name"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span></p>
                <p class="avail-text">Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span>, Own: <span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
                <p id="price-display-${good.id}" class="font-roboto-mono font-bold price-text" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}" data-base-price="${price}">${formatCredits(price)}</p>
                
                <div id="effective-price-display-${good.id}" class="effective-price-display"></div>
                
                <div class="indicator-container" id="indicators-${good.id}">${indicatorHtml}</div>

                ${avgCostHtml}

                ${transactionControlsHtml}
            </div>

            <div class="min-view-content">
                <p class="font-bold commodity-name-min">${good.name}${ownedQtyText}</p>
                <p class="tier-text-min">Tier ${good.tier} | ${good.cat}</p>
            </div>
        </div>
    </div>`;
}

// --- [[START]] Added for Metal Update V1 ---

/**
 * Renders the list of all available material cards.
 * @param {object} gameState - The current game state.
 * @param {function} getItemPrice - A function to calculate the item's current price.
 * @param {object} marketTransactionState - The saved state of the transaction modules.
 * @returns {string} The HTML string for all material cards.
 * @private
 */
function _renderMaterialsList(gameState, getItemPrice, marketTransactionState) {
    // Currently, only Metal Scrap exists. This can be expanded to a loop if more materials are added.
    const metalScrapHtml = _renderMaterialCard(gameState, getItemPrice, marketTransactionState);
    return metalScrapHtml;
}

/**
 * Generates the HTML for the "Metal Scrap" material card.
 * @param {object} gameState - The current game state.
 * @param {function} getItemPrice - A function to calculate the item's current price.
 * @param {object} marketTransactionState - The saved state of the transaction modules.
 * @returns {string} The HTML string for the material card.
 * @private
 */
function _renderMaterialCard(gameState, getItemPrice, marketTransactionState) {
    const { player } = gameState;
    const materialId = 'metal_scrap'; // Hardcoded as per GDD
    const material = DB.COMMODITIES.find(c => c.id === materialId);
    if (!material) return ''; // Safety check

    const sellValue = material.basePriceRange[0]; // Use base price as fixed sell value
    const playerInv = player.metalScrap || 0;
    
    // GDD: This card is permanently in "sell" mode.
    const transactionControlsHtml = `
         <div class="transaction-controls" data-mode="sell" data-good-id="${materialId}" data-item-type="material">
            <div class="qty-stepper">
                <button class="qty-down" data-action="decrement" data-good-id="${materialId}" data-item-type="material">▼</button>
                <input type="number" value="0" id="qty-${materialId}" min="0">
                <button class="qty-up" data-action="increment" data-good-id="${materialId}" data-item-type="material">▲</button>
            </div>
            <div class="action-group">
                <button class="btn confirm-btn" data-action="confirm-trade" data-good-id="${materialId}" data-item-type="material">Sell</button>
                <button class="btn max-btn" data-action="set-max-trade" data-good-id="${materialId}" data-item-type="material">Max</button>
            </div>
        </div>`;

    return `
    <div class="item-card-container" id="item-card-container-${materialId}">
        <div class="rounded-lg border ${material.styleClass} transition-colors shadow-md">
            
            <div class="max-view-content">
                <p class="font-bold commodity-name">${material.name}</p>
                <p class="avail-text">Inventory: <span id="p-inv-${materialId}">${formatNumber(playerInv, 2)}</span> TONS</p>
                
                <p class="font-roboto-mono font-bold price-text" style="top: 50px;">${formatCredits(sellValue)}</p>
                <p class="font-roboto-mono" style="position: absolute; top: 80px; left: 16px; font-size: 0.9rem; color: var(--color-light-2); text-shadow: var(--market-card-avail-text-shadow);">per 1 TON</p>
                
                <div id="effective-price-display-${materialId}" class="effective-price-display" style="top: 105px;"></div>

                ${transactionControlsHtml}
            </div>
            
            <div class="min-view-content"></div>
        </div>
    </div>`;
}

/**
 * Updates the Market Pager buttons and Carousel position based on GameState.
 * This function is exported to be called by UIManager.js.
 * @param {object} gameState - The current state of the game.
 */
export function _updateMarketPager(gameState) {
    const subScreen = gameState.uiState.marketSubScreen || 'commodities';

    const btnMaterials = document.getElementById('market-page-btn-materials');
    const btnCommodities = document.getElementById('market-page-btn-commodities');
    const slider = document.getElementById('market-carousel-slider');

    if (!btnMaterials || !btnCommodities || !slider) {
        return; // Elements not rendered yet
    }

    if (subScreen === 'materials') {
        btnMaterials.classList.add('btn-primary');
        btnMaterials.classList.remove('btn-secondary');
        btnCommodities.classList.remove('btn-primary');
        btnCommodities.classList.add('btn-secondary');
        slider.style.transform = 'translateX(0%)';
    } else { // 'commodities'
        btnCommodities.classList.add('btn-primary');
        btnCommodities.classList.remove('btn-secondary');
        btnMaterials.classList.remove('btn-primary');
        btnMaterials.classList.add('btn-secondary');
        slider.style.transform = 'translateX(-50%)';
    }
}
// --- [[END]] Added for Metal Update V1 ---