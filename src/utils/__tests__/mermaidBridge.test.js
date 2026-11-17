import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMermaidFrame } from '../mermaidBridge';

// Spec: Docs/internal/mermaid-spec.md ("Security"). The bridge owns ONE hidden same-origin iframe (mermaid-frame.html, where Mermaid
// runs under a CSP that blocks every fetch) and talks to it by postMessage. jsdom fakes the frame: we dispatch MessageEvents on window
// with `source` = the iframe's contentWindow (the real frame) or `window` (an impostor), and spy on contentWindow.postMessage.
// Pinned (spec silent): the iframe is created lazily by the first render() (not by createMermaidFrame()); timeout 15000 ms counted from the
// render() call and covering the wait for `ready`; after ANY timeout (before or after `ready`) the iframe is removed and the next render() creates a fresh one.
// There is no iframe `error` event path (iframes don't fire it). The postMessage payload is exactly { id, source, theme } (targetOrigin not pinned).
const TIMEOUT = 15000;
const iframes = () => [...document.querySelectorAll('iframe')];
const frameEl = () => iframes()[0];
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

const send = (data, source) => window.dispatchEvent(new MessageEvent('message', { data, source }));
// Wait for the iframe to exist, spy on its postMessage, return helpers acting as the frame.
const frameOf = async () => {
    await vi.waitFor(() => expect(frameEl()).toBeTruthy());
    const el = frameEl();
    const win = el.contentWindow;
    const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {});
    return { el, win, post, ready: () => send({ type: 'ready' }, win), reply: (m) => send(m, win) };
};

beforeEach(() => { iframes().forEach((f) => f.remove()); });
afterEach(() => { vi.useRealTimers(); iframes().forEach((f) => f.remove()); });

describe('createMermaidFrame: the iframe', () => {
    it('createMermaidFrame() alone creates nothing; the first render() creates exactly one iframe, reused after', async () => {
        const frame = createMermaidFrame();
        expect(typeof frame.render).toBe('function');
        expect(iframes()).toHaveLength(0);
        const p1 = frame.render('nf-mermaid-1', 'graph A', 'default');
        const f = await frameOf();
        f.ready(); await flush();
        f.reply({ id: 'nf-mermaid-1', svg: '<svg/>' });
        await p1;
        const p2 = frame.render('nf-mermaid-2', 'graph B', 'default');
        await flush();
        f.reply({ id: 'nf-mermaid-2', svg: '<svg/>' });
        await p2;
        expect(iframes()).toHaveLength(1);
        expect(frameEl()).toBe(f.el);
    });

    it('src is mermaid-frame.html relative to the page; sandbox is allow-scripts allow-same-origin and nothing else', async () => {
        const frame = createMermaidFrame();
        frame.render('i', 's', 'default');
        const { el } = await frameOf();
        expect(el.src.endsWith('/mermaid-frame.html') || el.getAttribute('src') === './mermaid-frame.html' || el.getAttribute('src') === 'mermaid-frame.html').toBe(true);
        expect(new Set(el.getAttribute('sandbox').trim().split(/\s+/))).toEqual(new Set(['allow-scripts', 'allow-same-origin']));
    });

    it('attached to document.body, hidden from AT and focus, off-screen with a real size (never display:none: layout needs it)', async () => {
        const frame = createMermaidFrame();
        frame.render('i', 's', 'default');
        const { el } = await frameOf();
        expect(el.parentElement).toBe(document.body);
        expect(el.getAttribute('aria-hidden')).toBe('true');
        expect(el.getAttribute('tabindex')).toBe('-1');
        expect(el.style.display).not.toBe('none');
        expect(['fixed', 'absolute']).toContain(el.style.position);
        expect(parseInt(el.style.left, 10) < 0 || parseInt(el.style.top, 10) < 0).toBe(true);
        expect(parseInt(el.style.width, 10)).toBeGreaterThan(100);
        expect(parseInt(el.style.height, 10)).toBeGreaterThan(100);
    });
});

describe('createMermaidFrame: protocol', () => {
    it('waits for { type: "ready" } from the frame, then posts exactly { id, source, theme }', async () => {
        const frame = createMermaidFrame();
        frame.render('nf-mermaid-7', 'graph TD; A-->B', 'dark');
        const f = await frameOf();
        await flush();
        expect(f.post).not.toHaveBeenCalled();
        f.ready(); await flush();
        expect(f.post).toHaveBeenCalledTimes(1);
        expect(f.post.mock.calls[0][0]).toEqual({ id: 'nf-mermaid-7', source: 'graph TD; A-->B', theme: 'dark' });
    });

    it('resolves { svg } on the matching reply and { error } on an error reply (exact shapes)', async () => {
        const frame = createMermaidFrame();
        const p = frame.render('a', 's', 'default');
        const f = await frameOf(); f.ready(); await flush();
        f.reply({ id: 'a', svg: '<svg>ok</svg>' });
        expect(await p).toEqual({ svg: '<svg>ok</svg>' });
        const q = frame.render('b', 's', 'default'); await flush();
        f.reply({ id: 'b', error: 'Parse error on line 2' });
        expect(await q).toEqual({ error: 'Parse error on line 2' });
    });

    it('a second render after ready does not wait for another ready', async () => {
        const frame = createMermaidFrame();
        const p = frame.render('a', 's', 'default');
        const f = await frameOf(); f.ready(); await flush();
        f.reply({ id: 'a', svg: '<svg/>' }); await p;
        frame.render('b', 's2', 'dark'); await flush();
        expect(f.post).toHaveBeenCalledTimes(2);
        expect(f.post.mock.calls[1][0]).toEqual({ id: 'b', source: 's2', theme: 'dark' });
    });

    it('ignores a ready and a reply whose event.source is not the frame window', async () => {
        const frame = createMermaidFrame();
        let settled = false;
        const p = frame.render('a', 's', 'default').then((r) => { settled = true; return r; });
        const f = await frameOf();
        send({ type: 'ready' }, window); await flush();
        expect(f.post).not.toHaveBeenCalled(); // impostor ready ignored
        f.ready(); await flush();
        send({ id: 'a', svg: '<svg>EVIL</svg>' }, window); // impostor reply
        send({ id: 'a', svg: '<svg>EVIL</svg>' }, null);
        await flush();
        expect(settled).toBe(false);
        f.reply({ id: 'a', svg: '<svg>good</svg>' });
        expect(await p).toEqual({ svg: '<svg>good</svg>' });
    });

    it('ignores replies whose id does not match; concurrent renders each get their own reply, in any order', async () => {
        const frame = createMermaidFrame();
        const p1 = frame.render('one', 's1', 'default');
        const p2 = frame.render('two', 's2', 'default');
        const f = await frameOf(); f.ready(); await flush();
        f.reply({ id: 'nope', svg: '<svg>X</svg>' });
        f.reply({ id: 'two', svg: '<svg>2</svg>' });
        f.reply({ id: 'one', error: 'e1' });
        expect(await p2).toEqual({ svg: '<svg>2</svg>' });
        expect(await p1).toEqual({ error: 'e1' });
    });

    it('ignores non-object and unrelated messages (no throw, no settle)', async () => {
        const frame = createMermaidFrame();
        let settled = false;
        const p = frame.render('a', 's', 'default').then((r) => { settled = true; return r; });
        const f = await frameOf(); f.ready(); await flush();
        for (const d of [null, undefined, 'str', 42, {}, { type: 'other' }, { id: 'a' }]) f.reply(d);
        await flush();
        expect(settled).toBe(false);
        f.reply({ id: 'a', svg: '<svg/>' });
        await p;
    });
});

describe('createMermaidFrame: failure', () => {
    it(`per-call timeout (${TIMEOUT} ms): no ready at all resolves { error }`, async () => {
        vi.useFakeTimers();
        const frame = createMermaidFrame();
        let out;
        frame.render('a', 's', 'default').then((r) => { out = r; });
        await vi.advanceTimersByTimeAsync(TIMEOUT - 1);
        expect(out).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        expect(out.error).toBeTypeOf('string');
        expect(out.error.length).toBeGreaterThan(0);
        expect(out.svg).toBeUndefined();
    });

    it('per-call timeout: ready but no reply resolves { error }; a late reply is ignored without throwing', async () => {
        vi.useFakeTimers();
        const frame = createMermaidFrame();
        let out;
        frame.render('a', 's', 'default').then((r) => { out = r; });
        await vi.waitFor(() => expect(frameEl()).toBeTruthy());
        const win = frameEl().contentWindow;
        vi.spyOn(win, 'postMessage').mockImplementation(() => {});
        send({ type: 'ready' }, win);
        await vi.advanceTimersByTimeAsync(TIMEOUT);
        expect(out.error).toBeTypeOf('string');
        expect(() => send({ id: 'a', svg: '<svg/>' }, win)).not.toThrow();
        expect(out.svg).toBeUndefined();
    });

    it('ANY timeout drops the frame (even one that was ready): the next render removes it and gets a fresh iframe, so a hung render cannot wedge later calls', async () => {
        vi.useFakeTimers();
        const frame = createMermaidFrame();
        let out;
        frame.render('a', 's', 'default').then((r) => { out = r; });
        await vi.waitFor(() => expect(frameEl()).toBeTruthy());
        const hung = frameEl();
        const w1 = hung.contentWindow;
        vi.spyOn(w1, 'postMessage').mockImplementation(() => {});
        send({ type: 'ready' }, w1);
        await vi.advanceTimersByTimeAsync(TIMEOUT);
        expect(out.error).toBeTypeOf('string');

        const p = frame.render('b', 's2', 'default');
        await vi.waitFor(() => expect(iframes().some((f) => f !== hung)).toBe(true));
        expect(iframes()).toHaveLength(1);
        expect(hung.isConnected).toBe(false);
        const w2 = frameEl().contentWindow;
        const post = vi.spyOn(w2, 'postMessage').mockImplementation(() => {});
        send({ type: 'ready' }, w2);
        await vi.advanceTimersByTimeAsync(0);
        expect(post.mock.calls[0][0]).toEqual({ id: 'b', source: 's2', theme: 'default' });
        send({ id: 'a', svg: '<svg>LATE from the dropped frame</svg>' }, w1); // dead frame's late reply: ignored
        send({ id: 'b', svg: '<svg>fresh</svg>' }, w2);
        expect(await p).toEqual({ svg: '<svg>fresh</svg>' });
    });

    it('the timeout clock does not fire after a timely reply (no stray error, resolved value kept)', async () => {
        vi.useFakeTimers();
        const frame = createMermaidFrame();
        const p = frame.render('a', 's', 'default');
        await vi.waitFor(() => expect(frameEl()).toBeTruthy());
        const win = frameEl().contentWindow;
        vi.spyOn(win, 'postMessage').mockImplementation(() => {});
        send({ type: 'ready' }, win);
        await vi.advanceTimersByTimeAsync(10);
        send({ id: 'a', svg: '<svg>ok</svg>' }, win);
        expect(await p).toEqual({ svg: '<svg>ok</svg>' });
        await vi.advanceTimersByTimeAsync(TIMEOUT * 2);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a load failure (timeout before ready) resolves { error }; the next render removes the dead iframe and creates a fresh one that works', async () => {
        vi.useFakeTimers();
        const frame = createMermaidFrame();
        let out;
        frame.render('a', 's', 'default').then((r) => { out = r; });
        await vi.waitFor(() => expect(frameEl()).toBeTruthy());
        const dead = frameEl();
        await vi.advanceTimersByTimeAsync(TIMEOUT);
        expect(out.error).toBeTypeOf('string');

        const p = frame.render('b', 's2', 'default');
        await vi.waitFor(() => expect(iframes().some((f) => f !== dead)).toBe(true));
        expect(iframes()).toHaveLength(1);
        expect(dead.isConnected).toBe(false);
        const win = frameEl().contentWindow;
        const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {});
        send({ type: 'ready' }, win);
        await vi.advanceTimersByTimeAsync(0);
        expect(post.mock.calls[0][0]).toEqual({ id: 'b', source: 's2', theme: 'default' });
        send({ id: 'b', svg: '<svg>fresh</svg>' }, win);
        expect(await p).toEqual({ svg: '<svg>fresh</svg>' });
    });
});
