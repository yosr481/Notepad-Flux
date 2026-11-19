import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { changelogSection } from '../changelogSection';
import { version } from '../../../package.json';

/**
 * S2 — changelogSection(markdown, version) (Docs/internal/changelog-about-spec.md).
 *
 * Pinned contract:
 *  - named export from src/utils/changelogSection.js; pure; never throws for any input.
 *  - header = line starting `## [<version>]`, then spaces/tabs, then `-`, `–` or `—`, then the rest of the line
 *    (the date). A header without a separator (`## [Unreleased]`, `## [1.0.0]`) never matches.
 *  - body = everything after the header line up to the next line starting `## [` (or EOF), trimmed.
 *    `###` lines are body, they do not end it. Inner line endings are left as in the source (CRLF not normalised).
 *  - null when: version not found; body is empty after trim; markdown or version not a non-empty string.
 *  - version compared literally (no regex), whole bracket content: `1.6.0` != `1.6.0-beta` != `11.6.0` != `1x6x0`.
 *  - [Unreleased] is never returned (it has no separator, and asking for "Unreleased" gives null).
 *  - first match wins on a duplicated version.
 */
const LF = [
    '# Changelog',
    '',
    'intro text, ignored',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '- not yet released',
    '',
    '## [1.6.0] — 2026-11-16',
    '',
    '### Added',
    '',
    '- Math formulas',
    '- Second item',
    '',
    '### Fixed',
    '',
    '- A bug',
    '',
    '## [1.5.0] - 2026-11-16',
    '',
    '- hyphen separated',
    '',
    '## [1.4.0] – 2026-11-12',
    '',
    '- en dash separated',
    '',
    '## [1.3.0] \t—\t 2026-04-14',
    '',
    '- tabs around the separator',
    '',
].join('\n');
const CRLF = LF.replace(/\n/g, '\r\n');

describe('changelogSection — extraction', () => {
    it.each([['LF', LF], ['CRLF', CRLF]])('returns the body of a section, trimmed (%s)', (_n, md) => {
        const s = changelogSection(md, '1.6.0');
        expect(s).toMatch(/^### Added/);
        expect(s).toMatch(/- A bug$/);
        expect(s).toContain('- Math formulas');
        expect(s).toContain('- Second item');
        expect(s).toBe(s.trim());
    });

    it.each([['LF', LF], ['CRLF', CRLF]])('stops at the next "## [" header and does not leak neighbours (%s)', (_n, md) => {
        const s = changelogSection(md, '1.6.0');
        expect(s).not.toContain('hyphen separated');
        expect(s).not.toContain('not yet released');
        expect(s).not.toContain('## [');
        expect(s).not.toContain('2026-11-16');   // the header line itself is not part of the body
    });

    it('### headings inside a section do not end it', () => {
        expect(changelogSection(LF, '1.6.0')).toContain('### Fixed');
    });

    it.each([['hyphen', '1.5.0', 'hyphen separated'], ['en dash', '1.4.0', 'en dash separated'], ['em dash', '1.6.0', 'Math formulas'], ['tabs around the separator', '1.3.0', 'tabs around the separator']])(
        'accepts the %s separator', (_n, v, text) => {
            expect(changelogSection(LF, v)).toContain(text);
            expect(changelogSection(CRLF, v)).toContain(text);
        });

    it('the last section runs to end of file, trailing blank lines trimmed', () => {
        expect(changelogSection(LF, '1.3.0')).toBe('- tabs around the separator');
        expect(changelogSection(CRLF, '1.3.0')).toBe('- tabs around the separator');
    });

    it('a section without a trailing newline at EOF', () => {
        expect(changelogSection('## [2.0.0] — d\n- only line', '2.0.0')).toBe('- only line');
    });

    it('a body line that merely contains "## [" mid-line does not end the section', () => {
        expect(changelogSection('## [2.0.0] — d\n- see ## [x] here\n- more\n', '2.0.0')).toBe('- see ## [x] here\n- more');
    });

    it('duplicate version: first one wins', () => {
        expect(changelogSection('## [2.0.0] — a\n- one\n## [2.0.0] — b\n- two\n', '2.0.0')).toBe('- one');
    });

    it('a pre-release version is matched when asked for exactly', () => {
        expect(changelogSection('## [1.7.0-beta.1] — d\n- pre\n## [1.6.0] — d\n- rel\n', '1.7.0-beta.1')).toBe('- pre');
    });
});

describe('changelogSection — null paths', () => {
    it('missing version -> null', () => {
        expect(changelogSection(LF, '9.9.9')).toBeNull();
        expect(changelogSection(CRLF, '9.9.9')).toBeNull();
    });

    it('never returns [Unreleased], by name or otherwise', () => {
        expect(changelogSection(LF, 'Unreleased')).toBeNull();
        expect(changelogSection(LF, '[Unreleased]')).toBeNull();
        expect(changelogSection('## [Unreleased]\n- x\n', 'Unreleased')).toBeNull();
        expect(changelogSection('## [Unreleased] — 2026-01-01\n- x\n', 'Unreleased')).toBeNull();
    });

    it('a header without a separator/date does not match', () => {
        expect(changelogSection('## [1.0.0]\n- x\n', '1.0.0')).toBeNull();
    });

    it('a header not at the start of the line does not match', () => {
        expect(changelogSection('text ## [1.0.0] — d\n- x\n', '1.0.0')).toBeNull();
    });

    it('empty body (header straight into the next header, or EOF) -> null', () => {
        expect(changelogSection('## [1.0.0] — d\n\n## [0.9.0] — d\n- x\n', '1.0.0')).toBeNull();
        expect(changelogSection('## [1.0.0] — d\n\n  \n', '1.0.0')).toBeNull();
        expect(changelogSection('## [1.0.0] — d', '1.0.0')).toBeNull();
    });

    it.each([[undefined], [null], [42], [{}], ['']])('markdown %p -> null, no throw', (md) => {
        expect(changelogSection(md, '1.6.0')).toBeNull();
    });

    it.each([[undefined], [null], [''], [16], [{}]])('version %p -> null, no throw', (v) => {
        expect(changelogSection(LF, v)).toBeNull();
    });
});

describe('changelogSection — literal version match', () => {
    it('dots are not wildcards: 1.6.0 does not match [1x6x0]', () => {
        expect(changelogSection('## [1x6x0] — d\n- wrong\n', '1.6.0')).toBeNull();
        expect(changelogSection('## [1x6x0] — d\n- wrong\n## [1.6.0] — d\n- right\n', '1.6.0')).toBe('- right');
    });

    it('1.6.0 does not match [1.6.0-beta]', () => {
        expect(changelogSection('## [1.6.0-beta] — d\n- wrong\n', '1.6.0')).toBeNull();
    });

    it('1.6.0 does not match [11.6.0] or [1.6.0.1] or [21.6.0]', () => {
        expect(changelogSection('## [11.6.0] — d\n- wrong\n', '1.6.0')).toBeNull();
        expect(changelogSection('## [21.6.0] — d\n- wrong\n', '1.6.0')).toBeNull();
        expect(changelogSection('## [1.6.0.1] — d\n- wrong\n', '1.6.0')).toBeNull();
    });

    it('a prefix of the version does not match: 1.6 vs [1.6.0]', () => {
        expect(changelogSection('## [1.6.0] — d\n- x\n', '1.6')).toBeNull();
    });

    it.each([['1.(', '## [1.(] — d\n- paren\n'], ['1+', '## [1+] — d\n- plus\n'], ['.*', '## [.*] — d\n- star\n'], ['[', '## [[] — d\n- br\n']])(
        'regex metacharacters in the version are literal and never throw (%s)', (v, md) => {
            expect(() => changelogSection(LF, v)).not.toThrow();
            expect(changelogSection(LF, v)).toBeNull();
            expect(changelogSection(md, v)).not.toBeNull();
        });

    it('".*" does not match every section', () => {
        expect(changelogSection(LF, '.*')).toBeNull();
    });
});

describe('changelogSection — real CHANGELOG.md', () => {
    const md = fs.readFileSync(path.resolve(__dirname, '../../../CHANGELOG.md'), 'utf8');
    const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exists = new RegExp('^## \\[' + esc + '\\][ \\t]*[-–—]', 'm').test(md);

    it('package.json version: section returned if CHANGELOG has one, else null', () => {
        const s = changelogSection(md, version);
        if (!exists) { expect(s).toBeNull(); return; }
        expect(s).toBeTruthy();
        expect(s).not.toMatch(/^## \[/m);
        expect(s).toBe(s.trim());
        expect(s).toMatch(/^### /m);
    });

    it('[Unreleased] is never returned from the real file', () => {
        expect(changelogSection(md, 'Unreleased')).toBeNull();
    });

    it('works on the real file with CRLF line endings too', () => {
        const a = changelogSection(md.replace(/\r\n/g, '\n'), version);
        const b = changelogSection(md.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), version);
        expect(b === null ? null : b.replace(/\r\n/g, '\n')).toBe(a);
    });
});
