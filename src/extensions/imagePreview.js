import { WidgetType, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class ImageWidget extends WidgetType {
    constructor(url, alt) {
        super();
        this.url = url;
        this.alt = alt;
    }

    toDOM(view) {
        const img = document.createElement("img");
        img.src = this.url;
        img.alt = this.alt;
        img.className = "cm-image";
        img.title = this.alt;
        return img;
    }
}

const imageMatcher = /!\[(.*?)\]\((.*?)\)/g;

export const imagePreview = ViewPlugin.fromClass(class {
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
        while ((match = imageMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;

            // Check if cursor is inside the match or selection overlaps
            const { from: selFrom, to: selTo } = view.state.selection.main;
            const isCursorInside = (selFrom <= end) && (selTo >= start);

            if (!isCursorInside) {
                const alt = match[1];
                const url = match[2];
                builder.add(start, end, Decoration.replace({
                    widget: new ImageWidget(url, alt),
                    inclusive: false
                }));
            }
        }

        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
