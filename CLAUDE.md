# CLAUDE.md

Notepad Flux is a markdown editor (React + Vite + CodeMirror 6) that ships as a web app and as an Electron desktop app for Windows and Linux. Its core feature is Live Preview: markdown syntax is rendered in place and shows as raw text only where the cursor is. Scripts are in `package.json`. Read `Docs/ARCHITECTURE.md` and `Docs/DESKTOP_ELECTRON.md` (full IPC channel list) before non-trivial work.

## Security boundaries

The Electron shell treats the renderer as untrusted. Keep `contextIsolation: true`, `sandbox: true` and no `nodeIntegration`. The renderer reaches main only through `electron/preload.js`.

Every file IPC handler in `electron/main.js` checks the path against the grants (`isPathSafe`) before touching disk. Add new file channels the same way. The exceptions are channels where a user gesture is itself the grant: `read-file` and Save As (native dialog), `open-dropped-file` (path from `webUtils` on a real dropped File, preload only), and `take-launch-files` (paths main queued from the command line or OS "Open with"; the page can drain that queue but never add to it). Those add a grant instead of checking one. Main persists grants in `<userData>/authorized-paths.json`; the renderer never does.

`src/utils/sanitize.js` (filenames, DOMPurify for HTML) is the other boundary. Keep it strict.

## Saved tabs and the encryption key

`src/services/storage.js` keeps the session in IndexedDB, encrypted by `src/utils/crypto.js` with an AES key held through Electron `safeStorage`. A stored secure key that can't be read right now (locked or changed keyring) is never replaced. Instead the session loads with `KEY_UNAVAILABLE`, storage refuses every write for that window, and the user gets a warning. Replacing the key or writing in that state destroys tabs encrypted with it, so preserve this when touching either file. The legacy plaintext key in localStorage is removed only after a later launch reads the same key back from a real keyring backend. On Linux `basic_text` the plaintext copy is the only real recovery path, so it stays.

One window holds a Web Lock and is the primary window that persists the session; other windows don't write it. When the primary closes, a remaining window takes over. Tabs opened before the session load finishes survive it: they keep their ids, and a restored tab that clashes gets a fresh one.

## Where things go

- Every way a file becomes a tab (Open, Recent Files, drag-drop, OS launch) goes through `src/utils/openIntoTab.js`, then `createTab` in `src/context/SessionContext.jsx`. Opening a file that's already open focuses its existing tab (`fileKey` dedupe), so add new open paths there, not beside it.
- New editor behavior is a new CodeMirror extension passed in `src/components/Editor.jsx`, not a special case in the `livePreview.js` loop. livePreview decorates the whole document on purpose; don't add a range cap.
- `electron/ipcErrorMessage.js` maps thrown error strings to user messages. Past a few more branches, switch it to error codes.
- `SessionContext` holds what is open, not editor state; cursor, scroll and undo live in the CodeMirror views.

## Build and packaging

The sandboxed preload must be CommonJS, so `vite.config.js` builds `electron/preload.js` to `dist-electron/preload.cjs` and bypasses lib mode on purpose. `prebuild` writes `release-notes.md` from `CHANGELOG.md`; never commit that file. <!-- no-path -->

Linux file associations go in `build.linux.mimeTypes`, and `fileAssociations` stay under `build.win`. A top-level `fileAssociations` makes electron-builder ship a broken MIME XML on Linux that also overrides system `text/plain`. `scripts/__tests__/file-associations.test.js` guards this.

A local build copies file modes from the checkout into the `.deb`. If an installed file is unreadable, check its mode here before suspecting code.

## Tests

Unit tests are vitest under `__tests__/` next to the code, with `fake-indexeddb` for storage. The packaged-app suite runs Playwright against a built binary. It needs a display other than `:0`, and every launch uses a temp profile through `NOTEPAD_FLUX_USER_DATA`, so it never touches real data:

```bash
npm run build:vite && npx electron-builder --linux dir --publish never
DISPLAY=:0 Xephyr :77 -screen 1440x900 -ac -br &
DISPLAY=:77 node electron/e2e/packaged.mjs release/linux-unpacked/notepad-flux [--smoke] [--only=<scenario>,...]
```

`--only` takes scenario names (grep `want('` in the file), not check ids. RACE-3 is in `race2`, for example. `electron/e2e/packaged-win.mjs` is the Windows twin. `electron/main.js` isn't unit-testable; cover it through this suite.

## Releasing

Branch from `main`, PR into `main`, conventional commits (`fix:`, `feat:`, `chore:`). Update `CHANGELOG.md` (Keep a Changelog) for user-facing changes. To release:

1. `npm version X.Y.Z --no-git-tag-version`. This keeps the lockfile in sync.
2. In `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] — <date>` and add a fresh `[Unreleased]`.
3. Merge.
4. Push an annotated tag `vX.Y.Z`.

The tag triggers `.github/workflows/release.yml`, which builds every installer and publishes the GitHub Release. `scripts/check-version-sync.js` fails the release when the tag and `package.json` disagree. `.deb` installs don't auto-update; AppImage and Windows do.

`AGENTS.md` is a symlink to this file and `GEMINI.md` points here, so this is the only copy to maintain.
