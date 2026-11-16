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

const LOCK = 'notepad-flux-primary';
const disk = () => ({
    tabs: [{ id: 'p-1', title: 'DiskTab', content: 'on disk', isDirty: true, filePath: null, fileHandle: null }],
    activeTabId: 'p-1', recentFiles: [], settings: {},
});
const tick = async (n = 10) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

// A close that lands after the lock grant (onPromoted has run) but before React has rendered
// isSessionLoaded=false must still wait for the promotion merge. Everything below happens inside one
// act() scope so React cannot render between the grant and the close request.
describe('SessionContext: close requested right after a promotion lock grant', () => {
    let closeCb, apiB;
    beforeEach(async () => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks(); apiB = {};
        window.electronAPI = { onCloseRequested: vi.fn((cb) => { closeCb = cb; return () => {}; }) };
        const PA = () => { useSession(); return null; };
        const PB = () => { Object.assign(apiB, useSession()); return null; };
        // window A takes the lock; window B (the one under test, registered second) queues
        render(<><SessionProvider><PA /></SessionProvider><SessionProvider><PB /></SessionProvider></>);
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK)).toBe(1));
        await waitFor(() => expect(apiB.isSessionLoaded).toBe(true));
        // closeCb is whichever provider subscribed last = B
    });
    afterEach(() => { delete navigator.locks; delete window.electronAPI; storage.loadSession.mockImplementation(async () => ({ tabs: [] })); });

    it('does not flush/confirm before the merge finishes, then flushes the merged tabs', async () => {
        let finishLoad;
        storage.loadSession.mockImplementation(() => new Promise(r => { finishLoad = () => r(disk()); }));
        let settled = false, p;
        await act(async () => {
            navigator.locks.__release(LOCK);
            await tick();                       // onPromoted ran (setIsSessionLoaded(false) queued, not rendered)
            expect(finishLoad, 'promotion did not start loading').toBeTypeOf('function');
            p = closeCb().then(() => { settled = true; });
            await tick();
        });
        await act(async () => { await tick(); });
        expect(settled, 'close confirmed before the promotion merge finished').toBe(false);
        expect(storage.saveSnapshot).not.toHaveBeenCalled();

        await act(async () => { finishLoad(); await tick(30); }); // render + gate-resolving effect need the act scope to exit
        await p;
        expect(settled).toBe(true);
        const calls = storage.saveSnapshot.mock.calls;
        expect(calls.length, 'merge snapshot + close flush').toBeGreaterThanOrEqual(2);
        expect(calls.at(-1)[0].tabs.map(t => t.title)).toContain('DiskTab');
    });

    it('merge completing in the same tick as the close (batched false->true) still lets the close finish', async () => {
        storage.loadSession.mockImplementation(async () => disk());
        let p;
        await act(async () => {
            navigator.locks.__release(LOCK);
            await tick();
            p = closeCb();
            await tick(30);                     // merge finishes; React still has not rendered between
        });
        const outcome = await Promise.race([p.then(() => 'done'), new Promise(r => setTimeout(() => r('HANG'), 1000))]);
        expect(outcome).toBe('done');
    });
});
