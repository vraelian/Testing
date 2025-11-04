// js/services/IntelService.js
/**
 * @fileoverview This file contains the IntelService class, which manages
 * the entire lifecycle of the Local Data Broker system. It handles the
 * procedural generation of intel packets, dynamic pricing, and purchase logic.
 */

import { DB } from '../data/database.js';
import { INTEL_CONTENT } from '../data/intelContent.js';
import { PURCHASED_INTEL_MESSAGES } from '../data/intelMessages.js';
import { formatCredits } from '../utils.js';

/**
 * @class IntelService
 * @description The "brain" of the Intel System. Manages generation,
 * persistence, pricing, and purchase logic for intel packets.
 */
export class IntelService {
    /**
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./world/TimeService.js').TimeService} timeService
     * @param {import('./simulation/MarketService.js').MarketService} marketService
     * @param {import('./NewsTickerService.js').NewsTickerService} newsTickerService
     * @param {import('./LoggingService.js').Logger} logger
     */
    constructor(gameState, timeService, marketService, newsTickerService, logger) {
        this.gameState = gameState;
        this.timeService = timeService;
        this.marketService = marketService;
        this.newsTickerService = newsTickerService;
        this.logger = logger;
        this.db = DB; // For accessing static data
    }

    /**
     * Generates new intel packets for all locations.
     * Triggered by TimeService every 120 game days.
     * This method removes old, unpurchased intel and adds 1-3 new packets.
     * @JSDoc
     */
    generateIntelRefresh() {
        this.logger.info.system('IntelService', this.gameState.day, 'REFRESH', 'Generating intel refresh for all markets.');
        const state = this.gameState.getState();
        const newIntelMarket = { ...state.intelMarket };

        for (const locationId of Object.keys(newIntelMarket)) {
            // Filter out (remove) any packets that were NOT purchased
            const purchasedPackets = newIntelMarket[locationId].filter(packet => packet.isPurchased);
            newIntelMarket[locationId] = purchasedPackets;
        }

        // Iterate through all markets to generate new intel
        for (const location of this.db.MARKETS) {
            const locationId = location.id;
            if (!newIntelMarket[locationId]) {
                newIntelMarket[locationId] = [];
            }

            // GDD: Apply randomization to decide if a location gets new intel
            // Using 70% chance as specified in GDD [cite: 123, 444]
            if (Math.random() < 0.7) {
                const numPackets = 1 + Math.floor(Math.random() * 3); // 1-3 packets [cite: 124, 446]
                for (let i = 0; i < numPackets; i++) {
                    const newPacket = this._createPacket(locationId);
                    if (newPacket) {
                        newIntelMarket[locationId].push(newPacket);
                    }
                }
            }
        }

        this.gameState.updateState({ intelMarket: newIntelMarket });
    }

    /**
     * Private helper to create a single intelPacket object.
     * @param {string} locationId - The location to generate a packet for.
     * @returns {object | null} A new intelPacket object, or null if generation fails.
     * @private
     * @JSDoc
     */
    _createPacket(locationId) {
        const state = this.gameState.getState();
        // GDD: Picks from unlockedCommodities [cite: 127, 452]
        const unlockedCommodities = state.player.unlockedCommodities; 

        if (!unlockedCommodities || unlockedCommodities.length === 0) {
            this.logger.warn('IntelService', 'Cannot create packet: No unlocked commodities available.');
            return null;
        }

        const commodityId = unlockedCommodities[Math.floor(Math.random() * unlockedCommodities.length)];
        const discountPercent = 0.15 + Math.random() * 0.35; // 15% - 50% [cite: 128, 453]
        const durationDays = 30 + Math.floor(Math.random() * 61); // 30 - 90 days [cite: 129, 454]
        
        // GDD: Higher value deal = higher multiplier [cite: 130, 455]
        const valueMultiplier = 1.0 + (discountPercent * 2) + (durationDays / 90);
        
        const messageKeys = Object.keys(INTEL_CONTENT);
        if (messageKeys.length === 0) {
             this.logger.warn('IntelService', 'Cannot create packet: INTEL_CONTENT is empty.');
             return null;
        }
        const messageKey = messageKeys[Math.floor(Math.random() * messageKeys.length)]; // [cite: 131, 456]

        const packet = {
            id: `pkt_${locationId.replace('loc_', '')}_${this.timeService.getCurrentDay()}_${Math.floor(Math.random() * 999)}`,
            locationId: locationId,
            commodityId: commodityId,
            discountPercent: parseFloat(discountPercent.toFixed(2)),
            durationDays: durationDays,
            valueMultiplier: parseFloat(valueMultiplier.toFixed(2)),
            messageKey: messageKey,
            isPurchased: false,
        };

        return packet;
    }

    /**
     * Calculates the dynamic price for an intel packet at render time.
     * Price is 10-20% of player's current credits, scaled by the deal's value.
     * @param {object} packet - The intelPacket object.
     * @returns {number} The calculated price, rounded to the nearest 100.
     * @JSDoc
     */
    calculateIntelPrice(packet) {
        const playerCredits = this.gameState.getState().player.credits;
        
        // GDD: Finds 10-20% of player's wallet [cite: 137, 463]
        const base = playerCredits * (0.10 + Math.random() * 0.10); 
        
        // GDD: Apply value scaling [cite: 138, 464]
        const finalPrice = base * packet.valueMultiplier;
        
        // GDD: Rounds down to the nearest hundredth [cite: 139, 465]
        return Math.floor(finalPrice / 100) * 100;
    }

    /**
     * Executes the purchase of an intel packet.
     * This is the core transaction logic that locks the deal.
     * @param {string} packetId - The ID of the packet to purchase.
     * @param {string} locationId - The location ID where the purchase is happening.
     * @param {number} calculatedPrice - The price shown to the user (and to be charged).
     * @returns {object | null} The purchased intelPacket object on success, or null on failure.
     * @JSDoc
     */
    purchaseIntel(packetId, locationId, calculatedPrice) {
        const state = this.gameState.getState();
        
        // GDD Guard Clause: Aborts if a deal is already active [cite: 143, 470]
        if (state.activeIntelDeal !== null) {
            this.logger.warn('IntelService', 'Purchase aborted: A deal is already active.');
            return null;
        }

        const intelMarket = this.gameState.intelMarket; // Direct reference for mutation
        const packet = intelMarket[locationId]?.find(p => p.id === packetId);

        if (!packet) {
            this.logger.error('IntelService', `Purchase failed: Could not find packetId ${packetId} at ${locationId}.`);
            return null;
        }

        if (state.player.credits < calculatedPrice) {
            this.logger.warn('IntelService', 'Purchase aborted: Insufficient credits.');
            return null;
        }

        // 1. Deduct credits [cite: 145, 472]
        this.gameState.player.credits -= calculatedPrice;
        this.logger.info.player(state.day, 'INTEL_PURCHASE', `Purchased intel packet ${packet.id} for ${formatCredits(calculatedPrice)}`);

        // 2. Set packet as purchased [cite: 146, 473]
        packet.isPurchased = true;

        // 3. Create the Active Intel Deal [cite: 147, 474-476]
        const galacticAverage = this.marketService.getGalacticAverage(packet.commodityId);
        const overridePrice = Math.floor(galacticAverage * (1 - packet.discountPercent));
        const expiryDay = this.timeService.getCurrentDay() + packet.durationDays;

        const newActiveDeal = {
            locationId: packet.locationId,
            commodityId: packet.commodityId,
            overridePrice: overridePrice,
            expiryDay: expiryDay,
            sourcePacketId: packet.id // Track source for reference
        };

        // 4. Push message to NewsTicker [cite: 149, 478]
        try {
            const commodityName = this.db.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'goods';
            const locationName = this.db.MARKETS.find(m => m.id === packet.locationId)?.name || 'a local market';
            let msgTemplate = PURCHASED_INTEL_MESSAGES[Math.floor(Math.random() * PURCHASED_INTEL_MESSAGES.length)];
            let message = msgTemplate.replace('{Commodity Name}', commodityName).replace('{Location Name}', locationName);
            this.newsTickerService.pushMessage(message, 'INTEL', true); // Push as priority
        } catch (e) {
            this.logger.error('IntelService', 'Failed to push news ticker message.', e);
        }

        // 5. Set the active deal in GameState, which locks the market [cite: 148, 477]
        this.gameState.updateState({ 
            activeIntelDeal: newActiveDeal,
            intelMarket: intelMarket // Ensure the mutated intelMarket object is saved
        });
        
        return packet;
    }

    /**
     * Gets the galactic average price for a commodity.
     * @param {string} commodityId - The ID of the commodity.
     * @returns {number} The galactic average price.
     * @JSDoc
     */
    getGalacticAverage(commodityId) {
        // This is a passthrough to the MarketService method
        return this.marketService.getGalacticAverage(commodityId);
    }

    /**
     * Gets the current game day from the TimeService.
     * @returns {number} The current day.
     * @JSDoc
     */
    getCurrentDay() {
        return this.timeService.getCurrentDay();
    }
}