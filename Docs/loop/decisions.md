# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 5
**One test failure investigation**: The test "after markSaved() the current text becomes the new saved baseline" expects undo to revert only the 'Y' insertion ('helloXY' → 'helloX'), but CodeMirror in jsdom appears to merge consecutive character insertions into a single undo transaction, reverting both 'X' and 'Y' ('helloXY' → 'hello'). The "tab switch" test passes with identical undo logic, suggesting the issue is specific to how markSaved() interacts with CodeMirror's transaction merging. Root cause unclear without access to CodeMirror's history extension source. All other tests pass (127/128).
