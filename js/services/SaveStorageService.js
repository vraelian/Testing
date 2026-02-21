// js/services/SaveStorageService.js

/**
 * @fileoverview Service for managing game saves using IndexedDB with a 
 * bulletproof iOS Native Bridge fallback.
 */

class SaveStorageService {
    constructor() {
        this.dbName = 'OrbitalSavesDB';
        this.storeName = 'saves';
        this.version = 1;
        this.db = null;
        this.initPromise = this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'slotId' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('SaveStorageService: IndexedDB initialization failed', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Saves the game payload to the specified slot in both IndexedDB and iOS Native Storage.
     */
    async saveGame(slotId, payload) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const dataToSave = { ...payload, slotId };
            
            const request = store.put(dataToSave);

            request.onsuccess = () => {
                // --- PHASE 1: iOS NATIVE BRIDGE (DUAL-WRITE) ---
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosSaveBackup) {
                    try {
                        window.webkit.messageHandlers.iosSaveBackup.postMessage({
                            slotId: slotId,
                            payload: JSON.stringify(dataToSave)
                        });
                        console.log(`[iOS Bridge] Slot ${slotId} backed up to native UserDefaults.`);
                    } catch(e) {
                        console.warn("[iOS Bridge] Failed to send backup to native layer", e);
                    }
                }
                
                // Keep local fallback synced
                if (!window.__IOS_SAVES) window.__IOS_SAVES = {};
                window.__IOS_SAVES[slotId] = dataToSave;
                
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Loads a game save. Prioritizes the indestructible iOS Native Storage if available.
     */
    async loadGame(slotId) {
        // --- PHASE 1: iOS NATIVE BRIDGE (HEALING FALLBACK) ---
        // Native saves are injected directly into the window at boot by Swift.
        if (window.__IOS_SAVES && window.__IOS_SAVES[slotId]) {
            try {
                console.log(`[iOS Bridge] Loading slot ${slotId} from unbreakable native storage.`);
                const nativeSave = typeof window.__IOS_SAVES[slotId] === 'string' 
                    ? JSON.parse(window.__IOS_SAVES[slotId]) 
                    : window.__IOS_SAVES[slotId];
                
                // Heal IndexedDB silently in the background
                this._syncToIndexedDB(nativeSave);
                return nativeSave;
            } catch (e) {
                console.error("[iOS Bridge] Failed to parse native iOS save:", e);
            }
        }

        // Standard IndexedDB Load
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(slotId);

            request.onsuccess = (event) => resolve(event.target.result || null);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Deletes a game save from both environments.
     */
    async deleteGame(slotId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(slotId);

            request.onsuccess = () => {
                // --- PHASE 1: iOS NATIVE BRIDGE ---
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosDeleteBackup) {
                    window.webkit.messageHandlers.iosDeleteBackup.postMessage(slotId);
                }
                if (window.__IOS_SAVES) delete window.__IOS_SAVES[slotId];
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Retrieves metadata for the Splash Screen by safely merging Native and IDB data.
     */
    async getAllSaveMetadata() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                let indexedDBSaves = event.target.result || [];
                let metadataMap = new Map();
                
                // 1. Log IDB saves
                indexedDBSaves.forEach(save => {
                    metadataMap.set(save.slotId, { slotId: save.slotId, version: save.version, metadata: save.metadata });
                });

                // 2. Overwrite/Rescue with Native iOS saves (survives IDB wipe)
                if (window.__IOS_SAVES) {
                    for (const [slotId, data] of Object.entries(window.__IOS_SAVES)) {
                        try {
                            const nativeSave = typeof data === 'string' ? JSON.parse(data) : data;
                            metadataMap.set(slotId, { slotId: nativeSave.slotId, version: nativeSave.version, metadata: nativeSave.metadata });
                        } catch(e) {}
                    }
                }

                resolve(Array.from(metadataMap.values()));
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Helper to push a native save back into IDB if IDB was cleared by the OS.
     * @private
     */
    async _syncToIndexedDB(savePayload) {
        await this.initPromise;
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            store.put(savePayload).onsuccess = resolve;
        });
    }
}

export const saveStorageService = new SaveStorageService();