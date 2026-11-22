import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { textDirection } from '../textDirection';

const dirs = (doc) => {
    const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), textDirection] });
    ensureSyntaxTree(state, doc.length, 5000);
    const view = new EditorView({ state, parent: document.body });
    return [...view.dom.querySelectorAll('.cm-line')].map((l) => l.getAttribute('dir'));
};

describe('textDirection: line prefixes', () => {
    it('sanity: plain Hebrew line is rtl, plain English is not', () => {
        expect(dirs('שלום')).toEqual(['rtl']);
        expect(dirs('Hello')).toEqual([null]);
    });
    it.each(['> [!note] שלום', '> [!note]- שלום', '> - שלום', '> > שלום', '- [ ] שלום', '> - [ ] שלום'])('%s is rtl', (l) => {
        expect(dirs(l)).toEqual(['rtl']);
    });
    it.each(['> [!note] Hello', '> - Hello', '> [!note]'])('%s is not rtl', (l) => {
        expect(dirs(l)).toEqual([null]);
    });
});
