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
        link.className = "cm-link";
        link.href = this.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        // Text content
        const textSpan = document.createElement("span");
        textSpan.textContent = this.text;
        link.appendChild(textSpan);

        // External link icon
        const icon = document.createElement("span");
        icon.className = "cm-link-icon";
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        icon.style.marginLeft = "4px";
        icon.style.opacity = "0.7";
        icon.style.display = "inline-flex";
        icon.style.verticalAlign = "middle";
        link.appendChild(icon);

        return link;
    }

    eq(other) {
        return other.text === this.text && other.url === this.url;
    }

    ignoreEvent(event) {
        // If Ctrl+Click (or Cmd+Click on Mac), let the browser handle it (open link)
        // and return true so CodeMirror ignores it (doesn't move cursor/reveal syntax)
        if (event.type === "mousedown" || event.type === "click") {
            if (event.ctrlKey || event.metaKey) {
                return true;
            }
        }
        return false;
    }
}

const linkMatcher = /\[(.*?)\]\(([^"\s]+)(?:\s+"(.*?)")?\)/g;

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
