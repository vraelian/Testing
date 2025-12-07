// js/data/assets_config.js
/**
 * @fileoverview Configuration for ship asset variants.
 * Defines how many visual variants (A, B, C...) exist for each ship.
 */

export const DEFAULT_VARIANT_COUNT = 5;

/**
 * A map of Ship IDs to their specific variant counts.
 * Only add entries here if a ship has more or fewer than the DEFAULT_VARIANT_COUNT.
 * Example: If the Mule has 7 variants (A-G), add '[SHIP_IDS.MULE]: 7'.
 * @type {Object<string, number>}
 */
export const SHIP_VARIANT_COUNTS = {
    // 'Mule.Ship': 7, (<-- EXAMPLE)
    'Wanderer.Ship': 6,
    'Mule.Ship': 8,
    'Nomad.Ship': 6,
    'Mesa.Ship': 8,
    'Pathfinder.Ship': 7,
    'Pilgrim.Ship': 8,
    'Meridian.Ship': 8,
    'Raven.Ship': 9,
    'Warden.Ship': 11,
    'Aegis.Ship': 6,
    'Forerunner.Ship': 9,
    'Guardian.Ship': 11,
};