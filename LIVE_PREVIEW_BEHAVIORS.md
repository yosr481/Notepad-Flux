# Live Preview Markdown Behaviors & Styles

This document provides a comprehensive overview of all markdown rendering behaviors, editor interactions, and styling in the Live Preview mode of this application.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Activation Modes](#activation-modes)
3. [Inline Formatting](#inline-formatting)
4. [Headings](#headings)
5. [Lists](#lists)
6. [Links](#links)
7. [Images](#images)
8. [Code](#code)
9. [Blockquotes](#blockquotes)
10. [Tables](#tables)
11. [Horizontal Rules](#horizontal-rules)
12. [Highlights](#highlights)
13. [Keyboard Behaviors](#keyboard-behaviors)
14. [Styling Reference](#styling-reference)

---

## Core Philosophy

The Live Preview mode provides a **WYSIWYG-style** editing experience where:

- **Markdown syntax is hidden by default** and only revealed when actively editing
- **Rendered content is displayed inline** for a clean reading experience
- **Cursor interaction** determines when syntax becomes visible
- **Smooth transitions** between editing and reading modes

---

## Activation Modes

The editor uses two primary activation modes to determine when to show/hide markdown syntax:

### Range-Based Activation
Used for inline elements (bold, italic, strikethrough, links, inline code, etc.)

**Trigger**: Cursor **touches** the element range
- If cursor is anywhere within `[from, to]` of the element, syntax is revealed
- Otherwise, syntax is hidden and content is rendered

### Line-Based Activation
Used for block elements (headings, blockquotes, horizontal rules)

**Trigger**: Cursor is on the **same line** as the element
- If cursor is anywhere on the line containing the element, syntax is revealed
- Otherwise, syntax is hidden and content is rendered

### Block-Based Activation
Used for multi-line elements (tables, code blocks)

**Trigger**: Cursor **touches** any part of the block
- If cursor is within the entire block range, syntax is revealed
- Otherwise, the block is replaced with a rendered widget

---

## Inline Formatting

### Bold (`**text**` or `__text__`)

**Inactive State** (cursor not touching):
- Asterisks/underscores are **hidden**
- Text appears **bold**
- Font weight: `bold`

**Active State** (cursor touching):
- Asterisks/underscores are **visible**
- Text remains bold
- Allows editing of markers

**Nested Handling**:
- Supports nested emphasis (e.g., `***bold italic***`)
- If cursor touches outer emphasis, inner markers are also revealed

---

### Italic (`*text*` or `_text_`)

**Inactive State**:
- Asterisks/underscores are **hidden**
- Text appears *italic*
- Font style: `italic`

**Active State**:
- Asterisks/underscores are **visible**
- Text remains italic
- Allows editing of markers

---

### Strikethrough (`~~text~~`)

**Inactive State**:
- Tildes (`~~`) are **hidden**
- Text has **line-through** decoration
- Color: `var(--text-muted)`
- Class: `.cm-strikethrough`

**Active State**:
- Tildes are **visible**
- Strikethrough styling remains
- Allows editing of markers

---

## Headings

Supports ATX-style headings (`# H1` through `###### H6`)

**Inactive State** (cursor not on line):
- Hash symbols (`#`) and trailing space are **hidden**
- Text is rendered with appropriate heading size
- Font weight: `bold`

**Active State** (cursor on line):
- Hash symbols and space are **visible**
- Heading styling remains
- Allows editing of heading level

**Sizes**:
- H1: `1.6em`
- H2: `1.4em`
- H3: `1.2em`
- H4: `1.1em`
- H5: `1.0em`
- H6: `0.9em` (muted color)

---

## Lists

### Unordered Lists (`-` or `*`)

**Inactive State**:
- Dash/asterisk is **replaced** with a bullet widget (`•`)
- Class: `.cm-bullet`
- Bullet color: Inherits from theme

**Active State** (cursor touching marker):
- Original dash/asterisk is **visible**
- Allows editing of list structure

**Ordered Lists** (`1.`, `2.`, etc.):
- Numbers are **always visible** (not replaced)
- Supports auto-incrementing on Enter key

---

### Task Lists (`- [ ]` or `- [x]`)

**Inactive State**:
- Dash is **hidden**
- Checkbox marker (`[ ]` or `[x]`) is **replaced** with interactive checkbox widget
- Checkbox is clickable and toggles state
- Class: `.cm-checkbox`

**Active State** (cursor touching dash OR checkbox):
- Dash is **visible**
- Checkbox marker is **visible** as text
- Allows editing of task syntax

**Checkbox Interaction**:
- Click checkbox to toggle between `[ ]` (unchecked) and `[x]` (checked)
- Updates document content directly
- Prevents default focus behavior

---

## Links

### Markdown Links (`[text](url)`)

**Inactive State**:
- Brackets and parentheses are **hidden**
- Link is rendered as clickable anchor element
- Displays link text with external link icon
- Color: `var(--text-accent)`
- Text decoration: `underline`
- Icon: External link SVG (12x12)

**Active State** (cursor touching):
- Full markdown syntax is **visible**
- Link is not clickable
- Allows editing of text and URL

**Link Rendering**:
- Supports markdown formatting in link text (bold, italic, strikethrough, code)
- Opens in new tab (`target="_blank"`)
- Security: `rel="noopener noreferrer"`

**Tooltip**:
- Hover over inactive link shows: "Ctrl + Click to open link"
- Tooltip disappears when cursor touches link

**Click Behavior**:
- `Ctrl + Click` (or `Cmd + Click` on Mac) opens link in new tab
- Regular click moves cursor to link for editing

---

## Images

### Markdown Images (`![alt](url)`)

**Inactive State**:
- Markdown syntax is **replaced** with rendered image
- Image displays inline with proper sizing
- Max width: `100%`
- Border radius: `4px`
- Margin: `0.5em 0`

**Active State** (cursor touching syntax):
- Markdown syntax is **visible** on the line
- Image preview appears **below** the syntax line
- Display: `block`
- Allows editing of alt text and URL

**Loading States**:
- Uses LRU cache (limit: 100 images) for performance
- Shows loading state while fetching
- Debounced updates for large documents (>1000 lines)

**Broken Images**:
- Displays broken image icon (SVG)
- Shows alt text or "Image not found"
- Background: `var(--background-secondary)`
- Border: `1px solid var(--background-modifier-border)`
- Class: `.cm-image-broken`

**Image Cache**:
- Global cache shared across editor instances
- Prevents redundant network requests
- Handles pending requests to avoid duplicates

---

## Code

### Inline Code (`` `text` ``)

**Inactive State**:
- Backticks are **hidden**
- Text has monospace font and background
- Background: `var(--background-secondary)`
- Padding: `2px 6px`
- Border radius: `3px`
- Font: `var(--font-monospace)`
- Font size: `0.9em`
- Class: `.cm-inline-code`

**Active State**:
- Backticks are **visible**
- Styling remains
- Allows editing of code content

---

### Code Blocks (Fenced with ` ``` `)

**Inactive State**:
- Opening and closing fence markers (` ``` `) are **hidden**
- Language identifier is **hidden**
- Code content is displayed with background
- Background: `var(--background-secondary)`
- Font: `var(--font-monospace)`
- Font size: `0.9em`
- Line height: `1.6`
- Padding: `0.75em 1em`
- Border radius: `4px`
- Class: `.cm-code-block`

**Active State** (cursor touching block):
- Fence markers are **visible** but **faint**
- Language identifier is **visible** but **faint**
- Class: `.cm-faint-syntax`
- Opacity: `0.7`
- Code block background remains

**Styling Details**:
- First line: Top padding and rounded top corners
- Last line: Bottom padding and rounded bottom corners
- Single-line blocks: All corners rounded
- Full-width background with `min-width: 100%`

---

## Blockquotes

### Blockquote (`> text`)

**Inactive State** (cursor not on line):
- Quote marker (`>`) is **hidden**
- Left border is displayed
- Border: `4px solid var(--blockquote-border)`
- Padding left: `1.5em`
- Class: `.cm-blockquote-line`

**Active State** (cursor on line):
- Quote marker (`>`) is **visible**
- Border remains
- Allows editing of quote content

**Multi-line Blockquotes**:
- Each line gets the border decoration
- Continuous border effect across all lines
- Quote markers hidden/shown per line based on cursor position

---

## Tables

### Markdown Tables

**Inactive State** (cursor not touching):
- Entire markdown table is **replaced** with rendered HTML table
- Proper table formatting with borders
- Border collapse: `collapse`
- Cell borders: `1px solid var(--background-modifier-border)`
- Cell padding: `8px`
- Header background: `var(--background-secondary)`
- Header font weight: `600`
- Class: `.cm-table-widget`

**Active State** (cursor touching):
- Raw markdown syntax is **visible**
- Allows editing of table structure
- Pipe characters and alignment markers visible

**Table Rendering**:
- First row treated as header (`<th>`)
- Subsequent rows as data (`<td>`)
- Alignment row (`| --- |`) is skipped
- Supports markdown formatting in cells (bold, italic, strikethrough, code, links, highlights)

**Click Behavior**:
- Clicking table (when inactive) moves cursor to table start
- Allows links in table cells to be clickable
- Prevents default mousedown on table widget

---

## Horizontal Rules

### HR (`---`, `***`, or `___`)

**Inactive State** (cursor not on line):
- Markdown syntax is **replaced** with `<hr>` widget
- Border: `2px solid var(--interactive-accent)`
- Opacity: `0.5`
- Margin: `1em 0`
- Class: `.cm-hr`

**Active State** (cursor on line):
- Raw markdown syntax is **visible**
- Allows editing

---

## Highlights

### Highlighted Text (`==text==`)

**Inactive State**:
- Equal signs (`==`) are **hidden**
- Text has background highlight
- Background: `var(--text-highlight-bg)`
- Padding: `2px 4px`
- Border radius: `4px`
- Class: `.cm-highlight`

**Active State** (cursor touching):
- Equal signs are **visible**
- Background highlight remains
- Allows editing of markers

**Implementation**:
- Uses regex matching (`/==(.*?)==/g`)
- Implemented via ViewPlugin for performance
- Respects cursor selection for show/hide behavior

---

## Keyboard Behaviors

### Enter Key in Lists

**Non-empty list item**:
- Creates new list item on next line
- Preserves indentation
- For ordered lists: Auto-increments number
- For task lists: Creates new unchecked task (`[ ]`)

**Empty list item**:
- Deletes the bullet/marker
- Exits list mode
- Stays on current line (no new line created)

---

### Tab Key in Lists

**First item in list** (no item above):
- Behaves as regular Tab
- Returns `false` to allow default handler

**Subsequent items** (item above exists):
- Indents the list item (nesting)
- Uses `indentMore` command
- Creates nested list structure

---

### Shift+Tab in Lists

**Behavior**:
- Unindents the list item
- Uses `indentLess` command
- Moves item up one level in hierarchy

---

## Styling Reference

### CSS Variables Used

**Colors**:
- `--text-normal`: Primary text color
- `--text-muted`: Secondary/muted text
- `--text-faint`: Very faint text (syntax markers)
- `--text-accent`: Accent color (links, bullets)
- `--background-primary`: Main background
- `--background-secondary`: Secondary background (code, tables)
- `--background-modifier-border`: Border color
- `--text-selection`: Selection highlight
- `--text-highlight-bg`: Highlight background (`==text==`)
- `--blockquote-border`: Blockquote left border
- `--interactive-accent`: Interactive elements

**Fonts**:
- `--font-text`: Primary text font
- `--font-monospace`: Monospace font for code

**Syntax Highlighting** (for code blocks):
- `--syntax-keyword`: Keywords
- `--syntax-string`: Strings
- `--syntax-regexp`: Regular expressions
- `--syntax-number`: Numbers
- `--syntax-bool`: Booleans
- `--syntax-function`: Functions
- `--syntax-class`: Classes
- `--syntax-property`: Properties

---

### Key CSS Classes

**Markdown Elements**:
- `.cm-bullet`: Bullet widget
- `.cm-checkbox`: Task checkbox widget
- `.cm-hr`: Horizontal rule widget
- `.cm-table-widget`: Table container
- `.cm-code-block`: Code block line decoration
- `.cm-inline-code`: Inline code styling
- `.cm-highlight`: Highlighted text
- `.cm-strikethrough`: Strikethrough text
- `.cm-blockquote-line`: Blockquote line decoration
- `.cm-link`: Rendered link element
- `.cm-image`: Rendered image
- `.cm-image-broken`: Broken image display

**Syntax Markers**:
- `.cm-faint-syntax`: Faint syntax markers (active code blocks)
- `.cm-formatting`: General formatting characters

**Image States**:
- `.cm-image-container`: Image wrapper
- `.cm-image-loading`: Loading state
- `.cm-broken-icon`: Broken image icon
- `.cm-broken-text`: Broken image text

---

## Performance Optimizations

### Image Preview
- **LRU Cache**: Limits cached images to 100
- **Debouncing**: 300ms delay for large documents (>1000 lines)
- **Pending Requests**: Prevents duplicate network requests
- **Image Decoding**: Uses `img.decode()` for smooth rendering

### Link Preview
- **Debouncing**: 300ms delay for large documents
- **Viewport-based**: Only processes visible ranges
- **Regex Matching**: Efficient pattern matching

### Live Preview Decorations
- **Sorted Decorations**: Ensures RangeSetBuilder requirements
- **Incremental Updates**: Only rebuilds on doc/selection changes
- **Viewport Optimization**: Processes only visible content

---

## Extension Architecture

### Core Extensions

1. **`livePreview.js`**: Main live preview logic
   - Handles syntax hiding/revealing
   - Manages decorations for all markdown elements
   - Implements activation modes

2. **`widgets.js`**: Widget definitions
   - `BulletWidget`: Bullet point replacement
   - `CheckboxWidget`: Interactive task checkbox
   - `HRWidget`: Horizontal rule
   - `TableWidget`: Rendered table
   - `CodeBlockWidget`: Code block (currently unused)

3. **`imagePreview.js`**: Image rendering
   - Image loading and caching
   - Broken image handling
   - Active/inactive state management

4. **`linkPreview.js`**: Link rendering
   - Link widget with icon
   - Markdown parsing in link text
   - Cursor-based activation

5. **`linkHandler.js`**: Link interaction
   - Ctrl+Click to open links
   - Hover tooltip
   - URL extraction from syntax tree

6. **`listKeymap.js`**: List keyboard behaviors
   - Enter key handling
   - Tab/Shift+Tab indentation
   - Task list creation

---

## Theme Integration

The editor uses a theme system defined in `theme.js`:

**Base Theme** (`obsidianBaseTheme`):
- Sets editor layout and colors
- Configures cursor, selection, and gutters
- Uses CSS variables for theming

**Highlight Style** (`obsidianHighlightStyle`):
- Defines syntax highlighting for markdown elements
- Configures heading sizes
- Sets colors for inline formatting

**Theme Export**:
```javascript
export const obsidianTheme = [
    obsidianBaseTheme,
    syntaxHighlighting(obsidianHighlightStyle)
];
```

---

## Future Enhancements

Potential areas for expansion:

- **Footnotes**: Support for `[^1]` syntax
- **Collapsible Sections**: Fold/unfold headings
- **Table Editing**: Enhanced table editing experience
- **Image Resizing**: width and height attributes for image sizing

---

## Testing Recommendations

When testing Live Preview behaviors:

1. **Cursor Positioning**: Test cursor at various positions (before, inside, after elements)
2. **Selection Ranges**: Test with text selections spanning multiple elements
3. **Nested Elements**: Test nested formatting (bold inside italic, etc.)
4. **Multi-line Elements**: Test blockquotes, code blocks, and tables across many lines
5. **Edge Cases**: Empty elements, malformed syntax, special characters
6. **Performance**: Test with large documents (>1000 lines)
7. **Keyboard Navigation**: Test arrow keys, home/end, page up/down
8. **Copy/Paste**: Ensure markdown syntax is preserved
9. **Undo/Redo**: Verify state management
10. **Theme Switching**: Test in both light and dark modes

---

*Last Updated: 2025-11-26*
