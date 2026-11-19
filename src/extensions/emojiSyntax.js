// Emoji shortcodes `:name:`. One scanner shared by the lezer parser below and the marked export extension.
// Rule: `:` + [a-zA-Z0-9_+-]+ + `:`, and no [a-zA-Z0-9] directly before the opening colon or after the closing one.
// Not lezer's built-in Emoji: that one can't read `:+1:` or `:t-rex:` and has no boundary rule.
const COLON = 58;
const NAME = /[a-zA-Z0-9_+-]/;
const ALNUM = /[a-zA-Z0-9]/;

// text[pos] is the opening colon. Returns { from, to, name } or null. Knows nothing about the table.
export function scanEmoji(text, pos) {
    if (text.charCodeAt(pos) !== COLON) return null;
    if (pos > 0 && ALNUM.test(text[pos - 1])) return null;
    let i = pos + 1;
    while (i < text.length && NAME.test(text[i])) i++;
    if (i === pos + 1 || text.charCodeAt(i) !== COLON) return null;
    if (i + 1 < text.length && ALNUM.test(text[i + 1])) return null;
    return { from: pos, to: i + 1, name: text.slice(pos + 1, i) };
}

// ponytail: names longer than this never match; the longest gemoji name is 40. Keeps each colon's scan O(1).
const MAX_NAME = 64;

function emoji(cx, next, start) {
    if (next !== COLON) return -1;
    const from = Math.max(cx.offset, start - 1);
    const hit = scanEmoji(cx.slice(from, Math.min(cx.end, start + MAX_NAME + 3)), start - from);
    return hit ? cx.addElement(cx.elt('Emoji', start, start + hit.to - hit.from)) : -1;
}

export const emojiSyntax = {
    defineNodes: [{ name: 'Emoji' }],
    parseInline: [{ name: 'Emoji', parse: emoji }],
};
