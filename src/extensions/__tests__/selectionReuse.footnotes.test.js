import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { footnotePreview } from '../footnotes';
import { decoSets, flat, mkState, expectSameDecos, countTreeWalks, at } from './selectionReuseHelpers';

// Spec: Docs/internal/selection-reuse-spec.md (B11a). Only footnotePreview is loaded, so the facet holds
// exactly one DecorationSet. Offsets via indexOf. Widgets are identified by their eq key (text, def).

const exts = [markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] }), footnotePreview];
const DOC = [
    'Intro plain text.',
    '',
    'Text[^a] and note^[inline *text*] more[^b].',
    '',
    '> quote ref[^a] and ^[in quote]',
    '',
    'Unresolved[^zz] and [^a] again.',
    '',
    '[^a]: Definition A',
    '[^b]: Def B with ^[inner inline]',
    '',
    'tail plain one',
    'tail plain two',
].join('\n');

const P = {
    plain1: at(DOC, 'Intro plain', 3),
    plain2: at(DOC, 'tail plain one', 3),
    plain3: at(DOC, 'tail plain two', 4),
    refA: at(DOC, '[^a] and note'),          // first ref to a
    refAIn: at(DOC, '[^a] and note', 2),
    refAIn2: at(DOC, '[^a] and note', 3),
    refAEnd: at(DOC, '[^a] and note', 4),
    inlFrom: at(DOC, '^[inline'),
    refB: at(DOC, '[^b].'),
    defA: at(DOC, '[^a]: Definition'),
    defAText: at(DOC, 'Definition A', 3),
    defB: at(DOC, '[^b]: Def B'),
    zz: at(DOC, '[^zz]'),
};
const tick = (state, selection) => state.update({ selection }).state;
const setOf = (state) => { const s = decoSets(state); expect(s).toHaveLength(1); return s[0]; };
const at_ = (state, from) => flat(state).find((d) => d.from === from);

describe('footnote selection reuse: fixture sanity', () => {
    it('cursor away: refs 1 / 2, inline notes, def markers all decorated; unresolved ref is not', () => {
        const s = mkState(DOC, exts, P.plain1);
        expect(at_(s, P.refA).value.spec.widget.text).toBe('1');
        expect(at_(s, P.refA).value.spec.widget.def).toBe(false);
        expect(at_(s, P.inlFrom).value.spec.widget.text).toBe('2');
        expect(at_(s, P.refB).value.spec.widget.text).toBe('3');
        expect(at_(s, P.zz)).toBeUndefined();
        expect(at_(s, P.defA).value.spec.widget.text).toBe('1.');
        expect(at_(s, P.defA).value.spec.widget.def).toBe(true);
        expect(at_(s, P.defA).to).toBe(P.defA + '[^a]:'.length);
    });
});

describe('footnote selection reuse: identity when the touched set is unchanged', () => {
    it('plain-text to plain-text moves return the identical set', () => {
        let s = mkState(DOC, exts, P.plain1);
        const before = setOf(s);
        s = tick(s, { anchor: P.plain2 });
        expect(setOf(s)).toBe(before);
        s = tick(s, { anchor: P.plain3, head: P.plain3 + 4 });
        expect(setOf(s)).toBe(before);
        s = tick(s, { anchor: P.zz + 3 });   // unresolved ref has no decoration to touch
        expect(setOf(s)).toBe(before);
    });

    it('selection set to the very same position still returns the identical set', () => {
        let s = mkState(DOC, exts, P.plain1);
        const before = setOf(s);
        s = tick(s, { anchor: P.plain1 });
        expect(setOf(s)).toBe(before);
    });

    it('moves within one touched ref (both ends) keep the identical set', () => {
        let s = mkState(DOC, exts, P.refAIn);
        const touched = setOf(s);
        for (const pos of [P.refA, P.refAIn2, P.refAEnd, P.refAIn]) {
            s = tick(s, { anchor: pos });
            expect(setOf(s), `pos ${pos}`).toBe(touched);
        }
    });

    it('moves within one touched definition marker keep the identical set', () => {
        let s = mkState(DOC, exts, P.defA + 1);
        const touched = setOf(s);
        s = tick(s, { anchor: P.defA + 3 });
        expect(setOf(s)).toBe(touched);
        s = tick(s, { anchor: P.defA });
        expect(setOf(s)).toBe(touched);
    });

    it('a non-selection, non-doc transaction keeps the identical set', () => {
        const s = mkState(DOC, exts, P.plain1);
        const before = setOf(s);
        expect(setOf(s.update({ scrollIntoView: true }).state)).toBe(before);
    });
});

describe('footnote selection reuse: rebuild when the touched set changes', () => {
    it('ref number: onto the ref hides its widget (raw shown), off brings it back with the same number', () => {
        let s = mkState(DOC, exts, P.plain1);
        const away = setOf(s);
        s = tick(s, { anchor: P.refAIn });
        const on = setOf(s);
        expect(on).not.toBe(away);
        expect(at_(s, P.refA)).toBeUndefined();
        expect(at_(s, P.refB)).toBeTruthy();         // untouched refs keep theirs
        s = tick(s, { anchor: P.plain2 });
        expect(setOf(s)).not.toBe(on);
        expect(at_(s, P.refA).value.spec.widget.text).toBe('1');
    });

    it('inline note: onto it hides its widget, off restores it', () => {
        let s = mkState(DOC, exts, P.plain1);
        s = tick(s, { anchor: P.inlFrom + 3 });
        expect(at_(s, P.inlFrom)).toBeUndefined();
        s = tick(s, { anchor: P.plain1 });
        expect(at_(s, P.inlFrom).value.spec.widget.text).toBe('2');
    });

    it('definition marker: cursor in the marker hides it; cursor in the note text shows it', () => {
        let s = mkState(DOC, exts, P.plain1);
        const away = setOf(s);
        s = tick(s, { anchor: P.defA + 2 });
        expect(setOf(s)).not.toBe(away);
        expect(at_(s, P.defA)).toBeUndefined();
        expect(at_(s, P.defB).value.spec.widget.text).toBe('3.');
        s = tick(s, { anchor: P.defAText });
        expect(at_(s, P.defA).value.spec.widget.text).toBe('1.');
    });

    it('moving straight from one ref onto another changes the set', () => {
        let s = mkState(DOC, exts, P.refAIn);
        const a = setOf(s);
        s = tick(s, { anchor: P.refB + 2 });
        expect(setOf(s)).not.toBe(a);
        expect(at_(s, P.refA)).toBeTruthy();
        expect(at_(s, P.refB)).toBeUndefined();
    });

    it('a second cursor touching another ref changes the set', () => {
        const base = EditorState.create({
            doc: DOC,
            selection: EditorSelection.create([EditorSelection.cursor(P.plain1), EditorSelection.cursor(P.plain2)]),
            extensions: [EditorState.allowMultipleSelections.of(true), exts],
        });
        const before = setOf(base);
        const moved = base.update({
            selection: EditorSelection.create([EditorSelection.cursor(P.plain1), EditorSelection.cursor(P.refB + 2)]),
        }).state;
        expect(setOf(moved)).not.toBe(before);
        expect(at_(moved, P.refB)).toBeUndefined();
    });
});

describe('footnote selection reuse: equivalence with a fresh state at every selection', () => {
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

    it('jumping between far-apart items equals a fresh create', () => {
        let s = mkState(DOC, exts, 0);
        for (const pos of [P.defB + 2, P.refAIn, P.plain3, at(DOC, '> quote ref[^a]', 10), P.inlFrom + 2, P.defAText, P.plain1, DOC.length]) {
            s = tick(s, { anchor: pos });
            expectSameDecos(s, mkState(DOC, exts, pos), `jump ${pos}`);
        }
    });
});

describe('footnote selection reuse: doc and tree changes still rebuild', () => {
    it('inserting a new ref (with its definition) before existing ones renumbers them', () => {
        let s = mkState(DOC, exts, P.plain3);
        const before = setOf(s);
        const end = s.doc.length;
        s = s.update({
            changes: [{ from: 0, insert: 'New[^c] first.\n\n' }, { from: end, insert: '\n\n[^c]: Def C' }],
            selection: { anchor: 0 },
        }).state;
        expect(setOf(s)).not.toBe(before);
        const doc2 = s.doc.toString();
        const num = (sub, off = 0) => at_(s, doc2.indexOf(sub) + off).value.spec.widget.text;
        expect(num('[^c] first')).toBe('1');
        expect(num('[^a] and note')).toBe('2');
        expect(num('[^b].')).toBe('4');
        expect(num('[^c]: Def C')).toBe('1.');
        expect(num('[^a]: Definition')).toBe('2.');
        expectSameDecos(s, mkState(doc2, exts, 0), 'after insert');
    });

    it('after an edit, later cursor moves still match a fresh state (no stale cached ranges)', () => {
        let s = mkState(DOC, exts, P.plain3);
        s = s.update({ changes: { from: 0, insert: 'SHIFT ME\n\n' }, selection: { anchor: s.doc.length } }).state;
        const doc2 = s.doc.toString();
        expectSameDecos(s, mkState(doc2, exts, doc2.length), 'after edit');
        for (const pos of [doc2.indexOf('[^a] and') + 2, 0, doc2.indexOf('[^b]: Def') + 1, doc2.indexOf('^[in quote') + 3, doc2.length]) {
            s = tick(s, { anchor: pos });
            expectSameDecos(s, mkState(doc2, exts, pos), `post-edit cursor ${pos}`);
        }
    });

    it('deleting a definition drops the ref widgets that depended on it', () => {
        let s = mkState(DOC, exts, P.plain1);
        const i = s.doc.toString().indexOf('[^b]: Def B with ^[inner inline]');
        s = s.update({ changes: { from: i, to: i + '[^b]: Def B with ^[inner inline]'.length }, selection: { anchor: 0 } }).state;
        const doc2 = s.doc.toString();
        expect(at_(s, doc2.indexOf('[^b].'))).toBeUndefined();
        expectSameDecos(s, mkState(doc2, exts, 0), 'after delete');
    });
});

describe('footnote selection reuse: no tree walk on cursor-only moves', () => {
    it('selection-only transactions (touched set unchanged or changed) call Tree.iterate zero times', () => {
        const s = mkState(DOC, exts, P.plain1);
        expect(countTreeWalks(s, () => s.update({ changes: { from: 0, insert: 'x' } }).state)).toBeGreaterThan(0);
        expect(countTreeWalks(s, () => {
            let t = s;
            for (const pos of [P.plain2, P.refAIn, P.refAIn2, P.defA + 2, P.defAText, P.inlFrom + 3, P.plain3, 0]) t = tick(t, { anchor: pos });
        })).toBe(0);
    });
});
