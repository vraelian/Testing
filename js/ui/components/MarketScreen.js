// js/ui/components/MarketScreen.js
/**
 * @fileoverview Renders the complete Market screen, including the
 * new carousel for materials and commodities.
 */
import { DB } from '../../data/database.js';
import { COMMODITY_IDS, ACTION_IDS, MATERIAL_IDS } from '../../data/constants.js';
import { formatCredits, renderIndicatorPills } from '../../utils.js';

/**
 * Renders the Market screen HTML.
 * @param {object} gameState The current game state.
 * @param {boolean} isMobile Whether the view is mobile.
 * @param {function} getItemPrice A function (bound to UIManager) to get the correct price.
 * @param {object} marketTransactionState The saved state of quantities/modes.
 * @returns {string} The HTML string for the market screen.
 */
export function renderMarketScreen(gameState, isMobile, getItemPrice, marketTransactionState) {
    const { player, market, currentLocationId } = gameState;
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location.navTheme;
    const inventory = player.inventories[player.activeShipId];

    // --- Phase 3b: Pager & Carousel Structure ---
    const pagerHtml = `
        <div class="market-pager-container" style="--theme-color-primary: ${theme.borderColor};">
            <button
                id="market-page-materials"
                class="market-pager-btn"
                data-action="market-page-materials"
            >Materials</button>
            <button
                id="market-page-commodities"
                class="market-pager-btn"
                data-action="market-page-commodities"
            >Commodities</button>
        </div>
    `;

    const commoditiesHtml = _renderCommoditiesList(gameState, isMobile, getItemPrice, marketTransactionState);
    const materialsHtml = _renderMaterialsList(gameState, theme); // Phase 3c call

    const carouselHtml = `
        <div id="market-carousel-wrapper" class="market-carousel-wrapper">
            <div id="market-carousel" class="market-carousel-container">
                <div id="market-materials-screen" class="market-sub-screen">
                    ${materialsHtml}
                </div>
                <div id="market-commodities-screen" class="market-sub-screen">
                    ${commoditiesHtml}
                </div>
            </div>
        </div>
    `;

    return pagerHtml + carouselHtml;
}

/**
 * Renders the list of commodity cards.
 * @private
 */
function _renderCommoditiesList(gameState, isMobile, getItemPrice, marketTransactionState) {
    const { player, market, currentLocationId } = gameState;
    const inventory = player.inventories[player.activeShipId];
    const locationMarket = market.inventory[currentLocationId];
    const locationPrices = market.prices[currentLocationId];
    const galacticAverages = market.galacticAverages;
    const uiState = gameState.uiState;

    const commodityIds = Object.values(COMMODITY_IDS);
    const visibleCommodities = commodityIds.filter(id => {
        const item = DB.COMMODITIES.find(c => c.id === id);
        return !item.isHidden;
    });

    const categories = {
        'Raw Materials': [],
        'Refined Goods': [],
        'Components': [],
        'Consumables': [],
        'Technology': [],
        'Exotics': []
    };

    visibleCommodities.forEach(goodId => {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const playerItem = inventory[goodId];
        const marketItem = locationMarket[goodId];

        if (playerItem || (marketItem && marketItem.quantity > 0)) {
            const price = getItemPrice(gameState, goodId);
            const cardHtml = _renderCommodityCard(
                good,
                playerItem,
                marketItem,
                price,
                galacticAverages[goodId],
                isMobile,
                uiState.marketCardMinimized[goodId],
                marketTransactionState[goodId],
                getItemPrice,
                gameState
            );
            if (categories[good.category]) {
                categories[good.category].push(cardHtml);
            }
        }
    });

    let listHtml = '';
    for (const [category, cards] of Object.entries(categories)) {
        if (cards.length > 0) {
            listHtml += `<div class="market-category-container">
                            <h3 class="market-category-title">${category}</h3>
                            ${cards.join('')}
                         </div>`;
        }
    }

    return `<div class="scroll-panel market-scroll-panel">${listHtml}</div>`;
}

/**
 * Renders a single commodity card.
 * @private
 */
function _renderCommodityCard(good, playerItem, marketItem, price, galacticAvg, isMobile, isMinimized, savedState, getItemPrice, gameState) {
    const { id, name, description, styleClass } = good;
    const playerQty = playerItem?.quantity || 0;
    const marketQty = marketItem?.quantity || 0;
    const avgCost = playerItem?.avgCost || 0;

    const defaultMode = playerQty > 0 ? 'sell' : 'buy';
    const initialMode = savedState?.mode || defaultMode;
    const initialQty = savedState?.quantity || '0';

    const indicators = renderIndicatorPills({
        price: price,
        sellPrice: getItemPrice(gameState, id, true),
        galacticAvg: galacticAvg,
        playerItem: playerItem
    });

    const avgCostDisplay = avgCost > 0 ? `Avg. Cost: ${formatCredits(avgCost, false)}` : 'No purchase history';
    const isBuyMode = initialMode === 'buy';

    const transactionControls = `
        <div class="transaction-controls" data-good-id="${id}" data-item-type="commodity" data-mode="${initialMode}">
            <div class="trade-mode-toggle" data-action="toggle-trade-mode">
                <button class="btn-buy ${isBuyMode ? 'active' : ''}">BUY</button>
                <button class="btn-sell ${!isBuyMode ? 'active' : ''}">SELL</button>
            </div>
            <div class="quantity-controls">
                <button class="btn-step" data-action="${ACTION_IDS.DECREMENT}">-</button>
                <input type="number" class="quantity-input" value="${initialQty}" min="0" pattern="[0-9]*" inputmode="numeric">
                <button class="btn-step" data-action="${ACTION_IDS.INCREMENT}">+</button>
            </div>
            <button class="btn-max" data-action="set-max-trade">MAX</button>
            <button class="btn-confirm" data-action="confirm-trade">
                <span class="confirm-buy-text">BUY</span>
                <span class="confirm-sell-text">SELL</span>
            </button>
        </div>
    `;

    const dynamicContent = `
        <div class="item-card-header commodity-style ${styleClass}">
            <div class="item-card-name-row">
                <h4 class="item-card-name">${name}</h4>
                <div class="price-info">
                    <span id="avg-cost-${id}" class="avg-cost-display ${!isBuyMode ? 'visible' : ''}">${avgCostDisplay}</span>
                    <span id="price-display-${id}" class="font-roboto-mono font-bold price-text" data-base-price="${price}">${formatCredits(price)}</span>
                    <span id="effective-price-display-${id}" class="font-roboto-mono effective-price-text"></span>
                </div>
            </div>
            <div class="item-card-subtitle-row">
                <div class="item-card-holdings">
                    <span>HOLD: <span class="hl-cyan">${playerQty}</span></span>
                    <span>MARKET: <span class="hl-cyan">${marketQty}</span></span>
                </div>
                <div id="indicators-${id}" class="indicator-pills">
                    ${indicators}
                </div>
            </div>
        </div>
        <div class="item-card-body">
            ${isMobile ? '' : `<p class="item-card-description">${description}</p>`}
            ${transactionControls}
        </div>
    `;

    const minimizeIcon = isMinimized ? '&#9660;' : '&#9650;'; // Down arrow / Up arrow

    return `
        <div class="item-card-container ${isMinimized ? 'minimized' : ''}">
            <div class="item-card-content">
                ${dynamicContent}
            </div>
            <button class="minimize-toggle" data-action="${ACTION_IDS.TOGGLE_MARKET_CARD_VIEW}" data-good-id="${id}">${minimizeIcon}</button>
        </div>
    `;
}

/**
 * Renders the list of material cards. (Currently only Metal Scrap)
 * @param {object} gameState The current game state.
 * @param {object} theme The current location's theme.
 * @returns {string} The HTML string for the materials list.
 * @private
 */
function _renderMaterialsList(gameState, theme) {
    const scrapHtml = _renderMaterialCard(gameState, theme);
    return `<div class="scroll-panel market-scroll-panel">
                <div class="market-category-container">
                    <h3 class="market-category-title">Recovered Materials</h3>
                    ${scrapHtml}
                </div>
            </div>`;
}

/**
 * Renders the single card for Metal Scrap.
 * @param {object} gameState The current game state.
 * @param {object} theme The current location's theme.
 * @returns {string} The HTML string for the Metal Scrap card.
 * @private
 */
function _renderMaterialCard(gameState, theme) {
    const { player } = gameState;
    const material = DB.MATERIALS[MATERIAL_IDS.METAL_SCRAP];
    const playerQty = player.metalScrap;
    const sellPrice = material.basePrice;

    // Phase 4b: Add data-item-type="material" and data-good-id
    // Note: mode is hardcoded to "sell"
    const transactionControls = `
        <div class="transaction-controls" data-good-id="${MATERIAL_IDS.METAL_SCRAP}" data-item-type="material" data-mode="sell">
            <div class="trade-mode-toggle" data-action="toggle-trade-mode">
                <button class="btn-sell active" disabled>SELL</button>
            </div>
            <div class="quantity-controls">
                <button class="btn-step" data-action="${ACTION_IDS.DECREMENT}">-</button>
                <input type="number" class="quantity-input" value="0" min="0" pattern="[0-9]*" inputmode="numeric">
                <button class="btn-step" data-action="${ACTION_IDS.INCREMENT}">+</button>
            </div>
            <button class="btn-max" data-action="set-max-trade">MAX</button>
            <button class="btn-confirm" data-action="confirm-trade">
                <span class="confirm-sell-text">SELL</span>
            </button>
        </div>
    `;

    return `
        <div class="item-card-container material-card">
            <div class="item-card-content">
                <div classs="item-card-header" style="border-bottom: 1px solid ${theme.borderColor};">
                    <div class="item-card-name-row">
                        <h4 class="item-card-name">${material.name}</h4>
                        <div class="price-info">
                            <span class="font-roboto-mono font-bold price-text" data-base-price="${sellPrice}">${formatCredits(sellPrice)} / unit</span>
                        </div>
                    </div>
                    <div class="item-card-subtitle-row">
                        <div class="item-card-holdings">
                            <span>HOLD: <span class="hl-cyan">${playerQty.toLocaleString()}</span></span>
                        </div>
                    </div>
                </div>
                <div class="item-card-body">
                    <p class="item-card-description">${material.description}</p>
                    ${transactionControls}
                </div>
            </div>
        </div>
    `;
}