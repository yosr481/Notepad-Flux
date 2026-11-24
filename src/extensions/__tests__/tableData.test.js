import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { resolveFootnotes } from '../footnotes';
import { buildTableData, tableDOM } from '../tableCells';
import { livePreview, buildDecorations } from '../livePreview';
import { TableWidget } from '../widgets';

// B12 T1 revision: the old convertTableToHTML.test.js (HTML string) migrated onto the data path.
// Contract pinned here:
//  - buildTableData(state, tableNode, resolveFootnotes(state)) -> { align, head: [cell], body: [[cell]] }, cell = part[],
//    plain text is a bare string part. It returns null for a node that is not a table (no TableHeader / delimiter).
//  - tableDOM(data, view) -> <table><thead><tr><th>..</tr></thead><tbody>..</tbody></table>. A column without alignment
//    gets NO class attribute and never a style attribute; aligned cells get class cm-align-left|center|right.
//  - Text that is not a table (no delimiter row, empty, one line) yields no Table node and so no TableWidget at all
//    (the old "Empty Table" div has no data-path equivalent: it was a string-path fallback for input the parser never
//    gives a Table node for).
//  - Links: only isSafeExternalUrl urls (http, https, mailto) get href + target=_blank + rel="noopener noreferrer".
//    Relative, tel:, javascript:, file: get no href at all.
//  - A cell's text is the escaped-pipe-unescaped, markers-stripped string. Raw HTML in a cell is text, never elements.

const T = (...lines) => lines.join('\n');
const stateOf = (doc) => {
    const s = EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage, extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] }), livePreview],
    });
    // ensureSyntaxTree does not always publish into the state (syntaxTree(state) is a stale snapshot); update({}) adopts the finished tree
    ensureSyntaxTree(s, doc.length, 30000);
    return s.update({}).state;
};
const tableNode = (s) => {
    let t = null;
    syntaxTree(s).iterate({ enter: (n) => { if (n.name === 'Table' && !t) t = n.node; } });
    return t;
};
const dataOf = (doc) => {
    const s = stateOf(doc);
    const t = tableNode(s);
    return t && buildTableData(s, t, resolveFootnotes(s));
};
const domOf = (doc) => tableDOM(dataOf(doc), { requestMeasure() {} });
const texts = (root, sel) => [...root.querySelectorAll(sel)].map((e) => e.textContent);
const widgetsIn = (doc) => {
    const s = stateOf(doc);
    const out = [];
    buildDecorations(s, { from: 0, to: doc.length }).between(0, doc.length, (f, t, v) => {
        if (v.spec && v.spec.widget instanceof TableWidget) out.push(v.spec.widget);
    });
    return out;
};

describe('table data: basic structure', () => {
    const doc = T('| H1 | H2 |', '| --- | --- |', '| a | b |');

    it('data shape: align, head and body of part arrays; plain text is a bare string', () => {
        expect(dataOf(doc)).toEqual({ align: [null, null], head: [['H1'], ['H2']], body: [[['a'], ['b']]] });
    });

    it('renders <table><thead> th cells and <tbody> td cells, and drops the delimiter row', () => {
        const t = domOf(doc);
        expect(t.tagName).toBe('TABLE');
        expect(texts(t, 'thead th')).toEqual(['H1', 'H2']);
        expect(texts(t, 'tbody td')).toEqual(['a', 'b']);
        expect(t.textContent).not.toContain('---');
        expect(t.querySelectorAll('th').length).toBe(2);
        expect(t.querySelectorAll('td').length).toBe(2);
    });

    it('renders every body row', () => {
        const t = domOf(T('| H |', '| --- |', '| r1 |', '| r2 |', '| r3 |'));
        expect(t.querySelectorAll('tr').length).toBe(4); // 1 header + 3 body
        expect(texts(t, 'tbody td')).toEqual(['r1', 'r2', 'r3']);
    });

    it('a plain table is exactly this markup (no class attribute, no stray characters)', () => {
        expect(domOf(T('| a | b |', '| --- | --- |', '| 1 | 2 |')).outerHTML).toBe(
            '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
        );
    });

    it('a header-only table has no <tbody>', () => {
        const t = domOf(T('| H |', '| --- |'));
        expect(t.querySelector('tbody')).toBeNull();
        expect(texts(t, 'th')).toEqual(['H']);
    });
});

describe('table data: alignment (class, never inline style)', () => {
    const doc = T('| L | C | R |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |');

    it('data.align lists left / center / right / null per column', () => {
        expect(dataOf(doc).align).toEqual(['left', 'center', 'right']);
        expect(dataOf(T('| A | B |', '| :---: | --- |', '| 1 | 2 |')).align).toEqual(['center', null]);
    });

    it('maps :--- / :---: / ---: to cm-align-left / -center / -right on header AND body cells', () => {
        const t = domOf(doc);
        expect([...t.querySelectorAll('th')].map((c) => c.className)).toEqual(['cm-align-left', 'cm-align-center', 'cm-align-right']);
        expect([...t.querySelectorAll('td')].map((c) => c.className)).toEqual(['cm-align-left', 'cm-align-center', 'cm-align-right']);
    });

    it('a delimiter row with no outer pipes is recognised', () => {
        const t = domOf(T('h | i', ':-: | ---:', 'x | y'));
        expect([...t.querySelectorAll('th')].map((c) => c.className)).toEqual(['cm-align-center', 'cm-align-right']);
        expect([...t.querySelectorAll('td')].map((c) => c.className)).toEqual(['cm-align-center', 'cm-align-right']);
    });

    it('a plain --- column carries no class attribute and no style attribute anywhere', () => {
        const t = domOf(T('| A | B |', '| --- | --- |', '| 1 | 2 |'));
        for (const c of t.querySelectorAll('th, td')) {
            expect(c.hasAttribute('class')).toBe(false);
            expect(c.hasAttribute('style')).toBe(false);
        }
    });

    it('never emits an inline style for any alignment', () => {
        const t = domOf(doc);
        expect(t.outerHTML).not.toContain('style=');
        expect(t.outerHTML).not.toContain('text-align');
    });

    it('mixed: the aligned column has its class, the plain column none', () => {
        const t = domOf(T('| A | B |', '| :---: | --- |', '| 1 | 2 |'));
        expect(t.querySelector('th:nth-child(1)').className).toBe('cm-align-center');
        expect(t.querySelector('th:nth-child(2)').hasAttribute('class')).toBe(false);
        expect(t.querySelector('td:nth-child(2)').hasAttribute('class')).toBe(false);
    });
});

describe('table data: not a table', () => {
    it.each([
        ['empty string', ''],
        ['whitespace only', '   \n  '],
        ['a single line with no delimiter row', '| just one cell |'],
        ['a header with no delimiter row', T('| a | b |', '| 1 | 2 |')],
    ])('%s: no Table node, no TableWidget, no data', (_n, doc) => {
        const s = stateOf(doc);
        expect(tableNode(s)).toBeNull();
        expect(widgetsIn(doc)).toEqual([]);
    });

    it('buildTableData returns null for a node that is not a table', () => {
        const s = stateOf('just a paragraph');
        const para = syntaxTree(s).topNode.firstChild;
        expect(buildTableData(s, para, resolveFootnotes(s))).toBeNull();
    });
});

describe('table data: cell content', () => {
    it('**bold** is a strong part', () => {
        const t = domOf(T('| H |', '| --- |', '| **bold** |'));
        expect(t.querySelector('td strong').textContent).toBe('bold');
        expect(dataOf(T('| H |', '| --- |', '| **bold** |')).body[0][0]).toEqual([{ k: 'strong', c: ['bold'] }]);
    });

    it('a raw <script> in a cell is text, never an element', () => {
        const t = domOf(T('| H |', '| --- |', '| <script>alert(1)</script> |'));
        expect(t.querySelector('script')).toBeNull();
        expect(t.querySelector('td').textContent).toContain('<script>alert(1)</script>');
    });
});

describe('table data: links in cells (shared isSafeExternalUrl rule)', () => {
    const link = (cell) => domOf(T('| H |', '| --- |', `| ${cell} |`)).querySelector('td a');
    const anyHref = (cell) => domOf(T('| H |', '| --- |', `| ${cell} |`)).querySelector('td [href]');

    it('an untitled http(s) link: href, target=_blank, rel=noopener noreferrer, text t', () => {
        const a = link('[t](http://x)');
        expect(a.getAttribute('href')).toBe('http://x');
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener noreferrer');
        expect(a.textContent).toBe('t');
    });

    it('a titled link keeps only the url: no title text anywhere, no quote characters', () => {
        const t = domOf(T('| H |', '| --- |', '| [t](http://x "hi") |'));
        expect(t.querySelector('a').getAttribute('href')).toBe('http://x');
        expect(t.querySelector('td').textContent).toBe('t');
        expect(t.outerHTML).not.toContain('hi');
        expect(t.outerHTML).not.toContain('&quot;');
    });

    it('keeps a query string intact when a title follows', () => {
        const a = link('[t](http://x?a=1&b=2 "hi")');
        expect(a.getAttribute('href')).toBe('http://x?a=1&b=2');
    });

    it('https and mailto links get an href', () => {
        expect(link('[t](https://x.test/p)').getAttribute('href')).toBe('https://x.test/p');
        expect(link('[m](mailto:a@b.test)').getAttribute('href')).toBe('mailto:a@b.test');
    });

    it.each([
        ['relative file', '[x](foo.md)'],
        ['tel:', '[x](tel:+123456)'],
        ['javascript:', '[x](javascript:alert(1))'],
        ['file:', '[x](file:///etc/passwd)'],
        ['data:', '[x](data:text/html,hi)'],
        ['protocol-relative', '[x](//evil.test/p)'],
    ])('%s: no href, no target, no rel on anything, text kept', (_n, cell) => {
        const t = domOf(T('| H |', '| --- |', `| ${cell} |`));
        expect(t.querySelector('[href]')).toBeNull();
        expect(t.querySelector('[target]')).toBeNull();
        expect(t.querySelector('[rel]')).toBeNull();
        expect(t.querySelector('td').textContent).toBe('x');
        expect(anyHref(cell)).toBeNull();
    });
});

describe('table data: blockquote tables (rows carry "> " in the source)', () => {
    it('"> "-prefixed rows give a real table with the cell text and no ">"', () => {
        const t = domOf(T('> | a | b |', '> | - | - |', '> | 1 | 2 |'));
        expect(texts(t, 'th')).toEqual(['a', 'b']);
        expect(texts(t, 'td')).toEqual(['1', '2']);
        expect(t.textContent).not.toContain('>');
    });

    it('">"-prefixed rows with no space after the > still render', () => {
        const t = domOf(T('>| a | b |', '>| - | - |', '>| 1 | 2 |'));
        expect(texts(t, 'th')).toEqual(['a', 'b']);
        expect(texts(t, 'td')).toEqual(['1', '2']);
    });

    it.each([
        ['an extra space after ">"', T('>  | a | b |', '>  | - | - |', '>  | 1 | 2 |')],
        ['a nested "> > " quote', T('> > | a | b |', '> > | - | - |', '> > | 1 | 2 |')],
    ])('%s is NOT a table for the parser: no Table node, no widget (the source stays visible)', (_n, doc) => {
        // Old convertTableToHTML tested these on raw strings; lezer never hands them over as a Table.
        expect(tableNode(stateOf(doc))).toBeNull();
        expect(widgetsIn(doc)).toEqual([]);
    });

    it('livePreview gives exactly one widget for a blockquote table, holding data with the right cells', () => {
        const [w] = widgetsIn('x\n\n> | a | b |\n> | - | - |\n> | 1 | 2 |\n');
        expect(w.data.head).toEqual([['a'], ['b']]);
        expect(w.data.body).toEqual([[['1'], ['2']]]);
    });
});

describe('table data: escaped pipe in a cell', () => {
    it('"| `a \\| b` | c |" is exactly 2 columns', () => {
        const t = domOf(T('| `a \\| b` | c |', '| --- | --- |', '| 1 | 2 |'));
        expect(t.querySelectorAll('th').length).toBe(2);
        expect(t.querySelectorAll('td').length).toBe(2);
    });

    it('the escaped pipe is ONE literal "|" in code, no backslash survives', () => {
        const t = domOf(T('| `a \\| b` | c |', '| --- | --- |', '| 1 | 2 |'));
        expect(t.querySelector('th code').textContent).toBe('a | b');
        expect(t.textContent).not.toContain('\\');
        expect(texts(t, 'th')).toEqual(['a | b', 'c']);
    });

    it('in a BODY cell: 2 cells, literal "|"', () => {
        const t = domOf(T('| H1 | H2 |', '| --- | --- |', '| a \\| b | c |'));
        expect(texts(t, 'td')).toEqual(['a | b', 'c']);
    });

    it('"\\|" at the very start of a cell gives a literal leading "|"', () => {
        const t = domOf(T('| H1 | H2 |', '| --- | --- |', '| \\|x | y |'));
        expect(texts(t, 'td')).toEqual(['|x', 'y']);
    });

    it('an unescaped table has the same number of cells as pipes say', () => {
        const t = domOf(T('| a | b | c |', '| --- | --- | --- |', '| 1 | 2 | 3 |'));
        expect(t.querySelectorAll('th').length).toBe(3);
        expect(t.querySelectorAll('td').length).toBe(3);
    });

    it('composes with a blockquote and with alignment', () => {
        const t = domOf(T('> | a \\| b | c |', '> | :---: | ---: |', '> | 1 | 2 |'));
        expect(texts(t, 'th')).toEqual(['a | b', 'c']);
        expect(texts(t, 'td')).toEqual(['1', '2']);
        expect([...t.querySelectorAll('th')].map((c) => c.className)).toEqual(['cm-align-center', 'cm-align-right']);
        expect([...t.querySelectorAll('td')].map((c) => c.className)).toEqual(['cm-align-center', 'cm-align-right']);
    });

    it('an escaped backslash before a pipe: "a\\\\|b" is a cell ending in a backslash, then a real separator', () => {
        const t = domOf('| h1 | h2 |\n| - | - |\n| a\\\\|b |');
        expect(texts(t, 'td')).toEqual(['a\\', 'b']);
        expect(t.querySelector('tbody').textContent).not.toContain('\\|');
    });
});

describe('table data: row width follows the header (GFM, as export)', () => {
    it('cells past the header count are dropped: | 1 | 2 | 3 | under one column is exactly one td', () => {
        const doc = T('| h |', '| --- |', '| 1 | 2 | 3 |');
        expect(dataOf(doc).body).toEqual([[['1']]]);
        const t = domOf(doc);
        expect(t.querySelectorAll('tbody td').length).toBe(1);
        expect(t.querySelector('tbody td').textContent).toBe('1');
        expect(t.textContent).not.toContain('2');
    });

    it('a row with extra cells among normal rows is cut to the header width, others untouched', () => {
        const t = domOf(T('| a | b |', '| - | - |', '| 1 | 2 | 3 | 4 |', '| 5 | 6 |'));
        expect([...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent))).toEqual([['1', '2'], ['5', '6']]);
    });

    it('short rows are padded with empty cells to the header width', () => {
        const t = domOf(T('| a | b | c |', '| - | - | - |', '| 1 |', '| | y |'));
        expect([...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent))).toEqual([['1', '', ''], ['', 'y', '']]);
    });
});

describe('table data: TableWidget holds data only', () => {
    it('the widget exposes .data and no HTML string path', () => {
        const [w] = widgetsIn(T('p', '', '| a |', '| - |', '| 1 |', ''));
        expect(w.data).toEqual({ align: [null], head: [['a']], body: [[['1']]] });
        expect(w.htmlContent).toBeUndefined();
    });
});

// F7 T1: safe inline HTML tags in cells (spec: "Table cells"). Pinned: a cell renders the same classes as outside,
// built from textContent only. kbd/u/ins/small/abbr -> span.cm-html-<name>; mark -> span.cm-highlight; sub/sup ->
// span.cm-subscript/.cm-superscript; span -> its text, no wrapper class. The tags themselves never reach the DOM as
// elements (no <kbd> etc.), source attributes are not applied except abbr title (setAttribute). Unclosed/crossing/
// unlisted tags and <br> stay text. Element names of the wrappers are not pinned, only classes.
describe('table data: safe inline html tags', () => {
    const cell = (c) => domOf(T('| h |', '| --- |', `| ${c} |`)).querySelector('tbody td');
    it.each([
        ['kbd', 'cm-html-kbd'], ['u', 'cm-html-u'], ['ins', 'cm-html-ins'], ['small', 'cm-html-small'], ['abbr', 'cm-html-abbr'],
        ['mark', 'cm-highlight'], ['sub', 'cm-subscript'], ['sup', 'cm-superscript'],
    ])('<%s>x</..> -> .%s holding x, tags gone from the text', (n, cls) => {
        const td = cell(`a <${n}>x</${n}> b`);
        expect(texts(td, '.' + cls)).toEqual(['x']);
        expect(td.textContent).toBe('a x b');
    });
    it('<kbd>K</kbd> <mark>m</mark> <u>u</u> in one cell', () => {
        const td = cell('<kbd>K</kbd> <mark>m</mark> <u>u</u>');
        expect(texts(td, '.cm-html-kbd')).toEqual(['K']);
        expect(texts(td, '.cm-highlight')).toEqual(['m']);
        expect(texts(td, '.cm-html-u')).toEqual(['u']);
        expect(td.textContent).toBe('K m u');
    });
    it('span: text only, no wrapper class, tags gone', () => {
        const td = cell('a <span>x</span> b');
        expect(td.textContent).toBe('a x b');
        expect(td.querySelector('[class*="cm-html-"], .cm-highlight')).toBeNull();
    });
    it('case-insensitive', () => {
        const td = cell('<KBD>K</Kbd>');
        expect(texts(td, '.cm-html-kbd')).toEqual(['K']);
    });
    it('nesting and markdown inside', () => {
        const td = cell('<kbd><u>x</u></kbd> <mark>**b**</mark>');
        expect(td.querySelector('.cm-html-kbd .cm-html-u').textContent).toBe('x');
        expect(td.querySelector('.cm-highlight strong').textContent).toBe('b');
        expect(td.textContent).toBe('x b');
    });
    it('no real kbd/mark/u/abbr/ins/small element is created', () => {
        const td = cell('<kbd>K</kbd> <mark>m</mark> <u>u</u> <abbr title="t">a</abbr> <ins>i</ins> <small>s</small>');
        expect(td.querySelector('kbd, mark, u, abbr, ins, small')).toBeNull();
    });
    it('abbr title is an attribute; markup in it is not parsed', () => {
        const td = cell('<abbr title="x <b>y</b> z">W</abbr> <abbr>V</abbr>');
        const [a, b] = td.querySelectorAll('.cm-html-abbr');
        expect(a.getAttribute('title')).toBe('x <b>y</b> z');
        expect(td.querySelector('b')).toBeNull();
        expect(b.hasAttribute('title')).toBe(false);
    });
    it('class/style/id/on*/data-* in the source are not applied', () => {
        const td = cell('<kbd class="evil" style="color:red" id="i" onclick="alert(1)" data-x="1" title="t">K</kbd> <abbr title="t" class="evil" onclick="1">A</abbr>');
        expect(td.querySelector('.evil, [style], [id], [onclick], [data-x]')).toBeNull();
        expect(td.querySelector('.cm-html-kbd').hasAttribute('title')).toBe(false);
        expect(td.querySelector('.cm-html-abbr').getAttribute('title')).toBe('t');
        expect(td.textContent).toBe('K A');
    });
    it('<script> and other raw html in a cell stay text; no element appears', () => {
        const td = cell('<script>alert(1)</script> <img src=x onerror=1> <b>y</b> <kbd>K</kbd>');
        expect(td.querySelector('script, img, b')).toBeNull();
        expect(td.textContent).toContain('<script>alert(1)</script>');
        expect(td.textContent).toContain('<b>y</b>');
        expect(texts(td, '.cm-html-kbd')).toEqual(['K']);
    });
    it('unclosed, mismatched, crossing tags and <br> stay as text', () => {
        const td = cell('<u>x <kbd>a</u>b</kbd> </mark> <br>');
        expect(td.querySelector('[class*="cm-html-"], .cm-highlight')).toBeNull();
        expect(td.textContent).toBe('<u>x <kbd>a</u>b</kbd> </mark> <br>');
    });
    it('tags inside inline code stay text', () => {
        const td = cell('`<kbd>K</kbd>`');
        expect(td.querySelector('[class*="cm-html-"]')).toBeNull();
        expect(td.textContent).toBe('<kbd>K</kbd>');
    });
    it('a pair split by the cell separator is not rendered (each cell is its own context)', () => {
        const d = domOf(T('| a | b |', '| - | - |', '| <u>x | y</u> |'));
        expect(d.querySelector('.cm-html-u')).toBeNull();
    });
});
