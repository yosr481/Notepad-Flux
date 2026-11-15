import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Spec E (fix/crypto-key-safety), storage level: while the AES key is unavailable
// (SECURE-only, keyring locked), nothing persisted may be overwritten. When the keyring
// comes back on a later launch, every tab and metadata row must still open.
// Each "launch" is a fresh storage + crypto module pair (vi.resetModules) over the same
// fake IndexedDB and localStorage, like a renderer restart.

const SECURE = 'notepad-flux-secure-key';
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const wrap = (s) => 'ENC(' + btoa(s) + ')';
const unwrap = (s) => atob(s.slice(4, -1));

function installSafeStorage({ locked }) {
    window.electronAPI = {
        safeStorage: {
            isAvailable: vi.fn(async () => true),
            encrypt: vi.fn(async (s) => wrap(s)),
            decrypt: vi.fn(async (s) => { if (locked) throw new Error('keyring locked'); return unwrap(s); }),
            backend: vi.fn(async () => 'gnome_libsecret'),
        },
    };
}

async function launch({ locked }) {
    installSafeStorage({ locked });
    vi.resetModules();
    return (await import('../storage')).storage;
}

async function dumpDb(storage) {
    const db = await storage.initDB();
    const tabs = await db.getAll('tabs');
    const keys = await db.getAllKeys('metadata');
    const meta = {};
    for (const k of keys) meta[k] = await db.get('metadata', k);
    return { tabs, meta };
}

// DB state after a healthy load (loadSession stamps schemaVersion, so compare from there).
async function baseline() {
    const s = await launch({ locked: false });
    await s.loadSession();
    return dumpDb(s);
}

let errSpy, warnSpy, keyB64;
beforeEach(async () => {
    localStorage.clear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    keyB64 = b64(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(SECURE, wrap(keyB64)); // already-migrated install: SECURE only

    // Healthy launch writes the user's session.
    const storage = await launch({ locked: false });
    await storage.clearSession();
    await storage.saveTab({ id: 't1', title: 'Plan', content: 'precious body', filePath: '/home/u/plan.md', fileHandle: '/home/u/plan.md', isDirty: false });
    await storage.saveMetadata({ activeTabId: 't1', tabOrder: ['t1'], recentFiles: ['/home/u/plan.md'] });
});
afterEach(() => {
    delete window.electronAPI;
    errSpy.mockRestore();
    warnSpy.mockRestore();
});

describe('storage while the encryption key is unavailable (spec E, superseded by locked mode)', () => {
    // Updated for spec 1/2: loadSession checks the key first; on KEY_UNAVAILABLE it locks
    // writes and returns an empty session flagged keyUnavailable (no placeholders), and all
    // writes resolve as no-ops. The property that matters is unchanged: rows stay byte-identical.
    it('loadSession returns an empty session flagged keyUnavailable, locks writes, and touches neither the DB nor the key', async () => {
        const before = await baseline();
        const storage = await launch({ locked: true });

        const session = await storage.loadSession();
        expect(session.keyUnavailable).toBe(true);
        expect(session.tabs).toEqual([]);
        expect(session.activeTabId).toBeNull();
        expect(storage.writesLocked).toBe(true);

        expect(await dumpDb(storage)).toEqual(before);
        expect(localStorage.getItem(SECURE)).toBe(wrap(keyB64));
    });

    it('a healthy load is not flagged and does not lock writes', async () => {
        const storage = await launch({ locked: false });
        const session = await storage.loadSession();
        expect(session.keyUnavailable).toBeFalsy();
        expect(storage.writesLocked).toBe(false);
    });

    it('saveTab over a stored id after a locked load resolves and does not overwrite its ciphertext', async () => {
        const before = await baseline();
        const storage = await launch({ locked: true });
        await storage.loadSession();

        await expect(storage.saveTab({ id: 't1', title: 'Untitled', content: '', isDirty: false, _decryptFailed: true })).resolves.toBeUndefined();
        await expect(storage.saveTab({ id: 't1', title: 'typed', content: 'user typed here', isDirty: true })).resolves.toBeUndefined();
        expect(await dumpDb(storage)).toEqual(before);
    });

    it('saveMetadata after a locked load resolves as a no-op and leaves the stored metadata rows intact', async () => {
        const before = await baseline();
        const storage = await launch({ locked: true });
        await storage.loadSession();

        await expect(storage.saveMetadata({ activeTabId: null, tabOrder: [], recentFiles: [] })).resolves.toBeUndefined();
        expect(await dumpDb(storage)).toEqual(before);
    });

    it('saveSnapshot / deleteTab / clearSession after a locked load are no-ops; every row intact', async () => {
        const before = await baseline();
        const storage = await launch({ locked: true });
        const s = await storage.loadSession();

        await expect(storage.saveSnapshot({ tabs: [{ id: 't1', title: 'x', content: 'new', isDirty: true }], metadata: { activeTabId: s.activeTabId, tabOrder: s.tabOrder, recentFiles: s.recentFiles } })).resolves.toBeUndefined();
        await expect(storage.deleteTab('t1')).resolves.toBeUndefined();
        await expect(storage.clearSession()).resolves.toBeUndefined();
        expect(await dumpDb(storage)).toEqual(before);
    });

    it('a legacy (no NFv1:) ciphertext row is never surfaced as content while locked, survives write attempts, and opens on the next healthy launch', async () => {
        const healthy = await launch({ locked: false });
        const { encrypt } = await import('../../utils/crypto');
        const db = await healthy.initDB();
        const legacyContent = (await encrypt('pre-sentinel body')).slice('NFv1:'.length);
        const legacyRow = { id: 'old', title: 'Old plain title', content: legacyContent, filePath: null, fileHandle: null, isDirty: false };
        await db.put('tabs', legacyRow);

        const storage = await launch({ locked: true });
        const session = await storage.loadSession();
        expect(JSON.stringify(session)).not.toContain(legacyContent);

        await storage.saveTab({ id: 'old', title: 'Untitled', content: legacyContent, isDirty: true });
        await storage.saveSnapshot({ tabs: [{ id: 'old', content: 'x' }], metadata: {} });
        await storage.deleteTab('old');
        expect(await (await storage.initDB()).get('tabs', 'old')).toEqual(legacyRow);

        const back = await launch({ locked: false });
        expect((await back.loadSession()).tabs.find((t) => t.id === 'old').content).toBe('pre-sentinel body');
    });

    it('after a locked launch that tried to save everything, the next healthy launch restores the full session', async () => {
        const locked = await launch({ locked: true });
        await locked.loadSession();
        const fresh = { id: 't1', title: 'Untitled', content: 'typed in the locked window', isDirty: true }; // id clashes with the stored tab
        await locked.saveTab(fresh);
        await locked.saveMetadata({ activeTabId: 't1', tabOrder: ['t1'], recentFiles: [] });
        await locked.saveSnapshot({ tabs: [fresh], metadata: { activeTabId: null, tabOrder: [] } });
        await locked.deleteTab('t1');

        const healthy = await launch({ locked: false });
        const session = await healthy.loadSession();
        expect(session.tabs).toHaveLength(1);
        expect(session.tabs[0]).toMatchObject({ id: 't1', title: 'Plan', content: 'precious body', filePath: '/home/u/plan.md' });
        expect(session.tabs[0]._decryptFailed).toBeUndefined();
        expect(session.activeTabId).toBe('t1');
        expect(session.tabOrder).toEqual(['t1']);
        expect(session.recentFiles).toEqual(['/home/u/plan.md']);
    });
});
