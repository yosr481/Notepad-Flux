// Sub/superscript for marked: the rules of @lezer/markdown's Subscript/Superscript (parseSubSuper), which the
// editor uses. `~`/`^` opens unless doubled; the closer is the next unescaped same marker with no whitespace
// before it. Content is not re-parsed.
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
        // marked passes the tokens emitted so far; the previous source char is the end of the last one's raw.
        // lezer's Strikethrough owns `~~` runs, so a `~` right after a swallowed text `~` never opens a subscript
        // (`^` does; a finished sub/sup token never blocks, so `H~2~~3~` is two subscripts).
        tokenizer(src, tokens) {
            const hit = scanSubSup(src); // first: reading the last token's raw on every call is O(n^2)
            if (!hit || (src[0] === '~' && tokens.at(-1)?.type === 'text' && tokens.at(-1).raw.endsWith('~'))) return undefined;
            return { type: 'subSup', raw: src.slice(0, hit.end), tag: TAGS[src[0]], text: unescape(hit.content) };
        },
        renderer: (t) => `<${t.tag}>${escapeHtml(t.text)}</${t.tag}>`,
    }],
    // Single `~a~` is subscript now; only `~~a~~` stays strikethrough. Returning false keeps marked's own rule.
    tokenizer: { del: (src) => (src.startsWith('~~') ? false : undefined) },
};
