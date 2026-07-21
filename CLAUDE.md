# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Notepad Flux is a minimal, distraction-free markdown editor built with React + Vite and CodeMirror 6, distributed both as a web app and as a cross-platform Electron desktop app (Windows/Linux). Its signature feature is a "Live Preview" mode: markdown syntax is hidden and rendered as WYSIWYG, revealing raw syntax only when the cursor is on/inside the element (similar to Obsidian.md).

## Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (web renderer, http://localhost:5173)
npm run build        # vite build + electron-builder -> produces installers in release/
npm run build:vite   # vite build only (renderer + electron main/preload bundles, no packaging)
npm run preview      # serve the built renderer only
npm run lint         # ESLint over the whole repo
npm test             # run vitest in watch mode
npm run test:ui      # vitest with the UI runner
npm run test:coverage # vitest run --coverage (v8 provider)
```

Run a single test file or test case with vitest directly, e.g.:
```bash
npx vitest run src/extensions/__tests__/livePreview.test.js
npx vitest run -t "test name substring"
```

Test config lives in `vitest.config.js` (jsdom environment, globals enabled, setup file `src/test/setup.js`). Coverage excludes `src/main.jsx`, `src/test/**`, `src/mockData.js`, and config files.

There is no separate Electron dev script wired in `package.json`; `npm run dev` runs the Vite renderer only. The `vite-plugin-electron` plugin builds `electron/main.js` and `electron/preload.js` into `dist-electron/` as part of the Vite build/dev pipeline.

## Architecture

Full details live in `Docs/ARCHITECTURE.md` and `Docs/DESKTOP_ELECTRON.md` — read those for anything non-trivial. Summary:

### Renderer (web) side

- **`src/App.jsx`** — top-level layout and event wiring (menu bar, tabs, status bar, editor).
- **`src/context/SessionContext.jsx`** — single source of truth for *what* is open: `tabs` (`{ id, title, content, fileHandle, filePath, isDirty }`), `activeTabId`, `recentFiles`, `settings`. Does not hold live editor state (cursor, scroll, undo history) — that stays inside CodeMirror instances. Uses the Web Locks API to elect one browser tab/window as the "primary window" responsible for persisting session state to IndexedDB; other windows only read settings.
- **`src/components/Editor.jsx`** — wraps a CodeMirror `EditorView` per active tab. On tab switch it caches/restores view state (scroll, history) and syncs typed changes back into `SessionContext` (marking tabs dirty).
- **`src/extensions/`** — CodeMirror 6 extensions; this is where the live-preview "brain" lives:
  - `livePreview.js` — core WYSIWYG logic: a `ViewPlugin`/`StateField` that scans the doc for markdown syntax and decides per-range whether to show raw syntax (cursor overlaps) or a styled/widget decoration (cursor elsewhere).
  - `widgets.js` — widget replacements: checkboxes (interactive, toggle `[ ]`/`[x]` in the underlying text), horizontal rules, rendered tables, bullets.
  - `imagePreview.js` — inline image rendering/caching.
  - `linkPreview.js` / `linkHandler.js` — link widgets and Ctrl+Click/hover interactions.
  - `listKeymap.js` — Enter/Tab/Shift+Tab behavior for lists and task lists.
  - `searchHighlight.js`, `textDirection.js` — supporting extensions.
  - New editor features are added as additional extensions passed into the CodeMirror instance in `Editor.jsx`, not by special-casing the core loop.
- **`src/hooks/useCommands.js`** — the command layer bridging UI actions (menu items, shortcuts) to state/IO: `newTab`, `closeTab`, `openFile`, `saveFile`, export, etc. Reads `SessionContext`, calls into `utils/fileSystem.js`/`utils/export.js`, then calls back into `SessionContext` to update tab state.
- **`src/utils/fileSystem.js`** — file I/O abstraction. Prefers the File System Access API (`showOpenFilePicker`/`showSaveFilePicker`) in-browser; falls back to `<input type="file">` + download links where unsupported (e.g. Firefox). Also detects/routes to Electron IPC when running in the desktop shell.
- **`src/services/storage.js`** — IndexedDB persistence (via `idb`) for session/tab/settings data. Tab content and metadata are encrypted before being written (see `src/utils/crypto.js`) and decrypted on load.
- **`src/utils/sanitize.js`** — sanitizes filenames/HTML (DOMPurify) — this is a security-relevant boundary; keep it strict when touching it.

### Desktop (Electron) side

- **`electron/main.js`** (ESM) — creates the splash + main `BrowserWindow`, overrides `app.getPath('userData')` to a stable per-OS path (`%USERPROFILE%\AppData\LocalLow\Notepad Flux` on Windows, `~/.config/notepad-flux` on Linux), and registers IPC handlers. Maintains an `allowedPaths` allowlist and an `isPathSafe` check — all file IPC handlers validate paths through this before touching disk; preserve this pattern when adding new file-related IPC channels.
- **IPC channels**: `read-file`, `read-file-content(filePath)`, `save-file({ filePath?, content })`, `main-process-message`. The renderer only ever talks to these through the preload-exposed bridge — never enable `nodeIntegration` in the renderer, and keep `contextIsolation: true` / `sandbox: true`.
- **`electron/preload.js`** — the only bridge between renderer and main (contextBridge, isolated world).
- Build output: `dist/` (Vite renderer build), `dist-electron/` (built main + preload). `electron-builder` packages `dist/**`, `dist-electron/main.js`, `dist-electron/preload.js`, and `package.json` into installers (NSIS for Windows x64/ia32, deb + AppImage for Linux) under `release/`. Config is in the `build` field of `package.json`.

### Data flow example (opening a file)

`MenuBar` → `useCommands.openFile()` → `fileSystem.openFile()` (native picker or Electron IPC) → returns `{ handle/filePath, content, name }` → `session.createTab(...)` → `Editor.jsx` detects the new `activeTabId` and initializes a CodeMirror instance with that content.

## Conventions

- **ESLint** (`eslint.config.js`, flat config): `no-unused-vars` is a warning, ignoring names matching `^[A-Z_]` (vars) and `^_` (args). `react-hooks/set-state-in-effect` is a warning (not an error) because some effects intentionally sync with external systems (IndexedDB, Web Locks). Electron main-process files (`electron/**/*.js`) run with Node globals and allow `no-useless-catch`. Test files (`src/**/*.{test,spec}.js`, `src/test/**`) get Vitest/Node globals. `src/context/**` disables `react-refresh/only-export-components` (context modules export both the provider and a hook).
- **Styling**: CSS Modules co-located with components (`Component.module.css`), plus global CSS variables in `src/styles/variables.css` for theming (dark/light).
- **Security-sensitive areas**: IPC handlers/preload scripts (path validation, no `nodeIntegration`), filename sanitization (`sanitizeFilename`, cross-platform safe on Windows/Linux), and content sanitization (DOMPurify) before rendering. Treat these as boundaries to keep tight, not to relax for convenience.
- **Tests** live in `__tests__` directories next to the code they cover (e.g. `src/extensions/__tests__/`, `src/hooks/__tests__/`, `src/utils/__tests__/`). `fake-indexeddb` is used to test storage code without a real browser.
- **Branching/commits**: branch from `main` (e.g. `feature/...`, `fix/...`), open PRs against `main`. Commit messages are short, imperative, and conventional-ish (`fix:`, `feat:`, `refactor:`, `chore:`). Releases are tagged `vX.Y.Z`, which triggers `.github/workflows/release.yml` (builds Windows + Linux installers, extracts notes from `CHANGELOG.md` via `scripts/extract-changelog.js`, publishes a GitHub Release). `CHANGELOG.md` follows Keep a Changelog / SemVer — update it when making user-facing changes.
- Full contribution guidelines are in `CONTRIBUTING.md`; a `GEMINI.md` file also exists with an equivalent project summary for another AI assistant — keep the two in sync if either changes materially.
