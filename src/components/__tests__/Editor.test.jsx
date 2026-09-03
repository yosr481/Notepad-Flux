import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import Editor from '../Editor';

// TASK 5 — real isDirty + find/replace error-guard (P1-4 / P1-11)
//
// Contract pinned by this suite:
//
// isDirty (Editor.jsx):
//  - `savedContentRef` baseline = initialContent on mount, RESET to the newly
//    active tab's content whenever activeTabId changes.
//  - updateListener on docChanged calls onContentChange(text, text !== baseline)
//    — a real boolean, NOT a hardwired `true`.
//  - New imperative method markSaved(): records current doc text as the baseline.
//
// find / replaceAll guard (Editor.jsx):
//  - An invalid regex pattern must NOT throw out of find()/replaceAll().
//  - find() with a bad pattern returns { current: 0, total: 0 }.
//  - replaceAll() with a bad pattern returns 0 and makes no document change.
//  - Valid searches keep working (regression guard — the fix must try/catch the
//    SearchQuery/getCursor construction, NOT silently drop regex support).

// jsdom lacks scrollIntoView; CodeMirror's findNext calls it.
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}

/** Grab the live EditorView that the Editor component mounted. */
function getView(container) {
    const dom = container.querySelector('.cm-editor');
    const view = dom && EditorView.findFromDOM(dom);
    if (!view) throw new Error('EditorView not mounted in jsdom');
    return view;
}

/** Append text at the end of the doc (simulates typing). */
function type(view, text) {
    act(() => {
        view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
    });
}

function mountEditor(props = {}) {
    const ref = createRef();
    const onContentChange = vi.fn();
    const utils = render(
        <Editor
            ref={ref}
            activeTabId={props.activeTabId ?? '1'}
            tabIds={props.tabIds ?? ['1']}
            initialContent={props.initialContent ?? ''}
            initialCursor={0}
            initialScroll={0}
            onContentChange={onContentChange}
            onStatsUpdate={vi.fn()}
            onStateChange={vi.fn()}
        />
    );
    return { ref, onContentChange, ...utils };
}

/** Second arg of the most recent onContentChange call. */
const lastDirty = (spy) => spy.mock.calls.at(-1)[1];
const lastText = (spy) => spy.mock.calls.at(-1)[0];

beforeEach(() => {
    vi.restoreAllMocks();
});
afterEach(() => {
    cleanup();
});

describe('Editor — isDirty is a real boolean (P1-4)', () => {
    it('mounts a real CodeMirror EditorView under jsdom', () => {
        const { container } = mountEditor({ initialContent: 'hello' });
        expect(getView(container).state.doc.toString()).toBe('hello');
    });

    it('typing into a clean tab reports isDirty === true', () => {
        const { container, onContentChange } = mountEditor({ initialContent: 'hello' });
        type(getView(container), 'X');

        expect(onContentChange).toHaveBeenCalled();
        expect(lastText(onContentChange)).toBe('helloX');
        expect(lastDirty(onContentChange)).toBe(true);
    });

    it('editing then reverting to the saved text reports isDirty === false', () => {
        const { container, onContentChange } = mountEditor({ initialContent: 'hello' });
        const view = getView(container);

        type(view, 'X');
        expect(lastDirty(onContentChange)).toBe(true);

        act(() => { undo(view); });

        expect(view.state.doc.toString()).toBe('hello');
        expect(lastText(onContentChange)).toBe('hello');
        expect(lastDirty(onContentChange)).toBe(false); // fails today: hardwired `true`
    });

    it('the isDirty flag is a boolean, never a truthy stand-in', () => {
        const { container, onContentChange } = mountEditor({ initialContent: 'a' });
        type(getView(container), 'b');
        expect(typeof lastDirty(onContentChange)).toBe('boolean');
    });

    it('markSaved() is an imperative method on the ref', () => {
        const { ref } = mountEditor({ initialContent: 'hello' });
        expect(typeof ref.current.markSaved).toBe('function'); // fails today: no such method
    });

    it('after markSaved() the current text becomes the new saved baseline', () => {
        const { container, ref, onContentChange } = mountEditor({ initialContent: 'hello' });
        const view = getView(container);

        type(view, 'X'); // doc === 'helloX', dirty
        expect(lastDirty(onContentChange)).toBe(true);

        act(() => { ref.current.markSaved(); });

        // Edit away from the new baseline...
        type(view, 'Y');
        expect(lastDirty(onContentChange)).toBe(true);

        // ...then set the doc explicitly back to 'helloX'. (Can't use undo here:
        // both type() calls land in one CodeMirror history group, so undo would
        // revert past markSaved's baseline to 'hello'. Pin "baseline moved" directly.)
        act(() => {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'helloX' } });
        });

        expect(view.state.doc.toString()).toBe('helloX');
        expect(lastDirty(onContentChange)).toBe(false); // baseline moved to 'helloX'
    });

    it('switching to another tab resets the saved baseline to that tab\'s content', () => {
        const { container, onContentChange, rerender } = mountEditor({
            activeTabId: '1',
            tabIds: ['1', '2'],
            initialContent: 'aaa',
        });

        // Switch to tab 2 with its own content.
        rerender(
            <Editor
                activeTabId="2"
                tabIds={['1', '2']}
                initialContent="bbb"
                initialCursor={0}
                initialScroll={0}
                onContentChange={onContentChange}
                onStatsUpdate={vi.fn()}
                onStateChange={vi.fn()}
            />
        );

        const view = getView(container);
        expect(view.state.doc.toString()).toBe('bbb');

        // Edit-and-revert on the new tab must report clean against 'bbb',
        // not against the old tab's 'aaa' baseline.
        type(view, 'Z');
        expect(lastDirty(onContentChange)).toBe(true);
        act(() => { undo(view); });

        expect(view.state.doc.toString()).toBe('bbb');
        expect(lastDirty(onContentChange)).toBe(false);
    });
});

describe('Editor — find() guards a bad regex (P1-11)', () => {
    it('find() with an invalid regex pattern does not throw', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(() => ref.current.find('[', { useRegex: true })).not.toThrow(); // throws today
    });

    it('find() with an invalid regex pattern returns { current: 0, total: 0 }', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(ref.current.find('[', { useRegex: true })).toEqual({ current: 0, total: 0 });
    });

    it.each(['[', '(', '*', '\\'])('find() survives malformed pattern %j', (pat) => {
        const { ref } = mountEditor({ initialContent: 'abc [ ( * abc' });
        expect(() => ref.current.find(pat, { useRegex: true })).not.toThrow();
        expect(ref.current.find(pat, { useRegex: true })).toEqual({ current: 0, total: 0 });
    });

    it('find() with empty search text returns { current: 0, total: 0 }', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(ref.current.find('', { useRegex: true })).toEqual({ current: 0, total: 0 });
    });

    it('find() still counts a plain-text query (regression guard)', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(ref.current.find('foo').total).toBe(3);
    });

    it('find() still counts a valid regex query (regression guard)', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(ref.current.find('f.o', { useRegex: true }).total).toBe(3);
    });

    it('find() with a valid but unmatched query returns total 0 without throwing', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(ref.current.find('zzz')).toEqual({ current: 0, total: 0 });
    });
});

describe('Editor — replaceAll() guards a bad regex (P1-11)', () => {
    it('replaceAll() with an invalid regex pattern does not throw', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(() => ref.current.replaceAll('[', 'x', { useRegex: true })).not.toThrow(); // throws today
    });

    it('replaceAll() with an invalid regex pattern returns 0 and changes nothing', () => {
        const { container, ref } = mountEditor({ initialContent: 'foo foo foo' });
        const before = getView(container).state.doc.toString();

        const count = ref.current.replaceAll('[', 'x', { useRegex: true });

        expect(count).toBe(0);
        expect(getView(container).state.doc.toString()).toBe(before);
    });

    it('replaceAll() with empty search text returns 0', () => {
        const { ref } = mountEditor({ initialContent: 'foo foo foo' });
        expect(ref.current.replaceAll('', 'x', { useRegex: true })).toBe(0);
    });

    it('replaceAll() still replaces a plain-text query (regression guard)', () => {
        const { container, ref } = mountEditor({ initialContent: 'foo foo foo' });

        let count;
        act(() => { count = ref.current.replaceAll('foo', 'bar', {}); });

        expect(count).toBe(3);
        expect(getView(container).state.doc.toString()).toBe('bar bar bar');
    });

    it('replaceAll() still replaces a valid regex query (regression guard)', () => {
        const { container, ref } = mountEditor({ initialContent: 'foo foo foo' });

        let count;
        act(() => { count = ref.current.replaceAll('f.o', 'bar', { useRegex: true }); });

        expect(count).toBe(3);
        expect(getView(container).state.doc.toString()).toBe('bar bar bar');
    });
});
