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
