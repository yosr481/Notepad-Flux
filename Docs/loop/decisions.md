# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Round F — Cleanup

### 1. persistTab() extraction
Extracted save ladder (`if (fileHandle) → saveFile()` / `else if (!canSaveInPlace() && filePath) → saveFileAs()` / `else → saveFileAs()`) into `persistTab(tab, content)` helper to DRY three call sites in `closeTab`, `saveFile`, and `closeWindow`. Returns `true` on success, `false` on user cancel. Callers keep their `catch → showToast → return/abort` pattern. Also extracted `canSaveInPlace()` to replace `!fileSystem.isSupported()` checks, making intent clearer.

### 2. Dead code
- Removed unused `QuoteBarWidget` class from `widgets.js` (never imported)
- Removed unused `CodeBlockWidget` class from `widgets.js` (imported in `livePreview.js` but never used in the file); removed from import
- Removed unused import `getSearchQuery` from `Editor.jsx`
- Removed dead functions from `validation.js`: `sanitizeInput`, `isValidEmail`, `escapeForQuery` (zero non-test importers). Kept `limitLength` (used in `GoToLineDialog.jsx`)

### 3. phosphor-react → lucide-react
Updated 5 component files to import from `lucide-react` instead. Icon mappings: `X→X`, `CaretDown→ChevronDown`, `CaretUp→ChevronUp`, `ArrowLeft→ArrowLeft`, `Gear→Settings` (aliased to `SettingsIcon` in `MenuBar.jsx` to avoid name clash). Updated 2 test files to mock `lucide-react` instead. Removed `phosphor-react` from `package.json`; ran `npm install` to update lockfile. Version sync still OK.

### 4. GEMINI.md redirect
Replaced entire GEMINI.md with a short 2-line redirect to CLAUDE.md instead of stale duplicate.

### 5. Theme duplication
Merged effective rules from `fluxBaseTheme` (from `theme.js`) into the single inline `EditorView.theme({...})` in `Editor.jsx` (later-in-array rules were overriding it). Deleted `fluxBaseTheme` and `obsidianTheme` exports from `theme.js` (no longer used). Kept syntax highlighting (`fluxHighlightStyle`) in `theme.js`. Fixed double-space typo in `theme.js` line 73: `var(  --text-muted)` → `var(--text-muted)`.

### 6. textDirection.js invariant hoist
Hoisted `syntaxTree(state)` above the per-line loop (invariant, doesn't change during iteration). Added "IndentedCode" to the skip check (one-liner alongside existing "FencedCode" and "Table") to prevent RTL decoration on indented code blocks.
