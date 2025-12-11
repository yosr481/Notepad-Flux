import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Base Theme (Layout & Colors)
export const obsidianBaseTheme = EditorView.theme({
    "&": {
        color: "var(--text-normal)",
        backgroundColor: "var(--background-primary)",
        height: "100%",
        fontSize: "16px"
    },
    ".cm-content": {
        caretColor: "var(--text-normal)",
        fontFamily: "var(--font-text)",
        paddingBottom: "30vh"
    },
    ".cm-scroller": {
        fontFamily: "var(--font-text)"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "var(--text-normal)"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "var(--text-selection)"
    },
    ".cm-gutters": {
        backgroundColor: "var(--background-primary)",
        color: "var(--text-muted)",
        border: "none"
    },
    ".cm-searchMatch": {
        backgroundColor: "var(--text-highlight-bg)",
        borderRadius: "2px"
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--text-highlight-bg-active)",
        border: "1px solid var(--text-accent)"
    }
});

// Syntax Highlighting (Markdown Elements)
export const obsidianHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontSize: "1.6em", fontWeight: "bold", color: "var(--text-normal)" },
    { tag: tags.heading2, fontSize: "1.4em", fontWeight: "bold", color: "var(--text-normal)" },
    { tag: tags.heading3, fontSize: "1.2em", fontWeight: "bold", color: "var(--text-normal)" },
    { tag: tags.heading4, fontSize: "1.1em", fontWeight: "bold", color: "var(--text-normal)" },
    { tag: tags.heading5, fontSize: "1.0em", fontWeight: "bold", color: "var(--text-normal)" },
    { tag: tags.heading6, fontSize: "0.9em", fontWeight: "bold", color: "var(--text-muted)" },

    { tag: tags.strong, fontWeight: "bold", color: "var(--text-normal)" },
    { tag: tags.emphasis, fontStyle: "italic", color: "var(--text-normal)" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--text-muted)" },

    { tag: tags.link, color: "var(--text-accent)", textDecoration: "none" },
    { tag: tags.url, color: "var(--text-faint)", textDecoration: "underline" },

    { tag: tags.quote, color: "var(--text-muted)", fontStyle: "italic" },
    { tag: tags.monospace, fontFamily: "var(--font-monospace)", backgroundColor: "var(--background-secondary)", padding: "2px 4px", borderRadius: "4px", color: "var(--text-normal)" },

    { tag: tags.list, color: "var(--text-accent)" },

    // Hide formatting characters (hashtags, asterisks) by making them faint or transparent if needed
    // But livePreview.js handles hiding them completely. 
    // We style them just in case they are visible (e.g. under cursor)
    { tag: tags.processingInstruction, color: "var(--text-faint)" },
    { tag: tags.meta, color: "var(--text-faint)" },

    // Code Highlighting
    { tag: tags.keyword, color: "var(--syntax-keyword)" },
    { tag: tags.operator, color: "var(--text-accent)" },
    { tag: tags.comment, color: "var(--text-faint)", fontStyle: "italic" },
    { tag: tags.string, color: "var(--syntax-string)" },
    { tag: tags.regexp, color: "var(--syntax-regexp)" },
    { tag: tags.number, color: "var(--syntax-number)" },
    { tag: tags.bool, color: "var(--syntax-bool)" },
    { tag: tags.variableName, color: "var(--text-normal)" },
    { tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
    { tag: tags.className, color: "var(--syntax-class)" },
    { tag: tags.typeName, color: "var(--syntax-class)" },
    { tag: tags.propertyName, color: "var(--syntax-property)" }
]);

export const obsidianTheme = [
    obsidianBaseTheme,
    syntaxHighlighting(obsidianHighlightStyle)
];
