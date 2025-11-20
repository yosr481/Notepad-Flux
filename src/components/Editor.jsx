import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { livePreview } from '../extensions/livePreview';
import { imagePreview } from '../extensions/imagePreview';
import { linkPreview } from '../extensions/linkPreview';
import { obsidianTheme } from '../theme';

const Editor = () => {
    const editorRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) return;

        const startState = EditorState.create({
            doc: `# Markdown Test Document

## 1. Basic Markdown Behaviors

### 1.1 Headings
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

### 1.2 Text Emphasis
**Bold text**
*Italic text*
***Bold and italic***
==Highlighted text==
~~Strikethrough text~~

### 1.3 Lists

#### Unordered Lists
- Item 1
- Item 2
- Item 3

* Alternative bullet 1
* Alternative bullet 2

#### Ordered Lists
1. First item
2. Second item
3. Third item

#### Task Lists
- [ ] Unchecked task
- [x] Completed task
- [ ] Another unchecked task

### 1.4 Links and Images
[Simple link](https://example.com)
[Link with title](https://example.com "Example Title")
![Image alt text](https://via.placeholder.com/150)

### 1.5 Code

Inline code: \`console.log('Hello')\`

Code block:
\`\`\`javascript
function test() {
  return "Hello World";
}
\`\`\`

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\`

### 1.6 Blockquotes
> Single line quote

> Multi-line quote
> that spans multiple
> lines

### 1.7 Horizontal Rules
---
***
___

### 1.8 Tables
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## 2. Complex Scenarios

### 2.1 Mixed Formatting
This paragraph has **bold**, *italic*, ***bold italic***, ==highlighted==, ~~strikethrough~~, and \`inline code\` all together.

### 2.2 Long Lists
1. First item with a very long text that should wrap to multiple lines to test how the editor handles wrapped content
2. Second item
3. Third item with **bold** and *italic* text
4. Fourth item with \`inline code\`
5. Fifth item

### 2.3 Complex Code Blocks
\`\`\`javascript
// Complex code with syntax
class Editor {
  constructor(options) {
    this.options = options;
    this.initialize();
  }
  
  initialize() {
    console.log("Editor initialized");
  }
}
\`\`\`

### 2.4 Multiple Consecutive Blockquotes
> First blockquote
> with multiple lines

> Second blockquote
> immediately after

> Third blockquote

### 2.5 Complex Table
| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Bold | ✅ | High | Working |
| Italic | ✅ | High | Working |
| Tables | 🔧 | Medium | Testing |
| Code | ✅ | High | Working |

## 3. Nested Markdown

### 3.1 Lists with Nested Items
- Parent item 1
  - Child item 1.1
  - Child item 1.2
    - Grandchild item 1.2.1
    - Grandchild item 1.2.2
  - Child item 1.3
- Parent item 2
  - Child item 2.1

### 3.2 Ordered Lists with Nesting
1. First level item 1
   1. Second level item 1.1
   2. Second level item 1.2
      1. Third level item 1.2.1
      2. Third level item 1.2.2
2. First level item 2

### 3.3 Task Lists with Nesting
- [ ] Parent task
  - [x] Completed subtask
  - [ ] Uncompleted subtask
    - [ ] Nested subtask
- [x] Completed parent task
  - [x] All subtasks done

### 3.4 Blockquotes with Nested Elements
> This blockquote contains:
> - A list item
> - Another list item
>   - Nested list item
> 
> And **bold text** and *italic text*
> 
> \`\`\`javascript
> // Even code blocks
> const x = 42;
> \`\`\`

### 3.5 Lists with Mixed Content
1. Item with **bold** text
   - Nested bullet with *italic*
   - Another nested bullet with \`code\`
2. Item with [a link](https://example.com)
   > And a nested blockquote
3. Item with code:
   \`\`\`
   const test = true;
   \`\`\`

### 3.6 Deeply Nested Lists
- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5
          - Level 6

## 4. Edge Cases

### 4.1 Empty Elements
**Bold with nothing**

*Italic with nothing*


Multiple empty lines above

### 4.2 Special Characters
**Bold with *nested italic* inside**
*Italic with **nested bold** inside*

### 4.3 Malformed Markdown
**Unclosed bold
*Unclosed italic

### 4.4 Multiple Markers
****Four asterisks****
***Three asterisks***

### 4.5 Inline Code with Backticks
\`code with \\\`escaped backticks\\\` inside\`

### 4.6 Links and Emphasis Combined
**[Bold link](https://example.com)**
*[Italic link](https://example.com)*
[Link with **bold** text](https://example.com)

### 4.7 Table Edge Cases
| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
|Very long cell content that should wrap|C2|R2|

### 4.8 Blockquote Edge Cases
>No space after marker
> Extra  spaces  in  text

> Blockquote with empty line above

### 4.9 Mixed Nesting
> **Bold in blockquote**
> - List in blockquote
>   - Nested list in blockquote
>     > Nested blockquote in list in blockquote
>     > With **bold** and *italic*

### 4.10 Code Block Edge Cases
\`\`\`
No language specified
\`\`\`

\`\`\`unknown-language
Unknown language
\`\`\`

### 4.11 Consecutive Emphasis
**bold1** **bold2** **bold3**
*italic1* *italic2* *italic3*

### 4.12 URLs and Paths
https://www.example.com
C:\\Users\\Path\\To\\File.txt
/unix/path/to/file.txt

---

## Test Instructions
1. Move your cursor through each section
2. Verify that markdown syntax appears/disappears correctly
3. Check that nested elements render properly
4. Verify table rendering
5. Test code block syntax highlighting
6. Ensure blockquotes maintain proper indentation
7. Check that wrapped lines display correctly
8. Verify all emphasis styles work (bold, italic, highlight, strikethrough)
`,
            extensions: [
                keymap.of([...defaultKeymap, ...historyKeymap]),
                history(),
                EditorView.lineWrapping,
                markdown({ base: markdownLanguage, codeLanguages: languages }),
                livePreview, // Our custom extension
                imagePreview,
                linkPreview,
                obsidianTheme
            ]
        });

        const view = new EditorView({
            state: startState,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, []);

    return <div ref={editorRef} className="cm-editor-container" style={{ height: '100%' }} />;
};

export default Editor;
