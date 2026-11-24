import { Decoration, WidgetType } from "@codemirror/view";
import { selectionKeyedField } from "./decorationField";
import { nodesOf } from "./nodeIndex";
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

function collect(state) {
    const items = [];
    for (const n of nodesOf(state, "Emoji")) {
        const name = state.sliceDoc(n.from + 1, n.to - 1);
        if (emojiFor(name) !== undefined) items.push({ name, from: n.from, to: n.to });
    }
    return items;
}

const decorate = (items, touched) => Decoration.set(
    items.filter((_, i) => !touched.has(i)).map((n) => Decoration.replace({ widget: new EmojiWidget(n.name) }).range(n.from, n.to)), true);

export const emojiPreview = selectionKeyedField({ collect, decorate });
