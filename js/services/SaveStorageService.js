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
     * Implements an ACK protocol to guarantee the iOS bridge completes before resolving.
     */
    async saveGame(slotId, payload) {
        await this.initPromise;
        const dataToSave = { ...payload, slotId };
        
        // 1. Save to IndexedDB (Primary Web Storage)
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(dataToSave);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });

        // 2. Keep local memory fallback synced
        if (!window.__IOS_SAVES) window.__IOS_SAVES = {};
        window.__IOS_SAVES[slotId] = dataToSave;

        // 3. iOS Native Bridge (Dual-Write with ACK Protocol)
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosSaveBackup) {
            try {
                // Yield to the main thread briefly to allow UI rendering/animations
                // to proceed smoothly before blocking the thread with a heavy JSON.stringify
                await new Promise(r => setTimeout(r, 10)); 
                const stringifiedPayload = JSON.stringify(dataToSave);
                
                const ackId = 'ack_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

                // Promise 1: Resolves when Swift executes the dynamically generated callback
                const nativePromise = new Promise((nativeResolve) => {
                    window[ackId] = () => {
                        delete window[ackId]; // Cleanup memory
                        console.log(`[iOS Bridge] Slot ${slotId} backed up to native UserDefaults (ACK received).`);
                        nativeResolve();
                    };
                    
                    window.webkit.messageHandlers.iosSaveBackup.postMessage({
                        slotId: slotId,
                        payload: stringifiedPayload,
                        ackId: ackId
                    });
                });

                // Promise 2: A 2000ms safety timeout to prevent soft-locking the game 
                // if the native layer fails to respond or crashes.
                const timeoutPromise = new Promise((timeoutResolve) => {
                    setTimeout(() => {
                        if (window[ackId]) {
                            console.warn(`[iOS Bridge] Timeout waiting for ACK on ${ackId}.`);
                            delete window[ackId]; // Cleanup memory
                            timeoutResolve(); 
                        }
                    }, 2000);
                });

                // Wait for either the ACK or the Timeout before officially concluding the save process
                await Promise.race([nativePromise, timeoutPromise]);
            } catch(e) {
                console.warn("[iOS Bridge] Failed to send backup to native layer", e);
            }
        }
    }

    /**
     * Loads a game save. Dynamically compares IDB vs iOS Native Storage to bypass
     * stale WKUserScript injections upon window.reload().
     */
    async loadGame(slotId) {
        await this.initPromise;
        
        // 1. Fetch Primary IDB Save
        let idbSave = null;
        try {
            idbSave = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(slotId);
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.warn("[SaveStorageService] IDB load failed", e);
        }

        // 2. Fetch iOS Native Fallback
        let nativeSave = null;
        if (window.__IOS_SAVES && window.__IOS_SAVES[slotId]) {
            try {
                nativeSave = typeof window.__IOS_SAVES[slotId] === 'string' 
                    ? JSON.parse(window.__IOS_SAVES[slotId]) 
                    : window.__IOS_SAVES[slotId];
            } catch (e) {
                console.error("[iOS Bridge] Failed to parse native iOS save:", e);
            }
        }

        // 3. Resolution Logic
        if (!idbSave && !nativeSave) return null;
        
        if (!idbSave && nativeSave) {
            console.log(`[iOS Bridge] IDB wiped. Healing from unbreakable native storage.`);
            this._syncToIndexedDB(nativeSave);
            return nativeSave;
        }
        
        if (idbSave && !nativeSave) return idbSave;

        // Both exist: Prevent WKWebView stale-script bug by comparing timestamps/progress
        const idbTime = idbSave.metadata?.timestamp || idbSave.state?.day || 0;
        const nativeTime = nativeSave.metadata?.timestamp || nativeSave.state?.day || 0;

        if (nativeTime > idbTime) {
            console.log(`[iOS Bridge] Native save is newer. Healing IDB.`);
            this._syncToIndexedDB(nativeSave);
            return nativeSave;
        } else {
            console.log(`[SaveStorageService] IDB save is newer or equal to Native. Using IDB to bypass stale iOS memory.`);
            return idbSave;
        }
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
     * Retrieves metadata for the Splash Screen, safely resolving desyncs between Native and IDB data.
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
                    metadataMap.set(save.slotId, save);
                });

                // 2. Overwrite with Native iOS saves ONLY IF NEWER (Bypasses stale WKUserScript)
                if (window.__IOS_SAVES) {
                    for (const [slotId, data] of Object.entries(window.__IOS_SAVES)) {
                        try {
                            const nativeSave = typeof data === 'string' ? JSON.parse(data) : data;
                            const existing = metadataMap.get(slotId);
                            
                            let useNative = true;
                            if (existing) {
                                const nativeTime = nativeSave.metadata?.timestamp || nativeSave.state?.day || 0;
                                const existingTime = existing.metadata?.timestamp || existing.state?.day || 0;
                                if (existingTime >= nativeTime) {
                                    useNative = false; // IDB is fresher or equal
                                }
                            }

                            if (useNative) {
                                metadataMap.set(slotId, nativeSave);
                            }
                        } catch(e) {}
                    }
                }

                // Format back to what the UI expects
                const results = Array.from(metadataMap.values()).map(save => ({
                    slotId: save.slotId,
                    version: save.version,
                    metadata: save.metadata
                }));

                resolve(results);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Serializes a save slot for external download via the browser.
     * @param {string} slotId 
     * @returns {boolean} Success status
     */
    async exportSave(slotId) {
        try {
            const saveData = await this.loadGame(slotId);
            if (!saveData) {
                console.warn(`[SaveStorageService] No data found in ${slotId} to export.`);
                return false;
            }

            // Encode the payload for browser download
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            
            // Format: orbital_trading_slot_1_1700000000.json
            downloadAnchorNode.setAttribute("download", `orbital_trading_${slotId}_${Date.now()}.json`);
            
            document.body.appendChild(downloadAnchorNode); // Required for Firefox compatibility
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            return true;
        } catch (e) {
            console.error("[SaveStorageService] Export failed:", e);
            return false;
        }
    }

    /**
     * Parses an uploaded JSON save file and writes it to the specified slot,
     * triggering both IDB and iOS Native Bridge backups.
     * @param {string} slotId 
     * @param {string|object} jsonData 
     * @returns {boolean} Success status
     */
    async importSave(slotId, jsonData) {
        try {
            const payload = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            // Basic Schema Validation to prevent bricking the game
            if (!payload || !payload.state || !payload.metadata) {
                throw new Error("Invalid save file schema. Missing state or metadata roots.");
            }

            // Override the payload's internal slot ID to match the target destination
            payload.slotId = slotId;

            // Route through the standard saveGame flow to ensure Dual-Write (Web + iOS) triggers
            await this.saveGame(slotId, payload);
            return true;
        } catch (e) {
            console.error("[SaveStorageService] Import failed:", e);
            throw e; // Bubble error to UI for Toast notification
        }
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