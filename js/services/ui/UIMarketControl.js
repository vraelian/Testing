// js/services/ui/UIMarketControl.js
import { DB } from '../../data/database.js';
import { SCREEN_IDS, PERK_IDS } from '../../data/constants.js';
import { formatCredits, renderIndicatorPills } from '../../utils.js';
import { renderMarketScreen } from '../../ui/components/MarketScreen.js';

export class UIMarketControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
        this.marketTransactionState = {}; 
        this.marketScrollPosition = 0;
    }

    /**
     * Resets the input state for market transactions.
     * Critical for clearing pending trades when traveling to a new location.
     */
    resetMarketTransactionState() {
        this.marketTransactionState = {};
    }

    /**
     * Helper to retrieve aggregated fleet inventory for a specific commodity
     * @param {object} state 
     * @param {string} goodId 
     * @returns {object|null}
     */
    _getFleetItem(state, goodId) {
        let totalQty = 0;
        let totalCostValue = 0;
        
        for (const shipId of state.player.ownedShipIds) {
            const item = state.player.inventories[shipId]?.[goodId];
            if (item && item.quantity > 0) {
                totalQty += item.quantity;
                totalCostValue += item.quantity * item.avgCost;
            }
        }
        
        return totalQty > 0 ? { quantity: totalQty, avgCost: totalCostValue / totalQty } : null;
    }

    /**
     * Renders the market screen, preserving scroll position and input states.
     * @param {object} gameState 
     */
    updateMarketScreen(gameState) {
        if (gameState.activeScreen !== SCREEN_IDS.MARKET) return;
        
        const marketScrollPanel = this.manager.cache.marketScreen.querySelector('.market-scroll-panel'); 

        // Preserve Scroll Position
        if (this.manager.lastKnownState && 
            this.manager.lastKnownState.activeScreen === SCREEN_IDS.MARKET && 
            this.manager.lastKnownState.currentLocationId === gameState.currentLocationId && 
            marketScrollPanel) {
            this.marketScrollPosition = marketScrollPanel.scrollTop;
        } else {
            this.marketScrollPosition = 0;
        }
    
        this._saveMarketTransactionState();
        
        // Render Component
        this.manager.cache.marketScreen.innerHTML = renderMarketScreen(
            gameState, 
            this.manager.isMobile, 
            this.getItemPrice.bind(this), 
            this.marketTransactionState
        );
        
        this._restoreMarketTransactionState();
        
        // Restore Scroll Position
        const newMarketScrollPanel = this.manager.cache.marketScreen.querySelector('.market-scroll-panel');
        if (newMarketScrollPanel) {
            newMarketScrollPanel.scrollTop = this.marketScrollPosition;
        }
    }

    /**
     * Calculates the display price for an item, accounting for modifiers.
     * @param {object} gameState 
     * @param {string} goodId 
     * @param {boolean} isSelling 
     * @returns {number}
     */
    getItemPrice(gameState, goodId, isSelling = false) {
        if (!this.manager.simulationService || !this.manager.simulationService.marketService) {
            return gameState.market.prices[gameState.currentLocationId]?.[goodId] || 0;
        }
        return this.manager.simulationService.marketService.getPrice(gameState.currentLocationId, goodId, true);
    }

    _saveMarketTransactionState() {
        if (!this.manager.lastKnownState || this.manager.lastKnownState.activeScreen !== SCREEN_IDS.MARKET) return;
        const controls = this.manager.cache.marketScreen.querySelectorAll('.transaction-controls');
        controls.forEach(control => {
            const goodId = control.dataset.goodId;
            const qtyInput = control.querySelector('input');
            const mode = control.dataset.mode;

            if (qtyInput) {
                this.marketTransactionState[goodId] = {
                    quantity: qtyInput.value,
                    mode: mode
                };
            }
        });
    }

    _restoreMarketTransactionState() {
        for (const goodId in this.marketTransactionState) {
            const state = this.marketTransactionState[goodId];
            const control = this.manager.cache.marketScreen.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
            if (control) {
                const qtyInput = control.querySelector('input');
                if (qtyInput) {
                    qtyInput.value = state.quantity;
                    control.setAttribute('data-mode', state.mode);
                    this.updateMarketCardDisplay(goodId, parseInt(state.quantity, 10) || 0, state.mode);
                }
            }
        }
    }

    /**
     * Updates the base price display on a market card (e.g., after a refresh).
     * @param {string} goodId 
     * @param {number} newPrice 
     */
    updateMarketCardPrice(goodId, newPrice) {
        const priceEl = this.manager.cache.marketScreen.querySelector(`#price-display-${goodId}`);
        if (priceEl) {
            priceEl.dataset.basePrice = newPrice;
            const controls = priceEl.closest('.item-card-container').querySelector('.transaction-controls');
            if (controls && controls.dataset.mode === 'buy') {
                priceEl.textContent = formatCredits(newPrice);
            }
        }
    }

    /**
     * Updates the dynamic pricing display based on quantity input (Buy vs Sell mode).
     * @param {string} goodId 
     * @param {number} quantity 
     * @param {string} mode 
     */
    updateMarketCardDisplay(goodId, quantity, mode) {
        const priceEl = this.manager.cache.marketScreen.querySelector(`#price-display-${goodId}`);
        const effectivePriceEl = this.manager.cache.marketScreen.querySelector(`#effective-price-display-${goodId}`);
        const indicatorEl = this.manager.cache.marketScreen.querySelector(`#indicators-${goodId}`);
        const avgCostEl = this.manager.cache.marketScreen.querySelector(`#avg-cost-${goodId}`);

        if (!priceEl || !effectivePriceEl || !indicatorEl || !this.manager.lastKnownState) return;

        const state = this.manager.lastKnownState;
        const basePrice = parseInt(priceEl.dataset.basePrice, 10);
        const playerItem = this._getFleetItem(state, goodId);

        if (avgCostEl) {
            avgCostEl.classList.toggle('visible', mode === 'sell');
        }

        if (mode === 'buy') {
            priceEl.textContent = formatCredits(basePrice);
            priceEl.className = 'font-roboto-mono font-bold price-text';
            effectivePriceEl.textContent = '';
            
            indicatorEl.innerHTML = renderIndicatorPills({
                price: basePrice,
                sellPrice: this.getItemPrice(state, goodId, true),
                galacticAvg: state.market.galacticAverages[goodId],
                playerItem: playerItem
            });

        } else { // 'sell' mode
            const { effectivePricePerUnit, netProfit } = this._calculateSaleDetails(goodId, quantity);

            if (quantity > 0) {
                let profitText = `⌬ ${netProfit >= 0 ? '+' : ''}${formatCredits(netProfit, false)}`;
                priceEl.textContent = profitText;
                effectivePriceEl.textContent = `(${formatCredits(basePrice, false)}/unit)`;
                priceEl.className = `font-roboto-mono font-bold ${netProfit >= 0 ? 'profit-text' : 'loss-text'}`;
            } else {
                priceEl.textContent = '⌬ +0';
                priceEl.className = 'font-roboto-mono font-bold profit-text';
                effectivePriceEl.textContent = '';
            }

            indicatorEl.innerHTML = renderIndicatorPills({
                price: basePrice,
                sellPrice: effectivePricePerUnit || this.getItemPrice(state, goodId, true),
                galacticAvg: state.market.galacticAverages[goodId],
                playerItem: playerItem
            });
        }
    }

    _calculateSaleDetails(goodId, quantity) {
        const state = this.manager.lastKnownState;
        if (!state) return { totalPrice: 0, effectivePricePerUnit: 0, netProfit: 0 };

        const basePrice = this.getItemPrice(state, goodId, true);
        const effectivePrice = basePrice; 
        const totalPrice = Math.floor(effectivePrice * quantity);

        // --- FLEET OVERFLOW SYSTEM: EXACT COST BASIS SIMULATION ---
        // Instead of using the blended average, simulate the exact drain order
        // (Active Ship first, then by max capacity descending) to project real profit.
        const activeShipId = state.player.activeShipId;
        const shipInventories = [];
        
        for (const shipId of state.player.ownedShipIds) {
            const qty = state.player.inventories[shipId]?.[goodId]?.quantity || 0;
            // Safely fetch max capacity, falling back to static DB if simulation service isn't ready
            const maxCapacity = this.manager.simulationService ? 
                this.manager.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                DB.SHIPS[shipId].maxCapacity;
                
            shipInventories.push({ shipId, qty, maxCapacity });
        }

        shipInventories.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.maxCapacity - a.maxCapacity;
        });

        let remainingToSell = quantity;
        let exactCostBasis = 0;

        for (const shipData of shipInventories) {
            if (remainingToSell <= 0) break;
            const toRemove = Math.min(remainingToSell, shipData.qty);
            if (toRemove > 0) {
                const invItem = state.player.inventories[shipData.shipId][goodId];
                exactCostBasis += (toRemove * invItem.avgCost);
                remainingToSell -= toRemove;
            }
        }
        // --- END SIMULATION ---

        let netProfit = totalPrice - exactCostBasis;
        if (netProfit > 0) {
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + (state.player.statModifiers?.profitBonus || 0);
            netProfit += netProfit * totalBonus;
        }

        return {
            totalPrice,
            effectivePricePerUnit: effectivePrice, 
            netProfit
        };
    }

    /**
     * Generates the SVG string for the Price History graph.
     * @param {string} goodId 
     * @param {object} gameState 
     * @param {object} _playerItem - Kept for signature compatibility, unused.
     * @returns {string} SVG HTML string
     */
    renderPriceGraph(goodId, gameState, _playerItem) {
        const history = gameState.market.priceHistory[gameState.currentLocationId]?.[goodId];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">No Data Available!</div>`;
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const staticAvg = (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
        const width = 280, height = 140, padding = 35;
        const prices = history.map(p => p.price);
        
        const fleetItem = this._getFleetItem(gameState, goodId);
        const playerBuyPrice = fleetItem?.avgCost > 0 ? fleetItem.avgCost : null;

        let allValues = [...prices, staticAvg];
        if (playerBuyPrice) allValues.push(playerBuyPrice);
        const minVal = Math.min(...allValues), maxVal = Math.max(...allValues);
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

        const iToX = i => (i / (history.length - 1)) * (width - padding * 2) + padding;
        const vToY = v => height - padding - ((v - minVal) / valueRange) * (height - padding * 2.5);

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${padding}" y1="${vToY(maxVal)}" x2="${padding}" y2="${height - padding}" /><line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />`;
        svg += `</g>`;

        const staticAvgY = vToY(staticAvg);
        svg += `<line x1="${padding}" y1="${staticAvgY}" x2="${width - padding}" y2="${staticAvgY}" stroke="#facc15" stroke-width="1" stroke-dasharray="3 3" />`;
        svg += `<text x="${width - padding + 4}" y="${staticAvgY + 3}" fill="#facc15" font-size="10" font-family="Roboto Mono" text-anchor="start">Avg: ${formatCredits(staticAvg, false)}</text>`;
        if (playerBuyPrice) {
            const buyPriceY = vToY(playerBuyPrice);
            svg += `<line x1="${padding}" y1="${buyPriceY}" x2="${width - padding}" y2="${buyPriceY}" stroke="#34d399" stroke-width="1" stroke-dasharray="3 3" />`;
            svg += `<text x="${width - padding + 4}" y="${buyPriceY + 3}" fill="#34d399" font-size="10" font-family="Roboto Mono" text-anchor="start">Paid: ${formatCredits(playerBuyPrice, false)}</text>`;
        }

        const pricePoints = history.map((p, i) => `${iToX(i)},${vToY(p.price)}`).join(' ');
        svg += `<polyline fill="none" stroke="#60a5fa" stroke-width="2" points="${pricePoints}" />`;

        const firstDay = history[0].day;
        const lastDay = history[history.length - 1].day;
        svg += `<text x="${padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="start">Day ${firstDay}</text>`;
        svg += `<text x="${width - padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">Day ${lastDay}</text>`;
        svg += `<text x="${padding - 8}" y="${vToY(minVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${padding - 8}" y="${vToY(maxVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates the SVG string for the Finance/Credits graph.
     * @param {object} gameState 
     * @returns {string} SVG HTML string
     */
    renderFinanceGraph(gameState) {
        const history = gameState.player.creditHistory || [];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">No Financial Data Available</div>`;

        const width = 280, height = 140, padding = 35;
        const values = history.map(h => h.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

        const iToX = i => (i / (history.length - 1)) * (width - padding * 2) + padding;
        const vToY = v => height - padding - ((v - minVal) / valueRange) * (height - padding * 2.5);

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        
        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${padding}" y1="${vToY(maxVal)}" x2="${padding}" y2="${height - padding}" />`;
        svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />`;
        svg += `</g>`;

        const points = history.map((h, i) => `${iToX(i)},${vToY(h.value)}`).join(' ');
        svg += `<polyline fill="none" stroke="#10b981" stroke-width="2" points="${points}" />`; 

        const firstDay = history[0].day;
        const lastDay = history[history.length - 1].day;
        svg += `<text x="${padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="start">Day ${firstDay}</text>`;
        svg += `<text x="${width - padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">Day ${lastDay}</text>`;
        
        svg += `<text x="${padding - 8}" y="${vToY(minVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${padding - 8}" y="${vToY(maxVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;
        
        svg += `</svg>`;
        return svg;
    }
}