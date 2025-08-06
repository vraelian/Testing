// js/utils/utils.js
import { DATE_CONFIG } from '../data/dateConfig.js';

export function formatCredits(amount, showDecimal = true) {
    if (Math.abs(amount) >= 1000000000000) {
        return `⌬${(amount / 1000000000000).toFixed(2)}T`;
    } else if (Math.abs(amount) >= 1000000000) {
        return `⌬${(amount / 1000000000).toFixed(2)}B`;
    } else if (Math.abs(amount) >= 1000000) {
        return `⌬${(amount / 1000000).toFixed(2)}M`;
    } else if (Math.abs(amount) >= 1000) {
        return `⌬${(amount / 1000).toFixed(2)}K`;
    }
    return `⌬${showDecimal ? amount.toFixed(2) : Math.floor(amount).toLocaleString()}`;
}

export function calculateInventoryUsed(inventory) {
    if (!inventory) return 0;
    return Object.values(inventory).reduce((acc, item) => acc + (item.quantity || 0), 0);
}

export function getDateFromDay(day) {
    let year = DATE_CONFIG.START_YEAR;
    let dayOfYear = day - 1;

    while (dayOfYear >= 365) {
        dayOfYear -= 365;
        year++;
    }

    let month = 0;
    while (dayOfYear >= DATE_CONFIG.DAYS_IN_MONTH[month]) {
        dayOfYear -= DATE_CONFIG.DAYS_IN_MONTH[month];
        month++;
    }

    const dayOfMonth = dayOfYear + 1;
    const monthName = DATE_CONFIG.MONTH_NAMES[month];

    return `${monthName} ${dayOfMonth}, ${year}`;
}

export function skewedRandom(min, max) {
    const beta = Math.random();
    const skewed = Math.pow(beta, 2); // Skew towards lower numbers
    return Math.floor(min + (max - min) * skewed);
}