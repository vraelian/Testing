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
import { PERK_IDS, LOCATION_IDS } from '../data/constants.js';
import { GameAttributes } from './GameAttributes.js';

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
        this.db = DB; 
        this.uiManager = null; // Injected later by dependency container/facade
    }

    /**
     * Injects the UIManager instance to handle callbacks for modal sequences.
     * @param {object} uiManager 
     * @JSDoc
     */
    setUIManager(uiManager) {
        this.uiManager = uiManager;
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
        const intelMarket = state.intelMarket;

        for (const locationId of Object.keys(intelMarket)) {
            const purchasedPackets = intelMarket[locationId].filter(packet => packet.isPurchased);
            intelMarket[locationId] = purchasedPackets;
        }

        // Iterate through all markets to generate new intel
        for (const location of this.db.MARKETS) {
            const locationId = location.id; // This is the SALE location
            if (!intelMarket[locationId]) {
                 intelMarket[locationId] = [];
            }

            if (Math.random() < 0.7) {
                const existingKeys = intelMarket[locationId].map(p => p.messageKey).filter(Boolean);
                const newKeysInBatch = new Set();

                const baseNum = 1 + Math.floor(Math.random() * 3); // 1-3 packets
                const mult = location.intelProfile?.packetMultiplier || 1;
                const numPackets = Math.floor(baseNum * mult);

                for (let i = 0; i < numPackets; i++) {
                    const unavailableKeys = [...existingKeys, ...newKeysInBatch];
                    const newPacket = this._createPacket(locationId, unavailableKeys);

                    if (newPacket) {
                        intelMarket[locationId].push(newPacket);
                        newKeysInBatch.add(newPacket.messageKey);
                    }
                }
            }
        }
        
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
        const locationDef = this.db.MARKETS.find(m => m.id === saleLocationId);
        const intelProfile = locationDef?.intelProfile || {};

        let unlockedCommodities = this.db.COMMODITIES.filter(c => c.tier <= revealedTier);

        if (!unlockedCommodities || unlockedCommodities.length === 0) {
            this.logger.warn('IntelService', 'Cannot create packet: No unlocked commodities available for player\'s tier.');
            return null;
        }

        // Apply Market Personality Focus Categories
        if (intelProfile.focusCats && intelProfile.focusCats.length > 0) {
            const focused = unlockedCommodities.filter(c => intelProfile.focusCats.includes(c.cat));
            if (focused.length > 0) {
                unlockedCommodities = focused; // Override with focused pool if player has unlocked them
            }
        }

        const unlockedCommodityIds = unlockedCommodities.map(c => c.id);

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

        const commodityId = unlockedCommodityIds[Math.floor(Math.random() * unlockedCommodityIds.length)];
        
        // --- VIRTUAL WORKBENCH: HIGH-VALUE INTEL BASELINE ---
        // Calculate Discount using Intel Profile parameters (clamped to baseline 40-60%)
        const profileMin = intelProfile.minDiscount !== undefined ? intelProfile.minDiscount : 0.40;
        const profileMax = intelProfile.maxDiscount !== undefined ? intelProfile.maxDiscount : 0.60;
        
        const minDiscount = Math.max(0.40, profileMin);
        const maxDiscount = Math.max(0.60, profileMax);
        const discountPercent = minDiscount + Math.random() * (maxDiscount - minDiscount);
        // --- END VIRTUAL WORKBENCH ---

        const durationDays = 30 + Math.floor(Math.random() * 61); // 30 - 90 days
        const durationMod = intelProfile.durationMod !== undefined ? intelProfile.durationMod : 1.0;
        const effectiveDurationDays = durationDays * durationMod;
        
        const valueMultiplier = 1.0 + (discountPercent * 2) + (effectiveDurationDays / 90);
        
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
        const activeShip = state.player.activeShipId;
        
        let base = playerCredits * (0.10 + Math.random() * 0.10); 
        
        // --- VIRTUAL WORKBENCH: VENUS QUIRK ---
        if (currentLocationId === LOCATION_IDS.VENUS) {
            base *= 0.5; // 50% discount at Venus
        }

        // Apply Local Eco Profile Cost Modifier
        const locationDef = this.db.MARKETS.find(m => m.id === currentLocationId);
        if (locationDef?.intelProfile?.costMod) {
             base *= locationDef.intelProfile.costMod;
        }

        let finalPrice = base * packet.valueMultiplier;
        
        // --- PHASE 2: AGE PERK (INTEL COST) ---
        const ageIntelDiscount = state.player.statModifiers?.intelCost || 0;
        if (ageIntelDiscount > 0) {
            finalPrice *= (1 - ageIntelDiscount);
        }

        // --- Z-CLASS LOGIC ---
        // ATTR_WHISPER_NETWORK (The Listener): 50% Discount
        const shipAttributes = GameAttributes.getShipAttributes(activeShip);
        if (shipAttributes.includes('ATTR_WHISPER_NETWORK')) {
            finalPrice *= 0.5;
        }
        // --- END Z-CLASS ---

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
        
        // 1. Read the *current* state ONCE. This is a shallow copy.
        const state = this.gameState.getState();
        
        // 2. Perform all failure checks on this state.
        if (state.activeIntelDeal !== null) {
            this.logger.warn('IntelService', 'Purchase aborted: A deal is already active.');
            return null; 
        }

        if (state.player.credits < calculatedPrice) {
            this.logger.warn('IntelService', 'Purchase aborted: Insufficient credits.');
            return null;
        }

        // 3. Get the *live* intelMarket object from the state.
        const intelMarket = state.intelMarket;

        // 4. Find the *live* packet object.
        const packet = intelMarket[locationId]?.find(p => p.id === packetId);

        if (!packet) {
            this.logger.error('IntelService', `Purchase failed: Could not find packetId ${packetId} in live market at ${locationId}.`);
            return null; 
        }
        
        // 5. Mutate the live packet object.
        packet.isPurchased = true;
        packet.pricePaid = calculatedPrice;

        this.logger.info.player(state.day, 'INTEL_PURCHASE', `Purchased intel packet ${packet.id} for ${formatCredits(calculatedPrice)}`);

        // 6. Create a *new* player object for the state update.
        const newPlayerState = { ...state.player };
        newPlayerState.credits -= calculatedPrice;

        // 7. Create the Active Intel Deal
        const galacticAverage = this.marketService.getGalacticAverage(packet.commodityId);
        const overridePrice = Math.floor(galacticAverage * (1 - packet.discountPercent));

        // Calculate dynamic duration
        const dealLocationId = packet.dealLocationId;
        let travelTime = this.gameState.TRAVEL_DATA[state.currentLocationId][dealLocationId].time;

        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelTime = Math.round(travelTime * this.db.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
        }
        
        // --- VIRTUAL WORKBENCH: VENUS QUIRK ---
        let durationMultiplier = 1.9; // Base multiplier
        if (state.currentLocationId === LOCATION_IDS.VENUS) {
            durationMultiplier *= 2.0; // Double duration at Venus
        }

        // Apply Local Eco Profile Duration Modifier
        const locationDef = this.db.MARKETS.find(m => m.id === state.currentLocationId);
        if (locationDef?.intelProfile?.durationMod) {
             durationMultiplier *= locationDef.intelProfile.durationMod;
        }

        // --- PHASE 2: AGE PERK (INTEL DURATION) ---
        const ageDurationBonus = state.player.statModifiers?.intelDuration || 0;
        if (ageDurationBonus > 0) {
            durationMultiplier *= (1 + ageDurationBonus);
        }

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
        this.gameState.setState({ 
            player: newPlayerState,
            activeIntelDeal: newActiveDeal,
            intelMarket: intelMarket 
        });
        
        return packet;
    }

    /**
     * Grants a specific narrative intel deal, forcibly overriding any existing deal.
     * Bypasses standard credit checks and replaces the activeIntelDeal.
     * @param {object} intelParams - Parameters for the forced deal.
     * @param {string} intelParams.commodityId - The ID of the commodity to discount.
     * @param {string} intelParams.dealLocationId - The location where the deal is active.
     * @param {number} intelParams.discountPercent - The percentage discount (e.g., 0.80 for 80%).
     * @param {number} intelParams.durationDays - How many days the deal should last.
     * @param {string} [intelParams.messageKey] - Optional explicit messageKey to use.
     * @JSDoc
     */
    grantNarrativeIntel(intelParams) {
        const state = this.gameState.getState();
        
        const overridePrice = Math.floor(this.getGalacticAverage(intelParams.commodityId) * (1 - (intelParams.discountPercent || 0.5)));
        const expiryDay = this.timeService.getCurrentDay() + (intelParams.durationDays || 60);

        let msgKey = intelParams.messageKey;
        if (!msgKey) {
             const keys = Object.keys(INTEL_CONTENT).filter(k => k !== 'STORY_HOOK_01');
             msgKey = keys[Math.floor(Math.random() * keys.length)] || 'SUPPLY_CHAIN_SHOCK';
        }

        const newActiveDeal = {
            locationId: intelParams.dealLocationId,
            commodityId: intelParams.commodityId,
            overridePrice: overridePrice,
            expiryDay: expiryDay,
            sourcePacketId: 'narrative_grant',
            sourceSaleLocationId: state.currentLocationId
        };

        const mockPacket = {
            id: 'narrative_grant',
            locationId: state.currentLocationId,
            dealLocationId: intelParams.dealLocationId,
            commodityId: intelParams.commodityId,
            discountPercent: intelParams.discountPercent || 0.5,
            durationDays: intelParams.durationDays || 60,
            messageKey: msgKey, 
            isPurchased: true,
            pricePaid: 0,
            expiryDay: expiryDay
        };

        const intelMarket = { ...state.intelMarket };
        if (!intelMarket[state.currentLocationId]) {
            intelMarket[state.currentLocationId] = [];
        }
        intelMarket[state.currentLocationId] = intelMarket[state.currentLocationId].filter(p => p.id !== 'narrative_grant');
        intelMarket[state.currentLocationId].push(mockPacket);

        this.logger.info.system('IntelService', state.day, 'INTEL_GRANT', `Narrative intel granted for ${intelParams.commodityId} at ${intelParams.dealLocationId}. Overriding current deal.`);

        // Push message to NewsTicker
        try {
            const commodityName = this.db.COMMODITIES.find(c => c.id === intelParams.commodityId)?.name || 'goods';
            const locationName = this.db.MARKETS.find(m => m.id === intelParams.dealLocationId)?.name || 'a local market';
            let msgTemplate = PURCHASED_INTEL_MESSAGES[Math.floor(Math.random() * PURCHASED_INTEL_MESSAGES.length)];
            if (!msgTemplate) msgTemplate = "Secure data link established. {Commodity Name} heavily demanded at {Location Name}.";
            let message = msgTemplate.replace('{Commodity Name}', commodityName).replace('{Location Name}', locationName);
            this.newsTickerService.pushMessage(message, 'INTEL', true); 
        } catch (e) {
            this.logger.error('IntelService', 'Failed to push news ticker message for narrative intel.', e);
        }

        this.gameState.setState({ 
            activeIntelDeal: newActiveDeal,
            intelMarket: intelMarket 
        });
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

    /**
     * Generates a spontaneous Hot Intel deal for the current location.
     * Filters for unlocked commodities and assigns a steep 30-60% discount.
     * @JSDoc
     */
    generateHotIntel() {
        const state = this.gameState.getState();
        const locationId = state.currentLocationId;
        const inventory = state.market.inventory[locationId];
        const revealedTier = state.player.revealedTier;

        // Fetch unlocked commodities
        const unlockedCommodities = this.db.COMMODITIES.filter(c => c.tier <= revealedTier);
        
        // Filter for items that actually have supply in the current location
        const availableUnlockedIds = unlockedCommodities
            .map(c => c.id)
            .filter(id => inventory[id] && inventory[id].quantity > 0);

        if (availableUnlockedIds.length === 0) {
            this.logger.warn('IntelService', 'Cannot generate Hot Intel: No unlocked commodities currently in stock.');
            return;
        }

        // Select a random valid commodity and generate multiplier (0.40 to 0.70 means a 60% to 30% discount)
        const commodityId = availableUnlockedIds[Math.floor(Math.random() * availableUnlockedIds.length)];
        const discountMultiplier = parseFloat((0.40 + Math.random() * 0.30).toFixed(2));

        this.logger.info.system('IntelService', state.day, 'HOT_INTEL', `Generated Hot Intel for ${commodityId} at ${locationId} with multiplier ${discountMultiplier}`);

        this.gameState.setState({
            activeHotIntel: { 
                locationId: locationId, 
                commodityId: commodityId, 
                discountMultiplier: discountMultiplier 
            }
        });
    }

    /**
     * Evaluates trigger conditions (10% chance, 365-day cooldown) upon arrival.
     * Fires the generation logic and sequences the delayed UI modal.
     * @JSDoc
     */
    evaluateHotIntelTrigger() {
        const state = this.gameState.getState();
        
        if (Math.random() <= 0.10 && (state.day - state.lastHotIntelDay >= 365)) {
            // Update cooldown and mutate state
            this.gameState.setState({ lastHotIntelDay: state.day });
            this.generateHotIntel();
            
            // Initiate the 3-second delay sequence for the UI rendering
            setTimeout(() => {
                const currentState = this.gameState.getState();
                
                // Route through the injected UIManager if available, or fallback to global reference
                if (this.uiManager && currentState.activeHotIntel) {
                    this.uiManager.showHotIntelModal(currentState.activeHotIntel);
                } else if (window.game && window.game.uiManager && currentState.activeHotIntel) {
                    window.game.uiManager.showHotIntelModal(currentState.activeHotIntel);
                } else {
                    this.logger.error('IntelService', 'Failed to show Hot Intel Modal: UI Manager not found.');
                }
            }, 3000);
        }
    }
}