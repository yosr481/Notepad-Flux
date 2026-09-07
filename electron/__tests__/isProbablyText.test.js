import { describe, it, expect } from 'vitest';
import { isProbablyText } from '../isProbablyText.js';

describe('isProbablyText (binary-file guard, QA finding 2)', () => {
    it('plain ASCII text → true', () => {
        expect(isProbablyText(Buffer.from('hello world\nsecond line\n'))).toBe(true);
    });

    it('UTF-8 multibyte (Hebrew) → true', () => {
        expect(isProbablyText(Buffer.from('שלום עולם', 'utf-8'))).toBe(true);
    });

    it('UTF-8 multibyte (emoji) → true', () => {
        expect(isProbablyText(Buffer.from('done ✅ 🚀', 'utf-8'))).toBe(true);
    });

    it('empty buffer → true', () => {
        expect(isProbablyText(Buffer.alloc(0))).toBe(true);
    });

    it('NUL in the first bytes → false', () => {
        expect(isProbablyText(Buffer.from([0x41, 0x42, 0x00, 0x43]))).toBe(false);
    });

    it('NUL at byte 0 → false', () => {
        expect(isProbablyText(Buffer.from([0x00, 0x41, 0x41]))).toBe(false);
    });

    // sniff window is the first 8000 bytes; a NUL past that must not be seen
    it('NUL only after byte 8000 → true', () => {
        const buf = Buffer.concat([Buffer.alloc(8001, 0x41), Buffer.from([0x00])]);
        expect(isProbablyText(buf)).toBe(true);
    });

    // boundary: NUL exactly at index 7999 is inside the window → false
    it('NUL at index 7999 (last byte of window) → false', () => {
        const arr = Buffer.alloc(8000, 0x41);
        arr[7999] = 0x00;
        expect(isProbablyText(arr)).toBe(false);
    });

    // boundary: NUL at index 8000 is the first byte outside the window → true
    it('NUL at index 8000 (first byte past window) → true', () => {
        const arr = Buffer.alloc(8001, 0x41);
        arr[8000] = 0x00;
        expect(isProbablyText(arr)).toBe(true);
    });

    it('Uint8Array (not Buffer) is accepted', () => {
        expect(isProbablyText(new Uint8Array([0x41, 0x42, 0x43]))).toBe(true);
        expect(isProbablyText(new Uint8Array([0x41, 0x00]))).toBe(false);
    });

    it('null → false', () => {
        expect(isProbablyText(null)).toBe(false);
    });

    it('undefined → false', () => {
        expect(isProbablyText(undefined)).toBe(false);
    });

    it('plain string → false', () => {
        expect(isProbablyText('hello')).toBe(false);
    });

    it('number → false', () => {
        expect(isProbablyText(42)).toBe(false);
    });

    it('plain object / array → false', () => {
        expect(isProbablyText({})).toBe(false);
        expect(isProbablyText([0x41, 0x42])).toBe(false);
    });
});
