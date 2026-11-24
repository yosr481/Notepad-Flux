import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { BulletWidget, CheckboxWidget, TableWidget, HRWidget, TextSpanWidget } from "./widgets";
import { isCursorTouching, isCursorOnLine } from "./selection";
import { isUnresolvedReference } from "./linkDefs";
import { buildTableData } from "./tableCells";
import { resolveFootnotes } from "./footnotes";
import { decodeEntity } from "./entities";

// Each handler gets (node, ctx = { state, doc, selection, decorations }) and pushes
// onto ctx.decorations. Returning false skips the node's children.

// Math is drawn by mathPreview; nothing inside it is markdown.
const skipChildren = () => false;

const emphasisMark = (node, { selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    const parent = node.node.parent;
    if (parent && (parent.name === "Emphasis" || parent.name === "StrongEmphasis" || parent.name === "Strikethrough")) {
        let isTouching = isCursorTouching(selection, parent.from, parent.to);

        if (!isTouching) {
            const grandParent = parent.parent;
            if (grandParent && (grandParent.name === "Emphasis" || grandParent.name === "StrongEmphasis")) {
                if (isCursorTouching(selection, grandParent.from, grandParent.to)) {
                    isTouching = true;
                }
            }
        }

        if (!isTouching) {
            decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.replace({}) });
        }
    }
};

const escape = (node, { selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
        // Hide only the backslash, leave the escaped char as plain text
        decorations.push({ from: nodeFrom, to: nodeFrom + 1, value: Decoration.replace({}) });
    }
};

const linkMarkOrUrl = (node, { state, selection, decorations }) => {
    const { name, from: nodeFrom, to: nodeTo } = node;
    const parent = node.node.parent;
    if (parent && (parent.name === "Link" || (parent.name === "Autolink" && name === "LinkMark"))
        && !(parent.name === "Link" && isUnresolvedReference(parent, state))) {
        let isTouching = isCursorTouching(selection, parent.from, parent.to);

        if (!isTouching) {
            let ancestor = parent.parent;
            while (ancestor) {
                if (ancestor.name === "StrongEmphasis" || ancestor.name === "Emphasis") {
                    if (isCursorTouching(selection, ancestor.from, ancestor.to)) {
                        isTouching = true;
                        break;
                    }
                    ancestor = ancestor.parent;
                } else {
                    break;
                }
            }
        }

        if (!isTouching) {
            decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.replace({}) });
        }
    }
};

const listMark = (node, { doc, selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    const parent = node.node.parent;
    if (parent && parent.name === "ListItem") {
        const grandParent = parent.parent;
        const isOrdered = grandParent && grandParent.name === "OrderedList";

        if (isOrdered) {
            // Ordered list: renumber with computed marker
            const markerText = doc.sliceString(nodeFrom, nodeTo);
            const delimMatch = markerText.match(/^\d+([.)])/);
            if (delimMatch) {
                const delim = delimMatch[1];
                // ponytail: rebuilds the sibling list + findIndex per ListMark visited (O(n²) per list); viewport-bounded so fine, hoist to a per-OrderedList cache if a huge list drags
                const listItems = grandParent.node.getChildren("ListItem");
                const itemIndex = listItems.findIndex(li => li.from === parent.from);
                const firstSiblingMark = listItems[0]?.getChild("ListMark");
                if (firstSiblingMark && itemIndex >= 0) {
                    const firstMarkerText = doc.sliceString(firstSiblingMark.from, firstSiblingMark.to);
                    const firstDigitsMatch = firstMarkerText.match(/^\d+/);
                    if (firstDigitsMatch) {
                        const startNum = parseInt(firstDigitsMatch[0], 10);
                        const computedNum = startNum + itemIndex;
                        const text = String(computedNum) + delim;
                        if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                            decorations.push({
                                from: nodeFrom, to: nodeTo, value: Decoration.replace({
                                    widget: new TextSpanWidget(text, "cm-ordered-marker")
                                })
                            });
                        }
                    }
                }
            }
            return;
        }

        const taskChild = parent.getChild("Task");
        if (taskChild) {
            let isTouching = isCursorTouching(selection, nodeFrom, nodeTo);
            if (!isTouching) {
                const taskMarker = taskChild.getChild("TaskMarker");
                if (taskMarker) {
                    if (isCursorTouching(selection, taskMarker.from, taskMarker.to)) {
                        isTouching = true;
                    }
                }
            }

            if (!isTouching) {
                decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.replace({}) });
            }
        } else {
            if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                decorations.push({
                    from: nodeFrom, to: nodeTo, value: Decoration.replace({
                        widget: new BulletWidget()
                    })
                });
            }
        }
    }
};

const taskMarker = (node, { doc, selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    let isTouching = isCursorTouching(selection, nodeFrom, nodeTo);

    if (!isTouching) {
        const taskNode = node.node.parent;
        if (taskNode && taskNode.name === "Task") {
            const listItem = taskNode.parent;
            if (listItem && listItem.name === "ListItem") {
                const listMark = listItem.getChild("ListMark");
                if (listMark) {
                    if (isCursorTouching(selection, listMark.from, listMark.to)) {
                        isTouching = true;
                    }
                }
            }
        }
    }

    if (!isTouching) {
        const isChecked = /[xX]/.test(doc.sliceString(nodeFrom, nodeTo));
        decorations.push({
            from: nodeFrom, to: nodeTo, value: Decoration.replace({
                widget: new CheckboxWidget(isChecked)
            })
        });
    }
};

const atxHeading = (node, { doc, selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    if (!isCursorOnLine(selection, doc, nodeFrom)) {
        const headerText = doc.sliceString(nodeFrom, nodeTo);
        // Hide leading ###...
        const match = headerText.match(/^#+\s+/);
        const leadLen = match ? match[0].length : 0;
        if (match) {
            decorations.push({ from: nodeFrom, to: nodeFrom + match[0].length, value: Decoration.replace({}) });
        }
        // Hide trailing closing sequence if present
        const closeMatch = headerText.match(/\s+#+\s*$/);
        if (closeMatch && closeMatch.index >= leadLen) {
            decorations.push({ from: nodeFrom + closeMatch.index, to: nodeTo, value: Decoration.replace({}) });
        }
    }
};

const setextHeading = (node, { doc, selection, decorations }) => {
    const headerMark = node.node.getChild("HeaderMark");
    if (headerMark) {
        // Hide underline only if cursor is on none of the heading's lines (multi-line text + underline)
        const lastLine = doc.lineAt(headerMark.from).number;
        let cursorIn = false;
        for (let n = doc.lineAt(node.from).number; n <= lastLine && !cursorIn; n++) {
            cursorIn = isCursorOnLine(selection, doc, doc.line(n).from);
        }
        if (!cursorIn) {
            decorations.push({ from: headerMark.from, to: headerMark.to, value: Decoration.replace({}) });
        }
    }
};

const horizontalRule = (node, { doc, selection, decorations }) => {
    if (!isCursorOnLine(selection, doc, node.from)) {
        decorations.push({
            from: node.from, to: node.to, value: Decoration.replace({
                widget: new HRWidget()
            })
        });
    }
};

const blockquote = (node, { doc, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    // Depth = ancestors including self, capped at 3
    let depth = 1;
    let ancestor = node.node.parent;
    while (ancestor && depth < 3) {
        if (ancestor.name === "Blockquote") {
            depth++;
        }
        ancestor = ancestor.parent;
    }
    // One decoration per line keeps the border continuous across a multi-line quote
    for (let i = nodeFrom; i < nodeTo;) {
        const line = doc.lineAt(i);
        decorations.push({
            from: line.from, to: line.from, value: Decoration.line({
                class: `cm-blockquote-line cm-blockquote-depth-${depth}`
            })
        });
        i = line.to + 1;
    }
};

const quoteMark = (node, { doc, selection, decorations }) => {
    // Check if cursor is on the SPECIFIC LINE of this QuoteMark
    if (!isCursorOnLine(selection, doc, node.from)) {
        decorations.push({ from: node.from, to: node.to, value: Decoration.replace({}) });
    }
};

const strikethrough = (node, { selection, decorations }) => {
    if (!isCursorTouching(selection, node.from, node.to)) {
        decorations.push({ from: node.from, to: node.to, value: Decoration.mark({ class: "cm-strikethrough" }) });
    }
};

// Hide a mark node unless the cursor touches its parent (which must be `parentName`)
const hideMarkOfParent = (parentName) => (node, { selection, decorations }) => {
    const parent = node.node.parent;
    if (parent && parent.name === parentName) {
        if (!isCursorTouching(selection, parent.from, parent.to)) {
            decorations.push({ from: node.from, to: node.to, value: Decoration.replace({}) });
        }
    }
};

const inlineCode = (node, { selection, decorations }) => {
    if (!isCursorTouching(selection, node.from, node.to)) {
        decorations.push({ from: node.from, to: node.to, value: Decoration.mark({ class: "cm-inline-code" }) });
    }
};

const entity = (node, { doc, selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
        const decoded = decodeEntity(doc.sliceString(nodeFrom, nodeTo));
        if (decoded !== null) {
            decorations.push({
                from: nodeFrom, to: nodeTo, value: Decoration.replace({
                    widget: new TextSpanWidget(decoded, "cm-entity")
                })
            });
        }
    }
};

const collapsedLine = Decoration.line({ class: "cm-collapsed-line" });

const linkReference = (node, { doc, selection, decorations }) => {
    if (!isCursorTouching(selection, node.from, node.to)) {
        decorations.push({ from: node.from, to: node.to, value: Decoration.replace({}) });
        // A line holding only the definition ([comment]: # (...)) would stay as an empty row: fold it away.
        const line = doc.lineAt(node.from);
        if (line.from === node.from && line.text.trimEnd().length === node.to - line.from) {
            decorations.push({ from: line.from, to: line.from, value: collapsedLine });
        }
    }
};

const linkLabel = (node, { state, selection, decorations }) => {
    const parent = node.node.parent;
    if (parent && (parent.name === "Link" || parent.name === "Image") && !isUnresolvedReference(parent, state)) {
        if (!isCursorTouching(selection, parent.from, parent.to)) {
            decorations.push({ from: node.from, to: node.to, value: Decoration.replace({}) });
        }
    }
};

const fencedCode = (node, { doc, selection, decorations }) => {
    const { from: nodeFrom, to: nodeTo } = node;
    // Always style the code block lines, even when active
    for (let i = nodeFrom; i < nodeTo;) {
        const line = doc.lineAt(i);
        decorations.push({
            from: line.from, to: line.from, value: Decoration.line({
                class: "cm-code-block"
            })
        });
        i = line.to + 1;
    }

    const startMark = node.node.getChild("CodeMark");
    const info = node.node.getChild("CodeInfo");
    const lastMark = node.node.lastChild;
    const hasEndFence = lastMark && lastMark.name === "CodeMark" && startMark && lastMark.from !== startMark.from;

    // Hide fences if not active, make them faint if active
    const value = isCursorTouching(selection, nodeFrom, nodeTo)
        ? Decoration.mark({ class: "cm-faint-syntax" })
        : Decoration.replace({});
    if (startMark) decorations.push({ from: startMark.from, to: startMark.to, value });
    if (info) decorations.push({ from: info.from, to: info.to, value });
    if (hasEndFence) decorations.push({ from: lastMark.from, to: lastMark.to, value });
};

const table = (node, { state, selection, decorations }) => {
    if (!isCursorTouching(selection, node.from, node.to)) {
        const data = buildTableData(state, node.node);
        decorations.push({
            from: node.from, to: node.to, value: Decoration.replace({
                widget: new TableWidget(data)
            })
        });
        return false; // SKIP CHILDREN
    }
};

const handlers = Object.assign(Object.create(null), {
    InlineMath: skipChildren,
    BlockMath: skipChildren,
    EmphasisMark: emphasisMark,
    Escape: escape,
    LinkMark: linkMarkOrUrl,
    URL: linkMarkOrUrl,
    ListMark: listMark,
    TaskMarker: taskMarker,
    ATXHeading1: atxHeading,
    ATXHeading2: atxHeading,
    ATXHeading3: atxHeading,
    ATXHeading4: atxHeading,
    ATXHeading5: atxHeading,
    ATXHeading6: atxHeading,
    SetextHeading1: setextHeading,
    SetextHeading2: setextHeading,
    HorizontalRule: horizontalRule,
    Blockquote: blockquote,
    QuoteMark: quoteMark,
    Strikethrough: strikethrough,
    StrikethroughMark: hideMarkOfParent("Strikethrough"),
    InlineCode: inlineCode,
    CodeMark: hideMarkOfParent("InlineCode"),
    Entity: entity,
    LinkReference: linkReference,
    LinkLabel: linkLabel,
    FencedCode: fencedCode,
    Table: table,
});

export const buildDecorations = (state, range) => {
    const builder = new RangeSetBuilder();
    const ctx = { state, doc: state.doc, selection: state.selection, decorations: [] };
    const { decorations } = ctx;

    const iterRange = range || { from: 0, to: ctx.doc.length };

    syntaxTree(state).iterate({
        from: iterRange.from,
        to: iterRange.to,
        enter: (node) => handlers[node.name]?.(node, ctx)
    });

    // Sort decorations by 'from' position to satisfy RangeSetBuilder requirements
    decorations.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        const sideDiff = (a.value.startSide ?? 0) - (b.value.startSide ?? 0);
        if (sideDiff !== 0) return sideDiff;
        return a.to - b.to;
    });

    for (const deco of decorations) {
        builder.add(deco.from, deco.to, deco.value);
    }

    return builder.finish();
};


// Warm resolveFootnotes' own result cache (doc + tree keyed; the node walk is the shared index) so a later
// selection-only move that un-touches a table needs no resolve pass. Without it selectionReuse.livePreview's table cases fail.
const fullBuild = (state) => {
    resolveFootnotes(state);
    return buildDecorations(state);
};

// ponytail: doc/tree changes rebuild every decoration; selection-only moves redo just the touched blocks.
// Fine for notepad-sized docs (tens of KB), add viewport windowing back if large files jank.
const livePreviewField = StateField.define({
    create(state) {
        return fullBuild(state);
    },
    update(decorations, transaction) {
        // syntaxTree comparison: the markdown parser is time-sliced, so on a long
        // doc the tail parses in a later transaction that carries no docChanged/
        // selection/effect flag. Without this check those lines keep their stale
        // (empty) decorations and never render as live preview.
        const tree = syntaxTree(transaction.state);
        if (transaction.docChanged || syntaxTree(transaction.startState) !== tree) {
            return fullBuild(transaction.state);
        }
        if (transaction.selection) {
            // Selection-only: re-decorate just the top-level blocks the old or new selection touches.
            const { startState, state } = transaction;
            // Touch test is line-widened: blocks indented 1-3 spaces start after the indent but reveal per line.
            const touched = [];
            for (let n = tree.topNode.firstChild; n; n = n.nextSibling) {
                const lf = state.doc.lineAt(n.from).from, lt = state.doc.lineAt(n.to).to;
                if (isCursorTouching(startState.selection, lf, lt) || isCursorTouching(state.selection, lf, lt)) {
                    touched.push({ from: n.from, to: n.to });
                }
            }
            if (!touched.length) return decorations;
            const owned = (from) => touched.some((b) => from >= b.from && from <= b.to);
            const add = [];
            for (const b of touched) {
                for (const it = buildDecorations(state, b).iter(); it.value; it.next()) {
                    if (it.from >= b.from && it.from <= b.to) add.push(it.value.range(it.from, it.to));
                }
            }
            return decorations.update({
                filter: (from) => !owned(from), filterFrom: touched[0].from, filterTo: touched[touched.length - 1].to, add, sort: true,
            });
        }
        return decorations;
    },
    provide: field => EditorView.decorations.from(field)
});

// --- Highlights (==text==) ---


// We need to handle Highlights in the main loop if we want the "hide markers" behavior.
// Standard Markdown doesn't support ==, but GFM might if enabled.
// If not, we treat it as text.
// Let's assume we need to regex search for it in the visible ranges or use a ViewPlugin.

// Let's use a ViewPlugin for Highlights that respects selection
const insideMath = (state, pos) => {
    for (let n = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
        if (n.name === "InlineMath" || n.name === "BlockMath") return true;
    }
    return false;
};

const highlightPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.compute(view);
    }

    update(update) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = this.compute(update.view);
        }
    }

    compute(view) {
        const builder = new RangeSetBuilder();
        const { state } = view;
        const { doc, selection } = state;

        for (const { from, to } of view.visibleRanges) {
            const text = doc.sliceString(from, to);
            const regex = /==(.*?)==/g;
            let match;
            while ((match = regex.exec(text))) {
                const start = from + match.index;
                const end = start + match[0].length;
                if (insideMath(state, start)) continue;

                // If cursor touches, don't hide markers (just style background if we want, or nothing)
                if (isCursorTouching(selection, start, end)) {
                    // Style the background of the inner text even when active
                    const innerStart = start + 2;
                    const innerEnd = end - 2;
                    if (innerEnd > innerStart) {
                        builder.add(innerStart, innerEnd, Decoration.mark({ class: "cm-highlight" }));
                    }
                } else {
                    // Hide markers, style content
                    const innerStart = start + 2;
                    const innerEnd = end - 2;

                    // Hide leading ==
                    builder.add(start, innerStart, Decoration.replace({}));
                    // Style content
                    builder.add(innerStart, innerEnd, Decoration.mark({ class: "cm-highlight" }));
                    // Hide trailing ==
                    builder.add(innerEnd, end, Decoration.replace({}));
                }
            }
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});

export const livePreview = [
    livePreviewField,
    highlightPlugin
];
