import { describe, it, expect, vi, afterEach } from 'vitest';
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
import { linkHandler } from '../linkHandler';
import { resolveLinkDefs } from '../linkDefs';
import { TableWidget } from '../widgets';
import { renderMarkdownHtml } from '../../utils/export';

// B15: link destination edge cases in the EDITOR (LinkWidget outside tables, table cells, link defs, Ctrl+click).
//
// PINNED CONTRACT (writer must match):
//  1. resolveLinkDefs: a definition URL of the form <...> has the angle brackets stripped (spaces inside kept).
//     `[r]: <https://e.com/a b>` -> url "https://e.com/a b". Same rule for an inline `[t](<dest>)` link
//     (LinkWidget regex today excludes spaces and keeps <>; widened here: both outside tables and in cells).
//  2. Email autolink `<a@b.test>` in a table cell -> <a href="mailto:a@b.test">, link text stays "a@b.test".
//     A URL with a scheme (https://..., javascript:...) is NOT prefixed. Outside tables an Autolink has no
//     widget and no click handling today (also for https), so it is out of scope: no outside test.
//  3. Destination text (inline, reference def, cell) = entity-decoded via decodeEntity (named + &#38; + &#x26;),
//     applied AFTER <> strip. Order: strip <>, backslash-unescape, decode entities, then isSafeExternalUrl.
//     Unknown/unterminated entities stay literal. Decoded unsafe schemes yield NO href (never a live
//     javascript:), label still renders.
//  4. Ctrl/Cmd+click (linkClickHandler) opens the SAME decoded/stripped url as the rendered href, and
//     refuses unsafe ones (no window.open).
//  5. Export is the oracle: editor href == export href. For spaces, export percent-encodes (a%20b), so
//     those comparisons use the anchor's `.href` PROPERTY (URL-normalised); others use getAttribute('href').
//  6. TableWidget(null): constructor and toDOM() do not throw; toDOM() gives div.cm-table-widget with no <table>.
//     Export code is not to change.

const mocks = vi.hoisted(() => ({ renderTex: vi.fn(), isMathLoaded: vi.fn(() => false) }));
vi.mock('../../utils/math', () => ({
    renderTex: (...a) => mocks.renderTex(...a),
    isMathLoaded: () => mocks.isMathLoaded(),
}));

const EXTENSIONS = [
    markdown({ base: markdownLanguage, extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] }),
    livePreview, linkPreview, linkHandler,
];

const views = [];
const mkView = (doc, anchor = 0) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor }, extensions: EXTENSIONS }), parent });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor } });
    views.push(view);
    return view;
};
afterEach(() => { while (views.length) views.pop().destroy(); vi.restoreAllMocks(); });

const mkState = (doc) => {
    const s = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
    ensureSyntaxTree(s, s.doc.length, 10000);
    return s.update({}).state;
};

const outsideDoc = (body, defs = "") => `p\n\n${body}\n\nz\n${defs}`;
const cellDoc = (cell, defs = '') => `p\n\n| h |\n| --- |\n| ${cell} |\n\nz\n${defs}`;
const outsideLink = (v) => v.dom.querySelector('.cm-content a.cm-link');
const cellLink = (v) => v.dom.querySelector('.cm-table-widget tbody td a.cm-link');

// Export oracle: the <a> marked produces for the same markdown.
const exportLink = async (md) => {
    const d = document.createElement('div');
    d.innerHTML = await renderMarkdownHtml(md);
    return d.querySelector('a');
};

// [label, markdown body for the link, defs appended after, expected href attribute]
const FORMS = {
    'inline': (dest) => ({ body: `[t](${dest})`, defs: '' }),
    'reference def': (dest) => ({ body: '[t][r]', defs: `\n[r]: ${dest}\n` }),
};

describe('resolveLinkDefs: destination', () => {
    it('strips <> from an angle-bracket destination', () => {
        expect(resolveLinkDefs(mkState('[r]: <https://e.com>')).get('r').url).toBe('https://e.com');
    });
    it('keeps spaces inside <> ', () => {
        expect(resolveLinkDefs(mkState('[r]: <https://e.com/a b>')).get('r').url).toBe('https://e.com/a b');
    });
    it('angle destination keeps its title', () => {
        expect(resolveLinkDefs(mkState('[r]: <https://e.com> "T"')).get('r')).toEqual({ url: 'https://e.com', title: 'T' });
    });
    it('plain destination unchanged (control)', () => {
        expect(resolveLinkDefs(mkState('[r]: https://e.com')).get('r').url).toBe('https://e.com');
    });
    it.each([['&amp;', '&'], ['&#38;', '&'], ['&#x26;', '&']])('decodes %s in a definition url', (ent, ch) => {
        expect(resolveLinkDefs(mkState(`[r]: https://e.com/?a=1${ent}b=2`)).get('r').url).toBe(`https://e.com/?a=1${ch}b=2`);
    });
    it('unknown entity stays literal', () => {
        expect(resolveLinkDefs(mkState('[r]: https://e.com/?a=1&nope;b')).get('r').url).toBe('https://e.com/?a=1&nope;b');
    });
    it('bare & without a semicolon stays literal', () => {
        expect(resolveLinkDefs(mkState('[r]: https://e.com/?a=1&b=2')).get('r').url).toBe('https://e.com/?a=1&b=2');
    });
    it('angle + entity: both applied', () => {
        expect(resolveLinkDefs(mkState('[r]: <https://e.com/?a=1&amp;b=2>')).get('r').url).toBe('https://e.com/?a=1&b=2');
    });
});

describe.each([['outside tables (LinkWidget)', outsideDoc, outsideLink], ['table cell', (b, d) => cellDoc(b, d), cellLink]])(
    'destinations %s', (_n, mkDoc, find) => {
        const render = (form, dest) => { const { body, defs } = FORMS[form](dest); return { v: mkView(mkDoc(body, defs)), md: mkDoc(body, defs) }; };

        describe.each(Object.keys(FORMS))('%s', (form) => {
            it('angle-bracket destination: href without <>', () => {
                const { v } = render(form, '<https://e.com>');
                expect(find(v).getAttribute('href')).toBe('https://e.com');
            });

            it('angle-bracket destination with a space: decoded href, equals export', async () => {
                const { v, md } = render(form, '<https://e.com/a b>');
                const a = find(v);
                expect(a, 'link widget rendered').not.toBeNull();
                expect(a.getAttribute('href')).toBe('https://e.com/a b');
                expect(a.href).toBe((await exportLink(md)).href);
            });

            it.each([['&amp;', '&'], ['&#38;', '&'], ['&#x26;', '&']])('entity %s in destination decodes; equals export', async (ent) => {
                const { v, md } = render(form, `https://e.com/?a=1${ent}b=2`);
                const a = find(v);
                expect(a.getAttribute('href')).toBe('https://e.com/?a=1&b=2');
                expect(a.getAttribute('href')).toBe((await exportLink(md)).getAttribute('href'));
            });

            it('angle + entity together', () => {
                const { v } = render(form, '<https://e.com/?a=1&amp;b=2>');
                expect(find(v).getAttribute('href')).toBe('https://e.com/?a=1&b=2');
            });

            it('unknown entity stays literal in the href', () => {
                const { v } = render(form, 'https://e.com/?a=1&nope;b');
                expect(find(v).getAttribute('href')).toBe('https://e.com/?a=1&nope;b');
            });

            it('entity must not smuggle markup: &lt;script&gt; stays text in the attribute, no element', () => {
                const { v } = render(form, 'https://e.com/?q=&lt;script&gt;');
                const a = find(v);
                expect(a.getAttribute('href')).toBe('https://e.com/?q=<script>');
                expect(v.dom.querySelector('.cm-content script')).toBeNull();
            });

            describe('security: href still passes isSafeExternalUrl AFTER decoding', () => {
                it.each([
                    ['numeric entity scheme', '&#106;avascript:alert(1)'],
                    ['hex entity scheme', '&#x6A;avascript:alert(1)'],
                    ['angle-bracket scheme', '<javascript:alert(1)>'],
                    ['angle + entity scheme', '<&#106;avascript:alert(1)>'],
                    ['entity colon', 'javascript&#58;alert(1)'],
                ])('%s: no href', (_x, dest) => {
                    const { v } = render(form, dest);
                    const a = find(v);
                    expect(a, 'label still renders as a link element').not.toBeNull();
                    expect(a.getAttribute('href')).toBeNull();
                    expect(v.dom.innerHTML).not.toMatch(/href="javascript:/i);
                });

                it('file: via angle bracket: no href', () => {
                    const { v } = render(form, '<file:///etc/passwd>');
                    expect(find(v).getAttribute('href')).toBeNull();
                });
            });
        });
    });

describe('email autolink in a table cell', () => {
    it('<a@b.test> gets href mailto:a@b.test, text a@b.test, equals export', async () => {
        const a = cellLink(mkView(cellDoc('<a@b.test>')));
        expect(a, 'autolink rendered as anchor in cell').not.toBeNull();
        expect(a.getAttribute('href')).toBe('mailto:a@b.test');
        expect(a.textContent).toBe('a@b.test');
        expect(a.getAttribute('href')).toBe((await exportLink('<a@b.test>')).getAttribute('href'));
    });

    it('https autolink unchanged: no mailto prefix', () => {
        expect(cellLink(mkView(cellDoc('<https://e.com/x>'))).getAttribute('href')).toBe('https://e.com/x');
    });

    it('mailto: autolink is not double-prefixed', () => {
        expect(cellLink(mkView(cellDoc('<mailto:a@b.test>'))).getAttribute('href')).toBe('mailto:a@b.test');
    });

    it('javascript: autolink: still no href', () => {
        const a = cellLink(mkView(cellDoc('<javascript:alert(1)>')));
        expect(a === null || a.getAttribute('href') === null).toBe(true);
        expect(document.body.innerHTML).not.toMatch(/href="javascript:/i);
    });

    it.each(['ctrlKey', 'metaKey'])('%s mousedown on the email link is not prevented (opens like other links)', (key) => {
        const v = mkView(cellDoc('<a@b.test>'));
        const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, [key]: true });
        cellLink(v).dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        expect(v.state.selection.main.head).toBe(0);
    });
});

describe('autolink in a table cell: backslash stays literal, entities decode (CommonMark)', () => {
    it('<https://e.com/a\\_b> keeps the backslash, equals export', async () => {
        const a = cellLink(mkView(cellDoc('<https://e.com/a\\_b>')));
        expect(a.href).toBe((await exportLink('<https://e.com/a\\_b>')).href);
        expect(a.href).toContain('%5C');
    });
    it('<https://e.com/?a=1&amp;b=2> still decodes entities, equals export', async () => {
        const a = cellLink(mkView(cellDoc('<https://e.com/?a=1&amp;b=2>')));
        expect(a.getAttribute('href')).toBe('https://e.com/?a=1&b=2');
        expect(a.href).toBe((await exportLink('<https://e.com/?a=1&amp;b=2>')).href);
    });
    it('email autolink still gets mailto:', () => {
        expect(cellLink(mkView(cellDoc('<a@b.test>'))).getAttribute('href')).toBe('mailto:a@b.test');
    });
});

describe('entities in an inline link inside a table cell (cell-only forms)', () => {
    it('[t](url?a=1&amp;b=2) in a cell: decoded', () => {
        expect(cellLink(mkView(cellDoc('[t](https://e.com/?a=1&amp;b=2)'))).getAttribute('href')).toBe('https://e.com/?a=1&b=2');
    });
    it('plain & stays as is (control)', () => {
        expect(cellLink(mkView(cellDoc('[t](https://e.com/?a=1&b=2)'))).getAttribute('href')).toBe('https://e.com/?a=1&b=2');
    });
});

describe('Ctrl/Cmd+click opens the decoded url (linkClickHandler)', () => {
    const click = (doc, needle, init = { ctrlKey: true }) => {
        const v = mkView(doc);
        v.posAtCoords = () => doc.indexOf(needle);
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
        v.contentDOM.dispatchEvent(ev);
        return { open, ev };
    };

    it('inline url with &amp;: opens a=1&b=2', () => {
        const { open } = click(outsideDoc('[t](https://e.com/?a=1&amp;b=2)'), 'https://e.com');
        expect(open).toHaveBeenCalledWith('https://e.com/?a=1&b=2', '_blank');
    });
    it('inline <angle> url: opens without <>', () => {
        const { open } = click(outsideDoc('[t](<https://e.com>)'), 'https://e.com');
        expect(open).toHaveBeenCalledWith('https://e.com', '_blank');
    });
    it('metaKey works too', () => {
        const { open } = click(outsideDoc('[t](https://e.com/?a=1&#38;b=2)'), 'https://e.com', { metaKey: true });
        expect(open).toHaveBeenCalledWith('https://e.com/?a=1&b=2', '_blank');
    });
    it('reference link to an angle def: opens without <>', () => {
        const doc = outsideDoc('[t][r]', '\n[r]: <https://e.com>\n');
        const { open } = click(doc, 't]');
        expect(open).toHaveBeenCalledWith('https://e.com', '_blank');
    });
    it('security: &#106;avascript: is never opened', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { open } = click(outsideDoc('[t](&#106;avascript:alert(1))'), '&#106;');
        expect(open).not.toHaveBeenCalled();
    });
    it('security: <javascript:...> is never opened', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { open } = click(outsideDoc('[t](<javascript:alert(1)>)'), 'javascript');
        expect(open).not.toHaveBeenCalled();
    });
    it('plain click (no modifier) opens nothing', () => {
        const { open } = click(outsideDoc('[t](https://e.com/?a=1&amp;b=2)'), 'https://e.com', {});
        expect(open).not.toHaveBeenCalled();
    });
});

describe('TableWidget with null data (defensive; lezer never emits such a Table)', () => {
    it('constructor does not throw', () => {
        expect(() => new TableWidget(null)).not.toThrow();
    });
    it('toDOM does not throw and renders an empty .cm-table-widget with no <table>', () => {
        const v = mkView('x');
        let dom;
        expect(() => { dom = new TableWidget(null).toDOM(v); }).not.toThrow();
        expect(dom.className).toBe('cm-table-widget');
        expect(dom.querySelector('table')).toBeNull();
    });
    it('two null widgets are eq', () => {
        expect(new TableWidget(null).eq(new TableWidget(null))).toBe(true);
    });
});
