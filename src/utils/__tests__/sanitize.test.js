import { describe, it, expect } from 'vitest';
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
