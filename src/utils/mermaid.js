import DOMPurify from 'dompurify';
import { createMermaidFrame } from './mermaidBridge';

export { MERMAID_CONFIG } from './mermaidConfig';

let frame = null;
let loaded = false;
let chain = Promise.resolve();
let counter = 0;
const cache = new Map();
const CACHE_LIMIT = 100;

export const isMermaidLoaded = () => loaded;

// The app CSP has img-src *, so any non-local url() in CSS is a network request on open.
// ponytail: rule is "drop the whole ;{} segment"; over-drops rare legit CSS with escapes. Parse CSS if that bites.
const LOCAL_URL = /url\(\s*#[^)]*\)/gi;
const FETCHER = /(?:url|src|attr|image|image-set|cross-fade|element)\s*\(|@import/i;
const hasFetcher = (v) => FETCHER.test(v.replace(LOCAL_URL, ''));

const cleanCss = (css) => css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Segments between ; { }; quoted strings and (...) are atomic so url(data:...;base64,...) stays whole.
    .replace(/(?:"[^"]*"|'[^']*'|\([^)]*(?:\)|$)|[^;{}"'(])+/g, (seg) => (seg.includes('\\') || hasFetcher(seg) ? '' : seg));

export function sanitizeMermaidSvg(svg) {
    const body = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true },
        FORBID_TAGS: ['foreignObject', 'image', 'script'],
        ADD_TAGS: ['style', 'use'],
        RETURN_DOM: true,
    });
    // A `click` node is wrapped in <a> that carries the node's translate(); dropping the <a> moved the node to
    // the origin. Keep the wrapper as an inert <g> with every attribute but the link ones.
    for (const a of body.querySelectorAll('a')) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (const { name, value } of a.attributes) if (!/href$|^target$/i.test(name)) g.setAttribute(name, value);
        g.append(...a.childNodes);
        a.replaceWith(g);
    }
    for (const el of body.querySelectorAll('*')) {
        if (el.localName === 'style') el.textContent = cleanCss(el.textContent);
        for (const { name, value } of [...el.attributes]) {
            if (/href$/i.test(name)) {
                if (!value.trim().startsWith('#')) el.removeAttribute(name);
            } else if (name === 'style') {
                el.setAttribute(name, cleanCss(value));
            } else if (hasFetcher(value)) {
                el.removeAttribute(name);
            }
        }
    }
    return body.innerHTML;
}

const messageOf = (err) => String(err?.message ?? err);

const renderNow = async (source, theme) => {
    const key = theme + '\0' + source;
    const hit = cache.get(key);
    if (hit) {
        const next = `nf-mermaid-${++counter}`;
        return { svg: hit.svg.replace(new RegExp(`${hit.id}(?!\\d)`, 'g'), next) };
    }
    const id = `nf-mermaid-${++counter}`;
    try {
        frame ??= createMermaidFrame();
        const out = await frame.render(id, source, theme);
        if (out.error !== undefined) return { error: out.error };
        loaded = true;
        const svg = sanitizeMermaidSvg(out.svg);
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
        cache.set(key, { svg, id });
        return { svg };
    } catch (err) {
        // Not cached: a failure may be transient.
        return { error: messageOf(err) };
    }
};

// Mermaid source -> { svg } (sanitized) | { error }. Never rejects; renders run one at a time.
export function renderMermaid(source, { theme = 'default' } = {}) {
    const p = chain.then(() => renderNow(source, theme));
    chain = p;
    return p;
}
