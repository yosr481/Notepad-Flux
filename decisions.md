# Decisions — Notepad Flux

Dated decision log. Entries land here when they graduate out of `HANDOFF.md` §5
(the rolling ledger) — a decision plus its rationale, so the ledger stays short
without losing the "why".

---

## 2026-09-06 — curated out of HANDOFF.md §5 (render-audit loop residue)

- **#84 (code-audit remediation) merged to `main` as `7dba5d0`.** Done; recorded
  here so the ledger no longer carries it.
- **v1.4.0 release trigger recipe.** A release is cut by: bump `version` in
  `package.json`, move CHANGELOG `## [Unreleased]` → `## [1.4.0]`, then
  `git tag v1.4.0`. The tag is the *only* trigger — `.github/workflows/release.yml`
  builds Windows + Linux installers, extracts notes from `CHANGELOG.md` via
  `scripts/extract-changelog.js`, publishes the GitHub Release.
  `pending-questions.md` Q1 recommended `1.4.0` as the version for the
  render-audit loop work (PR #85). Not yet released as of this date.
- **Render-audit loop rationale lives in its own doc.** Full 9/9-task TDD loop
  reasoning + FUTURE-8 (12 deferred render items) are in
  `Docs/internal/loop/design-decisions.md`. Note: `Docs/internal/**` and
  `HANDOFF.md` are gitignored, so that doc is local-only.

## 2026-11-15 — curated out of HANDOFF.md §5 (2026-11-10/11 and 2026-11-12 sessions)

- **Released as 1.4.0** (minor: new features — drag-drop, status-bar EOL/charset, session log, tab strip).
- **Merged #90 despite CodeQL red:** every alert was in test/e2e code, none in shipped code;
  `main` is unprotected. Fixing them is qa-owner's job.
- **PR strategy: 4 stacked PRs instead of #85.** 52 commits, +6.1k lines over 73 files, no
  review in two months; commits group by path with two exceptions that were split
  (`Split-from:` trailers). Renderer and tab work can merge now; shell work waits for manual QA.
- **Build root cause:** `releaseInfo.releaseNotesFile` pointed at a gitignored file only the
  release workflow generated. `prebuild` now runs `scripts/extract-changelog.js`.
- **Windows installers are built here in two steps**, because electron-builder needs wine for
  NSIS and its one-shot build stalled in the container: `npx electron-builder --win dir --x64
  --ia32 --publish never` natively, copy `app-update.yml` from `release/linux-unpacked/resources`
  into each `win*-unpacked/resources` (a `dir` target writes none), then
  `docker run … electronuserland/builder:wine … npx electron-builder --win nsis --x64
  --prepackaged release/win-unpacked --publish never` (and the same for ia32). CI on Windows
  builds the real thing in one step.
- **Id policy (final):** tabs that exist in a window before a session load or a take-over keep
  their ids; a saved tab whose id clashes gets the fresh id, and its old row is deleted after
  the snapshot. Renaming the live tab instead was tried and removed: updates already issued
  under the old id reached the wrong tab.
- **Window lifetime (Yossi's choice):** the app stays open until the last window closes; a
  remaining window takes over the session; File > Exit closes every window through its guard.
- **RTL caret jump is not an app defect:** stock CodeMirror in Chromium draws the caret at the
  other edge of a bidi run boundary; the test now compares against a stock control.
- **Accepted:** `![a](a.png title)` (unquoted title) loads `a.png title`, as on `main`.

## 2026-11-15 — Electron 40 → 45

- **Windows ia32 dropped (Yossi's choice).** Electron 44+ publishes no 32-bit Windows
  binaries. Staying on 43 would keep it only until 43's end of life (Jan 2027). A 32-bit
  install on 1.4.4 auto-updates to an x64 installer that fails, so it stays on 1.4.4.
- **safeStorage moved to the async API in the same round** (sync is removed in 46). Probe on
  this machine (gnome_libsecret): sync and async share the `v11` format and key, each reads
  the other's blobs, `shouldReEncrypt` false. Still acted on (review finding): if the flag is
  set, crypto.js rewrites the secure copy, replacing the old one only after the new one reads
  back to the same key. Otherwise a rotated keyring could later leave the only key copy unreadable.
