import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { linkPreview } from '../linkPreview';
import { livePreview } from '../livePreview';
import { linkHandler, linkKind, linkTooltipInfo } from '../linkHandler';

// Spec: Docs/internal/b18-b19-spec.md "T2" (Yossi's policy 2026-11-25).
//
// PINNED API (writer must export these from linkHandler.js):
//   linkKind(url) => "heading" | "external" | "relative" | "unsafe"
//       url = an already-normalized destination (normalizeDestination output). Pure, never throws.
//       "#..." (incl. bare "#") -> heading; isSafeExternalUrl(url) -> external;
//       does NOT match /^[a-z][a-z0-9+.-]*:/i -> relative (includes ""); everything else -> unsafe.
//       Order: heading, then external, then relative, then unsafe.
//   linkTooltipInfo(state, pos, side) => { pos, end, text } | null
//       The pure body of the `linkTooltip` hoverTooltip source (linkTooltip must call it and wrap the result:
//       pos/end = Link node from/to, text = tooltip text). null when: not on a Link, cursor/selection
//       touches the Link (range.from <= link.to && range.to >= link.from), reference unresolved,
//       destination unsafe. Destination = inline URL node, else resolveReference(linkNode).url (same lookup as click).
//       text: external "Ctrl + Click to open link"; heading "Ctrl + Click to jump to heading";
//             relative "Relative link: opens only in exported files".
//   Click: relative -> preventDefault, no window.open, no selection move, NO console.warn.
//          unsafe -> console.warn('Blocked unsafe link scheme:', url) + preventDefault (unchanged).
//   Widget href for relative stays absent (unchanged).

describe('linkKind', () => {
    it.each([
        ['#top', 'heading'], ['#', 'heading'], ['#a-b', 'heading'],
        ['https://e.com', 'external'], ['http://e.com/x?y=1', 'external'], ['mailto:a@b.com', 'external'],
        ['HTTPS://E.COM', 'external'],
        ['notes.md', 'relative'], ['a(b)c', 'relative'], ['./x/y.md', 'relative'], ['../up.md', 'relative'],
        ['/abs/path.md', 'relative'], ['?q=1', 'relative'], ['//host/x', 'relative'], ['page.md#sec', 'relative'],
        ['dir/a:b.md', 'relative'], ['', 'relative'],
        ['javascript:alert(1)', 'unsafe'], ['JAVASCRIPT:alert(1)', 'unsafe'], ['vbscript:x', 'unsafe'],
        ['file:///etc/passwd', 'unsafe'], ['data:text/html,hi', 'unsafe'], ['smb://h/s', 'unsafe'],
        ['c:\\x', 'unsafe'], ['x-custom+v1.2:foo', 'unsafe'],
    ])('%j -> %s', (url, kind) => {
        expect(linkKind(url)).toBe(kind);
    });

    it('a leading "#" wins over scheme-like text after it', () => {
        expect(linkKind('#javascript:x')).toBe('heading');
    });
    it('a scheme must start with a letter: "1a:b" has no scheme -> relative', () => {
        expect(linkKind('1a:b')).toBe('relative');
    });
});

const appExtensions = [markdown({
    base: markdownLanguage,
    extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax],
})];
const views = [];
const mkView = (doc, anchor = doc.length, extra = [linkHandler]) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor }, extensions: [...appExtensions, ...extra] }),
        parent,
    });
    views.push(view);
    return view;
};
const click = (view, pos, init = { ctrlKey: true }) => {
    view.posAtCoords = () => pos;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    view.contentDOM.dispatchEvent(event);
    return event;
};

describe('Ctrl/Cmd+click by link kind', () => {
    let open, warn;
    beforeEach(() => {
        open = vi.spyOn(window, 'open').mockImplementation(() => null);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => { views.splice(0).forEach((v) => v.destroy()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it.each([
        ['notes.md'], ['a(b)c'], ['./x/y.md'], ['../up.md'], ['/abs/path.md'], ['?q=1'], ['//host/x'], ['page.md#sec'],
    ])('inline relative [Go](%s): nothing opens, no move, no warning, preventDefault', (dest) => {
        const doc = `intro\n\n[Go](${dest.includes('(') ? `<${dest}>` : dest})\n\n# Target\n`;
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'));
        expect(e.defaultPrevented).toBe(true);
        expect(open).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(v.state.selection.main.head).toBe(0);
    });

    it('empty destination [Go]() is relative (the tooltip says so): click is inert, silent and prevented', () => {
        const doc = 'intro\n\n[Go]()\n\n# Target\n';
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'));
        expect(e.defaultPrevented).toBe(true);
        expect(open).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(v.state.selection.main.head).toBe(0);
    });

    it('reference relative [t][r] + [r]: notes.md -> inert and silent', () => {
        const doc = 'intro\n\n[Go][r]\n\n[r]: notes.md\n';
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'));
        expect(e.defaultPrevented).toBe(true);
        expect(open).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(v.state.selection.main.head).toBe(0);
    });

    it('Cmd (metaKey) on a relative link is inert and silent too', () => {
        const doc = 'intro\n\n[Go](notes.md)\n';
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'), { metaKey: true });
        expect(e.defaultPrevented).toBe(true);
        expect(open).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it('plain click on a relative link: not prevented, nothing happens', () => {
        const doc = 'intro\n\n[Go](notes.md)\n';
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'), {});
        expect(e.defaultPrevented).toBe(false);
        expect(open).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it.each([
        ['inline javascript:', '[Go](javascript:alert(1))'],
        ['inline JAVASCRIPT:', '[Go](JAVASCRIPT:alert(1))'],
        ['inline file:', '[Go](file:///etc/passwd)'],
        ['inline data:', '[Go](data:text/html,hi)'],
        ['inline smb:', '[Go](smb://h/s)'],
        ['inline vbscript:', '[Go](vbscript:x)'],
    ])('%s still warns "Blocked unsafe link scheme", no open, preventDefault', (_n, link) => {
        const doc = `intro\n\n${link}\n`;
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'));
        expect(open).not.toHaveBeenCalled();
        expect(warn.mock.calls.some((c) => String(c[0]).includes('Blocked unsafe link scheme'))).toBe(true);
        expect(e.defaultPrevented).toBe(true);
    });

    it('reference to an unsafe scheme still warns', () => {
        const doc = 'intro\n\n[Go][r]\n\n[r]: smb://host/share\n';
        const v = mkView(doc, 0);
        click(v, doc.indexOf('Go'));
        expect(open).not.toHaveBeenCalled();
        expect(warn.mock.calls.some((c) => String(c[0]).includes('Blocked unsafe link scheme'))).toBe(true);
    });

    it('external still opens in a new tab, no warning', () => {
        const doc = 'intro\n\n[Go](https://example.com/a)\n';
        const v = mkView(doc, 0);
        const e = click(v, doc.indexOf('Go'));
        expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank');
        expect(e.defaultPrevented).toBe(true);
        expect(warn).not.toHaveBeenCalled();
    });

    it('heading still jumps, no warning, no open', () => {
        const doc = '[Go](#target)\n\ntext\n\n# Target\n';
        const v = mkView(doc, doc.length);
        const e = click(v, doc.indexOf('Go'));
        expect(e.defaultPrevented).toBe(true);
        expect(v.state.selection.main.head).toBe(doc.indexOf('# Target'));
        expect(open).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('linkTooltipInfo: text by link kind', () => {
    const REL = 'Relative link: opens only in exported files';
    const tip = (doc, needle, anchor = 0) => {
        const state = EditorState.create({ doc, selection: { anchor }, extensions: appExtensions });
        return linkTooltipInfo(state, doc.indexOf(needle), 1);
    };

    it('external inline -> "Ctrl + Click to open link", range = whole Link node', () => {
        const doc = 'intro\n\n[Go](https://example.com)\n';
        const t = tip(doc, 'Go');
        expect(t).toEqual({ pos: doc.indexOf('[Go]'), end: doc.indexOf('[Go]') + '[Go](https://example.com)'.length, text: 'Ctrl + Click to open link' });
    });
    it('mailto -> open link text', () => {
        expect(tip('intro\n\n[Go](mailto:a@b.com)\n', 'Go').text).toBe('Ctrl + Click to open link');
    });
    it('heading -> "Ctrl + Click to jump to heading"', () => {
        expect(tip('intro\n\n[Go](#target)\n\n# Target\n', 'Go').text).toBe('Ctrl + Click to jump to heading');
    });
    it.each(['notes.md', './x/y.md', '../up.md', '/abs/path.md', '?q=1', '//host/x', 'page.md#sec'])(
        'relative [Go](%s) -> relative text', (dest) => {
            expect(tip(`intro\n\n[Go](${dest})\n`, 'Go').text).toBe(REL);
        });
    it('relative with parens via angle brackets -> relative text', () => {
        expect(tip('intro\n\n[Go](<a(b)c>)\n', 'Go').text).toBe(REL);
    });
    it('hover over the URL part (not the label) also works', () => {
        expect(tip('intro\n\n[Go](notes.md)\n', 'notes').text).toBe(REL);
    });
    it('reference link uses the resolved definition: relative', () => {
        expect(tip('intro\n\n[Go][r]\n\n[r]: notes.md\n', 'Go').text).toBe(REL);
    });
    it('reference link resolved to external / heading', () => {
        expect(tip('intro\n\n[Go][r]\n\n[r]: https://e.com\n', 'Go').text).toBe('Ctrl + Click to open link');
        expect(tip('intro\n\n[Go][r]\n\n[r]: #target\n\n# Target\n', 'Go').text).toBe('Ctrl + Click to jump to heading');
    });
    it('shortcut reference [r] resolves too', () => {
        expect(tip('intro\n\n[r]\n\n[r]: notes.md\n', 'r]').text).toBe(REL);
    });
    it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'smb://h/s', 'vbscript:x'])(
        'unsafe %s -> null (no tooltip)', (dest) => {
            expect(tip(`intro\n\n[Go](${dest})\n`, 'Go')).toBeNull();
        });
    it('reference to unsafe -> null', () => {
        expect(tip('intro\n\n[Go][r]\n\n[r]: javascript:alert(1)\n', 'Go')).toBeNull();
    });
    it('unresolved reference [t][missing] -> null', () => {
        expect(tip('intro\n\n[Go][missing]\n', 'Go')).toBeNull();
    });
    it('not on a link -> null', () => {
        expect(tip('intro\n\n[Go](notes.md)\n', 'intro')).toBeNull();
    });
    it('cursor touching the link (inside, either edge) -> null for every kind', () => {
        for (const dest of ['notes.md', 'https://e.com', '#t']) {
            const doc = `intro\n\n[Go](${dest})\n`;
            const from = doc.indexOf('[Go]');
            const to = from + `[Go](${dest})`.length;
            for (const a of [from, from + 2, to]) expect(tip(doc, 'Go', a), `${dest}@${a}`).toBeNull();
        }
    });
    it('cursor elsewhere -> tooltip (selection far from link)', () => {
        expect(tip('[Go](notes.md)\n\nfar away\n', 'Go', 20)).not.toBeNull();
    });
});

describe('linkTooltip extension is wired to linkTooltipInfo (hover, real view)', () => {
    afterEach(() => { views.splice(0).forEach((v) => v.destroy()); document.body.innerHTML = ''; vi.useRealTimers(); });

    it('hovering a relative link shows the relative text in a tooltip', async () => {
        vi.useFakeTimers();
        const doc = 'intro\n\n[Go](notes.md)\n';
        const v = mkView(doc, 0);
        v.posAtCoords = () => doc.indexOf('Go');
        v.coordsAtPos = () => ({ left: 0, right: 10, top: 0, bottom: 10 });
        v.contentDOM.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 5 }));
        await vi.advanceTimersByTimeAsync(1000);
        const tt = document.querySelector('.cm-tooltip-cursor');
        expect(tt?.textContent).toBe('Relative link: opens only in exported files');
    });
});

describe('widget href (linkPreview)', () => {
    afterEach(() => { views.splice(0).forEach((v) => v.destroy()); document.body.innerHTML = ''; });
    it('relative link renders an anchor widget with NO href', () => {
        const v = mkView('intro\n\n[Go](notes.md)\n', 0, [livePreview, linkPreview]);
        const a = v.dom.querySelector('a.cm-link');
        expect(a).not.toBeNull();
        expect(a.getAttribute('href')).toBeNull();
    });
});
