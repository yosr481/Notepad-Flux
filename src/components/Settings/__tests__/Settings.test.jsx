import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../Settings';
import { dialogs } from '../../../utils/dialogs';
import { useSession } from '../../../context/SessionContext';

vi.mock('lucide-react', () => ({
    ArrowLeft: () => <span data-testid="back-icon">back</span>
}));

vi.mock('../../../utils/dialogs', () => ({
    dialogs: { confirm: vi.fn(async () => false), alert: vi.fn() }
}));

vi.mock('../../../context/SessionContext', () => ({
    useSession: vi.fn(() => ({ clearSessionData: vi.fn() }))
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
    });

    const renderSettings = () =>
        render(
            <Settings
                isOpen={true}
                onClose={vi.fn()}
                settings={baseSettings}
                updateSettings={updateSettings}
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
        useSession.mockReturnValue({ clearSessionData });
        dialogs.confirm.mockReset();
    });

    const renderSettings = () =>
        render(
            <Settings
                isOpen={true}
                onClose={vi.fn()}
                settings={baseSettings}
                updateSettings={vi.fn()}
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
