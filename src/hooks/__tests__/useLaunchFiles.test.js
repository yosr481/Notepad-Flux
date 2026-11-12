import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openLaunchFiles, useLaunchFiles } from '../useLaunchFiles';
import { fileSystem } from '../../utils/fileSystem';

vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        takeLaunchFiles: vi.fn(async () => []),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    fileSystem.takeLaunchFiles.mockImplementation(async () => []);
});
afterEach(() => { delete window.electronAPI; });

describe('openLaunchFiles', () => {
    it('ok entry: createTab with name/handle/content, lands in Recent, no toast', async () => {
        const createTab = vi.fn(), addRecentFile = vi.fn(), showToast = vi.fn();
        fileSystem.takeLaunchFiles.mockResolvedValueOnce([{ handle: '/abs/a.md', content: 'BODY', name: 'a.md' }]);
        await openLaunchFiles({ createTab, addRecentFile, showToast });

        expect(createTab).toHaveBeenCalledTimes(1);
        expect(createTab).toHaveBeenCalledWith({
            title: 'a.md', content: 'BODY', filePath: 'a.md', fileHandle: '/abs/a.md', isDirty: false, charset: 'UTF-8',
        });
        expect(addRecentFile).toHaveBeenCalledWith('a.md', 'a.md', '/abs/a.md');
        expect(showToast).not.toHaveBeenCalled();
    });

    it('mixed list: tabs in order, error entry toasts with drop wording and does not stop the rest', async () => {
        const createTab = vi.fn(), addRecentFile = vi.fn(), showToast = vi.fn();
        fileSystem.takeLaunchFiles.mockResolvedValueOnce([
            { handle: '/abs/a.md', content: 'A', name: 'a.md' },
            { name: 'bad.bin', error: 'Not a text file.' },
            { handle: '/abs/c.txt', content: 'C', name: 'c.txt' },
        ]);
        await openLaunchFiles({ createTab, addRecentFile, showToast });

        expect(createTab).toHaveBeenCalledTimes(2);
        expect(createTab.mock.calls[0][0].title).toBe('a.md');
        expect(createTab.mock.calls[1][0].title).toBe('c.txt');
        expect(showToast).toHaveBeenCalledTimes(1);
        expect(showToast).toHaveBeenCalledWith('Could not open "bad.bin": Not a text file.');
    });

    it('BOM content is stripped by openIntoTab (charset recorded)', async () => {
        const createTab = vi.fn();
        fileSystem.takeLaunchFiles.mockResolvedValueOnce([{ handle: '/abs/b.md', content: '\uFEFFhi', name: 'b.md' }]);
        await openLaunchFiles({ createTab, showToast: vi.fn() });
        expect(createTab.mock.calls[0][0].content).toBe('hi');
        expect(createTab.mock.calls[0][0].charset).toBe('UTF-8 BOM');
    });

    it('empty list: nothing happens', async () => {
        const createTab = vi.fn(), showToast = vi.fn();
        await openLaunchFiles({ createTab, showToast });
        expect(createTab).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
    });

    it('takeLaunchFiles rejects: one toast "Could not open files: <message>", no throw, no tab', async () => {
        const createTab = vi.fn(), showToast = vi.fn();
        fileSystem.takeLaunchFiles.mockRejectedValueOnce(new Error('ipc down'));
        await expect(openLaunchFiles({ createTab, showToast })).resolves.not.toThrow();
        expect(showToast).toHaveBeenCalledTimes(1);
        expect(showToast).toHaveBeenCalledWith('Could not open files: ipc down');
        expect(createTab).not.toHaveBeenCalled();
    });

    it('tolerates missing addRecentFile', async () => {
        const createTab = vi.fn();
        fileSystem.takeLaunchFiles.mockResolvedValueOnce([{ handle: '/a.md', content: 'x', name: 'a.md' }]);
        await expect(openLaunchFiles({ createTab, showToast: vi.fn() })).resolves.not.toThrow();
        expect(createTab).toHaveBeenCalledTimes(1);
    });
});

describe('useLaunchFiles', () => {
    it('on mount drains launch files exactly once', async () => {
        const createTab = vi.fn();
        fileSystem.takeLaunchFiles.mockResolvedValueOnce([{ handle: '/abs/a.md', content: 'A', name: 'a.md' }]);
        const { rerender } = renderHook(() => useLaunchFiles({ createTab, addRecentFile: vi.fn(), showToast: vi.fn() }));
        await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
        rerender();
        await new Promise((r) => setTimeout(r, 10));
        expect(fileSystem.takeLaunchFiles).toHaveBeenCalledTimes(1);
        expect(createTab).toHaveBeenCalledTimes(1);
    });

    it('works with no electronAPI (web build): no crash, mount call still made', async () => {
        const { unmount } = renderHook(() => useLaunchFiles({ createTab: vi.fn(), showToast: vi.fn() }));
        await waitFor(() => expect(fileSystem.takeLaunchFiles).toHaveBeenCalledTimes(1));
        expect(() => unmount()).not.toThrow();
    });

    it('electronAPI without onLaunchFiles: no crash', async () => {
        window.electronAPI = {};
        renderHook(() => useLaunchFiles({ createTab: vi.fn(), showToast: vi.fn() }));
        await waitFor(() => expect(fileSystem.takeLaunchFiles).toHaveBeenCalledTimes(1));
    });

    it('each onLaunchFiles notification re-drains and opens the new files (second instance case)', async () => {
        let notify;
        const unsubscribe = vi.fn();
        window.electronAPI = { onLaunchFiles: vi.fn((cb) => { notify = cb; return unsubscribe; }) };
        const createTab = vi.fn();
        renderHook(() => useLaunchFiles({ createTab, addRecentFile: vi.fn(), showToast: vi.fn() }));
        await waitFor(() => expect(fileSystem.takeLaunchFiles).toHaveBeenCalledTimes(1));
        expect(window.electronAPI.onLaunchFiles).toHaveBeenCalledTimes(1);

        fileSystem.takeLaunchFiles.mockResolvedValueOnce([{ handle: '/abs/late.md', content: 'L', name: 'late.md' }]);
        notify();
        await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
        expect(createTab.mock.calls[0][0].title).toBe('late.md');
        expect(fileSystem.takeLaunchFiles).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes on unmount', async () => {
        const unsubscribe = vi.fn();
        window.electronAPI = { onLaunchFiles: vi.fn(() => unsubscribe) };
        const { unmount } = renderHook(() => useLaunchFiles({ createTab: vi.fn(), showToast: vi.fn() }));
        await waitFor(() => expect(window.electronAPI.onLaunchFiles).toHaveBeenCalled());
        expect(unsubscribe).not.toHaveBeenCalled();
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
