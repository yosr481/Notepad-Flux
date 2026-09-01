import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calls onClose after the given duration', () => {
        const onClose = vi.fn();
        render(<Toast message="Saved" duration={3000} onClose={onClose} />);

        expect(onClose).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(2999));
        expect(onClose).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not fire again after the timer is cleared on unmount', () => {
        const onClose = vi.fn();
        const { unmount } = render(<Toast message="Saved" duration={3000} onClose={onClose} />);

        unmount();
        act(() => vi.advanceTimersByTime(5000));

        expect(onClose).not.toHaveBeenCalled();
    });
});
