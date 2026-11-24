import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: vi.fn() } }));

import { renderMarkdownHtml } from '../export';

// Spec: Docs/internal/heading-links-spec.md ("Export (T1)", "Rules").
// Pinned choices where the spec is silent:
//  - Ids are read from the parsed DOM (never string-matched); ids are set post-sanitize via the nonce class marker.
//  - Heading inside a footnote definition is written as an indented continuation block (4 spaces) after a blank line.
//  - Callout titles are not headings; only real `#` headings in the callout body count.
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));
const ids = (d) => [...d.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => h.id);

describe('export heading ids: basics (early-return path, no math/footnotes/mermaid)', () => {
    it('ATX h1-h6 get slugs', async () => {
        const d = await render('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n');
        expect(ids(d)).toEqual(['one', 'two', 'three', 'four', 'five', 'six']);
    });
    it('applies headingSlug rules to inline syntax', async () => {
        const d = await render('## **Bold** _and_ `code`\n\n## Link [text](http://x.y)\n\n## Note[^1]\n\n[^1]: n\n');
        expect(ids(d).slice(0, 3)).toEqual(['bold-and-code', 'link-text', 'note']);
    });
    it('Hebrew heading', async () => {
        expect(ids(await render('# שלום עולם\n'))).toEqual(['שלום-עולם']);
    });
    it('setext h1 and h2', async () => {
        const d = await render('Alt One\n=======\n\nAlt Two\n-------\n');
        expect(ids(d)).toEqual(['alt-one', 'alt-two']);
    });
    it('multi-line setext joins lines with one space', async () => {
        const d = await render('First line\nsecond line\n======\n');
        expect(ids(d)).toEqual(['first-line-second-line']);
    });
    it('closing # run stripped', async () => {
        const d = await render('## Title ##\n\n### Other ###   \n');
        expect(ids(d)).toEqual(['title', 'other']);
    });
    it('closing run strip: tab-separated stripped, escaped \\# kept, setext trailing # kept', async () => {
        const d = await render('# Foo\t##\n\n# back \\#\n\nBar #\n===\n');
        expect(ids(d)).toEqual(['foo', 'back-', 'bar-']);
    });
    it('a link to the slug has a target in the output', async () => {
        const d = await render('[go](#second-part)\n\n# First\n\n## Second Part\n');
        expect(d.querySelector('a[href="#second-part"]')).not.toBeNull();
        expect(d.getElementById ? d.getElementById('second-part') : d.querySelector('#second-part')).not.toBeNull();
    });
});

describe('export heading ids: dedupe and per-render numbering', () => {
    it('duplicates get -1, -2 in document order', async () => {
        const d = await render('# Same\n\n## Same\n\n### Same\n');
        expect(ids(d)).toEqual(['same', 'same-1', 'same-2']);
    });
    it('two renders of one doc give identical ids (fresh slugger)', async () => {
        const md = '# A\n\n# A\n\n## B\n';
        const a = ids(await render(md));
        const b = ids(await render(md));
        expect(a).toEqual(['a', 'a-1', 'b']);
        expect(b).toEqual(a);
    });
    it('empty heading gets no id and does not advance counters', async () => {
        const d = await render('# x\n\n#\n\n## !!!\n\n# x\n');
        expect(ids(d)).toEqual(['x', '', '', 'x-1']);
        expect(d.querySelectorAll('h1,h2').length).toBe(4);
    });
});

describe('export heading ids: containers', () => {
    it('heading inside blockquote', async () => {
        expect(ids(await render('> ## Quoted\n> text\n'))).toEqual(['quoted']);
    });
    it('setext heading inside blockquote', async () => {
        const d = await render('> Quoted setext\n> ===\n');
        expect(ids(d)).toEqual(['quoted-setext']);
    });
    it('multi-line setext inside blockquote drops the > prefix of continuation lines', async () => {
        const d = await render('> Part one\n> part two\n> ===\n');
        expect(ids(d)).toEqual(['part-one-part-two']);
    });
    it('heading inside list item', async () => {
        const d = await render('- item\n\n  ## In list\n\n- other\n');
        expect(ids(d)).toEqual(['in-list']);
    });
    it('heading inside callout body', async () => {
        const d = await render('> [!note]\n> ## In callout\n> text\n');
        expect(ids(d)).toEqual(['in-callout']);
    });
    it('numbering runs across body, quote, list and callout in document order', async () => {
        const d = await render('# T\n\n> # T\n\n- a\n\n  # T\n\n> [!tip]\n> # T\n');
        expect(ids(d)).toEqual(['t', 't-1', 't-2', 't-3']);
    });
});

describe('export heading ids: exclusions', () => {
    it('front matter content gets nothing and does not shift numbering', async () => {
        const d = await render('---\n# Not heading\ntitle: x\n---\n\n# Not heading\n');
        expect(ids(d)).toEqual(['not-heading']);
    });
    it('code blocks are not headings', async () => {
        const d = await render('```\n# code\n```\n\n    # indented\n\n# Real\n');
        expect(ids(d)).toEqual(['real']);
    });
    it('raw HTML heading gets no id and is not counted', async () => {
        const d = await render('<h2>Raw</h2>\n\n# Raw\n');
        const hs = [...d.querySelectorAll('h1,h2')];
        expect(hs.map((h) => h.textContent)).toEqual(['Raw', 'Raw']);
        expect(hs.map((h) => h.id)).toEqual(['', 'raw']);
    });
    it('raw HTML id attribute is dropped (security)', async () => {
        const d = await render('<h2 id="x">Y</h2>\n');
        const h = d.querySelector('h2');
        expect(h.id).toBe('');
        expect(h.hasAttribute('id')).toBe(false);
        expect(await renderMarkdownHtml('<h2 id="x">Y</h2>\n')).not.toContain('id="x"');
    });
    it('raw HTML cannot claim a heading slug id for another element', async () => {
        const d = await render('<p id="mine">p</p>\n\n# Mine\n');
        expect(d.querySelectorAll('[id="mine"]').length).toBe(1);
        expect(d.querySelector('[id="mine"]').tagName).toBe('H1');
    });
    it('heading inside a footnote definition gets no id; body headings keep theirs', async () => {
        const md = '# Body\n\nRef[^1]\n\n[^1]: note\n\n    ## Inner\n\n## After\n';
        const d = await render(md);
        const inner = [...d.querySelectorAll('section.footnotes h1,section.footnotes h2,section.footnotes h3')];
        for (const h of inner) expect(h.id).toBe('');
        const body = [...d.querySelectorAll('h1,h2')].filter((h) => !h.closest('section.footnotes'));
        expect(body.map((h) => h.id)).toEqual(['body', 'after']);
    });
    it('a footnote heading does not take a slug: later body heading with the same text is unnumbered', async () => {
        const d = await render('Ref[^1]\n\n[^1]: note\n\n    ## Same\n\n## Same\n');
        const body = [...d.querySelectorAll('h2')].filter((h) => !h.closest('section.footnotes'));
        expect(body.map((h) => h.id)).toEqual(['same']);
    });
});

describe('export heading ids: footnote ids and class marker', () => {
    it('footnotes keep fn-N / fnref-N ids next to heading ids', async () => {
        const d = await render('# Doc\n\nText[^1]\n\n[^1]: note\n');
        expect(d.querySelector('h1').id).toBe('doc');
        expect(d.querySelector('a.footnote-ref').id).toBe('fnref-1');
        expect(d.querySelector('li#fn-1')).not.toBeNull();
    });
    it('heading without other classes has no class attribute', async () => {
        const d = await render('# Plain\n');
        expect(d.querySelector('h1').hasAttribute('class')).toBe(false);
    });
    it('no class with the nf marker is left on any heading', async () => {
        const html = await renderMarkdownHtml('# A\n\n## B\n\n> ## C\n\nRef[^1]\n\n[^1]: n\n');
        for (const h of dom(html).querySelectorAll('h1,h2,h3,h4,h5,h6')) {
            expect(h.className).not.toMatch(/nf[0-9a-f]{24}-/);
            expect(h.className).not.toMatch(/\bnf/);
        }
        expect(html).not.toMatch(/nf[0-9a-f]{24}-/);
    });
    it('doc with math keeps heading ids and no marker class (slow path)', async () => {
        const d = await render('# Plain Title\n\n$$x$$\n');
        const h = d.querySelector('h1');
        expect(h.id).toBe('plain-title');
        expect(h.className).not.toMatch(/nf/);
    });
});

describe('sanitize.js stays untouched', () => {
    it('ALLOWED_ATTR has no id', () => {
        const src = readFileSync(resolve(process.cwd(), 'src/utils/sanitize.js'), 'utf8');
        const attrs = src.match(/ALLOWED_ATTR:\s*\[([^\]]*)\]/)[1];
        expect(attrs).not.toMatch(/['"]id['"]/);
    });
});
