import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { CheckboxWidget, TextSpanWidget } from '../widgets';

// The toggle lives in CheckboxWidget.toDOM's `mousedown` handler: it reads
// view.state.doc at view.posAtDOM(input) (the widget replaces exactly the TaskMarker
// "[ ]", so that is the "[") and view.dispatch()es a single 1-char replacement.
//
// It needs (a) a real view for view.state.doc + view.dispatch, and (b)
// view.posAtDOM(input) to locate the widget in the doc. jsdom has no layout, so
// rather than wire a full live-preview render we mount a minimal view and stub
// view.posAtDOM to return the offset of the "[" on the task line — the handler
// only uses that position to resolve `line` and `line.from`.
//
// Pinned toggle contract (audit #11, extended for quoted/ordered tasks):
//   - the 3 chars at posAtDOM must match /^\[[ xX]\]$/, else no dispatch, doc unchanged
//   - any checked state ('x' OR 'X') toggles to ' '; ' ' toggles to 'x' (lowercase)
//   - only the single char between the brackets changes, whatever precedes the bracket
//     (indent, `> `, `> > `, callout, `+`, `1.` bullets: Lezer parses all as Task/TaskMarker
//     and livePreview renders a box for each, so each must be savable)
//   - the input's click is defaultPrevented so the native toggle can never desync from the doc
const setup = (doc) => {
    const view = new EditorView({
        state: EditorState.create({ doc }),
        parent: document.createElement('div'),
    });
    const bracketPos = doc.lastIndexOf('['); // the task marker's "[" (last line, after any callout header)
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

    const more = [
        ['> - [ ] t', '> - [x] t', 'blockquote'],
        ['> - [x] t', '> - [ ] t', 'blockquote, checked'],
        ['> > - [x] t', '> > - [ ] t', 'nested blockquote'],
        ['> [!todo] T\n> - [ ] t', '> [!todo] T\n> - [x] t', 'callout task line'],
        ['+ [ ] t', '+ [x] t', 'plus bullet'],
        ['+ [X] t', '+ [ ] t', 'plus bullet, uppercase'],
        ['1. [ ] t', '1. [x] t', 'ordered item'],
        ['1. [x] t', '1. [ ] t', 'ordered item, checked'],
        ['  > - [X] t', '  > - [ ] t', 'indented blockquote, uppercase'],
    ];
    for (const [before, after, name] of more) {
        it(`${name}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`, () => {
            const { view, fire } = setup(before);
            fire();
            expect(view.state.doc.toString()).toBe(after);
        });
    }

    it('no dispatch when the 3 chars at posAtDOM are not "[?]"', () => {
        for (const doc of ['> - [ ] t', '- [ ] t', '- [y] t']) {
            const { view, input } = setup(doc);
            view.posAtDOM = () => (doc.includes('[y]') ? doc.indexOf('[') : 0);
            input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            expect(view.state.doc.toString()).toBe(doc);
        }
    });

    it('click on the checkbox is defaultPrevented (DOM state comes only from the doc)', () => {
        const { input } = setup('> - [ ] t');
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        input.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
    });
});

describe('TextSpanWidget as entity (cm-entity) — decoded HTML entity as a text-only span (audit #3)', () => {
    // Pinned contract:
    //   TextSpanWidget(text, className): text stores the already-decoded string.
    //   toDOM() -> <span class="cm-entity"> whose textContent === ch, set via
    //     textContent (NEVER innerHTML) — so no element children.
    //   eq(other) -> same text and className
    //   ignoreEvent() -> false
    it('toDOM() is a bare SPAN.cm-entity with textContent === ch and no element children', () => {
        const dom = new TextSpanWidget('&', 'cm-entity').toDOM();
        expect(dom.tagName).toBe('SPAN');
        expect(dom.textContent).toBe('&');
        expect(dom.className).toContain('cm-entity');
        expect(dom.children.length).toBe(0);
        expect(dom.querySelector('*')).toBe(null);
    });

    it('renders a multi-char decoded value literally (no HTML interpretation)', () => {
        const dom = new TextSpanWidget('<b>', 'cm-entity').toDOM();
        expect(dom.textContent).toBe('<b>');
        expect(dom.children.length).toBe(0);
    });

    it('eq: true for the same char, false for a different char', () => {
        expect(new TextSpanWidget('&', 'cm-entity').eq(new TextSpanWidget('&', 'cm-entity'))).toBe(true);
        expect(new TextSpanWidget('&', 'cm-entity').eq(new TextSpanWidget('<', 'cm-entity'))).toBe(false);
    });

    it('ignoreEvent() returns false', () => {
        expect(new TextSpanWidget('&', 'cm-entity').ignoreEvent()).toBe(false);
    });
});

describe('TextSpanWidget as ordered marker (cm-ordered-marker) — computed ordered-list marker (Task 7 / audit #12)', () => {
    // Pinned contract (same 4-method shape as BulletWidget):
    //   TextSpanWidget(text, className): text stores the already-formatted marker string ("2.", "6)", ...).
    //   toDOM() -> <span class="cm-ordered-marker"> whose textContent === text, set via
    //     textContent (no element children).
    //   eq(other) -> same text and className
    //   ignoreEvent() -> false
    it('toDOM() is a bare SPAN.cm-ordered-marker with textContent === text and no element children', () => {
        const dom = new TextSpanWidget('2.', 'cm-ordered-marker').toDOM();
        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toContain('cm-ordered-marker');
        expect(dom.textContent).toBe('2.');
        expect(dom.children.length).toBe(0);
        expect(dom.querySelector('*')).toBe(null);
    });

    it('preserves a ")" delimiter verbatim in the rendered text', () => {
        expect(new TextSpanWidget('3)', 'cm-ordered-marker').toDOM().textContent).toBe('3)');
    });

    it('eq: true for the same text, false for a different text', () => {
        expect(new TextSpanWidget('2.', 'cm-ordered-marker').eq(new TextSpanWidget('2.', 'cm-ordered-marker'))).toBe(true);
        expect(new TextSpanWidget('2.', 'cm-ordered-marker').eq(new TextSpanWidget('3.', 'cm-ordered-marker'))).toBe(false);
    });

    it('ignoreEvent() returns false', () => {
        expect(new TextSpanWidget('1.', 'cm-ordered-marker').ignoreEvent()).toBe(false);
    });
});
