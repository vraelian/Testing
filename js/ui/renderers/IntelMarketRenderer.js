// js/ui/renderers/IntelMarketRenderer.js
/**
 * @fileoverview This file contains the IntelMarketRenderer class.
 * Its sole responsibility is to dynamically render the content for the
 * "Intel Market" tab based on the player's current location and game state.
 */

import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

/**
 * @class IntelMarketRenderer
 * @description Renders the dynamic content of the "Intel Market" tab.
 */
export class IntelMarketRenderer {
    /**
     * @param {import('../services/GameState.js').GameState} gameState
     * @param {import('../services/IntelService.js').IntelService} intelService
     */
    constructor(gameState, intelService) {
        this.gameState = gameState;
        this.intelService = intelService;
        this.db = DB;
    }

    /**
     * Renders the intel packet buttons into the provided container.
     * @param {HTMLElement} containerElement - The div#intel-market-content element.
     * @JSDoc
     */
    render(containerElement) {
        const state = this.gameState.getState();
        const { currentLocationId, activeIntelDeal, intelMarket } = state;
        
        const shopInventory = intelMarket[currentLocationId] || [];
        const isLocked = activeIntelDeal !== null;

        if (shopInventory.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-400 text-center italic p-4">No intel data available at this location.</p>`;
            return;
        }

        const html = shopInventory.map(packet => {
            if (packet.isPurchased) {
                return this._renderPurchasedButton(packet);
            } else {
                // Price is calculated at render time
                const price = this.intelService.calculateIntelPrice(packet);
                return this._renderOfferButton(packet, price, isLocked);
            }
        }).join('');

        containerElement.innerHTML = `<div class="w-full max-w-md mx-auto flex flex-col gap-4">${html}</div>`;
    }

    /**
     * Renders a button for a previously purchased intel packet.
     * @param {object} packet - The intelPacket object.
     * @returns {string} HTML for the "View Intel" button.
     * @private
     * @JSDoc
     */
    _renderPurchasedButton(packet) {
        const locationName = this.db.MARKETS.find(m => m.id === packet.locationId)?.name || 'Unknown';
        return `
            <button class="btn btn-intel" 
                    data-action="show_intel_details" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${packet.locationId}">
                ${locationName} - View Intel
            </button>`;
    }

    /**
     * Renders a button for a purchasable intel packet.
     * @param {object} packet - The intelPacket object.
     * @param {number} price - The dynamically calculated price.
     * @param {boolean} isLocked - Whether the Intel Market is locked by an active deal.
     * @returns {string} HTML for the "Purchase" button.
     * @private
     * @JSDoc
     */
    _renderOfferButton(packet, price, isLocked) {
        const locationName = this.db.MARKETS.find(m => m.id === packet.locationId)?.name || 'Unknown';
        const disabledAttr = isLocked ? 'disabled' : '';
        const title = isLocked ? 'You already have an active intel deal.' : `Purchase intel from ${locationName}`;
        
        return `
            <button class="btn btn-intel" 
                    data-action="show_intel_offer" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${packet.locationId}" 
                    data-price="${price}" 
                    title="${title}"
                    ${disabledAttr}>
                ${locationName} ⌬ ${price.toLocaleString()}
            </button>`;
    }
}