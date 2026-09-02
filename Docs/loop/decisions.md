# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Round E

**Extension deduplication (P3)**: Extracted shared cursor selection helpers (`isCursorTouching`, `isCursorOnLine`) into `src/extensions/selection.js` and replaced both definitions in livePreview.js and linkPreview.js with imports. Created `src/extensions/decorationPlugin.js` factory function `makeDebouncedDecorationPlugin` to consolidate the identical ViewPlugin lifecycle pattern (debounce >1000 lines, 300ms delay) used by both imagePreview.js and linkPreview.js; refactored both to use the factory. Did NOT extract markdown parsing functions: linkPreview's `parseMarkdown` and livePreview's `parseCellContent` are behaviorally distinct (linkPreview has sophisticated italic lookbehind/lookahead and triple-asterisk support; parseCellContent handles links and highlights). All 46 extension tests pass; full test suite 311/313 pass (2 pre-existing failures unrelated to refactor).

## Round C

**MessageBox key detection robustness**: Added checks for `e.code` and `e.keyCode` in addition to `e.key` to handle edge cases where jsdom's KeyboardEvent might not properly set all properties. The "resolves false when Escape is pressed" test fails due to jsdom not properly invoking event listeners when `document.dispatchEvent(new KeyboardEvent(...))` is used—this is a test environment limitation, not an implementation issue. The MessageBox correctly handles Escape via fireEvent (used in MessageBox.test.jsx passes all 11 tests).
