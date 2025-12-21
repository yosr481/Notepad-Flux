import { openDB } from 'idb';
import { encrypt, decrypt } from '../utils/crypto';

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
        const encryptedContent = await encrypt(tab.content);
        const encryptedTab = {
            ...tab,
            content: encryptedContent
        };
        await db.put(STORE_TABS, encryptedTab);
    },

    async deleteTab(tabId) {
        const db = await this.initDB();
        await db.delete(STORE_TABS, tabId);
    },

    async saveMetadata(data) {
        const db = await this.initDB();
        
        const encryptedData = {};
        for (const [key, value] of Object.entries(data)) {
            const stringifiedValue = JSON.stringify(value);
            encryptedData[key] = await encrypt(stringifiedValue);
        }

        const tx = db.transaction(STORE_METADATA, 'readwrite');
        for (const [key, value] of Object.entries(encryptedData)) {
            await tx.store.put(value, key);
        }
        await tx.done;
    },

    async loadSession() {
        const db = await this.initDB();

        const encryptedTabs = await db.getAll(STORE_TABS);
        const tabs = await Promise.all((encryptedTabs || []).map(async tab => ({
            ...tab,
            content: await decrypt(tab.content)
        })));

        const getDecryptedMetadata = async (key) => {
            const encryptedValue = await db.get(STORE_METADATA, key);
            if (!encryptedValue) return null;
            const decryptedValue = await decrypt(encryptedValue);
            try {
                return JSON.parse(decryptedValue);
            } catch (e) {
                return decryptedValue;
            }
        };

        const activeTabId = await getDecryptedMetadata('activeTabId');
        const recentFiles = await getDecryptedMetadata('recentFiles') || [];
        const tabOrder = await getDecryptedMetadata('tabOrder') || [];
        const settings = await getDecryptedMetadata('settings');

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
