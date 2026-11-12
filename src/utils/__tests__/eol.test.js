import { describe, it, expect } from 'vitest';
import { detectEol, normalizeEol, detectCharset, applyCharset } from '../eol';

// ---------------------------------------------------------------------------
// TASK 10 — src/utils/eol.js: 4 pure helpers behind the real status-bar
// line-ending + charset cells.
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec fixed, restated so they read as decisions):
//
//  * detectEol returns the string 'CRLF' or 'LF' — never a token like '\r\n'.
//    ANY '\r\n' in the content -> 'CRLF'. A lone '\r' with no following '\n'
//    does NOT count as CRLF (only the '\r\n' pair is looked for). Non-string
//    and '' -> 'LF'.
//  * normalizeEol is the ONLY writer of on-disk line endings:
//      - target 'CRLF': collapse '\r\n'->'\n' first, THEN '\n'->'\r\n'. This
//        two-step order is deliberate: it guarantees no '\r\r\n' is ever
//        produced from already-CRLF or mixed input.
//      - any other target (incl. 'LF', undefined, 'lf', 'crlf' lower, junk):
//        collapse '\r\n'->'\n' only. Lone '\r' is left untouched — no CR-only
//        Mac conversion is in scope.
//      - idempotent in both directions.
//  * detectCharset: leading U+FEFF -> 'UTF-8 BOM', else 'UTF-8'. Non-string ->
//    'UTF-8'. Only position 0 is inspected.
//  * applyCharset:
//      - 'UTF-8 BOM': exactly one leading U+FEFF (add if absent, never double).
//      - anything else: strip a single leading U+FEFF if present, else no-op.
//      - idempotent.

const BOM = '﻿';

describe('detectEol', () => {
    it('returns CRLF when the content contains a \\r\\n pair', () => {
        expect(detectEol('a\r\nb')).toBe('CRLF');
    });

    it('returns LF for pure-LF content', () => {
        expect(detectEol('a\nb\nc')).toBe('LF');
    });

    it('returns CRLF for mixed content that has at least one \\r\\n', () => {
        expect(detectEol('a\r\nb\nc')).toBe('CRLF');
    });

    it('returns LF for empty string', () => {
        expect(detectEol('')).toBe('LF');
    });

    it('returns LF for non-string input', () => {
        expect(detectEol(undefined)).toBe('LF');
        expect(detectEol(null)).toBe('LF');
        expect(detectEol(42)).toBe('LF');
    });

    it('a lone \\r (no following \\n) is NOT treated as CRLF', () => {
        expect(detectEol('a\rb')).toBe('LF');
    });
});

describe('normalizeEol', () => {
    it('LF -> CRLF converts every break', () => {
        expect(normalizeEol('a\nb\nc', 'CRLF')).toBe('a\r\nb\r\nc');
    });

    it('CRLF -> LF collapses every break', () => {
        expect(normalizeEol('a\r\nb\r\nc', 'LF')).toBe('a\nb\nc');
    });

    it('mixed -> CRLF never produces \\r\\r\\n', () => {
        const out = normalizeEol('a\r\nb\nc\r\nd', 'CRLF');
        expect(out).toBe('a\r\nb\r\nc\r\nd');
        expect(out).not.toMatch(/\r\r/);
    });

    it('mixed -> LF collapses the \\r\\n pairs and leaves the lone \\n', () => {
        expect(normalizeEol('a\r\nb\nc', 'LF')).toBe('a\nb\nc');
    });

    it('undefined target behaves as LF (collapse only)', () => {
        expect(normalizeEol('a\r\nb', undefined)).toBe('a\nb');
    });

    it('an unrecognised target behaves as LF (collapse only)', () => {
        expect(normalizeEol('a\r\nb', 'utf-junk')).toBe('a\nb');
        expect(normalizeEol('a\r\nb', 'crlf')).toBe('a\nb'); // case-sensitive: only exact 'CRLF'
    });

    it('is idempotent for CRLF', () => {
        const once = normalizeEol('a\nb\r\nc', 'CRLF');
        expect(normalizeEol(once, 'CRLF')).toBe(once);
    });

    it('is idempotent for LF', () => {
        const once = normalizeEol('a\r\nb\r\nc', 'LF');
        expect(normalizeEol(once, 'LF')).toBe(once);
    });

    it('leaves content with no line breaks untouched', () => {
        expect(normalizeEol('abc', 'CRLF')).toBe('abc');
        expect(normalizeEol('abc', 'LF')).toBe('abc');
    });
});

describe('detectCharset', () => {
    it('returns "UTF-8 BOM" when the first char is U+FEFF', () => {
        expect(detectCharset(BOM + 'hello')).toBe('UTF-8 BOM');
    });

    it('returns "UTF-8" without a leading BOM', () => {
        expect(detectCharset('hello')).toBe('UTF-8');
    });

    it('returns "UTF-8" for empty string', () => {
        expect(detectCharset('')).toBe('UTF-8');
    });

    it('returns "UTF-8" for non-string input', () => {
        expect(detectCharset(undefined)).toBe('UTF-8');
        expect(detectCharset(null)).toBe('UTF-8');
    });

    it('a BOM that is not at position 0 does not count', () => {
        expect(detectCharset('a' + BOM + 'b')).toBe('UTF-8');
    });
});

describe('applyCharset', () => {
    it('adds a leading BOM when missing', () => {
        expect(applyCharset('hello', 'UTF-8 BOM')).toBe(BOM + 'hello');
    });

    it('does not double the BOM when one is already present', () => {
        expect(applyCharset(BOM + 'hello', 'UTF-8 BOM')).toBe(BOM + 'hello');
    });

    it('strips a leading BOM for plain UTF-8', () => {
        expect(applyCharset(BOM + 'hello', 'UTF-8')).toBe('hello');
    });

    it('plain UTF-8 with no BOM is a no-op', () => {
        expect(applyCharset('hello', 'UTF-8')).toBe('hello');
    });

    it('an unrecognised charset behaves as plain UTF-8 (strip BOM)', () => {
        expect(applyCharset(BOM + 'hello', 'latin1')).toBe('hello');
    });

    it('is idempotent for UTF-8 BOM', () => {
        const once = applyCharset('hello', 'UTF-8 BOM');
        expect(applyCharset(once, 'UTF-8 BOM')).toBe(once);
    });

    it('is idempotent for plain UTF-8', () => {
        const once = applyCharset(BOM + 'hello', 'UTF-8');
        expect(applyCharset(once, 'UTF-8')).toBe(once);
    });

    it('only strips ONE leading BOM, not a run of them', () => {
        // a second U+FEFF is real content (ZERO WIDTH NO-BREAK SPACE) once the
        // BOM is consumed — applyCharset removes exactly the first.
        expect(applyCharset(BOM + BOM + 'x', 'UTF-8')).toBe(BOM + 'x');
    });
});
