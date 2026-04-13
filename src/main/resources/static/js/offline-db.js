const OfflineDB = (() => {
    const DB_NAME = "bluetech_offline";
    const DB_VERSION = 1;

    function open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains("draft_results")) {
                    const store = db.createObjectStore("draft_results", { keyPath: "draftKey" });
                    store.createIndex("siteId", "siteId", { unique: false });
                    store.createIndex("syncStatus", "syncStatus", { unique: false });
                }

                if (!db.objectStoreNames.contains("draft_photos")) {
                    const store = db.createObjectStore("draft_photos", { keyPath: "photoKey" });
                    store.createIndex("draftKey", "draftKey", { unique: false });
                    store.createIndex("syncStatus", "syncStatus", { unique: false });
                }

                if (!db.objectStoreNames.contains("draft_locations")) {
                    const store = db.createObjectStore("draft_locations", { keyPath: "locationKey" });
                    store.createIndex("siteId", "siteId", { unique: false });
                    store.createIndex("syncStatus", "syncStatus", { unique: false });
                }
            };

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function put(storeName, data) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(data);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function get(storeName, key) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAll(storeName) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteByKey(storeName, key) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    return { open, put, get, getAll, deleteByKey };
})();