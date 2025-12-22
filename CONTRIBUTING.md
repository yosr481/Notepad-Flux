# Contributing to Notepad-Flux

First off, thank you for considering contributing! 🎉\
This project is a fast, modern Markdown/text editor built with React & Vite, now available as a native Electron desktop application for Windows and Linux. Version 1.1.0 brings enhanced security, platform-specific optimizations, and refined UI/UX.

This document describes how to set up the project, how to propose changes, and some guidelines to keep the codebase healthy and consistent.

---
## Table of Contents
* [Code of Conduct](#code-of-conduct)
* [Project Setup](#project-setup)
* [Branching & Workflow](#branching--workflow)
* [Issues & Feature Requests](#issues--feature-requests)
* [Making Changes](#making-changes)
* [Code Style](#code-style)
* [Testing](#testing)
* [Commit Messages](#commit-messages)
* [Pull Request Checklist](#pull-request-checklist)

---
## Code of Conduct
By participating in this project, you agree to maintain a respectful, inclusive, and constructive environment.

If you see or experience unacceptable behavior, please open an issue or reach out to the maintainer.

---
## Project Setup
### Prerequisites
* Node.js (LTS recommended)
* npm (bundled with Node) or another package manager (yarn, pnpm)

### Installing dependencies
```bash
npm install
```

### Running the dev server
```bash
npm run dev
```

Then open the URL printed in the terminal (usually `http://localhost:5173/`).

### Building for production
```bash
npm run build
```

This command will build the web assets and create Electron distribution packages for Windows and Linux.

---
## Branching & Workflow
* The `main` branch contains the latest stable code.
* For any change (bug fix, feature, refactor), please:
  1. Fork the repo (if you don’t have write access).
  2. Create a branch from `main`, for example:
    * `feature/live-preview-improvements`
    * `fix/undo-stack-bug`
  3. Open a Pull Request (PR) against `main`.

---
## Issues & Feature Requests
* **Security Vulnerabilities**: If you find a security issue, please **do not** open a public issue. Follow the instructions in our [Security Policy](SECURITY.md).
* **Bug reports**: Use the "Bug Report" issue template if available.
  * Include steps to reproduce, expected vs. actual behavior, and environment details.
* **Feature requests**: Use the "Feature Request" template if available.
  * Explain the problem you’re trying to solve and why the feature is useful.

If you’re unsure whether an idea fits this project, feel free to open a discussion-style issue before investing a lot of time.

---
## Making Changes
1. Pick or create an issue to work on.
2. Discuss your approach in the issue if it’s non-trivial.
3. Implement the change in a dedicated branch.
4. Add or update tests where it makes sense.
5. Run the test and lint tasks locally before pushing.

---
## Code Style
This project uses modern JavaScript/React with Vite and Electron for desktop distribution.
* Follow the existing patterns in:
  * `src/components/`
  * `src/context/`
  * `src/hooks/`
  * `src/utils/`
  * `electron/` (for desktop-specific code)

* When working on security-sensitive areas (IPC, preload scripts, file handling):
  * Use explicit, safe data handling patterns
  * Sanitize filenames to ensure OS compatibility (Windows/Linux)
  * Use platform-specific paths for persistent data storage
  * Keep sandbox restrictions in mind for the main window

* Prefer:
  * Small, focused components and hooks.
  * Clear naming.
  * Separation of concerns (UI vs. state vs. side-effects).

If ESLint/Prettier configs are present:
```bash
npm run lint
```

(If you see style errors or warnings, please fix them before committing.)

---
## Testing
If tests exist:
```bash
npm test
```

If tests are missing in an area you’re touching:
* Consider adding at least basic coverage, especially for:
  * Critical logic (e.g. file/session management).
  * Reusable hooks and utilities.

---
## Commit Messages
Try to keep commit messages:
* Short and descriptive:
  * `fix: keep cursor position after replacing text`
  * `feat: add word count to status bar`
  * `refactor: extract editor state hook`
* Written in the imperative mood (e.g., "add", "fix", "refactor").

---
## Pull Request Checklist
Before opening or merging a PR, please ensure:
- [ ] The change is scoped and focused (one logical change per PR).
- [ ] Code builds successfully (`npm run build`).
- [ ] Lint/tests pass (`npm run lint`, `npm test` if applicable).
- [ ] New UI/UX behavior is documented in the PR description (screenshots/gifs encouraged).
- [ ] Any new configuration or env vars are documented (e.g., in `README.md` or `.env.example`).

Thank you for contributing! 🙌