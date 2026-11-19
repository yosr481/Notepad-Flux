import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));

import { renderMarkdownHtml, exportToHtml } from '../export';

// Export defects: ==highlight==, table column alignment, shared RTL/table CSS.
// Highlight rule mirrors the editor (livePreview.js): /==(.*?)==/ within one line, not inside math.
const T = 60000;
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));
const marks = (d) => [...d.querySelectorAll('mark')];

beforeEach(() => { exportFile.mockReset(); exportFile.mockResolvedValue(undefined); });

describe('export: ==highlight==', () => {
    it('a ==b== c gives <mark>b</mark> and no literal ==', async () => {
        const d = await render('a ==b== c');
        expect(marks(d).map((m) => m.innerHTML)).toEqual(['b']);
        expect(d.textContent).not.toContain('==');
    }, T);

    it('inner content is parsed as inline markdown', async () => {
        expect((await render('==**b**==')).querySelector('mark > strong')?.textContent).toBe('b');
        expect((await render('==*i*==')).querySelector('mark > em')?.textContent).toBe('i');
    }, T);

    it('three highlights on one line give three marks', async () => {
        expect(marks(await render('==a== x ==b== y ==c==')).map((m) => m.textContent)).toEqual(['a', 'b', 'c']);
    }, T);

    it('a highlight in a table cell is a <mark> in the td', async () => {
        const d = await render('| h |\n|---|\n| ==x== |');
        expect(d.querySelector('td mark')?.textContent).toBe('x');
    }, T);

    it('code span and math stay literal', async () => {
        const d = await render('`==x==` and $==x==$');
        expect(d.querySelector('code').textContent).toBe('==x==');
        expect(marks(d)).toHaveLength(0);
    }, T);

    it('unclosed ==x stays literal', async () => {
        const d = await render('a ==x b');
        expect(marks(d)).toHaveLength(0);
        expect(d.textContent).toContain('==x');
    }, T);

    it('empty ==== gives no empty <mark>', async () => {
        const d = await render('a ==== b');
        expect(marks(d)).toHaveLength(0);
        expect(d.textContent).toContain('====');
    }, T);

    it('never spans a newline', async () => {
        const d = await render('==a\nb==');
        expect(marks(d)).toHaveLength(0);
        expect(d.textContent).toContain('==a');
    }, T);

    it('==Important== `code` gives a mark followed by code', async () => {
        const d = await render('==Important== `code`');
        expect(marks(d)[0]?.textContent).toBe('Important');
        expect(d.querySelector('code')?.textContent).toBe('code');
        expect(marks(d)[0].compareDocumentPosition(d.querySelector('code')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }, T);

    it('raw <mark> via highlight does not open an injection (inner html stays escaped)', async () => {
        const d = await render('==<img src=x onerror=alert(1)>==');
        expect(d.querySelector('img[onerror]')).toBeNull();
    }, T);
});

describe('export: table column alignment', () => {
    const md = '| a | b | c | d |\n|:---|:---:|---:|---|\n| 1 | 2 | 3 | 4 |';
    it('th and td get align-left/center/right classes; unaligned none', async () => {
        const d = await render(md);
        for (const sel of ['th', 'td']) {
            const cells = [...d.querySelectorAll(sel)];
            expect(cells.map((c) => c.className)).toEqual(['align-left', 'align-center', 'align-right', '']);
        }
    }, T);

    it('no align or style attribute survives (sanitizer stays strict)', async () => {
        const d = await render(md);
        for (const c of d.querySelectorAll('th,td')) {
            expect(c.hasAttribute('align')).toBe(false);
            expect(c.hasAttribute('style')).toBe(false);
        }
    }, T);
});

describe('export: shared base CSS', () => {
    it('exportToHtml embeds unicode-bidi: plaintext and the .align-center rule', async () => {
        await exportToHtml('t', 'x');
        const html = exportFile.mock.calls[0][0];
        expect(html).toContain('unicode-bidi: plaintext');
        expect(html).toMatch(/\.align-center\s*\{[^}]*text-align:\s*center/);
    }, T);

    it('PrintDocument.jsx imports exportBase.css', () => {
        expect(readFileSync('src/components/Print/PrintDocument.jsx', 'utf8')).toMatch(/import\s+['"][^'"]*styles\/exportBase\.css['"]/);
    });
});
