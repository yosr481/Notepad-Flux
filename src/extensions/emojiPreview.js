import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isCursorTouching } from "./selection";
import { emojiFor } from "../utils/emojiTable";

class EmojiWidget extends WidgetType {
    constructor(name) { super(); this.name = name; }
    eq(other) { return other instanceof EmojiWidget && other.name === this.name; }
    toDOM() {
        const el = document.createElement("span");
        el.className = "cm-emoji";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", this.name);
        el.textContent = emojiFor(this.name);
        return el;
    }
}

function build(state) {
    const tree = syntaxTree(state);
    const nodes = [];
    tree.iterate({
        enter: (n) => {
            if (n.name !== "Emoji") return;
            const name = state.sliceDoc(n.from + 1, n.to - 1);
            if (emojiFor(name) !== undefined) nodes.push({ name, from: n.from, to: n.to });
        },
    });
    return withSelection({ tree, nodes }, state);
}

// The only selection input: which nodes it touches. Same decoration set while that stays the same.
function withSelection(value, state) {
    const key = value.nodes.map((n) => (isCursorTouching(state.selection, n.from, n.to) ? 1 : 0)).join("");
    if (value.decos && key === value.key) return value;
    const ranges = [];
    value.nodes.forEach((n, i) => {
        if (key[i] !== "1") ranges.push(Decoration.replace({ widget: new EmojiWidget(n.name) }).range(n.from, n.to));
    });
    return { ...value, key, decos: Decoration.set(ranges, true) };
}

export const emojiPreview = StateField.define({
    create: build,
    update(value, tr) {
        if (tr.docChanged || syntaxTree(tr.state) !== value.tree) return build(tr.state);
        return tr.selection ? withSelection(value, tr.state) : value;
    },
    provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});
