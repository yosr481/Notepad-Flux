import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { livePreview } from '../livePreview';
import { calloutPreview } from '../callouts';
import { mermaidPreview } from '../mermaidPreview';
import { renderMermaid } from '../../utils/mermaid';

vi.mock('../../utils/mermaid', () => ({ renderMermaid: vi.fn() }));

// Spec: Docs/internal/mermaid-spec.md ("Syntax", "Editor behaviour"). Offsets via doc.indexOf(unique substring).
// Pinned choices (spec silent / task contract):
//  - Block range = [opening fence start, closing fence end] (or doc end if unclosed). Any selection range
//    with range.from <= to && range.to >= from (isCursorTouching) shows raw source and NO mermaidPreview deco.
//  - Source passed to renderMermaid = lines strictly between the fences joined with "\n", no trailing newline.
//  - Not touching: ONE div.cm-mermaid[dir=ltr] replaces all block lines (fence lines included).
//  - Loading: class cm-mermaid-loading + textContent = source. Error: class cm-mermaid-error, message as text.
//  - Theme: 'dark' iff document.body.dataset.theme === 'dark', else 'default'. Body data-theme change
//    re-renders mounted widgets (MutationObserver), no polling.
//  - Widget eq = source + theme: moving the cursor around outside the block does not re-render.
//  - mousedown on widget: cursor to start of first body line; empty body -> end of opening fence line.
//  - Docs end with a "tail" paragraph so the default cursor (doc end) touches no block.
//  - vitest.config has no clearMocks: this file resets the mock itself in beforeEach (default = pending forever).
// Not drivable in jsdom: real CSS (max-width, faint loading text), real mouse hit-testing, real Mermaid output.

const views = [];
const mkView = (doc, anchor = doc.length, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor, head },
            extensions: [
                markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] }),
                livePreview, calloutPreview, mermaidPreview,
            ],
        }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};
const qa = (v, sel) => [...v.dom.querySelectorAll(sel)];
const q = (v, sel) => v.dom.querySelector(sel);
const widgets = (v) => qa(v, '.cm-mermaid');
const lineEl = (v, text) => qa(v, '.cm-line').find((l) => l.textContent.includes(text));
const mouse = (el) =>
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
const deferred = () => {
    let resolveFn;
    const promise = new Promise((r) => { resolveFn = r; });
    return { promise, resolve: resolveFn };
};
const setSel = (v, anchor, head = anchor) => v.dispatch({ selection: { anchor, head } });

beforeEach(() => {
    renderMermaid.mockReset();
    renderMermaid.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => {
    while (views.length) views.pop().destroy();
    delete document.body.dataset.theme;
    document.body.innerHTML = '';
});

const SRC = 'graph TD\nA-->B';
const DOC = `intro\n\n\`\`\`mermaid\n${SRC}\n\`\`\`\n\ntail`;
const blockFrom = (doc) => doc.indexOf('```mermaid');
const blockTo = (doc) => doc.indexOf('A-->B\n```') + 'A-->B\n```'.length;

describe('mermaidPreview: which fences count', () => {
    const cases = [
        ['backtick fence', 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\ntail', true],
        ['tilde fence', 'intro\n\n~~~mermaid\ngraph TD\nA-->B\n~~~\n\ntail', true],
        ['long fence', 'intro\n\n`````mermaid\ngraph TD\nA-->B\n`````\n\ntail', true],
        ['uppercase info', 'intro\n\n```MERMAID\ngraph TD\nA-->B\n```\n\ntail', true],
        ['mixed case + extra words', 'intro\n\n~~~ Mermaid extra\ngraph TD\nA-->B\n~~~\n\ntail', true],
        ['unclosed fence to doc end', 'intro\n\n```mermaid\ngraph TD\nA-->B', true, 0],
        ['mermaidx is not mermaid', 'intro\n\n```mermaidx\ngraph TD\nA-->B\n```\n\ntail', false],
        ['js fence', 'intro\n\n```js\nlet a = 1;\n```\n\ntail', false],
        ['no info string', 'intro\n\n```\ngraph TD\nA-->B\n```\n\ntail', false],
        ['indented code', 'intro\n\n    mermaid\n    graph TD\n\ntail', false],
    ];
    for (const [name, doc, yes, cursor] of cases) {
        it(`${name}: ${yes ? 'one widget' : 'no widget'}`, () => {
            const v = mkView(doc, cursor ?? doc.length);
            expect(widgets(v)).toHaveLength(yes ? 1 : 0);
            expect(renderMermaid).toHaveBeenCalledTimes(yes ? 1 : 0);
        });
    }

    it('unclosed fence: source is everything after the opening fence line to doc end', () => {
        mkView('intro\n\n```mermaid\ngraph TD\nA-->B', 0);
        expect(renderMermaid).toHaveBeenCalledWith('graph TD\nA-->B', { theme: 'default' });
    });
});

describe('mermaidPreview: block replace (cursor outside)', () => {
    it('one div.cm-mermaid[dir=ltr] replaces every block line, fences included; other lines stay', () => {
        const v = mkView(DOC);
        const w = widgets(v);
        expect(w).toHaveLength(1);
        expect(w[0].getAttribute('dir')).toBe('ltr');
        expect(lineEl(v, '```mermaid')).toBeUndefined();
        expect(lineEl(v, 'graph TD')).toBeUndefined();
        expect(lineEl(v, 'A-->B')).toBeUndefined();
        expect(lineEl(v, 'intro')).toBeTruthy();
        expect(lineEl(v, 'tail')).toBeTruthy();
    });

    it('renderMermaid gets the body only (no fence lines) and the default theme', () => {
        mkView(DOC);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        expect(renderMermaid).toHaveBeenCalledWith(SRC, { theme: 'default' });
    });

    it('longer fence / tilde body is passed as is (a ``` line inside a ````-fence is body)', () => {
        mkView('intro\n\n````mermaid\ngraph TD\n```\nA-->B\n````\n\ntail');
        expect(renderMermaid).toHaveBeenCalledWith('graph TD\n```\nA-->B', { theme: 'default' });
    });
});

describe('mermaidPreview: cursor touching shows raw source, no decoration at all', () => {
    const touching = {
        'cursor at block start': (d) => [blockFrom(d)],
        'cursor at block end': (d) => [blockTo(d)],
        'cursor inside the body': (d) => [d.indexOf('A-->B') + 2],
        'cursor on the opening fence line': (d) => [d.indexOf('mermaid') + 3],
        'range spanning the whole block': (d) => [blockFrom(d) - 2, blockTo(d) + 2],
        'range ending exactly at block start': (d) => [0, blockFrom(d)],
        'range starting exactly at block end': (d) => [blockTo(d), d.length],
    };
    for (const [name, pick] of Object.entries(touching)) {
        it(name, () => {
            const [a, b] = pick(DOC);
            const v = mkView(DOC, a, b ?? a);
            expect(widgets(v)).toHaveLength(0);
            expect(qa(v, '.cm-mermaid-loading, .cm-mermaid-error')).toHaveLength(0);
            expect(lineEl(v, '```mermaid')).toBeTruthy();
            expect(lineEl(v, 'graph TD')).toBeTruthy();
            expect(lineEl(v, 'A-->B')).toBeTruthy();
            expect(renderMermaid).not.toHaveBeenCalled();
        });
    }

    it('cursor one char before the block (the blank line before) is outside', () => {
        // blockFrom - 1 is the blank line's own end: strictly before the block, so NOT touching.
        const v = mkView(DOC, blockFrom(DOC) - 1);
        expect(widgets(v)).toHaveLength(1);
    });

    it('cursor one char after the block end is outside', () => {
        const v = mkView(DOC, blockTo(DOC) + 1);
        expect(widgets(v)).toHaveLength(1);
    });

    it('moving the cursor into the block removes the widget; moving out brings it back', () => {
        const v = mkView(DOC);
        expect(widgets(v)).toHaveLength(1);
        setSel(v, DOC.indexOf('A-->B'));
        expect(widgets(v)).toHaveLength(0);
        expect(lineEl(v, 'A-->B')).toBeTruthy();
        setSel(v, DOC.length);
        expect(widgets(v)).toHaveLength(1);
    });
});

describe('mermaidPreview: widget DOM and render results', () => {
    it('right after creation: cm-mermaid-loading and textContent = body source', () => {
        const d = deferred();
        renderMermaid.mockReturnValue(d.promise);
        const v = mkView(DOC);
        const w = widgets(v)[0];
        expect(w.classList.contains('cm-mermaid-loading')).toBe(true);
        expect(w.textContent).toBe(SRC);
    });

    it('{ svg }: loading class removed, markup inserted as innerHTML', async () => {
        renderMermaid.mockResolvedValue({ svg: '<svg id="dia1"><g class="node"></g></svg>' });
        const v = mkView(DOC);
        await vi.waitFor(() => expect(q(v, '.cm-mermaid svg#dia1')).toBeTruthy());
        const w = widgets(v)[0];
        expect(w.classList.contains('cm-mermaid-loading')).toBe(false);
        expect(w.classList.contains('cm-mermaid-error')).toBe(false);
        expect(w.querySelector('g.node')).toBeTruthy();
        expect(w.getAttribute('dir')).toBe('ltr');
    });

    it('{ error }: cm-mermaid-error, loading removed, message shown', async () => {
        renderMermaid.mockResolvedValue({ error: 'Parse error on line 2' });
        const v = mkView(DOC);
        await vi.waitFor(() => expect(q(v, '.cm-mermaid.cm-mermaid-error')).toBeTruthy());
        const w = widgets(v)[0];
        expect(w.classList.contains('cm-mermaid-loading')).toBe(false);
        expect(w.textContent).toContain('Parse error on line 2');
        expect(w.querySelector('svg')).toBeNull();
    });

    it('{ error } with markup is literal text, never elements', async () => {
        renderMermaid.mockResolvedValue({ error: '<b>x</b><img src=x onerror=alert(1)>' });
        const v = mkView(DOC);
        await vi.waitFor(() => expect(q(v, '.cm-mermaid-error')).toBeTruthy());
        const w = widgets(v)[0];
        expect(w.querySelector('b')).toBeNull();
        expect(w.querySelector('img')).toBeNull();
        expect(w.textContent).toContain('<b>x</b>');
    });

    it('a result arriving after the widget was destroyed does not throw', async () => {
        const d = deferred();
        renderMermaid.mockReturnValue(d.promise);
        const v = mkView(DOC);
        setSel(v, DOC.indexOf('A-->B')); // widget removed
        d.resolve({ svg: '<svg id="late"></svg>' });
        await d.promise;
        await Promise.resolve();
        expect(q(v, 'svg#late')).toBeNull();
    });

    it('a rejecting renderMermaid (contract breach) does not escape into the editor', async () => {
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        renderMermaid.mockRejectedValue(new Error('boom'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const v = mkView(DOC);
        await vi.waitFor(() => expect(spy).toHaveBeenCalled());
        await Promise.resolve();
        process.off('unhandledRejection', unhandled);
        spy.mockRestore();
        expect(unhandled).not.toHaveBeenCalled();
        expect(widgets(v)).toHaveLength(1); // still the loading box with raw source
        expect(widgets(v)[0].textContent).toBe(SRC);
    });
});

describe('mermaidPreview: theme', () => {
    it("body data-theme=dark at creation -> renderMermaid(source, { theme: 'dark' })", () => {
        document.body.dataset.theme = 'dark';
        mkView(DOC);
        expect(renderMermaid).toHaveBeenCalledWith(SRC, { theme: 'dark' });
    });

    it("data-theme=light or absent or anything else -> 'default'", () => {
        document.body.dataset.theme = 'light';
        mkView(DOC);
        expect(renderMermaid).toHaveBeenLastCalledWith(SRC, { theme: 'default' });
        document.body.dataset.theme = 'sepia';
        mkView(DOC);
        expect(renderMermaid).toHaveBeenLastCalledWith(SRC, { theme: 'default' });
    });

    it('changing body data-theme re-renders the mounted widget with the new theme', async () => {
        renderMermaid.mockResolvedValue({ svg: '<svg id="a"></svg>' });
        const v = mkView(DOC);
        await vi.waitFor(() => expect(q(v, 'svg#a')).toBeTruthy());
        renderMermaid.mockClear();
        renderMermaid.mockResolvedValue({ svg: '<svg id="b"></svg>' });
        document.body.dataset.theme = 'dark';
        await vi.waitFor(() => expect(renderMermaid).toHaveBeenCalledWith(SRC, { theme: 'dark' }));
        await vi.waitFor(() => expect(q(v, '.cm-mermaid svg#b')).toBeTruthy());
        expect(widgets(v)).toHaveLength(1);
        // and back
        document.body.dataset.theme = 'light';
        await vi.waitFor(() => expect(renderMermaid).toHaveBeenLastCalledWith(SRC, { theme: 'default' }));
    });

    it('every mounted widget re-renders on a theme change', async () => {
        const doc = 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\nmid\n\n```mermaid\npie\n"a": 1\n```\n\ntail';
        mkView(doc);
        renderMermaid.mockClear();
        document.body.dataset.theme = 'dark';
        await vi.waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(2));
        const sources = renderMermaid.mock.calls.map((c) => c[0]).sort();
        expect(sources).toEqual(['graph TD\nA-->B', 'pie\n"a": 1'].sort());
        for (const c of renderMermaid.mock.calls) expect(c[1]).toEqual({ theme: 'dark' });
    });

    it('a destroyed view no longer re-renders on theme change', async () => {
        const v = mkView(DOC);
        v.destroy();
        views.pop();
        renderMermaid.mockClear();
        document.body.dataset.theme = 'dark';
        await Promise.resolve(); // MutationObserver callbacks are microtasks
        await Promise.resolve();
        expect(renderMermaid).not.toHaveBeenCalled();
    });
});

describe('mermaidPreview: widget identity (eq = source + theme)', () => {
    it('moving the cursor elsewhere outside the block does not render again', () => {
        const v = mkView(DOC);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        const w = widgets(v)[0];
        setSel(v, 0);
        setSel(v, 3);
        setSel(v, DOC.length);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        expect(widgets(v)[0]).toBe(w);
    });

    it('typing outside the block does not render again', () => {
        const v = mkView(DOC);
        v.dispatch({ changes: { from: DOC.length, insert: ' more' }, selection: { anchor: DOC.length + 5 } });
        expect(renderMermaid).toHaveBeenCalledTimes(1);
    });

    it('editing the source, then leaving, renders the new source', () => {
        const v = mkView(DOC);
        const at = DOC.indexOf('graph TD');
        setSel(v, at);
        v.dispatch({ changes: { from: at, insert: 'X' }, selection: { anchor: at + 1 } });
        renderMermaid.mockClear();
        setSel(v, v.state.doc.length);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        expect(renderMermaid).toHaveBeenCalledWith('Xgraph TD\nA-->B', { theme: 'default' });
    });
});

describe('mermaidPreview: mousedown on the widget', () => {
    it('puts the cursor at the start of the first body line; raw source appears', () => {
        const v = mkView(DOC);
        mouse(widgets(v)[0]);
        expect(v.state.selection.main.empty).toBe(true);
        expect(v.state.selection.main.head).toBe(DOC.indexOf('graph TD'));
        expect(widgets(v)).toHaveLength(0);
        expect(lineEl(v, '```mermaid')).toBeTruthy();
        expect(lineEl(v, 'graph TD')).toBeTruthy();
    });

    it('works for the second of two blocks and leaves the first rendered', () => {
        const doc = 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\nmid\n\n```mermaid\npie\n"a": 1\n```\n\ntail';
        const v = mkView(doc);
        expect(widgets(v)).toHaveLength(2);
        mouse(widgets(v)[1]);
        expect(v.state.selection.main.head).toBe(doc.indexOf('pie'));
        expect(widgets(v)).toHaveLength(1);
        expect(lineEl(v, 'pie')).toBeTruthy();
    });

    it('empty body: cursor goes to the end of the opening fence line', () => {
        const doc = 'intro\n\n```mermaid\n```\n\ntail';
        const v = mkView(doc);
        expect(widgets(v)).toHaveLength(1);
        mouse(widgets(v)[0]);
        expect(v.state.selection.main.head).toBe(doc.indexOf('```mermaid') + '```mermaid'.length);
        expect(widgets(v)).toHaveLength(0);
    });

    it('the document is not changed by the click', () => {
        const v = mkView(DOC);
        mouse(widgets(v)[0]);
        expect(v.state.doc.toString()).toBe(DOC);
    });
});

describe('mermaidPreview: several blocks, neighbours', () => {
    it('two mermaid blocks render independently with their own source', () => {
        const doc = 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\nmid\n\n~~~mermaid\npie\n"a": 1\n~~~\n\ntail';
        const v = mkView(doc);
        expect(widgets(v)).toHaveLength(2);
        const srcs = renderMermaid.mock.calls.map((c) => c[0]);
        expect(srcs).toContain('graph TD\nA-->B');
        expect(srcs).toContain('pie\n"a": 1');
        expect(lineEl(v, 'mid')).toBeTruthy();
    });

    it('cursor in one block leaves the other rendered', () => {
        const doc = 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\nmid\n\n```mermaid\npie\n"a": 1\n```\n\ntail';
        const v = mkView(doc, doc.indexOf('pie'));
        expect(widgets(v)).toHaveLength(1);
        expect(widgets(v)[0].textContent).toBe('graph TD\nA-->B');
        expect(lineEl(v, 'pie')).toBeTruthy();
    });

    it('a second block resolving independently: one svg, one error', async () => {
        renderMermaid.mockImplementation(async (s) =>
            s.startsWith('pie') ? { error: 'bad pie' } : { svg: '<svg id="ok"></svg>' });
        const doc = 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\nmid\n\n```mermaid\npie\n"a": 1\n```\n\ntail';
        const v = mkView(doc);
        await vi.waitFor(() => expect(q(v, 'svg#ok')).toBeTruthy());
        await vi.waitFor(() => expect(q(v, '.cm-mermaid-error')).toBeTruthy());
        expect(qa(v, '.cm-mermaid-error')).toHaveLength(1);
        expect(q(v, '.cm-mermaid-error').textContent).toContain('bad pie');
    });

    it('a non-mermaid fence next to a mermaid block is untouched', () => {
        const doc = 'intro\n\n```js\nlet a = 1;\n```\n\n```mermaid\ngraph TD\nA-->B\n```\n\ntail';
        const v = mkView(doc);
        expect(widgets(v)).toHaveLength(1);
        expect(lineEl(v, 'let a = 1;')).toBeTruthy();
        expect(lineEl(v, 'graph TD')).toBeUndefined();
        expect(renderMermaid).toHaveBeenCalledTimes(1);
    });

    it('no mermaid block: nothing rendered, loader never called', () => {
        const v = mkView('just text\n\n```js\nx\n```\n\ntail');
        expect(widgets(v)).toHaveLength(0);
        expect(renderMermaid).not.toHaveBeenCalled();
    });

    it('empty document does not throw', () => {
        expect(() => mkView('')).not.toThrow();
    });
});

describe('mermaidPreview: nested containers (minimum: recognised, no throw)', () => {
    it('inside a blockquote', () => {
        let v;
        expect(() => { v = mkView('> ```mermaid\n> graph TD\n> A-->B\n> ```\n\ntail'); }).not.toThrow();
        expect(widgets(v)).toHaveLength(1);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        expect(renderMermaid.mock.calls[0][0]).toContain('graph TD');
    });

    it('inside a list item', () => {
        let v;
        expect(() => { v = mkView('- item\n\n  ```mermaid\n  graph TD\n  A-->B\n  ```\n\ntail'); }).not.toThrow();
        expect(widgets(v)).toHaveLength(1);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        expect(renderMermaid.mock.calls[0][0]).toContain('graph TD');
    });

    it('1-3 space indented fence is still a mermaid fence', () => {
        const v = mkView('intro\n\n   ```mermaid\n   graph TD\n   ```\n\ntail');
        expect(widgets(v)).toHaveLength(1);
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');

    it('mermaidPreview is imported from ../extensions/mermaidPreview', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bmermaidPreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/mermaidPreview['"]/);
    });

    it('mermaidPreview is in the extensions array, after calloutPreview', () => {
        expect(src).toMatch(/^\s*mermaidPreview,/m);
        expect(src.indexOf('mermaidPreview,')).toBeGreaterThan(src.indexOf('calloutPreview,'));
    });
});

describe('mermaidPreview: selection-only fast path', () => {
    // Identity, not timing: a cursor move that touches no block keeps the same decoration set object
    // (no rebuild, no new widgets); moving into a block gives a new one. Pre-fix logic rebuilt on every move.
    const mermaidSet = (v) => {
        const found = v.state.facet(EditorView.decorations).filter((d) => {
            if (typeof d === 'function') return false;
            let hit = false;
            d.between(0, v.state.doc.length, (_f, _t, val) => {
                if (val.spec.widget && 'source' in val.spec.widget) { hit = true; return false; }
            });
            return hit;
        });
        expect(found.length).toBe(1);
        return found[0];
    };

    it('move off every block keeps the same set; into a block gives a new one; out again gives a new one', () => {
        let doc = '';
        for (let i = 0; i < 40; i++) doc += `plain ${i}\n\n\`\`\`mermaid\ngraph TD\nA${i}-->B\n\`\`\`\n\n`;
        const v = mkView(doc, 0);
        const plain = (n) => doc.indexOf(`plain ${n}\n`) + 2;
        setSel(v, plain(5));
        const before = mermaidSet(v);
        setSel(v, plain(6));
        expect(mermaidSet(v)).toBe(before);
        setSel(v, plain(30));
        expect(mermaidSet(v)).toBe(before);
        setSel(v, doc.indexOf('A7-->B'));
        const inside = mermaidSet(v);
        expect(inside).not.toBe(before);
        expect(mermaidSet(v).size).toBe(39);
        setSel(v, plain(8));
        expect(mermaidSet(v)).not.toBe(inside);
        expect(mermaidSet(v).size).toBe(40);
    });
});
