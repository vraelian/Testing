// js/utils.js
/**
 * @fileoverview This file contains globally accessible utility functions for various tasks
 * such as formatting numbers, calculating inventory usage, and handling date conversions.
 * These helpers are used throughout the application to standardize common operations.
 */
import { DATE_CONFIG } from './data/database.js';
import { UNION_ARRAYS } from './data/constants.js';

/**
 * A centralized map for commodity visual styles.
 * @type {Object.<string, {hex: string, gradient: string}>}
 */
const commodityStyleMap = {
    'item-style-1':  { hex: '#60a5fa', gradient: 'linear-gradient(45deg, #3b82f6, #1e3a8a)' },
    'item-style-2':  { hex: '#a3a3a3', gradient: 'linear-gradient(45deg, #737373, #262626)' },
    'item-style-3':  { hex: '#22c55e', gradient: 'linear-gradient(45deg, #16a34a, #14532d)' },
    'item-style-4':  { hex: '#a1a1aa', gradient: 'linear-gradient(45deg, #a1a1aa, #52525b)' },
    'item-style-5':  { hex: '#c084fc', gradient: 'linear-gradient(45deg, #a855f7, #6b21a8)' },
    'item-style-6':  { hex: '#818cf8', gradient: 'linear-gradient(45deg, #6366f1, #4338ca)' },
    'item-style-7':  { hex: '#cbd5e1', gradient: 'linear-gradient(45deg, #94a3b8, #475569)' }, 
    'item-style-8':  { hex: '#22d3ee', gradient: 'linear-gradient(45deg, #06b6d4, #155e75)' },
    'item-style-9':  { hex: '#f59e0b', gradient: 'linear-gradient(45deg, #d97706, #b45309)' },
    'item-style-10': { hex: '#fb7185', gradient: 'linear-gradient(45deg, #f43f5e, #9f1239)' },
    'item-style-11': { hex: '#a78bfa', gradient: 'linear-gradient(165deg, #a78bfa, #312e81, #1e3a8a)' },
    'item-style-12': { hex: '#f87171', gradient: 'linear-gradient(45deg, #ef4444, #7f1d1d)' },
    'item-style-13': { hex: '#d8b4fe', gradient: 'linear-gradient(45deg, #a855f7, #3b0764)' },
    'item-style-14': { hex: '#f472b6', gradient: 'linear-gradient(45deg, #ec4899, #831843)' },
};

/**
 * Retrieves the style object for a given commodity style class.
 */
export function getCommodityStyle(styleClass) {
    return commodityStyleMap[styleClass] || { hex: '#a8a29e', gradient: 'linear-gradient(45deg, #52525b, #18181b)' };
}

/**
 * Formats a number into a compact, human-readable string with appropriate suffixes (k, M, B, T).
 */
export function formatAbbreviatedNumber(amount) {
    const isNegative = amount < 0;
    const num = Math.abs(Math.floor(amount));
    const sign = isNegative ? '-' : '';

    let formattedNumber;
    if (num >= 1e18) {
        formattedNumber = `${(num).toExponential(1)}`;
    } else if (num >= 1e15) {
        formattedNumber = `${parseFloat((num / 1e15).toFixed(2))}Q`;
    } else if (num >= 1e12) {
        formattedNumber = `${parseFloat((num / 1e12).toFixed(2))}T`;
    } else if (num >= 1e9) {
        formattedNumber = `${parseFloat((num / 1e9).toFixed(2))}B`;
    } else if (num >= 1e6) {
        formattedNumber = `${parseFloat((num / 1e6).toFixed(2))}M`;
    } else if (num >= 1e3) {
        formattedNumber = `${parseFloat((num / 1e3).toFixed(1))}k`;
    } else {
        formattedNumber = num.toString();
    }

    return `${sign}${formattedNumber}`;
}

/**
 * Formats a number into a compact, human-readable credit string with appropriate suffixes (k, M, B, T).
 */
export function formatCredits(amount, withSymbol = true) {
    const isNegative = amount < 0;
    const num = Math.abs(Math.floor(amount));
    const prefix = withSymbol ? '⌬ ' : '';
    const sign = isNegative ? '-' : '';

    let formattedNumber;
    if (num >= 1e18) {
        formattedNumber = `${(num).toExponential(1)}`;
    } else if (num >= 1e15) {
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

    return `${prefix}${sign}${formattedNumber}`;
}

/**
 * Calculates the total number of cargo units currently used in a given inventory object.
 */
export function calculateInventoryUsed(inventory) {
     if (!inventory) return 0;
    return Object.values(inventory).reduce((acc, item) => acc + item.quantity, 0);
}

/**
 * Returns the correct ordinal suffix (st, nd, rd, th) for a given day of the month.
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
    
    const dStr = day.toString().padStart(2, '0');
    const mStr = month.toString().padStart(2, '0');
    
    return `${dStr}/${mStr}/${year}`;
}

/**
 * Generates a random integer between a min and max value, skewed towards the lower end.
 */
export function skewedRandom(min, max) {
    let rand = (Math.random() + Math.random() + Math.random()) / 3; 
    return Math.floor(min + (max - min) * Math.pow(rand, 0.5)); 
}

/**
 * Generates the HTML for the MKT and P/L indicators on a market card.
 */
export function renderIndicatorPills({ price, sellPrice, galacticAvg, playerItem }) {
    const marketDiff = price - galacticAvg;
    const marketPct = galacticAvg > 0 ? Math.round((marketDiff / galacticAvg) * 100) : 0;
    const marketSign = marketPct >= 0 ? '+' : '';
    let marketClass = 'neutral';
    if (marketPct > 5) marketClass = 'positive';
    if (marketPct < -5) marketClass = 'negative';
    
    if (marketPct >= 20) marketClass += ' extreme-positive';
    if (marketPct <= -20) marketClass += ' extreme-negative';
    
    const marketIcon = marketPct > 5 ? '▲' : (marketPct < -5 ? '▼' : '●');
    const marketIndicatorHtml = `<div class="indicator-pill ${marketClass}">${marketIcon} MKT: ${marketSign}${marketPct}%</div>`;

    let plIndicatorHtml = '';
    
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

/**
 * Recursively merges a source object into a target object.
 * Arrays are entirely replaced by the source array to prevent orphaned data or indexing bugs,
 * UNLESS the array key is defined in UNION_ARRAYS, in which case it is intelligently merged.
 * Primitives are safely overwritten.
 * @param {Object} target - The base object (usually a fresh default game state).
 * @param {Object} source - The object to merge in (usually the loaded save data payload).
 * @returns {Object} The mutated target object.
 */
export function deepMerge(target, source) {
    if (target === null || typeof target !== 'object') {
        return source;
    }
    if (source === null || typeof source !== 'object') {
        return source;
    }

    if (Array.isArray(source)) {
        return source.slice(); 
    }

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (source[key] === null) {
                target[key] = null;
            } else if (Array.isArray(source[key])) {
                
                // --- PHASE 2: SMART ARRAY UNION ---
                if (Array.isArray(target[key]) && UNION_ARRAYS.includes(key)) {
                    // Create a strict Set union of target (new code defaults) and source (old save)
                    // This prevents players from losing access to newly added base game content.
                    target[key] = [...new Set([...target[key], ...source[key]])];
                } else {
                    // Strict overwrite for structural arrays (e.g. active missions, owned ships)
                    target[key] = source[key].slice(); 
                }

            } else if (typeof source[key] === 'object') {
                if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
                    target[key] = {};
                }
                target[key] = deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
}

/**
 * Recursively strips null, undefined, and empty string values from an object,
 * explicitly preserving deterministic mutators like 0 and false.
 * @param {Object} obj - The object to strip.
 * @returns {Object} The stripped object.
 */
export function safeSchemaStrip(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => safeSchemaStrip(item));
    }

    const stripped = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (val !== null && val !== undefined && val !== "") {
                if (typeof val === 'object') {
                    stripped[key] = safeSchemaStrip(val);
                } else {
                    stripped[key] = val;
                }
            }
        }
    }
    return stripped;
}

/**
 * Hydrates a stripped payload by safely merging it over a default structural template.
 * @param {Object} target - The stripped payload from storage.
 * @param {Object} defaultTemplate - The complete, fresh state schema.
 * @returns {Object} The hydrated object.
 */
export function schemaHydrate(target, defaultTemplate) {
    const clonedTemplate = JSON.parse(JSON.stringify(defaultTemplate));
    return deepMerge(clonedTemplate, target);
}