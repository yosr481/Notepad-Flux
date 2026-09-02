# Design & architecture decisions — build-loop audit remediation

Running log. User: "Ok for all now, log all decisions for me to review after the build loop is fully done."
Every non-trivial UI / architecture fork made during the loop lands here with: what, options, chosen, rationale, task.

---

## Confirmed by user (AskUserQuestion, 2026-09-02)

### A1 — Primary-window failover gap (Task 3, P0-4)
Options: buffer+flush on promotion / opportunistic last-write-wins / block editing until promoted.
**Chosen: buffer + flush on promotion.** Secondary window holds writes in memory during the gap between the old primary dying and this window winning the lock; flushes on promotion. No data loss.

### A2 — Decrypt-failure user surface (Task 1 follow-up)
Options: silent / toast on restore / full per-tab recovery UI.
**Chosen: toast on restore** ("N tab(s) couldn't be restored"). Full recovery UI deferred to a later ticket (logged as FUTURE-1 below).

### A3 — SessionContext refactor depth (Task 24, P3)
Options: useMemo value only / split into 3 contexts.
**Chosen: split into settings / tab-state / actions contexts.** Bigger change — touches every `useSession` consumer — but the god-context is a named architectural finding, not just a perf nit.

### U1 — dialogs.js replacement (Task 23 / Task 18)
Options: in-app `<ConfirmDialog>` / Electron `showMessageBox` via IPC.
**Chosen: in-app `<ConfirmDialog>` React component.** Matches existing modal patterns (Settings, GoToLine). Also backs U2 (Clear Session Data confirm).

---

## Recommended, user said "Ok for all" — applying unless a review flags a problem

### A4 — storage schemaVersion (Task 15)
**Reserve a `schemaVersion` key + empty migration slot.** No migration framework (YAGNI — `DB_VERSION` still 1, no schema change pending).

### A5 — Icon libraries (Task 23)
`lucide-react` + `phosphor-react` both installed; `phosphor-react` is deprecated upstream (→ `@phosphor-icons/react`).
**Drop `phosphor-react`, migrate its call sites to `lucide-react`.** Call-site count to be confirmed during Task 23; if large with no lucide equivalents, revisit.

### A6 — Code signing for auto-updates (Task 17)
Auto-updates ship unsigned (no `CSC_LINK` etc.). Needs a real Windows Authenticode cert — cannot be done headless.
**Document the gap in release notes / a KNOWN-ISSUES entry; do not attempt.** User decision required later: buy a cert or accept unsigned.

### A7 — CI `npm audit` hard-fail (Task 17)
`npm audit --audit-level=moderate` with no allowlist → any future transitive advisory blocks `main`.
**Switch to `continue-on-error: true` + a separate reporting step.** Keeps signal, stops unrelated advisories from wedging releases.

### U2 — "Clear Session Data" button (Task 18)
**Wire it to a confirm dialog first (U1 component), then wipe + reload.** No "export first" offer (YAGNI; user can export manually).

### U3 — HTML export styling (Task 2, shipped)
**Kept the minimal built-in `sans-serif` inline stylesheet.** Not matched to app theme, no toggle. Revisit only on request.

### U4 — isDirty semantics (Task 5)
**Track CodeMirror doc version against last-saved version; undo-to-saved clears dirty.** Not a plain content-string compare (that wouldn't clear on undo).

---

## Deferred to future tickets (not in this loop)

- **FUTURE-1** — full per-tab decrypt-recovery UI (keep-empty / remove / export-raw-ciphertext). A2 shipped the toast only.
- **FUTURE-2** — code-signing cert acquisition + wiring (A6).
- **FUTURE-3** — remote-image loading in editor/Print is now possible after Task 2's `img` allowlist; add a "block remote images" setting if privacy matters.

---

## Decisions made autonomously during tasks (record as they happen)

### Task 1 — crypto hardening
- **Security-property reversal (intentional).** Pre-change `decrypt` guaranteed it never returned ciphertext-shaped data (collapsed every failure to `''`). Dropped for the non-sentinel legacy path: undecryptable legacy input now returns unchanged. Rationale: old `''` also destroyed genuine legacy plaintext; with the `NFv1:` sentinel, all new data takes the strict throw path, so exposure is bounded to pre-migration rows.
- **`decrypt` is now a throwing function** on the `NFv1:` path. Any new caller must handle rejection.
- **`_decryptFailed` in-memory tab flag** + `saveTab` skip-guard: a tab that failed to decrypt loads empty and is not persisted until the user puts real content in it, so `saveSession`-on-close can't zero the intact ciphertext on disk.

### Task 2 — export XSS + sanitize
- **Single sanitize profile, widened** (not a separate export profile). All four `sanitizeHTML` callers feed `marked()` output through the same function; the dropped tags were structural markdown output missing for everyone.
- **Hand-rolled 6-line `escapeHtml` local in export.js** rather than reusing `sanitizeText` — different job (escape-to-literal for a `<title>` text context vs strip-tags).
- **`markdownToHtml` export kept** though now unused internally — harmless, out of scope to chase callers.

### Batched architect review (Tasks 4/5/8/9), 2026-09-02 — deferred items
- **editorRef calling-convention inconsistency (nit, not fixed).** `closeTab(id,{editorRef})` vs `closeOtherTabs(id, editorRef)` vs `saveFile(editorRef)` — three signatures for the same App-level ref. Cleanest fix is `useCommands(showToast, editorRef)` once, dropping ~6 call-site edits. FOLD INTO Task 24 (useCommands memoize/cleanup) rather than a standalone round.
- **Tab-switch dirty-flag divergence (bug(low), not fixed).** Editor rebaselines `savedContentRef` on every `activeTabId` change, so right after a tab switch the editor treats the tab as clean while SessionContext still has `isDirty:true`. Narrow break: edit A → switch away+back → edit-and-exact-revert A silently clears the dirty flag with no save (content still in the IndexedDB session, recoverable; tab dot stays correct via context until then). FUTURE-4 — revisit if it bites; proper fix ties Editor's baseline to the context tab's last-saved marker, likely part of Task 24's context split.
- **`|| tab.content` empty-doc fallback (bug(low), FIXED inline in commit after Task 9).** `saveFile`/`saveFileAs` treated a cleared doc `''` as "use stale copy". Now `editorRef?.current ? getCurrentContent() : tab.content`.

### Task 10 scoping — P1-6b deferred
- **Electron `win.on('close')` dirty-guard IPC (P1-6b) — deferred, not in Task 10.** Task 9's synchronous `beforeunload` `preventDefault()` + `returnValue=''` already triggers Electron's built-in unsaved-changes dialog on window close (Electron honors `beforeunload` by default). A dedicated `win.on('close')` → IPC → renderer `closeWindow()` → confirm round-trip is a refinement (custom prompt copy, save-on-close), not a data-loss gap, and is untestable under vitest. FUTURE-5.
