import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import Editor from '../Editor';

// a37bb5c: when the session load renumbers the tab being edited, the Editor follows the id and keeps its live
// view state; a real switch (even to a tab with identical text) loads that tab's own state.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
afterEach(() => cleanup());

const viewOf = (container) => EditorView.findFromDOM(container.querySelector('.cm-editor'));
const type = (view, text) => act(() => { view.dispatch({ changes: { from: view.state.doc.length, insert: text } }); });

const props = (over = {}) => ({
    activeTabId: 'tab-2', renamedFrom: null, tabIds: ['tab-2'], initialContent: 'EARLY', initialCursor: 0, initialScroll: 0,
    onContentChange: vi.fn(), onStatsUpdate: vi.fn(), onStateChange: vi.fn(), ...over,
});

describe('Editor: id rename of the active tab', () => {
    it('keeps the same EditorState (document, caret, undo history) even though the props still carry stale content and cursor 0', () => {
        const p = props()
        const { container, rerender } = render(<Editor {...p} />);
        const view = viewOf(container);
        type(view, 'abc');
        act(() => view.dispatch({ selection: { anchor: 3 } }));
        const stateBefore = view.state;
        rerender(<Editor {...p} activeTabId="tab-9" renamedFrom="tab-2" tabIds={['tab-9']} />);   // initialContent still 'EARLY', cursor 0
        expect(viewOf(container)).toBe(view);
        expect(view.state).toBe(stateBefore);                     // not rebuilt
        expect(view.state.doc.toString()).toBe('EARLYabc');
        expect(view.state.selection.main.head).toBe(3);
        act(() => { undo(view); });
        expect(view.state.doc.toString()).toBe('EARLY');          // undo history survived
    });

    it('keystrokes after the rename reach the CURRENT callbacks, not the ones from the render that created the view', () => {
        const first = props();
        const { container, rerender } = render(<Editor {...first} />);
        const view = viewOf(container);
        const second = props({ activeTabId: 'tab-9', renamedFrom: 'tab-2', tabIds: ['tab-9'] });
        rerender(<Editor {...second} />);
        first.onContentChange.mockClear(); second.onContentChange.mockClear();
        type(view, 'X');
        expect(second.onContentChange).toHaveBeenCalledWith('EARLYX', true);
        expect(first.onContentChange).not.toHaveBeenCalled();
    });

    it('a later real switch away and back after a rename still works with the new id', () => {
        const p = props();
        const { container, rerender } = render(<Editor {...p} />);
        const view = viewOf(container); type(view, '1');
        rerender(<Editor {...p} activeTabId="tab-9" renamedFrom="tab-2" tabIds={['tab-9', 'other']} />);
        rerender(<Editor {...p} activeTabId="other" renamedFrom={null} initialContent="OTHER" tabIds={['tab-9', 'other']} />);
        expect(viewOf(container).state.doc.toString()).toBe('OTHER');
        rerender(<Editor {...p} activeTabId="tab-9" renamedFrom={null} initialContent="EARLY1" tabIds={['tab-9', 'other']} />);   // the app keeps tab.content in sync
        expect(viewOf(container).state.doc.toString()).toBe('EARLY1');
    });

    it('a stale renamedFrom (not the tab the editor is showing) is treated as a real switch', () => {
        const p = props();
        const { container, rerender } = render(<Editor {...p} />);
        type(viewOf(container), 'zzz');
        rerender(<Editor {...p} activeTabId="b" renamedFrom="not-the-current-tab" initialContent="B-TEXT" tabIds={['tab-2', 'b']} />);
        expect(viewOf(container).state.doc.toString()).toBe('B-TEXT');
    });
});

describe('Editor: switching between two tabs with identical text', () => {
    it('does not share state: the new tab starts from its own content with an empty undo history, and the first tab keeps its edits', () => {
        const p = props({ activeTabId: 'a', tabIds: ['a', 'b'], initialContent: 'same' });
        const { container, rerender } = render(<Editor {...p} />);
        type(viewOf(container), 'X');
        rerender(<Editor {...p} activeTabId="b" initialContent="same" />);
        const v = viewOf(container);
        expect(v.state.doc.toString()).toBe('same');
        act(() => { undo(v); });
        expect(v.state.doc.toString()).toBe('same');            // nothing to undo: history is not a's
        type(v, 'Y');
        rerender(<Editor {...p} activeTabId="a" initialContent="sameX" />);
        expect(viewOf(container).state.doc.toString()).toBe('sameX');
        rerender(<Editor {...p} activeTabId="b" initialContent="sameY" />);
        expect(viewOf(container).state.doc.toString()).toBe('sameY');
    });
});
