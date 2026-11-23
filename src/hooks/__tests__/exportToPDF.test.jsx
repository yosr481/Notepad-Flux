import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { renderHook, act } from '@testing-library/react';
import { useCommands } from '../useCommands';
import * as SessionContext from '../../context/SessionContext';
import { fileSystem } from '../../utils/fileSystem';
import { renderMarkdownHtml } from '../../utils/export';

/**
 * P1 — PDF export via main-process printToPDF (no html2canvas / jsPDF).
 *
 * Pinned contract (Electron, window.electronAPI.printToPdf exists):
 *  1. renderMarkdownHtml(content, { expandFolds: true }); failure -> toast
 *     'Could not export to PDF.', nothing mounted, printToPdf/exportFile not called.
 *  2. Mount PrintDocument in #print-container, await nextPaint, call
 *     electronAPI.printToPdf() exactly once with NO arguments.
 *  3. #print-container is removed (finally) BEFORE exportFile is called, and also
 *     when printToPdf rejects.
 *  4. exportFile(new Blob([bytes], {type:'application/pdf'}), '<title ws->_>.pdf',
 *     [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]).
 *  5. Toasts: 'Exporting to PDF...' first; success 'Exported to PDF successfully!';
 *     exportFile false -> 'Export to PDF cancelled.'; printToPdf or exportFile
 *     rejection -> 'Failed to export to PDF.' (no success toast).
 * Web (no electronAPI.printToPdf): same flow as print(): window.print once, container
 * removed afterwards, no electronAPI call, no exportFile.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

vi.mock('../../context/SessionContext', () => ({
    useTabState: vi.fn(),
    useSessionActions: vi.fn(),
}));

vi.mock('../../utils/fileSystem', () => ({
    fileSystem: {
        exportFile: vi.fn(async () => true),
        saveFile: vi.fn(async () => undefined),
        saveFileAs: vi.fn(async (_c, name) => ({ name, handle: {} })),
        isSupported: vi.fn(() => true),
    },
}));

vi.mock('../../utils/dialogs', () => ({
    dialogs: { confirm: vi.fn(async () => true), alert: vi.fn(), saveChangesPrompt: vi.fn(async () => 'save') },
}));

vi.mock('../../utils/export', () => ({
    exportToHtml: vi.fn(async () => true),
    renderMarkdownHtml: vi.fn(async () => '<p id="rendered-marker">stub</p>'),
}));

// Renders the html prop so the test can see what was mounted.
vi.mock('../../components/Print/PrintDocument', () => ({
    default: ({ title, html }) => (
        <div data-testid="print-doc" data-title={title} dangerouslySetInnerHTML={{ __html: html }} />
    ),
}));

const makeSession = (title = 'My Doc  Name') => ({
    tabState: {
        tabs: [{ id: '1', title, content: '# hello', isDirty: false }],
        activeTabId: '1',
        isPrimaryWindow: true,
        isSessionLoaded: true,
        recentFiles: [],
        restoreWarning: null,
    },
    actions: {
        setActiveTabId: vi.fn(), createTab: vi.fn(), closeTab: vi.fn(), updateTab: vi.fn(),
        switchTab: vi.fn(), reorderTabs: vi.fn(), setTabs: vi.fn(), addRecentFile: vi.fn(),
    },
});

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]); // "%PDF-" + 3
const container = () => document.getElementById('print-container');
const run = async (toast = vi.fn()) => {
    const { result } = renderHook(() => useCommands(toast));
    await act(async () => { await result.current.exportToPDF(); });
    return toast;
};
// jsdom's Blob is not Node's: `new Response(blob)` stringifies it, so read via FileReader.
const blobBytes = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
});

describe('exportToPDF() — Electron path', () => {
    let printToPdf;
    let printSpy;

    beforeEach(() => {
        const { tabState, actions } = makeSession();
        SessionContext.useTabState.mockReturnValue(tabState);
        SessionContext.useSessionActions.mockReturnValue(actions);
        printToPdf = vi.fn(async () => PDF_BYTES);
        window.electronAPI = { printToPdf };
        printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        vi.mocked(fileSystem.exportFile).mockReset().mockResolvedValue(true);
        vi.mocked(renderMarkdownHtml).mockReset().mockResolvedValue('<p id="rendered-marker">stub</p>');
    });

    afterEach(() => {
        delete window.electronAPI;
        printSpy.mockRestore();
        container()?.remove();
    });

    it('renders markdown with expandFolds: true', async () => {
        await run();
        expect(renderMarkdownHtml).toHaveBeenCalledWith('# hello', { expandFolds: true });
    });

    it('calls printToPdf once, with no arguments, after the container is mounted with the rendered html', async () => {
        let seen;
        printToPdf.mockImplementation(async (...args) => {
            seen = { args, exists: !!container(), html: container()?.innerHTML ?? '', title: container()?.querySelector('[data-title]')?.getAttribute('data-title') };
            return PDF_BYTES;
        });
        await run();
        expect(printToPdf).toHaveBeenCalledTimes(1);
        expect(seen.args).toEqual([]);
        expect(seen.exists).toBe(true);
        expect(seen.html).toContain('id="rendered-marker"');
        expect(seen.title).toBe('My Doc  Name');
    });

    it('does not use window.print on the Electron path', async () => {
        await run();
        expect(printSpy).not.toHaveBeenCalled();
    });

    it('saves a Blob of type application/pdf holding exactly the returned bytes', async () => {
        await run();
        expect(fileSystem.exportFile).toHaveBeenCalledTimes(1);
        const [blob] = vi.mocked(fileSystem.exportFile).mock.calls[0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/pdf');
        expect(await blobBytes(blob)).toEqual(PDF_BYTES);
    });

    it('names the file <title with each whitespace char -> _>.pdf and passes the PDF type filter', async () => {
        await run();
        const [, name, types] = vi.mocked(fileSystem.exportFile).mock.calls[0];
        expect(name).toBe('My_Doc__Name.pdf');
        expect(types).toEqual([{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]);
    });

    it('removes #print-container before exportFile is called', async () => {
        let existedAtSave;
        vi.mocked(fileSystem.exportFile).mockImplementation(async () => { existedAtSave = !!container(); return true; });
        await run();
        expect(existedAtSave).toBe(false);
        expect(container()).toBeNull();
    });

    it('removes #print-container when printToPdf rejects, and never opens the save dialog', async () => {
        printToPdf.mockRejectedValue(new Error('boom'));
        const toast = await run();
        expect(container()).toBeNull();
        expect(fileSystem.exportFile).not.toHaveBeenCalled();
        expect(toast).toHaveBeenLastCalledWith('Failed to export to PDF.');
    });

    it('success: toasts "Exporting to PDF..." then "Exported to PDF successfully!"', async () => {
        const toast = await run();
        expect(toast.mock.calls.map(c => c[0])).toEqual(['Exporting to PDF...', 'Exported to PDF successfully!']);
    });

    it('cancel (exportFile resolves false): toasts "Export to PDF cancelled."', async () => {
        vi.mocked(fileSystem.exportFile).mockResolvedValue(false);
        const toast = await run();
        expect(toast.mock.calls.map(c => c[0])).toEqual(['Exporting to PDF...', 'Export to PDF cancelled.']);
    });

    it('exportFile rejection: toasts "Failed to export to PDF." and leaves no container', async () => {
        vi.mocked(fileSystem.exportFile).mockRejectedValue(new Error('disk'));
        const toast = await run();
        expect(toast.mock.calls.map(c => c[0])).toEqual(['Exporting to PDF...', 'Failed to export to PDF.']);
        expect(container()).toBeNull();
    });

    it('printToPdf rejection: only "Exporting..." then "Failed to export to PDF." (no success/cancel toast)', async () => {
        printToPdf.mockRejectedValue(new Error('boom'));
        const toast = await run();
        expect(toast.mock.calls.map(c => c[0])).toEqual(['Exporting to PDF...', 'Failed to export to PDF.']);
    });

    it('render failure: toast "Could not export to PDF.", nothing mounted, printToPdf and exportFile not called', async () => {
        vi.mocked(renderMarkdownHtml).mockRejectedValue(new Error('render'));
        const toast = await run();
        expect(toast.mock.calls.map(c => c[0])).toEqual(['Exporting to PDF...', 'Could not export to PDF.']);
        expect(container()).toBeNull();
        expect(printToPdf).not.toHaveBeenCalled();
        expect(fileSystem.exportFile).not.toHaveBeenCalled();
    });

    it('no active tab: does nothing', async () => {
        SessionContext.useTabState.mockReturnValue({ ...makeSession().tabState, activeTabId: 'nope' });
        const toast = await run();
        expect(toast).not.toHaveBeenCalled();
        expect(printToPdf).not.toHaveBeenCalled();
    });
});

describe('exportToPDF() — web path (no electronAPI.printToPdf)', () => {
    let printSpy;

    beforeEach(() => {
        const { tabState, actions } = makeSession();
        SessionContext.useTabState.mockReturnValue(tabState);
        SessionContext.useSessionActions.mockReturnValue(actions);
        printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        vi.mocked(fileSystem.exportFile).mockReset().mockResolvedValue(true);
        vi.mocked(renderMarkdownHtml).mockReset().mockResolvedValue('<p>stub</p>');
    });

    afterEach(() => {
        delete window.electronAPI;
        printSpy.mockRestore();
        container()?.remove();
    });

    it('opens the browser print dialog once (same flow as print()) and removes the container afterwards', async () => {
        let existedAtPrint;
        printSpy.mockImplementation(() => { existedAtPrint = !!container(); });
        await run();
        expect(printSpy).toHaveBeenCalledTimes(1);
        expect(existedAtPrint).toBe(true);
        expect(container()).toBeNull();
        expect(fileSystem.exportFile).not.toHaveBeenCalled();
    });

    it('does not call any electronAPI method when electronAPI exists without printToPdf', async () => {
        const other = vi.fn();
        window.electronAPI = { openDataFolder: other, getDataInfo: other };
        await run();
        expect(printSpy).toHaveBeenCalledTimes(1);
        expect(other).not.toHaveBeenCalled();
    });

    it('render failure mounts nothing and does not print', async () => {
        vi.mocked(renderMarkdownHtml).mockRejectedValue(new Error('render'));
        await run();
        expect(printSpy).not.toHaveBeenCalled();
        expect(container()).toBeNull();
    });
});

describe('PDF export has no raster/jsPDF dependency', () => {
    it('useCommands.js no longer references jspdf or html2canvas', () => {
        const src = readFileSync(resolve(HERE, '../useCommands.js'), 'utf8');
        expect(src).not.toMatch(/jspdf|html2canvas/i);
    });

    it('package.json no longer lists jspdf or html2canvas', () => {
        const pkg = JSON.parse(readFileSync(resolve(HERE, '../../../package.json'), 'utf8'));
        const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
        expect(all).not.toHaveProperty('jspdf');
        expect(all).not.toHaveProperty('html2canvas');
    });
});
