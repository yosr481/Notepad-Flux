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

        link.style.color = "var(--text-accent)";
        link.style.textDecoration = "underline";

        const textSpan = document.createElement("span");
        // Parse markdown formatting in link text
        textSpan.innerHTML = this.parseMarkdown(this.text);
        link.appendChild(textSpan);

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

    parseMarkdown(text) {
        // Escape HTML to prevent XSS
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Parse bold and italic (order matters to handle combined formatting)
        // Bold and italic: ***text*** or ___text___
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
        html = html.replace(/\_\_\_(.*?)\_\_\_/g, "<strong><em>$1</em></strong>");

        // Bold: **text** or __text__
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\_\_(.*?)\_\_/g, "<strong>$1</strong>");

        // Italic: *text* or _text_
        html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
        html = html.replace(/\_(.*?)\_/g, "<em>$1</em>");

        // Strikethrough: ~~text~~
        html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

        // Inline code: `text`
        html = html.replace(/`(.*?)`/g, "<code>$1</code>");

        return html;
    }

    eq(other) {
        return other.text === this.text && other.url === this.url;
    }

    ignoreEvent(event) {
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
        this.debounceTimer = null;
        this.pendingView = null;
    }

    update(update) {
        const docSize = update.state.doc.lines;
        const isLargeDoc = docSize > 1000;

        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            if (isLargeDoc && update.docChanged) {
                clearTimeout(this.debounceTimer);
                this.pendingView = update.view;
                this.debounceTimer = setTimeout(() => {
                    if (this.pendingView) {
                        this.decorations = this.computeDecorations(this.pendingView);
                        this.pendingView.requestMeasure();
                    }
                }, 300);
            } else {
                this.decorations = this.computeDecorations(update.view);
            }
        }
    }

    destroy() {
        clearTimeout(this.debounceTimer);
    }

    computeDecorations(view) {
        const builder = new RangeSetBuilder();
        const { from: selFrom, to: selTo } = view.state.selection.main;

        for (const { from, to } of view.visibleRanges) {
            const text = view.state.doc.sliceString(from, to);
            linkMatcher.lastIndex = 0;
            let match;

            while ((match = linkMatcher.exec(text))) {
                const start = from + match.index;
                const end = start + match[0].length;

                const isCursorInside = (selFrom <= end) && (selTo >= start);

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
        }

        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});