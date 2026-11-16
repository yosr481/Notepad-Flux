import { ViewPlugin } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

// Factory for creating debounced decoration plugins
// Used by plugins that need to update decorations on doc changes but want to debounce
// computation for large documents to avoid performance issues

export function makeDebouncedDecorationPlugin({ compute, threshold = 1000, delay = 300 }) {
    return ViewPlugin.fromClass(
        class {
            constructor(view) {
                this.decorations = this.computeDecorations(view);
                this.debounceTimer = null;
                this.pendingView = null;
            }

            update(update) {
                const docSize = update.state.doc.lines;
                const isLargeDoc = docSize > threshold;

                // The markdown parse is time-sliced: on a long doc the rest of the tree
                // (e.g. link definitions at the end) arrives in a transaction with none
                // of the other flags. Same check as livePreview.
                const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
                if (update.docChanged || update.viewportChanged || update.selectionSet || treeChanged) {
                    // Edits and parse-only updates on a large doc are debounced alike; the
                    // background parse would otherwise rescan the whole doc once per slice.
                    if (isLargeDoc && (update.docChanged || treeChanged)) {
                        clearTimeout(this.debounceTimer);
                        this.pendingView = update.view;
                        this.debounceTimer = setTimeout(() => {
                            if (this.pendingView) {
                                this.decorations = this.computeDecorations(this.pendingView);
                                this.pendingView.dispatch({});
                            }
                        }, delay);
                    } else {
                        this.decorations = this.computeDecorations(update.view);
                    }
                }
            }

            destroy() {
                clearTimeout(this.debounceTimer);
            }

            computeDecorations(view) {
                return compute(view);
            }
        },
        { decorations: v => v.decorations }
    );
}
