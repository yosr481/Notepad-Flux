import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import Editor from '../Editor';

// Editor callbacks are read through refs (keystrokes always reach the current tab id) and a real switch between tabs, even with
// identical text, loads that tab's own state. (The a37bb5c rename branch was removed in 6f2fd19: early tabs keep their ids.)
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
afterEach(() => cleanup());

const viewOf = (container) => EditorView.findFromDOM(container.querySelector('.cm-editor'));
const type = (view, text) => act(() => { view.dispatch({ changes: { from: view.state.doc.length, insert: text } }); });

const props = (over = {}) => ({
    activeTabId: 'tab-2', tabIds: ['tab-2'], initialContent: 'EARLY', initialCursor: 0, initialScroll: 0,
    onContentChange: vi.fn(), onStatsUpdate: vi.fn(), onStateChange: vi.fn(), ...over,
});

describe('Editor: callbacks follow the current props', () => {
    it('after the active id and the callbacks change, keystrokes reach the CURRENT callbacks, not the ones from the render that created the view', () => {
        const first = props();
        const { container, rerender } = render(<Editor {...first} />);
        const second = props({ activeTabId: 'tab-9', initialContent: 'EARLY', tabIds: ['tab-9'] });
        rerender(<Editor {...second} />);
        first.onContentChange.mockClear(); second.onContentChange.mockClear();
        const live = viewOf(container); type(live, 'X');
        expect(second.onContentChange).toHaveBeenCalledWith('EARLYX', true);
        expect(first.onContentChange).not.toHaveBeenCalled();
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
