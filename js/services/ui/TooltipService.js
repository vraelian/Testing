// js/services/ui/TooltipService.js
/**
 * @fileoverview
 * This service manages the creation, display, and positioning of all
 * tooltips, including generic text tooltips and complex price graphs.
 * Extracted from UIManager.js as part of the Phase 2 refactor.
 */

import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS } from '../../data/constants.js';

export class TooltipService {
    /**
     * Initializes the TooltipService.
     */
    constructor() {
        /** @type {HTMLElement | null} */
        this.activeGraphAnchor = null;
        /** @type {HTMLElement | null} */
        this.activeGenericTooltipAnchor = null;

        // Cache the tooltip DOM elements
        /** @type {HTMLElement | null} */
        this.graphTooltip = document.getElementById('graph-tooltip');
        /** @type {HTMLElement | null} */
        this.genericTooltip = document.getElementById('generic-tooltip');

        if (!this.graphTooltip || !this.genericTooltip) {
            console.error("TooltipService: Missing graph-tooltip or generic-tooltip in the DOM.");
        }
    }

    /**
     * Shows and renders the price or finance graph tooltip.
     * @param {HTMLElement} anchorEl - The element to anchor the graph to.
     * @param {object} gameState - The current game state.
     * @param {string} action - The action type (e.g., 'show_price_graph').
     */
    showGraph(anchorEl, gameState, action) {
        if (!this.graphTooltip) return;

        this.activeGraphAnchor = anchorEl;

        if (action === ACTION_IDS.SHOW_PRICE_GRAPH) {
            const goodId = anchorEl.dataset.goodId;
            const playerItem = gameState.player.inventories[gameState.player.activeShipId][goodId];
            this.graphTooltip.innerHTML = this._renderPriceGraph(goodId, gameState, playerItem);
        } else if (action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
            this.graphTooltip.innerHTML = this._renderFinanceGraph(gameState);
        }

        this.graphTooltip.style.display = 'block';
        this.updateGraphTooltipPosition();
    }

    /**
     * Hides the graph tooltip.
     */
    hideGraph() {
        if (this.activeGraphAnchor && this.graphTooltip) {
            this.graphTooltip.style.display = 'none';
            this.activeGraphAnchor = null;
        }
    }

    /**
     * Updates the graph tooltip's position relative to its anchor.
     */
    updateGraphTooltipPosition() {
        if (!this.activeGraphAnchor || !this.graphTooltip) return;
        if (this.graphTooltip.style.display === 'none') return;

        // Find the closest item card container to anchor to
        const anchorRect = this.activeGraphAnchor.closest('.item-card-container')?.getBoundingClientRect();
        if (!anchorRect) {
            // Fallback if no container, hide the graph
            this.hideGraph();
            return;
        }

        const tooltipHeight = this.graphTooltip.offsetHeight;
        let topPos = anchorRect.top - tooltipHeight - 10; // 10px spacing
        let leftPos = anchorRect.left;

        // If it goes off-screen top, flip to bottom
        if (topPos < 10) {
            topPos = anchorRect.bottom + 10;
        }

        this.graphTooltip.style.left = `${leftPos}px`;
        this.graphTooltip.style.top = `${topPos}px`;
    }

    /**
     * Renders the SVG for the price history graph.
     * @param {string} goodId - The commodity ID.
     * @param {object} gameState - The current game state.
     * @param {object} playerItem - The player's inventory item.
     * @returns {string} The SVG string.
     * @private
     */
    _renderPriceGraph(goodId, gameState, playerItem) {
        const history = gameState.market.priceHistory[gameState.currentLocationId]?.[goodId];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">No Data Available!</div>`;
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const staticAvg = (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
        const width = 280, height = 140, padding = 35;
        const prices = history.map(p => p.price);
        const playerBuyPrice = playerItem?.avgCost > 0 ? playerItem.avgCost : null;

        let allValues = [...prices, staticAvg];
        if (playerBuyPrice) allValues.push(playerBuyPrice);
        const minVal = Math.min(...allValues), maxVal = Math.max(...allValues);
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

        const getX = i => (i / (history.length - 1)) * (width - padding * 2) + padding;
        const getY = v => height - padding - ((v - minVal) / valueRange) * (height - padding * 2.5);

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${padding}" y1="${getY(maxVal)}" x2="${padding}" y2="${height - padding}" /><line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />`;
        svg += `</g>`;

        const staticAvgY = getY(staticAvg);
        svg += `<line x1="${padding}" y1="${staticAvgY}" x2="${width - padding}" y2="${staticAvgY}" stroke="#facc15" stroke-width="1" stroke-dasharray="3 3" />`;
        svg += `<text x="${width - padding + 4}" y="${staticAvgY + 3}" fill="#facc15" font-size="10" font-family="Roboto Mono" text-anchor="start">Avg: ${formatCredits(staticAvg, false)}</text>`;

        if (playerBuyPrice) {
            const buyPriceY = getY(playerBuyPrice);
            svg += `<line x1="${padding}" y1="${buyPriceY}" x2="${width - padding}" y2="${buyPriceY}" stroke="#34d399" stroke-width="1" stroke-dasharray="3 3" />`;
            svg += `<text x="${width - padding + 4}" y="${buyPriceY + 3}" fill="#34d399" font-size="10" font-family="Roboto Mono" text-anchor="start">Paid: ${formatCredits(playerBuyPrice, false)}</text>`;
        }

        const pricePoints = history.map((p, i) => `${getX(i)},${getY(p.price)}`).join(' ');
        svg += `<polyline fill="none" stroke="#60a5fa" stroke-width="2" points="${pricePoints}" />`;

        const firstDay = history[0].day;
        const lastDay = history[history.length - 1].day;
        svg += `<text x="${padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="start">Day ${firstDay}</text>`;
        svg += `<text x="${width - padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">Day ${lastDay}</text>`;
        svg += `<text x="${padding - 8}" y="${getY(minVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${padding - 8}" y="${getY(maxVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;
        svg += `</svg>`;
        return svg;
    }

    /**
     * Renders the SVG for the finance graph (placeholder).
     * @param {object} gameState - The current game state.
     * @returns {string} The SVG string.
     * @private
     */
    _renderFinanceGraph(gameState) {
        // This function was present in UIManager but unused.
        // Migrating it here preserves the extraction logic.
        return `<div class="text-gray-400 text-sm p-4">Finance Graph Not Implemented.</div>`;
    }


    /**
     * Shows a generic text tooltip.
     * @param {HTMLElement} anchorEl - The element to anchor to.
     * @param {string} content - The text or HTML content for the tooltip.
     */
    showGenericTooltip(anchorEl, content) {
        if (!this.genericTooltip) return;
        this.activeGenericTooltipAnchor = anchorEl;
        this.genericTooltip.innerHTML = content;
        this.genericTooltip.style.display = 'block';
        this.updateGenericTooltipPosition();
    }

    /**
     * Hides the generic tooltip.
     */
    hideGenericTooltip() {
        if (this.activeGenericTooltipAnchor && this.genericTooltip) {
            this.genericTooltip.style.display = 'none';
            this.activeGenericTooltipAnchor = null;
        }
    }

    /**
     * Updates the generic tooltip's position relative to its anchor.
     */
    updateGenericTooltipPosition() {
        if (!this.activeGenericTooltipAnchor || !this.genericTooltip) return;

        const rect = this.activeGenericTooltipAnchor.getBoundingClientRect();
        const tooltipWidth = this.genericTooltip.offsetWidth;
        const tooltipHeight = this.genericTooltip.offsetHeight;
        let leftPos = rect.right + 10;
        let topPos = rect.top + (rect.height / 2) - (tooltipHeight / 2);

        // Basic boundary checks
        if (topPos < 10) {
            topPos = rect.bottom + 10;
        }
        if (leftPos < 10) {
            leftPos = 10;
        }
        if (leftPos + tooltipWidth > window.innerWidth) {
            leftPos = window.innerWidth - tooltipWidth - 10;
        }

        this.genericTooltip.style.left = `${leftPos}px`;
        this.genericTooltip.style.top = `${topPos}px`;
    }
}