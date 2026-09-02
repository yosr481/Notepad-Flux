# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 10

**Lexical guard before realpath**: The check `filePath.includes('..')` on the ORIGINAL `filePath` (not `resolve(filePath)`) is intentionally done before any fs call. This catches and rejects path traversal attempts outright, without relying on `realpath` normalization. The predicate rejects the raw string if it contains `..`, even if `resolve()` would then resolve it away.

**Two-level canonicalization fallback**: When `realpath(resolve(filePath))` throws ENOENT (file doesn't exist, e.g., a brand-new file for `save-file`), the predicate falls back to `realpath(resolve(dirname(resolve(filePath))))` (the parent). This handles the case where a user saves a new file to a newly-created subdirectory within an allowed tree — the file and sometimes even its immediate parent don't exist on disk yet, but the ancestor directory does. If the parent also throws, the predicate returns `false` immediately (no further fallback).

**Injected realpath function**: `realpath` is passed in as a parameter (production: `realpathSync`; tests: a fake map-backed version). This decouples the predicate from the filesystem for testability and allows future switching to async/cached variants without changing the predicate signature.

**Stale allowed entries are silently skipped**: If an entry in `allowedPaths` has been deleted from disk since being added (so `realpath(allowed)` throws), the predicate skips that entry and continues checking the rest. This prevents a cascading failure when a user deletes a folder that was previously picked and added to the allowlist.
