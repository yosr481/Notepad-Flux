# Build loop — audit remediation

Queue = all audit findings, ordered by severity. Baseline: `main` @ aeafaf9, 13 test files / 42 tests green.
Branch: `fix/audit-remediation`.

| # | Task | Sev | Findings | Status | Rounds | Commit |
|---|------|-----|----------|--------|--------|--------|
| 1 | crypto hardening: sentinel + throw-on-tamper, chunked base64, key-gen under lock (+ load-path isolation) | P0 | P0-1, P0-2, P1-9, P1-10 | done | 3 | 50c8304 |
| 2 | export XSS: sanitize + escape HTML export; drop dead exportToPdf stub; expand sanitize allowlist + drop SAFE_FOR_TEMPLATES (merged Task 11) | P0 | P0-3, P2-sanitize | done | 1 | c5e3cc4 |
| 3 | primary-window failover: queued lock + promotion; buffer+flush edits in failover gap (A1); toast on decrypt-fail restore (A2) | P0 | P0-4 | done | 4 | 3d7a4c0 |
| 4 | last-tab delete guard + cancel pending debounced saveTab on close | P0 | P0-5, P2-close-timer | done | 1 | a9b27d1 |
| 5 | editor: real isDirty compare; find/replace try-catch | P1 | P1-4, P1-11 | done | 1 | a747031 |
| 6 | livePreview: scope decoration build to viewport + changed ranges (StateField + viewport StateEffect; architect in-round) | P1 | P1-2 | done | 1 | 1169c03 |
| 7 | image/link large-doc repaint fix (annotation transaction) | P1 | P1-3 | done | 1 | 55778c7 |
| 8 | gate tabOrder write on id-list join | P1 | P1-5 | done | 1 | ec76733 |
| 9 | close paths (renderer): flush live editor content before close-save; save-failure toast + requestPermission; synchronous beforeunload dirty guard for ALL windows | P1 | P1-7, P1-8, P1-6a | done | 1 | 79832cc |
| 10 | electron: extract+test isPathSafe with realpathSync (P1-12); drop userData root from allowlist (P1-13); architect in-round | P1 | P1-12, P1-13 | in-review | 1 | |
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
| 24 | split SessionContext into settings/tab-state/actions contexts (user pick A3); memoize useCommands return | P3 | P3-memo | queued | 0 | |
| 25 | test backfill: isPathSafe, crypto failure modes, listKeymap, convertTableToHTML, extract-changelog, livePreview reveal | P3 | P3-tests | queued | 0 | |
| 26 | reconcile GEMINI.md; double-rAF scroll restore | P3 | P3-misc | queued | 0 | |

Statuses: queued → tests-written → in-progress → in-review → done

## Log

- **Task 9** (1 round; tactical-only, needs-revision for one dead var → fixed inline). fileSystem.js: `WebNativeDriver.saveFile` gates on `queryPermission`/`requestPermission({mode:'readwrite'})` before `createWritable`, throws if denied. useCommands.js: `showToast` on every save/close-save failure (was bare console.error); `closeTab({editorRef})` + `closeWindow(editorRef)` save `editorRef.current.getCurrentContent()` for the ACTIVE tab (debounce-lag fix), `tab.content` otherwise; `closeOtherTabs`/`closeTabsToRight` take + forward `editorRef`. App.jsx: `beforeunload` now synchronous `preventDefault()`+`returnValue=''` for ANY dirty window (was `!isPrimaryWindow`-gated + broken async setTimeout); `closingRef` removed; editorRef threaded to all close entry points. Tactical repaired the P1-7 test block's missing `window.close` spy. 175 green. Electron `win.on('close')` guard = Task 10.

- **Task 8** (inline; trivial ~8-line effect gate + 2 tests). SessionContext tabOrder effect: compare `tabs.map(t=>t.id).join(',')` vs `prevTabOrderRef`, return early if unchanged — keystrokes no longer trigger an openDB+encrypt+txn for an unchanged value. 151 green.

- **Task 7** (1 round; no separate review — tactical wrote+verified the fix during test-writing, 2-line change eyeballed = spec). imagePreview.js + linkPreview.js: large-doc debounce timer now `this.pendingView.dispatch({})` instead of `requestMeasure()` — CM re-reads `this.decorations` only on an update cycle, not a measure, so widgets never appeared until an unrelated transaction. Empty tx = no changes/selection/effects = no recompute loop. Tests: imagePreview.test.js (new, 8) + linkPreview.test.js (+8). 149 green. Dedupe of the identical block = Task 21.

- **Task 6** (1 round; tactical + architect both `done` first pass). livePreview.js: `buildDecorations(state, range)` iterates `syntaxTree.iterate({from,to,...})` bounded to a padded viewport instead of the whole doc. New `setLivePreviewViewport` StateEffect + `livePreviewViewportField` hold the range; companion `livePreviewViewportPlugin` publishes `view.viewport ± PAD(2000)` on viewport/doc change (guarded against re-dispatch loop). `livePreviewField` stays a StateField (multi-line Table/HR replace widgets can't come from a ViewPlugin). `create()` fallback = first PREFIX(10000) chars. Exports: `buildDecorations`, `setLivePreviewViewport`. `livePreview` array now len 4, `[0]` still the decoration field. Byte-identical output for docs within viewport+PAD. 133 green.
  - bug(low) accepted: doc opened scrolled mid-document shows one frame of raw markdown before the plugin publishes the real range (no scroll state persisted today, so rarely hit).

- **Task 5** (1 round, tactical-only). Editor.jsx: `savedContentRef` baseline (mount + reset per tab switch on both restore/new paths) + `markSaved()` imperative method; updateListener now emits real `onContentChange(text, text !== savedContentRef.current)` — undo-to-saved clears dirty via plain string compare, no CM doc-version needed. useCommands calls `editorRef.markSaved()` after each successful write. find/replaceAll wrapped in try/catch → bad regex returns empty result, no doc change. Tactical fixed 1 test (CM merges 2 synchronous `type()` calls into one undo group — replaced undo-based assertion with explicit dispatch). 128 green.
  - For later tasks: Editor exposes `markSaved()`; `savedContentRef` is per-mounted-editor, resets on `activeTabId` change.

- **Task 4** (inline; session rate-limit killed the agent mid-run but its test file writes survived). `closeTab`: `willRemove` computed synchronously from `currentTabsRef.current` (`.some(id) && length>1`) — the `setTabs` updater runs later so an in-updater flag isn't visible to the disk branch. `storage.deleteTab` + pending-`saveTimers` clear now gated on `willRemove`. Fixes P0-5 (last-tab close wiped the disk row) + P2-close-timer (debounced save resurrected the deleted row). Tactical's 5 tests kept as the gate; no separate review round (rate limited). 102 green.

- **Task 3** (4 rounds; 2 substantive, 2 low-sev). SessionContext: secondary windows now issue a queued `navigator.locks.request('notepad-flux-primary', {signal}, onPromoted)`; on primary death the winner promotes — `isSessionLoaded=false` gate + timer-clear over the merge span (stops pristine-clobber), reload disk session as base, merge non-pristine local tabs (local wins) sorted by disk `tabOrder`, persist merged-in tabs + metadata, restore pre-promotion active tab. `adoptSessionMeta` shared by load+promotion paths. A2: `restoreWarning` context value → one-shot App toast, cleared after show. New test infra: `src/test/fakeLocks.js`. 97 green.
  - For later tasks: promotion path holds the lock via `await new Promise` on the abort signal (now guarded for already-aborted). `currentTabsRef`/`currentActiveTabIdRef` mirror state for the `[]`-dep election effect — reuse them, don't add state to that effect's deps.

- **Task 1** (3 rounds). crypto.js: `NFv1:` sentinel on ciphertext; `decrypt` throws on tampered/wrong-key sentinel blob instead of silently returning `''`; chunked `uint8ToBase64` (200k-char safe, kills P0-2 RangeError); module-scope `cachedKey` memo; key create/migrate under `navigator.locks` `notepad-flux-key`. storage.js: per-row decrypt isolation in `loadSession` (one bad tab no longer drops the whole session), degraded tab tagged `_decryptFailed` + `saveTab` skip-guard so `saveSession`-on-close can't re-encrypt `''` over intact ciphertext. Bug(high) caught by architect R2 (silent disk wipe on close) → fixed R3. Intentional security-property reversal recorded: non-sentinel legacy path now returns undecryptable input unchanged (old `''` also destroyed real legacy plaintext). Tests: `crypto.hardening.test.js` (16, new), `crypto.test.js` (2 stale assertions rewritten by tactical), `storage.test.js` (+1 isolation test). 59 total green.
  - For later tasks: `decrypt` is now a throwing function on the `NFv1:` path — any NEW caller must handle rejection. `_decryptFailed` is an in-memory-only tab flag; don't rely on it surviving a round-trip.
- **Task 2** (1 round, both reviewers `done` first pass). export.js: body now `sanitizeHTML(marked(md))`, title HTML-escaped via local `escapeHtml`, dead `exportToPdf` stub deleted. sanitize.js: allowlist +`h1-h6 pre img hr blockquote span` +`src alt`, `SAFE_FOR_TEMPLATES` removed (was mangling `{{ }}` note text). Single shared profile, not an export-specific one. Tests: `export.test.js` (new), `sanitize.test.js` (+12). 87 green. Low notes (non-blocking): remote `<img src=http>` now loads in editor/Print; non-string title would throw `escapeHtml` (caller guarantees string).
