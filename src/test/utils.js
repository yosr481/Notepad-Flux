import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";

export function createEditor(doc, extensions = []) {
    const parent = document.createElement('div');
    const state = EditorState.create({
        doc,
        extensions: [
            markdown(),
            ...extensions
        ]
    });

    const view = new EditorView({
        state,
        parent
    });

    return { state, view, parent };
}
