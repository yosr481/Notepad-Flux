import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marked } from 'marked';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));

import { renderMarkdownHtml, markdownToHtml, exportToHtml } from '../export';
import { mathSyntax } from '../../extensions/mathSyntax';
import { footnoteSyntax } from '../../extensions/footnoteSyntax';
import { resolveFootnotes } from '../../extensions/footnotes';

// Spec: Docs/internal/footnotes-spec.md ("Export (HTML, PDF, Print)", "Security").
// Pinned choices where the spec is silent:
//  - Output is checked through DOM parsing, never exact whitespace.
//  - Back-link of a note whose last block is not a paragraph (list, code): only "exists inside the <li>" is pinned.
//  - The ref text is always the number; ids/hrefs come from numbers only (no label text anywhere).
//  - A `[^x]` ref to a defined note followed by `(url)` stays a footnote ref; what follows is lexed by normal rules (url autolinked, as the editor does).
//  - REVISED 2026-11-17 (GitHub order, see spec "Numbering"): refs in a definition are numbered after all body refs;
//    notes reached only from unreferenced notes are not exported and leave no number gap.
//  - A ref/inline note inside link text exports as a plain <sup>N</sup> (no nested <a>); the note itself is still exported.
//  - Ids are set after sanitizing (per-render nonce marker); raw HTML can never produce an id.
//  - A ref only inside an IGNORED duplicate definition is not reached (not exported).
const T = 60000;

const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md) => dom(await renderMarkdownHtml(md));
const lis = (d) => [...d.querySelectorAll('section.footnotes > ol > li')];
const refs = (d) => [...d.querySelectorAll('sup > a.footnote-ref')];
const back = (li) => [...li.querySelectorAll('a.footnote-backref')];

beforeEach(() => { exportFile.mockReset(); });

describe('renderMarkdownHtml footnotes: reference shape', () => {
    it('ref is sup > a with href #fn-N, id fnref-N, class footnote-ref, text N', async () => {
        const d = await render('Text[^a]\n\n[^a]: note');
        const a = d.querySelector('p > sup > a');
        expect(a.getAttribute('href')).toBe('#fn-1');
        expect(a.getAttribute('id')).toBe('fnref-1');
        expect(a.getAttribute('class')).toBe('footnote-ref');
        expect(a.textContent).toBe('1');
    });

    it('2nd and 3rd refs to the same note: fnref-1-2, fnref-1-3, same href and text', async () => {
        const d = await render('A[^a] B[^a] C[^a]\n\n[^a]: note');
        const r = refs(d);
        expect(r.map((a) => a.id)).toEqual(['fnref-1', 'fnref-1-2', 'fnref-1-3']);
        expect(r.map((a) => a.getAttribute('href'))).toEqual(['#fn-1', '#fn-1', '#fn-1']);
        expect(r.map((a) => a.textContent)).toEqual(['1', '1', '1']);
    });

    it('labels match case-insensitively', async () => {
        const d = await render('A[^Note] B[^note]\n\n[^NOTE]: n');
        expect(refs(d).map((a) => a.id)).toEqual(['fnref-1', 'fnref-1-2']);
        expect(lis(d)).toHaveLength(1);
    });

    it('a defined ref followed by (url) is still a footnote ref; the editor autolinks the url, so export does too', async () => {
        // Editor (lezer GFM) parses FootnoteReference then URL for `x[^a](http://e.com/p)`; export follows: normal rules after the ref.
        const d = await render('x[^a](https://e.com/p) y\n\n[^a]: n');
        expect(refs(d)).toHaveLength(1);
        expect(d.querySelector('a[href="https://e.com/p"]')).not.toBeNull();
        expect(d.querySelector('a[href="#fn-1"]')).not.toBeNull();
    });
});

describe('renderMarkdownHtml footnotes: section shape', () => {
    it('section.footnotes > ol > li#fn-N with content and a back-link in the last paragraph', async () => {
        const d = await render('Text[^a]\n\n[^a]: the note');
        const [li] = lis(d);
        expect(li.id).toBe('fn-1');
        expect(li.textContent).toContain('the note');
        const p = li.querySelector('p:last-of-type');
        const b = back(li);
        expect(b).toHaveLength(1);
        expect(p.contains(b[0])).toBe(true);
        expect(b[0].getAttribute('href')).toBe('#fnref-1');
        expect(b[0].getAttribute('class')).toBe('footnote-backref');
        expect(b[0].textContent).toBe('↩');
    });

    it('section is the last element of the output; exactly one section', async () => {
        const d = await render('One[^a]\n\nMiddle\n\n[^a]: n\n\nTail para');
        expect(d.querySelectorAll('section')).toHaveLength(1);
        expect(d.lastElementChild.matches('section.footnotes')).toBe(true);
        expect(d.textContent.indexOf('Tail para')).toBeLessThan(d.textContent.indexOf('n↩'));
    });

    it('one back-link per reference; later ones point at fnref-N-M', async () => {
        const d = await render('A[^a] B[^a] C[^a]\n\n[^a]: note');
        const b = back(lis(d)[0]);
        expect(b.map((x) => x.getAttribute('href'))).toEqual(['#fnref-1', '#fnref-1-2', '#fnref-1-3']);
    });

    it('notes are in number order (first reference), not definition order', async () => {
        const d = await render('A[^b] B[^a]\n\n[^a]: Alpha\n[^b]: Beta');
        const l = lis(d);
        expect(l.map((x) => x.id)).toEqual(['fn-1', 'fn-2']);
        expect(l[0].textContent).toContain('Beta');
        expect(l[1].textContent).toContain('Alpha');
        expect(refs(d).map((a) => a.getAttribute('href'))).toEqual(['#fn-1', '#fn-2']);
    });

    it('no footnotes: no section, no sup', async () => {
        const html = await renderMarkdownHtml('# Title\n\nplain [link](https://e.com) text');
        expect(html).not.toContain('<section');
        expect(html).not.toContain('<sup');
    });
});

describe('renderMarkdownHtml footnotes: inline ^[note]', () => {
    it('ref plus an li at its number with one back-link', async () => {
        const d = await render('x^[the inline note] y');
        const a = d.querySelector('sup > a.footnote-ref');
        expect(a.getAttribute('href')).toBe('#fn-1');
        expect(a.id).toBe('fnref-1');
        expect(a.textContent).toBe('1');
        const [li] = lis(d);
        expect(li.id).toBe('fn-1');
        expect(li.textContent).toContain('the inline note');
        expect(back(li)).toHaveLength(1);
        expect(back(li)[0].getAttribute('href')).toBe('#fnref-1');
        expect(d.querySelector('p').textContent).not.toContain('the inline note');
    });

    it('inline markdown inside renders', async () => {
        const d = await render('x^[a *b* and `c`] y');
        const [li] = lis(d);
        expect(li.querySelector('em').textContent).toBe('b');
        expect(li.querySelector('code').textContent).toBe('c');
    });

    it('inline and labelled share one sequence by first occurrence', async () => {
        const d = await render('a^[i1] b[^l] c^[i2]\n\n[^l]: lab');
        expect(refs(d).map((a) => a.textContent)).toEqual(['1', '2', '3']);
        expect(lis(d).map((li) => li.textContent.replace('↩', '').trim())).toEqual(['i1', 'lab', 'i2']);
    });

    it('empty ^[] is not a footnote', async () => {
        const html = await renderMarkdownHtml('x^[] y');
        expect(html).not.toContain('<sup');
        expect(html).not.toContain('<section');
        expect(html).toContain('^[]');
    });

    it('inline math inside an inline note renders', async () => {
        const d = await render('x^[see $a$ here] y');
        expect(lis(d)[0].querySelector('.math svg')).not.toBeNull();
    }, T);
});

describe('renderMarkdownHtml footnotes: unresolved, unreferenced, duplicate', () => {
    it('[^x] without definition stays literal text', async () => {
        const d = await render('see [^x] here');
        expect(d.querySelector('p').textContent).toBe('see [^x] here');
        expect(d.querySelector('sup')).toBeNull();
        expect(d.querySelector('section')).toBeNull();
    });

    it('[^x](url) with x undefined is a normal link', async () => {
        const d = await render('see [^x](https://e.com/p) here');
        const a = d.querySelector('a[href="https://e.com/p"]');
        expect(a).not.toBeNull();
        expect(d.querySelector('sup')).toBeNull();
        expect(d.querySelector('section')).toBeNull();
    });

    it('escaped \\[^a] is literal even when a is defined', async () => {
        const d = await render('x \\[^a] y\n\n[^a]: note');
        expect(d.querySelector('sup')).toBeNull();
        expect(d.querySelector('section')).toBeNull();
        expect(d.querySelector('p').textContent).toContain('[^a]');
    });

    it('unreferenced definition is not in the output at all', async () => {
        const html = await renderMarkdownHtml('Text\n\n[^a]: orphan note');
        expect(html).not.toContain('orphan');
        expect(html).not.toContain('<section');
        expect(html).not.toContain('[^a]');
    });

    it('only referenced definitions appear', async () => {
        const d = await render('x[^b]\n\n[^a]: unused note\n[^b]: used note');
        expect(lis(d)).toHaveLength(1);
        expect(lis(d)[0].textContent).toContain('used note');
        expect(d.textContent).not.toContain('unused note');
    });

    it('duplicate definition: first wins, later ones are gone from the output', async () => {
        const d = await render('x[^a]\n\n[^a]: first note\n\n[^a]: second note');
        expect(lis(d)).toHaveLength(1);
        expect(lis(d)[0].textContent).toContain('first note');
        expect(d.textContent).not.toContain('second note');
    });
});

describe('renderMarkdownHtml footnotes: note content', () => {
    it('multi-paragraph definition (4-space continuation) stays in the li', async () => {
        const d = await render('x[^a]\n\n[^a]: para one\n\n    para two\n\nafter');
        const [li] = lis(d);
        const ps = [...li.querySelectorAll('p')];
        expect(ps.map((p) => p.textContent.replace('↩', '').trim())).toEqual(['para one', 'para two']);
        expect(ps[1].contains(back(li)[0])).toBe(true);
        expect(d.textContent.indexOf('after')).toBeLessThan(d.textContent.indexOf('para one'));
    });

    it('a list inside a note renders inside the li, back-link present', async () => {
        const d = await render('x[^a]\n\n[^a]: intro\n\n    - item A\n    - item B\n');
        const [li] = lis(d);
        expect([...li.querySelectorAll('ul > li')].map((x) => x.textContent.trim())).toEqual(['item A', 'item B']);
        expect(back(li)).toHaveLength(1);
    });

    it('math inside a note renders the math span like the body', async () => {
        const d = await render('x[^a]\n\n[^a]: energy $E$ here');
        const [li] = lis(d);
        const m = li.querySelector('span.math.math-inline');
        expect(m).not.toBeNull();
        expect(m.querySelector('svg')).not.toBeNull();
        expect(li.textContent).not.toContain('$E$');
    }, T);

    it('inline markdown in a labelled note renders', async () => {
        const d = await render('x[^a]\n\n[^a]: some **bold** and [link](https://e.com)');
        const [li] = lis(d);
        expect(li.querySelector('strong').textContent).toBe('bold');
        expect(li.querySelector('a[href="https://e.com"]')).not.toBeNull();
    });

    it('a ref inside a referenced note is numbered after the body refs', async () => {
        const d = await render('x[^a]\n\n[^a]: first, see[^b]\n[^b]: second');
        expect(refs(d).map((a) => a.textContent)).toEqual(['1', '2']);
        expect(lis(d).map((li) => li.id)).toEqual(['fn-1', 'fn-2']);
        expect(lis(d)[0].querySelector('a.footnote-ref').getAttribute('href')).toBe('#fn-2');
        expect(back(lis(d)[1])[0].getAttribute('href')).toBe('#fnref-2');
    });
});

describe('renderMarkdownHtml footnotes: containers', () => {
    it('definition inside a blockquote is collected and removed from the quote', async () => {
        const d = await render('x[^a]\n\n> quoted\n> [^a]: NOTEQ\n\ntail');
        expect(lis(d)[0].textContent).toContain('NOTEQ');
        const bq = d.querySelector('blockquote');
        expect(bq?.textContent ?? '').not.toContain('NOTEQ');
        expect(d.textContent).not.toContain('[^a]:');
    });

    it('definition inside a list item is collected and removed from the list', async () => {
        const d = await render('x[^a]\n\n- one\n- [^a]: NOTEL\n- three');
        expect(lis(d)[0].textContent).toContain('NOTEL');
        const body = [...d.querySelectorAll('ul')].map((u) => u.textContent).join('');
        expect(body).not.toContain('NOTEL');
        expect(body).toContain('one');
        expect(body).toContain('three');
        expect(d.textContent).not.toContain('[^a]:');
    });

    it('reference inside a blockquote and a list item resolves', async () => {
        const d = await render('> q[^a]\n\n- l[^a]\n\n[^a]: n');
        expect(refs(d).map((a) => a.id)).toEqual(['fnref-1', 'fnref-1-2']);
    });
});

describe('renderMarkdownHtml footnotes: never footnotes', () => {
    it.each([
        ['code span', 'x `[^a]` y\n\n[^a]: n'],
        ['fenced code', '```\n[^a]\n```\n\n[^a]: n'],
        ['indented code', 'para\n\n    [^a]\n\n[^a]: n'],
        ['inline math', 'x $y[^a]$ z\n\n[^a]: n'],
        ['block math', '$$\nx[^a]\n$$\n\n[^a]: n'],
        ['html comment', '<!-- [^a] -->\n\n[^a]: n'],
        ['link url', '[t](https://e.com/[^a]) x\n\n[^a]: n'],
    ])('reference in %s is not a footnote', async (_n, md) => {
        const d = await render(md);
        expect(d.querySelector('sup')).toBeNull();
        expect(d.querySelector('section')).toBeNull();
    }, T);

    it('code span keeps its literal text', async () => {
        const d = await render('x `[^a]` y\n\n[^a]: n');
        expect(d.querySelector('code').textContent).toBe('[^a]');
    });

    it('inline note syntax in code and math is not a footnote', async () => {
        for (const md of ['x `^[n]` y', '```\n^[n]\n```', 'x $a^[n]$ y']) {
            const d = await render(md);
            expect(d.querySelector('section'), md).toBeNull();
            expect(d.querySelector('sup'), md).toBeNull();
        }
    }, T);

    it('a definition inside a fenced code block is not a definition', async () => {
        const d = await render('```\n[^a]: note\n```\n\nText[^a]');
        expect(d.querySelector('pre code').textContent).toContain('[^a]: note');
        expect(d.querySelector('sup')).toBeNull();
        expect(d.querySelector('section')).toBeNull();
    });
});

describe('renderMarkdownHtml footnotes: security', () => {
    it('<script>, javascript: link and onerror in a note are stripped; note behaves like a body paragraph', async () => {
        // Property: no <script>, no javascript: href, no on* attribute. Whether the markdown link renders is NOT pinned
        // (raw html at the start of a block is an html block, in the body and in a note alike; F7 revisits html).
        const payload = '<script>alert(1)</script> [bad](javascript:alert(2)) <img src=x onerror=alert(3)> ok';
        const check = (html) => {
            expect(html).not.toContain('<script');
            const d = dom(html); // literal "javascript:" text is harmless; only href/attributes matter
            expect(d.querySelector('script')).toBeNull();
            for (const el of d.querySelectorAll('*')) for (const at of el.attributes) expect(at.name.startsWith('on')).toBe(false);
            for (const a of d.querySelectorAll('a[href]')) expect(a.getAttribute('href')).not.toMatch(/^\s*javascript:/i);
        };
        check(await renderMarkdownHtml('x[^a]\n\n[^a]: ' + payload));
        check(await renderMarkdownHtml('x[^a]\n\n' + payload + '\n\n[^a]: n'));
        check(await renderMarkdownHtml('x[^a]\n\n[^a]: lead ' + payload));
    });

    it('same payloads in an inline note are stripped', async () => {
        const html = await renderMarkdownHtml('x^[<script>alert(1)</script> [b](javascript:alert(2)) <img src=x onerror=alert(3)>] y');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('onerror');
    });

    it('a hostile label with whitespace is just text: no element, no attribute from it', async () => {
        const d = await render('x[^"><img src=x onerror=alert(1)>]\n\n[^"><img src=x onerror=alert(1)>]: n');
        expect(d.querySelector('[onerror]')).toBeNull();
        expect(d.querySelector('section')).toBeNull();
    });

    it('a hostile whitespace-free label that IS defined never reaches ids, hrefs or text', async () => {
        const label = '"><b>x</b>';
        const d = await render(`x[^${label}] y\n\n[^${label}]: note`);
        const html = d.firstElementChild ? [...d.children].map((e) => e.outerHTML).join('') : '';
        expect(d.querySelector('b')).toBeNull();
        expect(html).not.toContain('<b>');
        for (const el of d.querySelectorAll('[id]')) expect(el.id).toMatch(/^fn(ref)?-\d+(-\d+)?$/);
        for (const a of d.querySelectorAll('a[href]')) expect(a.getAttribute('href')).toMatch(/^#fn(ref)?-\d+(-\d+)?$/);
        expect(html).not.toContain('"><');
    });

    it('every id in the output (refs, notes, back-link targets) matches the fn rule', async () => {
        const d = await render('A[^a] B[^a] C^[i] D[^b]\n\n[^a]: n\n[^b]: m');
        const ids = [...d.querySelectorAll('[id]')].map((e) => e.id);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) expect(id).toMatch(/^fn(ref)?-\d+(-\d+)?$/);
    });

    it('body content cannot set ids: id attr in raw html is dropped while a footnote id survives', async () => {
        const d = await render('<span id="location">s</span> x[^a]\n\n[^a]: n');
        expect(d.querySelector('#location')).toBeNull();
        expect(d.querySelector('#fnref-1')).not.toBeNull();
    });

    it('a raw <a id="fn-1"> cannot spoof the footnote target: exactly one id="fn-1", on the note li', async () => {
        const d = await render('<a id="fn-1">p</a> ^[n]');
        expect(d.querySelectorAll('[id="fn-1"]')).toHaveLength(1);
        expect(d.querySelector('[id="fn-1"]').tagName).toBe('LI');
        const user = [...d.querySelectorAll('a')].find((a) => a.textContent === 'p');
        expect(user.hasAttribute('id')).toBe(false);
    });

    it('raw ids that mimic fnref-N also get dropped: the only id="fnref-1" is the real ref', async () => {
        const d = await render('<span id="fnref-1">s</span><li id="fn-1">l</li> x[^a]\n\n[^a]: n');
        expect(d.querySelectorAll('[id="fnref-1"]')).toHaveLength(1);
        expect(d.querySelector('[id="fnref-1"]').tagName).toBe('A');
        expect(d.querySelectorAll('[id="fn-1"]')).toHaveLength(1);
        expect(d.querySelector('[id="fn-1"]').parentElement.parentElement.className).toBe('footnotes');
    });

    it.each([
        '<span class="fnid-fn-1">s</span>',
        '<span class="fnid-1 fnid-fn-1 nf-fn-1 NFFN0">s</span>',
        '<span title="fnid-fn-1" class="fnid">s</span>',
        '<span class="fnid-fnref-1">s</span> fnid-fn-1 NFFN',
        '<a href="#fnid-fn-1" class="fnid-fn-1">s</a>',
    ])('guessable marker in raw html cannot produce an id: %s', async (raw) => {
        const d = await render(`${raw} x^[n] y^[m]`);
        expect([...d.querySelectorAll('[id]')].map((e) => e.id).sort()).toEqual(['fn-1', 'fn-2', 'fnref-1', 'fnref-2']);
    });

    it('output carries no marker leftovers: li has only id, refs only href/id/class, back-links only href/class', async () => {
        const d = await render('A[^a] B[^a]\n\n[^a]: n');
        expect(lis(d)[0].getAttributeNames()).toEqual(['id']);
        for (const a of refs(d)) expect(a.getAttributeNames().sort()).toEqual(['class', 'href', 'id']);
        for (const a of back(lis(d)[0])) expect(a.getAttributeNames().sort()).toEqual(['class', 'href']);
        expect(d.querySelector('section.footnotes').getAttributeNames()).toEqual(['class']);
    });

    it('rendering twice gives identical output (nonce never leaks into it)', async () => {
        const md = 'A[^a] B^[i]\n\n[^a]: n';
        expect(await renderMarkdownHtml(md)).toBe(await renderMarkdownHtml(md));
    });

    it('ids survive together with math in the same document', async () => {
        const d = await render('$x$ A[^a]\n\n[^a]: n $y$');
        expect(d.querySelector('#fnref-1')).not.toBeNull();
        expect(d.querySelector('li#fn-1')).not.toBeNull();
    });
});

describe('renderMarkdownHtml footnotes: GitHub order and unreachable notes', () => {
    const hrefsResolve = (d) => {
        for (const a of d.querySelectorAll('a[href^="#"]')) expect(d.querySelector(`[id="${a.getAttribute('href').slice(1)}"]`)).not.toBeNull();
    };

    it('adversarial repro: only note B is exported, no dangling #fnref-2', async () => {
        const d = await render('x [^b]\n\n[^a]: has [^c]\n\n[^b]: B\n\n[^c]: C\n');
        expect(lis(d)).toHaveLength(1);
        expect(lis(d)[0].id).toBe('fn-1');
        expect(lis(d)[0].textContent).toContain('B');
        expect(d.querySelector('[href="#fnref-2"]')).toBeNull();
        expect(d.querySelector('[id="fn-2"]')).toBeNull();
        expect(d.textContent).not.toContain('has');
        expect(d.textContent).not.toMatch(/\bC\b/);
        expect(refs(d).map((a) => a.textContent)).toEqual(['1']);
        hrefsResolve(d);
    });

    it('refs inside a definition are numbered after all body refs', async () => {
        const d = await render('a[^1] b[^2]\n\n[^1]: see[^3]\n[^2]: two\n[^3]: three');
        expect(lis(d).map((li) => li.id)).toEqual(['fn-1', 'fn-2', 'fn-3']);
        expect(lis(d).map((li) => li.textContent.replace(/[\s↩\d]+$/g, '').trim().split(/[ ,]/)[0])).toEqual(['see', 'two', 'three']);
        expect(lis(d)[0].querySelector('a.footnote-ref').getAttribute('href')).toBe('#fn-3');
    });

    it('definitions are read breadth first in number order', async () => {
        const d = await render('x[^b] y[^a]\n\n[^a]: A see[^p]\n[^b]: B see[^q]\n[^p]: P\n[^q]: Q');
        expect(lis(d).map((li) => li.textContent.trim()[0])).toEqual(['B', 'A', 'Q', 'P']);
    });

    it('notes reached only from an unreferenced note are not exported, transitively', async () => {
        const d = await render('x[^a]\n\n[^a]: A\n[^u]: U see[^v]\n[^v]: V see[^w]\n[^w]: W');
        expect(lis(d)).toHaveLength(1);
        expect(d.textContent).not.toContain('see');
        expect(lis(d)[0].textContent).toContain('A');
        hrefsResolve(d);
    });

    it('an inline note inside an unreferenced definition is not exported either', async () => {
        const d = await render('x[^a]\n\n[^a]: A\n[^u]: U with^[hidden]');
        expect(lis(d)).toHaveLength(1);
        expect(d.textContent).not.toContain('hidden');
    });

    it('a ref inside a definition to an already numbered note adds a second back-link to that note', async () => {
        const d = await render('x[^a] y[^b]\n\n[^a]: A\n[^b]: B see[^a]');
        expect(back(lis(d)[0]).map((a) => a.getAttribute('href'))).toEqual(['#fnref-1', '#fnref-1-2']);
        hrefsResolve(d);
    });

    it('a ref only inside an ignored duplicate definition is not exported', async () => {
        const d = await render('x[^a]\n\n[^a]: first\n\n[^a]: dup see[^b]\n\n[^b]: B');
        expect(lis(d)).toHaveLength(1);
        expect(lis(d)[0].textContent).toContain('first');
    });
});

describe('renderMarkdownHtml footnotes: inside link text', () => {
    const hrefsResolve = (d) => {
        for (const a of d.querySelectorAll('a[href^="#"]')) expect(d.querySelector(`[id="${a.getAttribute('href').slice(1)}"]`)).not.toBeNull();
    };
    it('a ref in link text is a plain <sup>N</sup>, no nested anchor; the note and its back-link are exported', async () => {
        const d = await render('[x [^a] y](http://e.com)\n\n[^a]: n');
        const link = d.querySelector('a[href="http://e.com"]');
        expect(link).not.toBeNull();
        expect(link.querySelector('a')).toBeNull();
        expect(link.querySelector('sup').outerHTML).toBe('<sup id="fnref-1">1</sup>');
        expect(link.textContent).toBe('x 1 y');
        expect(d.querySelectorAll('a a')).toHaveLength(0);
        hrefsResolve(d);
        expect(lis(d)).toHaveLength(1);
        expect(lis(d)[0].id).toBe('fn-1');
        expect(back(lis(d)[0])).toHaveLength(1);
        expect(back(lis(d)[0])[0].getAttribute('href')).toBe('#fnref-1');
    });

    it('an inline note in link text is a plain <sup>N</sup> too, and the note is exported', async () => {
        const d = await render('[x ^[the note] y](http://e.com)');
        const link = d.querySelector('a[href="http://e.com"]');
        expect(link.querySelector('a')).toBeNull();
        expect(link.querySelector('sup').outerHTML).toBe('<sup id="fnref-1">1</sup>');
        expect(link.textContent).toBe('x 1 y');
        expect(lis(d)).toHaveLength(1);
        expect(lis(d)[0].textContent).toContain('the note');
        expect(back(lis(d)[0])).toHaveLength(1);
        hrefsResolve(d);
    });

    it('a ref in link text still takes its number in document order, and later refs continue after it', async () => {
        const d = await render('[x [^a] y](http://e.com) then z[^b]\n\n[^a]: A\n[^b]: B');
        expect(lis(d).map((li) => li.id)).toEqual(['fn-1', 'fn-2']);
        const link = d.querySelector('a[href="http://e.com"]');
        expect(link.textContent).toBe('x 1 y');
        expect(refs(d).map((a) => a.textContent)).toContain('2');
        hrefsResolve(d);
    });

    it('a ref outside the link text is unaffected (still sup > a.footnote-ref)', async () => {
        const d = await render('[plain](http://e.com) q[^a]\n\n[^a]: n');
        expect(refs(d)).toHaveLength(1);
        expect(refs(d)[0].id).toBe('fnref-1');
    });
});

describe('numbering parity with resolveFootnotes', () => {
    const state = (doc) => {
        const s = EditorState.create({
            doc,
            extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] })],
        });
        // syntaxTree(state) is a snapshot from create (20 ms parse budget, partial under load); update({}) adopts the finished tree
        ensureSyntaxTree(s, s.doc.length, 5000);
        return s.update({}).state;
    };
    // Every note text is unique ("txt-<label>" / "inl-<k>"): li number N must hold the text resolveFootnotes numbers N.
    const docs = [
        'a^[inl-1] b[^x] c^[inl-2] d[^y]\n\n[^x]: txt-x\n[^y]: txt-y',
        'a[^y] b[^x] c[^y] d[^x]\n\n[^x]: txt-x\n[^y]: txt-y',
        'a[^x] b[^q] c[^y]\n\n[^x]: txt-x\n[^y]: txt-y',
        'start[^x]\n\n[^x]: txt-x, see[^y]\n[^y]: txt-y\n\nend^[inl-1]',
        '> q[^y]\n\n- l^[inl-1] m[^x]\n\n[^x]: txt-x\n\n> [^y]: txt-y',
        'a[^Note] b[^x] c[^NOTE] d^[inl-1]\n\n[^note]: txt-note\n[^x]: txt-x',
        'a[^x] b[^y]\n\n[^x]: txt-x see[^z]\n[^y]: txt-y see[^w] and^[inl-1]\n[^z]: txt-z\n[^w]: txt-w',
        'x [^b]\n\n[^a]: txt-a has [^c]\n\n[^b]: txt-b\n\n[^c]: txt-c\n',
        'a[^x]\n\n[^x]: txt-x\n[^u]: txt-u see[^v] and^[inl-1]\n[^v]: txt-v',
        'a[^x] b[^y]\n\n[^x]: txt-x\n[^y]: txt-y see[^x]',
    ];
    it.each(docs.map((d, i) => [i, d]))('doc #%i: li order and ref numbers equal resolveFootnotes', async (_i, doc) => {
        const r = resolveFootnotes(state(doc));
        const expected = [];
        for (const [label, e] of r.labelled) expected[e.number - 1] = 'txt-' + label.toLowerCase();
        for (const [, e] of r.inline) expected[e.number - 1] = e.text;
        const d = await render(doc);
        const got = lis(d).map((li) => li.textContent.replace('↩', '').replace(/[\s↩]+$/g, '').replace(/\s+/g, ' ').trim());
        expect(got.map((t) => t.split(/[ ,]/)[0])).toEqual(expected.map((t) => t.split(/[ ,]/)[0]));
        const maxN = expected.length;
        expect(refs(d).every((a) => Number(a.textContent) >= 1 && Number(a.textContent) <= maxN)).toBe(true);
        // Per-ref numbers, not DOM order: a ref inside a note renders in the section, after the body's refs.
        // Multiset of ref numbers in the DOM == multiset resolveFootnotes assigns (refs of a note + one per inline note).
        const want = [];
        for (const [, e] of r.labelled) for (let k = 0; k < e.refs.length; k++) want.push(e.number);
        for (const [, e] of r.inline) want.push(e.number);
        expect(refs(d).map((a) => Number(a.textContent)).sort((a, b) => a - b)).toEqual(want.sort((a, b) => a - b));
        // every ref points at the li of its own number
        for (const a of refs(d)) expect(a.getAttribute('href')).toBe('#fn-' + a.textContent);
    });
});

describe('markdownToHtml stays the plain marked call', () => {
    it('no footnote handling: identical to marked()', () => {
        const md = 'a[^1] b^[c]\n\n[^1]: n';
        const out = markdownToHtml(md);
        expect(out).toBe(marked(md));
        expect(out).not.toContain('footnote');
        expect(out).not.toContain('<sup');
    });
});

describe('exportToHtml footnotes', () => {
    it('embeds the footnote section and a .footnotes style rule', async () => {
        exportFile.mockResolvedValue(true);
        await exportToHtml('T', 'x[^a]\n\n[^a]: note');
        const html = exportFile.mock.calls[0][0];
        expect(html).toContain('<section class="footnotes">');
        expect(html).toContain('id="fn-1"');
        expect(html).toMatch(/\.footnotes\s*\{/);
    });
});
