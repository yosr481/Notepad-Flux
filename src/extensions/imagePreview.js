import { WidgetType, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class ImageWidget extends WidgetType {
    constructor(url, alt) {
        super();
        this.url = url;
        this.alt = alt;
    }

    toDOM(view) {
        const container = document.createElement("span");
        container.className = "cm-image-container";

        const img = document.createElement("img");
        img.src = this.url;
        img.alt = this.alt;
        img.className = "cm-image";
        img.title = this.alt;

        img.onerror = () => {
            // Replace img with broken image icon and text
            container.className = "cm-image-broken";
            container.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cm-broken-icon"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><line x1="3" x2="21" y1="3" y2="21"/></svg>
                <span class="cm-broken-text">${this.alt || "Image not found"}</span>
            `;
        };

        container.appendChild(img);
        return container;
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
            } else {
                // Cursor is inside: Show text AND the image (to prevent jumping)
                const alt = match[1];
                const url = match[2];
                // Add widget after the text
                builder.add(end, end, Decoration.widget({
                    widget: new ImageWidget(url, alt),
                    side: 1
                }));
            }
        }

        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
