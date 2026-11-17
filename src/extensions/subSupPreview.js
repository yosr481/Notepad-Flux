import { EditorView, Decoration } from "@codemirror/view";
import { StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isCursorTouching } from "./selection";

const hide = Decoration.replace({});
const CLASS = { Subscript: "cm-subscript", Superscript: "cm-superscript" };
const contentMark = { Subscript: Decoration.mark({ class: CLASS.Subscript }), Superscript: Decoration.mark({ class: CLASS.Superscript }) };

function build(state) {
    const tree = syntaxTree(state);
    const nodes = [];
    tree.iterate({ enter: (n) => { if (CLASS[n.name]) nodes.push({ name: n.name, from: n.from, to: n.to }); } });
    return withSelection({ tree, nodes }, state);
}

// The only selection input: which nodes it touches. Same decoration set while that stays the same.
function withSelection(value, state) {
    const key = value.nodes.map((n) => (isCursorTouching(state.selection, n.from, n.to) ? 1 : 0)).join("");
    if (value.decos && key === value.key) return value;
    const ranges = [];
    value.nodes.forEach((n, i) => {
        if (key[i] === "1") return;
        ranges.push(hide.range(n.from, n.from + 1), contentMark[n.name].range(n.from + 1, n.to - 1), hide.range(n.to - 1, n.to));
    });
    return { ...value, key, decos: Decoration.set(ranges, true) };
}

const subSupField = StateField.define({
    create: build,
    update(value, tr) {
        if (tr.docChanged || syntaxTree(tr.state) !== value.tree) return build(tr.state);
        return tr.selection ? withSelection(value, tr.state) : value;
    },
    provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});

export const subSupPreview = subSupField;
