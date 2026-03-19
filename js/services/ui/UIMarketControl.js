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
        
        // Render Component (Phase 5: Added getXRayData binder)
        this.manager.cache.marketScreen.innerHTML = renderMarketScreen(
            gameState, 
            this.manager.isMobile, 
            this.getItemPrice.bind(this), 
            this.marketTransactionState,
            this.getXRayData.bind(this)
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

    /**
     * Fetch hidden variables for Phase 5 Diagnostic Rendering
     */
    getXRayData(gameState, goodId, simulatedQty = 0, simulatedMode = 'buy') {
        if (!this.manager.simulationService || !this.manager.simulationService.marketService) return null;
        const ms = this.manager.simulationService.marketService;
        const locId = gameState.currentLocationId;
        const item = gameState.market.inventory[locId]?.[goodId];
        if (!item) return null;
        
        const targetPrice = ms.getLocalTargetPrice(locId, goodId, simulatedQty, simulatedMode, simulatedQty > 0);
        
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const market = DB.MARKETS.find(m => m.id === locId);
        const [min, max] = good.canonicalAvailability;
        const modifier = market.availabilityModifier?.[goodId] ?? 1.0;
        const baseMean = ((min+max)/2) * modifier;
        
        let pressure = item.marketPressure;
        if (simulatedQty > 0) {
             const pMod = market.ecoProfile?.dampeners?.[goodId] ?? market.ecoProfile?.pressureMod ?? 1.0;
             const pChange = (((Math.abs(simulatedQty) / (max || 100)) * good.tier) / 10) * pMod;
             if (simulatedMode === 'buy') pressure -= pChange;
             else pressure += pChange;
        } else if (gameState.day < item.lastPlayerInteractionTimestamp + 7) {
             pressure = 0;
        }

        const adapt = 1 - Math.max(-2.0, Math.min(0.5, pressure * 0.5));
        const targetStock = Math.max(1, baseMean * adapt * (1 + (gameState.player.statModifiers?.commoditySupply || 0)));
        
        let currentQty = item.quantity;
        if (simulatedQty > 0) {
            if (simulatedMode === 'sell') currentQty += simulatedQty;
            if (simulatedMode === 'buy') currentQty = Math.max(0, currentQty - simulatedQty);
        }
        
        const ratio = currentQty / targetStock;
        
        return {
            pressure: pressure.toFixed(3),
            targetPrice: Math.round(targetPrice),
            ratio: ratio.toFixed(2),
            targetStock: Math.round(targetStock)
        };
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
        
        const ms = this.manager.simulationService?.marketService;
        const localTargetPrice = ms ? ms.getLocalTargetPrice(state.currentLocationId, goodId) : state.market.galacticAverages[goodId];

        if (avgCostEl) {
            avgCostEl.classList.toggle('visible', mode === 'sell');
        }

        if (mode === 'buy') {
            const availEl = priceEl.closest('.item-card-container').querySelector('.avail-text');
            if (availEl) {
                const currentMarketStock = state.market.inventory[state.currentLocationId]?.[goodId]?.quantity || 0;
                const ownQty = playerItem ? playerItem.quantity : 0;
                availEl.innerHTML = `Avail: ${currentMarketStock} | <span id="p-inv-${goodId}">Own: ${ownQty}</span>`;
            }

            const displayPrice = quantity > 0 ? basePrice * quantity : basePrice;
            priceEl.textContent = formatCredits(displayPrice);
            priceEl.className = 'font-roboto-mono font-bold price-text';
            
            if (quantity > 1) {
                effectivePriceEl.textContent = `(${formatCredits(basePrice, false)}/unit)`;
            } else {
                effectivePriceEl.textContent = '';
            }
            
            indicatorEl.innerHTML = renderIndicatorPills({
                price: basePrice,
                sellPrice: this.getItemPrice(state, goodId, true),
                galacticAvg: localTargetPrice, 
                playerItem: playerItem
            });

        } else { // 'sell' mode
            const { effectivePricePerUnit, netProfit } = this._calculateSaleDetails(goodId, quantity);

            let isGlut = false;
            let currentMarketStock = 0;
            if (ms) {
                currentMarketStock = state.market.inventory[state.currentLocationId]?.[goodId]?.quantity || 0;
                const glutThreshold = ms.getGlutThreshold(state.currentLocationId, goodId);
                const parsedQty = parseInt(quantity, 10) || 0;
                if ((parsedQty + currentMarketStock) > glutThreshold) {
                    isGlut = true;
                }
            }

            const availEl = priceEl.closest('.item-card-container').querySelector('.avail-text');
            if (availEl) {
                if (isGlut) {
                    availEl.innerHTML = `<span class="text-glut-warning font-bold" style="font-size: 0.9em; letter-spacing: 0.5px;">MKT SATURATED - 0.25% LOSS!</span>`;
                } else {
                    const ownQty = playerItem ? playerItem.quantity : 0;
                    availEl.innerHTML = `Avail: ${currentMarketStock} | <span id="p-inv-${goodId}">Own: ${ownQty}</span>`;
                }
            }

            if (quantity > 0) {
                let profitText = `⌬ ${netProfit >= 0 ? '+' : ''}${formatCredits(netProfit, false)}`;
                priceEl.textContent = profitText;
                effectivePriceEl.textContent = `(${formatCredits(basePrice, false)}/unit)`;
                priceEl.className = `font-roboto-mono font-bold ${netProfit >= 0 ? 'profit-text' : 'loss-text'} ${isGlut ? 'text-glut-warning' : ''}`;
            } else {
                priceEl.textContent = '⌬ +0';
                priceEl.className = `font-roboto-mono font-bold profit-text ${isGlut ? 'text-glut-warning' : ''}`;
                effectivePriceEl.textContent = '';
            }

            indicatorEl.innerHTML = renderIndicatorPills({
                price: basePrice,
                sellPrice: effectivePricePerUnit || this.getItemPrice(state, goodId, true),
                galacticAvg: localTargetPrice, 
                playerItem: playerItem
            });
        }

        // --- PHASE 5: LIVE X-RAY UPDATE OVERLAY ---
        if (state.uiState?.xrayEnabled) {
            const xrayEl = this.manager.cache.marketScreen.querySelector(`#xray-${goodId}`);
            if (xrayEl) {
                const parsedQty = parseInt(quantity, 10) || 0;
                const xrayData = this.getXRayData(state, goodId, parsedQty, mode);
                if (xrayData) {
                     xrayEl.innerHTML = `
                         <div class="text-[10px] text-cyan-400 font-mono mt-2 p-1 border border-cyan-800 bg-cyan-950/30 rounded" style="line-height: 1.2;">
                             [X-RAY] Target: ⌬${xrayData.targetPrice} | P: ${xrayData.pressure}<br>
                             Ratio: ${xrayData.ratio} (T.Stock: ${xrayData.targetStock})
                         </div>
                     `;
                }
            }
       }
    }

    _calculateSaleDetails(goodId, quantity) {
        const state = this.manager.lastKnownState;
        if (!state) return { totalPrice: 0, effectivePricePerUnit: 0, netProfit: 0 };

        const basePrice = this.getItemPrice(state, goodId, true);
        const effectivePrice = basePrice; 

        const activeShipId = state.player.activeShipId;
        const shipInventories = [];
        
        let totalOwnedQty = 0;
        
        for (const shipId of state.player.ownedShipIds) {
            const qty = state.player.inventories[shipId]?.[goodId]?.quantity || 0;
            totalOwnedQty += qty;
            const maxCapacity = this.manager.simulationService ? 
                this.manager.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                DB.SHIPS[shipId].maxCapacity;
                
            shipInventories.push({ shipId, qty, maxCapacity });
        }

        const evaluableQty = Math.min(quantity, totalOwnedQty);
        const totalPrice = Math.floor(effectivePrice * evaluableQty);

        shipInventories.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.maxCapacity - a.maxCapacity;
        });

        let remainingToSell = evaluableQty;
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
     */
    renderPriceGraph(goodId, gameState, _playerItem) {
        if (!this.manager.simulationService || !this.manager.simulationService.marketService) {
            return `<div class="text-gray-400 text-sm p-4">Simulation Offline</div>`;
        }

        const ms = this.manager.simulationService.marketService;
        const locId = gameState.currentLocationId;
        const currentDay = gameState.day;
        
        const historyDays = 90;
        const projectedDays = 45;

        const curveData = ms.generateCurveData(locId, goodId, historyDays, projectedDays);
        if (!curveData || curveData.length === 0) return `<div class="text-gray-400 text-sm p-4">No Data Available</div>`;

        const galacticAvg = ms.getGalacticAverage(goodId);
        const localAvg = ms.getLocalTargetPrice(locId, goodId);

        const width = 380, height = 255, paddingLeft = 60, paddingRight = 20, paddingTop = 30, paddingBottom = 105;

        const allPrices = curveData.map(d => d.price).concat([galacticAvg, localAvg]);
        const minVal = Math.max(1, Math.min(...allPrices) * 0.85); 
        const maxVal = Math.max(...allPrices) * 1.15; 
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;
        const midVal = (minVal + maxVal) / 2;

        const minDay = currentDay - historyDays;
        const maxDay = currentDay + projectedDays;
        const dayRange = maxDay - minDay;

        const iToX = day => ((day - minDay) / dayRange) * (width - paddingLeft - paddingRight) + paddingLeft;
        const vToY = v => height - paddingBottom - ((v - minVal) / valueRange) * (height - paddingTop - paddingBottom);

        let svg = `<div class="market-graph-container" onclick="this.classList.toggle('graph-expanded')" style="cursor: pointer; width: 100%; height: 100%;">`;
        svg += `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="100%" height="100%" fill="#0c101d" />`;

        const sysStateObj = gameState.systemStates || gameState.systemState || {};
        const weatherHistory = sysStateObj.historyLedger || [];
        const activeStates = [];
        
        if (sysStateObj.activeId && sysStateObj.activeId !== 'NEUTRAL') {
            activeStates.push({
                id: sysStateObj.activeId,
                startDay: sysStateObj.startDay || currentDay,
                endDay: (sysStateObj.startDay || currentDay) + (sysStateObj.remainingDays || 7)
            });
        }
        
        const allBands = [...weatherHistory, ...activeStates];

        allBands.forEach(band => {
            if (typeof band === 'string') return; 
            
            const stateDef = DB.SYSTEM_STATES?.[band.id];
            const isMalign = stateDef?.isMalign === true; 
            const bandClass = isMalign ? 'svg-band-malign' : 'svg-band-benign';

            const rawStartX = iToX(band.startDay || band.day);
            const rawEndX = iToX(band.endDay || ((band.startDay || band.day) + 7));
            const startX = Math.max(paddingLeft, rawStartX);
            const endX = Math.min(width - paddingRight, rawEndX);

            if (endX > startX && endX >= paddingLeft && startX <= width - paddingRight) {
                svg += `<rect x="${startX}" y="${paddingTop}" width="${endX - startX}" height="${height - paddingTop - paddingBottom}" class="${bandClass}" />`;
            }
        });

        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${paddingLeft}" y1="${vToY(maxVal)}" x2="${paddingLeft}" y2="${height - paddingBottom}" />`;
        svg += `<line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" />`;
        
        for (let d = minDay; d <= maxDay; d += 7) {
            const tx = iToX(d);
            if (tx >= paddingLeft && tx <= width - paddingRight) {
                svg += `<line x1="${tx}" y1="${height - paddingBottom}" x2="${tx}" y2="${height - paddingBottom + 5}" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1" />`;
            }
        }
        svg += `</g>`;

        const sysAvgY = vToY(galacticAvg);
        const localAvgY = vToY(localAvg);
        
        svg += `<line x1="${paddingLeft}" y1="${sysAvgY}" x2="${width - paddingRight}" y2="${sysAvgY}" class="svg-line-sys-avg" style="stroke: #ffffff !important;" />`;
        svg += `<line x1="${paddingLeft}" y1="${localAvgY}" x2="${width - paddingRight}" y2="${localAvgY}" class="svg-line-local-avg" style="stroke: #fbbf24 !important;" stroke-dasharray="4,4" />`;

        let historyPath = '';
        let projectPath = '';
        let isFirstHistory = true;
        let isFirstProject = true;
        let currentPricePoint = { price: curveData[curveData.length - 1].price };

        curveData.forEach((point) => {
            let y = vToY(point.price);
            
            if (point.isLocked) {
                y += (Math.random() * 2 - 1) * 2; 
            }
            
            const x = iToX(point.day);
            
            if (point.day <= currentDay) {
                const cmd = isFirstHistory ? 'M' : 'L';
                historyPath += `${cmd}${x},${y} `;
                isFirstHistory = false;
            }
            if (point.day >= currentDay) {
                const pCmd = isFirstProject ? 'M' : 'L';
                projectPath += `${pCmd}${x},${y} `;
                isFirstProject = false;
            }

            if (point.day === currentDay) {
                currentPricePoint = point;
            }
        });

        svg += `<path d="${historyPath.trim()}" class="svg-line-history" fill="none" />`;
        if (projectPath.length > 0) {
            svg += `<path d="${projectPath.trim()}" class="svg-line-project" fill="none" />`;
        }

        const graphBottomY = height - paddingBottom;
        svg += `<text x="${paddingLeft}" y="${graphBottomY + 16}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="start">-90</text>`;
        
        const currX = iToX(currentDay);
        svg += `<text x="${currX}" y="${paddingTop - 12}" fill="#ffffff" font-size="12" font-family="Roboto Mono" text-anchor="middle">PRESENT</text>`;
        svg += `<polygon points="${currX - 4},${paddingTop - 8} ${currX + 4},${paddingTop - 8} ${currX},${paddingTop - 1}" fill="#ffffff" />`;
        
        svg += `<text x="${width - paddingRight}" y="${graphBottomY + 16}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">+45</text>`;

        const graphCenterX = paddingLeft + ((width - paddingLeft - paddingRight) / 2);
        svg += `<text x="${graphCenterX}" y="${graphBottomY + 34}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="middle">TIME</text>`;

        const currY = vToY(currentPricePoint.price);
        svg += `<text x="${currX - 6}" y="${currY - 6}" fill="#ffffff" font-size="12" font-family="Roboto Mono" text-anchor="end">${formatCredits(currentPricePoint.price, false)}</text>`;

        svg += `<text x="${paddingLeft - 6}" y="${paddingTop - 12}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">PRICE</text>`;
        svg += `<text x="${paddingLeft - 6}" y="${vToY(minVal) + 4}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${paddingLeft - 6}" y="${vToY(midVal) + 4}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">${formatCredits(midVal, false)}</text>`;
        svg += `<text x="${paddingLeft - 6}" y="${vToY(maxVal) + 4}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;

        const legendY1 = height - 35;
        const legendY2 = height - 15;
        
        svg += `<line x1="${paddingLeft}" y1="${legendY1 - 4}" x2="${paddingLeft + 12}" y2="${legendY1 - 4}" class="svg-line-history" />`;
        svg += `<text x="${paddingLeft + 18}" y="${legendY1}" fill="#9ca3af" font-size="12" font-family="Roboto Mono">History</text>`;
        
        svg += `<line x1="${paddingLeft + 85}" y1="${legendY1 - 4}" x2="${paddingLeft + 97}" y2="${legendY1 - 4}" class="svg-line-project" />`;
        svg += `<text x="${paddingLeft + 103}" y="${legendY1}" fill="#9ca3af" font-size="12" font-family="Roboto Mono">Project</text>`;
        
        svg += `<line x1="${paddingLeft + 175}" y1="${legendY1 - 4}" x2="${paddingLeft + 187}" y2="${legendY1 - 4}" class="svg-line-local-avg" style="stroke: #fbbf24 !important;" stroke-dasharray="4,4" />`;
        svg += `<text x="${paddingLeft + 193}" y="${legendY1}" fill="#9ca3af" font-size="12" font-family="Roboto Mono">Local MKT</text>`;

        svg += `<line x1="${paddingLeft}" y1="${legendY2 - 4}" x2="${paddingLeft + 12}" y2="${legendY2 - 4}" class="svg-line-sys-avg" style="stroke: #ffffff !important;" stroke-dasharray="4,4" />`;
        svg += `<text x="${paddingLeft + 18}" y="${legendY2}" fill="#9ca3af" font-size="12" font-family="Roboto Mono">Sys Avg</text>`;

        svg += `<rect x="${paddingLeft + 85}" y="${legendY2 - 10}" width="10" height="10" fill="rgba(0, 255, 0, 0.35)" />`;
        svg += `<rect x="${paddingLeft + 95}" y="${legendY2 - 10}" width="10" height="10" fill="rgba(255, 0, 0, 0.35)" />`;
        svg += `<text x="${paddingLeft + 110}" y="${legendY2}" fill="#9ca3af" font-size="12" font-family="Roboto Mono">Economy</text>`;

        svg += `</svg></div>`;
        return svg;
    }

    /**
     * Generates the SVG string for the Finance/Credits graph.
     */
    renderFinanceGraph(gameState) {
        const history = gameState.player.creditHistory || [];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">No Financial Data Available</div>`;

        const width = 300, height = 140, paddingLeft = 45, paddingRight = 20;
        const values = history.map(h => h.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

        const iToX = i => (i / (history.length - 1)) * (width - paddingLeft - paddingRight) + paddingLeft;
        const vToY = v => height - paddingLeft - ((v - minVal) / valueRange) * (height - paddingLeft * 1.5); 

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        
        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${paddingLeft}" y1="${vToY(maxVal)}" x2="${paddingLeft}" y2="${height - paddingLeft}" />`;
        svg += `<line x1="${paddingLeft}" y1="${height - paddingLeft}" x2="${width - paddingRight}" y2="${height - paddingLeft}" />`;
        svg += `</g>`;

        const points = history.map((h, i) => `${iToX(i)},${vToY(h.value)}`).join(' ');
        svg += `<polyline fill="none" stroke="#10b981" stroke-width="2" points="${points}" />`; 

        const firstDay = history[0].day;
        const lastDay = history[history.length - 1].day;
        svg += `<text x="${paddingLeft}" y="${height - paddingLeft + 15}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="start">Day ${firstDay}</text>`;
        svg += `<text x="${width - paddingRight}" y="${height - paddingLeft + 15}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">Day ${lastDay}</text>`;
        
        svg += `<text x="${paddingLeft - 8}" y="${vToY(minVal) + 4}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${paddingLeft - 8}" y="${vToY(maxVal) + 4}" fill="#9ca3af" font-size="12" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;
        
        svg += `</svg>`;
        return svg;
    }
}