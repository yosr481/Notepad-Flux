import { EditorView, hoverTooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { resolveReference, normalizeDestination } from "./linkDefs";

// Scheme allowlist for URLs pulled straight from document content.
// Anything not http/https/mailto (file:, smb:, javascript:, custom protocols) is refused.
export const isSafeExternalUrl = (url) => {
    try {
        return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
    } catch {
        return false;
    }
};

// Tooltip to show "Ctrl + Click to open"
export const linkTooltip = hoverTooltip((view, pos, side) => {
    const { state } = view;
    const { selection } = state;

    // Check if cursor is touching the position (Active Mode)
    // If the cursor is inside the link, we don't want the tooltip because we are editing
    // We need to find the link node first to know its range
    const node = syntaxTree(state).resolveInner(pos, side);
    let linkNode = node;
    if (linkNode.name !== "Link") {
        if (linkNode.parent && linkNode.parent.name === "Link") {
            linkNode = linkNode.parent;
        } else {
            return null;
        }
    }

    // Check if cursor touches the link range
    const isTouching = selection.ranges.some(range => range.from <= linkNode.to && range.to >= linkNode.from);
    if (isTouching) return null;

    // We found a link and cursor is NOT touching it. Return tooltip.
    return {
        pos: linkNode.from,
        end: linkNode.to,
        above: true,
        create(view) {
            const dom = document.createElement("div");
            dom.className = "cm-tooltip-cursor";
            dom.textContent = "Ctrl + Click to open link";
            return { dom };
        }
    };
});

// Click Handler
export const linkClickHandler = EditorView.domEventHandlers({
    click: (event, view) => {
        if (!event.ctrlKey && !event.metaKey) return;
        // Footnote widgets handle their own ctrl-click (mousedown); don't open a surrounding link
        if (event.target instanceof Element && event.target.closest(".cm-footnote-ref, .cm-footnote-def")) return;

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return;

        const { state } = view;
        const node = syntaxTree(state).resolveInner(pos);

        let linkNode = node;
        // Traverse up to find Link node
        while (linkNode && linkNode.name !== "Link") {
            linkNode = linkNode.parent;
        }

        if (!linkNode) return;

        // Extract URL
        const urlNode = linkNode.getChild("URL");
        if (urlNode) {
            const url = normalizeDestination(state.doc.sliceString(urlNode.from, urlNode.to));

            if (url) {
                if (isSafeExternalUrl(url)) {
                    window.open(url, '_blank');
                } else {
                    console.warn('Blocked unsafe link scheme:', url);
                }
                event.preventDefault();
            }
        } else if (resolveReference(linkNode, state)) {
            // Reference link, e.g. [![alt][img]][site] with [site]: url elsewhere
            const url = resolveReference(linkNode, state).url;
            if (isSafeExternalUrl(url)) {
                window.open(url, '_blank');
            } else {
                console.warn('Blocked unsafe link scheme:', url);
            }
            event.preventDefault();
        } else if (linkNode.name === "Link") {
            // Maybe it's an autolink where the whole thing is a URL?
            // Or try to find text content if URL node is missing
            const text = state.doc.sliceString(linkNode.from, linkNode.to);
            // Simple regex to extract url from [text](url) or <url>
            const match = text.match(/\((.*?)\)$/) || text.match(/^<(.*)>$/);
            if (match) {
                const url = normalizeDestination(match[1]);
                if (isSafeExternalUrl(url)) {
                    window.open(url, '_blank');
                } else {
                    console.warn('Blocked unsafe link scheme:', url);
                }
                event.preventDefault();
            }
        }
    }
});

export const linkHandler = [
    linkTooltip,
    linkClickHandler
];
