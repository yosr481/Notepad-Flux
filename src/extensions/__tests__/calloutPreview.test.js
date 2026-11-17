import { describe, it, expect, afterEach } from 'vitest';
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
import { footnotePreview } from '../footnotes';
import { calloutPreview } from '../callouts';

// Spec: Docs/internal/callouts-spec.md ("Editor behaviour"). Offsets via doc.indexOf(unique substring).
// Pinned choices (spec silent):
//  - A line is found in the DOM by .cm-line textContent containing a unique substring.
//  - Folded body = block-replaced: its text is absent from the DOM. Header line stays.
//  - Selection on the header line shows raw text but does NOT unfold; only selection inside the body does.
//  - Mousedown on .cm-callout-fold toggles, leaves doc AND selection unchanged (cursor is not moved).
//  - Fold state is keyed by header position and maps through edits (insert before the callout: a
//    folded callout stays folded, a toggled-open one stays open).
//  - Icon isolation: .cm-callout-icon has an inline style attribute containing `unicode-bidi: isolate`.
//  - .cm-callout-icon is the <svg> itself or contains one; different canonical types give different svg markup.
//  - Docs here end with a "tail" paragraph so the default cursor (doc end) touches no callout.
// Not drivable in jsdom (Task 5 e2e): real click hit-testing, colours/AA contrast, CSS tint/border,
// real bidi rendering, cursor via arrow keys / search / Go to line, chevron rotation.

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
                livePreview, mathPreview, footnotePreview, calloutPreview,
            ],
        }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};
const qa = (v, sel) => [...v.dom.querySelectorAll(sel)];
const q = (v, sel) => v.dom.querySelector(sel);
const lineEl = (v, text) => qa(v, '.cm-line').find((l) => l.textContent.includes(text));
const classesOf = (v, text) => {
    const el = lineEl(v, text);
    expect(el, `line containing "${text}"`).toBeTruthy();
    return [...el.classList];
};
const calloutClasses = (v, text) => classesOf(v, text).filter((c) => c.startsWith('cm-callout'));
const mouse = (el) =>
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));

afterEach(() => { while (views.length) views.pop().destroy(); });

const TIP = '> [!tip] My title\n> body line\n> more body\n\ntail';

describe('calloutPreview: line classes', () => {
    it('every line of a callout gets cm-callout + cm-callout-<canonical> plus blockquote classes', () => {
        const v = mkView(TIP);
        for (const t of ['My title', 'body line', 'more body']) {
            const c = classesOf(v, t);
            expect(c, t).toContain('cm-callout');
            expect(c, t).toContain('cm-callout-tip');
            expect(c, t).toContain('cm-blockquote-line');
            expect(c, t).toContain('cm-blockquote-depth-1');
        }
        expect(calloutClasses(v, 'tail')).toEqual([]);
    });

    it('alias maps to canonical class (hint -> tip), case-insensitive (TLDR -> abstract)', () => {
        expect(calloutClasses(mkView('> [!hint]\n> b1\n\ntail'), 'b1')).toContain('cm-callout-tip');
        expect(calloutClasses(mkView('> [!TLDR]\n> b2\n\ntail'), 'b2')).toContain('cm-callout-abstract');
    });

    it('unknown type -> cm-callout-note', () => {
        const v = mkView('> [!weird] t\n> b3\n\ntail');
        expect(calloutClasses(v, 'b3')).toEqual(expect.arrayContaining(['cm-callout', 'cm-callout-note']));
    });

    it('plain blockquote gets no callout classes', () => {
        const v = mkView('> plain quote\n> second\n\ntail');
        expect(calloutClasses(v, 'plain quote')).toEqual([]);
        expect(calloutClasses(v, 'second')).toEqual([]);
        expect(classesOf(v, 'plain quote')).toContain('cm-blockquote-line');
        expect(qa(v, '.cm-callout-header').length).toBe(0);
    });

    it('marker without a space (">[!note] t") is still a callout', () => {
        const v = mkView('>[!note] t\n>b4\n\ntail');
        expect(calloutClasses(v, 'b4')).toContain('cm-callout-note');
    });

    it('nested callout: innermost wins for its lines, outer keeps its own', () => {
        const doc = '> [!note] outer\n> before\n> > [!tip] inner\n> > inner body\n>\n> after\n\ntail';
        const v = mkView(doc);
        expect(calloutClasses(v, 'before')).toContain('cm-callout-note');
        expect(calloutClasses(v, 'after')).toContain('cm-callout-note');
        const ib = calloutClasses(v, 'inner body');
        expect(ib).toContain('cm-callout-tip');
        expect(ib).not.toContain('cm-callout-note');
        const hd = calloutClasses(v, 'inner');
        expect(hd).toContain('cm-callout-tip');
        expect(hd).not.toContain('cm-callout-note');
        expect(qa(v, '.cm-callout-header').length).toBe(2);
    });

    it('doc edit changes classes ([!tip] -> [!bug])', () => {
        const v = mkView(TIP);
        const from = TIP.indexOf('tip');
        v.dispatch({ changes: { from, to: from + 3, insert: 'bug' } });
        const c = calloutClasses(v, 'body line');
        expect(c).toContain('cm-callout-bug');
        expect(c).not.toContain('cm-callout-tip');
    });

    it('editing the header into a non-callout removes the classes', () => {
        const v = mkView(TIP);
        v.dispatch({ changes: { from: TIP.indexOf('[!tip]'), to: TIP.indexOf('[!tip]') + 1, insert: '' } });
        expect(calloutClasses(v, 'body line')).toEqual([]);
        expect(qa(v, '.cm-callout-header').length).toBe(0);
    });
});

describe('calloutPreview: not a callout', () => {
    it('[!note] on the 2nd line of a blockquote', () => {
        const v = mkView('> first\n> [!note] x\n\ntail');
        expect(calloutClasses(v, 'first')).toEqual([]);
        expect(calloutClasses(v, '[!note]')).toEqual([]);
        expect(qa(v, '.cm-callout-header').length).toBe(0);
    });

    it('escaped \\[!note]', () => {
        const v = mkView('> \\[!note] x\n> b5\n\ntail');
        expect(calloutClasses(v, 'b5')).toEqual([]);
        expect(qa(v, '.cm-callout-header').length).toBe(0);
    });

    it('inside a fenced code block', () => {
        const v = mkView('```\n> [!note] x\n> b6\n```\n\ntail');
        expect(qa(v, '.cm-callout, .cm-callout-header').length).toBe(0);
        expect(v.dom.textContent).toContain('[!note]');
    });

    it('malformed header "[!note" is plain', () => {
        const v = mkView('> [!note x\n> b7\n\ntail');
        expect(calloutClasses(v, 'b7')).toEqual([]);
    });
});

describe('calloutPreview: header widget', () => {
    it('no title: widget replaces [!type] with icon + .cm-callout-title showing the type name', () => {
        const v = mkView('> [!warning]\n> b8\n\ntail');
        const w = q(v, 'span.cm-callout-header');
        expect(w).toBeTruthy();
        expect(w.querySelector('.cm-callout-icon')).toBeTruthy();
        expect(w.querySelector('.cm-callout-title').textContent).toBe('Warning');
        expect(v.dom.textContent).not.toContain('[!warning]');
        expect(lineEl(v, 'Warning')).toBeTruthy();
    });

    it('title text of an untitled alias is the type as written, capitalised', () => {
        const v = mkView('> [!TLDR]\n> b9\n\ntail');
        expect(q(v, '.cm-callout-header .cm-callout-title').textContent).toBe('Tldr');
    });

    it('icon is an svg (itself or inside), different per canonical type, shared by aliases', () => {
        const svg = (doc) => {
            const el = q(mkView(doc), '.cm-callout-icon');
            expect(el, doc).toBeTruthy();
            const s = el.tagName.toLowerCase() === 'svg' ? el : el.querySelector('svg');
            expect(s, doc).toBeTruthy();
            return s.outerHTML;
        };
        const note = svg('> [!note]\n> b\n\ntail');
        const bug = svg('> [!bug]\n> b\n\ntail');
        expect(note).not.toBe(bug);
        expect(svg('> [!hint]\n> b\n\ntail')).toBe(svg('> [!tip]\n> b\n\ntail'));
        expect(svg('> [!weird]\n> b\n\ntail')).toBe(note); // unknown -> note icon
    });

    it('with a title: no .cm-callout-title widget text; title stays doc text with a mark class', () => {
        const v = mkView(TIP);
        const w = q(v, '.cm-callout-header');
        expect(w).toBeTruthy();
        expect(w.querySelector('.cm-callout-title')).toBeNull();
        expect(w.textContent).not.toContain('My title');
        const mark = qa(v, '.cm-line .cm-callout-title').find((e) => !w.contains(e));
        expect(mark.textContent).toBe('My title');
        expect(v.dom.textContent).not.toContain('[!tip]');
        expect(v.dom.textContent).toContain('My title');
    });

    it('title inline markdown is live-previewed', () => {
        const v = mkView('> [!tip] a **bold** word\n> b\n\ntail');
        // Bold styling comes from fluxHighlightStyle in Editor.jsx (not installed here); livePreview only hides the marks.
        expect(lineEl(v, 'a bold word')).toBeTruthy();
        expect(v.dom.textContent).not.toContain('**');
        v.dispatch({ selection: { anchor: 12 } }); // cursor on the header line: marks show raw again
        expect(v.dom.textContent).toContain('**bold**');
    });

    it('selection on the header line: no widget, raw [!type] visible, classes stay', () => {
        const v = mkView(TIP, TIP.indexOf('My title'));
        expect(qa(v, '.cm-callout-header').length).toBe(0);
        expect(v.dom.textContent).toContain('[!tip]');
        expect(calloutClasses(v, 'My title')).toContain('cm-callout-tip');
    });

    it('moving the selection on and off the header toggles the widget', () => {
        const v = mkView(TIP);
        expect(qa(v, '.cm-callout-header').length).toBe(1);
        v.dispatch({ selection: { anchor: TIP.indexOf('[!tip]') + 2 } });
        expect(qa(v, '.cm-callout-header').length).toBe(0);
        v.dispatch({ selection: { anchor: TIP.length } });
        expect(qa(v, '.cm-callout-header').length).toBe(1);
    });

    it('selection in the body (not header) keeps the header widget', () => {
        const v = mkView(TIP, TIP.indexOf('body line'));
        expect(qa(v, '.cm-callout-header').length).toBe(1);
    });

    it('RTL: no-title widget .cm-callout-title has dir="auto"; icon has unicode-bidi: isolate', () => {
        const v = mkView('> [!note]\n> b\n\ntail');
        expect(q(v, '.cm-callout-header .cm-callout-title').getAttribute('dir')).toBe('auto');
        expect(q(v, '.cm-callout-icon').getAttribute('style') || '').toMatch(/unicode-bidi:\s*isolate/);
    });

    it('Hebrew title is kept as doc text', () => {
        const v = mkView('> [!note] כותרת עברית\n> גוף\n\ntail');
        expect(v.dom.textContent).toContain('כותרת עברית');
        expect(qa(v, '.cm-line .cm-callout-title').some((e) => e.textContent === 'כותרת עברית')).toBe(true);
        expect(v.dom.textContent).not.toContain('[!note]');
    });
});

describe('calloutPreview: offsets inside lists, indent, nesting', () => {
    const check = (doc, cls = 'cm-callout-tip') => {
        const v = mkView(doc);
        expect(qa(v, '.cm-callout-header').length).toBe(1);
        const line = lineEl(v, 'xtitle');
        expect(line, doc).toBeTruthy();
        expect(line.textContent).not.toMatch(/\[!|tip\]/);
        expect(line.textContent).toContain('xtitle');
        expect([...line.classList]).toContain(cls);
        expect(calloutClasses(v, 'bodyx')).toContain(cls);
    };
    it('inside a list item', () => check('- > [!tip] xtitle\n  > bodyx\n\ntail'));
    it('1-3 space indent', () => {
        check('  > [!tip] xtitle\n  > bodyx\n\ntail');
        check(' > [!tip] xtitle\n > bodyx\n\ntail');
        check('   > [!tip] xtitle\n   > bodyx\n\ntail');
    });
    it('ordered list item', () => check('1. > [!tip] xtitle\n   > bodyx\n\ntail'));
    it('nested "> > [!tip]" header widget at the right offset', () => {
        const v = mkView('> outer\n> > [!tip] xtitle\n> > bodyx\n\ntail');
        const line = lineEl(v, 'xtitle');
        expect(line.textContent).not.toMatch(/\[!|tip\]/);
        expect(qa(v, '.cm-callout-header').length).toBe(1);
        expect(calloutClasses(v, 'outer')).toEqual([]);
        expect(calloutClasses(v, 'bodyx')).toContain('cm-callout-tip');
    });
});

describe('calloutPreview: folding', () => {
    const FOLD = (c) => `> [!note]${c} Title\n> body line\n> more body\n\ntail`;

    it('no fold char: no chevron', () => {
        expect(qa(mkView(FOLD('')), '.cm-callout-fold').length).toBe(0);
    });

    it('"-" starts folded: body hidden, header + chevron + text after callout remain', () => {
        const v = mkView(FOLD('-'));
        expect(qa(v, '.cm-callout-header .cm-callout-fold').length).toBe(1);
        expect(v.dom.textContent).not.toContain('body line');
        expect(v.dom.textContent).not.toContain('more body');
        expect(v.dom.textContent).toContain('Title');
        expect(v.dom.textContent).toContain('tail');
    });

    it('"+" starts open: chevron present, body visible', () => {
        const v = mkView(FOLD('+'));
        expect(qa(v, '.cm-callout-fold').length).toBe(1);
        expect(v.dom.textContent).toContain('body line');
        expect(v.dom.textContent).toContain('more body');
    });

    it('mousedown on the chevron toggles; doc and selection never change', () => {
        const doc = FOLD('-');
        const v = mkView(doc);
        const sel = v.state.selection.main.head;
        mouse(q(v, '.cm-callout-fold'));
        expect(v.dom.textContent).toContain('body line');
        expect(v.state.doc.toString()).toBe(doc);
        expect(v.state.selection.main.head).toBe(sel);
        mouse(q(v, '.cm-callout-fold'));
        expect(v.dom.textContent).not.toContain('body line');
        expect(v.state.doc.toString()).toBe(doc);
        expect(v.state.selection.main.head).toBe(sel);
    });

    it('"+" can be folded by click', () => {
        const doc = FOLD('+');
        const v = mkView(doc);
        mouse(q(v, '.cm-callout-fold'));
        expect(v.dom.textContent).not.toContain('body line');
        expect(v.state.doc.toString()).toBe(doc);
    });

    it('folding one callout leaves another untouched', () => {
        const v = mkView('> [!note]+ A\n> aaa\n\n> [!tip]+ B\n> bbb\n\ntail');
        mouse(qa(v, '.cm-callout-fold')[0]);
        expect(v.dom.textContent).not.toContain('aaa');
        expect(v.dom.textContent).toContain('bbb');
    });

    it('selection moving into a folded body unfolds it', () => {
        const doc = FOLD('-');
        const v = mkView(doc);
        v.dispatch({ selection: { anchor: doc.indexOf('more body') + 2 } });
        expect(v.dom.textContent).toContain('body line');
        expect(v.dom.textContent).toContain('more body');
    });

    it('selection on the header line shows raw text but does not unfold', () => {
        const doc = FOLD('-');
        const v = mkView(doc, doc.indexOf('Title'));
        expect(qa(v, '.cm-callout-header').length).toBe(0);
        expect(v.dom.textContent).toContain('[!note]-');
        expect(v.dom.textContent).not.toContain('body line');
    });

    it('fold state maps through edits before the callout (folded stays folded)', () => {
        const v = mkView(FOLD('-'));
        v.dispatch({ changes: { from: 0, insert: 'intro\n\n' } });
        expect(v.dom.textContent).toContain('intro');
        expect(v.dom.textContent).not.toContain('body line');
    });

    it('toggled-open state maps through edits before the callout (stays open)', () => {
        const v = mkView(FOLD('-'));
        mouse(q(v, '.cm-callout-fold'));
        v.dispatch({ changes: { from: 0, insert: 'intro\n\n' } });
        expect(v.dom.textContent).toContain('body line');
    });

    it('editing the body of an open foldable callout keeps it open', () => {
        const doc = FOLD('-');
        const v = mkView(doc);
        mouse(q(v, '.cm-callout-fold'));
        const at = v.state.doc.toString().indexOf('more body');
        v.dispatch({ changes: { from: at, insert: 'x ' } });
        expect(v.dom.textContent).toContain('x more body');
    });

    it('deleting a toggled callout does not hand its flip to the next callout', () => {
        const doc = '> [!note]- A\n> abody\n\n> [!note]+ B\n> bbody\n\ntail';
        const v = mkView(doc);
        mouse(q(v, '.cm-callout-fold')); // A opens
        expect(v.dom.textContent).toContain('abody');
        v.dispatch({ changes: { from: doc.indexOf('[!note]- A'), to: doc.indexOf('[!note]+ B') } });
        expect(v.dom.textContent).toContain('bbody');
        expect(q(v, '.cm-callout-folded')).toBeNull();
    });

    it('folded callout keeps its classes on the header line', () => {
        const v = mkView(FOLD('-'));
        expect(calloutClasses(v, 'Title')).toEqual(expect.arrayContaining(['cm-callout', 'cm-callout-note']));
    });

    it('folded in a list item hides only the body', () => {
        const v = mkView('- > [!tip]- xtitle\n  > bodyx\n\ntail');
        expect(v.dom.textContent).not.toContain('bodyx');
        expect(v.dom.textContent).toContain('xtitle');
        expect(v.dom.textContent).toContain('tail');
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');

    it('calloutPreview is imported from ../extensions/callouts', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bcalloutPreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/callouts['"]/);
    });

    it('calloutPreview is in the extensions array, after footnotePreview', () => {
        expect(src).toMatch(/^\s*calloutPreview,/m);
        expect(src.indexOf('calloutPreview,')).toBeGreaterThan(src.indexOf('footnotePreview,'));
    });
});
