// js/services/AssetService.js
/**
 * @fileoverview Centralizes the logic for generating dynamic asset paths.
 * Implements the "Modulo Variant" system for perfect probability distribution.
 */

import { DB } from '../data/database.js';
import { DEFAULT_VARIANT_COUNT, SHIP_VARIANT_COUNTS } from '../data/assets_config.js';

export class AssetService {
    /**
     * Generates the target image path for a ship based on the player's visual seed.
     * Uses modulo arithmetic to cycle through available variants (A, B, C...) perfectly.
     * * Naming Convention: assets/images/ships/[Name]/[Name]_[Variant].jpeg
     * * @param {string} shipId - The GAME ID of the ship (e.g., 'Wanderer.Ship').
     * @param {number} visualSeed - The player's current visual seed integer.
     * @returns {string} The relative path to the image asset.
     */
    static getShipImage(shipId, visualSeed = 0) {
        const shipData = DB.SHIPS[shipId];
        if (!shipData) return '';

        const baseName = shipData.name; 
        
        // 1. Determine how many variants this ship has
        const variantCount = SHIP_VARIANT_COUNTS[shipId] || DEFAULT_VARIANT_COUNT;

        // 2. Calculate the index (0 to Count-1)
        // The visualSeed increments indefinitely, but modulo keeps the result within bounds.
        const variantIndex = Math.abs(visualSeed) % variantCount;

        // 3. Convert index to letter (0='A', 1='B', 2='C', etc.)
        // String.fromCharCode(65) is 'A'.
        const variantLetter = String.fromCharCode(65 + variantIndex);

        // 4. Construct Path
        // Example: assets/images/ships/Wanderer/Wanderer_B.jpeg
        return `assets/images/ships/${baseName}/${baseName}_${variantLetter}.jpeg`;
    }

    /**
     * Generates the guaranteed fallback path (Variant A).
     * Used by the UI if a specific file is missing/broken.
     * @param {string} shipId 
     * @returns {string}
     */
    static getFallbackImage(shipId) {
        const shipData = DB.SHIPS[shipId];
        if (!shipData) return '';

        const baseName = shipData.name;
        return `assets/images/ships/${baseName}/${baseName}_A.jpeg`;
    }
}