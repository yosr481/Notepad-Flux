import { describe, it, expect, vi } from 'vitest';

// Spec: Docs/internal/math-spec.md ("Modules and public API", "Rendering and security").

// Parse the markup and inspect real elements/attributes: MathJax echoes the TeX source into
// inert data-latex attributes, so a text grep for "href" would false-positive.
const dom = (markup) => {
    const d = document.createElement('div');
    d.innerHTML = markup;
    return [...d.querySelectorAll('*')];
};
const attrs = (el) => [...el.attributes];

const fresh = async () => {
    vi.resetModules();
    return import('../math');
};

describe('math.renderTex', () => {
    // Regression: MathJax 4 inline line-breaking split `E = mc^2` into sibling <svg>s at `=`;
    // only the first ("E") was returned.
    it('inline E = mc^2 renders the whole formula, not just "E"', async () => {
        const { renderTex } = await fresh();
        const whole = await renderTex('E = mc^2', { display: false });
        const justE = await renderTex('E', { display: false });
        const width = (s) => parseFloat(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(s)[1]);
        expect(whole.match(/<svg/g).length).toBe(1);
        expect(width(whole)).toBeGreaterThan(width(justE) * 2);
    }, 60000);

    it('inline quadratic formula renders past the first "x"', async () => {
        const { renderTex } = await fresh();
        const whole = await renderTex('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', { display: false });
        const justX = await renderTex('x', { display: false });
        const width = (s) => parseFloat(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(s)[1]);
        expect(whole.match(/<svg/g).length).toBe(1);
        expect(width(whole)).toBeGreaterThan(width(justX) * 4);
    }, 60000);

    it('returns <svg markup for valid TeX, without an mjx-container wrapper', async () => {
        const { renderTex } = await fresh();
        const out = await renderTex('x^2', { display: false });
        expect(typeof out).toBe('string');
        expect(out).toContain('<svg');
        expect(out).not.toContain('mjx-container');
        expect(out).not.toContain('data-mjx-error');
    }, 60000);

    it('returns the identical cached string for the same input', async () => {
        const { renderTex } = await fresh();
        const a = await renderTex('\\frac{a}{b}', { display: false });
        const b = await renderTex('\\frac{a}{b}', { display: false });
        expect(b).toBe(a);
    }, 60000);

    it('display and inline modes do not share a cache entry (display output differs)', async () => {
        const { renderTex } = await fresh();
        const i = await renderTex('\\sum_{k=0}^{n} k', { display: false });
        const d = await renderTex('\\sum_{k=0}^{n} k', { display: true });
        expect(d).toContain('<svg');
        expect(d).not.toBe(i);
    }, 60000);

    it('invalid TeX does not throw and returns markup carrying data-mjx-error', async () => {
        const { renderTex } = await fresh();
        const out = await renderTex('\\frac{', { display: false });
        expect(out).toContain('<svg');
        expect(out).toContain('data-mjx-error');
    }, 60000);

    it('an undefined control sequence does not throw', async () => {
        const { renderTex } = await fresh();
        await expect(renderTex('\\notacommand{x}\\left(', { display: false })).resolves.toContain('<svg');
    }, 60000);

    it('\\mathbb{R} renders glyph paths (lazy font range loads) and no error', async () => {
        const { renderTex } = await fresh();
        const out = await renderTex('\\mathbb{R}', { display: false });
        expect(out).not.toContain('data-mjx-error');
        expect(out).toMatch(/<path[^>]*\sd="[^"]{10,}"/);
    }, 60000);

    it('ams, cancel, braket, color and mhchem packages are available (no error)', async () => {
        const { renderTex } = await fresh();
        for (const tex of [
            '\\begin{align} a &= b \\\\ c &= d \\end{align}',
            '\\cancel{x}',
            '\\bra{a}\\ket{b}',
            '\\color{red}{x}',
            '\\ce{H2O}',
            '\\boldsymbol{x}',
        ]) {
            const out = await renderTex(tex, { display: true });
            expect(out, tex).not.toContain('data-mjx-error');
            expect(out, tex).toContain('<svg');
        }
    }, 120000);

    it('uses currentColor so it follows the editor theme', async () => {
        const { renderTex } = await fresh();
        expect(await renderTex('x', { display: false })).toContain('currentColor');
    }, 60000);

    it('does not use <use href> glyph references (fontCache none)', async () => {
        const { renderTex } = await fresh();
        expect(await renderTex('x+y', { display: false })).not.toMatch(/<use\b/);
    }, 60000);

    describe('hostile TeX', () => {
        const cases = {
            href: '\\href{javascript:alert(1)}{x}',
            class: '\\class{x}{y}',
            style: '\\style{color:red}{x}',
            require: '\\require{html}\\href{javascript:alert(1)}{x}',
            cssId: '\\cssId{a}{b}',
            data: '\\data{k=v}{x}',
            requireAutoload: '\\require{autoload}\\href{javascript:alert(1)}{x}',
            rawSvg: '\\text{<script>alert(1)</script><img src=x onerror=alert(1)>}',
            foreign: '\\text{<foreignObject><div onclick="x()">y</div></foreignObject>}',
        };
        for (const [name, tex] of Object.entries(cases)) {
            it(`${name}: output has no href, xlink:href, <script, on...= attribute, or <foreignObject`, async () => {
                const { renderTex } = await fresh();
                for (const display of [false, true]) {
                    const out = await renderTex(tex, { display });
                    expect(typeof out).toBe('string');
                    const els = dom(out);
                    expect(els.length).toBeGreaterThan(0);
                    expect(els.filter((e) => /^(a|script|foreignobject)$/i.test(e.tagName))).toEqual([]);
                    for (const e of els) {
                        for (const a of attrs(e)) {
                            expect(a.name, `${e.tagName}@${a.name}`).not.toMatch(/^(href|xlink:href|on.*)$/i);
                            if (a.name !== 'data-latex') expect(a.value).not.toMatch(/javascript:/i);
                        }
                    }
                    expect(out).not.toMatch(/<(script|foreignObject)/i);
                }
            }, 60000);
        }

        it('\\style{color:red}{x} and \\class{x}{y} leave no style or class carrying the payload', async () => {
            const { renderTex } = await fresh();
            const s = await renderTex('\\style{color:red}{x}', { display: false });
            for (const e of dom(s)) expect(e.getAttribute('style') || '').not.toMatch(/color/i);
            const c = await renderTex('\\class{evilclass}{y}', { display: false });
            for (const e of dom(c)) expect(e.getAttribute('class') || '').not.toContain('evilclass');
        }, 60000);
    });
});

describe('math.isMathLoaded', () => {
    it('is false on a fresh module before any render and true after the first renderTex', async () => {
        const mod = await fresh();
        expect(mod.isMathLoaded()).toBe(false);
        await mod.renderTex('x', { display: false });
        expect(mod.isMathLoaded()).toBe(true);
    }, 60000);

    it('importing the module alone does not load MathJax', async () => {
        const mod = await fresh();
        expect(mod.isMathLoaded()).toBe(false);
    });
});

describe('math isolation and failure', () => {
    it('\\newcommand in one formula is undefined in the next (renders as an undefined macro, not the glyph)', async () => {
        const { renderTex } = await fresh();
        const first = await renderTex('\\newcommand{\\foo}{A}\\foo', { display: false });
        const second = await renderTex('\\foo', { display: false });
        const undef = await renderTex('\\neverdefinedmacro', { display: false });
        expect(first).not.toContain('data-mjx-error');
        expect(second).not.toBe(first);
        // same shape as a fresh render of an undefined macro: red text, not the glyph A
        expect(second).toMatch(/red|data-mjx-error/);
        expect(undef).toMatch(/red|data-mjx-error/);
    }, 60000);

    it('engine import failure: renderTex resolves (no throw) with an error svg, and a later call retries and succeeds', async () => {
        vi.resetModules();
        let calls = 0;
        const real = await vi.importActual('../mathjax.js');
        vi.doMock('../mathjax.js', () => {
            calls++;
            if (calls === 1) throw new Error('chunk load failed');
            return real;
        });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const { renderTex, isMathLoaded } = await import('../math');
            const bad = await renderTex('x^2', { display: false });
            expect(bad).toContain('<svg');
            expect(bad).toContain('data-mjx-error');
            expect(isMathLoaded()).toBe(false);
            const good = await renderTex('x^2', { display: false });
            expect(good).toContain('<svg');
            expect(good).not.toContain('data-mjx-error');
            expect(good).toMatch(/<path/);
            expect(isMathLoaded()).toBe(true);
        } finally {
            spy.mockRestore();
            vi.doUnmock('../mathjax.js');
        }
    }, 60000);
});
