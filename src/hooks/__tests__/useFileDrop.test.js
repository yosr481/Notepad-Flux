import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openDroppedFiles, useFileDrop } from '../useFileDrop';
import { fileSystem } from '../../utils/fileSystem';

vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        authorizePaths: vi.fn(async () => ({ added: 1 })),
        openFileFromPath: vi.fn(async (p) => ({ content: 'FILE BODY', name: 'note.md', handle: p })),
        // Electron 40: dropped File has no `.path`; the hook resolves the native
        // path through this bridge (webUtils.getPathForFile). Web build → null.
        pathForFile: vi.fn(() => null),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    fileSystem.authorizePaths.mockImplementation(async () => ({ added: 1 }));
    fileSystem.openFileFromPath.mockImplementation(async (p) => ({ content: 'FILE BODY', name: 'note.md', handle: p }));
    fileSystem.pathForFile.mockImplementation(() => null);
});

// ---------------------------------------------------------------------------
// openDroppedFiles
// ---------------------------------------------------------------------------
describe('openDroppedFiles', () => {
    it('Electron file (pathForFile resolves a path): authorizePaths + openFileFromPath + createTab with path-derived fields', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        fileSystem.pathForFile.mockReturnValueOnce('/abs/note.md');
        await openDroppedFiles([{ name: 'note.md' }], { createTab, showToast });

        expect(fileSystem.pathForFile).toHaveBeenCalledTimes(1);
        expect(fileSystem.authorizePaths).toHaveBeenCalledWith(['/abs/note.md']);
        expect(fileSystem.openFileFromPath).toHaveBeenCalledWith('/abs/note.md');
        expect(createTab).toHaveBeenCalledTimes(1);
        expect(createTab).toHaveBeenCalledWith({
            title: 'note.md',
            content: 'FILE BODY',
            filePath: '/abs/note.md',
            fileHandle: '/abs/note.md',
            isDirty: false,
        });
        expect(showToast).not.toHaveBeenCalled();
    });

    it('web file (pathForFile returns null): uses file.text(), createTab with name-derived fields, openFileFromPath NOT called', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        const text = vi.fn(async () => 'WEB BODY');
        await openDroppedFiles([{ name: 'w.md', text }], { createTab, showToast });

        expect(text).toHaveBeenCalledTimes(1);
        expect(fileSystem.openFileFromPath).not.toHaveBeenCalled();
        expect(fileSystem.authorizePaths).not.toHaveBeenCalled();
        expect(createTab).toHaveBeenCalledTimes(1);
        expect(createTab).toHaveBeenCalledWith({
            title: 'w.md',
            content: 'WEB BODY',
            filePath: 'w.md',
            fileHandle: null,
            isDirty: false,
        });
    });

    it('two files (Electron + web): createTab called twice, once per file, correct args each', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        const text = vi.fn(async () => 'WEB BODY');
        fileSystem.pathForFile.mockReturnValueOnce('/abs/a.md'); // file 1 → Electron; file 2 → default null
        await openDroppedFiles(
            [
                { name: 'note.md' },
                { name: 'w.md', text },
            ],
            { createTab, showToast },
        );

        expect(createTab).toHaveBeenCalledTimes(2);
        expect(createTab).toHaveBeenNthCalledWith(1, {
            title: 'note.md',
            content: 'FILE BODY',
            filePath: '/abs/a.md',
            fileHandle: '/abs/a.md',
            isDirty: false,
        });
        expect(createTab).toHaveBeenNthCalledWith(2, {
            title: 'w.md',
            content: 'WEB BODY',
            filePath: 'w.md',
            fileHandle: null,
            isDirty: false,
        });
    });

    it('error on file 1 of 2: showToast with a string containing file.name, loop continues to file 2', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        fileSystem.pathForFile.mockReturnValueOnce('/abs/bad.md');
        fileSystem.openFileFromPath.mockRejectedValueOnce(new Error('boom'));
        const text = vi.fn(async () => 'WEB BODY');

        await openDroppedFiles(
            [
                { name: 'bad.md' },
                { name: 'good.md', text },
            ],
            { createTab, showToast },
        );

        expect(showToast).toHaveBeenCalledTimes(1);
        const msg = showToast.mock.calls[0][0];
        expect(typeof msg).toBe('string');
        expect(msg).toContain('bad.md');
        expect(msg).toContain('boom');
        // file 2 still opened
        expect(createTab).toHaveBeenCalledTimes(1);
        expect(createTab).toHaveBeenCalledWith({
            title: 'good.md',
            content: 'WEB BODY',
            filePath: 'good.md',
            fileHandle: null,
            isDirty: false,
        });
    });

    it('error path tolerates a missing showToast (optional chaining), still continues', async () => {
        const createTab = vi.fn();
        fileSystem.pathForFile.mockReturnValueOnce('/abs/bad.md');
        fileSystem.openFileFromPath.mockRejectedValueOnce(new Error('boom'));
        const text = vi.fn(async () => 'WEB BODY');

        await expect(
            openDroppedFiles(
                [
                    { name: 'bad.md' },
                    { name: 'good.md', text },
                ],
                { createTab },
            ),
        ).resolves.not.toThrow();
        expect(createTab).toHaveBeenCalledTimes(1);
    });

    it('empty list: no throw, no createTab', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        await expect(openDroppedFiles([], { createTab, showToast })).resolves.not.toThrow();
        expect(createTab).not.toHaveBeenCalled();
    });

    it('non-iterable / nullish list: no throw, no createTab', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        await expect(openDroppedFiles(undefined, { createTab, showToast })).resolves.not.toThrow();
        await expect(openDroppedFiles(null, { createTab, showToast })).resolves.not.toThrow();
        expect(createTab).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// useFileDrop
// ---------------------------------------------------------------------------
function fireDrop(files) {
    const e = new Event('drop', { cancelable: true, bubbles: true });
    e.dataTransfer = { files };
    window.dispatchEvent(e);
    return e;
}

describe('useFileDrop', () => {
    it('dragover on window is preventDefault-ed after mount', () => {
        renderHook(() => useFileDrop({ createTab: vi.fn(), showToast: vi.fn() }));
        const e = new Event('dragover', { cancelable: true, bubbles: true });
        window.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(true);
    });

    it('drop on window is preventDefault-ed and eventually calls createTab', async () => {
        const createTab = vi.fn();
        renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));

        fileSystem.pathForFile.mockReturnValue('/a/x.md');
        const e = fireDrop([{ name: 'x.md' }]);
        expect(e.defaultPrevented).toBe(true);
        await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
        expect(createTab).toHaveBeenCalledWith({
            title: 'note.md',
            content: 'FILE BODY',
            filePath: '/a/x.md',
            fileHandle: '/a/x.md',
            isDirty: false,
        });
    });

    it('drop with missing dataTransfer does not throw and does not call createTab', async () => {
        const createTab = vi.fn();
        renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));

        const e = new Event('drop', { cancelable: true, bubbles: true });
        expect(() => window.dispatchEvent(e)).not.toThrow();
        expect(e.defaultPrevented).toBe(true);
        await new Promise((r) => setTimeout(r, 0));
        expect(createTab).not.toHaveBeenCalled();
    });

    it('after unmount, a drop no longer triggers createTab (listeners cleaned up)', async () => {
        const createTab = vi.fn();
        const { unmount } = renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));
        unmount();

        fileSystem.pathForFile.mockReturnValue('/a/x.md');
        const e = fireDrop([{ name: 'x.md' }]);
        expect(e.defaultPrevented).toBe(false);
        await new Promise((r) => setTimeout(r, 10));
        expect(createTab).not.toHaveBeenCalled();
    });
});
