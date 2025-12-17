import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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
