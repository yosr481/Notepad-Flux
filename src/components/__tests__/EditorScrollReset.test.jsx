import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import Editor from '../Editor';

// B1: view.setState keeps the scroller's old scrollTop. Carried into another (large) doc it breaks CM's measure loop and the next click
// throws "Cannot read properties of null (reading 'length')" in scanTile. Contract pinned here:
//  1. On a tab switch, after EITHER setState path (fresh createEditorState / cached state), scrollDOM.scrollTop is 0 before any restore.
//  2. Restores still win afterwards, in the next rAF: scrollCache for a cached tab, the initialScroll prop (> 0) for a new tab.
//  3. A re-render with the SAME active tab never touches scrollTop.
// jsdom's scrollTop is a no-op (always 0), so each test defines a plain read/write own property on the real scrollDOM element; setState
// keeps the same element, so the value survives exactly as it does in a browser. requestAnimationFrame is queued and flushed by hand so
// "right after the switch" and "after the rAF" are separately observable.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

let queue = [];
const flush = () => { const q = queue; queue = []; q.forEach(cb => cb(0)); };
afterEach(() => { cleanup(); vi.restoreAllMocks(); queue = []; });

const setup = () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { queue.push(cb); return queue.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const base = { tabIds: ['a', 'b', 'c'], initialCursor: 0, onContentChange: vi.fn(), onStatsUpdate: vi.fn(), onStateChange: vi.fn() };
    const el = (id, content, initialScroll = 0) => <Editor {...base} activeTabId={id} initialContent={content} initialScroll={initialScroll} />;
    const r = render(el('a', 'aaa'));
    const view = EditorView.findFromDOM(r.container.querySelector('.cm-editor'));
    let top = 0;
    Object.defineProperty(view.scrollDOM, 'scrollTop', { configurable: true, get: () => top, set: v => { top = v; } });
    flush(); // mount-time rAFs
    return { el, rerender: r.rerender, view, set: v => { top = v; }, get: () => view.scrollDOM.scrollTop };
};

describe('Editor: scrollTop on tab switch (B1)', () => {
    it('fresh-state path: switching to a NEW tab resets the previous tab\'s large scrollTop to 0, immediately and after the rAF', () => {
        const t = setup();
        t.set(250000);
        t.rerender(t.el('b', 'bbb'));
        expect(t.get()).toBe(0);
        flush();
        expect(t.get()).toBe(0); // no cached scroll, no initialScroll: lands at 0, not at the previous offset
    });

    it('cached-state path: switching back to a cached tab resets to 0 immediately (not the leaving tab\'s offset), even when that tab\'s cached scroll is 0', () => {
        const t = setup();
        t.rerender(t.el('b', 'bbb'));           // a -> b (b new, scrolled 0)
        flush();
        t.rerender(t.el('a', 'aaa'));           // b -> a, leaves b cached with scroll 0
        flush();
        t.set(250000);
        t.rerender(t.el('b', 'bbb'));           // a -> b, cached state, cached scroll 0
        expect(t.get()).toBe(0);
        flush();
        expect(t.get()).toBe(0);
    });

    it('cached scroll still wins: a tab scrolled to 3000, left and returned to, is at 0 right after the switch and at 3000 after the rAF', () => {
        const t = setup();
        t.set(3000);
        t.rerender(t.el('b', 'bbb'));
        flush();
        expect(t.get()).toBe(0);
        t.set(90000);                            // b scrolled far; must not leak into a
        t.rerender(t.el('a', 'aaa'));
        expect(t.get()).toBe(0);                 // before the restore
        flush();
        expect(t.get()).toBe(3000);
    });

    it('initialScroll prop still wins for a new tab: 0 right after the switch, the prop value after the rAF', () => {
        const t = setup();
        t.set(250000);
        t.rerender(t.el('c', 'ccc', 700));
        expect(t.get()).toBe(0);
        flush();
        expect(t.get()).toBe(700);
    });

    it('no behaviour change without a tab switch: re-rendering the same active tab leaves scrollTop alone', () => {
        const t = setup();
        t.set(4000);
        t.rerender(<Editor tabIds={['a', 'b']} initialCursor={0} onContentChange={vi.fn()} onStatsUpdate={vi.fn()} onStateChange={vi.fn()} activeTabId="a" initialContent="aaa" initialScroll={0} />);
        flush();
        expect(t.get()).toBe(4000);
    });
});
