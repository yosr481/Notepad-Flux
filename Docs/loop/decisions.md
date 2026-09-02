# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 3

**Three escape hatches for the one-time election effect**: (1) `currentTabsRef` synced in a separate effect lets `onPromoted` read the latest local `tabs` without adding it to the locks effect's dependency array (would rerun on every tab change, breaking the one-time election). (2) `setIsSessionLoaded(false)` at the top of `onPromoted` gates all save effects during the merge window so they don't write pristine state while tabs are reconciling. (3) `adoptSessionMeta(diskSession)` shared by both `loadAndSetupSession` (initial load) and `onPromoted` (promotion) ensures tabOrder/metadata divergence is impossible (both paths now sort by tabOrder and adopt metadata identically).
