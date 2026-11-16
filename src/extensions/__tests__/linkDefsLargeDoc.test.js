import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { resolveLinkDefs, resolveReference } from '../linkDefs';
import { imagePreview } from '../imagePreview';

// Backlog B2: on a big doc the Lezer parse is time-sliced, so definitions at the
// END may be missing from the tree when a state is created. resolveLinkDefs
// memoizes per state; the question is whether a stale partial answer is ever
// reused once a fuller tree exists.

const extensions = [markdown({ base: markdownLanguage, extensions: [fastLinkEnd] })];

// ~1.5 MB of paragraphs, refs at the top, definitions at the very end.
const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.\n\n';
const bigDoc = () =>
    'See [the site][home] and ![logo][pic] here.\n\n' +
    para.repeat(19000) +
    '[home]: https://example.com/home\n[pic]: https://example.com/pic.png\n';

const noteDefs = (m) => [m.get('home')?.url, m.get('pic')?.url];

describe('resolveLinkDefs on a large, incrementally parsed document (B2)', () => {
    it('a state created before the parse finishes may be partial, but the next state sees the defs', () => {
        const state0 = EditorState.create({ doc: bigDoc(), extensions });
        expect(state0.doc.length).toBeGreaterThan(1_000_000);

        // (a) right after creation: whatever the budget allowed. Do not assert completeness.
        const partial = resolveLinkDefs(state0);
        const partialTreeLen = syntaxTree(state0).length;

        // (b) finish the parse
        const done = ensureSyntaxTree(state0, state0.doc.length, 30000);
        expect(done, 'parse must complete within 30s').toBeTruthy();
        expect(done.length).toBe(state0.doc.length);

        // (c) next state after a trivial transaction: must read the complete tree
        const state1 = state0.update({}).state;
        expect(syntaxTree(state1).length).toBe(state1.doc.length);
        expect(noteDefs(resolveLinkDefs(state1))).toEqual([
            'https://example.com/home',
            'https://example.com/pic.png',
        ]);

        // memo is per state, not global: the partial Map is not handed to state1
        expect(resolveLinkDefs(state1)).not.toBe(partial);
        // Informational: partial only differs if the machine was too slow to parse in budget.
        if (partialTreeLen < state0.doc.length) expect(partial.size).toBeLessThan(2);
    });

    it('resolveReference for a top-of-doc reference link resolves on the complete-tree state', () => {
        const state0 = EditorState.create({ doc: bigDoc(), extensions });
        ensureSyntaxTree(state0, state0.doc.length, 30000);
        const state1 = state0.update({}).state;
        let found = 0;
        syntaxTree(state1).iterate({
            from: 0, to: 100,
            enter: (n) => {
                if (n.name === 'Link' || n.name === 'Image') {
                    found++;
                    expect(resolveReference(n.node, state1)?.url).toMatch(/^https:\/\/example\.com\//);
                }
            },
        });
        expect(found).toBe(2);
    });
});

describe('imagePreview rendering after the parse completes (B2, user-visible)', () => {
    it('![alt][id] near the top becomes an image widget once the tail has parsed, without further user input', () => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const view = new EditorView({
            state: EditorState.create({ doc: bigDoc(), selection: { anchor: bigDoc().length }, extensions: [...extensions, imagePreview] }),
            parent,
        });
        try {
            // Drive the parse to completion and let the view pick the finished tree up
            // the way CodeMirror's own parse worker does: an empty transaction.
            ensureSyntaxTree(view.state, view.state.doc.length, 30000);
            // Large docs (>1000 lines) debounce tree-only recomputes by 300 ms: fake clock, no flakiness.
            vi.useFakeTimers();
            view.dispatch({});
            expect(syntaxTree(view.state).length).toBe(view.state.doc.length);
            vi.advanceTimersByTime(400);
            expect(parent.querySelector('img'), 'image widget for ![logo][pic]').not.toBeNull();
        } finally {
            vi.useRealTimers();
            view.destroy();
            parent.remove();
        }
    });
});
