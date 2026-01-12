// js/services/GameAttributes.js
import { LOCATION_IDS } from '../data/constants.js';

/**
 * @fileoverview The Upgrade Registry (formerly GameAttributes).
 * This service defines the available Ship Upgrades, their metadata, and their effects.
 * It also acts as a compatibility layer, neutralizing legacy attribute logic.
 */

// ==========================================
// 1. UPGRADE DEFINITIONS (The Registry)
// ==========================================

const UPGRADE_DEFINITIONS = {
    // --- Phase 1 Placeholders ---
    'UPGRADE_01': {
        id: 'UPGRADE_01',
        name: 'Hyper-Combustor',
        value: 4000,
        description: 'An aftermarket injector that boosts engine output, but voids the warranty.',
        // Future logic hooks will go here
    },
    'UPGRADE_02': {
        id: 'UPGRADE_02',
        name: 'Duralium Plating',
        value: 6000,
        description: 'Heavy-duty bolt-on armor plates. Ugly, but effective.',
    },
    'UPGRADE_03': {
        id: 'UPGRADE_03',
        name: 'Smuggler\'s Compartment',
        value: 8000,
        description: 'A shielded cargo nook for... sensitive documents.',
    }
};

// ==========================================
// 2. STATION QUIRKS (Legacy Support)
// ==========================================
// Note: Station quirks are being retained for now but effectively disabled or simplified
// if they relied on the old attribute system. 

const STATION_QUIRK_MAP = {
    // [LOCATION_IDS.JUPITER]: ['QUIRK_JUPITER_FUEL'],
    // [LOCATION_IDS.VENUS]: ['QUIRK_VENUS_REPAIR'],
};

// ==========================================
// 3. SERVICE EXPORT (The API)
// ==========================================

export const GameAttributes = {
    /**
     * Retrieves an upgrade definition by ID.
     * @param {string} id 
     * @returns {object|null}
     */
    getDefinition(id) {
        return UPGRADE_DEFINITIONS[id] || null;
    },

    /**
     * Returns a list of all defined Upgrade IDs.
     * Useful for debug tools and random generation.
     * @returns {string[]} Array of Upgrade IDs.
     */
    getAllUpgradeIds() {
        return Object.keys(UPGRADE_DEFINITIONS);
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Formerly returned ship attributes. Now returns an empty array to prevent legacy logic from firing.
     * @param {string} shipId 
     * @returns {Array} Always empty.
     */
    getShipAttributes(shipId) {
        return [];
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Formerly returned station quirks. Now returns empty.
     * @param {string} locationId 
     * @returns {Array} Always empty.
     */
    getStationQuirks(locationId) {
        return [];
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Returns 1.0 to ensure standard service pricing.
     * @returns {number} 1.0
     */
    getServiceCostModifier(shipId, locationId, serviceType) {
        return 1.0;
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Returns 1.0 to ensure standard fuel costs.
     * @returns {number} 1.0
     */
    getFuelCostModifier(shipId) {
        return 1.0;
    },

    /**
     * LEGACY NEUTRALIZATION:
     * Returns 1.0 to ensure standard market pricing.
     * @returns {number} 1.0
     */
    getPriceModifier(shipId, locationId, transactionType, contextData = {}) {
        return 1.0;
    }
};