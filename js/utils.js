// js/utils.js
/**
 * @fileoverview This file contains globally accessible utility functions for various tasks
 * such as formatting numbers, calculating inventory usage, and handling date conversions.
 * These helpers are used throughout the application to standardize common operations.
 */
import { DATE_CONFIG } from './data/database.js';

/**
 * A centralized map for commodity visual styles.
 * @type {Object.<string, {hex: string, gradient: string}>}
 */
const commodityStyleMap = {
    'item-style-1':  { hex: '#60a5fa', gradient: 'linear-gradient(45deg, #3b82f6, #1e3a8a)' },
    'item-style-2':  { hex: '#a3a3a3', gradient: 'linear-gradient(45deg, #737373, #262626)' },
    'item-style-3':  { hex: '#22c55e', gradient: 'linear-gradient(45deg, #16a34a, #14532d)' },
    // CHANGED: Cybernetics - Brightened to Light Zinc for readability on dark backgrounds
    'item-style-4':  { hex: '#a1a1aa', gradient: 'linear-gradient(45deg, #a1a1aa, #52525b)' },
    'item-style-5':  { hex: '#c084fc', gradient: 'linear-gradient(45deg, #a855f7, #6b21a8)' },
    // CHANGED: Neural Processors - Brightened to Electric Indigo for contrast
    'item-style-6':  { hex: '#818cf8', gradient: 'linear-gradient(45deg, #6366f1, #4338ca)' },
    // CHANGED: Graphene Lattices - Brightened to Steel Grey/Slate 300
    'item-style-7':  { hex: '#cbd5e1', gradient: 'linear-gradient(45deg, #94a3b8, #475569)' }, 
    // CHANGED: Cryo-Sleep Pods - Brightened to Neon Cyan for contrast
    'item-style-8':  { hex: '#22d3ee', gradient: 'linear-gradient(45deg, #06b6d4, #155e75)' },
    // CHANGED: Atmo Processors - Brightened to Bright Amber/Bronze
    'item-style-9':  { hex: '#f59e0b', gradient: 'linear-gradient(45deg, #d97706, #b45309)' },
    'item-style-10': { hex: '#fb7185', gradient: 'linear-gradient(45deg, #f43f5e, #9f1239)' },
    'item-style-11': { hex: '#a78bfa', gradient: 'linear-gradient(165deg, #a78bfa, #312e81, #1e3a8a)' },
    'item-style-12': { hex: '#f87171', gradient: 'linear-gradient(45deg, #ef4444, #7f1d1d)' },
    'item-style-13': { hex: '#d8b4fe', gradient: 'linear-gradient(45deg, #a855f7, #3b0764)' },
    'item-style-14': { hex: '#f472b6', gradient: 'linear-gradient(45deg, #ec4899, #831843)' },
};

/**
 * Retrieves the style object for a given commodity style class.
 * @param {string} styleClass - The style class of the commodity.
 * @returns {{hex: string, gradient: string}} The style object.
 */
export function getCommodityStyle(styleClass) {
    return commodityStyleMap[styleClass] || { hex: '#a8a29e', gradient: 'linear-gradient(45deg, #52525b, #18181b)' };
}

/**
 * Formats a number into a compact, human-readable credit string with appropriate suffixes (k, M, B, T).
 * This function now correctly handles negative values.
 * Example: -12345 becomes '⌬ -12.3k'.
 * @param {number} amount The numeric value to format.
 * @param {boolean} [withSymbol=true] - Whether to prepend the '⌬ ' symbol.
 * @returns {string} The formatted credit string.
 */
export function formatCredits(amount, withSymbol = true) {
    const isNegative = amount < 0;
    const num = Math.abs(Math.floor(amount));
    // --- VIRTUAL WORKBENCH: REVERTED TO STANDARD SPACE ---
    const prefix = withSymbol ? '⌬ ' : '';
    // --- END VIRTUAL WORKBENCH ---
    const sign = isNegative ? '-' : '';

    let formattedNumber;
    // --- VIRTUAL WORKBENCH START: Phase 1 (Universal Abbreviation) ---
    if (num >= 1e18) { // Numbers >= 1 Quintillion
        formattedNumber = `${(num).toExponential(1)}`;
    } else if (num >= 1e15) { // Numbers >= 1 Quadrillion
        formattedNumber = `${parseFloat((num / 1e15).toFixed(2)).toString()}Q`;
    } else if (num >= 1e12) {
        formattedNumber = `${parseFloat((num / 1e12).toFixed(2)).toString()}T`;
    } else if (num >= 1e9) {
        formattedNumber = `${parseFloat((num / 1e9).toFixed(2)).toString()}B`;
    } else if (num >= 1e6) {
        formattedNumber = `${parseFloat((num / 1e6).toFixed(2)).toString()}M`;
    } else if (num >= 1e3) {
        formattedNumber = `${parseFloat((num / 1e3).toFixed(1)).toString()}k`;
    } else {
        formattedNumber = num.toLocaleString();
    }
    // --- VIRTUAL WORKBENCH END: Phase 1 (Universal Abbreviation) ---

    return `${prefix}${sign}${formattedNumber}`;
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
    const year = DATE_CONFIG.START_YEAR + Math.floor((dayNumber - 1) / 365);
    let dayOfYear = (dayNumber - 1) % 365;
    const dayOfWeek = DATE_CONFIG.DAY_NAMES[(dayNumber - 1 + DATE_CONFIG.START_DAY_OF_WEEK) % 7];
    let monthIndex = 0;
    for (let i = 0; i < DATE_CONFIG.DAYS_IN_MONTH.length; i++) {
        if (dayOfYear < DATE_CONFIG.DAYS_IN_MONTH[i]) {
            monthIndex = i;
            break;
        }
        dayOfYear -= DATE_CONFIG.DAYS_IN_MONTH[i];
    }
    const dayOfMonth = dayOfYear + 1;
    const monthName = DATE_CONFIG.MONTH_NAMES[monthIndex];
    return `${dayOfWeek}, ${monthName} ${dayOfMonth}${getDaySuffix(dayOfMonth)}, ${year}`;
}

/**
 * Converts an absolute day number into a short date string (DD/MM/YYYY).
 * @param {number} dayNumber - The absolute day number.
 * @returns {string} The formatted date string (e.g., "01/01/2140").
 */
export function formatGameDateShort(dayNumber) {
    const year = DATE_CONFIG.START_YEAR + Math.floor((dayNumber - 1) / 365);
    let dayOfYear = (dayNumber - 1) % 365;
    
    let monthIndex = 0;
    for (let i = 0; i < DATE_CONFIG.DAYS_IN_MONTH.length; i++) {
        if (dayOfYear < DATE_CONFIG.DAYS_IN_MONTH[i]) {
            monthIndex = i;
            break;
        }
        dayOfYear -= DATE_CONFIG.DAYS_IN_MONTH[i];
    }
    
    const day = dayOfYear + 1;
    const month = monthIndex + 1;
    
    // Pad with leading zeros
    const dStr = day.toString().padStart(2, '0');
    const mStr = month.toString().padStart(2, '0');
    
    return `${dStr}/${mStr}/${year}`;
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

/**
 * Generates the HTML for the MKT and P/L indicators on a market card.
 * This centralized function ensures consistent and accurate indicator rendering.
 * @param {object} data - An object containing all necessary data for rendering.
 * @param {number} data.price - The current market buy price.
 * @param {number} data.sellPrice - The effective sell price (after diminishing returns).
 * @param {number} data.galacticAvg - The galactic average price for the commodity.
 * @param {object} data.playerItem - The player's inventory data for this commodity (can be null).
 * @returns {string} The HTML string for the indicator pills.
 */
export function renderIndicatorPills({ price, sellPrice, galacticAvg, playerItem }) {
    // Market vs Galactic Average Indicator (MKT)
    const marketDiff = price - galacticAvg;
    const marketPct = galacticAvg > 0 ? Math.round((marketDiff / galacticAvg) * 100) : 0;
    const marketSign = marketPct >= 0 ? '+' : '';
    let marketClass = 'neutral';
    if (marketPct > 5) marketClass = 'positive';
    if (marketPct < -5) marketClass = 'negative';
    const marketIcon = marketPct > 5 ? '▲' : (marketPct < -5 ? '▼' : '●');
    const marketIndicatorHtml = `<div class="indicator-pill ${marketClass}">${marketIcon} MKT: ${marketSign}${marketPct}%</div>`;

    let plIndicatorHtml = '';
    
    // Profit/Loss Indicator (P/L)
    if (playerItem && playerItem.avgCost > 0) {
        const spreadPerUnit = sellPrice - playerItem.avgCost;
        
        if (Math.abs(spreadPerUnit) > 0.01) {
            const plPct = playerItem.avgCost > 0 ? Math.round((spreadPerUnit / playerItem.avgCost) * 100) : 0;
            const plSign = plPct >= 0 ? '+' : '';
            const plClass = spreadPerUnit >= 0 ? 'positive' : 'negative';
            const plIcon = spreadPerUnit >= 0 ? '▲' : '▼';
            plIndicatorHtml = `<div class="indicator-pill ${plClass}"> P/L: ${plSign}${plPct}%</div>`;
        }
    }

    return `${marketIndicatorHtml}${plIndicatorHtml}`;
}