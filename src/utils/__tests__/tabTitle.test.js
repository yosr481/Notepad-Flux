import { describe, it, expect } from 'vitest';
import { titleFromContent } from '../tabTitle';
import { sanitizeFilename } from '../fileSystem';

describe('titleFromContent', () => {
    it('plain first line', () => expect(titleFromContent('Hello world')).toBe('Hello world'));
    it('blank first line (no front matter) is Untitled', () => {
        expect(titleFromContent('\nHello')).toBe('Untitled');
        expect(titleFromContent('')).toBe('Untitled');
    });
    it('trims, slices to 35 and sanitizes', () => {
        expect(titleFromContent('  ' + 'a'.repeat(50))).toBe('a'.repeat(35));
        expect(titleFromContent('a/b')).toBe(sanitizeFilename('a/b'));
    });
    it('skips front matter: title comes from the first non-blank line after it', () => {
        expect(titleFromContent('---\ntitle: X\n---\n\n# Hello')).toBe(titleFromContent('# Hello'));
        expect(titleFromContent('---\ntitle: X\n---\n\n# Hello')).toBe(sanitizeFilename('# Hello'));
    });
    it('front matter only is Untitled', () => expect(titleFromContent('---\na: 1\n---\n')).toBe('Untitled'));
    it('empty front matter', () => expect(titleFromContent('---\n---\nNext')).toBe('Next'));
    it('unclosed --- is not front matter', () => expect(titleFromContent('---\nnot fm')).toBe(sanitizeFilename('---')));
});
