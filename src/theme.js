import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Flux Design Theme (formerly obsidianBaseTheme)
export const fluxBaseTheme = EditorView.theme({
    "&": {
        color: "var(--text-normal)",
        backgroundColor: "var(--background-primary)",
        height: "100%",
        fontSize: "var(--font-size-normal)",
        fontFamily: "var(--font-text)"
    },
    ".cm-content": {
        caretColor: "var(--color-focus-blue)",
        fontFamily: "var(--font-text)",
        paddingBottom: "30vh",
        maxWidth: "var(--max-width-editor)",
        margin: "0",
        padding: "24px 24px",
        lineHeight: "var(--line-height-relaxed)"
    },
    ".cm-scroller": {
        fontFamily: "var(--font-text)",
        lineHeight: "var(--line-height-relaxed)"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "var(--color-focus-blue)"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "var(--text-selection)"
    },
    ".cm-gutters": {
        backgroundColor: "var(--background-primary)", // Seamless gutters
        color: "var(--text-muted)",
        border: "none",
        paddingRight: "var(--space-16)"
    },
    ".cm-activeLine": {
        backgroundColor: "transparent" // Disable default active line implementation to avoid clutter
    },
    ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--text-normal)"
    },
    ".cm-searchMatch": {
        backgroundColor: "var(--text-highlight-bg)",
        borderRadius: "var(--radius-s)"
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--text-highlight-bg-active)",
        border: "1px solid var(--text-accent)"
    }
});

// Flux Syntax Highlighting (Live Preview Focused)
export const fluxHighlightStyle = HighlightStyle.define([
    // Headings
    { tag: tags.heading1, fontSize: "var(--font-size-xxl)", fontWeight: "var(--font-weight-semibold)", color: "var(--text-normal)", letterSpacing: "-0.02em" },
    { tag: tags.heading2, fontSize: "var(--font-size-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--text-normal)", letterSpacing: "-0.01em" },
    { tag: tags.heading3, fontSize: "var(--font-size-l)", fontWeight: "var(--font-weight-medium)", color: "var(--text-normal)" },
    { tag: tags.heading4, fontSize: "var(--font-size-normal)", fontWeight: "var(--font-weight-medium)", color: "var(--text-muted)" },
    { tag: tags.heading5, fontSize: "var(--font-size-s)", fontWeight: "var(--font-weight-medium)", color: "var(--text-muted)" },
    { tag: tags.heading6, fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-medium)", color: "var(--text-muted)", textTransform: "uppercase" },

    // Inline Formatting
    { tag: tags.strong, fontWeight: "var(--font-weight-semibold)", color: "var(--text-normal)" },
    { tag: tags.emphasis, fontStyle: "italic", color: "var(--text-normal)" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--text-muted)", opacity: "0.6" },

    // Links
    { tag: tags.link, color: "var(--text-accent)", textDecoration: "none" },
    { tag: tags.url, color: "var(--text-faint)", textDecoration: "underline" },

    // Block Elements
    { tag: tags.quote, color: "var(--text-muted)", fontStyle: "italic", borderLeft: "4px solid var(--text-accent)" },
    { tag: tags.monospace, fontFamily: "var(--font-monospace)", backgroundColor: "var(--background-secondary)", padding: "2px 4px", borderRadius: "4px", color: "var(--text-normal)", fontSize: "0.9em" },

    // Lists
    { tag: tags.list, color: "var(--text-accent)" },

    // Markdown Syntax (Live Preview - Low Contrast)
    // Marks syntax like #, *, [, ] as low contrast to recede visually
    { tag: tags.processingInstruction, color: "var(--color-markdown-syntax)" },
    { tag: tags.meta, color: "var(--color-markdown-syntax)" },
    { tag: tags.punctuation, color: "var(--color-markdown-syntax)" },

    // Code Highlighting
    { tag: tags.keyword, color: "var(--syntax-keyword)" },
    { tag: tags.operator, color: "var(--text-accent)" },
    { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
    { tag: tags.string, color: "var(--syntax-string)" },
    { tag: tags.regexp, color: "var(--text-accent)" },
    { tag: tags.number, color: "var(--syntax-property)" },
    { tag: tags.bool, color: "var(--syntax-keyword)" },
    { tag: tags.variableName, color: "var(--text-normal)" },
    { tag: tags.function(tags.variableName), color: "var(--text-accent)" },
    { tag: tags.className, color: "var(--syntax-variable)" },
    { tag: tags.typeName, color: "var(--syntax-variable)" },
    { tag: tags.propertyName, color: "var(--syntax-property)" }
]);

// Export as obsidianTheme for compatibility, but it's now Flux
export const obsidianTheme = [
    fluxBaseTheme,
    syntaxHighlighting(fluxHighlightStyle)
];
