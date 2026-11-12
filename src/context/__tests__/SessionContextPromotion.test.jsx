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
const diskSession = () => ({
    tabs: [
        { id: 'tab-1', title: 'PrimaryOne', content: 'primary window text one', isDirty: true, filePath: null, fileHandle: null },
        { id: 'tab-2', title: 'PrimaryTwo', content: 'primary window text two', isDirty: true, filePath: null, fileHandle: null },
    ],
    activeTabId: 'tab-1', recentFiles: [], settings: {},
});

// Window B is a secondary (second window). Its own tabs are numbered from its own counter, so they
// reuse ids ('tab-1', 'tab-2') that the primary window's persisted tabs already use.
describe('SessionContext: secondary window promoted to primary (failover) with colliding tab ids', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks();
        storage.loadSession.mockResolvedValue(diskSession());
    });
    afterEach(() => { delete navigator.locks; storage.loadSession.mockImplementation(async () => ({ tabs: [] })); });

    it('KNOWN DEFECT (flagged by the author, not fixed): the promoted window keeps BOTH its own typed tab and every persisted primary tab', async () => {
        const apiA = {}, apiB = {};
        const PA = () => { Object.assign(apiA, useSession()); return null; };
        const PB = () => { Object.assign(apiB, useSession()); return null; };
        render(<><SessionProvider><PA /></SessionProvider><SessionProvider><PB /></SessionProvider></>);
        await waitFor(() => expect(apiA.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK)).toBe(1));
        // the user types into the second window's default tab (id tab-1) and opens another one (tab-2)
        act(() => { apiB.updateTab('tab-1', { content: 'second window typed', isDirty: true }); });
        act(() => { apiB.createTab({ title: 'second.md', content: 'second window file', filePath: 'second.md', fileHandle: '/p/second.md' }); });
        await act(async () => { navigator.locks.__release(LOCK); });
        await waitFor(() => expect(apiB.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(storage.saveSnapshot).toHaveBeenCalled());
        const contents = apiB.tabs.map(t => t.content);
        for (const c of ['primary window text one', 'primary window text two', 'second window typed', 'second window file'])
            expect(contents, `lost: ${c} (tabs: ${JSON.stringify(apiB.tabs.map(t => [t.id, t.title]))})`).toContain(c);
        expect(new Set(apiB.tabs.map(t => t.id)).size).toBe(apiB.tabs.length);
    });

    it('with no id collision both sets of tabs survive the promotion (baseline)', async () => {
        storage.loadSession.mockResolvedValue({ ...diskSession(), tabs: diskSession().tabs.map(t => ({ ...t, id: 'p-' + t.id })), activeTabId: 'p-tab-1' });
        const apiA = {}, apiB = {};
        const PA = () => { Object.assign(apiA, useSession()); return null; };
        const PB = () => { Object.assign(apiB, useSession()); return null; };
        render(<><SessionProvider><PA /></SessionProvider><SessionProvider><PB /></SessionProvider></>);
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK)).toBe(1));
        act(() => { apiB.updateTab('tab-1', { content: 'second window typed', isDirty: true }); });
        await act(async () => { navigator.locks.__release(LOCK); });
        await waitFor(() => expect(apiB.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(apiB.tabs).toHaveLength(3));
        expect(apiB.tabs.map(t => t.content)).toEqual(expect.arrayContaining(['primary window text one', 'second window typed']));
    });

    // 957c1bb: a saved tab renumbered only because of the promoted window's untouched default tab (dropped) leaves its old row behind
    const promote = async (diskIds, localSetup) => {
        storage.loadSession.mockResolvedValue({ tabs: diskIds.map(id => ({ id, title: `D-${id}`, content: `body ${id}`, isDirty: true, filePath: null, fileHandle: null })), activeTabId: diskIds[0], recentFiles: [], settings: {} });
        const apiA = {}, apiB = {};
        const PA = () => { Object.assign(apiA, useSession()); return null; };
        const PB = () => { Object.assign(apiB, useSession()); return null; };
        render(<><SessionProvider><PA /></SessionProvider><SessionProvider><PB /></SessionProvider></>);
        await waitFor(() => expect(navigator.locks.__queueLength(LOCK)).toBe(1));
        localSetup?.(apiB);
        await act(async () => { navigator.locks.__release(LOCK); });
        await waitFor(() => expect(apiB.isPrimaryWindow).toBe(true));
        await waitFor(() => expect(storage.saveSnapshot).toHaveBeenCalled());
        return apiB;
    };

    it('PROMOTION PATH orphan rows: an untouched default tab (dropped) clashes with saved tab-1: that tab is renumbered and its old row is deleted after the snapshot', async () => {
        const apiB = await promote(['tab-1', 'p-x']);          // window B stays pristine: nothing local to keep
        await waitFor(() => expect(storage.deleteTab).toHaveBeenCalledWith('tab-1'));
        expect(apiB.tabs.filter(t => t.title === 'D-tab-1')).toHaveLength(1);       // once, under a fresh id
        expect(apiB.tabs.find(t => t.title === 'D-tab-1').id).not.toBe('tab-1');
        expect(apiB.tabs.map(t => t.title).sort()).toEqual(['D-p-x', 'D-tab-1']);
        expect(storage.deleteTab.mock.invocationCallOrder[0]).toBeGreaterThan(storage.saveSnapshot.mock.invocationCallOrder.at(-1));
        const written = storage.saveSnapshot.mock.calls.at(-1)[0].tabs.map(t => t.id);
        expect(written).not.toContain('tab-1');                                      // nothing writes the stale id back
    });

    it('PROMOTION PATH: a saved row that a local early tab overwrites (same id) is NOT deleted, only ids nobody holds anymore', async () => {
        const apiB = await promote(['tab-1', 'tab-2'], (b) => { act(() => { b.createTab({ title: 'early.md', content: 'E', filePath: 'early.md', fileHandle: '/p/early.md' }); }); });
        const deleted = storage.deleteTab.mock.calls.map(c => c[0]);
        expect(deleted).toContain('tab-1');                                          // only the dropped pristine tab clashed with it
        expect(deleted).not.toContain('tab-2');                                      // the early tab-2 overwrote that row
        expect(apiB.tabs.find(t => t.title === 'early.md').id).toBe('tab-2');
        expect(apiB.tabs.filter(t => t.title.startsWith('D-'))).toHaveLength(2);
    });

    it('PROMOTION PATH: without any clash no row is deleted', async () => {
        await promote(['p-a', 'p-b']);
        expect(storage.deleteTab).not.toHaveBeenCalled();
    });
});
