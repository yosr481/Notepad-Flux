import { describe, it, expect, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { listKeymap } from '../listKeymap';

// ---------------------------------------------------------------------------
// ROUND G — listKeymap real behaviour (was toBeDefined-tier)
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec left open, stated as decisions):
//
//  * Bindings are driven through runScopeHandlers(view, KeyboardEvent, 'editor')
//    against a real EditorView. indentUnit is pinned to two spaces so indent /
//    outdent output is deterministic.
//  * Enter on a NON-empty list line ("- item", "1. item", "- [x] done"):
//    inserts "\n" + a fresh marker of the same kind at the same indent.
//      - ordered markers increment: "1." -> "2."
//      - task markers always reset to unchecked: "- [ ] "
//    Handler returns true.
//  * Enter on an EMPTY list line ("- " / "1. " / "- [ ] " with nothing after):
//    clears the line (removes the marker) and returns true — does NOT add a row.
//  * Enter on a non-list line: handler returns false, doc untouched.
//  * Tab on a list line that has ANOTHER list line directly above: indents by
//    one indentUnit (indentMore), returns true.
//  * Tab on the FIRST list line (no list line above): handler returns false
//    (delegates to the base Tab behaviour), doc untouched.
//  * Shift-Tab on an indented list line: outdents by one indentUnit, returns
//    true.  NOTE: listKeymap does not bind Shift-Tab today — this pins that it
//    must (writer adds an indentLess binding).

let views = [];
afterEach(() => {
    views.forEach(v => v.destroy());
    views = [];
});

function mkView(doc, cursorPos) {
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor: cursorPos },
            extensions: [indentUnit.of('  '), listKeymap],
        }),
        parent: document.body,
    });
    views.push(view);
    return view;
}

const fireEnter = (view) =>
    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Enter' }), 'editor');
const fireTab = (view, shift = false) =>
    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift }), 'editor');

describe('listKeymap — Enter', () => {
    it('continues an unordered list: "- item" -> new "- " bullet below', () => {
        const view = mkView('- item', 6);
        expect(fireEnter(view)).toBe(true);
        expect(view.state.doc.toString()).toBe('- item\n- ');
    });

    it('continues an ordered list and increments the number: "1. item" -> "2. "', () => {
        const view = mkView('1. item', 7);
        expect(fireEnter(view)).toBe(true);
        expect(view.state.doc.toString()).toBe('1. item\n2. ');
    });

    it('continues a task list and always resets to unchecked: "- [x] done" -> "- [ ] "', () => {
        const view = mkView('- [x] done', 10);
        expect(fireEnter(view)).toBe(true);
        expect(view.state.doc.toString()).toBe('- [x] done\n- [ ] ');
    });

    it('on an EMPTY bullet ("- " with nothing after) removes the bullet instead of adding a row', () => {
        const view = mkView('- ', 2);
        expect(fireEnter(view)).toBe(true);
        expect(view.state.doc.toString()).toBe('');
    });

    it('on an EMPTY task bullet ("- [ ] ") removes the bullet', () => {
        const view = mkView('- [ ] ', 6);
        expect(fireEnter(view)).toBe(true);
        expect(view.state.doc.toString()).toBe('');
    });

    it('on a non-list line: returns false and leaves the doc untouched', () => {
        const view = mkView('plain text', 10);
        expect(fireEnter(view)).toBe(false);
        expect(view.state.doc.toString()).toBe('plain text');
    });
});

describe('listKeymap — Tab / Shift-Tab', () => {
    it('Tab on a bullet with a list line above indents it by one indentUnit', () => {
        const view = mkView('- a\n- b', 7); // cursor at end of the second "- b"
        expect(fireTab(view)).toBe(true);
        expect(view.state.doc.toString()).toBe('- a\n  - b');
    });

    it('Tab on the FIRST bullet (no list line above) returns false and does not change the doc', () => {
        const view = mkView('- a', 3);
        expect(fireTab(view)).toBe(false);
        expect(view.state.doc.toString()).toBe('- a');
    });

    it('Shift-Tab on an indented bullet outdents it by one indentUnit', () => {
        const view = mkView('- a\n  - b', 9); // cursor inside the indented "  - b"
        expect(fireTab(view, true)).toBe(true);
        expect(view.state.doc.toString()).toBe('- a\n- b');
    });
});

describe('listKeymap — shape', () => {
    it('is a usable CodeMirror extension', () => {
        expect(listKeymap).toBeTruthy();
    });
});
