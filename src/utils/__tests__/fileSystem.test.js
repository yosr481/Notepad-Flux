import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileSystem, sanitizeFilename } from '../fileSystem';
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

    it('openFileFromPath should be a function', () => {
        expect(typeof fileSystem.openFileFromPath).toBe('function');
    });

    // We can add more tests for saveFile, saveFileAs logic
    // including legacy fallback (download link) if IS_SUPPORTED is false.
});

describe('WebNativeDriver.saveFile requests readwrite permission before writing (P1-8a)', () => {
    // getDriver() picks WebNativeDriver when the pickers exist on window and
    // there is no window.electronAPI.
    beforeEach(() => {
        global.showOpenFilePicker = vi.fn();
        global.showSaveFilePicker = vi.fn();
        delete window.electronAPI;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const mkHandle = (overrides = {}) => {
        const writable = {
            write: vi.fn(async () => undefined),
            close: vi.fn(async () => undefined),
        };
        return {
            _writable: writable,
            createWritable: vi.fn(async () => writable),
            queryPermission: vi.fn(async () => 'granted'),
            requestPermission: vi.fn(async () => 'granted'),
            ...overrides,
        };
    };

    it('does not call requestPermission when queryPermission already returns "granted"; write proceeds', async () => {
        const handle = mkHandle({ queryPermission: vi.fn(async () => 'granted') });

        await fileSystem.saveFile(handle, 'DATA');

        expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
        expect(handle.requestPermission).not.toHaveBeenCalled();
        expect(handle.createWritable).toHaveBeenCalled();
        expect(handle._writable.write).toHaveBeenCalledWith('DATA');
        expect(handle._writable.close).toHaveBeenCalled();
    });

    it('calls requestPermission (with {mode:"readwrite"}) when queryPermission is not "granted", then writes on grant', async () => {
        const handle = mkHandle({
            queryPermission: vi.fn(async () => 'prompt'),
            requestPermission: vi.fn(async () => 'granted'),
        });

        await fileSystem.saveFile(handle, 'DATA');

        expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
        // permission is resolved before any write is attempted
        expect(handle.requestPermission.mock.invocationCallOrder[0])
            .toBeLessThan(handle.createWritable.mock.invocationCallOrder[0]);
        expect(handle._writable.write).toHaveBeenCalledWith('DATA');
    });

    it('throws and does NOT write when permission stays denied after requestPermission', async () => {
        const handle = mkHandle({
            queryPermission: vi.fn(async () => 'denied'),
            requestPermission: vi.fn(async () => 'denied'),
        });

        await expect(fileSystem.saveFile(handle, 'DATA')).rejects.toThrow();
        expect(handle.createWritable).not.toHaveBeenCalled();
    });

    it('throws and does NOT write when queryPermission is not granted and the handle has no requestPermission', async () => {
        const handle = mkHandle({
            queryPermission: vi.fn(async () => 'prompt'),
            requestPermission: undefined,
        });

        await expect(fileSystem.saveFile(handle, 'DATA')).rejects.toThrow();
        expect(handle.createWritable).not.toHaveBeenCalled();
    });

    it('proceeds straight to write when the handle has no queryPermission (older impl, behaviour unchanged)', async () => {
        const handle = mkHandle({ queryPermission: undefined, requestPermission: undefined });

        await fileSystem.saveFile(handle, 'DATA');

        expect(handle.createWritable).toHaveBeenCalled();
        expect(handle._writable.write).toHaveBeenCalledWith('DATA');
        expect(handle._writable.close).toHaveBeenCalled();
    });
});

describe('sanitizeFilename', () => {
    it('strips forward slashes so a filename cannot carry a path', () => {
        expect(sanitizeFilename('../../etc/passwd')).not.toContain('/');
    });

    it('strips backslashes', () => {
        expect(sanitizeFilename('a\\b')).not.toContain('\\');
    });
});

describe('ElectronDriver normalises binary content before IPC (P2-pdf)', () => {
    let saveFileMock;
    beforeEach(() => {
        saveFileMock = vi.fn(async () => ({ filePath: '/out/x.pdf', canceled: false }));
        window.electronAPI = { saveFile: saveFileMock };
    });
    afterEach(() => { delete window.electronAPI; });

    it('converts a Blob to a Uint8Array (not [object Blob]) for saveFileAs', async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' });
        await fileSystem.saveFileAs(blob, 'doc.pdf');
        const sent = saveFileMock.mock.calls[0][0].content;
        expect(sent).toBeInstanceOf(Uint8Array);
        expect(Array.from(sent)).toEqual([1, 2, 3]);
    });

    it('converts a Blob for saveFile (existing handle)', async () => {
        const blob = new Blob([new Uint8Array([9, 8])]);
        await fileSystem.saveFile('/out/x.pdf', blob);
        const sent = saveFileMock.mock.calls[0][0].content;
        expect(sent).toBeInstanceOf(Uint8Array);
        expect(Array.from(sent)).toEqual([9, 8]);
    });

    it('passes a string straight through unchanged', async () => {
        await fileSystem.saveFileAs('# hello', 'note.md');
        expect(saveFileMock.mock.calls[0][0].content).toBe('# hello');
    });

    it('wraps an ArrayBuffer / typed array as Uint8Array', async () => {
        await fileSystem.saveFileAs(new Uint8Array([7]).buffer, 'x.bin');
        expect(saveFileMock.mock.calls[0][0].content).toBeInstanceOf(Uint8Array);
        expect(Array.from(saveFileMock.mock.calls[0][0].content)).toEqual([7]);
    });
});
