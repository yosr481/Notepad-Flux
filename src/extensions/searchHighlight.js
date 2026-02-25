import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { getSearchQuery } from '@codemirror/search';

// Extension to highlight the current search match
const searchMatchHighlight = StateField.define({
    create() {
        return Decoration.none;
    },
    update(decorations, tr) {
        // Get the current search query
        const query = getSearchQuery(tr.state);

        if (!query || !query.search) {
            return Decoration.none;
        }

        // Get the current selection
        const selection = tr.state.selection.main;
        if (selection.empty) {
            return Decoration.none;
        }

        // Get the selected text
        const selectedText = tr.state.sliceDoc(selection.from, selection.to);

        // Check if the selection matches the search query
        const searchText = query.search;
        let matches = false;

        if (query.regexp) {
            try {
                const regex = new RegExp(searchText, query.caseSensitive ? '' : 'i');
                matches = regex.test(selectedText);
            } catch (e) {
                // Ignore invalid regex
            }
        } else {
            if (query.caseSensitive) {
                matches = selectedText === searchText;
            } else {
                matches = selectedText.toLowerCase() === searchText.toLowerCase();
            }
        }

        if (matches) {
            // Create decoration for the current match
            const deco = Decoration.mark({
                class: 'cm-searchMatch-selected'
            }).range(selection.from, selection.to);

            return Decoration.set([deco]);
        }

        return Decoration.none;
    },
    provide: f => EditorView.decorations.from(f)
});

export { searchMatchHighlight };
