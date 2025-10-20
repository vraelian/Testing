// js/ui/components/MarketScreen.js
/**
 * @fileoverview
 * This file contains the rendering logic for the Market screen.
 * It is responsible for displaying all available commodities for trade.
 */
import { DB } from '../../data/database.js';
import { formatCredits, renderIndicatorPills } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';

/**
 * Renders the entire Market screen, adapting for mobile or desktop layouts.
 * @param {object} gameState - The current state of the game.
 * @param {boolean} isMobile - A flag indicating if the mobile layout should be used.
 * @param {function} getItemPrice - A reference to the UIManager's getItemPrice function.
 * @param {object} marketTransactionState - The saved state of the transaction modules.
 * @returns {string} The HTML content for the Market screen.
 */
export function renderMarketScreen(gameState, isMobile, getItemPrice, marketTransactionState) {
    const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= gameState.player.revealedTier);
    const marketHtml = availableCommodities.map(good => {
        return _getMarketItemHtml(good, gameState, getItemPrice, marketTransactionState);
    }).join('');

    return `<div class="scroll-panel">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${marketHtml}</div>
            </div>`;
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
    // REMOVED tutorials
    const { player, market, currentLocationId, uiState } = gameState;
    const playerItem = player.inventories[player.activeShipId]?.[good.id];
    const price = getItemPrice(gameState, good.id);
    const sellPrice = getItemPrice(gameState, good.id, true);
    const galacticAvg = market.galacticAverages[good.id];
    const marketStock = market.inventory[currentLocationId]?.[good.id];

    const hasLicense = !good.licenseId || player.unlockedLicenseIds.includes(good.licenseId);

    // REMOVED tutorial step checks: isPlasteelTutStep, isMarketLockedForMission, isLockedForTutorial

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

        // REMOVED isLockedForTutorial check from disabled attribute
        transactionControlsHtml = `
             <div class="transaction-controls" data-mode="${initialMode}" data-good-id="${good.id}">
                <div class="toggle-switch" data-action="toggle-trade-mode" data-good-id="${good.id}">
                    <div class="toggle-thumb"></div>
                    <div class="toggle-labels"><span class="label-buy">Buy</span><span class="label-sell">Sell</span></div>
                </div>
                <div class="qty-stepper">
                    <button class="qty-down" data-action="decrement" data-good-id="${good.id}">▼</button>
                    <input type="number" value="0" id="qty-${good.id}" min="0">
                    <button class="qty-up" data-action="increment" data-good-id="${good.id}">▲</button>
                </div>
                <div class="action-group">
                    <button class="btn confirm-btn" data-action="confirm-trade" data-good-id="${good.id}">Confirm</button>
                    <button class="btn max-btn" data-action="set-max-trade" data-good-id="${good.id}">Max</button>
                </div>
            </div>`;
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