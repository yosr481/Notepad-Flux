import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { linkPreview } from '../linkPreview';
import { livePreview } from '../livePreview';
import { linkHandler, linkTooltipInfo } from '../linkHandler';
import { autolinkHref } from '../linkDefs';

// Spec: Docs/internal/b18-b19-spec.md "T3".
//
// PINNED CONTRACT
//  autolinkHref(label) => string, exported from linkDefs.js, pure. label = text between `<` and `>`.
//    scheme (/^[a-z][a-z0-9+.-]*:/i) -> decodeAttrEntities(label) with every `\` -> `%5C`; else "mailto:" + label.
//    tableCells.js calls it (output unchanged). No mailto-label entity decoding (today's rule).
//  linkPreview: Autolink node outside table / outside a Link label, cursor not touching it (nor an enclosing
//    Emphasis/StrongEmphasis) -> Decoration.replace widget over `<`..`>`; a.cm-link; label as typed.
//    href only when isSafeExternalUrl(autolinkHref(label)); else no href attribute.
//  Ctrl/Cmd+click -> openLink(view, autolinkHref(label)); preventDefault on every Ctrl+click on an autolink.
//    Plain click: not prevented, nothing opens.
//  linkTooltipInfo on an autolink: {pos: node.from, end: node.to, text}; unsafe/touching -> null.
//  Autolink inside a Link label: no second widget; click resolves to the OUTER link's destination (unchanged).

const emptyRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => emptyRect;

const md = markdown({
    base: markdownLanguage,
    extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax],
});
const views = [];
const mkView = (doc, anchor = 0, extra = [livePreview, linkPreview, linkHandler], head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor, head }, extensions: [md, ...extra] }),
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
const stateOf = (doc, anchor = 0, head = anchor) => {
    const s = EditorState.create({ doc, selection: { anchor, head }, extensions: [md] });
    ensureSyntaxTree(s, s.doc.length, 5000);
    return s;
};
const anchors = (v) => [...v.dom.querySelectorAll('.cm-content a.cm-link')];
const lineText = (v, n) => v.dom.querySelectorAll('.cm-content .cm-line')[n].textContent;

beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { views.splice(0).forEach((v) => v.destroy()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('autolinkHref (pure)', () => {
    it.each([
        ['https://x.y/a', 'https://x.y/a'],
        ['http://x.y', 'http://x.y'],
        ['HTTPS://X.Y', 'HTTPS://X.Y'],
        ['mailto:a@b.co', 'mailto:a@b.co'],
        ['git+ssh://h/r', 'git+ssh://h/r'],
        ['javascript:alert(1)', 'javascript:alert(1)'],
        ['file:///x', 'file:///x'],
    ])('scheme label %j -> %j', (label, href) => {
        expect(autolinkHref(label)).toBe(href);
    });

    it.each([
        ['a@b.co', 'mailto:a@b.co'],
        ['first.last+tag@sub.example.com', 'mailto:first.last+tag@sub.example.com'],
    ])('no scheme %j -> mailto:', (label, href) => {
        expect(autolinkHref(label)).toBe(href);
    });

    it('entities decode when a scheme is present', () => {
        expect(autolinkHref('https://x.y/?a=1&amp;b=2')).toBe('https://x.y/?a=1&b=2');
    });

    it('every backslash becomes %5C (not "/" and not dropped)', () => {
        expect(autolinkHref('https://a.b/c\\d\\e')).toBe('https://a.b/c%5Cd%5Ce');
    });

    it('mailto label is NOT entity-decoded (today\'s rule, pinned)', () => {
        expect(autolinkHref('a&amp;b@c.d')).toBe('mailto:a&amp;b@c.d');
    });

    it('a scheme must start with a letter: "1a:b" has none -> mailto:', () => {
        expect(autolinkHref('1a:b')).toBe('mailto:1a:b');
    });
});

describe('tableCells uses the shared rule (output unchanged)', () => {
    const cell = (c) => {
        const v = mkView(`p\n\n| h |\n| --- |\n| ${c} |\n\nz\n`, 0);
        return v.dom.querySelector('.cm-table-widget tbody td');
    };
    it('backslash in a scheme autolink -> %5C in href', () => {
        expect(cell('<https://a.b/c\\d>').querySelector('a').getAttribute('href')).toBe('https://a.b/c%5Cd');
    });
    it('email autolink -> mailto: href, text is the label', () => {
        const a = cell('<x@y.z>').querySelector('a');
        expect(a.getAttribute('href')).toBe('mailto:x@y.z');
        expect(a.textContent).toBe('x@y.z');
    });
    it('entity in a scheme autolink decodes in href', () => {
        expect(cell('<https://a.b/?p&amp;q>').querySelector('a').getAttribute('href')).toBe('https://a.b/?p&q');
    });
    it('an autolink in a cell gets no second (editor-level) widget', () => {
        const v = mkView('p\n\n| h |\n| --- |\n| <https://a.b> |\n\nz\n', 0);
        expect(v.dom.querySelectorAll('.cm-table-widget a').length).toBe(1);
    });
});

describe('autolink widget (cursor away)', () => {
    const doc = 'intro\n\n<https://x.y/a>\n\nend\n';

    it('renders one a.cm-link with the label as typed and href', () => {
        const v = mkView(doc, 0);
        const as = anchors(v);
        expect(as.length).toBe(1);
        expect(as[0].getAttribute('href')).toBe('https://x.y/a');
        expect(as[0].textContent).toBe('https://x.y/a');
        expect(as[0].getAttribute('target')).toBe('_blank');
    });

    it('no double decoration: line shows the label once, no < or >', () => {
        const v = mkView(doc, 0);
        expect(lineText(v, 2)).toBe('https://x.y/a');
    });

    it('same for an autolink in the middle of a sentence', () => {
        const v = mkView('intro\n\nsee <https://x.y/a> now\n', 0);
        expect(lineText(v, 2)).toBe('see https://x.y/a now');
        expect(anchors(v).length).toBe(1);
    });

    it('email autolink gets a mailto: href and shows the bare address', () => {
        const v = mkView('intro\n\n<a@b.co>\n', 0);
        const a = anchors(v)[0];
        expect(a.getAttribute('href')).toBe('mailto:a@b.co');
        expect(lineText(v, 2)).toBe('a@b.co');
    });

    it('mailto: scheme autolink gets href', () => {
        const v = mkView('intro\n\n<mailto:a@b.co>\n', 0);
        expect(anchors(v)[0].getAttribute('href')).toBe('mailto:a@b.co');
    });

    it('backslash label: href carries %5C, text keeps the typed backslash', () => {
        const v = mkView('intro\n\n<https://a.b/c\\d>\n', 0);
        const a = anchors(v)[0];
        expect(a.getAttribute('href')).toBe('https://a.b/c%5Cd');
        expect(a.textContent).toBe('https://a.b/c\\d');
    });

    it.each([['javascript:alert(1)'], ['file:///x'], ['smb://h/s']])('unsafe <%s>: widget, no href, label shown', (label) => {
        const v = mkView(`intro\n\n<${label}>\n`, 0);
        const as = anchors(v);
        expect(as.length).toBe(1);
        expect(as[0].hasAttribute('href')).toBe(false);
        expect(lineText(v, 2)).toBe(label);
    });

    it('two autolinks on one line -> two widgets', () => {
        const v = mkView('intro\n\n<https://a.b> and <c@d.ef>\n', 0);
        expect(anchors(v).length).toBe(2);
        expect(lineText(v, 2)).toBe('https://a.b and c@d.ef');
    });

    it('inherits bold / italic like links', () => {
        const b = mkView('intro\n\n**<https://x.y>**\n', 0);
        expect(anchors(b)[0].style.fontWeight).toBe('bold');
        const i = mkView('intro\n\n*<https://x.y>*\n', 0);
        expect(anchors(i)[0].style.fontStyle).toBe('italic');
        const plain = mkView('intro\n\n<https://x.y>\n', 0);
        expect(anchors(plain)[0].style.fontWeight).toBe('');
        expect(anchors(plain)[0].style.fontStyle).toBe('');
    });

    it('works inside a list item and a blockquote', () => {
        const l = mkView('intro\n\n- <https://x.y>\n', 0);
        expect(anchors(l).length).toBe(1);
        const q = mkView('intro\n\n> <https://x.y>\n', 0);
        expect(anchors(q).length).toBe(1);
    });
});

describe('autolink widget (cursor reveal)', () => {
    const doc = 'intro\n\n<https://x.y/a>\n\nend\n';
    const at = doc.indexOf('<https');
    const end = at + '<https://x.y/a>'.length;

    it.each([
        ['at node start', at], ['inside', at + 5], ['at node end', end],
    ])('cursor %s -> raw source, no widget', (_n, pos) => {
        const v = mkView(doc, pos);
        expect(anchors(v).length).toBe(0);
        expect(lineText(v, 2)).toBe('<https://x.y/a>');
    });

    it('a selection range overlapping the node reveals it', () => {
        const v = mkView(doc, at - 2, undefined, at + 3);
        expect(anchors(v).length).toBe(0);
    });

    it('cursor touching an enclosing bold/italic reveals the autolink', () => {
        const d = 'intro\n\n**<https://x.y>**\n';
        expect(anchors(mkView(d, d.indexOf('**<'))).length).toBe(0);
        const e = 'intro\n\n*<https://x.y>*\n';
        expect(anchors(mkView(e, e.indexOf('*<') + 1)).length).toBe(0);
    });

    it('moving the cursor off re-renders the widget', () => {
        const v = mkView(doc, at + 3);
        expect(anchors(v).length).toBe(0);
        v.dispatch({ selection: { anchor: 0 } });
        expect(anchors(v).length).toBe(1);
        expect(lineText(v, 2)).toBe('https://x.y/a');
    });
});

describe('autolink out of scope (unchanged)', () => {
    it('autolink inside a Link label: exactly one widget (the outer link), outer href', () => {
        const v = mkView('intro\n\n[see <https://x.y>](https://z.w)\n', 0);
        const as = anchors(v);
        expect(as.length).toBe(1);
        expect(as[0].getAttribute('href')).toBe('https://z.w');
    });

    it('bare GFM URL without <> is not a link widget', () => {
        const v = mkView('intro\n\ngo https://x.y/a now\n', 0);
        expect(anchors(v).length).toBe(0);
        expect(lineText(v, 2)).toBe('go https://x.y/a now');
    });
});

describe('Ctrl/Cmd+click on autolinks', () => {
    const doc = 'intro\n\n<https://x.y/a>\n\nend\n';
    const inLabel = (d, s) => d.indexOf(s);

    it('ctrl+click on the rendered widget opens the href in a new tab and prevents default', () => {
        const v = mkView(doc, 0);
        const e = click(v, inLabel(doc, 'x.y'));
        expect(window.open).toHaveBeenCalledWith('https://x.y/a', '_blank');
        expect(e.defaultPrevented).toBe(true);
    });

    it('meta+click works the same', () => {
        const v = mkView(doc, 0);
        const e = click(v, inLabel(doc, 'x.y'), { metaKey: true });
        expect(window.open).toHaveBeenCalledWith('https://x.y/a', '_blank');
        expect(e.defaultPrevented).toBe(true);
    });

    it('ctrl+click on the raw text (no linkPreview, cursor elsewhere) opens it too', () => {
        const v = mkView(doc, 0, [linkHandler]);
        click(v, inLabel(doc, 'x.y'));
        expect(window.open).toHaveBeenCalledWith('https://x.y/a', '_blank');
    });

    it('ctrl+click on the `<` mark opens it', () => {
        const v = mkView(doc, 0, [linkHandler]);
        click(v, doc.indexOf('<https'));
        expect(window.open).toHaveBeenCalledWith('https://x.y/a', '_blank');
    });

    it('email autolink opens mailto:', () => {
        const d = 'intro\n\n<a@b.co>\n';
        const v = mkView(d, 0);
        const e = click(v, d.indexOf('a@b'));
        expect(window.open).toHaveBeenCalledWith('mailto:a@b.co', '_blank');
        expect(e.defaultPrevented).toBe(true);
    });

    it('backslash autolink opens the %5C href', () => {
        const d = 'intro\n\n<https://a.b/c\\d>\n';
        const v = mkView(d, 0);
        click(v, d.indexOf('a.b'));
        expect(window.open).toHaveBeenCalledWith('https://a.b/c%5Cd', '_blank');
    });

    it.each([['javascript:alert(1)'], ['file:///x']])('unsafe <%s>: warns, no open, still prevented', (label) => {
        const d = `intro\n\n<${label}>\n`;
        const v = mkView(d, 0);
        const e = click(v, d.indexOf(label.slice(0, 4)) + 1);
        expect(window.open).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('Blocked unsafe link scheme:', label);
        expect(e.defaultPrevented).toBe(true);
    });

    it('plain click: nothing opens, not prevented', () => {
        const v = mkView(doc, 0);
        const e = click(v, inLabel(doc, 'x.y'), {});
        expect(window.open).not.toHaveBeenCalled();
        expect(e.defaultPrevented).toBe(false);
    });

    it('ctrl+click on plain text next to an autolink does nothing and is not prevented', () => {
        const d = 'intro\n\nsee <https://x.y> now\n';
        const v = mkView(d, 0);
        const e = click(v, d.indexOf('now'));
        expect(window.open).not.toHaveBeenCalled();
        expect(e.defaultPrevented).toBe(false);
    });

    it('autolink inside a Link label: ctrl+click opens the OUTER destination (unchanged)', () => {
        const d = 'intro\n\n[see <https://x.y>](https://z.w)\n';
        const v = mkView(d, 0);
        click(v, d.indexOf('x.y'));
        expect(window.open).toHaveBeenCalledTimes(1);
        expect(window.open).toHaveBeenCalledWith('https://z.w', '_blank');
    });
});

describe('click boundaries with resolveInner(pos, 1)', () => {
    it('Link clicks: end of a link or of the line opens nothing; adjacent link opens at its own first char', () => {
        const d = 'intro\n\n[a](https://x.y)[b](https://z.w)\n';
        const v = mkView(d, 0);
        const aEnd = d.indexOf('[b]');
        click(v, d.length - 1); // pos at second link `to` (line end)
        expect(window.open).not.toHaveBeenCalled();
        click(v, aEnd); // first char of `[b]`: belongs to b, not a
        expect(window.open).toHaveBeenCalledTimes(1);
        expect(window.open).toHaveBeenLastCalledWith('https://z.w', '_blank');
        click(v, aEnd - 1); // inside a's `)`
        expect(window.open).toHaveBeenLastCalledWith('https://x.y', '_blank');
    });
});

describe('autolink hover tooltip (linkTooltipInfo)', () => {
    const doc = 'intro\n\nsee <https://x.y/a> now\n';
    const from = doc.indexOf('<https');
    const to = from + '<https://x.y/a>'.length;

    it('https autolink -> {pos: from, end: to, text}', () => {
        expect(linkTooltipInfo(stateOf(doc, 0), doc.indexOf('x.y'), 1))
            .toEqual({ pos: from, end: to, text: 'Ctrl + Click to open link' });
    });

    it('hovering the `<` or `>` mark gives the same info', () => {
        const s = stateOf(doc, 0);
        expect(linkTooltipInfo(s, from, 1)?.pos).toBe(from);
        expect(linkTooltipInfo(s, to - 1, -1)?.end).toBe(to);
    });

    it('email autolink -> open-link text', () => {
        const d = 'intro\n\n<a@b.co>\n';
        expect(linkTooltipInfo(stateOf(d, 0), d.indexOf('a@b'), 1)?.text).toBe('Ctrl + Click to open link');
    });

    it.each([['javascript:alert(1)'], ['file:///x']])('unsafe <%s> -> null', (label) => {
        const d = `intro\n\n<${label}>\n`;
        expect(linkTooltipInfo(stateOf(d, 0), d.indexOf(label) + 2, 1)).toBeNull();
    });

    it('cursor touching the autolink -> null', () => {
        const mid = doc.indexOf('x.y');
        for (const a of [from, mid, to]) expect(linkTooltipInfo(stateOf(doc, a), mid, 1), `@${a}`).toBeNull();
    });

    it('plain text next to the autolink -> null', () => {
        expect(linkTooltipInfo(stateOf(doc, 0), doc.indexOf('now'), 1)).toBeNull();
    });

    it('autolink inside a Link label: hover gives the OUTER link range, and the widget label has no <>', () => {
        const d = 'intro\n\n[see **<https://x.y>**](https://z.w)\n';
        const lf = d.indexOf('[see'), lt = d.indexOf('(https://z.w)') + '(https://z.w)'.length;
        expect(linkTooltipInfo(stateOf(d, 0), d.indexOf('x.y'), 1))
            .toEqual({ pos: lf, end: lt, text: 'Ctrl + Click to open link' });
        const a = anchors(mkView(d, 0));
        expect(a.length).toBe(1); // no <a> nested in the outer widget
        expect(a[0].textContent).toContain('https://x.y');
        expect(a[0].textContent).not.toMatch(/[<>]/);
    });

    it('the real hover tooltip shows for an autolink', async () => {
        vi.useFakeTimers();
        const d = 'intro\n\n<https://x.y/a>\n';
        const v = mkView(d, 0);
        v.posAtCoords = () => d.indexOf('x.y');
        v.coordsAtPos = () => ({ left: 0, right: 10, top: 0, bottom: 10 });
        v.contentDOM.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 5 }));
        await vi.advanceTimersByTimeAsync(1000);
        expect(document.querySelector('.cm-tooltip-cursor')?.textContent).toBe('Ctrl + Click to open link');
        vi.useRealTimers();
    });
});
