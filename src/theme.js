import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

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
    { tag: tags.url, color: "var(--text-muted)", textDecoration: "underline" },

    // Block Elements
    { tag: tags.quote, color: "var(--text-muted)", fontStyle: "italic" },
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
