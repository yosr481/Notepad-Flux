import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({ fileSystem: { exportFile: (...a) => exportFile(...a) } }));

import { renderMarkdownHtml, exportToHtml } from '../export';
import { mathSyntax } from '../../extensions/mathSyntax';
import { footnoteSyntax } from '../../extensions/footnoteSyntax';
import { scanCallout, CALLOUT_TYPES } from '../../extensions/calloutSyntax';
import { lucideSvg } from '../lucideSvg';

// Spec: Docs/internal/callouts-spec.md ("Export (HTML, PDF, Print)", "Security").
// Pinned choices (spec silent or only implied):
//  - Output is checked through DOM parsing, never exact whitespace.
//  - Plain callout:  div.callout.callout-<canonical> > div.callout-title > (svg, span.callout-title-text) + div.callout-content.
//  - Foldable:       details.callout.callout-<canonical> > summary.callout-title (same children) + div.callout-content.
//  - Header-only callout (no body): no .callout-content element at all (also for foldable ones).
//  - The icon svg is the FIRST element child of .callout-title; exactly one svg per callout title.
//  - Icon svg children match lucideSvg(CALLOUT_TYPES[canonical].icon) child-for-child (outerHTML).
//  - The fold char (`-`/`+`) is never part of the title text.
//  - `expandFolds` is honoured only when === true; omitted, `{}` or `false` keep fold state (`-` closed, `+` open).
//    Non-foldable callouts stay <div> under expandFolds.
//  - Title text comes from .callout-title-text: custom title as inline markdown, else calloutTitle(scan).
//  - Class names: only `callout`, `callout-<canonical>` on the callout; the raw type text never appears in any class.
//  - A marker class (prefix `nf` + nonce) never survives into output; no element has an empty class attribute.
//  - A type longer than 50 chars is not a callout (scanCallout rule): plain <blockquote>.
//  - Raw HTML cannot forge the icon: user spans with marker-like classes never get an svg child, and svgs exist
//    only as the first child of a callout title.
//  - Not driven here: useCommands PDF/Print wiring (no existing unit test drives its export calls) -> e2e.
//    The 'expandFolds: true' contract of those two callers is pinned only at renderMarkdownHtml level.
const dom = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const render = async (md, options) => dom(await renderMarkdownHtml(md, options));
const callouts = (d) => [...d.querySelectorAll('.callout')];
const canonicalOf = (el) => [...el.classList].find((c) => c.startsWith('callout-'))?.slice('callout-'.length);
const titleEl = (c) => c.querySelector(':scope > .callout-title');
const titleText = (c) => titleEl(c).querySelector('.callout-title-text').textContent;
const content = (c) => c.querySelector(':scope > .callout-content');

beforeEach(() => { exportFile.mockReset(); });

describe('renderMarkdownHtml callouts: shape', () => {
    it('renders div.callout.callout-note > title (svg + text) + content, and no blockquote', async () => {
        const d = await render('> [!note] Heads up\n> body text');
        const [c, ...rest] = callouts(d);
        expect(rest).toEqual([]);
        expect(c.tagName).toBe('DIV');
        expect([...c.classList].sort()).toEqual(['callout', 'callout-note']);
        expect(titleEl(c).tagName).toBe('DIV');
        expect(titleEl(c).firstElementChild.tagName.toLowerCase()).toBe('svg');
        expect(titleText(c)).toBe('Heads up');
        expect(content(c).textContent.trim()).toBe('body text');
        expect(d.querySelector('blockquote')).toBeNull();
        expect([...c.children].map((e) => e.className)).toEqual(['callout-title', 'callout-content']);
    });

    it('header and body are separate: body does not leak into the title, title not into the body', async () => {
        const [c] = callouts(await render('> [!note] Only title\n> the body'));
        expect(titleText(c)).toBe('Only title');
        expect(content(c).textContent).not.toContain('Only title');
        expect(content(c).textContent).not.toContain('[!note]');
    });

    it('header-only callout has no .callout-content', async () => {
        const [c] = callouts(await render('> [!warning] Just a title'));
        expect(titleText(c)).toBe('Just a title');
        expect(c.querySelector('.callout-content')).toBeNull();
    });

    it('header with no title and no body: default title, no content element', async () => {
        const [c] = callouts(await render('> [!tip]'));
        expect(titleText(c)).toBe('Tip');
        expect(c.querySelector('.callout-content')).toBeNull();
    });

    it('body is not inside the title and no [!type] text remains anywhere', async () => {
        const html = await renderMarkdownHtml('> [!note]\n> body');
        expect(html).not.toContain('[!note]');
        expect(html).not.toContain('[!NOTE]');
    });

    it('two callouts separated by a blank line are two callouts', async () => {
        const cs = callouts(await render('> [!note] a\n\n> [!tip] b'));
        expect(cs.map(canonicalOf)).toEqual(['note', 'tip']);
    });

    it('a plain blockquote is untouched: blockquote, no callout', async () => {
        const d = await render('> just a quote\n> more');
        expect(callouts(d)).toEqual([]);
        expect(d.querySelector('blockquote')).not.toBeNull();
        expect(d.querySelector('svg')).toBeNull();
    });
});

describe('renderMarkdownHtml callouts: types, aliases, titles', () => {
    it.each([
        ['note', 'note'], ['abstract', 'abstract'], ['summary', 'abstract'], ['tldr', 'abstract'], ['info', 'info'],
        ['todo', 'todo'], ['tip', 'tip'], ['hint', 'tip'], ['important', 'important'], ['success', 'success'],
        ['check', 'success'], ['done', 'success'], ['question', 'question'], ['help', 'question'], ['faq', 'question'],
        ['warning', 'warning'], ['attention', 'warning'], ['caution', 'caution'], ['failure', 'failure'],
        ['fail', 'failure'], ['missing', 'failure'], ['danger', 'danger'], ['error', 'danger'], ['bug', 'bug'],
        ['example', 'example'], ['quote', 'quote'], ['cite', 'quote'],
    ])('[!%s] -> callout-%s', async (type, canonical) => {
        const [c] = callouts(await render(`> [!${type}]\n> b`));
        expect([...c.classList].sort()).toEqual(['callout', `callout-${canonical}`]);
    });

    it('[!tldr] is callout-abstract and its default title is the type as written, capitalised ("Tldr")', async () => {
        const [c] = callouts(await render('> [!tldr]\n> b'));
        expect(canonicalOf(c)).toBe('abstract');
        expect(titleText(c)).toBe('Tldr');
    });

    it('type is case-insensitive; default title is capitalised first letter, rest lowercased', async () => {
        const [c] = callouts(await render('> [!WARNING]\n> b'));
        expect(canonicalOf(c)).toBe('warning');
        expect(titleText(c)).toBe('Warning');
    });

    it('[!faq] default title is "Faq"', async () => {
        const [c] = callouts(await render('> [!faq]\n> b'));
        expect(titleText(c)).toBe('Faq');
    });

    it('unknown type renders as note with the type as title; raw type never in a class', async () => {
        const html = await renderMarkdownHtml('> [!xyz-Abc_1]\n> b');
        const [c] = callouts(dom(html));
        expect([...c.classList].sort()).toEqual(['callout', 'callout-note']);
        expect(titleText(c)).toBe('Xyz-abc_1');
        expect(html.toLowerCase()).not.toMatch(/class="[^"]*xyz/);
    });

    it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('prototype-ish type [!%s] is just an unknown type -> note', async (t) => {
        const [c] = callouts(await render(`> [!${t}]\n> b`));
        expect([...c.classList].sort()).toEqual(['callout', 'callout-note']);
    });

    it('custom title is rendered as inline markdown', async () => {
        const [c] = callouts(await render('> [!note] A **bold** and `code` and [l](https://e.com)\n> b'));
        const t = c.querySelector('.callout-title-text');
        expect(t.querySelector('strong').textContent).toBe('bold');
        expect(t.querySelector('code').textContent).toBe('code');
        expect(t.querySelector('a').getAttribute('href')).toBe('https://e.com');
    });

    it('Hebrew title kept as written', async () => {
        const [c] = callouts(await render('> [!note] כותרת בעברית\n> גוף'));
        expect(titleText(c)).toBe('כותרת בעברית');
        expect(content(c).textContent.trim()).toBe('גוף');
    });

    it('type with 50 chars is a callout, 51 chars is a plain blockquote', async () => {
        const ok = await render(`> [!${'a'.repeat(50)}]\n> b`);
        expect(callouts(ok)).toHaveLength(1);
        const no = await render(`> [!${'a'.repeat(51)}]\n> b`);
        expect(callouts(no)).toEqual([]);
        expect(no.querySelector('blockquote')).not.toBeNull();
    });
});

describe('renderMarkdownHtml callouts: icon', () => {
    it.each(Object.keys(CALLOUT_TYPES))('[!%s] icon svg matches lucideSvg(CALLOUT_TYPES.%s.icon)', async (canonical) => {
        const [c] = callouts(await render(`> [!${canonical}]\n> b`));
        const svg = titleEl(c).firstElementChild;
        expect(svg.tagName.toLowerCase()).toBe('svg');
        const expected = lucideSvg(CALLOUT_TYPES[canonical].icon, 'x');
        expect(expected).not.toBeNull();
        expect(svg.children.length).toBeGreaterThan(0);
        expect([...svg.children].map((e) => e.outerHTML)).toEqual([...expected.children].map((e) => e.outerHTML));
    });

    it('an alias uses the canonical icon; unknown uses the note icon', async () => {
        const d = await render('> [!hint]\n> b\n\n> [!zzz]\n> b');
        const note = lucideSvg(CALLOUT_TYPES.note.icon, 'x');
        const tip = lucideSvg(CALLOUT_TYPES.tip.icon, 'x');
        const [hint, zzz] = callouts(d).map((c) => [...titleEl(c).firstElementChild.children].map((e) => e.outerHTML));
        expect(hint).toEqual([...tip.children].map((e) => e.outerHTML));
        expect(zzz).toEqual([...note.children].map((e) => e.outerHTML));
    });

    it('exactly one svg per callout title, none elsewhere', async () => {
        const d = await render('> [!note] a\n> b\n\n> [!tip]- c\n> d\n\nplain text');
        expect(d.querySelectorAll('svg')).toHaveLength(2);
        for (const c of callouts(d)) expect(titleEl(c).querySelectorAll('svg')).toHaveLength(1);
    });

    it('foldable summary also gets the icon as first child', async () => {
        const [c] = callouts(await render('> [!danger]- t\n> b'));
        expect(titleEl(c).tagName).toBe('SUMMARY');
        expect(titleEl(c).firstElementChild.tagName.toLowerCase()).toBe('svg');
    });

    it('no marker class leaks: no class starting with "nf" + hex nonce, no empty class attribute', async () => {
        const html = await renderMarkdownHtml('> [!note] t\n> b $x$ and a[^1]\n\n> [!tip]- c\n\n[^1]: n');
        const d = dom(html);
        for (const el of d.querySelectorAll('*')) {
            for (const cls of el.classList) expect(cls).not.toMatch(/^nf[0-9a-f]{8}/i);
            if (el.hasAttribute('class')) expect(el.getAttribute('class').trim()).not.toBe('');
        }
        expect(html).not.toMatch(/nf[0-9a-f]{24}/i);
    });

    it('icon markup is deterministic across renders apart from nothing leaking (same input, same output)', async () => {
        const md = '> [!note] a\n> b\n\n> [!bug]- c';
        expect(await renderMarkdownHtml(md)).toBe(await renderMarkdownHtml(md));
    });
});

describe('renderMarkdownHtml callouts: folds', () => {
    it('`-` is details.callout, not open, summary.callout-title, content inside details', async () => {
        const [c] = callouts(await render('> [!note]- Folded\n> body'));
        expect(c.tagName).toBe('DETAILS');
        expect([...c.classList].sort()).toEqual(['callout', 'callout-note']);
        expect(c.hasAttribute('open')).toBe(false);
        expect(c.querySelector(':scope > summary.callout-title')).not.toBeNull();
        expect(titleText(c)).toBe('Folded');
        expect(c.querySelector(':scope > div.callout-content').textContent.trim()).toBe('body');
    });

    it('`+` is details with open', async () => {
        const [c] = callouts(await render('> [!tip]+ Open\n> body'));
        expect(c.tagName).toBe('DETAILS');
        expect(c.hasAttribute('open')).toBe(true);
        expect(canonicalOf(c)).toBe('tip');
        expect(titleText(c)).toBe('Open');
    });

    it('fold char is not part of the default title', async () => {
        const [a, b] = callouts(await render('> [!faq]-\n> x\n\n> [!faq]+\n> y'));
        expect(titleText(a)).toBe('Faq');
        expect(titleText(b)).toBe('Faq');
    });

    it('no fold char: plain div, no details/summary anywhere', async () => {
        const d = await render('> [!note] t\n> b');
        expect(d.querySelector('details')).toBeNull();
        expect(d.querySelector('summary')).toBeNull();
    });

    it('header-only foldable: details + summary, no content', async () => {
        const [c] = callouts(await render('> [!note]- Only'));
        expect(c.tagName).toBe('DETAILS');
        expect(c.querySelector('.callout-content')).toBeNull();
        expect(c.hasAttribute('open')).toBe(false);
    });

    it('expandFolds: true opens every details, including `-` and nested ones; fold-less callouts stay div', async () => {
        const md = '> [!note]- a\n> b\n>\n> > [!tip]- inner\n> > c\n\n> [!warning]+ d\n> e\n\n> [!info] plain\n> f';
        const d = await render(md, { expandFolds: true });
        const det = [...d.querySelectorAll('details.callout')];
        expect(det).toHaveLength(3);
        for (const x of det) expect(x.hasAttribute('open')).toBe(true);
        expect(callouts(d)).toHaveLength(4);
        expect(d.querySelectorAll('div.callout')).toHaveLength(1);
    });

    it.each([[undefined], [{}], [{ expandFolds: false }]])('default / %j keeps fold state', async (options) => {
        const d = await render('> [!note]- a\n> b\n\n> [!tip]+ c\n> d', options);
        const [closed, open] = [...d.querySelectorAll('details.callout')];
        expect(closed.hasAttribute('open')).toBe(false);
        expect(open.hasAttribute('open')).toBe(true);
    });

    it('expandFolds is only honoured when exactly true (truthy non-true keeps fold state)', async () => {
        const d = await render('> [!note]- a\n> b', { expandFolds: 'yes' });
        expect(d.querySelector('details').hasAttribute('open')).toBe(false);
    });

    it('expandFolds does not change a document without callouts', async () => {
        const md = '# T\n\n> quote\n\ntext';
        expect(await renderMarkdownHtml(md, { expandFolds: true })).toBe(await renderMarkdownHtml(md));
    });
});

describe('renderMarkdownHtml callouts: body content', () => {
    it('paragraphs, list and code block', async () => {
        const [c] = callouts(await render('> [!note] t\n> first para\n>\n> second para\n>\n> - a\n> - b\n>\n> ```js\n> let x = 1;\n> ```'));
        const body = content(c);
        expect(body.querySelectorAll('p')).toHaveLength(2);
        expect(body.querySelectorAll('ul > li')).toHaveLength(2);
        expect(body.querySelector('pre code').textContent).toContain('let x = 1;');
    });

    it('inline markdown in the body', async () => {
        const [c] = callouts(await render('> [!note]\n> some **bold** text'));
        expect(content(c).querySelector('strong').textContent).toBe('bold');
    });

    it('math in the body renders the math span', async () => {
        const [c] = callouts(await render('> [!note]\n> area $x^2$ ok'));
        expect(content(c).querySelector('span.math.math-inline svg')).not.toBeNull();
    });

    it('math in a title renders the math span too', async () => {
        const [c] = callouts(await render('> [!note] area $x^2$\n> b'));
        expect(c.querySelector('.callout-title-text span.math')).not.toBeNull();
    });

    it('footnote ref in the body is numbered, section stays at the end, ids set', async () => {
        const d = await render('> [!note]\n> see[^a]\n\ntail\n\n[^a]: the note');
        const a = d.querySelector('.callout-content a.footnote-ref');
        expect(a.textContent).toBe('1');
        expect(a.getAttribute('href')).toBe('#fn-1');
        expect(a.id).toBe('fnref-1');
        const last = [...d.children].filter((e) => e.nodeType === 1).pop();
        expect(last.matches('section.footnotes')).toBe(true);
        expect(d.querySelector('section.footnotes li').id).toBe('fn-1');
        expect(d.querySelector('.callout section.footnotes')).toBeNull();
    });

    it('nested callout renders a nested .callout inside the content', async () => {
        const d = await render('> [!note] outer\n> body\n>\n> > [!tip] inner\n> > inner body');
        const [outer, inner, ...rest] = callouts(d);
        expect(rest).toEqual([]);
        expect(canonicalOf(outer)).toBe('note');
        expect(canonicalOf(inner)).toBe('tip');
        expect(content(outer).contains(inner)).toBe(true);
        expect(titleText(inner)).toBe('inner');
        expect(content(inner).textContent.trim()).toBe('inner body');
        expect(d.querySelector('blockquote')).toBeNull();
    });

    it('plain nested quote inside a callout stays a blockquote', async () => {
        const d = await render('> [!note]\n> > plain nested');
        const [c, ...rest] = callouts(d);
        expect(rest).toEqual([]);
        expect(content(c).querySelector('blockquote')).not.toBeNull();
    });

    it('callout nested in a plain quote is still a callout', async () => {
        const d = await render('> intro\n>\n> > [!tip] inner\n> > b');
        expect(callouts(d).map(canonicalOf)).toEqual(['tip']);
    });

    it('callout inside a list item works', async () => {
        const d = await render('- item\n\n  > [!warning] careful\n  > body here\n- next');
        const [c] = callouts(d);
        expect(c.closest('li')).not.toBeNull();
        expect(canonicalOf(c)).toBe('warning');
        expect(titleText(c)).toBe('careful');
        expect(content(c).textContent.trim()).toBe('body here');
    });

    it('callout starting a list item (`- > [!note]`) works', async () => {
        const [c] = callouts(await render('- > [!note] t\n  > b'));
        expect(c.closest('li')).not.toBeNull();
        expect(titleText(c)).toBe('t');
    });
});

describe('renderMarkdownHtml callouts: not callouts', () => {
    it('[!note] on the second line is plain blockquote text', async () => {
        const d = await render('> first line\n> [!note] second');
        expect(callouts(d)).toEqual([]);
        expect(d.querySelector('blockquote').textContent).toContain('[!note]');
    });

    it('text before the marker on the first line', async () => {
        const d = await render('> text [!note] x');
        expect(callouts(d)).toEqual([]);
        expect(d.querySelector('blockquote')).not.toBeNull();
    });

    it('escaped \\[!note] is a plain quote showing "[!note]"', async () => {
        const d = await render('> \\[!note] x\n> body');
        expect(callouts(d)).toEqual([]);
        expect(d.querySelector('blockquote').textContent).toContain('[!note]');
    });

    it('inside a fenced code block stays code', async () => {
        const d = await render('```\n> [!note] x\n> body\n```');
        expect(callouts(d)).toEqual([]);
        expect(d.querySelector('pre code').textContent).toContain('> [!note] x');
        expect(d.querySelector('svg')).toBeNull();
    });

    it('inside inline code stays code', async () => {
        const d = await render('use `> [!note]` here');
        expect(callouts(d)).toEqual([]);
    });

    it('[!note] outside any blockquote is text', async () => {
        const d = await render('[!note] not quoted');
        expect(callouts(d)).toEqual([]);
        expect(d.querySelector('p').textContent).toBe('[!note] not quoted');
    });

    it('"[! note]" with a space is not a callout', async () => {
        expect(callouts(await render('> [! note] x'))).toEqual([]);
    });
});

describe('renderMarkdownHtml callouts: security', () => {
    const hostile = [
        '<img src=x onerror=alert(1)>',
        '[x](javascript:alert(1))',
        '<script>alert(1)</script>',
        '<a href="javascript:alert(1)" onclick="alert(2)">y</a>',
        '<div onclick="alert(1)" style="x:y" id="i">z</div>',
        '<details open ontoggle="alert(1)"><summary>s</summary></details>',
    ];
    const check = (d) => {
        for (const el of d.querySelectorAll('*')) {
            for (const a of el.attributes) expect(a.name.startsWith('on')).toBe(false);
            expect(el.hasAttribute('style')).toBe(false);
        }
        for (const a of d.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
        expect(d.querySelector('script')).toBeNull();
        expect(d.querySelector('img[onerror]')).toBeNull();
    };

    it.each(hostile)('hostile title %s is neutralised', async (payload) => {
        check(await render(`> [!note] ${payload}\n> body`));
        check(await render(`> [!note]- ${payload}\n> body`));
        check(await render(`> [!note] ${payload}`));
    });

    it.each(hostile)('hostile body %s is neutralised', async (payload) => {
        check(await render(`> [!note]\n> ${payload}`));
    });

    it('the raw-HTML <img onerror> title leaves no onerror text in the serialized output', async () => {
        const html = await renderMarkdownHtml('> [!note] <img src=x onerror=alert(1)>\n> b');
        expect(html).not.toMatch(/onerror\s*=/i);
        expect(html).not.toMatch(/href="javascript:/i);
    });

    it('hostile type text never reaches a class or attribute', async () => {
        const html = await renderMarkdownHtml('> [!x"onmouseover="alert(1)]\n> b');
        expect(dom(html).querySelector('[onmouseover]')).toBeNull();
        const d = await render('> [!a-b_c]\n> b');
        expect([...callouts(d)[0].classList].sort()).toEqual(['callout', 'callout-note']);
    });

    it('user spans with marker-like classes never get an icon, in title, body or top level', async () => {
        const md = [
            '> [!note] <span class="nf00112233445566778899aabb-icon-note">t</span>',
            '> <span class="nf-icon-note">b</span> <span class="nficon">c</span>',
            '',
            '<span class="nf00112233445566778899aabb-icon-note nf-icon">top</span>',
            '',
            '<span class="NFMATH0I1E nf0-fn-1">x</span>',
        ].join('\n');
        const d = await render(md);
        for (const s of d.querySelectorAll('span:not(.callout-title-text)')) expect(s.querySelector('svg')).toBeNull();
        expect(d.querySelectorAll('svg')).toHaveLength(1);
        expect(titleEl(callouts(d)[0]).firstElementChild.tagName.toLowerCase()).toBe('svg');
        // the user's own spans are not turned into ids either
        for (const el of d.querySelectorAll('*')) expect(el.hasAttribute('id')).toBe(false);
    });

    it('a user span with marker-like class in a doc with no callout gets no svg', async () => {
        const d = await render('<span class="nf00112233445566778899aabb-icon-note">x</span>');
        expect(d.querySelector('svg')).toBeNull();
    });

    it('raw <svg> in the document is stripped (icons only come from the fixed table)', async () => {
        const d = await render('> [!note]\n> <svg onload="alert(1)"><path d="M0 0"/></svg>');
        const svgs = d.querySelectorAll('svg');
        expect(svgs).toHaveLength(1); // only the real icon
        expect(titleEl(callouts(d)[0]).contains(svgs[0])).toBe(true);
    });

    it('output contains no id attribute coming from user HTML inside a callout', async () => {
        const d = await render('> [!note] t\n> <p id="x">a</p>');
        expect(d.querySelector('#x')).toBeNull();
    });
});

// The editor treats as callouts: every Blockquote node whose first line (after its own `>` and one space)
// scans as a callout. Export must produce the same callouts, same canonical, in document order.
describe('renderMarkdownHtml callouts: editor/export parity', () => {
    const editorCallouts = (doc) => {
        const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] })] });
        const tree = ensureSyntaxTree(state, state.doc.length, 5000);
        const out = [];
        tree.iterate({
            enter(n) {
                if (n.name !== 'Blockquote') return;
                const line = state.doc.lineAt(n.from);
                const text = line.text.slice(n.from - line.from).replace(/^>[ \t]?/, '');
                const scan = scanCallout(text);
                if (scan) out.push(scan.canonical);
            },
        });
        return out;
    };

    const docs = {
        'mixed types, folds, aliases, unknown': '> [!NOTE] a\n> b\n\n> [!tldr]- c\n> d\n\n> [!zzz]+ e\n> f\n\n> [!hint]\n> g',
        'nested callouts and plain nested quote': '> [!note] o\n> body\n>\n> > [!tip] i\n> > ib\n>\n> > plain\n\n> [!warning]\n> > [!bug] deep',
        'callouts in list items': '- a\n\n  > [!info] x\n  > y\n- > [!danger] z\n  > w\n\n1. one\n\n   > [!quote] q',
        'look-alikes that are not callouts': '> first\n> [!note] second\n\n> text [!note]\n\n> \\[!note] esc\n\n```\n> [!note] code\n```\n\n[!note] bare\n\n> [! note] space',
        'two callouts plus plain quote': '> [!example] a\n\n> plain\n\n> [!success] b\n> c',
        'header-only, hebrew, upper, long type': `> [!faq]\n\n> [!note] כותרת\n> גוף\n\n> [!CAUTION]-\n\n> [!${'a'.repeat(51)}] too long\n\n> [!${'b'.repeat(50)}] ok`,
    };

    it.each(Object.entries(docs))('%s', async (_name, doc) => {
        const expected = editorCallouts(doc);
        const d = await render(doc);
        expect(callouts(d).map(canonicalOf)).toEqual(expected);
    });

    it('the parity docs actually contain callouts (guard against a vacuous pass)', () => {
        const total = Object.values(docs).reduce((n, doc) => n + editorCallouts(doc).length, 0);
        expect(total).toBeGreaterThanOrEqual(12);
    });
});

describe('exportToHtml: callout stylesheet', () => {
    it('the exported document stylesheet has .callout rules', async () => {
        await exportToHtml('Doc', '> [!note] t\n> b');
        const html = exportFile.mock.calls[0][0];
        expect(html).toMatch(/\.callout[\s\S]*?\{/);
        expect(html).toContain('class="callout callout-note"');
    });
});
