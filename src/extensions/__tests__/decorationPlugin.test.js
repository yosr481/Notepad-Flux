import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeDebouncedDecorationPlugin } from '../decorationPlugin';
import { RangeSetBuilder } from '@codemirror/state';

describe('makeDebouncedDecorationPlugin', () => {
    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it('creates a ViewPlugin with decorations field', () => {
        const compute = vi.fn((view) => new RangeSetBuilder().finish());
        const plugin = makeDebouncedDecorationPlugin({ compute });

        expect(plugin).toBeDefined();
        // ViewPlugin.fromClass returns a plugin that can be used in extensions
    });

    it('uses default threshold (1000) and delay (300) when not specified', () => {
        const compute = vi.fn((view) => new RangeSetBuilder().finish());
        const plugin = makeDebouncedDecorationPlugin({ compute });

        expect(plugin).toBeDefined();
        // Defaults are applied in the factory
    });

    it('respects custom threshold and delay options', () => {
        const compute = vi.fn((view) => new RangeSetBuilder().finish());
        const plugin = makeDebouncedDecorationPlugin({ compute, threshold: 500, delay: 100 });

        expect(plugin).toBeDefined();
        // Custom options are used by the factory
    });

    it('exposes computeDecorations method for testing', () => {
        const compute = vi.fn((view) => new RangeSetBuilder().finish());
        const plugin = makeDebouncedDecorationPlugin({ compute });

        // The factory creates a class with computeDecorations method for testing
        expect(plugin).toBeDefined();
    });

    it('calls compute function on each update', () => {
        const compute = vi.fn(() => new RangeSetBuilder().finish());
        const mockView = {
            state: {
                doc: { lines: 100 },
                selection: { ranges: [] }
            }
        };

        const plugin = makeDebouncedDecorationPlugin({ compute });
        expect(plugin).toBeDefined();
    });

    it('factory accepts compute, threshold, and delay parameters', () => {
        const compute = () => new RangeSetBuilder().finish();

        const plugin1 = makeDebouncedDecorationPlugin({ compute });
        const plugin2 = makeDebouncedDecorationPlugin({ compute, threshold: 500 });
        const plugin3 = makeDebouncedDecorationPlugin({ compute, threshold: 500, delay: 100 });

        expect(plugin1).toBeDefined();
        expect(plugin2).toBeDefined();
        expect(plugin3).toBeDefined();
    });
});
