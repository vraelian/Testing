// js/services/bot/BotMemoryService.js
/**
 * @fileoverview This file contains the BotMemoryService class.
 * This service is attached to a specific bot persona and acts as its
 * "memory." It restricts the bot's knowledge to only what it has
 * personally observed, forcing it to operate with incomplete and
 * potentially stale information, just like a human player.
 */

export class BotMemoryService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../LoggingService.js').Logger} logger
     */
    constructor(gameState, logger) {
        this.gameState = gameState;
        this.logger = logger;

        /**
         * Stores the bot's memory of market prices.
         * The key is the locationId, and the value is an object
         * containing the prices and the day they were observed.
         * @type {Object<string, {day: number, prices: Object<string, number>}>}
         *
         * Example:
         * {
         * 'loc_mars': {
         * day: 150,
         * prices: { 'plasteel': 200, 'water_ice': 10 }
         * },
         * 'loc_earth': {
         * day: 120,
         * prices: { 'plasteel': 150, 'water_ice': 30 }
         * }
         * }
         */
        this.marketMemory = {};
    }

    /**
     * Records the current market prices for a given location.
     * This method should be called by a persona *only* when it
     * is physically docked at that location.
     * @param {string} locationId - The location to observe.
     * @param {Object<string, number>} currentPrices - The current prices at that market.
     */
    recordMarketData(locationId, currentPrices) {
        const currentDay = this.gameState.day;
        this.logger.info.system('BotMemory', currentDay, 'MEMORY_REC', `Recording market data for ${locationId}.`);
        
        // Create a deep copy of the prices to prevent pass-by-reference issues
        const pricesCopy = { ...currentPrices };

        this.marketMemory[locationId] = {
            day: currentDay,
            prices: pricesCopy
        };
    }

    /**
     * Retrieves all remembered market data.
     * This is what the "Human" persona will use to find trade routes.
     * @returns {Object<string, {day: number, prices: Object<string, number>}>}
     */
    getRememberedMarketData() {
        return this.marketMemory;
    }

    /**
     * Gets the remembered price for a specific good at a location.
     * @param {string} locationId
     * @param {string} goodId
     * @returns {number | null} The price, or null if not in memory.
     */
    getRememberedPrice(locationId, goodId) {
        if (this.marketMemory[locationId] && this.marketMemory[locationId].prices[goodId]) {
            return this.marketMemory[locationId].prices[goodId];
        }
        return null;
    }

    /**
     * A utility for the persona to check how old its data is for a location.
     * @param {string} locationId
     * @returns {number | null} The number of days since observation, or null.
     */
    getDataStaleness(locationId) {
        if (this.marketMemory[locationId]) {
            return this.gameState.day - this.marketMemory[locationId].day;
        }
        return null;
    }
}