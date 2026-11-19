import { describe, it, expect } from 'vitest';
import { formatBytes } from '../formatBytes';

// S1 data-path-spec: 1024-based, 1 decimal, B/KB/MB/GB. Pinned picks (spec leaves them open):
//  - bytes (< 1024) print as whole numbers with no decimal: "1023 B"
//  - KB/MB/GB print exactly one decimal: "1.0 KB"
//  - a value that would round up to 1024.0 of its unit rolls over to the next unit
//  - no TB: anything past GB stays in GB ("1024.0 GB")
//  - not a finite number >= 0 (NaN, Infinity, negative, string, null, undefined) -> '' (caller shows nothing)
describe('formatBytes', () => {
    it.each([
        [0, '0 B'],
        [1, '1 B'],
        [512, '512 B'],
        [1023, '1023 B'],
    ])('%d -> %s (bytes, no decimal)', (n, out) => {
        expect(formatBytes(n)).toBe(out);
    });

    it.each([
        [1024, '1.0 KB'],
        [1536, '1.5 KB'],
        [1050, '1.0 KB'],   // 1.0254 rounds down
        [1100, '1.1 KB'],   // 1.0742 rounds up
        [10 * 1024, '10.0 KB'],
        [1024 * 1024 - 1024, '1023.0 KB'],
    ])('%d -> %s (KB)', (n, out) => {
        expect(formatBytes(n)).toBe(out);
    });

    it.each([
        [1024 * 1024, '1.0 MB'],
        [13002342, '12.4 MB'],
        [Math.round(12.4 * 1024 * 1024), '12.4 MB'],
        [5.5 * 1024 * 1024, '5.5 MB'],
    ])('%d -> %s (MB)', (n, out) => {
        expect(formatBytes(n)).toBe(out);
    });

    it.each([
        [1024 ** 3, '1.0 GB'],
        [1.5 * 1024 ** 3, '1.5 GB'],
        [3.1 * 1024 ** 3, '3.1 GB'],
    ])('%d -> %s (GB)', (n, out) => {
        expect(formatBytes(n)).toBe(out);
    });

    it('is 1024-based, not 1000-based', () => {
        expect(formatBytes(1000)).toBe('1000 B');
        expect(formatBytes(1024)).toBe('1.0 KB');
    });

    it('rolls over instead of printing "1024.0 <unit>"', () => {
        expect(formatBytes(1024 * 1024 - 1)).toBe('1.0 MB');
        expect(formatBytes(1024 ** 3 - 1)).toBe('1.0 GB');
        // just under the rounding edge stays in the lower unit
        expect(formatBytes(1024 * 1024 - 52)).toBe('1023.9 KB');
    });

    it('has no TB unit: huge values stay in GB', () => {
        expect(formatBytes(1024 ** 4)).toBe('1024.0 GB');
        expect(formatBytes(2 * 1024 ** 4)).toBe('2048.0 GB');
    });

    it.each([NaN, Infinity, -Infinity, -1, -1024, '1024', null, undefined, {}, []])(
        'invalid input %p -> empty string (no throw)', (v) => {
            expect(formatBytes(v)).toBe('');
        });
});
