import { EditorView, Decoration } from "@codemirror/view";
import { StateField, RangeSet, RangeValue } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isCursorTouching } from "./selection";
import { decodeAttrEntities } from "./entities";

export const SAFE_INLINE_HTML_TAGS = ["abbr", "ins", "kbd", "mark", "small", "span", "sub", "sup", "u"];
// Content class per tag (span has none). Every name must also be in sanitize.js ALLOWED_TAGS.
export const HTML_TAG_CLASS = { abbr: "cm-html-abbr", ins: "cm-html-ins", kbd: "cm-html-kbd", mark: "cm-highlight", small: "cm-html-small", span: "", sub: "cm-subscript", sup: "cm-superscript", u: "cm-html-u" };

const hide = Decoration.replace({});
const faint = Decoration.mark({ class: "cm-faint-syntax" });
const TAG = /^<(\/?)([A-Za-z][A-Za-z0-9]*)/;

export const MAX_HTML_NESTING = 32; // deeper pairs stay source: bounds decoration depth and DOM depth

// First real `title` attribute of an opening tag's source, entity-decoded (one pass); null if none. Walks the
// attributes so a `title=` inside another value doesn't count. Only ever used as an attribute value, never parsed.
export function abbrTitle(src) {
    const re = /\s*(?:\/|([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"?|'([^']*)'?|([^\s"'=<>`]+)))?|.)/y;
    re.lastIndex = src.search(/[\s/]/) < 0 ? src.length : src.search(/[\s/]/);
    for (let m; re.lastIndex < src.length && (m = re.exec(src)); ) {
        if (m[1] && m[1].toLowerCase() === "title") {
            const v = m[2] ?? m[3] ?? m[4];
            if (v !== undefined) return decodeAttrEntities(v);
        }
    }
    return null;
}

// Pairs the safe inline tags among the HTMLTag children of one inline parent (so a paragraph, cell or emphasis
// is its own context). Mismatched or crossing tags pair nothing; pairs nested deeper than MAX_HTML_NESTING are
// dropped. Linear in the tags. -> [{ name, open: {from,to}, close: {from,to} }]
export function pairHtmlTags(parent, doc) {
    const found = [];
    const stack = [];
    const live = new Map(); // name -> openers of it on the stack, so an unmatched closer is O(1)
    for (let n = parent.firstChild; n; n = n.nextSibling) {
        if (n.name !== "HTMLTag") continue;
        const src = doc.sliceString(n.from, n.to);
        const m = TAG.exec(src);
        if (!m) continue;
        const name = m[2].toLowerCase();
        if (!SAFE_INLINE_HTML_TAGS.includes(name)) continue;
        if (!m[1]) {
            if (!src.endsWith("/>")) { stack.push({ name, from: n.from, to: n.to }); live.set(name, (live.get(name) ?? 0) + 1); }
            continue;
        }
        if (!live.get(name)) continue;
        let i = stack.length - 1;
        while (stack[i].name !== name) i--;
        if (i === stack.length - 1) found.push({ name, open: stack[i], close: { from: n.from, to: n.to } });
        for (let j = i; j < stack.length; j++) live.set(stack[j].name, live.get(stack[j].name) - 1); // crossing: drop all above too
        stack.length = i;
    }
    // Depth = enclosing pairs + 1, swept in source order.
    found.sort((a, b) => a.open.from - b.open.from);
    const ends = [];
    return found.filter((p) => {
        while (ends.length && ends.at(-1) < p.open.from) ends.pop();
        ends.push(p.close.to);
        return ends.length <= MAX_HTML_NESTING;
    });
}

class PairRef extends RangeValue { constructor(i) { super(); this.i = i; } }

function build(state) {
    const tree = syntaxTree(state);
    const pairs = [];
    const brs = [];
    const seen = new Set();
    tree.iterate({
        enter: (n) => {
            if (n.name !== "HTMLTag") return;
            const src = state.doc.sliceString(n.from, n.to);
            if (/^<br\b/i.test(src)) brs.push({ from: n.from, to: n.to });
            const parent = n.node.parent;
            if (!parent || seen.has(parent.from + ":" + parent.to + parent.name)) return;
            seen.add(parent.from + ":" + parent.to + parent.name);
            pairs.push(...pairHtmlTags(parent, state.doc));
        },
    });
    pairs.sort((a, b) => a.open.from - b.open.from);
    const index = RangeSet.of(pairs.map((p, i) => new PairRef(i).range(p.open.from, p.close.to)));
    return withSelection({ tree, pairs, brs, index }, state);
}

// The only selection input: which pairs it touches. Same decoration set while that stays the same.
function withSelection(value, state) {
    const hit = new Set();
    for (const r of state.selection.ranges) {
        value.index.between(Math.max(0, r.from - 1), r.to + 1, (_f, _t, v) => {
            const p = value.pairs[v.i];
            if (isCursorTouching(state.selection, p.open.from, p.close.to)) hit.add(v.i);
        });
    }
    const key = [...hit].sort((a, b) => a - b).join(",");
    if (value.decos && key === value.key) return value;
    const ranges = value.brs.map((b) => faint.range(b.from, b.to));
    value.pairs.forEach((p, i) => {
        const { open, close } = p;
        if (hit.has(i)) { ranges.push(faint.range(open.from, open.to), faint.range(close.from, close.to)); return; }
        ranges.push(hide.range(open.from, open.to), hide.range(close.from, close.to));
        const cls = HTML_TAG_CLASS[p.name];
        const title = p.name === "abbr" ? abbrTitle(state.doc.sliceString(open.from, open.to)) : null;
        if ((cls || title !== null) && close.from > open.to) {
            const spec = { class: cls };
            if (title !== null) spec.attributes = { title };
            ranges.push(Decoration.mark(spec).range(open.to, close.from));
        }
    });
    return { ...value, key, decos: Decoration.set(ranges, true) };
}

export const htmlInlinePreview = StateField.define({
    create: build,
    update(value, tr) {
        if (tr.docChanged || syntaxTree(tr.state) !== value.tree) return build(tr.state);
        return tr.selection ? withSelection(value, tr.state) : value;
    },
    provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});
