import { Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// RTL Character Range (Hebrew, Arabic, Syriac, Thaana, N'Ko, etc.)
const RTL_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

// Markdown Patterns to Ignore at Start of Line
// 1. Headers: #, ##, etc.
// 2. Lists: -, *, +, 1.
// 3. Blockquotes: >
// 4. Code Block Fences: ```, ~~~
// 5. Checkboxes: - [ ]
// 6. Links/Images/Wikilinks: [, ![
// 7. Styles: **, *, __, _, ==, ~~, `
const MD_IGNORE_PATTERN = /^(\s*)(#{1,6}\s+|[-*+]\s+(\[\s?[xX]?\s?\]\s+)?|\d+\.\s+|>\s*|`{3,}|~{3,}|!?\[{1,2}|={2}|~{2}|`+|\*{1,3}|_{1,3})/;

const rtlDecoration = Decoration.line({
    attributes: { dir: "rtl" }
});

const ltrDecoration = Decoration.line({
    attributes: { dir: "ltr" }
});

const textDirectionPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.buildDecorations(view);
    }

    update(update) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view) {
        const builder = new RangeSetBuilder();
        const { state } = view;
        const { doc } = state;

        for (const { from, to } of view.visibleRanges) {
            // Iterate over lines in the visible range
            const startLine = doc.lineAt(from);
            const endLine = doc.lineAt(to);

            let row = startLine;
            while (true) {
                // Check if line is inside a Code Block or Table
                // We use the syntax tree to check the type of the node at the start of the line
                const tree = syntaxTree(state);
                const node = tree.resolveInner(row.from, 1);
                const typeName = node ? node.type.name : "";

                // Allow RTL in normal "Paragraph", "ATXHeading", "SetextHeading", "ListItem", "Blockquote"
                // explicit skip for CodeBlock, Table
                const isCodeOrTable = typeName.includes("Code") || typeName.includes("Table") || typeName.includes("Math");

                // Note: Resolved node might be a child (e.g., "ListMark"). We might want to check parents.
                // But generally, code blocks and tables are distinct enough. 
                // Let's refine: FencedCode, IndentedCode, HTMLBlock?
                // Actually, syntaxTree.resolveInner at line start usually gives the block type if it's a wrapper.
                // Let's try to detect if we are strictly INSIDE a code block content.

                let shouldIgnore = false;

                // Helper to check ancestors
                let curr = node;
                while (curr) {
                    if (curr.name.includes("FencedCode") || curr.name.includes("Table")) {
                        shouldIgnore = true;
                        break;
                    }
                    curr = curr.parent;
                }

                if (!shouldIgnore) {
                    const text = row.text;
                    const cleanText = text.replace(MD_IGNORE_PATTERN, "");
                    const trimmed = cleanText.trim();

                    if (trimmed.length > 0) {
                        const firstChar = trimmed[0];
                        if (RTL_REGEX.test(firstChar)) {
                            builder.add(row.from, row.from, rtlDecoration);
                        } else {
                            // Optional: Explicitly set LTR? 
                            // If the whole container becomes RTL, we might want this.
                            // For now, assuming default is LTR, so we only need to flag RTL.
                            // However, if we mix, it's safer to not enforce LTR unless we know we are in an RTL context.
                            // But keeping it simple: Only tag RTL lines.

                            // User request: "If it's RTL char, we adjust this line to the right".
                            // Implicitly, standard lines stay left.
                        }
                    }
                }

                if (row.number >= endLine.number) break;
                row = doc.line(row.number + 1);
            }
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});

export const textDirection = [
    textDirectionPlugin
];
