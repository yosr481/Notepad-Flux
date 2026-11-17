// Sub/superscript for marked: the rules of @lezer/markdown's Subscript/Superscript (parseSubSuper), which the
// editor uses. `~`/`^` opens unless doubled; the closer is the next unescaped same marker with no whitespace
// before it. Content is not re-parsed.
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// marked's GFM strikethrough rule, for `~~` only.
const DEL = /^~~(?=[^\s~])(?:\\.|[^\\])*?(?:\\.|[^\s~\\])~~(?=[^~]|$)/;
const TAGS = { '~': 'sub', '^': 'sup' };

// text[0] is the marker: returns { end, content } (end = index after the closer) or null.
export function scanSubSup(text) {
    const ch = text[0];
    if (!TAGS[ch] || text[1] === ch) return null;
    for (let i = 1; i < text.length; i++) {
        const c = text[i];
        if (c === ch) return { end: i + 1, content: text.slice(1, i) };
        if (c === '\\') i++;
        else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') return null;
    }
    return null;
}

const unescape = (s) => s.replace(/\\([\s\S])/g, (m, c) => (c === ' ' ? ' ' : /[!-/:-@[-`{-~]/.test(c) ? c : m));

export const subSupExtension = {
    extensions: [{
        name: 'subSup',
        level: 'inline',
        start: (src) => { const i = src.search(/[~^]/); return i < 0 ? undefined : i; },
        tokenizer(src) {
            // lezer never opens a subscript inside a run of 2+ tildes (strikethrough delimiters own it). Unless
            // strikethrough matches here, take the whole run as text so marked doesn't re-start mid-run.
            const run = /^~{2,}/.exec(src);
            if (run) return DEL.test(src) ? undefined : { type: 'text', raw: run[0], text: run[0] };
            const hit = scanSubSup(src);
            return hit && { type: 'subSup', raw: src.slice(0, hit.end), tag: TAGS[src[0]], text: unescape(hit.content) };
        },
        renderer: (t) => `<${t.tag}>${escapeHtml(t.text)}</${t.tag}>`,
    }],
    // Single `~a~` is subscript now; only `~~a~~` stays strikethrough. Returning false keeps marked's own rule.
    tokenizer: { del: (src) => (src.startsWith('~~') ? false : undefined) },
};
