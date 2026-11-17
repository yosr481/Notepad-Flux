import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { scanEmoji, emojiSyntax } from '../emojiSyntax';

// F6 T2 emoji syntax. Pinned contract:
//  - scanEmoji(text, pos) -> { from, to, name } | null. pos is the index of the OPENING colon (text[pos] must be ':',
//    else null). Match = `:` + [a-zA-Z0-9_+-]+ + `:`; from = pos, to = index after the closing colon, name = between.
//  - Boundary: the char before pos and the char after the closing colon must not be [a-zA-Z0-9]. Start/end of text is
//    fine; `_`, `:`, spaces, punctuation and non-ASCII letters are fine. Name must be non-empty and has no whitespace.
//  - scanEmoji knows nothing about the table: ':SMILE:', ':-:' etc. still scan; emojiFor decides later.
//  - scanEmoji is pure and looks at the given string only (escapes, code, links are the parser's business).
//  - emojiSyntax is a lezer MarkdownConfig with an inline `Emoji` node (colon to colon inclusive), replacing
//    @lezer/markdown's built-in Emoji. Names and parse results are pinned further in emojiParity.test.js.
const hit = (text, pos = text.indexOf(':')) => scanEmoji(text, pos);

describe('scanEmoji: matches', () => {
    it('whole text is a shortcode', () => {
        expect(hit(':smile:')).toEqual({ from: 0, to: 7, name: 'smile' });
    });
    it('offsets inside running text come from the given pos', () => {
        const t = 'a :smile: b';
        const at = t.indexOf(':smile:');
        expect(scanEmoji(t, at)).toEqual({ from: at, to: at + 7, name: 'smile' });
    });
    it.each(['+1', '-1', 't-rex', 'e-mail', 'non-potable_water', '100', 'a_b', 'SMILE', '-', '+', '_', 'A1b2'])('name %j', (name) => {
        expect(hit(`:${name}:`)).toEqual({ from: 0, to: name.length + 2, name });
    });
    it.each(['(:smile:)', 'x_:smile:_y', ' :smile: ', ',:smile:.', 'א:smile:ב', 'é:smile:é', '::smile::', '*:smile:*', '\n:smile:\n'])(
        'neighbours that are not [a-zA-Z0-9]: %j', (t) => {
            const at = t.indexOf(':smile:');
            expect(scanEmoji(t, at)).toEqual({ from: at, to: at + 7, name: 'smile' });
        });
    it('adjacent shortcodes: each scans from its own opening colon', () => {
        const t = ':smile::tada:';
        expect(scanEmoji(t, 0)).toEqual({ from: 0, to: 7, name: 'smile' });
        expect(scanEmoji(t, 7)).toEqual({ from: 7, to: 13, name: 'tada' });
    });
});

describe('scanEmoji: null', () => {
    it('pos not on a colon', () => {
        expect(scanEmoji(':smile:', 1)).toBeNull();
        expect(scanEmoji(':smile:', 0 + 6 - 1)).toBeNull();
        expect(scanEmoji('', 0)).toBeNull();
        expect(scanEmoji(':smile:', 99)).toBeNull();
    });
    it.each(['::', ':', ':smile', ':sm ile:', ':sm\tile:', ':sm\nile:', ':sm.ile:', ':smא:', '::b'])('no valid name/closer: %j', (t) => {
        expect(hit(t)).toBeNull();
    });
    it.each(['a:smile:', '1:smile:', 'Z:smile:', ':smile:b', ':smile:1', ':smile:Z', 'a:smile:b', '1:100:1000', '12:100:45', '10:30:45'])(
        'boundary: %j', (t) => {
            for (let i = 0; i < t.length; i++) if (t[i] === ':') expect(scanEmoji(t, i)).toBeNull();
        });
    it('the closing colon of a match is not an opener when a letter precedes it', () => {
        const t = 'x :smile: y';
        expect(scanEmoji(t, t.indexOf(':smile:') + 6)).toBeNull();
    });
    it('http://x and a::b never match', () => {
        for (const t of ['http://x.test', 'a::b']) for (let i = 0; i < t.length; i++) if (t[i] === ':') expect(scanEmoji(t, i)).toBeNull();
    });
});

describe('emojiSyntax: lezer config', () => {
    const parser = markdown({
        base: markdownLanguage,
        extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax],
    }).language.parser;
    const emoji = (doc) => {
        const out = [];
        parser.parse(doc).iterate({ enter: (n) => { if (n.name === 'Emoji') out.push([n.from, n.to]); } });
        return out;
    };
    it('defines an inline Emoji node with exact span (offsets via indexOf)', () => {
        const doc = 'a :smile: b :+1: c';
        expect(emoji(doc)).toEqual([
            [doc.indexOf(':smile:'), doc.indexOf(':smile:') + 7],
            [doc.indexOf(':+1:'), doc.indexOf(':+1:') + 4],
        ]);
    });
    it('Emoji node appears for any name the scanner accepts (the table is not consulted by the parser)', () => {
        expect(emoji(':notanemoji:')).toEqual([[0, 12]]);
        expect(emoji(':-:')).toEqual([[0, 3]]);
    });
    it('boundary and literal cases give no Emoji node', () => {
        for (const d of ['10:30:45', '12:100:45', 'a:smile:b', 'http://x.test', 'a::b', ':-', '::']) expect(emoji(d)).toEqual([]);
    });
    it('works inside blockquote, list item and 1-3 space indent (offset from line.pos, not line start)', () => {
        for (const d of ['> :smile:', '- :smile:', '   :smile:', '> - :smile:']) expect(emoji(d)).toEqual([[d.indexOf(':smile:'), d.indexOf(':smile:') + 7]]);
    });
    it('escaped colon: no node', () => {
        expect(emoji('\\:smile:')).toEqual([]);
    });
    it('not inside code, math, link url, front matter', () => {
        for (const d of ['`:smile:`', '```\n:smile:\n```', '$:smile:$', '[a](http://x.test/:smile:)', '---\ntitle: :smile:\n---\n\nx']) expect(emoji(d)).toEqual([]);
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');
    const list = (src.match(/markdown\(\{[^)]*?extensions:\s*\[([^\]]*)\]/) || [])[1] || '';

    it('emojiSyntax is imported from ../extensions/emojiSyntax', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bemojiSyntax\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/emojiSyntax['"]/);
    });
    it('emojiSyntax is in the markdown({ extensions: [...] }) list, after footnoteSyntax and Superscript', () => {
        expect(list).toMatch(/\bemojiSyntax\b/);
        expect(list.indexOf('emojiSyntax')).toBeGreaterThan(list.indexOf('footnoteSyntax'));
        expect(list.indexOf('emojiSyntax')).toBeGreaterThan(list.indexOf('Superscript'));
    });
    it("lezer's built-in Emoji is neither imported nor in the list (emojiSyntax replaces it)", () => {
        expect(src).not.toMatch(/import\s*\{[^}]*\bEmoji\b[^}]*\}\s*from\s*['"]@lezer\/markdown['"]/);
        expect(list).not.toMatch(/\bEmoji\b/);
    });
    it('emojiPreview is imported from ../extensions/emojiPreview and in the extensions array after livePreview', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bemojiPreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/emojiPreview['"]/);
        expect(src).toMatch(/^\s*emojiPreview,/m);
        expect(src.indexOf('emojiPreview,')).toBeGreaterThan(src.indexOf('livePreview,'));
    });
});
