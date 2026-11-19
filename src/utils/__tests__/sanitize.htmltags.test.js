import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../sanitize';
import { SAFE_INLINE_HTML_TAGS } from '../../extensions/htmlInlinePreview';

// F7 T1: the editor renders exactly the tags the export allows. SAFE_INLINE_HTML_TAGS (named export of
// src/extensions/htmlInlinePreview.js) is the single list; every name in it must survive sanitizeHTML
// (i.e. be in ALLOWED_TAGS). Checked by behaviour, so ALLOWED_TAGS needs no export.
describe('sanitize: editor tag list vs ALLOWED_TAGS', () => {
    it('the list is not empty (guards a vacuous it.each)', () => {
        expect(SAFE_INLINE_HTML_TAGS.length).toBeGreaterThanOrEqual(9);
    });
    it.each([...['kbd', 'mark', 'u', 'abbr', 'ins', 'small', 'span', 'sub', 'sup']])('%s survives sanitizeHTML', (n) => {
        expect(sanitizeHTML(`<${n}>x</${n}>`)).toBe(`<${n}>x</${n}>`);
    });
    it('every name in SAFE_INLINE_HTML_TAGS survives sanitizeHTML', () => {
        for (const n of SAFE_INLINE_HTML_TAGS) expect(sanitizeHTML(`<${n}>x</${n}>`), n).toBe(`<${n}>x</${n}>`);
    });
    it('abbr keeps title; style/id/name/on*/data-* go from every new tag', () => {
        expect(sanitizeHTML('<abbr title="t">x</abbr>')).toBe('<abbr title="t">x</abbr>');
        for (const n of ['kbd', 'mark', 'u', 'abbr', 'ins', 'small']) {
            const out = sanitizeHTML(`<${n} style="color:red" id="i" name="n" onclick="a()" data-x="1">x</${n}>`);
            expect(out, n).toBe(`<${n}>x</${n}>`);
        }
    });
    it('still dropped: script, iframe, style, javascript: href', () => {
        expect(sanitizeHTML('<kbd>k</kbd><script>alert(1)</script>')).toBe('<kbd>k</kbd>');
        expect(sanitizeHTML('<iframe src="x"></iframe><style>a{}</style>')).toBe('');
        expect(sanitizeHTML('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    });
});
