import { syntaxTree } from "@codemirror/language";
import { normalizeLabel } from "./linkDefs";

const cache = new WeakMap();

// Definition text: raw source after "]:", continuation lines lose up to 4 leading spaces.
function defText(raw) {
    const [first, ...rest] = raw.split('\n');
    return [first.replace(/^[ \t]+/, ''), ...rest.map((l) => l.replace(/^ {0,4}/, ''))].join('\n').trimEnd();
}

// { labelled: Map<label, {number, defFrom, defTo, text, refs}>, inline: Map<from, {number, text}> },
// memoized per EditorState. Read-only for callers. One tree pass, then numbering in document order.
export function resolveFootnotes(state) {
    if (cache.has(state)) return cache.get(state);

    const doc = state.doc;
    const defs = new Map();   // label -> first definition in document order
    const events = [];        // refs and inline notes, document order
    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.name === 'FootnoteDefinition') {
                const label = node.node.getChild('FootnoteLabel');
                if (!label) return;
                const key = normalizeLabel(doc.sliceString(label.from, label.to));
                if (defs.has(key)) return;
                const raw = doc.sliceString(label.to + 2, node.to);
                const text = defText(raw);
                defs.set(key, { defFrom: node.from, defTo: node.to - (raw.length - raw.trimEnd().length), text });
            } else if (node.name === 'FootnoteReference') {
                const label = node.node.getChild('FootnoteLabel');
                if (label) events.push({ key: normalizeLabel(doc.sliceString(label.from, label.to)), from: node.from });
            } else if (node.name === 'InlineFootnote') {
                events.push({ inlineFrom: node.from, text: doc.sliceString(node.from + 2, node.to - 1) });
            }
        },
    });

    const labelled = new Map(), inline = new Map();
    let n = 0;
    for (const e of events) {
        if (e.inlineFrom !== undefined) {
            inline.set(e.inlineFrom, { number: ++n, text: e.text });
            continue;
        }
        const def = defs.get(e.key);
        if (!def) continue;
        const entry = labelled.get(e.key);
        if (entry) entry.refs.push(e.from);
        else labelled.set(e.key, { number: ++n, ...def, refs: [e.from] });
    }

    const result = { labelled, inline };
    cache.set(state, result);
    return result;
}
