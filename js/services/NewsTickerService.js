// js/services/NewsTickerService.js
/**
 * @fileoverview Manages the state and content of the news ticker.
 * It maintains a queue of messages and serves them to the UIManager.
 */
import { NEWS_FLAVOR } from '../data/news_flavor.js';

const MAX_MESSAGES = 10; // Max number of messages to show at once
const FLAVOR_PULSE_RATE = 10; // Add a new flavor text every 10 days

export class NewsTickerService {
    /**
     * @param {import('./GameState.js').GameState} gameState 
     */
    constructor(gameState) {
        this.gameState = gameState;
        this.messageQueue = [];
        this.lastFlavorDay = 0;
    }

    /**
     * Public method for other services to add a message to the ticker.
     * @param {string} text - The message content.
     * @param {string} type - 'SYSTEM', 'INTEL', 'FLAVOR', 'ALERT'
     * @param {boolean} [isPriority=false] - If true, prepends to the front.
     */
    pushMessage(text, type, isPriority = false) {
        const newMessage = {
            id: Date.now() + Math.random(),
            text: text,
            type: type
        };

        if (isPriority) {
            this.messageQueue.unshift(newMessage);
        } else {
            this.messageQueue.push(newMessage);
        }

        // Enforce queue limit
        while (this.messageQueue.length > MAX_MESSAGES) {
            this.messageQueue.shift(); // Remove the oldest
        }
    }

    /**
     * Called by TimeService each day to pulse flavor text.
     */
    pulse() {
        // Add flavor text periodically
        if (this.gameState.day - this.lastFlavorDay >= FLAVOR_PULSE_RATE) {
            const flavorText = NEWS_FLAVOR[Math.floor(Math.random() * NEWS_FLAVOR.length)];
            this.pushMessage(flavorText, 'FLAVOR');
            this.lastFlavorDay = this.gameState.day;
        }
    }

    /**
     * Gets the formatted HTML string for all current messages.
     * @returns {string} The HTML for the .news-ticker-content element.
     */
    getTickerContentHtml() {
        if (this.messageQueue.length === 0) {
            this.pushMessage("Welcome to Orbital Trading. All systems nominal.", "SYSTEM");
        }

        const separator = ` <span class="ticker-separator"> // </span> `;
        
        const messageHtml = this.messageQueue.map(msg => 
            `<span class="ticker-message" data-type="${msg.type}">${msg.text}</span>`
        ).join(separator);

        // We return the inner content, not the container
        return `<div class="news-ticker-content">${messageHtml}</div>`;
    }
}