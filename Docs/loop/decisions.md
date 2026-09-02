# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Round B — P2-atomic (persistence hardening)

**Schema version reads outside transactions:** `saveSnapshot()` reads `schemaVersion` from the metadata store BEFORE opening the transaction (not inside). This is necessary because IndexedDB forbids nested/concurrent transactions — attempting `db.get()` inside an active transaction fails with InvalidStateError. The version check is cached in `shouldStampVersion` and used inside the transaction.

**Metadata debounce window at 400ms:** The debounce for reactive metadata saves (activeTabId, recentFiles, settings) is pinned at 400ms to reduce IPC churn on rapid state changes (e.g., fast tab switches). Tab saves remain at 1000ms. Structural metadata writes (createTab, closeTab, tabOrder effect, onPromoted) stay synchronous/immediate and bypass the debounce.

**Schema version not encrypted:** The `schemaVersion` key is stored as a raw number in the metadata store, not encrypted. This allows `getSchemaVersion()` to read it without requiring the encryption key, enabling pre-launch schema detection/migration in future versions.

### Round B — persistence hardening (reviewer-noted corners)
- **`loadSession` stamps `schemaVersion` and runs in secondary windows too.** Architect flagged as a minor CLAUDE.md deviation ("secondary reads only"). Kept as-is: the stamp is a single idempotent write of the constant `1` on a pre-versioning DB only (guarded `typeof !== 'number'`), not session data, no race (last-write-wins on an identical value). Tests pin this path. Revisit if a real migration lands.
- **`onPromoted` still persists non-atomically** (`saveTab` loop + separate `saveMetadata({tabOrder})`) rather than `saveSnapshot` — a crash between them reproduces the tabOrder/tab-set inconsistency Round B fixes elsewhere. Left deliberately: a failover test pins `onPromoted`'s granular call counts, and promotion re-reads disk + re-merges on the next promotion so it self-heals. FOLD INTO Round G (context split) — switch to `saveSnapshot` and update the failover test.
