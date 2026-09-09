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
    COMMODITY_VARIANT_COUNTS,
    DEFAULT_LOCATION_VARIANT_COUNT,
    LOCATION_VARIANT_COUNTS
} from '../data/assets_config.js';
import { AssetStorageService } from './AssetStorageService.js';

export class AssetService {
    // 1x1 Transparent GIF for garbage collected images
    static PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    // In-Memory Cache: Maps FilePath -> BlobURL (e.g. "blob:http://localhost/...")
    static blobCache = new Map();

    /**
     * Map of Location IDs to the specific Capitalized Folder/Filename prefixes.
     * Maps internal IDs (e.g. 'loc_sun') to Title Case file system names (e.g. 'Sol').
     */
    static LOCATION_FILENAME_MAP = {
        'loc_sun': 'Sol',
        'loc_corona': 'Corona',
        'loc_mercury': 'Mercury',
        'loc_venus': 'Venus',
        'loc_earth': 'Earth',
        'loc_luna': 'Luna',
        'loc_mars': 'Mars',
        'loc_belt': 'Belt',
        'loc_exchange': 'Exchange',
        'loc_jupiter': 'Jupiter',
        'loc_saturn': 'Saturn',
        'loc_uranus': 'Uranus',
        'loc_neptune': 'Neptune',
        'loc_kepler': 'Kepler',
        'loc_pluto': 'Pluto'
    };

    /**
     * Initializes the storage backend.
     */
    static async init() {
        await AssetStorageService.initDB();
    }

    // --- Path Generators (Private Helpers) ---

    /**
     * Converts a 0-based index to a variant suffix using Base-26 logic.
     * 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB
     * @param {number} index 
     * @returns {string} The alphabetic suffix.
     */
    static _getVariantSuffix(index) {
        let suffix = '';
        while (index >= 0) {
            suffix = String.fromCharCode(65 + (index % 26)) + suffix;
            index = Math.floor(index / 26) - 1;
        }
        return suffix;
    }

    static _generateShipPath(shipId, visualSeed) {
        const shipData = DB.SHIPS[shipId];
        if (!shipData) return null;

        // 1. Determine Variant Letter (A, B, C... AA, AB...)
        const variantCount = SHIP_VARIANT_COUNTS[shipId] !== undefined 
            ? SHIP_VARIANT_COUNTS[shipId] 
            : DEFAULT_VARIANT_COUNT;
        
        const variantIndex = Math.abs(visualSeed) % variantCount;
        const variantLetter = this._getVariantSuffix(variantIndex);
        
        // 2. Branch Logic Based on Ship Class
        // Class Z (Alien) and F (Failsafe) use the HYBRID structure
        if (['Z', 'F'].includes(shipData.class)) {
            // Base Filename: Uses ID (Sanitized) to preserve underscores (e.g. "Causality_of_Silence")
            const fileName = shipId.replace('.Ship', ''); 
            
            // Folder Name: Derived from ID by replacing underscores with spaces
            // Rule: "Cryo_Sleep_Pod" -> "Cryo Sleep Pod"
            const folderName = fileName.replace(/_/g, ' ');

            // Result: assets/images/ships/Cryo Sleep Pod/Cryo_Sleep_Pod_A.webp
            return `assets/images/ships/${folderName}/${fileName}_${variantLetter}.webp`;
        } 
        
        // 3. Legacy Logic (Classes C, B, A, S, O)
        // Keeps original behavior 100% intact for existing ships
        const baseName = shipData.name;
        return `assets/images/ships/${baseName}/${baseName}_${variantLetter}.webp`;
    }

    static _generateCommodityPath(commodityName, visualSeed) {
        if (!commodityName) return null;
        
        // Convert 'water ice' back to 'water ice' for file paths
        const originalName = commodityName.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .replace(/ Xeno-geologicals/i, ' xeno-geologicals') // handle hyphen
            .replace(/^Xeno-geologicals/i, 'xeno-geologicals')
            .replace(/ Cryo-sleep/i, ' Cryo-Sleep')
            .replace(/^Cryo-sleep/i, 'Cryo-Sleep')
            .replace(/ Folded-space/i, ' Folded-Space')
            .replace(/^Folded-space/i, 'Folded-Space')
            .replace(/ Ai /i, ' AI '); // Handle special capitalization
            
        let variantCount = COMMODITY_VARIANT_COUNTS[commodityName] || COMMODITY_VARIANT_COUNTS[originalName];
        if (variantCount === undefined) variantCount = DEFAULT_COMMODITY_VARIANT_COUNT;
        if (variantCount <= 0) return null;
        
        const variantIndex = Math.abs(visualSeed) % variantCount;
        const variantLetter = this._getVariantSuffix(variantIndex);
        const fileNamePrefix = originalName.replace(/ /g, '_');
        return `assets/images/commodities/${originalName}/${fileNamePrefix}_${variantLetter}.webp`;
    }

    /**
     * Resolves the canonical folder and file prefix for a location.
     * Supports declarative market.assetPrefix, dictionary mapping, ID matching, and clean fallbacks.
     * @param {string|object} locationIdOrObj 
     * @returns {string} The capitalized prefix (e.g. 'Corona', 'Sol', 'Earth').
     */
    static _resolveLocationPrefix(locationIdOrObj) {
        if (!locationIdOrObj) return 'Unknown';

        // 1. If an object is passed (e.g. market object)
        if (typeof locationIdOrObj === 'object') {
            if (locationIdOrObj.assetPrefix) return locationIdOrObj.assetPrefix;
            locationIdOrObj = locationIdOrObj.id || locationIdOrObj.name || '';
        }

        const locKey = String(locationIdOrObj).trim();

        // 2. Check DB.MARKETS for declarative assetPrefix
        const market = DB.MARKETS?.find(m => m.id === locKey || m.name?.toLowerCase() === locKey.toLowerCase());
        if (market?.assetPrefix) {
            return market.assetPrefix;
        }

        // 3. Check explicit dictionary mapping
        if (this.LOCATION_FILENAME_MAP[locKey]) {
            return this.LOCATION_FILENAME_MAP[locKey];
        }

        // Check dictionary mapping case-insensitively
        const lowerLocKey = locKey.toLowerCase();
        for (const [key, prefix] of Object.entries(this.LOCATION_FILENAME_MAP)) {
            if (key.toLowerCase() === lowerLocKey) {
                return prefix;
            }
        }

        // 4. Safe fallback: Strip 'loc_', capitalize first letter
        const raw = locKey.replace(/^loc_/, '');
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    /**
     * Determines the total visual variants available for a location.
     * Checks market object, LOCATION_VARIANT_COUNTS (case-insensitively), and fallback defaults.
     * @param {string|object} locationId 
     * @returns {number}
     */
    static getLocationVariantCount(locationId) {
        // Direct property check if an object was passed
        if (typeof locationId === 'object' && locationId !== null) {
            if (typeof locationId.variantCount === 'number' && locationId.variantCount > 0) {
                return locationId.variantCount;
            }
            if (typeof locationId.imageVariants === 'number' && locationId.imageVariants > 0) {
                return locationId.imageVariants;
            }
        }

        const filePrefix = this._resolveLocationPrefix(locationId);

        // Check DB.MARKETS for explicit variantCount
        const market = DB.MARKETS?.find(m => m.id === locationId || m.name?.toLowerCase() === String(locationId).toLowerCase());
        if (typeof market?.variantCount === 'number' && market.variantCount > 0) {
            return market.variantCount;
        }

        // Exact match in LOCATION_VARIANT_COUNTS
        if (LOCATION_VARIANT_COUNTS[filePrefix] !== undefined) {
            return LOCATION_VARIANT_COUNTS[filePrefix];
        }

        // Case-insensitive match in LOCATION_VARIANT_COUNTS
        const lowerPrefix = filePrefix.toLowerCase();
        for (const [key, count] of Object.entries(LOCATION_VARIANT_COUNTS)) {
            if (key.toLowerCase() === lowerPrefix) {
                return count;
            }
        }

        return DEFAULT_LOCATION_VARIANT_COUNT;
    }

    static _generateLocationPath(locationId, variantLetter = null) {
        if (!locationId) return null;

        // 1. Resolve filename prefix (Folder & File Start)
        const filePrefix = this._resolveLocationPrefix(locationId);

        // 2. Determine Variant Letter
        let letter = variantLetter;
        if (!letter) {
            const variantCount = this.getLocationVariantCount(locationId);
            const variantIndex = variantCount > 0 ? Math.floor(Math.random() * variantCount) : 0;
            letter = this._getVariantSuffix(variantIndex); // A...Z, AA...
        }

        // 3. Construct Path
        // Pattern: assets/images/locations/[Capitalized]/[Capitalized]_[Letter].webp
        return `assets/images/locations/${filePrefix}/${filePrefix}_${letter}.webp`;
    }

    /**
     * Generates a path for a specific static modal image.
     * @param {string} category - The subfolder name (e.g., 'intro', 'events').
     * @param {string} imageId - The filename without extension (e.g., 'intro_1').
     */
    static _generateModalPath(category, imageId) {
        if (!category || !imageId) return null;
        return `assets/images/modals/${category}/${imageId}.webp`;
    }

    /**
     * V1 OPTIMIZATION: Phase 5 - JavaScript Theme Engine Routing
     * Centralizes theme logic to map location themes directly to DOM root CSS variables.
     * Executes hardware-accelerated visual updates without node-level DOM manipulation.
     * @param {string} locationId - The ID of the current location.
     */
    static applyLocationTheme(locationId) {
        const location = DB.MARKETS.find(l => l.id === locationId);
        
        // Establish fallback defaults
        const theme = location?.navTheme || { 
            gradient: 'linear-gradient(180deg, rgba(12, 16, 29, 0.95) 0%, transparent 100%)', 
            borderColor: '#3a4a6a', 
            textColor: '#d0d8e8' 
        };

        const rootStyle = document.documentElement.style;

        // Map to the :root CSS custom property manifest
        rootStyle.setProperty('--ui-bg-base', theme.gradient);
        rootStyle.setProperty('--ui-gradient-header', theme.gradient);
        rootStyle.setProperty('--ui-border-primary', theme.borderColor);
        rootStyle.setProperty('--ui-text-highlight', theme.textColor);
        
        // Maintain legacy bindings for existing modules until fully deprecated
        rootStyle.setProperty('--theme-border-color', theme.borderColor);
        rootStyle.setProperty('--theme-gradient', theme.gradient);
        rootStyle.setProperty('--theme-text-color', theme.textColor);
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
            const fileName = shipId.replace('.Ship', '');
            
            // Standard Rule: "Cryo_Sleep_Pod" -> "Cryo Sleep Pod"
            const folderName = fileName.replace(/_/g, ' ');
            
            return `assets/images/ships/${folderName}/${fileName}_A.webp`;
        }

        // Legacy Fallback
        const baseName = shipData.name;
        return `assets/images/ships/${baseName}/${baseName}_A.webp`;
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
     * Generates a target image URL for a location.
     * Used for the Travel Animation sequence and location visual displays.
     * @param {string|object} locationId - Location ID or market object.
     * @param {string} [specificVariant=null] - Optional specific variant letter (e.g. 'A').
     * @returns {string} Image path or cached blob URL.
     */
    static getLocationImage(locationId, specificVariant = null) {
        const path = this._generateLocationPath(locationId, specificVariant);
        if (!path) return '';

        if (this.blobCache.has(path)) {
            return this.blobCache.get(path);
        }
        return path;
    }

    /**
     * Retrieves all available variant image paths for a given location.
     * Useful for codex entries, galleries, or pre-buffering.
     * @param {string|object} locationId 
     * @returns {string[]}
     */
    static getLocationAllImagePaths(locationId) {
        const filePrefix = this._resolveLocationPrefix(locationId);
        const count = this.getLocationVariantCount(locationId);
        const paths = [];
        for (let i = 0; i < count; i++) {
            const letter = this._getVariantSuffix(i);
            const path = `assets/images/locations/${filePrefix}/${filePrefix}_${letter}.webp`;
            paths.push(this.blobCache.has(path) ? this.blobCache.get(path) : path);
        }
        return paths;
    }

    /**
     * Retrieves the image path for a static modal asset.
     */
    static getModalImage(category, imageId) {
        const path = this._generateModalPath(category, imageId);
        if (!path) return '';

        if (this.blobCache.has(path)) {
            return this.blobCache.get(path);
        }
        return path;
    }

    /**
     * Hydrates (Fetches, Stores, and Caches) a list of assets.
     * This replaces the old "new Image()" preloading.
     * @param {Array<{type: 'ship'|'commodity'|'location'|'modal'|'direct', id?: string, category?: string, seed?: number, path?: string}>} assetRequests 
     */
    static async hydrateAssets(assetRequests) {
        const uniquePaths = new Set();
        
        // 1. Resolve logical paths
        assetRequests.forEach(req => {
            let path = null;
            if (req.type === 'ship' && req.id) {
                path = this._generateShipPath(req.id, req.seed || 0);
            } else if (req.type === 'commodity' && req.id) {
                const name = DB.COMMODITIES.find(c => c.id === req.id)?.name;
                if (name) path = this._generateCommodityPath(name, req.seed || 0);
            } else if (req.type === 'location') {
                if (req.path) {
                    path = req.path;
                } else if (req.id) {
                    path = this._generateLocationPath(req.id);
                }
            } else if (req.type === 'modal' && req.category && req.id) {
                path = this._generateModalPath(req.category, req.id);
            } else if ((req.type === 'modal' || req.type === 'direct') && req.path) {
                path = req.path;
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
     * Forces the browser to decode and upload CSS background textures to the GPU
     * by rendering them in a hidden, off-screen DOM element.
     * Prevents texture "pop-in" upon entering the game UI.
     * @private
     */
    static _prewarmTextures() {
        const warmDiv = document.createElement('div');
        warmDiv.style.cssText = `
            position: fixed; 
            top: -9999px; 
            left: -9999px; 
            width: 1px; 
            height: 1px; 
            opacity: 0.01; 
            pointer-events: none; 
            z-index: -1;
            /* Stack multiple backgrounds to load them all simultaneously */
            background-image: var(--bg-flat-metal), var(--bg-smooth-metal), var(--bg-metal), var(--bg-noise), var(--bg-dark-metal);
        `;
        document.body.appendChild(warmDiv);
        
        // Clean up the div after allowing the browser time to paint/decode (2 seconds)
        setTimeout(() => {
            if (document.body.contains(warmDiv)) {
                document.body.removeChild(warmDiv);
            }
        }, 2000);
    }

    /**
     * BOOT PHASE HYDRATION (Title Screen)
     * Loads high-priority UI assets that are needed immediately upon entering the game.
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

        // 3. Starter Ships
        const starterShips = [
            'Mule.Ship', 
            'Wanderer.Ship', 
            'Stalwart.Ship', 
            'Rooster.Ship', 
            'Nomad.Ship'
        ]; 
        
        starterShips.forEach(shipId => {
            bootQueue.push({ type: 'ship', id: shipId, seed: 0 }); 
        });

        // 4. Intro Modal Images (Preload directly to ensure they are ready before the first click)
        bootQueue.push({ type: 'modal', category: 'intro', id: 'intro_1' });
        bootQueue.push({ type: 'modal', category: 'intro', id: 'intro_2' });

        // 5. Global Character Spritesheet
        bootQueue.push({ type: 'direct', path: 'assets/images/characters/characters_sprite.webp' });

        // 6. Global UI Textures
        bootQueue.push({ type: 'direct', path: 'assets/images/textures/ui_noise_base.webp' });
        bootQueue.push({ type: 'direct', path: 'assets/images/textures/ui_metal_tile.webp' });
        bootQueue.push({ type: 'direct', path: 'assets/images/textures/flat_smooth_metal.webp' });
        bootQueue.push({ type: 'direct', path: 'assets/images/textures/flat_metal.webp' });
        bootQueue.push({ type: 'direct', path: 'assets/images/textures/dark_metal.webp' });

        await this.hydrateAssets(bootQueue);

        // --- TEXTURE CSS VARIABLE INJECTION ---
        // Binds the Blob URLs to CSS to guarantee offline rendering and bypass pathing errors
        const noiseUrl = this.blobCache.get('assets/images/textures/ui_noise_base.webp');
        const metalUrl = this.blobCache.get('assets/images/textures/ui_metal_tile.webp');
        const smoothMetalUrl = this.blobCache.get('assets/images/textures/flat_smooth_metal.webp');
        const flatMetalUrl = this.blobCache.get('assets/images/textures/flat_metal.webp');
        const darkMetalUrl = this.blobCache.get('assets/images/textures/dark_metal.webp');

        if (noiseUrl) document.documentElement.style.setProperty('--bg-noise', `url(${noiseUrl})`);
        if (metalUrl) document.documentElement.style.setProperty('--bg-metal', `url(${metalUrl})`);
        if (smoothMetalUrl) document.documentElement.style.setProperty('--bg-smooth-metal', `url(${smoothMetalUrl})`);
        if (flatMetalUrl) document.documentElement.style.setProperty('--bg-flat-metal', `url(${flatMetalUrl})`);
        if (darkMetalUrl) document.documentElement.style.setProperty('--bg-dark-metal', `url(${darkMetalUrl})`);

        // Guarantee GPU decoding before transition
        this._prewarmTextures();

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

    /**
     * Pre-caches thumbnail pointer paths for all active navigation locations.
     * Triggers when the Navigation tab is opened.
     */
    static preloadLocationThumbnails() {
        const queue = DB.MARKETS.map(m => ({ type: 'location', id: m.id }));
        this.hydrateAssets(queue).catch(e => console.warn('[AssetService] Location preload warning:', e));
    }

    /**
     * Forces the targeted high-res location background to hydrate immediately.
     * Called during Launch Modal instantiation to ensure it's ready if the player confirms.
     * @param {string} locId 
     */
    static hydrateTargetLocation(locId) {
        this.hydrateAssets([{ type: 'location', id: locId }]).catch(e => console.warn(`[AssetService] Target location ${locId} hydration failed:`, e));
    }
}