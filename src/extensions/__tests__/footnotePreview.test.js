import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { mathPreview } from '../mathPreview';
import { livePreview } from '../livePreview';
import { linkClickHandler } from '../linkHandler';
import { footnotePreview, footnoteTooltipText, footnoteJump } from '../footnotes';

// Spec: Docs/internal/footnotes-spec.md ("Editor behaviour (footnotePreview)").
// Offsets come from doc.indexOf(unique substring), never counted by hand.
// Pinned choices (spec silent):
//  - footnoteTooltipText(state, pos): non-null when from <= pos < to of a resolved ref / inline note
//    (pos === to is NOT pinned); null elsewhere, for unresolved refs and for definitions.
//  - footnoteJump(view, pos): ref -> selection at defFrom + marker + leading spaces (start of note
//    text); definition marker (from <= pos < markEnd) -> first ref `from`; else false, selection untouched.
//  - Ctrl/Cmd mousedown on a widget calls footnoteJump; a plain mousedown on a ref/inline widget puts
//    the cursor at from + 2.

const views = [];
const mkView = (doc, anchor = doc.length, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor, head },
            extensions: [
                markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] }),
                livePreview, mathPreview, footnotePreview,
            ],
        }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};
const stateOf = (doc) => {
    const state = EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] })],
    });
    ensureSyntaxTree(state, doc.length, 5000);
    return state;
};
const qa = (v, sel) => [...v.dom.querySelectorAll(sel)];
const q = (v, sel) => v.dom.querySelector(sel);
const mouse = (el, init = {}) =>
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...init }));

afterEach(() => { while (views.length) views.pop().destroy(); });

const DOC = 'See[^a] and^[inl].\n\n[^a]: note text\n\ntail';
const END = DOC.length; // cursor in "tail": touches nothing

describe('footnotePreview: references', () => {
    it('cursor outside: [^a] is replaced by sup.cm-footnote-ref showing its number', () => {
        const v = mkView(DOC, END);
        const refs = qa(v, 'sup.cm-footnote-ref');
        expect(refs.map((r) => r.textContent)).toEqual(['1', '2']); // [^a] = 1, inline = 2
        expect(v.dom.textContent).not.toContain('[^a]');
        expect(v.dom.textContent).not.toContain('^[inl]');
    });

    it('widgets carry dir="ltr"', () => {
        const v = mkView(DOC, END);
        for (const el of qa(v, '.cm-footnote-ref, .cm-footnote-def')) expect(el.getAttribute('dir')).toBe('ltr');
        expect(qa(v, '.cm-footnote-def').length).toBe(1);
    });

    it('cursor strictly inside the reference: raw text, no widget for it', () => {
        const from = DOC.indexOf('[^a]');
        const v = mkView(DOC, from + 2);
        expect(v.dom.textContent).toContain('[^a]');
        expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent)).toEqual(['2']); // only inline left
    });

    it('cursor touching either end counts as inside', () => {
        const from = DOC.indexOf('[^a]');
        for (const pos of [from, from + 4]) {
            const v = mkView(DOC, pos);
            expect(v.dom.textContent, `pos ${pos}`).toContain('[^a]');
            expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent), `pos ${pos}`).toEqual(['2']);
        }
    });

    it('a selection overlapping the reference shows raw; one elsewhere keeps the widget', () => {
        const from = DOC.indexOf('[^a]');
        const over = mkView(DOC, from - 2, from + 2);
        expect(over.dom.textContent).toContain('[^a]');
        const elsewhere = mkView(DOC, END - 4, END);
        expect(elsewhere.dom.textContent).not.toContain('[^a]');
    });

    it('unresolved reference: raw text, no widget', () => {
        const v = mkView('See[^zz] here\n\ntail');
        expect(v.dom.textContent).toContain('[^zz]');
        expect(q(v, '.cm-footnote-ref')).toBeNull();
    });

    it('a second reference to the same note shows the same number', () => {
        const v = mkView('A[^a] B[^a]\n\n[^a]: n\n\ntail');
        expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent)).toEqual(['1', '1']);
    });

    it('label match is case-insensitive (same rule as resolveFootnotes)', () => {
        const v = mkView('A[^Ab]\n\n[^aB]: n\n\ntail');
        expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent)).toEqual(['1']);
    });
});

describe('footnotePreview: inline notes', () => {
    it('outside: whole ^[...] replaced by sup.cm-footnote-ref with its number', () => {
        const v = mkView('x^[hello *w*] y\n\ntail');
        const refs = qa(v, 'sup.cm-footnote-ref');
        expect(refs.map((r) => r.textContent)).toEqual(['1']);
        expect(v.dom.textContent).not.toContain('hello');
    });

    it('inside: raw text visible, no widget', () => {
        const d = 'x^[hello] y\n\ntail';
        const v = mkView(d, d.indexOf('hello') + 2);
        expect(v.dom.textContent).toContain('^[hello]');
        expect(q(v, '.cm-footnote-ref')).toBeNull();
    });

    it('touching either end counts as inside', () => {
        const d = 'x^[hello] y\n\ntail';
        const from = d.indexOf('^[');
        for (const pos of [from, d.indexOf('] y') + 1]) {
            const v = mkView(d, pos);
            expect(v.dom.textContent, `pos ${pos}`).toContain('^[hello]');
            expect(q(v, '.cm-footnote-ref'), `pos ${pos}`).toBeNull();
        }
    });

    it('inline numbering interleaves with labelled in document order', () => {
        const v = mkView('a^[i1] b[^q] c^[i2]\n\n[^q]: Q\n\ntail');
        expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent)).toEqual(['1', '2', '3']);
    });
});

describe('footnotePreview: definitions', () => {
    it('outside: [^a]: marker replaced by span.cm-footnote-def "1."; note text stays in the doc', () => {
        const v = mkView(DOC, END);
        const d = q(v, 'span.cm-footnote-def');
        expect(d).not.toBeNull();
        expect(d.textContent).toBe('1.');
        expect(v.dom.textContent).not.toContain('[^a]:');
        expect(v.dom.textContent).toContain('note text');
    });

    it('cursor touching the marker (either end of [^a]:) shows raw marker', () => {
        const from = DOC.lastIndexOf('[^a]:');
        for (const pos of [from, from + 2, from + 5]) {
            const v = mkView(DOC, pos);
            expect(q(v, '.cm-footnote-def'), `pos ${pos}`).toBeNull();
            expect(v.dom.textContent, `pos ${pos}`).toContain('[^a]:');
        }
    });

    it('cursor in the note text (past the marker) keeps the marker widget', () => {
        const v = mkView(DOC, DOC.indexOf('text') + 1);
        expect(q(v, '.cm-footnote-def').textContent).toBe('1.');
    });

    it('orphan definition (no reference): no widget, raw marker', () => {
        const v = mkView('no refs here\n\n[^o]: orphan\n\ntail');
        expect(q(v, '.cm-footnote-def')).toBeNull();
        expect(v.dom.textContent).toContain('[^o]:');
    });

    it('duplicate definition: only the first gets a widget, the second stays raw', () => {
        const v = mkView('A[^a]\n\n[^a]: first\n\n[^a]: second\n\ntail');
        const defs = qa(v, '.cm-footnote-def');
        expect(defs.length).toBe(1);
        expect(v.dom.textContent).toContain('[^a]: second');
        expect(v.dom.textContent).not.toContain('[^a]: first');
    });

    it('definition inside a blockquote gets the widget too', () => {
        const v = mkView('A[^a]\n\n> [^a]: quoted\n\ntail');
        expect(q(v, '.cm-footnote-def').textContent).toBe('1.');
    });
});

describe('footnotePreview: edits and RTL', () => {
    it('inserting an earlier reference shifts the numbers', () => {
        const d = 'a[^x] b[^y]\n\n[^x]: X\n[^y]: Y\n\ntail';
        const v = mkView(d, d.length);
        expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent)).toEqual(['1', '2']);
        v.dispatch({ changes: { from: 0, insert: '[^y]' }, selection: { anchor: v.state.doc.length + 4 } });
        ensureSyntaxTree(v.state, v.state.doc.length, 5000);
        v.dispatch({ selection: { anchor: v.state.doc.length } });
        expect(qa(v, 'sup.cm-footnote-ref').map((r) => r.textContent)).toEqual(['1', '2', '1']);
    });

    it('Hebrew line with a reference keeps the widget dir="ltr"', () => {
        const d = 'שלום עולם[^a] והמשך\n\n[^a]: הערה\n\ntail';
        const v = mkView(d, d.length);
        const w = q(v, 'sup.cm-footnote-ref');
        expect(w.textContent).toBe('1');
        expect(w.getAttribute('dir')).toBe('ltr');
    });
});

describe('footnoteTooltipText', () => {
    it('resolved reference -> its note text', () => {
        const st = stateOf(DOC);
        expect(footnoteTooltipText(st, DOC.indexOf('[^a]') + 1)).toBe('note text');
        expect(footnoteTooltipText(st, DOC.indexOf('[^a]'))).toBe('note text');
    });

    it('inline note -> its content', () => {
        const st = stateOf(DOC);
        expect(footnoteTooltipText(st, DOC.indexOf('^[inl]') + 3)).toBe('inl');
    });

    it('null off a ref, on an unresolved ref, and on a definition marker', () => {
        const d = 'plain [^zz] and[^a]\n\n[^a]: n\n\ntail';
        const st = stateOf(d);
        expect(footnoteTooltipText(st, 0)).toBeNull();
        expect(footnoteTooltipText(st, d.indexOf('[^zz]') + 1)).toBeNull();
        expect(footnoteTooltipText(st, d.lastIndexOf('[^a]:') + 1)).toBeNull();
        expect(footnoteTooltipText(st, d.length)).toBeNull();
    });

    it('collapses whitespace runs and newlines to one space, trims', () => {
        const d = 'A[^a]\n\n[^a]:   one   two\n    three \t four  \n\ntail';
        expect(footnoteTooltipText(stateOf(d), d.indexOf('[^a]'))).toBe('one two three four');
    });

    it('strips blockquote prefixes from each line (> and >)', () => {
        const d = 'A[^a]\n\n> [^a]: first\n>     second\n>\n>     third\n\ntail';
        const out = footnoteTooltipText(stateOf(d), d.indexOf('[^a]'));
        expect(out).toBe('first second third');
        expect(out).not.toContain('>');
    });

    it('caps at 300 chars with an ellipsis when cut', () => {
        const long = 'x'.repeat(500);
        const d = `A[^a]\n\n[^a]: ${long}\n\ntail`;
        const out = footnoteTooltipText(stateOf(d), d.indexOf('[^a]'));
        expect(out).toBe('x'.repeat(300) + '…');
    });

    it('exactly 300 chars is not cut and gets no ellipsis', () => {
        const d = `A[^a]\n\n[^a]: ${'y'.repeat(300)}\n\ntail`;
        expect(footnoteTooltipText(stateOf(d), d.indexOf('[^a]'))).toBe('y'.repeat(300));
    });

    it('inline note text is cleaned the same way', () => {
        const d = 'x^[ a   b\nc ] y';
        expect(footnoteTooltipText(stateOf(d), d.indexOf('^[') + 2)).toBe('a b c');
    });
});

describe('footnoteJump', () => {
    it('on a resolved ref: selection moves to the start of the definition text, returns true', () => {
        const v = mkView(DOC, END);
        expect(footnoteJump(v, DOC.indexOf('[^a]') + 1)).toBe(true);
        expect(v.state.selection.main.head).toBe(DOC.indexOf('note text'));
        expect(v.state.selection.main.empty).toBe(true);
    });

    it('skips extra spaces after ]: (first non-space)', () => {
        const d = 'A[^a]\n\n[^a]:    spaced\n\ntail';
        const v = mkView(d);
        expect(footnoteJump(v, d.indexOf('[^a]'))).toBe(true);
        expect(v.state.selection.main.head).toBe(d.indexOf('spaced'));
    });

    it('on a definition marker: jumps to the FIRST reference from', () => {
        const d = 'A[^a] B[^a]\n\n[^a]: n\n\ntail';
        const v = mkView(d);
        expect(footnoteJump(v, d.lastIndexOf('[^a]:') + 1)).toBe(true);
        expect(v.state.selection.main.head).toBe(d.indexOf('[^a]'));
    });

    it('returns false and leaves the selection alone for unresolved ref, inline note, orphan def, plain text', () => {
        const d = 'A[^zz] x^[inl]\n\n[^o]: orphan\n\ntail';
        const v = mkView(d, 3);
        for (const pos of [d.indexOf('[^zz]') + 1, d.indexOf('^[inl]') + 3, d.indexOf('[^o]:') + 1, d.length]) {
            expect(footnoteJump(v, pos), `pos ${pos}`).toBe(false);
            expect(v.state.selection.main.head).toBe(3);
        }
    });
});

describe('footnotePreview: mouse', () => {
    it('plain mousedown on a reference widget puts the cursor at from + 2 (raw appears)', () => {
        const v = mkView(DOC, END);
        mouse(q(v, 'sup.cm-footnote-ref'));
        expect(v.state.selection.main.head).toBe(DOC.indexOf('[^a]') + 2);
        expect(v.dom.textContent).toContain('[^a]');
    });

    it('plain mousedown on an inline-note widget puts the cursor at from + 2', () => {
        const v = mkView(DOC, END);
        mouse(qa(v, 'sup.cm-footnote-ref')[1]);
        expect(v.state.selection.main.head).toBe(DOC.indexOf('^[inl]') + 2);
    });

    it('ctrl+mousedown on a reference widget jumps to the definition text', () => {
        const v = mkView(DOC, END);
        mouse(q(v, 'sup.cm-footnote-ref'), { ctrlKey: true });
        expect(v.state.selection.main.head).toBe(DOC.indexOf('note text'));
    });

    it('meta+mousedown works like ctrl', () => {
        const v = mkView(DOC, END);
        mouse(q(v, 'sup.cm-footnote-ref'), { metaKey: true });
        expect(v.state.selection.main.head).toBe(DOC.indexOf('note text'));
    });

    it('ctrl+mousedown on the definition widget jumps back to the first reference', () => {
        const v = mkView(DOC, END);
        mouse(q(v, 'span.cm-footnote-def'), { ctrlKey: true });
        expect(v.state.selection.main.head).toBe(DOC.indexOf('[^a]'));
    });

    it('ctrl+mousedown on an inline-note widget has nothing to jump to: cursor goes inside (from + 2)', () => {
        const v = mkView(DOC, END);
        mouse(qa(v, 'sup.cm-footnote-ref')[1], { ctrlKey: true });
        expect(v.state.selection.main.head).toBe(DOC.indexOf('^[inl]') + 2);
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');

    it('footnoteSyntax is in the markdown() extensions list', () => {
        expect(src).toMatch(/markdown\(\{[^}]*extensions:\s*\[[^\]]*\bfootnoteSyntax\b[^\]]*\]/);
    });

    it('footnotePreview is in the editor extensions array and imported', () => {
        expect(src).toMatch(/^\s*footnotePreview,/m);
        expect(src).toMatch(/import\s*\{[^}]*\bfootnotePreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/footnotes['"]/);
    });
});

describe('linkClickHandler vs footnote widgets', () => {
    it('Ctrl+click on a ref widget inside link text does not open the link; elsewhere in the link it does', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const doc = 'first\n\n[lnk[^1]](https://example.com/x)\n\n[^1]: note\n';
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const view = new EditorView({
            state: EditorState.create({
                doc, selection: { anchor: 0 },
                extensions: [markdown({ base: markdownLanguage, extensions: [footnoteSyntax] }), livePreview, footnotePreview, linkClickHandler],
            }),
            parent,
        });
        ensureSyntaxTree(view.state, doc.length, 5000);
        view.dispatch({ selection: { anchor: 0 } });
        view.posAtCoords = () => doc.indexOf('lnk') + 1;
        const ref = view.dom.querySelector('.cm-footnote-ref');
        expect(ref).not.toBeNull();
        ref.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        expect(open).not.toHaveBeenCalled();
        view.contentDOM.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        expect(open).toHaveBeenCalledWith('https://example.com/x', '_blank');
        view.destroy();
        vi.restoreAllMocks();
    });
});
