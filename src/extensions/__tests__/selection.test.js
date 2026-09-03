import { describe, it, expect } from 'vitest';
import { isCursorTouching, isCursorOnLine } from '../selection';

describe('selection helpers', () => {
    describe('isCursorTouching', () => {
        const mockSelection = (from, to) => ({
            ranges: [{ from, to }]
        });

        it('returns true when cursor is inside range', () => {
            const selection = mockSelection(5, 8);
            expect(isCursorTouching(selection, 0, 10)).toBe(true);
        });

        it('returns true when cursor overlaps start', () => {
            const selection = mockSelection(5, 10);
            expect(isCursorTouching(selection, 8, 15)).toBe(true);
        });

        it('returns true when cursor overlaps end', () => {
            const selection = mockSelection(10, 15);
            expect(isCursorTouching(selection, 5, 12)).toBe(true);
        });

        it('returns true when ranges touch exactly at boundary (from <= to)', () => {
            const selection = mockSelection(10, 10);
            expect(isCursorTouching(selection, 10, 15)).toBe(true);
        });

        it('returns false when cursor is outside range', () => {
            const selection = mockSelection(0, 5);
            expect(isCursorTouching(selection, 10, 15)).toBe(false);
        });

        it('handles multiple selection ranges', () => {
            const selection = {
                ranges: [
                    { from: 0, to: 5 },
                    { from: 20, to: 25 }
                ]
            };
            expect(isCursorTouching(selection, 22, 28)).toBe(true);
        });
    });

    describe('isCursorOnLine', () => {
        const mockDoc = (content) => ({
            lineAt: (pos) => {
                const lines = content.split('\n');
                let currentPos = 0;
                for (let i = 0; i < lines.length; i++) {
                    const lineLength = lines[i].length + 1; // +1 for newline
                    const lineEnd = currentPos + lineLength;
                    if (pos >= currentPos && pos < lineEnd) {
                        return {
                            from: currentPos,
                            to: lineEnd - 1,
                            number: i
                        };
                    }
                    currentPos = lineEnd;
                }
                return { from: currentPos, to: currentPos + lines[lines.length - 1].length, number: lines.length - 1 };
            }
        });

        it('returns true when cursor is on the same line', () => {
            const doc = mockDoc('hello\nworld');
            const selection = { ranges: [{ from: 2, to: 2 }] };
            expect(isCursorOnLine(selection, doc, 1)).toBe(true);
        });

        it('returns false when cursor is on different line', () => {
            const doc = mockDoc('hello\nworld');
            const selection = { ranges: [{ from: 7, to: 7 }] };
            expect(isCursorOnLine(selection, doc, 1)).toBe(false);
        });

        it('returns true when cursor spans across line boundaries', () => {
            const doc = mockDoc('hello\nworld');
            const selection = { ranges: [{ from: 2, to: 8 }] };
            expect(isCursorOnLine(selection, doc, 1)).toBe(true);
        });
    });
});
