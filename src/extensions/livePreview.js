import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField, StateEffect } from "@codemirror/state";
import { BulletWidget, CheckboxWidget, TableWidget, HRWidget } from "./widgets";
import { isCursorTouching, isCursorOnLine } from "./selection";

const PREFIX = 10000;

export const buildDecorations = (state, range) => {
    const builder = new RangeSetBuilder();
    const selection = state.selection;
    const doc = state.doc;
    const decorations = [];

    const iterRange = range ? { from: range.from, to: range.to } : { from: 0, to: Math.min(doc.length, PREFIX) };

    syntaxTree(state).iterate({
        ...iterRange,
        enter: (node) => {
            const { name, from: nodeFrom, to: nodeTo } = node;

            if (name === "EmphasisMark") {
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
            }

            if (name === "LinkMark" || name === "URL") {
                const parent = node.node.parent;
                if (parent && parent.name === "Link") {
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
            }

            if (name === "ListMark") {
                const parent = node.node.parent;
                if (parent && parent.name === "ListItem") {
                    const grandParent = parent.parent;
                    const isOrdered = grandParent && grandParent.name === "OrderedList";

                    if (isOrdered) {
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
            }

            if (name === "TaskMarker") {
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
                    const isChecked = doc.sliceString(nodeFrom, nodeTo).includes("x");
                    decorations.push({
                        from: nodeFrom, to: nodeTo, value: Decoration.replace({
                            widget: new CheckboxWidget(isChecked)
                        })
                    });
                }
            }

            if (name.startsWith("ATXHeading")) {
                if (!isCursorOnLine(selection, doc, nodeFrom)) {
                    const headerText = doc.sliceString(nodeFrom, nodeTo);
                    const match = headerText.match(/^#+\s+/);
                    if (match) {
                        const hideFrom = nodeFrom;
                        const hideTo = nodeFrom + match[0].length;
                        decorations.push({ from: hideFrom, to: hideTo, value: Decoration.replace({}) });
                    }
                }
            }

            if (name === "HorizontalRule") {
                if (!isCursorOnLine(selection, doc, nodeFrom)) {
                    decorations.push({
                        from: nodeFrom, to: nodeTo, value: Decoration.replace({
                            widget: new HRWidget()
                        })
                    });
                }
            }

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
        const sideDiff = (a.value.startSide ?? 0) - (b.value.startSide ?? 0);
        if (sideDiff !== 0) return sideDiff;
        return a.to - b.to;
    });

    for (const deco of decorations) {
        builder.add(deco.from, deco.to, deco.value);
    }

    return builder.finish();
};

export const setLivePreviewViewport = StateEffect.define();

const livePreviewViewportField = StateField.define({
    create: () => null,
    update(range, tr) {
        for (const e of tr.effects) {
            if (e.is(setLivePreviewViewport)) return e.value;
        }
        return range;
    }
});

const livePreviewField = StateField.define({
    create(state) {
        return buildDecorations(state);
    },
    update(decorations, transaction) {
        if (transaction.docChanged || transaction.selection || transaction.effects.some(e => e.is(setLivePreviewViewport))) {
            const range = transaction.state.field(livePreviewViewportField, false);
            return buildDecorations(transaction.state, range);
        }
        return decorations;
    },
    provide: field => EditorView.decorations.from(field)
});

export function convertTableToHTML(text) {
    const rows = text.trim().split('\n');
    if (rows.length < 2) return "<div class='cm-table-empty'>Empty Table</div>";

    let alignments = [];

    // Check for delimiter row at index 1
    const potentialDelimiter = rows[1].trim();
    // Matches | :---: | --- | formatting
    // Must contain - or : and only valid delimiter chars
    const isValidDelimiter = /^\|?[\s\-:|]+\|?$/.test(potentialDelimiter) && potentialDelimiter.includes('-');
    if (isValidDelimiter) {
        const cleanDelimiter = potentialDelimiter.replace(/^\|/, '').replace(/\|$/, '');
        alignments = cleanDelimiter.split('|').map(s => {
            s = s.trim();
            if (s.startsWith(':') && s.endsWith(':')) return 'center';
            if (s.endsWith(':')) return 'right';
            if (s.startsWith(':')) return 'left';
            return null;
        });
    }

    // If no valid delimiter row, return empty table
    if (!isValidDelimiter) {
        return "<div class='cm-table-empty'>Empty Table</div>";
    }

    let headerContent = "";
    let bodyContent = "";

    for (let i = 0; i < rows.length; i++) {
        // Skip delimiter row
        if (i === 1) continue;

        const row = rows[i];
        const cleanRow = row.trim().replace(/^\|/, '').replace(/\|$/, '');
        if (!cleanRow.trim()) continue; // Skip empty rows

        const isHeader = i === 0;
        const cellTag = isHeader ? "th" : "td";

        let rowHtml = "<tr>";
        const cells = cleanRow.split('|');
        for (let j = 0; j < cells.length; j++) {
            const content = cells[j].trim();
            const parsed = parseCellContent(content);
            let alignAttr = "";
            if (alignments[j]) {
                alignAttr = ` style="text-align: ${alignments[j]}"`;
            }
            rowHtml += `<${cellTag}${alignAttr}>${parsed}</${cellTag}>`;
        }
        rowHtml += "</tr>";

        if (isHeader) {
            headerContent += rowHtml;
        } else {
            bodyContent += rowHtml;
        }
    }

    // Return empty table div if no header rows
    if (!headerContent) {
        return "<div class='cm-table-empty'>Empty Table</div>";
    }

    let html = "<table>" +
              "<thead>" +
              headerContent +
              "</thead>";
    if (bodyContent) {
        html += "<tbody>" +
                bodyContent +
                "</tbody>";
    }
    html += "</table>";

    return html;
}

// ponytail: PAD margins outside viewport; constructs larger than PAD starting above viewport may lose decorations until scrolled into range
const PAD = 2000;

const livePreviewViewportPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        this.publish(view);
    }

    update(u) {
        if (u.viewportChanged || u.docChanged) {
            this.publish(u.view);
        }
    }

    publish(view) {
        const { from, to } = view.viewport;
        const docLen = view.state.doc.length;
        const range = { from: Math.max(0, from - PAD), to: Math.min(docLen, to + PAD) };
        const cur = view.state.field(livePreviewViewportField, false);
        if (!cur || cur.from !== range.from || cur.to !== range.to) {
            view.dispatch({ effects: setLivePreviewViewport.of(range) });
        }
    }
});

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
    livePreviewViewportField,
    livePreviewViewportPlugin,
    highlightPlugin
];
