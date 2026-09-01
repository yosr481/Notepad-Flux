import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Settings from '../Settings';

vi.mock('phosphor-react', () => ({
    ArrowLeft: () => <span data-testid="back-icon">back</span>
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
