# Markdown Reference Guide

**Project:** Notepad Flux  
**Last Updated:** 2025-12-11

---

This reference guide provides a comprehensive overview of the Markdown syntax supported in Notepad Flux. All examples shown here will render correctly in the Live Preview mode.

---

## Table of Contents

1. [Headers](#headers)
2. [Emphasis](#emphasis)
3. [Lists](#lists)
4. [Links](#links)
5. [Code](#code)
6. [Tables](#tables)
7. [Blockquotes](#blockquotes)
8. [Horizontal Rules](#horizontal-rules)
9. [Line Breaks](#line-breaks)
10. [Task Lists](#task-lists)
11. [Highlights](#highlights)

---

## Headers

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6

Alternatively, for H1 and H2, an underline-ish style:

Alt-H1
======

Alt-H2
------
```

**Renders as:**

# H1

## H2

### H3

#### H4

##### H5

###### H6

Alternatively, for H1 and H2, an underline-ish style:

Alt-H1
======

Alt-H2
------

---

## Emphasis

```markdown
Emphasis, aka italics, with *asterisks* or _underscores_.

Strong emphasis, aka bold, with **asterisks** or __underscores__.

Combined emphasis with **asterisks and _underscores_**.

Strikethrough uses two tildes: ~~scratch this~~.
```

**Renders as:**

Emphasis, aka italics, with *asterisks* or _underscores_.

Strong emphasis, aka bold, with **asterisks** or __underscores__.

Combined emphasis with **asterisks and _underscores_**.

Strikethrough uses two tildes: ~~scratch this~~.

---

## Lists

### Unordered Lists

```markdown
* Unordered list can use asterisks
- Or minuses
+ Or pluses
  - Nested item (2 spaces)
    - Double nested (4 spaces)
```

**Renders as:**

* Unordered list can use asterisks
- Or minuses
+ Or pluses
  - Nested item (2 spaces)
    - Double nested (4 spaces)

### Ordered Lists

```markdown
1. First ordered list item
2. Another item
   1. Ordered sub-list
3. Actual numbers don't matter, just that it's a number
4. And another item.
```

**Renders as:**

1. First ordered list item
2. Another item
   1. Ordered sub-list
3. Actual numbers don't matter, just that it's a number
4. And another item.

### List Paragraphs

```markdown
1. You can have properly indented paragraphs within list items.
   
   Notice the blank line above, and the leading spaces.

2. To have a line break without a paragraph, use two trailing spaces.  
   Note that this line is separate, but within the same paragraph.
```

**Renders as:**

1. You can have properly indented paragraphs within list items.
   
   Notice the blank line above, and the leading spaces.

2. To have a line break without a paragraph, use two trailing spaces.  
   Note that this line is separate, but within the same paragraph.

---

## Links

```markdown
[I'm an inline-style link](https://www.google.com)

[I'm an inline-style link with title](https://www.google.com "Google's Homepage")

[You can use numbers for reference-style link definitions][1]

URLs in angle brackets will automatically get turned into links: 
<http://www.example.com>

[1]: https://www.example.com
```

**Renders as:**

[I'm an inline-style link](https://www.google.com)

[I'm an inline-style link with title](https://www.google.com "Google's Homepage")

[You can use numbers for reference-style link definitions][1]

URLs in angle brackets will automatically get turned into links: 
<http://www.example.com>

[1]: https://www.example.com

---

## Code

### Inline Code

```markdown
Inline `code` has `back-ticks around` it.
```

**Renders as:**

Inline `code` has `back-ticks around` it.

### Code Blocks

#### 4-Spaces Fence

```markdown
    s = "Code with space indent"
    print s
```

**Renders as:**

    s = "Code with space indent"
    print s

#### Backtick Fence

````markdown
```
Code goes here
Code goes here
```
````

**Renders as:**

```
Code goes here
Code goes here
```

#### Backtick Fence with Language

````markdown
```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
```
````

**Renders as:**

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
```

---

## Tables

```markdown
| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |
| zebra stripes | are neat      |    $1 |
```

**Renders as:**

| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |
| zebra stripes | are neat      |    $1 |

### Simple Table

You don't need to make the raw markdown line up prettily:

```markdown
Markdown | Less | Pretty
--- | --- | ---
*Still* | `renders` | **nicely**
1 | 2 | 3
```

**Renders as:**

| Markdown | Less      | Pretty     |
| -------- | --------- | ---------- |
| *Still*  | `renders` | **nicely** |
| 1        | 2         | 3          |

---

## Blockquotes

```markdown
> Blockquotes are very handy for emphasizing text.
> This line is part of the same quote.

Quote break.

> This is a very long line that will still be quoted properly when it wraps.
> You can *put* **Markdown** into a blockquote.
```

**Renders as:**

> Blockquotes are very handy for emphasizing text.
> This line is part of the same quote.

Quote break.

> This is a very long line that will still be quoted properly when it wraps.
> You can *put* **Markdown** into a blockquote.

---

## Horizontal Rules

Three or more...

```markdown
---

Hyphens

***

Asterisks

___

Underscores
```

**Renders as:**

---

Hyphens

***

Asterisks

___

Underscores

---

## Line Breaks

```markdown
Here's a line for us to start with.

This line is separated from the one above by two newlines, so it will be a *separate paragraph*.

This line is also a separate paragraph, but...  
This line is only separated by two trailing spaces and a single newline, so it's a separate line in the *same paragraph*.
```

**Renders as:**

Here's a line for us to start with.

This line is separated from the one above by two newlines, so it will be a *separate paragraph*.

This line is also a separate paragraph, but...  
This line is only separated by two trailing spaces and a single newline, so it's a separate line in the *same paragraph*.

---

## Task Lists

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task
  - [x] Nested completed task
  - [ ] Nested incomplete task
```

**Renders as:**

- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task
  - [x] Nested completed task
  - [ ] Nested incomplete task

**Note:** In Notepad Flux, you can click on the checkboxes to toggle their state!

---

## Highlights

```markdown
This is ==highlighted text== for emphasis.

You can combine ==**bold highlighted**== text.
```

**Renders as:**

This is ==highlighted text== for emphasis.

You can combine ==**bold highlighted**== text.

---

## Images

```markdown
![Alt text](https://via.placeholder.com/150 "Optional title")

Inline-style:
![alt text](https://via.placeholder.com/150)

Reference-style:
![alt text][logo]

[logo]: https://via.placeholder.com/150 "Logo Title"
```

**Note:** Images will be displayed inline in Notepad Flux when not actively editing the markdown syntax.

---

## Comments

You can add comments that won't appear in the preview:

```markdown
[comment]: # (This is a comment and won't be visible)
```

---

## Escaping Characters

Use backslash to escape markdown characters:

```markdown
\*This text is not italic\*
\# This is not a heading
\[This is not a link\]
```

**Renders as:**

\*This text is not italic\*  
\# This is not a heading  
\[This is not a link\]

---

## Keyboard Shortcuts

While editing in Notepad Flux:

- **Enter** in a list: Create a new list item
- **Enter** on an empty list item: Exit the list
- **Tab** in a list: Indent (nest) the item
- **Shift+Tab** in a list: Unindent the item
- **Ctrl+Click** on a link: Open the link in a new tab

---

## Best Practices

### Readability

1. **Use blank lines** between different block elements (headers, paragraphs, lists)
2. **Indent nested lists** with 2 or 4 spaces consistently
3. **Use descriptive link text** instead of "click here"
4. **Add alt text to images** for accessibility

### Compatibility

1. **Stick to standard markdown** for maximum compatibility
2. **Test special features** (like task lists and highlights) if exporting
3. **Use fenced code blocks** (with backticks) instead of indented code blocks for better language support

### Organization

1. **Use headings hierarchically** (don't skip levels)
2. **Use tables** for structured data
3. **Use blockquotes** for quotations or callouts
4. **Use horizontal rules** sparingly to separate major sections

---

## Cross-References

- For details on how these elements render in Live Preview, see [`FEATURES.md`](./FEATURES.md)
- For styling details, see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)

---

*This reference guide is based on standard Markdown syntax with some extensions supported by Notepad Flux.*

**Credits:**
- Original inspiration: [Markdown Cheatsheet by Adam Pritchard](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)
- License: [CC-BY](https://creativecommons.org/licenses/by/3.0/)
