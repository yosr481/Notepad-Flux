import { EditorView, hoverTooltip } from "@codemirror/view";
import { syntaxTree, ensureSyntaxTree } from "@codemirror/language";
import { resolveReference, normalizeDestination } from "./linkDefs";
import { createSlugger } from "./headingSlug";

// Scheme allowlist for URLs pulled straight from document content.
// Anything not http/https/mailto (file:, smb:, javascript:, custom protocols) is refused.
export const isSafeExternalUrl = (url) => {
    try {
        return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
    } catch {
        return false;
    }
};

// Every counted heading in document order: [{ slug, from }], from = start of its first line.
// Same slugs as export ids (shared createSlugger; footnote definitions, front matter and code are skipped).
export const headingTargets = (state) => {
    const { doc } = state;
    const tree = ensureSyntaxTree(state, doc.length, 1000) ?? syntaxTree(state);
    const slugger = createSlugger();
    const out = [];
    tree.iterate({
        enter: (node) => {
            if (node.name === "FootnoteDefinition") return false;
            const atx = /^ATXHeading\d$/.test(node.name);
            if (!atx && !/^SetextHeading\d$/.test(node.name)) return;
            const marks = node.node.getChildren("HeaderMark");
            let a = node.from;
            let b = node.to;
            if (atx) {
                a = marks[0].to;
                if (marks.length > 1) b = marks[marks.length - 1].from;
            } else {
                b = doc.lineAt(marks[marks.length - 1].from).from; // underline line, not its mark: `> ===`
            }
            // drop continuation-line `>` marks; headingSlug joins the leftover indent
            let text = "";
            for (const q of node.node.getChildren("QuoteMark")) {
                if (q.from < a || q.to > b) continue;
                text += doc.sliceString(a, q.from);
                a = q.to;
            }
            text += doc.sliceString(a, Math.max(a, b));
            const slug = slugger.slug(text);
            if (slug) out.push({ slug, from: doc.lineAt(node.from).from });
            return false;
        },
    });
    return out;
};

// Jump to the heading a `#fragment` link points at; a miss does nothing.
const jumpToHeading = (view, fragment) => {
    let frag = fragment;
    try { frag = decodeURIComponent(fragment); } catch { /* keep raw */ }
    const targets = headingTargets(view.state);
    const hit = targets.find((h) => h.slug === frag) ?? targets.find((h) => h.slug === frag.toLowerCase());
    if (!hit) return;
    view.dispatch({
        selection: { anchor: hit.from },
        effects: EditorView.scrollIntoView(hit.from, { y: "start" }),
    });
    view.focus();
};

// One place for the open-URL rule: http/https/mailto open, `#x` jumps, anything else warns.
const openLink = (view, url) => {
    if (url.startsWith("#")) jumpToHeading(view, url.slice(1));
    else if (isSafeExternalUrl(url)) window.open(url, '_blank');
    else console.warn('Blocked unsafe link scheme:', url);
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
                openLink(view, url);
                event.preventDefault();
            }
        } else if (resolveReference(linkNode, state)) {
            // Reference link, e.g. [![alt][img]][site] with [site]: url elsewhere
            openLink(view, resolveReference(linkNode, state).url);
            event.preventDefault();
        } else if (linkNode.name === "Link") {
            // Maybe it's an autolink where the whole thing is a URL?
            // Or try to find text content if URL node is missing
            const text = state.doc.sliceString(linkNode.from, linkNode.to);
            // Simple regex to extract url from [text](url) or <url>
            const match = text.match(/\((.*?)\)$/) || text.match(/^<(.*)>$/);
            if (match) {
                openLink(view, normalizeDestination(match[1]));
                event.preventDefault();
            }
        }
    }
});

export const linkHandler = [
    linkTooltip,
    linkClickHandler
];
