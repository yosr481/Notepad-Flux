import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { createFakeLockManager } from '../test/fakeLocks';

// Storage mocked so SessionProvider can mount without a real IndexedDB.
vi.mock('../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        deleteTab: vi.fn(),
        clearSession: vi.fn(),
    },
}));

// Heavy / irrelevant children stubbed. Tabs and MenuBar are stubbed to
// expose the close callbacks App wires into them so we can assert the
// live-editor ref is threaded through (P1-7).
vi.mock('../components/Editor', () => ({ default: () => <div data-testid="editor" /> }));
vi.mock('../components/Layout/StatusBar', () => ({ default: () => null }));
vi.mock('../components/Settings/Settings', () => ({ default: () => null }));
vi.mock('../components/Layout/Tabs', () => ({
    default: (props) => (
        <button data-testid="tabs-close" onClick={() => props.onTabClose('tab-1')}>x</button>
    ),
}));
vi.mock('../components/Layout/MenuBar', () => ({
    default: (props) => (
        <button data-testid="menu-close-tab" onClick={props.onCloseTab}>close</button>
    ),
}));

// Mutable control surface for the mocked command layer.
const mockCtl = {
    tabs: [{ id: 'tab-1', title: 'Untitled', content: '', isDirty: false }],
    closeTab: vi.fn(),
    isPrimaryWindow: true,
};

vi.mock('../hooks/useCommands', () => ({
    useCommands: () => ({
        tabs: mockCtl.tabs,
        activeTabId: 'tab-1',
        setActiveTabId: vi.fn(),
        newTab: vi.fn(),
        openFile: vi.fn(),
        openRecentFile: vi.fn(),
        saveFile: vi.fn(),
        saveFileAs: vi.fn(),
        exportToPDF: vi.fn(),
        exportToHTML: vi.fn(),
        print: vi.fn(),
        closeTab: mockCtl.closeTab,
        closeOtherTabs: vi.fn(),
        closeTabsToRight: vi.fn(),
        switchTab: vi.fn(),
        updateTab: vi.fn(),
        reorderTabs: vi.fn(),
        recentFiles: [],
        closeWindow: vi.fn(),
        isPrimaryWindow: mockCtl.isPrimaryWindow,
    }),
}));

import App from '../App';
import { SessionProvider } from '../context/SessionContext';

const renderApp = () =>
    render(
        <SessionProvider>
            <App />
        </SessionProvider>
    );

describe('App beforeunload dirty guard — only non-primary windows block (TASK 7 / QA-10)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            writable: true,
            value: createFakeLockManager(),
        });
        mockCtl.tabs = [{ id: 'tab-1', title: 'Untitled', content: '', isDirty: false }];
        mockCtl.closeTab = vi.fn();
        mockCtl.isPrimaryWindow = true;
    });

    afterEach(() => {
        delete navigator.locks;
        vi.clearAllMocks();
    });

    // The primary window persists the session on close and must never block or
    // nag — session-restore brings unsaved buffers back next launch.
    it('primary window: does NOT preventDefault even when a tab is dirty', () => {
        mockCtl.isPrimaryWindow = true;
        mockCtl.tabs = [{ id: 'tab-1', title: 'X', content: '', isDirty: true }];
        renderApp();

        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);

        expect(e.defaultPrevented).toBe(false);
    });

    // A non-primary window does NOT persist tabs, so it keeps the dirty-guard.
    it('non-primary window: preventDefaults when a tab is dirty', () => {
        mockCtl.isPrimaryWindow = false;
        mockCtl.tabs = [{ id: 'tab-1', title: 'X', content: '', isDirty: true }];
        renderApp();

        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);

        expect(e.defaultPrevented).toBe(true);
    });

    it('non-primary window: does NOT preventDefault when no tab is dirty', () => {
        mockCtl.isPrimaryWindow = false;
        mockCtl.tabs = [{ id: 'tab-1', title: 'X', content: '', isDirty: false }];
        renderApp();

        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);

        expect(e.defaultPrevented).toBe(false);
    });

    it('primary window: does NOT preventDefault when no tab is dirty', () => {
        mockCtl.isPrimaryWindow = true;
        mockCtl.tabs = [{ id: 'tab-1', title: 'X', content: '', isDirty: false }];
        renderApp();

        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);

        expect(e.defaultPrevented).toBe(false);
    });
});

describe('App wiring — close paths thread the live editor ref (P1-7)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            writable: true,
            value: createFakeLockManager(),
        });
        mockCtl.tabs = [{ id: 'tab-1', title: 'Untitled', content: '', isDirty: false }];
        mockCtl.closeTab = vi.fn();
        mockCtl.isPrimaryWindow = true;
    });

    afterEach(() => {
        delete navigator.locks;
        vi.clearAllMocks();
    });

    it('Tabs onTabClose calls closeTab(id)', () => {
        renderApp();
        fireEvent.click(screen.getByTestId('tabs-close'));

        expect(mockCtl.closeTab).toHaveBeenCalledWith('tab-1');
    });

    it('Ctrl+W calls closeTab(activeTabId)', () => {
        renderApp();
        window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'w', bubbles: true }));

        expect(mockCtl.closeTab).toHaveBeenCalledWith('tab-1');
    });

    it('MenuBar onCloseTab calls closeTab(activeTabId)', () => {
        renderApp();
        fireEvent.click(screen.getByTestId('menu-close-tab'));

        expect(mockCtl.closeTab).toHaveBeenCalledWith('tab-1');
    });
});
