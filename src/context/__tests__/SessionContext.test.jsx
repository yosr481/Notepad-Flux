import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionContext';
import { storage } from '../../services/storage';
import { createFakeLockManager } from '../../test/fakeLocks';

vi.mock('../../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        deleteTab: vi.fn(),
        clearSession: vi.fn(),
    },
}));

function renderSession() {
    const api = {};
    function Probe() {
        Object.assign(api, useSession());
        return null;
    }
    render(
        <SessionProvider>
            <Probe />
        </SessionProvider>
    );
    return api;
}

describe('SessionContext.closeTab (L3)', () => {
    it('does not remove the last remaining tab', () => {
        const api = renderSession();
        expect(api.tabs).toHaveLength(1);
        const lastId = api.tabs[0].id;

        act(() => {
            api.closeTab(lastId);
        });

        expect(api.tabs).toHaveLength(1);
        expect(api.tabs[0].id).toBe(lastId);
    });

    it('removes a tab when others remain', () => {
        const api = renderSession();
        act(() => {
            api.setTabs([
                { id: 'tab-1', title: 'A', content: '', isDirty: false },
                { id: 'tab-2', title: 'B', content: '', isDirty: false },
            ]);
        });

        act(() => {
            api.closeTab('tab-1');
        });

        expect(api.tabs.map(t => t.id)).toEqual(['tab-2']);
    });
});

// ---------------------------------------------------------------------------
// TASK 3 — primary-window failover + failover-gap buffering (P0-4 / A1)
// ---------------------------------------------------------------------------
//
// Pinned contract for these tests (choices the spec left open):
//
//  * The secondary path MUST issue a queued (non-ifAvailable) request for
//    'notepad-flux-primary' so it can be promoted when the primary dies.
//    Today it does not, so every test below that depends on promotion fails.
//
//  * On promotion the promoted window calls storage.loadSession() again and
//    ADOPTS that on-disk session as the base, then MERGES its own local tabs
//    on top, by id:
//      - base   = the tabs returned by the post-promotion loadSession()
//      - a local tab is "meaningful" unless it is an untouched scratch tab:
//        content === '' && isDirty !== true && filePath == null &&
//        fileHandle == null && its id is not present on disk
//      - result = base, then for each meaningful local tab:
//          id already in result  -> local entry replaces it (local edit wins)
//          id not in result      -> local entry is appended
//      - each meaningful local tab is persisted via storage.saveTab()
//    So a never-edited secondary contributes nothing (its pristine tab-1 is
//    dropped) and must NOT bulk-persist that pristine array before adopting.
//
//  * restoreWarning: a string when >= 1 restored tab has _decryptFailed, null
//    otherwise. It contains the count and matches /couldn.?t be restored/i.
//    Only the primary / promoted path sets it (a pure secondary does not
//    "restore" anything).

const LOCK_NAME = 'notepad-flux-primary';

const DISK_TABS = [
    { id: 'disk-a', title: 'Alpha', content: 'alpha body', isDirty: false, filePath: null, fileHandle: null },
    { id: 'disk-b', title: 'Beta', content: 'beta body', isDirty: false, filePath: null, fileHandle: null },
];

const diskSession = () => ({
    tabs: DISK_TABS.map(t => ({ ...t })),
    activeTabId: 'disk-a',
    recentFiles: [],
    settings: {},
});

function renderWindows(count) {
    const apiA = {};
    const apiB = {};
    function ProbeA() { Object.assign(apiA, useSession()); return null; }
    function ProbeB() { Object.assign(apiB, useSession()); return null; }
    render(
        <>
            <SessionProvider><ProbeA /></SessionProvider>
            {count === 2 && <SessionProvider><ProbeB /></SessionProvider>}
        </>
    );
    return { apiA, apiB };
}

describe('SessionContext primary-window failover (P0-4 / A1 / A2)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            writable: true,
            value: createFakeLockManager(),
        });
    });

    afterEach(() => {
        delete navigator.locks;
        vi.clearAllMocks();
        storage.loadSession.mockImplementation(async () => ({ tabs: [] }));
    });

    // #2 — first window becomes primary and loads once.
    it('elects the first window as primary and loads the session exactly once', async () => {
        storage.loadSession.mockResolvedValue(diskSession());

        const { apiA } = renderWindows(1);

        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        expect(storage.loadSession).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(apiA.tabs.map(t => t.id)).toEqual(['disk-a', 'disk-b']));
    });

    // #3 — second window is secondary AND parks itself on the wait queue.
    // The current code never queues from the secondary branch -> queue stays 0.
    it('parks the second window as a secondary that QUEUES for the primary lock', async () => {
        storage.loadSession.mockResolvedValue(diskSession());

        const { apiA, apiB } = renderWindows(2);

        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(apiB.isSessionLoaded).toBe(true));
        expect(apiB.isPrimaryWindow).toBe(false);

        await waitFor(() => expect(navigator.locks.__queueLength(LOCK_NAME)).toBe(1));
    });

    // #4 — releasing the primary promotes the queued secondary; it re-loads
    // from disk and then persists.
    it('promotes the queued secondary when the primary releases its lock', async () => {
        storage.loadSession.mockResolvedValue(diskSession());

        const { apiA, apiB } = renderWindows(2);
        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK_NAME)).toBe(1));

        const loadsBefore = storage.loadSession.mock.calls.length;
        const persistsBefore =
            storage.saveTab.mock.calls.length + storage.saveMetadata.mock.calls.length;

        await act(async () => {
            navigator.locks.__release(LOCK_NAME);
        });

        await waitFor(() => expect(apiB.isPrimaryWindow).toBe(true));
        // re-loaded the on-disk session after promotion
        expect(storage.loadSession.mock.calls.length).toBeGreaterThan(loadsBefore);
        // adopted the on-disk tabs
        await waitFor(() => expect(apiB.tabs.map(t => t.id)).toEqual(['disk-a', 'disk-b']));
        // and persisted something once promoted
        await waitFor(() =>
            expect(
                storage.saveTab.mock.calls.length + storage.saveMetadata.mock.calls.length
            ).toBeGreaterThan(persistsBefore)
        );
    });

    // #5 — A1: a never-edited secondary must NOT wipe the on-disk session with
    // its pristine default tab on promotion.
    it('does not bulk-persist the pristine default tab when a never-edited secondary is promoted', async () => {
        storage.loadSession.mockResolvedValue(diskSession());

        const { apiA, apiB } = renderWindows(2);
        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK_NAME)).toBe(1));
        expect(apiB.tabs.map(t => t.id)).toEqual(['tab-1']); // still the pristine default

        await act(async () => {
            navigator.locks.__release(LOCK_NAME);
        });

        await waitFor(() => expect(apiB.isPrimaryWindow).toBe(true));
        // promoted window ends up with exactly the 2 disk tabs, not the 1-tab default
        await waitFor(() => expect(apiB.tabs.map(t => t.id)).toEqual(['disk-a', 'disk-b']));
        expect(storage.saveTab).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: 'tab-1', content: '' })
        );
    });

    // #6 — A1: an edited secondary keeps its local tab through promotion; the
    // disk tabs are merged in around it.
    it('merges a secondary-created tab into the adopted disk session on promotion', async () => {
        storage.loadSession.mockResolvedValue(diskSession());

        const { apiA, apiB } = renderWindows(2);
        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK_NAME)).toBe(1));

        act(() => {
            apiB.createTab({ content: 'local draft' });
        });
        await waitFor(() => expect(apiB.tabs.some(t => t.content === 'local draft')).toBe(true));
        const localId = apiB.tabs.find(t => t.content === 'local draft').id;

        await act(async () => {
            navigator.locks.__release(LOCK_NAME);
        });

        await waitFor(() => expect(apiB.isPrimaryWindow).toBe(true));
        await waitFor(() => {
            const ids = apiB.tabs.map(t => t.id);
            expect(ids).toEqual(expect.arrayContaining(['disk-a', 'disk-b', localId]));
        });
        // the pristine default tab is still dropped, only the real local tab survives
        expect(apiB.tabs.map(t => t.id)).not.toContain('tab-1');
        await waitFor(() =>
            expect(storage.saveTab).toHaveBeenCalledWith(
                expect.objectContaining({ id: localId, content: 'local draft' })
            )
        );
    });

    // #7 — A2: restoreWarning surfaces failed-to-decrypt tabs.
    it('exposes a restoreWarning string when one restored tab failed to decrypt', async () => {
        storage.loadSession.mockResolvedValue({
            tabs: [
                { id: 'disk-a', title: 'Alpha', content: 'ok', isDirty: false },
                { id: 'disk-b', title: 'Beta', content: '', isDirty: false, _decryptFailed: true },
            ],
            activeTabId: 'disk-a',
            recentFiles: [],
            settings: {},
        });

        const { apiA } = renderWindows(1);

        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(apiA.restoreWarning).toEqual(expect.any(String)));
        expect(apiA.restoreWarning).toMatch(/couldn.?t be restored/i);
        expect(apiA.restoreWarning).toMatch(/\b1\b/);
    });

    it('counts every failed tab in the restoreWarning', async () => {
        storage.loadSession.mockResolvedValue({
            tabs: [
                { id: 'disk-a', title: 'A', content: '', _decryptFailed: true },
                { id: 'disk-b', title: 'B', content: '', _decryptFailed: true },
                { id: 'disk-c', title: 'C', content: 'fine' },
            ],
            activeTabId: 'disk-a',
            recentFiles: [],
            settings: {},
        });

        const { apiA } = renderWindows(1);

        await waitFor(() => expect(apiA.restoreWarning).toEqual(expect.any(String)));
        expect(apiA.restoreWarning).toMatch(/\b2\b/);
    });

    it('leaves restoreWarning null when every restored tab decrypted cleanly', async () => {
        storage.loadSession.mockResolvedValue(diskSession());

        const { apiA } = renderWindows(1);

        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(apiA.isSessionLoaded).toBe(true));
        expect(apiA.restoreWarning).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// TASK 4 — closeTab: last-tab delete guard + cancel pending debounced saveTab
//          (P0-5 + P2-close-timer)
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec left open, stated so they read as
// decisions and not oversights):
//
//  * closeTab on a NON-last tab, primary window:
//      - tab is removed from `tabs`
//      - storage.deleteTab IS called exactly once, with that id (a bare string,
//        not an object)
//  * closeTab on the LAST remaining tab, primary window:
//      - `tabs` is completely unchanged (same length, same id)
//      - storage.deleteTab is NOT called at all (the disk row must survive so
//        the tab comes back on next launch) — P0-5
//  * The delete branch is gated on BOTH the close actually having happened AND
//      (isPrimaryWindow && isSessionLoaded). A non-primary window never calls
//      storage.deleteTab.
//  * A pending debounced saveTab for the tab being closed (non-last) is
//      cancelled: the 1000ms setTimeout is cleared and its saveTimers entry
//      removed, so storage.saveTab is never called for that id after the close —
//      P2-close-timer. Observable proxy for "entry removed" is "saveTab not
//      fired for that id" (saveTimers is a private ref).
//  * Closing one tab does NOT disturb a pending debounced save for a DIFFERENT,
//      still-open tab — only the closed tab's timer is cancelled.
//
// All four "new bug" assertions below fail against the current code:
//   - P0-5: storage.deleteTab fires on last-tab close
//   - P2:   the closed tab's debounced saveTab still fires after close

describe('SessionContext.closeTab — primary persistence (P0-5 / P2-close-timer)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            writable: true,
            value: createFakeLockManager(),
        });
    });

    afterEach(() => {
        delete navigator.locks;
        vi.clearAllMocks();
        vi.useRealTimers();
        storage.loadSession.mockImplementation(async () => ({ tabs: [] }));
    });

    // default loadSession mock returns { tabs: [] } -> provider keeps its own
    // single default tab-1, which is exactly the last-tab scenario.
    async function renderPrimary() {
        const api = {};
        function Probe() { Object.assign(api, useSession()); return null; }
        render(<SessionProvider><Probe /></SessionProvider>);
        await waitFor(() => expect(api.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        return api;
    }

    const twoTabs = () => ([
        { id: 'tab-1', title: 'A', content: '', isDirty: false, filePath: null, fileHandle: null },
        { id: 'tab-2', title: 'B', content: '', isDirty: false, filePath: null, fileHandle: null },
    ]);

    // P0-5: the core bug. Closing the only tab must not delete its disk row.
    it('does NOT call storage.deleteTab when closing the last remaining tab', async () => {
        const api = await renderPrimary();
        expect(api.tabs).toHaveLength(1);
        const lastId = api.tabs[0].id;
        storage.deleteTab.mockClear();

        act(() => { api.closeTab(lastId); });

        expect(api.tabs.map(t => t.id)).toEqual([lastId]);
        expect(storage.deleteTab).not.toHaveBeenCalled();
    });

    // regression guard: the normal close path still deletes the disk row.
    it('calls storage.deleteTab(id) once and removes the tab when others remain', async () => {
        const api = await renderPrimary();
        act(() => { api.setTabs(twoTabs()); });
        storage.deleteTab.mockClear();

        act(() => { api.closeTab('tab-1'); });

        expect(api.tabs.map(t => t.id)).toEqual(['tab-2']);
        expect(storage.deleteTab).toHaveBeenCalledTimes(1);
        expect(storage.deleteTab).toHaveBeenCalledWith('tab-1');
    });

    // gate: a non-primary window must never touch the disk row.
    it('does NOT call storage.deleteTab when the window is not primary', async () => {
        delete navigator.locks; // no Web Locks -> provider never becomes primary
        const api = {};
        function Probe() { Object.assign(api, useSession()); return null; }
        render(<SessionProvider><Probe /></SessionProvider>);
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        expect(api.isPrimaryWindow).toBe(false);

        act(() => { api.setTabs(twoTabs()); });
        storage.deleteTab.mockClear();

        act(() => { api.closeTab('tab-1'); });

        expect(api.tabs.map(t => t.id)).toEqual(['tab-2']);
        expect(storage.deleteTab).not.toHaveBeenCalled();
    });

    // P2-close-timer: a pending debounced save for the closed tab is cancelled.
    it('cancels a pending debounced saveTab for the tab being closed', async () => {
        const api = await renderPrimary();
        act(() => { api.setTabs(twoTabs()); });

        vi.useFakeTimers();
        act(() => { api.updateTab('tab-1', { content: 'x' }); }); // schedules 1000ms saveTab
        act(() => { api.closeTab('tab-1'); });
        storage.saveTab.mockClear();
        act(() => { vi.advanceTimersByTime(1100); });

        expect(storage.saveTab).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: 'tab-1' })
        );
    });

    // P2-close-timer: closing tab-1 must not cancel tab-2's pending save.
    it('leaves a different still-open tab’s pending debounced saveTab intact', async () => {
        const api = await renderPrimary();
        act(() => { api.setTabs(twoTabs()); });

        vi.useFakeTimers();
        act(() => { api.updateTab('tab-2', { content: 'keep' }); });
        act(() => { api.closeTab('tab-1'); });
        storage.saveTab.mockClear();
        act(() => { vi.advanceTimersByTime(1100); });

        expect(storage.saveTab).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'tab-2', content: 'keep' })
        );
    });
});

// TASK 8 — tabOrder metadata write is gated on the id-list actually changing (P1-5)
describe('SessionContext tabOrder write gating (P1-5)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', {
            configurable: true, writable: true, value: createFakeLockManager(),
        });
    });
    afterEach(() => {
        delete navigator.locks;
        vi.clearAllMocks();
        vi.useRealTimers();
        storage.loadSession.mockImplementation(async () => ({ tabs: [] }));
    });

    async function renderPrimary() {
        const api = {};
        function Probe() { Object.assign(api, useSession()); return null; }
        render(<SessionProvider><Probe /></SessionProvider>);
        await waitFor(() => expect(api.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(api.isSessionLoaded).toBe(true));
        return api;
    }

    const tabOrderCalls = () =>
        storage.saveMetadata.mock.calls.filter(
            ([arg]) => arg && Object.prototype.hasOwnProperty.call(arg, 'tabOrder')
        );

    it('does NOT re-write tabOrder on content edits (id list unchanged)', async () => {
        const api = await renderPrimary();
        storage.saveMetadata.mockClear();

        act(() => { api.updateTab('tab-1', { content: 'a' }); });
        act(() => { api.updateTab('tab-1', { content: 'ab' }); });
        act(() => { api.updateTab('tab-1', { content: 'abc' }); });

        expect(tabOrderCalls()).toHaveLength(0);
    });

    it('DOES write tabOrder when a tab is added (id list changed)', async () => {
        const api = await renderPrimary();
        storage.saveMetadata.mockClear();

        act(() => { api.createTab({ content: 'new' }); });

        const calls = tabOrderCalls();
        expect(calls.length).toBeGreaterThanOrEqual(1);
        const lastOrder = calls[calls.length - 1][0].tabOrder;
        expect(lastOrder.length).toBe(2);
    });
});
