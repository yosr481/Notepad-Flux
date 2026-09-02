import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { createFakeLockManager } from '../test/fakeLocks';

// Storage is mocked so we can drive what "restoring the session" returns.
vi.mock('../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        deleteTab: vi.fn(),
        clearSession: vi.fn(),
    },
}));

// Heavy children stubbed out — this test only cares that App turns the
// context's restoreWarning into a visible toast (A2).
vi.mock('../components/Editor', () => ({ default: () => <div data-testid="editor" /> }));
vi.mock('../components/Layout/MenuBar', () => ({ default: () => null }));
vi.mock('../components/Layout/Tabs', () => ({ default: () => null }));
vi.mock('../components/Layout/StatusBar', () => ({ default: () => null }));
vi.mock('../components/Settings/Settings', () => ({ default: () => null }));
vi.mock('../hooks/useCommands', () => ({
    useCommands: () => ({
        tabs: [{ id: 'tab-1', title: 'Untitled', content: '', isDirty: false }],
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
        closeTab: vi.fn(),
        closeOtherTabs: vi.fn(),
        closeTabsToRight: vi.fn(),
        switchTab: vi.fn(),
        updateTab: vi.fn(),
        reorderTabs: vi.fn(),
        recentFiles: [],
        closeWindow: vi.fn(),
        isPrimaryWindow: true,
    }),
}));

import App from '../App';
import { SessionProvider } from '../context/SessionContext';
import { storage } from '../services/storage';

describe('App restore-warning toast (A2)', () => {
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

    it('renders a toast when a restored tab failed to decrypt', async () => {
        storage.loadSession.mockResolvedValue({
            tabs: [
                { id: 'a', title: 'A', content: 'ok', isDirty: false },
                { id: 'b', title: 'B', content: '', isDirty: false, _decryptFailed: true },
            ],
            activeTabId: 'a',
            recentFiles: [],
            settings: {},
        });

        render(
            <SessionProvider>
                <App />
            </SessionProvider>
        );

        expect(
            await screen.findByText(/couldn.?t be restored/i, {}, { timeout: 3000 })
        ).toBeInTheDocument();
    });

    it('renders no restore-warning toast when every restored tab decrypted', async () => {
        storage.loadSession.mockResolvedValue({
            tabs: [{ id: 'a', title: 'A', content: 'ok', isDirty: false }],
            activeTabId: 'a',
            recentFiles: [],
            settings: {},
        });

        render(
            <SessionProvider>
                <App />
            </SessionProvider>
        );

        await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
        expect(screen.queryByText(/couldn.?t be restored/i)).not.toBeInTheDocument();
    });
});
