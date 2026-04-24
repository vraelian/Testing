// js/services/SaveStorageService.js

/**
 * @fileoverview Service for managing game saves using IndexedDB with a 
 * bulletproof iOS Native Bridge fallback and A/B buffered localStorage.
 * Now utilizes a Web Worker for native CompressionStream offloading and 
 * provides a synchronous emergency hook for OS-level terminations.
 */

class SaveStorageService {
    constructor() {
        this.dbName = 'OrbitalSavesDB';
        this.version = 2; // Upgraded to v2 for Relational Chunking
        this.db = null;
        this.worker = new Worker('js/workers/saveWorker.js');
        
        // Listen for generic worker faults
        this.worker.onerror = (err) => console.error("[Save Worker] Fatal error:", err);
        
        this.initPromise = this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Retain legacy store for backwards compatibility during migration
                if (!db.objectStoreNames.contains('saves')) {
                    db.createObjectStore('saves', { keyPath: 'slotId' });
                }

                // V4 Architecture: Create chunked relational stores
                const stores = ['saves_metadata', 'saves_player', 'saves_world', 'saves_sol'];
                stores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'slotId' });
                    }
                });
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
     * Reverses the worker's native decompression utilizing the browser's DecompressionStream.
     * @private
     */
    async _decompressChunk(arrayBuffer) {
        try {
            const stream = new Blob([arrayBuffer]).stream();
            const decompressed = stream.pipeThrough(new DecompressionStream('deflate-raw'));
            const response = new Response(decompressed);
            const text = await response.text();
            return JSON.parse(text);
        } catch (e) {
            console.error("[SaveStorageService] Decompression failed", e);
            return null;
        }
    }

    /**
     * Reads and decompresses a specific relational chunk from IDB.
     * @private
     */
    async _readChunk(storeName, slotId) {
        return new Promise((resolve) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(slotId);
            
            request.onsuccess = async (e) => {
                const result = e.target.result;
                if (!result || !result.data) return resolve(null);
                try {
                    const decompressed = await this._decompressChunk(result.data);
                    resolve(decompressed);
                } catch (err) {
                    resolve(null); // Fail gracefully if stream is corrupted
                }
            };
            request.onerror = () => resolve(null);
        });
    }

    /**
     * EMERGENCY HOOK: A strictly synchronous fallback triggered when the OS is about to 
     * freeze or terminate the web view. It bypasses all Web Workers and Native Bridge 
     * promises to execute a blocking localStorage dump.
     * @param {string} slotId 
     * @param {object} payload 
     */
    _emergencySynchronousCommit(slotId, payload) {
        if (!slotId || !payload) return;
        try {
            const dataToSave = { ...payload, slotId };
            
            // Raw stringification and synchronous localStorage write only (NanoStorage surrogate)
            const bufferMetaKey = `orbital_save_${slotId}_buffer_meta`;
            const lastActive = localStorage.getItem(bufferMetaKey) || 'B';
            const activeBuffer = lastActive === 'A' ? 'B' : 'A';
            const targetKey = `orbital_save_${slotId}_buffer_${activeBuffer}`;
            
            localStorage.setItem(targetKey, JSON.stringify(dataToSave));
            localStorage.setItem(bufferMetaKey, activeBuffer);
            
            console.warn(`[Defensive Hook] Emergency synchronous commit executed for slot ${slotId}.`);
        } catch (e) {
            console.warn("[Defensive Hook] Emergency commit failed (Quota exceeded or Private Mode).", e);
        }
    }

    /**
     * Saves the game payload to the specified slot utilizing A/B Buffering 
     * and a decoupled Native Bridge dispatch. Offloads IDB to Worker thread.
     */
    async saveGame(slotId, payload) {
        await this.initPromise;
        const dataToSave = { ...payload, slotId };
        
        // 1. A/B Buffering in localStorage (Synchronous Safety Net)
        try {
            const bufferMetaKey = `orbital_save_${slotId}_buffer_meta`;
            const lastActive = localStorage.getItem(bufferMetaKey) || 'B';
            const activeBuffer = lastActive === 'A' ? 'B' : 'A';
            const targetKey = `orbital_save_${slotId}_buffer_${activeBuffer}`;
            
            localStorage.setItem(targetKey, JSON.stringify(dataToSave));
            localStorage.setItem(bufferMetaKey, activeBuffer);
        } catch (e) {
            console.warn('Private Mode / Quota error', e);
        }

        // 2. Memory Map Fallback
        if (!window.__IOS_SAVES) window.__IOS_SAVES = {};
        window.__IOS_SAVES[slotId] = dataToSave;

        // 3. iOS Native Bridge (Fully Asynchronous & Decoupled)
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosSaveBackup) {
            // Decouple from main synchronous flow to prevent UI freezing
            setTimeout(() => {
                try {
                    const stringifiedPayload = JSON.stringify(dataToSave);
                    window.webkit.messageHandlers.iosSaveBackup.postMessage({
                        slotId: slotId,
                        payload: stringifiedPayload,
                        ackId: 'no_ack_required' // Abandoned ACK protocol for hostile async environments
                    });
                } catch(e) {
                    console.warn("[iOS Bridge] Failed to send backup to native layer", e);
                }
            }, 0);
        }

        // 4. Primary IndexedDB Write (Offloaded to Web Worker)
        this.worker.postMessage({
            action: 'SAVE',
            slotId: slotId,
            payload: dataToSave
        });
    }

    /**
     * Loads a game save by checking the Native Vault FIRST to defeat the 7-day ITP purge.
     * Seamlessly stitches Relational Chunks back together if Web Storage is selected.
     */
    async loadGame(slotId) {
        await this.initPromise;
        
        // 1. Fetch iOS Native Fallback First (Ultimate Master)
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

        // 2. Fetch Web Storage Candidates (A/B Buffer & Chunked IDB)
        let webTime = 0;
        let webSave = null;

        // Read LocalStorage A/B Buffer
        try {
            const activeBuffer = localStorage.getItem(`orbital_save_${slotId}_buffer_meta`) || 'A';
            const lsData = localStorage.getItem(`orbital_save_${slotId}_buffer_${activeBuffer}`);
            if (lsData) {
                webSave = JSON.parse(lsData);
                webTime = webSave.metadata?.timestamp || webSave.state?.day || 0;
            }
        } catch(e) {
            console.warn('Private Mode / Quota error', e);
        }

        // Read and merge IDB Chunks
        try {
            const [metaChunk, playerChunk, worldChunk, solChunk] = await Promise.all([
                this._readChunk('saves_metadata', slotId),
                this._readChunk('saves_player', slotId),
                this._readChunk('saves_world', slotId),
                this._readChunk('saves_sol', slotId)
            ]);

            if (metaChunk && playerChunk && worldChunk && solChunk) {
                const idbSave = {
                    slotId: metaChunk.slotId,
                    version: metaChunk.version,
                    metadata: metaChunk.metadata,
                    state: {
                        ...playerChunk,
                        ...worldChunk,
                        ...solChunk
                    }
                };
                
                // Cleanup redundant injection
                delete idbSave.state.slotId;

                const idbTime = idbSave.metadata?.timestamp || idbSave.state?.day || 0;
                if (idbTime >= webTime) {
                    webSave = idbSave;
                    webTime = idbTime;
                }
            } else if (this.db.objectStoreNames.contains('saves')) {
                // Legacy Fallback for pre-V4 monolithic saves
                const legacySave = await new Promise((resolve) => {
                    const tx = this.db.transaction(['saves'], 'readonly');
                    const req = tx.objectStore('saves').get(slotId);
                    req.onsuccess = (e) => resolve(e.target.result);
                    req.onerror = () => resolve(null);
                });
                
                if (legacySave) {
                    const legacyTime = legacySave.metadata?.timestamp || legacySave.state?.day || 0;
                    if (legacyTime >= webTime) {
                        webSave = legacySave;
                        webTime = legacyTime;
                    }
                }
            }
        } catch (e) {
            console.warn("[SaveStorageService] IDB load failed", e);
        }

        // 3. Resolution Logic: Native Override
        if (nativeSave) {
            const nativeTime = nativeSave.metadata?.timestamp || nativeSave.state?.day || 0;
            // Mitigating 7-Day Purge: If Native matches or exceeds Web, it becomes the truth.
            if (nativeTime >= webTime) {
                console.log(`[iOS Bridge] Native Vault verified. Bypassing web storage entirely.`);
                this._syncToIndexedDB(nativeSave); // Silently heal IDB via Web Worker
                return nativeSave;
            }
        }

        return webSave;
    }

    /**
     * Deletes a game save from all environments.
     */
    async deleteGame(slotId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['saves', 'saves_metadata', 'saves_player', 'saves_world', 'saves_sol'], 'readwrite');
            
            // Wipe chunks
            transaction.objectStore('saves_metadata').delete(slotId);
            transaction.objectStore('saves_player').delete(slotId);
            transaction.objectStore('saves_world').delete(slotId);
            transaction.objectStore('saves_sol').delete(slotId);
            
            // Wipe legacy store if present
            if (this.db.objectStoreNames.contains('saves')) {
                transaction.objectStore('saves').delete(slotId);
            }

            transaction.oncomplete = () => {
                // Clear A/B Buffers
                try {
                    localStorage.removeItem(`orbital_save_${slotId}_buffer_A`);
                    localStorage.removeItem(`orbital_save_${slotId}_buffer_B`);
                    localStorage.removeItem(`orbital_save_${slotId}_buffer_meta`);
                } catch(e) {}

                // Clear Native Bridge
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosDeleteBackup) {
                    window.webkit.messageHandlers.iosDeleteBackup.postMessage(slotId);
                }
                if (window.__IOS_SAVES) delete window.__IOS_SAVES[slotId];
                
                resolve();
            };
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Retrieves metadata for the Splash Screen, safely resolving desyncs between Native, LocalStorage, and IDB data.
     * Efficiently reads only the lightweight 'saves_metadata' chunk store.
     */
    async getAllSaveMetadata() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['saves_metadata'], 'readonly');
            const store = tx.objectStore('saves_metadata');
            const request = store.getAll();

            request.onsuccess = async (event) => {
                let chunkedSaves = event.target.result || [];
                let metadataMap = new Map();
                
                // 1. Map IDB Metadata Chunks (Fast Track)
                await Promise.all(chunkedSaves.map(async (chunk) => {
                    if (chunk.data) {
                        const decompressed = await this._decompressChunk(chunk.data);
                        if (decompressed) {
                            metadataMap.set(String(decompressed.slotId), decompressed);
                        }
                    }
                }));

                // Legacy monolithic fallback map
                if (this.db.objectStoreNames.contains('saves')) {
                    const legacyTx = this.db.transaction(['saves'], 'readonly');
                    const legacyReq = legacyTx.objectStore('saves').getAll();
                    const legacySaves = await new Promise(r => {
                        legacyReq.onsuccess = e => r(e.target.result || []);
                        legacyReq.onerror = () => r([]);
                    });
                    legacySaves.forEach(save => {
                        if (!metadataMap.has(String(save.slotId))) {
                            metadataMap.set(String(save.slotId), save);
                        }
                    });
                }

                // 2. Evaluate LocalStorage A/B Buffers
                try {
                    [1, 2, 3].forEach(slotId => {
                        const strSlot = String(slotId);
                        const activeBuffer = localStorage.getItem(`orbital_save_${strSlot}_buffer_meta`) || 'A';
                        const lsData = localStorage.getItem(`orbital_save_${strSlot}_buffer_${activeBuffer}`);
                        if (lsData) {
                            const lsSave = JSON.parse(lsData);
                            const existing = metadataMap.get(strSlot);
                            const lsTime = lsSave.metadata?.timestamp || lsSave.state?.day || 0;
                            const existingTime = existing?.metadata?.timestamp || existing?.state?.day || 0;
                            
                            if (lsTime >= existingTime) {
                                metadataMap.set(strSlot, lsSave);
                            }
                        }
                    });
                } catch(e) {}

                // 3. Overwrite with Native iOS saves ONLY IF NEWER
                if (window.__IOS_SAVES) {
                    for (const [slotId, data] of Object.entries(window.__IOS_SAVES)) {
                        try {
                            const nativeSave = typeof data === 'string' ? JSON.parse(data) : data;
                            const existing = metadataMap.get(String(slotId));
                            
                            let useNative = true;
                            if (existing) {
                                const nativeTime = nativeSave.metadata?.timestamp || nativeSave.state?.day || 0;
                                const existingTime = existing.metadata?.timestamp || existing.state?.day || 0;
                                if (existingTime >= nativeTime) {
                                    useNative = false; 
                                }
                            }

                            if (useNative) {
                                metadataMap.set(String(slotId), nativeSave);
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

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `orbital_trading_${slotId}_${Date.now()}.json`);
            
            document.body.appendChild(downloadAnchorNode); 
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            return true;
        } catch (e) {
            console.error("[SaveStorageService] Export failed:", e);
            return false;
        }
    }

    /**
     * Parses an uploaded JSON save file and writes it to the specified slot.
     * @param {string} slotId 
     * @param {string|object} jsonData 
     * @returns {boolean} Success status
     */
    async importSave(slotId, jsonData) {
        try {
            const payload = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (!payload || !payload.state || !payload.metadata) {
                throw new Error("Invalid save file schema. Missing state or metadata roots.");
            }

            payload.slotId = slotId;
            await this.saveGame(slotId, payload);
            return true;
        } catch (e) {
            console.error("[SaveStorageService] Import failed:", e);
            throw e; 
        }
    }

    /**
     * Helper to push a native save back into IDB if IDB was cleared by the OS.
     * Deploys this rewrite back to the background worker.
     * @private
     */
    async _syncToIndexedDB(savePayload) {
        await this.initPromise;
        this.worker.postMessage({
            action: 'SAVE',
            slotId: savePayload.slotId,
            payload: savePayload
        });
    }
}

export const saveStorageService = new SaveStorageService();