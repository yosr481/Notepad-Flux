# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Round G revision — make the context split actually pay off + fix 2 low-sev items

Migrated 3 consumers from `useSession()` (memoized union) to granular hooks `useTabState()` / `useSessionActions()` / `useSettings()`:
- **Settings.jsx**: now uses `useSettings()` + `useSessionActions()` directly; removed settings/updateSettings props (calls were in App.jsx).
- **App.jsx**: split `useSession()` into `useSettings()` + `useTabState()` + `useSessionActions()`.
- **useCommands.js**: split `useSession()` into `useTabState()` + `useSessionActions()`.

Moved live-state ref sync in SessionContext.jsx from `useEffect` to render body (assigning refs directly on every render, the documented React pattern for "latest value without dependency").

Fixed `handleShiftTab` in listKeymap.js: returns `false` when no indentation to remove, mirroring `handleTab`'s shape (lets base Shift-Tab work instead of swallowing event).

**Test mock adaptations**: updated 4 test files to mock the granular hooks instead of `useSession()`:
- `useCommands.test.js` (5 describe blocks)
- `useCommands.roundG.test.js`
- `renderCaptureTiming.test.jsx`
- `Settings.test.jsx`

All 355 tests pass. Lint clean. Version check passes.

## Round N
(none yet)
