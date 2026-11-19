import { describe, it, expect, vi } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { SUB_SUP_CASES } from '../../test/subSupCases';

vi.mock('../../utils/fileSystem', () => ({ fileSystem: { exportFile: vi.fn() } }));
import { renderMarkdownHtml } from '../../utils/export';

// F6 T1 parity: ONE case table, run through the editor's lezer parse and through the HTML export.
// Pinned: editor list = [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript] (app order, new ones last).
const parser = markdown({
    base: markdownLanguage,
    extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript],
}).language.parser;
const has = (md, name) => {
    let found = false;
    parser.parse(md).iterate({ enter: (n) => { if (n.name === name) found = true; } });
    return found;
};
const T = 60000;
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const realSups = (d) => [...d.querySelectorAll('sup')].filter((s) => !s.querySelector(':scope > a.footnote-ref'));

describe('sub/sup parity: editor (lezer) and export agree on every case', () => {
    it.each(SUB_SUP_CASES)('editor: %j -> sub %s, sup %s', (md, sub, sup) => {
        expect(has(md, 'Subscript')).toBe(sub);
        expect(has(md, 'Superscript')).toBe(sup);
    });

    it.each(SUB_SUP_CASES)('export: %j -> sub %s, sup %s', async (md, sub, sup) => {
        const d = dom(await renderMarkdownHtml(md));
        expect(d.querySelectorAll('sub').length > 0).toBe(sub);
        expect(realSups(d).length > 0).toBe(sup);
    }, T);

    it('table covers both outcomes for sub and for sup (guards a degenerate table)', () => {
        expect(SUB_SUP_CASES.some((c) => c[1])).toBe(true);
        expect(SUB_SUP_CASES.some((c) => c[2])).toBe(true);
        expect(SUB_SUP_CASES.some((c) => !c[1] && !c[2])).toBe(true);
        expect(SUB_SUP_CASES.length).toBeGreaterThanOrEqual(25);
    });
});
