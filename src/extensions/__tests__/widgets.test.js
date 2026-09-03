import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { CheckboxWidget, EntityWidget } from '../widgets';

// The toggle lives in CheckboxWidget.toDOM's `mousedown` handler: it reads
// view.state.doc, matches the task-line prefix, and view.dispatch()es a single
// 1-char replacement between the brackets.
//
// It needs (a) a real view for view.state.doc + view.dispatch, and (b)
// view.posAtDOM(input) to locate the widget in the doc. jsdom has no layout, so
// rather than wire a full live-preview render we mount a minimal view and stub
// view.posAtDOM to return the offset of the "[" on the task line — the handler
// only uses that position to resolve `line` and `line.from`.
//
// Pinned toggle contract (audit #11):
//   - line must match /^(\s*[-*+] )\[([ xX])\]/  (bullets -, *, +; inner ' ', 'x', 'X')
//   - any checked state ('x' OR 'X') toggles to ' '
//   - ' ' toggles to 'x' (lowercase)
//   - leading whitespace + bullet char preserved; only the single char between
//     the brackets is replaced (from = line.from + prefix.length + 1, length 1)
//   - non-matching lines (e.g. ordered "1. [ ]"): no dispatch
const setup = (doc) => {
    const view = new EditorView({
        state: EditorState.create({ doc }),
        parent: document.createElement('div'),
    });
    const bracketPos = doc.indexOf('[');
    view.posAtDOM = () => bracketPos;
    const input = new CheckboxWidget(true).toDOM(view);
    const fire = () =>
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    return { view, input, fire };
};

describe('CheckboxWidget toggle — GFM uppercase [X] + all bullet chars (audit #11)', () => {
    const cases = [
        ['- [X] task', '- [ ] task', 'uppercase X -> unchecked'],
        ['- [x] task', '- [ ] task', 'lowercase x -> unchecked (regression guard)'],
        ['- [ ] task', '- [x] task', 'empty -> checked, lowercase x (regression guard)'],
        ['* [X] task', '* [ ] task', 'star bullet, uppercase -> unchecked'],
        ['  - [X] nested', '  - [ ] nested', 'leading indent preserved'],
    ];

    for (const [before, after, name] of cases) {
        it(`${name}: "${before}" -> "${after}"`, () => {
            const { view, fire } = setup(before);
            fire();
            expect(view.state.doc.toString()).toBe(after);
        });
    }

    it('plus bullet is out of scope: "+ [ ] task" unchanged, no dispatch', () => {
        const { view, fire } = setup('+ [ ] task');
        fire();
        expect(view.state.doc.toString()).toBe('+ [ ] task');
    });

    it('ordered-list task item is out of scope: "1. [ ] ordered" unchanged, no dispatch', () => {
        const { view, fire } = setup('1. [ ] ordered');
        fire();
        expect(view.state.doc.toString()).toBe('1. [ ] ordered');
    });
});

describe('EntityWidget — decoded HTML entity as a text-only span (audit #3)', () => {
    // Pinned contract:
    //   constructor(ch) stores the already-decoded string.
    //   toDOM() -> <span class="cm-entity"> whose textContent === ch, set via
    //     textContent (NEVER innerHTML) — so no element children.
    //   eq(other) -> other.ch === this.ch
    //   ignoreEvent() -> false
    it('toDOM() is a bare SPAN.cm-entity with textContent === ch and no element children', () => {
        const dom = new EntityWidget('&').toDOM();
        expect(dom.tagName).toBe('SPAN');
        expect(dom.textContent).toBe('&');
        expect(dom.className).toContain('cm-entity');
        expect(dom.children.length).toBe(0);
        expect(dom.querySelector('*')).toBe(null);
    });

    it('renders a multi-char decoded value literally (no HTML interpretation)', () => {
        const dom = new EntityWidget('<b>').toDOM();
        expect(dom.textContent).toBe('<b>');
        expect(dom.children.length).toBe(0);
    });

    it('eq: true for the same char, false for a different char', () => {
        expect(new EntityWidget('&').eq(new EntityWidget('&'))).toBe(true);
        expect(new EntityWidget('&').eq(new EntityWidget('<'))).toBe(false);
    });

    it('ignoreEvent() returns false', () => {
        expect(new EntityWidget('&').ignoreEvent()).toBe(false);
    });
});
