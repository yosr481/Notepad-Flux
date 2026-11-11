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

// Tabs created while storage.loadSession() is still pending ("early" tabs) must survive the load.
const disk = (ids) => ({ tabs: ids.map(id => ({ id, title: `D-${id}`, content: `body ${id}`, isDirty: false, filePath: null, fileHandle: null })), activeTabId: ids[0], recentFiles: [], settings: {} });

function mountWithPendingLoad() {
    let resolveLoad;
    storage.loadSession.mockImplementation(() => new Promise(r => { resolveLoad = r; }));
    const api = {};
    function Probe() { Object.assign(api, useSession()); return null; }
    render(<SessionProvider><Probe /></SessionProvider>);
    return { api, finish: async (session) => { await act(async () => { resolveLoad(session); }); } };
}

describe('SessionContext: tabs opened before the session load finishes', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks();
    });
    afterEach(() => { delete navigator.locks; storage.loadSession.mockImplementation(async () => ({ tabs: [] })); });

    it('keeps an early file tab after the restored tabs and makes it active; the pristine default tab is not duplicated', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md', isDirty: false }); });
        await finish(disk(['disk-a', 'disk-b']));
        await waitFor(() => expect(api.tabs.map(t => t.title)).toEqual(['D-disk-a', 'D-disk-b', 'early.md']));
        expect(api.tabs.filter(t => t.title === 'Untitled')).toHaveLength(0);
        expect(api.activeTabId).toBe(api.tabs[2].id);
        expect(new Set(api.tabs.map(t => t.id)).size).toBe(3);
    });

    it('early tabs KEEP their ids; restored tabs whose id clashes (the dropped pristine tab included) get fresh ones; order restored-then-early; early stays active; no id reused afterwards', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        expect(api.tabs.find(t => t.title === 'early.md').id).toBe('tab-2');
        await finish(disk(['tab-1', 'tab-2', 'tab-3']));
        await waitFor(() => expect(api.tabs).toHaveLength(4));
        expect(api.tabs.map(t => t.title)).toEqual(['D-tab-1', 'D-tab-2', 'D-tab-3', 'early.md']);
        const early = api.tabs[3];
        expect(early.id).toBe('tab-2'); expect(early.content).toBe('E');          // kept
        expect(api.tabs[2].id).toBe('tab-3');                                     // no clash: untouched
        expect(api.tabs[0].id).not.toBe('tab-1');                                 // clashed with the dropped pristine tab
        expect(api.tabs[1].id).not.toBe('tab-2');                                 // clashed with the early tab
        expect(api.tabs[0].content).toBe('body tab-1'); expect(api.tabs[1].content).toBe('body tab-2')   // restored content intact
        expect(new Set(api.tabs.map(t => t.id)).size).toBe(4);
        expect(api.activeTabId).toBe('tab-2');
        act(() => { api.createTab({ title: 'later' }); });
        expect(new Set(api.tabs.map(t => t.id)).size).toBe(5);
    });

    it('one saveSnapshot writes the renumbered restored tabs AND the early tabs, with the full order and the active early tab', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(storage.saveSnapshot).toHaveBeenCalled());
        expect(storage.saveSnapshot).toHaveBeenCalledTimes(1);
        const snap = storage.saveSnapshot.mock.calls[0][0];
        const restored = api.tabs.filter(t => t.title.startsWith('D-'));
        expect(snap.tabs.map(t => t.id).sort()).toEqual([...restored.map(t => t.id), 'tab-2'].sort());
        expect(snap.tabs.find(t => t.id === 'tab-2').title).toBe('early.md');
        expect(snap.metadata.activeTabId).toBe('tab-2');
        expect(snap.metadata.tabOrder).toEqual(api.tabs.map(t => t.id));
    });

    it('LOAD PATH orphan rows: a restored row whose id no early tab took over is deleted AFTER the snapshot; a row the early tab overwrote is not', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['tab-1', 'tab-2', 'tab-3']));
        await waitFor(() => expect(storage.deleteTab).toHaveBeenCalled());
        const deleted = storage.deleteTab.mock.calls.map(c => c[0]);
        expect(deleted).toEqual(['tab-1']);                                       // tab-2's row is overwritten by the early tab; tab-3 never moved
        expect(storage.deleteTab.mock.invocationCallOrder[0]).toBeGreaterThan(storage.saveSnapshot.mock.invocationCallOrder[0]);
    });

    it('a late update aimed at the dropped pristine tab id hits NO tab (not the restored tab that was renumbered away from it)', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs).toHaveLength(3));
        act(() => { api.updateTab('tab-1', { content: 'LATE KEYSTROKE', title: 'LATE' }); });   // queued before the load, applied after
        expect(api.tabs.some(t => t.content === 'LATE KEYSTROKE' || t.title === 'LATE')).toBe(false);
        expect(api.tabs.find(t => t.title === 'D-tab-1').content).toBe('body tab-1');
    });

    it('and a late update under the EARLY tab id still reaches the early tab, not the restored tab that was renumbered away from that id', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs).toHaveLength(3));
        act(() => { api.updateTab('tab-2', { content: 'E + typed' }); });
        expect(api.tabs.find(t => t.title === 'early.md').content).toBe('E + typed');
        expect(api.tabs.find(t => t.title === 'D-tab-2').content).toBe('body tab-2');
    });

    it('NO early tab: nothing is renumbered, no snapshot, no row deleted, and the next new tab gets the next free id', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs.map(t => t.id)).toEqual(['tab-1', 'tab-2']));
        expect(storage.saveSnapshot).not.toHaveBeenCalled(); expect(storage.deleteTab).not.toHaveBeenCalled();
        act(() => { api.createTab({ title: 'new' }); });
        expect(api.tabs.at(-1).id).toBe('tab-3');
    });

    it('an untouched default tab only: the restored session replaces it exactly (no early tabs, no snapshot write)', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        await finish(disk(['disk-a', 'disk-b']));
        await waitFor(() => expect(api.tabs.map(t => t.id)).toEqual(['disk-a', 'disk-b']));
        expect(api.activeTabId).toBe('disk-a');
        expect(storage.saveSnapshot).not.toHaveBeenCalled();
    });

    it('a default tab the user already typed into counts as an early tab: it keeps tab-1, the restored tab-1 is renumbered, and that row is not deleted', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.updateTab('tab-1', { content: 'typed early', isDirty: true }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs).toHaveLength(3));
        expect(api.tabs.at(-1)).toMatchObject({ id: 'tab-1', content: 'typed early' });
        const restored = api.tabs.find(t => t.title === 'D-tab-1');
        expect(restored.id).not.toBe('tab-1'); expect(restored.content).toBe('body tab-1');
        expect(storage.deleteTab).not.toHaveBeenCalledWith('tab-1');               // the early tab overwrites that row
    });

    it('an empty saved session (nothing on disk) keeps the early tab and the default tab as they are', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish({ tabs: [], recentFiles: [], settings: {} });
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        expect(api.tabs.map(t => t.title)).toEqual(['Untitled', 'early.md']);
        expect(new Set(api.tabs.map(t => t.id)).size).toBe(2);
    });
});
