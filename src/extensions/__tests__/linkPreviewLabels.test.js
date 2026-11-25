import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { mathPreview } from '../mathPreview';
import { footnoteSyntax } from '../footnoteSyntax';
import { footnotePreview } from '../footnotes';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { frontMatterPreview } from '../frontMatterPreview';
import { emojiSyntax } from '../emojiSyntax';
import { emojiPreview } from '../emojiPreview';
import { subSupPreview } from '../subSupPreview';
import { htmlInlinePreview } from '../htmlInlinePreview';
import { livePreview } from '../livePreview';
import { calloutPreview } from '../callouts';
import { mermaidPreview } from '../mermaidPreview';
import { imagePreview } from '../imagePreview';
import { linkPreview } from '../linkPreview';
import { linkHandler } from '../linkHandler';
import { textDirection } from '../textDirection';
import { emojiFor } from '../../utils/emojiTable';

// B14: link labels OUTSIDE tables render the same inline constructs as link labels inside table cells (B12, tableCells.js).
//
// Pinned choices:
//  - Harness = tableCells.test.js: the app's real extension list, cursor at 0 (paragraph "p", away from the link) unless
//    stated, assertions read the DOM under .cm-content.
//  - ORACLE: the same label in a body cell `| [label](u) |`. Both DOMs are reduced to a "label signature" of the <a>:
//    the .cm-link-icon is dropped, a class-less, attribute-less <span> (the LinkWidget text wrapper) is flattened,
//    elements become [tag, class, aria-label, children] and text becomes strings (adjacent strings merged). Equal
//    signatures = "same element kinds and text". Wrapper structure itself (span or not) is NOT pinned.
//  - Highlight: oracle gives span.cm-highlight, so `==h==` in an outside label must too (today it stays raw).
//  - Footnote refs in labels: `.cm-footnote-ref` with the resolveFootnotes number, as in a cell.
//  - Math: renderTex is mocked, as in tableCells.test.js; signature taken before the render resolves.
//  - Cursor on the link: raw source text shows, no widget (no a.cm-link), as today.
//  - Not asserted (jsdom): CSS, layout, real posAtCoords clicks. Click behaviour is pinned on LinkWidget.ignoreEvent.

const mocks = vi.hoisted(() => ({ renderTex: vi.fn(), isMathLoaded: vi.fn(() => false) }));
vi.mock('../../utils/math', () => ({
    renderTex: (...a) => mocks.renderTex(...a),
    isMathLoaded: () => mocks.isMathLoaded(),
}));

const SYNTAX = [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax];
const EXTENSIONS = [
    EditorView.lineWrapping,
    EditorView.perLineTextDirection.of(true),
    markdown({ base: markdownLanguage, extensions: SYNTAX }),
    livePreview, subSupPreview, htmlInlinePreview, emojiPreview, mathPreview, footnotePreview, calloutPreview, mermaidPreview,
    frontMatterPreview, imagePreview, linkPreview, linkHandler, textDirection,
];

const views = [];
const mkView = (doc, anchor = 0, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor, head }, extensions: EXTENSIONS }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};

const DEFS = '\n\n[^a]: A\n[^b]: B\n\n[r]: https://e.com\n';
const URL = 'https://u.test';
const outsideDoc = (label) => `p\n\n[${label}](${URL})\n\nz${DEFS}`;
const cellDoc = (label) => `p\n\n| h |\n| --- |\n| [${label}](${URL}) |\n\nz${DEFS}`;

const outsideLink = (v) => v.dom.querySelector('.cm-content a.cm-link');
const cellLink = (v) => v.dom.querySelector('.cm-table-widget tbody td a.cm-link');

// Label signature (see header).
const sig = (a) => {
    const out = [];
    const push = (x) => {
        if (typeof x === 'string' && typeof out.at(-1) === 'string') out[out.length - 1] += x;
        else out.push(x);
    };
    const walk = (node, into) => {
        for (const n of node.childNodes) {
            if (n.nodeType === 3) { into(n.textContent); continue; }
            if (n.nodeType !== 1 || n.classList.contains('cm-link-icon')) continue;
            if (n.tagName === 'SPAN' && n.attributes.length === 0) { walk(n, into); continue; }
            const kids = [];
            const add = (x) => {
                if (typeof x === 'string' && typeof kids.at(-1) === 'string') kids[kids.length - 1] += x;
                else kids.push(x);
            };
            walk(n, add);
            into([n.tagName.toLowerCase(), n.className, n.getAttribute('aria-label'), kids]);
        }
    };
    walk(a, push);
    return out;
};

beforeEach(() => {
    mocks.renderTex.mockReset();
    mocks.renderTex.mockImplementation(async (tex) => `<svg data-tex="${tex}" xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`);
});
afterEach(() => { while (views.length) views.pop().destroy(); vi.restoreAllMocks(); });

const parity = (label) => {
    const out = outsideLink(mkView(outsideDoc(label)));
    const cell = cellLink(mkView(cellDoc(label)));
    expect(cell, 'oracle: link in table cell').not.toBeNull();
    expect(out, 'link rendered outside a table').not.toBeNull();
    expect(sig(out)).toEqual(sig(cell));
    return out;
};

describe('link labels outside tables: constructs (cursor away)', () => {
    it('sub: [H~2~O](u) shows H, subscript 2, O; no ~', () => {
        const a = parity('H~2~O');
        expect(a.querySelector('.cm-subscript').textContent).toBe('2');
        expect(a.textContent).not.toContain('~');
        expect(a.getAttribute('href')).toBe(URL);
    });

    it('sup: [x^2^](u) shows superscript 2; no ^', () => {
        const a = parity('x^2^');
        expect(a.querySelector('.cm-superscript').textContent).toBe('2');
        expect(a.textContent).not.toContain('^');
    });

    it('emoji: [:smile:](u) shows span.cm-emoji[role=img][aria-label=smile]', () => {
        const a = parity(':smile:');
        const e = a.querySelector('span.cm-emoji');
        expect(e.getAttribute('role')).toBe('img');
        expect(e.getAttribute('aria-label')).toBe('smile');
        expect(e.textContent).toBe(emojiFor('smile'));
        expect(a.textContent).not.toContain(':smile:');
    });

    it('unknown emoji name stays literal in the label', () => {
        const a = parity(':nope: x');
        expect(a.querySelector('.cm-emoji')).toBeNull();
        expect(a.textContent).toContain(':nope: x');
    });

    it('math: [$x^2$](u) shows a .cm-math with raw TeX (no dollars), and renderTex is called inline', () => {
        const a = parity('a $x^2$ b');
        const m = a.querySelector('.cm-math');
        expect(m).not.toBeNull();
        expect(m.textContent).toBe('x^2');
        expect(a.textContent).not.toContain('$');
        expect(mocks.renderTex).toHaveBeenCalledWith('x^2', expect.objectContaining({ display: false }));
    });

    it('a lone dollar in a label stays literal', () => {
        const a = parity('cost $5');
        expect(a.querySelector('.cm-math')).toBeNull();
        expect(a.textContent).toContain('cost $5');
    });

    it('footnote ref: [see[^a]](u) shows .cm-footnote-ref numbered 1; no [^a]', () => {
        const a = parity('see[^a]');
        const f = a.querySelector('.cm-footnote-ref');
        expect(f).not.toBeNull();
        expect(f.textContent).toBe('1');
        expect(a.textContent).not.toContain('[^');
    });

    it('highlight: [==h==](u) shows h inside .cm-highlight; no ==', () => {
        const a = parity('a ==h== b');
        expect(a.querySelector('.cm-highlight').textContent).toBe('h');
        expect(a.textContent).not.toContain('==');
    });

    it.each([
        ['**b**', 'strong'],
        ['*i*', 'em'],
        ['~~s~~', 'del'],
        ['`c`', 'code'],
    ])('existing: [%s](u) still gives <%s> (parity with the cell)', (label, tag) => {
        const a = parity(label);
        expect(a.querySelector(tag)).not.toBeNull();
        expect(a.querySelector(tag).textContent).toBe(label.replace(/[*~`]/g, ''));
    });

    it('inline code content stays literal: [`H~2~O :smile: $x$`](u)', () => {
        const a = parity('`H~2~O :smile: $x$`');
        expect(a.querySelector('code').textContent).toBe('H~2~O :smile: $x$');
        expect(a.querySelector('.cm-subscript, .cm-emoji, .cm-math')).toBeNull();
    });

    it('mixed label: bold + sub + sup + emoji + math + footnote + highlight in one label', () => {
        const a = parity('**b** H~2~O x^2^ :tada: $y$ n[^b] ==h== `c`');
        for (const sel of ['strong', '.cm-subscript', '.cm-superscript', '.cm-emoji', '.cm-math', '.cm-footnote-ref', '.cm-highlight', 'code']) {
            expect(a.querySelector(sel), sel).not.toBeNull();
        }
        expect(a.querySelector('.cm-footnote-ref').textContent).toBe('1');
    });

    it('nested: [**H~2~O**](u) puts the subscript inside the <strong>', () => {
        const a = parity('**H~2~O**');
        expect(a.querySelector('strong .cm-subscript')).not.toBeNull();
    });

    it('an outer bold around the link still styles the widget and the label renders constructs', () => {
        const v = mkView(`p\n\n**[H~2~O](${URL})**\n\nz`);
        const a = outsideLink(v);
        expect(a.querySelector('.cm-subscript').textContent).toBe('2');
        expect(a.style.fontWeight).toBe('bold');
    });

    it('titled link: [H~2~O](u "t") keeps href, renders sub', () => {
        const v = mkView(`p\n\n[H~2~O](${URL} "t")\n\nz`);
        const a = outsideLink(v);
        expect(a.getAttribute('href')).toBe(URL);
        expect(a.querySelector('.cm-subscript').textContent).toBe('2');
    });

    it('inside a blockquote and a list item', () => {
        for (const doc of [`p\n\n> [H~2~O :smile:](${URL})\n\nz`, `p\n\n- [H~2~O :smile:](${URL})\n\nz`, `p\n\n   [H~2~O :smile:](${URL})\n\nz`]) {
            const a = outsideLink(mkView(doc));
            expect(a.querySelector('.cm-subscript').textContent, doc).toBe('2');
            expect(a.querySelector('.cm-emoji'), doc).not.toBeNull();
            expect(a.textContent, doc).not.toContain('>');
        }
    });

    it('reference link [H~2~O][r] renders sub and keeps the definition url', () => {
        const a = outsideLink(mkView('p\n\n[H~2~O :smile:][r]\n\nz' + DEFS));
        expect(a.getAttribute('href')).toBe('https://e.com');
        expect(a.querySelector('.cm-subscript').textContent).toBe('2');
        expect(a.querySelector('.cm-emoji')).not.toBeNull();
    });

    it('two links in one paragraph each render their own constructs', () => {
        const v = mkView(`p\n\n[H~2~O](${URL}) and [x^2^](${URL}/2)\n\nz`);
        const as = v.dom.querySelectorAll('.cm-content a.cm-link');
        expect(as.length).toBe(2);
        expect(as[0].querySelector('.cm-subscript')).not.toBeNull();
        expect(as[1].querySelector('.cm-superscript')).not.toBeNull();
        expect(as[1].getAttribute('href')).toBe(`${URL}/2`);
    });
});

describe('link labels outside tables: XSS stays closed', () => {
    it('html in a label is not turned into elements', () => {
        const a = outsideLink(mkView(`p\n\n[x <img src=x onerror=alert(1)> H~2~](${URL})\n\nz`));
        expect(a.querySelector('img')).toBeNull();
        expect(a.querySelector('.cm-subscript')).not.toBeNull();
    });

    it('nothing live inside a label: no element/attr from entities, autolinks or abbr titles; no javascript: href', () => {
        const label = '&lt;img src=x onerror=alert(1)&gt; <javascript:alert(1)> <abbr title="&quot; onmouseover=alert(2) x=&quot;">T</abbr>';
        const a = outsideLink(mkView(`p\n\n[${label}](${URL})\n\nz`));
        expect(a).not.toBeNull();
        expect(a.querySelector('img')).toBeNull();
        for (const e of [a, ...a.querySelectorAll('*')]) {
            for (const at of e.attributes) expect(at.name).not.toMatch(/^on/i);
            expect(e.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
        }
        expect(a.getAttribute('href')).toBe(URL);
    });
});

describe('link labels outside tables: cursor on the link shows raw source', () => {
    it.each([
        ['H~2~O'], ['x^2^'], [':smile:'], ['a $x$ b'], ['see[^a]'], ['**b** H~2~O'],
    ])('[%s](u) with the cursor inside: link is source, no widget', (label) => {
        const doc = outsideDoc(label);
        const v = mkView(doc, doc.indexOf(label) + 1);
        expect(v.dom.querySelector('.cm-content a.cm-link')).toBeNull();
        // Other extensions (sub/sup, math, footnotes) still decorate their own ranges with the cursor on the link,
        // as today; what is pinned is that the link itself is source: no widget, brackets and (url) visible.
        const text = v.dom.querySelector('.cm-content').textContent;
        expect(text).toContain('[');
        expect(text).toContain(`](${URL})`);
    });

    it('moving the cursor away from the link renders the label again, moving back shows source', () => {
        const doc = outsideDoc('H~2~O');
        const v = mkView(doc, 0);
        expect(outsideLink(v).querySelector('.cm-subscript')).not.toBeNull();
        v.dispatch({ selection: { anchor: doc.indexOf('H~2~O') + 2 } });
        expect(outsideLink(v)).toBeNull();
        v.dispatch({ selection: { anchor: 0 } });
        expect(outsideLink(v).querySelector('.cm-subscript').textContent).toBe('2');
    });
});

describe('link labels outside tables: regression guards', () => {
    it('plain label renders exactly as today: one <a>, text only, href/target/rel, icon', () => {
        const a = outsideLink(mkView(`p\n\n[Link Text](${URL})\n\nz`));
        expect(a.textContent).toBe('Link Text');
        expect(a.getAttribute('href')).toBe(URL);
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener noreferrer');
        expect(a.querySelector('.cm-link-icon svg')).not.toBeNull();
        expect(a.querySelectorAll('strong, em, del, code, sup, .cm-subscript, .cm-emoji, .cm-math').length).toBe(0);
        expect(sig(a)).toEqual(['Link Text']);
    });

    it('label text with html-special chars is escaped, not parsed: [a < b & c](u)', () => {
        const a = outsideLink(mkView(`p\n\n[a < b & c](${URL})\n\nz`));
        expect(a.textContent).toBe('a < b & c');
    });

    it('unsafe scheme: no href but the label still renders constructs', () => {
        const a = outsideLink(mkView('p\n\n[H~2~O](javascript:alert(1))\n\nz'));
        expect(a.getAttribute('href')).toBeNull();
        expect(a.querySelector('.cm-subscript')).not.toBeNull();
    });

    it('shortcut ref [r] with a definition renders a link with text r', () => {
        const a = outsideLink(mkView('p\n\n[r]\n\nz' + DEFS));
        expect(a.textContent).toBe('r');
        expect(a.getAttribute('href')).toBe('https://e.com');
    });

    it('unresolved ref [t][nope] stays source (no widget)', () => {
        const v = mkView('p\n\n[t][nope]\n\nz');
        expect(v.dom.querySelector('.cm-content a.cm-link')).toBeNull();
        expect(v.dom.querySelector('.cm-content').textContent).toContain('[t][nope]');
    });

    it('image-in-link is still not widgetised by linkPreview', () => {
        const v = mkView('p\n\n[![alt](img.png)](https://u.test)\n\nz');
        expect(v.dom.querySelector('.cm-content .cm-link-icon')).toBeNull();
    });

    it('autolink <https://e.com> is not resolved as a reference label (href is its own text)', () => {
        const v = mkView('p\n\n<https://e.com>\n\n[https://e.com]: https://other.test\n\nz');
        const a = v.dom.querySelector('.cm-content a.cm-link');
        expect(a).not.toBeNull();
        expect(a.href).toBe('https://e.com/');
    });

    it('click behaviour: ctrl/meta mousedown+click are left to the handler, plain ones go to CodeMirror (caret)', () => {
        const v = mkView(`p\n\n[H~2~O](${URL})\n\nz`);
        const w = (() => {
            const out = [];
            for (const c = v.plugin(linkPreview).decorations.iter(); c.value; c.next()) if (c.value.spec.widget) out.push(c.value.spec.widget);
            return out[0];
        })();
        expect(w).toBeDefined();
        for (const type of ['mousedown', 'click']) {
            expect(w.ignoreEvent(new MouseEvent(type, { ctrlKey: true }))).toBe(true);
            expect(w.ignoreEvent(new MouseEvent(type, { metaKey: true }))).toBe(true);
            expect(w.ignoreEvent(new MouseEvent(type))).toBe(false);
        }
    });

    it('widget eq: same label/url equal, different label not equal (a stale widget must not be reused)', () => {
        const get = (doc) => {
            const v = mkView(doc);
            for (const c = v.plugin(linkPreview).decorations.iter(); c.value; c.next()) if (c.value.spec.widget) return c.value.spec.widget;
        };
        const a = get(`p\n\n[H~2~O](${URL})\n\nz`);
        expect(a.eq(get(`p\n\n[H~2~O](${URL})\n\nz`))).toBe(true);
        expect(a.eq(get(`p\n\n[H~3~O](${URL})\n\nz`))).toBe(false);
        expect(a.eq(get(`p\n\n[H~2~O](${URL}/x)\n\nz`))).toBe(false);
    });
});
