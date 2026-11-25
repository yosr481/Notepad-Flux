import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { findDetails } from "./detailsSyntax";
import { lucideSvg } from "../utils/lucideSvg";

// `<details>` regions, Docs/internal/details-spec.md ("Editor (T2)"). Mirrors callouts.js. Fold state is view state:
// `flips` maps region.from -> the `open` it was flipped under; folded = (open === flipped). A flip whose `open` changed is dropped.
const toggleFold = StateEffect.define();

const isFolded = (r, flips) => r.open === flips.has(r.from);
const touches = (selection, from, to) => selection.ranges.some((s) => s.from <= to && s.to >= from);
const inBody = (r, selection) => selection.ranges.some((s) => s.to > r.headerTo && s.from <= r.closeTo);

// Per region: header touched / closing line touched. The only selection input to the decorations besides `flips`.
const cursorKey = (regions, selection) =>
    regions.map((r) => (touches(selection, r.from, r.headerTo) ? "h" : "") + (touches(selection, r.closeFrom, r.closeTo) ? "c" : "")).join(",");

class DetailsHeaderWidget extends WidgetType {
    constructor(label, folded) {
        super();
        this.label = label;
        this.folded = folded;
    }

    toDOM() {
        const el = document.createElement("span");
        el.className = "cm-details-header";
        const fold = document.createElement("span");
        fold.className = "cm-details-fold" + (this.folded ? " cm-details-folded" : "");
        const chevron = lucideSvg("chevron-down", "cm-details-chevron");
        if (chevron) fold.appendChild(chevron);
        el.appendChild(fold);
        const title = document.createElement("span");
        title.className = "cm-details-title";
        title.dir = "auto";
        title.textContent = this.label;
        el.appendChild(title);
        return el;
    }

    eq(o) {
        return o.label === this.label && o.folded === this.folded;
    }

    ignoreEvent() {
        return false;
    }
}

function build(state, flips, regions) {
    const { doc, selection } = state;
    const out = [];
    let hiddenTo = -1;
    for (const r of regions) {
        if (r.from < hiddenTo) continue; // inside a folded outer region
        const folded = isFolded(r, flips);
        if (!touches(selection, r.from, r.headerTo)) out.push(Decoration.replace({ widget: new DetailsHeaderWidget(r.label, folded) }).range(r.from, r.headerTo));
        if (folded) {
            out.push(Decoration.replace({ block: true }).range(r.headerTo, r.closeTo));
            hiddenTo = r.closeTo;
            continue;
        }
        if (r.bodyFrom <= r.bodyTo) {
            for (let n = doc.lineAt(r.bodyFrom).number; n <= doc.lineAt(r.bodyTo).number; n++) out.push(Decoration.line({ class: "cm-details-body" }).range(doc.line(n).from));
        }
        out.push(Decoration.line({ class: "cm-details-end" }).range(r.closeFrom));
        if (!touches(selection, r.closeFrom, r.closeTo)) out.push(Decoration.replace({}).range(r.closeFrom, r.closeTo));
    }
    return Decoration.set(out, true);
}

const detailsField = StateField.define({
    create(state) {
        const flips = new Map();
        const regions = findDetails(state);
        return { flips, regions, key: cursorKey(regions, state.selection), decos: build(state, flips, regions) };
    },
    update(value, tr) {
        let { flips, regions } = value;
        const toggles = tr.effects.filter((e) => e.is(toggleFold));
        const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state);
        if (!tr.docChanged && !tr.selection && !toggles.length && !treeChanged) return value;
        let flipsChanged = toggles.length > 0;
        if (tr.docChanged) {
            // mapPos at a deletion start lands on whatever follows, so drop flips whose opening line start was deleted.
            const deleted = [];
            tr.changes.iterChanges((fromA, toA) => deleted.push([fromA, toA]));
            flips = new Map([...flips].filter(([p]) => !deleted.some(([f, t]) => p >= f && p < t)).map(([p, o]) => [tr.changes.mapPos(p, 1), o]));
        } else flips = new Map(flips);
        if (tr.docChanged || treeChanged) {
            regions = findDetails(tr.state);
            const opens = new Map(regions.map((r) => [r.from, r.open]));
            for (const [p, o] of flips) if (opens.get(p) !== o) flips.delete(p);
        }
        const flip = (r) => (flips.delete(r.from) ? 0 : flips.set(r.from, r.open));
        for (const e of toggles) {
            const r = regions.find((k) => k.from === e.value);
            if (r) flip(r);
        }
        if (tr.selection) {
            for (const r of regions) {
                if (isFolded(r, flips) && inBody(r, tr.state.selection)) { flip(r); flipsChanged = true; }
            }
        }
        const key = cursorKey(regions, tr.state.selection);
        if (!tr.docChanged && !treeChanged && !flipsChanged && key === value.key) return value;
        return { flips, regions, key, decos: build(tr.state, flips, regions) };
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.decos),
});

// Same arrow-key rewrite as callouts' unfoldOnJump: a one-line step over the block replace would skip the body.
const unfoldOnJump = EditorState.transactionFilter.of((tr) => {
    if (tr.docChanged || !tr.selection || !tr.isUserEvent("select") || tr.isUserEvent("select.pointer")) return tr;
    const { doc, selection } = tr.startState;
    if (selection.ranges.length > 1 || tr.newSelection.ranges.length > 1) return tr;
    const { flips, regions } = tr.startState.field(detailsField);
    const oldHead = selection.main.head;
    const { anchor, head } = tr.newSelection.main;
    const oldLine = doc.lineAt(oldHead).number;
    const newLine = doc.lineAt(head).number;
    for (const r of regions) {
        if (!isFolded(r, flips)) continue;
        const headerLine = doc.lineAt(r.headerTo).number;
        const closeLine = doc.lineAt(r.closeTo).number;
        const down = oldLine === headerLine && newLine === closeLine + 1;
        const up = oldLine === closeLine + 1 && newLine === headerLine;
        if (!down && !up) continue;
        const target = doc.line(down ? headerLine + 1 : closeLine - 1);
        const col = oldHead - doc.lineAt(oldHead).from;
        return [tr, { selection: EditorSelection.single(anchor, Math.min(target.from + col, target.to)) }];
    }
    return tr;
});

const detailsTheme = EditorView.baseTheme({
    ".cm-details-header": { unicodeBidi: "isolate", display: "inline-flex", alignItems: "center", gap: "0.4em", fontWeight: "600" },
    ".cm-details-title": { unicodeBidi: "isolate" },
    ".cm-details-fold": { cursor: "pointer", display: "inline-flex", color: "var(--text-muted)" },
    ".cm-details-chevron": { transition: "transform 0.15s" },
    ".cm-details-folded .cm-details-chevron": { transform: "rotate(-90deg)" },
    ".cm-details-body, .cm-details-end": { borderInlineStart: "2px solid var(--text-muted)", paddingInlineStart: "0.8em", marginInlineStart: "0.4em" },
});

const detailsClick = EditorView.domEventHandlers({
    mousedown(event, view) {
        if (event.button !== 0) return false;
        const el = event.target instanceof Element ? event.target.closest(".cm-details-fold") : null;
        if (!el) return false;
        const pos = view.posAtDOM(el);
        const { flips, regions } = view.state.field(detailsField);
        const r = regions.find((k) => k.from === pos);
        // Folding with the caret in the body would hide it and the next key would re-open the fold.
        const moveCaret = r && !isFolded(r, flips) && inBody(r, view.state.selection);
        view.dispatch({ effects: toggleFold.of(pos), selection: moveCaret ? { anchor: r.headerTo } : undefined });
        event.preventDefault();
        return true;
    },
});

export const detailsPreview = [detailsField, unfoldOnJump, detailsTheme, detailsClick];
