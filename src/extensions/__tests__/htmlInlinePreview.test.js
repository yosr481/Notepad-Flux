import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { livePreview } from '../livePreview';
import { htmlInlinePreview, SAFE_INLINE_HTML_TAGS } from '../htmlInlinePreview';

// F7 T1 editor preview. Spec: Docs/internal/html-tags-spec.md. Pinned choices (spec silent / task contract):
//  - Exports of src/extensions/htmlInlinePreview.js, both NAMED: `htmlInlinePreview` (a StateField providing
//    EditorView.decorations, i.e. a plain DecorationSet in the facet, like subSupPreview; a ViewPlugin fails the
//    identity tests) and `SAFE_INLINE_HTML_TAGS` (array of lowercase names, exactly the nine below).
//  - A pair = an HTMLTag opening `<name ...>` + the next matching `</name>` in the same inline context, properly
//    nested (stack matching, name compared case-insensitively). Unclosed / unmatched / mismatched / crossing: NOTHING
//    from this extension for ANY tag involved (`<u><kbd>x</u></kbd>` renders neither). A pair that is closed and
//    properly nested still renders next to an unclosed one.
//  - Touching = isCursorTouching(selection, open.from, close.to), inclusive ends, ANY range. Touched: no content
//    class, no hiding, and both tag ranges (whole tag, attributes included) get cm-faint-syntax. Untouched: both tags
//    hidden (Decoration.replace -> absent from the DOM text) and the content between them gets the class.
//  - Classes: kbd/u/ins/small/abbr -> cm-html-<name>; mark -> cm-highlight; sub -> cm-subscript; sup ->
//    cm-superscript; span -> no class at all (tags still hidden).
//  - Attributes in the source are never applied, except abbr `title` (double, single or un-quoted), set as a DOM
//    attribute (never parsed as HTML) on the content element. `title` on any other tag is ignored.
//  - <br>, <br/>, <br /> (any case): left as source, ALWAYS cm-faint-syntax (touched or not). Any HTMLTag whose name
//    is not in the list (b, div, details, font...) and any HTMLBlock: untouched, no class, no faint.
//  - Markdown inside a pair is NOT this extension's job; livePreview still hides `**` inside <mark>.
//  - Not asserted (jsdom): CSS, real rendering.
const views = [];
const mkView = (doc, anchor = doc.length, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor, head },
            extensions: [
                EditorState.allowMultipleSelections.of(true),
                markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript] }),
                livePreview, htmlInlinePreview,
            ],
        }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};
const qa = (v, sel) => [...v.dom.querySelectorAll(sel)];
const setSel = (v, anchor, head = anchor) => v.dispatch({ selection: { anchor, head } });
const text = (v) => qa(v, '.cm-content')[0].textContent;
const line0 = (v) => qa(v, '.cm-line')[0].textContent;
const texts = (v, sel) => qa(v, sel).map((e) => e.textContent);
const HTML_CLASSES = '[class*="cm-html-"], .cm-highlight, .cm-subscript, .cm-superscript';

afterEach(() => {
    while (views.length) views.pop().destroy();
    document.body.innerHTML = '';
});

// The decoration set(s) holding this extension's marks, found structurally (not by timing).
const htmlSets = (v) => v.state.facet(EditorView.decorations).filter((d) => {
    if (typeof d === 'function') return false;
    let hit = false;
    d.between(0, v.state.doc.length, (_f, _t, val) => {
        if (/cm-html-/.test(val.spec.class || '')) { hit = true; return false; }
    });
    return hit;
});

const CLASS_OF = { kbd: 'cm-html-kbd', u: 'cm-html-u', ins: 'cm-html-ins', small: 'cm-html-small', abbr: 'cm-html-abbr', mark: 'cm-highlight', sub: 'cm-subscript', sup: 'cm-superscript' };

describe('htmlInlinePreview: exports', () => {
    it('SAFE_INLINE_HTML_TAGS is exactly the nine inline tags, lowercase', () => {
        expect([...SAFE_INLINE_HTML_TAGS].sort()).toEqual(['abbr', 'ins', 'kbd', 'mark', 'small', 'span', 'sub', 'sup', 'u']);
    });
    it('br, div, details, summary are not in it (not inline-rendered)', () => {
        for (const n of ['br', 'div', 'details', 'summary']) expect(SAFE_INLINE_HTML_TAGS).not.toContain(n);
    });
});

describe('htmlInlinePreview: hidden when the selection is away', () => {
    it.each(Object.entries(CLASS_OF))('<%s>x</..>: tags gone, x carries .%s', (name, cls) => {
        const v = mkView(`a <${name}>x</${name}> b\n\ntail`);
        expect(line0(v)).toBe('a x b');
        const els = qa(v, '.' + cls);
        expect(els).toHaveLength(1);
        expect(els[0].textContent).toBe('x');
        expect(qa(v, '.cm-faint-syntax')).toHaveLength(0);
    });
    it('span: tags gone, text stays, no class from this extension', () => {
        const v = mkView('a <span>x</span> b\n\ntail');
        expect(line0(v)).toBe('a x b');
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
    });
    it('multi-char content and two pairs in a line', () => {
        const v = mkView('a <kbd>Ctrl</kbd> + <kbd>C</kbd> z\n\ntail');
        expect(texts(v, '.cm-html-kbd')).toEqual(['Ctrl', 'C']);
        expect(line0(v)).toBe('a Ctrl + C z');
    });
    it('different tags in one line', () => {
        const v = mkView('<kbd>k</kbd> <u>u</u> <ins>i</ins> <small>s</small> tail');
        expect(texts(v, '.cm-html-kbd')).toEqual(['k']);
        expect(texts(v, '.cm-html-u')).toEqual(['u']);
        expect(texts(v, '.cm-html-ins')).toEqual(['i']);
        expect(texts(v, '.cm-html-small')).toEqual(['s']);
        expect(line0(v)).toBe('k u i s tail');
    });
    it('the class wraps ONLY the content, not the tags', () => {
        const v = mkView('a <kbd>K</kbd> b\n\ntail');
        expect(qa(v, '.cm-html-kbd')[0].textContent).not.toMatch(/[<>]/);
    });
    it('tag at the very start of a paragraph line (inline, not an HTML block)', () => {
        const v = mkView('<kbd>K</kbd> tail\n\nz');
        expect(texts(v, '.cm-html-kbd')).toEqual(['K']);
    });
    it('sub/sup written as HTML: H<sub>2</sub>O and x<sup>2</sup>', () => {
        const v = mkView('H<sub>2</sub>O x<sup>3</sup>\n\ntail');
        expect(texts(v, '.cm-subscript')).toEqual(['2']);
        expect(texts(v, '.cm-superscript')).toEqual(['3']);
        expect(line0(v)).toBe('H2O x3');
    });
    it.each([
        ['heading', '# a <u>x</u> b\n\ntail'],
        ['blockquote', '> a <u>x</u> b\n\ntail'],
        ['bullet item', '- a <u>x</u> b\n\ntail'],
        ['ordered item', '1. a <u>x</u> b\n\ntail'],
        ['3-space indent', '   a <u>x</u> b\n\ntail'],
        ['nested blockquote list', '> - a <u>x</u> b\n\ntail'],
    ])('%s: renders', (_n, doc) => {
        const v = mkView(doc);
        expect(texts(v, '.cm-html-u')).toEqual(['x']);
        expect(text(v)).not.toContain('<u>');
    });
    it('a pair over a soft line break in one paragraph renders', () => {
        const v = mkView('a <u>x\ny</u> b\n\ntail');
        expect(qa(v, '.cm-html-u').map((e) => e.textContent).join('')).toBe('xy');
        expect(text(v)).not.toContain('<u>');
        expect(text(v)).not.toContain('</u>');
    });
});

describe('htmlInlinePreview: tag names are case-insensitive', () => {
    it('<KBD>x</Kbd> renders cm-html-kbd, tags hidden', () => {
        const v = mkView('a <KBD>x</Kbd> b\n\ntail');
        expect(texts(v, '.cm-html-kbd')).toEqual(['x']);
        expect(line0(v)).toBe('a x b');
    });
    it('<MARK>, <Sub>, <ABBR title="t"> too', () => {
        const v = mkView('<MARK>m</MARK> H<Sub>2</SUB> <ABBR title="t">a</abbr> tail');
        expect(texts(v, '.cm-highlight')).toEqual(['m']);
        expect(texts(v, '.cm-subscript')).toEqual(['2']);
        expect(qa(v, '.cm-html-abbr')[0].getAttribute('title')).toBe('t');
    });
    it('touched: source case is preserved in the raw tags', () => {
        const d = 'a <KBD>x</Kbd> b\n\ntail';
        const v = mkView(d, d.indexOf('x'));
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<KBD>', '</Kbd>']);
        expect(line0(v)).toBe('a <KBD>x</Kbd> b');
    });
});

describe('htmlInlinePreview: raw when the selection touches', () => {
    const doc = 'a <kbd>K</kbd> b\n\ntail';
    const open = doc.indexOf('<kbd>');
    const content = doc.indexOf('K');
    const closeFrom = doc.indexOf('</kbd>');
    const closeTo = closeFrom + '</kbd>'.length;
    const raw = (v) => {
        expect(line0(v)).toBe('a <kbd>K</kbd> b');
        expect(qa(v, '.cm-html-kbd')).toHaveLength(0);
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<kbd>', '</kbd>']);
    };
    it.each(['kbd', 'u', 'ins', 'small', 'abbr', 'mark', 'sub', 'sup', 'span'])('%s: cursor in the content: raw, tags faint, no content class', (name) => {
        const d = `a <${name}>K</${name}> b\n\ntail`;
        const v = mkView(d, d.indexOf('K'));
        expect(line0(v)).toBe(`a <${name}>K</${name}> b`);
        expect(texts(v, '.cm-faint-syntax')).toEqual([`<${name}>`, `</${name}>`]);
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
    });
    it('cursor right before the opening tag touches (inclusive end)', () => raw(mkView(doc, open)));
    it('cursor right after the closing tag touches (inclusive end)', () => raw(mkView(doc, closeTo)));
    it('cursor inside the opening tag and inside the closing tag touches', () => {
        raw(mkView(doc, open + 2));
        raw(mkView(doc, closeFrom + 3));
    });
    it('cursor between the opening tag and the content, and between content and closing tag', () => {
        raw(mkView(doc, content));
        raw(mkView(doc, closeFrom));
    });
    it('one char further away does not touch', () => {
        const v = mkView(doc, open - 1);
        expect(qa(v, '.cm-html-kbd')).toHaveLength(1);
        setSel(v, closeTo + 1);
        expect(qa(v, '.cm-html-kbd')).toHaveLength(1);
        expect(line0(v)).toBe('a K b');
    });
    it('a selection overlapping from outside touches; one ending exactly at the pair start touches', () => {
        raw(mkView(doc, 0, open + 1));
        raw(mkView(doc, 0, open));
        raw(mkView(doc, closeTo, doc.length));
    });
    it('a selection covering the whole pair touches', () => raw(mkView(doc, open, closeTo)));
    it('only the touched pair goes raw; the other stays hidden', () => {
        const d = 'a <kbd>1</kbd> and <u>2</u>\n\ntail';
        const v = mkView(d, d.indexOf('1'));
        expect(qa(v, '.cm-html-kbd')).toHaveLength(0);
        expect(texts(v, '.cm-html-u')).toEqual(['2']);
        expect(line0(v)).toBe('a <kbd>1</kbd> and 2');
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<kbd>', '</kbd>']);
    });
    it('multi-cursor: touching with any range reveals', () => {
        const d = 'a <kbd>1</kbd> and <u>2</u>\n\ntail';
        const v = mkView(d, d.length);
        v.dispatch({ selection: EditorSelection.create([EditorSelection.cursor(d.length), EditorSelection.cursor(d.indexOf('2'))], 0) });
        expect(v.state.selection.ranges).toHaveLength(2);
        expect(qa(v, '.cm-html-u')).toHaveLength(0);
        expect(texts(v, '.cm-html-kbd')).toEqual(['1']);
    });
    it('moving away hides again; moving in reveals again', () => {
        const v = mkView(doc, content);
        expect(qa(v, '.cm-html-kbd')).toHaveLength(0);
        setSel(v, doc.length);
        expect(qa(v, '.cm-html-kbd')).toHaveLength(1);
        setSel(v, content);
        expect(qa(v, '.cm-html-kbd')).toHaveLength(0);
    });
    it('typing the closing > completes the pair and it renders', () => {
        const d = 'a <u>x</u b\n\ntail';
        const v = mkView(d, d.length);
        expect(qa(v, '.cm-html-u')).toHaveLength(0);
        v.dispatch({ changes: { from: d.indexOf('</u') + 3, insert: '>' }, selection: { anchor: d.length + 1 } });
        expect(texts(v, '.cm-html-u')).toEqual(['x']);
    });
    it('typing inside the content updates the class text', () => {
        const d = 'a <u>x</u> b\n\ntail';
        const v = mkView(d, d.length);
        v.dispatch({ changes: { from: d.indexOf('x') + 1, insert: 'y' }, selection: { anchor: d.length + 1 } });
        expect(texts(v, '.cm-html-u')).toEqual(['xy']);
    });
});

describe('htmlInlinePreview: nesting', () => {
    const doc = 'a <kbd><u>x</u></kbd> b\n\ntail';
    it('<kbd><u>x</u></kbd>: both classes, all four tags hidden', () => {
        const v = mkView(doc);
        expect(texts(v, '.cm-html-kbd')).toEqual(['x']);
        expect(texts(v, '.cm-html-u')).toEqual(['x']);
        expect(line0(v)).toBe('a x b');
    });
    it('cursor in the innermost content: everything raw', () => {
        const v = mkView(doc, doc.indexOf('x'));
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
        expect(line0(v)).toBe('a <kbd><u>x</u></kbd> b');
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<kbd>', '<u>', '</u>', '</kbd>']);
    });
    it('cursor touching only the outer opening tag: outer raw, inner pair stays rendered', () => {
        const v = mkView(doc, doc.indexOf('<kbd>'));
        expect(qa(v, '.cm-html-kbd')).toHaveLength(0);
        expect(texts(v, '.cm-html-u')).toEqual(['x']);
        expect(line0(v)).toBe('a <kbd>x</kbd> b');
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<kbd>', '</kbd>']);
    });
    it('different pairs of the same name side by side are independent', () => {
        const d = 'a <u>1</u> <u>2</u>\n\ntail';
        const v = mkView(d, d.indexOf('1'));
        expect(texts(v, '.cm-html-u')).toEqual(['2']);
        expect(line0(v)).toBe('a <u>1</u> 2');
    });
});

describe('htmlInlinePreview: markdown inside a pair keeps rendering', () => {
    it('<mark>**b**</mark>: tags and ** both hidden, highlight wraps b', () => {
        const v = mkView('a <mark>**b**</mark> c\n\ntail');
        expect(line0(v)).toBe('a b c');
        expect(texts(v, '.cm-highlight')).toEqual(['b']);
    });
    it('<u>*i* and `c`</u>: emphasis marks hidden, code styled', () => {
        const v = mkView('a <u>*i* and `c`</u> b\n\ntail');
        expect(line0(v)).toBe('a i and c b');
        expect(texts(v, '.cm-html-u')).toEqual(['i and c']);
        expect(texts(v, '.cm-inline-code')).toEqual(['c']);
    });
    it('markdown wrapping a pair: **<u>x</u>**', () => {
        const v = mkView('a **<u>x</u>** b\n\ntail');
        expect(line0(v)).toBe('a x b');
        expect(texts(v, '.cm-html-u')).toEqual(['x']);
    });
});

describe('htmlInlinePreview: not rendered (source as today)', () => {
    it.each([
        ['unclosed', 'a <u>x b\n\ntail', '<u>x b'],
        ['unmatched closer', 'a x</u> b\n\ntail', 'x</u>'],
        ['mismatched names', 'a <u>x</kbd> b\n\ntail', '<u>x</kbd>'],
        ['crossing', 'a <u><kbd>x</u></kbd> b\n\ntail', '<u><kbd>x</u></kbd>'],
        ['closer before opener', 'a </u>x<u> b\n\ntail', '</u>x<u>'],
        ['across paragraphs', 'a <u>x\n\ny</u> b\n\ntail', '<u>x'],
        ['across list items', '- a <u>x\n- y</u> b\n\ntail', '<u>x'],
        ['across blockquote end', '> a <u>x\n\ny</u> b\n\ntail', '<u>x'],
        ['incomplete closing tag', 'a <u>x</u b\n\ntail', '<u>x</u'],
        ['incomplete opening tag', 'a <u x</u> b\n\ntail', '<u x</u>'],
        ['not a tag name (space after <)', 'a < u>x</u> b\n\ntail', '< u>x'],
        ['closing tag in code', 'a <u>x `</u>` b\n\ntail', '<u>x'],
        ['opening tag in code', 'a `<u>` x</u> b\n\ntail', 'x</u>'],
        ['unlisted tag', 'a <b>x</b> <font>y</font>\n\ntail', '<b>x</b> <font>y</font>'],
        ['block div', '<div>\na <u>x</u>\n</div>\n\ntail', '<u>x</u>'],
        ['block details', '<details>\n<summary>s <u>x</u></summary>\nbody\n</details>\n\ntail', '<details>'],
    ])('%s', (_n, doc, visible) => {
        const v = mkView(doc);
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
        expect(qa(v, '.cm-faint-syntax')).toHaveLength(0);
        expect(text(v)).toContain(visible);
    });
    it('a closed pair still renders next to an unclosed one', () => {
        const v = mkView('a <u>x</u> <u>y b\n\ntail');
        expect(texts(v, '.cm-html-u')).toEqual(['x']);
        expect(text(v)).toContain('<u>y b');
    });
    it('a crossed pair does not stop an unrelated pair', () => {
        const v = mkView('a <u><kbd>x</u></kbd> <ins>i</ins>\n\ntail');
        expect(texts(v, '.cm-html-ins')).toEqual(['i']);
        expect(qa(v, '.cm-html-u, .cm-html-kbd')).toHaveLength(0);
    });
    it.each([
        ['inline code', '`<u>x</u>` and `<mark>m</mark>`\n\ntail'],
        ['fenced code', '```\n<u>x</u> <kbd>k</kbd>\n```\n\ntail'],
        ['tilde fence', '~~~\n<u>x</u>\n~~~\n\ntail'],
        ['indented code', 'p\n\n    <u>x</u>\n\ntail'],
        ['math', '$<u>x</u>$\n\ntail'],
        ['front matter', '---\ntitle: <u>x</u>\n---\n\ntail'],
    ])('nothing inside %s', (_n, doc) => {
        const v = mkView(doc);
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
        expect(qa(v, '.cm-faint-syntax')).toHaveLength(0);
        expect(text(v)).toContain('<u>');
    });
    it('inline code keeps its tags visible', () => {
        const v = mkView('`<u>x</u>`\n\ntail');
        expect(text(v)).toContain('<u>x</u>');
    });
});

describe('htmlInlinePreview: attributes are never applied', () => {
    it('abbr title="..." becomes the title attribute of the content element, tag hidden', () => {
        const v = mkView('a <abbr title="World Health">WHO</abbr> b\n\ntail');
        const el = qa(v, '.cm-html-abbr')[0];
        expect(el.textContent).toBe('WHO');
        expect(el.getAttribute('title')).toBe('World Health');
        expect(line0(v)).toBe('a WHO b');
    });
    it("single-quoted and un-quoted titles", () => {
        const v = mkView("<abbr title='one two'>A</abbr> <abbr title=tip>B</abbr> tail");
        const [a, b] = qa(v, '.cm-html-abbr');
        expect(a.getAttribute('title')).toBe('one two');
        expect(b.getAttribute('title')).toBe('tip');
    });
    it('abbr without title: no title attribute', () => {
        const v = mkView('a <abbr>WHO</abbr> b\n\ntail');
        expect(qa(v, '.cm-html-abbr')[0].hasAttribute('title')).toBe(false);
    });
    it('a title holding markup is an attribute value, never parsed: no <b> element appears', () => {
        const v = mkView('a <abbr title="x <b>y</b> z">W</abbr> b\n\ntail');
        expect(qa(v, 'b')).toHaveLength(0);
        expect(qa(v, '.cm-html-abbr')[0].getAttribute('title')).toBe('x <b>y</b> z');
        expect(line0(v)).toBe('a W b');
    });
    it('abbr: class/style/id/on* in the source are not applied; title still is', () => {
        const v = mkView('a <abbr title="t" class="evil" style="color:red" id="i" onclick="alert(1)">W</abbr> b\n\ntail');
        const el = qa(v, '.cm-html-abbr')[0];
        expect(el.getAttribute('title')).toBe('t');
        expect(el.hasAttribute('onclick')).toBe(false);
        expect(el.hasAttribute('id')).toBe(false);
        expect(el.getAttribute('style') || '').not.toMatch(/red/);
        expect(el.className).not.toMatch(/evil/);
        expect(qa(v, '.evil, [onclick], [id="i"]')).toHaveLength(0);
        expect(line0(v)).toBe('a W b');
    });
    it.each(['kbd', 'mark', 'u', 'ins', 'small', 'sub', 'sup', 'span'])('%s: class, style, id, title, on*, data-* are ignored', (name) => {
        const v = mkView(`a <${name} class="evil" style="color:red" id="i" title="tt" onclick="alert(1)" data-x="1">x</${name}> b\n\ntail`);
        expect(line0(v)).toBe('a x b');
        expect(qa(v, '.evil, [onclick], [id="i"], [title="tt"], [data-x]')).toHaveLength(0);
        for (const el of qa(v, '.cm-content *')) expect(el.getAttribute('style') || '', el.className).not.toMatch(/red/);
    });
    it('no element anywhere carries an on* attribute for a line of every tag', () => {
        const v = mkView('<kbd onclick=1>a</kbd> <mark onmouseover=1>b</mark> <u onfocus=1>c</u> <abbr title="t" onclick=1>d</abbr> <span onclick=1>e</span> tail');
        for (const el of qa(v, '.cm-content *')) for (const a of el.getAttributeNames()) expect(a.startsWith('on'), `${el.tagName} ${a}`).toBe(false);
    });
});

describe('htmlInlinePreview: <br> and block HTML', () => {
    it.each(['<br>', '<br/>', '<br />', '<BR>', '<Br/>'])('%s: stays source and faint (cursor away)', (br) => {
        const v = mkView(`a${br}b\n\ntail`);
        expect(line0(v)).toBe(`a${br}b`);
        expect(texts(v, '.cm-faint-syntax')).toEqual([br]);
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
    });
    it('<br> is still source and faint with the cursor on it', () => {
        const d = 'a<br>b\n\ntail';
        const v = mkView(d, d.indexOf('<br>') + 2);
        expect(line0(v)).toBe('a<br>b');
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<br>']);
    });
    it('<br> inside a rendered pair stays source and faint; the pair renders', () => {
        const v = mkView('a <u>x<br>y</u> b\n\ntail');
        expect(line0(v)).toBe('a x<br>y b');
        expect(texts(v, '.cm-faint-syntax')).toEqual(['<br>']);
        expect(qa(v, '.cm-html-u')).toHaveLength(1);
    });
    it('block <div> and <details> are untouched: no class, no faint, source intact', () => {
        const d = '<div>x</div>\n\n<details>\n<summary>s</summary>\nbody\n</details>\n\ntail';
        const v = mkView(d);
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
        expect(qa(v, '.cm-faint-syntax')).toHaveLength(0);
        expect(text(v)).toContain('<div>x</div>');
        expect(text(v)).toContain('<details>');
        expect(text(v)).toContain('<summary>s</summary>');
    });
    it('inline <div> / <details> inside a paragraph are not in the list: untouched', () => {
        const v = mkView('a <div>x</div> <details>y</details> b\n\ntail');
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
        expect(qa(v, '.cm-faint-syntax')).toHaveLength(0);
        expect(line0(v)).toBe('a <div>x</div> <details>y</details> b');
    });
    it('HTML comments stay source', () => {
        const v = mkView('a <!-- <u>x</u> --> b\n\ntail');
        expect(qa(v, HTML_CLASSES)).toHaveLength(0);
        expect(line0(v)).toBe('a <!-- <u>x</u> --> b');
    });
});

describe('htmlInlinePreview: selection-only fast path (structural identity)', () => {
    let doc = 'A <kbd>1</kbd> and <u>2</u> end\n\n';
    for (let i = 0; i < 40; i++) doc += `plain ${i}\n\n`;
    const plain = (n) => doc.indexOf(`plain ${n}\n`) + 2;
    const kbdAt = doc.indexOf('1</kbd>');
    const uAt = doc.indexOf('2</u>');

    it('the extension exposes a plain DecorationSet in the facet', () => {
        expect(htmlSets(mkView(doc, plain(3)))).toHaveLength(1);
    });
    it('moves that keep the touched-pair set unchanged return the identical set', () => {
        const v = mkView(doc, plain(3));
        const before = htmlSets(v);
        expect(before).toHaveLength(1);
        setSel(v, plain(20));
        expect(htmlSets(v)[0]).toBe(before[0]);
        setSel(v, plain(35), plain(36));
        expect(htmlSets(v)[0]).toBe(before[0]);
    });
    it('touching a pair changes the set; moving within it keeps the new set; leaving gives a new set again', () => {
        const v = mkView(doc, plain(3));
        const before = htmlSets(v)[0];
        setSel(v, kbdAt);
        const inside = htmlSets(v);
        expect(inside).toHaveLength(1); // the u pair is still hidden
        expect(inside[0]).not.toBe(before);
        setSel(v, kbdAt + 1);
        expect(htmlSets(v)[0]).toBe(inside[0]);
        setSel(v, plain(30));
        expect(htmlSets(v)[0]).not.toBe(inside[0]);
    });
    it('moving from one pair to the other changes the set', () => {
        const v = mkView(doc, kbdAt);
        const a = htmlSets(v)[0];
        setSel(v, uAt);
        expect(htmlSets(v)[0]).not.toBe(a);
    });
    it('a document change rebuilds (new set), and the new content is decorated', () => {
        const v = mkView(doc, plain(3));
        const before = htmlSets(v)[0];
        v.dispatch({ changes: { from: 0, insert: 'Z' }, selection: { anchor: plain(3) + 1 } });
        expect(htmlSets(v)[0]).not.toBe(before);
        expect(texts(v, '.cm-html-kbd')).toEqual(['1']);
    });
});

describe('source guards and wiring', () => {
    const own = readFileSync(resolve(process.cwd(), 'src/extensions/htmlInlinePreview.js'), 'utf8');
    const editor = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');
    it('reuses isCursorTouching from ./selection (one touching rule across extensions)', () => {
        expect(own).toMatch(/import\s*\{[^}]*\bisCursorTouching\b[^}]*\}\s*from\s*['"]\.\/selection['"]|import\s*\{[^}]*\bselectionKeyedField\b[^}]*\}\s*from\s*['"]\.\/decorationField['"]/);
    });
    it('Editor.jsx imports htmlInlinePreview and lists it in the extensions array', () => {
        expect(editor).toMatch(/import\s*\{[^}]*\bhtmlInlinePreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/htmlInlinePreview['"]/);
        expect(editor).toMatch(/^\s*htmlInlinePreview,\s*$/m);
    });
    it('livePreview.js has no HTMLTag branch (new behaviour is its own extension)', () => {
        const lp = readFileSync(resolve(process.cwd(), 'src/extensions/livePreview.js'), 'utf8');
        expect(lp).not.toMatch(/HTMLTag/);
    });
});
