import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommands } from '../useCommands';
import * as SessionContext from '../../context/SessionContext';
import { fileSystem } from '../../utils/fileSystem';
import { dialogs } from '../../utils/dialogs';

// ---------------------------------------------------------------------------
// ROUND G — useCommands(showToast, editorRef): editorRef becomes a hook arg,
//           the returned object is memoized.
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec left open, stated as decisions):
//
//  * New signature: useCommands(showToast, editorRef). editorRef is optional.
//  * The close family no longer threads editorRef:
//      - closeTab(id, options)      -> options keeps { skipPrompt }, NO editorRef
//      - closeOtherTabs(id)         -> no editorRef param
//      - closeTabsToRight(id)       -> no editorRef param
//      - closeWindow()              -> no editorRef param
//    They all read the hook's `editorRef` directly instead.
//  * saveFile(editorRef) / saveFileAs(editorRef) KEEP their positional editorRef
//    param (the P1-4 markSaved suite depends on it). Unchanged.
//  * Live-content flush is unchanged in behaviour: an active dirty tab closes on
//    editorRef.current.getCurrentContent(); a non-active dirty tab closes on
//    tab.content; no editorRef at all -> tab.content.
//  * The object useCommands returns is wrapped in useMemo: two calls across a
//    rerender with the same args and no underlying state change return the SAME
//    object identity (Object.is).

vi.mock('../../context/SessionContext', () => ({
    useTabState: vi.fn(),
    useSessionActions: vi.fn(),
}));

vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        saveFile: vi.fn(async () => undefined),
        saveFileAs: vi.fn(async (_content, name) => ({ name, handle: {} })),
        isSupported: vi.fn(() => true),
    },
}));

vi.mock('../../utils/dialogs', () => ({
    dialogs: {
        confirm: vi.fn(() => Promise.resolve(true)),
        alert: vi.fn(),
        saveChangesPrompt: vi.fn(async () => 'save'),
    },
}));

let mockTabState;
let mockActions;
let showToast;

let closeSpy;
beforeEach(() => {
    vi.clearAllMocks();
    // closeWindow() ends in a real window.close(); without this jsdom's window
    // tears down and the next renderHook crashes on document.body.
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
        setTabs: vi.fn(),
        addRecentFile: vi.fn()
    };
    SessionContext.useTabState.mockReturnValue(mockTabState);
    SessionContext.useSessionActions.mockReturnValue(mockActions);
});

afterEach(() => {
    closeSpy?.mockRestore();
});

const liveRef = (text = 'LIVE') => ({ current: { getCurrentContent: () => text, markSaved: vi.fn() } });

describe('ROUND G — useCommands return is memoized', () => {
    it('returns the SAME object across a rerender when args and state are unchanged', () => {
        const editorRef = liveRef();
        const { result, rerender } = renderHook(
            ({ st, er }) => useCommands(st, er),
            { initialProps: { st: showToast, er: editorRef } }
        );
        const first = result.current;
        rerender({ st: showToast, er: editorRef });
        expect(result.current).toBe(first);
    });

    it('still returns a usable object when called with no editorRef', () => {
        const { result } = renderHook(() => useCommands(showToast));
        expect(typeof result.current.closeTab).toBe('function');
        expect(typeof result.current.closeWindow).toBe('function');
    });
});

describe('ROUND G — close family reads the hook editorRef (no editorRef params)', () => {
    it('closeTab(activeDirty) flushes editorRef.current.getCurrentContent() from the hook arg', async () => {
        const { result } = renderHook(() => useCommands(showToast, liveRef('LIVE')));
        await act(async () => {
            await result.current.closeTab('1');
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTab(non-activeDirty) still saves that tab.content, never the live content', async () => {
        const { result } = renderHook(() => useCommands(showToast, liveRef('LIVE')));
        await act(async () => {
            await result.current.closeTab('2');
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale2');
        expect(fileSystem.saveFile).not.toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTab(active) with NO hook editorRef falls back to tab.content', async () => {
        const { result } = renderHook(() => useCommands(showToast));
        await act(async () => {
            await result.current.closeTab('1');
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale');
    });

    it('closeTab(id, { skipPrompt: true }) skips the dirty prompt and just closes', async () => {
        const { result } = renderHook(() => useCommands(showToast, liveRef()));
        await act(async () => {
            await result.current.closeTab('1', { skipPrompt: true });
        });
        expect(dialogs.saveChangesPrompt).not.toHaveBeenCalled();
        expect(fileSystem.saveFile).not.toHaveBeenCalled();
        expect(mockActions.closeTab).toHaveBeenCalledWith('1');
    });

    it('closeOtherTabs(id) — no editorRef param — still flushes the active tab it closes', async () => {
        mockTabState.tabs[1].isDirty = false; // only the active tab '1' is dirty
        const { result } = renderHook(() => useCommands(showToast, liveRef('LIVE')));
        await act(async () => {
            await result.current.closeOtherTabs('2');
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeTabsToRight(id) — no editorRef param — still flushes the active tab it closes', async () => {
        mockTabState.activeTabId = '2';
        mockTabState.tabs[0].isDirty = false; // keep '1', close '2' (active, dirty)
        const { result } = renderHook(() => useCommands(showToast, liveRef('LIVE')));
        await act(async () => {
            await result.current.closeTabsToRight('1');
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeWindow() — no editorRef param — flushes the live content for the active tab', async () => {
        mockTabState.tabs[1].isDirty = false; // only the active tab is dirty
        const { result } = renderHook(() => useCommands(showToast, liveRef('LIVE')));
        await act(async () => {
            await result.current.closeWindow();
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });

    it('closeWindow(): a non-active dirty tab in the loop still saves its own content', async () => {
        mockTabState.tabs[0].isDirty = false; // active clean, "Other" dirty
        const { result } = renderHook(() => useCommands(showToast, liveRef('LIVE')));
        await act(async () => {
            await result.current.closeWindow();
        });
        expect(fileSystem.saveFile).toHaveBeenCalledWith(expect.anything(), 'stale2');
        expect(fileSystem.saveFile).not.toHaveBeenCalledWith(expect.anything(), 'LIVE');
    });
});
