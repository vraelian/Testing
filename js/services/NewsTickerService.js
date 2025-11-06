// js/services/NewsTickerService.js
/**
 * @fileoverview Manages the state and content of the news ticker.
 * It maintains a queue of messages and serves them to the UIManager.
 * Implements V2 logic: dynamic queue, message types, and live content.
 */

// NEW: Import new data files
import { FLAVOR_ADS } from '../data/flavorAds.js';
import { FREE_INTEL_MESSAGES, PURCHASED_INTEL_MESSAGES } from '../data/intelMessages.js';
// CORRECTED IMPORT: Import the DB constant, not a function
import { DB } from '../data/database.js';

const MAX_MESSAGES = 15; // Max number of messages in the rotation

// NEW: Map location IDs to their CSS theme color variables
// These variables are assumed to exist in global.css or similar
const locationColorMap = {
    "loc_venus": "var(--color-theme-venus)",
    "loc_earth": "var(--color-theme-earth)",
    "loc_luna": "var(--color-theme-luna)",
    "loc_mars": "var(--color-theme-mars)",
    "loc_belt": "var(--color-theme-belt)",
    "loc_exchange": "var(--color-theme-exchange)",
    "loc_jupiter": "var(--color-theme-jupiter)",
    "loc_saturn": "var(--color-theme-saturn)",
    "loc_uranus": "var(--color-theme-uranus)",
    "loc_neptune": "var(--color-theme-neptune)",
    "loc_kepler": "var(--color-theme-kepler)",
    "loc_pluto": "var(--color-theme-pluto)"
};

export class NewsTickerService {
    /**
     * @param {import('./GameState.js').GameState} gameState 
     */
    constructor(gameState) {
        this.gameState = gameState;
        /** @type {import('./SimulationService.js').SimulationService | null} */
        this.simulationService = null;
        /** @type {import('./simulation/MarketService.js').MarketService | null} */
        this.marketService = null;

        /** @type {Array<Object>} */
        this.messageQueue = [];
        this.isDirty = true;
        this.welcomeMessagePlayed = false;
    }

    /**
     * Injects services needed for dynamic content generation.
     * Called by SimulationService constructor.
     * @param {import('./SimulationService.js').SimulationService} simulationService
     * @param {import('./simulation/MarketService.js').MarketService} marketService
     */
    setServices(simulationService, marketService) {
        this.simulationService = simulationService;
        this.marketService = marketService;
    }

    /**
     * Public method for other services (like SimService) to add a dynamic message.
     * Used for ALERT, STORY, and non-startup SYSTEM messages.
     * @param {string} text - The message content.
     * @param {string} type - 'SYSTEM', 'INTEL', 'FLAVOR', 'ALERT', 'STORY'
     * @param {boolean} [isPriority=false] - If true, prepends to the front.
     * @param {boolean} [requiresLiveData=false] - If true, text will be auto-generated live.
     */
    pushMessage(text, type, isPriority = false, requiresLiveData = false) {
        // De-duplication check, ignoring live data messages (which have no text)
        if (text && this.messageQueue.some(msg => msg.text === text)) {
            return; // Don't add duplicate
        }

        const newMessage = {
            id: Date.now() + Math.random(), // Added ID for future-proofing
            text: text,
            type: type,
            requiresLiveData: requiresLiveData
        };

        if (isPriority) {
            // "Next-Up" insertion logic: Inserts at the front of the queue.
            // Per V2 spec, this should be after the *current* message,
            // but unshift() is the simplest implementation for now.
            this.messageQueue.unshift(newMessage);
        } else {
            this.messageQueue.push(newMessage);
        }

        // Enforce queue limit
        while (this.messageQueue.length > MAX_MESSAGES) {
            this.messageQueue.shift(); // Remove the oldest
        }

        this.isDirty = true;
    }

    /**
     * Called by TimeService each day.
     * The old version added flavor text here. The V2 design moves flavor
     * text to onLocationChange, so this pulse is now empty.
     * Kept for compatibility with TimeService.
     */
    pulse() {
        // No longer used for flavor text as per V2 design.
    }

    /**
     * Called by SimulationService when the player arrives at a new location.
     * Rebuilds the entire default message queue.
     */
    onLocationChange() {
        const state = this.gameState.getState();
        // ---
        // BUG FIX (a): The location ID is at the root of the state, not under `player`.
        // ---
        const newLocationId = state.currentLocationId;

        // Start with a fresh queue
        this.messageQueue = [];

        // 1. Add 'Welcome' message (once per game)
        this.generateWelcomeMessage();

        // 2. Add Free Intel message
        this.generateFreeIntelMessage(newLocationId);

        // 3. Add Flavor Ad #1
        const flavorAds = this.selectLocationFlavorAds(newLocationId);
        if (flavorAds[0]) {
            this.pushMessage(flavorAds[0], 'FLAVOR');
        }

        // 3. Add Purchased Intel (if active)
        this.generatePurchasedIntelMessage();

        // 4. Add Flavor Ad #2
        if (flavorAds[1]) {
            this.pushMessage(flavorAds[1], 'FLAVOR');
        }

        // 5. Add Ship Status message
        // We push an empty object with the live data flag.
        this.pushMessage('', 'STATUS', false, true);

        // Mark as dirty to force UIManager to re-render
        this.isDirty = true;
    }

    /**
     * Gets the formatted HTML string for all current messages.
     * @returns {string} The HTML for the .news-ticker-content element.
     */
    getTickerContentHtml() {
        // MODIFIED: Removed fallback call to onLocationChange()
        // This was causing the ticker to reset when switching tabs.
        if (this.messageQueue.length === 0 && !this.welcomeMessagePlayed) {
            // Initial game load
            this.generateWelcomeMessage();
        }

        const separator = ` <span class="ticker-separator"> // </span> `;
        
        const messageHtml = this.messageQueue.map(msg => {
            let text = msg.text;
            let style = '';

            // Handle STATUS messages
            if (msg.requiresLiveData && msg.type === 'STATUS') {
                text = this.getLiveStatusText();
            }

            // Handle FLAVOR color
            if (msg.type === 'FLAVOR') {
                style = `style="color: ${this.getLocationColor()};"`;
            }

            return `<span class="ticker-message" data-type="${msg.type}" ${style}>${text}</span>`;
        }).join(separator);

        return `<div class="news-ticker-content">${messageHtml}</div>`;
    }

    // --- PRIVATE HELPER METHODS ---

    /**
     * Adds the one-time welcome message to the queue.
     * @private
     */
    generateWelcomeMessage() {
        if (!this.welcomeMessagePlayed) {
            this.pushMessage("Welcome to Orbital Trading", "SYSTEM", true);
            this.welcomeMessagePlayed = true;
        }
    }

    /**
     * Finds and pushes the best free intel for the current location.
     * @param {string} locationId
     * @private
     */
    generateFreeIntelMessage(locationId) {
        if (!this.marketService) return;

        const state = this.gameState.getState();
        const locationPrices = state.market.prices[locationId];
        if (!locationPrices) return;
        
        const commodities = DB.COMMODITIES; // O(N) array of static data
        let bestDeal = { commodityId: null, discount: 0 };

        // --- VIRTUAL WORKBENCH: OPTIMIZED LOOP ---
        // Iterate the static commodity DB (O(N))
        for (const staticData of commodities) {
            // Skip if player can't see this tier
            if (!staticData || !staticData.basePriceRange || staticData.tier > state.player.revealedTier) {
                continue;
            }

            // Get price from the price map (O(1) lookup)
            const price = locationPrices[staticData.id];
            if (price === undefined) {
                continue; // This commodity isn't sold here or has no price
            }

            // Calculate galacticAverage from basePriceRange
            const galacticAverage = (staticData.basePriceRange[0] + staticData.basePriceRange[1]) / 2;
            const discount = (galacticAverage - price) / galacticAverage;

            if (discount > bestDeal.discount) {
                bestDeal = { commodityId: staticData.id, discount };
            }
        }
        // --- END VIRTUAL WORKBENCH ---

        // Check if the best deal meets the 5% threshold
        if (bestDeal.discount >= 0.05) {
            // Get the name *after* the loop
            const commodityName = commodities.find(c => c.id === bestDeal.commodityId).name;
            let tier;

            if (bestDeal.discount > 0.50) tier = 'tier5';
            else if (bestDeal.discount > 0.30) tier = 'tier4';
            else if (bestDeal.discount > 0.20) tier = 'tier3';
            else if (bestDeal.discount > 0.10) tier = 'tier2';
            else tier = 'tier1';

            const messageList = FREE_INTEL_MESSAGES[tier];
            let text = messageList[Math.floor(Math.random() * messageList.length)];
            text = text.replace('{Commodity Name}', commodityName);
            this.pushMessage(text, 'INTEL');

        } else {
            // No significant deals
            this.pushMessage('Market conditions nominal.', 'INTEL');
        }
    }

    /**
     * Checks for active purchased intel and pushes it to the queue.
     * @private
     */
    generatePurchasedIntelMessage() {
        // --- TBD: Placeholder ---
        // This will check GameState for active purchased intel.
        // const { activeIntel } = this.gameState.getState().player;
        // if (activeIntel) {
        //     const { commodityId, locationId, dealType } = activeIntel;
        //     // CORRECTED: Access DB data via .find()
        //     const commodityName = DB.COMMODITIES.find(c => c.id === commodityId).name;
        //     const locationName = DB.MARKETS.find(m => m.id === locationId).name;
        //
        //     let text = PURCHASED_INTEL_MESSAGES[Math.floor(Math.random() * PURCHASED_INTEL_MESSAGES.length)];
        //     text = text.replace('{Commodity Name}', commodityName)
        //                 .replace('{Location Name}', locationName);
        //     this.pushMessage(text, 'INTEL');
        // }
    }

    /**
     * Selects two random, different flavor ads for the current location.
     * @param {string} locationId
     * @returns {Array<string>} An array containing two ad strings.
     * @private
     */
    selectLocationFlavorAds(locationId) {
        const adPool = FLAVOR_ADS[locationId] || FLAVOR_ADS['loc_belt']; // Fallback to belt
        if (adPool.length === 0) return ["", ""];
        if (adPool.length === 1) return [adPool[0], adPool[0]];

        // Shuffle and pick two
        const shuffled = [...adPool].sort(() => 0.5 - Math.random());
        return [shuffled[0], shuffled[1]];
    }

    /**
     * Generates the ship STATUS string from live GameState.
     * @returns {string} The formatted status text.
     * @private
     */
    getLiveStatusText() {
        try {
            const state = this.gameState.getState();
            const activeShipId = state.player.activeShipId;
            if (!activeShipId) return "STATUS: NO ACTIVE SHIP";

            // CORRECTED: Get static data from DB.SHIPS
            const shipData = DB.SHIPS[activeShipId];
            // CORRECTED: Get live data from player.shipStates
            const shipState = state.player.shipStates[activeShipId]; 
            
            if (!shipData || !shipState) return "STATUS: DATA ERROR";

            const fuel = Math.round((shipState.fuel / shipData.maxFuel) * 100);
            const hull = Math.round((shipState.health / shipData.maxHealth) * 100);
            
            // CORRECTED: Get cargo data. cargoUsed is not on shipState, must be calculated.
            let cargoUsed = 0;
            const inventory = state.player.inventories[activeShipId];
            if (inventory) {
                cargoUsed = Object.values(inventory).reduce((sum, item) => sum + item.quantity, 0);
            }
            
            const cargoMax = shipData.cargoCapacity;

            return `${shipData.name}: FUEL: ${fuel}% | CARGO: ${cargoUsed}/${cargoMax} | HULL: ${hull}%`;
        } catch (e) {
            console.error("NewsTickerService Error generating status:", e);
            return "STATUS: ERROR"; // Safeguard
        }
    }

    /**
     * Gets the location-specific theme color CSS variable.
     * @returns {string} The CSS variable string.
     * @private
     */
    getLocationColor() {
        // ---
        // BUG FIX (a): The location ID is at the root of the state, not under `player`.
        // ---
        const locationId = this.gameState.getState().currentLocationId;
        return locationColorMap[locationId] || 'var(--color-text-primary)'; // Fallback
    }
}