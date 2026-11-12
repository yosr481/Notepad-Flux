import { describe, it, expect, vi, afterEach } from 'vitest';
import { fileSystem } from '../fileSystem';

afterEach(() => { delete window.electronAPI; });

describe('fileSystem.takeLaunchFiles', () => {
    it('web build (no electronAPI): resolves []', async () => {
        delete window.electronAPI;
        await expect(fileSystem.takeLaunchFiles()).resolves.toEqual([]);
    });

    it('electronAPI without takeLaunchFiles (older preload): resolves []', async () => {
        window.electronAPI = {};
        await expect(fileSystem.takeLaunchFiles()).resolves.toEqual([]);
    });

    it('maps ok and error entries; name is the basename', async () => {
        window.electronAPI = {
            takeLaunchFiles: vi.fn(async () => [
                { filePath: '/home/u/My Notes.md', content: 'BODY' },
                { filePath: '/home/u/gone.md', error: 'File not found.' },
            ]),
        };
        const out = await fileSystem.takeLaunchFiles();
        expect(window.electronAPI.takeLaunchFiles).toHaveBeenCalledTimes(1);
        expect(out).toEqual([
            { handle: '/home/u/My Notes.md', content: 'BODY', name: 'My Notes.md' },
            { name: 'gone.md', error: 'File not found.' },
        ]);
    });

    it('empty content is still ok (empty file), not an error', async () => {
        window.electronAPI = { takeLaunchFiles: vi.fn(async () => [{ filePath: '/a/e.md', content: '' }]) };
        expect(await fileSystem.takeLaunchFiles()).toEqual([{ handle: '/a/e.md', content: '', name: 'e.md' }]);
    });

    it('non-array result is treated as no files', async () => {
        window.electronAPI = { takeLaunchFiles: vi.fn(async () => null) };
        await expect(fileSystem.takeLaunchFiles()).resolves.toEqual([]);
    });

    it('rejected IPC call is thrown with the Electron wrapper stripped', async () => {
        window.electronAPI = {
            takeLaunchFiles: vi.fn(async () => { throw new Error("Error invoking remote method 'take-launch-files': Error: boom"); }),
        };
        await expect(fileSystem.takeLaunchFiles()).rejects.toThrow(/^boom$/);
    });
});
