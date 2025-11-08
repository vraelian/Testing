// js/services/IntelService.js
/**
 * @fileoverview
 * This service is the "brain" of the Intel system. It manages the lifecycle
 * of intel packets: generation, persistence, dynamic pricing, and the
 * purchase transaction.
 *
 * As part of the Phase 4 refactor, this service is now also responsible
 * for handling the entire modal UI flow for intel, using the ModalService
 * to present offers and details.
 */

import { INTEL_CONTENT } from '../data/intelContent.js';

export class IntelService {
    /**
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./simulation/MarketService.js').MarketService} marketService
     * @param {import('./NewsTickerService.js').NewsTickerService} newsTickerService
     * @param {import('./ui/ModalService.js').ModalService} modalService
     * @param {import('./LoggingService.js').Logger} logger
     * @param {object} DB - The static database.
     */
    constructor(gameState, marketService, newsTickerService, modalService, logger, DB) {
        this.gameState = gameState;
        this.marketService = marketService;
        this.newsTickerService = newsTickerService;
        this.DB = DB;
        
        // --- VIRTUAL WORKBENCH: ADD NEW DEPENDENCIES ---
        /** @type {import('./ui/ModalService.js').ModalService} */
        this.modalService = modalService;
        /** @type {import('./LoggingService.js').Logger} */
        this.logger = logger;
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Called by TimeService daily to refresh intel markets.
     * @param {string} locationId - The location to refresh.
     * @param {number} currentDay - The current game day.
     * @JSDoc
     */
    generateIntelRefresh(locationId, currentDay) {
        const state = this.gameState.getState();
        const existingPackets = state.intelMarket[locationId] || [];

        // 1. Expire old, unpurchased packets
        let packets = existingPackets.filter(p => {
            if (p.isPurchased) return true; // Keep purchased packets (as a record)
            return p.expiryDay > currentDay; // Keep if not expired
        });

        // 2. Generate new packets if the shop is empty
        const unpurchasedCount = packets.filter(p => !p.isPurchased).length;
        if (unpurchasedCount < 3) { // Only generate if fewer than 3 available
            const newPacketsNeeded = 3 - unpurchasedCount;
            for (let i = 0; i < newPacketsNeeded; i++) {
                const newPacket = this._generateIntelPacket(locationId, currentDay);
                if (newPacket) {
                    packets.push(newPacket);
                }
            }
        }

        this.gameState.setIntelMarketForLocation(locationId, packets);
    }

    /**
     * Calculates the dynamic price for an intel packet.
     * @param {object} packet - The intel packet.
     * @returns {number} The calculated price.
     * @JSDoc
     */
    calculateIntelPrice(packet) {
        const state = this.gameState.getState();
        
        // 1. Get base price of the deal
        const commodity = this.DB.COMMODITIES.find(c => c.id === packet.commodityId);
        const avgPrice = (commodity.basePriceRange[0] + commodity.basePriceRange[1]) / 2;
        const dealPrice = avgPrice * (1 - packet.discountPercent);
        
        // 2. Calculate potential profit (simple model: 10 units)
        const potentialProfit = (avgPrice - dealPrice) * 10; // Assume a 10-unit trade
        
        // 3. Get player's current credits (as a wealth metric)
        const playerCredits = state.player.credits;
        
        // 4. Calculate dynamic price
        // Price is a blend of 0.5% of player credits and 10% of potential profit
        const creditFactor = playerCredits * 0.005;
        const profitFactor = potentialProfit * 0.10;
        
        let price = Math.floor(creditFactor + profitFactor);
        
        // 5. Apply caps and floors
        const minPrice = 250;
        const maxPrice = 75000;
        
        price = Math.max(minPrice, price); // Ensure minimum price
        price = Math.min(maxPrice, price); // Ensure maximum price
        price = Math.floor(price / 10) * 10; // Round to nearest 10

        return price;
    }

    /**
     * Executes the purchase of an intel packet.
     * @param {string} packetId - The ID of the packet to buy.
     * @param {string} locationId - The location where the purchase is happening.
     * @param {number} price - The agreed-upon price (from the UI).
     * @returns {object | null} The purchased packet on success, null on failure.
     * @JSDoc
     */
    purchaseIntel(packetId, locationId, price) {
        const state = this.gameState.getState();

        // 1. Check for existing deal ("One-Deal Lock")
        if (state.activeIntelDeal) {
            this.logger.warn('IntelService', `Purchase failed: Player already has an active intel deal.`);
            return null;
        }

        // 2. Find the packet
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) {
            this.logger.error('IntelService', `Purchase failed: Packet ${packetId} not found at ${locationId}.`);
            return null;
        }

        // 3. Check funds
        if (state.player.credits < price) {
            this.logger.warn('IntelService', `Purchase failed: Insufficient credits.`);
            return null;
        }

        // 4. Process transaction
        this.gameState.setState({
            player: {
                ...state.player,
                credits: state.player.credits - price
            },
            // Create the active deal
            activeIntelDeal: {
                packetId: packet.id,
                dealLocationId: packet.dealLocationId,
                commodityId: packet.commodityId,
                discountPercent: packet.discountPercent,
                expiryDay: packet.expiryDay
            },
            // Mark the packet in the market as purchased
            intelMarket: {
                ...state.intelMarket,
                [locationId]: state.intelMarket[locationId].map(p => 
                    p.id === packetId ? { ...p, isPurchased: true } : p
                )
            }
        });

        // 5. Push news ticker message
        const commodityName = this.DB.COMMODITIES.find(c => c.id === packet.commodityId)?.name;
        const locationName = this.DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name;
        this.newsTickerService.pushMessage(
            `DEAL ACTIVE: ${commodityName} at ${locationName}. Expires in ${packet.expiryDay - state.day} days.`,
            'INTEL',
            `deal-${packet.id}`
        );

        this.logger.log('IntelService', `Intel packet ${packetId} purchased successfully.`);
        return packet;
    }

    /**
     * Gets the current day from the game state.
     * @returns {number} The current day.
     * @JSDoc
     */
    getCurrentDay() {
        return this.gameState.getState().day;
    }

    /**
     * Generates a single new intel packet.
     * @param {string} locationId - The location where this packet will be sold.
     * @param {number} currentDay - The current game day.
     * @returns {object | null} A new intel packet object, or null if generation failed.
     * @private
     * @JSDoc
     */
    _generateIntelPacket(locationId, currentDay) {
        const allLocationIds = this.DB.MARKETS.map(m => m.id);
        const allCommodityIds = this.DB.COMMODITIES.map(c => c.id);

        // 1. Pick a random deal location (cannot be the current location)
        let dealLocationId = locationId;
        while (dealLocationId === locationId) {
            dealLocationId = allLocationIds[Math.floor(Math.random() * allLocationIds.length)];
        }

        // 2. Pick a random commodity
        const commodityId = allCommodityIds[Math.floor(Math.random() * allCommodityIds.length)];
        
        // 3. Pick a random discount
        const discountPercent = (Math.floor(Math.random() * 6) + 3) * 0.1; // 30% to 80%
        
        // 4. Pick a message key
        const messageKeys = Object.keys(INTEL_CONTENT);
        const messageKey = messageKeys[Math.floor(Math.random() * messageKeys.length)];
        
        // 5. Set duration
        const duration = Math.floor(Math.random() * 5) + 3; // 3-7 days
        const expiryDay = currentDay + duration;

        return {
            id: `intel_${currentDay}_${Math.random().toString(36).substring(2, 9)}`,
            locationId: locationId, // Where it's sold
            dealLocationId: dealLocationId, // Where the deal is
            commodityId: commodityId,
            discountPercent: discountPercent,
            messageKey: messageKey,
            expiryDay: expiryDay,
            isPurchased: false
        };
    }

    /**
     * Gets the player's credits (for pricing).
     * @param {string} locationId - (Unused) Kept for compatibility.
     * @returns {number} Player's current credits.
     * @private
     * @JSDoc
     */
    _getLocationPlayerCredits(locationId) {
        return this.gameState.getState().player.credits;
    }

    // --- VIRTUAL WORKBENCH: MODAL HANDLERS (Extracted from UIManager) ---

    /**
     * Finds the specified intel packet from the game state.
     * @param {string} packetId 
     * @param {string} locationId - The location *where the player is*.
     * @returns {object | null} The packet object or null if not found.
     * @private
     * @JSDoc
     */
    _findIntelPacket(packetId, locationId) {
        const state = this.gameState.getState();
        // Check current location first
        if (state.intelMarket[locationId]) {
            const packet = state.intelMarket[locationId].find(p => p.id === packetId);
            if (packet) return packet;
        }

        // Fallback: Search all locations (for viewing already-purchased intel)
        for (const locId of Object.keys(state.intelMarket)) {
            const packet = state.intelMarket[locId].find(p => p.id === packetId);
            if (packet) {
                return packet;
            }
        }

        this.logger.error('IntelService', `_findIntelPacket: Could not find packet ${packetId} anywhere.`);
        return null;
    }

    /**
     * Formats an intel "details" string, replacing all placeholders.
     * @param {string} template - The template string from INTEL_CONTENT.
     * @param {object} packet - The intelPacket object.
     * @param {number} price - The calculated price.
     * @returns {string} The formatted, player-facing string.
     * @private
     * @JSDoc
     */
    _formatIntelDetails(template, packet, price) {
        const dealLocationName = this.DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'an unknown location';
        const commodityName = this.DB.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'a mystery commodity';
        const discountStr = `${Math.floor(packet.discountPercent * 100)}%`;
        const priceStr = `${price.toLocaleString()} ⌬`;

        const currentDay = this.getCurrentDay();
        const remainingDays = Math.max(0, (packet.expiryDay || 0) - currentDay);
        
        let durationStr;
        if (remainingDays === 0) {
            durationStr = "less than a day";
        } else if (remainingDays === 1) {
            durationStr = "1 day";
        } else {
            durationStr = `${remainingDays} days`;
        }
        
        let result = template
            .replace(/\[location name\]/g, dealLocationName)
            .replace(/\[commodity name\]/g, commodityName)
            .replace(/\[discount amount %\]/g, discountStr)
            .replace(/\[⌬ credit price\]/g, priceStr);

        // Handle both old ("[durationDays] days") and new ("[durationDays]") placeholders
        result = result.replace(/\[durationDays\]\s*days/g, durationStr);
        result = result.replace(/\[durationDays\]/g, durationStr);
        
        return result;
    }

    /**
     * Shows the "Sample" modal (the offer) for an intel packet.
     * This is called by UIManager's stub.
     * @param {HTMLElement} element - The clicked button element.
     * @JSDoc
     */
    showOfferModal(element) {
        const { packetId, locationId, price } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;
        
        const dealLocationName = this.DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'a distant market';

        // Get the "sample" text from the content file
        const msg = INTEL_CONTENT[packet.messageKey];
        const vagueText = (msg?.sample || "Intel available at [location name].")
            .replace('[location name]', dealLocationName);
        
        const priceNum = parseInt(price, 10);
        const purchaseButtonHTML = `
            <button class="btn btn-intel-buy" 
                    data-action="buy_intel" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${locationId}" 
                    data-price="${priceNum}">
                Purchase Intel (${priceNum.toLocaleString()} ⌬)
            </button>`;

        this.modalService.queueModal('event-modal', 'Intel Offer', vagueText, null, {
            theme: locationId,
            dismissOutside: true,
            footer: purchaseButtonHTML
        });
    }

    /**
     * Handles the "buy_intel" action, calls purchaseIntel, and shows the "Details" modal on success.
     * This is called by UIManager's stub.
     * @param {HTMLElement} element - The clicked "Purchase Intel" button.
     * @JSDoc
     */
    purchaseAndShowDetails(element) {
        const { packetId, locationId, price } = element.dataset;
        const priceNum = parseInt(price, 10);

        // Call the service to perform the transaction
        const purchasedPacket = this.purchaseIntel(packetId, locationId, priceNum);

        if (purchasedPacket) {
            // On success, immediately close "Sample" modal
            this.modalService.hideModal('event-modal'); 
            
            // Re-find the packet from the *new* state
            const updatedPacket = this._findIntelPacket(packetId, locationId);
            if (updatedPacket) {
                // Show the details modal
                this._showIntelDetailsModal(updatedPacket, priceNum, locationId);
            }
            // Note: The UIManager.render() cycle will automatically update the
            // button state on the Intel screen. No manual re-render is needed.
        } else {
            // Purchase failed
            this.modalService.hideModal('event-modal');
            this.modalService.queueModal('event-modal', 'Purchase Failed', 'Unable to purchase intel. You may already have an active deal or insufficient credits.');
        }
    }

    /**
     * Shows the "Details" modal for a purchased packet.
     * This is called by UIManager's stub.
     * @param {HTMLElement} element - The clicked "View Intel" button.
     * @JSDoc
     */
    showDetailsModal(element) {
        const { packetId, locationId } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;

        // Re-calculate price for display (it's not stored on the "View" button)
        const price = this.calculateIntelPrice(packet);
        this._showIntelDetailsModal(packet, price, locationId);
    }

    /**
     * Private helper to show the "Details" modal.
     * @param {object} packet - The intelPacket object.
     * @param {number} price - The price (either from purchase or re-calculated).
     * @param {string} locationId - The locationId for theming.
     * @private
     * @JSDoc
     */
    _showIntelDetailsModal(packet, price, locationId) {
        const detailsTemplate = INTEL_CONTENT[packet.messageKey]?.details || "No details found for this intel packet.";
        const formattedDetails = this._formatIntelDetails(detailsTemplate, packet, price);

        this.modalService.queueModal('event-modal', 'Intel Unlocked', formattedDetails, null, {
            theme: locationId,
            dismissInside: true,
            dismissOutside: true,
            footer: null, // No buttons
            contentClass: 'text-left' // Details are paragraphs
        });
    }
    // --- END VIRTUAL WORKBENCH ---
}