import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree, forceParsing } from '@codemirror/language';
import { decorationField } from '../decorationField';

// Contract: decorationField(build) -> extension; build(state) -> DecorationSet.
// Rebuild iff doc changed || tr.selection set || syntaxTree(startState) !== syntaxTree(state).
// Otherwise the SAME DecorationSet object is returned (NOT mapped) - identical to the
// pre-extraction mathField / footnoteField behaviour.

class Tag extends WidgetType {
    constructor(text) { super(); this.text = text; }
    toDOM() { const el = document.createElement('span'); el.className = 'df-tag'; el.textContent = this.text; return el; }
    eq(o) { return o.text === this.text; }
}

const views = [];
afterEach(() => { while (views.length) views.pop().destroy(); });

// Field value is read back through EditorView.decorations facet: collect sets for assertions.
const setup = (doc, { build, anchor = 0, withMarkdown = false } = {}) => {
    const spy = vi.fn(build ?? (() => Decoration.none));
    const field = decorationField(spy);
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor },
            extensions: [withMarkdown ? markdown() : [], field],
        }),
        parent,
    });
    views.push(view);
    const decos = () => {
        const sets = view.state.facet(EditorView.decorations).filter((s) => typeof s !== 'function');
        return sets[0];
    };
    return { view, spy, field, decos };
};

const tagBuild = (state) => Decoration.set([
    Decoration.widget({ widget: new Tag('W' + state.doc.length), side: 1 }).range(0),
]);

describe('decorationField', () => {
    it('returns a usable extension (accepted by EditorState.create)', () => {
        const ext = decorationField(() => Decoration.none);
        expect(ext).toBeTruthy();
        expect(() => EditorState.create({ doc: 'a', extensions: [ext] })).not.toThrow();
    });

    it('calls build exactly once on create, with the created state', () => {
        const seen = [];
        const { spy, view } = setup('hello', { build: (s) => { seen.push(s); return Decoration.none; } });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(seen[0].doc.toString()).toBe('hello');
        expect(seen[0]).toBe(view.state);
    });

    it('provides decorations to the view: widget from build appears in the DOM', () => {
        const { view } = setup('abc', { build: tagBuild });
        const el = view.dom.querySelector('.df-tag');
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('W3');
    });

    it('provides mark decorations too (class on text)', () => {
        const { view } = setup('abc', {
            build: () => Decoration.set([Decoration.mark({ class: 'df-mark' }).range(0, 2)]),
        });
        expect(view.dom.querySelector('.df-mark')?.textContent).toBe('ab');
    });

    it('rebuilds on doc change, passing the NEW state; DOM follows', () => {
        const { view, spy } = setup('abc', { build: tagBuild });
        view.dispatch({ changes: { from: 3, insert: 'de' } });
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0].doc.toString()).toBe('abcde');
        expect(view.dom.querySelector('.df-tag').textContent).toBe('W5');
    });

    it('rebuilds on selection change', () => {
        const { view, spy } = setup('abc', { build: tagBuild });
        view.dispatch({ selection: { anchor: 2 } });
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0].selection.main.anchor).toBe(2);
    });

    it('rebuilds when a transaction sets selection even to the same position (tr.selection truthy, pinned)', () => {
        const { view, spy } = setup('abc', { build: tagBuild, anchor: 1 });
        view.dispatch({ selection: { anchor: 1 } });
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('rebuilds once when doc and selection change together', () => {
        const { view, spy } = setup('abc', { build: tagBuild });
        view.dispatch({ changes: { from: 0, insert: 'x' }, selection: { anchor: 2 } });
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('does NOT rebuild on an unrelated transaction; value is the same object', () => {
        const { view, spy, decos } = setup('abc', { build: tagBuild });
        const before = decos();
        view.dispatch({ scrollIntoView: true });
        view.dispatch({ userEvent: 'noop' });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(decos()).toBe(before);
    });

    it('non-rebuild transactions do not map: same set object even across an annotation-only tr', () => {
        const { view, decos } = setup('abc', { build: tagBuild });
        const before = decos();
        view.dispatch({ effects: [] });
        expect(decos()).toBe(before);
    });

    it('rebuilds when syntaxTree changes without doc or selection change (incremental parse)', () => {
        const doc = Array.from({ length: 30000 }, (_, i) => `- item **${i}** text with \`code\` and [link](http://x/${i})`).join('\n');
        const { view, spy } = setup(doc, { build: tagBuild, withMarkdown: true });
        const treeBefore = syntaxTree(view.state);
        const callsBefore = spy.mock.calls.length;
        forceParsing(view, view.state.doc.length, 5000);
        const treeAfter = syntaxTree(view.state);
        // Precondition: the initial parse must have been partial, else this test proves nothing.
        expect(treeAfter).not.toBe(treeBefore);
        expect(spy.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('does not rebuild when the tree is unchanged (same tree object, no doc/selection change)', () => {
        const { view, spy } = setup('# hi\n\ntext', { build: tagBuild, withMarkdown: true });
        forceParsing(view, view.state.doc.length, 5000);
        const calls = spy.mock.calls.length;
        const tree = syntaxTree(view.state);
        view.dispatch({ scrollIntoView: true });
        expect(syntaxTree(view.state)).toBe(tree);
        expect(spy.mock.calls.length).toBe(calls);
    });

    it('two fields from separate calls are independent', () => {
        const a = vi.fn(() => Decoration.none), b = vi.fn(() => Decoration.none);
        const state = EditorState.create({ doc: 'x', extensions: [decorationField(a), decorationField(b)] });
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        state.update({ selection: { anchor: 1 } }).state;
        expect(a).toHaveBeenCalledTimes(2);
        expect(b).toHaveBeenCalledTimes(2);
    });

    it('build exceptions propagate (not swallowed)', () => {
        expect(() => EditorState.create({ doc: 'x', extensions: [decorationField(() => { throw new Error('boom'); })] }))
            .toThrow('boom');
    });

    it('empty doc: build still called, no widgets rendered when build returns none', () => {
        const { view, spy } = setup('');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(view.dom.querySelector('.df-tag')).toBeNull();
    });
});
