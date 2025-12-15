import { openDB } from 'idb';

const DB_NAME = 'notepad-flux-db';
const DB_VERSION = 1;
const STORE_TABS = 'tabs';
const STORE_METADATA = 'metadata';

export const storage = {
    async initDB() {
        return openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_TABS)) {
                    db.createObjectStore(STORE_TABS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_METADATA)) {
                    db.createObjectStore(STORE_METADATA);
                }
            },
        });
    },

    async saveTab(tab) {
        const db = await this.initDB();
        await db.put(STORE_TABS, tab);
    },

    async deleteTab(tabId) {
        const db = await this.initDB();
        await db.delete(STORE_TABS, tabId);
    },

    async saveMetadata(data) {
        const db = await this.initDB();
        const tx = db.transaction(STORE_METADATA, 'readwrite');
        const store = tx.objectStore(STORE_METADATA);
        for (const [key, value] of Object.entries(data)) {
            await store.put(value, key);
        }
        await tx.done;
    },

    async loadSession() {
        const db = await this.initDB();

        // Load tabs
        const tabs = await db.getAll(STORE_TABS);

        // Load metadata
        const activeTabId = await db.get(STORE_METADATA, 'activeTabId');
        const recentFiles = await db.get(STORE_METADATA, 'recentFiles') || [];
        const tabOrder = await db.get(STORE_METADATA, 'tabOrder') || [];
        const settings = await db.get(STORE_METADATA, 'settings');

        return {
            tabs: tabs || [],
            activeTabId,
            recentFiles,
            tabOrder,
            settings
        };
    },

    async clearSession() {
        const db = await this.initDB();
        await db.clear(STORE_TABS);
        await db.clear(STORE_METADATA);
    }
};
