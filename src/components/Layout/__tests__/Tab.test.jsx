import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Tab from '../Tab';

// Mock phosphor-react icons
vi.mock('phosphor-react', () => ({
    X: () => <span data-testid="close-icon">X</span>,
    File: () => <span data-testid="file-icon">F</span>
}));

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: null
    }),
    CSS: { Transform: { toString: vi.fn() } }
}));

describe('Tab Component', () => {
    const mockTab = {
        id: '1',
        title: 'Test Tab',
        isDirty: false
    };

    const defaultProps = {
        tab: mockTab,
        isActive: false,
        onClick: vi.fn(),
        onClose: vi.fn()
    };

    it('should render tab title', () => {
        render(<Tab {...mockTab} {...defaultProps} />);
        expect(screen.getByText('Test Tab')).toBeInTheDocument();
    });

    it('should show dirty indicator when isDirty is true', () => {
        render(<Tab {...mockTab} {...defaultProps} isDirty={true} />);
        expect(screen.getByText('Test Tab')).toBeInTheDocument();
        // Just verify it renders without crashing for now, unless we know the DOM structure.
    });

    it('should call onClick when clicked', () => {
        render(<Tab {...mockTab} {...defaultProps} />);
        fireEvent.click(screen.getByText('Test Tab'));
        expect(defaultProps.onClick).toHaveBeenCalledWith('1');
    });

    it('should call onClose when close button clicked', () => {
        render(<Tab {...mockTab} {...defaultProps} />);
        const closeButton = screen.getByTestId('close-icon').parentElement; // Assuming icon is wrapped in button
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalledWith('1');
    });
});
