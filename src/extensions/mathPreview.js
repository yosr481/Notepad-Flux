import { StateField } from "@codemirror/state";
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { isClosedBlock, mathSource } from "./mathSyntax";
import { renderTex } from "../utils/math";

// kind: "inline" | "display" ($$..$$ inside a line) | "block" | "preview" (under a block being edited)
class MathWidget extends WidgetType {
    constructor(tex, kind) {
        super();
        this.tex = tex;
        this.kind = kind;
    }

    get display() { return this.kind !== "inline"; }
    get isBlock() { return this.kind === "block" || this.kind === "preview"; }

    toDOM(view) {
        const el = document.createElement(this.isBlock ? "div" : "span");
        el.className = "cm-math " + ({
            inline: "cm-math-inline",
            display: "cm-math-inline cm-math-display",
            block: "cm-math-block",
            preview: "cm-math-block cm-math-preview",
        })[this.kind];
        // Math reads left to right even on a Hebrew line, and doesn't reorder the text around it.
        el.dir = "ltr";

        // Raw TeX until the SVG is ready. A cached render resolves in the same microtask flush,
        // before the browser paints, so redraws don't flash.
        el.classList.add("cm-math-loading");
        el.textContent = this.tex;
        renderTex(this.tex, { display: this.display }).then((out) => {
            el.classList.remove("cm-math-loading");
            el.innerHTML = out; // sanitized in renderTex
            if (el.isConnected) view.requestMeasure();
        }, (err) => {
            // Keep the raw TeX on screen; never let a render failure escape into the editor.
            console.error("Math render failed:", err);
        });
        return el;
    }

    eq(other) {
        return other.tex === this.tex && other.kind === this.kind;
    }

    // Clicks reach the editor's handlers (mathClick below opens the TeX for editing).
    ignoreEvent() {
        return false;
    }
}

const touches = (selection, from, to) => selection.ranges.some((r) => r.from <= to && r.to >= from);

function buildMath(state) {
    const decorations = [];
    if (state.doc.length === 0) return Decoration.none;
    const { selection, doc } = state;

    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.name === "InlineMath") {
                if (!touches(selection, node.from, node.to)) {
                    const display = doc.sliceString(node.from, node.from + 2) === "$$";
                    decorations.push(Decoration.replace({
                        widget: new MathWidget(mathSource(doc, node.node), display ? "display" : "inline"),
                    }).range(node.from, node.to));
                }
                return false;
            }
            if (node.name === "BlockMath") {
                if (!isClosedBlock(node.node)) return false;
                const tex = mathSource(doc, node.node);
                // Block widgets must cover whole lines (a block inside "> " included).
                const from = doc.lineAt(node.from).from, to = doc.lineAt(node.to).to;
                if (!touches(selection, from, to)) {
                    decorations.push(Decoration.replace({ widget: new MathWidget(tex, "block"), block: true }).range(from, to));
                } else {
                    decorations.push(Decoration.widget({ widget: new MathWidget(tex, "preview"), block: true, side: 1 }).range(to));
                }
                return false;
            }
        },
    });
    return Decoration.set(decorations, true);
}

// A StateField, not a ViewPlugin: block math replaces line breaks, which only a field may do.
// Rebuilt on the same triggers as livePreview (the parse is time-sliced, so tree changes count).
const mathField = StateField.define({
    create: buildMath,
    update(decorations, tr) {
        if (tr.docChanged || tr.selection || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
            return buildMath(tr.state);
        }
        return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
});

const mathTheme = EditorView.baseTheme({
    ".cm-math": { unicodeBidi: "isolate" },
    ".cm-math-inline svg": { verticalAlign: "middle" },
    ".cm-math-display, .cm-math-block": { display: "block", textAlign: "center", margin: "0.5em 0", overflowX: "auto" },
    ".cm-math-display": { display: "inline-block", width: "100%" },
    ".cm-math-preview": { opacity: "0.85", borderTop: "1px dashed var(--background-modifier-border, #8884)", paddingTop: "0.25em" },
    ".cm-math-loading": { fontFamily: "var(--font-monospace, monospace)", opacity: "0.6" },
    ".cm-math [data-mjx-error] text, .cm-math svg[data-mjx-error] text": { fill: "var(--text-error, #d33)" },
    ".cm-math [data-mjx-error] rect": { fill: "transparent" },
});

// Clicking rendered math puts the caret just inside its opening delimiter, so the TeX opens
// wherever on the formula you click (a plain coordinate hit would land past the end).
const mathClick = EditorView.domEventHandlers({
    mousedown(event, view) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        const el = event.target instanceof Element ? event.target.closest(".cm-math") : null;
        if (!el || el.classList.contains("cm-math-preview")) return false;
        const from = view.posAtDOM(el);
        const mark = view.state.doc.sliceString(from, from + 2) === "$$" ? 2 : 1;
        view.dispatch({ selection: { anchor: Math.min(from + mark, view.state.doc.length) } });
        view.focus();
        event.preventDefault();
        return true;
    },
});

export const mathPreview = [mathField, mathTheme, mathClick];
