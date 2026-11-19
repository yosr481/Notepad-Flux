import { StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { isCursorTouching } from "./selection";

// StateField that rebuilds its decorations with build(state) on doc, selection and syntax-tree
// changes (the parse is time-sliced, so tree changes count). Otherwise keeps the same set, unmapped.
export function decorationField(build) {
    return StateField.define({
        create: build,
        update(decorations, tr) {
            if (tr.docChanged || tr.selection || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
                return build(tr.state);
            }
            return decorations;
        },
        provide: (field) => EditorView.decorations.from(field),
    });
}

// Like decorationField, but the tree/doc work lives in collect(state) -> items ({from, to, ...}) and runs only
// on doc or syntax-tree changes. A selection-only move re-derives which items it touches (isCursorTouching) and
// keeps the same DecorationSet while that is unchanged; otherwise decorate(items, touched[]) -> DecorationSet.
export function selectionKeyedField({ collect, decorate }) {
    const withSelection = (value, state) => {
        const touched = value.items.map((n) => isCursorTouching(state.selection, n.from, n.to));
        const key = touched.map(Number).join("");
        if (value.decos && key === value.key) return value;
        return { ...value, key, decos: decorate(value.items, touched) };
    };
    const build = (state) => withSelection({ tree: syntaxTree(state), items: collect(state) }, state);
    return StateField.define({
        create: build,
        update(value, tr) {
            if (tr.docChanged || syntaxTree(tr.state) !== value.tree) return build(tr.state);
            return tr.selection ? withSelection(value, tr.state) : value;
        },
        provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
    });
}
