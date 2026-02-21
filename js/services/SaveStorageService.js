// js/services/SaveStorageService.js

/**
 * @fileoverview Service for managing game saves using IndexedDB.
 * IndexedDB is required to prevent main-thread stuttering during auto-saves 
 * (asynchronous operations) and to ensure persistent storage that survives 
 * mobile iOS web browser cache evictions.
 */

class SaveStorageService {
    constructor() {
        this.dbName = 'OrbitalSavesDB';
        this.storeName = 'saves';
        this.version = 1;
        this.db = null;
        this.initPromise = this._initDB();
    }

    /**
     * Initializes the IndexedDB connection and ensures the object store exists.
     * @returns {Promise<void>}
     * @private
     */
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
     * Saves the game payload to the specified slot.
     * @param {string} slotId - The slot identifier (e.g., 'slot_1').
     * @param {object} payload - The complete save payload containing version, metadata, and state.
     * @returns {Promise<void>}
     */
    async saveGame(slotId, payload) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // Explicitly enforce the slotId on the payload for the keyPath
            const dataToSave = { ...payload, slotId };
            
            const request = store.put(dataToSave);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Loads a game save from the specified slot.
     * @param {string} slotId - The slot identifier (e.g., 'slot_1').
     * @returns {Promise<object|null>} The save payload, or null if empty.
     */
    async loadGame(slotId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(slotId);

            request.onsuccess = (event) => {
                resolve(event.target.result || null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Deletes a game save from the specified slot.
     * @param {string} slotId - The slot identifier (e.g., 'slot_1').
     * @returns {Promise<void>}
     */
    async deleteGame(slotId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(slotId);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Retrieves only the metadata for all populated save slots.
     * Used exclusively to rapidly populate the Splash Screen UI without loading full game states into memory.
     * @returns {Promise<Array<object>>} Array of objects containing { slotId, version, metadata }.
     */
    async getAllSaveMetadata() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                const saves = event.target.result || [];
                const metadataList = saves.map(save => ({
                    slotId: save.slotId,
                    version: save.version,
                    metadata: save.metadata
                }));
                resolve(metadataList);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Export a singleton instance for global use
export const saveStorageService = new SaveStorageService();