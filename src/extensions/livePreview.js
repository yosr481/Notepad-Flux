import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { BulletWidget, CheckboxWidget, TableWidget, HRWidget, CodeBlockWidget } from "./widgets";

// Helper: Check if cursor touches the range [from, to]
const isCursorTouching = (selection, from, to) => {
    return selection.ranges.some(range => range.from <= to && range.to >= from);
};

// Helper: Check if cursor/selection intersects the line
const isCursorOnLine = (selection, doc, from) => {
    const line = doc.lineAt(from);
    return selection.ranges.some(range => range.from <= line.to && range.to >= line.from);
};

const buildDecorations = (state) => {
    const builder = new RangeSetBuilder();
    const selection = state.selection;
    const doc = state.doc;
    const decorations = [];

    syntaxTree(state).iterate({
        enter: (node) => {
            const { name, from: nodeFrom, to: nodeTo } = node;

            // --- Range-Based Triggers ---

            // 1. Inline Styles (Bold, Italic, Strike)
            if (name === "EmphasisMark") {
                const parent = node.node.parent;
                if (parent && (parent.name === "Emphasis" || parent.name === "StrongEmphasis" || parent.name === "Strikethrough")) {
                    let isTouching = isCursorTouching(selection, parent.from, parent.to);

                    // Check grandparent for nested emphasis (e.g. ***bold italic***)
                    // If the cursor touches the outer emphasis, we should also reveal the inner markers
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
            }

            // 2. Links
            if (name === "LinkMark" || name === "URL") {
                const parent = node.node.parent;
                if (parent && parent.name === "Link") {
                    let isTouching = isCursorTouching(selection, parent.from, parent.to);

                    // Check if cursor is touching outer emphasis (grandparents from Link)
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
            }

            // 3. Lists (Bullets)
            if (name === "ListMark") {
                const parent = node.node.parent;
                if (parent && parent.name === "ListItem") {
                    // Check if it's an Ordered List
                    const grandParent = parent.parent;
                    const isOrdered = grandParent && grandParent.name === "OrderedList";

                    if (isOrdered) {
                        // Do nothing for Ordered Lists (keep numbers)
                        return;
                    }

                    const taskChild = parent.getChild("Task");
                    if (taskChild) {
                        // Task List: Hide the dash if not touching
                        // Check if touching dash OR task marker
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
                        // Normal Bullet List: Replace with Bullet Widget if not touching
                        if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                            decorations.push({
                                from: nodeFrom, to: nodeTo, value: Decoration.replace({
                                    widget: new BulletWidget()
                                })
                            });
                        }
                    }
                }
            }

            // 4. Tasks (Checkboxes)
            if (name === "TaskMarker") {
                let isTouching = isCursorTouching(selection, nodeFrom, nodeTo);

                // Also check if touching the ListMark (dash)
                if (!isTouching) {
                    const taskNode = node.node.parent; // Task
                    if (taskNode && taskNode.name === "Task") {
                        const listItem = taskNode.parent; // ListItem
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
                    const isChecked = doc.sliceString(nodeFrom, nodeTo).includes("x");
                    decorations.push({
                        from: nodeFrom, to: nodeTo, value: Decoration.replace({
                            widget: new CheckboxWidget(isChecked)
                        })
                    });
                }
            }

            // --- Active Line Triggers ---

            // 5. Headings (ATX)
            if (name.startsWith("ATXHeading")) {
                if (!isCursorOnLine(selection, doc, nodeFrom)) {
                    // Regex to find the hash and trailing space: /^#+\s+/
                    // We need to look at the text content of the node
                    const headerText = doc.sliceString(nodeFrom, nodeTo);
                    const match = headerText.match(/^#+\s+/);
                    if (match) {
                        const hideFrom = nodeFrom;
                        const hideTo = nodeFrom + match[0].length;
                        decorations.push({ from: hideFrom, to: hideTo, value: Decoration.replace({}) });
                    }
                }
            }

            // 6. Horizontal Rules
            if (name === "HorizontalRule") {
                if (!isCursorOnLine(selection, doc, nodeFrom)) {
                    decorations.push({
                        from: nodeFrom, to: nodeTo, value: Decoration.replace({
                            widget: new HRWidget()
                        })
                    });
                }
            }

            // 7. Blockquotes
            if (name === "Blockquote") {
                // Iterate over lines in the blockquote to apply decoration to each line
                // This ensures continuous border even if it's multiple lines
                for (let i = nodeFrom; i < nodeTo;) {
                    const line = doc.lineAt(i);
                    decorations.push({
                        from: line.from, to: line.from, value: Decoration.line({
                            class: "cm-blockquote-line"
                        })
                    });
                    i = line.to + 1;
                }
            }

            if (name === "QuoteMark") {
                // Check if cursor is on the SPECIFIC LINE of this QuoteMark
                if (!isCursorOnLine(selection, doc, nodeFrom)) {
                    decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.replace({}) });
                }
            }

            // 8. Strikethrough (~~text~~)
            if (name === "Strikethrough") {
                if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                    // Apply styling to the whole thing
                    decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.mark({ class: "cm-strikethrough" }) });
                }
            }

            if (name === "StrikethroughMark") {
                const parent = node.node.parent;
                if (parent && parent.name === "Strikethrough") {
                    if (!isCursorTouching(selection, parent.from, parent.to)) {
                        decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.replace({}) });
                    }
                }
            }

            // 9. Inline Code (`text`)
            if (name === "InlineCode") {
                if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                    decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.mark({ class: "cm-inline-code" }) });
                }
            }

            if (name === "CodeMark") {
                const parent = node.node.parent;
                if (parent && parent.name === "InlineCode") {
                    if (!isCursorTouching(selection, parent.from, parent.to)) {
                        decorations.push({ from: nodeFrom, to: nodeTo, value: Decoration.replace({}) });
                    }
                }
            }

            // 10. Code Blocks (Fenced)
            if (name === "FencedCode") {
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

                let startMark = node.node.getChild("CodeMark");
                let info = node.node.getChild("CodeInfo");
                let lastMark = node.node.lastChild;

                const isTouching = isCursorTouching(selection, nodeFrom, nodeTo);

                if (!isTouching) {
                    // Hide fences if not active
                    if (startMark) decorations.push({ from: startMark.from, to: startMark.to, value: Decoration.replace({}) });
                    if (info) decorations.push({ from: info.from, to: info.to, value: Decoration.replace({}) });
                    if (lastMark && lastMark.name === "CodeMark" && startMark && lastMark.from !== startMark.from) {
                        decorations.push({ from: lastMark.from, to: lastMark.to, value: Decoration.replace({}) });
                    }
                } else {
                    // Make faint if active
                    const faintMark = Decoration.mark({ class: "cm-faint-syntax" });
                    if (startMark) decorations.push({ from: startMark.from, to: startMark.to, value: faintMark });
                    if (info) decorations.push({ from: info.from, to: info.to, value: faintMark });
                    if (lastMark && lastMark.name === "CodeMark" && startMark && lastMark.from !== startMark.from) {
                        decorations.push({ from: lastMark.from, to: lastMark.to, value: faintMark });
                    }
                }
            }

            // --- Block Triggers ---

            // 11. Tables
            if (name === "Table") {
                if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                    const tableText = doc.sliceString(nodeFrom, nodeTo);
                    const html = convertTableToHTML(tableText);
                    decorations.push({
                        from: nodeFrom, to: nodeTo, value: Decoration.replace({
                            widget: new TableWidget(html)
                        })
                    });
                    return false; // SKIP CHILDREN
                }
            }
        }
    });

    // Sort decorations by 'from' position to satisfy RangeSetBuilder requirements
    decorations.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        if (a.value.startSide !== b.value.startSide) return a.value.startSide - b.value.startSide;
        return a.to - b.to;
    });

    for (const deco of decorations) {
        builder.add(deco.from, deco.to, deco.value);
    }

    return builder.finish();
};

const livePreviewField = StateField.define({
    create(state) {
        return buildDecorations(state);
    },
    update(decorations, transaction) {
        if (transaction.docChanged || transaction.selection) {
            return buildDecorations(transaction.state);
        }
        return decorations;
    },
    provide: field => EditorView.decorations.from(field)
});

function convertTableToHTML(text) {
    const rows = text.trim().split('\n');
    if (rows.length === 0) return "";

    let html = "<table>";
    let hasContent = false;

    rows.forEach((row, index) => {
        // Remove outer pipes if they exist
        const cleanRow = row.trim().replace(/^\|/, '').replace(/\|$/, '');
        if (!cleanRow.trim()) return; // Skip empty rows

        const cells = cleanRow.split('|');

        const isHeader = index === 0;
        if (row.includes('---')) return;

        html += "<tr>";
        cells.forEach(cell => {
            const tag = isHeader ? "th" : "td";
            html += `<${tag}>${parseCellContent(cell.trim())}</${tag}>`;
        });
        html += "</tr>";
        hasContent = true;
    });
    html += "</table>";

    return hasContent ? html : "<div class='cm-table-empty'>Empty Table</div>";
}

// --- Highlights (==text==) ---


// We need to handle Highlights in the main loop if we want the "hide markers" behavior.
// Standard Markdown doesn't support ==, but GFM might if enabled. 
// If not, we treat it as text.
// Let's assume we need to regex search for it in the visible ranges or use a ViewPlugin.

// Let's use a ViewPlugin for Highlights that respects selection
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

function parseCellContent(content) {
    // Basic markdown parsing for table cells
    let html = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Strikethrough ~~text~~
    html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");
    // Code `text`
    html = html.replace(/`(.*?)`/g, "<code>$1</code>");
    // Links [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Highlights ==text==
    html = html.replace(/==(.*?)==/g, "<mark>$1</mark>");

    return html;
}

export const livePreview = [
    livePreviewField,
    highlightPlugin
];
