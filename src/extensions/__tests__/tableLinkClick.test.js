import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { TableWidget } from '../widgets';

// Rendered table: plain click on a link puts the cursor in the table (raw markdown shows);
// only Ctrl/Cmd+Click follows the link. Same as links outside tables.
const DOC = 'intro\n\n| a |\n|---|\n| [x](https://example.com) |\n';
const TABLE_POS = DOC.indexOf('|');

const setup = () => {
    const view = new EditorView({
        state: EditorState.create({ doc: DOC, selection: { anchor: 0 } }),
        parent: document.body,
    });
    view.posAtDOM = () => TABLE_POS; // jsdom has no layout; widget start offset
    const data = {
        align: [null],
        head: [['a']],
        body: [[[{ k: 'a', href: 'https://example.com', c: ['x'] }]]],
    };
    const div = new TableWidget(data).toDOM(view);
    document.body.append(div);
    const a = div.querySelector('a');
    const cell = div.querySelector('tbody td');
    return { view, a, cell };
};
const fire = (el, type, init = {}) => {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
    el.dispatchEvent(ev);
    return ev;
};

describe('TableWidget link clicks', () => {
    it('sanity: table link is a real anchor with href', () => {
        const { a } = setup();
        expect(a.getAttribute('href')).toBe('https://example.com');
    });

    it('plain mousedown on a table link prevents default and moves the cursor to the table', () => {
        const { view, a } = setup();
        const ev = fire(a, 'mousedown');
        expect(ev.defaultPrevented).toBe(true);
        expect(view.state.selection.main.head).toBe(TABLE_POS);
    });

    it('control: plain mousedown on a non-link cell moves the cursor', () => {
        const { view, cell } = setup();
        const ev = fire(cell, 'mousedown');
        expect(ev.defaultPrevented).toBe(true);
        expect(view.state.selection.main.head).toBe(TABLE_POS);
    });

    for (const key of ['ctrlKey', 'metaKey']) {
        it(`${key} mousedown on a table link leaves the selection alone and is not prevented`, () => {
            const { view, a } = setup();
            const ev = fire(a, 'mousedown', { [key]: true });
            expect(view.state.selection.main.head).toBe(0);
            expect(ev.defaultPrevented).toBe(false);
        });
    }

    it('plain click on a table link is defaultPrevented (no navigation)', () => {
        const { a } = setup();
        expect(fire(a, 'click').defaultPrevented).toBe(true);
    });

    for (const key of ['ctrlKey', 'metaKey']) {
        it(`${key} click on a table link is not prevented (native open still works)`, () => {
            const { a } = setup();
            expect(fire(a, 'click', { [key]: true }).defaultPrevented).toBe(false);
        });
    }
});
