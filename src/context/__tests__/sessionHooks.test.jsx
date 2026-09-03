import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor, renderHook } from '@testing-library/react';
import {
    SessionProvider,
    useSession,
    useSettings,
    useTabState,
    useSessionActions,
} from '../SessionContext';

// ---------------------------------------------------------------------------
// ROUND G — SessionContext split into three memoized hooks under one provider
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec left open, stated as decisions):
//
//  * SessionProvider exposes THREE context values, each wrapped in useMemo:
//      useSettings()       -> { settings, updateSettings }
//      useTabState()       -> { tabs, activeTabId, isPrimaryWindow,
//                              isSessionLoaded, recentFiles, restoreWarning }
//      useSessionActions() -> { setActiveTabId, createTab, closeTab, updateTab,
//                              switchTab, setTabs, reorderTabs, addRecentFile,
//                              saveSession, clearSessionData, clearRestoreWarning }
//  * useSession() REMAINS, returning the exact union of all three (same keys,
//    same references) so the legacy SessionContext.test.jsx keeps passing.
//  * Each of the four hooks throws /must be used within a SessionProvider/ when
//    called outside the provider.
//  * Memo identity:
//      - changing ONLY `tabs` (setTabs) does NOT change the identity of
//        useSessionActions() nor useSettings().
//      - changing `settings` (updateSettings) does NOT change the identity of
//        useTabState() nor useSessionActions().
//      - changing `tabs` DOES change the identity of useTabState() (positive
//        control: the memo deps are real, not frozen).

vi.mock('../../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        saveSnapshot: vi.fn(async () => {}),
        getSchemaVersion: vi.fn(async () => 1),
        deleteTab: vi.fn(),
        clearSession: vi.fn(),
    },
}));

const SETTINGS_KEYS = ['settings', 'updateSettings'];
const TAB_STATE_KEYS = [
    'tabs',
    'activeTabId',
    'isPrimaryWindow',
    'isSessionLoaded',
    'recentFiles',
    'restoreWarning',
];
const ACTION_KEYS = [
    'setActiveTabId',
    'createTab',
    'closeTab',
    'updateTab',
    'switchTab',
    'setTabs',
    'reorderTabs',
    'addRecentFile',
    'saveSession',
    'clearSessionData',
    'clearRestoreWarning',
];
// The union must exactly equal what useSession() returns today.
const SESSION_KEYS = [...SETTINGS_KEYS, ...TAB_STATE_KEYS, ...ACTION_KEYS];

function mount() {
    const holder = {};
    function Probe() {
        Object.assign(holder, {
            settings: useSettings(),
            tabState: useTabState(),
            actions: useSessionActions(),
            session: useSession(),
        });
        return null;
    }
    render(
        <SessionProvider>
            <Probe />
        </SessionProvider>
    );
    return { current: holder };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('ROUND G — sub-hook guards (outside provider)', () => {
    it('useSettings throws the SessionProvider guard error outside a provider', () => {
        expect(() => renderHook(() => useSettings())).toThrow(/must be used within a SessionProvider/);
    });
    it('useTabState throws the SessionProvider guard error outside a provider', () => {
        expect(() => renderHook(() => useTabState())).toThrow(/must be used within a SessionProvider/);
    });
    it('useSessionActions throws the SessionProvider guard error outside a provider', () => {
        expect(() => renderHook(() => useSessionActions())).toThrow(/must be used within a SessionProvider/);
    });
    it('useSession still throws its guard error outside a provider (unchanged)', () => {
        expect(() => renderHook(() => useSession())).toThrow(/must be used within a SessionProvider/);
    });
});

describe('ROUND G — sub-hook shapes', () => {
    it('useSettings returns exactly { settings, updateSettings }', () => {
        const ref = mount();
        expect(Object.keys(ref.current.settings).sort()).toEqual([...SETTINGS_KEYS].sort());
        expect(typeof ref.current.settings.updateSettings).toBe('function');
        expect(ref.current.settings.settings).toEqual(expect.objectContaining({ theme: expect.any(String) }));
    });

    it('useTabState returns exactly the six read-only keys', () => {
        const ref = mount();
        expect(Object.keys(ref.current.tabState).sort()).toEqual([...TAB_STATE_KEYS].sort());
        expect(Array.isArray(ref.current.tabState.tabs)).toBe(true);
        expect(typeof ref.current.tabState.activeTabId).toBe('string');
    });

    it('useSessionActions returns exactly the eleven action keys, all functions', () => {
        const ref = mount();
        expect(Object.keys(ref.current.actions).sort()).toEqual([...ACTION_KEYS].sort());
        for (const k of ACTION_KEYS) {
            expect(typeof ref.current.actions[k]).toBe('function');
        }
    });

    it('useSession returns the exact union of the three sub-hooks (same key set as today)', () => {
        const ref = mount();
        expect(new Set(Object.keys(ref.current.session))).toEqual(new Set(SESSION_KEYS));
    });

    it('useSession shares the SAME references as the sub-hooks (no copies)', () => {
        const ref = mount();
        const { settings, tabState, actions, session } = ref.current;
        for (const k of SETTINGS_KEYS) expect(session[k]).toBe(settings[k]);
        for (const k of TAB_STATE_KEYS) expect(session[k]).toBe(tabState[k]);
        for (const k of ACTION_KEYS) expect(session[k]).toBe(actions[k]);
    });
});

describe('ROUND G — memoized context-value identity', () => {
    it('changing only `tabs` does NOT change useSessionActions() identity', async () => {
        const ref = mount();
        await waitFor(() => expect(ref.current.tabState.isSessionLoaded).toBe(true));

        const before = ref.current.actions;
        act(() => {
            ref.current.actions.setTabs([
                { id: 'tab-1', title: 'A', content: '', isDirty: false, filePath: null, fileHandle: null },
                { id: 'tab-2', title: 'B', content: '', isDirty: false, filePath: null, fileHandle: null },
            ]);
        });

        expect(ref.current.tabState.tabs.map(t => t.id)).toEqual(['tab-1', 'tab-2']);
        expect(ref.current.actions).toBe(before); // actions object is stable
    });

    it('changing only `tabs` does NOT change useSettings() identity', async () => {
        const ref = mount();
        await waitFor(() => expect(ref.current.tabState.isSessionLoaded).toBe(true));

        const before = ref.current.settings;
        act(() => {
            ref.current.actions.setTabs([
                { id: 'tab-1', title: 'A', content: 'x', isDirty: true, filePath: null, fileHandle: null },
            ]);
        });

        expect(ref.current.settings).toBe(before);
    });

    it('changing `settings` does NOT change useTabState() identity', async () => {
        const ref = mount();
        await waitFor(() => expect(ref.current.tabState.isSessionLoaded).toBe(true));

        const before = ref.current.tabState;
        act(() => {
            ref.current.settings.updateSettings({ theme: 'dark' });
        });

        expect(ref.current.settings.settings.theme).toBe('dark');
        expect(ref.current.tabState).toBe(before); // tab-state object is stable
    });

    it('changing `settings` does NOT change useSessionActions() identity', async () => {
        const ref = mount();
        await waitFor(() => expect(ref.current.tabState.isSessionLoaded).toBe(true));

        const before = ref.current.actions;
        act(() => {
            ref.current.settings.updateSettings({ theme: 'light' });
        });

        expect(ref.current.actions).toBe(before);
    });

    it('changing `tabs` DOES change useTabState() identity (positive control)', async () => {
        const ref = mount();
        await waitFor(() => expect(ref.current.tabState.isSessionLoaded).toBe(true));

        const before = ref.current.tabState;
        act(() => {
            ref.current.actions.setTabs([
                { id: 'tab-9', title: 'Z', content: '', isDirty: false, filePath: null, fileHandle: null },
            ]);
        });

        expect(ref.current.tabState).not.toBe(before);
        expect(ref.current.tabState.tabs.map(t => t.id)).toEqual(['tab-9']);
    });
});
