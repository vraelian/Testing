// js/services/AssetStorageService.js
/**
 * @fileoverview Low-level wrapper for IndexedDB to manage persistent asset storage.
 * This acts as the "Locker" preventing iOS cache eviction.
 */

export class AssetStorageService {
    static DB_NAME = 'OrbitalAssetsDB';
    static STORE_NAME = 'assets';
    static VERSION = 1;
    static db = null;

    /**
     * Opens the database connection.
     * @returns {Promise<void>}
     */
    static async initDB() {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("AssetStorageService: DB Open Error", event);
                reject(event);
            };
        });
    }

    /**
     * Saves a raw Blob to the database under a specific key (file path).
     * @param {string} key - The unique path/ID of the asset.
     * @param {Blob} blob - The image data.
     * @returns {Promise<void>}
     */
    static async saveAsset(key, blob) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.put(blob, key);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    /**
     * Retrieves a Blob from the database.
     * @param {string} key 
     * @returns {Promise<Blob|undefined>}
     */
    static async getAsset(key) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.get(key);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (e) => reject(e);
        });
    }
    
    /**
     * Checks if an asset exists in the database.
     * @param {string} key 
     * @returns {Promise<boolean>}
     */
    static async hasAsset(key) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.count(key);

            request.onsuccess = (event) => resolve(event.target.result > 0);
            request.onerror = (e) => reject(e);
        });
    }
}