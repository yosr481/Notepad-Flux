// Callout header rules, Docs/internal/callouts-spec.md ("Syntax", types table). Pure: shared by the editor
// extension and the export renderer, like footnoteSyntax.js. lineText is the blockquote's first line after
// the quote marker and its one space.

// Canonical type -> display data. Colour and icon follow the canonical type.
export const CALLOUT_TYPES = {
    note: { icon: 'pencil' },
    abstract: { icon: 'clipboard-list' },
    info: { icon: 'info' },
    todo: { icon: 'circle-check' },
    tip: { icon: 'flame' },
    important: { icon: 'circle-alert' },
    success: { icon: 'check' },
    question: { icon: 'circle-help' },
    warning: { icon: 'triangle-alert' },
    caution: { icon: 'octagon-alert' },
    failure: { icon: 'x' },
    danger: { icon: 'zap' },
    bug: { icon: 'bug' },
    example: { icon: 'list' },
    quote: { icon: 'quote' },
};

// Alias (lowercase) -> canonical type. Anything else is unknown and renders as note.
const CALLOUT_ALIASES = {
    summary: 'abstract', tldr: 'abstract', hint: 'tip', check: 'success', done: 'success',
    help: 'question', faq: 'question', attention: 'warning', fail: 'failure', missing: 'failure',
    error: 'danger', cite: 'quote',
};

const CALLOUT_HEADER = /^\[!([A-Za-z0-9_-]{1,50})\]([-+]?)/;

// Returns { type, canonical, fold, title, markEnd } or null. markEnd is the index just after "]" and the
// fold char; the title is the rest of the line, trimmed ('' when none).
export function scanCallout(lineText) {
    const m = CALLOUT_HEADER.exec(lineText);
    if (!m) return null;
    const type = m[1];
    const key = type.toLowerCase();
    const aliased = Object.hasOwn(CALLOUT_ALIASES, key) ? CALLOUT_ALIASES[key] : key;
    const canonical = Object.hasOwn(CALLOUT_TYPES, aliased) ? aliased : 'note';
    const markEnd = m[0].length;
    return { type, canonical, fold: m[2], title: lineText.slice(markEnd).trim(), markEnd };
}

// Shown title: the written title when present, else the type as written with its first letter capitalised.
export function calloutTitle(scan) {
    if (scan.title) return scan.title;
    return scan.type.charAt(0).toUpperCase() + scan.type.slice(1).toLowerCase();
}
