import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { livePreview } from '../livePreview';
import { linkPreview } from '../linkPreview';
import { linkHandler } from '../linkHandler';
import { htmlInlinePreview, abbrTitle } from '../htmlInlinePreview';
import { normalizeDestination } from '../linkDefs';
import { renderMarkdownHtml } from '../../utils/export';

// B16a: ONE full-HTML5 entity decoder for the editor (abbr titles outside tables and in cells, link destinations).
//
// PINNED CONTRACT (writer must match):
//  1. Named (whole HTML5 set) and numeric (&#233; &#xE9; &#XE9;) entities decode exactly as the platform parser does,
//     via a native inert parser (DOMParser / <template> / <textarea>); no new dependency, no hand-written table.
//  2. Only ONE pass: `&amp;eacute;` -> `&eacute;` (not é). Unknown names (`&bogus;`), bare `&` and `&` without a
//     terminating `;` stay literal. (No-semicolon legacy forms like `&eacute` are not pinned: not tested.)
//  3. Callers: abbrTitle(src) (exported), normalizeDestination(raw) (exported, order: strip <>, unescape, decode),
//     the rendered abbr title in the editor and in table cells, and the rendered link href outside tables and in cells.
//  4. Decoding never creates markup: `&lt;img ...&gt;` stays literal TEXT in the title/href, no element appears, no
//     handler attribute exists. Decoded link hrefs still go through isSafeExternalUrl (B15 guards stay).
//  5. Text-node rendering uses the same full-set decoder since B19 T1 (entities.named.test.js owns the detail):
//     a named entity beyond the old 7 IS decoded in plain text.
//  Export is the oracle for abbr title / href parity.

const mocks = vi.hoisted(() => ({ renderTex: vi.fn(), isMathLoaded: vi.fn(() => false) }));
vi.mock('../../utils/math', () => ({
    renderTex: (...a) => mocks.renderTex(...a),
    isMathLoaded: () => mocks.isMathLoaded(),
}));

const EXTENSIONS = [
    markdown({ base: markdownLanguage, extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] }),
    livePreview, htmlInlinePreview, linkPreview, linkHandler,
];
const views = [];
const mkView = (doc, anchor = 0) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor }, extensions: EXTENSIONS }), parent });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor } });
    views.push(view);
    return view;
};
afterEach(() => { while (views.length) views.pop().destroy(); vi.restoreAllMocks(); });

const outsideDoc = (body) => `p\n\n${body}\n\nz\n`;
const cellDoc = (cell) => `p\n\n| h |\n| --- |\n| ${cell} |\n\nz\n`;
const outsideAbbr = (v) => v.dom.querySelector('.cm-content .cm-html-abbr');
const cellAbbr = (v) => v.dom.querySelector('.cm-table-widget tbody td .cm-html-abbr');
const outsideLink = (v) => v.dom.querySelector('.cm-content a.cm-link');
const cellLink = (v) => v.dom.querySelector('.cm-table-widget tbody td a.cm-link');
const exportEl = async (md, sel) => {
    const d = document.createElement('div');
    d.innerHTML = await renderMarkdownHtml(md);
    return d.querySelector(sel);
};

// [entity source, decoded text]
const DECODE = [
    ['&eacute;', 'é'],
    ['&hellip;', '…'],
    ['&mdash;', '—'],
    ['&nbsp;', ' '],
    ['&copy;', '©'],
    ['&euro;', '€'],
    ['&rarr;', '→'],
    ['&Aacute;', 'Á'],
    ['&fjlig;', 'fj'],                  // multi-codepoint: two chars from one name
    ['&NotEqualTilde;', '≂̸'], // multi-codepoint: two code points
    ['&#233;', 'é'],
    ['&#xE9;', 'é'],
    ['&#XE9;', 'é'],
    ['&#x1F600;', '\u{1F600}'],         // astral numeric
    ['&amp;', '&'],                     // old set still works
    ['&lt;', '<'],
    ['&quot;', '"'],
];

describe('abbrTitle: full entity set', () => {
    it.each(DECODE)('%s decodes', (ent, ch) => {
        expect(abbrTitle(`<abbr title="x${ent}y">`)).toBe(`x${ch}y`);
    });
    it('single-quoted and un-quoted values decode too', () => {
        expect(abbrTitle("<abbr title='caf&eacute;'>")).toBe('café');
        expect(abbrTitle('<abbr title=caf&eacute;>')).toBe('café');
    });
    it('several entities in one title', () => {
        expect(abbrTitle('<abbr title="a&hellip;b&mdash;c&#233;&copy;">')).toBe('a…b—cé©');
    });
    it('one pass only: &amp;eacute; -> &eacute;', () => {
        expect(abbrTitle('<abbr title="&amp;eacute;">')).toBe('&eacute;');
        expect(abbrTitle('<abbr title="&amp;lt;">')).toBe('&lt;');
    });
    it('unknown name stays literal', () => {
        expect(abbrTitle('<abbr title="a&bogus;b">')).toBe('a&bogus;b');
    });
    it('bare & and & without ; stay literal', () => {
        expect(abbrTitle('<abbr title="a & b">')).toBe('a & b');
        expect(abbrTitle('<abbr title="a&b=1&c">')).toBe('a&b=1&c');
        expect(abbrTitle('<abbr title="AT&T">')).toBe('AT&T');
    });
    it('malformed numeric stays literal', () => {
        expect(abbrTitle('<abbr title="&#;&#x;&#xZZ;">')).toBe('&#;&#x;&#xZZ;');
    });
    it('no title -> null (unchanged)', () => {
        expect(abbrTitle('<abbr>')).toBeNull();
    });
    it('markup guard: &lt;img ...&gt; is literal text, nothing parsed', () => {
        expect(abbrTitle('<abbr title="&lt;img src=x onerror=alert(1)&gt;">')).toBe('<img src=x onerror=alert(1)>');
    });
    it('does not create elements or fire handlers while decoding', () => {
        const before = document.querySelectorAll('*').length;
        const spy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        abbrTitle('<abbr title="&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;">');
        expect(spy).not.toHaveBeenCalled();
        expect(document.querySelectorAll('*').length).toBe(before);
    });
    it('decoded quote/angle in the value is still just the value', () => {
        expect(abbrTitle('<abbr title="&quot;&gt;&lt;b&gt;x">')).toBe('"><b>x');
    });
});

describe('normalizeDestination: full entity set', () => {
    it.each(DECODE)('%s decodes', (ent, ch) => {
        expect(normalizeDestination(`https://e.com/?q=${ent}`)).toBe(`https://e.com/?q=${ch}`);
    });
    it('angle + backslash + named entity: all applied in order', () => {
        expect(normalizeDestination('<https://e.com/caf&eacute;\\_x>')).toBe('https://e.com/café_x');
    });
    it('one pass only', () => {
        expect(normalizeDestination('https://e.com/?a=&amp;eacute;')).toBe('https://e.com/?a=&eacute;');
    });
    it('unknown, bare & and unterminated stay literal', () => {
        expect(normalizeDestination('https://e.com/?a=1&bogus;b&c=2&d')).toBe('https://e.com/?a=1&bogus;b&c=2&d');
    });
    it('markup guard: stays text', () => {
        expect(normalizeDestination('https://e.com/?q=&lt;img src=x onerror=alert(1)&gt;')).toBe('https://e.com/?q=<img src=x onerror=alert(1)>');
    });
});

describe.each([['outside tables', outsideDoc, outsideAbbr], ['table cell', cellDoc, cellAbbr]])('abbr title rendered: %s', (_n, mkDoc, find) => {
    it.each(DECODE)('%s in the title attribute; equals export', async (ent, ch) => {
        const md = mkDoc(`<abbr title="x${ent}y">W</abbr>`);
        const el = find(mkView(md));
        expect(el, 'abbr rendered').not.toBeNull();
        expect(el.getAttribute('title')).toBe(`x${ch}y`);
        expect((await exportEl(md, 'abbr')).getAttribute('title')).toBe(`x${ch}y`);
    });
    it('caf&eacute; (the reported case) -> café', () => {
        expect(find(mkView(mkDoc('<abbr title="caf&eacute;">W</abbr>'))).getAttribute('title')).toBe('café');
    });
    it('unknown entity and bare & stay literal', () => {
        expect(find(mkView(mkDoc('<abbr title="a&bogus;b & c">W</abbr>'))).getAttribute('title')).toBe('a&bogus;b & c');
    });
    it('markup injection: literal text in the title, no element, no handler', () => {
        const v = mkView(mkDoc('<abbr title="&lt;img src=x onerror=alert(1)&gt;">W</abbr>'));
        const el = find(v);
        expect(el.getAttribute('title')).toBe('<img src=x onerror=alert(1)>');
        expect(v.dom.querySelector('img:not(.cm-widgetBuffer)')).toBeNull();
        expect(v.dom.querySelector('[onerror]')).toBeNull();
        expect(v.dom.querySelector('script')).toBeNull();
    });
});

describe.each([
    ['outside inline', outsideDoc, outsideLink],
    ['table cell inline', cellDoc, cellLink],
])('link destination rendered: %s', (_n, mkDoc, find) => {
    it('[t](https://e.com/?q=caf&eacute;) -> href decoded, equals export', async () => {
        const md = mkDoc('[t](https://e.com/?q=caf&eacute;)');
        const a = find(mkView(md));
        expect(a, 'link rendered').not.toBeNull();
        expect(a.getAttribute('href')).toBe('https://e.com/?q=café');
        expect(a.getAttribute('href')).toBe((await exportEl(md, 'a')).getAttribute('href'));
    });
    it.each([['&hellip;', '…'], ['&#233;', 'é'], ['&#xE9;', 'é'], ['&fjlig;', 'fj']])('%s in href', (ent, ch) => {
        expect(find(mkView(mkDoc(`[t](https://e.com/?q=${ent})`))).getAttribute('href')).toBe(`https://e.com/?q=${ch}`);
    });
    it('unknown entity stays literal', () => {
        expect(find(mkView(mkDoc('[t](https://e.com/?q=a&bogus;b)'))).getAttribute('href')).toBe('https://e.com/?q=a&bogus;b');
    });
    it('markup-looking entity stays text in href, no element', () => {
        const v = mkView(mkDoc('[t](https://e.com/?q=&lt;img&gt;)'));
        expect(find(v).getAttribute('href')).toBe('https://e.com/?q=<img>');
        expect(v.dom.querySelector('img:not(.cm-widgetBuffer)')).toBeNull();
    });
    it('decoded unsafe scheme still yields no href (isSafeExternalUrl after decoding)', () => {
        const a = find(mkView(mkDoc('[t](javascript&colon;alert(1))')));
        if (a) expect(a.getAttribute('href')).toBeNull();
        expect(a?.outerHTML ?? '').not.toMatch(/href="javascript:/i);
    });
});

describe('text nodes (B19 T1: full set)', () => {
    it('a named entity beyond the old 7 is decoded in plain text', () => {
        const v = mkView('p\n\nx &eacute; y\n\nz\n');
        expect(v.dom.querySelector('.cm-content').textContent).toContain('x é y');
        expect(v.dom.querySelector('.cm-content').textContent).not.toContain('&eacute;');
    });
});
