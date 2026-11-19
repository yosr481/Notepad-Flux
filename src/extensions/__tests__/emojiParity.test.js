import { describe, it, expect, vi } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { emojiFor } from '../../utils/emojiTable';
import { EMOJI_CASES } from '../../test/emojiCases';

vi.mock('../../utils/fileSystem', () => ({ fileSystem: { exportFile: vi.fn() } }));
import { renderMarkdownHtml } from '../../utils/export';

// F6 T2 parity: ONE case table, run through the editor's lezer parse (+ emojiFor) and through the HTML export.
// Pinned: editor list = [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] (app order, new last).
// emojiSyntax (our own rule, see src/test/emojiCases.js) replaces lezer's built-in Emoji; the node is still named `Emoji`.
const parser = markdown({
    base: markdownLanguage,
    extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax],
}).language.parser;
const editorNames = (md) => {
    const out = [];
    parser.parse(md).iterate({
        enter: (n) => {
            if (n.name !== 'Emoji') return;
            const name = md.slice(n.from + 1, n.to - 1);
            if (emojiFor(name) !== undefined) out.push(name);
        },
    });
    return out;
};
const T = 60000;
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
// every emoji grapheme in the rendered text: pictograph + optional VS16 / skin tone / ZWJ continuation
const glyphs = (text) => text.match(/\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*/gu) || [];

describe('emoji parity: editor (lezer + table) and export agree on every case', () => {
    it.each(EMOJI_CASES)('editor: %j -> %j', (md, names) => {
        expect(editorNames(md)).toEqual(names);
    });

    it.each(EMOJI_CASES)('export: %j -> %j', async (md, names) => {
        const d = dom(await renderMarkdownHtml(md));
        d.querySelectorAll('a.footnote-backref').forEach((a) => a.remove()); // the back-link arrow U+21A9 is pictographic
        expect(glyphs(d.textContent)).toEqual(names.map(emojiFor));
    }, T);

    it('bare email autolink: me@x.com:smile: stays literal in both (a letter precedes the colon even though marked ends the email token there)', async () => {
        const md = 'me@x.com:smile:';
        expect(editorNames(md)).toEqual([]);
        const d = dom(await renderMarkdownHtml(md));
        expect(glyphs(d.textContent)).toEqual([]);
        expect(d.querySelector('p').textContent).toBe(md);
    }, T);

    it('table covers hits, misses, and is not degenerate', () => {
        expect(EMOJI_CASES.some((c) => c[1].length > 0)).toBe(true);
        expect(EMOJI_CASES.some((c) => c[1].length === 0)).toBe(true);
        expect(EMOJI_CASES.some((c) => c[1].length > 1)).toBe(true);
        expect(EMOJI_CASES.length).toBeGreaterThanOrEqual(60);
        for (const [, names] of EMOJI_CASES) for (const n of names) expect(emojiFor(n)).toBeDefined();
    });
});

describe('name rule, pinned (editor and export both follow scanEmoji, not lezer\'s built-in)', () => {
    const parses = (md) => { let f = false; parser.parse(md).iterate({ enter: (n) => { if (n.name === 'Emoji') f = true; } }); return f; };
    it.each([':smile:', ':a_b:', ':A1:', ':100:', ':+1:', ':-1:', ':t-rex:', ':e-mail:', ':non-potable_water:', 'a :smile: b', '(:smile:)', ':smile::tada:'])('%j parses as an Emoji node', (md) => {
        expect(parses(md)).toBe(true);
    });
    it.each([':a b:', '::', ':smile', 'a::b', 'http://x.test', '10:30:45', '12:100:45', '1:100:1000', 'a:smile:b', ':smile:b', '1:smile:', ':smile:1', ':sm\nile:'])('%j does not parse', (md) => {
        expect(parses(md)).toBe(false);
    });
    it('Emoji node spans colon to colon inclusive', () => {
        const md = 'a :smile: b';
        let span = null;
        parser.parse(md).iterate({ enter: (n) => { if (n.name === 'Emoji') span = [n.from, n.to]; } });
        expect(span).toEqual([md.indexOf(':smile:'), md.indexOf(':smile:') + ':smile:'.length]);
    });
    it('adjacent shortcodes give two nodes', () => {
        const spans = [];
        parser.parse(':smile::tada:').iterate({ enter: (n) => { if (n.name === 'Emoji') spans.push([n.from, n.to]); } });
        expect(spans).toEqual([[0, 7], [7, 13]]);
    });
});
