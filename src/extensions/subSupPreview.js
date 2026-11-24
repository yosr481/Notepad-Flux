import { Decoration } from "@codemirror/view";
import { selectionKeyedField } from "./decorationField";
import { nodesOf } from "./nodeIndex";

const hide = Decoration.replace({});
const contentMark = { Subscript: Decoration.mark({ class: "cm-subscript" }), Superscript: Decoration.mark({ class: "cm-superscript" }) };

const collect = (state) => [...nodesOf(state, "Subscript"), ...nodesOf(state, "Superscript")]
    .sort((a, b) => a.from - b.from)
    .map((n) => ({ name: n.node.name, from: n.from, to: n.to }));

function decorate(items, touched) {
    const ranges = [];
    items.forEach((n, i) => {
        if (touched.has(i)) return;
        ranges.push(hide.range(n.from, n.from + 1), contentMark[n.name].range(n.from + 1, n.to - 1), hide.range(n.to - 1, n.to));
    });
    return Decoration.set(ranges, true);
}

export const subSupPreview = selectionKeyedField({ collect, decorate });
