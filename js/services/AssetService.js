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
import { SHIP_IDS } from '../data/constants.js';

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
        const baseName = shipData.name; 
        const variantCount = SHIP_VARIANT_COUNTS[shipId] || DEFAULT_VARIANT_COUNT;
        const variantIndex = Math.abs(visualSeed) % variantCount;
        const variantLetter = String.fromCharCode(65 + variantIndex);
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
        const baseName = shipData.name;
        // Fallback images are rarely cached as blobs since they are emergency assets, 
        // but we could extend hydration to them if needed.
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
     * INTELLIGENT GLOBAL HYDRATOR
     * Orchestrates the loading of the entire game in two phases: Critical and Background.
     * @param {object} playerState - The current player state object.
     */
    static async hydrateGameAssets(playerState) {
        const seed = playerState?.visualSeed || 0;
        const currentTier = playerState?.revealedTier || 1;
        const ownedShips = playerState?.ownedShipIds || [];
        const activeShip = playerState?.activeShipId;

        // --- BATCH 1: CRITICAL ASSETS (Immediate) ---
        // These are required for the very first screen the player sees.
        const criticalQueue = [];

        // 1. Starter Ships (Always safe to load)
        [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE].forEach(id => {
            criticalQueue.push({ type: 'ship', id, seed });
        });

        // 2. Player's Owned Ships (if loaded game)
        if (activeShip) criticalQueue.push({ type: 'ship', id: activeShip, seed });
        ownedShips.forEach(id => criticalQueue.push({ type: 'ship', id, seed }));

        // 3. Current Tier Commodities (Visible in Market)
        DB.COMMODITIES.forEach(c => {
            if (c.tier <= currentTier) {
                criticalQueue.push({ type: 'commodity', id: c.id, seed });
            }
        });

        console.log(`[AssetService] Hydrating ${criticalQueue.length} Critical Assets...`);
        await this.hydrateAssets(criticalQueue); // Await this one

        // --- BATCH 2: BACKGROUND ASSETS (Deferred) ---
        // These load silently while the player is reading Intro or browsing.
        setTimeout(() => {
            this.hydrateAllShips(seed);
            this.hydrateAllCommodities(seed);
            
            // Future Location Art
            const locationQueue = [];
            DB.MARKETS.forEach(m => {
                if (m.bgImage) locationQueue.push({ type: 'location', path: m.bgImage });
                if (m.imagePath) locationQueue.push({ type: 'location', path: m.imagePath });
            });
            if (locationQueue.length > 0) this.hydrateAssets(locationQueue);

        }, 2000); // 2 second delay to let UI thread settle
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
     * Legacy Adapter: Preloads images for a specific range of ships.
     * Now routes to hydrateAssets.
     */
    static preloadBuffer(shipList, centerIndex, range, visualSeed) {
        const min = Math.max(0, centerIndex - range);
        const max = Math.min(shipList.length - 1, centerIndex + range);
        
        const requests = [];
        for (let i = min; i <= max; i++) {
            requests.push({ type: 'ship', id: shipList[i], seed: visualSeed });
        }
        
        // Trigger hydration in background
        this.hydrateAssets(requests);
    }

    /**
     * Legacy Adapter: Initial preload helper.
     */
    static performInitialPreload(gameState, isHangarMode) {
        // This is largely redundant due to hydrateGameAssets but kept for carousel-specific logic
        const { player, market } = gameState;
        const shipList = isHangarMode 
            ? player.ownedShipIds 
            : Object.keys(market.shipyardStock || {}).map(k => k);
        
        const activeIndex = isHangarMode 
            ? (gameState.uiState.hangarActiveIndex || 0) 
            : (gameState.uiState.shipyardActiveIndex || 0);

        this.preloadBuffer(shipList, activeIndex, 5, player.visualSeed);
    }
}