import { markdownLanguage } from "@codemirror/lang-markdown";

// @lezer/markdown's LinkEnd (1.6 through 1.8.1) re-walks every earlier inline
// part of the paragraph after each link closes, to mark older "[" openers as
// invalid. That is O(parts) per link, so O(n²) per paragraph: a 1.3 MB paragraph
// with a link per line takes ~2 s to inline-parse, and the whole paragraph is
// re-parsed on every keystroke. This wrapper runs the stock LinkEnd on a view
// of the parts that starts at the matching opener (so its re-walk is empty)
// and does the invalidation itself with a per-paragraph cursor (amortised O(1)).
// The output tree is identical; only the bookkeeping changes.
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
    if (result >= 0 && opener.type === LinkStart) {
        // CommonMark: no links inside links, so every earlier "[" is dead.
        for (let j = done; j < i; j++) if (parts[j] && parts[j].type === LinkStart) parts[j].side = 0;
        done = i;
    }
    invalidatedUpTo.set(cx, done);
    return result;
}

export const fastLinkEnd = { parseInline: [{ name: "LinkEnd", parse: linkEnd }] };
