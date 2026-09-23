import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openDroppedFiles, useFileDrop } from '../useFileDrop';
import { fileSystem } from '../../utils/fileSystem';

vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        // Electron: preload resolves the native path and main reads + grants it.
        // Web build → null (the hook reads the File itself).
        openDroppedFile: vi.fn(async () => null),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    fileSystem.openDroppedFile.mockImplementation(async () => null);
});

// ---------------------------------------------------------------------------
// openDroppedFiles
// ---------------------------------------------------------------------------
describe('openDroppedFiles', () => {
    it('Electron file (openDroppedFile resolves): createTab with name as filePath, full path as fileHandle', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        const file = { name: 'note.md' };
        fileSystem.openDroppedFile.mockResolvedValueOnce({ handle: '/abs/note.md', content: 'FILE BODY', name: 'note.md' });
        await openDroppedFiles([file], { createTab, showToast });

        expect(fileSystem.openDroppedFile).toHaveBeenCalledWith(file);
        expect(createTab).toHaveBeenCalledTimes(1);
        expect(createTab).toHaveBeenCalledWith({
            title: 'note.md',
            content: 'FILE BODY',
            filePath: 'note.md',
            fileHandle: '/abs/note.md',
            isDirty: false,
        });
        expect(showToast).not.toHaveBeenCalled();
    });

    it('web file (openDroppedFile returns null): uses file.text(), createTab with name-derived fields, openFileFromPath NOT called', async () => {
        const createTab = vi.fn();
        const showToast = vi.fn();
        const text = vi.fn(async () => 'WEB BODY');
        await openDroppedFiles([{ name: 'w.md', text }], { createTab, showToast });

        expect(text).toHaveBeenCalledTimes(1);
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
        fileSystem.openDroppedFile.mockResolvedValueOnce({ handle: '/abs/a.md', content: 'FILE BODY', name: 'a.md' }); // file 2 → default null
        await openDroppedFiles(
            [
                { name: 'note.md' },
                { name: 'w.md', text },
            ],
            { createTab, showToast },
        );

        expect(createTab).toHaveBeenCalledTimes(2);
        expect(createTab).toHaveBeenNthCalledWith(1, {
            title: 'a.md',
            content: 'FILE BODY',
            filePath: 'a.md',
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
        fileSystem.openDroppedFile.mockRejectedValueOnce(new Error('boom'));
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
        fileSystem.openDroppedFile.mockRejectedValueOnce(new Error('boom'));
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
function fireDrop(files, types = ['Files']) {
    const e = new Event('drop', { cancelable: true, bubbles: true });
    e.dataTransfer = { files, types };
    window.dispatchEvent(e);
    return e;
}

describe('useFileDrop', () => {
    it('file dragover on window is preventDefault-ed after mount', () => {
        renderHook(() => useFileDrop({ createTab: vi.fn(), showToast: vi.fn() }));
        const e = new Event('dragover', { cancelable: true, bubbles: true });
        e.dataTransfer = { types: ['Files'] };
        window.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(true);
    });

    it('text drag/drop (no Files) is left alone so CodeMirror can handle it', async () => {
        const createTab = vi.fn();
        renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));
        const over = new Event('dragover', { cancelable: true, bubbles: true });
        over.dataTransfer = { types: ['text/plain'] };
        window.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
        const e = fireDrop([], ['text/plain']);
        expect(e.defaultPrevented).toBe(false);
        await new Promise((r) => setTimeout(r, 0));
        expect(createTab).not.toHaveBeenCalled();
    });

    it('drop on window is preventDefault-ed and eventually calls createTab', async () => {
        const createTab = vi.fn();
        renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));

        fileSystem.openDroppedFile.mockResolvedValueOnce({ handle: '/a/x.md', content: 'FILE BODY', name: 'x.md' });
        const e = fireDrop([{ name: 'x.md' }]);
        expect(e.defaultPrevented).toBe(true);
        await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
        expect(createTab).toHaveBeenCalledWith({
            title: 'x.md',
            content: 'FILE BODY',
            filePath: 'x.md',
            fileHandle: '/a/x.md',
            isDirty: false,
        });
    });

    it('drop with missing dataTransfer does not throw and does not call createTab', async () => {
        const createTab = vi.fn();
        renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));

        const e = new Event('drop', { cancelable: true, bubbles: true });
        expect(() => window.dispatchEvent(e)).not.toThrow();
        expect(e.defaultPrevented).toBe(false);
        await new Promise((r) => setTimeout(r, 0));
        expect(createTab).not.toHaveBeenCalled();
    });

    it('after unmount, a drop no longer triggers createTab (listeners cleaned up)', async () => {
        const createTab = vi.fn();
        const { unmount } = renderHook(() => useFileDrop({ createTab, showToast: vi.fn() }));
        unmount();

        const e = fireDrop([{ name: 'x.md' }]);
        expect(e.defaultPrevented).toBe(false);
        await new Promise((r) => setTimeout(r, 10));
        expect(createTab).not.toHaveBeenCalled();
    });
});
