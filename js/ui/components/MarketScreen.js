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
 * @returns {string} The HTML content for the Market screen.
 */
export function renderMarketScreen(gameState, isMobile) {
    const availableCommodities = DB.COMMODITIES.filter(c => c.unlockLevel <= gameState.player.unlockedCommodityLevel);
    const marketHtml = availableCommodities.map(good => {
        // For this visual overhaul, we'll use the same detailed layout for both.
        // The responsive design is handled in CSS.
        return _getMarketItemHtml(good, gameState);
    }).join('');

    return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${marketHtml}</div>`;
}

function _getMarketItemHtml(good, gameState) {
    const { player, market, currentLocationId, tutorials } = gameState;
    const playerItem = player.inventories[player.activeShipId]?.[good.id];
    const price = getItemPrice(gameState, good.id);
    const sellPrice = getItemPrice(gameState, good.id, true);
    const galacticAvg = market.galacticAverages[good.id];
    const marketStock = market.inventory[currentLocationId]?.[good.id];
    const currentLocation = DB.MARKETS.find(m => m.id === currentLocationId);

    const isPlasteelTutStep = tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId === 'mission_2_2';
    const isMarketLockedForMission = tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId === 'mission_2_3';
    const isLockedForTutorial = (isPlasteelTutStep && good.id !== COMMODITY_IDS.PLASTEEL) || isMarketLockedForMission;

    const isSpecialDemand = currentLocation.specialDemand && currentLocation.specialDemand[good.id];
    const buyDisabled = (isSpecialDemand || isLockedForTutorial) ? 'disabled' : '';
    const sellDisabled = isLockedForTutorial ? 'disabled' : ''; // This might need separate logic later if we lock only one action

    const nameTooltip = isSpecialDemand ? `data-tooltip="${currentLocation.specialDemand[good.id].lore}"` : `data-tooltip="${good.lore}"`;
    const playerInvDisplay = playerItem && playerItem.quantity > 0 ? ` <span class='text-cyan-300'>(${playerItem.quantity})</span>` : '';
    const graphIcon = `<span class="graph-icon" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}">📈</span>`;
    const indicatorHtml = _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem);

    return `
    <div class="item-card-container" id="item-card-container-${good.id}">
        <div class="bg-black/20 p-4 rounded-lg flex justify-between items-center border ${good.styleClass} transition-colors shadow-md h-32">
            <div class="flex flex-col justify-between flex-grow self-start pt-1">
                <div>
                    <p class="font-bold commodity-name text-outline"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span><span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
                    <p id="price-${good.id}" class="font-roboto-mono text-xl font-bold text-left pt-2 price-text text-outline flex items-center">${formatCredits(price)}</p>
                </div>
                <div class="text-sm self-start pb-1 text-outline flex items-center gap-3">
                    <span>Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span> ${graphIcon}</span>
                    <div id="indicators-${good.id}" class="flex items-center gap-2">${indicatorHtml}</div>
                </div>
            </div>
             <div class="transaction-controls" data-mode="buy" data-good-id="${good.id}" ${isLockedForTutorial ? 'disabled' : ''}>
                <div class="toggle-switch" data-action="toggle-trade-mode" data-good-id="${good.id}">
                    <div class="toggle-thumb"></div>
                    <div class="toggle-labels"><span class="label-buy">Buy</span><span class="label-sell">Sell</span></div>
                </div>
                <div class="qty-stepper">
                    <button class="qty-down" data-action="decrement" data-good-id="${good.id}">▼</button>
                    <input type="number" value="1" id="qty-${good.id}" min="1">
                    <button class="qty-up" data-action="increment" data-good-id="${good.id}">▲</button>
                </div>
                <div class="action-group">
                    <button class="btn confirm-btn" data-action="confirm-trade" data-good-id="${good.id}">Confirm</button>
                    <button class="btn max-btn" data-action="set-max-trade" data-good-id="${good.id}">Max</button>
                </div>
            </div>
        </div>
    </div>`;
}


/**
 * Generates the HTML for the MKT and P/L indicators, ensuring they always stack vertically.
 * @param {number} price - The current market price.
 * @param {number} sellPrice - The current sell price (including special demand).
 * @param {number} galacticAvg - The galactic average price.
 * @param {object} playerItem - The player's inventory item for this commodity.
 * @returns {string} An HTML string containing the vertically stacked indicators.
 * @private
 */
function _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem) {
    // Market Indicator Logic
    const marketDiff = price - galacticAvg;
    const marketPct = galacticAvg > 0 ? Math.round((marketDiff / galacticAvg) * 100) : 0;
    const marketSign = marketPct > 0 ? '+' : '';
    let marketClass = marketPct < -15 ? 'negative' : (marketPct > 15 ? 'positive' : 'neutral');
    let marketIcon = marketPct < -15 ? '▼' : (marketPct > 15 ? '▲' : '●');
    const marketIndicatorHtml = `<div class="indicator-pill ${marketClass}">${marketIcon} MKT: ${marketSign}${marketPct}%</div>`;

    // P/L Indicator Logic
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

    // Always stack the indicators vertically
    return `<div class="flex flex-col items-start gap-1">${marketIndicatorHtml}${plIndicatorHtml}</div>`;
}


// This function needs to be accessible from this component, so it's duplicated from UIManager
function getItemPrice(gameState, goodId, isSelling = false) {
    let price = gameState.market.prices[gameState.currentLocationId][goodId];
    const market = DB.MARKETS.find(m => m.id === gameState.currentLocationId);
    if (isSelling && market.specialDemand && market.specialDemand[goodId]) {
        price *= market.specialDemand[good.id].bonus;
    }
    const intel = gameState.intel.active;
    if (intel && intel.targetMarketId === gameState.currentLocationId && intel.commodityId === goodId) {
        price *= (intel.type === 'demand') ? DB.CONFIG.INTEL_DEMAND_MOD : DB.CONFIG.INTEL_DEPRESSION_MOD;
    }
    return Math.max(1, Math.round(price));
}