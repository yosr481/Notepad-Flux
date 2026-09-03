import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { imagePreview } from '../imagePreview';

// ---------------------------------------------------------------------------
// TASK 7 / P1-3 — image widgets never repaint on large docs.
//
// imagePreview is a ViewPlugin. On a doc with > 1000 lines AND update.docChanged
// it debounces the decoration recompute by 300ms. The debounced callback must
// force a CodeMirror update cycle so CM re-reads `this.decorations` — otherwise
// the freshly computed widgets sit unused until an unrelated transaction.
//
// Pinned contract:
//   * debounce trigger: state.doc.lines > 1000 (strict) AND update.docChanged.
//     Exactly 1000 lines, or a selection-only / viewport-only update on a large
//     doc, take the synchronous path (no timer).
//   * debounce delay: 300ms.
//   * the debounced callback recomputes decorations AND dispatches a NO-OP
//     transaction on the view (no changes, no selection, no effects) so CM
//     runs an update cycle and picks up `this.decorations`.
//   * that no-op transaction must not re-enter the debounce branch (no loop):
//     no further timer is scheduled.
// ---------------------------------------------------------------------------

const IMG = '![x](https://e/x.png)';

// Exactly `n` lines.
const linesDoc = (n) => 'a\n'.repeat(n - 1) + 'a';

const views = [];
const mkView = (doc, anchor = 0) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor },
            extensions: [markdown(), imagePreview],
        }),
        parent,
    });
    views.push(view);
    return view;
};

// A transaction spec that forces an update cycle without changing the doc,
// selection, or dispatching effects.
const isNoOpSpec = (spec) =>
    spec != null &&
    typeof spec === 'object' &&
    typeof spec !== 'function' &&
    !spec.changes &&
    !spec.selection &&
    (!spec.effects || (Array.isArray(spec.effects) && spec.effects.length === 0));

afterEach(() => {
    vi.useRealTimers();
    while (views.length) views.pop().destroy();
    vi.restoreAllMocks();
});

describe('imagePreview — debounced repaint on large docs (P1-3)', () => {
    it('exposes a plugin instance whose decorations facet reads its `decorations` field', () => {
        const view = mkView(`intro ${IMG}\n`);
        const plugin = view.plugin(imagePreview);
        expect(plugin).toBeTruthy();
        expect(typeof plugin.decorations.size).toBe('number');
    });

    it('large doc: a docChanged update debounces — recompute is deferred to the timer', () => {
        const view = mkView(linesDoc(1500));
        expect(view.state.doc.lines).toBe(1500);
        const plugin = view.plugin(imagePreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');

        view.dispatch({
            changes: { from: 0, insert: `${IMG} ` },
            selection: { anchor: view.state.doc.length },
        });

        // Debounced: nothing recomputed synchronously, exactly one timer pending.
        expect(computeSpy).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(300);

        expect(computeSpy).toHaveBeenCalledTimes(1);
        expect(plugin.decorations.size).toBeGreaterThanOrEqual(1);
    });

    it('large doc: the debounce timer forces an update cycle so the widget actually repaints (FAILS before fix)', () => {
        // Doc starts with NO image; the edit inserts one on line 1.
        const view = mkView(linesDoc(1500));
        const dispatchSpy = vi.spyOn(view, 'dispatch');

        vi.useFakeTimers();
        view.dispatch({
            changes: { from: 0, insert: `see ${IMG} here\n` },
            selection: { anchor: view.state.doc.length },
        });

        // Debounced — widget not applied to the DOM yet.
        expect(view.dom.querySelector('.cm-image-container')).toBeNull();

        vi.advanceTimersByTime(350);

        // The timer must have dispatched a no-op transaction to force CM to
        // re-read the plugin decorations. Before the fix the timer only calls
        // requestMeasure(), so no such dispatch happens.
        const forcing = dispatchSpy.mock.calls.filter(([spec]) => isNoOpSpec(spec));
        expect(forcing.length).toBeGreaterThanOrEqual(1);

        // And the widget is now in the DOM without any further unrelated
        // transaction. Before the fix `plugin.decorations` holds the widget but
        // CM never picks it up, so this stays null.
        expect(view.dom.querySelector('.cm-image-container')).not.toBeNull();
    });

    it('large doc: the forcing transaction does not re-enter the debounce branch (no repaint loop)', () => {
        const view = mkView(linesDoc(1500));
        const dispatchSpy = vi.spyOn(view, 'dispatch');

        vi.useFakeTimers();
        view.dispatch({
            changes: { from: 0, insert: `see ${IMG} here\n` },
            selection: { anchor: view.state.doc.length },
        });
        vi.advanceTimersByTime(350);

        // Timer fired; no new timer scheduled by the forcing transaction.
        expect(vi.getTimerCount()).toBe(0);

        dispatchSpy.mockClear();
        vi.advanceTimersByTime(5000);
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('small doc (< 1000 lines): recompute is synchronous — no timer, no forcing dispatch', () => {
        const view = mkView(linesDoc(500));
        const plugin = view.plugin(imagePreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');
        const dispatchSpy = vi.spyOn(view, 'dispatch');

        view.dispatch({
            changes: { from: 0, insert: `see ${IMG} here\n` },
            selection: { anchor: view.state.doc.length },
        });

        expect(computeSpy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
        expect(view.dom.querySelector('.cm-image-container')).not.toBeNull();

        // Only the caller's transaction — no extra no-op forcing dispatch.
        const forcing = dispatchSpy.mock.calls.filter(([spec]) => isNoOpSpec(spec));
        expect(forcing.length).toBe(0);
    });

    it('boundary: exactly 1000 lines uses the synchronous path; 1001 lines debounces', () => {
        const small = mkView(linesDoc(1000));
        expect(small.state.doc.lines).toBe(1000);
        const smallPlugin = small.plugin(imagePreview);
        vi.useFakeTimers();
        const smallCompute = vi.spyOn(smallPlugin, 'computeDecorations');
        // Insert without a newline so the post-change doc is still exactly 1000 lines.
        small.dispatch({ changes: { from: 0, insert: `${IMG} ` }, selection: { anchor: small.state.doc.length } });
        expect(small.state.doc.lines).toBe(1000);
        expect(vi.getTimerCount()).toBe(0);
        expect(smallCompute).toHaveBeenCalledTimes(1);
        vi.useRealTimers();

        const large = mkView(linesDoc(1001));
        expect(large.state.doc.lines).toBe(1001);
        const largePlugin = large.plugin(imagePreview);
        vi.useFakeTimers();
        const largeCompute = vi.spyOn(largePlugin, 'computeDecorations');
        large.dispatch({ changes: { from: 0, insert: `${IMG} ` }, selection: { anchor: large.state.doc.length } });
        expect(large.state.doc.lines).toBe(1001);
        expect(vi.getTimerCount()).toBe(1);
        expect(largeCompute).not.toHaveBeenCalled();
    });

    it('large doc: a selection-only update is not debounced (only docChanged debounces)', () => {
        const view = mkView(linesDoc(1500));
        const plugin = view.plugin(imagePreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');

        view.dispatch({ selection: { anchor: 4 } });

        expect(vi.getTimerCount()).toBe(0);
        expect(computeSpy).toHaveBeenCalledTimes(1);
    });

    it('large doc: the debounce delay is 300ms', () => {
        const view = mkView(linesDoc(1500));
        const plugin = view.plugin(imagePreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');
        view.dispatch({
            changes: { from: 0, insert: `${IMG} ` },
            selection: { anchor: view.state.doc.length },
        });

        vi.advanceTimersByTime(299);
        expect(computeSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(computeSpy).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// TASK 3 — image with a title attribute: ![alt](url "title") (audit #10)
//
// Bug: imageMatcher `/!\[(.*?)\]\((.*?)\)/g` puts everything between the parens
// (`url "title"`) into match[2], which becomes ImageWidget.url -> img.src, so
// the image fails to load. Fix mirrors linkPreview.js:135 — a URL group that
// stops at whitespace/quote/paren plus an optional title group that is dropped.
//
// Pinned contract:
//   * ![alt](url "title")  -> widget.url === "url" (bare), widget.alt === "alt"
//   * ![alt](url) / ![](url) -> widget.url === "url" (unchanged)
//   * URL group is [^"\s)]+ : keeps %20, query strings (?a=1&b=2), paren-free
//     paths; stops at the first space so a single-quoted 'title' tail is left
//     out of the URL (only the clean URL is asserted, the tail is not pinned).
//   * cursor-inside the image still yields a widget (existing behaviour) and
//     that widget's url is the clean URL too.
//   * out of scope: escaped \" inside a title, <url> autolink form.
//
// Tested at the level imagePreview.js uses: build an EditorView with the
// plugin, read the ViewPlugin's `decorations` RangeSet, pull the widget out.
// ---------------------------------------------------------------------------

// Every widget carried by the plugin's current decoration set, in doc order.
const imageWidgets = (view) => {
    const set = view.plugin(imagePreview).decorations;
    const out = [];
    const cur = set.iter();
    while (cur.value) {
        const w = cur.value.spec && cur.value.spec.widget;
        if (w) out.push(w);
        cur.next();
    }
    return out;
};

// Doc with a non-image first line so anchor 0 leaves the cursor OFF the image.
const withCursorOff = (imgMarkdown) => mkView(`intro line\n${imgMarkdown}`, 0);

describe('imagePreview — image title attribute (TASK 3)', () => {
    it('strips the "title" from the URL: ![x](url "title") -> widget.url is bare (FAILS before fix)', () => {
        const view = withCursorOff('![x](https://e/x.png "the title")');
        const [w] = imageWidgets(view);
        expect(w).toBeTruthy();
        expect(w.url).toBe('https://e/x.png');
        expect(w.alt).toBe('x');
    });

    it('no title: ![x](url) is unchanged', () => {
        const view = withCursorOff('![x](https://e/x.png)');
        const [w] = imageWidgets(view);
        expect(w.url).toBe('https://e/x.png');
        expect(w.alt).toBe('x');
    });

    it('empty alt with a title: ![](url "t") -> url bare, alt empty string', () => {
        const view = withCursorOff('![](https://e/x.png "t")');
        const [w] = imageWidgets(view);
        expect(w.url).toBe('https://e/x.png');
        expect(w.alt).toBe('');
    });

    it('preserves %20 in the URL when a title follows', () => {
        const view = withCursorOff('![a](https://e/a%20b.png "t")');
        const [w] = imageWidgets(view);
        expect(w.url).toBe('https://e/a%20b.png');
    });

    it('preserves a query string in the URL when a title follows', () => {
        const view = withCursorOff('![a](https://e/x.png?a=1&b=2 "t")');
        const [w] = imageWidgets(view);
        expect(w.url).toBe('https://e/x.png?a=1&b=2');
    });

    it('single-quoted title: URL still stops at the first space and is clean', () => {
        // CommonMark allows 'single' quotes; linkPreview does not and neither
        // need we. Pin only that the URL group [^"\s)]+ yields the bare URL.
        const view = withCursorOff("![a](https://e/x.png 'single')");
        const [w] = imageWidgets(view);
        expect(w.url).toBe('https://e/x.png');
    });

    it('cursor inside the image still yields a widget, with the clean URL', () => {
        // Single-line doc, anchor 0 -> cursor is on/inside the image: existing
        // behaviour is an active Decoration.widget rather than a replace.
        const view = mkView('![x](https://e/x.png "t")', 0);
        const widgets = imageWidgets(view);
        expect(widgets.length).toBeGreaterThanOrEqual(1);
        expect(widgets[0].url).toBe('https://e/x.png');
    });
});

// ---------------------------------------------------------------------------
// TASK 8 — reference-style images (audit #8): ![alt][id] / ![id][] / ![id]
//
// imagePreview.js resolves these over its visible ranges using two regexes plus
// resolveLinkDefs(view.state):
//   full-ref  /!\[([^\]]*)\]\[([^\]]*)\]/g   — label = group2 || group1, alt = group1
//   shortcut  /!\[([^\]]+)\](?!\[|\()/g      — label = group1,           alt = group1
//
// PINNED:
//   * ![alt][id]  -> widget.url === def.url, widget.alt === "alt"
//   * ![id][]     -> widget.url === def.url, widget.alt === "id"  (empty label
//                     falls back to the visible alt text)
//   * ![id]       -> widget.url === def.url, widget.alt === "id"
//   * unresolved ![alt][nope] (no matching LRD) -> NO widget, left as source
//   * the inline ![alt](url) path is unaffected.
// ---------------------------------------------------------------------------

describe('imagePreview — reference-style images (TASK 8)', () => {
    it('full ref ![alt][id]: widget src from the LRD, alt "alt" (FAILS before fix)', () => {
        const view = withCursorOff('![alt][id]\n\n[id]: http://x');
        const [w] = imageWidgets(view);
        expect(w).toBeTruthy();
        expect(w.url).toBe('http://x');
        expect(w.alt).toBe('alt');
    });

    it('collapsed ref ![id][]: src from the LRD, alt "id" (FAILS before fix)', () => {
        const view = withCursorOff('![id][]\n\n[id]: http://x');
        const [w] = imageWidgets(view);
        expect(w).toBeTruthy();
        expect(w.url).toBe('http://x');
        expect(w.alt).toBe('id');
    });

    it('shortcut ref ![id]: src from the LRD, alt "id" (FAILS before fix)', () => {
        const view = withCursorOff('![id]\n\n[id]: http://x');
        const [w] = imageWidgets(view);
        expect(w).toBeTruthy();
        expect(w.url).toBe('http://x');
        expect(w.alt).toBe('id');
    });

    it('unresolved ![alt][nope] (no matching LRD) -> NO widget, left as source', () => {
        const view = withCursorOff('![alt][nope]');
        expect(imageWidgets(view).length).toBe(0);
    });

    it('the inline ![alt](url) path is unaffected by the ref matcher', () => {
        const view = withCursorOff('![x](https://e/x.png)');
        const [w] = imageWidgets(view);
        expect(w.url).toBe('https://e/x.png');
        expect(w.alt).toBe('x');
    });

    // GAP (reviewer-added): the inline imageMatcher's `.*?` alt group can span
    // across `]` `[`, so on ONE line holding a resolved reference image followed
    // by an inline image it matches the whole run [0..end]. The ref-full matcher
    // then adds an overlapping range [0..shorter] to the SAME RangeSetBuilder
    // after the longer one -> "Ranges must be added sorted" throw, killing all
    // image rendering in the view. Must not throw; both images should resolve.
    it('resolved ref image + inline image on one line does not throw', () => {
        let view;
        expect(() => {
            view = withCursorOff('![a][x] ![b](https://e/b.png)\n\n[x]: https://e/x.png');
        }).not.toThrow();
        const urls = imageWidgets(view).map((w) => w.url).sort();
        expect(urls).toEqual(['https://e/b.png', 'https://e/x.png']);
    });
});
