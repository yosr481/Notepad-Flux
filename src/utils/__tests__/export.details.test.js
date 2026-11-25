import { describe, it, expect, vi } from 'vitest';

vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: vi.fn() } }));

import { renderMarkdownHtml } from '../export';

// Spec: Docs/internal/details-spec.md ("Export (T3)").
// Pinned choices:
//  - Output is checked through DOM parsing, never exact whitespace.
//  - `expandFolds` is honoured only when === true (same as callouts); omitted, `{}`, false, truthy non-true keep the author's state.
//  - expandFolds only adds the `open` attribute: no other attribute appears, summary and body are unchanged.
//  - Raw `<details>` only here (no callouts): every <details> in the output, nested or inside a blockquote, gets `open`.
//  - Fast-path docs (no math/mermaid/footnotes/headings, so no idMark) must still be opened.
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md, options) => dom(await renderMarkdownHtml(md, options));
const all = (d) => [...d.querySelectorAll('details')];
const open = (el) => el.hasAttribute('open');
const EXPAND = { expandFolds: true };

const BLANK = '<details>\n<summary>Sum</summary>\n\nbody **bold**\n\n</details>';
const ONE_BLOCK = '<details>\n<summary>Sum</summary>\nbody line\n</details>';
const NESTED = '<details>\n<summary>Outer</summary>\n\nouter text\n\n<details>\n<summary>Inner</summary>\n\ninner text\n\n</details>\n\n</details>';

describe('export details: expandFolds true opens every details', () => {
    it.each([['blank-line form', BLANK], ['one-block form', ONE_BLOCK]])('%s', async (_n, md) => {
        const d = await render(md, EXPAND);
        expect(all(d)).toHaveLength(1);
        expect(open(all(d)[0])).toBe(true);
    });

    it('nested: outer and inner both open', async () => {
        const d = await render(NESTED, EXPAND);
        const det = all(d);
        expect(det).toHaveLength(2);
        for (const x of det) expect(open(x)).toBe(true);
    });

    it('several sibling details, all open', async () => {
        const d = await render(`${BLANK}\n\n${ONE_BLOCK}\n\n${BLANK}`, EXPAND);
        expect(all(d)).toHaveLength(3);
        for (const x of all(d)) expect(open(x)).toBe(true);
    });

    it('already-open details stay open (single open attribute, nothing doubled)', async () => {
        const d = await render('<details open>\n<summary>S</summary>\n\nb\n\n</details>', EXPAND);
        const [x] = all(d);
        expect(open(x)).toBe(true);
        expect([...x.attributes].map((a) => a.name)).toEqual(['open']);
    });

    it('mix of closed and open: all open', async () => {
        const d = await render(`<details open>\n<summary>A</summary>\n\na\n\n</details>\n\n${BLANK}`, EXPAND);
        expect(all(d)).toHaveLength(2);
        for (const x of all(d)) expect(open(x)).toBe(true);
    });

    it('details inside a blockquote are opened too (export renders them, unlike the editor)', async () => {
        const d = await render('> <details>\n> <summary>Q</summary>\n>\n> quoted body\n>\n> </details>', EXPAND);
        const det = all(d);
        expect(det).toHaveLength(1);
        expect(det[0].closest('blockquote')).not.toBeNull();
        expect(open(det[0])).toBe(true);
    });

    it('with headings, math and footnotes in the doc (slow path) still opens', async () => {
        const md = `# Title\n\n${BLANK}\n\n$x^2$ and a note[^1]\n\n[^1]: n`;
        const d = await render(md, EXPAND);
        expect(open(all(d)[0])).toBe(true);
    });

    it('fast path: heading-free doc with only a closed details still comes back open', async () => {
        const md = '<details>\n<summary>Only</summary>\n\njust text\n\n</details>';
        const d = await render(md, EXPAND);
        expect(all(d)).toHaveLength(1);
        expect(open(all(d)[0])).toBe(true);
    });

    it('fast path with nested closed details: both open', async () => {
        const d = await render(NESTED, EXPAND);
        for (const x of all(d)) expect(open(x)).toBe(true);
    });
});

describe('export details: no expandFolds keeps the author state (HTML export)', () => {
    it.each([[undefined], [{}], [{ expandFolds: false }], [{ expandFolds: 'yes' }], [{ expandFolds: 1 }]])('closed stays closed, open stays open: %j', async (options) => {
        const md = `${BLANK}\n\n<details open>\n<summary>O</summary>\n\no\n\n</details>`;
        const [closed, opened] = all(await render(md, options));
        expect(open(closed)).toBe(false);
        expect(open(opened)).toBe(true);
    });

    it('nested: closed inner inside open outer stays closed', async () => {
        const md = '<details open>\n<summary>Outer</summary>\n\nx\n\n<details>\n<summary>Inner</summary>\n\ny\n\n</details>\n\n</details>';
        const [outer, inner] = all(await render(md));
        expect(open(outer)).toBe(true);
        expect(open(inner)).toBe(false);
    });

    it('closed details in a blockquote stays closed', async () => {
        const d = await render('> <details>\n> <summary>Q</summary>\n>\n> b\n>\n> </details>');
        expect(open(all(d)[0])).toBe(false);
    });
});

describe('export details: content untouched', () => {
    it('summary and body identical apart from the open attribute', async () => {
        const closed = await render(BLANK);
        const opened = await render(BLANK, EXPAND);
        const [a] = all(closed);
        const [b] = all(opened);
        expect(b.querySelector('summary').innerHTML).toBe(a.querySelector('summary').innerHTML);
        expect(b.querySelector('summary').textContent).toBe('Sum');
        expect(b.innerHTML).toBe(a.innerHTML);
        expect(b.querySelector('strong').textContent).toBe('bold');
    });

    it('no attribute besides `open` is added', async () => {
        const [x] = all(await render(BLANK, EXPAND));
        expect([...x.attributes].map((a) => a.name)).toEqual(['open']);
        expect([...x.querySelector('summary').attributes]).toEqual([]);
    });

    it('a doc without details is byte-identical with and without expandFolds', async () => {
        const md = 'plain\n\n> quote\n\n- a\n- b';
        expect(await renderMarkdownHtml(md, EXPAND)).toBe(await renderMarkdownHtml(md));
    });

    it('does not open a callout-free lookalike: text "<details>" in a code span / fence is not a details element', async () => {
        const d = await render('`<details>` and\n\n```html\n<details>\n<summary>x</summary>\n</details>\n```', EXPAND);
        expect(all(d)).toHaveLength(0);
    });
});

describe('export details: sanitizer still applies', () => {
    it('raw <details ontoggle=...> has no event handler attribute, with and without expandFolds', async () => {
        const md = '<details ontoggle="alert(1)">\n<summary>S</summary>\n\nb\n\n</details>';
        for (const options of [undefined, EXPAND]) {
            const html = await renderMarkdownHtml(md, options);
            expect(html).not.toMatch(/ontoggle/i);
            const [x] = all(dom(html));
            expect([...x.attributes].some((a) => /^on/i.test(a.name))).toBe(false);
        }
        expect(open(all(await render(md, EXPAND))[0])).toBe(true);
    });

    it('script inside a details body is still stripped when expanded', async () => {
        const d = await render('<details>\n<summary>S</summary>\n\n<script>alert(1)</script>\n\n</details>', EXPAND);
        expect(d.querySelector('script')).toBeNull();
        expect(open(all(d)[0])).toBe(true);
    });
});
