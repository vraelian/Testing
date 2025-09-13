// js/services/LoggingService.js
/**
 * @fileoverview This file contains the LoggingService, a centralized utility for handling all console output.
 * It supports verbosity levels, color-coded categories, collapsible groups, performance timing,
 * and maintains a buffer of recent logs for generating bug reports. This service is designed to
 * make debugging more efficient and to standardize all logging throughout the application.
 */

// 1. --- CONFIGURATION ---
const LOG_LEVELS = {
    DEBUG: 4, // Most verbose: for fine-grained state changes, variable dumps.
    INFO: 3,  // Default: for key player actions, major system events.
    WARN: 2,   // For potential issues that don't break the game.
    ERROR: 1,  // For critical, game-breaking errors.
    NONE: 0    // Disables all console output.
};

const COLORS = {
    player: '#60a5fa',      // Blue for player actions
    system: '#4ade80',      // Green for automated system processes
    state: '#facc15',       // Yellow for significant game state changes
    warn: '#f59e0b',        // Orange for warnings
    error: '#f87171',       // Red for errors
    group: '#d4d4d8'        // Light gray for group titles
};

const MAX_LOG_HISTORY = 100; // Number of log entries to keep for bug reports.

// 2. --- STATE ---
let currentLogLevel = LOG_LEVELS.INFO; // Default logging level.
const logHistory = []; // In-memory buffer of recent log messages.

// 3. --- CORE LOGIC ---

/**
 * Adds a formatted message to the log history buffer.
 * @param {string} message The plain text message to store.
 * @private
 */
function addToHistory(message) {
    logHistory.push(message);
    if (logHistory.length > MAX_LOG_HISTORY) {
        logHistory.shift();
    }
}

/**
 * The core logging function.
 * @param {number} level The verbosity level of the message.
 * @param {string} service The service or system originating the log.
 * @param {number|string} day The current in-game day or a placeholder.
 * @param {string} action The action being logged.
 * @param {string} details The specific details of the log entry.
 * @param {string} color The CSS color for the log category.
 * @param {object|null} data Optional data object to inspect in the console.
 * @private
 */
function log(level, service, day, action, details, color, data = null) {
    if (level > currentLogLevel) return;

    const formattedMessage = `[${service}] [Day ${day}] ${action}: ${details}`;
    addToHistory(formattedMessage);

    console.log(
        `%c[${service}] %c[Day ${day}] %c${action}: %c${details}`,
        `color: ${color}; font-weight: bold;`,
        'color: #9ca3af;',
        'color: #e5e7eb; font-weight: bold;',
        'color: inherit;',
        data || ''
    );
     if (data) {
        console.dir(data);
    }
}

// 4. --- PUBLIC API ---

/**
 * The exported Logger object provides a clean, namespaced API for all logging.
 */
export const Logger = {
    /**
     * Sets the global verbosity level for the logger.
     * @param {string} levelName - The name of the level (e.g., "DEBUG", "INFO").
     */
    setLevel: (levelName) => {
        const level = LOG_LEVELS[levelName.toUpperCase()];
        if (typeof level !== 'undefined') {
            currentLogLevel = level;
            console.log(`%c[Logger] Log level set to: ${levelName}`, `color: ${COLORS.state}; font-weight: bold;`);
        } else {
            Logger.warn('LoggingService', `Attempted to set invalid log level: ${levelName}`);
        }
    },

    /**
     * Retrieves the stored log history for bug reporting.
     * @returns {string} A formatted string of all log entries.
     */
    getLogHistory: () => logHistory.join('\n'),

    // --- Informational Logs ---
    info: {
        player: (day, action, details, data = null) => log(LOG_LEVELS.INFO, 'Player', day, action, details, COLORS.player, data),
        system: (service, day, action, details, data = null) => log(LOG_LEVELS.INFO, service, day, action, details, COLORS.system, data),
        state: (day, action, details, data = null) => log(LOG_LEVELS.INFO, 'Game', day, action, details, COLORS.state, data)
    },

    // --- Warning and Error Logs ---
    warn: (service, details) => {
        if (LOG_LEVELS.WARN > currentLogLevel) return;
        const formattedMessage = `[${service}] WARN: ${details}`;
        addToHistory(formattedMessage);
        console.warn(`%c[${service}] WARN:`, `color: ${COLORS.warn}; font-weight: bold;`, details);
    },
    error: (service, details, error = null) => {
        if (LOG_LEVELS.ERROR > currentLogLevel) return;
        const formattedMessage = `[${service}] ERROR: ${details}`;
        addToHistory(formattedMessage);
        console.error(`%c[${service}] ERROR:`, `color: ${COLORS.error}; font-weight: bold;`, details, error || '');
    },

    // --- Utility Logs ---
    group: (label) => {
        if (LOG_LEVELS.DEBUG > currentLogLevel) return;
        addToHistory(`--- GROUP START: ${label} ---`);
        console.groupCollapsed(`%c${label}`, `color: ${COLORS.group}; font-style: italic;`);
    },
    groupEnd: () => {
        if (LOG_LEVELS.DEBUG > currentLogLevel) return;
        console.groupEnd();
        addToHistory(`--- GROUP END ---`);
    },
    time: (label) => {
        if (LOG_LEVELS.DEBUG > currentLogLevel) return;
        console.time(label);
    },
    timeEnd: (label) => {
        if (LOG_LEVELS.DEBUG > currentLogLevel) return;
        console.timeEnd(label);
    }
};