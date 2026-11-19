import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Frame-side of the Mermaid sandbox (spec "Security"). The module's top-level wiring (import('mermaid'), message listener, posting
// `ready`) is e2e-only; here only handleRenderMessage(engine, data) with a mocked engine. The mock keeps the real wiring inert.
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));

const root = resolve(__dirname, '../..');
const mkEngine = () => ({ initialize: vi.fn(), render: vi.fn(async (id) => ({ svg: `<svg id="${id}"/>` })) });
// Fresh module each test: the "theme already initialized" memory is module state.
const load = async () => { vi.resetModules(); return import('../mermaidFrame'); };
const cfg = async () => (await import('../utils/mermaidConfig')).MERMAID_CONFIG;

describe('handleRenderMessage', () => {
    let handleRenderMessage;
    beforeEach(async () => { ({ handleRenderMessage } = await load()); });

    it('initializes with MERMAID_CONFIG plus theme, renders (id, source) with exactly those two args, returns { id, svg } verbatim', async () => {
        const e = mkEngine();
        const out = await handleRenderMessage(e, { id: 'nf-mermaid-1', source: 'graph TD; A-->B', theme: 'dark' });
        expect(e.initialize).toHaveBeenCalledWith({ ...(await cfg()), theme: 'dark' });
        expect(e.render).toHaveBeenCalledWith('nf-mermaid-1', 'graph TD; A-->B');
        expect(out).toEqual({ id: 'nf-mermaid-1', svg: '<svg id="nf-mermaid-1"/>' });
    });

    it('does not re-initialize while the theme stays the same; re-initializes before the render when it changes', async () => {
        const e = mkEngine();
        await handleRenderMessage(e, { id: 'a', source: 's', theme: 'default' });
        await handleRenderMessage(e, { id: 'b', source: 's', theme: 'default' });
        expect(e.initialize).toHaveBeenCalledTimes(1);
        await handleRenderMessage(e, { id: 'c', source: 's', theme: 'dark' });
        expect(e.initialize).toHaveBeenCalledTimes(2);
        expect(e.initialize.mock.calls[1][0].theme).toBe('dark');
        expect(e.initialize.mock.invocationCallOrder[1]).toBeLessThan(e.render.mock.invocationCallOrder[2]);
    });

    it('a missing theme means "default"', async () => {
        const e = mkEngine();
        await handleRenderMessage(e, { id: 'a', source: 's' });
        expect(e.initialize.mock.calls[0][0].theme).toBe('default');
    });

    it('engine rejection (Error, string, { message }) -> { id, error } text, never throws', async () => {
        const e = mkEngine();
        e.render.mockRejectedValueOnce(new Error('Parse error on line 2'));
        expect(await handleRenderMessage(e, { id: 'a', source: 's', theme: 'default' })).toEqual({ id: 'a', error: 'Parse error on line 2' });
        e.render.mockRejectedValueOnce('plain');
        expect(await handleRenderMessage(e, { id: 'b', source: 's', theme: 'default' })).toEqual({ id: 'b', error: 'plain' });
        e.render.mockRejectedValueOnce({ message: 'obj' });
        expect(await handleRenderMessage(e, { id: 'c', source: 's', theme: 'default' })).toEqual({ id: 'c', error: 'obj' });
    });

    it('initialize throwing, or render throwing synchronously, also gives { id, error }', async () => {
        const e = mkEngine();
        e.initialize.mockImplementationOnce(() => { throw new Error('init boom'); });
        expect(await handleRenderMessage(e, { id: 'a', source: 's', theme: 'default' })).toEqual({ id: 'a', error: 'init boom' });
        e.render.mockImplementationOnce(() => { throw new Error('sync boom'); });
        expect(await handleRenderMessage(e, { id: 'b', source: 's', theme: 'default' })).toEqual({ id: 'b', error: 'sync boom' });
    });

    it('malformed messages never throw and yield a string error', async () => {
        const e = mkEngine();
        for (const d of [null, undefined, 'str', 42, {}, { id: 'a' }, { id: 'a', source: 42 }]) {
            const out = await handleRenderMessage(e, d);
            expect(out.error, JSON.stringify(d)).toBeTypeOf('string');
            expect(out.svg).toBeUndefined();
        }
        expect(e.render).not.toHaveBeenCalled();
    });

    it('a failed render removes Mermaid\'s scratch element d<id> from this (the frame) document', async () => {
        const e = mkEngine();
        const scratch = document.createElement('div');
        scratch.id = 'dnf-mermaid-9';
        document.body.appendChild(scratch);
        e.render.mockRejectedValueOnce(new Error('x'));
        await handleRenderMessage(e, { id: 'nf-mermaid-9', source: 's', theme: 'default' });
        expect(document.getElementById('dnf-mermaid-9')).toBeNull();
    });
});

describe('mermaid-frame.html and the build', () => {
    const html = readFileSync(resolve(root, 'mermaid-frame.html'), 'utf8');

    it('CSP meta is exactly default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\' (no img/font/connect/frame)', () => {
        const m = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]*)"/i);
        expect(m).not.toBeNull();
        expect(m[1].trim().replace(/;$/, '')).toBe("default-src 'none'; script-src 'self'; style-src 'unsafe-inline'");
    });

    it('loads src/mermaidFrame.js as the only script, a module (no inline script: the CSP would block it)', () => {
        const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((x) => x[0]);
        expect(scripts).toHaveLength(1);
        expect(scripts[0]).toMatch(/type=["']module["']/);
        expect(scripts[0]).toMatch(/src=["'][^"']*src\/mermaidFrame\.js["']/);
        expect(html).not.toMatch(/<script\b[^>]*>[^<]*\S[^<]*<\/script>/i); // nothing but whitespace between <script> and </script>
    });

    it('vite.config.js builds mermaid-frame.html as a second input next to index.html', () => {
        const cfgText = readFileSync(resolve(root, 'vite.config.js'), 'utf8');
        expect(cfgText).toContain('mermaid-frame.html');
        expect(cfgText).toMatch(/input/);
        expect(cfgText).toContain('index.html');
    });
});
