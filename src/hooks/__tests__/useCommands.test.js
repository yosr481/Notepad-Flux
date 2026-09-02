import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, render, act } from '@testing-library/react';
import { useCommands } from '../useCommands';
import * as SessionContext from '../../context/SessionContext';
import { fileSystem } from '../../utils/fileSystem';
import { dialogs } from '../../utils/dialogs';

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

describe('useCommands — a successful save clears dirty via editorRef.markSaved (P1-4)', () => {
    let mockSession;

    beforeEach(() => {
        mockSession = {
            tabs: [{ id: '1', title: 'Tab 1', content: 'old', isDirty: true }],
            activeTabId: '1',
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            setTabs: vi.fn(),
            recentFiles: [],
            addRecentFile: vi.fn(),
            isPrimaryWindow: true,
        };
        SessionContext.useSession.mockReturnValue(mockSession);
    });

    const mkEditorRef = () => ({
        current: { getCurrentContent: () => 'new text', markSaved: vi.fn() },
    });

    it('saveFile (fileHandle branch) calls editorRef.current.markSaved() after the write', async () => {
        mockSession.tabs[0].fileHandle = {};
        const editorRef = mkEditorRef();
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.saveFile(editorRef);
        });

        expect(fileSystem.saveFile).toHaveBeenCalled();
        expect(mockSession.updateTab).toHaveBeenCalledWith('1', expect.objectContaining({ isDirty: false }));
        expect(editorRef.current.markSaved).toHaveBeenCalled(); // fails today: never invoked
    });

    it('saveFileAs calls editorRef.current.markSaved() after the write', async () => {
        const editorRef = mkEditorRef();
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.saveFileAs(editorRef);
        });

        expect(mockSession.updateTab).toHaveBeenCalledWith('1', expect.objectContaining({ isDirty: false }));
        expect(editorRef.current.markSaved).toHaveBeenCalled(); // fails today: never invoked
    });

    it('does not call markSaved when saveFileAs is cancelled (no write happened)', async () => {
        fileSystem.saveFileAs.mockResolvedValueOnce(null);
        const editorRef = mkEditorRef();
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.saveFileAs(editorRef);
        });

        expect(editorRef.current.markSaved).not.toHaveBeenCalled();
    });

    it('does not call markSaved when the write throws', async () => {
        mockSession.tabs[0].fileHandle = {};
        fileSystem.saveFile.mockRejectedValueOnce(new Error('disk full'));
        const editorRef = mkEditorRef();
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.saveFile(editorRef);
        });

        expect(editorRef.current.markSaved).not.toHaveBeenCalled();
    });
});

describe('useCommands — save failures surface a toast (P1-8b)', () => {
    let mockSession;
    let showToast;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');

        showToast = vi.fn();
        mockSession = {
            tabs: [{ id: '1', title: 'MyDoc', content: 'old', isDirty: true, fileHandle: {} }],
            activeTabId: '1',
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            recentFiles: [],
            addRecentFile: vi.fn(),
            isPrimaryWindow: true,
        };
        SessionContext.useSession.mockReturnValue(mockSession);
    });

    const mkEditorRef = () => ({ current: { getCurrentContent: () => 'old', markSaved: vi.fn() } });

    it('saveFile: on a fileHandle-write throw, showToast is called with a message naming the tab title', async () => {
        fileSystem.saveFile.mockRejectedValueOnce(new Error('disk full'));
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.saveFile(mkEditorRef());
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('MyDoc'));
    });

    it('saveFile: on the fallback (download) branch throw, showToast is called with the tab title', async () => {
        fileSystem.isSupported.mockReturnValue(false);
        mockSession.tabs[0].fileHandle = undefined;
        mockSession.tabs[0].filePath = 'MyDoc.md';
        fileSystem.saveFileAs.mockRejectedValueOnce(new Error('nope'));
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.saveFile(mkEditorRef());
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('MyDoc'));
    });

    it('saveFileAs: on a throw, showToast is called with a message naming the tab title', async () => {
        mockSession.tabs[0].fileHandle = undefined;
        fileSystem.saveFileAs.mockRejectedValueOnce(new Error('nope'));
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.saveFileAs(mkEditorRef());
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('MyDoc'));
    });

    it('saveFile: on the success path showToast is NOT called', async () => {
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.saveFile(mkEditorRef());
        });

        expect(showToast).not.toHaveBeenCalled();
    });
});

describe('useCommands — close-save throw shows a toast AND aborts the close (P1-8b)', () => {
    let mockSession;
    let showToast;
    let closeSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');

        showToast = vi.fn();
        mockSession = {
            tabs: [
                { id: '1', title: 'DirtyDoc', content: 'old', isDirty: true, fileHandle: {} },
                { id: '2', title: 'Tab 2', content: '', isDirty: false },
            ],
            activeTabId: '1',
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            recentFiles: [],
            addRecentFile: vi.fn(),
            isPrimaryWindow: false, // closeWindow only runs its per-tab loop for non-primary windows
        };
        SessionContext.useSession.mockReturnValue(mockSession);
        closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
    });

    afterEach(() => {
        closeSpy.mockRestore();
    });

    it('closeTab: save throw -> showToast called and the tab is NOT closed', async () => {
        fileSystem.saveFile.mockRejectedValueOnce(new Error('disk full'));
        const editorRef = { current: { getCurrentContent: () => 'old' } };
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTab('1', { editorRef });
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('DirtyDoc'));
        expect(mockSession.closeTab).not.toHaveBeenCalled();
        expect(mockSession.createTab).not.toHaveBeenCalled();
    });

    it('closeWindow: save throw -> showToast called and window.close is NOT reached', async () => {
        fileSystem.saveFile.mockRejectedValueOnce(new Error('disk full'));
        const editorRef = { current: { getCurrentContent: () => 'old' } };
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeWindow(editorRef);
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('DirtyDoc'));
        expect(closeSpy).not.toHaveBeenCalled();
    });
});

describe('useCommands — close-save flushes the live editor for the active tab (P1-7)', () => {
    let mockSession;
    let showToast;
    let closeSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');

        showToast = vi.fn();
        mockSession = {
            tabs: [
                { id: '1', title: 'Active', content: 'stale', isDirty: true, fileHandle: {} },
                { id: '2', title: 'Other', content: 'stale2', isDirty: true, fileHandle: {} },
            ],
            activeTabId: '1',
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            recentFiles: [],
            addRecentFile: vi.fn(),
            isPrimaryWindow: false,
        };
        SessionContext.useSession.mockReturnValue(mockSession);
    });

    afterEach(() => {
        closeSpy.mockRestore();
    });

    const liveRef = () => ({ current: { getCurrentContent: () => 'LIVE' } });

    it('closeTab(active, {editorRef}): saves editorRef.current.getCurrentContent() ("LIVE"), not tab.content', async () => {
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTab('1', { editorRef: liveRef() });
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTab(non-active, {editorRef}): still saves that tab.content ("stale2"), never the live content', async () => {
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTab('2', { editorRef: liveRef() });
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale2');
    });

    it('closeTab(active) with no editorRef: falls back to tab.content ("stale")', async () => {
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale');
    });

    it('closeTab(active, {editorRef}) with no fileHandle: passes "LIVE" to saveFileAs', async () => {
        mockSession.tabs[0].fileHandle = undefined;
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTab('1', { editorRef: liveRef() });
        });

        expect(fileSystem.saveFileAs).toHaveBeenCalledWith('LIVE', expect.anything());
    });

    it('closeWindow(editorRef): flushes the live content for the active tab', async () => {
        mockSession.tabs[1].isDirty = false; // only the active tab is dirty
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeWindow(liveRef());
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeWindow(editorRef): a non-active dirty tab in the loop still saves its own content', async () => {
        mockSession.tabs[0].isDirty = false; // active tab clean, "Other" dirty
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeWindow(liveRef());
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale2');
        expect(fileSystem.saveFile).not.toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeOtherTabs(id, editorRef) forwards editorRef so the active tab it closes is flushed', async () => {
        // active tab '1' is one of the tabs closeOtherTabs('2') will close
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeOtherTabs('2', liveRef());
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTabsToRight(id, editorRef) forwards editorRef so the active tab it closes is flushed', async () => {
        // keep '1', close everything to its right; make '2' the active dirty tab
        mockSession.activeTabId = '2';
        mockSession.tabs[0].isDirty = false;
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTabsToRight('1', liveRef());
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });
});
