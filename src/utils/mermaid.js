import DOMPurify from 'dompurify';

// Fixed, document-proof settings. `secure` makes Mermaid ignore these keys in a %%{init}%% directive.
export const MERMAID_CONFIG = {
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize',
        'themeCSS', 'themeVariables', 'fontFamily', 'htmlLabels', 'flowchart'],
};

let engine = null;
let currentTheme = null;
let chain = Promise.resolve();
let counter = 0;
const cache = new Map();
const CACHE_LIMIT = 100;

export const isMermaidLoaded = () => engine !== null && !(engine instanceof Promise);

const loadEngine = () => {
    if (!engine) {
        // A failed load is forgotten, so the next render tries again.
        engine = import('mermaid').then((m) => { currentTheme = null; return (engine = m.default); },
            (err) => { engine = null; throw err; });
    }
    return engine instanceof Promise ? engine : Promise.resolve(engine);
};

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
        FORBID_TAGS: ['a', 'foreignObject', 'image', 'script'],
        ADD_TAGS: ['style', 'use'],
        RETURN_DOM: true,
    });
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
    if (hit) return hit;
    const id = `nf-mermaid-${++counter}`;
    try {
        const m = await loadEngine();
        if (theme !== currentTheme) {
            m.initialize({ ...MERMAID_CONFIG, theme });
            currentTheme = theme;
        }
        const out = { svg: sanitizeMermaidSvg((await m.render(id, source)).svg) };
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
        cache.set(key, out);
        return out;
    } catch (err) {
        // Mermaid leaves a scratch element behind on a failed render.
        document.getElementById('d' + id)?.remove();
        // Not cached: a load failure may be transient.
        return { error: messageOf(err) };
    }
};

// Mermaid source -> { svg } (sanitized) | { error }. Never rejects; renders run one at a time.
export function renderMermaid(source, { theme = 'default' } = {}) {
    const p = chain.then(() => renderNow(source, theme));
    chain = p;
    return p;
}
