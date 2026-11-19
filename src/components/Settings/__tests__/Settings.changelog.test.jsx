import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import Settings from '../Settings';
import * as SessionContext from '../../../context/SessionContext';
import { loadChangelog } from '../../../utils/loadChangelog';
import { version } from '../../../../package.json';

vi.mock('lucide-react', () => ({ ArrowLeft: () => <span>back</span> }));
vi.mock('../../../utils/dialogs', () => ({ dialogs: { confirm: vi.fn(async () => false), alert: vi.fn() } }));
vi.mock('../../../context/SessionContext', () => ({ useSettings: vi.fn(), useSessionActions: vi.fn() }));
vi.mock('../../../utils/loadChangelog', () => ({ loadChangelog: vi.fn() }));

/**
 * S2 — "What's new in vX" in Settings > About (Docs/internal/changelog-about-spec.md).
 *
 * Pinned contract (spec leaves these open; these are the picks):
 *  - loader: src/utils/loadChangelog.js, named export `loadChangelog(): Promise<string>` = the raw text of
 *    CHANGELOG.md (a dynamic `import('../../CHANGELOG.md?raw')` returning its default export). Tests mock it with vi.mock.
 *  - Settings calls it at most once per mounted Settings, the first time the <details> is opened (never on render,
 *    never when closed), then keeps the text (closing and reopening does not call it again).
 *  - Settings picks the section with changelogSection(text, <package.json version>). The summary and the section use
 *    package.json `version`, NOT the `appVersion` prop (the tests pass appVersion="0.0.0" to prove it).
 *  - the <summary> text is exactly `What's new in v<version>` with a straight ASCII apostrophe.
 *  - a <details> element exists on first render (whether the section exists cannot be known before the lazy load).
 *    If the load resolves but has no section for the version, the <details> is removed from the DOM entirely.
 *  - load failure (reject, or sync throw): the <details> stays, open, with the text "Couldn't load the changelog."
 *    (straight apostrophe) and nothing is thrown.
 *  - body: marked + sanitizeHTML, then a post-sanitize pass over every <a>: href kept only for http/https/mailto
 *    (isSafeExternalUrl) and then target="_blank" + rel containing noopener and noreferrer; any other <a> (javascript:,
 *    relative, #fragment, no href) loses its href (and gets no target) but keeps its text.
 *  - the section's `## [x] — date` header line is not shown. Headings from `### Added` render as heading elements.
 */
const CL = (body, v = version) => [
    '# Changelog', '', '## [Unreleased]', '', '- unreleased item must never show', '',
    `## [${v}] — 2026-11-16`, '', body, '',
    '## [0.0.1] — 2020-01-01', '', '- an older item', '',
].join('\n');

const BASIC = '### Added\n\n- First feature\n- Second feature\n\n### Fixed\n\n- A bug';
const baseSettings = { theme: 'system', sessionWarnTabs: 10, sessionWarnSize: 50 };
const ui = () => <Settings isOpen onClose={vi.fn()} appVersion="0.0.0" />;
const summary = () => screen.queryByText(`What's new in v${version}`);
const detailsOf = (c) => c.querySelector('details');
const expand = () => fireEvent.click(summary());
const openWith = async (text, c) => {
    loadChangelog.mockResolvedValue(text);
    expand();
    await waitFor(() => expect(loadChangelog).toHaveBeenCalled());
    return detailsOf(c);
};

beforeEach(() => {
    loadChangelog.mockReset();
    SessionContext.useSettings.mockReturnValue({ settings: baseSettings, updateSettings: vi.fn() });
    SessionContext.useSessionActions.mockReturnValue({ clearSessionData: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Settings About > What\'s new — shell', () => {
    it('renders a closed <details> with the summary "What\'s new in v<package.json version>"', () => {
        loadChangelog.mockResolvedValue(CL(BASIC));
        const { container } = render(ui());
        const d = detailsOf(container);
        expect(d).toBeTruthy();
        expect(d.open).toBe(false);
        expect(summary()).toBeInTheDocument();
        expect(d.querySelector('summary')).toBe(summary().closest('summary'));
    });

    it('uses package.json version, not the appVersion prop', () => {
        loadChangelog.mockResolvedValue(CL(BASIC));
        render(ui());
        expect(screen.queryByText("What's new in v0.0.0")).toBeNull();
        expect(summary()).toBeInTheDocument();
    });

    it('is lazy: the loader is not called on render, nor after a re-render while closed', () => {
        loadChangelog.mockResolvedValue(CL(BASIC));
        const { rerender } = render(ui());
        rerender(ui());
        expect(loadChangelog).not.toHaveBeenCalled();
    });

    it('the first expansion calls the loader once, with no arguments; reopening does not call it again', async () => {
        loadChangelog.mockResolvedValue(CL(BASIC));
        const { container } = render(ui());
        expand();
        await waitFor(() => expect(screen.getByText('First feature')).toBeInTheDocument());
        expect(loadChangelog).toHaveBeenCalledTimes(1);
        expect(loadChangelog).toHaveBeenCalledWith();
        expand();   // close
        expect(detailsOf(container).open).toBe(false);
        expand();   // reopen
        expect(detailsOf(container).open).toBe(true);
        expect(screen.getByText('First feature')).toBeInTheDocument();
        expect(loadChangelog).toHaveBeenCalledTimes(1);
    });
});

describe('Settings About > What\'s new — content', () => {
    it('expanding renders the section: ### headings as headings, items as list items', async () => {
        const { container } = render(ui());
        const d = await openWith(CL(BASIC), container);
        expect(d.open).toBe(true);
        await waitFor(() => expect(screen.getByText('First feature')).toBeInTheDocument());
        const added = screen.getByRole('heading', { name: 'Added' });
        expect(d.contains(added)).toBe(true);
        expect(screen.getByRole('heading', { name: 'Fixed' })).toBeInTheDocument();
        expect(screen.getByText('First feature').closest('li')).toBeTruthy();
        expect(screen.getByText('Second feature').closest('li')).toBeTruthy();
        expect(d.querySelectorAll('li').length).toBe(3);
    });

    it('shows only this version: no [Unreleased], no older version, no header line', async () => {
        const { container } = render(ui());
        const d = await openWith(CL(BASIC), container);
        await waitFor(() => expect(screen.getByText('First feature')).toBeInTheDocument());
        expect(d.textContent).not.toContain('unreleased item');
        expect(d.textContent).not.toContain('an older item');
        expect(d.textContent).not.toContain('2026-11-16');
    });

    it('inline markdown renders (bold, code)', async () => {
        const { container } = render(ui());
        const d = await openWith(CL('### Added\n\n- **Bold** and `code` here'), container);
        await waitFor(() => expect(d.querySelector('strong')).toBeTruthy());
        expect(d.querySelector('strong').textContent).toBe('Bold');
        expect(d.querySelector('code').textContent).toBe('code');
    });

    it('CRLF changelog text works the same', async () => {
        const { container } = render(ui());
        const d = await openWith(CL(BASIC).replace(/\n/g, '\r\n'), container);
        await waitFor(() => expect(screen.getByText('Second feature')).toBeInTheDocument());
        expect(d.querySelectorAll('li').length).toBe(3);
    });
});

describe('Settings About > What\'s new — sanitising', () => {
    it('strips <script> and inline event handlers from the changelog text', async () => {
        const evil = '### Added\n\n- ok item\n\n<script>window.__pwn = 1</script>\n\n<img src="x" onerror="window.__pwn = 2">\n\n<b onclick="window.__pwn = 3">bold</b>';
        const { container } = render(ui());
        const d = await openWith(CL(evil), container);
        await waitFor(() => expect(screen.getByText('ok item')).toBeInTheDocument());
        expect(d.querySelector('script')).toBeNull();
        expect(d.innerHTML).not.toMatch(/onerror/i);
        expect(d.innerHTML).not.toMatch(/onclick/i);
        expect(d.innerHTML).not.toContain('__pwn');
        expect(window.__pwn).toBeUndefined();
    });

    it('disallowed tags are dropped (iframe, style, form)', async () => {
        const { container } = render(ui());
        const d = await openWith(CL('- ok item\n\n<iframe src="https://evil.test"></iframe>\n\n<style>body{display:none}</style>'), container);
        await waitFor(() => expect(screen.getByText('ok item')).toBeInTheDocument());
        expect(d.querySelector('iframe')).toBeNull();
        expect(d.querySelector('style')).toBeNull();
    });
});

describe('Settings About > What\'s new — links', () => {
    const links = (d) => [...d.querySelectorAll('a')];
    const byText = (d, t) => links(d).find((a) => a.textContent === t);

    it.each([['http', 'http://example.com/a'], ['https', 'https://example.com/a'], ['mailto', 'mailto:me@example.com']])(
        '%s links keep href and get target=_blank + rel noopener noreferrer', async (_n, url) => {
            const { container } = render(ui());
            const d = await openWith(CL(`- see [the link](${url})`), container);
            await waitFor(() => expect(byText(d, 'the link')).toBeTruthy());
            const a = byText(d, 'the link');
            expect(a.getAttribute('href')).toBe(url);
            expect(a.getAttribute('target')).toBe('_blank');
            expect(a.getAttribute('rel')).toContain('noopener');
            expect(a.getAttribute('rel')).toContain('noreferrer');
        });

    it('an autolink / raw <a> without target gets target=_blank and rel too; a hostile target/rel is overwritten', async () => {
        const { container } = render(ui());
        const d = await openWith(CL('- <a href="https://example.com/raw" target="_self" rel="opener">raw</a> and <https://example.com/auto>'), container);
        await waitFor(() => expect(byText(d, 'raw')).toBeTruthy());
        for (const a of links(d)) {
            expect(a.getAttribute('target')).toBe('_blank');
            expect(a.getAttribute('rel')).toContain('noopener');
            expect(a.getAttribute('rel')).not.toMatch(/(^|\s)opener(\s|$)/);
        }
        expect(links(d).length).toBe(2);
    });

    it.each([
        ['javascript:', '[bad link](javascript:alert(1))'],
        ['relative', '[bad link](./docs/readme.md)'],
        ['root-relative', '[bad link](/etc/passwd)'],
        ['fragment', '[bad link](#added)'],
        ['file:', '[bad link](file:///etc/passwd)'],
        ['data:', '[bad link](data:text/html,x)'],
        ['raw <a javascript:>', '<a href="javascript:alert(1)">bad link</a>'],
    ])('%s link loses its href but keeps its text', async (_n, md) => {
        const { container } = render(ui());
        const d = await openWith(CL('- ' + md + ' tail'), container);
        await waitFor(() => expect(d.textContent).toContain('bad link'));
        for (const a of links(d)) {
            expect(a.hasAttribute('href')).toBe(false);
            expect(a.getAttribute('target')).not.toBe('_blank');
        }
        expect(d.textContent).toContain('bad link tail');
        expect(d.querySelector('[href]')).toBeNull();
    });

    it('safe and unsafe links side by side are handled independently', async () => {
        const { container } = render(ui());
        const d = await openWith(CL('- [good](https://example.com) [bad](javascript:alert(1))'), container);
        await waitFor(() => expect(byText(d, 'good')).toBeTruthy());
        expect(byText(d, 'good').getAttribute('href')).toBe('https://example.com/');
        expect(byText(d, 'bad') ? byText(d, 'bad').hasAttribute('href') : false).toBe(false);
        expect(d.textContent).toContain('bad');
    });
});

describe('Settings About > What\'s new — no section / failures', () => {
    it('loaded text has no section for this version: the <details> goes away, nothing else shown', async () => {
        const { container } = render(ui());
        loadChangelog.mockResolvedValue('# Changelog\n\n## [Unreleased]\n\n- only unreleased\n\n## [0.0.1] — 2020-01-01\n\n- old\n');
        expand();
        await waitFor(() => expect(detailsOf(container)).toBeNull());
        expect(summary()).toBeNull();
        expect(screen.queryByText(/only unreleased/)).toBeNull();
        expect(screen.queryByText(/Couldn't load/)).toBeNull();
    });

    it('a version that only exists under another spelling ([x.y.z-beta]) is no section', async () => {
        const { container } = render(ui());
        loadChangelog.mockResolvedValue(`## [${version}-beta] — 2020-01-01\n\n- beta only\n`);
        expand();
        await waitFor(() => expect(detailsOf(container)).toBeNull());
    });

    it('rejected loader: "Couldn\'t load the changelog." inside the open section, no crash', async () => {
        const { container } = render(ui());
        loadChangelog.mockRejectedValue(new Error('chunk failed'));
        expand();
        expect(await screen.findByText("Couldn't load the changelog.")).toBeInTheDocument();
        const d = detailsOf(container);
        expect(d).toBeTruthy();
        expect(d.open).toBe(true);
        expect(d.contains(screen.getByText("Couldn't load the changelog."))).toBe(true);
        expect(summary()).toBeInTheDocument();
    });

    it('synchronously throwing loader: same message, no crash', async () => {
        const { container } = render(ui());
        loadChangelog.mockImplementation(() => { throw new Error('boom'); });
        expand();
        expect(await screen.findByText("Couldn't load the changelog.")).toBeInTheDocument();
        expect(detailsOf(container)).toBeTruthy();
    });

    it('while loading nothing is rendered in the body (no error text, no headings)', () => {
        loadChangelog.mockReturnValue(new Promise(() => {}));
        const { container } = render(ui());
        expand();
        expect(loadChangelog).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Couldn't load the changelog.")).toBeNull();
        expect(detailsOf(container).querySelector('li')).toBeNull();
    });

    it('unmounting while the load is pending does not throw or warn', async () => {
        let resolve;
        loadChangelog.mockReturnValue(new Promise((r) => { resolve = r; }));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { unmount } = render(ui());
        expand();
        unmount();
        resolve(CL(BASIC));
        await new Promise((r) => setTimeout(r, 20));
        expect(err).not.toHaveBeenCalled();
    });
});
