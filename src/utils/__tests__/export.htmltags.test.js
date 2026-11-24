import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));

import { renderMarkdownHtml } from '../export';

// F7 T1 export. Spec: Docs/internal/html-tags-spec.md ("Export"). Pinned choices:
//  - kbd, mark, u, abbr(title), ins, small are allowed; everything else keeps today's behaviour.
//  - No new attributes: style, id, name, on*, data-* are stripped from every allowed tag (class/title/href/src/alt/open
//    were already allowed globally and are not re-pinned here).
//  - Output is checked through DOM parsing, never whitespace.
//  - Tests marked (guard) pass today and must keep passing.
const T = 60000;
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));

beforeEach(() => { exportFile.mockReset(); });

const NEW_TAGS = ['kbd', 'mark', 'u', 'ins', 'small'];

describe('renderMarkdownHtml html tags: new survivors', () => {
    it.each(NEW_TAGS)('<%s> survives with its text, exactly', async (n) => {
        const d = await render(`a <${n}>x</${n}> b`);
        expect(d.querySelector('p').innerHTML).toBe(`a <${n}>x</${n}> b`);
    }, T);
    it('<abbr title> survives and keeps the title', async () => {
        const d = await render('a <abbr title="World Health">WHO</abbr> b');
        expect(d.querySelector('p').innerHTML).toBe('a <abbr title="World Health">WHO</abbr> b');
    }, T);
    it('uppercase tags survive too', async () => {
        const d = await render('<KBD>K</KBD> <Mark>m</Mark> <U>u</U> tail');
        expect(d.querySelectorAll('kbd, mark, u')).toHaveLength(3);
    }, T);
    it('nesting survives: <kbd><u>x</u></kbd>', async () => {
        const d = await render('a <kbd><u>x</u></kbd> b');
        expect(d.querySelector('kbd > u').textContent).toBe('x');
    }, T);
    it('markdown inside keeps working: <mark>**b**</mark> -> mark > strong', async () => {
        const d = await render('a <mark>**b**</mark> c');
        expect(d.querySelector('mark > strong').textContent).toBe('b');
    }, T);
    it('works in a heading, a list item and a table cell', async () => {
        const d = await render('# <u>h</u>\n\n- <kbd>k</kbd>\n\n| a |\n| - |\n| <ins>i</ins> |');
        expect(d.querySelector('h1 u')).not.toBeNull();
        expect(d.querySelector('li kbd')).not.toBeNull();
        expect(d.querySelector('td ins')).not.toBeNull();
    }, T);
    it('tags inside code stay escaped text, never elements (guard)', async () => {
        const d = await render('`<kbd>x</kbd>`\n\n```\n<mark>m</mark>\n```');
        expect(d.querySelector('kbd, mark')).toBeNull();
        expect(d.querySelector('p code').textContent).toBe('<kbd>x</kbd>');
        expect(d.querySelector('pre code').textContent).toContain('<mark>m</mark>');
    }, T);
});

describe('renderMarkdownHtml html tags: today\'s survivors stay (guard)', () => {
    it('details / summary open', async () => {
        const d = await render('<details open>\n<summary>Sum</summary>\n\nbody\n\n</details>');
        const det = d.querySelector('details');
        expect(det.hasAttribute('open')).toBe(true);
        expect(det.querySelector('summary').textContent).toBe('Sum');
        expect(det.textContent).toContain('body');
    }, T);
    it('span, div, sub, sup, br', async () => {
        const d = await render('a <span>s</span> H<sub>2</sub> x<sup>3</sup>a<br>b\n\n<div>block</div>');
        expect(d.querySelector('span').textContent).toBe('s');
        expect(d.querySelector('sub').textContent).toBe('2');
        expect(d.querySelector('sup').textContent).toBe('3');
        expect(d.querySelector('p br')).not.toBeNull();
        expect(d.querySelector('div').textContent).toBe('block');
    }, T);
});

describe('renderMarkdownHtml html tags: attributes stripped', () => {
    const ALL = ['kbd', 'mark', 'u', 'ins', 'small', 'abbr', 'span', 'sub', 'sup', 'div'];
    const BAD = (el) => el.getAttributeNames().filter((a) => a === 'style' || a === 'id' || a === 'name' || a.startsWith('on') || a.startsWith('data-'));
    it.each(ALL)('<%s>: style, id, name, on*, data-* are dropped; the element and text stay', async (n) => {
        const d = await render(`a <${n} style="color:red" id="x" name="y" onclick="alert(1)" onmouseover="alert(2)" data-k="v">T</${n}> b`);
        const el = d.querySelector(n);
        expect(el, n).not.toBeNull();
        expect(el.textContent).toBe('T');
        expect(BAD(el)).toEqual([]);
        expect(d.querySelector('[style], [id], [name], [onclick], [onmouseover], [data-k]')).toBeNull();
    }, T);
    it('abbr keeps title while its other attributes go', async () => {
        const d = await render('a <abbr title="t" style="x:y" onclick="1" id="i">W</abbr> b');
        const el = d.querySelector('abbr');
        expect(el.getAttribute('title')).toBe('t');
        expect(el.getAttributeNames().sort()).toEqual(['title']);
    }, T);
    it('title on kbd is not an error (allowed attr today) and nothing else leaks', async () => {
        const d = await render('a <kbd title="t" onclick="1">K</kbd> b');
        expect(d.querySelector('kbd').hasAttribute('onclick')).toBe(false);
    }, T);
});

describe('renderMarkdownHtml html tags: still dropped (guard)', () => {
    it('<script> is dropped with its content', async () => {
        const d = await render('a <script>alert(1)</script> b <kbd>k</kbd>');
        expect(d.querySelector('script')).toBeNull();
        expect(d.textContent).not.toContain('alert(1)');
    }, T);
    it('<script> inside an allowed tag is dropped, the tag stays', async () => {
        const d = await render('a <kbd>k<script>alert(1)</script></kbd> b');
        expect(d.querySelector('script')).toBeNull();
        expect(d.querySelector('kbd').textContent).toBe('k');
    }, T);
    it('<iframe>, <style>, <object>, <form> are dropped', async () => {
        const d = await render('a <iframe src="https://e.com"></iframe> <style>p{color:red}</style> <object data="x"></object> <form>f</form> b');
        expect(d.querySelector('iframe, style, object, form')).toBeNull();
    }, T);
    it('javascript: hrefs are dropped; nested in a new tag too', async () => {
        const d = await render('<a href="javascript:alert(1)">x</a> <mark><a href="javascript:alert(2)">y</a></mark> [z](javascript:alert(3))');
        for (const a of d.querySelectorAll('a')) expect((a.getAttribute('href') || '').toLowerCase()).not.toContain('javascript:');
    }, T);
    it('tags off the list keep today\'s behaviour: <font>, <big>, <blink> unwrapped, text stays', async () => {
        const d = await render('a <font color="red">f</font> <big>c</big> <blink>m</blink> b');
        expect(d.querySelector('font, big, blink')).toBeNull();
        expect(d.querySelector('p').textContent).toContain('f');
        expect(d.querySelector('p').textContent).toContain('m');
    }, T);
});

describe('renderMarkdownHtml html tags: footnote ids stay un-spoofable', () => {
    it('id on the new tags is dropped; the real footnote ids survive', async () => {
        const d = await render('<kbd id="fn-1">k</kbd> <mark id="fnref-1">m</mark> <abbr id="fn-1" name="fn-1" title="t">a</abbr> x[^a]\n\n[^a]: n');
        expect(d.querySelectorAll('[id="fn-1"]')).toHaveLength(1);
        expect(d.querySelector('[id="fn-1"]').tagName).toBe('LI');
        expect(d.querySelectorAll('[id="fnref-1"]')).toHaveLength(1);
        expect(d.querySelector('[id="fnref-1"]').tagName).toBe('A');
        for (const n of ['kbd', 'mark', 'abbr']) expect(d.querySelector(n).hasAttribute('id')).toBe(false);
    }, T);
    it('every id in the output is a footnote id', async () => {
        const d = await render('<u id="x">u</u> <ins id="y">i</ins> <small id="z">s</small> x[^a]\n\n[^a]: n');
        for (const e of d.querySelectorAll('[id]')) expect(e.id).toMatch(/^fn(ref)?-\d+(-\d+)?$/);
    }, T);
    it('a new tag inside a note body renders and cannot set ids', async () => {
        const d = await render('x[^a]\n\n[^a]: see <kbd id="fn-9">k</kbd>');
        expect(d.querySelector('section.footnotes kbd').textContent).toBe('k');
        expect(d.querySelector('kbd').hasAttribute('id')).toBe(false);
    }, T);
});

// Spec: kbd gets a key-cap look in HTML, PDF and Print. PrintDocument (used for PDF and Print) does not use the
// exportToHtml <style> block, so the shared exportBase.css (imported by PrintDocument; C7 moved kbd there) must style kbd with explicit fg and bg.
describe('html tags: Print/PDF stylesheet', () => {
    it('shared exportBase.css gives kbd an explicit color and background-color', async () => {
        const { readFileSync } = await import('fs');
        const css = readFileSync('src/styles/exportBase.css', 'utf8');
        const rule = (css.match(/kbd[^{}]*\{([^}]*)\}/) || [])[1] || '';
        expect(rule).toMatch(/(^|[;\s])color:/);
        expect(rule).toMatch(/background(-color)?:/);
    });
});
