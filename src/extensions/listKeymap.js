import { keymap } from "@codemirror/view";
import { indentMore, indentLess } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";

const isListLine = (state, line) => {
    const text = line.text;
    return /^\s*([-*]|\d+\.)\s/.test(text);
};

const isTaskLine = (text) => {
    return /^\s*([-*])\s+\[[ xX]\]\s/.test(text);
};

const isEmptyListLine = (state, line) => {
    const text = line.text;
    if (isTaskLine(text)) {
        return /^\s*([-*])\s+\[[ xX]\]\s*$/.test(text);
    }
    return /^\s*([-*]|\d+\.)\s*$/.test(text);
};

const handleEnter = (view) => {
    const { state } = view;
    const { doc, selection } = state;
    const pos = selection.main.head;
    const line = doc.lineAt(pos);

    if (isListLine(state, line)) {
        if (isEmptyListLine(state, line)) {
            // Case 2: Empty list item -> Delete bullet and exit list (stay on same line)
            view.dispatch({
                changes: { from: line.from, to: line.to, insert: "" }
            });
            return true;
        } else {
            // Case 1: Non-empty list item -> Create new item on next line

            // Check for Task List first
            const taskMatch = line.text.match(/^(\s*)([-*])\s+\[[ xX]\](\s+)/);
            if (taskMatch) {
                const indent = taskMatch[1];
                const bullet = taskMatch[2];
                const space = taskMatch[3];
                // Always create unchecked task
                const insertText = `\n${indent}${bullet} [ ]${space}`;
                view.dispatch({
                    changes: { from: pos, insert: insertText },
                    selection: { anchor: pos + insertText.length }
                });
                return true;
            }

            // Regular List
            const match = line.text.match(/^(\s*)([-*]|\d+\.)(\s+)/);
            if (match) {
                const indent = match[1];
                const marker = match[2];
                const space = match[3];

                let newMarker = marker;
                if (/^\d+\.$/.test(marker)) {
                    const num = parseInt(marker);
                    newMarker = (num + 1) + ".";
                }

                const insertText = `\n${indent}${newMarker}${space}`;
                view.dispatch({
                    changes: { from: pos, insert: insertText },
                    selection: { anchor: pos + insertText.length }
                });
                return true;
            }
        }
    }
    return false;
};

const handleTab = (view) => {
    const { state } = view;
    const { doc, selection } = state;
    const pos = selection.main.head;
    const line = doc.lineAt(pos);

    if (isListLine(state, line)) {
        // Check if it's the first item in a list block
        // We look at the previous line.
        if (line.number > 1) {
            const prevLine = doc.line(line.number - 1);
            if (isListLine(state, prevLine)) {
                // There is an item above -> Indent (Nest)
                return indentMore(view);
            }
        }
        // First item or no item above -> Regular Tab (insert tab or do nothing if we want to enforce list structure)
        // User said "treat as regular tab".
        // Default tab behavior usually inserts tab character or indents line.
        // Let's return false to let default handler take over.
        return false;
    }
    return false;
};

export const listKeymap = keymap.of([
    { key: "Enter", run: handleEnter },
    { key: "Tab", run: handleTab }
]);
