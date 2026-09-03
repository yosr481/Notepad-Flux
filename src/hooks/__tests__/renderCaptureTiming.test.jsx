import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommands } from '../useCommands';
import * as SessionContext from '../../context/SessionContext';

/**
 * ROUND C — P2-ric: render-capture timing.
 *
 * Pinned contract:
 *  - useCommands.js gains a module-local helper `nextPaint()` that resolves
 *    after a DOUBLE requestAnimationFrame, with a setTimeout(cb, 16) fallback
 *    when requestAnimationFrame is not a function (jsdom / old Safari safe).
 *  - exportToPDF: `await new Promise(resolve => requestIdleCallback(resolve))`
 *    becomes `await nextPaint()`.
 *  - print: `requestIdleCallback(() => { ... })` becomes
 *    `nextPaint().then(() => { ... })`.
 *  - NO `requestIdleCallback` identifier remains anywhere in useCommands.js.
 */

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
}));

vi.mock('../../components/Print/PrintDocument', () => ({
    default: () => null,
}));

const html2canvasMock = vi.fn(async () => ({
    toDataURL: () => 'data:image/png;base64,AAAA',
    width: 100,
    height: 200,
}));
vi.mock('html2canvas', () => ({ default: (...a) => html2canvasMock(...a) }));

vi.mock('jspdf', () => ({
    default: class {
        constructor() {
            this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
        }
        addImage() {}
        addPage() {}
        output() { return new Blob(['pdf'], { type: 'application/pdf' }); }
    },
}));

const makeSession = () => {
    const tabState = {
        tabs: [{ id: '1', title: 'Doc One', content: '# hello', isDirty: false }],
        activeTabId: '1',
        isPrimaryWindow: true,
        isSessionLoaded: true,
        recentFiles: [],
        restoreWarning: null
    };
    const actions = {
        setActiveTabId: vi.fn(),
        createTab: vi.fn(),
        closeTab: vi.fn(),
        updateTab: vi.fn(),
        switchTab: vi.fn(),
        reorderTabs: vi.fn(),
        setTabs: vi.fn(),
        addRecentFile: vi.fn()
    };
    return { tabState, actions };
};

describe('useCommands.js source — no requestIdleCallback', () => {
    it('does not reference requestIdleCallback anywhere', () => {
        const src = readFileSync(
            resolve(HERE, '../useCommands.js'),
            'utf8'
        );
        expect(src).not.toMatch(/requestIdleCallback/);
    });

    it('defines a nextPaint helper', () => {
        const src = readFileSync(
            resolve(HERE, '../useCommands.js'),
            'utf8'
        );
        expect(src).toMatch(/nextPaint/);
    });
});

describe('print() — uses nextPaint, still prints and unmounts', () => {
    let printSpy;

    beforeEach(() => {
        const { tabState, actions } = makeSession();
        SessionContext.useTabState.mockReturnValue(tabState);
        SessionContext.useSessionActions.mockReturnValue(actions);
        printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    });

    afterEach(() => {
        printSpy.mockRestore();
        document.getElementById('print-container')?.remove();
        vi.clearAllMocks();
    });

    it('calls window.print() after the paint tick', async () => {
        const { result } = renderHook(() => useCommands(vi.fn()));

        act(() => {
            result.current.print();
        });

        await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    });

    it('removes the #print-container mount node after printing', async () => {
        const { result } = renderHook(() => useCommands(vi.fn()));

        act(() => {
            result.current.print();
        });

        await waitFor(() => expect(printSpy).toHaveBeenCalled());
        await waitFor(() =>
            expect(document.getElementById('print-container')).toBeNull()
        );
    });

    it('does not throw when requestIdleCallback is undefined', async () => {
        const saved = window.requestIdleCallback;
        // eslint-disable-next-line no-undef
        delete window.requestIdleCallback;
        try {
            const { result } = renderHook(() => useCommands(vi.fn()));
            act(() => {
                result.current.print();
            });
            await waitFor(() => expect(printSpy).toHaveBeenCalled());
        } finally {
            if (saved) window.requestIdleCallback = saved;
        }
    });
});

describe('exportToPDF() — uses nextPaint', () => {
    beforeEach(() => {
        const { tabState, actions } = makeSession();
        SessionContext.useTabState.mockReturnValue(tabState);
        SessionContext.useSessionActions.mockReturnValue(actions);
        html2canvasMock.mockClear();
    });

    afterEach(() => {
        document.getElementById('print-container')?.remove();
    });

    it('runs to html2canvas without throwing when requestIdleCallback is undefined', async () => {
        const saved = window.requestIdleCallback;
        // eslint-disable-next-line no-undef
        delete window.requestIdleCallback;
        try {
            const { result } = renderHook(() => useCommands(vi.fn()));

            await act(async () => {
                await result.current.exportToPDF();
            });

            expect(html2canvasMock).toHaveBeenCalledTimes(1);
        } finally {
            if (saved) window.requestIdleCallback = saved;
        }
    });
});
