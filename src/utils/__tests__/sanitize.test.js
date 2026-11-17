import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { sanitizeHTML } from '../sanitize';

describe('sanitizeHTML', () => {
    it('should allow safe tags', () => {
        const input = '<b>Bold</b> <i>Italic</i> <p>Paragraph</p> <br> <ul><li>List</li></ul> <table><tbody><tr><td>Cell</td></tr></tbody></table> <code>Code</code> <del>Strike</del>';
        const output = sanitizeHTML(input);
        expect(output).toBe(input);
    });

    it('should allow safe attributes', () => {
        const input = '<a href="https://example.com" title="Example" class="link">Link</a>';
        const output = sanitizeHTML(input);
        expect(output).toBe(input);
    });

    it('should remove unsafe tags', () => {
        const input = '<div>Safe?</div><script>alert("XSS")</script><img src=x onerror=alert(1)>';
        const output = sanitizeHTML(input);
        expect(output).not.toContain('<script>');
        expect(output).not.toContain('onerror');
        // div is not in ALLOWED_TAGS
        expect(output).not.toContain('<div>');
        expect(output).toContain('Safe?');
    });

    it('should remove unsafe attributes', () => {
        const input = '<a href="javascript:alert(1)" onclick="alert(1)">Link</a>';
        const output = sanitizeHTML(input);
        expect(output).not.toContain('javascript:');
        expect(output).not.toContain('onclick');
    });

    it('should handle data attributes based on config', () => {
        const input = '<b data-something="value">Bold</b>';
        const output = sanitizeHTML(input);
        expect(output).toBe('<b>Bold</b>');
    });

    // --- New allowlist contract (P2-sanitize) ---

    it('should keep all six heading levels', () => {
        const input = '<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h5>e</h5><h6>f</h6>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('should keep pre, blockquote, hr and span', () => {
        const input = '<blockquote><p>quote</p></blockquote><pre><code>x</code></pre><hr><span>s</span>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('should keep img with src and alt', () => {
        const input = '<img src="pic.png" alt="a picture">';
        const output = sanitizeHTML(input);
        expect(output).toContain('<img');
        expect(output).toContain('src="pic.png"');
        expect(output).toContain('alt="a picture"');
    });

    it('should keep an img but drop its onerror handler', () => {
        // pins contract point 4: tag + src survive, event handler is gone
        const output = sanitizeHTML('<img src="x" onerror="alert(1)">');
        expect(output).toContain('<img');
        expect(output).not.toContain('onerror');
        expect(output).not.toContain('alert(1)');
    });

    it('should still allow the pre-existing safe tags', () => {
        const input = '<b>Bold</b> <i>Italic</i> <p>Paragraph</p> <br> <ul><li>List</li></ul> <table><tbody><tr><td>Cell</td></tr></tbody></table> <code>Code</code> <del>Strike</del>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('should still allow href, title and class attributes', () => {
        const input = '<a href="https://example.com" title="Example" class="link">Link</a>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    // --- SAFE_FOR_TEMPLATES removed: template-like literals pass through ---

    it('should pass {{ mustache }} literal text through unchanged inside a p', () => {
        // SAFE_FOR_TEMPLATES:true used to blank this out; contract point 2 wants it kept.
        const input = '<p>{{ mustache }}</p>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('should pass ${expr} literal text through unchanged inside a p', () => {
        const input = '<p>total is ${expr} dollars</p>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    // --- Regression guards: these must stay stripped ---

    it('should strip script tags', () => {
        expect(sanitizeHTML('<p>ok</p><script>alert(1)</script>')).not.toContain('<script');
    });

    it('should strip inline event-handler attributes', () => {
        const output = sanitizeHTML('<p onclick="alert(1)" onload="x()" onmouseover="y()">hi</p>');
        expect(output).not.toContain('onclick');
        expect(output).not.toContain('onload');
        expect(output).not.toContain('onmouseover');
    });

    it('should strip javascript: hrefs', () => {
        expect(sanitizeHTML('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    });

    it('should strip data: hrefs on anchors (non-image)', () => {
        const output = sanitizeHTML('<a href="data:text/html,<script>alert(1)</script>">x</a>');
        expect(output).not.toContain('data:text/html');
        expect(output).not.toContain('<script');
    });

    it('should strip iframe, object and embed', () => {
        const output = sanitizeHTML('<iframe src="evil"></iframe><object data="evil"></object><embed src="evil">');
        expect(output).not.toContain('<iframe');
        expect(output).not.toContain('<object');
        expect(output).not.toContain('<embed');
    });

    it('should strip style and form elements', () => {
        const output = sanitizeHTML('<style>body{display:none}</style><form action="/x"><input></form>');
        expect(output).not.toContain('<style');
        expect(output).not.toContain('<form');
        expect(output).not.toContain('<input');
    });
});

// F2 footnotes (Docs/internal/footnotes-spec.md "Security", revised 2026-11-17): sup + section allowed; `id` is NOT
// allowed at all (export sets footnote ids itself, after sanitizing, from a per-render nonce marker).
describe('sanitizeHTML: footnotes', () => {
    it('keeps sup and section', () => {
        const input = '<p>a<sup>1</sup></p><section class="footnotes"><ol><li>n</li></ol></section>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('keeps the footnote ref and back-link shape, minus ids', () => {
        expect(sanitizeHTML('<sup><a href="#fn-1" id="fnref-1" class="footnote-ref">1</a></sup>'))
            .toBe('<sup><a href="#fn-1" class="footnote-ref">1</a></sup>');
        expect(sanitizeHTML('<ol><li id="fn-1"><p>n <a href="#fnref-1" class="footnote-backref">↩</a></p></li></ol>'))
            .toBe('<ol><li><p>n <a href="#fnref-1" class="footnote-backref">↩</a></p></li></ol>');
    });

    it.each(['fn-1', 'fn-12', 'fnref-1', 'fnref-1-2', 'x', 'location', 'fn-abc', ' fn-1', 'FN-1', 'fn-1&#10;'])(
        'removes id="%s" but keeps the element and its text',
        (id) => {
            expect(sanitizeHTML(`<p id="${id}">keep</p>`)).toBe('<p>keep</p>');
            expect(sanitizeHTML(`<li id="${id}">keep</li>`)).toBe('<li>keep</li>');
        },
    );

    it('removes ids on any allowed tag, keeps other attributes', () => {
        const out = sanitizeHTML('<a id="location" href="https://e.com" class="c">t</a><img id="cookie" src="a.png" alt="x">');
        expect(out).not.toContain('id=');
        expect(out).toContain('href="https://e.com"');
        expect(out).toContain('class="c"');
        expect(out).toContain('src="a.png"');
    });

    it('still drops style, data-* and name attributes', () => {
        const out = sanitizeHTML('<sup style="color:red" data-x="1" name="n">1</sup><section style="x" data-y="2">s</section>');
        expect(out).toBe('<sup>1</sup><section>s</section>');
    });

    it('does not widen other rules: div still stripped, javascript: href still removed, no id survives', () => {
        const out = sanitizeHTML('<div id="fn-1">d</div><a id="fn-2" href="javascript:alert(1)">l</a>');
        expect(out).not.toContain('<div');
        expect(out).not.toContain('javascript:');
        expect(out).not.toContain('id=');
    });

    it('leaves no global DOMPurify hook behind: other DOMPurify users keep their ids (e.g. the math SVG sanitizer)', () => {
        const svg = DOMPurify.sanitize('<svg xmlns="http://www.w3.org/2000/svg" id="glyph1"><rect id="r2" width="1" height="1"/></svg>', { USE_PROFILES: { svg: true } });
        expect(svg).toContain('id="glyph1"');
        expect(svg).toContain('id="r2"');
        expect(DOMPurify.sanitize('<p id="myid">x</p>', { ALLOWED_TAGS: ['p'], ALLOWED_ATTR: ['id'] })).toBe('<p id="myid">x</p>');
    });
});
