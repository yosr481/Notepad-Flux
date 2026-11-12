import { describe, it, expect, vi, afterEach } from 'vitest';
import { unwrapIpcError, fileSystem } from '../fileSystem';

const wrapped = (channel, msg, kind = 'Error') => new Error(`Error invoking remote method '${channel}': ${kind}: ${msg}`);

describe('unwrapIpcError', () => {
    it('strips Electron\'s "Error invoking remote method" prefix and keeps main\'s message', () => {
        expect(unwrapIpcError(wrapped('read-file', 'Permission denied.')).message).toBe('Permission denied.');
        expect(unwrapIpcError(wrapped('save-file', 'File not found.')).message).toBe('File not found.');
        expect(unwrapIpcError(wrapped('read-file-content', 'An internal system error occurred. Please try again.')).message)
            .toBe('An internal system error occurred. Please try again.');
    });
    it('handles other error class names after the channel and channel names with dashes/digits', () => {
        expect(unwrapIpcError(wrapped('open-dropped-file', 'Not a text file.', 'TypeError')).message).toBe('Not a text file.');
        expect(unwrapIpcError(new Error("Error invoking remote method 'a-b2': Boom")).message).toBe('Boom');
    });
    it('leaves messages without the prefix untouched', () => {
        expect(unwrapIpcError(new Error('plain failure')).message).toBe('plain failure');
        expect(unwrapIpcError(new Error('Error invoking remote method but not at the start')).message).toBe('Error invoking remote method but not at the start');
    });
    it('only strips at the very start and only once', () => {
        const e = new Error("Error invoking remote method 'x': Error: Error invoking remote method 'y': Error: inner");
        expect(unwrapIpcError(e).message).toBe("Error invoking remote method 'y': Error: inner");
    });
    it('returns the same object (mutates message in place) and tolerates non-errors', () => {
        const e = wrapped('x', 'm'); expect(unwrapIpcError(e)).toBe(e);
        expect(unwrapIpcError(null)).toBeNull();
        expect(unwrapIpcError(undefined)).toBeUndefined();
        expect(unwrapIpcError('str')).toBe('str');
        expect(unwrapIpcError({ message: 5 })).toEqual({ message: 5 });
    });
});

describe('Electron driver surfaces the unwrapped message', () => {
    afterEach(() => { delete window.electronAPI; vi.restoreAllMocks(); });
    const api = (over) => { window.electronAPI = { readFile: vi.fn(), readFileContent: vi.fn(), saveFile: vi.fn(), openDroppedFile: vi.fn(), ...over }; };

    it('openFile', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        api({ readFile: vi.fn().mockRejectedValue(wrapped('read-file', 'Permission denied.')) });
        await expect(fileSystem.openFile()).rejects.toThrow(/^Permission denied\.$/);
    });
    it('saveFile', async () => {
        api({ saveFile: vi.fn().mockRejectedValue(wrapped('save-file', 'Permission denied.')) });
        await expect(fileSystem.saveFile('C:\\x.md', 'text')).rejects.toThrow(/^Permission denied\.$/);
    });
    it('openFileFromPath / openFileFromHandle', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        api({ readFileContent: vi.fn().mockRejectedValue(wrapped('read-file-content', 'File not found.')) });
        await expect(fileSystem.openFileFromPath('/x')).rejects.toThrow(/^File not found\.$/);
        await expect(fileSystem.openFileFromHandle('/x')).rejects.toThrow(/^File not found\.$/);
    });
    it('openDroppedFile', async () => {
        api({ openDroppedFile: vi.fn().mockRejectedValue(wrapped('open-dropped-file', 'Not a text file.')) });
        await expect(fileSystem.openDroppedFile(new File(['x'], 'a.md'))).rejects.toThrow(/^Not a text file\.$/);
    });
    it('success values pass through untouched', async () => {
        api({ readFile: vi.fn().mockResolvedValue({ canceled: false, filePath: '/a/b.md', content: 'hi' }) });
        await expect(fileSystem.openFile()).resolves.toEqual({ handle: '/a/b.md', content: 'hi', name: 'b.md' });
    });
});
