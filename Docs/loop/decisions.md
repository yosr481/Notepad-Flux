# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 7
Empty `dispatch({})` from the debounce timer forces the update cycle CodeMirror needs to apply `this.decorations`; `requestMeasure()` only scheduled a DOM measure, not an update. Same one-line change in both `imagePreview.js` and `linkPreview.js` (deduplication is Task 21).
