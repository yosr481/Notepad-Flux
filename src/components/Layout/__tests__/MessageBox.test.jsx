import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import MessageBox from '../MessageBox';

/**
 * ROUND C — U1: MessageBox 2-button confirm mode + danger prop.
 *
 * Pinned contract:
 *  - 2-button mode is triggered by secondaryLabel == null (null OR undefined),
 *    NOT by a `variant` prop. (Chosen because the existing default
 *    secondaryLabel is "Don't Save", so no current caller regresses, and
 *    dialogs.confirm simply omits secondaryLabel.)
 *  - In 2-button mode the secondary <button> is NOT in the DOM at all.
 *  - `danger` prop (boolean, default false). When true the PRIMARY button
 *    carries a `data-danger` attribute; when false/absent it does not.
 *    (data-* chosen over a CSS-module class so the assertion does not depend
 *    on CSS-module hashing.)
 *  - Esc -> onCancel, Enter -> onPrimary in BOTH modes.
 *  - Existing 3-button behaviour is unchanged when secondaryLabel is a string.
 */

afterEach(cleanup);

const baseProps = {
    title: 'Title',
    message: 'Body text',
    primaryLabel: 'Save',
    cancelLabel: 'Cancel',
};

describe('MessageBox — 3-button (existing) behaviour', () => {
    it('renders all three buttons when secondaryLabel is a string', () => {
        const { getByText, getAllByRole } = render(
            <MessageBox
                {...baseProps}
                secondaryLabel="Don't Save"
                onPrimary={vi.fn()}
                onSecondary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(getAllByRole('button')).toHaveLength(3);
        expect(getByText('Save')).toBeInTheDocument();
        expect(getByText("Don't Save")).toBeInTheDocument();
        expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('defaults secondaryLabel to "Don\'t Save" (3-button) when the prop is omitted entirely', () => {
        // Distinguishes "prop omitted -> default string -> 3 buttons" from
        // "prop explicitly null -> 2 buttons". Omitting must NOT collapse to 2.
        const { getAllByRole, getByText } = render(
            <MessageBox
                {...baseProps}
                onPrimary={vi.fn()}
                onSecondary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(getAllByRole('button')).toHaveLength(3);
        expect(getByText("Don't Save")).toBeInTheDocument();
    });

    it('clicking secondary fires onSecondary only', () => {
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();
        const onCancel = vi.fn();
        const { getByText } = render(
            <MessageBox
                {...baseProps}
                secondaryLabel="Don't Save"
                onPrimary={onPrimary}
                onSecondary={onSecondary}
                onCancel={onCancel}
            />
        );
        fireEvent.click(getByText("Don't Save"));
        expect(onSecondary).toHaveBeenCalledTimes(1);
        expect(onPrimary).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });
});

describe('MessageBox — 2-button confirm mode (secondaryLabel == null)', () => {
    it('omits the secondary button when secondaryLabel is null', () => {
        const { getAllByRole, queryByText } = render(
            <MessageBox
                {...baseProps}
                secondaryLabel={null}
                onPrimary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(getAllByRole('button')).toHaveLength(2);
        expect(queryByText("Don't Save")).toBeNull();
    });

    it('renders exactly [cancel] and [primary] with their labels', () => {
        const { getByText, getAllByRole } = render(
            <MessageBox
                {...baseProps}
                primaryLabel="Clear"
                cancelLabel="Keep"
                secondaryLabel={null}
                onPrimary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        const buttons = getAllByRole('button').map(b => b.textContent);
        expect(buttons).toEqual(expect.arrayContaining(['Clear', 'Keep']));
        expect(buttons).toHaveLength(2);
        expect(getByText('Clear')).toBeInTheDocument();
        expect(getByText('Keep')).toBeInTheDocument();
    });

    it('does not crash and never calls onSecondary when onSecondary is not supplied', () => {
        const onPrimary = vi.fn();
        const onCancel = vi.fn();
        const { getByText } = render(
            <MessageBox
                {...baseProps}
                primaryLabel="Clear"
                secondaryLabel={null}
                onPrimary={onPrimary}
                onCancel={onCancel}
            />
        );
        fireEvent.click(getByText('Clear'));
        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('Enter still triggers onPrimary in 2-button mode', () => {
        const onPrimary = vi.fn();
        render(
            <MessageBox
                {...baseProps}
                secondaryLabel={null}
                onPrimary={onPrimary}
                onCancel={vi.fn()}
            />
        );
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onPrimary).toHaveBeenCalledTimes(1);
    });

    it('Esc still triggers onCancel in 2-button mode', () => {
        const onCancel = vi.fn();
        render(
            <MessageBox
                {...baseProps}
                secondaryLabel={null}
                onPrimary={vi.fn()}
                onCancel={onCancel}
            />
        );
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe('MessageBox — danger prop', () => {
    it('adds data-danger to the primary button when danger is true', () => {
        const { getByText } = render(
            <MessageBox
                {...baseProps}
                primaryLabel="Clear"
                secondaryLabel={null}
                danger
                onPrimary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(getByText('Clear')).toHaveAttribute('data-danger');
    });

    it('does NOT add data-danger to the primary button by default', () => {
        const { getByText } = render(
            <MessageBox
                {...baseProps}
                primaryLabel="Clear"
                secondaryLabel={null}
                onPrimary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(getByText('Clear')).not.toHaveAttribute('data-danger');
    });

    it('does not put data-danger on the cancel button', () => {
        const { getByText } = render(
            <MessageBox
                {...baseProps}
                primaryLabel="Clear"
                cancelLabel="Keep"
                secondaryLabel={null}
                danger
                onPrimary={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(getByText('Keep')).not.toHaveAttribute('data-danger');
    });
});
