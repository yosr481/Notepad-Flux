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

    it('renumbers an early tab whose id collides with a disk tab id, keeps it active, and never reuses ids afterwards', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        const earlyId = api.tabs.find(t => t.title === 'early.md').id;
        expect(earlyId).toBe('tab-2');                       // numbered before the disk ids were known
        await finish(disk(['tab-1', 'tab-2', 'tab-3']));
        await waitFor(() => expect(api.tabs).toHaveLength(4));
        const ids = api.tabs.map(t => t.id);
        expect(new Set(ids).size).toBe(4);
        const early = api.tabs.find(t => t.title === 'early.md');
        expect(early.id).not.toBe('tab-2'); expect(early.content).toBe('E');
        expect(api.tabs.find(t => t.id === 'tab-2').title).toBe('D-tab-2');   // disk tab keeps its id
        expect(api.activeTabId).toBe(early.id);
        act(() => { api.createTab({ title: 'later' }); });
        expect(new Set(api.tabs.map(t => t.id)).size).toBe(5);
    });

    it('persists the early tabs at once through saveSnapshot with the new active id and full tab order', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(storage.saveSnapshot).toHaveBeenCalled());
        const snap = storage.saveSnapshot.mock.calls.at(-1)[0];
        const early = api.tabs.find(t => t.title === 'early.md');
        expect(snap.tabs.map(t => t.id)).toEqual([early.id]);
        expect(snap.metadata.activeTabId).toBe(early.id);
        expect(snap.metadata.tabOrder).toEqual(api.tabs.map(t => t.id));
    });

    it('an untouched default tab only: the restored session replaces it exactly (no early tabs, no snapshot write)', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        await finish(disk(['disk-a', 'disk-b']));
        await waitFor(() => expect(api.tabs.map(t => t.id)).toEqual(['disk-a', 'disk-b']));
        expect(api.activeTabId).toBe('disk-a');
        expect(storage.saveSnapshot).not.toHaveBeenCalled();
    });

    it('a default tab the user already typed into (content set, dirty) counts as an early tab and is kept', async () => {
        const { api, finish } = mountWithPendingLoad();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.updateTab('tab-1', { content: 'typed early', isDirty: true }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs).toHaveLength(3));
        expect(api.tabs.some(t => t.content === 'typed early')).toBe(true);
        expect(api.tabs.find(t => t.content === 'typed early').id).not.toBe('tab-1');
        expect(api.tabs.find(t => t.id === 'tab-1').title).toBe('D-tab-1');
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
