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
        return isMobile 
            ? _getMarketItemHtmlMobile(good, gameState) 
            : _getMarketItemHtmlDesktop(good, gameState);
    }).join('');

    return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${marketHtml}</div>`;
}

function _getMarketItemHtmlDesktop(good, gameState) {
    const { player, market, currentLocationId, tutorials } = gameState;
    const playerItem = player.inventories[player.activeShipId]?.[good.id];
    const price = getItemPrice(gameState, good.id);
    const sellPrice = getItemPrice(gameState, good.id, true);
    const galacticAvg = market.galacticAverages[good.id];
    const marketStock = market.inventory[currentLocationId]?.[good.id];
    const currentLocation = DB.MARKETS.find(m => m.id === currentLocationId);
    
    const isPlasteelTutStep = tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId === 'mission_2_2';
    const isLockedForTutorial = isPlasteelTutStep && good.id !== COMMODITY_IDS.PLASTEEL;

    const isSpecialDemand = currentLocation.specialDemand && currentLocation.specialDemand[good.id];
    const buyDisabled = (isSpecialDemand || isLockedForTutorial) ? 'disabled' : '';
    const sellDisabled = isLockedForTutorial ? 'disabled' : '';

    const nameTooltip = isSpecialDemand ? `data-tooltip="${currentLocation.specialDemand[good.id].lore}"` : `data-tooltip="${good.lore}"`;
    const playerInvDisplay = playerItem && playerItem.quantity > 0 ? ` <span class='text-cyan-300'>(${playerItem.quantity})</span>` : '';
    const graphIcon = `<span class="graph-icon" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}">📈</span>`;
    const { marketIndicatorHtml, plIndicatorHtml } = _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, false);
    return `
    <div class="item-card-container" id="item-card-container-${good.id}">
        <div class="bg-black/20 p-4 rounded-lg flex justify-between items-center border ${good.styleClass} transition-colors shadow-md h-32">
            <div class="flex flex-col h-full justify-between flex-grow self-start pt-1">
                <div>
                    <p class="font-bold commodity-name text-outline"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span><span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
                     <p id="price-${good.id}" class="font-roboto-mono text-xl font-bold text-left pt-2 price-text text-outline flex items-center">${formatCredits(price)}</p>
                </div>
                <div class="text-sm self-start pb-1 text-outline flex items-center gap-3">
                    <span>Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span> ${graphIcon}</span>
                    <div id="indicators-${good.id}" class="flex items-center gap-2">${marketIndicatorHtml}${plIndicatorHtml}</div>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <div class="flex flex-col items-center"><div class="flex flex-col space-y-1">
                    <button id="buy-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.BUY_ITEM}" data-good-id="${good.id}" ${buyDisabled}>Buy</button>
                    <button id="max-buy-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_BUY}" data-good-id="${good.id}" ${buyDisabled}>Max</button>
                </div></div>
                <div class="flex flex-col items-center">
                    <button class="qty-btn" data-action="${ACTION_IDS.INCREMENT}" data-good-id="${good.id}" ${sellDisabled}>+</button>
                    <input type="number" class="qty-input p-2 my-1" id="qty-${good.id}" data-good-id="${good.id}" value="1" min="1" ${sellDisabled}>
                    <button class="qty-btn" data-action="${ACTION_IDS.DECREMENT}" data-good-id="${good.id}" ${sellDisabled}>-</button>
                </div>
                <div class="flex flex-col items-center"><div class="flex flex-col space-y-1">
                    <button id="sell-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.SELL_ITEM}" data-good-id="${good.id}" ${sellDisabled}>Sell</button>
                    <button id="max-sell-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_SELL}" data-good-id="${good.id}" ${sellDisabled}>Max</button>
                </div></div>
            </div>
        </div>
    </div>`;
}

function _getMarketItemHtmlMobile(good, gameState) {
    const { player, market, currentLocationId, tutorials } = gameState;
    const playerItem = player.inventories[player.activeShipId]?.[good.id];
    const price = getItemPrice(gameState, good.id);
    const sellPrice = getItemPrice(gameState, good.id, true);
    const galacticAvg = market.galacticAverages[good.id];
    const marketStock = market.inventory[currentLocationId]?.[good.id];
    const currentLocation = DB.MARKETS.find(m => m.id === currentLocationId);

    const isPlasteelTutStep = tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId === 'mission_2_2';
    const isLockedForTutorial = isPlasteelTutStep && good.id !== COMMODITY_IDS.PLASTEEL;

    const isSpecialDemand = currentLocation.specialDemand && currentLocation.specialDemand[good.id];
    const buyDisabled = (isSpecialDemand || isLockedForTutorial) ? 'disabled' : '';
    const sellDisabled = isLockedForTutorial ? 'disabled' : '';

    const nameTooltip = isSpecialDemand ? `data-tooltip="${currentLocation.specialDemand[good.id].lore}"` : `data-tooltip="${good.lore}"`;
    const playerInvDisplay = playerItem && playerItem.quantity > 0 ? ` <span class='text-cyan-300'>(${playerItem.quantity})</span>` : '';
    const graphIcon = `<span class="graph-icon" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}">📈</span>`;
    const { marketIndicatorHtml } = _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, true);
    return `
    <div class="item-card-container" id="item-card-container-${good.id}">
        <div class="bg-black/20 p-4 rounded-lg flex flex-col border ${good.styleClass} shadow-md">
            <div class="flex justify-between items-start w-full mb-2">
                <div class="flex-grow">
                    <p class="font-bold commodity-name text-outline"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span><span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
                    <p id="price-${good.id}" class="font-roboto-mono text-xl font-bold text-left pt-2 price-text text-outline flex items-center">${formatCredits(price)}</p>
                </div>
                <div class="text-right text-sm flex-shrink-0 ml-2 text-outline">Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span> ${graphIcon}</div>
            </div>
            <div id="indicators-${good.id}">${marketIndicatorHtml}</div>
            <div class="flex justify-end items-end mt-2">
                <div class="mobile-controls-wrapper">
                    <div class="flex flex-col items-center space-y-1">
                        <button id="buy-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.BUY_ITEM}" data-good-id="${good.id}" ${buyDisabled}>Buy</button>
                        <button id="max-buy-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_BUY}" data-good-id="${good.id}" ${buyDisabled}>Max</button>
                    </div>
                    <div class="flex flex-col items-center space-y-1">
                        <button class="qty-btn" data-action="${ACTION_IDS.INCREMENT}" data-good-id="${good.id}" ${sellDisabled}>+</button>
                        <input type="number" class="qty-input" id="qty-${good.id}-mobile" data-good-id="${good.id}" value="1" min="1" ${sellDisabled}>
                        <button class="qty-btn" data-action="${ACTION_IDS.DECREMENT}" data-good-id="${good.id}" ${sellDisabled}>-</button>
                    </div>
                    <div class="flex flex-col items-center space-y-1">
                        <button id="sell-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.SELL_ITEM}" data-good-id="${good.id}" ${sellDisabled}>Sell</button>
                        <button id="max-sell-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_SELL}" data-good-id="${good.id}" ${sellDisabled}>Max</button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, isMobile) {
    const marketDiff = price - galacticAvg;
    const marketPct = galacticAvg > 0 ? Math.round((marketDiff / galacticAvg) * 100) : 0;
    const marketSign = marketPct > 0 ? '+' : '';
    let marketColor = marketPct < -15 ? 'text-red-400' : (marketPct > 15 ? 'text-green-400' : 'text-white');
    let marketArrowSVG = _getArrowSvg(marketPct > 15 ? 'up' : marketPct < -15 ? 'down' : 'neutral');
    if (isMobile) {
        let mobileHtml = `<div class="mobile-indicator-wrapper text-sm text-outline">`;
        mobileHtml += `<div class="flex items-center ${marketColor}"><span>MKT: ${marketSign}${marketPct}%</span> ${marketArrowSVG}</div>`;
        
        if (playerItem && playerItem.avgCost > 0) {
            const spreadPerUnit = sellPrice - playerItem.avgCost;
            if (Math.abs(spreadPerUnit) > 0.01) {
                const plPct = playerItem.avgCost > 0 ? Math.round((spreadPerUnit / playerItem.avgCost) * 100) : 0;
                const plColor = spreadPerUnit >= 0 ? 'text-green-400' : 'text-red-400';
                const plSign = plPct > 0 ? '+' : '';
                let plArrowSVG = _getArrowSvg(spreadPerUnit > 0 ? 'up' : 'down');
                mobileHtml += `<div class="flex items-center ${plColor}"><span>P/L: ${plSign}${plPct}%</span> ${plArrowSVG}</div>`;
            }
        }
        mobileHtml += `</div>`;
        return { marketIndicatorHtml: mobileHtml, plIndicatorHtml: '' };
    } else {
        const marketIndicatorHtml = `<div class="flex items-center gap-2"><div class="market-indicator-stacked ${marketColor}"><span class="text-xs opacity-80">MKT</span><span>${marketSign}${marketPct}%</span></div>${marketArrowSVG}</div>`;
        let plIndicatorHtml = '';
        if (playerItem && playerItem.avgCost > 0) {
            const spreadPerUnit = sellPrice - playerItem.avgCost;
            if (Math.abs(spreadPerUnit) > 0.01) {
                const plPct = playerItem.avgCost > 0 ? Math.round((spreadPerUnit / playerItem.avgCost) * 100) : 0;
                const plColor = spreadPerUnit >= 0 ? 'text-green-400' : 'text-red-400';
                const plSign = plPct > 0 ? '+' : '';
                let plArrowSVG = _getArrowSvg(spreadPerUnit > 0 ? 'up' : 'down');
                plIndicatorHtml = `<div class="flex items-center gap-2"><div class="market-indicator-stacked ${plColor}"><span class="text-xs opacity-80">P/L</span><span>${plSign}${plPct}%</span></div>${plArrowSVG}</div>`;
            }
        }
        return { marketIndicatorHtml, plIndicatorHtml };
    }
}

function _getArrowSvg(direction) {
    const path = {
        up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
        down: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
        neutral: 'M5 12h14'
    };
    const fill = direction === 'neutral' ? 'none' : 'currentColor';
    const stroke = direction === 'neutral' ? 'currentColor' : 'none';
    const strokeWidth = direction === 'neutral' ? '3' : '0';
    return `<svg class="indicator-arrow" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"><path d="${path[direction]}"/></svg>`;
}

// This function needs to be accessible from this component, so it's duplicated from UIManager
function getItemPrice(gameState, goodId, isSelling = false) {
    let price = gameState.market.prices[gameState.currentLocationId][goodId];
    const market = DB.MARKETS.find(m => m.id === gameState.currentLocationId);
    if (isSelling && market.specialDemand && market.specialDemand[goodId]) {
        price *= market.specialDemand[goodId].bonus;
    }
    const intel = gameState.intel.active;
    if (intel && intel.targetMarketId === gameState.currentLocationId && intel.commodityId === goodId) {
        price *= (intel.type === 'demand') ? DB.CONFIG.INTEL_DEMAND_MOD : DB.CONFIG.INTEL_DEPRESSION_MOD;
    }
    return Math.max(1, Math.round(price));
}