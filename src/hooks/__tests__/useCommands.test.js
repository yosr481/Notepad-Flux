import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, render, act } from '@testing-library/react';
import { useCommands } from '../useCommands';
import * as SessionContext from '../../context/SessionContext';
import { fileSystem } from '../../utils/fileSystem';
import { dialogs } from '../../utils/dialogs';

// Mock the context
vi.mock('../../context/SessionContext', () => ({
    useTabState: vi.fn(),
    useSessionActions: vi.fn()
}));

// Mock utils
vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        openFile: vi.fn(async () => null),
        openFileFromHandle: vi.fn(async () => { throw new Error('nope'); }),
        openFileFromPath: vi.fn(async () => { throw new Error('nope'); }),
        saveFile: vi.fn(async () => undefined),
        saveFileAs: vi.fn(async (_content, name) => ({ name, handle: {} })),
        fileExists: vi.fn(async () => true),
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
    let mockTabState;
    let mockActions;

    beforeEach(() => {
        mockTabState = {
            tabs: [{ id: '1', title: 'Tab 1', content: '', isDirty: false }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            setTabs: vi.fn(),
            addRecentFile: vi.fn(),
            removeRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    it('newTab should call createTab from context', () => {
        const { result } = renderHook(() => useCommands());

        act(() => {
            result.current.newTab();
        });

        expect(mockActions.createTab).toHaveBeenCalled();
    });

    it('closeTab should call context closeTab if not dirty', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(mockActions.closeTab).toHaveBeenCalledWith('1');
    });

    it('closeTab should update tab if dirty and saved', async () => {
        mockTabState.tabs[0].isDirty = true;
        mockTabState.tabs[0].content = 'New Content';

        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(mockActions.updateTab).toHaveBeenCalled();
        expect(mockActions.closeTab).toHaveBeenCalledWith('1');
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

            SessionContext.useTabState.mockReturnValue({
                tabs,
                activeTabId,
                isPrimaryWindow: true,
                isSessionLoaded: true,
                recentFiles: [],
                restoreWarning: null
            });
            SessionContext.useSessionActions.mockReturnValue({
                setActiveTabId,
                createTab: vi.fn(),
                // mirrors the fixed context closeTab: never drop the last tab (L3)
                closeTab: (id) => setTabs(prev => (prev.length <= 1 ? prev : prev.filter(t => t.id !== id))),
                updateTab: vi.fn(),
                switchTab: vi.fn(),
                reorderTabs: vi.fn(),
                setTabs,
                addRecentFile: vi.fn()
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
    let mockTabState;
    let mockActions;

    beforeEach(() => {
        mockTabState = {
            tabs: [{ id: '1', title: 'Tab 1', content: 'old', isDirty: true }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            setTabs: vi.fn(),
            addRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    const mkEditorRef = () => ({
        current: { getCurrentContent: () => 'new text', markSaved: vi.fn() },
    });

    it('saveFile (fileHandle branch) calls editorRef.current.markSaved() after the write', async () => {
        mockTabState.tabs[0].fileHandle = {};
        const editorRef = mkEditorRef();
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.saveFile(editorRef);
        });

        expect(fileSystem.saveFile).toHaveBeenCalled();
        expect(mockActions.updateTab).toHaveBeenCalledWith('1', expect.objectContaining({ isDirty: false }));
        expect(editorRef.current.markSaved).toHaveBeenCalled(); // fails today: never invoked
    });

    it('saveFileAs calls editorRef.current.markSaved() after the write', async () => {
        const editorRef = mkEditorRef();
        const { result } = renderHook(() => useCommands());

        await act(async () => {
            await result.current.saveFileAs(editorRef);
        });

        expect(mockActions.updateTab).toHaveBeenCalledWith('1', expect.objectContaining({ isDirty: false }));
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
        mockTabState.tabs[0].fileHandle = {};
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
    let mockTabState;
    let mockActions;
    let showToast;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');

        showToast = vi.fn();
        mockTabState = {
            tabs: [{ id: '1', title: 'MyDoc', content: 'old', isDirty: true, fileHandle: {} }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            addRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
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
        mockTabState.tabs[0].fileHandle = undefined;
        mockTabState.tabs[0].filePath = 'MyDoc.md';
        fileSystem.saveFileAs.mockRejectedValueOnce(new Error('nope'));
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.saveFile(mkEditorRef());
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('MyDoc'));
    });

    it('saveFileAs: on a throw, showToast is called with a message naming the tab title', async () => {
        mockTabState.tabs[0].fileHandle = undefined;
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
    let mockTabState;
    let mockActions;
    let showToast;
    let closeSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');

        showToast = vi.fn();
        mockTabState = {
            tabs: [
                { id: '1', title: 'DirtyDoc', content: 'old', isDirty: true, fileHandle: {} },
                { id: '2', title: 'Tab 2', content: '', isDirty: false },
            ],
            activeTabId: '1',
            isPrimaryWindow: false,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            addRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
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
        expect(mockActions.closeTab).not.toHaveBeenCalled();
        expect(mockActions.createTab).not.toHaveBeenCalled();
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

describe('useCommands — openFile failures surface a toast (QA-1 / finding-7 parity)', () => {
    let mockTabState;
    let mockActions;
    let showToast;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.openFile.mockImplementation(async () => null);
        showToast = vi.fn();
        mockTabState = {
            tabs: [{ id: '1', title: 'Tab 1', content: '', isDirty: false }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            addRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    it('openFile: when fileSystem.openFile rejects, showToast is called with a string containing the error message', async () => {
        fileSystem.openFile.mockRejectedValueOnce(new Error('EACCES: permission denied'));
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.openFile();
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('EACCES: permission denied'));
        expect(mockActions.createTab).not.toHaveBeenCalled();
    });

    it('openFile: when the picker is cancelled (resolves null), showToast is NOT called and nothing throws', async () => {
        fileSystem.openFile.mockResolvedValueOnce(null);
        const { result } = renderHook(() => useCommands(showToast));

        let threw = false;
        await act(async () => {
            try {
                await result.current.openFile();
            } catch {
                threw = true;
            }
        });

        expect(threw).toBe(false);
        expect(showToast).not.toHaveBeenCalled();
        expect(mockActions.createTab).not.toHaveBeenCalled();
    });
});

describe('useCommands — close-save flushes the live editor for the active tab (P1-7)', () => {
    let mockTabState;
    let mockActions;
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
        mockTabState = {
            tabs: [
                { id: '1', title: 'Active', content: 'stale', isDirty: true, fileHandle: {} },
                { id: '2', title: 'Other', content: 'stale2', isDirty: true, fileHandle: {} },
            ],
            activeTabId: '1',
            isPrimaryWindow: false,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            addRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    afterEach(() => {
        closeSpy.mockRestore();
    });

    // ROUND G: editorRef is now the 2nd arg to useCommands, not threaded through
    // closeTab options / the multi-close params. One stable ref per test.
    const liveRef = () => ({ current: { getCurrentContent: () => 'LIVE' } });

    it('closeTab(active): saves editorRef.current.getCurrentContent() ("LIVE"), not tab.content', async () => {
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTab(non-active): still saves that tab.content ("stale2"), never the live content', async () => {
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeTab('2');
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale2');
    });

    it('closeTab(active) with no editorRef on the hook: falls back to tab.content ("stale")', async () => {
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale');
    });

    it('closeTab(active) with no fileHandle: passes "LIVE" to saveFileAs', async () => {
        mockTabState.tabs[0].fileHandle = undefined;
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeTab('1');
        });

        expect(fileSystem.saveFileAs).toHaveBeenCalledWith('LIVE', expect.anything());
    });

    it('closeWindow(): flushes the live content for the active tab', async () => {
        mockTabState.tabs[1].isDirty = false; // only the active tab is dirty
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeWindow();
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeWindow(): a non-active dirty tab in the loop still saves its own content', async () => {
        mockTabState.tabs[0].isDirty = false; // active tab clean, "Other" dirty
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeWindow();
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale2');
        expect(fileSystem.saveFile).not.toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeOtherTabs(id) flushes the active tab it closes via the hook editorRef', async () => {
        // active tab '1' is one of the tabs closeOtherTabs('2') will close
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeOtherTabs('2');
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTabsToRight(id) flushes the active tab it closes via the hook editorRef', async () => {
        // keep '1', close everything to its right; make '2' the active dirty tab
        mockTabState.activeTabId = '2';
        mockTabState.tabs[0].isDirty = false;
        const { result } = renderHook(() => useCommands(showToast, liveRef()));

        await act(async () => {
            await result.current.closeTabsToRight('1');
        });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });
});

describe('openRecentFile when the file is gone (QA finding 9 / TASK 6)', () => {
    // Pinned flow when BOTH the fileHandle open and the filePath open fail:
    //  1. dialogs.confirm({ title: 'File not found', ... , confirmLabel: 'Locate…',
    //     cancelLabel: 'Cancel' }) is shown FIRST — before any native picker.
    //  2. confirm -> false: removeRecentFile(filePath) is called, then return.
    //     The native picker (fileSystem.openFile) is NOT invoked. No toast, no alert.
    //  3. confirm -> true: fileSystem.openFile() runs. If it returns null (picker
    //     cancelled) -> just return: no createTab, no alert, no throw, no
    //     removeRecentFile.
    //  4. confirm -> true and openFile returns a file -> createTab with that file.
    //  The outer catch (genuine unexpected errors) still uses dialogs.alert — not
    //  exercised here.
    let mockTabState;
    let mockActions;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.isSupported.mockReturnValue(true);
        fileSystem.openFileFromHandle.mockImplementation(async () => { throw new Error('nope'); });
        fileSystem.openFileFromPath.mockImplementation(async () => { throw new Error('nope'); });
        fileSystem.openFile.mockImplementation(async () => null);

        mockTabState = {
            tabs: [{ id: '1', title: 'Tab 1', content: '', isDirty: false }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            setTabs: vi.fn(),
            addRecentFile: vi.fn(),
            removeRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    const FILE_PATH = '/old/path/notes.md';
    const FILE_NAME = 'notes.md';

    const callOpenRecent = async (result) => {
        let threw = false;
        await act(async () => {
            try {
                await result.current.openRecentFile(FILE_PATH, FILE_NAME, {});
            } catch {
                threw = true;
            }
        });
        return threw;
    };

    it('calls dialogs.confirm BEFORE fileSystem.openFile', async () => {
        const order = [];
        dialogs.confirm.mockImplementation(async () => { order.push('confirm'); return true; });
        fileSystem.openFile.mockImplementation(async () => { order.push('openFile'); return null; });

        const { result } = renderHook(() => useCommands());
        const threw = await callOpenRecent(result);

        expect(threw).toBe(false);
        expect(order).toEqual(['confirm', 'openFile']);
    });

    it('confirm -> false: picker NOT opened, removeRecentFile(filePath) called, no throw', async () => {
        dialogs.confirm.mockResolvedValue(false);

        const { result } = renderHook(() => useCommands());
        const threw = await callOpenRecent(result);

        expect(threw).toBe(false);
        expect(fileSystem.openFile).not.toHaveBeenCalled();
        expect(mockActions.removeRecentFile).toHaveBeenCalledWith(FILE_PATH);
        expect(mockActions.createTab).not.toHaveBeenCalled();
        expect(dialogs.alert).not.toHaveBeenCalled();
    });

    it('confirm -> true, picker cancelled (null): no createTab, no alert, no removeRecentFile, no throw', async () => {
        dialogs.confirm.mockResolvedValue(true);
        fileSystem.openFile.mockResolvedValue(null);

        const { result } = renderHook(() => useCommands());
        const threw = await callOpenRecent(result);

        expect(threw).toBe(false);
        expect(fileSystem.openFile).toHaveBeenCalled();
        expect(mockActions.createTab).not.toHaveBeenCalled();
        expect(dialogs.alert).not.toHaveBeenCalled();
        expect(mockActions.removeRecentFile).not.toHaveBeenCalled();
    });

    it('confirm -> true, picker returns a file: createTab is called with that file', async () => {
        dialogs.confirm.mockResolvedValue(true);
        fileSystem.openFile.mockResolvedValue({ name: 'relocated.md', content: 'hello', handle: {} });

        const { result } = renderHook(() => useCommands());
        const threw = await callOpenRecent(result);

        expect(threw).toBe(false);
        expect(mockActions.createTab).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'relocated.md', content: 'hello', isDirty: false })
        );
    });
});

// ---------------------------------------------------------------------------
// TASK 7 / QA finding 10 — closeWindow must still prompt for a LONE dirty tab
// on a non-primary window, and the hook must expose isPrimaryWindow.
// ---------------------------------------------------------------------------
//
// Pinned contract:
//  * useCommands()'s returned object includes `isPrimaryWindow` (passed through
//    from useTabState) so App.jsx can gate its beforeunload guard on it.
//  * closeWindow() on a NON-primary window: the dirty-check + saveChangesPrompt
//    + save runs for EVERY dirty tab, including the last remaining one. The
//    old `if (liveState.current.tabs.length <= 1) break;` guard must not skip
//    the prompt (data-loss gap). Only the final context closeTab is still
//    guarded so one default tab survives.
//  * choice 'cancel' aborts the whole close: window.close() is not reached.
//  * choice 'save' + a successful persist: window.close() IS reached; the
//    context-level closeTab is NOT called for that last tab (it stays).

describe('useCommands — isPrimaryWindow passthrough + lone-dirty-tab closeWindow prompt (TASK 7)', () => {
    let mockTabState;
    let mockActions;
    let showToast;
    let closeSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');

        showToast = vi.fn();
        mockTabState = {
            tabs: [{ id: '1', title: 'LoneDirty', content: 'old', isDirty: true, fileHandle: {} }],
            activeTabId: '1',
            isPrimaryWindow: false,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null
        };
        mockActions = {
            setActiveTabId: vi.fn(),
            createTab: vi.fn(),
            closeTab: vi.fn(),
            updateTab: vi.fn(),
            switchTab: vi.fn(),
            reorderTabs: vi.fn(),
            addRecentFile: vi.fn()
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
        closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
    });

    afterEach(() => {
        closeSpy.mockRestore();
    });

    it('exposes isPrimaryWindow from the hook (mirrors useTabState)', () => {
        const { result } = renderHook(() => useCommands(showToast));
        expect(result.current.isPrimaryWindow).toBe(false);

        mockTabState.isPrimaryWindow = true;
        const { result: r2 } = renderHook(() => useCommands(showToast));
        expect(r2.current.isPrimaryWindow).toBe(true);
    });

    it('closeWindow(): a single dirty tab still triggers dialogs.saveChangesPrompt', async () => {
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeWindow();
        });

        expect(dialogs.saveChangesPrompt).toHaveBeenCalled();
    });

    it('closeWindow(): choice "cancel" on the lone dirty tab aborts — window.close not called', async () => {
        dialogs.saveChangesPrompt.mockImplementation(async () => 'cancel');
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeWindow();
        });

        expect(closeSpy).not.toHaveBeenCalled();
    });

    it('closeWindow(): choice "save" on the lone dirty tab saves, then closes, keeping the last tab', async () => {
        dialogs.saveChangesPrompt.mockImplementation(async () => 'save');
        const { result } = renderHook(() => useCommands(showToast));

        await act(async () => {
            await result.current.closeWindow();
        });

        expect(fileSystem.saveFile).toHaveBeenCalled();
        expect(closeSpy).toHaveBeenCalled();
        expect(mockActions.closeTab).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// TASK 9 — a fileMissing tab must NOT save in place; it routes to Save As,
// and a successful Save As clears the flag (QA finding 12).
// ---------------------------------------------------------------------------
//
// Pinned contract:
//  * persistTab's in-place branches are gated on `!tab.fileMissing`:
//      - `tab.fileHandle && !tab.fileMissing`  (native handle write)
//      - `!canSaveInPlace() && tab.filePath && !tab.fileMissing` (path write)
//    So a fileMissing tab — even one that still has a fileHandle / filePath —
//    falls through to the title-based `fileSystem.saveFileAs(content, tab.title)`
//    branch. `fileSystem.saveFile` is never called for it.
//  * On a successful Save As the tab's update payload carries `fileMissing:false`
//    (both via persistTab's final branch and via the saveFileAs command).
//  * The cached buffer is still the content that gets written.
//  * A normal tab (fileMissing falsy) with a fileHandle is unaffected — it still
//    saves in place via fileSystem.saveFile.

describe('useCommands — a fileMissing tab saves through Save As (TASK 9 / QA finding 12)', () => {
    let mockTabState;
    let mockActions;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async () => ({ name: 'x.md', handle: '/new/x.md' }));
        fileSystem.isSupported.mockReturnValue(true);

        mockTabState = {
            tabs: [{
                id: '1', title: 'x.md', content: 'cached', isDirty: true,
                fileHandle: '/abs/x.md', filePath: '/abs/x.md', fileMissing: true,
            }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null,
        };
        mockActions = {
            setActiveTabId: vi.fn(), createTab: vi.fn(), closeTab: vi.fn(),
            updateTab: vi.fn(), switchTab: vi.fn(), reorderTabs: vi.fn(),
            setTabs: vi.fn(), addRecentFile: vi.fn(), removeRecentFile: vi.fn(),
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    const mkEditorRef = () => ({ current: { getCurrentContent: () => 'live text', markSaved: vi.fn() } });

    it('saveFile: routes a fileMissing tab to fileSystem.saveFileAs, never fileSystem.saveFile', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef()); });

        expect(fileSystem.saveFileAs).toHaveBeenCalledWith('live text', 'x.md');
        expect(fileSystem.saveFile).not.toHaveBeenCalled();
    });

    it('saveFile: a successful Save As clears fileMissing (updateTab { fileMissing: false, isDirty: false })', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef()); });

        expect(mockActions.updateTab).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({ fileMissing: false, isDirty: false }),
        );
    });

    it('saveFileAs command: a successful write clears fileMissing on the active tab', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFileAs(mkEditorRef()); });

        expect(mockActions.updateTab).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({ fileMissing: false }),
        );
    });

    it('regression: a normal tab (fileMissing falsy) with a fileHandle still saves in place', async () => {
        mockTabState.tabs[0].fileMissing = false;
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef()); });

        expect(fileSystem.saveFile).toHaveBeenCalled();
        expect(fileSystem.saveFileAs).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// TASK 10 — persistTab normalizes line endings + charset on the disk write only
// ---------------------------------------------------------------------------
//
// Pinned contract:
//  * persistTab computes the on-disk form ONCE at the top:
//      outContent = applyCharset(normalizeEol(content, tab.eol || 'LF'),
//                                tab.charset || 'UTF-8')
//    and passes `outContent` to every fileSystem.saveFile / saveFileAs call.
//  * The editor works in LF internally: the updateTab({ content, ... }) calls
//    still store the ORIGINAL `content`, NOT the normalized bytes.
//  * A tab with eol 'LF' + charset 'UTF-8' (or missing both) writes the content
//    through unchanged — regression guard.

describe('useCommands — persistTab EOL + charset normalization on save (TASK 10)', () => {
    let mockTabState;
    let mockActions;

    beforeEach(() => {
        vi.clearAllMocks();
        fileSystem.saveFile.mockImplementation(async () => undefined);
        fileSystem.saveFileAs.mockImplementation(async (_c, name) => ({ name, handle: {} }));
        fileSystem.isSupported.mockReturnValue(true);

        mockTabState = {
            tabs: [{
                id: '1', title: 'note.md', content: 'a\nb', isDirty: true,
                fileHandle: {}, eol: 'CRLF', charset: 'UTF-8',
            }],
            activeTabId: '1',
            isPrimaryWindow: true,
            isSessionLoaded: true,
            recentFiles: [],
            restoreWarning: null,
        };
        mockActions = {
            setActiveTabId: vi.fn(), createTab: vi.fn(), closeTab: vi.fn(),
            updateTab: vi.fn(), switchTab: vi.fn(), reorderTabs: vi.fn(),
            setTabs: vi.fn(), addRecentFile: vi.fn(), removeRecentFile: vi.fn(),
        };
        SessionContext.useTabState.mockReturnValue(mockTabState);
        SessionContext.useSessionActions.mockReturnValue(mockActions);
    });

    const mkEditorRef = (text = 'a\nb') => ({
        current: { getCurrentContent: () => text, markSaved: vi.fn() },
    });

    it('eol "CRLF": the bytes handed to fileSystem.saveFile use \\r\\n', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef('a\nb')); });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'a\r\nb');
    });

    it('the cached tab content stays LF — updateTab still stores the original', async () => {
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef('a\nb')); });

        expect(mockActions.updateTab).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({ content: 'a\nb', isDirty: false }),
        );
    });

    it('charset "UTF-8 BOM": the bytes handed to fileSystem.saveFile start with U+FEFF', async () => {
        mockTabState.tabs[0].charset = 'UTF-8 BOM';
        mockTabState.tabs[0].eol = 'LF';
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef('a\nb')); });

        const written = fileSystem.saveFile.mock.calls[0][1];
        expect(written.charCodeAt(0)).toBe(0xFEFF);
        expect(written).toBe('﻿a\nb');
    });

    it('regression: eol "LF" + charset "UTF-8" writes the content through unchanged', async () => {
        mockTabState.tabs[0].eol = 'LF';
        mockTabState.tabs[0].charset = 'UTF-8';
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef('a\nb')); });

        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'a\nb');
    });

    // persistTab's else branch (no fileHandle, no filePath) also routes through
    // the same normalized `outContent`.
    it('persistTab Save-As fallback: a CRLF tab hands \\r\\n bytes to fileSystem.saveFileAs', async () => {
        mockTabState.tabs[0].fileHandle = undefined;
        mockTabState.tabs[0].filePath = undefined;
        mockTabState.tabs[0].eol = 'CRLF';
        const { result } = renderHook(() => useCommands());

        await act(async () => { await result.current.saveFile(mkEditorRef('a\nb')); });

        expect(fileSystem.saveFileAs).toHaveBeenCalledWith('a\r\nb', 'note.md');
    });
});
