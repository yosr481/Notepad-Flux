import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLatestNotes } from '../extract-changelog.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('extractLatestNotes', () => {
    it('extracts the first section when the header uses an EM DASH (the real CHANGELOG format)', () => {
        const cl = [
            '# Changelog', '',
            '## [1.3.2] — 2026-04-14', '',
            '### Refactor', '- did a thing', '',
            '## [1.3.1] — 2026-03-01', '',
            '- older thing',
        ].join('\n');
        const notes = extractLatestNotes(cl);
        expect(notes).toContain('did a thing');
        expect(notes).not.toContain('older thing');
    });

    it('still works with a plain hyphen separator', () => {
        const cl = '## [2.0.0] - 2026-01-01\n\n- hyphen entry\n\n## [1.9.9] - 2025-12-01\n\n- prev';
        expect(extractLatestNotes(cl)).toBe('- hyphen entry');
    });

    it('works with an en dash', () => {
        const cl = '## [2.0.0] – 2026-01-01\n\n- en dash entry\n';
        expect(extractLatestNotes(cl)).toBe('- en dash entry');
    });

    it('returns the last section body at end of file (no trailing header)', () => {
        const cl = '## [1.0.0] — 2026-01-01\n\nonly section\n';
        expect(extractLatestNotes(cl)).toBe('only section');
    });

    it('returns null when there is no version header', () => {
        expect(extractLatestNotes('# Changelog\n\nnothing here')).toBeNull();
    });

    it('extracts the top section from the real repo CHANGELOG.md', () => {
        const cl = readFileSync(join(HERE, '..', '..', 'CHANGELOG.md'), 'utf8');
        const notes = extractLatestNotes(cl);
        expect(notes).toBeTruthy();
        expect(notes.length).toBeGreaterThan(0);
        // must not bleed into the second section
        expect(notes).not.toMatch(/^## \[/m);
    });
});
