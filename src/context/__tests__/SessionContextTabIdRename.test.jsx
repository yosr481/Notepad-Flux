import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SessionProvider, useSession, useTabIdRename } from '../SessionContext';
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

const disk = (ids) => ({ tabs: ids.map(id => ({ id, title: `D-${id}`, content: `body ${id}`, isDirty: false, filePath: null, fileHandle: null })), activeTabId: ids[0], recentFiles: [], settings: {} });

function mountPending() {
    let resolveLoad;
    storage.loadSession.mockImplementation(() => new Promise(r => { resolveLoad = r; }));
    const api = {};
    function Probe() { Object.assign(api, useSession(), { rename: useTabIdRename() }); return null; }
    render(<SessionProvider><Probe /></SessionProvider>);
    return { api, finish: (session) => act(async () => { resolveLoad(session); }) };
}

describe('useTabIdRename (a37bb5c)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks();
    });
    afterEach(() => { delete navigator.locks; storage.loadSession.mockImplementation(async () => ({ tabs: [] })); });

    it('is null before any load and with no early tabs', async () => {
        const { api, finish } = mountPending();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        expect(api.rename).toBeNull();
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs.map(t => t.id)).toEqual(['tab-1', 'tab-2']));
        expect(api.rename).toBeNull();
    });

    it('is set to {from,to} when the load renumbers the ACTIVE early tab', async () => {
        const { api, finish } = mountPending();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        expect(api.activeTabId).toBe('tab-2');
        await finish(disk(['tab-1', 'tab-2', 'tab-3']));
        await waitFor(() => expect(api.tabs).toHaveLength(4));
        expect(api.rename).toEqual({ from: 'tab-2', to: api.activeTabId });
        expect(api.activeTabId).not.toBe('tab-2');
        expect(api.tabs.find(t => t.id === api.activeTabId).title).toBe('early.md');
    });

    it('is cleared once the active tab really changes, and stays cleared when switching back', async () => {
        const { api, finish } = mountPending();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.rename).not.toBeNull());
        const renamedTo = api.rename.to;
        act(() => { api.setActiveTabId('tab-1'); });
        await waitFor(() => expect(api.rename).toBeNull());
        act(() => { api.setActiveTabId(renamedTo); });
        expect(api.rename).toBeNull();
    });

    it('is NOT set when only a non-active early tab was renumbered', async () => {
        const { api, finish } = mountPending();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'A.md', content: 'A', filePath: 'A.md', fileHandle: '/p/A.md' }); });   // tab-2, collides
        act(() => { api.createTab({ title: 'B.md', content: 'B', filePath: 'B.md', fileHandle: '/p/B.md' }); });   // tab-3, active, no collision
        await finish(disk(['tab-1', 'tab-2']));
        await waitFor(() => expect(api.tabs).toHaveLength(4));
        expect(api.tabs.find(t => t.title === 'A.md').id).not.toBe('tab-2');     // A was renumbered
        expect(api.activeTabId).toBe('tab-3'); expect(api.rename).toBeNull();
    });

    it('is NOT set when the active early tab did not collide with a restored id', async () => {
        const { api, finish } = mountPending();
        await waitFor(() => expect(storage.loadSession).toHaveBeenCalled());
        act(() => { api.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); });
        await finish(disk(['disk-a', 'disk-b']));
        await waitFor(() => expect(api.tabs).toHaveLength(3));
        expect(api.activeTabId).toBe('tab-2'); expect(api.rename).toBeNull();
    });
});
