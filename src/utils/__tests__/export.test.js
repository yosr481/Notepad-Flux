import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture what exportToHtml hands to the file layer without touching disk / pickers.
const exportFile = vi.fn();
vi.mock('../fileSystem', () => ({
    fileSystem: {
        exportFile: (...args) => exportFile(...args),
    },
}));

// marked is a real dependency and is exercised for real here.
import * as mod from '../export';
import { exportToHtml } from '../export';

const SENTINEL = Symbol('exportFile-return');

beforeEach(() => {
    exportFile.mockReset();
    exportFile.mockResolvedValue(SENTINEL);
});

// Grab the fullHtml string (first arg) from the single exportFile call.
const lastHtml = () => {
    expect(exportFile).toHaveBeenCalledTimes(1);
    return exportFile.mock.calls[0][0];
};

describe('exportToHtml — body sanitization (P0-3)', () => {
    // Load-bearing: current code interpolates raw marked() output, so raw HTML in the
    // markdown reaches fullHtml verbatim. These two fail until sanitizeHTML is wired in.
    it('produces no <script when markdown carries a raw script tag', async () => {
        await exportToHtml('doc', '<script>alert(1)</script>\n\nnormal text');
        expect(lastHtml()).not.toContain('<script');
    });

    it('strips a raw <img onerror> in the markdown down to a bare tag', async () => {
        await exportToHtml('doc', 'text\n\n<img src=x onerror=alert(1)>');
        const html = lastHtml();
        expect(html).not.toContain('onerror');
        expect(html).not.toContain('alert(1)');
    });

    // Contract-named payloads. marked already escapes these, so they are inert even
    // before the fix — kept as guards that the fix must not regress.
    it('keeps a backticked script literal inert (contract payload)', async () => {
        await exportToHtml('doc', '`<script>alert(1)</script>`');
        expect(lastHtml()).not.toContain('<script');
    });

    it('produces no javascript: href from a markdown link', async () => {
        await exportToHtml('doc', '[click](javascript:alert(1))');
        expect(lastHtml()).not.toContain('javascript:');
    });

    it('does not turn the malformed-image payload into an element with an event handler', async () => {
        // marked already renders `![x](x" onerror="alert(1))` as inert text, not an <img>.
        // The payload must never appear as an attribute inside a tag.
        await exportToHtml('doc', '![x](x" onerror="alert(1))');
        const html = lastHtml();
        expect(html).not.toMatch(/<[^>]*onerror/i);
    });

    it('keeps ordinary rendered markdown in the body', async () => {
        await exportToHtml('doc', '# Hello\n\nsome **bold** text');
        const html = lastHtml();
        expect(html).toContain('<h1>Hello</h1>');
        expect(html).toContain('<strong>bold</strong>');
    });
});

describe('exportToHtml — title escaping (P0-3)', () => {
    it('does not let a crafted title break out of the <title> element', async () => {
        await exportToHtml('</title><script>alert(1)</script>', 'body');
        const html = lastHtml();
        expect(html).not.toContain('<script');
        expect(html).not.toContain('</title><script');
    });

    it('escapes the five HTML metacharacters in the title', async () => {
        await exportToHtml(`a & b < c > d " e ' f`, 'body');
        const html = lastHtml();
        expect(html).toContain('a &amp; b &lt; c &gt; d');
        // the raw quote/angle characters from the title must not appear as markup
        expect(html).not.toContain('b < c');
        expect(html).not.toContain('c > d');
    });

    it('still uses the title text for the visible document title', async () => {
        await exportToHtml('My Notes', 'body');
        expect(lastHtml()).toContain('My Notes');
    });
});

describe('exportToHtml — return value & IO contract', () => {
    it('forwards whatever fileSystem.exportFile returns', async () => {
        const result = await exportToHtml('doc', 'body');
        expect(result).toBe(SENTINEL);
    });

    it('passes a string as the first argument to exportFile', async () => {
        await exportToHtml('doc', 'body');
        expect(typeof exportFile.mock.calls[0][0]).toBe('string');
    });

    it('calls exportFile with an .html suggested filename derived from the title', async () => {
        await exportToHtml('My Notes', 'body');
        expect(exportFile.mock.calls[0][1]).toBe('My_Notes.html');
    });
});

describe('export.js module surface', () => {
    it('still exports exportToHtml', () => {
        expect(typeof mod.exportToHtml).toBe('function');
    });

    it('no longer exports exportToPdf (dead code removed)', () => {
        expect(mod.exportToPdf).toBeUndefined();
    });
});
