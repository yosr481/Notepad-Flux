import { syntaxTree } from "@codemirror/language";

// One full-tree walk per syntax tree, shared by every caller and name. Cached per doc, valid while the tree is the same.
export const INDEXED_NODES = ["Subscript", "Superscript", "Emoji", "HTMLTag", "InlineMath", "BlockMath", "FootnoteDefinition", "FootnoteReference", "InlineFootnote", "Blockquote", "FencedCode", "HTMLBlock"];

const cache = new WeakMap(); // doc -> { tree, byName }

// -> [{ from, to, node }] for every node of that name (nested ones too), in document order. Unknown name throws.
export function nodesOf(state, name) {
    if (!INDEXED_NODES.includes(name)) throw new Error(`nodeIndex: "${name}" is not indexed`);
    const tree = syntaxTree(state);
    let hit = cache.get(state.doc);
    if (!hit || hit.tree !== tree) {
        const byName = Object.fromEntries(INDEXED_NODES.map((n) => [n, []]));
        tree.iterate({ enter: (n) => { if (byName[n.name]) byName[n.name].push({ from: n.from, to: n.to, node: n.node }); } });
        hit = { tree, byName };
        cache.set(state.doc, hit);
    }
    return hit.byName[name];
}
