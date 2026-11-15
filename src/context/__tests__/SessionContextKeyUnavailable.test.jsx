import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createFakeLockManager } from '../../test/fakeLocks';

// Spec 2 (fix/crypto-key-safety): session load when the encryption key is unavailable.
// Real stack on purpose: real SessionContext -> real storage -> real crypto -> fake-indexeddb,
// with a fake Electron keyring that is locked. Mocking storage here would hide the exact
// failure this guards (a write/delete that reaches IndexedDB while the key can't be read).
// Each window is its own module instance (vi.resetModules), like a separate renderer process,
// so one window's storage.lockWrites() cannot mask another window's missing check.
// Disk writes are observed via the IndexedDB write primitives AND the raw DB contents.

vi.mock('../../utils/fileSystem', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, fileSystem: { ...actual.fileSystem, fileExists: vi.fn(async () => null) } };
});

const LOCK = 'notepad-flux-primary';
const SECURE = 'notepad-flux-secure-key';
const WARNING = "The system keyring is locked, so saved tabs can't be opened. They are safe on disk. Unlock the keyring and restart Notepad Flux; until then, changes are kept only if you save them as files.";

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const wrap = (s) => 'ENC(' + btoa(s) + ')';
const unwrap = (s) => atob(s.slice(4, -1));

let keyring, closeCb;
function installElectron() {
    window.electronAPI = {
        safeStorage: {
            isAvailable: vi.fn(async () => true),
            encrypt: vi.fn(async (s) => wrap(s)),
            decrypt: vi.fn(async (s) => { if (keyring.locked) throw new Error('keyring locked'); return unwrap(s); }),
            backend: vi.fn(async () => 'gnome_libsecret'),
        },
        onCloseRequested: vi.fn((cb) => { closeCb = cb; return () => {}; }),
    };
}

// One renderer: fresh SessionContext + storage + crypto.
async function loadWindow() {
    vi.resetModules();
    const ctx = await import('../SessionContext');
    const { storage } = await import('../../services/storage');
    return { ...ctx, storage };
}

function mount(win) {
    const api = {};
    const Probe = () => { Object.assign(api, win.useSession()); return null; };
    const r = render(<win.SessionProvider><Probe /></win.SessionProvider>);
    return { api, unmount: r.unmount };
}

async function dumpDb(storage) {
    const db = await storage.initDB();
    const meta = {};
    for (const k of await db.getAllKeys('metadata')) meta[k] = await db.get('metadata', k);
    return { tabs: await db.getAll('tabs'), meta };
}

const WRITE_OPS = ['put', 'add', 'delete', 'clear'];
let spies;
const startWriteSpies = () => { spies = WRITE_OPS.map((op) => vi.spyOn(IDBObjectStore.prototype, op)); };
const writeCalls = () => spies.flatMap((s, i) => s.mock.calls.map((c) => [WRITE_OPS[i], c[1] ?? c[0]?.id ?? c[0]]));

// Let any fire-and-forget IndexedDB work land (fake-indexeddb runs on real setImmediate).
const settleIdb = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); };

// Run user actions with a fake clock so every debounce (400 ms metadata, 1 s tab save) fires deterministically.
async function withFakeClock(fn) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
        await act(async () => { await fn(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    } finally {
        vi.useRealTimers();
    }
    await settleIdb();
}

// Every in-session path that persisted before: typing, new tab, close, switch, reorder,
// active tab, recent files, settings, blur, hidden, beforeunload, saveSession, close handshake.
async function exerciseEverything(api) {
    await withFakeClock(async () => {
        api.updateTab(api.activeTabId, { content: 'typed while locked', isDirty: true });
        api.createTab({ title: 'new.md', content: 'new tab body', isDirty: true });
        await Promise.resolve();
    });
    await withFakeClock(async () => {
        const newId = api.tabs.at(-1).id;
        api.updateTab(newId, { content: 'more typing', isDirty: true });
        api.switchTab('prev');
        api.switchTab('next');
        if (api.tabs.length > 1) api.reorderTabs(api.tabs[0].id, api.tabs.at(-1).id);
        api.addRecentFile('/home/u/r.md', 'r.md');
        api.updateSettings({ theme: 'dark' });
        api.setActiveTabId(api.tabs[0].id);
    });
    await withFakeClock(async () => {
        window.dispatchEvent(new Event('blur'));
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('beforeunload'));
        await api.saveSession();
        if (closeCb) await closeCb();
    });
    await withFakeClock(async () => {
        // close every tab that can be closed (ids may collide with on-disk rows)
        for (const t of [...api.tabs].reverse()) api.closeTab(t.id);
    });
}

let errSpy, warnSpy, logSpy, before, keyB64;
beforeEach(async () => {
    localStorage.clear();
    closeCb = null;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    keyring = { locked: false };
    keyB64 = b64(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(SECURE, wrap(keyB64)); // migrated install: SECURE only
    installElectron();
    Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });

    // A previous healthy launch saved three tabs. Ids tab-1..3 deliberately collide with the
    // ids a fresh window hands out, so any leaked write or delete hits a real row.
    const seed = await loadWindow();
    await seed.storage.clearSession();
    for (const [id, body] of [['tab-1', 'alpha body'], ['tab-2', 'beta body'], ['tab-3', 'gamma body']])
        await seed.storage.saveTab({ id, title: id.toUpperCase(), content: body, filePath: `/home/u/${id}.md`, fileHandle: `/home/u/${id}.md`, isDirty: false });
    await seed.storage.saveMetadata({ activeTabId: 'tab-2', tabOrder: ['tab-1', 'tab-2', 'tab-3'], recentFiles: [{ filePath: '/home/u/x.md', fileName: 'x.md' }], settings: { theme: 'light' } });
    await seed.storage.loadSession(); // stamp schemaVersion: baseline is a settled DB
    before = await dumpDb(seed.storage);
});
// Isolation: a HEALTHY window (control test, final healthy relaunch) legitimately persists via
// debounces scheduled on the real clock (metadata 400 ms, tab 1 s); unmount does not cancel them.
// Left alone they fire inside the NEXT test, after its `before` snapshot, and look like a leak
// from the locked window. Drain them here so every write lands in the test that caused it.
const DRAIN_MS = 1200; // > the longest SessionContext debounce (1000 ms)
afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, DRAIN_MS));
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 20));
    spies?.forEach((s) => s.mockRestore());
    spies = null;
    delete navigator.locks;
    delete window.electronAPI;
    delete document.visibilityState;
    errSpy.mockRestore(); warnSpy.mockRestore(); logSpy.mockRestore();
});

async function expectSessionIntactOnHealthyRelaunch() {
    cleanup();
    keyring.locked = false;
    Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
    const win = await loadWindow();
    const { api } = mount(win);
    await waitFor(() => expect(api.isSessionLoaded).toBe(true));
    await waitFor(() => expect(api.tabs.map((t) => t.content)).toEqual(['alpha body', 'beta body', 'gamma body']));
    expect(api.tabs.map((t) => t.filePath)).toEqual(['/home/u/tab-1.md', '/home/u/tab-2.md', '/home/u/tab-3.md']);
    expect(api.restoreWarning).toBeNull();
}

describe('SessionContext with the encryption key unavailable (spec 2)', () => {
    it('control: with a healthy key the same stack restores tabs and typing DOES reach IndexedDB (spies are live)', async () => {
        const win = await loadWindow();
        const { api } = mount(win);
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        await waitFor(() => expect(api.tabs.map((t) => t.content)).toEqual(['alpha body', 'beta body', 'gamma body']));
        expect(api.restoreWarning).toBeNull();
        expect(win.storage.writesLocked).toBe(false);
        startWriteSpies();
        await withFakeClock(async () => { api.updateTab('tab-1', { content: 'edited', isDirty: true }); });
        expect(writeCalls().length).toBeGreaterThan(0);
    });

    it('primary: lockWrites() is called, nothing is restored, and the keyring warning (not the decryption one) is shown', async () => {
        keyring.locked = true;
        const win = await loadWindow();
        const lockSpy = vi.spyOn(win.storage, 'lockWrites');
        startWriteSpies();
        const { api } = mount(win);
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        await waitFor(() => expect(api.restoreWarning).toBe(WARNING));

        expect(lockSpy).toHaveBeenCalled();
        expect(win.storage.writesLocked).toBe(true);
        expect(api.restoreWarning).toMatch(/keyring/);
        expect(api.restoreWarning).toMatch(/safe/);
        expect(api.restoreWarning).not.toMatch(/decryption failed/);
        // fresh window state only: the default tab, no placeholders for the disk rows
        expect(api.tabs).toHaveLength(1);
        expect(api.tabs[0]).toMatchObject({ content: '', isDirty: false });
        expect(api.tabs.some((t) => t._decryptFailed)).toBe(false);
        expect(api.recentFiles).toEqual([]);
        expect(writeCalls()).toEqual([]);
        expect(await dumpDb(win.storage)).toEqual(before);
    });

    it('primary: typing, new tab, switch, reorder, settings, blur/hidden/beforeunload, saveSession, close handshake and closing tabs cause zero IndexedDB writes; next healthy launch restores everything', async () => {
        keyring.locked = true;
        const win = await loadWindow();
        const { api } = mount(win);
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        await waitFor(() => expect(api.restoreWarning).toBe(WARNING));
        startWriteSpies();

        await exerciseEverything(api);

        expect(writeCalls()).toEqual([]);
        expect(await dumpDb(win.storage)).toEqual(before);
        await expectSessionIntactOnHealthyRelaunch();
    });

    it('primary: zero writes even if the keyring unlocks mid-session (lock is one-way)', async () => {
        keyring.locked = true;
        const win = await loadWindow();
        const { api } = mount(win);
        await waitFor(() => expect(api.restoreWarning).toBe(WARNING));
        startWriteSpies();

        keyring.locked = false; // crypto would now succeed in this renderer
        await exerciseEverything(api);

        expect(writeCalls()).toEqual([]);
        expect(await dumpDb(win.storage)).toEqual(before);
    });

    it('primary: a tab opened before the load finished is kept in the window and never written', async () => {
        keyring.locked = true;
        const win = await loadWindow();
        startWriteSpies();
        const { api } = mount(win);
        // SessionContext asks for the primary lock after 100 ms: this tab is "early"
        act(() => { api.createTab({ title: 'early.md', content: 'early body', filePath: 'early.md', fileHandle: '/home/u/early.md', isDirty: false }); });
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        await waitFor(() => expect(api.restoreWarning).toBe(WARNING));

        expect(api.tabs.map((t) => t.content)).toContain('early body');
        expect(api.tabs.map((t) => t.content)).not.toContain('alpha body');
        await settleIdb();
        expect(writeCalls()).toEqual([]);
        expect(await dumpDb(win.storage)).toEqual(before);
    });

    it('secondary promoted while the key is unavailable: locks writes, shows the warning, its promotion snapshot writes nothing', async () => {
        keyring.locked = true;
        const winA = await loadWindow();
        const a = mount(winA);
        await waitFor(() => expect(a.api.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(a.api.isSessionLoaded).toBe(true));

        const winB = await loadWindow(); // separate renderer, separate storage module
        const b = mount(winB);
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK)).toBe(1));
        await waitFor(() => expect(b.api.isSessionLoaded).toBe(true));
        act(() => { b.api.updateTab(b.api.activeTabId, { content: 'typed in second window', isDirty: true }); });
        act(() => { b.api.createTab({ title: 'b.md', content: 'second window file', filePath: 'b.md', fileHandle: '/home/u/b.md' }); });
        startWriteSpies();

        a.unmount(); // window A closes: B is promoted
        await waitFor(() => expect(b.api.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(b.api.isSessionLoaded).toBe(true));
        await waitFor(() => expect(b.api.restoreWarning).toBe(WARNING));
        await settleIdb();

        expect(winB.storage.writesLocked).toBe(true);
        expect(b.api.tabs.map((t) => t.content)).toEqual(expect.arrayContaining(['typed in second window', 'second window file']));
        expect(b.api.tabs.map((t) => t.content)).not.toContain('alpha body');
        expect(b.api.tabs.some((t) => t._decryptFailed)).toBe(false);
        expect(writeCalls()).toEqual([]);

        await exerciseEverything(b.api);
        expect(writeCalls()).toEqual([]);
        expect(await dumpDb(winB.storage)).toEqual(before);
        await expectSessionIntactOnHealthyRelaunch();
    });
});
