import { WidgetType, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import DOMPurify from 'dompurify';

class LinkWidget extends WidgetType {
    constructor(text, url, style = {}) {
        super();
        this.text = text;
        this.url = url;
        this.style = style; // { bold: boolean, italic: boolean }
    }

    toDOM(view) {
        const link = document.createElement("a");
        link.className = "cm-link";
        link.href = this.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        // Apply inherited styles
        if (this.style.bold) link.style.fontWeight = "bold";
        if (this.style.italic) link.style.fontStyle = "italic";

        const textSpan = document.createElement("span");
        // Parse markdown formatting in link text
        textSpan.innerHTML = DOMPurify.sanitize(this.parseMarkdown(this.text));
        link.appendChild(textSpan);

        const icon = document.createElement("span");
        icon.className = "cm-link-icon";
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        link.appendChild(icon);

        return link;
    }

    parseMarkdown(text) {
        // Escape HTML to prevent XSS
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // IMPORTANT: The order matters. Combined usage first.

        // Bold and Italic: ***text*** or ___text___
        // Logic: *** matches bold(*) + italic(**) or bold(**) + italic(*)
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
        html = html.replace(/___(.*?)___/g, "<strong><em>$1</em></strong>");

        // Bold: **text** or __text__
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

        // Italic: *text* or _text_
        html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
        html = html.replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, "<em>$1</em>");

        // Strikethrough: ~~text~~
        html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

        // Inline code: `text`
        html = html.replace(/`(.*?)`/g, "<code>$1</code>");

        return html;
    }

    eq(other) {
        return other.text === this.text &&
            other.url === this.url &&
            other.style?.bold === this.style?.bold &&
            other.style?.italic === this.style?.italic;
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

// Helper: Check if cursor touches the range [from, to]
const isCursorTouching = (selection, from, to) => {
    return selection.ranges.some(range => range.from <= to && range.to >= from);
};

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
        const { state } = view;
        const { selection, doc } = state;

        // Iterate over the syntax tree to find Links
        syntaxTree(state).iterate({
            enter: (node) => {
                if (node.name !== "Link") return;

                const { from, to } = node;

                // Check if cursor is active inside or touching the link
                let shouldReveal = isCursorTouching(selection, from, to);

                // Check for surrounding emphasis (Bold/Italic)
                let bold = false;
                let italic = false;
                let parent = node.node.parent;

                // Traverse up to find Emphasis/StrongEmphasis
                // and also check if cursor is touching those outer marks to reveal everything
                while (parent) {
                    if (parent.name === "StrongEmphasis" || parent.name === "Emphasis") {
                        if (parent.name === "StrongEmphasis") bold = true;
                        if (parent.name === "Emphasis") italic = true;

                        // If cursor is touching the outer emphasis, reveal the link
                        if (isCursorTouching(selection, parent.from, parent.to)) {
                            shouldReveal = true;
                        }

                        parent = parent.parent; // continue moving up
                    } else {
                        break;
                    }
                }

                if (!shouldReveal) {
                    let urlNode = node.node.getChild("URL");

                    // Fallback using regex if we can't easily isolate the URL node or just to be safe with text extraction
                    const textContentFull = doc.sliceString(from, to);

                    // Ignore image links which start with !
                    if (textContentFull.startsWith("!")) return;

                    const match = textContentFull.match(/^\[(.*?)\]\(([^"\s)]+)(?:\s+"(.*?)")?\)/);

                    if (match) {
                        // double check with urlNode if it exists to be precise? 
                        // Actually the replacement range is [from, to] so regex matching the whole slice is correct.

                        const linkText = match[1];
                        const linkUrl = match[2];

                        builder.add(from, to, Decoration.replace({
                            widget: new LinkWidget(linkText, linkUrl, { bold, italic }),
                            inclusive: false
                        }));
                    }
                }
            }
        });

        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});