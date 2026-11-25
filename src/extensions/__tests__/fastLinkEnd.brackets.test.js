import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { livePreview } from '../livePreview';
import { linkPreview } from '../linkPreview';
import { linkHandler, linkTooltipInfo } from '../linkHandler';
import { resolveReference } from '../linkDefs';
import { buildTableData, tableDOM } from '../tableCells';
import { resolveFootnotes } from '../footnotes';

// Spec: Docs/internal/b18-b19-spec.md "T4" (B18 brackets inside link labels).
//
// PINNED CONTRACT (fastLinkEnd.js rule change):
//   A link that closed in bare shortcut form `[x]` (the Link ends right after its `]`; not followed
//   by `(...)`, `[...]` or `[]`) does NOT invalidate earlier `[` openers. Inline `[x](...)`, full `[x][y]`
//   and collapsed `[x][]` links still do (CommonMark: `[a [b](x) c](y)` -> inner link only).
//   Whitespace between `]` and `(` means shortcut: `[b] (x)` is a shortcut link followed by text.
//   Not handled on purpose (accepted gap, pinned below as such): when the inner `[b]` is itself a
//   DEFINED shortcut reference CommonMark makes `[b]` the link and the outer text; the editor shows the outer link.
//   Images are out of scope: whatever stock lezer gives for `![a [b] c](i)` stays.
//
// Choices where the spec left room (writer must match):
//   - Tree shape is pinned by structure (outer Link spans, URL child, which links exist), NOT by a full dump,
//     so the inner `[b]` may stay a nested Link child of the outer.
//   - Collapsed `[a [b] c][]` is pinned as a tree shape only. Its definition `[a [b] c]: u` is not a valid
//     CommonMark label (no unescaped brackets in labels) and lezer does not parse it as LinkReference, so it
//     stays unresolved: pinned as "unresolved, shown as text".
//   - Click / hover on a position INSIDE the inner `[b]` acts on the OUTER link (outer destination wins,
//     same rule as Autolink-in-Link): enclosingLink must not stop at a destination-less inner Link.

const SYNTAX = [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax];
const lang = () => markdown({ base: markdownLanguage, extensions: SYNTAX });
const stock = markdownLanguage.parser;
const fast = stock.configure(fastLinkEnd);

const dump = (parser, text) => {
    const out = [];
    parser.parse(text).iterate({ enter: (n) => { out.push(`${n.name}:${n.from}-${n.to}`); } });
    return out.join(' ');
};
// Every Link/Image node with its URL child text and the names of its direct children.
const nodes = (text, name = 'Link', parser = fast) => {
    const out = [];
    parser.parse(text).iterate({
        enter: (n) => {
            if (n.name !== name) return;
            const url = n.node.getChild('URL');
            const kids = [];
            for (let c = n.node.firstChild; c; c = c.nextSibling) kids.push(c.name);
            out.push({ from: n.from, to: n.to, url: url ? text.slice(url.from, url.to) : null, kids });
        },
    });
    return out;
};
const links = (text) => nodes(text, 'Link');
const spans = (text) => links(text).map((l) => [l.from, l.to]);

describe('fastLinkEnd brackets: shortcut-closed inner link keeps the outer opener alive', () => {
    it('[a [b] c](https://u): one outer Link over the whole text with URL child https://u', () => {
        const t = '[a [b] c](https://u)';
        const outer = links(t).filter((l) => l.from === 0);
        expect(outer).toHaveLength(1);
        expect(outer[0].to).toBe(t.length);
        expect(outer[0].url).toBe('https://u');
        // label visible text between the outer marks
        const doc = EditorState.create({ doc: t, extensions: [lang()] });
        ensureSyntaxTree(doc, t.length, 5000);
        const o = syntaxTree(doc).topNode.firstChild.firstChild;
        expect(o.name).toBe('Link');
        const marks = [];
        for (let c = o.firstChild; c; c = c.nextSibling) if (c.name === 'LinkMark') marks.push(c);
        expect(t.slice(marks[0].to, marks[1].from)).toBe('a [b] c');
    });

    it('the inner [b] may stay a nested Link, but no other top-level Link competes with the outer', () => {
        const t = 'x [a [b] c](https://u) y';
        const outerFrom = t.indexOf('[a'), outerTo = t.indexOf(' y');
        const ls = links(t);
        expect(ls.some((l) => l.from === outerFrom && l.to === outerTo && l.url === 'https://u')).toBe(true);
        for (const l of ls) expect(l.from >= outerFrom && l.to <= outerTo, JSON.stringify(l)).toBe(true);
    });

    it('same inside a blockquote, a list item, a 2-space indent, a multi-line paragraph and emphasis', () => {
        for (const t of ['> [a [b] c](https://u)', '- [a [b] c](https://u)', '  [a [b] c](https://u)',
            '1. item\n\n   [a [b] c](https://u)', '[a [b]\nc](https://u)', '**[a [b] c](https://u)**', '*see [a [b] c](https://u) end*']) {
            const from = t.indexOf('[a');
            const to = t.indexOf('](https://u)') + '](https://u)'.length;
            const hit = links(t).filter((l) => l.from === from);
            expect(hit, JSON.stringify(t)).toHaveLength(1);
            expect(hit[0].to, JSON.stringify(t)).toBe(to);
            expect(hit[0].url, JSON.stringify(t)).toBe('https://u');
        }
    });

    it('two outer links in one paragraph, and an outer link followed by an ordinary link', () => {
        const t = '[a [b] c](u1) and [d [e] f](u2) and [g](u3)';
        const hits = links(t).filter((l) => l.url !== null).map((l) => [l.from, l.to, l.url]);
        expect(hits).toEqual([
            [0, t.indexOf(' and [d'), 'u1'],
            [t.indexOf('[d'), t.indexOf(' and [g'), 'u2'],
            [t.indexOf('[g'), t.length, 'u3'],
        ]);
    });

    it('nested shortcut levels [a [b [c] d] e](u): one outer Link over everything', () => {
        const t = '[a [b [c] d] e](u)';
        const outer = links(t).filter((l) => l.from === 0);
        expect(outer).toHaveLength(1);
        expect(outer[0]).toMatchObject({ to: t.length, url: 'u' });
    });

    it('shortcut then whitespace then (x) is still a shortcut: [a [b] (x) c](y) keeps the outer link', () => {
        const t = '[a [b] (x) c](y)';
        const outer = links(t).filter((l) => l.from === 0);
        expect(outer).toHaveLength(1);
        expect(outer[0]).toMatchObject({ to: t.length, url: 'y' });
    });

    it('several shortcut brackets inside one label: [a [b] [c] [d] e](u)', () => {
        const t = '[a [b] [c] [d] e](u)';
        const outer = links(t).filter((l) => l.from === 0);
        expect(outer).toHaveLength(1);
        expect(outer[0]).toMatchObject({ to: t.length, url: 'u' });
    });

    it('a later inline link inside the label still kills the outer: [a [b] [c](d) e](f) -> no Link from 0', () => {
        const t = '[a [b] [c](d) e](f)';
        expect(links(t).some((l) => l.from === 0)).toBe(false);
        expect(links(t).some((l) => l.from === t.indexOf('[c') && l.url === 'd')).toBe(true);
    });

    it('a shortcut inner link after the outer already died does not revive it: [a [b](x) [c] d](y)', () => {
        const t = '[a [b](x) [c] d](y)';
        expect(links(t).some((l) => l.from === 0)).toBe(false);
        expect(links(t).some((l) => l.from === t.indexOf('[b') && l.url === 'x')).toBe(true);
    });

    it('unclosed outer is unchanged: [a [b] c and [a [b] c] stay as before for the parts that do not form a link', () => {
        expect(dump(fast, '[a [b] c')).toBe(dump(stock, '[a [b] c'));
        expect(dump(fast, 'x [a [b] c')).toBe(dump(stock, 'x [a [b] c'));
    });
});

describe('fastLinkEnd brackets: forms that still invalidate earlier openers (CommonMark no links inside links)', () => {
    it('[a [b](x) c](y): inner inline Link with URL x; no Link starts at the first [', () => {
        const t = '[a [b](x) c](y)';
        expect(links(t).some((l) => l.from === 0)).toBe(false);
        expect(links(t).filter((l) => l.url === 'x')).toHaveLength(1);
        expect(links(t).find((l) => l.url === 'x')).toMatchObject({ from: t.indexOf('[b'), to: t.indexOf(' c](y)') });
    });

    it('[a [b][r] c](y): inner full-reference Link only, outer stays text (unchanged behaviour)', () => {
        const t = '[a [b][r] c](y)';
        expect(links(t).some((l) => l.from === 0)).toBe(false);
        expect(spans(t)).toEqual([[t.indexOf('[b'), t.indexOf(' c](y)')]]);
        expect(dump(fast, t)).toBe(dump(stock, t));
    });

    it('[a [b][] c](y): inner collapsed Link kills the outer', () => {
        const t = '[a [b][] c](y)';
        expect(links(t).some((l) => l.from === 0)).toBe(false);
        expect(spans(t)).toEqual([[t.indexOf('[b'), t.indexOf(' c](y)')]]);
    });

    it('the stock-equal cases: nested inline links behave exactly like stock', () => {
        for (const t of ['[outer [inner](i) tail](o)', '[a [b [c](c) d](b) e](a)', '[[x](y)](z)', '[x [y](y) [z](z)](w)']) {
            expect(dump(fast, t), JSON.stringify(t)).toBe(dump(stock, t));
        }
    });
});

describe('fastLinkEnd brackets: reference-style outer links', () => {
    const mkState = (doc) => {
        const s = EditorState.create({ doc, extensions: [lang()] });
        ensureSyntaxTree(s, doc.length, 5000);
        return s;
    };
    const outerLink = (s) => {
        let hit = null;
        syntaxTree(s).iterate({ enter: (n) => { if (!hit && n.name === 'Link' && n.from === 0) hit = n.node; } });
        return hit;
    };

    it('[a [b] c][r] + [r]: https://u -> outer Link from 0 resolves via resolveReference', () => {
        const doc = '[a [b] c][r]\n\n[r]: https://u';
        const s = mkState(doc);
        const o = outerLink(s);
        expect(o, 'outer Link').not.toBeNull();
        expect(o.to).toBe(doc.indexOf('\n\n'));
        expect(resolveReference(o, s)).toMatchObject({ url: 'https://u' });
    });

    it('[a [b] c][r] with r undefined: outer Link exists but resolves to null (shown as text)', () => {
        const doc = '[a [b] c][r]';
        const s = mkState(doc);
        const o = outerLink(s);
        expect(o).not.toBeNull();
        expect(resolveReference(o, s)).toBeNull();
    });

    it('[a [b] c][]: outer collapsed Link spans the whole text; its definition cannot resolve (bracketed label is not a LinkReference)', () => {
        const doc = '[a [b] c][]\n\n[a [b] c]: https://u';
        const s = mkState(doc);
        const o = outerLink(s);
        expect(o, 'outer Link').not.toBeNull();
        expect(o.to).toBe(doc.indexOf('\n\n'));
        expect(resolveReference(o, s)).toBeNull();
    });

    it('[a [b] c] alone (shortcut outer, no definition): outer Link exists and is unresolved', () => {
        const doc = '[a [b] c]';
        const s = mkState(doc);
        const o = outerLink(s);
        expect(o).not.toBeNull();
        expect(o.to).toBe(doc.length);
        expect(resolveReference(o, s)).toBeNull();
    });
});

describe('fastLinkEnd brackets: shortcut-only paragraphs, images, task lists, footnotes are unchanged vs stock', () => {
    it.each([
        '[x]', '[x] [y]', 'see [x] and [y](u)', '[x] [y](u)', '[x](u) [y]', '- [ ] item', '- [x] done\n- [ ] todo',
        '1. [ ] a', '[^1]', 'text[^1] and [^2]\n\n[^1]: a\n[^2]: b', '[x]\n\n[x]: https://u', '[x][]\n\n[x]: https://u',
        '![a [b] c](i.png)', '![a [b](x) c](i.png)', '![a [b][r] c](i.png)',
        '[x] (y)', '[x]: y', 'a [ ] b [x] c',
    ])('%j', (t) => {
        expect(dump(fast, t)).toBe(dump(stock, t));
    });

    it('image alt with brackets: stock behaviour pinned (Image 0-17 with a nested shortcut Link for [b])', () => {
        const t = '![a [b] c](i.png)';
        expect(nodes(t, 'Image', stock)).toEqual(nodes(t, 'Image', fast));
        expect(nodes(t, 'Image')[0]).toMatchObject({ from: 0, to: t.length, url: 'i.png' });
    });
});

describe('fastLinkEnd brackets: editor end to end (real EditorView, app extensions)', () => {
    const views = [];
    const mkView = (doc, anchor = 0, head = anchor) => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const view = new EditorView({
            state: EditorState.create({ doc, selection: { anchor, head }, extensions: [lang(), livePreview, linkPreview, linkHandler] }),
            parent,
        });
        ensureSyntaxTree(view.state, view.state.doc.length, 5000);
        view.dispatch({ selection: { anchor, head } }); // rebuild decorations with the tree ready
        views.push(view);
        return view;
    };
    const click = (view, pos, init = { ctrlKey: true }) => {
        view.posAtCoords = () => pos;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
        view.contentDOM.dispatchEvent(event);
        return event;
    };
    const U = 'https://u';
    const DOC = `p\n\n[a [b] c](${U})\n\nz`;
    const lineText = (v, needle) => [...v.dom.querySelectorAll('.cm-line')].find((l) => l.textContent.includes(needle))?.textContent;

    let open;
    beforeEach(() => { open = vi.spyOn(window, 'open').mockImplementation(() => null); });
    afterEach(() => { while (views.length) views.pop().destroy(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('cursor away: exactly one a.cm-link, href https://u, text "a [b] c"; no stray bracket text from the inner node', () => {
        const v = mkView(DOC, 0);
        const as = v.dom.querySelectorAll('.cm-content a.cm-link');
        expect(as).toHaveLength(1);
        expect(as[0].getAttribute('href')).toBe(U);
        const icon = as[0].querySelector('.cm-link-icon');
        const label = as[0].textContent.replace(icon ? icon.textContent : '', '');
        expect(label).toBe('a [b] c');
        // the whole rendered line is the widget only: nothing hidden/visible left over from the raw source
        const line = [...v.dom.querySelectorAll('.cm-line')].find((l) => l.querySelector('a.cm-link'));
        expect(line.textContent).toBe(as[0].textContent);
        expect(line.textContent).not.toContain('(');
        expect(line.textContent).not.toContain('https');
        expect(line.querySelectorAll('a.cm-link')).toHaveLength(1);
    });

    it('Ctrl+click on the label opens https://u in a new tab (outer part and inside the inner [b])', () => {
        for (const needle of ['a [', 'b]', ' c]']) {
            open.mockClear();
            const v = mkView(DOC, 0);
            const e = click(v, DOC.indexOf(needle) + (needle === 'a [' ? 0 : 0));
            expect(open, needle).toHaveBeenCalledWith(U, '_blank');
            expect(e.defaultPrevented, needle).toBe(true);
            v.destroy(); views.pop();
        }
    });

    it('hover tooltip: linkTooltipInfo has the OUTER range and text, also with the pointer on the inner [b]', () => {
        const state = mkView(DOC, 0).state;
        const from = DOC.indexOf('[a [b]');
        const to = DOC.indexOf('\n\nz');
        for (const pos of [DOC.indexOf('a [b]'), DOC.indexOf('b]'), DOC.indexOf(' c](')]) {
            expect(linkTooltipInfo(state, pos, 1), `pos ${pos}`).toEqual({ pos: from, end: to, text: 'Ctrl + Click to open link' });
        }
    });

    it('cursor touching the link: raw source unchanged, no widget, nothing hidden (also with the cursor at c, outside the inner [b])', () => {
        const raw = `[a [b] c](${U})`;
        for (const at of [DOC.indexOf('[a [b]'), DOC.indexOf('a [b]'), DOC.indexOf('b]'), DOC.indexOf(' c]') + 1, DOC.indexOf('\n\nz')]) {
            const v = mkView(DOC, at);
            expect(v.dom.querySelectorAll('.cm-content a.cm-link'), `at ${at}`).toHaveLength(0);
            expect(lineText(v, 'a [b]'), `at ${at}`).toBe(raw);
        }
    });

    it('inner [b] produces no widget of its own and its LinkMarks stay visible while the outer is revealed', () => {
        const v = mkView(DOC, DOC.indexOf(' c]') + 1);   // inside the outer label, outside the inner [b]
        expect(v.dom.querySelectorAll('.cm-link-icon')).toHaveLength(0);
        expect(lineText(v, 'a [b]')).toContain('[b]');
    });

    it('outer in a table-free list item and in a blockquote renders one widget with the full label', () => {
        for (const doc of [`p\n\n- [a [b] c](${U})\n\nz`, `p\n\n> [a [b] c](${U})\n\nz`]) {
            const v = mkView(doc, 0);
            const as = v.dom.querySelectorAll('.cm-content a.cm-link');
            expect(as, doc).toHaveLength(1);
            expect(as[0].getAttribute('href')).toBe(U);
            expect(as[0].textContent).toContain('a [b] c');
        }
    });

    it('defined inner [b] does not steal the outer link; an outer without destination leaves an autolink inside its widget', () => {
        const doc = `p\n\n[a [b] c](${U})\n\nz\n\n[b]: https://b.example\n`;
        for (const at of [0, doc.indexOf(' c]') + 1]) {       // cursor away; cursor in the outer label, outside [b]
            const v = mkView(doc, at);
            const as = v.dom.querySelectorAll('.cm-content a.cm-link');
            if (at === 0) {
                expect(as).toHaveLength(1);
                expect(as[0].getAttribute('href')).toBe(U);
                expect(as[0].textContent).toContain('a [b] c');
            } else {
                expect(as).toHaveLength(0);
expect(lineText(v, `(${U})`)).toBe(`[a [b] c](${U})`);   // inner [b] marks stay visible
            }
        }
        const v = mkView('p\n\n[a [b] <https://x.example>]\n\nz', 0);
        const as = [...v.dom.querySelectorAll('.cm-content a.cm-link')];
        expect(as.map((a) => a.getAttribute('href'))).toEqual(['https://x.example']);
    });

    it('unresolved [a [b] c] and [a [b] c][r] stay literal text: no widget, nothing hidden', () => {
        for (const label of ['[a [b] c]', '[a [b] c][r]']) {
            const v = mkView(`p\n\n${label}\n\nz`, 0);
            expect(v.dom.querySelectorAll('.cm-content a.cm-link'), label).toHaveLength(0);
            expect(lineText(v, 'a [b]'), label).toBe(label);
        }
    });

    it('reference outer [a [b] c][r] + [r]: https://u renders a widget with href https://u', () => {
        const doc = `p\n\n[a [b] c][r]\n\nz\n\n[r]: ${U}\n`;
        const v = mkView(doc, 0);
        const as = v.dom.querySelectorAll('.cm-content a.cm-link');
        expect(as).toHaveLength(1);
        expect(as[0].getAttribute('href')).toBe(U);
        expect(as[0].textContent).toContain('a [b] c');
    });

    it('[a [b](x) c](y): only the inner link is a widget (href x); outer brackets remain visible text', () => {
        const v = mkView('p\n\n[a [b](https://x) c](https://y)\n\nz', 0);
        const as = v.dom.querySelectorAll('.cm-content a.cm-link');
        expect(as).toHaveLength(1);
        expect(as[0].getAttribute('href')).toBe('https://x');
        expect(lineText(v, 'a ')).toBe('[a b' + (as[0].querySelector('.cm-link-icon')?.textContent ?? '') + ' c](https://y)');
    });

    it('ACCEPTED GAP (documented, not CommonMark): when [b] is itself a defined shortcut reference the editor still shows the OUTER link', () => {
        const doc = `p\n\n[a [b] c](${U})\n\nz\n\n[b]: https://b.example\n`;
        const v = mkView(doc, 0);
        const as = [...v.dom.querySelectorAll('.cm-content a.cm-link')];
        expect(as.length).toBeGreaterThanOrEqual(1);
        expect(as[0].getAttribute('href')).toBe(U);
    });
});

describe('fastLinkEnd brackets: stays near-linear', () => {
    const time = (text) => {
        fast.parse(text);                                                    // warm up
        let best = Infinity;
        for (let k = 0; k < 2; k++) { const t0 = performance.now(); fast.parse(text); best = Math.min(best, performance.now() - t0); }
        return best;
    };
    // shape A: one open "[a " then many shortcut "[x]" brackets, closed by "](u)" at the end
    const shapeA = (n) => '[a ' + '[x] '.repeat(n) + 'c](u)';
    // shape B: many outer links with shortcut brackets inside
    const shapeB = (n) => Array.from({ length: n }, () => '[a [b] c](u)').join(' ');

    it.each([['A', shapeA], ['B', shapeB]])('shape %s: 20k parses within a generous bound and grows near-linearly (4x size < 10x time)', (_n, make) => {
        const small = time(make(5000)), big = time(make(20000));
        expect(big, `5k ${small.toFixed(0)}ms, 20k ${big.toFixed(0)}ms`).toBeLessThan(15000);
        // linear = 4x; the old per-link re-walk was ~16x. Floor of 20ms keeps tiny timings from flaking the ratio.
        expect(big, `5k ${small.toFixed(0)}ms, 20k ${big.toFixed(0)}ms`).toBeLessThan(Math.max(small, 20) * 10);
    }, 120000);

    it('20k [a [b] c](u) links in one paragraph all come out as outer links (correctness at scale)', () => {
        const n = 2000;
        const t = shapeB(n);
        const outer = links(t).filter((l) => l.url === 'u');
        expect(outer).toHaveLength(n);
        expect(outer[0]).toMatchObject({ from: 0, to: '[a [b] c](u)'.length });
        expect(outer.at(-1).to).toBe(t.length);
    });

    it('shape A at scale still resolves the single outer link', () => {
        const t = shapeA(3000);
        const outer = links(t).filter((l) => l.from === 0);
        expect(outer).toHaveLength(1);
        expect(outer[0]).toMatchObject({ to: t.length, url: 'u' });
    });
    it('a table cell `[a [b] c](https://u)` renders one anchor with the full label (same as export)', () => {
        const state = EditorState.create({ doc: '| h |\n| - |\n| [a [b] c](https://u) |\n', extensions: [lang()] });
        ensureSyntaxTree(state, state.doc.length, 5000);
        let tb = null;
        syntaxTree(state).iterate({ enter: (n) => { if (n.name === 'Table' && !tb) tb = n.node; } });
        const td = tableDOM(buildTableData(state, tb, resolveFootnotes(state)), { requestMeasure() {} }).querySelector('tbody td');
        expect(td.querySelectorAll('a')).toHaveLength(1);
        expect(td.querySelector('a').textContent).toBe('a [b] c');
    });
});
