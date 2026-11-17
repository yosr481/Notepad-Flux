// Lezer markdown extension: YAML front matter at the very start of the document.
// Rules in Docs/internal/frontmatter-spec.md ("Syntax"). scanFrontMatter is the one copy of the rule,
// shared by this block parser and (later) the export renderer.
const DASH = 45, BOM = 0xFEFF;
const OPEN = /^---[ \t]*$/, CLOSE = /^(?:---|\.\.\.)[ \t]*$/;

// Line text at `pos` without its newline or a CR before it: { text, end (offset after text), next (start of next line, or -1) }.
function lineAt(text, pos) {
    const nl = text.indexOf('\n', pos);
    let end = nl < 0 ? text.length : nl;
    if (text.charCodeAt(end - 1) === 13 && end > pos) end--;
    return { text: text.slice(pos, end), end, next: nl < 0 ? -1 : nl + 1 };
}

// Returns { from, to, contentFrom, contentTo } or null. `to` is the end of the closing fence line text
// (before any "\r"); contentTo is the end of the last YAML line, equal to contentFrom when empty.
export function scanFrontMatter(text) {
    const from = text.charCodeAt(0) === BOM ? 1 : 0;
    const open = lineAt(text, from);
    if (!OPEN.test(open.text) || open.next < 0) return null;
    const contentFrom = open.next;
    for (let pos = contentFrom; pos >= 0;) {
        const line = lineAt(text, pos);
        if (CLOSE.test(line.text)) {
            let contentTo = pos === contentFrom ? contentFrom : pos - 1;
            if (contentTo > contentFrom && text.charCodeAt(contentTo - 1) === 13) contentTo--;
            return { from, to: line.end, contentFrom, contentTo };
        }
        pos = line.next;
    }
    return null;
}

function frontMatter(cx, line) {
    if (cx.lineStart !== 0 || line.pos !== 0 || (line.next !== DASH && line.next !== BOM)) return false;
    const text = cx.input.read(0, cx.input.length);
    const fm = scanFrontMatter(text);
    if (!fm) return false;
    const openEnd = lineAt(text, fm.from).end;
    const closeFrom = text.lastIndexOf('\n', fm.to - 1) + 1;
    const children = [cx.elt('FrontMatterMark', fm.from, openEnd)];
    if (fm.contentTo > fm.contentFrom) children.push(cx.elt('FrontMatterContent', fm.contentFrom, fm.contentTo));
    children.push(cx.elt('FrontMatterMark', closeFrom, fm.to));
    cx.addElement(cx.elt('FrontMatter', fm.from, fm.to, children));
    while (cx.nextLine() && cx.lineStart <= fm.to);
    return true;
}

export const frontMatterSyntax = {
    defineNodes: ['FrontMatter', 'FrontMatterMark', 'FrontMatterContent'],
    parseBlock: [{ name: 'FrontMatter', parse: frontMatter, before: 'HorizontalRule' }],
};
