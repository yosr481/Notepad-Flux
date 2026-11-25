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

// Kind of an already-normalized destination. Relative links (no scheme) never open from the editor.
export const linkKind = (url) => {
    if (url.startsWith("#")) return "heading";
    if (isSafeExternalUrl(url)) return "external";
    return /^[a-z][a-z0-9+.-]*:/i.test(url) ? "unsafe" : "relative";
};

// One place for the open-URL rule: http/https/mailto open, `#x` jumps, relative is inert, other schemes warn.
const openLink = (view, url) => {
    const kind = linkKind(url);
    if (kind === "heading") jumpToHeading(view, url.slice(1));
    else if (kind === "external") window.open(url, '_blank');
    else if (kind === "unsafe") console.warn('Blocked unsafe link scheme:', url);
};

// Normalized destination of a Link node (inline URL, else resolved reference), or null.
const linkDestination = (linkNode, state) => {
    const urlNode = linkNode.getChild("URL");
    if (urlNode) return normalizeDestination(state.doc.sliceString(urlNode.from, urlNode.to));
    const ref = resolveReference(linkNode, state);
    if (ref) return ref.url;
    // Maybe it's an autolink where the whole thing is a URL: [text](url) or <url>
    const match = state.doc.sliceString(linkNode.from, linkNode.to).match(/\((.*?)\)$/)
        || state.doc.sliceString(linkNode.from, linkNode.to).match(/^<(.*)>$/);
    return match ? normalizeDestination(match[1]) : null;
};

const TOOLTIP_TEXT = {
    external: "Ctrl + Click to open link",
    heading: "Ctrl + Click to jump to heading",
    relative: "Relative link: opens only in exported files",
};

// Pure body of linkTooltip: { pos, end, text } for an inactive link with an openable/relative destination.
export const linkTooltipInfo = (state, pos, side) => {
    // The cursor inside the link means we are editing it: no tooltip.
    let linkNode = syntaxTree(state).resolveInner(pos, side);
    if (linkNode.name !== "Link") {
        if (linkNode.parent && linkNode.parent.name === "Link") linkNode = linkNode.parent;
        else return null;
    }
    if (state.selection.ranges.some(r => r.from <= linkNode.to && r.to >= linkNode.from)) return null;

    const url = linkDestination(linkNode, state);
    if (url === null) return null;
    const text = TOOLTIP_TEXT[linkKind(url)];
    return text ? { pos: linkNode.from, end: linkNode.to, text } : null;
};

export const linkTooltip = hoverTooltip((view, pos, side) => {
    const info = linkTooltipInfo(view.state, pos, side);
    if (!info) return null;
    return {
        pos: info.pos,
        end: info.end,
        above: true,
        create() {
            const dom = document.createElement("div");
            dom.className = "cm-tooltip-cursor";
            dom.textContent = info.text;
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

        let linkNode = syntaxTree(view.state).resolveInner(pos);
        while (linkNode && linkNode.name !== "Link") linkNode = linkNode.parent;
        if (!linkNode) return;

        const url = linkDestination(linkNode, view.state);
        if (url !== null) {
            openLink(view, url);
            event.preventDefault();
        }
    }
});

export const linkHandler = [
    linkTooltip,
    linkClickHandler
];
