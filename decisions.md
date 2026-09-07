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
