import { syntaxTree } from "@codemirror/language";

// Memoization cache
const cache = new WeakMap();

export function normalizeLabel(raw) {
    let label = raw;

    // Strip ONE leading [ and ONE trailing ]
    if (label.startsWith('[')) {
        label = label.slice(1);
    }
    if (label.endsWith(']')) {
        label = label.slice(0, -1);
    }

    // Trim and collapse internal whitespace
    label = label.trim();
    label = label.replace(/\s+/g, ' ');

    // Lowercase
    label = label.toLowerCase();

    return label;
}

// Returns a Map<normalizedLabel, {url, title?}> of link reference definitions in
// the document, memoized per EditorState. The Map is shared across callers —
// callers must treat it as read-only and never mutate it.
export function resolveLinkDefs(state) {
    // Check cache first
    if (cache.has(state)) {
        return cache.get(state);
    }

    const map = new Map();
    const doc = state.doc;

    // Iterate full document collecting LinkReference nodes
    syntaxTree(state).iterate({
        enter: (node) => {
            const { name } = node;

            // Only descend into Document and Blockquote
            if (name !== "Document" && name !== "Blockquote") {
                // Skip non-container nodes to avoid walking inline subtrees
                if (name !== "LinkReference") {
                    return false;
                }
            }

            // Collect LinkReference definitions
            if (name === "LinkReference") {
                // Get the LinkLabel child
                const labelNode = node.node.getChild("LinkLabel");
                if (!labelNode) return false;

                // Get the URL child
                const urlNode = node.node.getChild("URL");
                if (!urlNode) return false;

                // Extract and normalize label
                const labelText = doc.sliceString(labelNode.from, labelNode.to);
                const normalizedLabel = normalizeLabel(labelText);

                // Only store if not already present (first definition wins)
                if (!map.has(normalizedLabel)) {
                    const url = doc.sliceString(urlNode.from, urlNode.to);
                    const entry = { url };

                    // Get optional LinkTitle child
                    const titleNode = node.node.getChild("LinkTitle");
                    if (titleNode) {
                        let titleText = doc.sliceString(titleNode.from, titleNode.to);

                        // Strip ONE surrounding delimiter pair
                        if ((titleText.startsWith('"') && titleText.endsWith('"')) ||
                            (titleText.startsWith("'") && titleText.endsWith("'"))) {
                            titleText = titleText.slice(1, -1);
                        } else if (titleText.startsWith('(') && titleText.endsWith(')')) {
                            titleText = titleText.slice(1, -1);
                        }

                        entry.title = titleText;
                    }

                    map.set(normalizedLabel, entry);
                }

                return false;
            }
        }
    });

    // Store in cache and return
    cache.set(state, map);
    return map;
}

// Visible text between a Link node's opening [ and closing ] LinkMarks.
export function getVisibleTextBetweenMarks(linkNode, doc) {
    const marks = [];
    for (let child = linkNode.firstChild; child; child = child.nextSibling) {
        if (child.name === "LinkMark") marks.push(child);
    }
    return marks.length >= 2 ? doc.sliceString(marks[0].to, marks[1].from) : '';
}

// Is this Link/Image inline ([t](url), [t](), [t](<>))? Inline ones carry the
// "(" ")" LinkMarks (4 total); reference forms ([t][id], [id][], [id]) carry 2.
function isInlineLink(linkNode) {
    if (linkNode.getChild("URL")) return true;
    let marks = 0;
    for (let c = linkNode.firstChild; c; c = c.nextSibling) if (c.name === "LinkMark") marks++;
    return marks > 2;
}

// The [id]: url definition a reference-style Link/Image points at, or null
// (also null for inline links). Label = LinkLabel, else the visible text
// (shortcut [id] / collapsed [id][]).
export function resolveReference(linkNode, state) {
    if (isInlineLink(linkNode)) return null;
    const labelNode = linkNode.getChild("LinkLabel");
    const label = (labelNode && normalizeLabel(state.doc.sliceString(labelNode.from, labelNode.to)))
        || normalizeLabel(getVisibleTextBetweenMarks(linkNode, state.doc));
    return resolveLinkDefs(state).get(label) ?? null;
}

// A reference-style Link/Image with no matching definition. CommonMark renders
// it as literal text, so live preview must leave its brackets/label visible.
export function isUnresolvedReference(linkNode, state) {
    return !isInlineLink(linkNode) && !resolveReference(linkNode, state);
}
