import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Spec 1 (fix/crypto-key-safety): storage "locked mode".
// storage.lockWrites() makes every disk-changing method resolve without touching IndexedDB,
// for the rest of the module's lifetime (no unlock). Reads keep working.
// Writes are observed two ways: the raw DB contents (byte-identical) and spies on the
// IndexedDB object-store write primitives (so an identical rewrite still counts).
// Each test gets a fresh storage + crypto module (vi.resetModules) = a fresh renderer.

const SECURE = 'notepad-flux-secure-key';
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const wrap = (s) => 'ENC(' + btoa(s) + ')';
const unwrap = (s) => atob(s.slice(4, -1));

function installSafeStorage(state) {
    window.electronAPI = {
        safeStorage: {
            isAvailable: vi.fn(async () => true),
            encrypt: vi.fn(async (s) => wrap(s)),
            decrypt: vi.fn(async (s) => { if (state.locked) throw new Error('keyring locked'); return unwrap(s); }),
            backend: vi.fn(async () => 'gnome_libsecret'),
        },
    };
}

async function freshStorage() {
    vi.resetModules();
    return (await import('../storage')).storage;
}

async function dumpDb(storage) {
    const db = await storage.initDB();
    const meta = {};
    for (const k of await db.getAllKeys('metadata')) meta[k] = await db.get('metadata', k);
    return { tabs: await db.getAll('tabs'), meta };
}

const WRITE_OPS = ['put', 'add', 'delete', 'clear'];
function spyIdbWrites() {
    return WRITE_OPS.map((op) => vi.spyOn(IDBObjectStore.prototype, op));
}
const writeCalls = (spies) => spies.flatMap((s, i) => s.mock.calls.map((c) => [WRITE_OPS[i], ...c]));

let errSpy, warnSpy, keyring, spies, storage, before;
beforeEach(async () => {
    localStorage.clear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    keyring = { locked: false };
    localStorage.setItem(SECURE, wrap(b64(crypto.getRandomValues(new Uint8Array(32)))));
    installSafeStorage(keyring);

    const seed = await freshStorage();
    await seed.clearSession();
    await seed.saveTab({ id: 'tab-1', title: 'One', content: 'first body', isDirty: false });
    await seed.saveTab({ id: 'tab-2', title: 'Two', content: 'second body', isDirty: false });
    await seed.saveMetadata({ activeTabId: 'tab-2', tabOrder: ['tab-1', 'tab-2'] });
    await seed.loadSession(); // stamps schemaVersion so the baseline is a settled DB
    before = await dumpDb(seed);

    storage = await freshStorage();
    spies = spyIdbWrites();
});
afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    delete window.electronAPI;
    errSpy.mockRestore();
    warnSpy.mockRestore();
});

// Every disk-changing storage method, with arguments that WOULD change rows if run.
const writers = [
    ['saveTab', (s) => s.saveTab({ id: 'tab-1', title: 'Overwrite', content: 'overwritten', isDirty: true })],
    ['saveTab (new id)', (s) => s.saveTab({ id: 'tab-9', title: 'New', content: 'new', isDirty: true })],
    ['deleteTab', (s) => s.deleteTab('tab-1')],
    ['saveMetadata', (s) => s.saveMetadata({ activeTabId: 'tab-1', tabOrder: [] })],
    ['saveSnapshot', (s) => s.saveSnapshot({ tabs: [{ id: 'tab-2', title: 'X', content: 'snap', isDirty: true }], metadata: { tabOrder: ['tab-2'] } })],
    ['clearSession', (s) => s.clearSession()],
];

describe('storage locked mode (spec 1)', () => {
    it('writesLocked is false by default and writes go through (control: the spies see writes)', async () => {
        expect(storage.writesLocked).toBe(false);
        await storage.saveTab({ id: 'tab-1', title: 'One', content: 'changed', isDirty: true });
        expect(writeCalls(spies).length).toBeGreaterThan(0);
        expect(await dumpDb(storage)).not.toEqual(before);
    });

    it('lockWrites() sets writesLocked = true; calling it again keeps it locked; there is no unlock API', async () => {
        expect(typeof storage.lockWrites).toBe('function');
        storage.lockWrites();
        expect(storage.writesLocked).toBe(true);
        storage.lockWrites();
        expect(storage.writesLocked).toBe(true);
        expect(Object.keys(storage).filter((k) => /unlock/i.test(k))).toEqual([]);
    });

    for (const [name, call] of writers) {
        it(`${name} after lockWrites() resolves and leaves IndexedDB untouched (healthy key)`, async () => {
            storage.lockWrites();
            await expect(call(storage)).resolves.toBeUndefined();
            expect(writeCalls(spies)).toEqual([]);
            expect(await dumpDb(storage)).toEqual(before);
        });

        it(`${name}: locked while the keyring is locked, still a no-op after the key becomes available mid-session`, async () => {
            keyring.locked = true;
            storage.lockWrites();
            await expect(call(storage)).resolves.toBeUndefined();
            keyring.locked = false; // keyring unlocked: the key now works in this module
            await expect(call(storage)).resolves.toBeUndefined();
            expect(storage.writesLocked).toBe(true);
            expect(writeCalls(spies)).toEqual([]);
            expect(await dumpDb(storage)).toEqual(before);
        });
    }

    it('reads still work while locked: loadSession returns the stored tabs and metadata', async () => {
        storage.lockWrites();
        const s = await storage.loadSession();
        expect(s.tabs.map((t) => [t.id, t.content]).sort()).toEqual([['tab-1', 'first body'], ['tab-2', 'second body']]);
        expect(s.activeTabId).toBe('tab-2');
        expect(s.tabOrder).toEqual(['tab-1', 'tab-2']);
        expect(await storage.getSchemaVersion()).toBe(1);
        expect(writeCalls(spies)).toEqual([]);
    });

    // Spec gap pinned on the strict side: loadSession lazily stamps schemaVersion, which is a
    // disk write hiding in a read. Locked means zero writes, so it must not stamp either.
    it('loadSession while locked does not stamp schemaVersion on a DB that lacks it', async () => {
        const db = await storage.initDB();
        await db.delete('metadata', 'schemaVersion');
        const without = await dumpDb(storage);
        spies.forEach((s) => s.mockClear());

        storage.lockWrites();
        await storage.loadSession();
        expect(writeCalls(spies)).toEqual([]);
        expect(await dumpDb(storage)).toEqual(without);
    });

    it('lock is per module lifetime: a fresh module (next launch) starts unlocked', async () => {
        storage.lockWrites();
        const next = await freshStorage();
        expect(next.writesLocked).toBe(false);
    });
});
