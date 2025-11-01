/**
 * @file NewsTickerService.js
 * @description Manages the scrolling news ticker, including message generation,
 * queueing, dynamic insertions, and styling for various message types.
 * This is the V2 implementation.
 */

import { GameState } from './GameState.js';
import { MarketService } from './simulation/MarketService.js';
import { subscribe, publish } from './EventManager.js';
import { formatNumber, getRandomElement, shuffleArray } from '../utils.js';

export class NewsTickerService {
    /**
     * Creates an instance of NewsTickerService.
     */
    constructor() {
        this.tickerBar = document.getElementById('news-ticker-bar');
        this.tickerContent = null; // Will be created
        this.messageQueue = [];
        this.currentMessageIndex = 0;
        this.welcomeMessagePlayed = false;
        this.isCycling = false;

        // For V2 queue logic
        this.locationFlavorMessages = [];
        this.purchasedIntelMessage = null; // Stores the active purchased intel object

        /**
         * Map of location IDs to their corresponding CSS theme color variables.
         * Used for styling FLAVOR messages.
         * @type {Object<string, string>}
         */
        this.locationColorMap = {
            "loc_mercury": "var(--color-theme-mercury)", // Example, if added
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
            "loc_pluto": "var(--color-theme-pluto)",
            "loc_kepler": "var(--color-theme-kepler)"
        };
    }

    /**
     * Initializes the news ticker service.
     * Creates the ticker content element and starts the message cycling.
     */
    init() {
        if (!this.tickerBar) {
            console.error("News ticker bar element not found!");
            return;
        }

        this.tickerContent = document.createElement('div');
        this.tickerContent.className = 'news-ticker-content';
        this.tickerBar.appendChild(this.tickerContent);

        // Stop animation on hover
        this.tickerContent.addEventListener('mouseenter', () => this.pause());
        this.tickerContent.addEventListener('mouseleave', () => this.resume());

        // Rebuild queue on location change
        subscribe('locationChanged', () => this.buildDefaultQueue());
        
        // Build initial queue
        this.buildDefaultQueue();

        // Show welcome message once
        if (!this.welcomeMessagePlayed) {
            this.showWelcomeMessage();
        }
    }

    /**
     * Builds the default rotating message queue for the current location.
     * This is called on location arrival.
     * Queue Order: Free Intel, Flavor #1, Purchased Intel (if active), Flavor #2, Status
     * @private
     */
    buildDefaultQueue() {
        this.stop(); // Stop current cycle
        this.messageQueue = []; // Clear existing queue

        // 1. Generate Free Intel for the current location
        const freeIntelMessage = this.generateFreeIntelMessage();
        this.messageQueue.push(freeIntelMessage);

        // 2. Select two unique flavor messages for this location
        this.locationFlavorMessages = this.selectFlavorMessages();
        if (this.locationFlavorMessages.length > 0) {
            this.messageQueue.push(this.locationFlavorMessages[0]);
        }

        // 3. Add active purchased intel, if it exists
        if (this.purchasedIntelMessage) {
            // TODO: Add expiration logic check here
            this.messageQueue.push(this.purchasedIntelMessage);
        }

        // 4. Add the second flavor message
        if (this.locationFlavorMessages.length > 1) {
            this.messageQueue.push(this.locationFlavorMessages[1]);
        }

        // 5. Add the dynamic Status message
        this.messageQueue.push({
            text: "STATUS_PLACEHOLDER", // Text will be generated live
            type: "STATUS",
            requiresLiveData: true
        });

        this.currentMessageIndex = 0;
        this.start(); // Start cycling the new queue
    }

    /**
     * Generates the free intel message for the current location.
     * Finds the commodity with the best discount > 5%.
     * @returns {object} The intel message object.
     * @private
     */
    generateFreeIntelMessage() {
        const currentLocationId = GameState.player.location;
        const marketData = MarketService.getMarketData(currentLocationId);
        if (!marketData || !marketData.commodities) {
            return { text: "Market data unavailable.", type: "SYSTEM" };
        }

        let bestDeal = { commodity: null, margin: 0, discountPercent: 0 };

        for (const commodityId in marketData.commodities) {
            const item = marketData.commodities[commodityId];
            const average = MarketService.getGalacticAverage(commodityId);
            const margin = average - item.price;
            
            // We only care about favorable margins (discounts)
            if (margin > bestDeal.margin) {
                bestDeal = {
                    commodityId: commodityId,
                    commodityName: MarketService.getCommodityName(commodityId),
                    margin: margin,
                    discountPercent: (1 - item.price / average)
                };
            }
        }

        // Check if the best deal meets the 5% threshold
        if (bestDeal.commodityId && bestDeal.discountPercent >= 0.05) {
            let tier;
            const perc = bestDeal.discountPercent * 100;

            if (perc >= 51) tier = 'tier5';
            else if (perc >= 31) tier = 'tier4';
            else if (perc >= 21) tier = 'tier3';
            else if (perc >= 11) tier = 'tier2';
            else tier = 'tier1'; // 5-10%

            const messageTemplate = getRandomElement(FREE_INTEL_MESSAGES[tier]);
            const text = messageTemplate.replace(/{Commodity Name}/g, bestDeal.commodityName);
            
            return { text: text, type: "INTEL" };
        } else {
            // Tier 0: No significant deals
            return { text: getRandomElement(FREE_INTEL_MESSAGES['tier0']), type: "INTEL" };
        }
    }

    /**
     * Selects two unique flavor messages for the current location.
     * @returns {object[]} An array of two flavor message objects.
     * @private
     */
    selectFlavorMessages() {
        const currentLocationId = GameState.player.location;
        const adsPool = FLAVOR_ADS[currentLocationId];

        if (!adsPool || adsPool.length === 0) {
            return [{ text: "No local broadcasts detected.", type: "FLAVOR" }];
        }

        // Shuffle and pick the first two
        const shuffledAds = shuffleArray([...adsPool]);
        const selectedMessages = [];

        if (shuffledAds.length > 0) {
            selectedMessages.push({
                text: shuffledAds[0],
                type: "FLAVOR"
            });
        }
        
        if (shuffledAds.length > 1) {
             selectedMessages.push({
                text: shuffledAds[1],
                type: "FLAVOR"
            });
        } else if (shuffledAds.length > 0) {
            // If only one ad exists, duplicate it
             selectedMessages.push({
                text: shuffledAds[0],
                type: "FLAVOR"
            });
        }

        return selectedMessages;
    }

    /**
     * Generates the ship status message with live data.
     * @returns {string} The formatted status message.
     * @private
     */
    generateStatusMessage() {
        const ship = GameState.player.ship;
        if (!ship) return "NO SHIP DATA";

        const shipName = ship.shipName || "Vagabond";
        const fuelPercent = Math.round((ship.fuel / ship.fuelCapacity) * 100);
        const cargoUsed = ship.cargo.reduce((acc, item) => acc + item.quantity, 0);
        const cargoMax = ship.cargoMax;
        const hullPercent = Math.round((ship.hull / ship.hullMax) * 100);

        return `${shipName}: FUEL: ${fuelPercent}% | CARGO: ${cargoUsed}/${cargoMax} | HULL: ${hullPercent}%`;
    }

    /**
     * Starts the message cycling.
     */
    start() {
        if (this.isCycling || this.messageQueue.length === 0) return;
        this.isCycling = true;
        this.cycleMessage();
    }

    /**
     * Stops the message cycling.
     */
    stop() {
        this.isCycling = false;
        if (this.tickerContent) {
            this.tickerContent.style.animation = 'none';
        }
    }

    /**
     * Pauses the ticker animation.
     */
    pause() {
        if (this.tickerContent) {
            this.tickerContent.style.animationPlayState = 'paused';
        }
    }

    /**
     * Resumes the ticker animation.
     */
    resume() {
        if (this.tickerContent) {
            this.tickerContent.style.animationPlayState = 'running';
        }
    }

    /**
     * Core logic for cycling to the next message.
     * @private
     */
    cycleMessage() {
        if (!this.isCycling || this.messageQueue.length === 0) {
            this.isCycling = false;
            return;
        }

        // Get the next message
        const message = this.messageQueue[this.currentMessageIndex];
        
        // Display it
        this.displayMessage(message);

        // Calculate animation duration based on text length
        // Aprox 25 chars/sec
        const minDuration = 10; // seconds
        const charCount = this.tickerContent.textContent.length;
        const duration = Math.max(minDuration, charCount / 20); // Adjust '20' to control speed
        
        this.tickerContent.style.animation = 'none'; // Reset animation
        void this.tickerContent.offsetWidth; // Trigger reflow
        this.tickerContent.style.animation = `scroll-ticker ${duration}s linear`;

        // Set timeout to cycle to the next message when this one finishes
        setTimeout(() => {
            if (this.isCycling) {
                // Advance index and loop
                this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messageQueue.length;
                this.cycleMessage();
            }
        }, duration * 1000); // Wait for the animation to complete
    }

    /**
     * Renders a specific message object to the ticker.
     * @param {object} messageObj The message object to display.
     * @private
     */
    displayMessage(messageObj) {
        if (!this.tickerContent) return;

        let text = messageObj.text;
        
        // If message requires live data, generate it now
        if (messageObj.requiresLiveData) {
            text = this.generateStatusMessage();
        }
        
        const type = messageObj.type ? messageObj.type.toLowerCase() : 'default';

        // Build the message span
        const messageSpan = document.createElement('span');
        messageSpan.className = `ticker-message type-${type}`;
        messageSpan.textContent = text;

        // Apply dynamic color for FLAVOR
        if (messageObj.type === "FLAVOR") {
            const locationColor = this.locationColorMap[GameState.player.location] || 'var(--ot-text-primary)';
            messageSpan.style.color = locationColor;
        }

        // Clear previous content and add the new message
        this.tickerContent.innerHTML = ''; // Clear
        this.tickerContent.appendChild(messageSpan);
        
        // Add separator for visual spacing
        const separator = document.createElement('span');
        separator.className = 'ticker-separator';
        separator.textContent = ' // ';
        this.tickerContent.appendChild(separator);
    }

    /**
     * Inserts a high-priority message to play next.
     * Used for SYSTEM, ALERT, and STORY types.
     * @param {string} text The message text.
     * @param {string} type The message type (e.g., "ALERT", "SYSTEM", "STORY").
     * @param {object} [options] Optional parameters.
     * @param {number} [options.duration] How long the message should stay in the queue (in ms).
     */
    addDynamicMessage(text, type, options = {}) {
        const messageObj = {
            text: text,
            type: type.toUpperCase(),
            isDynamic: true,
            expiration: options.duration ? Date.now() + options.duration : null
        };

        // Insert after the currently playing message
        const insertIndex = (this.currentMessageIndex + 1) % this.messageQueue.length;
        this.messageQueue.splice(insertIndex, 0, messageObj);

        // If this is the only message, start the cycle
        if (!this.isCycling && this.messageQueue.length === 1) {
            this.currentMessageIndex = 0;
            this.start();
        }

        // TODO: Add logic to remove expired dynamic messages
    }

    /**
     * Adds a purchased intel message to its standard slot in the queue.
     * This does NOT interrupt the current message.
     * @param {string} commodityId The ID of the commodity.
     * @param {string} locationId The ID of the location.
     */
    addPurchasedIntel(commodityId, locationId) {
        // Find commodity and location names
        const commodityName = MarketService.getCommodityName(commodityId) || "Goods";
        const locationName = MarketService.getLocationName(locationId) || "a station";

        // Select a random message template
        const messageTemplate = getRandomElement(PURCHASED_INTEL_MESSAGES);

        // Format the text
        const text = messageTemplate
            .replace(/{Commodity Name}/g, commodityName)
            .replace(/{Location Name}/g, locationName);

        const messageObj = {
            text: text,
            type: "INTEL",
            isDynamic: false,
            expiration: Date.now() + (1000 * 60 * 60 * 24 * 7) // Example: 7-day expiry
        };

        // Store it as the active purchased intel
        this.purchasedIntelMessage = messageObj;

        // Rebuild the queue to include it
        this.buildDefaultQueue();
    }

    /**
     * Shows the one-time welcome message.
     * @private
     */
    showWelcomeMessage() {
        if (this.welcomeMessagePlayed) return;
        
        this.addDynamicMessage(
            "Welcome to Orbital Trading",
            "SYSTEM"
        );
        this.welcomeMessagePlayed = true;
    }
}