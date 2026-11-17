import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));
vi.mock('../mermaid', () => ({ renderMermaid: vi.fn() }));

import { renderMermaid } from '../mermaid';
import { renderMarkdownHtml, exportToHtml } from '../export';

// Spec: Docs/internal/frontmatter-spec.md ("Syntax", "Export (HTML, PDF, Print)").
// Pinned choices (spec silent or only implied):
//  - renderMarkdownHtml removes the block found by scanFrontMatter (same rule as the editor, NO 500-line cap) before marked lexes.
//  - Equivalence is the contract: renderMarkdownHtml(fm + body, o) === renderMarkdownHtml(body, o) as exact HTML strings
//    (ids/markup carry no per-call randomness in the final output; mermaid is mocked deterministically).
//  - The text right after the closing fence's own line break is the body; the fence line break itself is not part of the body.
//  - Export never parses YAML: invalid YAML is still stripped.
//  - Not front matter (output unchanged from today): unclosed opening fence, block not at offset 0 (a BOM at 0 is fine).
//  - A body footnote reference to a definition that exists only inside the front matter stays literal text.
//  - No post-sanitize pass for front matter: export.js has no front-matter finish.
//  - The BOM that preceded the front matter never reaches the output.
const FM = '---\ntitle: Hello\ntags: [a, b]\n---\n';
const render = (md, o) => renderMarkdownHtml(md, o);
const same = async (fm, body, o) => {
    const [a, b] = await Promise.all([render(body, o), render(fm + body, o)]);
    expect(b).toBe(a);
    return b;
};

beforeEach(() => {
    exportFile.mockReset();
    renderMermaid.mockReset();
    renderMermaid.mockImplementation(async (src) => ({ svg: `<svg data-src="${encodeURIComponent(src)}"><g><text>ok</text></g></svg>` }));
});

describe('export front matter: stripped, nothing appears', () => {
    it('front matter alone renders to nothing visible: no hr, no h2, no key or value text', async () => {
        const html = await render(FM + 'Body.');
        expect(html).not.toContain('<hr');
        expect(html).not.toContain('<h2');
        expect(html).not.toContain('title');
        expect(html).not.toContain('Hello');
        expect(html).not.toContain('tags');
        expect(html).toContain('Body.');
    });

    it('a document that is only front matter renders to no hr/h2/text', async () => {
        const html = await render(FM);
        expect(html).not.toMatch(/<hr|<h2|title|Hello|tags/);
        expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
    });

    it('plain paragraph', async () => { await same(FM, 'Just a paragraph.\n'); });
    it('heading first', async () => {
        const html = await same(FM, '# Title\n\ntext\n');
        expect(html).toContain('<h1');
    });
    it('list', async () => { await same(FM, '- a\n- b\n- c\n'); });
    it('a later --- is still an hr', async () => {
        const html = await same(FM, 'above\n\n---\n\nbelow\n');
        expect(html.match(/<hr/g)).toHaveLength(1);
    });
    it('a later --- block still behaves as hr/setext (no second front matter)', async () => {
        const html = await same(FM, 'text\n\n---\nk: v\n---\nmore\n');
        expect(html).toContain('<hr');
    });
    it('math', async () => { await same(FM, 'inline $x^2$ and\n\n$$\ny = 1\n$$\n'); });
    it('footnotes', async () => {
        const html = await same(FM, 'Ref[^1] here.\n\n[^1]: the note\n');
        expect(html).toContain('the note');
    });
    it('a callout', async () => { await same(FM, '> [!note] Heads up\n> body\n'); });
    it('a mermaid fence', async () => {
        const html = await same(FM, '```mermaid\ngraph TD\nA-->B\n```\n');
        expect(html).toContain('mermaid-diagram');
        expect(renderMermaid).toHaveBeenCalledTimes(2); // once per render, none for the front matter
    });
});

describe('export front matter: syntax variants', () => {
    it('closed by ...', async () => { await same('---\ntitle: x\n...\n', 'Body\n'); });
    it('empty front matter ---\\n---', async () => {
        const html = await same('---\n---\n', 'Body\n');
        expect(html).not.toContain('<hr');
    });
    it('trailing spaces/tabs on the fences', async () => { await same('---  \ntitle: x\n---\t\n', 'Body\n'); });
    it('BOM before the opening fence is stripped and not in output', async () => {
        const html = await same('﻿' + FM, 'Body\n');
        expect(html).not.toContain('﻿');
        expect(html).not.toContain('<hr');
    });
    it('CRLF document', async () => {
        const crlf = (s) => s.replace(/\n/g, '\r\n');
        const html = await same(crlf(FM), crlf('# H\n\ntext\n\n- a\n- b\n'));
        expect(html).not.toMatch(/title|Hello|<hr/);
    });
    it('closer more than 500 lines down is still stripped (no cap in export)', async () => {
        const yaml = Array.from({ length: 700 }, (_, i) => `key${i}: value${i}`).join('\n');
        const html = await same('---\n' + yaml + '\n---\n', 'Body\n');
        expect(html).not.toMatch(/key\d|value\d|<hr|<h2/);
    });
    it('invalid YAML is still stripped (export never parses it)', async () => {
        const html = await same('---\n: : [unclosed\n  - {a\n\t bad: "x\n---\n', 'Body\n');
        expect(html).not.toMatch(/unclosed|bad|<hr|<h2/);
    });
    it('front matter followed directly by end of document with no trailing newline', async () => {
        const html = await render('---\ntitle: x\n---');
        expect(html).not.toMatch(/<hr|<h2|title/);
    });
});

describe('export front matter: not front matter, exported as today', () => {
    it('unclosed opening fence: hr + paragraph, text kept', async () => {
        const html = await render('---\ntitle: x\n\nBody\n');
        expect(html).toContain('<hr');
        expect(html).toContain('title: x');
        expect(html).toContain('Body');
    });
    it('unclosed fence with a later --- is not closed by a non-fence line', async () => {
        const html = await render('---\ntitle: x\nBody\n');
        expect(html).toContain('<hr');
        expect(html).toContain('title: x');
    });
    it('--- block not at line 1: hr + setext h2, text kept', async () => {
        const html = await render('intro\n\n---\ntitle: x\n---\nbody\n');
        expect(html).toContain('<hr');
        expect(html).toContain('<h2');
        expect(html).toContain('title: x');
    });
    it('--- block after a leading blank line is not front matter', async () => {
        const html = await render('\n---\ntitle: x\n---\nbody\n');
        expect(html).toContain('title: x');
    });
    it('fence with extra characters (---x) does not open front matter', async () => {
        const html = await render('---x\ntitle: x\n---\nbody\n');
        expect(html).toContain('title: x');
    });
});

describe('export front matter: front matter contents never leak', () => {
    it('footnote def, math and <script> inside front matter do not appear', async () => {
        const fm = '---\nnote: "[^1]: secret note"\n$x$: <script>alert(1)</script>\n---\n';
        const html = await render(fm + 'Body\n');
        expect(html).not.toMatch(/secret|script|alert|\$x\$|footnote|<svg|math/i);
        expect(html).toBe(await render('Body\n'));
    });
    it('unquoted [^1]: note and $x$ lines inside front matter vanish; no footnotes section', async () => {
        const fm = '---\n[^1]: note\nmath: $x$\n---\n';
        const html = await render(fm + 'Body\n');
        expect(html).toBe(await render('Body\n'));
        expect(html).not.toContain('note');
    });
    it('a body [^1] reference does NOT resolve to a definition that only exists in the front matter', async () => {
        const fm = '---\n[^1]: only in front matter\n---\n';
        const html = await render(fm + 'See[^1] here.\n');
        expect(html).toBe(await render('See[^1] here.\n'));
        expect(html).toContain('[^1]');
        expect(html).not.toContain('only in front matter');
        expect(html).not.toContain('footnote');
    });
    it('exportToHtml: front matter text absent from the written file', async () => {
        await exportToHtml('doc', FM + 'Body\n');
        const written = exportFile.mock.calls[0][0];
        expect(written).toContain('Body');
        expect(written).not.toMatch(/Hello|tags: |title: /);
    });
});

describe('export front matter: expandFolds option path (PDF/Print)', () => {
    const body = '> [!note]- Folded\n> hidden\n\n> [!tip]+ Open\n> shown\n\n---\n\nend\n';
    it('same output with and without front matter when expandFolds: true', async () => {
        const html = await same(FM, body, { expandFolds: true });
        expect(html).toContain('<details');
        expect(html.match(/<details/g).length).toBe(html.match(/<details[^>]* open/g).length); // every fold expanded
        expect(html).not.toMatch(/Hello|tags/);
    });
    it('same output with and without front matter by default (folds kept)', async () => {
        const html = await same(FM, body);
        expect(html).toContain('<details');
    });
    it('empty and BOM front matter under expandFolds', async () => {
        await same('﻿---\n---\n', body, { expandFolds: true });
    });
});

describe('export front matter: no post-sanitize pass', () => {
    it('export.js has no front-matter finish/factory', () => {
        const src = readFileSync(resolve(process.cwd(), 'src/utils/export.js'), 'utf8');
        expect(src).not.toMatch(/frontMatter\w*\.finish|createFrontMatter/i);
    });
});
