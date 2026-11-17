import { emojiFor } from "../utils/emojiTable";
import { normalizeLabel } from "./linkDefs";
import { mathSource } from "./mathSyntax";
import { MathWidget } from "./mathPreview";
import { isSafeExternalUrl } from "./linkHandler";

// Rendered table cells, built from the editor's syntax tree so the inline rules are the editor's own.
// Data shape (what TableWidget holds and compares):
//   { align: [null|"left"|"center"|"right"], head: [cell], body: [[cell]] }  cell = part[]
//   part = string | { k: "strong"|"em"|"del"|"code"|"sub"|"sup"|"mark"|"a", c: part[], href? }
//        | { k: "math", tex, display } | { k: "emoji", name } | { k: "fn", n }

const CONTAINERS = { StrongEmphasis: "strong", Emphasis: "em", Strikethrough: "del", Subscript: "sub", Superscript: "sup" };
const unpipe = (s) => s.replace(/\\\|/g, "|"); // GFM: `\|` in a cell is a literal pipe, even in code and math

function cellParts(state, cell, footnotes) {
    const doc = state.doc;
    const text = (a, b) => doc.sliceString(a, b);
    // ponytail: `==h==` is found per text run, so a pair split by other markup (==**b**==) stays literal.
    const plain = (a, b) => {
        const out = [];
        let last = 0;
        const s = text(a, b);
        for (const m of s.matchAll(/==(.*?)==/g)) {
            if (m.index > last) out.push(s.slice(last, m.index));
            out.push({ k: "mark", c: [m[1]] });
            last = m.index + m[0].length;
        }
        if (last < s.length) out.push(s.slice(last));
        return out;
    };

    // Parts for [from, to) of `parent`: children become parts, the gaps between them plain text.
    function walk(parent, from, to) {
        const out = [];
        let pos = from;
        const gap = (end) => { if (end > pos) out.push(...plain(pos, end)); };
        for (let n = parent.firstChild; n; n = n.nextSibling) {
            if (n.from < from || n.to > to) continue;
            gap(n.from);
            pos = n.to;
            const part = convert(n);
            if (part !== null) out.push(...part);
        }
        gap(to);
        return out;
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
            case "Link": {
                const url = n.node.getChild("URL");
                const marks = n.node.getChildren("LinkMark");
                if (!url || marks.length < 2) return raw(n);
                return [{ k: "a", href: text(url.from, url.to), c: walk(n, marks[0].to, marks[1].from) }];
            }
            default: return raw(n); // HTML, images, entities, autolinks...: shown as the source text
        }
    }

    return walk(cell, cell.from, cell.to);
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

export function buildTableData(state, table, footnotes) {
    if (table.name !== "Table") return null;
    const head = table.getChild("TableHeader");
    const delim = table.getChild("TableDelimiter");
    if (!head || !delim) return null;
    const ds = state.doc.sliceString(delim.from, delim.to).trim().replace(/^\|/, "").replace(/\|$/, "");
    const body = table.getChildren("TableRow").map((r) => rowCells(state, r, footnotes)).filter((r) => r.length);
    return { align: ds.split("|").map(ALIGN), head: rowCells(state, head, footnotes), body };
}

const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
};

function appendParts(parent, parts, view) {
    for (const p of parts) {
        if (typeof p === "string") { parent.append(p); continue; }
        let e;
        switch (p.k) {
            case "math": parent.append(new MathWidget(p.tex, p.display ? "display" : "inline").toDOM(view)); continue;
            case "emoji":
                e = el("span", "cm-emoji");
                e.setAttribute("role", "img");
                e.setAttribute("aria-label", p.name);
                e.textContent = emojiFor(p.name);
                break;
            case "fn":
                e = el("sup", "cm-footnote-ref");
                e.dir = "ltr";
                e.textContent = String(p.n);
                break;
            case "mark": e = el("span", "cm-highlight"); break;
            case "sub": e = el("span", "cm-subscript"); break;
            case "sup": e = el("span", "cm-superscript"); break;
            case "a":
                e = el("a");
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
