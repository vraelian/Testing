// js/services/TelemetryStorageService.js

/**
 * @class TelemetryStorageService
 * @description An isolated IndexedDB vault designed strictly for long-term diagnostic data, 
 * ensuring zero I/O competition with the primary player save data loop.
 */
export class TelemetryStorageService {
    constructor() {
        this.dbName = 'OrbitalTelemetryDB';
        this.dbVersion = 1;
        this.storeName = 'telemetry_logs';
        this.db = null;
    }

    /**
     * Initializes the detached database connection.
     * @returns {Promise<IDBDatabase>}
     * @private
     */
    async _initDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("TelemetryStorageService: Database connection error:", event.target.errorCode);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { autoIncrement: true });
                }
            };
        });
    }

    /**
     * Opens a readwrite transaction and pushes the payload asynchronously to prevent main-thread locking.
     * @param {object} payload - The extracted telemetry arrays.
     */
    async appendTelemetry(payload) {
        if (!payload) return;

        try {
            const db = await this._initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const timestampedPayload = {
                    timestamp: Date.now(),
                    data: payload
                };

                const request = store.add(timestampedPayload);

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    console.error("TelemetryStorageService: Failed to append telemetry data.", event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("TelemetryStorageService: DB Init failed during append operation.", error);
        }
    }
}