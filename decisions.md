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

## 2026-11-16 — backlog round (deps majors, B2–B5, housekeeping)

- **Removed `vite-plugin-electron-renderer`.** It gives the renderer Node modules; a
  sandboxed renderer with no `nodeIntegration` never uses them, and 0.14 breaks on Vite 8.
- **Vite 8 broke the packaged app while unit tests and dev mode stayed green.** Rolldown
  gives the bundle a `require` shim that returns Vite's empty browser stub for `path`, so a
  guarded `require('path')` that was always undefined in the sandbox started "working" and
  `path.basename` threw on every open/save/drop (39 e2e checks). Fix: delete the dead
  require. Lesson: a bundler major needs the packaged e2e run, not only unit tests.
- **`react-hooks/refs` set to warn.** New in eslint-plugin-react-hooks 7.1; it flags our
  deliberate latest-value refs written in render. Rewriting the close-gate code for a lint
  rule is risk with no gain.
- **Overrides raised past advisories:** `minimatch ^11.0.1`, `glob ^14.0.2` (dev tooling
  only). License Check verified after each change (a glob override broke it in 1.4.4).
- **`esbuild` declared as a devDependency:** the e2e harness imports it; it used to come
  through Vite 7.
- **B2: the stale `resolveLinkDefs` memo is not real** (WeakMap per state; each new state
  reads the fuller tree). The real defect was next to it: `decorationPlugin` ignored
  tree-only updates, so reference images stayed raw text in large files until input.
  Fixed; on large docs tree changes share the edit debounce (review finding: otherwise one
  full-document scan per parse slice).
- **B3 fixed with per-load gates:** `onPromoted` arms a fresh gate synchronously; each
  finished load stores its own gate in state, and an effect resolves exactly that gate.
  A counter alone left two races (review findings), which per-load gates close.
- **B4 not fixed: not reproducible.** The page subscribes to `flush-before-close` before
  `did-finish-load`, even with 20x CPU throttle. The `closereload` e2e scenario guards it.
  No new IPC channel for an unseen race.
- **B5:** real profile log has 2 launches on 1.5.0, no "close without saving". Keep watching.
- **Housekeeping:** `release/` old installers deleted (3.1 GB → 712 MB, Yossi approved);
  `pending-questions.md` (2026-09) archived. Its Q2 and Q4 render gaps were fixed in
  `fb362b2`; leftovers became backlog F7 (raw HTML) and C4 (livePreview cleanup).

## 2026-11-16 — math rendering library

- **MathJax, not KaTeX.** Yossi chose "the library Obsidian uses"; Obsidian renders
  `$…$` / `$$…$$` with MathJax, so notes written there look the same here. Cost: bigger and
  slower than KaTeX, so it is lazy-loaded and only for documents that contain math.

## 2026-11-19 — 2.0.0 release

- **Released as 2.0.0** (major: the markdown-coverage round F2–F7 plus S1, S2, C4, B1, B8,
  B9, B12). Shipped as 16 stacked PRs (#113–#128), merged top-down into their bases with merge
  commits, so #113 carried the whole stack and `main` CI ran once on the full content. Then
  #129 (version bump), tag `v2.0.0`, release run 44476287696 green.
- **Release gate:** unit 3732/3732 on a quiet machine; packaged e2e on the stack tip Linux
  192/192, Windows 195/195 (+1 not automatable), 0 page errors. Full packaged runs flake
  when other sessions load the host (Unity builds, clang); check `uptime` first and rerun
  failures with `--only` before calling them regressions.
- **Licences: per-package exceptions, not wider licence lists** (Yossi). Mermaid brings
  `elkjs` (EPL-2.0 OR GPL-3.0-or-later, shipped unmodified as a lazy chunk; EPL-2.0 allows
  that in an MIT app) and `robust-predicates` (public domain + Unlicense). Allowed by name in
  `dependency-review.yml`, so a new dependency under those licences still fails.
- **CodeQL alerts in test code get fixed, not dismissed** (unlike #90): one was a real
  test gap (the no-inline-script check missed `<SCRIPT>`).
- **B8:** ProgIDs namespaced (`NotepadFlux.*`) and the open command quoted by an NSIS
  `customInstall` macro, because electron-builder 26 hardcodes the unquoted form. Upgrade
  from 1.6.0 verified: the old uninstaller removes the generic `Markdown`/`Text` classes.
- **B1:** root cause was `view.setState()` keeping the old `scrollTop`; reset it on tab
  switch. Upstream CodeMirror gap, not reported yet: `posAtCoords` doesn't guard
  `lineAt() == null` after "Viewport failed to stabilize".
- **B9:** shortcuts match `e.code` with exact modifiers. Held Ctrl+N/W/O/P is swallowed
  (`preventDefault`, no action) so a repeat can't reach a native default like print.
  Accepted side effect: Ctrl+F5 / Shift+F5 no longer insert the date.
