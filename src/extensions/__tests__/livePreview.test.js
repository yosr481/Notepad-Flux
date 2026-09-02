import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
    livePreview,
    buildDecorations,
    setLivePreviewViewport,
} from '../livePreview';
import { TableWidget } from '../widgets';
import { createEditor } from '../../test/utils';

// GFM parser (tables, strikethrough, task lists) — bare markdown() in test utils
// is CommonMark only, which does not emit a `Table` node.
const gfm = (doc, selection) =>
    EditorState.create({
        doc,
        selection,
        extensions: [markdown({ base: markdownLanguage }), livePreview],
    });

const getField = (state) => state.field(livePreview[0]);

// Count decoration ranges overlapping [from, to).
const countDecos = (field, from, to) => {
    let n = 0;
    field.between(from, to, () => { n++; });
    return n;
};

// Decoration values whose range is EXACTLY [from, to].
const decosAt = (field, from, to) => {
    const out = [];
    field.between(from, to, (f, t, v) => {
        if (f === from && t === to) out.push(v);
    });
    return out;
};

describe('Live Preview Extension — shape', () => {
    it('exports an array whose first element is the decoration StateField', () => {
        expect(Array.isArray(livePreview)).toBe(true);
        // field + highlightPlugin + viewport plugin (+ maybe a viewport field)
        expect(livePreview.length).toBeGreaterThanOrEqual(3);

        const { state } = createEditor('**Bold**', livePreview);
        // livePreview[0] must stay the field that provides decorations.
        const field = state.field(livePreview[0], false);
        expect(field).toBeDefined();
        expect(typeof field.between).toBe('function');
    });

    it('constructs an EditorView without throwing (block decos stay in the field, not a ViewPlugin)', () => {
        const parent = document.createElement('div');
        expect(() => {
            new EditorView({
                state: gfm('intro\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nend'),
                parent,
            });
        }).not.toThrow();
    });
});

describe('Live Preview Extension — viewport-scoped decoration build', () => {
    // Doc with **aa** at offset 0-6 and **zz** at offset 50007-50013.
    const bigDoc = '**aa**\n' + 'x\n'.repeat(25000) + '**zz**\n';
    const FAR = 50007; // start of the far StrongEmphasis

    it('does NOT decorate nodes outside the given range', () => {
        // Cursor at 500: away from both bold spans, but inside the {0,1000} range.
        const state = gfm(bigDoc, { anchor: 500 });
        const field = buildDecorations(state, { from: 0, to: 1000 });

        // In-range **aa** IS decorated (its EmphasisMarks are hidden).
        expect(countDecos(field, 0, 10)).toBeGreaterThan(0);

        // Out-of-range **zz** near offset 50007 is NOT touched.
        expect(countDecos(field, FAR - 5, state.doc.length)).toBe(0);
    });

    it('with no range argument, falls back to a bounded prefix — not the whole doc', () => {
        const state = gfm(bigDoc, { anchor: 500 });
        const field = buildDecorations(state);

        // Prefix content still decorated.
        expect(countDecos(field, 0, 10)).toBeGreaterThan(0);
        // Content ~50k in is beyond the fallback bound → undecorated.
        expect(countDecos(field, FAR - 5, state.doc.length)).toBe(0);
    });

    it('reveals raw syntax for a bold span the cursor is inside, hides it otherwise (in range)', () => {
        const doc = 'hello **world** there';
        // EmphasisMark ranges: 6-8 and 13-15; StrongEmphasis 6-15.
        const full = { from: 0, to: doc.length };

        // Cursor at 0: not touching the span → marks hidden (replace deco present).
        const away = buildDecorations(gfm(doc, { anchor: 0 }), full);
        expect(decosAt(away, 6, 8).length).toBe(1);
        expect(decosAt(away, 13, 15).length).toBe(1);

        // Cursor at 10: inside the span → marks shown (no replace deco).
        const inside = buildDecorations(gfm(doc, { anchor: 10 }), full);
        expect(decosAt(inside, 6, 8).length).toBe(0);
        expect(decosAt(inside, 13, 15).length).toBe(0);
    });

    it('keeps the multi-line table block decoration (one full-span TableWidget replace)', () => {
        const table = '| a | b |\n| - | - |\n| 1 | 2 |';
        const doc = 'intro\n\n' + table + '\n\nend';
        const tFrom = doc.indexOf('| a | b |');
        const tTo = tFrom + table.length; // Table node 7..36
        const full = { from: 0, to: doc.length };

        // Cursor at 0: not touching table → exactly one replace spanning the whole table.
        const collapsed = buildDecorations(gfm(doc, { anchor: 0 }), full);
        const widgets = [];
        collapsed.between(0, doc.length, (f, t, v) => {
            if (v.spec && v.spec.widget instanceof TableWidget) widgets.push([f, t, v]);
        });
        expect(widgets.length).toBe(1);
        expect(widgets[0][0]).toBe(tFrom);
        expect(widgets[0][1]).toBe(tTo);
        expect(widgets[0][2].spec.widget.htmlContent).toContain('<table');

        // Cursor inside the table → no full-span table widget.
        const open = buildDecorations(gfm(doc, { anchor: tFrom + 4 }), full);
        let stillWidget = false;
        open.between(0, doc.length, (f, t, v) => {
            if (f === tFrom && t === tTo && v.spec && v.spec.widget instanceof TableWidget) stillWidget = true;
        });
        expect(stillWidget).toBe(false);
    });

    it('setLivePreviewViewport moves the decorated region for later transactions', () => {
        const parent = document.createElement('div');
        const view = new EditorView({
            state: gfm(bigDoc, { anchor: 500 }),
            parent,
        });

        // Initial: prefix decorated, far span not.
        expect(countDecos(getField(view.state), 0, 10)).toBeGreaterThan(0);
        expect(countDecos(getField(view.state), FAR - 5, view.state.doc.length)).toBe(0);

        // Point the live-preview viewport at the far span, then a normal
        // selection transaction should decorate there instead.
        view.dispatch({ effects: setLivePreviewViewport.of({ from: 49000, to: 51000 }) });
        view.dispatch({ selection: { anchor: 49500 } }); // in new range, not touching **zz**

        expect(countDecos(getField(view.state), FAR - 5, FAR + 12)).toBeGreaterThan(0);
        expect(countDecos(getField(view.state), 0, 10)).toBe(0);

        view.destroy();
    });
});
