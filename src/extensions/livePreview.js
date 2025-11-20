import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { BulletWidget, CheckboxWidget, TableWidget, HRWidget } from "./widgets";

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

    syntaxTree(state).iterate({
        enter: (node) => {
            const { name, from: nodeFrom, to: nodeTo } = node;

            // --- Range-Based Triggers ---

            // 1. Inline Styles (Bold, Italic, Strike)
            if (name === "EmphasisMark") {
                const parent = node.node.parent;
                if (parent && (parent.name === "Emphasis" || parent.name === "StrongEmphasis" || parent.name === "Strikethrough")) {
                    if (!isCursorTouching(selection, parent.from, parent.to)) {
                        builder.add(nodeFrom, nodeTo, Decoration.replace({}));
                    }
                }
            }

            // 2. Links
            if (name === "LinkMark" || name === "URL") {
                const parent = node.node.parent;
                if (parent && parent.name === "Link") {
                    if (!isCursorTouching(selection, parent.from, parent.to)) {
                        builder.add(nodeFrom, nodeTo, Decoration.replace({}));
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
                        if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                            builder.add(nodeFrom, nodeTo, Decoration.replace({}));
                        }
                    } else {
                        // Normal Bullet List: Replace with Bullet Widget if not touching
                        if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                            builder.add(nodeFrom, nodeTo, Decoration.replace({
                                widget: new BulletWidget()
                            }));
                        }
                    }
                }
            }

            // 4. Tasks (Checkboxes)
            if (name === "TaskMarker") {
                if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                    const isChecked = doc.sliceString(nodeFrom, nodeTo).includes("x");
                    builder.add(nodeFrom, nodeTo, Decoration.replace({
                        widget: new CheckboxWidget(isChecked)
                    }));
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
                        builder.add(hideFrom, hideTo, Decoration.replace({}));
                    }
                }
            }

            // 6. Horizontal Rules
            if (name === "HorizontalRule") {
                if (!isCursorOnLine(selection, doc, nodeFrom)) {
                    builder.add(nodeFrom, nodeTo, Decoration.replace({
                        widget: new HRWidget()
                    }));
                }
            }

            // 7. Blockquotes
            if (name === "QuoteMark") {
                const parent = node.node.parent;
                if (parent && parent.name === "Blockquote") {
                    // Add line decoration for the blockquote border
                    builder.add(parent.from, parent.from, Decoration.line({
                        class: "cm-blockquote-line"
                    }));

                    if (!isCursorOnLine(selection, doc, parent.from)) {
                        builder.add(nodeFrom, nodeTo, Decoration.replace({}));
                    }
                }
            }

            // --- Block Triggers ---

            // 8. Tables
            if (name === "Table") {
                if (!isCursorTouching(selection, nodeFrom, nodeTo)) {
                    const tableText = doc.sliceString(nodeFrom, nodeTo);
                    const html = convertTableToHTML(tableText);
                    builder.add(nodeFrom, nodeTo, Decoration.replace({
                        widget: new TableWidget(html),
                        block: true // Block replacement is allowed in StateField
                    }));
                    return false; // SKIP CHILDREN
                }
            }
        }
    });

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
            html += `<${tag}>${cell.trim()}</${tag}>`;
        });
        html += "</tr>";
        hasContent = true;
    });
    html += "</table>";

    return hasContent ? html : "<div style='color: gray; padding: 1em;'>Empty Table</div>";
}

export const livePreview = [
    livePreviewField
];
