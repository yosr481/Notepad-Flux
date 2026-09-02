# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 9

**showToast is optional in useCommands**: Tests call `useCommands()` without a showToast argument (P1-4 tests), while others pass it. Used optional chaining (`showToast?.()`) to guard all toast calls, making the param truly optional.

**Removed closingRef in App.jsx**: Simplified beforeunload effect per contract. No longer needed after replacing the complex isPrimaryWindow/closeWindow logic with simple dirty-tab check.
