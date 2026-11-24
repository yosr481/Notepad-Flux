import { describe, it, expect, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree, forceParsing } from '@codemirror/language';
import { mathSyntax } from '../mathSyntax';
import { mathPreview } from '../mathPreview';
import { decoSets, flat, mkState, expectSameDecos, countTreeWalks, at } from './selectionReuseHelpers';

// Spec: Docs/internal/selection-reuse-spec.md (B11a). Only mathPreview is loaded, so the facet holds
// exactly one DecorationSet. Offsets via indexOf. Pinned: a selection-only transaction that leaves the
// touched-item set unchanged yields the IDENTICAL set (toBe), including tr.selection set to the same place.

vi.mock('../../utils/math', () => ({
    renderTex: async (tex) => `<svg data-tex="${tex}"/>`,
    isMathLoaded: () => false,
}));

const exts = [markdown({ base: markdownLanguage, extensions: [mathSyntax] }), mathPreview];
const DOC = [
    'Intro text here, plain.',
    '',
    'Inline $a+b$ and display $$c^2$$ end.',
    '',
    '$$',
    '\\int_0^1 x\\,dx',
    '$$',
    '',
    '> quote $q$ text',
    '> $$',
    '> z',
    '> $$',
    '',
    'second $y$ line',
    '',
    'tail plain text one',
    'tail plain text two',
].join('\n');

const P = {
    plain1: at(DOC, 'Intro text', 3),
    plain2: at(DOC, 'tail plain text one', 3),
    plain3: at(DOC, 'tail plain text two', 5),
    inlineFrom: at(DOC, '$a+b$'),
    inlineIn: at(DOC, '$a+b$', 2),
    inlineIn2: at(DOC, '$a+b$', 3),
    inlineTo: at(DOC, '$a+b$', 5),
    dispFrom: at(DOC, '$$c^2$$'),
    blockLine: at(DOC, '\\int', 3),
    blockLine2: at(DOC, '\\int', 6),
    yFrom: at(DOC, '$y$'),
};
const tick = (state, selection) => state.update({ selection }).state;
const setOf = (state) => { const s = decoSets(state); expect(s).toHaveLength(1); return s[0]; };
const kinds = (state) => flat(state).map((d) => d.value.spec.widget.kind);

describe('math selection reuse: fixture sanity', () => {
    it('cursor away: inline, display and block widgets, plus the quote ones, all present', () => {
        const s = mkState(DOC, exts, P.plain1);
        const k = kinds(s);
        expect(k.filter((x) => x === 'inline')).toHaveLength(3);   // a+b, q, y
        expect(k.filter((x) => x === 'display')).toHaveLength(1);
        expect(k.filter((x) => x === 'block')).toHaveLength(2);    // top-level + in blockquote
        expect(k).not.toContain('preview');
    });
});

describe('math selection reuse: identity when the touched set is unchanged', () => {
    it('plain-text to plain-text moves return the identical set', () => {
        let s = mkState(DOC, exts, P.plain1);
        const before = setOf(s);
        s = tick(s, { anchor: P.plain2 });
        expect(setOf(s)).toBe(before);
        s = tick(s, { anchor: P.plain3, head: P.plain3 + 4 });
        expect(setOf(s)).toBe(before);
        s = tick(s, { anchor: 0 });
        expect(setOf(s)).toBe(before);
    });

    it('selection set to the very same position still returns the identical set', () => {
        let s = mkState(DOC, exts, P.plain1);
        const before = setOf(s);
        s = tick(s, { anchor: P.plain1 });
        expect(setOf(s)).toBe(before);
    });

    it('moves within one touched inline item (incl. both ends) keep the identical set', () => {
        let s = mkState(DOC, exts, P.inlineIn);
        const touched = setOf(s);
        for (const pos of [P.inlineFrom, P.inlineIn2, P.inlineTo, P.inlineIn]) {
            s = tick(s, { anchor: pos });
            expect(setOf(s), `pos ${pos}`).toBe(touched);
        }
        s = tick(s, { anchor: P.inlineFrom, head: P.inlineTo });
        expect(setOf(s)).toBe(touched);
    });

    it('moves between two lines of one touched block keep the identical set', () => {
        let s = mkState(DOC, exts, P.blockLine);
        const touched = setOf(s);
        s = tick(s, { anchor: P.blockLine2 });
        expect(setOf(s)).toBe(touched);
        s = tick(s, { anchor: at(DOC, '$$\n\\int') + 1 });
        expect(setOf(s)).toBe(touched);
    });

    it('a non-selection, non-doc transaction keeps the identical set', () => {
        const s = mkState(DOC, exts, P.plain1);
        const before = setOf(s);
        expect(setOf(s.update({ scrollIntoView: true }).state)).toBe(before);
    });
});

describe('math selection reuse: rebuild when the touched set changes', () => {
    it('inline: onto the item gives a new set without its widget; off restores it', () => {
        let s = mkState(DOC, exts, P.plain1);
        const away = setOf(s);
        expect(flat(s).some((d) => d.from === P.inlineFrom && d.to === P.inlineTo)).toBe(true);
        s = tick(s, { anchor: P.inlineIn });
        const on = setOf(s);
        expect(on).not.toBe(away);
        expect(flat(s).some((d) => d.from === P.inlineFrom)).toBe(false);
        s = tick(s, { anchor: P.plain2 });
        expect(setOf(s)).not.toBe(on);
        const w = flat(s).find((d) => d.from === P.inlineFrom);
        expect(w.to).toBe(P.inlineTo);
        expect(w.value.spec.widget.tex).toBe('a+b');
        expect(w.value.spec.widget.kind).toBe('inline');
    });

    it('moving from one inline item straight onto another changes the set', () => {
        let s = mkState(DOC, exts, P.inlineIn);
        const a = setOf(s);
        s = tick(s, { anchor: P.yFrom + 1 });
        expect(setOf(s)).not.toBe(a);
        expect(flat(s).some((d) => d.from === P.inlineFrom)).toBe(true);
        expect(flat(s).some((d) => d.from === P.yFrom)).toBe(false);
    });

    it('block: untouched is a whole-line block replace; touched is a "preview" widget at the end', () => {
        let s = mkState(DOC, exts, P.plain1);
        const from = at(DOC, '$$\n\\int'), to = at(DOC, '\\int_0^1 x\\,dx\n$$') + '\\int_0^1 x\\,dx\n$$'.length;
        const closed = flat(s).find((d) => d.from === from);
        expect(closed.to).toBe(to);
        expect(closed.value.spec.widget.kind).toBe('block');
        expect(closed.value.spec.block).toBe(true);
        s = tick(s, { anchor: P.blockLine });
        const open = flat(s).find((d) => d.value.spec.widget?.kind === 'preview' && d.from === to);
        expect(open).toBeTruthy();
        expect(open.from).toBe(open.to);
        expect(open.value.spec.widget.tex.trim()).toBe('\\int_0^1 x\\,dx');
        expect(flat(s).some((d) => d.from === from && d.value.spec.widget.kind === 'block')).toBe(false);
        s = tick(s, { anchor: P.plain1 });
        expect(flat(s).find((d) => d.from === from).value.spec.widget.kind).toBe('block');
    });

    it('a second cursor touching another item changes the set', () => {
        const base = EditorState.create({
            doc: DOC,
            selection: EditorSelection.create([EditorSelection.cursor(P.plain1), EditorSelection.cursor(P.plain2)]),
            extensions: [EditorState.allowMultipleSelections.of(true), exts],
        });
        const before = setOf(base);
        const moved = base.update({
            selection: EditorSelection.create([EditorSelection.cursor(P.plain1), EditorSelection.cursor(P.inlineIn)]),
        }).state;
        expect(setOf(moved)).not.toBe(before);
        expect(flat(moved).some((d) => d.from === P.inlineFrom)).toBe(false);
    });
});

describe('math selection reuse: equivalence with a fresh state at every selection', () => {
    it('forward then backward cursor walk, chained, equals a fresh create at each position', () => {
        let s = mkState(DOC, exts, 0);
        const order = [...Array(DOC.length + 1).keys()];
        for (const pos of [...order, ...order.reverse()]) {
            s = tick(s, { anchor: pos });
            expectSameDecos(s, mkState(DOC, exts, pos), `cursor ${pos}`);
        }
    });

    it('range selections (chained) equal a fresh create', () => {
        let s = mkState(DOC, exts, 0);
        for (let i = 0; i <= DOC.length; i += 1) {
            const head = Math.min(i + 5, DOC.length);
            s = tick(s, { anchor: i, head });
            expectSameDecos(s, mkState(DOC, exts, i, head), `range ${i}-${head}`);
        }
    });

    it('jumping between far-apart items (not adjacent steps) equals a fresh create', () => {
        let s = mkState(DOC, exts, 0);
        for (const pos of [P.yFrom + 1, P.inlineIn, P.blockLine, P.plain3, P.dispFrom + 3, at(DOC, '> z'), P.plain1, DOC.length]) {
            s = tick(s, { anchor: pos });
            expectSameDecos(s, mkState(DOC, exts, pos), `jump ${pos}`);
        }
    });
});

describe('math selection reuse: doc and tree changes still rebuild', () => {
    it('editing math source updates the widget (cursor away)', () => {
        let s = mkState(DOC, exts, P.plain3);
        const before = setOf(s);
        const i = at(DOC, 'a+b');
        s = s.update({ changes: { from: i, to: i + 3, insert: 'm*n' }, selection: { anchor: s.doc.length } }).state;
        expect(setOf(s)).not.toBe(before);
        expect(flat(s).find((d) => d.value.spec.widget.tex === 'm*n')).toBeTruthy();
        expect(flat(s).find((d) => d.value.spec.widget.tex === 'a+b')).toBeUndefined();
    });

    it('inserting text before shifts ranges; later cursor moves still match a fresh state', () => {
        let s = mkState(DOC, exts, P.plain3);
        s = s.update({ changes: { from: 0, insert: 'NEW LINE\n\n' }, selection: { anchor: s.doc.length } }).state;
        const doc2 = s.doc.toString();
        expectSameDecos(s, mkState(doc2, exts, doc2.length), 'after edit');
        const inl = doc2.indexOf('$a+b$');
        for (const pos of [inl + 2, 0, doc2.indexOf('$y$') + 1, doc2.length]) {
            s = tick(s, { anchor: pos });
            expectSameDecos(s, mkState(doc2, exts, pos), `post-edit cursor ${pos}`);
        }
    });

    it('typing a new math item adds its widget; deleting one removes it', () => {
        let s = mkState(DOC, exts, P.plain1);
        const n0 = flat(s).length;
        s = s.update({ changes: { from: P.plain1, insert: ' $new$ ' }, selection: { anchor: 0 } }).state;
        expect(flat(s)).toHaveLength(n0 + 1);
        const i = s.doc.toString().indexOf('$y$');
        s = s.update({ changes: { from: i, to: i + 3 }, selection: { anchor: 0 } }).state;
        expect(flat(s)).toHaveLength(n0);
    });

    it('a syntax-tree-only change (time-sliced parse completing) rebuilds', () => {
        const filler = Array.from({ length: 30000 }, (_, i) => `- item **${i}** text with \`code\` and [link](http://x/${i})`).join('\n');
        const doc = filler + '\n\nlate $late$ math\n';
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const view = new EditorView({
            state: EditorState.create({ doc, selection: { anchor: 0 }, extensions: exts }),
            parent,
        });
        try {
            const treeBefore = syntaxTree(view.state);
            const before = setOf(view.state);
            // No "late math absent before" assertion: how far the first parse gets is load-dependent.
            expect(forceParsing(view, view.state.doc.length, 30000)).toBe(true);
            expect(syntaxTree(view.state)).not.toBe(treeBefore);
            expect(setOf(view.state)).not.toBe(before);
            expect(flat(view.state).some((d) => d.value.spec.widget?.tex === 'late')).toBe(true);
        } finally { view.destroy(); }
    });
});

describe('math selection reuse: no tree walk on cursor-only moves', () => {
    it('selection-only transactions (touched set unchanged or changed) call Tree.iterate zero times', () => {
        const s = mkState(DOC, exts, P.plain1);
        // Precondition: a doc change does walk the tree, so the counter is live.
        expect(countTreeWalks(s, () => s.update({ changes: { from: 0, insert: 'x' } }).state)).toBeGreaterThan(0);
        expect(countTreeWalks(s, () => {
            let t = s;
            for (const pos of [P.plain2, P.inlineIn, P.inlineIn2, P.blockLine, P.plain3, P.yFrom + 1, 0]) t = tick(t, { anchor: pos });
        })).toBe(0);
    });
});
