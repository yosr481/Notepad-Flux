import { describe, it, expect, vi } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { codeLanguages } from '../codeLanguages';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { livePreview, buildDecorations } from '../livePreview';
import { isCursorTouching } from '../selection';
import { mkState, expectSameDecos, at } from './selectionReuseHelpers';

// T1 (Docs/internal/b11-perf-spec.md): a selection-only transaction re-decorates only the top-level blocks
// (children of Document) touched, inclusive ends, by the old or the new selection. Pinned:
//  - output == fresh buildDecorations(newState) (expectSameDecos), for every move;
//  - perf gate = Tree.iterate arguments, never wall-clock: every iterate call during the update has numeric
//    from/to lying inside ONE touched block; no touched block -> zero iterate calls;
//  - doc change / tree change: full rebuild (iterate over the whole doc is allowed there).

vi.mock('../../utils/math', () => ({
    renderTex: async (tex) => `<svg data-tex="${tex}"/>`,
    isMathLoaded: () => false,
}));

const exts = [
    markdown({
        base: markdownLanguage,
        codeLanguages,
        extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax],
    }),
    livePreview,
];

const DOC = [
    '# ATX heading',                                   // 0
    '',
    'Setext title',
    '============',
    '',
    'Para with *em* and **strong *nested em* text** and ~~gone~~ and `code` &amp; \\* esc.',
    '',
    'Links: [text](http://example.com/a), [refd][ref], [ref] and <http://auto.example> ok.',
    '',
    '[ref]: http://example.com "Title"',
    '',
    '- bullet one',
    '- bullet two',
    '  - nested bullet',
    '',
    '1. first',
    '2. second',
    '3. third',
    '',
    '- [ ] todo item',
    '- [x] done item',
    '',
    '---',
    '',
    '> quote line',
    '> - quoted item',
    '> - quoted item two',
    '',
    '```js',
    'let a = 1;',
    '```',
    '',
    '| h1 | h2 |',
    '| --- | --- |',
    '| c1 | c2 |',
    '',
    'Inline math $a+b$ here.',
    '',
    '$$',
    'c^2',
    '$$',
    '',
    'last paragraph',
].join('\n');

const P = {
    start: 0,
    end: DOC.length,
    atx: at(DOC, 'ATX', 1),
    setext: at(DOC, 'Setext', 2),
    em: at(DOC, 'em*', 1),
    strong: at(DOC, 'strong *nested', 2),
    nestedEm: at(DOC, 'nested em', 2),
    strike: at(DOC, 'gone', 1),
    code: at(DOC, '`code`', 2),
    entity: at(DOC, '&amp;', 2),
    escape: at(DOC, '\\*', 1),
    link: at(DOC, '[text]', 2),
    refLink: at(DOC, '[refd]', 2),
    autolink: at(DOC, 'auto.example', 2),
    def: at(DOC, '[ref]: http', 2),
    bullet: at(DOC, 'bullet one', 2),
    nestedBullet: at(DOC, 'nested bullet', 2),
    ordered: at(DOC, 'second', 2),
    ordered3: at(DOC, 'third', 2),
    task: at(DOC, 'todo item', 2),
    taskDone: at(DOC, 'done item', 2),
    hr: at(DOC, '---\n\n> quote', 1),
    quote: at(DOC, 'quote line', 2),
    quoteList: at(DOC, 'quoted item two', 2),
    fence: at(DOC, 'let a', 2),
    table: at(DOC, 'c1', 1),
    inlineMath: at(DOC, '$a+b$', 2),
    blockMath: at(DOC, 'c^2', 1),
    last: at(DOC, 'last paragraph', 3),
    blank1: at(DOC, '============\n\n', 13),   // blank line between setext and para
    blank2: at(DOC, '- [ ] todo', -2),          // blank line before task list
};

// ---- helpers ----
const sel = (...rs) => EditorSelection.create(rs.map((r) => (Array.isArray(r) ? EditorSelection.range(r[0], r[1]) : EditorSelection.cursor(r))));
const blocksOf = (state) => {
    const out = [];
    for (let n = syntaxTree(state).topNode.firstChild; n; n = n.nextSibling) out.push({ from: n.from, to: n.to });
    return out;
};
// touched = inclusive overlap with the block widened to whole lines (indented blocks reveal from column 0)
const touchedBlocks = (state, ...selections) =>
    blocksOf(state)
        .map((b) => ({ from: state.doc.lineAt(b.from).from, to: state.doc.lineAt(b.to).to }))
        .filter((b) => selections.some((s) => isCursorTouching(s, b.from, b.to)));

// Runs the selection-only update, spies Tree.iterate with arguments.
const move = (state, selection) => {
    const Tree = syntaxTree(state).constructor;
    const spy = vi.spyOn(Tree.prototype, 'iterate');
    let next;
    try { next = state.update({ selection }).state; } finally { /* restore below */ }
    const calls = spy.mock.calls.map((c) => ({ from: c[0]?.from, to: c[0]?.to }));
    spy.mockRestore();
    return { next, calls, touched: touchedBlocks(state, state.selection, next.selection) };
};

const check = (state, selection, label = '') => {
    const { next, calls, touched } = move(state, selection);
    expect(next.doc.eq(state.doc), `${label} doc unchanged`).toBe(true);
    expect(syntaxTree(next), `${label} same tree`).toBe(syntaxTree(state));
    expectSameDecos(next, mkFresh(next), label);
    // walk bound
    if (touched.length === 0) expect(calls, `${label} no iterate when nothing touched`).toHaveLength(0);
    for (const c of calls) {
        expect(typeof c.from, `${label} iterate has numeric from`).toBe('number');
        expect(typeof c.to, `${label} iterate has numeric to`).toBe('number');
        const ok = touched.some((b) => c.from >= b.from && c.to <= b.to);
        expect(ok, `${label} iterate [${c.from},${c.to}] inside a touched block ${JSON.stringify(touched)}`).toBe(true);
    }
    return next;
};

// reference: a state whose only decorations are a fresh buildDecorations(next)
const mkFresh = (next) => EditorState.create({ doc: next.doc, extensions: [EditorView.decorations.of(buildDecorations(next))] });

describe('fixture sanity', () => {
    const s = mkState(DOC, exts, P.last);
    it('has the expected top-level blocks and decorations', () => {
        const names = [];
        for (let n = syntaxTree(s).topNode.firstChild; n; n = n.nextSibling) names.push(n.name);
        for (const k of ['ATXHeading1', 'SetextHeading1', 'Paragraph', 'LinkReference', 'BulletList', 'OrderedList',
            'HorizontalRule', 'Blockquote', 'FencedCode', 'Table']) expect(names, k).toContain(k);
        expect(blocksOf(s).length).toBeGreaterThanOrEqual(15);
    });
    it('every probe position is a real offset', () => {
        for (const [k, v] of Object.entries(P)) expect(v, k).toBeGreaterThanOrEqual(0);
    });
});

const into = (name, from, to) => it(`${name}: cursor moves ${from} -> ${to}`, () => {
    const s = mkState(DOC, exts, P[from]);
    check(s, sel(P[to]), `${from}->${to}`);
    check(mkState(DOC, exts, P[to]), sel(P[from]), `${to}->${from}`);
});

describe('single cursor, into / out of / between constructs', () => {
    const far = 'last';
    for (const k of ['atx', 'setext', 'em', 'strong', 'nestedEm', 'strike', 'code', 'entity', 'escape', 'link',
        'refLink', 'autolink', 'def', 'bullet', 'nestedBullet', 'ordered', 'ordered3', 'task', 'taskDone', 'hr',
        'quote', 'quoteList', 'fence', 'table', 'inlineMath', 'blockMath']) into(k, far, k);
    // between: same block and neighbouring blocks
    into('em/strong in one paragraph', 'em', 'strong');
    into('strong/strike in one paragraph', 'strong', 'strike');
    into('link/refLink', 'link', 'refLink');
    into('ordered items', 'ordered', 'ordered3');
    into('bullet/nestedBullet', 'bullet', 'nestedBullet');
    into('task/taskDone', 'task', 'taskDone');
    into('quote/quoteList', 'quote', 'quoteList');
    into('table <-> fence', 'table', 'fence');
    into('inline math <-> block math', 'inlineMath', 'blockMath');
    into('ordered list <-> bullet list', 'ordered', 'bullet');
    into('atx <-> setext', 'atx', 'setext');
});

describe('boundaries and blank lines', () => {
    it('doc start <-> doc end', () => {
        check(mkState(DOC, exts, P.start), sel(P.end), 'start->end');
        check(mkState(DOC, exts, P.end), sel(P.start), 'end->start');
    });
    it('cursor exactly at a block from and to (inclusive ends touch)', () => {
        const s = mkState(DOC, exts, P.last);
        for (const b of blocksOf(s)) {
            check(s, sel(b.from), `from ${b.from}`);
            check(s, sel(b.to), `to ${b.to}`);
        }
    });
    it('every offset of the doc, from a fixed origin (equivalence + walk bound)', () => {
        const s = mkState(DOC, exts, P.em);
        for (let i = 0; i <= DOC.length; i += 3) check(s, sel(i), `->${i}`);
    });
    it('blank line (touching nothing) to blank line: no iterate at all', () => {
        const a = at(DOC, '============\n\n', 13), b = at(DOC, 'ok.\n\n[ref]', 4);
        const s = mkState(DOC, exts, a);
        expect(touchedBlocks(s, s.selection, sel(b))).toHaveLength(0);
        const { calls, next } = move(s, sel(b));
        expect(calls).toHaveLength(0);
        expectSameDecos(next, mkFresh(next));
    });
    it('blank line -> block and block -> blank line', () => {
        const blank = at(DOC, '============\n\n', 13);
        check(mkState(DOC, exts, blank), sel(P.em), 'blank->em');
        check(mkState(DOC, exts, P.em), sel(blank), 'em->blank');
    });
    it('selection set to the very same place', () => {
        const s = mkState(DOC, exts, P.strong);
        check(s, sel(P.strong), 'same');
    });
});

describe('multi-range and spanning selections', () => {
    it('two cursors in different blocks, then moved, then one dropped', () => {
        let s = mkState(DOC, exts, P.last);
        s = check(s, sel(P.em, P.link), 'two cursors');
        s = check(s, sel(P.strong, P.table), 'moved both');
        s = check(s, sel(P.table), 'dropped one');
        check(s, sel(P.atx, P.ordered, P.fence, P.last), 'four cursors');
    });
    it('range spanning several blocks', () => {
        const s = mkState(DOC, exts, P.last);
        const r = check(s, sel([P.setext, P.bullet]), 'span');
        check(r, sel([P.hr, P.fence]), 'span moved');
        check(r, sel(P.last), 'span collapsed away');
    });
    it('range shrinking and growing across a block boundary', () => {
        let s = mkState(DOC, exts, P.last);
        s = check(s, sel([P.em, P.link]), 'grow');
        s = check(s, sel([P.em, P.refLink]), 'grow more');
        s = check(s, sel([P.em, P.strike]), 'shrink');
        s = check(s, sel([P.em, P.em + 2]), 'shrink to one block');
    });
    it('select-all then collapse', () => {
        let s = mkState(DOC, exts, P.em);
        s = check(s, sel([0, DOC.length]), 'all');
        check(s, sel(P.last), 'collapse');
    });
});

describe('stateful chain', () => {
    it('equivalence after every step of a long walk (no drift)', () => {
        let s = mkState(DOC, exts, 0);
        const order = Object.values(P);
        const walk = [...order, ...order.slice().reverse(), ...order.filter((_, i) => i % 2)];
        walk.forEach((p, i) => { s = check(s, sel(p), `step ${i} @${p}`); });
        s = check(s, sel(P.em, P.table), 'multi');
        s = check(s, sel(P.last), 'back');
    });
});

describe('indented top-level blocks', () => {
    it('cursor at column 0 of an indented heading/setext/HR/quote/fence matches a fresh build', () => {
        const D = 'para\n\n   # Head\n\n   Setext\n   ===\n\n  ---\n\n  > quote\n\n   ```js\n   code\n   ```\n\nlast';
        const starts = [];
        let off = 0;
        for (const l of D.split('\n')) { if (/^ {1,3}\S/.test(l)) starts.push(off); off += l.length + 1; }
        expect(starts.length).toBeGreaterThanOrEqual(6);
        const far = D.length;
        for (const p of starts) {
            check(mkState(D, exts, far), sel(p), `far->${p}`);
            check(mkState(D, exts, p), sel(far), `${p}->far`);
            check(mkState(D, exts, p), sel(p + 1), `${p}->${p + 1}`);
        }
        let s = mkState(D, exts, far);
        for (const p of [...starts, ...starts.slice().reverse()]) s = check(s, sel(p), `walk ${p}`);
    });
});

describe('line-widened adjacency and far-apart ranges', () => {
    it('adjacent indented blocks (no blank line) and far-apart multi-range keep untouched blocks decorated', () => {
        const D = '  # H1\n  > q\n   ---\n   ```js\n   x\n   ```\n  # H2\n\n*a* **b**\n\n*c* ~~d~~\n\n   # H3\n  > q2';
        const far = D.length;
        const lineStarts = []; let off = 0;
        for (const l of D.split('\n')) { lineStarts.push(off, off + l.length); off += l.length + 1; }
        for (const p of lineStarts) {
            check(mkState(D, exts, far), sel(p), `adj far->${p}`);
            check(mkState(D, exts, p), sel(far), `adj ${p}->far`);
        }
        const mid = D.indexOf('*c*');
        check(mkState(D, exts, mid), sel(0, far), 'multi far apart');
        check(mkState(D, exts, mid), sel(2, far - 1), 'multi far apart 2');
        check(mkState(D, exts, 0), sel(2, far - 1), 'multi from start');
    });
});

describe('full rebuild paths unchanged', () => {
    it('doc change gives fresh decorations', () => {
        const s = mkState(DOC, exts, P.em);
        const at0 = at(DOC, 'last paragraph');
        const n = s.update({ changes: { from: at0, insert: '**x** ' }, selection: { anchor: P.em } }).state;
        expectSameDecos(n, mkFresh(n));
    });
    it('doc change may walk the whole tree (not bound to touched blocks)', () => {
        const s = mkState(DOC, exts, P.em);
        const Tree = syntaxTree(s).constructor;
        const spy = vi.spyOn(Tree.prototype, 'iterate');
        s.update({ changes: { from: 0, insert: 'x' } }).state;
        const whole = spy.mock.calls.some((c) => c[0]?.from === 0 && c[0]?.to >= DOC.length);
        spy.mockRestore();
        expect(whole).toBe(true);
    });
});
