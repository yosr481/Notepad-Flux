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
});
