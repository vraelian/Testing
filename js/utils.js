// js/utils.js
/**
 * @fileoverview This file contains globally accessible utility functions for various tasks
 * such as formatting numbers, calculating inventory usage, and handling date conversions.
 * These helpers are used throughout the application to standardize common operations.
 */
import { DB } from './data/database.js';

/**
 * Formats a number into a compact, human-readable credit string with appropriate suffixes (k, M, B, T).
 * Example: 12345 becomes '⌬ 12.3k'.
 * @param {number} amount The numeric value to format.
 * @param {boolean} [withSymbol=true] - Whether to prepend the '⌬ ' symbol.
 * @returns {string} The formatted credit string.
 */
export function formatCredits(amount, withSymbol = true) {
    const num = Math.floor(amount);
    const prefix = withSymbol ? '⌬ ' : '';
    if (num >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${prefix}${(num / 1e3).toFixed(1)}k`;
    return `${prefix}${num.toLocaleString()}`;
}

/**
 * Calculates the total number of cargo units currently used in a given inventory object.
 * @param {object} inventory - The inventory object to calculate, where keys are commodity IDs
 * and values are objects containing a 'quantity' property.
 * @returns {number} The total sum of all item quantities in the inventory.
 */
export function calculateInventoryUsed(inventory) {
     if (!inventory) return 0;
    return Object.values(inventory).reduce((acc, item) => acc + item.quantity, 0);
}

/**
 * Returns the correct ordinal suffix (st, nd, rd, th) for a given day of the month.
 * @param {number} day - The day of the month.
 * @returns {string} The ordinal suffix.
 * @private
 */
function getDaySuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

/**
 * Converts an absolute day number from the start of the game into a formatted date string.
 * Example: 'Monday, January 1st, 2140'.
 * @param {number} dayNumber - The absolute day number of the game.
 * @returns {string} The fully formatted date string.
 */
export function getDateFromDay(dayNumber) {
    const year = DB.DATE_CONFIG.START_YEAR + Math.floor((dayNumber - 1) / 365);
    let dayOfYear = (dayNumber - 1) % 365;
    const dayOfWeek = DB.DATE_CONFIG.DAY_NAMES[(dayNumber - 1 + DB.DATE_CONFIG.START_DAY_OF_WEEK) % 7];
    let monthIndex = 0;
    for (let i = 0; i < DB.DATE_CONFIG.DAYS_IN_MONTH.length; i++) {
        if (dayOfYear < DB.DATE_CONFIG.DAYS_IN_MONTH[i]) {
            monthIndex = i;
            break;
        }
        dayOfYear -= DB.DATE_CONFIG.DAYS_IN_MONTH[i];
    }
    const dayOfMonth = dayOfYear + 1;
    const monthName = DB.DATE_CONFIG.MONTH_NAMES[monthIndex];
    return `${dayOfWeek}, ${monthName} ${dayOfMonth}${getDaySuffix(dayOfMonth)}, ${year}`;
}

/**
 * Generates a random integer between a min and max value, skewed towards the lower end.
 * This is useful for creating distributions where lower values are more common.
 * @param {number} min - The minimum possible value (inclusive).
 * @param {number} max - The maximum possible value (inclusive).
 * @returns {number} The skewed random integer.
 */
export function skewedRandom(min, max) {
    let rand = (Math.random() + Math.random() + Math.random()) / 3; // Average of 3 rolls biases towards the mean (0.5).
    return Math.floor(min + (max - min) * Math.pow(rand, 0.5)); // Squaring the root further biases towards the lower end.
}