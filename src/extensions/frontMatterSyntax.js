// Lezer markdown extension: YAML front matter at the very start of the document.
// Rules in Docs/internal/frontmatter-spec.md ("Syntax"). scanFrontMatter is the one copy of the rule,
// shared by this block parser, the properties widget and the export renderer.
const DASH = 45, BOM = 0xFEFF;
export const FRONT_MATTER_MAX_LINES = 500;
const OPEN = /^\uFEFF?---[ \t]*$/, CLOSE = /^(?:---|\.\.\.)[ \t]*$/;

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
    for (let pos = contentFrom, yamlLines = 0; pos >= 0;) {
        const line = lineAt(text, pos);
        if (!CLOSE.test(line.text) && ++yamlLines > FRONT_MATTER_MAX_LINES) return null;
        if (CLOSE.test(line.text)) {
            let contentTo = pos === contentFrom ? contentFrom : pos - 1;
            if (contentTo > contentFrom && text.charCodeAt(contentTo - 1) === 13) contentTo--;
            return { from, to: line.end, contentFrom, contentTo };
        }
        pos = line.next;
    }
    return null;
}

// Head text from offset 0 up to the closer, read in doubling chunks so a long doc is not copied per reparse.
// Chunks are cut after a newline so scanFrontMatter never sees a partial line.
// ponytail: each reparse re-reads and rescans from 0, at most ~2x the cap (opener + cap + 1 lines) of text, and stops there for an unclosed opener.
function scanHead(input) {
    for (let size = 1024; ; size *= 2) {
        const n = Math.min(size, input.length);
        let text = input.read(0, n);
        if (n < input.length) text = text.slice(0, text.lastIndexOf('\n') + 1);
        const fm = scanFrontMatter(text);
        if (fm) return { text, fm };
        if (n === input.length || text.split('\n').length > FRONT_MATTER_MAX_LINES + 2) return null;
    }
}

function frontMatter(cx, line) {
    if (cx.lineStart !== 0 || line.pos !== 0 || (line.next !== DASH && line.next !== BOM)) return false;
    if (!OPEN.test(line.text.replace(/\r$/, ""))) return false;
    const head = scanHead(cx.input);
    if (!head) return false;
    const { text, fm } = head;
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
