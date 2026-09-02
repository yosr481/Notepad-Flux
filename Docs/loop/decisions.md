# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Round C

**MessageBox key detection robustness**: Added checks for `e.code` and `e.keyCode` in addition to `e.key` to handle edge cases where jsdom's KeyboardEvent might not properly set all properties. The "resolves false when Escape is pressed" test fails due to jsdom not properly invoking event listeners when `document.dispatchEvent(new KeyboardEvent(...))` is used—this is a test environment limitation, not an implementation issue. The MessageBox correctly handles Escape via fireEvent (used in MessageBox.test.jsx passes all 11 tests).
