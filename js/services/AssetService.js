// js/services/AssetService.js
/**
 * @fileoverview Centralizes the logic for generating dynamic asset paths.
 * Implements the "Modulo Variant" system for perfect probability distribution
 * and manages asset preloading/caching.
 */

import { DB } from '../data/database.js';
import { 
    DEFAULT_VARIANT_COUNT, 
    SHIP_VARIANT_COUNTS, 
    DEFAULT_COMMODITY_VARIANT_COUNT, 
    COMMODITY_VARIANT_COUNTS 
} from '../data/assets_config.js';

export class AssetService {
    // 1x1 Transparent GIF for garbage collected images
    static PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    /**
     * Generates the target image path for a ship based on the player's visual seed.
     * Uses modulo arithmetic to cycle through available variants (A, B, C...) perfectly.
     * Naming Convention: assets/images/ships/[Name]/[Name]_[Variant].jpeg
     * @param {string} shipId - The GAME ID of the ship (e.g., 'Wanderer.Ship').
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
        const variantIndex = Math.abs(visualSeed) % variantCount;

        // 3. Convert index to letter (0='A', 1='B', 2='C', etc.)
        const variantLetter = String.fromCharCode(65 + variantIndex);

        // 4. Construct Path
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

    /**
     * Generates the target image path for a commodity based on the player's visual seed.
     * Naming Convention: assets/images/commodities/[Name]/[Name_With_Underscores]_[Variant].png
     * @param {string} commodityName - The name of the commodity (e.g., 'Water Ice').
     * @param {number} visualSeed - The player's current visual seed integer.
     * @returns {string} The relative path to the image asset.
     */
    static getCommodityImage(commodityName, visualSeed = 0) {
        if (!commodityName) return '';

        // 1. Determine count. Explicit 0 overrides default.
        // We check for undefined to allow a commodity to be omitted from config and fallback to default.
        let variantCount = COMMODITY_VARIANT_COUNTS[commodityName];
        if (variantCount === undefined) {
            variantCount = DEFAULT_COMMODITY_VARIANT_COUNT;
        }

        // 2. Safety Check: If 0 or negative, return empty string (disables custom art)
        if (variantCount <= 0) return '';

        // 3. Calculate the index
        const variantIndex = Math.abs(visualSeed) % variantCount;

        // 4. Convert index to letter
        const variantLetter = String.fromCharCode(65 + variantIndex);

        // 5. Construct Path
        // Folder preserves spaces: "Water Ice"
        // Filename uses underscores: "Water_Ice_A.png"
        const fileNamePrefix = commodityName.replace(/ /g, '_');
        
        return `assets/images/commodities/${commodityName}/${fileNamePrefix}_${variantLetter}.png`;
    }

    /**
     * Preloads images for a specific range of ships around a center index.
     * This ensures assets are hot in the cache before they are displayed.
     * @param {string[]} shipList - Array of ship IDs.
     * @param {number} centerIndex - The current active index.
     * @param {number} range - The number of neighbors to preload (e.g., 5).
     * @param {number} visualSeed - The player's visual seed.
     */
    static preloadBuffer(shipList, centerIndex, range, visualSeed) {
        const min = Math.max(0, centerIndex - range);
        const max = Math.min(shipList.length - 1, centerIndex + range);

        for (let i = min; i <= max; i++) {
            const src = this.getShipImage(shipList[i], visualSeed);
            // Create a detached Image object to force browser download/cache
            const img = new Image();
            img.src = src;
        }
    }

    /**
     * Helper to preload the initial view state.
     * Should be called on Game Start and Travel Complete.
     * @param {object} gameState - Current game state.
     * @param {boolean} isHangarMode - Initial mode.
     */
    static performInitialPreload(gameState, isHangarMode) {
        const { player, market } = gameState;
        const shipList = isHangarMode 
            ? player.ownedShipIds 
            : Object.keys(market.shipyardStock || {}).map(k => k); // Approx list extraction
        
        const activeIndex = isHangarMode 
            ? (gameState.uiState.hangarActiveIndex || 0) 
            : (gameState.uiState.shipyardActiveIndex || 0);

        // Preload visible + 5 neighbors
        this.preloadBuffer(shipList, activeIndex, 5, player.visualSeed);
    }
}