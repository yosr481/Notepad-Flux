import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, render, act } from '@testing-library/react';
import { useCommands } from '../useCommands';
import * as SessionContext from '../../context/SessionContext';

// Mock the context
vi.mock('../../context/SessionContext', () => ({
    useSession: vi.fn()
}));

// Mock utils
vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        saveFile: vi.fn(async () => undefined),
        saveFileAs: vi.fn(async (_content, name) => ({ name, handle: {} })),
        isSupported: vi.fn(() => true)
    }
}));

vi.mock('../../utils/dialogs', () => ({
    dialogs: {
        confirm: vi.fn(() => Promise.resolve(true)),
        alert: vi.fn(),
        saveChangesPrompt: vi.fn(async () => 'save'),
    }
}));

describe('useCommands Hook', () => {
    let mockSession;

    beforeEach(() => {
        mockSession = {
            tabs: [{ id: '1', title: 'Tab 1', content: '', isDirty: false }],
            activeTabId: '1',
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(), // context's closeTab matching nomenclature
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            setTabs: vi.fn(),
            recentFiles: [],
            addRecentFile: vi.fn(),
            isPrimaryWindow: true
        };
        SessionContext.useSession.mockReturnValue(mockSession);
    });

    it('newTab should call createTab from context', () => {
        const { result } = renderHook(() => useCommands());

        act(() => {
            result.current.newTab();
        });

        expect(mockSession.createTab).toHaveBeenCalled();
    });

    it('closeTab should call context closeTab if not dirty', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(mockSession.closeTab).toHaveBeenCalledWith('1');
    });

    it('closeTab should update tab if dirty and saved', async () => {
        mockSession.tabs[0].isDirty = true;
        mockSession.tabs[0].content = 'New Content';

        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(mockSession.updateTab).toHaveBeenCalled();
        expect(mockSession.closeTab).toHaveBeenCalledWith('1');
    });
});

describe('useCommands multi-close operates on live tab state (M4/L3)', () => {
    // Harness with real React state so useCommands' live-state ref updates
    // between `await closeTab(...)` iterations, like it does in the running app.
    function renderWithLiveSession(initialTabs, initialActiveId) {
        const api = {};
        function Harness() {
            const [tabs, setTabs] = React.useState(initialTabs);
            const [activeTabId, setActiveTabId] = React.useState(initialActiveId);

            SessionContext.useSession.mockReturnValue({
                tabs,
                activeTabId,
                setActiveTabId,
                createTab: vi.fn(),
                // mirrors the fixed context closeTab: never drop the last tab (L3)
                closeTab: (id) => setTabs(prev => (prev.length <= 1 ? prev : prev.filter(t => t.id !== id))),
                updateTab: vi.fn(),
                switchTab: vi.fn(),
                reorderTabs: vi.fn(),
                setTabs,
                recentFiles: [],
                addRecentFile: vi.fn(),
                isPrimaryWindow: true,
            });

            api.commands = useCommands();
            api.tabs = tabs;
            api.activeTabId = activeTabId;
            return null;
        }
        render(React.createElement(Harness));
        return api;
    }

    const mkTabs = (...ids) => ids.map(id => ({ id, title: `Tab ${id}`, content: '', isDirty: false }));

    it('closeOtherTabs leaves activeTabId pointing at a surviving tab', async () => {
        const api = renderWithLiveSession(mkTabs('1', '2', '3', '4'), '2');

        await act(async () => {
            await api.commands.closeOtherTabs('4');
        });

        expect(api.tabs.map(t => t.id)).toEqual(['4']);
        expect(api.tabs.some(t => t.id === api.activeTabId)).toBe(true);
    });

    it('closeTabsToRight leaves activeTabId pointing at a surviving tab', async () => {
        const api = renderWithLiveSession(mkTabs('1', '2', '3', '4'), '3');

        await act(async () => {
            await api.commands.closeTabsToRight('1');
        });

        expect(api.tabs.map(t => t.id)).toEqual(['1']);
        expect(api.tabs.some(t => t.id === api.activeTabId)).toBe(true);
    });

    it('closing the last remaining tab via context closeTab leaves it in place (L3)', async () => {
        const api = renderWithLiveSession(mkTabs('1'), '1');

        await act(async () => {
            await api.commands.closeTab('1');
        });

        expect(api.tabs.map(t => t.id)).toEqual(['1']);
    });
});
