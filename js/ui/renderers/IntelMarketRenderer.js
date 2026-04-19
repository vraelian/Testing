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
     * @param {import('../services/IntelService.js').IntelService} intelService
     */
    constructor(intelService) {
        this.intelService = intelService;
        this.db = DB;
        this.currentGameState = null;
    }

    /**
     * Renders the intel packet buttons into the provided container.
     * @param {HTMLElement} containerElement - The div#intel-market-content element.
     * @param {object} gameState - The current raw game state object.
     * @JSDoc
     */
    render(containerElement, gameState) {
        this.currentGameState = gameState;
        const state = gameState;
        const { currentLocationId, activeIntelDeal, intelMarket, missions, player, day } = state;
        
        // --- VIRTUAL WORKBENCH: MODIFICATION (TUTORIAL RESTRICTION) ---
        // If mission_tutorial_03 is active, force the market to be empty
        // to prevent the player from buying intel and leaving the tutorial loop.
        const isTutorial3Active = missions && missions.activeMissionIds && missions.activeMissionIds.includes('mission_tutorial_03');

        if (isTutorial3Active) {
            containerElement.innerHTML = `<p class="text-gray-400 text-center italic p-4">No intel data available at this location.</p>`;
            return;
        }
        // --- END MODIFICATION ---

        // --- VIRTUAL WORKBENCH: REVOKED CLEARANCE CHECK ---
        const activeShipId = player?.activeShipId;
        const activeShipState = activeShipId ? player.shipStates[activeShipId] : null;
        const statusEffects = activeShipState?.statusEffects || [];
        const revokedClearance = statusEffects.find(s => s.id === 'status_revoked_clearance');

        if (revokedClearance) {
            const daysLeft = revokedClearance.expiryDay - day;
            containerElement.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 mt-12 border border-red-900/50 bg-red-900/10 rounded text-center">
                    <h2 class="text-3xl font-bold mb-4 font-orbitron text-white tracking-wider" style="text-shadow: 0 0 15px rgba(239, 68, 68, 1), 0 2px 4px rgba(0,0,0,0.8);">REVOKED CLEARANCE</h2>
                    <p class="text-gray-300 leading-relaxed">Your active ship has been banned from the network. Intel Market access disabled.<br><br>Time remaining: <span class="text-white font-bold">${daysLeft} days</span></p>
                </div>
            `;
            return;
        }
        // --- END REVOKED CLEARANCE CHECK ---

        // 1. Get the *single* active purchased packet, if it exists
        const globalPurchasedPackets = [];
        if (activeIntelDeal) {
            const purchasedPacket = Object.values(intelMarket)
                .flat()
                .find(packet => packet.isPurchased && packet.id === activeIntelDeal.sourcePacketId);
            
            if (purchasedPacket) {
                globalPurchasedPackets.push(purchasedPacket);
            }
        }

        // 2. Get unpurchased packets *only* from the current location
        const localUnpurchasedPackets = (intelMarket[currentLocationId] || [])
            .filter(packet => !packet.isPurchased);

        // 3. Combine lists, with purchased intel always at the top
        const combinedList = [...globalPurchasedPackets, ...localUnpurchasedPackets];

        const isLocked = activeIntelDeal !== null;

        if (combinedList.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-400 text-center italic p-4">No intel data available at this location.</p>`;
            return;
        }

        const html = combinedList.map(packet => {
            if (packet.isPurchased) {
                return this._renderPurchasedButton(packet);
            } else {
                // Price is calculated at render time
                let price = this.intelService.calculateIntelPrice(packet);
                
                // --- SYSTEM STATES V3 HOOKS (Intel Discount) ---
                const systemState = this.currentGameState?.systemState;
                const activeStateDef = systemState && systemState.activeId ? this.db.SYSTEM_STATES[systemState.activeId] : null;
                const isTargetLocation = systemState && systemState.targetLocations?.includes(this.currentGameState?.currentLocationId);

                if (activeStateDef && activeStateDef.modifiers && isTargetLocation && activeStateDef.modifiers.localIntelFree) {
                    price = 0;
                }
                // --- END SYSTEM STATES V3 ---

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
        const dealLocation = this.db.MARKETS.find(m => m.id === packet.dealLocationId);
        const dealLocationName = dealLocation?.name || 'Unknown Location';
        
        // Get theme from the DEAL location
        const theme = dealLocation?.navTheme || {
            gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', // Default gradient
            borderColor: '#7a9ac0', // Default border
            textColor: '#f0f0ff' // Default text
        };

        const style = `
            --theme-gradient: ${theme.gradient};
            --theme-border-color: ${theme.borderColor};
            --theme-text-color: ${theme.textColor};
        `;
        
        return `
            <button class="btn btn-intel btn-intel-purchased" style="${style}" data-action="show_intel_details" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${packet.locationId}"> 
                ${dealLocationName} - View Intel
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
        // Display the DEAL location name, not the SALE location name.
        const dealLocationName = this.db.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'Unknown Location';

        const disabledAttr = isLocked ? 'disabled' : '';
        const title = isLocked ? 'You already have an active intel deal.' : `Purchase intel for a deal at ${dealLocationName}`;
        
        // Conditionally apply pulsing class only if not locked
        const priceHtml = isLocked
            ? formatCredits(price, true) // Plain text (with symbol) for disabled button
            : `<span class="credits-text-pulsing">${formatCredits(price, true)}</span>`; // Pulsing class for active button

        return `
            <button class="btn btn-intel" 
                    data-action="show_intel_offer" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${packet.locationId}" data-price="${price}" 
                    title="${title}"
                    ${disabledAttr}>
                ${dealLocationName} ${priceHtml}
            </button>`;
    }
}