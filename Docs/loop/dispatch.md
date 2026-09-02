# dispatch.md — paste the shared block into every dispatch

## SHARED BLOCK

You have not seen any other part of this conversation. Repo root:
`/home/rienitz/Documents/LifeOS/05-Utilities/Notepad_Flux`
Branch: `fix/audit-remediation` (already checked out).

Project: Notepad Flux — Electron + React 19 + CodeMirror 6 markdown editor. ESM.
- Test runner: `npx vitest run <path>` (jsdom env, globals enabled, setup `src/test/setup.js`).
- Lint: `npm run lint` (flat eslint config; `no-unused-vars` warns, ignores `^[A-Z_]` / `^_`).
- Tests live in `__tests__/` next to the code they cover. `fake-indexeddb` available for storage.
- Full context on architecture: `CLAUDE.md`, `Docs/ARCHITECTURE.md`.
- Writer records non-obvious assumptions in `Docs/loop/decisions.md` (one entry per task).
- Security boundaries — keep tight, do not relax: `electron/main.js` IPC path validation,
  `src/utils/sanitize.js` DOMPurify, `electron/preload.js`. Never enable nodeIntegration.
- Modes in force: ponytail (laziest working solution, YAGNI, mark capped corners with
  `ponytail:` comment) + caveman (terse prose; normal prose in code/commits).

## GOTCHAS (grow this — each entry cost a review round)

- (none yet)

## VERIFICATION

- `npx vitest run` — full suite must stay green (baseline 42 tests).
- `npm run lint` — no new errors.
- crypto/storage/security-path changes: the failure-mode test is the point, not the happy path.

## ROLE SLOTS

### loop-tactical (test-writing, step 1)
{{TASK_SPEC}}
Pinned contract:
{{CONTRACT}}
Write the full test suite now. No implementation exists — tests must fail (import/assert).
Tests are the spec. At most the files named in the task. Report the run output.

### loop-writer (implement, step 2)
{{TASK_SPEC}}
Contract summary:
{{CONTRACT}}
The test file `{{TESTS}}` is the real spec — read it first. Implement to green.
Never edit tests. Test looks wrong → report it, don't fix.

### loop-tactical (review, step 3) / loop-architect (review, step 3)
{{TASK_SPEC}}
Diff under review:
{{DIFF}}
Writer decisions: {{DECISIONS}}
Re-run the tests yourself. Verdict: done / needs-revision / needs-design / bug(low|mid|high).

### loop-writer (revision, step 4)
Merged review findings to fix:
{{FINDINGS}}
Fix all non-minor. Never edit tests.
