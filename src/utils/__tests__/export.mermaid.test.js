import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Marked } from 'marked';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));
vi.mock('../mermaid', () => ({ renderMermaid: vi.fn() }));

import { renderMermaid } from '../mermaid';
import { renderMarkdownHtml, exportToHtml } from '../export';
import { createMermaid } from '../exportMermaid';

// Spec: Docs/internal/mermaid-spec.md ("Export (HTML, PDF, Print)", "Security"). Loader/sanitizer are covered in mermaid.test.js.
// Pinned choices (spec silent or only implied):
//  - createMermaid(nonce) -> { extension, prepare(), finish(root), has() } (same shape as createMath).
//  - `extension` is a marked extension usable as `new Marked(ext)`; it overrides only the `code` renderer for mermaid fences
//    and lets every other fence render as stock marked does. It emits a nonce placeholder that survives sanitizing.
//  - has() is false until a mermaid fence has been rendered by marked; other fences never flip it.
//  - Fence detection: first word of the info string, lowercased, === 'mermaid' (so `Mermaid`, `mermaid title` yes; `mermaidx` no).
//    ~~~ fences count too (marked treats them as fences).
//  - source passed to renderMermaid is the marked code-token text, verbatim (no trim/re-indent by us).
//  - renderMermaid is always called with exactly (source, { theme: 'default' }), whatever document.body.dataset.theme is.
//  - Success: div.mermaid-diagram[dir=ltr] whose innerHTML is exactly the returned svg string.
//  - Error: pre.mermaid-error whose textContent contains the source and the message; both as text only.
//  - One renderMermaid call per fence occurrence (identical sources are NOT merged here: every result gets its own root id, see the 'same block twice' test).
//  - Only the nonce placeholder is replaced. Look-alike text, forged placeholders, raw <div class="mermaid-diagram"> are inert.
//  - Fast path: no mermaid fence -> renderMermaid is never called.
const T = 60000;

const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));
const diagrams = (d) => [...d.querySelectorAll('div.mermaid-diagram')];
const svgFor = (src) => `<svg data-src="${encodeURIComponent(src)}"><g><text>ok</text></g></svg>`;
const fence = (body, info = 'mermaid') => '```' + info + '\n' + body + '\n```';
const fenceTokens = (md) => {
    const out = [];
    const walk = (ts) => ts.forEach((t) => { if (t.type === 'code') out.push(t); if (t.tokens) walk(t.tokens); if (t.items) walk(t.items); });
    walk(new Marked().lexer(md));
    return out;
};

beforeEach(() => {
    exportFile.mockReset();
    renderMermaid.mockReset();
    renderMermaid.mockImplementation(async (src) => ({ svg: svgFor(src) }));
});
afterEach(() => { delete document.body.dataset.theme; });

describe('createMermaid unit shape', () => {
    it('returns extension, prepare, finish and has', () => {
        const m = createMermaid('abc');
        expect(typeof m.extension).toBe('object');
        expect(typeof m.prepare).toBe('function');
        expect(typeof m.finish).toBe('function');
        expect(typeof m.has).toBe('function');
    });

    it('has() is false before any fence and after non-mermaid fences', () => {
        const m = createMermaid('abc');
        expect(m.has()).toBe(false);
        new Marked(m.extension).parse(fence('x = 1', 'js') + '\n\n' + fence('plain', '') + '\n\n' + fence('g', 'mermaidx'));
        expect(m.has()).toBe(false);
    });

    it('has() becomes true once a mermaid fence is rendered by marked', () => {
        const m = createMermaid('abc');
        new Marked(m.extension).parse(fence('graph TD\nA-->B'));
        expect(m.has()).toBe(true);
    });

    it('marked output holds a placeholder, not the source; prepare+finish swap it for the svg once', async () => {
        const m = createMermaid('abc');
        const html = new Marked(m.extension).parse(fence('graph TD\nA-->B'));
        expect(html).not.toContain('<svg');
        expect(renderMermaid).not.toHaveBeenCalled(); // rendering is deferred to prepare()
        await m.prepare();
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        const root = dom(html);
        m.finish(root);
        const d = diagrams(root);
        expect(d).toHaveLength(1);
        expect(d[0].innerHTML).toBe(svgFor('graph TD\nA-->B'));
        expect(root.innerHTML ?? '').not.toContain('NFMERMAID');
        const holder = document.createElement('div');
        holder.append(root);
        expect(holder.innerHTML).not.toMatch(/NFMERMAID/i);
    });
});

describe('renderMarkdownHtml mermaid: diagram', () => {
    it('a mermaid fence becomes div.mermaid-diagram[dir=ltr] holding the svg verbatim', async () => {
        const src = 'graph TD\n  A-->B';
        const d = await render(fence(src));
        const el = diagrams(d);
        expect(el).toHaveLength(1);
        expect(el[0].getAttribute('dir')).toBe('ltr');
        expect(el[0].innerHTML).toBe(svgFor(src));
        expect(d.querySelector('pre')).toBeNull();
        expect(d.querySelector('code')).toBeNull();
    }, T);

    it('source is exactly the marked code-token text', async () => {
        const body = 'graph TD\n    A["a  b"]-->B\n\n    B-->C';
        const md = 'intro\n\n' + fence(body);
        const [tok] = fenceTokens(md);
        await render(md);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
        expect(renderMermaid.mock.calls[0][0]).toBe(tok.text);
    }, T);

    it('theme is always default, even with a dark app theme', async () => {
        document.body.dataset.theme = 'dark';
        await render(fence('graph TD\nA-->B'));
        expect(renderMermaid.mock.calls[0][1]).toEqual({ theme: 'default' });
    }, T);

    it('info string: first word, lowercased: Mermaid / MERMAID / "mermaid title" render', async () => {
        for (const info of ['Mermaid', 'MERMAID', 'mermaid title="x"']) {
            renderMermaid.mockClear();
            const d = await render(fence('graph TD\nA-->B', info));
            expect(diagrams(d), info).toHaveLength(1);
            expect(renderMermaid, info).toHaveBeenCalledTimes(1);
        }
    }, T);

    it('~~~mermaid fences render too', async () => {
        const d = await render('~~~mermaid\ngraph TD\nA-->B\n~~~');
        expect(diagrams(d)).toHaveLength(1);
    }, T);

    it('text around the diagram is kept', async () => {
        const d = await render('before\n\n' + fence('graph TD\nA-->B') + '\n\nafter');
        expect(d.body?.textContent ?? d.textContent).toContain('before');
        expect(d.textContent).toContain('after');
    }, T);
});

describe('renderMarkdownHtml mermaid: other fences untouched', () => {
    it('js fence keeps <pre><code class="language-js"> and never calls renderMermaid', async () => {
        const d = await render(fence('let a = 1;', 'js'));
        expect(d.querySelector('pre > code.language-js').textContent).toContain('let a = 1;');
        expect(diagrams(d)).toHaveLength(0);
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);

    it('no-lang fence is a plain pre > code', async () => {
        const d = await render('```\ngraph TD\n```');
        expect(d.querySelector('pre > code')).not.toBeNull();
        expect(d.querySelector('code').className).toBe('');
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);

    it('mermaidx is not mermaid', async () => {
        const d = await render(fence('graph TD', 'mermaidx'));
        expect(d.querySelector('pre > code.language-mermaidx')).not.toBeNull();
        expect(diagrams(d)).toHaveLength(0);
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);

    it('indented code and inline code containing the word mermaid are not diagrams', async () => {
        const d = await render('    mermaid\n\nuse `mermaid` here');
        expect(diagrams(d)).toHaveLength(0);
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);

    it('a doc with no mermaid never calls renderMermaid (fast path), output equals the plain sanitized render', async () => {
        const html = await renderMarkdownHtml('# T\n\ntext **b**\n\n' + fence('x', 'js'));
        expect(renderMermaid).not.toHaveBeenCalled();
        expect(html).toContain('<h1>');
        expect(html).not.toMatch(/NFMERMAID/i);
    }, T);
});

describe('renderMarkdownHtml mermaid: error', () => {
    it('{ error } becomes pre.mermaid-error with the source and the message as text', async () => {
        renderMermaid.mockResolvedValue({ error: 'Parse error on line 2' });
        const src = 'graph TD\nA--';
        const d = await render(fence(src));
        const pre = d.querySelector('pre.mermaid-error');
        expect(pre).not.toBeNull();
        expect(pre.textContent).toContain(src);
        expect(pre.textContent).toContain('Parse error on line 2');
        expect(diagrams(d)).toHaveLength(0);
        expect(d.querySelector('svg')).toBeNull();
    }, T);

    it('markup in the message or source never becomes an element', async () => {
        renderMermaid.mockResolvedValue({ error: '<img src=x onerror=alert(1)>' });
        const d = await render(fence('<b>bold</b> <script>alert(2)</script>'));
        const pre = d.querySelector('pre.mermaid-error');
        expect(pre.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(pre.textContent).toContain('<b>bold</b>');
        expect(d.querySelector('img')).toBeNull();
        expect(d.querySelector('script')).toBeNull();
        expect(d.querySelector('b')).toBeNull();
    }, T);

    it('one failing diagram does not stop the next from rendering', async () => {
        renderMermaid.mockImplementation(async (src) => (src === 'bad' ? { error: 'nope' } : { svg: svgFor(src) }));
        const d = await render(fence('bad') + '\n\n' + fence('good'));
        expect(d.querySelectorAll('pre.mermaid-error')).toHaveLength(1);
        expect(diagrams(d)).toHaveLength(1);
        expect(diagrams(d)[0].innerHTML).toBe(svgFor('good'));
    }, T);
});

describe('renderMarkdownHtml mermaid: nesting', () => {
    it('inside a blockquote (prefix stripped from source)', async () => {
        const md = '> ' + '```mermaid\n> graph TD\n> A-->B\n> ```';
        const [tok] = fenceTokens(md);
        const d = await render(md);
        expect(d.querySelectorAll('blockquote div.mermaid-diagram')).toHaveLength(1);
        expect(renderMermaid.mock.calls[0][0]).toBe(tok.text);
        expect(tok.text).not.toMatch(/^\s*>/m);
    }, T);

    it('inside a list item', async () => {
        const md = '- item\n\n  ```mermaid\n  graph TD\n  A-->B\n  ```\n- next';
        const d = await render(md);
        expect(d.querySelectorAll('li div.mermaid-diagram')).toHaveLength(1);
        expect(renderMermaid.mock.calls[0][0]).toBe(fenceTokens(md)[0].text);
    }, T);

    it('inside a callout body', async () => {
        const md = '> [!note]\n> intro\n>\n> ```mermaid\n> graph TD\n> A-->B\n> ```';
        const d = await render(md);
        expect(d.querySelectorAll('.callout .callout-content div.mermaid-diagram')).toHaveLength(1);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
    }, T);
});

describe('renderMarkdownHtml mermaid: multiple diagrams', () => {
    it('document order, each with its own svg, one call per diagram', async () => {
        const d = await render(fence('graph A') + '\n\ntext\n\n' + fence('graph B') + '\n\n' + fence('graph C'));
        expect(diagrams(d).map((e) => e.innerHTML)).toEqual([svgFor('graph A'), svgFor('graph B'), svgFor('graph C')]);
        expect(renderMermaid).toHaveBeenCalledTimes(3);
        expect(renderMermaid.mock.calls.map((c) => c[0])).toEqual(['graph A', 'graph B', 'graph C']);
    }, T);

    it('identical sources: both appear, one renderMermaid call each (results carry per-call ids)', async () => {
        const d = await render(fence('graph A') + '\n\n' + fence('graph A'));
        expect(diagrams(d)).toHaveLength(2);
        expect(diagrams(d).every((e) => e.innerHTML === svgFor('graph A'))).toBe(true);
        expect(renderMermaid).toHaveBeenCalledTimes(2);
    }, T);

    it('same block twice: two distinct svg root ids (a shared id would break the second copy\'s markers/styles)', async () => {
        let n = 0;
        renderMermaid.mockImplementation(async () => ({ svg: `<svg id="nf-mermaid-${++n}"><g><text>ok</text></g></svg>` }));
        const d = await render(fence('graph A') + '\n\n' + fence('graph A'));
        const ids = diagrams(d).map((e) => e.querySelector('svg').id);
        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(2);
    }, T);

    it('exactly once per diagram per export, not twice', async () => {
        await render(fence('graph A'));
        expect(renderMermaid).toHaveBeenCalledTimes(1);
    }, T);
});

describe('renderMarkdownHtml mermaid: security', () => {
    it('placeholder look-alike text never injects svg nor calls renderMermaid', async () => {
        const md = 'NFMERMAID0E NFMERMAIDI0E NFMERMAIDabcI0E NFMERMAID000000000000000000000000I0E\n\n`NFMERMAID0I0E`';
        const html = await renderMarkdownHtml(md);
        expect(html).not.toContain('<svg');
        expect(html).toContain('NFMERMAID0E');
        expect(html).toContain('NFMERMAIDabcI0E');
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);

    it('look-alikes next to a real diagram stay text; only the real one gets an svg', async () => {
        const md = 'NFMERMAIDI0E NFMERMAIDabcI0E NFMERMAID0E\n\n' + fence('graph A');
        const d = await render(md);
        expect(d.querySelectorAll('svg')).toHaveLength(1);
        expect(diagrams(d)).toHaveLength(1);
        expect(d.querySelector('p').textContent).toContain('NFMERMAIDI0E NFMERMAIDabcI0E NFMERMAID0E');
        expect(renderMermaid).toHaveBeenCalledTimes(1);
    }, T);

    it('raw <div class="mermaid-diagram"> in the document gets no svg and triggers no render', async () => {
        const html = await renderMarkdownHtml('<div class="mermaid-diagram">NFMERMAIDI0E</div>\n\ntext');
        const d = dom(html);
        expect(d.querySelector('svg')).toBeNull();
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);

    it('raw <svg>, script and handlers in the document are still sanitized', async () => {
        const d = await render('<svg onload="alert(1)"><script>alert(2)</script></svg>\n\n<img src=x onerror="alert(3)">\n\n' + fence('graph A'));
        expect(d.querySelector('script')).toBeNull();
        expect(html(d)).not.toMatch(/onload|onerror/i);
        expect(diagrams(d)).toHaveLength(1);
    }, T);

    it('the svg is inserted verbatim after sanitizing (sanitizer does not touch renderMermaid output)', async () => {
        const svg = '<svg viewBox="0 0 10 10" style="max-width: 10px"><style>.a{fill:red}</style><g class="x"><text>t</text></g></svg>';
        renderMermaid.mockResolvedValue({ svg });
        const d = await render(fence('graph A'));
        expect(diagrams(d)[0].innerHTML).toBe(dom(svg).firstChild.outerHTML);
        expect(diagrams(d)[0].querySelector('style')).not.toBeNull();
    }, T);

    it('a mermaid-looking fence inside an HTML comment / raw html block stays inert', async () => {
        const d = await render('<!--\n```mermaid\ngraph A\n```\n-->\n\ntext');
        expect(diagrams(d)).toHaveLength(0);
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);
});

function html(d) { const h = document.createElement('div'); h.append(d.cloneNode(true)); return h.innerHTML; }

describe('renderMarkdownHtml mermaid: coexistence', () => {
    it('math, footnote, callout and mermaid in one document all export correctly', async () => {
        const md = [
            'Energy $x^2$ and a note[^a].',
            '',
            '> [!tip] Hint',
            '> callout body',
            '',
            fence('graph TD\nA-->B'),
            '',
            '[^a]: the note',
        ].join('\n');
        const d = await render(md);
        expect(d.querySelectorAll('span.math')).toHaveLength(1);
        expect(d.querySelector('span.math svg')).not.toBeNull();
        expect(d.querySelector('sup > a.footnote-ref').getAttribute('href')).toBe('#fn-1');
        expect(d.querySelector('a.footnote-ref').id).toBe('fnref-1');
        expect(d.querySelectorAll('section.footnotes > ol > li')).toHaveLength(1);
        expect(d.querySelectorAll('div.callout.callout-tip')).toHaveLength(1);
        expect(diagrams(d)).toHaveLength(1);
        expect(diagrams(d)[0].innerHTML).toBe(svgFor('graph TD\nA-->B'));
        expect(html(d)).not.toMatch(/NFMERMAID|NFMATH/);
        expect(renderMermaid).toHaveBeenCalledTimes(1);
    }, T);

    it('math-only docs still render math with renderMermaid untouched', async () => {
        const d = await render('just $y$ here');
        expect(d.querySelector('span.math svg')).not.toBeNull();
        expect(renderMermaid).not.toHaveBeenCalled();
    }, T);
});

describe('calloutExport.css: mermaid rules', () => {
    const CSS_PATH = 'src/styles/calloutExport.css';
    const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        if (selectors[0] && !selectors[0].startsWith('@')) rules.push({ selectors, body: m[2] });
    }
    const forSel = (sel) => rules.filter((r) => r.selectors.includes(sel));
    const decl = (sel, prop) => {
        for (const r of forSel(sel).reverse()) {
            const m = r.body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, 'i'));
            if (m) return m[1].trim().replace(/\s*!important$/, '');
        }
        return null;
    };
    const lum = (hex) => {
        let h = hex.replace('#', '');
        if (h.length === 3) h = [...h].map((c) => c + c).join('');
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

    it('.mermaid-diagram svg is max-width: 100% and height: auto', () => {
        expect(decl('.mermaid-diagram svg', 'max-width')).toBe('100%');
        expect(decl('.mermaid-diagram svg', 'height')).toBe('auto');
    });

    it('.mermaid-error sets an explicit hex color and background with contrast >= 4.5', () => {
        const color = decl('.mermaid-error', 'color');
        const bg = decl('.mermaid-error', 'background') ?? decl('.mermaid-error', 'background-color');
        expect(color).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        expect(bg).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        expect(contrast(color, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it('exportToHtml inlines the mermaid rules into the page', async () => {
        await exportToHtml('t', 'x');
        const page = exportFile.mock.calls[0][0];
        expect(page).toContain('.mermaid-diagram');
        expect(page).toContain('.mermaid-error');
    }, T);
});
