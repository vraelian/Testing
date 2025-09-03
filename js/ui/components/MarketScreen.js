// js/ui/components/MarketScreen.js
/**
 * @fileoverview
 * This file contains the rendering logic for the Market screen.
 * It is responsible for displaying all available commodities for trade.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';

/**
 * Renders the entire Market screen, adapting for mobile or desktop layouts.
 * @param {object} gameState - The current state of the game.
 * @param {boolean} isMobile - A flag indicating if the mobile layout should be used.
 * @param {function} getItemPrice - A reference to the UIManager's getItemPrice function.
 * @returns {string} The HTML content for the Market screen.
 */
export function renderMarketScreen(gameState, isMobile, getItemPrice) {
    const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= gameState.player.revealedTier);
    const marketHtml = availableCommodities.map(good => {
        return _getMarketItemHtml(good, gameState, getItemPrice);
    }).join('');

    return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${marketHtml}</div>`;
}

/**
 * Generates the HTML for a single commodity card on the market screen.
 * @param {object} good - The commodity data from the database.
 * @param {object} gameState - The current game state.
 * @param {function} getItemPrice - A function to calculate the item's current price.
 * @returns {string} The HTML string for the commodity card.
 * @private
 */
function _getMarketItemHtml(good, gameState, getItemPrice) {
    const { player, market, currentLocationId, tutorials } = gameState;
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
    const indicatorHtml = _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem);
    
    let transactionControlsHtml;
    if (hasLicense) {
        transactionControlsHtml = `
             <div class="transaction-controls" data-mode="buy" data-good-id="${good.id}" ${isLockedForTutorial ? 'disabled' : ''}>
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
            <div class="transaction-controls">
                <button class="btn w-full" data-action="acquire-license" data-license-id="${good.licenseId}">Acquire License</button>
            </div>`;
    }


    return `
    <div class="item-card-container ${!hasLicense ? 'locked' : ''}" id="item-card-container-${good.id}">
        <div class="rounded-lg border ${good.styleClass} transition-colors shadow-md">
            <p class="font-bold commodity-name"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span></p>
            <p class="avail-text">Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span>, Own: <span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
            <p id="price-display-${good.id}" class="font-roboto-mono font-bold price-text" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}" data-base-price="${price}">${formatCredits(price)}</p>
            
            <div id="effective-price-display-${good.id}" class="effective-price-display"></div>
            
            <div class="indicator-container" id="indicators-${good.id}">${indicatorHtml}</div>

            ${transactionControlsHtml}
        </div>
    </div>`;
}


/**
 * Generates the HTML for the MKT and P/L indicators.
 * @param {number} price - The current market price.
 * @param {number} sellPrice - The current sell price.
 * @param {number} galacticAvg - The galactic average price.
 * @param {object} playerItem - The player's inventory item.
 * @returns {string} An HTML string containing the indicators.
 * @private
 */
function _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem) {
    const marketDiff = price - galacticAvg;
    const marketPct = galacticAvg > 0 ? Math.round((marketDiff / galacticAvg) * 100) : 0;
    const marketSign = marketPct > 0 ? '+' : '';
    let marketClass = 'neutral';
    if (marketPct > 5) marketClass = 'positive';
    if (marketPct < -5) marketClass = 'negative';
    let marketIcon = marketPct > 5 ? '▲' : (marketPct < -5 ? '▼' : '●');
    const marketIndicatorHtml = `<div class="indicator-pill ${marketClass}">${marketIcon} MKT: ${marketSign}${marketPct}%</div>`;

    let plIndicatorHtml = '';
    if (playerItem && playerItem.avgCost > 0) {
        const spreadPerUnit = sellPrice - playerItem.avgCost;
        if (Math.abs(spreadPerUnit) > 0.01) {
            const plPct = playerItem.avgCost > 0 ? Math.round((spreadPerUnit / playerItem.avgCost) * 100) : 0;
            const plSign = plPct > 0 ? '+' : '';
            let plClass = spreadPerUnit >= 0 ? 'positive' : 'negative';
            let plIcon = spreadPerUnit >= 0 ? '▲' : '▼';
            plIndicatorHtml = `<div class="indicator-pill ${plClass}">${plIcon} P/L: ${plSign}${plPct}%</div>`;
        }
    }

    return `${marketIndicatorHtml}${plIndicatorHtml}`;
}