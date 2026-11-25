import { markdownLanguage } from "@codemirror/lang-markdown";

// This wrapper does two jobs: perf (amortised invalidation) and one rule change vs stock lezer (a bare
// shortcut `[x]` close keeps earlier `[` openers alive; see below). If upstream fixes the O(n²) re-walk,
// keep this wrapper anyway: the shortcut rule lives here.
//
// @lezer/markdown's LinkEnd (1.6 through 1.8.1) re-walks every earlier inline
// part of the paragraph after each link closes, to mark older "[" openers as
// invalid. That is O(parts) per link, so O(n²) per paragraph: a 1.3 MB paragraph
// with a link per line takes ~2 s to inline-parse, and the whole paragraph is
// re-parsed on every keystroke. This wrapper runs the stock LinkEnd on a view
// of the parts that starts at the matching opener (so its re-walk is empty)
// and does the invalidation itself with a per-paragraph cursor (amortised O(1)).
// The perf part leaves the tree identical; the rule change below does not (it changes the tree for every
// `[x] … ](…)` paragraph). Rule change vs stock: a link that closed as a bare shortcut `[x]` (ends right after its `]`) does not
// invalidate earlier openers, because lezer has no reference table and would otherwise kill the outer
// opener of `[a [b] c](url)`. Inline, full and collapsed links still do.
// ponytail: when `[b]` is a defined shortcut reference, CommonMark/marked make `[b]` the link and the outer
// text, but the editor shows the outer link. Fixing needs the definition table inside the inline parser.
const { parser } = markdownLanguage;
const stock = (name) => parser.inlineParsers[parser.inlineNames.indexOf(name)];
const stockLinkEnd = stock("LinkEnd");

// LinkStart / ImageStart delimiter types are private to lezer; capture them by
// letting the stock "[" and "![" parsers hand us the delimiter they create.
const delimiterType = (name, next) => {
    let type = null;
    stock(name)({ append: (d) => { type = d.type; return 0; }, char: () => 91 }, next, 0);
    return type;
};
const LinkStart = delimiterType("Link", 91);
const ImageStart = delimiterType("Image", 33);

// Per inline context: every LinkStart below this index is already invalidated.
const invalidatedUpTo = new WeakMap();

function linkEnd(cx, next, start) {
    if (next !== 93 /* ']' */) return -1;
    const { parts } = cx;
    let i = parts.length - 1;
    while (i >= 0 && !(parts[i] && (parts[i].type === LinkStart || parts[i].type === ImageStart))) i--;
    if (i < 0) return -1;

    const opener = parts[i];
    const view = Object.create(cx);   // stock code only writes `parts`; everything else reads through
    view.parts = parts.slice(i);
    const result = stockLinkEnd(view, next, start);
    parts.length = i;
    for (const p of view.parts) parts.push(p);

    let done = Math.min(invalidatedUpTo.get(cx) ?? 0, i);
    if (result > start + 1 && opener.type === LinkStart) {
        // CommonMark: no links inside links, so every earlier "[" is dead.
        for (let j = done; j < i; j++) if (parts[j] && parts[j].type === LinkStart) parts[j].side = 0;
        done = i;
    }
    invalidatedUpTo.set(cx, done);
    return result;
}

export const fastLinkEnd = { parseInline: [{ name: "LinkEnd", parse: linkEnd }] };
