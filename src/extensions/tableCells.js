import { emojiFor } from "../utils/emojiTable";
import { normalizeLabel } from "./linkDefs";
import { mathSource } from "./mathSyntax";
import { MathWidget } from "./mathPreview";
import { isSafeExternalUrl } from "./linkHandler";
import { resolveReference, normalizeDestination } from "./linkDefs";
import { resolveFootnotes, FootnoteWidget } from "./footnotes";
import { EmojiWidget } from "./emojiPreview";
import { HIGHLIGHT } from "./highlight";
import { decodeEntity, decodeAttrEntities } from "./entities";
import { syntaxTree } from "@codemirror/language";
import { pairHtmlTags, abbrTitle, HTML_TAG_CLASS } from "./htmlInlinePreview";

// Rendered table cells, built from the editor's syntax tree so the inline rules are the editor's own.
// Data shape (what TableWidget holds and compares):
//   { align: [null|"left"|"center"|"right"], head: [cell], body: [[cell]] }  cell = part[]
//   part = string | { k: "strong"|"em"|"del"|"code"|"sub"|"sup"|"mark"|"a", c: part[], href? }
//        | { k: "html", cls, title, c: part[] }  (safe inline html tag pair)
//        | { k: "math", tex, display } | { k: "emoji", name } | { k: "fn", n }

const CONTAINERS = { StrongEmphasis: "strong", Emphasis: "em", Strikethrough: "del", Subscript: "sub", Superscript: "sup" };
const unpipe = (s) => s.replace(/\\\|/g, "|"); // GFM: `\|` in a cell is a literal pipe, even in code and math

// The inline walker shared by table cells and link labels outside tables (linkPreview.js).
function inlineWalker(state, footnotes) {
    const doc = state.doc;
    const text = (a, b) => doc.sliceString(a, b);
    // ponytail: `==h==` is found per text run, so a pair split by other markup (==**b**==) stays literal.
    const plain = (a, b) => {
        const out = [];
        let last = 0;
        const s = text(a, b);
        for (const m of s.matchAll(HIGHLIGHT)) {
            if (m.index > last) out.push(s.slice(last, m.index));
            out.push({ k: "mark", c: [m[1]] });
            last = m.index + m[0].length;
        }
        if (last < s.length) out.push(s.slice(last));
        return out;
    };

    // Pairs once per parent (memo), not per nesting level.
    const pairMemo = new Map();
    const pairsOf = (parent) => {
        const key = parent.name + ":" + parent.from + ":" + parent.to;
        if (!pairMemo.has(key)) {
            const open = new Map(), close = new Set();
            for (const p of pairHtmlTags(parent, doc)) { open.set(p.open.from, p); close.add(p.close.from); }
            pairMemo.set(key, { open, close });
        }
        return pairMemo.get(key);
    };

    // Parts for [from, to) of `parent`: children become parts, the gaps between them plain text.
    // One pass; a rendered tag pair opens a frame that its closing tag pops.
    function walk(parent, from, to) {
        const root = [];
        const frames = [{ c: root }];
        const { open, close } = pairsOf(parent);
        let pos = from;
        const gap = (end) => { if (end > pos) frames.at(-1).c.push(...plain(pos, end)); };
        for (let n = parent.firstChild; n; n = n.nextSibling) {
            if (n.from < from || n.to > to) continue;
            gap(n.from);
            pos = n.to;
            if (n.name === "HTMLTag") {
                const p = open.get(n.from);
                if (p && p.close.to <= to) {
                    const title = p.name === "abbr" ? abbrTitle(text(n.from, n.to)) : null;
                    const part = { k: "html", cls: HTML_TAG_CLASS[p.name], title, c: [] };
                    frames.at(-1).c.push(part);
                    frames.push({ c: part.c, end: p.close.from });
                    continue;
                }
                if (close.has(n.from) && frames.at(-1).end === n.from) { frames.pop(); continue; }
            }
            const part = convert(n);
            if (part !== null) frames.at(-1).c.push(...part);
        }
        gap(to);
        return root;
    }

    const raw = (n) => [text(n.from, n.to)];

    function convert(n) {
        const name = n.name;
        if (name.endsWith("Mark")) return null;
        if (CONTAINERS[name]) return [{ k: CONTAINERS[name], c: walk(n, n.from, n.to) }];
        switch (name) {
            case "Escape": return [text(n.from + 1, n.to)];
            case "InlineCode": {
                const open = n.firstChild, close = n.lastChild;
                return [{ k: "code", c: [unpipe(text(open.to, close.from))] }];
            }
            case "InlineMath":
                return [{ k: "math", tex: unpipe(mathSource(doc, n.node)), display: text(n.from, n.from + 2) === "$$" }];
            case "Emoji": {
                const name = text(n.from + 1, n.to - 1);
                return emojiFor(name) === undefined ? raw(n) : [{ k: "emoji", name }];
            }
            case "FootnoteReference": {
                const label = n.node.getChild("FootnoteLabel");
                const entry = label && footnotes.labelled.get(normalizeLabel(text(label.from, label.to)));
                return entry ? [{ k: "fn", n: entry.number }] : raw(n);
            }
            case "InlineFootnote": {
                const entry = footnotes.inline.get(n.from);
                return entry ? [{ k: "fn", n: entry.number }] : raw(n);
            }
            case "Entity": return [decodeEntity(text(n.from, n.to)) ?? text(n.from, n.to)];
            case "Autolink": {
                const url = n.node.getChild("URL");
                if (!url) return raw(n);
                const label = text(url.from, url.to);
                // autolinks: entities decode, backslash stays literal (CommonMark) as %5C since the browser reads a raw one as "/"
                return [{ k: "a", href: /^[a-z][a-z0-9+.-]*:/i.test(label) ? decodeAttrEntities(label).replace(/\\/g, "%5C") : "mailto:" + label, c: [label] }];
            }
            case "Link": {
                const url = n.node.getChild("URL");
                const marks = n.node.getChildren("LinkMark");
                if (marks.length < 2) return raw(n);
                let href;
                if (url) href = normalizeDestination(text(url.from, url.to));
                else {
                    const def = resolveReference(n.node, state);
                    if (!def) return raw(n);
                    href = def.url;
                }
                return [{ k: "a", href, c: walk(n, marks[0].to, marks[1].from) }];
            }
            default: return raw(n); // HTML, images, entities, autolinks...: shown as the source text
        }
    }

    return walk;
}

const cellParts = (state, cell, footnotes) => inlineWalker(state, footnotes)(cell, cell.from, cell.to);

// Parts of an inline Link's label (between its first two LinkMarks), or null when it has no two marks.
export function linkLabelParts(state, link, footnotes) {
    const marks = link.getChildren("LinkMark");
    return marks.length < 2 ? null : inlineWalker(state, footnotes)(link, marks[0].to, marks[1].from);
}

const ALIGN = (s) => {
    s = s.trim();
    if (s.startsWith(":") && s.endsWith(":")) return "center";
    if (s.endsWith(":")) return "right";
    if (s.startsWith(":")) return "left";
    return null;
};

// Cells of one TableHeader/TableRow node. Empty cells have no TableCell node, so count them off the pipes.
function rowCells(state, row, footnotes) {
    const kids = [];
    for (let n = row.firstChild; n; n = n.nextSibling) kids.push(n);
    const isPipe = (n) => n && n.name === "TableDelimiter";
    const lead = isPipe(kids[0]) ? 1 : 0, trail = isPipe(kids.at(-1)) ? 1 : 0;
    const pipes = kids.filter(isPipe).length;
    const cells = Array.from({ length: Math.max(0, pipes + 1 - lead - trail) }, () => []);
    let idx = -lead;
    for (const n of kids) {
        if (isPipe(n)) idx++;
        else if (n.name === "TableCell" && cells[idx]) cells[idx] = cellParts(state, n, footnotes);
    }
    return cells;
}

// Per doc and parse: the footnote numbering and the cells depend on nothing else, so selection-only
// transactions reuse the data (same object, so TableWidget.eq is a cheap match).
const cache = new WeakMap();

export function buildTableData(state, table, footnotes) {
    if (table.name !== "Table") return null;
    const tree = syntaxTree(state);
    let entry = cache.get(state.doc);
    if (!entry || entry.tree !== tree) cache.set(state.doc, entry = { tree, tables: new Map() });
    if (!entry.tables.has(table.from)) entry.tables.set(table.from, computeTableData(state, table, footnotes ?? resolveFootnotes(state)));
    return entry.tables.get(table.from);
}

function computeTableData(state, table, footnotes) {
    const head = table.getChild("TableHeader");
    const delim = table.getChild("TableDelimiter");
    if (!head || !delim) return null;
    const ds = state.doc.sliceString(delim.from, delim.to).trim().replace(/^\|/, "").replace(/\|$/, "");
    const headCells = rowCells(state, head, footnotes);
    // The header decides the width, as in marked: extra cells dropped, short rows padded.
    const fit = (r) => Array.from({ length: headCells.length }, (_, i) => r[i] ?? []);
    const body = table.getChildren("TableRow").map((r) => rowCells(state, r, footnotes)).filter((r) => r.length).map(fit);
    return { align: ds.split("|").map(ALIGN), head: headCells, body };
}

const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
};

export function appendParts(parent, parts, view) {
    for (const p of parts) {
        if (typeof p === "string") { parent.append(p); continue; }
        let e;
        switch (p.k) {
            case "math": parent.append(new MathWidget(p.tex, p.display ? "display" : "inline").toDOM(view)); continue;
            case "emoji": parent.append(new EmojiWidget(p.name).toDOM()); continue;
            case "fn": parent.append(new FootnoteWidget(String(p.n), false).toDOM()); continue;
            case "html":
                e = el("span", p.cls);
                if (p.title !== null) e.setAttribute("title", p.title);
                break;
            case "mark": e = el("span", "cm-highlight"); break;
            case "sub": e = el("span", "cm-subscript"); break;
            case "sup": e = el("span", "cm-superscript"); break;
            case "a":
                e = el("a", "cm-link");
                if (isSafeExternalUrl(p.href)) {
                    e.setAttribute("href", p.href);
                    e.setAttribute("target", "_blank");
                    e.setAttribute("rel", "noopener noreferrer");
                }
                break;
            default: e = el(p.k);
        }
        if (p.c) appendParts(e, p.c, view);
        parent.append(e);
    }
}

export function tableDOM(data, view) {
    const table = el("table");
    const section = (tag, rows, th) => {
        const s = el(tag);
        for (const cells of rows) {
            const tr = el("tr");
            cells.forEach((parts, j) => {
                const c = el(th ? "th" : "td", data.align[j] ? `cm-align-${data.align[j]}` : "");
                appendParts(c, parts, view);
                tr.append(c);
            });
            s.append(tr);
        }
        return s;
    };
    table.append(section("thead", [data.head], true));
    if (data.body.length) table.append(section("tbody", data.body, false));
    return table;
}
