// Lezer markdown extension: $inline$, $$inline display$$ and $$ ... $$ blocks.
// Rules (Pandoc/Obsidian style, see Docs/internal/math-spec.md):
//  - `$` opens when the next char is not whitespace or `$`; the closer is the next `$` on the
//    same line with no whitespace before it and no digit after it. So "$5 and $10" is text.
//  - `$$...$$` inside a line is display math in place; a line starting with `$$` opens a block
//    that runs to the line holding the closing `$$` (or the end of the document, unrendered).
// Being real syntax nodes, math content is not parsed as markdown (no emphasis inside $a*b*c$),
// and code spans/fences, parsed first, never contain math.
const DOLLAR = 36, BACKSLASH = 92, NEWLINE = 10;
const isSpace = (c) => c === 32 || c === 9 || c === NEWLINE || c === 13;
const isDigit = (c) => c >= 48 && c <= 57;
// Longest inline formula looked for. Bounds the scan per `$`, so a long line full of `$`
// (minified or pasted data) stays linear instead of rescanning the line for every `$`.
export const INLINE_MATH_MAX = 1000;

// Inline math at text[0] ("$" or "$$"): returns { end, display } or null. One copy of the
// rules, used by the editor parser and by the export renderer (marked).
export function scanInlineMath(text) {
    if (text.charCodeAt(0) !== DOLLAR) return null;
    const display = text.charCodeAt(1) === DOLLAR;
    const open = display ? 2 : 1;
    const first = text.charCodeAt(open);
    if (open >= text.length || first === DOLLAR || first === NEWLINE || (!display && isSpace(first))) return null;

    for (let pos = open; pos < text.length; pos++) {
        const c = text.charCodeAt(pos);
        if (c === NEWLINE) return null;
        if (c === BACKSLASH) { pos++; continue; }
        if (c !== DOLLAR) continue;
        if (display) {
            if (text.charCodeAt(pos + 1) === DOLLAR) return { end: pos + 2, display };
            continue;
        }
        if (isSpace(text.charCodeAt(pos - 1)) || isDigit(text.charCodeAt(pos + 1))) continue;
        return { end: pos + 1, display };
    }
    return null;
}

function inlineMath(cx, next, start) {
    if (next !== DOLLAR) return -1;
    // Math never spans lines, so the rest of this line is enough.
    const limit = Math.min(cx.end, start + INLINE_MATH_MAX);
    let eol = start;
    while (eol < limit && cx.char(eol) !== NEWLINE) eol++;
    const m = scanInlineMath(cx.slice(start, eol));
    if (!m) return -1;
    const mark = m.display ? 2 : 1;
    return cx.addElement(cx.elt('InlineMath', start, start + m.end, [
        cx.elt('InlineMathMark', start, start + mark), cx.elt('InlineMathMark', start + m.end - mark, start + m.end)]));
}

// Index of an unescaped "$$" in text at or after `from`, or -1.
export function findClose(text, from) {
    for (let i = from; i < text.length - 1; i++) {
        const c = text.charCodeAt(i);
        if (c === BACKSLASH) { i++; continue; }
        if (c === DOLLAR && text.charCodeAt(i + 1) === DOLLAR) return i;
    }
    return -1;
}

// Is there an unescaped "$$" anywhere after `pos`? Read in chunks, stop at the first hit.
function closeFollows(input, pos) {
    const CHUNK = 8192;
    let carry = '';
    for (let at = pos; at < input.length; at += CHUNK) {
        const text = carry + input.read(at, Math.min(input.length, at + CHUNK));
        if (findClose(text, 0) >= 0) return true;
        carry = text.slice(-2); // a "$$" split across two chunks
    }
    return false;
}

export const opensBlock = (line) =>
    line.next === DOLLAR && line.text.charCodeAt(line.pos + 1) === DOLLAR && line.indent - line.baseIndent < 4;

function blockMath(cx, line) {
    if (!opensBlock(line)) return false;
    const from = cx.lineStart + line.pos;
    const marks = [cx.elt('BlockMathMark', from, from + 2)];
    const sameLine = findClose(line.text, line.pos + 2);
    // No closing $$ anywhere below: not a block (the line stays text, as in the export),
    // instead of swallowing the rest of the document while the user is still typing.
    if (sameLine < 0 && !closeFollows(cx.input, cx.lineStart + line.text.length)) return false;
    if (sameLine >= 0) {
        marks.push(cx.elt('BlockMathMark', cx.lineStart + sameLine, cx.lineStart + sameLine + 2));
        cx.nextLine();
    } else {
        // Same container walk as lezer's FencedCode: stop when a blockquote/list ends.
        while (cx.nextLine() && line.depth >= cx.stack.length) {
            for (const m of line.markers) marks.push(m);
            const close = findClose(line.text, line.basePos);
            if (close >= 0) {
                marks.push(cx.elt('BlockMathMark', cx.lineStart + close, cx.lineStart + close + 2));
                cx.nextLine();
                break;
            }
        }
    }
    cx.addElement(cx.elt('BlockMath', from, cx.prevLineEnd(), marks));
    return true;
}

export const mathSyntax = {
    defineNodes: ['InlineMath', 'InlineMathMark', 'BlockMath', 'BlockMathMark'],
    parseInline: [{ name: 'InlineMath', parse: inlineMath }],
    parseBlock: [{ name: 'BlockMath', parse: blockMath, before: 'FencedCode', endLeaf: (_cx, line) => opensBlock(line) }],
};

// True when a BlockMath node has its closing $$ (an unclosed block is never rendered).
export const isClosedBlock = (node) => {
    let marks = 0;
    for (let c = node.firstChild; c; c = c.nextSibling) if (c.name === 'BlockMathMark') marks++;
    return marks === 2;
};

// The TeX between the delimiters of an InlineMath/BlockMath node.
// Container markers inside a block (a blockquote's "> ") are left out.
export const mathSource = (doc, node) => {
    const open = node.firstChild, close = node.lastChild;
    let pos = open && open.name.endsWith('MathMark') ? open.to : node.from;
    const to = close && close !== open && close.name.endsWith('MathMark') ? close.from : node.to;
    let tex = '';
    for (let c = open && open.nextSibling; c && c.from < to; c = c.nextSibling) {
        if (c.name.endsWith('MathMark')) continue;
        tex += doc.sliceString(pos, c.from);
        pos = c.to;
    }
    return tex + doc.sliceString(pos, to);
};
