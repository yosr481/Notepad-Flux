// Owns one hidden same-origin iframe (mermaid-frame.html) where Mermaid runs under a CSP that blocks every fetch,
// and talks to it by postMessage: { id, source, theme } -> { id, svg } | { id, error }.
const TIMEOUT = 15000;

export function createMermaidFrame() {
    let el = null;
    let ready = null; // { promise, resolve } for the current iframe
    const pending = new Map(); // id -> settle(result)

    const drop = (reason) => {
        el?.remove();
        el = null;
        ready = null;
        for (const settle of [...pending.values()]) settle({ error: reason });
    };

    const onMessage = (e) => {
        const d = e.data;
        if (!el || e.source !== el.contentWindow || !d || typeof d !== 'object') return;
        if (d.type === 'ready') return ready?.resolve();
        const settle = pending.get(d.id);
        if (settle && (typeof d.svg === 'string' || typeof d.error === 'string')) {
            settle(d.svg !== undefined ? { svg: d.svg } : { error: d.error });
        }
    };

    window.addEventListener('message', onMessage);

    const create = () => {
        const f = document.createElement('iframe');
        f.src = './mermaid-frame.html';
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        // Off-screen but with a real size: Mermaid measures text, so never display:none.
        Object.assign(f.style, { position: 'fixed', left: '-10000px', top: '0', width: '1200px', height: '800px', border: '0' });
        ready = Promise.withResolvers();
        el = f;
        document.body.appendChild(f);
    };

    const render = (id, source, theme) => new Promise((resolve) => {
        if (!el) create();
        const f = el;
        const timer = setTimeout(() => {
            settle({ error: 'Diagram renderer timed out' });
            // Mermaid queues renders inside the frame, so a hung one would stall every later call: replace the frame.
            if (el === f) drop('Diagram renderer timed out');
        }, TIMEOUT);
        const settle = (r) => { clearTimeout(timer); pending.delete(id); resolve(r); };
        pending.set(id, settle);
        ready.promise.then(() => {
            if (el !== f || !pending.has(id)) return;
            // '*': under file:// the frame's origin is 'null', so no exact origin can be named. Safe: every
            // message is gated by event.source (both directions) and only diagram source/svg travels.
            f.contentWindow.postMessage({ id, source, theme }, '*');
        });
    });

    return { render };
}
