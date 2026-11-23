import { WidgetType, Decoration } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isCursorTouching } from './selection';
import { makeDebouncedDecorationPlugin } from "./decorationPlugin";
import { resolveReference, getVisibleTextBetweenMarks, normalizeDestination } from "./linkDefs";
import { isSafeExternalUrl } from "./linkHandler";
import { linkLabelParts, appendParts } from "./tableCells";
import { resolveFootnotes } from "./footnotes";

class LinkWidget extends WidgetType {
    constructor(text, url, style = {}, parts = [text]) {
        super();
        this.text = text;
        this.url = url;
        this.parts = parts; // label as tableCells parts (sub/sup/emoji/math/footnote/highlight...)
        this.style = style; // { bold: boolean, italic: boolean }
    }

    toDOM(view) {
        const link = document.createElement("a");
        link.className = "cm-link";
        if (isSafeExternalUrl(this.url)) link.href = this.url;   // no href for javascript:/file:/etc; same allowlist as ctrl+click
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        // Apply inherited styles
        if (this.style.bold) link.style.fontWeight = "bold";
        if (this.style.italic) link.style.fontStyle = "italic";

        const textSpan = document.createElement("span");
        appendParts(textSpan, this.parts, view);
        link.appendChild(textSpan);

        const icon = document.createElement("span");
        icon.className = "cm-link-icon";
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        link.appendChild(icon);

        return link;
    }

    eq(other) {
        return other.text === this.text &&
            JSON.stringify(other.parts) === JSON.stringify(this.parts) &&
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

function computeLinkDecorations(view) {
    const builder = new RangeSetBuilder();
    const { state } = view;
    const { selection, doc } = state;
    let footnotes; // resolved lazily, once per pass
    const partsOf = (n, text) => {
        if (!/[*_~^=`$:[&<\\]/.test(text)) return [text]; // no inline-construct starter: skip the walk
        footnotes ??= resolveFootnotes(state);
        return linkLabelParts(state, n, footnotes) ?? [text];
    };

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
                // #14: skip image-in-link
                if (node.node.getChild("Image")) return;

                // Fallback using regex if we can't easily isolate the URL node or just to be safe with text extraction
                const textContentFull = doc.sliceString(from, to);

                // Ignore image links which start with !
                if (textContentFull.startsWith("!")) return;

                const urlNode = node.node.getChild("URL");

                if (urlNode) {
                    const linkText = getVisibleTextBetweenMarks(node.node, doc);
                    const linkUrl = normalizeDestination(doc.sliceString(urlNode.from, urlNode.to));

                    builder.add(from, to, Decoration.replace({
                        widget: new LinkWidget(linkText, linkUrl, { bold, italic }, partsOf(node.node, linkText)),
                        inclusive: false
                    }));
                } else {
                    // #8: reference-style link resolution (shared with livePreview)
                    const visibleText = getVisibleTextBetweenMarks(node.node, doc);
                    const def = resolveReference(node.node, state);
                    if (def) {
                        builder.add(from, to, Decoration.replace({
                            widget: new LinkWidget(visibleText, def.url, { bold, italic }, partsOf(node.node, visibleText)),
                            inclusive: false
                        }));
                    }
                }
            }
        }
    });

    return builder.finish();
}

export const linkPreview = makeDebouncedDecorationPlugin({ compute: computeLinkDecorations });