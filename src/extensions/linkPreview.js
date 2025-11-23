import { WidgetType, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class LinkWidget extends WidgetType {
    constructor(text, url) {
        super();
        this.text = text;
        this.url = url;
    }

    toDOM(view) {
        const link = document.createElement("a");
        link.textContent = this.text;
        link.href = this.url;
        link.className = "cm-link";
        link.target = "_blank"; // Open in new tab
        link.rel = "noopener noreferrer";
        return link;
    }

    eq(other) {
        return other.text === this.text && other.url === this.url;
    }

    ignoreEvent() {
        return false;
    }
}

const linkMatcher = /\[(.*?)\]\((.*?)\)/g;

export const linkPreview = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.computeDecorations(view);
    }

    update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.computeDecorations(update.view);
        }
    }

    computeDecorations(view) {
        const builder = new RangeSetBuilder();
        const { from, to } = view.viewport;
        const text = view.state.doc.sliceString(from, to);
        const cursor = view.state.selection.main.head;

        let match;
        while ((match = linkMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;

            // Check if cursor is inside the match or selection overlaps
            const { from: selFrom, to: selTo } = view.state.selection.main;
            const isCursorInside = (selFrom <= end) && (selTo >= start);

            // Avoid overlapping with images (images start with !)
            const isImage = start > 0 && view.state.doc.sliceString(start - 1, start) === '!';

            if (!isCursorInside && !isImage) {
                const textContent = match[1];
                const url = match[2];
                builder.add(start, end, Decoration.replace({
                    widget: new LinkWidget(textContent, url),
                    inclusive: false
                }));
            }
        }

        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
