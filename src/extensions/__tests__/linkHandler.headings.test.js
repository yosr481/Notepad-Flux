import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { linkHandler, headingTargets } from '../linkHandler';

vi.mock('../../utils/fileSystem', () => ({ fileSystem: { exportFile: vi.fn() } }));
import { renderMarkdownHtml } from '../../utils/export';

// Spec: Docs/internal/heading-links-spec.md ("Editor (T2)").
// Pinned where the spec is silent:
//  - headingTargets(state) => [{ slug, from }] in document order; `from` = start of the heading's FIRST line
//    (for an indented or blockquoted heading that is the line start, not the `#`). Headings with an empty slug
//    are omitted (they get no id in export either), so the list lines up with export ids 1:1.
//  - Hit = ONE selection move to `from` (anchor === head, empty), scrollIntoView(from, {y:'start'}) effect, view.focus().
//  - "Autolink-path": lezer only makes Link nodes for bracket forms, so it is tested as `[t](<#x>)`.
//  - Fragment match: exact slug first, then `fragment.toLowerCase()`. No other normalisation.
const appExtensions = [markdown({
    base: markdownLanguage,
    extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax],
})];
const mkState = (doc, extra = []) => EditorState.create({ doc, extensions: [...appExtensions, ...extra] });

const views = [];
const mkView = (doc, anchor = 0) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor }, extensions: [...appExtensions, linkHandler] }),
        parent,
    });
    views.push(view);
    return view;
};

// Ctrl/Cmd+click at `pos` (jsdom has no layout, so posAtCoords is stubbed). Returns the event + captured effects.
const click = (view, pos, init = { ctrlKey: true }) => {
    view.posAtCoords = () => pos;
    const effects = [];
    const orig = view.dispatch.bind(view);
    vi.spyOn(view, 'dispatch').mockImplementation((...args) => {
        for (const a of args) for (const e of [].concat(a?.effects ?? [])) effects.push(e);
        return orig(...args);
    });
    const focus = vi.spyOn(view, 'focus');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    view.contentDOM.dispatchEvent(event);
    return { event, effects, focus };
};
const scrollTargets = (effects) => effects
    .filter((e) => e.is(EditorView.scrollIntoView(0).type))
    .map((e) => ({ pos: e.value.range.head, y: e.value.y }));

describe('headingTargets: pure heading list', () => {
    it('lists ATX and setext headings in order with deduped slugs and first-line starts', () => {
        const doc = '# Alpha\n\ntext\n\nBeta\n====\n\n## Alpha\n\n### Alpha\n';
        const t = headingTargets(mkState(doc));
        expect(t.map((h) => h.slug)).toEqual(['alpha', 'beta', 'alpha-1', 'alpha-2']);
        expect(t.map((h) => h.from)).toEqual([
            doc.indexOf('# Alpha'), doc.indexOf('Beta'), doc.indexOf('## Alpha'), doc.indexOf('### Alpha'),
        ]);
    });

    it('empty doc and doc without headings -> []', () => {
        expect(headingTargets(mkState(''))).toEqual([]);
        expect(headingTargets(mkState('just text\n\n- a list\n'))).toEqual([]);
    });

    it('a heading with an empty slug is omitted and does not shift dedupe', () => {
        const doc = '# Same\n\n# !!!\n\n# Same\n';
        expect(headingTargets(mkState(doc)).map((h) => h.slug)).toEqual(['same', 'same-1']);
    });

    it('multi-line setext: from is the first text line', () => {
        const doc = 'intro\n\nFirst line\nsecond line\n---\n';
        const [h] = headingTargets(mkState(doc));
        expect(h.slug).toBe('first-line-second-line');
        expect(h.from).toBe(doc.indexOf('First line'));
    });

    it('heading in a blockquote / list item: from is the start of its line', () => {
        const doc = '> # Quoted\n\n- # Listed\n';
        const t = headingTargets(mkState(doc));
        expect(t.map((h) => h.slug)).toEqual(['quoted', 'listed']);
        expect(t[0].from).toBe(doc.indexOf('> # Quoted'));
        expect(t[1].from).toBe(doc.indexOf('- # Listed'));
    });

    it('excluded: front matter, fenced code, footnote definition', () => {
        const doc = '---\ntitle: x\n# not a heading\n---\n\n```\n# in code\n```\n\nText[^1]\n\n[^1]: note\n\n    # inside fn\n\n# Real\n';
        expect(headingTargets(mkState(doc)).map((h) => h.slug)).toEqual(['real']);
    });

    it('trap (e): a heading inside a footnote definition is skipped and does not consume a dedupe slot', () => {
        const doc = '# Dup\n\nT[^1]\n\n[^1]: note\n\n    # Dup\n\n# Dup\n';
        expect(headingTargets(mkState(doc)).map((h) => h.slug)).toEqual(['dup', 'dup-1']);
    });
});

describe('headingTargets: parity with export ids', () => {
    // Accepted parser gaps (`#\tFoo`, indented-continuation setext, `- Foo\n===`) are deliberately NOT here.
    const FIXTURE = [
        '---',
        'title: Front',
        '# Not a heading',
        '---',
        '',
        '# Intro',
        '',
        '> Quoted setext',
        '> continues here',
        '> ===',
        '',
        '> Quoted two\n>    indented\n> ---',
        '',
        'Foo  ',
        'bar',
        '===',
        '',
        '## Closing run ##',
        '',
        '### Escaped \\#',
        '',
        '# Intro',
        '',
        '# Intro',
        '',
        '- # List heading',
        '- item',
        '',
        '> [!NOTE]',
        '> ## Callout heading',
        '> body',
        '',
        '```',
        '# not a heading',
        '```',
        '',
        'Ref[^a]',
        '',
        '[^a]: Footnote text',
        '',
        '    # Heading in footnote',
        '',
        '#### **Bold** [link](http://x.y) `code`',
        '',
        '##### שלום עולם',
        '',
        '###### Last one',
        '',
    ].join('\n');

    const exportIds = async (md) => {
        const html = await renderMarkdownHtml(md);
        const dom = new DOMParser().parseFromString(html, 'text/html');
        return [...dom.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => h.id).filter(Boolean);
    };

    it('editor slugs equal export ids, in document order', async () => {
        const editor = headingTargets(mkState(FIXTURE)).map((h) => h.slug);
        const exported = await exportIds(FIXTURE);
        expect(exported.length).toBeGreaterThan(8);        // fixture is not vacuous
        expect(editor).toEqual(exported);
    });

    it('fixture sanity: dedupe and trap results are really in the list', () => {
        const slugs = headingTargets(mkState(FIXTURE)).map((h) => h.slug);
        expect(slugs).toContain('intro-2');
        expect(slugs).toContain('foo---bar');
        expect(slugs).toContain('quoted-two-indented');
        expect(slugs).toContain('escaped-');
        expect(slugs).toContain('quoted-setext-continues-here');
        expect(slugs).not.toContain('heading-in-footnote');
        expect(slugs).not.toContain('not-a-heading');
    });
});

describe('headingTargets: beyond the parsed range', () => {
    it('finds a heading at the end of a doc whose initial tree is partial', () => {
        const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.\n\n';
        const doc = '# Top\n\n' + para.repeat(4000) + '# Far Away\n';
        const state = mkState(doc);
        // precondition: the parse really is partial, else this test proves nothing
        expect(syntaxTree(state).length).toBeLessThan(doc.length);
        const t = headingTargets(state);
        expect(t.map((h) => h.slug)).toEqual(['top', 'far-away']);
        expect(t[1].from).toBe(doc.lastIndexOf('# Far Away'));
    });
});

describe('Ctrl/Cmd+click on a #fragment link', () => {
    let open, warn;
    beforeEach(() => {
        open = vi.spyOn(window, 'open').mockImplementation(() => null);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => { views.splice(0).forEach((v) => v.destroy()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

    const unsafeWarned = () => warn.mock.calls.some((c) => String(c[0]).includes('Blocked unsafe link scheme'));
    const expectJump = (view, r, from) => {
        expect(r.event.defaultPrevented).toBe(true);
        expect(view.state.selection.main.anchor).toBe(from);
        expect(view.state.selection.main.head).toBe(from);
        expect(scrollTargets(r.effects)).toEqual([{ pos: from, y: 'start' }]);
        expect(r.focus).toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
        expect(unsafeWarned()).toBe(false);
    };
    const expectNoMove = (view, r, anchor) => {
        expect(r.event.defaultPrevented).toBe(true);
        expect(view.state.selection.main.head).toBe(anchor);
        expect(scrollTargets(r.effects)).toEqual([]);
        expect(open).not.toHaveBeenCalled();
        expect(unsafeWarned()).toBe(false);
    };

    it('inline link jumps to the heading start', () => {
        const doc = '[Go](#target)\n\ntext\n\n# Target\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.indexOf('# Target'));
    });

    it('Cmd (metaKey) click jumps too', () => {
        const doc = '[Go](#target)\n\n# Target\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'), { metaKey: true });
        expectJump(v, r, doc.indexOf('# Target'));
    });

    it('plain click (no Ctrl/Cmd) does nothing at all', () => {
        const doc = '[Go](#target)\n\n# Target\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'), {});
        expect(r.event.defaultPrevented).toBe(false);
        expect(v.state.selection.main.head).toBe(0);
        expect(scrollTargets(r.effects)).toEqual([]);
        expect(open).not.toHaveBeenCalled();
    });

    it('reference link [t][r] with [r]: #x jumps', () => {
        const doc = '[Go][r]\n\n# Target\n\n[r]: #target\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.indexOf('# Target'));
    });

    it('angle-bracket destination [t](<#x>) jumps', () => {
        const doc = '[Go](<#target>)\n\n# Target\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.indexOf('# Target'));
    });

    it('setext heading: lands on the first text line, not the underline', () => {
        const doc = '[Go](#two-lines)\n\nTwo\nlines\n=====\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.indexOf('Two\nlines'));
    });

    it('duplicate headings: #x-1 targets the second one', () => {
        const doc = '[Go](#x-1)\n\n# X\n\n# X\n';
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.lastIndexOf('# X'));
    });

    it('fragment is percent-decoded (non-ASCII)', () => {
        const doc = `[Go](#${encodeURIComponent('שלום-עולם')})\n\n# שלום עולם\n`;
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.indexOf('# שלום'));
    });

    it('malformed percent-escape falls back to the raw fragment', () => {
        const doc = '[Go](#100%)\n\n# 100%\n';          // slug of "100%" is "100"; raw "100%" does NOT match -> miss
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectNoMove(v, r, 0);
        const doc2 = '[Go](#bad%zz)\n\n# Bad zz\n';     // raw "bad%zz" matches nothing either; must not throw
        const v2 = mkView(doc2);
        expectNoMove(v2, click(v2, doc2.indexOf('Go')), 0);
    });

    it('exact match wins first, then lowercase fallback', () => {
        const doc = '[Go](#Target)\n\n# Target\n';       // slug is "target"; "Target" misses exact, lowercase hits
        const v = mkView(doc);
        const r = click(v, doc.indexOf('Go'));
        expectJump(v, r, doc.indexOf('# Target'));
        // exact-first: a heading whose slug really contains an uppercase char cannot exist (slugs are lowercase),
        // so exact-first is pinned only by "an exact hit never reaches the lowercase path": #target still works.
        const doc2 = '[Go](#target)\n\n# Target\n';
        const v2 = mkView(doc2);
        expectJump(v2, click(v2, doc2.indexOf('Go')), doc2.indexOf('# Target'));
    });

    it('works from inside a heading that is above or below the link (back-link)', () => {
        const doc = '# Top\n\ntext\n\n[Back](#top)\n';
        const v = mkView(doc, doc.length);
        const r = click(v, doc.indexOf('Back'));
        expectJump(v, r, 0);
    });

    it('miss: selection unchanged, preventDefault, no open, no warning', () => {
        const doc = '[Go](#nowhere)\n\n# Target\n';
        const v = mkView(doc, 3);
        expectNoMove(v, click(v, doc.indexOf('Go')), 3);
    });

    it('empty fragment `#`: same as miss', () => {
        const doc = '[Go](#)\n\n# Target\n';
        const v = mkView(doc, 2);
        expectNoMove(v, click(v, doc.indexOf('Go')), 2);
    });

    it('doc without any heading: miss, no throw', () => {
        const doc = '[Go](#x)\n';
        const v = mkView(doc, 1);
        expectNoMove(v, click(v, doc.indexOf('Go')), 1);
    });

    it('does not match a heading excluded from counting (inside a footnote definition)', () => {
        const doc = '[Go](#only-in-footnote)\n\nT[^1]\n\n[^1]: note\n\n    # Only in footnote\n';
        const v = mkView(doc, 4);
        expectNoMove(v, click(v, doc.indexOf('Go')), 4);
    });

    it('does not match a heading inside fenced code', () => {
        const doc = '[Go](#fake)\n\n```\n# Fake\n```\n';
        const v = mkView(doc, 4);
        expectNoMove(v, click(v, doc.indexOf('Go')), 4);
    });

    it('far heading in a big doc is reachable by click', () => {
        const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.\n\n';
        const doc = '[Go](#far-away)\n\n' + para.repeat(4000) + '# Far Away\n';
        const v = mkView(doc);
        // precondition: initial parse is partial, so the jump needs ensureSyntaxTree (kept small: no reliance on the 1s budget)
        expect(syntaxTree(v.state).length).toBeLessThan(doc.length);
        expectJump(v, click(v, doc.indexOf('Go')), doc.lastIndexOf('# Far Away'));
    });

    describe('regression: external URLs still behave after the helper refactor', () => {
        it.each([
            ['inline https', '[Go](https://example.com/a)\n', 'https://example.com/a'],
            ['inline http', '[Go](http://example.com/a)\n', 'http://example.com/a'],
            ['inline mailto', '[Go](mailto:a@b.com)\n', 'mailto:a@b.com'],
            ['angle-bracket https', '[Go](<https://example.com/b>)\n', 'https://example.com/b'],
            ['reference https', '[Go][r]\n\n[r]: https://example.com/c\n', 'https://example.com/c'],
        ])('%s opens in a new tab', (_n, doc, url) => {
            const v = mkView(doc);
            const r = click(v, doc.indexOf('Go'));
            expect(open).toHaveBeenCalledWith(url, '_blank');
            expect(r.event.defaultPrevented).toBe(true);
            expect(scrollTargets(r.effects)).toEqual([]);
        });

        it.each([
            ['inline javascript:', '[Go](javascript:alert(1))\n'],
            ['inline file:', '[Go](file:///etc/passwd)\n'],
            ['reference smb:', '[Go][r]\n\n[r]: smb://host/share\n'],
        ])('%s warns and does not open', (_n, doc) => {
            const v = mkView(doc);
            const r = click(v, doc.indexOf('Go'));
            expect(open).not.toHaveBeenCalled();
            expect(unsafeWarned()).toBe(true);
            expect(r.event.defaultPrevented).toBe(true);
            expect(scrollTargets(r.effects)).toEqual([]);
        });

        it('a non-fragment relative path is inert and silent (only `#` is special; T2 policy 2026-11-25)', () => {
            const doc = '[Go](page.md#target)\n\n# Target\n';
            const v = mkView(doc);
            click(v, doc.indexOf('Go'));
            expect(open).not.toHaveBeenCalled();
            expect(unsafeWarned()).toBe(false);
            expect(v.state.selection.main.head).toBe(0);
        });
    });
});
