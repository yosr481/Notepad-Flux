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
