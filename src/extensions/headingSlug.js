// Heading anchors shared by editor and export: GitHub-style slugs computed from the heading's source text.
// Inline syntax is reduced to visible text by regex (never rendered output), so both sides agree by construction.
const toVisibleText = (raw) => raw
    .replace(/\[\^[^\]\s]*\]/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g, '$1')
    .replace(/<[a-zA-Z/!][^>]*>/g, '')
    .replace(/(^|[^\p{L}\p{N}_])_+/gu, '$1') // emphasis `_` at a word edge; snake_case keeps its `_`
    .replace(/_+(?=$|[^\p{L}\p{N}_])/gu, '');

export const headingSlug = (raw) => toVisibleText(raw.replace(/\n[ \t]*/g, ' ')) // setext continuation lines join with one space
    .replace(/\s/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\-_ ]/gu, '')
    .replace(/^ +$/, '') // symbol-only heading: nothing left to anchor on
    .replace(/ /g, '-');

// Dedupe in call order like GitHub: x, x-1, x-2. An empty slug returns null and advances nothing.
export const createSlugger = () => {
    const used = new Set();
    const counts = new Map();
    return {
        slug(raw) {
            const base = headingSlug(raw);
            if (!base) return null;
            let s = base;
            let n = counts.get(base) ?? 0;
            while (used.has(s)) s = `${base}-${++n}`;
            counts.set(base, n);
            used.add(s);
            return s;
        },
    };
};
