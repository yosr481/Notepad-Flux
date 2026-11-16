import DOMPurify from 'dompurify';

let engine = null;
const cache = new Map();
const CACHE_LIMIT = 500;

export const isMathLoaded = () => engine !== null && !(engine instanceof Promise);

const loadEngine = () => {
    if (!engine) {
        // A failed load is forgotten, so the next render tries again.
        engine = import('./mathjax.js').then((m) => (engine = m), (err) => { engine = null; throw err; });
    }
    return engine instanceof Promise ? engine : Promise.resolve(engine);
};

// SVG only: MathJax output is paths, rects and text. Anything else (links, scripts, handlers,
// foreignObject) is dropped even if a TeX package ever emitted it.
const sanitizeSvg = (svg) => DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ['a', 'foreignObject', 'use', 'image', 'script', 'style'],
    // data-latex echoes the source; drop it and MathJax's other bookkeeping (keep data-mjx-error).
    FORBID_ATTR: ['href', 'xlink:href', 'data-latex', 'data-mml-node', 'data-c'],
});

// TeX -> sanitized <svg> markup. Invalid TeX gives MathJax's error rendering, never a throw.
export async function renderTex(tex, { display = false } = {}) {
    const key = (display ? 'D' : 'I') + tex;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    let svg;
    try {
        const { texToSvg } = await loadEngine();
        svg = sanitizeSvg(await texToSvg(tex, display));
    } catch (err) {
        console.error('Math render failed:', err);
        // Not cached: a load failure may be transient.
        return sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" data-mjx-error="${String(err.message || err).replace(/[<>"&]/g, '')}"><text y="12" fill="red">${tex.replace(/[<>&]/g, '')}</text></svg>`);
    }
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, svg);
    return svg;
}
