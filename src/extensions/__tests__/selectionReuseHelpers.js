// Shared by selectionReuse.*.test.js (B11a). Not a test file. Reads decorations only through the
// public EditorView.decorations facet, so nothing here depends on how the field is built.
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { expect, vi } from 'vitest';

export const decoSets = (state) => state.facet(EditorView.decorations).filter((d) => typeof d !== 'function');

export const flat = (state) => decoSets(state).flatMap((set) => {
    const out = [];
    for (const it = set.iter(); it.value; it.next()) out.push({ from: it.from, to: it.to, value: it.value });
    return out;
});

export const mkState = (doc, extensions, anchor = 0, head = anchor) => {
    const state = EditorState.create({ doc, selection: { anchor, head }, extensions });
    ensureSyntaxTree(state, doc.length, 5000);
    return state;
};

// Same decorations: from, to, widget class, widget.eq both ways, block/side flags.
export const expectSameDecos = (actual, expected, label = '') => {
    const a = flat(actual), b = flat(expected);
    expect(a.map((d) => [d.from, d.to]), label).toEqual(b.map((d) => [d.from, d.to]));
    a.forEach((d, i) => {
        const w = d.value.spec.widget, x = b[i].value.spec.widget;
        expect(w?.constructor.name, `${label} widget class @${d.from}`).toBe(x?.constructor.name);
        if (w) {
            expect(w.eq(x), `${label} eq @${d.from}`).toBe(true);
            expect(x.eq(w), `${label} eq rev @${d.from}`).toBe(true);
        }
        expect(!!d.value.spec.block, `${label} block @${d.from}`).toBe(!!b[i].value.spec.block);
        expect(d.value.spec.side ?? 0, `${label} side @${d.from}`).toBe(b[i].value.spec.side ?? 0);
    });
};

// Counts Lezer Tree.iterate calls (a tree walk) while fn runs.
export const countTreeWalks = (state, fn) => {
    const Tree = syntaxTree(state).constructor;
    const spy = vi.spyOn(Tree.prototype, 'iterate');
    try { fn(); return spy.mock.calls.length; } finally { spy.mockRestore(); }
};

export const at = (doc, sub, offset = 0) => {
    const i = doc.indexOf(sub);
    if (i < 0) throw new Error('fixture missing ' + sub);
    return i + offset;
};
