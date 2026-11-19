import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import Settings from '../Settings';
import * as SessionContext from '../../../context/SessionContext';

vi.mock('lucide-react', () => ({ ArrowLeft: () => <span>back</span> }));
vi.mock('../../../utils/dialogs', () => ({ dialogs: { confirm: vi.fn(async () => false), alert: vi.fn() } }));
vi.mock('../../../context/SessionContext', () => ({ useSettings: vi.fn(), useSessionActions: vi.fn() }));

/**
 * S1 — Session data row in Settings > Data Management (Docs/internal/data-path-spec.md).
 *
 * Pinned contract (spec leaves markup open; these are the picks):
 *  - preload bridge: window.electronAPI.getDataInfo() -> Promise<{ path, bytes }>,
 *    window.electronAPI.openDataFolder() -> Promise<{ ok } | string>, called with NO arguments.
 *  - desktop = window.electronAPI exists. The path is the textContent of an element with dir="ltr".
 *  - the formatted size / "Calculating…" / "Size unavailable" is the whole text of its own element
 *    (getByText exact match), "Calculating…" uses the single character U+2026.
 *  - button label "Open folder" (role button), shown on desktop in every state, never in web.
 *  - path is shown as soon as known: {path, bytes: invalid} -> "Size unavailable" + path. A rejected
 *    getDataInfo -> "Size unavailable" (and a path already shown by an earlier load stays).
 *  - web: no path, no button; size from navigator.storage.estimate().usage as "... used by this site"
 *    ("about 3.1 MB used by this site"); estimate missing / throwing / rejecting / usage not a number -> nothing.
 *  - fetched when Settings opens (isOpen false->true), not while closed, again on each reopen.
 */
const PATH = '/home/u/.config/notepad-flux';
const MB = 1024 * 1024;

const baseSettings = { theme: 'system', sessionWarnTabs: 10, sessionWarnSize: 50 };
const ui = (isOpen = true) => <Settings isOpen={isOpen} onClose={vi.fn()} appVersion="0.0.0" />;
const pathEl = (c) => [...c.querySelectorAll('[dir="ltr"]')].find((e) => e.textContent === PATH);
const openBtn = () => screen.queryByRole('button', { name: /open folder/i });

const origStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
const setStorage = (v) => Object.defineProperty(navigator, 'storage', { value: v, configurable: true });

beforeEach(() => {
    SessionContext.useSettings.mockReturnValue({ settings: baseSettings, updateSettings: vi.fn() });
    SessionContext.useSessionActions.mockReturnValue({ clearSessionData: vi.fn() });
});
afterEach(() => {
    delete window.electronAPI;
    if (origStorage) Object.defineProperty(navigator, 'storage', origStorage); else delete navigator.storage;
    vi.restoreAllMocks();
});

describe('Settings Session data row — desktop', () => {
    let api;
    beforeEach(() => {
        api = { getDataInfo: vi.fn(async () => ({ path: PATH, bytes: 13002342 })), openDataFolder: vi.fn(async () => ({ ok: true })) };
        window.electronAPI = api;
    });

    it('shows the folder path in a dir="ltr" element', async () => {
        const { container } = render(ui());
        await waitFor(() => expect(pathEl(container)).toBeTruthy());
        expect(pathEl(container).getAttribute('dir')).toBe('ltr');
    });

    it('shows "Calculating…" while the size loads', async () => {
        api.getDataInfo.mockReturnValue(new Promise(() => {}));
        render(ui());
        expect(await screen.findByText('Calculating…')).toBeInTheDocument();
        expect(openBtn()).toBeInTheDocument();
    });

    it('replaces "Calculating…" with the formatted size once loaded', async () => {
        render(ui());
        expect(await screen.findByText('12.4 MB')).toBeInTheDocument();
        expect(screen.queryByText('Calculating…')).toBeNull();
        expect(screen.queryByText('Size unavailable')).toBeNull();
    });

    it('formats other sizes (0 B, KB, GB)', async () => {
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 0 });
        const { unmount } = render(ui());
        expect(await screen.findByText('0 B')).toBeInTheDocument();
        unmount();
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 1536 });
        const r2 = render(ui());
        expect(await screen.findByText('1.5 KB')).toBeInTheDocument();
        r2.unmount();
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 3 * 1024 ** 3 });
        render(ui());
        expect(await screen.findByText('3.0 GB')).toBeInTheDocument();
    });

    it('rejected getDataInfo -> "Size unavailable", no crash, button still there', async () => {
        api.getDataInfo.mockRejectedValue(new Error('boom'));
        render(ui());
        expect(await screen.findByText('Size unavailable')).toBeInTheDocument();
        expect(screen.queryByText('Calculating…')).toBeNull();
        expect(openBtn()).toBeInTheDocument();
    });

    it('synchronously throwing getDataInfo -> "Size unavailable", no crash', async () => {
        api.getDataInfo.mockImplementation(() => { throw new Error('boom'); });
        render(ui());
        expect(await screen.findByText('Size unavailable')).toBeInTheDocument();
    });

    it.each([[undefined], [null], [NaN], [-5], ['12']])('bytes %p -> "Size unavailable" and the path stays', async (bytes) => {
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes });
        const { container } = render(ui());
        expect(await screen.findByText('Size unavailable')).toBeInTheDocument();
        expect(pathEl(container)).toBeTruthy();
    });

    it('a path from an earlier load stays when the refresh fails', async () => {
        const { container, rerender } = render(ui());
        await screen.findByText('12.4 MB');
        api.getDataInfo.mockRejectedValue(new Error('boom'));
        rerender(ui(false)); rerender(ui(true));
        expect(await screen.findByText('Size unavailable')).toBeInTheDocument();
        expect(pathEl(container)).toBeTruthy();
    });

    // Contract (round 1 review): getDataInfo resolves { path, bytes, truncated }; truncated === true (walk hit the cap)
    // shows "at least <size>" as the whole text of the size element.
    it('truncated: true -> "at least <size>"', async () => {
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 13002342, truncated: true });
        render(ui());
        expect(await screen.findByText('at least 12.4 MB')).toBeInTheDocument();
        expect(screen.queryByText('12.4 MB')).toBeNull();
    });

    it.each([[false], [undefined]])('truncated %p -> plain size, no "at least"', async (truncated) => {
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 13002342, truncated });
        render(ui());
        expect(await screen.findByText('12.4 MB')).toBeInTheDocument();
        expect(screen.queryByText(/at least/)).toBeNull();
    });

    it('truncated: true with invalid bytes -> "Size unavailable", no "at least"', async () => {
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: NaN, truncated: true });
        render(ui());
        expect(await screen.findByText('Size unavailable')).toBeInTheDocument();
        expect(screen.queryByText(/at least/)).toBeNull();
    });

    it('a truncated size refreshes to a plain one on reopen', async () => {
        api.getDataInfo.mockResolvedValueOnce({ path: PATH, bytes: 5 * MB, truncated: true });
        const { rerender } = render(ui());
        await screen.findByText('at least 5.0 MB');
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 6 * MB, truncated: false });
        rerender(ui(false)); rerender(ui(true));
        expect(await screen.findByText('6.0 MB')).toBeInTheDocument();
        expect(screen.queryByText(/at least/)).toBeNull();
    });

    it('"Open folder" calls openDataFolder() once with NO argument (no event, no path)', async () => {
        render(ui());
        await screen.findByText('12.4 MB');
        fireEvent.click(openBtn());
        await waitFor(() => expect(api.openDataFolder).toHaveBeenCalledTimes(1));
        expect(api.openDataFolder).toHaveBeenCalledWith();
        expect(api.openDataFolder.mock.calls[0]).toHaveLength(0);
    });

    it('"Open folder" works while the size is still loading and in the error state', async () => {
        api.getDataInfo.mockRejectedValue(new Error('x'));
        render(ui());
        await screen.findByText('Size unavailable');
        fireEvent.click(openBtn());
        await waitFor(() => expect(api.openDataFolder).toHaveBeenCalledTimes(1));
    });

    it('openDataFolder returning an error string or rejecting does not crash the page', async () => {
        api.openDataFolder.mockResolvedValueOnce('Failed to open path').mockRejectedValueOnce(new Error('nope'));
        const { container } = render(ui());
        await screen.findByText('12.4 MB');
        fireEvent.click(openBtn());
        fireEvent.click(openBtn());
        await waitFor(() => expect(api.openDataFolder).toHaveBeenCalledTimes(2));
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        expect(pathEl(container)).toBeTruthy();
    });

    it('does not use navigator.storage on desktop and shows no "used by this site"', async () => {
        const estimate = vi.fn(async () => ({ usage: 3 * MB }));
        setStorage({ estimate });
        render(ui());
        await screen.findByText('12.4 MB');
        expect(screen.queryByText(/used by this site/i)).toBeNull();
        expect(estimate).not.toHaveBeenCalled();
    });

    it('is not fetched while Settings is closed; fetched on open', async () => {
        const { rerender } = render(ui(false));
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        expect(api.getDataInfo).not.toHaveBeenCalled();
        rerender(ui(true));
        await screen.findByText('12.4 MB');
        expect(api.getDataInfo).toHaveBeenCalledTimes(1);
    });

    it('asks again each time Settings is reopened and shows the new size', async () => {
        const { rerender } = render(ui());
        await screen.findByText('12.4 MB');
        expect(api.getDataInfo).toHaveBeenCalledTimes(1);
        api.getDataInfo.mockResolvedValue({ path: PATH, bytes: 2 * MB });
        rerender(ui(false));
        rerender(ui(true));
        expect(await screen.findByText('2.0 MB')).toBeInTheDocument();
        expect(screen.queryByText('12.4 MB')).toBeNull();
        expect(api.getDataInfo).toHaveBeenCalledTimes(2);
    });

    it('a slow response from a closed session does not overwrite the reopened one', async () => {
        let resolveOld;
        api.getDataInfo.mockReturnValueOnce(new Promise((r) => { resolveOld = r; }));
        const { rerender } = render(ui());
        rerender(ui(false));
        api.getDataInfo.mockResolvedValueOnce({ path: PATH, bytes: 2 * MB });
        rerender(ui(true));
        await screen.findByText('2.0 MB');
        await act(async () => { resolveOld({ path: PATH, bytes: 99 * MB }); });
        expect(screen.getByText('2.0 MB')).toBeInTheDocument();
        expect(screen.queryByText('99.0 MB')).toBeNull();
    });

    it('does not set state after unmount (no act/unmounted warnings, no throw)', async () => {
        let res;
        api.getDataInfo.mockReturnValue(new Promise((r) => { res = r; }));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { unmount } = render(ui());
        unmount();
        await act(async () => { res({ path: PATH, bytes: MB }); });
        expect(err).not.toHaveBeenCalled();
    });
});

describe('Settings Session data row — web build (no electronAPI)', () => {
    const webAbsent = () => {
        expect(openBtn()).toBeNull();
        expect(screen.queryByText('Calculating…')).toBeNull();
        expect(screen.queryByText('Size unavailable')).toBeNull();
        expect(screen.queryByText(/used by this site/i)).toBeNull();
    };

    it('shows the estimate usage as "about <size> used by this site"; no path, no button', async () => {
        const estimate = vi.fn(async () => ({ usage: Math.round(3.1 * MB), quota: 1e12 }));
        setStorage({ estimate });
        const { container } = render(ui());
        const el = await screen.findByText(/used by this site/i);
        expect(el.textContent).toMatch(/about 3\.1 MB used by this site/i);
        expect(openBtn()).toBeNull();
        expect(container.querySelector('[dir="ltr"]')).toBeNull();
        expect(screen.queryByText('Calculating…')).toBeNull();
        expect(estimate).toHaveBeenCalledTimes(1);
    });

    it('usage 0 still renders ("0 B")', async () => {
        setStorage({ estimate: async () => ({ usage: 0 }) });
        render(ui());
        expect((await screen.findByText(/used by this site/i)).textContent).toMatch(/0 B used by this site/);
    });

    it('navigator.storage missing -> nothing, no crash', async () => {
        setStorage(undefined);
        render(ui());
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        webAbsent();
    });

    it('storage without estimate -> nothing, no crash', async () => {
        setStorage({});
        render(ui());
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        webAbsent();
    });

    it('estimate throwing synchronously -> nothing, no crash', async () => {
        setStorage({ estimate: () => { throw new Error('nope'); } });
        render(ui());
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        webAbsent();
    });

    it('estimate rejecting -> nothing, no crash', async () => {
        setStorage({ estimate: () => Promise.reject(new Error('nope')) });
        render(ui());
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        webAbsent();
    });

    it.each([[{}], [{ usage: undefined }], [{ usage: NaN }], [{ usage: -1 }], [undefined]])(
        'estimate resolving %p -> nothing', async (v) => {
            setStorage({ estimate: async () => v });
            render(ui());
            await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
            webAbsent();
        });

    it('estimate is not called while Settings is closed; asked again on every reopen', async () => {
        const estimate = vi.fn(async () => ({ usage: MB }));
        setStorage({ estimate });
        const { rerender } = render(ui(false));
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        expect(estimate).not.toHaveBeenCalled();
        rerender(ui(true));
        await screen.findByText(/1\.0 MB used by this site/i);
        estimate.mockResolvedValue({ usage: 2 * MB });
        rerender(ui(false)); rerender(ui(true));
        await screen.findByText(/2\.0 MB used by this site/i);
        expect(estimate).toHaveBeenCalledTimes(2);
    });
});
