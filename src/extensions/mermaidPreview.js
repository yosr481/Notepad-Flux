import { EditorView, Decoration, WidgetType, ViewPlugin } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { renderMermaid } from "../utils/mermaid";

const themeChanged = StateEffect.define();
const currentTheme = () => (document.body.dataset.theme === "dark" ? "dark" : "default");

class MermaidWidget extends WidgetType {
    constructor(source, theme) {
        super();
        this.source = source;
        this.theme = theme;
    }

    toDOM(view) {
        const el = document.createElement("div");
        el.className = "cm-mermaid cm-mermaid-loading";
        el.dir = "ltr";
        el.textContent = this.source; // raw source until the SVG is ready
        renderMermaid(this.source, { theme: this.theme }).then((out) => {
            el.classList.remove("cm-mermaid-loading");
            if (out.error !== undefined) {
                el.classList.add("cm-mermaid-error");
                el.textContent = out.error;
            } else {
                el.innerHTML = out.svg; // sanitized in renderMermaid
            }
            if (el.isConnected) view.requestMeasure();
        }).catch((err) => console.error("Mermaid render failed:", err));
        return el;
    }

    eq(other) {
        return other.source === this.source && other.theme === this.theme;
    }

    ignoreEvent() {
        return false;
    }
}

const touches = (selection, from, to) => selection.ranges.some((r) => r.from <= to && r.to >= from);

// Drop the container prefix (blockquote markers, list-item indent) the opening fence sat behind.
function bodyStripper(prefix) {
    const depth = (prefix.match(/>/g) || []).length;
    const quote = depth ? new RegExp(`^(?: {0,3}> ?){${depth}}`) : null;
    const tail = prefix.slice(prefix.lastIndexOf(">") + 1);
    const indent = Math.max(0, tail.length - (depth && tail.startsWith(" ") ? 1 : 0));
    const ws = new RegExp(`^[ \\t]{0,${indent}}`);
    return (text) => (quote ? text.replace(quote, "") : text).replace(ws, "");
}

function mermaidBlocks(state) {
    const { doc } = state;
    const blocks = [];
    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.name !== "FencedCode") return;
            const info = node.node.getChild("CodeInfo");
            if (!info || doc.sliceString(info.from, info.to).trim().split(/\s+/)[0].toLowerCase() !== "mermaid") return false;
            const open = doc.lineAt(node.from);
            const closed = node.node.getChildren("CodeMark").length > 1;
            const end = doc.lineAt(node.to);
            const lastBody = closed ? end.number - 1 : end.number;
            const strip = bodyStripper(doc.sliceString(open.from, node.from));
            const lines = [];
            for (let n = open.number + 1; n <= lastBody; n++) lines.push(strip(doc.line(n).text));
            blocks.push({
                from: open.from,
                to: end.to,
                source: lines.join("\n"),
                bodyFrom: lastBody > open.number ? doc.line(open.number + 1).from : open.to,
            });
            return false;
        },
    });
    return blocks;
}

// Indices of the blocks the selection touches: the only selection input to the decorations.
const touchKey = (blocks, selection) =>
    blocks.reduce((k, b, i) => (touches(selection, b.from, b.to) ? k + i + "," : k), "");

function buildDecos(blocks, key) {
    if (!blocks.length) return Decoration.none;
    const theme = currentTheme();
    const touched = new Set(key.split(",").filter(Boolean).map(Number));
    return Decoration.set(
        blocks.flatMap((b, i) => touched.has(i) ? []
            : [Decoration.replace({ widget: new MermaidWidget(b.source, theme), block: true }).range(b.from, b.to)]),
        true,
    );
}

function buildValue(state) {
    const blocks = mermaidBlocks(state);
    const key = touchKey(blocks, state.selection);
    return { blocks, key, decos: buildDecos(blocks, key) };
}

// Like decorationField, plus a rebuild when the app theme flips (the widget's theme changes).
// Block list is kept in the value: a selection move only re-filters it (nothing at all with zero blocks).
const mermaidField = StateField.define({
    create: buildValue,
    update(value, tr) {
        if (tr.docChanged || syntaxTree(tr.startState) !== syntaxTree(tr.state)) return buildValue(tr.state);
        if (tr.effects.some((e) => e.is(themeChanged))) {
            return { ...value, decos: buildDecos(value.blocks, value.key) };
        }
        if (tr.selection && value.blocks.length) {
            const key = touchKey(value.blocks, tr.state.selection);
            if (key !== value.key) return { ...value, key, decos: buildDecos(value.blocks, key) };
        }
        return value;
    },
    provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});

const themeWatcher = ViewPlugin.define((view) => {
    const observer = new MutationObserver(() => view.dispatch({ effects: themeChanged.of(null) }));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
    return { destroy: () => observer.disconnect() };
});

const mermaidTheme = EditorView.baseTheme({
    ".cm-mermaid": { display: "block", textAlign: "center", margin: "0.5em 0", maxWidth: "100%", overflowX: "hidden", unicodeBidi: "isolate" },
    ".cm-mermaid svg": { maxWidth: "100%", height: "auto" },
    ".cm-mermaid-loading": { fontFamily: "var(--font-monospace, monospace)", opacity: "0.6", whiteSpace: "pre-wrap", textAlign: "start" },
});

const mermaidClick = EditorView.domEventHandlers({
    mousedown(event, view) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        const el = event.target instanceof Element ? event.target.closest(".cm-mermaid") : null;
        if (!el) return false;
        const from = view.posAtDOM(el);
        const block = view.state.field(mermaidField).blocks.find((b) => b.from === from);
        if (!block) return false;
        view.dispatch({ selection: { anchor: block.bodyFrom } });
        view.focus();
        event.preventDefault();
        return true;
    },
});

export const mermaidPreview = [mermaidField, themeWatcher, mermaidTheme, mermaidClick];
