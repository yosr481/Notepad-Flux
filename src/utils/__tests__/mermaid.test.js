import { describe, it, expect, vi } from 'vitest';

// Spec: Docs/internal/mermaid-spec.md ("Library", "Rendering contract", "Security").
// jsdom can't lay out SVG, so the engine is mocked; render's result/rejection is driven per test.

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));

const FLOW_SVG = (extra = '') =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" id="m1">' +
    '<style>#m1 .node rect{fill:#ececff;stroke:#9370db}#m1 .label{font-family:sans-serif}</style>' +
    '<defs><marker id="m1_arrow" markerWidth="8" markerHeight="8"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>' +
    '<g class="node"><rect x="1" y="1" width="40" height="20"/><text x="5" y="15"><tspan>Start</tspan></text></g>' +
    '<path d="M41,10 L90,10" marker-end="url(#m1_arrow)"/>' +
    extra + '</svg>';

// Fresh module state; `engine` is the (reset) mocked mermaid default the module will import.
const fresh = async () => {
    vi.resetModules();
    const mod = await import('../mermaid');
    const engine = (await import('mermaid')).default;
    // The mock fns survive resetModules; clear calls and queued once-values so tests don't leak.
    engine.initialize.mockReset();
    engine.render.mockReset();
    engine.render.mockResolvedValue({ svg: FLOW_SVG() });
    return { ...mod, engine };
};

const parse = (markup) => {
    const d = document.createElement('div');
    d.innerHTML = markup;
    return d;
};
const allAttrs = (root) => [...root.querySelectorAll('*')].flatMap((el) => [...el.attributes]);

describe('MERMAID_CONFIG', () => {
    it('pins the fixed, document-proof settings', async () => {
        const { MERMAID_CONFIG: c } = await fresh();
        expect(c.startOnLoad).toBe(false);
        expect(c.securityLevel).toBe('strict');
        expect(c.htmlLabels).toBe(false);
        expect(c.flowchart.htmlLabels).toBe(false);
    });

    it('secure list covers every key a %%{init}%% directive must not change', async () => {
        const { MERMAID_CONFIG: c } = await fresh();
        for (const k of ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'themeCSS',
            'themeVariables', 'fontFamily', 'htmlLabels', 'flowchart']) {
            expect(c.secure).toContain(k);
        }
    });
});

describe('renderMermaid: engine loading', () => {
    it('isMermaidLoaded is false before the first call and true after it', async () => {
        const { renderMermaid, isMermaidLoaded } = await fresh();
        expect(isMermaidLoaded()).toBe(false);
        await renderMermaid('graph TD; A-->B');
        expect(isMermaidLoaded()).toBe(true);
    });

    it('loads the engine once for concurrent first calls', async () => {
        const { renderMermaid, engine } = await fresh();
        // Count initialize calls: one load + same theme => exactly one initialize.
        await Promise.all([renderMermaid('graph A'), renderMermaid('graph B'), renderMermaid('graph C')]);
        expect(engine.initialize).toHaveBeenCalledTimes(1);
        expect(engine.render).toHaveBeenCalledTimes(3);
    });

    it('a failed import resolves { error }, is forgotten, and the next call retries', async () => {
        vi.resetModules();
        vi.doMock('mermaid', () => { throw new Error('chunk load failed'); });
        const { renderMermaid, isMermaidLoaded } = await import('../mermaid');
        const bad = await renderMermaid('graph TD; A-->B');
        expect(typeof bad.error).toBe('string');
        expect(bad.svg).toBeUndefined();
        expect(isMermaidLoaded()).toBe(false);

        const render = vi.fn().mockResolvedValue({ svg: FLOW_SVG() });
        vi.doMock('mermaid', () => ({ default: { initialize: vi.fn(), render } }));
        const good = await renderMermaid('graph TD; A-->B');
        expect(good.error).toBeUndefined();
        expect(good.svg).toContain('<svg');
        expect(render).toHaveBeenCalledTimes(1);
        expect(isMermaidLoaded()).toBe(true);
        vi.doMock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));
    });

    it('a failed load is not cached: same source renders after the engine recovers', async () => {
        vi.resetModules();
        vi.doMock('mermaid', () => { throw new Error('offline'); });
        const { renderMermaid } = await import('../mermaid');
        expect((await renderMermaid('graph X')).error).toBeTypeOf('string');
        const render = vi.fn().mockResolvedValue({ svg: FLOW_SVG() });
        vi.doMock('mermaid', () => ({ default: { initialize: vi.fn(), render } }));
        expect((await renderMermaid('graph X')).svg).toContain('<svg');
        vi.doMock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));
    });
});

describe('renderMermaid: initialize / theme', () => {
    it('initializes with MERMAID_CONFIG spread plus theme (default theme = "default")', async () => {
        const { renderMermaid, MERMAID_CONFIG, engine } = await fresh();
        await renderMermaid('graph A');
        expect(engine.initialize).toHaveBeenCalledWith({ ...MERMAID_CONFIG, theme: 'default' });
    });

    it('does not re-initialize while the theme stays the same', async () => {
        const { renderMermaid, engine } = await fresh();
        await renderMermaid('graph A', { theme: 'dark' });
        await renderMermaid('graph B', { theme: 'dark' });
        expect(engine.initialize).toHaveBeenCalledTimes(1);
        expect(engine.initialize.mock.calls[0][0].theme).toBe('dark');
    });

    it('re-initializes when the theme changes, before that render', async () => {
        const { renderMermaid, engine } = await fresh();
        await renderMermaid('graph A', { theme: 'default' });
        await renderMermaid('graph B', { theme: 'dark' });
        expect(engine.initialize).toHaveBeenCalledTimes(2);
        expect(engine.initialize.mock.calls[1][0].theme).toBe('dark');
        expect(engine.initialize.mock.invocationCallOrder[1])
            .toBeLessThan(engine.render.mock.invocationCallOrder[1]);
    });
});

describe('renderMermaid: render call', () => {
    it('passes (id, source) with id matching /^nf-mermaid-\\d+$/', async () => {
        const { renderMermaid, engine } = await fresh();
        await renderMermaid('graph TD; A-->B');
        const [id, source] = engine.render.mock.calls[0];
        expect(id).toMatch(/^nf-mermaid-\d+$/);
        expect(source).toBe('graph TD; A-->B');
    });

    it('ids are unique per call and never derived from the source', async () => {
        const { renderMermaid, engine } = await fresh();
        await renderMermaid('graph A');
        await renderMermaid('graph B');
        const ids = engine.render.mock.calls.map((c) => c[0]);
        expect(new Set(ids).size).toBe(2);
        // Evil source text must not leak into the id.
        await renderMermaid('"><script>x</script>');
        expect(engine.render.mock.calls[2][0]).toMatch(/^nf-mermaid-\d+$/);
    });

    it('serializes renders: the second waits until the first settles', async () => {
        const { renderMermaid, engine } = await fresh();
        let release;
        engine.render.mockImplementationOnce(() => new Promise((r) => { release = r; }));
        const p1 = renderMermaid('graph one');
        const p2 = renderMermaid('graph two');
        // Let the first reach engine.render and everything else drain.
        await vi.waitFor(() => expect(engine.render).toHaveBeenCalledTimes(1));
        await Promise.resolve(); await Promise.resolve();
        expect(engine.render).toHaveBeenCalledTimes(1);
        release({ svg: FLOW_SVG() });
        await p1; await p2;
        expect(engine.render).toHaveBeenCalledTimes(2);
        expect(engine.render.mock.calls[1][1]).toBe('graph two');
    });

    it('a rejected render does not block the queue', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockRejectedValueOnce(new Error('boom'));
        const [a, b] = await Promise.all([renderMermaid('bad'), renderMermaid('good')]);
        expect(a.error).toBeTypeOf('string');
        expect(b.svg).toContain('<svg');
    });
});

describe('renderMermaid: errors', () => {
    it('mermaid rejection with Error -> { error: message } and never rejects', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockRejectedValueOnce(new Error('Parse error on line 2'));
        const out = await renderMermaid('graph TD; A--');
        expect(out).toEqual({ error: 'Parse error on line 2' });
    });

    it('non-Error rejections (string, object with message) still give a string error', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockRejectedValueOnce('plain failure');
        expect(await renderMermaid('s1')).toEqual({ error: 'plain failure' });
        engine.render.mockRejectedValueOnce({ message: 'obj failure' });
        expect(await renderMermaid('s2')).toEqual({ error: 'obj failure' });
    });

    it('error messages are plain strings, returned verbatim (caller uses textContent)', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockRejectedValueOnce(new Error('bad <b>token</b>'));
        const out = await renderMermaid('x');
        expect(out.error).toBe('bad <b>token</b>');
        expect(out.svg).toBeUndefined();
    });

    it('errors are not cached: the same source renders again', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockRejectedValueOnce(new Error('transient'));
        expect((await renderMermaid('graph A')).error).toBe('transient');
        expect((await renderMermaid('graph A')).svg).toContain('<svg');
        expect(engine.render).toHaveBeenCalledTimes(2);
    });
});

describe('renderMermaid: cache', () => {
    it('same theme + source returns the cached result without calling render again', async () => {
        const { renderMermaid, engine } = await fresh();
        const a = await renderMermaid('graph A');
        const b = await renderMermaid('graph A');
        expect(b).toEqual(a);
        expect(engine.render).toHaveBeenCalledTimes(1);
    });

    it('key includes theme: same source under another theme renders again', async () => {
        const { renderMermaid, engine } = await fresh();
        await renderMermaid('graph A', { theme: 'default' });
        await renderMermaid('graph A', { theme: 'dark' });
        expect(engine.render).toHaveBeenCalledTimes(2);
        // and both are now cached
        await renderMermaid('graph A', { theme: 'default' });
        await renderMermaid('graph A', { theme: 'dark' });
        expect(engine.render).toHaveBeenCalledTimes(2);
    });

    it('holds 100 entries, evicting the oldest on the 101st', async () => {
        const { renderMermaid, engine } = await fresh();
        for (let i = 0; i < 100; i++) await renderMermaid(`graph ${i}`);
        expect(engine.render).toHaveBeenCalledTimes(100);
        await renderMermaid('graph 0'); // still cached: 100 entries fit
        expect(engine.render).toHaveBeenCalledTimes(100);
        await renderMermaid('graph 100'); // 101st: evicts the oldest ('graph 0' was only read, not refreshed)
        expect(engine.render).toHaveBeenCalledTimes(101);
        await renderMermaid('graph 1'); // 2nd oldest survives
        expect(engine.render).toHaveBeenCalledTimes(101);
        await renderMermaid('graph 0'); // evicted -> renders again
        expect(engine.render).toHaveBeenCalledTimes(102);
    });
});

describe('renderMermaid: returns sanitized svg', () => {
    it('strips on* handlers and <script> from the engine output', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockResolvedValueOnce({
            svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><g><text>ok</text></g></svg>',
        });
        const out = await renderMermaid('graph A');
        expect(out.svg).not.toMatch(/onload/i);
        expect(out.svg).not.toMatch(/<script/i);
        expect(out.svg).toContain('ok');
    });

    it('the cached copy is the sanitized form too', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockResolvedValueOnce({ svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><g/></svg>' });
        await renderMermaid('graph A');
        const again = await renderMermaid('graph A');
        expect(again.svg).not.toMatch(/onload/i);
    });
});

describe('sanitizeMermaidSvg: removes', () => {
    it('returns a string', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        expect(typeof sanitizeMermaidSvg(FLOW_SVG())).toBe('string');
    });

    it('drops <script> and its content', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<script>alert(1)</script>'));
        expect(out).not.toMatch(/<script/i);
        expect(out).not.toContain('alert(1)');
    });

    it('drops <foreignObject> with its contents', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">LEAK</div></foreignObject>'));
        expect(out).not.toMatch(/foreignobject/i);
        expect(out).not.toContain('LEAK');
    });

    it('drops <a>; PINNED: its children are kept', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<a href="https://evil.test"><text id="kid">linked</text></a>'));
        const d = parse(out);
        expect(d.querySelector('a')).toBeNull();
        expect(out).not.toContain('evil.test');
        expect(d.querySelector('#kid')?.textContent).toBe('linked');
    });

    it('drops <image>', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<image href="https://evil.test/x.png" width="5" height="5"/>'));
        expect(out).not.toMatch(/<image/i);
        expect(out).not.toContain('evil.test');
    });

    it('drops every on* attribute', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(
            '<svg xmlns="http://www.w3.org/2000/svg" onload="a()"><g onclick="b()" onmouseover="c()"><rect onerror="d()" width="1" height="1"/></g></svg>');
        expect(allAttrs(parse(out)).filter((a) => /^on/i.test(a.name))).toEqual([]);
    });

    it.each([
        ['javascript:', 'javascript:alert(1)'],
        ['http:', 'http://evil.test/'],
        ['https:', 'https://evil.test/'],
        ['data:', 'data:image/svg+xml;base64,AAAA'],
        ['relative path', 'other.svg#x'],
    ])('drops href / xlink:href that is not a local #id ref (%s)', async (_n, url) => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG(
            `<path id="p" href="${url}" d="M0,0"/><path id="q" xlink:href="${url}" d="M0,0" xmlns:xlink="http://www.w3.org/1999/xlink"/>`));
        const bad = allAttrs(parse(out)).filter((a) => /href$/i.test(a.name));
        expect(bad).toEqual([]);
        expect(out).not.toContain('evil.test');
        expect(out).not.toMatch(/javascript:/i);
    });

    it('drops <use> with an external href', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<use href="https://evil.test/x.svg#a"/><use xlink:href="http://evil.test/y.svg#b" xmlns:xlink="http://www.w3.org/1999/xlink"/>'));
        expect(out).not.toContain('evil.test');
        expect(parse(out).querySelectorAll('use[href^="http"]').length).toBe(0);
    });
});

describe('sanitizeMermaidSvg: keeps', () => {
    it('keeps the structural elements and viewBox of a realistic flowchart', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const d = parse(sanitizeMermaidSvg(FLOW_SVG()));
        const svg = d.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.getAttribute('viewBox')).toBe('0 0 100 50');
        for (const sel of ['g', 'path', 'rect', 'text', 'tspan']) {
            expect(d.querySelector(sel), sel).not.toBeNull();
        }
        expect(d.querySelector('tspan').textContent).toBe('Start');
    });

    it('keeps <marker id> and marker-end="url(#...)"', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const d = parse(sanitizeMermaidSvg(FLOW_SVG()));
        expect(d.querySelector('marker')?.getAttribute('id')).toBe('m1_arrow');
        expect(d.querySelector('path[marker-end]')?.getAttribute('marker-end')).toBe('url(#m1_arrow)');
    });

    it("keeps Mermaid's own <style> element with its CSS text", async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const d = parse(sanitizeMermaidSvg(FLOW_SVG()));
        const style = d.querySelector('style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('#m1 .node rect{fill:#ececff;stroke:#9370db}');
    });

    it('keeps a <use> with a local #id href', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<use href="#m1_arrow"/>'));
        expect(parse(out).querySelector('use')?.getAttribute('href')).toBe('#m1_arrow');
    });

    it('keeps text content as text (not re-parsed as markup)', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(FLOW_SVG('<text id="t">a &lt;b&gt; &amp; c</text>'));
        expect(parse(out).querySelector('#t').textContent).toBe('a <b> & c');
    });
});

// classDef / style lines put document text into <style> text and style="" attributes, and the app
// CSP has img-src *, so a url() there is a network request on open. Outcome pinned: the dangerous
// declaration/rule is gone, the rest of the CSS stays (exact whitespace is not pinned).
const EVIL_URLS = [
    'url(http://evil.test/a.png)',
    "url('https://evil.test')",
    'url("data:image/svg+xml;base64,AAAA")',
    'url( //evil.test )',
    'URL(http://evil.test/a.png)',
    'u\\72l(http://evil.test/a.png)',
    '\\75rl(http://evil.test/a.png)',
    'url(javascript:alert(1))',
];

describe('sanitizeMermaidSvg: CSS (style text and style attributes)', () => {
    const withStyleText = (css) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>${css}</style><g><rect width="1" height="1"/></g></svg>`;
    const withStyleAttr = (css) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g><rect id="r" width="1" height="1" style="${css}"/></g></svg>`;

    it.each(EVIL_URLS)('removes %s from <style> text, keeps the other declarations', async (bad) => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(withStyleText(`.a{fill:#f9f;background:${bad};stroke:#333}.b{fill:#0f0}`));
        expect(out).not.toContain('evil.test');
        expect(out).not.toMatch(/data:image/i);
        expect(out).not.toMatch(/javascript:/i);
        const css = parse(out).querySelector('style').textContent;
        expect(css).toContain('fill:#f9f');
        expect(css).toContain('stroke:#333');
        expect(css).toContain('.b{fill:#0f0}');
    });

    it.each(EVIL_URLS)('removes %s from a style attribute, keeps the other declarations', async (bad) => {
        const { sanitizeMermaidSvg } = await fresh();
        // The attribute value is double-quoted, so use single-quote-safe entities for quotes.
        const attr = `fill:#f9f;background:${bad};stroke:#333`.replace(/"/g, '&quot;');
        const out = sanitizeMermaidSvg(withStyleAttr(attr));
        expect(out).not.toContain('evil.test');
        expect(out).not.toMatch(/data:image/i);
        expect(out).not.toMatch(/javascript:/i);
        const style = parse(out).querySelector('#r').getAttribute('style') || '';
        expect(style).toContain('fill:#f9f');
        expect(style).toContain('stroke:#333');
    });

    it.each([
        '@import url(http://evil.test/a.css);',
        '@import "https://evil.test/a.css";',
        "@import 'https://evil.test/a.css';",
        '@IMPORT url(//evil.test/a.css);',
    ])('removes %s from <style> text, keeps the later rules', async (imp) => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(withStyleText(`${imp}.a{fill:#f9f;stroke:#333}`));
        expect(out).not.toContain('evil.test');
        expect(out).not.toMatch(/@import/i);
        const css = parse(out).querySelector('style').textContent;
        expect(css).toContain('fill:#f9f');
        expect(css).toContain('stroke:#333');
    });

    it('a url() split across <style> comment tricks is still removed', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const out = sanitizeMermaidSvg(withStyleText('.a{fill:#f9f;background:url/**/(http://evil.test/a.png)}'));
        expect(out).not.toContain('evil.test');
        expect(parse(out).querySelector('style').textContent).toContain('fill:#f9f');
    });

    it('keeps local url(#id) refs in <style> text and in style attributes', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const t = parse(sanitizeMermaidSvg(withStyleText('.a{marker-end:url(#m1_arrow);fill:#f9f;stroke:#333}')));
        expect(t.querySelector('style').textContent).toContain('url(#m1_arrow)');
        const a = parse(sanitizeMermaidSvg(withStyleAttr('fill:url(#m1_grad);stroke:#333')));
        expect(a.querySelector('#r').getAttribute('style')).toContain('url(#m1_grad)');
        expect(a.querySelector('#r').getAttribute('style')).toContain('stroke:#333');
    });

    it('keeps normal declarations untouched in text and attributes', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const t = parse(sanitizeMermaidSvg(withStyleText('.a{fill:#f9f;stroke:#333;stroke-width:4px}')));
        const css = t.querySelector('style').textContent;
        for (const d of ['fill:#f9f', 'stroke:#333', 'stroke-width:4px']) expect(css).toContain(d);
        const a = parse(sanitizeMermaidSvg(withStyleAttr('fill:#f9f;stroke:#333')));
        const s = a.querySelector('#r').getAttribute('style');
        expect(s).toContain('fill:#f9f');
        expect(s).toContain('stroke:#333');
    });

    it('renderMermaid applies the same CSS cleaning to engine output', async () => {
        const { renderMermaid, engine } = await fresh();
        engine.render.mockResolvedValueOnce({ svg: withStyleText('@import url(http://evil.test/a.css);.a{fill:#f9f;background:url(http://evil.test/b.png)}') });
        const out = await renderMermaid('graph A');
        expect(out.svg).not.toContain('evil.test');
        expect(out.svg).toContain('fill:#f9f');
    });
});

// Review gap: an unterminated url( at end of input is still a valid url token to browsers (CSS Syntax
// returns the token at EOF), so it fetches. It must not survive, in <style> text or a style attribute.
describe('sanitizeMermaidSvg: unterminated url(', () => {
    it('removes url( with no closing paren from <style> text and style attributes', async () => {
        const { sanitizeMermaidSvg } = await fresh();
        const t = sanitizeMermaidSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#f9f;background:url(http://evil.test/a.png}</style></svg>');
        expect(t).not.toContain('evil.test');
        const a = sanitizeMermaidSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:#f9f;background:url(http://evil.test/a.png"/></svg>');
        expect(a).not.toContain('evil.test');
    });
});
