# Security Policy

## Supported Versions

The following versions of Notepad-Flux are currently being supported with security updates:

| Version | Supported |
| ------- |-----------|
| 1.1.x   | V         |
| < 1.1.0 | X         |

We recommend always using the latest stable release.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a potential security vulnerability in Notepad-Flux, please use one of the following methods for coordinated disclosure:

1.  **GitHub Private Vulnerability Reporting**: Use the "Report a vulnerability" button under the **Security** tab of this repository on GitHub. This is the preferred and most secure method.
2.  **Email**: If you are unable to use GitHub's reporting tool, please email me at `yosr481@gmail.com`.

### What to expect

- I will acknowledge receipt of your report within 48 hours.
- I will provide a preliminary evaluation of the report.
- I aim to resolve critical vulnerabilities as quickly as possible, typically within 14 days.
- Once a fix is ready and verified, I will coordinate the disclosure with you and release a new version.

## Threat Model

To help researchers understand the security boundaries of Notepad-Flux, I have a lightweight threat model.

### Project Overview
Notepad-Flux is an Electron-based Markdown editor. It runs as a desktop application with access to the local file system to read and write Markdown files.

### Assets
- **Local Files**: Markdown files (`.md`, `.markdown`) and other files on the user's system.
- **Persistent Data**: App settings and temporary data stored in the user's application data directory.
- **Process Integrity**: The integrity of the Electron main and renderer processes.

### Trust Boundaries
1.  **Renderer Process vs. Main Process**: The renderer process (UI) is considered less trusted than the main process. I use `contextIsolation` and `sandbox: true` to limit the renderer's capabilities.
2.  **External Content**: Markdown content is rendered in the UI. While I use CodeMirror 6, any user-provided content is treated as untrusted.
3.  **Local File System**: The application only has permission to access files explicitly opened by the user or stored in its designated data directory.

### Threats & Mitigation

| Threat | Description | Mitigation                                                                                                                      |
| --- | --- |---------------------------------------------------------------------------------------------------------------------------------|
| **XSS via Markdown** | Malicious Markdown content could attempt to execute JavaScript in the renderer. | I rely on CodeMirror 6 and Electron's `sandbox` and `contextIsolation`. I avoid using `dangerouslySetInnerHTML` where possible. |
| **IPC Abuse** | A compromised renderer could attempt to call sensitive IPC handlers. | IPC handlers are strictly defined in `electron/main.js` and validate all inputs (e.g., `isPathSafe`).                           |
| **Path Traversal** | Malicious paths could be used to access files outside of the intended scope. | The `isPathSafe` utility validates all file paths against an allow-list of user-opened files.                                   |
| **Dependency Vulnerabilities** | Vulnerabilities in npm dependencies. | I setup an automated security scans (`npm audit`, `CodeQL`) via GitHub Actions.                                                 |

### Out of Scope
- Attacks that require physical access to the user's machine.
- Vulnerabilities in the underlying Operating System or Electron framework itself (unless they can be triggered solely via Notepad-Flux's specific implementation).
- Social engineering attacks against the maintainers or users.
