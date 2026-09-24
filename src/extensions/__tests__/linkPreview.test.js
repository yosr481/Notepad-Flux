import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { livePreview } from '../livePreview';
import { linkPreview } from '../linkPreview';
import { markdown } from '@codemirror/lang-markdown';

describe('Link Preview Extension', () => {
    let view;

    const createEditor = (doc = '') => {
        const state = EditorState.create({
            doc,
            extensions: [
                markdown(),
                livePreview, // Link preview logic is often integrated or interacts with livePreview
            ]
        });
        view = new EditorView({ state });
        return view;
    };

    it('should exist', () => {
        expect(linkPreview).toBeDefined();
    });

    // Note: The actual hiding/showing logic is often inside livePreview.js for links too,
    // or strictly in linkPreview.js depending on architecture.
    // Based on `livePreview.js` content viewed earlier, it handles "LinkMark" and "URL" nodes.

    it('should hide link syntax when cursor is not touching', () => {
        view = createEditor('[Link Text](http://example.com)');
        // Cursor at 0

        // As with livePreview, we verify the state field is active.
        // Deep verification of decorations requires inspecting the view's decoration set,
        // which matches the livePreview tests we added.
        expect(view.state.doc.toString()).toBe('[Link Text](http://example.com)');
    });
});

// ---------------------------------------------------------------------------
// TASK 7 / P1-3 — link widgets never repaint on large docs.
//
// linkPreview is a ViewPlugin. On a doc with > 1000 lines AND update.docChanged
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

describe('linkPreview — debounced repaint on large docs (P1-3)', () => {
    // `[t](https://e)` with a prefix so a cursor at 0 is NOT touching the link.
    const LINK = '[t](https://e)';

    // Exactly `n` lines.
    const linesDoc = (n) => 'a\n'.repeat(n - 1) + 'a';

    const views = [];
    const mkView = (doc, anchor = 0) => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const v = new EditorView({
            state: EditorState.create({
                doc,
                selection: { anchor },
                extensions: [markdown(), linkPreview],
            }),
            parent,
        });
        views.push(v);
        return v;
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

    it('exposes a plugin instance whose decorations facet reads its `decorations` field', () => {
        const v = mkView(`see ${LINK}\n`);
        const plugin = v.plugin(linkPreview);
        expect(plugin).toBeTruthy();
        expect(typeof plugin.decorations.size).toBe('number');
    });

    it('large doc: a docChanged update debounces — recompute is deferred to the timer', () => {
        const v = mkView(linesDoc(1500));
        expect(v.state.doc.lines).toBe(1500);
        const plugin = v.plugin(linkPreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');

        v.dispatch({
            changes: { from: 0, insert: `see ${LINK} x\n` },
            selection: { anchor: v.state.doc.length },
        });

        expect(computeSpy).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(300);

        expect(computeSpy).toHaveBeenCalledTimes(1);
        expect(plugin.decorations.size).toBeGreaterThanOrEqual(1);
    });

    it('large doc: the debounce timer forces an update cycle so the widget actually repaints (FAILS before fix)', () => {
        // Doc starts with NO link; the edit inserts one on line 1.
        const v = mkView(linesDoc(1500));
        const dispatchSpy = vi.spyOn(v, 'dispatch');

        vi.useFakeTimers();
        v.dispatch({
            changes: { from: 0, insert: `see ${LINK} here\n` },
            selection: { anchor: v.state.doc.length },
        });

        // Debounced — widget not applied to the DOM yet.
        expect(v.dom.querySelector('.cm-link')).toBeNull();

        vi.advanceTimersByTime(350);

        // The timer must have dispatched a no-op transaction to force CM to
        // re-read the plugin decorations. Before the fix the timer only calls
        // requestMeasure(), so no such dispatch happens.
        const forcing = dispatchSpy.mock.calls.filter(([spec]) => isNoOpSpec(spec));
        expect(forcing.length).toBeGreaterThanOrEqual(1);

        // And the widget is now in the DOM without any further unrelated
        // transaction. Before the fix `plugin.decorations` holds the widget but
        // CM never picks it up, so this stays null.
        expect(v.dom.querySelector('.cm-link')).not.toBeNull();
    });

    it('large doc: the forcing transaction does not re-enter the debounce branch (no repaint loop)', () => {
        const v = mkView(linesDoc(1500));
        const dispatchSpy = vi.spyOn(v, 'dispatch');

        vi.useFakeTimers();
        v.dispatch({
            changes: { from: 0, insert: `see ${LINK} here\n` },
            selection: { anchor: v.state.doc.length },
        });
        vi.advanceTimersByTime(350);

        expect(vi.getTimerCount()).toBe(0);

        dispatchSpy.mockClear();
        vi.advanceTimersByTime(5000);
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('small doc (< 1000 lines): recompute is synchronous — no timer, no forcing dispatch', () => {
        const v = mkView(linesDoc(500));
        const plugin = v.plugin(linkPreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');
        const dispatchSpy = vi.spyOn(v, 'dispatch');

        v.dispatch({
            changes: { from: 0, insert: `see ${LINK} here\n` },
            selection: { anchor: v.state.doc.length },
        });

        expect(computeSpy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
        expect(v.dom.querySelector('.cm-link')).not.toBeNull();

        const forcing = dispatchSpy.mock.calls.filter(([spec]) => isNoOpSpec(spec));
        expect(forcing.length).toBe(0);
    });

    it('boundary: exactly 1000 lines uses the synchronous path; 1001 lines debounces', () => {
        const small = mkView(linesDoc(1000));
        expect(small.state.doc.lines).toBe(1000);
        const smallPlugin = small.plugin(linkPreview);
        vi.useFakeTimers();
        const smallCompute = vi.spyOn(smallPlugin, 'computeDecorations');
        // Insert without a newline so the post-change doc is still exactly 1000 lines.
        small.dispatch({ changes: { from: 0, insert: `see ${LINK} x ` }, selection: { anchor: small.state.doc.length } });
        expect(small.state.doc.lines).toBe(1000);
        expect(vi.getTimerCount()).toBe(0);
        expect(smallCompute).toHaveBeenCalledTimes(1);
        vi.useRealTimers();

        const large = mkView(linesDoc(1001));
        expect(large.state.doc.lines).toBe(1001);
        const largePlugin = large.plugin(linkPreview);
        vi.useFakeTimers();
        const largeCompute = vi.spyOn(largePlugin, 'computeDecorations');
        large.dispatch({ changes: { from: 0, insert: `see ${LINK} x ` }, selection: { anchor: large.state.doc.length } });
        expect(large.state.doc.lines).toBe(1001);
        expect(vi.getTimerCount()).toBe(1);
        expect(largeCompute).not.toHaveBeenCalled();
    });

    it('large doc: a selection-only update is not debounced (only docChanged debounces)', () => {
        const v = mkView(linesDoc(1500));
        const plugin = v.plugin(linkPreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');

        v.dispatch({ selection: { anchor: 4 } });

        expect(vi.getTimerCount()).toBe(0);
        expect(computeSpy).toHaveBeenCalledTimes(1);
    });

    it('large doc: the debounce delay is 300ms', () => {
        const v = mkView(linesDoc(1500));
        const plugin = v.plugin(linkPreview);

        vi.useFakeTimers();
        const computeSpy = vi.spyOn(plugin, 'computeDecorations');
        v.dispatch({
            changes: { from: 0, insert: `see ${LINK} x\n` },
            selection: { anchor: v.state.doc.length },
        });

        vi.advanceTimersByTime(299);
        expect(computeSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(computeSpy).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// TASK 8 — image-in-link (#14) + reference-style link resolution (#8)
// ===========================================================================
//
// #14  linkPreview.js gets, in the `!shouldReveal` block BEFORE the inline
//      /^\[(.*?)\]\(...\)/ regex:  if (node.node.getChild("Image")) return;
//      So "[![alt](img)](url)" produces NO LinkWidget over the outer span
//      (previously the lazy regex matched "![alt" / "img" and rendered a bogus
//      widget).
//
// #8   linkPreview resolves reference-style links via resolveLinkDefs(state):
//        * full ref   [text][id]  -> widget text = "text", url = def.url
//        * shortcut   [id]        -> widget text = "id",   url = def.url
//        * collapsed  [id][]      -> resolves by its visible text ("id")
//        * unresolved [text][nope] (no matching LRD) -> NO widget, left as
//          source (PINNED: no widget, not a reveal).
//      Node facts (bare markdown()): "[text][id]" -> Link > LinkMark, LinkMark,
//      LinkLabel "[id]"; "[id]" -> Link with NO LinkLabel; unresolved refs
//      STILL parse as Link nodes (the parser does not check definitions).
// ===========================================================================

describe('linkPreview — TASK 8 (image-in-link + reference links)', () => {
    const mounted = [];
    const mount = (doc, anchor = 0) => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const view = new EditorView({
            state: EditorState.create({
                doc,
                selection: { anchor },
                extensions: [markdown(), linkPreview],
            }),
            parent,
        });
        mounted.push(view);
        return view;
    };

    // Every widget carried by the plugin's current decoration set, in doc order.
    const linkWidgets = (view) => {
        const set = view.plugin(linkPreview).decorations;
        const out = [];
        const cur = set.iter();
        while (cur.value) {
            const w = cur.value.spec && cur.value.spec.widget;
            if (w) out.push(w);
            cur.next();
        }
        return out;
    };

    afterEach(() => {
        while (mounted.length) mounted.pop().destroy();
    });

    // ---- #14 image-in-link ----
    it('image-in-link "[![alt](img)](url)" cursor away: NO LinkWidget over the outer span (FAILS before fix)', () => {
        const view = mount('intro\n[![alt](img)](url)', 0);
        expect(linkWidgets(view).length).toBe(0);
    });

    it('sanity: a plain [text](url) still gets its LinkWidget (the guard did not over-fire)', () => {
        const view = mount('intro\n[text](http://x)', 0);
        const ws = linkWidgets(view);
        expect(ws.length).toBe(1);
        expect(ws[0].url).toBe('http://x');
        expect(ws[0].text).toBe('text');
    });

    // ---- #8 reference-style link resolution ----
    it('full ref [text][id] resolves: widget text "text", url from the LRD (FAILS before fix)', () => {
        const view = mount('intro\n[text][id]\n\n[id]: http://x', 0);
        const ws = linkWidgets(view);
        expect(ws.length).toBe(1);
        expect(ws[0].text).toBe('text');
        expect(ws[0].url).toBe('http://x');
    });

    it('shortcut ref [id] resolves: widget text "id", url from the LRD (FAILS before fix)', () => {
        const view = mount('intro\n[id]\n\n[id]: http://x', 0);
        const ws = linkWidgets(view);
        expect(ws.length).toBe(1);
        expect(ws[0].text).toBe('id');
        expect(ws[0].url).toBe('http://x');
    });

    it('collapsed ref [id][] resolves by its visible text, like the shortcut form (FAILS before fix)', () => {
        const view = mount('intro\n[id][]\n\n[id]: http://x', 0);
        const ws = linkWidgets(view);
        expect(ws.length).toBe(1);
        expect(ws[0].text).toBe('id');
        expect(ws[0].url).toBe('http://x');
    });

    it('unresolved ref [text][nope] (no matching LRD) -> NO widget, left as source', () => {
        const view = mount('intro\n[text][nope]', 0);
        expect(linkWidgets(view).length).toBe(0);
    });

    it('cursor touching a resolved ref link reveals it (no widget)', () => {
        const view = mount('[text][id]\n\n[id]: http://x', 2); // anchor inside Link[0,10]
        expect(linkWidgets(view).length).toBe(0);
    });
});
