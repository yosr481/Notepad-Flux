import { openDB } from 'idb';
import { encrypt, decrypt } from '../utils/crypto';

const DB_NAME = 'notepad-flux-db';
const DB_VERSION = 1;
const STORE_TABS = 'tabs';
const STORE_METADATA = 'metadata';

export const SCHEMA_VERSION = 1;

// Tab fields besides content that can hold user text or a disk path (title is the first
// line of an unsaved note; fileHandle is the absolute path in Electron). Encrypted too.
// Nothing indexes or queries by them: the store's only key is id.
const SENSITIVE_FIELDS = ['title', 'filePath', 'fileHandle'];

const encryptTab = async (tab) => {
    const out = { ...tab, content: await encrypt(tab.content) };
    for (const f of SENSITIVE_FIELDS) {
        if (typeof tab[f] === 'string') out[f] = await encrypt(tab[f]);
    }
    return out;
};

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

    async getSchemaVersion() {
        const db = await this.initDB();
        const v = await db.get(STORE_METADATA, 'schemaVersion');
        return typeof v === 'number' ? v : 0;
    },

    async saveTab(tab) {
        // A tab that failed to decrypt on load carries an empty content placeholder.
        // Persisting it would re-encrypt '' over the still-intact ciphertext on disk.
        // Skip until the user actually puts content in it (then the overwrite is their choice).
        if (tab._decryptFailed && !tab.content) return;

        const db = await this.initDB();
        const encryptedTab = await encryptTab(tab);
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

    async saveSnapshot({ tabs = [], metadata = {} }) {
        const db = await this.initDB();

        // Check if schemaVersion exists before transaction (outside the txn)
        const currentVersion = await db.get(STORE_METADATA, 'schemaVersion');
        const shouldStampVersion = typeof currentVersion !== 'number';

        // Encrypt all tabs first (before transaction)
        const encryptedTabs = [];
        for (const tab of tabs) {
            if (tab._decryptFailed && !tab.content) {
                // Skip this tab; its prior on-disk row survives
                continue;
            }
            encryptedTabs.push(await encryptTab(tab));
        }

        // Encrypt all metadata values first (before transaction)
        const encryptedMetadata = {};
        for (const [key, value] of Object.entries(metadata)) {
            const stringifiedValue = JSON.stringify(value);
            encryptedMetadata[key] = await encrypt(stringifiedValue);
        }

        // Single transaction: write tabs and metadata
        const tx = db.transaction([STORE_TABS, STORE_METADATA], 'readwrite');

        // Write encrypted tabs
        for (const tab of encryptedTabs) {
            await tx.objectStore(STORE_TABS).put(tab);
        }

        // Write encrypted metadata
        for (const [key, value] of Object.entries(encryptedMetadata)) {
            await tx.objectStore(STORE_METADATA).put(value, key);
        }

        // Stamp schemaVersion if absent (inside the transaction)
        if (shouldStampVersion) {
            await tx.objectStore(STORE_METADATA).put(SCHEMA_VERSION, 'schemaVersion');
        }

        await tx.done;
    },

    async loadSession() {
        const db = await this.initDB();

        const encryptedTabs = await db.getAll(STORE_TABS);
        const tabs = await Promise.all((encryptedTabs || []).map(async tab => {
            try {
                const decryptedContent = await decrypt(tab.content);
                const out = { ...tab, content: decryptedContent };
                // Rows from older versions hold these in plaintext; decrypt passes those through
                // and the next save rewrites them encrypted.
                for (const f of SENSITIVE_FIELDS) {
                    if (typeof tab[f] === 'string') out[f] = await decrypt(tab[f]);
                }
                return out;
            } catch (e) {
                console.error(`Failed to decrypt tab ${tab.id}:`, e);
                return {
                    ...tab,
                    // title/filePath may be ciphertext we cannot read: show neutral values
                    title: 'Untitled',
                    filePath: null,
                    fileHandle: null,
                    content: '',
                    _decryptFailed: true
                };
            }
        }));

        const getDecryptedMetadata = async (key) => {
            const encryptedValue = await db.get(STORE_METADATA, key);
            if (!encryptedValue) return null;
            try {
                const decryptedValue = await decrypt(encryptedValue);
                try {
                    return JSON.parse(decryptedValue);
                } catch {
                    return decryptedValue;
                }
            } catch (e) {
                console.error(`Failed to decrypt metadata key ${key}:`, e);
                return null;
            }
        };

        const activeTabId = await getDecryptedMetadata('activeTabId');
        const recentFiles = await getDecryptedMetadata('recentFiles') || [];
        const tabOrder = await getDecryptedMetadata('tabOrder') || [];
        const settings = await getDecryptedMetadata('settings');

        // Stamp schemaVersion if absent (lazy idempotent)
        const currentVersion = await db.get(STORE_METADATA, 'schemaVersion');
        if (typeof currentVersion !== 'number') {
            await db.put(STORE_METADATA, SCHEMA_VERSION, 'schemaVersion');
        }

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
