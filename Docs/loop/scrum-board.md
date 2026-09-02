# Build loop — audit remediation

Queue = all audit findings, ordered by severity. Baseline: `main` @ aeafaf9, 13 test files / 42 tests green.
Branch: `fix/audit-remediation`.

| # | Task | Sev | Findings | Status | Rounds | Commit |
|---|------|-----|----------|--------|--------|--------|
| 1 | crypto hardening: sentinel + throw-on-tamper, chunked base64, key-gen under lock (+ load-path isolation) | P0 | P0-1, P0-2, P1-9, P1-10 | done | 3 | 50c8304 |
| 2 | export XSS: sanitize + escape HTML export; drop dead exportToPdf stub; expand sanitize allowlist + drop SAFE_FOR_TEMPLATES (merged Task 11) | P0 | P0-3, P2-sanitize | in-review | 1 | |
| 3 | primary-window failover: queued lock + promotion | P0 | P0-4 | queued | 0 | |
| 4 | last-tab delete guard + cancel pending debounced saveTab on close | P0 | P0-5, P2-close-timer | queued | 0 | |
| 5 | editor: real isDirty compare; find/replace try-catch | P1 | P1-4, P1-11 | queued | 0 | |
| 6 | livePreview: scope decoration build to viewport + changed ranges | P1 | P1-2 | queued | 0 | |
| 7 | image/link large-doc repaint fix (annotation transaction) | P1 | P1-3 | queued | 0 | |
| 8 | gate tabOrder write on id-list join | P1 | P1-5 | queued | 0 | |
| 9 | close paths: sync dirty guard all windows + Electron close handler; flush editor before save; save-failure toast + requestPermission | P1 | P1-6, P1-7, P1-8 | queued | 0 | |
| 10 | electron path hardening: realpathSync in isPathSafe; narrow userData allowlist | P1 | P1-12, P1-13 | queued | 0 | |
| 11 | ~~sanitize allowlist~~ — MERGED INTO TASK 2 | P2 | P2-sanitize | merged | 0 | — |
| 12 | Electron PDF export: Buffer.from(blob); dialog filters by extension | P2 | P2-pdf | queued | 0 | |
| 13 | requestIdleCallback guard + double-rAF/flushSync before capture | P2 | P2-ric | queued | 0 | |
| 14 | debounce saveMetadata; coalesce with tab-order write | P2 | P2-meta | queued | 0 | |
| 15 | storage: atomic tabs+metadata txn; reserve schemaVersion | P2 | P2-atomic | queued | 0 | |
| 16 | goToLine lower bound (verify P1 fix); ctrl-click scheme check (verify) | P2 | P2-gotoline, P2-ctrlclick | queued | 0 | |
| 17 | CI/release: test gate in release.yml; extract-changelog em-dash; drop UNLICENSED; node align; npm ci; version-sync assert | P2 | P2-ci | queued | 0 | |
| 18 | wire "Clear Session Data" button | P2 | P2-settings | queued | 0 | |
| 19 | extract extensions/selection.js (4x isCursorTouching + isCursorOnLine) | P3 | P3-selection | queued | 0 | |
| 20 | extract inlineMarkdownToHtml util (3x parser) | P3 | P3-inline | queued | 0 | |
| 21 | extract makeDebouncedDecorationPlugin factory (2x block) | P3 | P3-debounce | queued | 0 | |
| 22 | extract persistTab() (triplicated save ladder) + canSaveInPlace() | P3 | P3-persist | queued | 0 | |
| 23 | dead-code sweep: unused imports/widgets/css/stubs; collapse theme blocks; hoist syntaxTree in textDirection | P3 | P3-dead | queued | 0 | |
| 24 | useMemo SessionContext value; memoize useCommands return | P3 | P3-memo | queued | 0 | |
| 25 | test backfill: isPathSafe, crypto failure modes, listKeymap, convertTableToHTML, extract-changelog, livePreview reveal | P3 | P3-tests | queued | 0 | |
| 26 | reconcile GEMINI.md; double-rAF scroll restore | P3 | P3-misc | queued | 0 | |

Statuses: queued → tests-written → in-progress → in-review → done

## Log

- **Task 1** (3 rounds). crypto.js: `NFv1:` sentinel on ciphertext; `decrypt` throws on tampered/wrong-key sentinel blob instead of silently returning `''`; chunked `uint8ToBase64` (200k-char safe, kills P0-2 RangeError); module-scope `cachedKey` memo; key create/migrate under `navigator.locks` `notepad-flux-key`. storage.js: per-row decrypt isolation in `loadSession` (one bad tab no longer drops the whole session), degraded tab tagged `_decryptFailed` + `saveTab` skip-guard so `saveSession`-on-close can't re-encrypt `''` over intact ciphertext. Bug(high) caught by architect R2 (silent disk wipe on close) → fixed R3. Intentional security-property reversal recorded: non-sentinel legacy path now returns undecryptable input unchanged (old `''` also destroyed real legacy plaintext). Tests: `crypto.hardening.test.js` (16, new), `crypto.test.js` (2 stale assertions rewritten by tactical), `storage.test.js` (+1 isolation test). 59 total green.
  - For later tasks: `decrypt` is now a throwing function on the `NFv1:` path — any NEW caller must handle rejection. `_decryptFailed` is an in-memory-only tab flag; don't rely on it surviving a round-trip.
