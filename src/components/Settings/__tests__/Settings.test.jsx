import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import Settings from '../Settings';
import { dialogs } from '../../../utils/dialogs';
import * as SessionContext from '../../../context/SessionContext';

vi.mock('lucide-react', () => ({
    ArrowLeft: () => <span data-testid="back-icon">back</span>
}));

vi.mock('../../../utils/dialogs', () => ({
    dialogs: { confirm: vi.fn(async () => false), alert: vi.fn() }
}));

vi.mock('../../../context/SessionContext', () => ({
    useSettings: vi.fn(),
    useSessionActions: vi.fn()
}));

const baseSettings = {
    theme: 'system',
    sessionWarnTabs: 10,
    sessionWarnSize: 50
};

describe('Settings handleNumberChange', () => {
    let updateSettings;

    beforeEach(() => {
        updateSettings = vi.fn();
        SessionContext.useSettings.mockReturnValue({
            settings: baseSettings,
            updateSettings
        });
        SessionContext.useSessionActions.mockReturnValue({
            clearSessionData: vi.fn()
        });
    });

    const renderSettings = () =>
        render(
            <Settings
                isOpen={true}
                onClose={vi.fn()}
                appVersion="0.0.0"
            />
        );

    it('does not call updateSettings for non-numeric input', () => {
        const { getByDisplayValue } = renderSettings();
        const input = getByDisplayValue('10');

        fireEvent.change(input, { target: { value: 'abc' } });

        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('does not call updateSettings for out-of-range input', () => {
        const { getByDisplayValue } = renderSettings();
        const input = getByDisplayValue('10');

        fireEvent.change(input, { target: { value: '9999' } });

        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('calls updateSettings with a valid in-range number', () => {
        const { getByDisplayValue } = renderSettings();
        const input = getByDisplayValue('10');

        fireEvent.change(input, { target: { value: '25' } });

        expect(updateSettings).toHaveBeenCalledWith({ sessionWarnTabs: 25 });
    });
});

/**
 * ROUND C — P2-settings + U1: wire the "Clear Session Data" button through
 * the design-system confirm modal.
 *
 * Pinned contract:
 *  - onClick calls dialogs.confirm({
 *      title: 'Clear session data?',
 *      message: 'This permanently removes all saved tabs and session data. This cannot be undone.',
 *      confirmLabel: 'Clear',
 *      danger: true
 *    })
 *  - clearSessionData comes from useSession().
 *  - Only when confirm resolves true is clearSessionData() called.
 */
describe('Settings — Clear Session Data button', () => {
    let clearSessionData;

    beforeEach(() => {
        clearSessionData = vi.fn();
        SessionContext.useSettings.mockReturnValue({
            settings: baseSettings,
            updateSettings: vi.fn()
        });
        SessionContext.useSessionActions.mockReturnValue({ clearSessionData });
        dialogs.confirm.mockReset();
    });

    const renderSettings = () =>
        render(
            <Settings
                isOpen={true}
                onClose={vi.fn()}
                appVersion="0.0.0"
            />
        );

    const clickClear = (getByText) =>
        fireEvent.click(getByText('Clear Session Data'));

    it('the button has a click handler wired (dialogs.confirm invoked)', async () => {
        dialogs.confirm.mockResolvedValue(false);
        const { getByText } = renderSettings();
        clickClear(getByText);
        await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    });

    it('invokes confirm with the pinned destructive options', async () => {
        dialogs.confirm.mockResolvedValue(false);
        const { getByText } = renderSettings();
        clickClear(getByText);
        await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
        expect(dialogs.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Clear session data?',
                message:
                    'This permanently removes all saved tabs and session data. This cannot be undone.',
                confirmLabel: 'Clear',
                danger: true,
            })
        );
    });

    it('calls clearSessionData when the user confirms', async () => {
        dialogs.confirm.mockResolvedValue(true);
        const { getByText } = renderSettings();
        clickClear(getByText);
        await waitFor(() => expect(clearSessionData).toHaveBeenCalledTimes(1));
    });

    it('does NOT call clearSessionData when the user cancels', async () => {
        dialogs.confirm.mockResolvedValue(false);
        const { getByText } = renderSettings();
        clickClear(getByText);
        await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
        // give any stray .then() a chance to run
        await new Promise(r => setTimeout(r, 0));
        expect(clearSessionData).not.toHaveBeenCalled();
    });
});

/**
 * U1 — Settings update button (Docs/internal/update-spec.md).
 * Uses a mocked window.electronAPI.updates (the real useUpdateStatus hook runs).
 */
describe('Settings — update button (U1)', () => {
    const st = (over) => ({ state: 'idle', version: null, percent: null, error: null, ...over });
    let updates, push;

    const mountWith = async (status) => {
        let cb = null;
        updates = {
            getStatus: vi.fn(async () => status),
            check: vi.fn(async () => status),
            download: vi.fn(async () => status),
            install: vi.fn(async () => status),
            onStatus: vi.fn((fn) => { cb = fn; return vi.fn(); }),
        };
        push = (s) => cb(s);
        window.electronAPI = { updates };
        render(<Settings isOpen={true} onClose={vi.fn()} appVersion="1.0.0" />);
    };

    beforeEach(() => {
        SessionContext.useSettings.mockReturnValue({ settings: baseSettings, updateSettings: vi.fn() });
        SessionContext.useSessionActions.mockReturnValue({ clearSessionData: vi.fn() });
    });
    afterEach(() => { delete window.electronAPI; });

    const btn = () => screen.getByTestId('update-button');

    // [state, status, label, action (null = no click action), disabled]
    const table = [
        ['idle', st({ state: 'idle' }), 'Check for updates', 'check', false],
        ['checking', st({ state: 'checking' }), 'Checking…', null, true],
        ['available', st({ state: 'available', version: '2.0.0' }), 'Update to v2.0.0', 'download', false],
        ['downloading', st({ state: 'downloading', version: '2.0.0', percent: 42 }), 'Downloading… 42%', null, true],
        ['downloaded', st({ state: 'downloaded', version: '2.0.0', percent: 100 }), 'Restart to update', 'install', false],
        ['not-available', st({ state: 'not-available' }), 'Up to date', 'check', false],
        ['error', st({ state: 'error', error: 'boom' }), 'Check for updates', 'check', false],
    ];

    it.each(table)('state %s: label, disabled flag and click action', async (_s, status, label, action, disabled) => {
        await mountWith(status);
        await waitFor(() => expect(btn()).toHaveTextContent(label));
        expect(btn().textContent.trim()).toBe(label);
        if (disabled) expect(btn()).toBeDisabled(); else expect(btn()).toBeEnabled();

        fireEvent.click(btn());
        await new Promise((r) => setTimeout(r, 0));
        for (const name of ['check', 'download', 'install']) {
            if (name === action) expect(updates[name]).toHaveBeenCalledTimes(1);
            else expect(updates[name]).not.toHaveBeenCalled();
        }
    });

    it('error: description shows "Update failed: {error}"', async () => {
        await mountWith(st({ state: 'error', error: 'network down' }));
        await waitFor(() => expect(screen.getByText(/Update failed: network down/)).toBeInTheDocument());
    });

    it('non-error states do not show "Update failed"', async () => {
        await mountWith(st({ state: 'idle' }));
        await waitFor(() => expect(btn()).toBeInTheDocument());
        expect(screen.queryByText(/Update failed/)).toBeNull();
    });

    it('re-renders when a push changes the state (idle -> downloading 7%)', async () => {
        await mountWith(st({ state: 'idle' }));
        await waitFor(() => expect(btn()).toHaveTextContent('Check for updates'));
        const { act } = await import('@testing-library/react');
        act(() => push(st({ state: 'downloading', version: '2.0.0', percent: 7 })));
        expect(btn()).toHaveTextContent('Downloading… 7%');
        expect(btn()).toBeDisabled();
    });

    it('downloaded with an error set: description shows "Update failed: {error}" and the Restart button stays', async () => {
        await mountWith(st({ state: 'downloaded', version: '2.0.0', percent: 100, error: 'install blocked' }));
        await waitFor(() => expect(screen.getByText(/Update failed: install blocked/)).toBeInTheDocument());
        expect(btn()).toHaveTextContent('Restart to update');
        expect(btn()).toBeEnabled();
    });

    it('a rejected updates.download() from a click is caught: console.error called, no unhandled rejection', async () => {
        const unhandled = [];
        const onUnhandled = (e) => unhandled.push(e);
        globalThis.process.on('unhandledRejection', onUnhandled);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await mountWith(st({ state: 'available', version: '2.0.0' }));
            updates.download.mockRejectedValue(new Error('ipc denied'));
            await waitFor(() => expect(btn()).toHaveTextContent('Update to v2.0.0'));
            fireEvent.click(btn());
            await waitFor(() => expect(errSpy).toHaveBeenCalled());
            await new Promise((r) => setTimeout(r, 10));
            expect(updates.download).toHaveBeenCalledTimes(1);
            expect(unhandled).toEqual([]);
        } finally {
            globalThis.process.off('unhandledRejection', onUnhandled);
            errSpy.mockRestore();
        }
    });

    it('unsupported: no update button, View Releases stays', async () => {
        await mountWith(st({ state: 'unsupported' }));
        await new Promise((r) => setTimeout(r, 0));
        expect(screen.queryByTestId('update-button')).toBeNull();
        expect(screen.getByText('View Releases')).toBeInTheDocument();
    });

    it('no electronAPI (web): no update button, View Releases stays', () => {
        render(<Settings isOpen={true} onClose={vi.fn()} appVersion="1.0.0" />);
        expect(screen.queryByTestId('update-button')).toBeNull();
        expect(screen.getByText('View Releases')).toBeInTheDocument();
    });

    it('electronAPI without updates: no update button', () => {
        window.electronAPI = {};
        render(<Settings isOpen={true} onClose={vi.fn()} appVersion="1.0.0" />);
        expect(screen.queryByTestId('update-button')).toBeNull();
    });

    it('View Releases stays next to the button and still links to the releases page', async () => {
        await mountWith(st({ state: 'idle' }));
        await waitFor(() => expect(btn()).toBeInTheDocument());
        const link = screen.getByText('View Releases').closest('a');
        expect(link).toHaveAttribute('href', 'https://github.com/yosr481/Notepad-Flux/releases');
    });
});
