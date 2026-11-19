import { describe, it, expect, vi } from 'vitest';
import { marked } from 'marked';

vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: vi.fn() } }));

import { renderMarkdownHtml } from '../export';
import { sanitizeHTML } from '../sanitize';

// Spec: Docs/internal/math-spec.md (renderMarkdownHtml, "never math" contexts, security).
const T = 60000;
const count = (s, needle) => s.split(needle).length - 1;

describe('renderMarkdownHtml: math', () => {
    it('inline $E = mc^2$ exports the full formula, not just "E"', async () => {
        const full = await renderMarkdownHtml('a $E = mc^2$ b');
        const onlyE = await renderMarkdownHtml('a $E$ b');
        const width = (h) => parseFloat(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(h)[1]);
        expect(width(full)).toBeGreaterThan(width(onlyE) * 2);
    }, T);

    it('renders inline $x^2$ as svg inside the sanitized html', async () => {
        const html = await renderMarkdownHtml('Area is $x^2$ ok');
        expect(html).toContain('<svg');
        expect(html).not.toContain('$x^2$');
        expect(html).toContain('Area is');
    }, T);

    it('renders block $$ ... $$ as svg', async () => {
        const html = await renderMarkdownHtml('before\n\n$$\n\\frac{a}{b}\n$$\n\nafter');
        expect(count(html, '<svg')).toBe(1);
        expect(html).not.toContain('\\frac');
        expect(html).toContain('before');
        expect(html).toContain('after');
    }, T);

    it('renders inline $$x$$ inside a paragraph as svg', async () => {
        const html = await renderMarkdownHtml('see $$x$$ here');
        expect(html).toContain('<svg');
        expect(html).not.toContain('$$');
    }, T);

    it('does not render non-math dollars: "costs $5 and $10" stays literal', async () => {
        const html = await renderMarkdownHtml('costs $5 and $10');
        expect(html).not.toContain('<svg');
        expect(html).toContain('costs $5 and $10');
    }, T);

    it('unclosed $$ block is never rendered and stays raw text', async () => {
        const html = await renderMarkdownHtml('$$\nx^2\n\nmore text');
        expect(html).not.toContain('<svg');
        expect(html).toContain('x^2');
        expect(html).toContain('more text');
    }, T);

    it('math inside an inline code span stays literal', async () => {
        const html = await renderMarkdownHtml('use `$x$` here');
        expect(html).not.toContain('<svg');
        expect(html).toContain('<code>$x$</code>');
    }, T);

    it('math inside a fenced code block stays literal', async () => {
        const html = await renderMarkdownHtml('```\n$x$\n$$\ny\n$$\n```');
        expect(html).not.toContain('<svg');
        expect(html).toContain('$x$');
        expect(html).toContain('$$');
    }, T);

    it('code and real math in one document: only the real math is rendered', async () => {
        const html = await renderMarkdownHtml('`$a$` and $b$\n\n```\n$c$\n```');
        expect(count(html, '<svg')).toBe(1);
        expect(html).toContain('<code>$a$</code>');
        expect(html).toContain('$c$');
    }, T);

    it('markdown inside math is not markdown: $a*b*c$ has no <em>', async () => {
        const html = await renderMarkdownHtml('$a*b*c$');
        expect(html).toContain('<svg');
        expect(html).not.toContain('<em>');
    }, T);

    it('the output is sanitized: hostile TeX and raw html leave no href, script, on...= or foreignObject', async () => {
        const html = await renderMarkdownHtml(
            '$\\href{javascript:alert(1)}{x}$ and $\\class{a}{b}$\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>'
        );
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/<foreignObject/i);
        const host = document.createElement('div');
        host.innerHTML = html;
        expect(host.querySelectorAll('svg').length).toBeGreaterThan(0);
        for (const e of host.querySelectorAll('*')) {
            for (const a of e.attributes) {
                expect(a.name, `${e.tagName}@${a.name}`).not.toMatch(/^(href|xlink:href|on.*)$/i);
                if (a.name !== 'data-latex') expect(a.value).not.toMatch(/javascript:/i);
            }
        }
    }, T);

    it('invalid TeX does not throw and yields the error svg', async () => {
        const html = await renderMarkdownHtml('$\\frac{$ and $$\\frac{$$');
        expect(typeof html).toBe('string');
    }, T);

    // Placeholder-collision guard: the renderer must not use a string a user could type.
    const guesses = [
        'MATHPLACEHOLDER0', 'MATHPLACEHOLDER_0', 'MATH_PLACEHOLDER_0', '@@MATH0@@', '@@MATH_0@@',
        'XMATH0X', 'MATH0', 'MATH_0', '%%MATH0%%', '%%MATH_0%%', '{{math0}}', '{{MATH_0}}',
        'ZZMATH0ZZ', 'MJX0', 'MJX_0', '@@MJX0@@', '[[math:0]]', 'math-0', 'math-placeholder-0',
        'MATHINLINE0', 'MATHBLOCK0', 'INLINEMATH0', 'BLOCKMATH0', '\uE000MATH0\uE001',
        'KATEX0', '@@INLINE0@@', '@@BLOCK0@@', '%%INLINE0%%',
    ];
    it.each(guesses)('a literal %j next to real math stays literal text', async (lit) => {
        const doc = `before ${lit} middle $x$ after ${lit} end\n\n$$\ny\n$$\n\n${lit}`;
        const html = await renderMarkdownHtml(doc);
        expect(count(html, lit)).toBe(3);
        expect(count(html, '<svg')).toBe(2);
    }, T);

    it('a literal placeholder-like string with NO math in the document stays literal', async () => {
        const html = await renderMarkdownHtml('@@MATH0@@ MATHPLACEHOLDER0 %%MATH0%%');
        expect(html).toContain('@@MATH0@@ MATHPLACEHOLDER0 %%MATH0%%');
        expect(html).not.toContain('<svg');
    }, T);
});

describe('renderMarkdownHtml: regression vs existing pipeline', () => {
    it('equals sanitizeHTML(marked(md)) for a math-free document', async () => {
        const md = [
            '# Title', '', 'Some *emphasis*, **strong**, `code` and [a link](https://e.com).', '',
            '- one', '- two', '', '1. a', '2. b', '', '> quote', '',
            '| a | b |', '|---|---|', '| 1 | 2 |', '', '```js', 'const a = "$b$";', '```', '',
            'Price: $5 and $10, also \\$5.', '', '![alt](https://e.com/x.png)', '', '---', '',
            '<script>alert(1)</script>', '', '<b onclick="x()">bold</b>',
        ].join('\n');
        expect(await renderMarkdownHtml(md)).toBe(sanitizeHTML(marked(md)));
    }, T);

    it('equals sanitizeHTML(marked(md)) for an empty document', async () => {
        expect(await renderMarkdownHtml('')).toBe(sanitizeHTML(marked('')));
    }, T);
});

describe('renderMarkdownHtml: formulas inside attributes and pathological input', () => {
    it('![$x$](a.png): img alt is exactly the source text $x$, no svg inside any attribute, no stray g/path outside an svg', async () => {
        const html = await renderMarkdownHtml('![$x$](a.png) and $y$');
        const host = document.createElement('div');
        host.innerHTML = html;
        const img = host.querySelector('img');
        expect(img).not.toBeNull();
        expect(img.getAttribute('alt')).toBe('$x$');
        for (const e of host.querySelectorAll('*')) {
            for (const a of e.attributes) expect(a.value, `${e.tagName}@${a.name}`).not.toMatch(/<svg|<path|<g[ >]/i);
        }
        expect([...host.querySelectorAll('g, path')].filter((e) => !e.closest('svg'))).toEqual([]);
        expect(host.querySelectorAll('svg')).toHaveLength(1);   // only the real $y$ in text
    }, T);

    it('a link title containing $y$ stays source text; output is well formed', async () => {
        const html = await renderMarkdownHtml('[link](http://e.com "has $y$ in title") and $z$');
        const host = document.createElement('div');
        host.innerHTML = html;
        const a = host.querySelector('a');
        expect(a).not.toBeNull();
        expect(a.getAttribute('title')).toBe('has $y$ in title');
        for (const e of host.querySelectorAll('*')) {
            for (const at of e.attributes) expect(at.value, `${e.tagName}@${at.name}`).not.toMatch(/<svg|<path|<g[ >]/i);
        }
        expect([...host.querySelectorAll('g, path')].filter((e) => !e.closest('svg'))).toEqual([]);
        expect(host.querySelectorAll('svg')).toHaveLength(1);
    }, T);

    it('a 300 KB line of "$a " repeated exports in well under 10 s (used to take ~20 s)', async () => {
        const md = '$a '.repeat(100000);
        const t = Date.now();
        const html = await renderMarkdownHtml(md);
        expect(Date.now() - t).toBeLessThan(10000);
        expect(typeof html).toBe('string');
    }, 60000);

    it('an inline formula over 1000 characters is not math in the export', async () => {
        const html = await renderMarkdownHtml('$' + 'a'.repeat(1001) + '$');
        expect(html).not.toContain('<svg');
    }, T);
});
