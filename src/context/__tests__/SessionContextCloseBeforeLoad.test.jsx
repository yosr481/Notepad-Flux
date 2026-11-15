import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionContext';
import { storage } from '../../services/storage';
import { createFakeLockManager } from '../../test/fakeLocks';

vi.mock('../../utils/fileSystem', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, fileSystem: { ...actual.fileSystem, fileExists: vi.fn(async () => null) } };
});
vi.mock('../../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(), saveMetadata: vi.fn(), saveSnapshot: vi.fn(async () => {}),
        getSchemaVersion: vi.fn(async () => 1), deleteTab: vi.fn(), clearSession: vi.fn(),
    },
}));

// Electron close handshake: main waits for the promise returned by the onCloseRequested callback (max 3s)
// and then closes the window. If it resolves while the session is still loading, edits made in that
// window (a slow keyring decrypt on a cold boot) are never written. Close must wait for the load.
const disk = { tabs: [{ id: 'disk-a', title: 'D', content: 'on disk', isDirty: false, filePath: null, fileHandle: null }], activeTabId: 'disk-a', recentFiles: [], settings: {} };

let active; // the close callback main would call now: last registered, not yet unsubscribed
function mount(loadImpl) {
    storage.loadSession.mockImplementation(loadImpl);
    window.electronAPI = { onCloseRequested: vi.fn((cb) => { active = cb; return () => { if (active === cb) active = null; }; }) };
    const api = {};
    function Probe() { Object.assign(api, useSession()); return null; }
    render(<SessionProvider><Probe /></SessionProvider>);
    return api;
}
const snapshotsWith = (text) => storage.saveSnapshot.mock.calls.filter(([s]) => s.tabs.some(t => t.content === text));

describe('SessionContext: window close requested before the session load finishes', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks(); active = null;
    });
    afterEach(() => { delete navigator.locks; delete window.electronAPI; storage.loadSession.mockImplementation(async () => ({ tabs: [] })); });

    it('close callback does not resolve before a snapshot holding the early edit has been saved', async () => {
        let resolveLoad;
        const api = mount(() => new Promise(r => { resolveLoad = r; }));
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'EARLY-TEXT', filePath: null, fileHandle: null, isDirty: true }); });
        await waitFor(() => expect(active).toBeTruthy());

        let resolvedWith = null;
        const closing = active().then(() => { resolvedWith = snapshotsWith('EARLY-TEXT').length; });
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        // still loading: either not resolved yet, or (also acceptable) it already saved the edit
        if (resolvedWith !== null) expect(resolvedWith, 'close confirmed while loading, nothing saved').toBeGreaterThan(0);

        await act(async () => { resolveLoad(disk); });
        await act(async () => { await Promise.race([closing, new Promise(r => setTimeout(r, 2000))]); });
        expect(resolvedWith, 'close callback never resolved after the load finished').not.toBeNull();
        expect(resolvedWith, 'close resolved with no snapshot containing EARLY-TEXT saved').toBeGreaterThan(0);
    });

    it('load fails: close callback still resolves (window is not held open)', async () => {
        let rejectLoad;
        const api = mount(() => new Promise((_, rej) => { rejectLoad = rej; }));
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        await waitFor(() => expect(active).toBeTruthy());
        const closing = active();
        await act(async () => { rejectLoad(Object.assign(new Error('key unavailable'), { code: 'KEY_UNAVAILABLE' })); });
        const outcome = await act(async () => Promise.race([closing.then(() => 'resolved'), new Promise(r => setTimeout(() => r('hung'), 2000))]));
        expect(outcome).toBe('resolved');
        void api;
    });
});
