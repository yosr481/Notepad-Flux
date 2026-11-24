import { describe, it, expect, vi } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { codeLanguages } from '../codeLanguages';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { livePreview } from '../livePreview';
import { subSupPreview } from '../subSupPreview';
import { htmlInlinePreview } from '../htmlInlinePreview';
import { emojiPreview } from '../emojiPreview';
import { mathPreview } from '../mathPreview';
import { footnotePreview, resolveFootnotes } from '../footnotes';
import { calloutPreview } from '../callouts';
import { mermaidPreview } from '../mermaidPreview';
import { frontMatterPreview } from '../frontMatterPreview';
import { nodesOf } from '../nodeIndex';
import { mkState, flat, at } from './selectionReuseHelpers';

// B11 T3. Spec: Docs/internal/b11-perf-spec.md (T3). mathPreview, footnotes (both walks), callouts and
// mermaidPreview read from nodeIndex instead of walking. Two parts:
//  1. Walk bound. Counts Tree.iterate calls, never time. Classification of a call:
//     - ranged: has `from`/`to` with from > 0 or to < doc.length (T1 touched-block re-decoration): not counted.
//     - container-only: enter() never descends (returns non-false) into a node outside the containers
//       linkDefs.js descends (Document, Blockquote, BulletList, OrderedList, ListItem) + LinkReference: allowed, reported.
//     - full: everything else. Bound is on these.
//     Pinned: fields minus livePreview -> <= 1 full walk per new tree; with livePreview -> <= 2; selection-only -> 0.
//  2. Equivalence guard: decorations + resolveFootnotes output on a rich fixture, snapshotted from the
//     pre-T3 code (HEAD 2a13848). Widgets by class + primitive props; eq is checked separately in the
//     existing suites.

vi.mock('../../utils/math', () => ({
    renderTex: async (tex) => `<svg data-tex="${tex}"/>`,
    isMathLoaded: () => false,
}));
vi.mock('../../utils/mermaid', () => ({ renderMermaid: vi.fn(() => new Promise(() => {})) }));

const lang = markdown({ base: markdownLanguage, codeLanguages, extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] });
const PREVIEWS = [subSupPreview, htmlInlinePreview, emojiPreview, mathPreview, footnotePreview, calloutPreview, mermaidPreview, frontMatterPreview];
const NO_LIVE = [lang, ...PREVIEWS];
const WITH_LIVE = [lang, livePreview, ...PREVIEWS];

const CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem', 'LinkReference']);

// Runs fn, returns { full, containerOnly, ranged } iterate-call counts.
const walks = (state, fn) => {
    const Tree = syntaxTree(state).constructor;
    const orig = Tree.prototype.iterate;
    const calls = [];
    const spy = vi.spyOn(Tree.prototype, 'iterate').mockImplementation(function (spec) {
        const rec = { ranged: (spec.from ?? 0) > 0 || (spec.to ?? Infinity) < this.length, descendedOutside: false };
        calls.push(rec);
        const enter = spec.enter;
        return orig.call(this, { ...spec, enter: (n) => {
            const r = enter(n);
            if (r !== false && !CONTAINERS.has(n.name)) rec.descendedOutside = true;
            return r;
        } });
    });
    try { fn(); } finally { spy.mockRestore(); }
    const rest = calls.filter((c) => !c.ranged);
    return {
        full: rest.filter((c) => c.descendedOutside).length,
        containerOnly: rest.filter((c) => !c.descendedOutside).length,
        ranged: calls.length - rest.length,
    };
};

const BIG = [
    '# Title $x$ ~sub~ ^sup^ :smile: <kbd>k</kbd>',
    '',
    'Ref[^a] and inline^[an inline note] and $m$.',
    '',
    '> [!note] Callout',
    '> body $q$ [^a]',
    '',
    '```mermaid',
    'graph TD; A-->B',
    '```',
    '',
    '```js',
    'const x = 1;',
    '```',
    '',
    '[^a]: The note [^b] and ^[inline in def].',
    '',
    '[^b]: Second.',
    '',
    'tail paragraph',
].join('\n');
const bigDoc = (n) => Array.from({ length: n }, (_, i) => BIG.replace(/\[\^(\w)\]/g, `[^$1${i}]`)).join('\n\n');

// Doc change -> finish the (time-sliced) parse -> adopt it. Counts every iterate on the way and how many
// distinct syntax trees the states saw (1 if the incremental parse finished at once, 2 if it was sliced), so the
// bound is per new tree whatever the parser's timing.
const typeAndSettle = (state, at0) => {
    const trees = new Set();
    const w = walks(state, () => {
        const s = state.update({ changes: { from: at0, insert: 'z' } }).state;
        trees.add(syntaxTree(s));
        ensureSyntaxTree(s, s.doc.length, 5000);
        trees.add(syntaxTree(s.update({}).state));
    });
    return { ...w, trees: trees.size };
};

// Today (HEAD 2a13848) per new tree: no-livePreview set 6 full walks (index, math, resolveFootnotes,
// collectFootnotes, callouts, mermaid); with livePreview 7 full (+ its buildDecorations; its resolveFootnotes
// call is the shared one) and 1 container-only (resolveLinkDefs, reached via resolveReference).
describe('walk bound: doc change', () => {
    const doc = bigDoc(8);
    it('all preview fields except livePreview: at most one full-tree walk per new tree', () => {
        const w = typeAndSettle(mkState(doc, NO_LIVE, 0), at(doc, 'tail paragraph'));
        expect(w.trees).toBeGreaterThanOrEqual(1);
        expect(w.full).toBeLessThanOrEqual(w.trees);
    });
    it('full app set with livePreview: at most two full-tree walks per new tree (livePreview + the index)', () => {
        const w = typeAndSettle(mkState(doc, WITH_LIVE, 0), at(doc, 'tail paragraph'));
        expect(w.full).toBeLessThanOrEqual(2 * w.trees);
    });
    it('resolveLinkDefs is the only other walk allowed: container-only, at most one per new tree', () => {
        const w = typeAndSettle(mkState(doc, WITH_LIVE, 0), at(doc, 'tail paragraph'));
        expect(w.containerOnly).toBeLessThanOrEqual(w.trees);
    });
    it('a second edit stays within the bound (the index is not a once-only freebie)', () => {
        let state = mkState(doc, NO_LIVE, 0);
        state = state.update({ changes: { from: 0, insert: 'y' } }).state;
        ensureSyntaxTree(state, state.doc.length, 5000);
        state = state.update({}).state;
        const w = typeAndSettle(state, state.doc.length);
        expect(w.full).toBeLessThanOrEqual(w.trees);
    });
    for (const [name, ext] of [['mathPreview', mathPreview], ['footnotePreview', footnotePreview], ['calloutPreview', calloutPreview], ['mermaidPreview', mermaidPreview]]) {
        it(`${name} alone: at most one full-tree walk per new tree (footnotePreview's two walks included)`, () => {
            const w = typeAndSettle(mkState(doc, [lang, ext], 0), at(doc, 'tail paragraph'));
            expect(w.full).toBeLessThanOrEqual(w.trees);
        });
    }
    it('nodesOf accepts every name the four modules need', () => {
        const state = mkState(doc, NO_LIVE, 0);
        for (const name of ['InlineMath', 'BlockMath', 'FootnoteDefinition', 'FootnoteReference', 'InlineFootnote', 'Blockquote', 'FencedCode']) {
            expect(() => nodesOf(state, name), name).not.toThrow();
        }
    });
});

describe('walk bound: selection-only moves', () => {
    const doc = bigDoc(8);
    it('no full-tree walk for the full app set (T1 ranged walks are fine)', () => {
        const state = mkState(doc, WITH_LIVE, 0);
        const w = walks(state, () => {
            let s = state;
            for (const pos of [at(doc, 'Ref['), at(doc, '> body'), at(doc, 'graph TD'), at(doc, 'tail paragraph', 3), 0]) {
                s = s.update({ selection: EditorSelection.single(pos) }).state;
            }
        });
        expect(w.full).toBe(0);
    });
    it('no full-tree walk for the preview fields alone', () => {
        const state = mkState(doc, NO_LIVE, 0);
        const w = walks(state, () => {
            let s = state;
            for (const pos of [at(doc, 'Ref['), at(doc, '> body'), at(doc, 'graph TD')]) s = s.update({ selection: EditorSelection.single(pos) }).state;
        });
        expect(w.full).toBe(0);
    });
});

// ---- equivalence ----

const RICH = [
    '---',
    'title: Fixture',
    '---',
    '',
    'Plain $a+b$ inline, $$c^2$$ display, ~sub~ ^sup^ :smile: <mark>m</mark>.',
    '',
    '$$',
    '\\int_0^1 x\\,dx',
    '$$',
    '',
    'Ref one[^one] and inline^[note with $z$ math] and unresolved[^nope] and again[^one].',
    '',
    '| Head [^tbl] | Math |',
    '| --- | --- |',
    '| cell ^[in cell] and [^one] | $t$ and $$u$$ |',
    '',
    '[link text [^one] here](https://example.com)',
    '',
    '[^one]: First note with ref [^two] and ^[inline in def] and $d$.',
    '',
    '    [^nested]: Nested def with [^one] and ^[deep inline].',
    '',
    '[^two]: Second note.',
    '    continued line [^tbl]',
    '',
    '[^tbl]: Table note.',
    '',
    '[^one]: Duplicate definition.',
    '',
    '> [!note] Outer',
    '> outer body $q$ [^two]',
    '> > [!warning]- Inner folded',
    '> > inner body',
    '',
    '- item',
    '  > [!tip] In list',
    '  > tip body',
    '',
    '```mermaid',
    'graph TD; A-->B',
    '```',
    '',
    '- ```mermaid',
    '  flowchart LR; X-->Y',
    '  ```',
    '',
    '```js',
    'const k = `$notmath$`;',
    '```',
    '',
    '~~~mermaid',
    'pie "a" : 1',
    '~~~',
    '',
    '```mermaid',
    'unclosed mermaid',
    '',
    'Display math $$ opened but never',
    'closed here',
    '',
    '$$',
    'unclosed block math',
].join('\n');

const ser = (v) => { try { return JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'function' || x instanceof Node ? undefined : x))); } catch { return String(v); } };
const serDecos = (state) => flat(state).map((d) => {
    const { widget, ...spec } = d.value.spec;
    const w = widget && { cls: widget.constructor.name, props: Object.fromEntries(Object.entries(widget).filter(([, x]) => ['string', 'number', 'boolean'].includes(typeof x))) };
    return { from: d.from, to: d.to, block: !!spec.block, side: spec.side ?? 0, spec: ser(spec), w };
});
const serFootnotes = (state) => {
    const r = resolveFootnotes(state);
    return { labelled: [...r.labelled].map(([k, v]) => [k, ser(v)]), inline: [...r.inline].map(([k, v]) => [k, ser(v)]) };
};

const FIELDS = { subSup: subSupPreview, htmlInline: htmlInlinePreview, emoji: emojiPreview, math: mathPreview, footnote: footnotePreview, callout: calloutPreview, mermaid: mermaidPreview, frontMatter: frontMatterPreview };
const CURSORS = { away: () => RICH.length, inMermaid: () => at(RICH, 'graph TD', 3), inCallout: () => at(RICH, 'outer body', 2), inInner: () => at(RICH, 'inner body', 2), inFootnoteDef: () => at(RICH, 'First note', 3), inTable: () => at(RICH, 'cell ^[', 3), inBlockMath: () => at(RICH, '\\int', 3), inUnclosed: () => at(RICH, 'unclosed block', 3) };

describe('equivalence with pre-T3 output (snapshot)', () => {
    it('fixture sanity: the fields have something to decorate', () => {
        const s = mkState(RICH, NO_LIVE, RICH.length);
        const n = (f) => flat(mkState(RICH, [lang, f], RICH.length)).length;
        for (const [name, f] of Object.entries(FIELDS)) expect(n(f), name).toBeGreaterThan(0);
        expect(serFootnotes(s).labelled.length).toBeGreaterThan(2);
    });
    for (const [cname, pos] of Object.entries(CURSORS)) {
        it(`every field alone, cursor ${cname}`, () => {
            const out = {};
            for (const [name, f] of Object.entries(FIELDS)) out[name] = serDecos(mkState(RICH, [lang, f], pos()));
            expect(out).toMatchSnapshot();
        });
        it(`all fields together, cursor ${cname}`, () => {
            expect(serDecos(mkState(RICH, NO_LIVE, pos()))).toMatchSnapshot();
        });
    }
    it('resolveFootnotes output', () => {
        expect(serFootnotes(mkState(RICH, NO_LIVE, 0))).toMatchSnapshot();
    });
    it('selection-only moves give the same decorations as a fresh state at that cursor', () => {
        let s = mkState(RICH, NO_LIVE, RICH.length);
        for (const k of ['inMermaid', 'inCallout', 'inFootnoteDef', 'inBlockMath', 'away']) {
            s = s.update({ selection: EditorSelection.single(CURSORS[k]()) }).state;
            expect(serDecos(s), k).toEqual(serDecos(mkState(RICH, NO_LIVE, CURSORS[k]())));
        }
    });
});

describe('footnote decorations never nest (HEAD skipped refs/notes inside an inline note)', () => {
    const ranges = (doc) => flat(mkState(doc, [lang, footnotePreview], doc.length)).map((d) => [d.from, d.to]);
    const noneInside = (r) => r.filter(([f, t]) => r.some(([F, T]) => (F !== f || T !== t) && F <= f && t <= T && !(F === f && t === T)));
    it('ref inside an inline note: only the outer note and the definition marker', () => {
        const doc = 'x ^[n [^a] y] z\n\n[^a]: def\n';
        const r = ranges(doc);
        expect(r).toEqual([[at(doc, '^[n'), at(doc, ' z')], [at(doc, '[^a]: def'), at(doc, '[^a]: def', 5)]]);
        expect(noneInside(r)).toEqual([]);
    });
    it('inline note inside an inline note: only the outer note', () => {
        const doc = 'x ^[a ^[b] c] z\n';
        const r = ranges(doc);
        expect(r).toEqual([[at(doc, '^[a'), at(doc, ' z')]]);
        expect(noneInside(r)).toEqual([]);
    });
});
