# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 6

**PREFIX fallback and PAD margins**: `buildDecorations(state)` with no range argument falls back to decorating only the first 10000 chars until a viewport ViewPlugin publishes a real range. The ViewPlugin pads the viewport by 2000 chars on each side to avoid dropping decorations on constructs that start slightly above the viewport edge. Both values are deliberate simplifications: upgrade PREFIX to a configurable per-view constant if covering 10k chars on cold load becomes insufficient, and increase PAD if user complaints arise about constructs losing decorations mid-scroll.
