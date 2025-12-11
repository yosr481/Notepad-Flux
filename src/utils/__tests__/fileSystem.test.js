import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileSystem } from '../fileSystem';
import { dialogs } from '../dialogs';

// Mock dialogs
vi.mock('../dialogs', () => ({
    dialogs: {
        alert: vi.fn()
    }
}));

describe('File System Utility', () => {
    beforeEach(() => {
        // Mock global window APIs
        global.showOpenFilePicker = vi.fn();
        global.showSaveFilePicker = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('isSupported should return true when API exists', () => {
        expect(fileSystem.isSupported()).toBe(true);
    });

    it('openFile should call showOpenFilePicker', async () => {
        const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
        const mockHandle = {
            kind: 'file',
            name: 'test.txt',
            getFile: vi.fn().mockResolvedValue({
                ...mockFile,
                name: 'test.txt',
                text: () => Promise.resolve('content')
            })
        };
        global.showOpenFilePicker.mockResolvedValue([mockHandle]);

        const result = await fileSystem.openFile();

        expect(global.showOpenFilePicker).toHaveBeenCalled();
        expect(result).toEqual({
            name: 'test.txt',
            content: 'content',
            handle: mockHandle
        });
    });

    // We can add more tests for saveFile, saveFileAs logic 
    // including legacy fallback (download link) if IS_SUPPORTED is false.
});
