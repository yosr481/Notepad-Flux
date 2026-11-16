import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';
import { mathPreview } from '../mathPreview';
import { livePreview } from '../livePreview';
import { forceParsing } from '@codemirror/language';

// Spec: Docs/internal/math-spec.md ("Editor behaviour (mathPreview)").
// renderTex is mocked so the test controls when a render resolves (loading state);
// one test at the end uses the real MathJax.

const mocks = vi.hoisted(() => ({ renderTex: vi.fn(), isMathLoaded: vi.fn(() => false) }));
vi.mock('../../utils/math', () => ({
    renderTex: (...a) => mocks.renderTex(...a),
    isMathLoaded: () => mocks.isMathLoaded(),
}));

const svgFor = (tex) => `<svg data-tex="${tex}" xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`;
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

const views = [];
const mkView = (doc, anchor = 0, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor, head },
            extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax] }), mathPreview],
        }),
        parent,
    });
    views.push(view);
    return view;
};
const q = (v, sel) => v.dom.querySelector(sel);
const qa = (v, sel) => [...v.dom.querySelectorAll(sel)];

beforeEach(() => {
    mocks.renderTex.mockReset();
    mocks.renderTex.mockImplementation(async (tex) => svgFor(tex));
});
afterEach(() => { while (views.length) views.pop().destroy(); });

describe('mathPreview: inline', () => {
    const doc = 'a $x^2$ b';   // math range 2..7

    it('cursor outside: the $...$ range is replaced by a .cm-math-inline widget with the svg', async () => {
        const v = mkView(doc, 0);
        await flush();
        const w = q(v, '.cm-math.cm-math-inline');
        expect(w).not.toBeNull();
        expect(w.tagName).toBe('SPAN');
        expect(w.querySelector('svg')).not.toBeNull();
        expect(v.dom.textContent).not.toContain('$x^2$');
        expect(mocks.renderTex).toHaveBeenCalledWith('x^2', expect.objectContaining({ display: false }));
    });

    it('cursor strictly inside: raw TeX is shown and there is no widget', async () => {
        const v = mkView(doc, 4);
        await flush();
        expect(q(v, '.cm-math-inline')).toBeNull();
        expect(v.dom.textContent).toContain('$x^2$');
    });

    it('cursor touching either end counts as inside (raw shown)', async () => {
        for (const pos of [2, 7]) {
            const v = mkView(doc, pos);
            await flush();
            expect(q(v, '.cm-math-inline'), `pos ${pos}`).toBeNull();
            expect(v.dom.textContent).toContain('$x^2$');
        }
    });

    it('a selection overlapping the math shows raw; a selection elsewhere keeps the widget', async () => {
        const over = mkView(doc, 0, 4);
        await flush();
        expect(q(over, '.cm-math-inline')).toBeNull();
        const away = mkView('a $x^2$ b c d', 11, 13);
        await flush();
        expect(q(away, '.cm-math-inline')).not.toBeNull();
    });

    it('moving the cursor into the math swaps widget for raw text, and back out restores the widget', async () => {
        const v = mkView(doc, 0);
        await flush();
        expect(q(v, '.cm-math-inline')).not.toBeNull();
        v.dispatch({ selection: { anchor: 4 } });
        await flush();
        expect(q(v, '.cm-math-inline')).toBeNull();
        v.dispatch({ selection: { anchor: 9 } });
        await flush();
        expect(q(v, '.cm-math-inline')).not.toBeNull();
    });

    it('non-math text with dollars ("$5 and $10") never gets a widget', async () => {
        const v = mkView('costs $5 and $10', 0);
        await flush();
        expect(q(v, '.cm-math')).toBeNull();
        expect(mocks.renderTex).not.toHaveBeenCalled();
    });

    it('math in a code span is not rendered', async () => {
        const v = mkView('a `$x$` b', 0);
        await flush();
        expect(q(v, '.cm-math')).toBeNull();
        expect(mocks.renderTex).not.toHaveBeenCalled();
    });

    it('the widget is dir="ltr" (math in a Hebrew line does not reorder surrounding text)', async () => {
        const v = mkView('שלום $x$ עולם', 0);
        await flush();
        const w = q(v, '.cm-math-inline');
        expect(w).not.toBeNull();
        expect(w.getAttribute('dir')).toBe('ltr');
    });

    it('inline $$x$$ gets the cm-math-display class and renders with display: true', async () => {
        const v = mkView('a $$x$$ b', 0);
        await flush();
        const w = q(v, '.cm-math.cm-math-display');
        expect(w).not.toBeNull();
        expect(mocks.renderTex).toHaveBeenCalledWith('x', expect.objectContaining({ display: true }));
        const plain = mkView('a $x$ b', 0);
        await flush();
        expect(q(plain, '.cm-math-display')).toBeNull();
    });

    it('clicking the widget puts the cursor inside the math (raw TeX appears)', async () => {
        const v = mkView(doc, 0);
        await flush();
        const w = q(v, '.cm-math-inline');
        for (const t of ['mousedown', 'mouseup', 'click']) {
            w.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 0 }));
        }
        await flush();
        const head = v.state.selection.main.head;
        expect(head).toBeGreaterThanOrEqual(2);
        expect(head).toBeLessThanOrEqual(7);
        expect(q(v, '.cm-math-inline')).toBeNull();
        expect(v.dom.textContent).toContain('$x^2$');
    });
});

describe('mathPreview: block', () => {
    const doc = 'para\n\n$$\nx^2\n$$\n\nafter';
    const inside = doc.indexOf('x^2');

    it('cursor outside: the block is replaced by a div.cm-math-block widget, raw lines hidden', async () => {
        const v = mkView(doc, 0);
        await flush();
        const w = q(v, '.cm-math.cm-math-block');
        expect(w).not.toBeNull();
        expect(w.tagName).toBe('DIV');
        expect(w.classList.contains('cm-math-preview')).toBe(false);
        expect(w.querySelector('svg')).not.toBeNull();
        expect(v.dom.textContent).not.toContain('x^2$$');
        expect(qa(v, '.cm-line').some((l) => l.textContent.includes('x^2'))).toBe(false);
        expect(mocks.renderTex).toHaveBeenCalledWith(expect.stringContaining('x^2'), expect.objectContaining({ display: true }));
    });

    it('cursor inside: raw lines are shown plus one .cm-math-preview widget below the block', async () => {
        const v = mkView(doc, inside);
        await flush();
        expect(qa(v, '.cm-line').some((l) => l.textContent.includes('x^2'))).toBe(true);
        const previews = qa(v, '.cm-math.cm-math-block.cm-math-preview');
        expect(previews).toHaveLength(1);
        expect(previews[0].querySelector('svg')).not.toBeNull();
        expect(qa(v, '.cm-math-block:not(.cm-math-preview)')).toHaveLength(0);
        // preview sits after the raw lines in document order
        const raw = qa(v, '.cm-line').find((l) => l.textContent.includes('x^2'));
        expect(raw.compareDocumentPosition(previews[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('cursor on the opening or closing $$ line counts as inside', async () => {
        for (const pos of [doc.indexOf('$$'), doc.indexOf('$$', doc.indexOf('x^2'))]) {
            const v = mkView(doc, pos);
            await flush();
            expect(qa(v, '.cm-math-block:not(.cm-math-preview)'), `pos ${pos}`).toHaveLength(0);
            expect(q(v, '.cm-math-preview'), `pos ${pos}`).not.toBeNull();
        }
    });

    it('single-line $$x$$ block renders as a block widget when the cursor is elsewhere', async () => {
        const v = mkView('$$x$$\n\ntail', 8);
        await flush();
        expect(q(v, '.cm-math-block')).not.toBeNull();
    });

    it('unclosed $$ block never renders: raw text stays, no widget, no render call', async () => {
        const d = '$$\nx^2\n\nmore text';
        for (const pos of [0, d.length]) {
            const v = mkView(d, pos);
            await flush();
            expect(q(v, '.cm-math'), `pos ${pos}`).toBeNull();
            expect(v.dom.textContent).toContain('more text');
        }
        expect(mocks.renderTex).not.toHaveBeenCalled();
    });

    it('typing the closing $$ turns the raw block into a rendered widget', async () => {
        const v = mkView('$$\nx\n\ntail', 0);
        await flush();
        expect(q(v, '.cm-math')).toBeNull();
        v.dispatch({ changes: { from: 4, insert: '$$' }, selection: { anchor: v.state.doc.length } });
        await flush();
        expect(q(v, '.cm-math-block')).not.toBeNull();
    });

    it('block widget is dir="ltr"', async () => {
        const v = mkView(doc, 0);
        await flush();
        expect(q(v, '.cm-math-block').getAttribute('dir')).toBe('ltr');
    });
});

describe('mathPreview: a lone $$ does not disable live preview below it', () => {
    it('with a $$ typed on its own line, a later # heading and **bold** still get live-preview decorations', async () => {
        const doc = 'intro\n\n$$\n\n# Heading\n\n**bold** text';
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const v = new EditorView({
            state: EditorState.create({
                doc,
                selection: { anchor: 0 },
                extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax] }), livePreview, mathPreview],
            }),
            parent,
        });
        views.push(v);
        forceParsing(v, doc.length, 5000);
        v.dispatch({ selection: { anchor: 0 } });
        await flush();
        const lines = qa(v, '.cm-line').map((l) => l.textContent);
        expect(lines.some((t) => t.includes('Heading')), JSON.stringify(lines)).toBe(true);
        expect(lines.some((t) => t.startsWith('# ')), 'heading marker still raw: ' + JSON.stringify(lines)).toBe(false);
        expect(lines.some((t) => t.includes('**')), 'bold markers still raw: ' + JSON.stringify(lines)).toBe(false);
        expect(q(v, '.cm-math')).toBeNull();
    });
});

describe('mathPreview: async loading', () => {
    it('while render is pending the widget shows raw TeX with .cm-math-loading, then swaps to the svg', async () => {
        let resolve;
        mocks.renderTex.mockImplementation(() => new Promise((r) => { resolve = r; }));
        const v = mkView('a $x^2$ b', 0);
        await flush();
        const w = q(v, '.cm-math-inline');
        expect(w).not.toBeNull();
        expect(w.classList.contains('cm-math-loading')).toBe(true);
        expect(w.textContent).toContain('x^2');
        expect(w.querySelector('svg')).toBeNull();

        resolve(svgFor('x^2'));
        await flush();
        const after = q(v, '.cm-math-inline');
        expect(after.classList.contains('cm-math-loading')).toBe(false);
        expect(after.querySelector('svg')).not.toBeNull();
    });

    it('a pending render that resolves after the cursor moved inside does not resurrect a widget', async () => {
        let resolve;
        mocks.renderTex.mockImplementation(() => new Promise((r) => { resolve = r; }));
        const v = mkView('a $x$ b', 0);
        await flush();
        v.dispatch({ selection: { anchor: 4 } });
        await flush();
        resolve(svgFor('x'));
        await flush();
        expect(q(v, '.cm-math-inline')).toBeNull();
        expect(v.dom.textContent).toContain('$x$');
    });

    it('a pending render that resolves after the view is destroyed does not throw', async () => {
        let resolve;
        mocks.renderTex.mockImplementation(() => new Promise((r) => { resolve = r; }));
        const errs = [];
        const onErr = (e) => errs.push(e);
        process.on('unhandledRejection', onErr);
        const v = mkView('a $x$ b', 0);
        await flush();
        v.destroy();
        resolve(svgFor('x'));
        await flush();
        process.off('unhandledRejection', onErr);
        expect(errs).toEqual([]);
    });

    it('a rejected render does not throw out of the editor (raw TeX or error shown)', async () => {
        mocks.renderTex.mockRejectedValue(new Error('boom'));
        const errs = [];
        const onErr = (e) => errs.push(e);
        process.on('unhandledRejection', onErr);
        const v = mkView('a $x$ b', 0);
        await flush();
        process.off('unhandledRejection', onErr);
        expect(errs).toEqual([]);
        expect(v.dom.textContent).toContain('x');
    });
});

describe('mathPreview: real MathJax', () => {
    it('renders a real svg (glyph paths) into the inline widget', async () => {
        const real = await vi.importActual('../../utils/math');
        mocks.renderTex.mockImplementation((...a) => real.renderTex(...a));
        const v = mkView('a $\\mathbb{R}$ b', 0);
        await vi.waitFor(() => {
            const svg = q(v, '.cm-math-inline svg');
            expect(svg).not.toBeNull();
            expect(svg.querySelector('path')).not.toBeNull();
        }, { timeout: 60000, interval: 100 });
        expect(q(v, '.cm-math-inline').classList.contains('cm-math-loading')).toBe(false);
    }, 70000);
});
