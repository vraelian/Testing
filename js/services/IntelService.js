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
// VIRTUAL WORKBENCH: Added PERK_IDS & LOCATION_IDS import
import { PERK_IDS, LOCATION_IDS } from '../data/constants.js';

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
        // Get the LIVE state object.
        const state = this.gameState.getState();
        const intelMarket = state.intelMarket;

        for (const locationId of Object.keys(intelMarket)) {
            // Filter out (remove) any packets that were NOT purchased
            const purchasedPackets = intelMarket[locationId].filter(packet => packet.isPurchased);
            // Mutate the intelMarket object directly, as per app architecture.
            intelMarket[locationId] = purchasedPackets;
        }

        
        // Iterate through all markets to generate new intel
        for (const location of this.db.MARKETS) {
            const locationId = location.id; // This is the SALE location
            if (!intelMarket[locationId]) {
                 intelMarket[locationId] = [];
            }

            // GDD: Apply randomization to decide if a location gets new intel
            // Using 70% chance as specified in GDD
            if (Math.random() < 0.7) {
                // Get keys already in use by purchased packets at this location
                const existingKeys = intelMarket[locationId].map(p => p.messageKey).filter(Boolean);
                // Track keys used in this specific batch
                const newKeysInBatch = new Set();

                const numPackets = 1 + Math.floor(Math.random() * 3); // 1-3 packets
                for (let i = 0; i < numPackets; i++) {
                    // Combine persistent keys and new-batch keys
                    const unavailableKeys = [...existingKeys, ...newKeysInBatch];
                    // Pass the sale location ID and unavailable keys
                    const newPacket = this._createPacket(locationId, unavailableKeys);

                    if (newPacket) {
                        // Mutate the intelMarket array directly.
                        intelMarket[locationId].push(newPacket);
                        newKeysInBatch.add(newPacket.messageKey);
                    }
                }
            }
        }
        
        // Call setState to trigger a render of the mutated state.
        this.gameState.setState({ intelMarket: intelMarket });
    }

    /**
     * Private helper to create a single intelPacket object.
     * @param {string} saleLocationId - The location where this packet will be SOLD.
     * @param {string[]} unavailableKeys - An array of messageKey strings already in use at this location.
     * @returns {object | null} A new intelPacket object, or null if generation fails.
     * @private
     * @JSDoc
     */
    _createPacket(saleLocationId, unavailableKeys = []) {
        const state = this.gameState.getState();
        
        const revealedTier = state.player.revealedTier;
        const unlockedCommodities = this.db.COMMODITIES
             .filter(c => c.tier <= revealedTier)
            .map(c => c.id);

        if (!unlockedCommodities || unlockedCommodities.length === 0) {
            this.logger.warn('IntelService', 'Cannot create packet: No unlocked commodities available for player\'s tier.');
            return null;
        }

        // Get the locations the player has actually visited and unlocked.
        const playerUnlockedLocations = state.player.unlockedLocationIds || [];
        
        // Ensure the DEAL location is different from the SALE location
        // AND the player has unlocked the DEAL location.
        const allLocationIds = this.db.MARKETS.map(m => m.id);
        const possibleDealLocations = allLocationIds.filter(id => 
            id !== saleLocationId && playerUnlockedLocations.includes(id)
        );
        
        if (possibleDealLocations.length === 0) {
             this.logger.info.system('IntelService', `Cannot create packet: No *unlocked* deal locations available (excluding ${saleLocationId}).`);
             return null;
        }
        const dealLocationId = possibleDealLocations[Math.floor(Math.random() * possibleDealLocations.length)];

        const commodityId = unlockedCommodities[Math.floor(Math.random() * unlockedCommodities.length)];
        const discountPercent = 0.15 + Math.random() * 0.35; // 15% - 50%
        const durationDays = 30 + Math.floor(Math.random() * 61); // 30 - 90 days
        
        const valueMultiplier = 1.0 + (discountPercent * 2) + (durationDays / 90);
        
        // Logic to prevent duplicate message keys
        const messageKeys = Object.keys(INTEL_CONTENT);
        if (messageKeys.length === 0) {
             this.logger.warn('IntelService', 'Cannot create packet: INTEL_CONTENT is empty.');
             return null;
        }
        
        const availableKeys = messageKeys.filter(key => !unavailableKeys.includes(key));
        let messageKey;

        if (availableKeys.length === 0) {
             this.logger.warn('IntelService', `All message keys for ${saleLocationId} are in use. Reusing a key to generate packet.`);
            messageKey = messageKeys[Math.floor(Math.random() * messageKeys.length)];
        } else {
            messageKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        }

        const packet = {
            id: `pkt_${saleLocationId.replace('loc_', '')}_${this.timeService.getCurrentDay()}_${Math.floor(Math.random() * 999)}`,
            locationId: saleLocationId, // (C) Where the packet is SOLD
            dealLocationId: dealLocationId, // (C) Where the DEAL is
            commodityId: commodityId,
            discountPercent: parseFloat(discountPercent.toFixed(2)),
            durationDays: durationDays, // Note: This is now just a base for pricing, not for expiration.
            valueMultiplier: parseFloat(valueMultiplier.toFixed(2)),
            messageKey: messageKey, // Reverted from messageIndex
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
        const state = this.gameState.getState();
        const playerCredits = state.player.credits;
        const currentLocationId = state.currentLocationId;
        
        let base = playerCredits * (0.10 + Math.random() * 0.10); 
        
        // --- VIRTUAL WORKBENCH: VENUS QUIRK (CHEAPER INTEL) ---
        if (currentLocationId === LOCATION_IDS.VENUS) {
            base *= 0.5; // 50% discount at Venus
        }
        // --- END VIRTUAL WORKBENCH ---

        const finalPrice = base * packet.valueMultiplier;
        
        return Math.floor(finalPrice / 100) * 100;
    }

    /**
     * Executes the purchase of an intel packet.
     * @param {string} packetId - The ID of the packet to purchase.
     * @param {string} locationId - The location ID where the purchase is happening (sale location).
     * @param {number} calculatedPrice - The price shown to the user (and to be charged).
     * @returns {object | null} The purchased intelPacket object on success, or null on failure.
     * @JSDoc
     */
    purchaseIntel(packetId, locationId, calculatedPrice) {
        
        // --- VIRTUAL WORKBENCH REFACTOR (ADHERING TO MUTABLE ARCHITECTURE) ---
        
        // 1. Read the *current* state ONCE. This is a shallow copy.
        const state = this.gameState.getState();
        
        // 2. Perform all failure checks on this state.
        if (state.activeIntelDeal !== null) {
            this.logger.warn('IntelService', 'Purchase aborted: A deal is already active.');
            return null; // This is what's failing in debug.
        }

        if (state.player.credits < calculatedPrice) {
            this.logger.warn('IntelService', 'Purchase aborted: Insufficient credits.');
            return null;
        }

        // 3. Get the *live* intelMarket object from the state.
        // We will mutate this object directly, as per the app's architecture.
        const intelMarket = state.intelMarket;

        // 4. Find the *live* packet object.
        const packet = intelMarket[locationId]?.find(p => p.id === packetId);

        if (!packet) {
            this.logger.error('IntelService', `Purchase failed: Could not find packetId ${packetId} in live market at ${locationId}.`);
            return null; // This was the other potential failure point.
        }
        
        // 5. Mutate the live packet object.
        packet.isPurchased = true;
        // --- VIRTUAL WORKBENCH: BUG FIX ---
        // Save the price that was paid to the packet object.
        packet.pricePaid = calculatedPrice;
        // --- END BUG FIX ---

        this.logger.info.player(state.day, 'INTEL_PURCHASE', `Purchased intel packet ${packet.id} for ${formatCredits(calculatedPrice)}`);

        // 6. Create a *new* player object for the state update.
        const newPlayerState = { ...state.player };
        newPlayerState.credits -= calculatedPrice;

        // 7. Create the Active Intel Deal
        const galacticAverage = this.marketService.getGalacticAverage(packet.commodityId);
        const overridePrice = Math.floor(galacticAverage * (1 - packet.discountPercent));

        // Calculate dynamic duration
        const currentLocationId = state.currentLocationId;
        const dealLocationId = packet.dealLocationId;
        let travelTime = this.gameState.TRAVEL_DATA[currentLocationId][dealLocationId].time;

        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelTime = Math.round(travelTime * this.db.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
        }
        
        // --- VIRTUAL WORKBENCH: VENUS QUIRK (LONGER DURATION) ---
        let durationMultiplier = 1.9; // Base multiplier
        if (currentLocationId === LOCATION_IDS.VENUS) {
            durationMultiplier *= 2.0; // Double duration at Venus
        }
        // --- END VIRTUAL WORKBENCH ---

        const newDurationDays = Math.ceil(travelTime * durationMultiplier);
        const expiryDay = this.timeService.getCurrentDay() + newDurationDays;
        
        this.logger.info.system('IntelService', state.day, 'INTEL_DURATION', `Intel deal for ${packet.commodityId} at ${dealLocationId} will last ${newDurationDays} days (Multiplier: ${durationMultiplier}). Expires on Day ${expiryDay}.`);

        // 8. Mutate the live packet object again.
        packet.expiryDay = expiryDay; 

        const newActiveDeal = {
            locationId: packet.dealLocationId, 
            commodityId: packet.commodityId,
            overridePrice: overridePrice,
            expiryDay: expiryDay,
            sourcePacketId: packet.id,
            sourceSaleLocationId: locationId
        };

        // 9. Push message to NewsTicker
        try {
            const commodityName = this.db.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'goods';
            const locationName = this.db.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'a local market';
            let msgTemplate = PURCHASED_INTEL_MESSAGES[Math.floor(Math.random() * PURCHASED_INTEL_MESSAGES.length)];
            let message = msgTemplate.replace('{Commodity Name}', commodityName).replace('{Location Name}', locationName);
            this.newsTickerService.pushMessage(message, 'INTEL', true); 
        } catch (e) {
            this.logger.error('IntelService', 'Failed to push news ticker message.', e);
        }

        // 10. Set the new state *once*.
        // We pass the *mutated* intelMarket and the *new* player/activeDeal.
        this.gameState.setState({ 
            player: newPlayerState,
            activeIntelDeal: newActiveDeal,
            intelMarket: intelMarket // Pass the mutated object to trigger render
        });
        
        // Return the mutated packet
        return packet;
        // --- END REFACTOR ---
    }

    /**
     * Gets the galactic average price for a commodity.
     * @param {string} commodityId - The ID of the commodity.
     * @returns {number} The galactic average price.
     * @JSDoc
     */
    getGalacticAverage(commodityId) {
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

    // --- VIRTUAL WORKBENCH REMOVAL ---
    // The entire 'debug_AddAllIntelPackets' method has been removed.
    // --- END REMOVAL ---
}