import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionContext';
import { storage } from '../../services/storage';
import { openIntoTab } from '../../utils/openIntoTab';
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

const file = (handle, content = 'disk') => ({ title: handle, content, filePath: handle, fileHandle: handle, isDirty: false });

// Mount as primary window with session loaded, so storage writes are live
// (a no-write assertion is meaningless if writes are disabled).
async function mount() {
    const api = {};
    function Probe() { Object.assign(api, useSession()); return null; }
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
    // wait until primary+loaded: a created tab is then persisted
    await waitFor(() => {
        storage.saveTab.mockClear();
        act(() => { api.createTab({ title: 'probe' }); });
        expect(storage.saveTab).toHaveBeenCalledTimes(1);
    });
    while (api.tabs.some(t => t.title === 'probe')) act(() => { api.closeTab(api.tabs.find(t => t.title === 'probe').id); });
    storage.saveTab.mockClear(); storage.saveMetadata.mockClear();
    return api;
}

describe('SessionContext.createTab: opening an already-open file focuses the existing tab', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks();
        delete window.electronAPI;
    });
    afterEach(() => { delete navigator.locks; delete window.electronAPI; });

    it('same fileHandle: no new tab, existing tab becomes active, no storage write', async () => {
        const api = await mount();
        act(() => { api.createTab(file('/a/a.md')); });
        const existing = api.tabs.find(t => t.fileHandle === '/a/a.md');
        act(() => { api.createTab(file('/b/b.md')); });
        expect(api.activeTabId).not.toBe(existing.id);
        const count = api.tabs.length;
        storage.saveTab.mockClear(); storage.saveMetadata.mockClear();

        act(() => { api.createTab(file('/a/a.md')); });

        expect(api.tabs).toHaveLength(count);
        expect(api.tabs.filter(t => t.fileHandle === '/a/a.md')).toHaveLength(1);
        expect(api.activeTabId).toBe(existing.id);
        expect(storage.saveTab).not.toHaveBeenCalled();
    });

    it('dirty existing tab keeps its unsaved content and isDirty (not overwritten by disk content)', async () => {
        const api = await mount();
        act(() => { api.createTab(file('/a/a.md', 'v1')); });
        const id = api.tabs.find(t => t.fileHandle === '/a/a.md').id;
        act(() => { api.updateTab(id, { content: 'unsaved edit', isDirty: true }); });

        act(() => { api.createTab(file('/a/a.md', 'v2-from-disk')); });

        const t = api.tabs.find(t => t.id === id);
        expect(t.content).toBe('unsaved edit');
        expect(t.isDirty).toBe(true);
        expect(api.tabs.filter(t => t.fileHandle === '/a/a.md')).toHaveLength(1);
        expect(api.activeTabId).toBe(id);
    });

    it('different path still opens a new tab', async () => {
        const api = await mount();
        act(() => { api.createTab(file('/a/a.md')); });
        const n = api.tabs.length;
        act(() => { api.createTab(file('/a/other.md')); });
        expect(api.tabs).toHaveLength(n + 1);
    });

    it('non-win32: match is exact and case/separator sensitive', async () => {
        window.electronAPI = { platform: 'linux' };
        const api = await mount();
        act(() => { api.createTab(file('/a/A.md')); });
        const n = api.tabs.length;
        act(() => { api.createTab(file('/a/a.md')); });
        expect(api.tabs).toHaveLength(n + 1);
    });

    it('no electronAPI (web/jsdom): exact match only', async () => {
        const api = await mount();
        act(() => { api.createTab(file('/a/A.md')); });
        const n = api.tabs.length;
        act(() => { api.createTab(file('/a/a.md')); });
        expect(api.tabs).toHaveLength(n + 1);
        act(() => { api.createTab(file('/a/A.md')); });
        expect(api.tabs).toHaveLength(n + 1);
    });

    it('win32: case-insensitive and / == \\', async () => {
        window.electronAPI = { platform: 'win32' };
        const api = await mount();
        act(() => { api.createTab(file('C:\\Notes\\A.md')); });
        const existing = api.tabs.find(t => t.fileHandle === 'C:\\Notes\\A.md');
        act(() => { api.createTab({ title: 'x' }); });
        const n = api.tabs.length;

        act(() => { api.createTab(file('c:/notes/a.md')); });

        expect(api.tabs).toHaveLength(n);
        expect(api.activeTabId).toBe(existing.id);
    });

    it('win32: genuinely different files still get their own tab', async () => {
        window.electronAPI = { platform: 'win32' };
        const api = await mount();
        act(() => { api.createTab(file('C:\\Notes\\A.md')); });
        const n = api.tabs.length;
        act(() => { api.createTab(file('C:\\Notes\\B.md')); });
        expect(api.tabs).toHaveLength(n + 1);
    });

    it.each([[null], [undefined], [''], [{ kind: 'file', name: 'a.md' }]])('fileHandle %j always creates a new tab', async (fh) => {
        const api = await mount();
        // seed with an equal-looking tab so a sloppy equality (null==null, ''=='') would wrongly dedupe
        act(() => { api.createTab({ title: 'one', fileHandle: fh }); });
        const n = api.tabs.length;
        act(() => { api.createTab({ title: 'two', fileHandle: fh }); });
        expect(api.tabs).toHaveLength(n + 1);
        expect(storage.saveTab).toHaveBeenCalledTimes(2);
    });

    it('two FileSystemFileHandle-like objects (web build) are never merged, even the same object', async () => {
        const api = await mount();
        const h = { kind: 'file', name: 'a.md' };
        act(() => { api.createTab({ title: 'one', fileHandle: h }); });
        const n = api.tabs.length;
        act(() => { api.createTab({ title: 'one again', fileHandle: h }); });
        expect(api.tabs).toHaveLength(n + 1);
    });

    it('two back-to-back opens of the same path in one batch yield one tab', async () => {
        const api = await mount();
        const n = api.tabs.length;
        act(() => { api.createTab(file('/a/a.md')); api.createTab(file('/a/a.md')); });
        expect(api.tabs).toHaveLength(n + 1);
        expect(api.tabs.filter(t => t.fileHandle === '/a/a.md')).toHaveLength(1);
    });

    it('via openIntoTab: second open of the same path -> one tab, active, and Recent Files entry moves to top', async () => {
        const api = await mount();
        const open = (name, handle) => act(() => { openIntoTab({ name, content: 'x', handle }, api); });
        open('a.md', '/a/a.md');
        open('b.md', '/b/b.md');
        const n = api.tabs.length;
        open('a.md', '/a/a.md');
        expect(api.tabs).toHaveLength(n);
        expect(api.tabs.find(t => t.id === api.activeTabId).fileHandle).toBe('/a/a.md');
        expect(api.recentFiles.map(f => f.filePath)).toEqual(['a.md', 'b.md']);
    });
});
