import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
    livePreview,
    buildDecorations,
    setLivePreviewViewport,
} from '../livePreview';
import { TableWidget, CheckboxWidget, EntityWidget } from '../widgets';
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

describe('Live Preview Extension — GFM uppercase [X] task checkbox (audit #11)', () => {
    // Pinned: a TaskMarker Lezer node spans EXACTLY the "[x]" / "[X]" / "[ ]"
    // slice (verified with the parser: "- [X] a" -> TaskMarker[2,5]). That
    // range carries one Decoration.replace whose .spec.widget is a
    // CheckboxWidget; `checked` is true for BOTH "[x]" and "[X]", false for "[ ]".
    const marker = (doc) => {
        const from = doc.indexOf('[');
        return { from, to: from + 3 };
    };
    // The checked-state cases put the task on line 2 with { anchor: 0 } on the
    // first line, so the cursor is off the task line entirely. ({ anchor: 0 }
    // on a lone task line would "touch" the ListMark and suppress the widget.)
    const checkboxAt = (field, m) => {
        const vs = decosAt(field, m.from, m.to);
        if (vs.length !== 1 || !vs[0].spec || !(vs[0].spec.widget instanceof CheckboxWidget)) return null;
        return vs[0].spec.widget;
    };

    it('renders "[X]" (uppercase) as a CHECKED CheckboxWidget', () => {
        const doc = 'x\n- [X] a';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), { from: 0, to: doc.length });
        const w = checkboxAt(field, marker(doc));
        expect(w).toBeInstanceOf(CheckboxWidget);
        expect(w.checked).toBe(true);
    });

    it('renders "[x]" (lowercase) as a CHECKED CheckboxWidget (regression guard)', () => {
        const doc = 'x\n- [x] a';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), { from: 0, to: doc.length });
        const w = checkboxAt(field, marker(doc));
        expect(w).toBeInstanceOf(CheckboxWidget);
        expect(w.checked).toBe(true);
    });

    it('renders "[ ]" (empty) as an UNCHECKED CheckboxWidget', () => {
        const doc = 'x\n- [ ] a';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), { from: 0, to: doc.length });
        const w = checkboxAt(field, marker(doc));
        expect(w).toBeInstanceOf(CheckboxWidget);
        expect(w.checked).toBe(false);
    });

    it('reveals the raw "[X]" (no widget) when the cursor is inside the marker', () => {
        // Same cursor-reveal pattern as the bold-span tests above: cursor
        // inside the node -> the replace decoration is gone.
        const doc = '- [X] a';
        const m = marker(doc); // [2,5]
        const field = buildDecorations(gfm(doc, { anchor: m.from + 1 }), { from: 0, to: doc.length });
        expect(decosAt(field, m.from, m.to).length).toBe(0);
    });
});

describe('Live Preview Extension — GFM angle-bracket autolinks keep no literal < > (audit #9)', () => {
    // Verified against the installed @lezer/markdown (GfmAutolink):
    //   "<https://example.com>" ->
    //     Autolink [0,21]
    //       LinkMark [0,1]  "<"
    //       URL      [1,20] "https://example.com"
    //       LinkMark [20,21] ">"
    //   "<user@host>" -> Autolink [0,11] > LinkMark[0,1] "<", URL[1,10], LinkMark[10,11] ">"
    //   Bare "https://example.com" -> a lone URL node whose parent is Paragraph (NOT Link/Autolink).
    //   Normal "[text](http://x)" -> Link > LinkMark "[" "]" "(" ")" + URL; the label text
    //     between the brackets is unwrapped text (no node of its own).
    //
    // Pinned contract for the fix:
    //  - For an Autolink the cursor is NOT touching: the two delimiter LinkMarks
    //    ("<" and ">") each get a bare Decoration.replace({}) (no widget).
    //  - The URL child is NOT hidden — it is the visible link text.
    //  - "cursor touching" = any selection range intersecting [Autolink.from, Autolink.to];
    //    touching reveals BOTH brackets (no decoration on either LinkMark).
    //  - Bare autolinks (no brackets) and normal [t](u) links are unchanged by this.
    const full = (doc) => ({ from: 0, to: doc.length });
    // A bare replace decoration (empty spec, no widget) at an exact range.
    const bareReplacesAt = (field, from, to) =>
        decosAt(field, from, to).filter((v) => v.spec && v.spec.widget === undefined);

    it('1. <https://example.com> with cursor off the line: the "<" (offset 0..1) carries one bare replace', () => {
        const doc = 'x\n<https://example.com>';
        const lt = doc.indexOf('<');            // 2
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        const vs = bareReplacesAt(field, lt, lt + 1);
        expect(vs.length).toBe(1);
        expect(vs[0].spec.widget).toBeUndefined();
    });

    it('2. <https://example.com> with cursor off the line: the ">" (last char) carries one bare replace', () => {
        const doc = 'x\n<https://example.com>';
        const gt = doc.length - 1;              // 22
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        const vs = bareReplacesAt(field, gt, gt + 1);
        expect(vs.length).toBe(1);
        expect(vs[0].spec.widget).toBeUndefined();
    });

    it('3. the URL span itself stays visible — no replace decoration over it', () => {
        const doc = 'x\n<https://example.com>';
        const urlFrom = doc.indexOf('https');   // 3
        const urlTo = doc.length - 1;           // 22
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        // No decoration exactly spanning the URL...
        expect(decosAt(field, urlFrom, urlTo).length).toBe(0);
        // ...and nothing decorating the URL interior (linkPreview is not in this
        // extension set). Stay off the bracket boundaries — RangeSet.between()
        // reports a range that only touches an endpoint.
        expect(countDecos(field, urlFrom + 1, urlTo - 1)).toBe(0);
    });

    it('4. <user@host> email autolink: "<" and ">" hidden, "user@host" not', () => {
        const doc = 'x\n<user@host>';
        const lt = doc.indexOf('<');            // 2
        const gt = doc.length - 1;              // 12
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(bareReplacesAt(field, lt, lt + 1).length).toBe(1);
        expect(bareReplacesAt(field, gt, gt + 1).length).toBe(1);
        // "user@host" between the brackets is untouched (interior only — see note in test 3).
        expect(countDecos(field, lt + 2, gt - 1)).toBe(0);
    });

    it('5. cursor inside the autolink reveals both brackets (no decoration on < or >)', () => {
        const doc = '<https://example.com>';
        // Autolink [0,21]; anchor at 3 is inside the URL, so it intersects the Autolink.
        const field = buildDecorations(gfm(doc, { anchor: 3 }), full(doc));
        expect(decosAt(field, 0, 1).length).toBe(0);
        expect(decosAt(field, doc.length - 1, doc.length).length).toBe(0);
    });

    it('6. bare autolink https://example.com (no brackets) is unchanged — no replace anywhere in it', () => {
        const doc = 'x\nhttps://example.com';
        const urlFrom = doc.indexOf('https');   // 2
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(countDecos(field, urlFrom, doc.length)).toBe(0);
    });

    it('7. normal [text](http://x) link is unchanged — brackets/parens/URL replaced, label text not', () => {
        const doc = 'x\n[text](http://x)';
        // Link [2,18]: LinkMark "[" [2,3], label "text" [3,7], LinkMark "]" [7,8],
        // LinkMark "(" [8,9], URL [9,17], LinkMark ")" [17,18].
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        // Current behaviour pinned: each syntax piece hidden with a bare replace.
        expect(bareReplacesAt(field, 2, 3).length).toBe(1);   // [
        expect(bareReplacesAt(field, 7, 8).length).toBe(1);   // ]
        expect(bareReplacesAt(field, 8, 9).length).toBe(1);   // (
        expect(bareReplacesAt(field, 9, 17).length).toBe(1);  // URL
        expect(bareReplacesAt(field, 17, 18).length).toBe(1); // )
        // The visible "text" label is NOT replaced (interior only — the "[" and "]"
        // replaces end/start on the label boundary and RangeSet.between() reports them).
        expect(decosAt(field, 3, 7).length).toBe(0);
        expect(countDecos(field, 4, 6)).toBe(0);
    });
});

describe('Live Preview Extension — backslash escapes hide only the "\\" (audit #2)', () => {
    // Verified against the installed @lezer/markdown:
    //   "x\n\\*a\\*"  -> Paragraph > Escape[2,4] "\\*", Escape[5,7] "\\*"
    //   "x\n\\\\"     -> Paragraph > Escape[2,4] "\\\\"
    //   "\\a"         -> Paragraph only, NO Escape node ("a" is not escapable)
    // The `*` inside an Escape never becomes an EmphasisMark, so formatting is
    // already suppressed. Only the leading backslash still leaks visually.
    //
    // Pinned contract for the fix:
    //  - For an `Escape` node the cursor is NOT touching: a bare
    //    Decoration.replace({}) (no widget) covers [nodeFrom, nodeFrom+1] — the
    //    backslash ONLY. The escaped char at nodeFrom+1 stays as plain document
    //    text and is NOT covered.
    //  - "\\\\" (escaped backslash): same — first "\\" hidden, second renders.
    //  - "cursor touching" is RANGE-scoped, not line-scoped: predicate is
    //    isCursorTouching(selection, escFrom, escTo) (any selection range
    //    intersecting [Escape.from, Escape.to]). A cursor inside one escape on a
    //    line does NOT reveal a sibling escape elsewhere on the same line.
    //  - "\\a" (non-escapable): no Escape node, no decoration, stays literal.
    const full = (doc) => ({ from: 0, to: doc.length });
    const bareReplacesAt = (field, from, to) =>
        decosAt(field, from, to).filter((v) => v.spec && v.spec.widget === undefined);

    it('cursor off the line: "\\*" -> the "\\" (escFrom..escFrom+1) carries one bare replace', () => {
        const doc = 'x\n\\*a\\*';
        const esc = doc.indexOf('\\'); // 2
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        const vs = bareReplacesAt(field, esc, esc + 1);
        expect(vs.length).toBe(1);
        expect(vs[0].spec.widget).toBeUndefined();
    });

    it('cursor off the line: the escaped "*" at escFrom+1 is NOT covered, and the whole Escape node is not replaced', () => {
        const doc = 'x\n\\*a\\*';
        const esc = doc.indexOf('\\'); // 2
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(decosAt(field, esc + 1, esc + 2).length).toBe(0); // the "*"
        expect(decosAt(field, esc, esc + 2).length).toBe(0);     // not the 2-char node
    });

    it('"\\\\" (escaped backslash): first "\\" hidden, second "\\" not', () => {
        const doc = 'x\n\\\\';
        const esc = doc.indexOf('\\'); // 2  — Escape [2,4]
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(bareReplacesAt(field, esc, esc + 1).length).toBe(1);
        expect(decosAt(field, esc + 1, esc + 2).length).toBe(0);
    });

    it('cursor inside the escape (anchor at escFrom+1) reveals raw "\\*" — no decoration on that escape', () => {
        const doc = 'x\n\\*a\\*';
        const esc = doc.indexOf('\\'); // 2
        const field = buildDecorations(gfm(doc, { anchor: esc + 1 }), full(doc));
        expect(countDecos(field, esc, esc + 2)).toBe(0);
    });

    it('range-scoped, not line-scoped: cursor in the first escape still hides the second escape on the same line', () => {
        const doc = 'x\n\\*a\\*';
        const esc = doc.indexOf('\\');        // 2  — Escape [2,4]
        const esc2 = doc.indexOf('\\', esc + 1); // 5  — Escape [5,7]
        const field = buildDecorations(gfm(doc, { anchor: esc + 1 }), full(doc));
        expect(bareReplacesAt(field, esc2, esc2 + 1).length).toBe(1);
    });

    it('"\\a" (non-escapable char): no Escape node, no decoration anywhere', () => {
        const doc = '\\a';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(countDecos(field, 0, doc.length)).toBe(0);
    });
});

describe('Live Preview Extension — HTML entities decode to their character (audit #3)', () => {
    // Verified against the installed @lezer/markdown:
    //   "x\n&amp;"     -> Paragraph > Entity[2,7]
    //   "&#169;" / "&#x2764;" / "&nbsp;" / "&copy;" -> a single Entity node over the token
    //   "&notareal;"   -> Lezer STILL emits Entity[..] (it does NOT validate against
    //                     the entity table) — the task brief's "no Entity node" was
    //                     wrong; pinned reality below.
    //   "`&amp;`"      -> InlineCode > CodeMark/CodeMark, NO Entity child.
    //   fenced code    -> CodeText, NO Entity child.
    //
    // Pinned contract for the fix:
    //  - For an `Entity` node the cursor is NOT touching that decodes to a real
    //    character: one Decoration.replace({ widget: new EntityWidget(decoded) })
    //    over the whole node range. widget.ch === the decoded string.
    //  - Numeric "&#NN;" / "&#xNN;" decode via String.fromCodePoint(parseInt(...)).
    //  - Named entities decode to exactly their character ("&amp;"->"&", "&copy;"->"©",
    //    "&nbsp;"->U+00A0, "&lt;"->"<", "&gt;"->">").
    //  - An Entity token that is NOT a valid reference ("&notareal;") produces NO
    //    decoration — it stays literal. (Impl note in decisions.md: a detached
    //    <textarea> greedily partial-matches "&not" -> "¬"; the fix must reject
    //    such tokens, e.g. a named-entity allow-map or a "decoded still contains
    //    ';'/letters" guard.)
    //  - Entities inside inline code / fenced code are never wrapped (no Entity
    //    node exists there anyway).
    //  - "cursor touching" is range-scoped: isCursorTouching(selection, from, to).
    //  - The widget renders via textContent only (architect directive): its DOM is
    //    a bare <span class="cm-entity"> with no element children.
    const full = (doc) => ({ from: 0, to: doc.length });
    const entRange = (doc) => {
        const from = doc.indexOf('&');
        return { from, to: doc.indexOf(';', from) + 1 };
    };
    const entityWidgetAt = (field, r) => {
        const vs = decosAt(field, r.from, r.to);
        if (vs.length !== 1) return null;
        const w = vs[0].spec && vs[0].spec.widget;
        return w instanceof EntityWidget ? w : null;
    };
    const anyEntityWidget = (field, doc) => {
        let found = false;
        field.between(0, doc.length, (f, t, v) => {
            if (v.spec && v.spec.widget instanceof EntityWidget) found = true;
        });
        return found;
    };

    it('"&amp;" cursor off -> one Decoration.replace whose widget is an EntityWidget with ch "&"', () => {
        const doc = 'x\n&amp;';
        const r = entRange(doc); // [2,7]
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        const w = entityWidgetAt(field, r);
        expect(w).toBeInstanceOf(EntityWidget);
        expect(w.ch).toBe('&');
    });

    it('"&amp;" widget renders via textContent — bare <span>, no element children, textContent "&"', () => {
        const doc = 'x\n&amp;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        const w = entityWidgetAt(field, entRange(doc));
        const dom = w.toDOM();
        expect(dom.textContent).toBe('&');
        expect(dom.querySelector('*')).toBe(null);
        expect(dom.children.length).toBe(0);
    });

    it('numeric "&#169;" -> ch "©"', () => {
        const doc = 'x\n&#169;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(entityWidgetAt(field, entRange(doc)).ch).toBe('©');
    });

    it('numeric hex "&#x2764;" -> ch "❤"', () => {
        const doc = 'x\n&#x2764;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(entityWidgetAt(field, entRange(doc)).ch).toBe('❤');
    });

    it('"&nbsp;" -> ch " " (non-breaking space)', () => {
        const doc = 'x\n&nbsp;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(entityWidgetAt(field, entRange(doc)).ch).toBe(' ');
    });

    it('"&copy;" -> ch "©"', () => {
        const doc = 'x\n&copy;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(entityWidgetAt(field, entRange(doc)).ch).toBe('©');
    });

    it('"&lt;" and "&gt;" decode to "<" and ">"', () => {
        for (const [tok, ch] of [['&lt;', '<'], ['&gt;', '>']]) {
            const doc = 'x ' + tok + ' y';
            const field = buildDecorations(gfm(doc, { anchor: doc.length }), full(doc));
            expect(entityWidgetAt(field, entRange(doc)).ch).toBe(ch);
        }
    });

    it('invalid "&notareal;" -> NO decoration, stays literal (Lezer emits an Entity node anyway)', () => {
        const doc = 'x\n&notareal;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(countDecos(field, doc.indexOf('&'), doc.length)).toBe(0);
        expect(anyEntityWidget(field, doc)).toBe(false);
    });

    it('"&toString;" (an Object.prototype key, not a real entity) -> NO decoration, stays literal', () => {
        // decodeEntity must use own-property lookup on its allow-map, not `key in map`
        // / `map[key]`, or inherited props (toString/constructor/__proto__/hasOwnProperty)
        // leak through and get rendered as garbage text.
        const doc = 'x\n&toString;';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(countDecos(field, doc.indexOf('&'), doc.length)).toBe(0);
        expect(anyEntityWidget(field, doc)).toBe(false);
    });

    it('entity inside inline code "`&amp;`" is NOT decoded — no EntityWidget', () => {
        const doc = 'x\n`&amp;`';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(anyEntityWidget(field, doc)).toBe(false);
    });

    it('entity inside a fenced code block is NOT decoded — no EntityWidget', () => {
        const doc = '```\n&amp;\n```';
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full(doc));
        expect(anyEntityWidget(field, doc)).toBe(false);
    });

    it('cursor touching the entity reveals raw "&copy;" — no decoration', () => {
        const doc = '&copy;';
        const field = buildDecorations(gfm(doc, { anchor: 2 }), full(doc));
        expect(countDecos(field, 0, doc.length)).toBe(0);
    });
});

describe('Live Preview Extension — GFM table nested in a blockquote (TASK 6 / audit #6)', () => {
    // Verified against the installed @lezer/markdown for
    //   'x\n\n> | a | b |\n> | - | - |\n> | 1 | 2 |\n':
    //     Blockquote [3,38]
    //       QuoteMark [3,4]
    //       Table [5,38]         <-- Table DOES nest under Blockquote
    //         TableHeader [5,14] "| a | b |"
    //         ... (rows 2+ still carry the "> " prefix in the sliced text)
    //   doc.sliceString(Table.from, Table.to) ===
    //     "| a | b |\n> | - | - |\n> | 1 | 2 |"
    //
    // Pinned: the Table range [5,38] carries exactly one Decoration.replace
    // whose .spec.widget is a TableWidget, and (after the #6 fix) that widget's
    // .htmlContent contains "<table" and NOT "cm-table-empty".
    const doc = 'x\n\n> | a | b |\n> | - | - |\n> | 1 | 2 |\n';
    const tFrom = 5;
    const tTo = 38;
    const full = { from: 0, to: doc.length };

    it('the parser nests Table under Blockquote and the slice still has the "> " prefix', () => {
        const state = gfm(doc, { anchor: 0 });
        expect(state.doc.sliceString(tFrom, tTo))
            .toBe('| a | b |\n> | - | - |\n> | 1 | 2 |');
    });

    it('cursor off the table: one TableWidget replace over [5,38] with a real <table>, not "Empty Table"', () => {
        const field = buildDecorations(gfm(doc, { anchor: 0 }), full);
        const widgets = [];
        field.between(0, doc.length, (f, t, v) => {
            if (v.spec && v.spec.widget instanceof TableWidget) widgets.push([f, t, v]);
        });
        expect(widgets.length).toBe(1);
        expect(widgets[0][0]).toBe(tFrom);
        expect(widgets[0][1]).toBe(tTo);
        expect(widgets[0][2].spec.widget.htmlContent).toContain('<table');
        expect(widgets[0][2].spec.widget.htmlContent).not.toContain('cm-table-empty');
        expect(widgets[0][2].spec.widget.htmlContent).not.toContain('Empty Table');
    });
});
