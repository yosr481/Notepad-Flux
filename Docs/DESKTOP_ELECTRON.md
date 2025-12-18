# Electron Desktop & Installers

Project: Notepad Flux  
Last Updated: 2025-12-18

---

## 1. Overview

Notepad Flux ships as a cross-platform desktop app packaged with Electron. This document covers the Electron architecture (main, preload, renderer), IPC, persistent paths, and distribution via installers on Windows (NSIS) and Linux (deb, AppImage).

---

## 2. App Structure (Desktop)

- Main Process: electron/main.js (ESM)
  - Creates the splash and main BrowserWindow
  - Applies Windows-integrated visuals (titleBarOverlay, mica background)
  - Disables default application menu
  - Sets process environment paths for dist and dist-electron
  - Registers IPC handlers for file interactions

- Preload Script: dist-electron/preload.js
  - Runs in isolated world (contextIsolation: true, sandbox: true)
  - Exposes limited, secure bridges to the renderer for IPC

- Renderer: dist/index.html (Vite build)
  - React UI and CodeMirror editor
  - Talks to Main via preload-exposed APIs

- Directory Highlights
  - dist: Renderer production bundle
  - dist-electron: Built main and preload scripts
  - public/icons/desktop/icon.png: App icon used by windows and installers
  - public/loading.html: Splash screen content

---

## 3. IPC Channels

All file system operations go through the main process via IPC. Channels:

- read-file: Opens native file picker; returns { canceled, filePath, content }
- read-file-content(filePath): Reads text from disk; returns content
- save-file({ filePath?, content }): Saves content; opens Save As if filePath is missing
- main-process-message: One-way message used for simple status pings

Renderer should call these via preload-provided wrappers. Never enable nodeIntegration in the renderer.

---

## 4. Persistent Data Paths

We override app.getPath('userData') to a stable per-OS directory before the app is ready:

- Windows: %USERPROFILE%\AppData\LocalLow\Notepad Flux
- Linux: ~/.config/notepad-flux

Use this location for runtime data (session metadata, logs). Do not store user documents here.

---

## 5. Build, Run, and Package

Package manager scripts (see package.json scripts):

- dev: vite (runs the web renderer dev server; pair with separate Electron start if needed)
- build: vite build then electron-builder (produces installers in release/)
- preview: vite preview (serves built renderer only)

Build outputs included in installer (electron-builder files config):

- dist/**
- dist-electron/main.js
- dist-electron/preload.js
- package.json (runtime metadata)

---

## 6. Installers & Targets

Electron Builder configuration (summarized from package.json build section):

- App ID: com.notepad-flux.app
- Product Name: Notepad Flux
- Icon: public/icons/desktop/icon.png
- Compression: maximum; ASAR enabled
- Output directory: release

Windows (win target):

- Target: nsis
- Architectures: x64, ia32
- Artifact Name: Notepad Flux-<version>-win-<arch>.<ext>
- NSIS options:
  - oneClick: false (assisted installer)
  - perMachine: false (per-user install by default)
  - allowElevation: true
  - allowToChangeInstallationDirectory: true
  - createDesktopShortcut: true
  - createStartMenuShortcut: true
  - shortcutName: Notepad Flux
  - deleteAppDataOnUninstall: false

Linux:

- Targets: deb, AppImage
- Category: Utility
- Artifact Name: Notepad Flux-<version>-<os>-<arch>.<ext>
- deb maintainer: yosr481@gmail.com
- deb dependencies: common Electron runtime libs (libgtk-3-0, libnss3, etc.)

Publishing:

- Provider: GitHub releases (owner: yosr481, repo: Notepad_Flux)

---

## 7. Installation & Uninstallation Notes

Windows (NSIS):

- Installer allows choosing install directory (default in user profile)
- Desktop and Start Menu shortcuts are created
- Uninstall keeps user data by default (session, settings) since deleteAppDataOnUninstall is false

Linux:

- deb: install via your distro's package manager (dependency resolution required)
- AppImage: make executable (chmod +x) and run; self-contained

User Documents:

- Notepad Flux does not move or duplicate your .md files. Saving uses the path you choose. Application runtime data lives in the userData directory listed above.

---

## 8. Security Posture (Renderer)

- nodeIntegration: false
- contextIsolation: true
- sandbox: true
- All privileged operations go through the preload and main IPC

---

## 9. Troubleshooting

- If the app window does not show, check whether the splash closed; look for process logs in userData
- On Windows, antivirus can block unpacked dev runs; try a packaged build
- On Linux, missing dependencies for deb installs can prevent launch; use AppImage if unsure

---

## 10. Cross References

- ARCHITECTURE.md: High-level system and desktop notes
- SPECIFICATIONS.md: UX and window/tab behavior
- FEATURES.md: Live Preview and markdown behaviors
