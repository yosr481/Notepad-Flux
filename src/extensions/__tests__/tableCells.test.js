import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { mathPreview } from '../mathPreview';
import { footnoteSyntax } from '../footnoteSyntax';
import { footnotePreview, resolveFootnotes } from '../footnotes';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { frontMatterPreview } from '../frontMatterPreview';
import { emojiSyntax } from '../emojiSyntax';
import { emojiPreview } from '../emojiPreview';
import { subSupPreview } from '../subSupPreview';
import { livePreview } from '../livePreview';
import { calloutPreview } from '../callouts';
import { mermaidPreview } from '../mermaidPreview';
import { imagePreview } from '../imagePreview';
import { linkPreview } from '../linkPreview';
import { linkHandler } from '../linkHandler';
import { textDirection } from '../textDirection';
import { emojiFor } from '../../utils/emojiTable';
import { TABLE_CELL_CASES } from '../../test/tableCellCases';

// Spec: Docs/internal/table-cells-spec.md (B12). Rendered table cells show the same inline features as the same text
// outside a table, with the cursor elsewhere.
//
// Pinned choices (spec silent):
//  - The view is built with the app's real extension list (components/Editor.jsx createEditorState, minus keymaps,
//    history, search and theme). The cursor is always outside the table; assertions read the DOM under .cm-table-widget.
//  - Math: the cell holds a `.cm-math` element whose textContent is the TeX WITHOUT the `$` (as MathWidget shows it)
//    until renderTex resolves, then an <svg>. renderTex(tex, { display: false }) is the call. A rejected render keeps
//    the raw TeX and throws nothing.
//  - Sub/sup: `.cm-subscript` / `.cm-superscript` elements holding just the inner text, no `~` / `^` visible.
//  - Emoji: span.cm-emoji[role=img][aria-label=<name>] with textContent = emojiFor(name).
//  - Footnotes: `.cm-footnote-ref` whose text is the resolveFootnotes number (labelled refs and inline notes alike).
//  - Highlight: only "the text shows and `==` does not" is pinned. Today sanitizeHTML drops <mark> (not in
//    ALLOWED_TAGS), so a wrapper element is not pinned either way.
//  - Link: <a href> kept; a mousedown on it is NOT default-prevented and does not move the cursor. A mousedown elsewhere
//    in the widget puts the cursor into the table range.
//  - Parity compares normalized textContent (whitespace collapsed, trimmed) and the ordered list of the five feature
//    classes per element.
//  - Not asserted (jsdom): CSS, layout.
//  - Time-free: renderTex is mocked; promise chains are drained with a macrotask flush, no clocks.

const mocks = vi.hoisted(() => ({ renderTex: vi.fn(), isMathLoaded: vi.fn(() => false) }));
vi.mock('../../utils/math', () => ({
    renderTex: (...a) => mocks.renderTex(...a),
    isMathLoaded: () => mocks.isMathLoaded(),
}));

const svgFor = (tex) => `<svg data-tex="${tex}" xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`;
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

const SYNTAX = [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax];
const EXTENSIONS = [
    EditorView.lineWrapping,
    EditorView.perLineTextDirection.of(true),
    markdown({ base: markdownLanguage, extensions: SYNTAX }),
    livePreview, subSupPreview, emojiPreview, mathPreview, footnotePreview, calloutPreview, mermaidPreview,
    frontMatterPreview, imagePreview, linkPreview, linkHandler, textDirection,
];

const views = [];
const mkView = (doc, anchor = doc.length, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor, head }, extensions: EXTENSIONS }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};
const widget = (v) => v.dom.querySelector('.cm-table-widget');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

// One body cell, cursor in the paragraph above (outside the table). `p` and `z` keep the table mid-document.
const cellDoc = (cell, extra = '') => `p\n\n| h |\n| --- |\n| ${cell} |\n\nz\n${extra}`;
const cellView = (cell, extra = '') => mkView(cellDoc(cell, extra), 0);
const td = (v) => widget(v).querySelector('tbody td');

beforeEach(() => {
    mocks.renderTex.mockReset();
    mocks.renderTex.mockImplementation(async (tex) => svgFor(tex));
});
afterEach(() => { while (views.length) views.pop().destroy(); vi.restoreAllMocks(); });

describe('table cells: the existing set still renders', () => {
    it('the table is one widget and no raw pipes show', () => {
        const v = cellView('**b**');
        expect(widget(v)).not.toBeNull();
        expect(widget(v).querySelector('table')).not.toBeNull();
        expect(td(v).textContent).toBe('b');
    });

    it.each([
        ['**b**', 'strong', 'b'],
        ['*i*', 'em', 'i'],
        ['~~s~~', 'del', 's'],
        ['`c`', 'code', 'c'],
    ])('%s -> <%s> holding %s, no markers left', (src, tag, text) => {
        const cell = td(cellView(src));
        const el = cell.querySelector(tag);
        expect(el).not.toBeNull();
        expect(el.textContent).toBe(text);
        expect(cell.textContent).toBe(text);
    });

    it('==h== shows h inside .cm-highlight (the class outside tables), no == left', () => {
        const cell = td(cellView('a ==h== b'));
        const hl = cell.querySelector('.cm-highlight');
        expect(hl).not.toBeNull();
        expect(hl.textContent).toBe('h');
        expect(norm(cell.textContent)).toBe('a h b');
    });

    it('==h== inside inline code stays literal in a cell', () => {
        const cell = td(cellView('`==h==`'));
        expect(cell.querySelector('.cm-highlight')).toBeNull();
        expect(cell.textContent).toBe('==h==');
    });

    it('[t](https://x) is an <a> with the href kept and the text t', () => {
        const a = td(cellView('[t](https://x)')).querySelector('a');
        expect(a).not.toBeNull();
        expect(a.getAttribute('href')).toBe('https://x');
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener noreferrer');
        expect(a.textContent).toBe('t');
    });

    it('only http, https and mailto links get an href; relative and tel: do not (as linkPreview)', () => {
        for (const url of ['foo.md', 'tel:+123456', 'file:///etc/passwd']) {
            const w = widget(cellView(`[x](${url})`));
            expect(w.querySelector('[href]'), url).toBeNull();
            expect(w.querySelector('tbody td').textContent).toBe('x');
        }
        expect(td(cellView('[m](mailto:a@b.test)')).querySelector('a').getAttribute('href')).toBe('mailto:a@b.test');
    });

    it.each(['strong', '.cm-subscript', 'em'])('clicking <%s> inside a link is not swallowed and does not move the cursor', (sel) => {
        const v = cellView('[**b** *i* H~2~O](https://x)');
        const inner = td(v).querySelector(`a ${sel}`);
        expect(inner).not.toBeNull();
        const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
        inner.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        expect(v.state.selection.main.head).toBe(0);
        expect(widget(v)).not.toBeNull();
    });

    it('a link with a "title" keeps only the url as href', () => {
        const a = td(cellView('[t](https://x "hi")')).querySelector('a');
        expect(a.getAttribute('href')).toBe('https://x');
    });

    it('clicking a link is not swallowed (no preventDefault, cursor stays outside the table)', () => {
        const v = cellView('[t](https://x)');
        const a = td(v).querySelector('a');
        const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
        a.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        expect(v.state.selection.main.head).toBe(0);
    });

    it('clicking elsewhere in the widget puts the cursor in the table (raw table opens)', () => {
        const doc = cellDoc('**b**');
        const v = mkView(doc, 0);
        const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
        td(v).dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        const head = v.state.selection.main.head;
        expect(head).toBeGreaterThanOrEqual(doc.indexOf('| h |'));
        expect(head).toBeLessThanOrEqual(doc.indexOf('\n\nz'));
        expect(widget(v)).toBeNull();
    });

    it('inline code content is literal: `**x**` shows the asterisks, no <strong>', () => {
        const cell = td(cellView('`**x**`'));
        expect(cell.querySelector('strong')).toBeNull();
        expect(cell.querySelector('code').textContent).toBe('**x**');
    });

    it('\\| shows a literal | and does not split the cell', () => {
        const v = cellView('a \\| b');
        expect(widget(v).querySelectorAll('tbody td').length).toBe(1);
        expect(td(v).textContent).toBe('a | b');
    });

    it('\\* shows a literal * and does not italicise', () => {
        const cell = td(cellView('\\*x\\*'));
        expect(cell.querySelector('em')).toBeNull();
        expect(cell.textContent).toBe('*x*');
    });

    it('a pipe inside code in a cell stays in one cell', () => {
        const v = cellView('`a \\| b`');
        expect(widget(v).querySelectorAll('tbody td').length).toBe(1);
        expect(td(v).querySelector('code').textContent).toContain('|');
    });

    it('column alignment classes survive', () => {
        const v = mkView('p\n\n| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |\n\nz', 0);
        const cells = [...widget(v).querySelectorAll('tbody td')];
        expect(cells.map((c) => c.className)).toEqual(['cm-align-left', 'cm-align-center', 'cm-align-right']);
    });

    it('features render in header cells too', () => {
        const v = mkView('p\n\n| H~2~O | x^2^ |\n| --- | --- |\n| a | b |\n\nz', 0);
        expect(widget(v).querySelector('th .cm-subscript').textContent).toBe('2');
        expect(widget(v).querySelector('th .cm-superscript').textContent).toBe('2');
    });

    it('features render in a table nested in a blockquote', () => {
        const v = mkView('p\n\n> | h |\n> | --- |\n> | H~2~O :smile: |\n\nz', 0);
        const cell = td(v);
        expect(cell.querySelector('.cm-subscript').textContent).toBe('2');
        expect(cell.querySelector('.cm-emoji').textContent).toBe(emojiFor('smile'));
        expect(cell.textContent).not.toContain('>');
    });

    it('empty cells keep their column and alignment, with and without outer pipes, in a blockquote table', () => {
        const v = mkView('p\n\n> | a | b | c |\n> | :-- | :-: | --: |\n> | x | | z |\n> | | y |\n\nz', 0);
        const rows = [...widget(v).querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => [c.textContent, c.className]));
        expect(rows).toEqual([
            [['x', 'cm-align-left'], ['', 'cm-align-center'], ['z', 'cm-align-right']],
            [['', 'cm-align-left'], ['y', 'cm-align-center']],
        ]);
    });

    it('several cells and rows each render their own features', () => {
        const v = mkView('p\n\n| a | b |\n| --- | --- |\n| H~2~O | x^2^ |\n| :tada: | **k** |\n\nz', 0);
        const w = widget(v);
        expect(w.querySelectorAll('.cm-subscript').length).toBe(1);
        expect(w.querySelectorAll('.cm-superscript').length).toBe(1);
        expect(w.querySelectorAll('.cm-emoji').length).toBe(1);
        expect(w.querySelectorAll('strong').length).toBe(1);
    });
});

describe('table cells: inline math', () => {
    it('$x^2$ gives a .cm-math element with raw TeX (no dollars) until the render resolves', async () => {
        let resolve;
        mocks.renderTex.mockImplementation(() => new Promise((r) => { resolve = r; }));
        const v = cellView('a $x^2$ b');
        const m = td(v).querySelector('.cm-math');
        expect(m).not.toBeNull();
        expect(m.textContent).toBe('x^2');
        expect(m.querySelector('svg')).toBeNull();
        expect(td(v).textContent).not.toContain('$');
        expect(mocks.renderTex).toHaveBeenCalledWith('x^2', expect.objectContaining({ display: false }));

        resolve(svgFor('x^2'));
        await flush();
        expect(td(v).querySelector('.cm-math svg')).not.toBeNull();
    });

    it('with a resolved render the cell shows the svg and the text around it', async () => {
        const v = cellView('a $x^2$ b');
        await flush();
        expect(td(v).querySelector('svg')).not.toBeNull();
        expect(norm(td(v).textContent)).toBe('a b');
    });

    it('two formulas in one cell make two widgets', async () => {
        const v = cellView('$a$ and $b$');
        await flush();
        expect(td(v).querySelectorAll('.cm-math').length).toBe(2);
        expect(td(v).querySelectorAll('svg').length).toBe(2);
    });

    it('math in bold keeps both', async () => {
        const v = cellView('**$x$**');
        await flush();
        expect(td(v).querySelector('strong .cm-math')).not.toBeNull();
    });

    it('nothing math-like happens inside inline code', async () => {
        const v = cellView('`$x^2$`');
        await flush();
        expect(td(v).querySelector('.cm-math')).toBeNull();
        expect(td(v).querySelector('svg')).toBeNull();
        expect(td(v).querySelector('code').textContent).toBe('$x^2$');
        expect(mocks.renderTex).not.toHaveBeenCalled();
    });

    it('a lone dollar (cost $5) stays literal', async () => {
        const v = cellView('cost $5 only');
        await flush();
        expect(td(v).querySelector('.cm-math')).toBeNull();
        expect(td(v).textContent).toBe('cost $5 only');
    });

    it('a failed render keeps the raw TeX and throws nothing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.renderTex.mockImplementation(() => Promise.reject(new Error('boom')));
        const v = cellView('$x^2$');
        await flush();
        expect(td(v).querySelector('.cm-math').textContent).toBe('x^2');
        expect(td(v).querySelector('svg')).toBeNull();
    });
});

describe('table cells: sub/sup', () => {
    it('H~2~O gives .cm-subscript with text 2 and no ~ visible', () => {
        const cell = td(cellView('H~2~O'));
        const sub = cell.querySelector('.cm-subscript');
        expect(sub).not.toBeNull();
        expect(sub.textContent).toBe('2');
        expect(cell.textContent).toBe('H2O');
        expect(cell.textContent).not.toContain('~');
    });

    it('x^2^ gives .cm-superscript with text 2 and no ^ visible', () => {
        const cell = td(cellView('x^2^'));
        expect(cell.querySelector('.cm-superscript').textContent).toBe('2');
        expect(cell.textContent).toBe('x2');
    });

    it('both in one cell, inside bold, inside a link', () => {
        const cell = td(cellView('**H~2~O** [x^2^](https://x) '));
        expect(cell.querySelector('strong .cm-subscript')).not.toBeNull();
        expect(cell.querySelector('a .cm-superscript')).not.toBeNull();
    });

    it('nothing converts inside inline code', () => {
        const cell = td(cellView('`H~2~O x^2^`'));
        expect(cell.querySelector('.cm-subscript, .cm-superscript')).toBeNull();
        expect(cell.textContent).toBe('H~2~O x^2^');
    });

    it('the editor rule holds in a cell: a space ends the attempt, ~~ stays strikethrough', () => {
        const cell = td(cellView('~a b~ and ~~gone~~'));
        expect(cell.querySelector('.cm-subscript')).toBeNull();
        expect(cell.querySelector('del').textContent).toBe('gone');
    });
});

describe('table cells: emoji', () => {
    it(':smile: gives span.cm-emoji[role=img][aria-label=smile] holding the character', () => {
        const cell = td(cellView(':smile:'));
        const e = cell.querySelector('span.cm-emoji');
        expect(e).not.toBeNull();
        expect(e.getAttribute('role')).toBe('img');
        expect(e.getAttribute('aria-label')).toBe('smile');
        expect(e.textContent).toBe('😄');
        expect(cell.textContent).toBe('😄');
    });

    it('12:100:45 stays literal (boundary rule)', () => {
        const cell = td(cellView('12:100:45'));
        expect(cell.querySelector('.cm-emoji')).toBeNull();
        expect(cell.textContent).toBe('12:100:45');
    });

    it(':nope: (unknown name) stays literal', () => {
        const cell = td(cellView(':nope:'));
        expect(cell.querySelector('.cm-emoji')).toBeNull();
        expect(cell.textContent).toBe(':nope:');
    });

    it('nothing converts inside inline code', () => {
        const cell = td(cellView('`:smile:`'));
        expect(cell.querySelector('.cm-emoji')).toBeNull();
        expect(cell.textContent).toBe(':smile:');
    });

    it('several emoji and names with + and _ resolve', () => {
        const cell = td(cellView(':+1: :white_check_mark:'));
        const labels = [...cell.querySelectorAll('.cm-emoji')].map((e) => e.getAttribute('aria-label'));
        expect(labels).toEqual(['+1', 'white_check_mark']);
        expect(cell.querySelectorAll('.cm-emoji')[0].textContent).toBe(emojiFor('+1'));
    });
});

describe('table cells: footnotes', () => {
    // Pinned doc from the task: a[^x] then table | b[^y] | with definitions for x and y.
    const doc = 'a[^x] then\n\n| h |\n| --- |\n| b[^y] |\n\n[^x]: X\n[^y]: Y\n';
    const stateOf = (d) => {
        const s = EditorState.create({ doc: d, extensions: [markdown({ base: markdownLanguage, extensions: SYNTAX })] });
        ensureSyntaxTree(s, d.length, 5000);
        return s;
    };

    it('resolveFootnotes counts the ref in the table (guards the test premise)', () => {
        const { labelled } = resolveFootnotes(stateOf(doc));
        expect(labelled.get('x').number).toBe(1);
        expect(labelled.get('y').number).toBe(2);
    });

    it('the table ref is .cm-footnote-ref with the number resolveFootnotes gives (2), no [^y] visible', () => {
        const v = mkView(doc);
        const expected = String(resolveFootnotes(v.state).labelled.get('y').number);
        expect(expected).toBe('2');
        const ref = td(v).querySelector('.cm-footnote-ref');
        expect(ref).not.toBeNull();
        expect(ref.textContent).toBe(expected);
        expect(td(v).textContent).toBe('b' + expected);
        expect(td(v).textContent).not.toContain('[^');
    });

    it('the ref outside the table shows 1 and the table ref shows 2 (same numbering as outside)', () => {
        const v = mkView(doc);
        const outside = [...v.dom.querySelectorAll('.cm-footnote-ref')].filter((e) => !widget(v).contains(e));
        expect(outside.map((e) => e.textContent)).toEqual(['1']);
    });

    it('a ref used both outside and in the table gets one number', () => {
        const d = 'a[^x]\n\n| h |\n| --- |\n| b[^x] c[^y] |\n\n[^x]: X\n[^y]: Y\n';
        const v = mkView(d);
        const refs = [...td(v).querySelectorAll('.cm-footnote-ref')].map((e) => e.textContent);
        expect(refs).toEqual(['1', '2']);
    });

    it('an inline ^[note] in a cell gets its number from resolveFootnotes', () => {
        const d = 'a[^x]\n\n| h |\n| --- |\n| n^[the note] |\n\n[^x]: X\n';
        const v = mkView(d);
        const entry = resolveFootnotes(v.state).inline.get(d.indexOf('^[the note]'));
        expect(entry).toBeDefined();
        const ref = td(v).querySelector('.cm-footnote-ref');
        expect(ref.textContent).toBe(String(entry.number));
        expect(td(v).textContent).not.toContain('the note');
        expect(td(v).textContent).not.toContain('^[');
    });

    it('an undefined ref [^zz] in a cell stays literal, as outside', () => {
        const v = mkView('a\n\n| h |\n| --- |\n| b[^zz] |\n\n[^x]: X\n');
        expect(td(v).querySelector('.cm-footnote-ref')).toBeNull();
        expect(td(v).textContent).toBe('b[^zz]');
    });

    it('nothing converts inside inline code', () => {
        const v = mkView('a[^x]\n\n| h |\n| --- |\n| `[^x] ^[n]` |\n\n[^x]: X\n');
        expect(td(v).querySelector('.cm-footnote-ref')).toBeNull();
        expect(td(v).textContent).toBe('[^x] ^[n]');
    });
});

describe('table cells: safety', () => {
    const allEls = (root) => [root, ...root.querySelectorAll('*')];

    it('<img src=x onerror=1> shows as text, no img element appears', () => {
        const v = cellView('<img src=x onerror=1>');
        expect(widget(v).querySelector('img')).toBeNull();
        expect(td(v).textContent).toContain('<img src=x onerror=1>');
    });

    it('other raw html shows as text too', () => {
        const v = cellView('<b>hi</b> <script>alert(1)</script>');
        expect(widget(v).querySelector('b, script')).toBeNull();
        expect(td(v).textContent).toContain('<b>hi</b>');
    });

    it('html inside code, bold and a link label stays text', () => {
        const v = cellView('`<img src=x>` **<i>x</i>** [<u>t</u>](https://x)');
        expect(widget(v).querySelector('img, i, u')).toBeNull();
    });

    it('markup in an emoji name is impossible: not an emoji, no element, label is a plain name', () => {
        const v = cellView(':<b>x</b>: :smile: :"onmouseover=1: :a"b:');
        expect(widget(v).querySelector('b')).toBeNull();
        const labels = [...widget(v).querySelectorAll('.cm-emoji')].map((e) => e.getAttribute('aria-label'));
        expect(labels).toEqual(['smile']);
        for (const l of labels) expect(l).toMatch(/^[a-z0-9_+-]+$/i);
        expect(td(v).textContent).toContain(':<b>x</b>:');
    });

    it('no on* attribute anywhere in the widget (a cell exercising every feature)', async () => {
        const v = cellView('<img src=x onerror=1> **b** [t](https://x) $x$ H~2~O x^2^ :smile: n[^a] ^[i] ==h== `c`',
            '\n[^a]: A\n');
        await flush();
        for (const el of allEls(widget(v))) {
            for (const a of el.attributes) expect(a.name.toLowerCase().startsWith('on'), `${el.tagName} ${a.name}`).toBe(false);
        }
    });

    it('no script, iframe, object, style element and no inline style attribute in the widget', async () => {
        const v = cellView('<script>1</script> <iframe></iframe> <style>x{}</style> $x$ H~2~O :smile:');
        await flush();
        expect(widget(v).querySelector('script, iframe, object, style')).toBeNull();
        for (const el of allEls(widget(v))) expect(el.hasAttribute('style'), el.tagName).toBe(false);
    });

    it('a javascript: link never becomes a live href', () => {
        const v = cellView('[x](javascript:alert(1))');
        for (const a of widget(v).querySelectorAll('a')) {
            expect((a.getAttribute('href') || '').toLowerCase()).not.toContain('javascript:');
        }
    });
});

describe('table cells: redraws (TableWidget.eq)', () => {
    const doc = 'top\n\n| h |\n| --- |\n| $x$ **b** b[^a] |\n\nlast\n\n[^a]: A\n';

    it('typing in a paragraph below the table keeps the same table DOM node', async () => {
        const v = mkView(doc, 0);
        await flush();
        const before = widget(v);
        v.dispatch({ changes: { from: doc.indexOf('last') + 4, insert: ' more' } });
        await flush();
        expect(widget(v)).toBe(before);
    });

    it('typing in a paragraph above the table keeps the same table DOM node', async () => {
        const v = mkView(doc, 0);
        await flush();
        const before = widget(v);
        v.dispatch({ changes: { from: 3, insert: ' more' } });
        await flush();
        expect(widget(v)).toBe(before);
    });

    it('adding a new footnote AFTER the table (nothing in the table renumbers) keeps the node', async () => {
        const v = mkView(doc, 0);
        await flush();
        const before = widget(v);
        const at = doc.indexOf('last') + 4;
        v.dispatch({ changes: { from: at, insert: ' q[^b]' } });
        v.dispatch({ changes: { from: v.state.doc.length, insert: '[^b]: B\n' } });
        await flush();
        expect(resolveFootnotes(v.state).labelled.get('b').number).toBe(2);
        expect(widget(v)).toBe(before);
    });

    it('a footnote number that shifts redraws the table: a new ref before it renumbers it', async () => {
        const d = 'top\n\n| h |\n| --- |\n| b[^y] |\n\n[^x]: X\n[^y]: Y\n';
        const v = mkView(d, d.length);
        const before = widget(v);
        expect(before.querySelector('.cm-footnote-ref').textContent).toBe('1');
        v.dispatch({ changes: { from: 3, insert: ' see[^x]' } });
        await flush();
        const after = widget(v);
        expect(resolveFootnotes(v.state).labelled.get('y').number).toBe(2);
        expect(after.querySelector('.cm-footnote-ref').textContent).toBe('2');
        expect(after).not.toBe(before);
    });

    it('a math source edit in the table redraws it and renders the new TeX', async () => {
        const d = 'top\n\n| h |\n| --- |\n| $x$ |\n\nlast\n';
        const v = mkView(d, 0);
        await flush();
        const before = widget(v);
        const at = d.indexOf('$x$') + 1;
        // edit inside the table, selection back outside it in the same transaction
        v.dispatch({ changes: { from: at, to: at + 1, insert: 'y' }, selection: { anchor: 0 } });
        await flush();
        expect(mocks.renderTex).toHaveBeenCalledWith('y', expect.objectContaining({ display: false }));
        expect(widget(v)).not.toBe(before);
        expect(td(v).querySelector('.cm-math svg')).not.toBeNull();
    });

    it('a visible text edit in the table redraws it', async () => {
        const d = 'top\n\n| h |\n| --- |\n| one |\n\nlast\n';
        const v = mkView(d, 0);
        const at = d.indexOf('one');
        v.dispatch({ changes: { from: at, to: at + 3, insert: 'two' }, selection: { anchor: 0 } });
        expect(td(v).textContent).toBe('two');
    });

    it('moving the cursor between other paragraphs keeps the same table DOM node', async () => {
        const v = mkView(doc, 0);
        await flush();
        const before = widget(v);
        v.dispatch({ selection: { anchor: doc.indexOf('last') } });
        await flush();
        expect(widget(v)).toBe(before);
    });
});

describe('table cells: parity with the same text outside a table', () => {
    const FEATURES = ['cm-subscript', 'cm-superscript', 'cm-emoji', 'cm-math', 'cm-footnote-ref'];
    const defs = '[^a]: A\n[^b]: B\n';
    const featureList = (root) => [...root.querySelectorAll('.' + FEATURES.join(',.'))]
        .map((el) => FEATURES.filter((c) => el.classList.contains(c)).join(' '));

    const inCell = async (s) => {
        const d = `p\n\n| h |\n| --- |\n| ${s} |\n\n${defs}`;
        const v = mkView(d, 0);
        await flush();
        return { text: norm(td(v).textContent), features: featureList(td(v)), view: v };
    };
    const inLine = async (s) => {
        const d = `p\n\n${s}\n\n${defs}`;
        const v = mkView(d, 0);
        await flush();
        const line = [...v.dom.querySelectorAll('.cm-line')].find((l) => v.state.doc.lineAt(v.posAtDOM(l)).number === 3);
        return { text: norm(line.textContent), features: featureList(line), view: v };
    };

    it('the case list is big enough and has no pipes or newlines (guards a degenerate list)', () => {
        expect(TABLE_CELL_CASES.length).toBeGreaterThanOrEqual(10);
        for (const s of TABLE_CELL_CASES) expect(s).not.toMatch(/[|\n]/);
    });

    it('the list exercises every compared class somewhere (outside render)', async () => {
        const seen = new Set();
        for (const s of TABLE_CELL_CASES) (await inLine(s)).features.forEach((f) => f.split(' ').forEach((c) => seen.add(c)));
        for (const c of FEATURES) expect(seen.has(c), c).toBe(true);
    });

    it.each(TABLE_CELL_CASES.map((s) => [s]))('%s', async (s) => {
        const cell = await inCell(s);
        const line = await inLine(s);
        expect(cell.text).toBe(line.text);
        expect(cell.features).toEqual(line.features);
    });
});
