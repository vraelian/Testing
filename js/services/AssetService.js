// js/services/AssetService.js
/**
 * @fileoverview Centralizes the logic for generating dynamic asset paths.
 * Implements the "Modulo Variant" system for perfect probability distribution
 * and manages persistent asset hydration via Blob Storage.
 */

import { DB } from '../data/database.js';
import { 
    DEFAULT_VARIANT_COUNT, 
    SHIP_VARIANT_COUNTS, 
    DEFAULT_COMMODITY_VARIANT_COUNT, 
    COMMODITY_VARIANT_COUNTS 
} from '../data/assets_config.js';
import { AssetStorageService } from './AssetStorageService.js';

export class AssetService {
    // 1x1 Transparent GIF for garbage collected images
    static PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    // In-Memory Cache: Maps FilePath -> BlobURL (e.g. "blob:http://localhost/...")
    static blobCache = new Map();

    /**
     * Initializes the storage backend.
     */
    static async init() {
        await AssetStorageService.initDB();
    }

    // --- Path Generators (Private Helpers) ---

    static _generateShipPath(shipId, visualSeed) {
        const shipData = DB.SHIPS[shipId];
        if (!shipData) return null;

        // 1. Determine Variant Letter (A, B, C...)
        const variantCount = SHIP_VARIANT_COUNTS[shipId] !== undefined 
            ? SHIP_VARIANT_COUNTS[shipId] 
            : DEFAULT_VARIANT_COUNT;
        
        const variantIndex = Math.abs(visualSeed) % variantCount;
        const variantLetter = String.fromCharCode(65 + variantIndex); // 65 is 'A'
        
        // 2. Branch Logic Based on Ship Class
        // Class Z (Alien) and F (Failsafe) use the HYBRID structure
        if (['Z', 'F'].includes(shipData.class)) {
            // Folder: Uses Display Name (e.g. "Causality of Silence")
            // EXCEPTION: Handle the "Cryo-Sleep Pod" hyphen explicitly if needed, otherwise use name
            let folderName = shipData.name;
            if (shipId === 'Cryo_Sleep_Pod.Ship') {
                folderName = 'Cryo-Sleep Pod'; // Matches your specific folder structure
            }

            // Filename: Uses ID (Sanitized) to preserve underscores (e.g. "Causality_of_Silence")
            const fileName = shipId.replace('.Ship', ''); 
            
            // Result: assets/images/ships/Causality of Silence/Causality_of_Silence_A.jpeg
            return `assets/images/ships/${folderName}/${fileName}_${variantLetter}.jpeg`;
        } 
        
        // 3. Legacy Logic (Classes C, B, A, S, O)
        // Keeps original behavior 100% intact for existing ships
        const baseName = shipData.name;
        return `assets/images/ships/${baseName}/${baseName}_${variantLetter}.jpeg`;
    }

    static _generateCommodityPath(commodityName, visualSeed) {
        if (!commodityName) return null;
        let variantCount = COMMODITY_VARIANT_COUNTS[commodityName];
        if (variantCount === undefined) variantCount = DEFAULT_COMMODITY_VARIANT_COUNT;
        if (variantCount <= 0) return null;
        const variantIndex = Math.abs(visualSeed) % variantCount;
        const variantLetter = String.fromCharCode(65 + variantIndex);
        const fileNamePrefix = commodityName.replace(/ /g, '_');
        return `assets/images/commodities/${commodityName}/${fileNamePrefix}_${variantLetter}.png`;
    }

    // --- Public API ---

    /**
     * Generates the target image URL for a ship.
     * Prefers a cached Blob URL (instant/offline) if available.
     * Falls back to the relative network path.
     */
    static getShipImage(shipId, visualSeed = 0) {
        const path = this._generateShipPath(shipId, visualSeed);
        if (!path) return '';
        
        if (this.blobCache.has(path)) {
            return this.blobCache.get(path);
        }
        return path;
    }

    /**
     * Generates the guaranteed fallback path (Variant A).
     */
    static getFallbackImage(shipId) {
        const shipData = DB.SHIPS[shipId];
        if (!shipData) return '';

        // Conditional Fallback Logic
        if (['Z', 'F'].includes(shipData.class)) {
            let folderName = shipData.name;
            if (shipId === 'Cryo_Sleep_Pod.Ship') {
                folderName = 'Cryo-Sleep Pod';
            }
            const fileName = shipId.replace('.Ship', '');
            return `assets/images/ships/${folderName}/${fileName}_A.jpeg`;
        }

        // Legacy Fallback
        const baseName = shipData.name;
        return `assets/images/ships/${baseName}/${baseName}_A.jpeg`;
    }

    /**
     * Generates the target image URL for a commodity.
     * Prefers a cached Blob URL.
     */
    static getCommodityImage(commodityName, visualSeed = 0) {
        const path = this._generateCommodityPath(commodityName, visualSeed);
        if (!path) return '';

        if (this.blobCache.has(path)) {
            return this.blobCache.get(path);
        }
        return path;
    }

    /**
     * Hydrates (Fetches, Stores, and Caches) a list of assets.
     * This replaces the old "new Image()" preloading.
     * @param {Array<{type: 'ship'|'commodity'|'location', id: string, seed?: number, path?: string}>} assetRequests 
     */
    static async hydrateAssets(assetRequests) {
        const uniquePaths = new Set();
        
        // 1. Resolve logical paths
        assetRequests.forEach(req => {
            let path = null;
            if (req.type === 'ship') {
                path = this._generateShipPath(req.id, req.seed || 0);
            } else if (req.type === 'commodity') {
                const name = DB.COMMODITIES.find(c => c.id === req.id)?.name;
                if (name) path = this._generateCommodityPath(name, req.seed || 0);
            } else if (req.type === 'location') {
                // Future-proofing: If DB.MARKETS has image properties
                if (req.path) path = req.path; 
            }
            if (path) uniquePaths.add(path);
        });

        // 2. Process hydration
        // NOTE: Mapping the array creates Promises immediately, effectively starting the fetch.
        // The order of the `assetRequests` array determines the order requests are queued by the browser.
        const promises = Array.from(uniquePaths).map(async (path) => {
            // A. Check Memory Cache
            if (this.blobCache.has(path)) return;

            // B. Check Persistent Storage (IndexedDB)
            try {
                const storedBlob = await AssetStorageService.getAsset(path);
                if (storedBlob) {
                    const url = URL.createObjectURL(storedBlob);
                    this.blobCache.set(path, url);
                    return;
                }
            } catch (err) {
                console.warn(`AssetService: DB read error for ${path}`, err);
            }

            // C. Fetch from Network (if not in DB)
            try {
                const response = await fetch(path);
                if (!response.ok) throw new Error(`Network error ${response.status}`);
                const blob = await response.blob();

                // Save to DB for next time (Fire & Forget/Await)
                await AssetStorageService.saveAsset(path, blob);

                // Update Memory Cache
                const url = URL.createObjectURL(blob);
                this.blobCache.set(path, url);
            } catch (err) {
                // Warning suppressed for missing optional assets
                // console.warn(`AssetService: Failed to hydrate ${path}`, err);
            }
        });

        // Wait for all to complete (or fail gracefully)
        await Promise.all(promises);
    }

    /**
     * BOOT PHASE HYDRATION (Title Screen)
     * Loads high-priority UI assets that are needed immediately upon entering the game.
     * - All Commodity Icons (used in Market cards)
     * - All Location Backgrounds (used in Screen backgrounds)
     */
    static async hydrateBootAssets() {
        console.log("[AssetService] Starting Boot Phase Hydration...");
        const bootQueue = [];

        // 1. All Commodities
        DB.COMMODITIES.forEach(c => {
            bootQueue.push({ type: 'commodity', id: c.id, seed: 0 }); // Seed 0 is default for icons
        });

        // 2. Location/Travel Art
        DB.MARKETS.forEach(m => {
            if (m.bgImage) bootQueue.push({ type: 'location', path: m.bgImage });
            if (m.imagePath) bootQueue.push({ type: 'location', path: m.imagePath });
        });

        await this.hydrateAssets(bootQueue);
        console.log(`[AssetService] Boot Hydration Complete. Loaded ${bootQueue.length} assets.`);
    }

    /**
     * GAME START HYDRATION
     * Context-aware loader that prioritizes assets based on the player's current view.
     * @param {object} gameState - The full GameState object.
     */
    static async hydrateGameAssets(gameState) {
        if (!gameState || !gameState.player) return;

        const player = gameState.player;
        const uiState = gameState.uiState || {};
        const seed = player.visualSeed || 0;
        
        console.log("[AssetService] Starting Game Phase Hydration...");
        const criticalQueue = [];

        // 1. Prioritize Hangar (Owned Ships)
        // Sort by distance from the last active index
        const ownedShips = player.ownedShipIds || [];
        const activeHangarIndex = uiState.hangarActiveIndex || 0;
        const sortedOwnedShips = this._sortByDistance(ownedShips, activeHangarIndex);
        
        sortedOwnedShips.forEach(id => {
            criticalQueue.push({ type: 'ship', id, seed });
        });

        // 2. Prioritize Shipyard (Stock)
        // Sort by distance from the last active index
        const shipyardStock = gameState.market && gameState.market.shipyardStock 
            ? Object.keys(gameState.market.shipyardStock) 
            : [];
        const activeShipyardIndex = uiState.shipyardActiveIndex || 0;
        const sortedShipyardStock = this._sortByDistance(shipyardStock, activeShipyardIndex);

        sortedShipyardStock.forEach(id => {
            criticalQueue.push({ type: 'ship', id, seed });
        });

        // 3. Fallback: Active Ship (Double check to ensure it's loaded if not in lists)
        if (player.activeShipId) {
            criticalQueue.push({ type: 'ship', id: player.activeShipId, seed });
        }

        // Execute Critical Batch
        console.log(`[AssetService] Hydrating ${criticalQueue.length} Context-Critical Assets...`);
        await this.hydrateAssets(criticalQueue);

        // --- BATCH 2: BACKGROUND ASSETS (Deferred) ---
        // Load everything else that might have been missed
        setTimeout(() => {
            this.hydrateAllShips(seed);
        }, 2000); 
    }

    /**
     * Helper: Sorts an array of items based on their index distance from a center point.
     * Emulates "Carousel" priority (Center -> Left/Right 1 -> Left/Right 2...).
     * @param {Array} list - The array of IDs.
     * @param {number} centerIndex - The focus index.
     * @returns {Array} - The sorted array.
     */
    static _sortByDistance(list, centerIndex) {
        if (!list || list.length === 0) return [];
        
        // Map items to a temporary object containing their original distance
        const mapped = list.map((item, index) => {
            const distance = Math.abs(index - centerIndex);
            return { item, distance };
        });

        // Sort by distance ascending
        mapped.sort((a, b) => a.distance - b.distance);

        // Unwrap
        return mapped.map(x => x.item);
    }

    /**
     * Helper: Queues hydration for EVERY ship in the database.
     * Useful for Debug Mode or background caching.
     * @param {number} seed 
     */
    static hydrateAllShips(seed = 0) {
        const queue = Object.keys(DB.SHIPS).map(id => ({ type: 'ship', id, seed }));
        console.log(`[AssetService] Background hydrating all ${queue.length} ships...`);
        this.hydrateAssets(queue);
    }

    /**
     * Helper: Queues hydration for EVERY commodity in the database.
     * @param {number} seed 
     */
    static hydrateAllCommodities(seed = 0) {
        const queue = DB.COMMODITIES.map(c => ({ type: 'commodity', id: c.id, seed }));
        console.log(`[AssetService] Background hydrating all ${queue.length} commodities...`);
        this.hydrateAssets(queue);
    }

    /**
     * Preloads a buffer of assets around a specific index in a list.
     * Called by CarouselEventHandler to ensure smooth scrolling.
     * @param {Array<string>} shipList - List of Ship IDs.
     * @param {number} targetIndex - The index we are scrolling to/near.
     * @param {number} bufferRadius - The number of items to load on either side (e.g. 5).
     * @param {number} seed - The player's visual seed.
     */
    static preloadBuffer(shipList, targetIndex, bufferRadius, seed) {
        if (!shipList || shipList.length === 0) return;

        const queue = [];
        // Calculate bounds, clamping to the array limits to prevent out-of-bounds errors
        const start = Math.max(0, targetIndex - bufferRadius);
        const end = Math.min(shipList.length - 1, targetIndex + bufferRadius);

        for (let i = start; i <= end; i++) {
            const shipId = shipList[i];
            if (shipId) {
                queue.push({ type: 'ship', id: shipId, seed: seed });
            }
        }

        // Trigger hydration (Fire and forget; we don't need to await this for the UI to continue)
        if (queue.length > 0) {
            this.hydrateAssets(queue).catch(e => console.warn('[AssetService] Buffer preload warning:', e));
        }
    }
}