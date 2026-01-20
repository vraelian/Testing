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
        // Class Z (Alien) and F (Failsafe) use the NEW file structure (.png, ID-based filenames)
        if (['Z', 'F'].includes(shipData.class)) {
            // Folder: Uses Display Name (e.g., "Causality of Silence")
            const folderName = shipData.name;
            
            // Filename: Uses ID (Sanitized) to preserve underscores (e.g., "Causality_of_Silence")
            const fileName = shipId.replace('.Ship', ''); 
            
            return `assets/images/ships/${folderName}/${fileName}_${variantLetter}.png`;
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
            const folderName = shipData.name;
            const fileName = shipId.replace('.Ship', '');
            return `assets/images/ships/${folderName}/${fileName}_A.png`;
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

                // Save to DB
                await AssetStorageService.saveAsset(path, blob);

                // Update Memory Cache
                const url = URL.createObjectURL(blob);
                this.blobCache.set(path, url);
            } catch (err) {
                // Suppress warnings for missing assets
            }
        });

        await Promise.all(promises);
    }

    /**
     * BOOT PHASE HYDRATION (Title Screen)
     */
    static async hydrateBootAssets() {
        console.log("[AssetService] Starting Boot Phase Hydration...");
        const bootQueue = [];

        // 1. All Commodities
        DB.COMMODITIES.forEach(c => {
            bootQueue.push({ type: 'commodity', id: c.id, seed: 0 }); 
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
     */
    static async hydrateGameAssets(gameState) {
        if (!gameState || !gameState.player) return;

        const player = gameState.player;
        const uiState = gameState.uiState || {};
        const seed = player.visualSeed || 0;
        
        console.log("[AssetService] Starting Game Phase Hydration...");
        const criticalQueue = [];

        // 1. Prioritize Hangar
        const ownedShips = player.ownedShipIds || [];
        const activeHangarIndex = uiState.hangarActiveIndex || 0;
        const sortedOwnedShips = this._sortByDistance(ownedShips, activeHangarIndex);
        
        sortedOwnedShips.forEach(id => {
            criticalQueue.push({ type: 'ship', id, seed });
        });

        // 2. Prioritize Shipyard
        const shipyardStock = gameState.market && gameState.market.shipyardStock 
            ? Object.keys(gameState.market.shipyardStock) 
            : [];
        const activeShipyardIndex = uiState.shipyardActiveIndex || 0;
        const sortedShipyardStock = this._sortByDistance(shipyardStock, activeShipyardIndex);

        sortedShipyardStock.forEach(id => {
            criticalQueue.push({ type: 'ship', id, seed });
        });

        // 3. Fallback: Active Ship
        if (player.activeShipId) {
            criticalQueue.push({ type: 'ship', id: player.activeShipId, seed });
        }

        console.log(`[AssetService] Hydrating ${criticalQueue.length} Context-Critical Assets...`);
        await this.hydrateAssets(criticalQueue);

        // BATCH 2: BACKGROUND ASSETS
        setTimeout(() => {
            this.hydrateAllShips(seed);
        }, 2000); 
    }

    static _sortByDistance(list, centerIndex) {
        if (!list || list.length === 0) return [];
        const mapped = list.map((item, index) => {
            const distance = Math.abs(index - centerIndex);
            return { item, distance };
        });
        mapped.sort((a, b) => a.distance - b.distance);
        return mapped.map(x => x.item);
    }

    static hydrateAllShips(seed = 0) {
        const queue = Object.keys(DB.SHIPS).map(id => ({ type: 'ship', id, seed }));
        console.log(`[AssetService] Background hydrating all ${queue.length} ships...`);
        this.hydrateAssets(queue);
    }

    static hydrateAllCommodities(seed = 0) {
        const queue = DB.COMMODITIES.map(c => ({ type: 'commodity', id: c.id, seed }));
        console.log(`[AssetService] Background hydrating all ${queue.length} commodities...`);
        this.hydrateAssets(queue);
    }

    static preloadBuffer(shipList, targetIndex, bufferRadius, seed) {
        if (!shipList || shipList.length === 0) return;
        const queue = [];
        const start = Math.max(0, targetIndex - bufferRadius);
        const end = Math.min(shipList.length - 1, targetIndex + bufferRadius);

        for (let i = start; i <= end; i++) {
            const shipId = shipList[i];
            if (shipId) {
                queue.push({ type: 'ship', id: shipId, seed: seed });
            }
        }

        if (queue.length > 0) {
            this.hydrateAssets(queue).catch(e => console.warn('[AssetService] Buffer preload warning:', e));
        }
    }
}