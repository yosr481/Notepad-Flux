import { EditorView, hoverTooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

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
            dom.style.padding = "4px 8px";
            dom.style.backgroundColor = "var(--background-secondary)";
            dom.style.border = "1px solid var(--background-modifier-border)";
            dom.style.borderRadius = "4px";
            dom.style.fontSize = "12px";
            dom.style.color = "var(--text-normal)";
            dom.style.zIndex = "100";
            return { dom };
        }
    };
});

// Click Handler
export const linkClickHandler = EditorView.domEventHandlers({
    click: (event, view) => {
        if (!event.ctrlKey && !event.metaKey) return;

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
            let url = state.doc.sliceString(urlNode.from, urlNode.to);
            // Remove surrounding parens if present (standard markdown parser includes them in URL node sometimes?)
            // Actually Lezer markdown URL node is usually just the text.
            // But let's clean it just in case.
            url = url.replace(/^\(/, '').replace(/\)$/, '');

            if (url) {
                window.open(url, '_blank');
                event.preventDefault();
            }
        } else if (linkNode.name === "Link") {
            // Maybe it's an autolink where the whole thing is a URL?
            // Or try to find text content if URL node is missing
            const text = state.doc.sliceString(linkNode.from, linkNode.to);
            // Simple regex to extract url from [text](url) or <url>
            const match = text.match(/\((.*?)\)$/) || text.match(/^<(.*)>$/);
            if (match) {
                window.open(match[1], '_blank');
                event.preventDefault();
            }
        }
    }
});

export const linkHandler = [
    linkTooltip,
    linkClickHandler
];
