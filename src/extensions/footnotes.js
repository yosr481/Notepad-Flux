import { EditorView, Decoration, WidgetType, hoverTooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { normalizeLabel } from "./linkDefs";
import { scanFootnoteDef, numberFootnotes, defText } from "./footnoteSyntax";
import { selectionKeyedField } from "./decorationField";
import { marked } from "marked";
import { sanitizeHTML } from "../utils/sanitize";

const cache = new WeakMap();

// { labelled: Map<label, {number, defFrom, defTo, text, refs}>, inline: Map<from, {number, text}> },
// memoized per EditorState. Read-only for callers. One tree pass, then GitHub-order numbering; notes never reached get no entry.
export function resolveFootnotes(state) {
    if (cache.has(state)) return cache.get(state);

    const doc = state.doc;
    const defs = new Map();   // label -> first definition in document order
    const events = [];        // refs and inline notes, document order
    const open = [];          // enclosing definitions' labels; IGNORED stands for a duplicate (never numbered)
    const IGNORED = Symbol('ignored duplicate definition');
    syntaxTree(state).iterate({
        leave: (node) => { if (node.name === 'FootnoteDefinition') open.pop(); },
        enter: (node) => {
            const inDef = open.at(-1) ?? null;
            if (node.name === 'FootnoteDefinition') {
                const label = node.node.getChild('FootnoteLabel');
                const key = label && normalizeLabel(doc.sliceString(label.from, label.to));
                if (!label || defs.has(key)) { open.push(IGNORED); return; }
                open.push(key);
                const raw = doc.sliceString(label.to + 2, node.to);
                const text = defText(raw);
                defs.set(key, { defFrom: node.from, defTo: node.to - (raw.length - raw.trimEnd().length), text });
            } else if (node.name === 'FootnoteReference') {
                const label = node.node.getChild('FootnoteLabel');
                if (label) events.push({ kind: 'ref', label: normalizeLabel(doc.sliceString(label.from, label.to)), inDef, from: node.from });
            } else if (node.name === 'InlineFootnote') {
                events.push({ kind: 'inline', inDef, from: node.from, text: doc.sliceString(node.from + 2, node.to - 1) });
            }
        },
    });

    const labelled = new Map(), inline = new Map();
    const numbers = numberFootnotes(events, (label) => defs.has(label));
    events.forEach((e, i) => {
        const number = numbers[i];
        if (number === null) return;
        if (e.kind === 'inline') inline.set(e.from, { number, text: e.text });
        else {
            const entry = labelled.get(e.label);
            if (entry) entry.refs.push(e.from);
            else labelled.set(e.label, { number, ...defs.get(e.label), refs: [e.from] });
        }
    });

    const result = { labelled, inline };
    cache.set(state, result);
    return result;
}

// Nearest ancestor-or-self of `names` at pos (side 1: pos === from still lands in the node).
function nodeAt(state, pos, names) {
    for (let n = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
        if (names.includes(n.name)) return n;
    }
    return null;
}

const labelKey = (state, node) => {
    const label = node.getChild('FootnoteLabel');
    return label && normalizeLabel(state.doc.sliceString(label.from, label.to));
};

// Resolved reference or inline note covering pos: { node, number, text, def? } or null.
function noteAt(state, pos) {
    const node = nodeAt(state, pos, ['FootnoteReference', 'InlineFootnote']);
    if (!node) return null;
    const { labelled, inline } = resolveFootnotes(state);
    if (node.name === 'InlineFootnote') {
        const note = inline.get(node.from);
        return note && { node, ...note };
    }
    const def = labelled.get(labelKey(state, node));
    return def && { node, number: def.number, text: def.text, def };
}

// Note text for the hover tooltip: container ">" prefixes stripped, whitespace collapsed, capped.
export function footnoteTooltipText(state, pos) {
    const note = noteAt(state, pos);
    if (!note) return null;
    const text = note.text.split('\n').map((l) => l.replace(/^[ \t]*(?:>[ \t]?)+/, '')).join(' ').replace(/\s+/g, ' ').trim();
    return text.length > 300 ? text.slice(0, 300) + '…' : text;
}

// Reference -> start of its note text; definition marker -> first reference. False when neither.
export function footnoteJump(view, pos) {
    const { state } = view;
    const note = noteAt(state, pos);
    let target;
    if (note?.def) {
        const line = state.doc.lineAt(note.def.defFrom);
        const rest = line.text.slice(note.def.defFrom - line.from);
        let i = scanFootnoteDef(rest)?.markEnd ?? 0;
        while (rest[i] === ' ' || rest[i] === '\t') i++;
        target = note.def.defFrom + i;
    } else {
        const def = nodeAt(state, pos, ['FootnoteDefinition']);
        const label = def?.getChild('FootnoteLabel');
        if (!label || pos >= label.to + 2) return false;
        const entry = resolveFootnotes(state).labelled.get(labelKey(state, def));
        if (entry?.defFrom !== def.from) return false;
        target = entry.refs[0];
    }
    view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
    return true;
}

class FootnoteWidget extends WidgetType {
    constructor(text, def) {
        super();
        this.text = text;
        this.def = def;
    }

    toDOM() {
        const el = document.createElement(this.def ? "span" : "sup");
        el.className = this.def ? "cm-footnote-def" : "cm-footnote-ref";
        el.dir = "ltr";
        el.textContent = this.text;
        return el;
    }

    eq(other) {
        return other.text === this.text && other.def === this.def;
    }

    ignoreEvent() {
        return false;
    }
}

function collectFootnotes(state) {
    const items = [];
    const { labelled, inline } = resolveFootnotes(state);
    const add = (from, to, text, def) => items.push({ from, to, text, def });
    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.name === 'FootnoteReference') {
                const entry = labelled.get(labelKey(state, node.node));
                if (entry) add(node.from, node.to, String(entry.number), false);
                return false;
            }
            if (node.name === 'InlineFootnote') {
                const note = inline.get(node.from);
                if (note) add(node.from, node.to, String(note.number), false);
                return false;
            }
            if (node.name === 'FootnoteDefinition') {
                const label = node.node.getChild('FootnoteLabel');
                const entry = label && labelled.get(labelKey(state, node.node));
                if (entry?.defFrom === node.from) add(node.from, label.to + 2, entry.number + '.', true);
            }
        },
    });
    return items;
}

const decorateFootnotes = (items, touched) => Decoration.set(
    items.flatMap((it, i) => touched[i] ? [] : [Decoration.replace({ widget: new FootnoteWidget(it.text, it.def) }).range(it.from, it.to)]),
    true,
);

// A StateField like mathField: items collected on doc and tree changes (the parse is time-sliced).
const footnoteField = selectionKeyedField({ collect: collectFootnotes, decorate: decorateFootnotes });

// The note's inline markdown, sanitized. Links show as link-styled text: a hover must not navigate.
export function footnoteTooltipDom(text) {
    const dom = document.createElement("div");
    dom.className = "cm-tooltip-cursor cm-footnote-tooltip";
    dom.innerHTML = sanitizeHTML(marked.parseInline(text));
    for (const a of dom.querySelectorAll("a")) {
        const span = document.createElement("span");
        span.className = "cm-link";
        span.append(...a.childNodes);
        a.replaceWith(span);
    }
    return dom;
}

const footnoteTooltip = hoverTooltip((view, pos) => {
    const text = footnoteTooltipText(view.state, pos);
    if (text === null) return null;
    const { node } = noteAt(view.state, pos);
    return {
        pos: node.from,
        end: node.to,
        above: true,
        create() {
            return { dom: footnoteTooltipDom(text) };
        },
    };
});

const footnoteTheme = EditorView.baseTheme({
    ".cm-footnote-ref, .cm-footnote-def": { unicodeBidi: "isolate", color: "var(--text-accent)", cursor: "pointer" },
    ".cm-footnote-ref": { fontSize: "0.75em", verticalAlign: "super", lineHeight: "0" },
    ".cm-footnote-def": { fontWeight: "600" },
    ".cm-footnote-tooltip": {
        unicodeBidi: "plaintext",
        maxWidth: "24em",
    },
});

// Plain click opens the raw source (caret just inside the opening mark); Ctrl/Cmd+click follows the link.
const footnoteClick = EditorView.domEventHandlers({
    mousedown(event, view) {
        if (event.button !== 0 || event.shiftKey) return false;
        const el = event.target instanceof Element ? event.target.closest(".cm-footnote-ref, .cm-footnote-def") : null;
        if (!el) return false;
        const from = view.posAtDOM(el);
        if (!((event.ctrlKey || event.metaKey) && footnoteJump(view, from))) {
            view.dispatch({ selection: { anchor: from + 2 } });
        }
        view.focus();
        event.preventDefault();
        return true;
    },
});

export const footnotePreview = [footnoteField, footnoteTooltip, footnoteTheme, footnoteClick];
