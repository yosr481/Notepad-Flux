import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));

import { renderMarkdownHtml } from '../export';

// F6 T1 export. Pinned choices where the spec is silent (writer: match these):
//  - Rules are the lezer ones (Docs/internal/subsup-emoji-spec.md): `~`/`^` opens when the next char is not the same
//    marker; the closer is the next unescaped same marker with NO whitespace (space, tab, newline) in between;
//    content non-empty; `\x` inside is an escape. No flanking rule: intra-word a~b~c is subscript.
//  - Content is NOT parsed again as markdown (the editor's Subscript node has only marks/escapes as children):
//    `~*a*~` -> <sub>*a*</sub> literal; inline HTML in the content is escaped text.
//  - Escapes inside content: `\ ` -> U+00A0 (Pandoc's non-breaking space); `\<punct>` -> that punct (`\~` -> `~`).
//  - Single `~a~` is no longer <del>; `~~a~~` stays <del>. `^[note]` stays a footnote (never <sup> from this feature).
//  - Output is checked through DOM parsing, never whitespace.
// Mirrored by the editor/export parity table in src/extensions/__tests__/subSupParity.test.js.
const T = 60000;
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));
const plainSups = (d) => [...d.querySelectorAll('sup')].filter((s) => !s.querySelector(':scope > a.footnote-ref'));

beforeEach(() => { exportFile.mockReset(); });

describe('renderMarkdownHtml: subscript', () => {
    it('H~2~O -> H<sub>2</sub>O exactly', async () => {
        const d = await render('H~2~O');
        expect(d.querySelector('p').innerHTML).toBe('H<sub>2</sub>O');
    }, T);
    it('multi-char and two in one line', async () => {
        const d = await render('a~xy~ b~z~');
        expect([...d.querySelectorAll('sub')].map((s) => s.textContent)).toEqual(['xy', 'z']);
    }, T);
    it('intra-word a~b~c is subscript (no flanking rule)', async () => {
        const d = await render('a~b~c');
        expect(d.querySelector('p').innerHTML).toBe('a<sub>b</sub>c');
    }, T);
    it('adjacent subscripts H~2~~3~: both open (lezer does), the closer of the first is not a barrier', async () => {
        const d = await render('H~2~~3~');
        expect([...d.querySelectorAll('sub')].map((x) => x.textContent)).toEqual(['2', '3']);
    }, T);
    it('single ~a~ is no longer <del>', async () => {
        const d = await render('~a~');
        expect(d.querySelectorAll('del')).toHaveLength(0);
        expect(d.querySelectorAll('sub')).toHaveLength(1);
    }, T);
    it('~~a~~ is still <del>, never sub', async () => {
        const d = await render('~~a~~');
        expect(d.querySelector('p').innerHTML).toBe('<del>a</del>');
    }, T);
    it('~~a~~ and ~b~ together: one del, one sub', async () => {
        const d = await render('~~a~~ and ~b~');
        expect(d.querySelectorAll('del')).toHaveLength(1);
        expect(d.querySelectorAll('sub')).toHaveLength(1);
        expect(d.querySelector('del').textContent).toBe('a');
        expect(d.querySelector('sub').textContent).toBe('b');
    }, T);
    it('~a b~ (space) stays literal tildes: no sub, no del', async () => {
        const d = await render('~a b~');
        expect(d.querySelectorAll('sub, del')).toHaveLength(0);
        expect(d.querySelector('p').textContent).toBe('~a b~');
    }, T);
    it('a newline ends the attempt: ~a\\nb~ stays literal', async () => {
        const d = await render('~a\nb~');
        expect(d.querySelectorAll('sub, del')).toHaveLength(0);
        expect(d.querySelector('p').textContent).toBe('~a\nb~');
    }, T);
    it('~a\\ b~ -> sub with a non-breaking space, backslash gone', async () => {
        const d = await render('~a\\ b~');
        expect(d.querySelector('sub').textContent).toBe('a b');
    }, T);
    it('~a\\~b~ -> escaped closer is content: sub "a~b"', async () => {
        const d = await render('~a\\~b~');
        expect(d.querySelector('sub').textContent).toBe('a~b');
    }, T);
    it('escaped opener \\~a\\~ is plain text "~a~"', async () => {
        const d = await render('\\~a\\~');
        expect(d.querySelectorAll('sub, del')).toHaveLength(0);
        expect(d.querySelector('p').textContent).toBe('~a~');
    }, T);
    it('unclosed ~a and a lone ~ stay literal', async () => {
        const d = await render('~a and b~');
        expect(d.querySelectorAll('sub, del')).toHaveLength(0);
        const d2 = await render('a ~ b ~ c');
        expect(d2.querySelectorAll('sub, del')).toHaveLength(0);
        expect(d2.querySelector('p').textContent).toBe('a ~ b ~ c');
    }, T);
    it('content is not re-parsed: ~*a*~ -> <sub>*a*</sub> literal', async () => {
        const d = await render('~*a*~');
        expect(d.querySelector('sub').textContent).toBe('*a*');
        expect(d.querySelectorAll('em')).toHaveLength(0);
    }, T);
});

describe('renderMarkdownHtml: intra-word ~~ with punctuation-first content equals the pre-F6 export', () => {
    // Pre-F6 (marked, flanking refuses <del> after a letter): literal text. F6 must not add <sub> or <del> there.
    // Expected strings are the old output (checked against plain marked.parseInline + sanitizer).
    it.each([
        ['a~~(y)~~', 'a~~(y)~~'],
        ['a~~:x~~', 'a~~:x~~'],
        ['a~~:smile:~~', 'a~~😄~~'],     // T2 emoji converts inside; still no <sub>
        ['a~~.b~~', 'a~~.b~~'],
        ['a~~"q"~~', 'a~~"q"~~'],
        ['a~~[z]~~', 'a~~[z]~~'],
        ['a~~-k~~', 'a~~-k~~'],
        ['a~~!~~', 'a~~!~~'],
        ['a~~*e*~~', 'a~~<em>e</em>~~'],
        ['1~~(y)~~', '1~~(y)~~'],
        ['a~~(y)~~b', 'a~~(y)~~b'],
        ['x ~~(y)~~', 'x <del>(y)</del>'],   // flanking allows this one: still <del>
        ['a~~b~~', 'a<del>b</del>'],
    ])('%j -> %j', async (md, expected) => {
        const d = await render(md);
        expect(d.querySelectorAll('sub')).toHaveLength(0);
        expect(d.querySelector('p').innerHTML).toBe(expected);
    }, T);
});

describe('renderMarkdownHtml: superscript', () => {
    it('x^2^ -> x<sup>2</sup> exactly', async () => {
        const d = await render('x^2^');
        expect(d.querySelector('p').innerHTML).toBe('x<sup>2</sup>');
    }, T);
    it('^a b^ stays literal; ^^ stays literal; x^2 unclosed stays literal', async () => {
        for (const md of ['^a b^', '^^', 'x^2']) {
            const d = await render(md);
            expect(d.querySelectorAll('sup')).toHaveLength(0);
            expect(d.querySelector('p').textContent).toBe(md);
        }
    }, T);
    it('^a\\ b^ -> sup with a non-breaking space', async () => {
        const d = await render('^a\\ b^');
        expect(d.querySelector('sup').textContent).toBe('a b');
    }, T);
    it('escaped opener \\^a\\^ is plain text "^a^"', async () => {
        const d = await render('\\^a\\^');
        expect(d.querySelectorAll('sup')).toHaveLength(0);
        expect(d.querySelector('p').textContent).toBe('^a^');
    }, T);
    it('HTML in the content is escaped text, never markup: x^<b>^', async () => {
        const d = await render('x^<b>^');
        expect(d.querySelector('sup').textContent).toBe('<b>');
        expect(d.querySelectorAll('b')).toHaveLength(0);
    }, T);
    it('sub and sup in one line', async () => {
        const d = await render('H~2~O and x^2^');
        expect(d.querySelector('p').innerHTML).toBe('H<sub>2</sub>O and x<sup>2</sup>');
    }, T);
});

describe('renderMarkdownHtml: footnotes keep winning over superscript', () => {
    it('x^[note] is a footnote ref, no superscript from this feature', async () => {
        const d = await render('x^[note]');
        expect(d.querySelectorAll('sup > a.footnote-ref')).toHaveLength(1);
        expect(plainSups(d)).toHaveLength(0);
        expect(d.querySelector('section.footnotes li').textContent).toContain('note');
    }, T);
    it('^[a]^ is a footnote followed by a stray caret, not a superscript', async () => {
        const d = await render('^[a]^');
        expect(d.querySelectorAll('sup > a.footnote-ref')).toHaveLength(1);
        expect(plainSups(d)).toHaveLength(0);
    }, T);
    it('a defined [^1] ref still works next to a real superscript', async () => {
        const d = await render('x^2^[^1]\n\n[^1]: n');
        expect(d.querySelectorAll('sup > a.footnote-ref')).toHaveLength(1);
        expect(plainSups(d).map((s) => s.textContent)).toEqual(['2']);
    }, T);
});

describe('renderMarkdownHtml: never inside code or math', () => {
    it('inline code is untouched', async () => {
        const d = await render('`H~2~O` and `x^2^`');
        expect([...d.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['H~2~O', 'x^2^']);
        expect(d.querySelectorAll('sub')).toHaveLength(0);
        expect(plainSups(d)).toHaveLength(0);
    }, T);
    it('backtick and tilde fences are untouched', async () => {
        for (const md of ['```\nH~2~O x^2^\n```', '~~~\nH~2~O x^2^\n~~~']) {
            const d = await render(md);
            expect(d.querySelector('pre code').textContent).toBe('H~2~O x^2^\n');
            expect(d.querySelectorAll('sub')).toHaveLength(0);
            expect(plainSups(d)).toHaveLength(0);
        }
    }, T);
    it('math $x^2^$ is untouched (rendered as math, no sup/sub)', async () => {
        const d = await render('a $x^2^$ b');
        expect(d.querySelector('svg')).not.toBeNull();
        expect(d.querySelectorAll('sub')).toHaveLength(0);
        expect(plainSups(d)).toHaveLength(0);
    }, T);
    it('link URL and bare autolink keep their tildes', async () => {
        const d = await render('[a](http://x.test/p~1~q) http://y.test/p~1~q');
        const hrefs = [...d.querySelectorAll('a')].map((a) => a.getAttribute('href'));
        expect(hrefs).toEqual(['http://x.test/p~1~q', 'http://y.test/p~1~q']);
        expect(d.querySelectorAll('sub')).toHaveLength(0);
    }, T);
});

describe('renderMarkdownHtml: nesting and containers', () => {
    it('nested **H~2~O** -> <strong>H<sub>2</sub>O</strong>', async () => {
        const d = await render('**H~2~O**');
        expect(d.querySelector('p').innerHTML).toBe('<strong>H<sub>2</sub>O</strong>');
    }, T);
    it('*x^2^* -> <em>x<sup>2</sup></em>', async () => {
        const d = await render('*x^2^*');
        expect(d.querySelector('p').innerHTML).toBe('<em>x<sup>2</sup></em>');
    }, T);
    it('inside link text, heading, list item, blockquote and table cell', async () => {
        const d = await render('[H~2~O](http://x.test)\n\n# H~2~O\n\n- H~2~O\n\n> H~2~O\n\n| a |\n|---|\n| H~2~O |');
        expect(d.querySelectorAll('a > sub')).toHaveLength(1);
        expect(d.querySelectorAll('h1 > sub')).toHaveLength(1);
        expect(d.querySelectorAll('li > sub')).toHaveLength(1);
        expect(d.querySelectorAll('blockquote sub')).toHaveLength(1);
        expect(d.querySelectorAll('td > sub')).toHaveLength(1);
    }, T);
    it('survives sanitizing: no attributes on emitted sub/sup', async () => {
        const d = await render('H~2~O x^2^');
        expect(d.querySelector('sub').attributes).toHaveLength(0);
        expect(d.querySelector('sup').attributes).toHaveLength(0);
    }, T);
});
