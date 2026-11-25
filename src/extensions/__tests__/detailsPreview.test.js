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
import { footnotePreview } from '../footnotes';
import { calloutPreview } from '../callouts';
import { mermaidPreview } from '../mermaidPreview';
import { detailsPreview } from '../detailsPreview';
import { findDetails } from '../detailsSyntax';
import { flat, mkState, countTreeWalks } from './selectionReuseHelpers';

vi.mock('../../utils/mermaid', () => ({ renderMermaid: vi.fn(() => new Promise(() => {})) }));
// Wrap findDetails so tests can count calls (dispatch note 1); behaviour is the real one.
vi.mock('../detailsSyntax', async (orig) => {
    const m = await orig();
    return { ...m, findDetails: vi.fn(m.findDetails) };
});

// Spec: Docs/internal/details-spec.md ("Editor (T2)", "T2 dispatch notes"). Offsets via doc.indexOf(unique substring).
// Pinned choices (spec silent):
//  - Export shape mirrors callouts: only `detailsPreview` (an extension array) is exported; there is NO exported field.
//    Decorations are read through the public EditorView.decorations facet (selectionReuseHelpers.flat).
//  - DOM classes: header widget span.cm-details-header; chevron span.cm-details-fold (+ cm-details-folded while folded)
//    containing an <svg>; label span.cm-details-title (dir="auto", text node only).
//  - Cursor-on-header = any selection range with from <= headerTo && to >= region.from (inclusive, like callouts).
//  - Cursor-on-closing-line = range with from <= closeTo && to >= closeFrom. The line keeps class cm-details-end
//    in both cases; only its text is hidden when the cursor is elsewhere.
//  - Folded replace decoration is ONE block replace exactly headerTo..closeTo (also when the body is empty).
//  - Header replace decoration is a non-block widget replace exactly from..headerTo.
//  - Fold flips when selection lands in the hidden range headerTo < pos <= closeTo. Caret AT headerTo is the header, not body.
//  - Arrow-style one-line step across a folded region lands on the first body line (down) / last body line (up), column kept.
//  - Mousedown (button 0) on .cm-details-fold toggles, preventDefault, never changes the doc. Selection unchanged unless the
//    caret is in the body of an open region being folded: then head moves to headerTo.
//  - Fold state = (open attribute) XOR (flip). Flip keyed by region.from, mapped with mapPos(p, 1); dropped when `open` changes.
// Not drivable in jsdom: real hit-testing, colours / AA contrast, chevron rotation.

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
                livePreview, mathPreview, footnotePreview, calloutPreview, mermaidPreview, detailsPreview,
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
const mouse = (el) =>
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
const text = (v) => v.dom.textContent;

afterEach(() => { while (views.length) views.pop().destroy(); vi.mocked(findDetails).mockClear(); });

const det = (attrs = '', body = '\nBody **md**\n') =>
    `<details${attrs}>\n<summary>Sum</summary>\n${body}\n</details>\n\ntail`;
const DET = det();
const DET_OPEN = det(' open');
const headerToOf = (doc) => doc.indexOf('</summary>') + '</summary>'.length;
const closeToOf = (doc) => doc.lastIndexOf('</details>') + '</details>'.length;

describe('detailsPreview: header widget', () => {
    it('renders chevron + label; raw header text is gone', () => {
        const v = mkView(DET);
        expect(qa(v, '.cm-details-header').length).toBe(1);
        expect(q(v, '.cm-details-header .cm-details-fold svg')).toBeTruthy();
        expect(q(v, '.cm-details-title').textContent).toBe('Sum');
        expect(text(v)).not.toContain('<details>');
        expect(text(v)).not.toContain('<summary>');
    });

    it('label element has dir="auto" and a single text node child', () => {
        const t = q(mkView(DET), '.cm-details-title');
        expect(t.getAttribute('dir')).toBe('auto');
        expect(t.childNodes.length).toBe(1);
        expect(t.firstChild.nodeType).toBe(Node.TEXT_NODE);
    });

    it('no summary: label "Details"', () => {
        const v = mkView('<details>\n\nBody\n\n</details>\n\ntail');
        expect(q(v, '.cm-details-title').textContent).toBe('Details');
    });

    it('label with entity-encoded <script> is text, no element created', () => {
        const v = mkView('<details>\n<summary>&lt;script&gt;x&lt;/script&gt;</summary>\n\nb\n\n</details>\n\ntail');
        const t = q(v, '.cm-details-title');
        expect(t.textContent).toBe('<script>x</script>');
        expect(t.children.length).toBe(0);
        expect(qa(v, 'script').length).toBe(0);
    });

    it('header is exactly one non-block replace widget from..headerTo', () => {
        const doc = DET;
        const v = mkView(doc);
        const d = flat(v.state).find((x) => x.value.spec.widget?.constructor.name !== undefined && x.from === 0 && x.to === headerToOf(doc));
        expect(d, 'header replace 0..headerTo').toBeTruthy();
        expect(!!d.value.spec.block).toBe(false);
    });

    it('indented opening tag (1-3 spaces) still gets the widget', () => {
        const v = mkView('  <details>\n  <summary>Sum</summary>\n\nBody\n\n  </details>\n\ntail');
        expect(qa(v, '.cm-details-header').length).toBe(1);
        expect(q(v, '.cm-details-title').textContent).toBe('Sum');
    });

    it('details inside a blockquote stays source (v1 limit)', () => {
        const v = mkView('> <details>\n> <summary>Sum</summary>\n>\n> Body\n>\n> </details>\n\ntail');
        expect(qa(v, '.cm-details-header').length).toBe(0);
    });

    it('one-line form stays source (v1 limit)', () => {
        const v = mkView('<details><summary>S</summary>x</details>\n\ntail');
        expect(qa(v, '.cm-details-header').length).toBe(0);
    });

    it('unmatched opening stays source', () => {
        const v = mkView('<details>\n<summary>S</summary>\n\nBody\n\ntail');
        expect(qa(v, '.cm-details-header').length).toBe(0);
    });
});

describe('detailsPreview: cursor reveals source', () => {
    it('caret on the summary line shows raw header, body stays folded', () => {
        const v = mkView(DET, DET.indexOf('Sum') + 1);
        expect(qa(v, '.cm-details-header').length).toBe(0);
        expect(text(v)).toContain('<summary>Sum</summary>');
        expect(text(v)).not.toContain('Body');
    });

    it('caret on the opening line of a multi-line header shows raw header (any header line)', () => {
        const v = mkView(DET, 3);
        expect(qa(v, '.cm-details-header').length).toBe(0);
        expect(text(v)).toContain('<details>');
        expect(text(v)).toContain('<summary>Sum</summary>');
    });

    it('caret at headerTo (end of summary line) is raw; caret on the next line is not', () => {
        const doc = DET;
        expect(qa(mkView(doc, headerToOf(doc)), '.cm-details-header').length).toBe(0);
        const next = mkView(DET_OPEN, headerToOf(DET_OPEN) + 1); // blank body line start
        expect(qa(next, '.cm-details-header').length).toBe(1);
    });

    it('a selection range overlapping the header (anchor before, head after) is raw', () => {
        const v = mkView(DET_OPEN, 0, DET_OPEN.indexOf('Body'));
        expect(qa(v, '.cm-details-header').length).toBe(0);
    });

    it('closing line: text hidden without cursor, raw with cursor, class cm-details-end both ways', () => {
        const doc = DET_OPEN;
        const v = mkView(doc);
        const end = q(v, '.cm-details-end');
        expect(end).toBeTruthy();
        expect(end.textContent).not.toContain('</details>');
        const c = mkView(doc, doc.lastIndexOf('</details>') + 3);
        const endC = q(c, '.cm-details-end');
        expect(endC).toBeTruthy();
        expect(endC.textContent).toContain('</details>');
    });
});

describe('detailsPreview: body and end line classes', () => {
    it('body lines get cm-details-body; header, closing and tail lines do not', () => {
        const v = mkView(DET_OPEN);
        expect(classesOf(v, 'Body')).toContain('cm-details-body');
        expect(classesOf(v, 'Body')).toContain('cm-details-body');
        expect(classesOf(v, 'tail')).not.toContain('cm-details-body');
        expect(classesOf(v, 'tail')).not.toContain('cm-details-end');
        expect([...q(v, '.cm-details-header').closest('.cm-line').classList]).not.toContain('cm-details-body');
        expect([...q(v, '.cm-details-end').classList]).not.toContain('cm-details-body');
    });

    it('every body line (including blank ones) has the class: line decos at each body line start', () => {
        const doc = DET_OPEN;
        const v = mkView(doc);
        const lineFroms = flat(v.state)
            .filter((d) => (d.value.spec.class ?? '').includes('cm-details-body'))
            .map((d) => d.from);
        const first = v.state.doc.lineAt(doc.indexOf('</summary>')).number + 1;
        const last = v.state.doc.lineAt(doc.lastIndexOf('</details>')).number - 1;
        const expected = [];
        for (let n = first; n <= last; n++) expected.push(v.state.doc.line(n).from);
        expect(lineFroms.sort((a, b) => a - b)).toEqual(expected);
    });

    it('empty body: no cm-details-body lines, end line still styled', () => {
        const v = mkView('<details open>\n<summary>S</summary>\n</details>\n\ntail');
        expect(qa(v, '.cm-details-body').length).toBe(0);
        expect(qa(v, '.cm-details-end').length).toBe(1);
        expect(qa(v, '.cm-details-header').length).toBe(1);
    });

    it('body stays normal live-preview markdown (bold marks hidden) and editable', () => {
        const v = mkView(DET_OPEN);
        expect(lineEl(v, 'Body').textContent).not.toContain('**');
        const at = DET_OPEN.indexOf('Body');
        v.dispatch({ changes: { from: at, insert: 'x' } });
        expect(v.state.doc.toString()).toContain('xBody');
    });
});

describe('detailsPreview: folding', () => {
    it('starts folded: body + closing line hidden, header + text after remain, chevron marked folded', () => {
        const v = mkView(DET);
        expect(text(v)).not.toContain('Body');
        expect(text(v)).not.toContain('</details>');
        expect(text(v)).toContain('Sum');
        expect(text(v)).toContain('tail');
        expect(qa(v, '.cm-details-fold.cm-details-folded').length).toBe(1);
        expect(qa(v, '.cm-details-body').length).toBe(0);
    });

    it('`open` attribute starts it open: body visible, chevron not folded', () => {
        const v = mkView(DET_OPEN);
        expect(text(v)).toContain('Body');
        expect(qa(v, '.cm-details-fold').length).toBe(1);
        expect(qa(v, '.cm-details-fold.cm-details-folded').length).toBe(0);
    });

    it('`open=""`, `class="x" open` and case-insensitive OPEN start open; class="a open" starts folded', () => {
        expect(text(mkView(det(' open=""')))).toContain('Body');
        expect(text(mkView(det(' class="x" open')))).toContain('Body');
        expect(text(mkView(det(' OPEN')))).toContain('Body');
        expect(text(mkView(det(' class="a open"')))).not.toContain('Body');
        expect(text(mkView(det(' data-open')))).not.toContain('Body');
    });

    it('folded: ONE block replace exactly headerTo..closeTo', () => {
        const doc = DET;
        const v = mkView(doc);
        const blocks = flat(v.state).filter((d) => d.value.spec.block && d.from === headerToOf(doc));
        expect(blocks.length).toBe(1);
        expect(blocks[0].to).toBe(closeToOf(doc));
    });

    it('empty body, folded: block replace still headerTo..closeTo, closing text hidden', () => {
        const doc = '<details>\n<summary>S</summary>\n</details>\n\ntail';
        const v = mkView(doc);
        const b = flat(v.state).find((d) => d.value.spec.block && d.from === headerToOf(doc));
        expect(b).toBeTruthy();
        expect(b.to).toBe(closeToOf(doc));
        expect(text(v)).not.toContain('</details>');
        expect(text(v)).toContain('tail');
    });

    it('chevron mousedown toggles both ways; doc and selection never change', () => {
        const doc = DET;
        const v = mkView(doc);
        const sel = v.state.selection.main.head;
        mouse(q(v, '.cm-details-fold'));
        expect(text(v)).toContain('Body');
        expect(v.state.doc.toString()).toBe(doc);
        expect(v.state.selection.main.head).toBe(sel);
        mouse(q(v, '.cm-details-fold'));
        expect(text(v)).not.toContain('Body');
        expect(v.state.doc.toString()).toBe(doc);
        expect(v.state.selection.main.head).toBe(sel);
    });

    it('an open region can be folded by click', () => {
        const v = mkView(DET_OPEN);
        mouse(q(v, '.cm-details-fold'));
        expect(text(v)).not.toContain('Body');
    });

    it('non-left button on the chevron does not toggle; left mousedown on the label never edits the doc and lands on the header', () => {
        const v = mkView(DET);
        q(v, '.cm-details-fold').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2 }));
        expect(text(v)).not.toContain('Body');
        q(v, '.cm-details-title').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
        // jsdom has no hit-testing: the editor may place the selection on the header (even spilling past it and unfolding), so the fold is not asserted.
        expect(v.state.selection.main.from).toBe(0);
        expect(v.state.doc.toString()).toBe(DET);
    });

    it('header widget does not swallow events (ignoreEvent false, like callouts), so a click on the label reaches the editor and the caret can reach the raw summary', () => {
        const v = mkView(DET);
        const w = flat(v.state).find((x) => x.from === 0 && x.value.spec.widget?.label === 'Sum').value.spec.widget;
        for (const sel of ['.cm-details-title', '.cm-details-fold', '.cm-details-header']) {
            expect(w.ignoreEvent({ target: q(v, sel) }), sel).toBe(false);
        }
    });

    it('chevron click with the caret in the body: caret moves to headerTo, region folds, doc unchanged', () => {
        const doc = DET_OPEN;
        const v = mkView(doc, doc.indexOf('Body') + 2);
        mouse(q(v, '.cm-details-fold'));
        expect(v.state.doc.toString()).toBe(doc);
        expect(v.state.selection.main.head).toBe(headerToOf(doc));
        expect(text(v)).not.toContain('Body');
    });

    it('folding one region leaves another untouched', () => {
        const doc = '<details open>\n<summary>A</summary>\n\naaa\n\n</details>\n\n<details open>\n<summary>B</summary>\n\nbbb\n\n</details>\n\ntail';
        const v = mkView(doc);
        mouse(qa(v, '.cm-details-fold')[0]);
        expect(text(v)).not.toContain('aaa');
        expect(text(v)).toContain('bbb');
    });
});

describe('detailsPreview: unfold on jump', () => {
    const doc = 'top\n\n<details>\n<summary>Sum</summary>\n\nline one\n\nline two\n\n</details>\n\nafter';
    const sumEnd = headerToOf(doc);

    it('selection moving into a folded body unfolds it', () => {
        const v = mkView(doc, 0);
        expect(text(v)).not.toContain('line one');
        v.dispatch({ selection: { anchor: doc.indexOf('line two') + 2 } });
        expect(text(v)).toContain('line one');
        expect(text(v)).toContain('line two');
    });

    it('selection onto the hidden closing line unfolds it', () => {
        const v = mkView(doc, 0);
        v.dispatch({ selection: { anchor: doc.lastIndexOf('</details>') + 2 } });
        expect(text(v)).toContain('line one');
    });

    it('caret on the header does NOT unfold', () => {
        const v = mkView(doc, sumEnd);
        expect(text(v)).not.toContain('line one');
        expect(text(v)).toContain('<summary>Sum</summary>');
    });

    it('arrow-style one-line step down across the fold lands on the first body line and unfolds', () => {
        const v = mkView(doc, sumEnd);
        const down = v.state.doc.line(v.state.doc.lineAt(doc.lastIndexOf('</details>')).number + 1).from;
        v.dispatch({ selection: { anchor: sumEnd, head: down }, userEvent: 'select' });
        const firstBody = v.state.doc.line(v.state.doc.lineAt(sumEnd).number + 1);
        expect(v.state.doc.lineAt(v.state.selection.main.head).number).toBe(firstBody.number);
        expect(text(v)).toContain('line one');
    });

    it('arrow-style one-line step up lands on the last body line and unfolds', () => {
        const probe = EditorState.create({ doc });
        const down = probe.doc.line(probe.doc.lineAt(doc.lastIndexOf('</details>')).number + 1).from;
        const v = mkView(doc, down);
        expect(text(v)).not.toContain('line two');
        v.dispatch({ selection: { anchor: down, head: sumEnd }, userEvent: 'select' });
        const closeLine = v.state.doc.lineAt(doc.lastIndexOf('</details>')).number;
        expect(v.state.doc.lineAt(v.state.selection.main.head).number).toBe(closeLine - 1);
        expect(text(v)).toContain('line two');
    });

    it('far jump (select all / Ctrl+End) is not hijacked', () => {
        const v = mkView(doc, 0);
        v.dispatch({ selection: { anchor: 0, head: doc.length }, userEvent: 'select' });
        expect(v.state.selection.main.head).toBe(doc.length);
    });

    it('pointer selection is not rewritten', () => {
        const v = mkView(doc, sumEnd);
        const to = doc.indexOf('after');
        v.dispatch({ selection: { anchor: to }, userEvent: 'select.pointer' });
        expect(v.state.selection.main.head).toBe(to);
    });
});

describe('detailsPreview: nesting', () => {
    const nested = (outerOpen, innerOpen) =>
        `<details${outerOpen}>\n<summary>Outer</summary>\n\nouter body\n\n<details${innerOpen}>\n<summary>Inner</summary>\n\ninner body\n\n</details>\n\n</details>\n\ntail`;

    it('folded outer hides the inner region entirely (one widget)', () => {
        const v = mkView(nested('', ' open'));
        expect(text(v)).not.toContain('outer body');
        expect(text(v)).not.toContain('Inner');
        expect(text(v)).not.toContain('inner body');
        expect(qa(v, '.cm-details-header').length).toBe(1);
    });

    it('open outer, folded inner: two widgets, inner body hidden', () => {
        const v = mkView(nested(' open', ''));
        expect(qa(v, '.cm-details-header').length).toBe(2);
        expect(text(v)).toContain('outer body');
        expect(text(v)).not.toContain('inner body');
    });

    it('open both: all text visible; unfolding outer by click reveals the inner as it was', () => {
        const v = mkView(nested('', ''));
        mouse(qa(v, '.cm-details-fold')[0]);
        expect(text(v)).toContain('outer body');
        expect(qa(v, '.cm-details-header').length).toBe(2);
        expect(text(v)).not.toContain('inner body');
        mouse(qa(v, '.cm-details-fold')[1]);
        expect(text(v)).toContain('inner body');
    });
});

describe('detailsPreview: fold state is view state', () => {
    it('survives Enter on line 1 (edit above the region), folded and opened', () => {
        const doc = 'top\n\n' + DET;
        const a = mkView(doc);
        a.dispatch({ changes: { from: 3, insert: '\n' } });
        expect(text(a)).not.toContain('Body');
        const b = mkView(doc);
        mouse(q(b, '.cm-details-fold'));
        b.dispatch({ changes: { from: 3, insert: '\n' } });
        expect(text(b)).toContain('Body');
        const c = mkView('top\n\n' + DET_OPEN);
        mouse(q(c, '.cm-details-fold'));
        c.dispatch({ changes: { from: 0, insert: '\n' } });
        expect(text(c)).not.toContain('Body');
    });

    it('survives typing inside the body', () => {
        const v = mkView(DET);
        mouse(q(v, '.cm-details-fold'));
        v.dispatch({ changes: { from: DET.indexOf('Body'), insert: 'x' } });
        expect(text(v)).toContain('xBody');
    });

    it('flip is dropped when `open` is added to the source (open XOR flip would re-fold otherwise)', () => {
        const v = mkView(DET);
        mouse(q(v, '.cm-details-fold')); // folded -> open
        expect(text(v)).toContain('Body');
        v.dispatch({ changes: { from: '<details'.length, insert: ' open' } });
        expect(text(v)).toContain('Body');
    });

    it('flip is dropped when `open` is removed from the source', () => {
        const v = mkView(DET_OPEN);
        mouse(q(v, '.cm-details-fold')); // open -> folded
        expect(text(v)).not.toContain('Body');
        v.dispatch({ changes: { from: '<details'.length, to: '<details open'.length, insert: '' } });
        expect(text(v)).not.toContain('Body');
    });

    it('never written to the document; widget clicks keep doc identical', () => {
        const v = mkView(DET);
        mouse(q(v, '.cm-details-fold'));
        mouse(q(v, '.cm-details-fold'));
        mouse(q(v, '.cm-details-fold'));
        expect(v.state.doc.toString()).toBe(DET);
    });
});

describe('detailsPreview: selection-only fast path', () => {
    it('selection-only transactions do not call findDetails again', () => {
        const doc = 'plain\n\nmore\n\n' + DET_OPEN;
        const v = mkView(doc, 0);
        vi.mocked(findDetails).mockClear();
        v.dispatch({ selection: { anchor: 3 }, userEvent: 'select' });
        v.dispatch({ selection: { anchor: 8 }, userEvent: 'select' });
        v.dispatch({ selection: { anchor: doc.indexOf('Body') }, userEvent: 'select' });
        v.dispatch({ selection: { anchor: 0 }, userEvent: 'select' });
        expect(vi.mocked(findDetails)).not.toHaveBeenCalled();
    });

    it('a doc change does recompute regions', () => {
        const v = mkView(DET_OPEN);
        vi.mocked(findDetails).mockClear();
        v.dispatch({ changes: { from: 0, insert: 'x\n\n' } });
        expect(vi.mocked(findDetails)).toHaveBeenCalled();
    });

    it('selection-only update does no tree walk (details extension alone)', () => {
        const state = mkState(DET_OPEN, [markdown({ base: markdownLanguage }), detailsPreview], 0);
        const walks = countTreeWalks(state, () => state.update({ selection: { anchor: DET_OPEN.indexOf('Body') }, userEvent: 'select' }).state);
        expect(walks).toBe(0);
    });

    it('selection changes still reveal/hide the header correctly after reuse', () => {
        const v = mkView(DET_OPEN, 0);
        expect(qa(v, '.cm-details-header').length).toBe(0);
        v.dispatch({ selection: { anchor: DET_OPEN.indexOf('Body') }, userEvent: 'select' });
        expect(qa(v, '.cm-details-header').length).toBe(1);
        v.dispatch({ selection: { anchor: 2 }, userEvent: 'select' });
        expect(qa(v, '.cm-details-header').length).toBe(0);
    });
});

describe('detailsPreview: overlap with other block replaces (dispatch note 7)', () => {
    const body = '\n> [!note]- Cal\n> callout-body\n\n```mermaid\ngraph TD; A-->B\n```\n\n| a | b |\n|---|---|\n| cellx | celly |\n';
    const mk = (attrs) => `<details${attrs}>\n<summary>Sum</summary>\n${body}\n</details>\n\ntail`;

    it('folded: no throw, whole body (callout, mermaid, table) hidden, header + tail remain', () => {
        let v;
        expect(() => { v = mkView(mk('')); }).not.toThrow();
        expect(text(v)).not.toContain('callout-body');
        expect(text(v)).not.toContain('graph TD');
        expect(text(v)).not.toContain('cellx');
        expect(qa(v, '.cm-mermaid').length).toBe(0);
        expect(qa(v, '.cm-callout-header').length).toBe(0);
        expect(qa(v, '.cm-details-header').length).toBe(1);
        expect(text(v)).toContain('tail');
    });

    it('unfolded: callout header, mermaid widget and table render as usual; details decorations present', () => {
        const doc = mk(' open');
        let v;
        expect(() => { v = mkView(doc); }).not.toThrow();
        expect(qa(v, '.cm-details-header').length).toBe(1);
        expect(qa(v, '.cm-callout-header').length).toBe(1);
        expect(qa(v, '.cm-mermaid').length).toBe(1);
        expect(text(v)).toContain('cellx');
        expect(text(v)).not.toContain('callout-body'); // callout is itself folded by "-"
        expect(flat(v.state).some((d) => d.from === 0 && d.to === headerToOf(doc))).toBe(true);
        expect(qa(v, '.cm-details-end').length).toBe(1);
    });

    it('toggling the details open then closed over those blocks never throws', () => {
        const v = mkView(mk(''));
        expect(() => { mouse(q(v, '.cm-details-fold')); mouse(q(v, '.cm-details-fold')); }).not.toThrow();
        expect(text(v)).not.toContain('graph TD');
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');

    it('detailsPreview is imported from ../extensions/detailsPreview', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bdetailsPreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/detailsPreview['"]/);
    });

    it('detailsPreview is in the extensions array, after footnotePreview', () => {
        expect(src).toMatch(/^\s*detailsPreview,/m);
        expect(src.indexOf('detailsPreview,')).toBeGreaterThan(src.indexOf('footnotePreview,'));
    });
});
