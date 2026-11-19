import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));

import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { renderMarkdownHtml } from '../export';
import { emojiFor } from '../emojiTable';

// F6 T2 export. Pinned choices where the spec is silent (writer: match these):
//  - Rule = scanEmoji from src/extensions/emojiSyntax.js (same as the editor, one copy): `:` + [a-zA-Z0-9_+-]+ + `:`
//    with no [a-zA-Z0-9] directly before the opening colon or after the closing one. The name is looked up exactly
//    (case-sensitive) with emojiFor. Unknown names and boundary failures stay literal text, colons included.
//  - A known shortcode becomes the emoji CHARACTER as plain text: no wrapper element, no <img>, no attributes.
//  - Applies to inline text only. Code spans, fences, indented code, math, link URLs/titles, autolinks, raw HTML,
//    attribute values and front matter are untouched. `\:smile:` (escaped colon) stays literal.
//  - Sub/sup content is NOT re-parsed (T1; lezer's Subscript/Superscript contain no Emoji): `~:smile:~` stays literal.
//  - Strikethrough, emphasis, links' text, headings, table cells, callouts and footnotes DO get emoji.
//  - Output is checked through DOM parsing, never whitespace. Mirrored by the editor/export parity table.
const T = 60000;
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));
const SMILE = emojiFor('smile'), TADA = emojiFor('tada');

beforeEach(() => { exportFile.mockReset(); });

describe('renderMarkdownHtml: emoji shortcodes', () => {
    it(':smile: -> the character, in no element', async () => {
        const d = await render(':smile:');
        expect(d.querySelector('p').innerHTML).toBe(SMILE);
        expect(d.querySelector('p').children).toHaveLength(0);
    }, T);
    it('character inside running text', async () => {
        const d = await render('hi :tada: there');
        expect(d.querySelector('p').innerHTML).toBe(`hi ${TADA} there`);
    }, T);
    it('raw output string has the character, no markup around it, no colons left', async () => {
        const html = await renderMarkdownHtml(':smile:');
        expect(html).toContain(SMILE);
        expect(html).not.toContain(':smile:');
        expect(html).not.toMatch(/<(span|img|i|em)\b/);
    }, T);
    it('alias and multi-codepoint emoji', async () => {
        const d = await render(':thumbsup: :heart:');
        expect(d.querySelector('p').textContent).toBe(`${emojiFor('thumbsup')} ${emojiFor('heart')}`);
    }, T);
    it('several in one line, adjacent ones included', async () => {
        const d = await render(':smile::tada: x :smile:');
        expect(d.querySelector('p').textContent).toBe(`${SMILE}${TADA} x ${SMILE}`);
    }, T);
    it('names with + and -: the 5 that lezer\'s built-in rule could not parse', async () => {
        const names = ['+1', '-1', 't-rex', 'e-mail', 'non-potable_water'];
        const d = await render(':+1: :-1: :t-rex: :e-mail: :non-potable_water:');
        expect(d.querySelector('p').textContent).toBe(names.map(emojiFor).join(' '));
    }, T);
    it('non-letter neighbours are fine: (:smile:) x_:smile: and Hebrew letters on both sides', async () => {
        const d = await render('(:smile:) x_:smile: \u05D0:smile:\u05D1');
        expect(d.querySelector('p').textContent).toBe(`(${SMILE}) x_${SMILE} \u05D0${SMILE}\u05D1`);
    }, T);
    it('survives sanitizing: no attributes, no elements added', async () => {
        const d = await render('x :smile: y');
        expect(d.querySelectorAll('*')).toHaveLength(1); // just the <p>
    }, T);
});

describe('renderMarkdownHtml: emoji stays literal', () => {
    it.each([
        [':notanemoji:'], [':SMILE:'], [':-:'], [':+:'],
        ['a:smile:b'], [':smile:b'], ['1:smile:'], [':smile:1'], [':smile:smile:'], ['12:100:45'], ['1:100:1000'],
        ['10:30:45'], ['at 10:30:45 sharp'], ['http://x.test'], ['a::b'], [':smile'], ['smile:'], [':sm ile:'],
    ])('%s -> text unchanged', async (md) => {
        const d = await render(md);
        expect(d.querySelector('p').textContent).toBe(md);
    }, T);
    it('unknown next to known: only the known converts', async () => {
        const d = await render(':nope: :smile: :-:');
        expect(d.querySelector('p').textContent).toBe(`:nope: ${SMILE} :-:`);
    }, T);
    it('escaped colon: \\:smile: stays literal text ":smile:"', async () => {
        const d = await render('\\:smile:');
        expect(d.querySelector('p').textContent).toBe(':smile:');
    }, T);
    it('escaped closer: :smile\\: stays literal text ":smile:"', async () => {
        const d = await render(':smile\\:');
        expect(d.querySelector('p').textContent).toBe(':smile:');
    }, T);
});

describe('export shares the one scanner', () => {
    it('some non-test file under src/utils imports scanEmoji from ../extensions/emojiSyntax', () => {
        const dir = resolve(process.cwd(), 'src/utils');
        const hit = readdirSync(dir).filter((f) => /\.js$/.test(f)).some((f) => /import\s*\{[^}]*\bscanEmoji\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/emojiSyntax['"]/.test(readFileSync(join(dir, f), 'utf8')));
        expect(hit).toBe(true);
    });
});

describe('renderMarkdownHtml: never inside code, math, URLs, HTML, front matter', () => {
    it('inline code is untouched, text around it converts', async () => {
        const d = await render(':smile: and `:tada:`');
        expect([...d.querySelectorAll('code')].map((c) => c.textContent)).toEqual([':tada:']);
        expect(d.querySelector('p').textContent).toBe(`${SMILE} and :tada:`);
    }, T);
    it('backtick, tilde and indented code blocks are untouched', async () => {
        for (const md of ['```\n:smile:\n```', '~~~\n:smile:\n~~~', '    :smile:']) {
            const d = await render(md);
            expect(d.querySelector('pre code').textContent.trim()).toBe(':smile:');
            expect(d.textContent).not.toContain(SMILE);
        }
    }, T);
    it('math is untouched (rendered as math, no emoji)', async () => {
        const d = await render('a $:smile:$ b');
        expect(d.querySelector('svg')).not.toBeNull();
        expect(d.textContent).not.toContain(SMILE);
    }, T);
    it('link URL, title and bare/angle autolinks keep their colons', async () => {
        const d = await render('[a](http://x.test/:smile: ":tada:") http://y.test/a:smile:b <http://z.test/a:smile:b>');
        const links = [...d.querySelectorAll('a')];
        expect(links.map((a) => a.getAttribute('href'))).toEqual(['http://x.test/:smile:', 'http://y.test/a:smile:b', 'http://z.test/a:smile:b']);
        expect(links[0].getAttribute('title')).toBe(':tada:');
        expect(d.textContent).not.toContain(SMILE);
        expect(d.textContent).not.toContain(TADA);
    }, T);
    it('link text converts', async () => {
        const d = await render('[:smile: hi](http://x.test)');
        expect(d.querySelector('a').textContent).toBe(`${SMILE} hi`);
    }, T);
    it('raw HTML attribute values are untouched', async () => {
        const d = await render('<span title=":smile:">x</span>');
        expect(d.querySelector('span').getAttribute('title')).toBe(':smile:');
    }, T);
    it('front matter is stripped and its content never converts; body does', async () => {
        const d = await render('---\ntitle: :smile:\n---\n\n:tada:');
        expect(d.textContent).not.toContain(SMILE);
        expect(d.querySelector('p').textContent).toBe(TADA);
    }, T);
});

describe('renderMarkdownHtml: containers and nesting', () => {
    it('emphasis, strong, strikethrough', async () => {
        const d = await render('*:smile:* **:smile:** ~~:smile:~~');
        expect(d.querySelector('em').textContent).toBe(SMILE);
        expect(d.querySelector('strong').textContent).toBe(SMILE);
        expect(d.querySelector('del').textContent).toBe(SMILE);
    }, T);
    it('heading, list items, blockquote', async () => {
        const d = await render('# :smile: title\n\n- :tada:\n\n1. :tada:\n\n> :smile:');
        expect(d.querySelector('h1').textContent).toBe(`${SMILE} title`);
        expect([...d.querySelectorAll('li')].map((l) => l.textContent)).toEqual([TADA, TADA]);
        expect(d.querySelector('blockquote').textContent.trim()).toBe(SMILE);
    }, T);
    it('table cell', async () => {
        const d = await render('| a |\n|---|\n| :smile: |');
        expect(d.querySelector('td').textContent).toBe(SMILE);
    }, T);
    it('callout title and body', async () => {
        const d = await render('> [!NOTE] :tada: head\n> :smile: body');
        const c = d.querySelector('.callout');
        expect(c.querySelector('.callout-title-text').textContent).toContain(TADA);
        expect(c.querySelector('.callout-content').textContent).toContain(SMILE);
        expect(c.textContent).not.toContain(':smile:');
    }, T);
    it('footnote definition and inline footnote', async () => {
        const d = await render('a[^1] b^[:smile: x]\n\n[^1]: :tada: done');
        const items = [...d.querySelectorAll('section.footnotes li')].map((l) => l.textContent);
        expect(items.some((t) => t.includes(TADA))).toBe(true);
        expect(items.some((t) => t.includes(SMILE))).toBe(true);
        expect(d.querySelector('section.footnotes').textContent).not.toMatch(/:tada:|:smile:/);
    }, T);
    it('multi-line paragraph: each line converts', async () => {
        const d = await render(':smile:\n:tada:');
        expect(d.querySelector('p').textContent).toBe(`${SMILE}\n${TADA}`);
    }, T);
});

describe('renderMarkdownHtml: sub/sup content is not re-parsed (matches the editor)', () => {
    it('H~:smile:~ -> <sub>:smile:</sub> literal', async () => {
        const d = await render('H~:smile:~');
        expect(d.querySelector('sub').textContent).toBe(':smile:');
        expect(d.textContent).not.toContain(SMILE);
    }, T);
    it('x^:smile:^ -> <sup>:smile:</sup> literal', async () => {
        const d = await render('x^:smile:^');
        expect(d.querySelector('sup').textContent).toBe(':smile:');
    }, T);
    it('shortcodes outside the sub still convert', async () => {
        const d = await render('~:smile:~ :tada:');
        expect(d.querySelector('p').textContent).toBe(`:smile: ${TADA}`);
    }, T);
});
