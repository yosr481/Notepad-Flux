import { MERMAID_CONFIG } from './utils/mermaidConfig';

// Runs inside mermaid-frame.html (CSP: no images, fonts, connections or frames), so whatever Mermaid builds from
// document text cannot fetch anything. Talks to the app page by postMessage (see utils/mermaidBridge.js).
let theme = null;

const messageOf = (err) => String(err?.message ?? err);

export async function handleRenderMessage(engine, data) {
    const id = data?.id;
    if (typeof id !== 'string' || typeof data.source !== 'string') return { id, error: 'Invalid render request' };
    try {
        const t = data.theme ?? 'default';
        if (t !== theme) {
            engine.initialize({ ...MERMAID_CONFIG, theme: t });
            theme = t;
        }
        return { id, svg: (await engine.render(id, data.source)).svg };
    } catch (err) {
        // Mermaid leaves a scratch element behind on a failed render.
        document.getElementById('d' + id)?.remove();
        return { id, error: messageOf(err) };
    }
}

// Only when running as the frame page; inert in the app window and under tests.
if (window.parent !== window) {
    import('mermaid').then(({ default: engine }) => {
        window.addEventListener('message', async (e) => {
            if (e.source !== window.parent) return;
            window.parent.postMessage(await handleRenderMessage(engine, e.data), '*');
        });
        window.parent.postMessage({ type: 'ready' }, '*');
    });
}
