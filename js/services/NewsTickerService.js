// js/services/NewsTickerService.js
/**
 * @fileoverview Manages the state, content, and rotation of the news ticker.
 * Implements a dynamic queue system that rebuilds on location change and allows
 * for "next-up" insertions of high-priority messages.
 *
 * (V2 - Comprehensive Rewrite)
 */

// Import new data files
import { FLAVOR_ADS } from '../data/flavorAds.js';
import { FREE_INTEL_MESSAGES, PURCHASED_INTEL_MESSAGES } from '../data/intelMessages.js';
// --- THIS IS THE FIX ---
import { DB } from '../data/database.js'; // Import the main database

/**
 * Maps location IDs to their corresponding CSS theme color variables.
 */
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
        /** * @type {import('./SimulationService.js').SimulationService | null} 
         */
        this.simulationService = null; // Will be injected by main.js
        this.messageQueue = [];
        this.welcomeMessagePlayed = false;
        this.currentLocationId = null;
        this.isDirty = true;
    }

    /**
     * Injects the SimulationService post-instantiation to resolve circular dependency.
     * @param {import('./SimulationService.js').SimulationService} sim
     */
    setSimulationService(sim) {
        this.simulationService = sim;
        
        // Now that we have the simulation, we can build the initial queue
        // which might have been missed if game loaded without a location change.
        if (this.messageQueue.length === 0) {
             const locationId = this.gameState.getState().player.currentLocationId || "loc_earth";
             this.onLocationChange(locationId);
        }
    }

    // --- COMPATIBILITY SHIMS (for old SimulationService) ---

    /**
     * @param {string} text - The message content.
     * @param {string} type - 'SYSTEM', 'INTEL', 'FLAVOR', 'ALERT'
     * @param {boolean} [isPriority=false] - If true, treats as a dynamic insertion.
     */
    pushMessage(text, type, isPriority = false) {
        if (isPriority) {
            // Only 'SYSTEM', 'ALERT', and 'STORY' are supported for dynamic insert
            if (type === 'SYSTEM' || type === 'ALERT' || type ==="STORY") {
                this.pushDynamicMessage(text, type);
            }
        }
        // Non-priority messages are no longer pushed; the queue is
        // built from FLAVOR and INTEL automatically.
    }

    /**
     * Deprecated method, kept for compatibility.
     * Ticker logic is now event-based (onLocationChange), not time-based.
     */
    pulse() {
        // This method is intentionally empty.
        // It's called by the old TimeService, but V2 logic is event-driven.
        return;
    }

    // --- V2 LOGIC METHODS ---

    /**
     * Selects a random item from an array.
     * @param {Array<any>} arr - The array to select from.
     * @returns {*} A random item from the array.
     */
    _selectRandom(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Called by SimulationService when the player arrives at a new location.
     * Rebuilds the entire default rotating queue. (Spec Sec 2.1)
     * @param {string} newLocationId - The ID of the new location.
     */
    onLocationChange(newLocationId) {
        // GUARD: Wait for simulation service to be injected
        if (!this.simulationService) {
            this.isDirty = true; // Try again next frame
            return; 
        }

        this.currentLocationId = newLocationId;
        this.messageQueue = this._buildDefaultQueue(newLocationId);
        
        if (!this.welcomeMessagePlayed) {
            const welcomeMsg = this._generateWelcomeMessage();
            if (welcomeMsg) {
                this.messageQueue.splice(1, 0, welcomeMsg);
                this.welcomeMessagePlayed = true;
            }
        }
        
        this.isDirty = true;
    }

    /**
     * Builds the default rotating message queue for a new location.
     * @param {string} locationId - The current location ID.
     * @returns {Array<Object>} The new default message queue.
     */
    _buildDefaultQueue(locationId) {
        // GUARD:
        if (!this.simulationService) return [];

        const queue = [];

        // 1. INTEL (Free)
        queue.push(this._generateFreeIntelMessage(locationId));

        // 2. & 4. FLAVOR (Ads)
        const flavorMessages = this._generateFlavorMessages(locationId);
        queue.push(flavorMessages.ad1);

        // 3. INTEL (Purchased)
        const purchasedIntel = this._generatePurchasedIntelMessage();
        if (purchasedIntel) {
            queue.push(purchasedIntel);
        }

        // 4. FLAVOR (Ad #2)
        queue.push(flavorMessages.ad2);

        // 5. STATUS
        queue.push(this._generateStatusMessageObject());

        return queue.filter(msg => msg !== null); // Clean out any nulls
    }

    /**
     * Creates the one-time welcome message.
     * @returns {Object|null} A SYSTEM message object or null.
     */
    _generateWelcomeMessage() {
        if (this.welcomeMessagePlayed) {
            return null;
        }
        return {
            text: "Welcome to Orbital Trading",
            type: "SYSTEM",
            isDynamic: true,
            expiration: null,
            requiresLiveData: false
        };
    }

    /**
     * Generates the free intel message for the current location.
     * @param {string} locationId - The current location ID.
     * @returns {Object} An INTEL message object.
     */
    _generateFreeIntelMessage(locationId) {
        // GUARD: This is the function that caused the error.
        if (!this.simulationService) return null; 

        let bestDeal = { margin: 0, commodityId: null, commodityName: null };
        
        // --- THIS IS THE FIX ---
        // Was: this.simulationService.getDatabase().locations
        // Now: DB.LOCATIONS
        const location = DB.LOCATIONS[locationId];
        const market = this.gameState.getState().market;
        // Was: this.simulationService.getDatabase().commodities
        // Now: DB.COMMODITIES
        const commodities = DB.COMMODITIES; // This is an array
        // --- END FIX ---

        if (!location || !market || !commodities) return null; // Extra safety

        location.commodities.forEach(commodityId => {
            const price = market.prices[locationId]?.[commodityId]?.price;
            
            // --- THIS IS THE FIX (for array) ---
            // Find the commodity from the array
            const commodity = commodities.find(c => c.id === commodityId);
            if (!commodity) return;
            // Was: const avg = commodities[commodityId]?.galacticAverage; (Wrong)
            // Now:
            const avg = commodity.galacticAverage;
            // --- END FIX ---
            
            if (price === undefined || avg === undefined) return;

            const margin = avg - price;

            if (margin > bestDeal.margin) {
                bestDeal = { 
                    margin: margin, 
                    price: price,
                    avg: avg,
                    commodityId: commodityId,
                    commodityName: commodity.name // Get name from commodity object
                };
            }
        });

        if (!bestDeal.commodityId || bestDeal.price > (bestDeal.avg * 0.95)) {
            return {
                text: "Market conditions nominal.",
                type: "INTEL",
                isDynamic: false,
                requiresLiveData: false
            };
        }

        const discountPercent = (1 - (bestDeal.price / bestDeal.avg)) * 100;
        let tier;

        if (discountPercent >= 51)      tier = "tier5";
        else if (discountPercent >= 31) tier = "tier4";
        else if (discountPercent >= 21) tier = "tier3";
        else if (discountPercent >= 11) tier = "tier2";
        else                            tier = "tier1";

        const messageTemplate = this._selectRandom(FREE_INTEL_MESSAGES[tier]);
        const text = messageTemplate.replace(/{Commodity Name}|{CommodITY Name}/g, bestDeal.commodityName);

        return {
            text: text,
            type: "INTEL",
            isDynamic: false,
            requiresLiveData: false
        };
    }

    /**
     * Generates two unique flavor ad messages for the current location.
     * @param {string} locationId - The current location ID.
     * @returns {{ad1: Object, ad2: Object}} An object containing two FLAVOR message objects.
     */
    _generateFlavorMessages(locationId) {
        const adsPool = FLAVOR_ADS[locationId] || FLAVOR_ADS["loc_pluto"];
        
        const ad1Text = this._selectRandom(adsPool);
        let ad2Text = this._selectRandom(adsPool);

        if (adsPool.length > 1) {
            while (ad2Text === ad1Text) {
                ad2Text = this._selectRandom(adsPool);
            }
        }

        return {
            ad1: { text: ad1Text, type: "FLAVOR", isDynamic: false, requiresLiveData: false },
            ad2: { text: ad2Text, type: "FLAVOR", isDynamic: false, requiresLiveData: false }
        };
    }

    /**
     * Generates the purchased intel message, if one is active.
     * @returns {Object|null} An INTEL message object or null.
     */
    _generatePurchasedIntelMessage() {
        if (!this.simulationService) return null;

        const purchasedIntel = this.gameState.getState().player.purchasedIntel;
        if (!purchasedIntel || purchasedIntel.expiresDay <= this.gameState.getState().day) {
            return null;
        }

        // --- THIS IS THE FIX ---
        // Was: this.simulationService.getDatabase().commodities[...].name
        const commodityName = DB.COMMODITIES.find(c => c.id === purchasedIntel.commodityId).name;
        // Was: this.simulationService.getDatabase().locations[...].name
        const locationName = DB.LOCATIONS[purchasedIntel.locationId].name;
        // --- END FIX ---

        const messageTemplate = this._selectRandom(PURCHASED_INTEL_MESSAGES);
        const text = messageTemplate
            .replace(/{Commodity Name}|{CommodITY Name}/g, commodityName)
            .replace("{Location Name}", locationName);

        return {
            text: text,
            type: "INTEL",
            isDynamic: false,
            expiration: purchasedIntel.expiresDay,
            requiresLiveData: false
        };
    }

    /**
     * Creates the STATUS message object.
     * @returns {Object} A STATUS message object.
     */
    _generateStatusMessageObject() {
        return {
            text: null, // Will be generated live
            type: "STATUS",
            isDynamic: false,
            requiresLiveData: true
        };
    }

    /**
     * Dynamically generates the text for the STATUS message.
     * @returns {string} The formatted status string.
     */
    _getLiveStatusText() {
        if (!this.simulationService) return "SHIP STATUS UNAVAILABLE";

        const state = this.gameState.getState();
        // --- THIS IS THE FIX ---
        // Was: this.simulationService.getDatabase().ships[...]
        const ship = DB.SHIPS[state.player.shipId];
        // --- END FIX ---
        const shipState = state.player.shipStates[state.player.shipId];

        if (!ship || !shipState) return "ERROR: NO SHIP DATA";

        const shipName = ship.name;
        const fuelPercent = Math.floor((shipState.fuel / ship.fuelCapacity) * 100);
        
        // Use the facade method for getUsedCargo as it's the official way
        const cargoUsed = this.simulationService.getUsedCargo ? this.simulationService.getUsedCargo() : 0;
        const cargoMax = ship.cargoCapacity;
        const hullPercent = Math.floor((shipState.health / ship.hull) * 100);

        return `${shipName}: FUEL: ${fuelPercent}% | CARGO: ${cargoUsed}/${cargoMax} | HULL: ${hullPercent}%`;
    }

    /**
     * Public method for other services to add a high-priority message.
     * @param {string} text - The message content.
     * @param {'SYSTEM' | 'ALERT' | 'STORY'} type - The message type.
     * @param {number|null} [expiresDay=null] - The day the message should expire.
     */
    pushDynamicMessage(text, type, expiresDay = null) {
        if (this.messageQueue.some(msg => msg.text === text && msg.isDynamic)) {
            return;
        }

        const newMessage = {
            id: Date.now() + Math.random(),
            text: text,
            type: type,
            isDynamic: true,
            expiration: expiresDay,
            requiresLiveData: false
        };

        // Insert after the first message (which is usually Free Intel)
        this.messageQueue.splice(1, 0, newMessage);
        this.isDirty = true;
    }

    /**
     * Called by UIManager to check if the ticker content needs to be re-rendered.
     * @returns {boolean}
     */
    isContentDirty() {
        return this.isDirty;
    }

    /**
     * Gets the formatted HTML string for all current messages.
     * @returns {string} The HTML for the .news-ticker-content element.
     */
    getTickerContentHtml() {
        if (!this.simulationService && this.messageQueue.length === 0) {
            return `<div class="news-ticker-content">Initializing simulation...</div>`;
        }

        if (this.messageQueue.length === 0) {
            // Failsafe if queue is still empty
            const locationId = this.gameState.getState().player.currentLocationId || "loc_earth";
            this.onLocationChange(locationId);
            
            if (this.messageQueue.length === 0) {
                 return '<div class="news-ticker-content">No signal...</div>';
            }
        }

        const currentDay = this.gameState.getState().day;
        
        // Clean expired messages (iterating backwards)
        for (let i = this.messageQueue.length - 1; i >= 0; i--) {
            const msg = this.messageQueue[i];
            const hasExpired = msg.expiration && msg.expiration <= currentDay;
            
            if ((msg.isDynamic && hasExpired) || (msg.type === 'INTEL' && hasExpired)) {
                this.messageQueue.splice(i, 1);
                this.isDirty = true; // Queue changed, mark dirty for next render
            }
        }
        
        // Re-check for purchased intel
        const purchasedIntel = this.gameState.getState().player.purchasedIntel;
        const hasPurchasedIntel = this.messageQueue.some(msg => 
            msg.type === 'INTEL' && msg.expiration > currentDay && !msg.isDynamic
        );
        if (purchasedIntel && purchasedIntel.expiresDay > currentDay && !hasPurchasedIntel) {
            const newIntelMsg = this._generatePurchasedIntelMessage();
            if (newIntelMsg) {
                this.messageQueue.splice(2, 0, newIntelMsg); // Insert in slot 3
                this.isDirty = true;
            }
        }

        const separator = ` <span class="ticker-separator"> // </span> `;
        
        const finalHtml = this.messageQueue.map((msg) => {
            let text = "";
            let style = "";
            const typeClass = `type-${msg.type.toLowerCase()}`;

            if (msg.requiresLiveData) {
                text = this._getLiveStatusText();
            } else {
                text = msg.text;
            }

            if (msg.type === "FLAVOR") {
                const color = locationColorMap[this.currentLocationId] || "inherit";
                style = `style="color: ${color};"`;
            }

            // Corrected class attribute formatting
            return `<span class="ticker-message ${typeClass}" ${style}>${text}</span>`;
        
        }).join(separator);
        
        this.isDirty = false; // We have just provided the "clean" content.

        // The UIManager will wrap this in .news-ticker-content
        return finalHtml;
    }
}