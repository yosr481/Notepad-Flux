import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isCursorOnLine } from "./selection";
import { scanCallout, calloutTitle, CALLOUT_TYPES } from "./calloutSyntax";
import { lucideSvg } from "../utils/lucideSvg";

// Callouts, Docs/internal/callouts-spec.md ("Editor behaviour"). Fold state is view state: `flipped` holds
// header positions (the "[" of "[!type]") whose fold differs from the `-`/`+` default.
const toggleFold = StateEffect.define();

// Every callout, outer before inner: the "[" position, scan, blockquote range and header line.
function findCallouts(state) {
    const { doc } = state;
    const found = [];
    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.name !== "Blockquote") return;
            const line = doc.lineAt(node.from);
            const text = line.text.slice(node.from - line.from);
            if (text[0] !== ">") return;
            const from = node.from + (text[1] === " " ? 2 : 1);
            const scan = scanCallout(line.text.slice(from - line.from));
            if (scan) found.push({ from, scan, line, quoteFrom: node.from, lastLine: doc.lineAt(node.to - 1) });
        },
    });
    return found;
}

const isFolded = (c, flipped) => (c.scan.fold === "-") !== flipped.has(c.from);
const inBody = (c, selection) => selection.ranges.some((r) => r.to > c.line.to && r.from <= c.lastLine.to);

class CalloutHeaderWidget extends WidgetType {
    constructor(canonical, label, foldable, folded) {
        super();
        this.canonical = canonical;
        this.label = label;
        this.foldable = foldable;
        this.folded = folded;
    }

    toDOM() {
        const el = document.createElement("span");
        el.className = "cm-callout-header";
        if (this.foldable) {
            const fold = document.createElement("span");
            fold.className = "cm-callout-fold" + (this.folded ? " cm-callout-folded" : "");
            const chevron = lucideSvg("chevron-down", "cm-callout-chevron");
            if (chevron) fold.appendChild(chevron);
            el.appendChild(fold);
        }
        const icon = lucideSvg(CALLOUT_TYPES[this.canonical].icon, "cm-callout-icon");
        if (icon) {
            icon.setAttribute("style", "unicode-bidi: isolate");
            el.appendChild(icon);
        }
        if (this.label !== null) {
            const title = document.createElement("span");
            title.className = "cm-callout-title";
            title.dir = "auto";
            title.textContent = this.label;
            el.appendChild(title);
        }
        return el;
    }

    eq(o) {
        return o.canonical === this.canonical && o.label === this.label && o.foldable === this.foldable && o.folded === this.folded;
    }

    ignoreEvent() {
        return false;
    }
}

function build(state, flipped, callouts) {
    const { doc, selection } = state;
    const lineClass = new Map(); // line.from -> class; inner callouts overwrite outer ones
    const out = [];
    let hiddenTo = -1;
    for (const c of callouts) {
        if (c.from < hiddenTo) continue; // inside a folded outer callout
        const { scan, line } = c;
        for (let l = line; ; l = doc.line(l.number + 1)) {
            lineClass.set(l.from, `cm-callout cm-callout-${scan.canonical}`);
            if (l.number === c.lastLine.number) break;
        }
        const ws = /^[ \t]*/.exec(line.text.slice(c.from - line.from + scan.markEnd))[0].length;
        const titleFrom = c.from + scan.markEnd + ws;
        if (scan.title) out.push(Decoration.mark({ class: "cm-callout-title", attributes: { dir: "auto" } }).range(titleFrom, line.to - (line.text.length - line.text.trimEnd().length)));
        const folded = isFolded(c, flipped);
        if (!isCursorOnLine(selection, doc, c.from)) {
            const widget = new CalloutHeaderWidget(scan.canonical, scan.title ? null : calloutTitle(scan), scan.fold !== "", folded);
            out.push(Decoration.replace({ widget }).range(c.from, titleFrom));
        }
        if (folded && c.lastLine.to > line.to) {
            out.push(Decoration.replace({ block: true }).range(line.to, c.lastLine.to));
            hiddenTo = c.lastLine.to;
        }
    }
    for (const [from, cls] of lineClass) out.push(Decoration.line({ class: cls }).range(from));
    return Decoration.set(out, true);
}

const calloutField = StateField.define({
    create(state) {
        const flipped = new Set();
        const callouts = findCallouts(state);
        return { flipped, callouts, decos: build(state, flipped, callouts) };
    },
    update(value, tr) {
        let { flipped, callouts } = value;
        const toggles = tr.effects.filter((e) => e.is(toggleFold));
        const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state);
        if (!tr.docChanged && !tr.selection && !toggles.length && !treeChanged) return value;
        if (tr.docChanged) {
            // A deleted "[" is gone, but mapPos(p) at a deletion start lands on the next header's "[", so check the deleted ranges.
            const deleted = [];
            tr.changes.iterChanges((fromA, toA) => deleted.push([fromA, toA]));
            flipped = new Set([...flipped].filter((p) => !deleted.some(([f, t]) => p >= f && p < t)).map((p) => tr.changes.mapPos(p, 1)));
        } else flipped = new Set(flipped);
        if (tr.docChanged || treeChanged) {
            callouts = findCallouts(tr.state);
            const headers = new Set(callouts.map((c) => c.from));
            for (const p of flipped) if (!headers.has(p)) flipped.delete(p);
        }
        const flip = (p) => (flipped.delete(p) ? 0 : flipped.add(p));
        for (const e of toggles) flip(e.value);
        if (tr.selection) {
            for (const c of callouts) if (isFolded(c, flipped) && inBody(c, tr.state.selection)) flip(c.from);
        }
        return { flipped, callouts, decos: build(tr.state, flipped, callouts) };
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.decos),
});

// Arrow keys move over the block replace in one step, so the caret lands past the hidden body and inBody never
// fires. Rewrite such a jump (not mouse clicks) to land inside the body, which then unfolds it.
const unfoldOnJump = EditorState.transactionFilter.of((tr) => {
    if (tr.docChanged || !tr.selection || !tr.isUserEvent("select") || tr.isUserEvent("select.pointer")) return tr;
    const { doc, selection } = tr.startState;
    if (selection.ranges.length > 1 || tr.newSelection.ranges.length > 1) return tr;
    const { flipped, callouts } = tr.startState.field(calloutField);
    const oldHead = selection.main.head;
    const { anchor, head } = tr.newSelection.main;
    const oldLine = doc.lineAt(oldHead).number;
    const newLine = doc.lineAt(head).number;
    for (const c of callouts) {
        if (!isFolded(c, flipped) || c.lastLine.to === c.line.to) continue;
        // Only a one-line step across the fold; far jumps (Ctrl+End, Select All, find-next) pass through.
        const down = oldLine === c.line.number && newLine === c.lastLine.number + 1;
        const up = oldLine === c.lastLine.number + 1 && newLine === c.line.number;
        if (!down && !up) continue;
        const target = doc.line(down ? c.line.number + 1 : c.lastLine.number);
        const col = oldHead - doc.lineAt(oldHead).from;
        return [tr, { selection: EditorSelection.single(anchor, Math.min(target.from + col, target.to)) }];
    }
    return tr;
});

const calloutTheme = EditorView.baseTheme({
    ".cm-callout-header": { unicodeBidi: "isolate", display: "inline-flex", alignItems: "center", gap: "0.4em", fontWeight: "600" },
    ".cm-callout-title": { unicodeBidi: "isolate" },
    ".cm-callout-icon": { flex: "none", color: "var(--callout-color)" },
    ".cm-callout-fold": { cursor: "pointer", display: "inline-flex", marginInlineStart: "0.3em" },
    ".cm-callout-chevron": { transition: "transform 0.15s" },
    ".cm-callout-fold:not(.cm-callout-folded) .cm-callout-chevron": { transform: "rotate(180deg)" },
});

const calloutClick = EditorView.domEventHandlers({
    mousedown(event, view) {
        if (event.button !== 0) return false;
        const el = event.target instanceof Element ? event.target.closest(".cm-callout-fold") : null;
        if (!el) return false;
        const pos = view.posAtDOM(el);
        const { flipped, callouts } = view.state.field(calloutField);
        const c = callouts.find((k) => k.from === pos);
        // Folding with the caret in the body would hide it and the next key would re-open the fold.
        const moveCaret = c && !isFolded(c, flipped) && inBody(c, view.state.selection);
        view.dispatch({ effects: toggleFold.of(pos), selection: moveCaret ? { anchor: c.line.to } : undefined });
        event.preventDefault();
        return true;
    },
});

export const calloutPreview = [calloutField, unfoldOnJump, calloutTheme, calloutClick];
