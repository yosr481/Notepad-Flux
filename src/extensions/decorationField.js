import { StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

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
