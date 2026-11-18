import { describe, it, expect } from 'vitest';
import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { htmlInlinePreview, abbrTitle, MAX_HTML_NESTING } from '../htmlInlinePreview';
import { buildTableData, tableDOM } from '../tableCells';
import { resolveFootnotes } from '../footnotes';

// F7 round 1 (adversarial-review fixes). Pinned contract:
//  - MAX_HTML_NESTING = 32 (named export of htmlInlinePreview.js). A pair's depth = 1 + the number of rendered-or-not
//    pairs enclosing it. Pairs at depth 1..32 render; a pair deeper than 32 renders NOTHING (its tags stay source).
//    So N nested pairs give min(N, 32) rendered pairs, always the OUTERMOST ones. Same cap in table cells.
//  - Pairing is linear in the number of tags (no stack scan per unmatched closer), once per parent / cell.
//  - Cursor moves that do not change the touched-pair set cost O(log pairs): no pass over all pairs.
//  - abbrTitle(openingTagSource): the FIRST real `title` attribute (case-insensitive name), found by walking the
//    attributes (quoted values are skipped, so ` title=x` inside another attribute's value is not an attribute);
//    value entity-decoded with decodeEntity (single pass, unknown/semicolon-less entities stay literal); null if none.
//  - Timing bounds are absolute and generous (>= 5x headroom over a linear implementation, far under the quadratic
//    one); the parse cost is excluded (the tree is built first, the extension is added afterwards).
const T = 120000;
const open = (n) => '<u>'.repeat(n);
const close = (n) => '</u>'.repeat(n);
const exts = [markdown({ base: markdownLanguage })];

const parsed = (doc) => {
    const s = EditorState.create({ doc, selection: { anchor: doc.length }, extensions: exts });
    expect(ensureSyntaxTree(s, doc.length, 60000)).not.toBeNull();
    return s;
};
const withExt = (s) => s.update({ effects: StateEffect.appendConfig.of(htmlInlinePreview) }).state;
const ms = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
const stateWithExt = (doc) => EditorState.create({ doc, selection: { anchor: doc.length }, extensions: [...exts, htmlInlinePreview] });

// Marks with a class and replace decorations, counted straight from the DecorationSet(s) in the facet.
const counts = (state) => {
    const out = { marks: 0, hidden: 0 };
    for (const d of state.facet(EditorView.decorations)) {
        if (typeof d === 'function') continue;
        d.between(0, state.doc.length, (_f, _t, v) => { if (v.spec.class) out.marks++; else out.hidden++; });
    }
    return out;
};

describe('nesting cap', () => {
    it('MAX_HTML_NESTING is 32', () => expect(MAX_HTML_NESTING).toBe(32));
    it('exactly 32 nested pairs all render (32 marks, 64 hidden tags)', () => {
        const d = 'a ' + open(32) + 'x' + close(32) + '\n\ntail';
        expect(counts(stateWithExt(d))).toEqual({ marks: 32, hidden: 64 });
    });
    it('33 nested pairs: the outermost 32 render, the innermost one stays source', () => {
        const d = 'a ' + open(33) + 'x' + close(33) + '\n\ntail';
        expect(counts(stateWithExt(d))).toEqual({ marks: 32, hidden: 64 });
    });
    it('the rendered ones are the OUTER pairs: the outermost opening tag is hidden, the innermost is not', () => {
        const d = 'a ' + open(40) + 'x' + close(40) + '\n\ntail';
        const s = stateWithExt(d);
        const hiddenAt = new Set();
        for (const set of s.facet(EditorView.decorations)) if (typeof set !== 'function') set.between(0, d.length, (f, t, v) => { if (!v.spec.class) hiddenAt.add(f); });
        expect(hiddenAt.has(d.indexOf('<u>'))).toBe(true);
        expect(hiddenAt.has(d.lastIndexOf('<u>'))).toBe(false);
        expect(hiddenAt.has(d.indexOf('</u>'))).toBe(false); // innermost closer
        expect(hiddenAt.has(d.lastIndexOf('</u>'))).toBe(true); // outermost closer
    });
    it('a cap-deep pair next to normal ones: siblings are independent (depth is nesting, not count)', () => {
        const d = ('a <u>x</u> ').repeat(100) + '\n\ntail';
        expect(counts(stateWithExt(d))).toEqual({ marks: 100, hidden: 200 });
    });
    it('8000 nested pairs: EditorState.create does not throw, 32 render', () => {
        const d = 'a ' + open(8000) + close(8000) + '\n\ntail';
        let s;
        expect(() => { s = stateWithExt(d); }).not.toThrow();
        expect(counts(s).marks).toBe(32);
    }, T);
    it('8000 nested pairs on an already-parsed state, then a cursor move: no throw', () => {
        const d = 'a ' + open(8000) + close(8000) + '\n\ntail';
        const s = withExt(parsed(d));
        expect(counts(s).marks).toBe(32);
        expect(() => s.update({ selection: { anchor: 5 } }).state).not.toThrow();
    }, T);
});

describe('pairing is linear', () => {
    it('40k unmatched closers over a 40k-deep stack of openers builds in < 3 s (was 17 s)', () => {
        const s = parsed('<u>'.repeat(40000) + '</kbd>'.repeat(40000));
        let out;
        const t = ms(() => { out = withExt(s); });
        expect(counts(out)).toEqual({ marks: 0, hidden: 0 });
        expect(t).toBeLessThan(3000);
    }, T);
    it('40k nested matched pairs build in < 3 s and render only the cap', () => {
        const s = parsed('a ' + open(40000) + close(40000) + '\n\ntail');
        let out;
        const t = ms(() => { out = withExt(s); });
        expect(counts(out).marks).toBe(32);
        expect(t).toBeLessThan(3000);
    }, T);
    it('40k flat unclosed openers build in < 3 s', () => {
        const s = parsed('<u>'.repeat(40000));
        const t = ms(() => withExt(s));
        expect(t).toBeLessThan(3000);
    }, T);
});

describe('table cells: one pairing per cell, same cap', () => {
    const cellData = (doc) => {
        const s = parsed(doc);
        let tb = null;
        syntaxTree(s).iterate({ enter: (n) => { if (n.name === 'Table' && !tb) tb = n.node; } });
        return { s, tb };
    };
    it('a 4000-deep cell builds in < 2 s (was 12 s) and renders only the cap', () => {
        const n = 4000;
        const { s, tb } = cellData('| h |\n| - |\n| ' + open(n) + 'x' + close(n) + ' |\n');
        let data;
        const t = ms(() => { data = buildTableData(s, tb, resolveFootnotes(s)); });
        expect(t).toBeLessThan(2000);
        const td = tableDOM(data, { requestMeasure() {} }).querySelector('tbody td');
        expect(td.querySelectorAll('span.cm-html-u')).toHaveLength(32);
        expect(td.textContent).toBe(open(n - 32) + 'x' + close(n - 32));
    }, T);
    it('exactly 32 nested pairs in a cell all render, no source left', () => {
        const { s, tb } = cellData('| h |\n| - |\n| ' + open(32) + 'x' + close(32) + ' |\n');
        const td = tableDOM(buildTableData(s, tb, resolveFootnotes(s)), { requestMeasure() {} }).querySelector('tbody td');
        expect(td.querySelectorAll('span.cm-html-u')).toHaveLength(32);
        expect(td.textContent).toBe('x');
    });
    it('many sibling pairs in one cell still render (cap is depth, not count)', () => {
        const { s, tb } = cellData('| h |\n| - |\n| ' + '<u>x</u> '.repeat(500) + ' |\n');
        const td = tableDOM(buildTableData(s, tb, resolveFootnotes(s)), { requestMeasure() {} }).querySelector('tbody td');
        expect(td.querySelectorAll('span.cm-html-u')).toHaveLength(500);
    });
});

describe('cursor moves are not O(pairs)', () => {
    const lineStarts = (doc, n) => { const out = []; for (let i = 0; i < n; i++) out.push(doc.indexOf('\n', Math.floor((doc.length / n) * i)) + 1); return out; };
    // cursor at line start + 1: before the pair on that line, so it touches nothing -> the touched set never changes
    const perMove = (pairs) => {
        const doc = 'a <kbd>k</kbd> b\n'.repeat(pairs);
        const s0 = withExt(parsed(doc));
        const pos = lineStarts(doc, 12).map((p) => p + 1);
        let s = s0;
        const t = ms(() => { for (const p of pos) s = s.update({ selection: { anchor: p } }).state; });
        return t / pos.length;
    };
    it('moving among untouched lines at 100k pairs costs <= 5x the cost at 5k (or < 1 ms a move)', () => {
        const small = perMove(5000);
        const big = perMove(100000);
        expect(big, `5k: ${small.toFixed(3)} ms/move, 100k: ${big.toFixed(3)} ms/move`).toBeLessThanOrEqual(Math.max(5 * small, 1));
    }, T);
});

describe('abbrTitle', () => {
    it('a title= inside another attribute value is not an attribute: the real title wins', () => {
        expect(abbrTitle('<abbr data-x="a title=evil" title="real">')).toBe('real');
    });
    it('a title= only inside another value gives no title', () => {
        expect(abbrTitle('<abbr data-x="a title=evil">')).toBeNull();
        expect(abbrTitle("<abbr class='x title=\"y\"'>")).toBeNull();
    });
    it('data-title and other names ending in title are not title', () => {
        expect(abbrTitle('<abbr data-title="x">')).toBeNull();
        expect(abbrTitle('<abbr subtitle="x">')).toBeNull();
    });
    it('first title wins; the attribute name is case-insensitive', () => {
        expect(abbrTitle('<abbr title="one" title="two">')).toBe('one');
        expect(abbrTitle("<abbr TITLE='x' title=\"y\">")).toBe('x');
        expect(abbrTitle('<ABBR Title=bare>')).toBe('bare');
    });
    it('quoted, single-quoted, bare and spaced forms still work; none gives null', () => {
        expect(abbrTitle('<abbr title="a b">')).toBe('a b');
        expect(abbrTitle("<abbr title='it\"s'>")).toBe('it"s');
        expect(abbrTitle('<abbr title = tip>')).toBe('tip');
        expect(abbrTitle('<abbr>')).toBeNull();
        expect(abbrTitle('<abbr class="c">')).toBeNull();
    });
    it('entities in the value are decoded with the shared set: &lt;b&gt; &amp; &copy; -> <b> & (c)', () => {
        expect(abbrTitle('<abbr title="&lt;b&gt; &amp; &copy;">')).toBe('<b> & ©');
        expect(abbrTitle('<abbr title="&quot;q&quot; &#65; &#x42;">')).toBe('"q" A B');
    });
    it('decoding is one pass; unknown and semicolon-less entities stay literal', () => {
        expect(abbrTitle('<abbr title="&amp;lt;">')).toBe('&lt;');
        expect(abbrTitle('<abbr title="&bogus; &amp x">')).toBe('&bogus; &amp x');
    });
    it('a 1 MB value comes back whole and fast', () => {
        const v = 'x'.repeat(1e6);
        let r;
        expect(ms(() => { r = abbrTitle(`<abbr title="${v}">`); })).toBeLessThan(500);
        expect(r.length).toBe(1e6);
    });
    it('a decoded title is text only: in a table cell it is a title attribute, no element appears', () => {
        const doc = '| h |\n| - |\n| <abbr title="&lt;b&gt;x&lt;/b&gt;">W</abbr> |\n';
        const s = parsed(doc);
        let tb = null;
        syntaxTree(s).iterate({ enter: (n) => { if (n.name === 'Table' && !tb) tb = n.node; } });
        const td = tableDOM(buildTableData(s, tb, resolveFootnotes(s)), { requestMeasure() {} }).querySelector('tbody td');
        expect(td.querySelector('.cm-html-abbr').getAttribute('title')).toBe('<b>x</b>');
        expect(td.querySelector('b')).toBeNull();
    });
});
