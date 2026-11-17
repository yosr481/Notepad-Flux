// Lezer markdown extension: [^label] references, ^[inline notes] and [^label]: definitions.
// Rules in Docs/internal/footnotes-spec.md ("Syntax"). Like mathSyntax, the pure scanners below are
// the one copy of the rules, shared by this parser and the export renderer.
// The parser marks every syntactically valid reference; whether a definition exists is decided later.
const BRACKET_OPEN = 91, BRACKET_CLOSE = 93, CARET = 94, BACKSLASH = 92, NEWLINE = 10, TAB = 9, SPACE = 32, COLON = 58;
const LABEL_MAX = 999;
// Longest inline note content looked for; bounds the scan per `^[` (as INLINE_MATH_MAX does).
// ponytail: each unclosed `^[` scans up to 2000 chars; linear, ~1.2 s on 600 KB of `^[`. Lower the cap if it bites.
export const INLINE_FOOTNOTE_MAX = 2000;

// "[^label]" at text[0]: returns { label, end } (end = index after "]") or null.
export function scanFootnoteRef(text) {
    if (text.charCodeAt(0) !== BRACKET_OPEN || text.charCodeAt(1) !== CARET) return null;
    for (let i = 2; i <= LABEL_MAX + 2 && i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === BRACKET_CLOSE) return i > 2 ? { label: text.slice(2, i), end: i + 1 } : null;
        if (c === BRACKET_OPEN || /\s/.test(text[i])) return null;
    }
    return null;
}

function blankLineAt(text, i) {
    while (text.charCodeAt(i) === SPACE || text.charCodeAt(i) === TAB) i++;
    return i >= text.length || text.charCodeAt(i) === NEWLINE;
}

// "^[note]" at text[0]: returns { end, content } (raw content) or null. Brackets inside must
// balance, `\` escapes the next char, a blank line ends the search.
export function scanInlineFootnote(text) {
    if (text.charCodeAt(0) !== CARET || text.charCodeAt(1) !== BRACKET_OPEN) return null;
    let depth = 1;
    for (let i = 2; i <= INLINE_FOOTNOTE_MAX + 2 && i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === BACKSLASH && text.charCodeAt(i + 1) !== NEWLINE) i++;
        else if (c === BRACKET_OPEN) depth++;
        else if (c === BRACKET_CLOSE) {
            if (--depth > 0) continue;
            return i > 2 ? { end: i + 1, content: text.slice(2, i) } : null;
        } else if (c === NEWLINE && blankLineAt(text, i + 1)) return null;
    }
    return null;
}

// "[^label]:" on a line, up to 3 spaces of indent: returns { label, markEnd } (index after ":") or null.
export function scanFootnoteDef(line) {
    let indent = 0;
    while (indent < 4 && line.charCodeAt(indent) === SPACE) indent++;
    if (indent > 3) return null;
    const ref = scanFootnoteRef(line.slice(indent));
    if (!ref || line.charCodeAt(indent + ref.end) !== COLON) return null;
    return { label: ref.label, markEnd: indent + ref.end + 1 };
}

function footnoteReference(cx, next, start) {
    if (next !== BRACKET_OPEN) return -1;
    const ref = scanFootnoteRef(cx.slice(start, Math.min(cx.end, start + LABEL_MAX + 3)));
    if (!ref) return -1;
    const end = start + ref.end;
    return cx.addElement(cx.elt('FootnoteReference', start, end, [
        cx.elt('FootnoteMark', start, start + 2), cx.elt('FootnoteLabel', start + 2, end - 1),
        cx.elt('FootnoteMark', end - 1, end)]));
}

function inlineFootnote(cx, next, start) {
    if (next !== CARET || cx.char(start + 1) !== BRACKET_OPEN) return -1;
    const note = scanInlineFootnote(cx.slice(start, Math.min(cx.end, start + INLINE_FOOTNOTE_MAX + 3)));
    if (!note) return -1;
    const end = start + note.end;
    return cx.addElement(cx.elt('InlineFootnote', start, end, [
        cx.elt('FootnoteMark', start, start + 2),
        ...cx.parser.parseInline(note.content, start + 2),
        cx.elt('FootnoteMark', end - 1, end)]));
}

// markEnd is returned relative to the line start (scanFootnoteDef sees text from line.pos on).
function opensDefinition(line) {
    if (line.next !== BRACKET_OPEN || line.indent - line.baseIndent >= 4) return null;
    const def = scanFootnoteDef(line.text.slice(line.pos));
    return def && { label: def.label, markEnd: line.pos + def.markEnd };
}

function footnoteDefinition(cx, line) {
    // A definition opened on this very line (`[^1]: [^2]: x`) does not nest another.
    if (cx.block.type === cx.parser.getNodeType('FootnoteDefinition').id && cx.block.from >= cx.lineStart) return false;
    const def = opensDefinition(line);
    if (!def) return false;
    const from = cx.lineStart + line.pos, markEnd = cx.lineStart + def.markEnd;
    cx.startComposite('FootnoteDefinition', line.pos);
    cx.addElement(cx.elt('FootnoteMark', from, from + 2));
    cx.addElement(cx.elt('FootnoteLabel', from + 2, markEnd - 2));
    cx.addElement(cx.elt('FootnoteMark', markEnd - 2, markEnd));
    // Empty text: consume the line here, or lezer would open an empty Paragraph.
    if (line.skipSpace(def.markEnd) === line.text.length) { cx.nextLine(); return true; }
    line.moveBase(def.markEnd);
    return null;
}

export const footnoteSyntax = {
    defineNodes: [
        'FootnoteReference', 'InlineFootnote', 'FootnoteMark', 'FootnoteLabel',
        {
            name: 'FootnoteDefinition',
            // Blank lines stay inside; a line indented 4+ continues the note.
            composite: (_cx, line) => {
                if (line.next < 0) return true;
                if (line.indent < line.baseIndent + 4) return false;
                line.moveBaseColumn(line.baseIndent + 4);
                return true;
            },
        },
    ],
    parseInline: [
        { name: 'FootnoteReference', parse: footnoteReference, before: 'Link' },
        { name: 'InlineFootnote', parse: inlineFootnote, before: 'Link' },
    ],
    parseBlock: [
        { name: 'FootnoteDefinition', parse: footnoteDefinition, before: 'LinkReference', endLeaf: (_cx, line) => !!opensDefinition(line) },
    ],
};
