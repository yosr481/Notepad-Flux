import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { createFakeLockManager } from '../test/fakeLocks';

// B9: App keyboard shortcuts match the PHYSICAL key (e.code), with exact modifiers.
// Contract (Docs/internal/loop/decisions.md pins are in the test-owner report):
//  - Ctrl+X  = ctrlKey && !shiftKey && !altKey && !metaKey ; Ctrl+Shift+X = ctrlKey && shiftKey && !altKey && !metaKey
//  - e.key is irrelevant (Latin, Hebrew, Caps Lock all work); e.code decides. No e.code => nothing fires.
//  - F5 = no modifiers at all.
//  - e.repeat: Ctrl+N / Ctrl+W / Ctrl+O / Ctrl+P do NOT run their action but the event IS still
//    preventDefault'ed (swallowed). Ctrl+Tab (and Ctrl+S) still run when repeating.
//  - preventDefault only when a shortcut matched; keys that match nothing are left alone.

vi.mock('../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        deleteTab: vi.fn(),
        clearSession: vi.fn(),
    },
}));

const ctl = vi.hoisted(() => ({}));

vi.mock('../components/Editor', async () => {
    const React = await import('react');
    return {
        default: React.forwardRef((_props, ref) => {
            React.useImperativeHandle(ref, () => ({
                insertDateTime: ctl.insertDateTime,
                getTotalLines: () => 10,
            }));
            return <div data-testid="editor" />;
        }),
    };
});
vi.mock('../components/Layout/StatusBar', () => ({ default: () => null }));
vi.mock('../components/Settings/Settings', () => ({ default: () => null }));
vi.mock('../components/Layout/Tabs', () => ({ default: () => null }));
vi.mock('../components/Layout/FindReplacePanel', () => ({
    default: (props) => <div data-testid="find-panel" data-mode={props.initialMode} />,
}));
vi.mock('../components/Layout/GoToLineDialog', () => ({
    default: () => <div data-testid="goto-dialog" />,
}));

vi.mock('../hooks/useCommands', () => ({
    useCommands: () => ({
        tabs: ctl.tabs,
        activeTabId: 'tab-1',
        setActiveTabId: vi.fn(),
        newTab: ctl.newTab,
        openFile: ctl.openFile,
        openRecentFile: vi.fn(),
        saveFile: ctl.saveFile,
        saveFileAs: ctl.saveFileAs,
        exportToPDF: vi.fn(),
        exportToHTML: vi.fn(),
        print: ctl.print,
        closeTab: ctl.closeTab,
        closeOtherTabs: vi.fn(),
        closeTabsToRight: vi.fn(),
        switchTab: ctl.switchTab,
        updateTab: vi.fn(),
        reorderTabs: vi.fn(),
        recentFiles: [],
        closeWindow: vi.fn(),
        isPrimaryWindow: true,
    }),
}));

import App from '../App';
import { SessionProvider } from '../context/SessionContext';

const renderApp = () =>
    render(
        <SessionProvider>
            <App />
        </SessionProvider>
    );

// Everything a shortcut can do, observable. Returns the names that happened.
const effects = () => {
    const out = [];
    if (ctl.newTab.mock.calls.length) out.push('newTab');
    if (ctl.openFile.mock.calls.length) out.push('open');
    if (ctl.saveFile.mock.calls.length) out.push('save');
    if (ctl.saveFileAs.mock.calls.length) out.push('saveAs');
    if (ctl.closeTab.mock.calls.length) out.push('closeTab');
    if (ctl.switchTab.mock.calls.length) out.push('switch:' + ctl.switchTab.mock.calls.map(c => c[0]).join(','));
    if (ctl.print.mock.calls.length) out.push('print');
    if (ctl.insertDateTime.mock.calls.length) out.push('dateTime');
    if (ctl.windowOpen.mock.calls.length) out.push('newWindow');
    const find = screen.queryByTestId('find-panel');
    if (find) out.push('panel:' + find.getAttribute('data-mode'));
    if (screen.queryByTestId('goto-dialog')) out.push('goto');
    return out;
};

// fireEvent returns false when the event was preventDefault'ed.
const press = (init) => {
    const notPrevented = fireEvent.keyDown(window, { bubbles: true, cancelable: true, ...init });
    return { prevented: !notPrevented, effects: effects() };
};

const LATIN = { KeyN: 'n', KeyO: 'o', KeyS: 's', KeyW: 'w', KeyF: 'f', KeyH: 'h', KeyG: 'g', KeyP: 'p' };
const HEBREW = { KeyN: 'מ', KeyO: 'ם', KeyS: 'ד', KeyW: "'", KeyF: 'כ', KeyH: 'י', KeyG: 'ע', KeyP: 'פ' };
const CAPS = Object.fromEntries(Object.entries(LATIN).map(([c, k]) => [c, k.toUpperCase()]));

// code -> expected effects. `shift` is the Ctrl+Shift+<code> effect (or null = no shifted shortcut).
const TABLE = [
    { code: 'KeyN', plain: ['newTab'], shift: ['newWindow'] },
    { code: 'KeyO', plain: ['open'], shift: null },
    { code: 'KeyS', plain: ['save'], shift: ['saveAs'] },
    { code: 'KeyW', plain: ['closeTab'], shift: null },
    { code: 'KeyF', plain: ['panel:find'], shift: null },
    { code: 'KeyH', plain: ['panel:replace'], shift: null },
    { code: 'KeyG', plain: ['goto'], shift: null },
    { code: 'KeyP', plain: ['print'], shift: null },
];

describe('App keyboard shortcuts (B9)', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        ctl.tabs = [{ id: 'tab-1', title: 'Untitled', content: '', isDirty: false }];
        for (const k of ['newTab', 'openFile', 'saveFile', 'saveFileAs', 'closeTab', 'switchTab', 'print', 'insertDateTime']) ctl[k] = vi.fn();
        ctl.windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
        renderApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete navigator.locks;
    });

    describe.each([['Latin', LATIN], ['Hebrew', HEBREW], ['Caps Lock', CAPS]])('%s layout', (_name, keys) => {
        it.each(TABLE)('Ctrl+$code fires its action once and preventDefaults', ({ code, plain }) => {
            const r = press({ key: keys[code], code, ctrlKey: true });
            expect(r.effects).toEqual(plain);
            expect(r.prevented).toBe(true);
        });

        it.each(TABLE.filter(t => t.shift))('Ctrl+Shift+$code fires only the shifted action', ({ code, shift }) => {
            // Shifted Latin key is uppercase on Latin/Caps layouts; Hebrew letter stays Hebrew.
            const key = keys === HEBREW ? keys[code] : LATIN[code].toUpperCase();
            const r = press({ key, code, ctrlKey: true, shiftKey: true });
            expect(r.effects).toEqual(shift);
            expect(r.prevented).toBe(true);
        });
    });

    describe('exact modifiers', () => {
        it.each(TABLE)('Ctrl+Alt+$code (AltGr) does nothing and is not preventDefaulted', ({ code }) => {
            const r = press({ key: LATIN[code], code, ctrlKey: true, altKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it.each(TABLE)('Ctrl+Alt+Shift+$code does nothing', ({ code }) => {
            const r = press({ key: LATIN[code], code, ctrlKey: true, altKey: true, shiftKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it.each(TABLE)('Ctrl+Meta+$code does nothing', ({ code }) => {
            const r = press({ key: LATIN[code], code, ctrlKey: true, metaKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it.each(TABLE)('Ctrl+Meta+Shift+$code does nothing', ({ code }) => {
            const r = press({ key: LATIN[code], code, ctrlKey: true, metaKey: true, shiftKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it.each(TABLE)('$code without Ctrl (plain typing) does nothing and is not preventDefaulted', ({ code }) => {
            const r = press({ key: LATIN[code], code });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it.each(TABLE)('Alt+$code and Meta+$code alone do nothing', ({ code }) => {
            expect(press({ key: LATIN[code], code, altKey: true }).effects).toEqual([]);
            expect(press({ key: LATIN[code], code, metaKey: true }).effects).toEqual([]);
        });

        it.each(TABLE.filter(t => !t.shift))('Ctrl+Shift+$code has no shifted shortcut: nothing fires (no fallthrough to Ctrl+$code)', ({ code }) => {
            const r = press({ key: LATIN[code].toUpperCase(), code, ctrlKey: true, shiftKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it('Ctrl+Shift+N opens a new window and does NOT open a new tab', () => {
            const r = press({ key: 'N', code: 'KeyN', ctrlKey: true, shiftKey: true });
            expect(ctl.newTab).not.toHaveBeenCalled();
            expect(r.effects).toEqual(['newWindow']);
        });

        it('Ctrl+S does not trigger Save As, and Ctrl+Shift+S does not trigger plain Save', () => {
            press({ key: 's', code: 'KeyS', ctrlKey: true });
            expect(ctl.saveFileAs).not.toHaveBeenCalled();
            expect(ctl.saveFile).toHaveBeenCalledTimes(1);
            ctl.saveFile.mockClear();
            press({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true });
            expect(ctl.saveFile).not.toHaveBeenCalled();
            expect(ctl.saveFileAs).toHaveBeenCalledTimes(1);
        });
    });

    describe('physical key, not character (decision, pinned)', () => {
        it('key "s" on a different physical key (code KeyD) does not save', () => {
            const r = press({ key: 's', code: 'KeyD', ctrlKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it('Hebrew key on a non-matching code does nothing', () => {
            expect(press({ key: 'ד', code: 'KeyD', ctrlKey: true }).effects).toEqual([]);
        });

        it('NOT handled: an event with key "s" but no code at all does not fire (no e.key fallback)', () => {
            const r = press({ key: 's', ctrlKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it('key "n" with code KeyS saves (code wins over key)', () => {
            expect(press({ key: 'n', code: 'KeyS', ctrlKey: true }).effects).toEqual(['save']);
        });
    });

    describe('B9 regression', () => {
        it('B9: Ctrl+S with key "ד" (Hebrew layout) on an unsaved tab triggers save (Save As path)', () => {
            ctl.tabs = [{ id: 'tab-1', title: 'Untitled', content: 'x', isDirty: true }];
            const r = press({ key: 'ד', code: 'KeyS', ctrlKey: true });
            expect(ctl.saveFile).toHaveBeenCalledTimes(1);
            expect(ctl.saveFile.mock.calls[0][0]).toHaveProperty('current'); // called with the editor ref, as today
            expect(ctl.saveFileAs).not.toHaveBeenCalled();
            expect(r.prevented).toBe(true);
        });

        it('B9: Ctrl+S with Caps Lock (key "S") saves', () => {
            expect(press({ key: 'S', code: 'KeyS', ctrlKey: true }).effects).toEqual(['save']);
        });
    });

    describe('Ctrl+Tab / Ctrl+Shift+Tab', () => {
        it('Ctrl+Tab goes to the next tab, preventDefaulted', () => {
            const r = press({ key: 'Tab', code: 'Tab', ctrlKey: true });
            expect(r.effects).toEqual(['switch:next']);
            expect(r.prevented).toBe(true);
        });

        it('Ctrl+Shift+Tab goes to the previous tab only', () => {
            const r = press({ key: 'Tab', code: 'Tab', ctrlKey: true, shiftKey: true });
            expect(r.effects).toEqual(['switch:prev']);
            expect(r.prevented).toBe(true);
        });

        it('Ctrl+Alt+Tab and Ctrl+Meta+Tab do nothing', () => {
            expect(press({ key: 'Tab', code: 'Tab', ctrlKey: true, altKey: true }).effects).toEqual([]);
            expect(press({ key: 'Tab', code: 'Tab', ctrlKey: true, metaKey: true }).effects).toEqual([]);
        });

        it('plain Tab and Shift+Tab are left to the editor', () => {
            const a = press({ key: 'Tab', code: 'Tab' });
            const b = press({ key: 'Tab', code: 'Tab', shiftKey: true });
            expect(a.effects).toEqual([]); expect(a.prevented).toBe(false);
            expect(b.effects).toEqual([]); expect(b.prevented).toBe(false);
        });

        it('repeat is allowed: holding Ctrl+Tab keeps switching', () => {
            press({ key: 'Tab', code: 'Tab', ctrlKey: true });
            press({ key: 'Tab', code: 'Tab', ctrlKey: true, repeat: true });
            press({ key: 'Tab', code: 'Tab', ctrlKey: true, repeat: true });
            expect(ctl.switchTab).toHaveBeenCalledTimes(3);
        });
    });

    describe('F5 inserts the date/time', () => {
        it('F5 calls editor.insertDateTime once and preventDefaults', () => {
            const r = press({ key: 'F5', code: 'F5' });
            expect(r.effects).toEqual(['dateTime']);
            expect(r.prevented).toBe(true);
        });

        it.each([
            ['Ctrl', { ctrlKey: true }],
            ['Shift', { shiftKey: true }],
            ['Alt', { altKey: true }],
            ['Meta', { metaKey: true }],
        ])('%s+F5 does not insert the date/time and is not preventDefaulted', (_n, mods) => {
            const r = press({ key: 'F5', code: 'F5', ...mods });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });
    });

    describe('Ctrl+Shift+N opens a new window (same action as File > New Window)', () => {
        it('calls window.open(location.href, "_blank")', () => {
            press({ key: 'N', code: 'KeyN', ctrlKey: true, shiftKey: true });
            expect(ctl.windowOpen).toHaveBeenCalledTimes(1);
            expect(ctl.windowOpen).toHaveBeenCalledWith(window.location.href, '_blank');
        });

        it('works on the Hebrew layout', () => {
            press({ key: 'מ', code: 'KeyN', ctrlKey: true, shiftKey: true });
            expect(ctl.windowOpen).toHaveBeenCalledWith(window.location.href, '_blank');
        });

        it('menu item File > New Window calls the identical window.open', () => {
            fireEvent.click(screen.getByText('File'));
            fireEvent.click(screen.getByText('New Window'));
            expect(ctl.windowOpen).toHaveBeenCalledWith(window.location.href, '_blank');
        });

        it('plain Ctrl+N does not open a window', () => {
            press({ key: 'n', code: 'KeyN', ctrlKey: true });
            expect(ctl.windowOpen).not.toHaveBeenCalled();
        });
    });

    describe('Ctrl+W closes the ACTIVE tab', () => {
        it('closeTab receives the active tab id', () => {
            press({ key: 'w', code: 'KeyW', ctrlKey: true });
            expect(ctl.closeTab).toHaveBeenCalledWith('tab-1');
        });
    });

    describe('find / replace / go to line', () => {
        it('Ctrl+F opens find mode, Ctrl+H then switches to replace mode', () => {
            press({ key: 'f', code: 'KeyF', ctrlKey: true });
            expect(screen.getByTestId('find-panel').getAttribute('data-mode')).toBe('find');
            // initialMode is read on mount of the panel; remount by toggling is the app's business.
            // Here only the last requested mode must be what App holds:
            press({ key: 'h', code: 'KeyH', ctrlKey: true });
            expect(screen.getByTestId('find-panel').getAttribute('data-mode')).toBe('replace');
        });

        it('Ctrl+G opens go-to-line', () => {
            press({ key: 'g', code: 'KeyG', ctrlKey: true });
            expect(screen.getByTestId('goto-dialog')).toBeTruthy();
        });
    });

    describe('e.repeat (holding a key)', () => {
        it.each([['KeyN', 'newTab'], ['KeyW', 'closeTab'], ['KeyO', 'open'], ['KeyP', 'print']])(
            'Ctrl+%s with repeat:true does not run the action (once from the first press only)',
            (code, name) => {
                const key = LATIN[code];
                expect(press({ key, code, ctrlKey: true }).effects).toEqual([name]);
                for (let i = 0; i < 5; i++) press({ key, code, ctrlKey: true, repeat: true });
                const fn = { newTab: ctl.newTab, closeTab: ctl.closeTab, open: ctl.openFile, print: ctl.print }[name];
                expect(fn).toHaveBeenCalledTimes(1);
            }
        );

        it.each(['KeyN', 'KeyW', 'KeyO', 'KeyP'])(
            'Ctrl+%s repeat is swallowed: preventDefault IS called (pinned), no action',
            (code) => {
                const r = press({ key: LATIN[code], code, ctrlKey: true, repeat: true });
                expect(r.effects).toEqual([]);
                expect(r.prevented).toBe(true);
            }
        );

        it('a repeat-only Ctrl+W (no first press) closes nothing', () => {
            press({ key: 'w', code: 'KeyW', ctrlKey: true, repeat: true });
            expect(ctl.closeTab).not.toHaveBeenCalled();
        });

        it('Ctrl+S with repeat:true still saves (only N/W/O/P are repeat-guarded)', () => {
            press({ key: 's', code: 'KeyS', ctrlKey: true, repeat: true });
            expect(ctl.saveFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('keys that are not app shortcuts are left alone', () => {
        it.each(['KeyZ', 'KeyY', 'KeyX', 'KeyC', 'KeyV', 'KeyA', 'KeyB', 'KeyE'])('Ctrl+%s: no effect, not preventDefaulted (CodeMirror owns it)', (code) => {
            const r = press({ key: code.slice(3).toLowerCase(), code, ctrlKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });

        it('F1..F12 other than F5 are ignored', () => {
            for (const n of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]) {
                const r = press({ key: 'F' + n, code: 'F' + n });
                expect(r.effects).toEqual([]);
                expect(r.prevented).toBe(false);
            }
        });

        it('a bare modifier press (Control) does nothing', () => {
            const r = press({ key: 'Control', code: 'ControlLeft', ctrlKey: true });
            expect(r.effects).toEqual([]);
            expect(r.prevented).toBe(false);
        });
    });

    describe('MenuBar labels are unchanged', () => {
        it('File menu advertises Ctrl+N, Ctrl+Shift+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+P, Ctrl+W', () => {
            fireEvent.click(screen.getByText('File'));
            for (const l of ['Ctrl+N', 'Ctrl+Shift+N', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+P', 'Ctrl+W']) {
                expect(screen.getAllByText(l).length).toBe(1);
            }
        });

        it('Edit menu advertises Ctrl+F, Ctrl+H, Ctrl+G', () => {
            fireEvent.click(screen.getByText('Edit'));
            for (const l of ['Ctrl+F', 'Ctrl+H', 'Ctrl+G']) {
                expect(screen.getAllByText(l).length).toBe(1);
            }
        });
    });
});
