# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2025-12-23

### Added
- **Session Persistence:** Implemented immediate tab and metadata saving upon new tab creation to prevent data loss.
- **Session Protection:** Added a robust `beforeunload` listener to ensure all open documents and application states are persisted right before closure.

### Fixed
- **State Reliability:** Resolved issues where the tab order or active tab might reset if the browser/electron process was killed unexpectedly.

## [1.1.2] - 2025-12-21

### Fixed
- **UI/UX:** Fixed an issue where link URL colors were too washed out in dark mode, improving readability.

### Documentation
- **Consistency:** Updated documentation to use a consistent first-person singular voice throughout the README and Desktop Electron guide.

### Refactoring
- **Code Quality:** Streamlined the codebase by removing redundant comments and simplifying logic for better maintainability.

## [1.1.1] - 2025-12-21

### Security & Data Protection
- **Secure Key Storage:** Integrated Electron's `safeStorage` API to protect encryption keys using OS-level credentials.
- **End-to-End Tab Encryption:** Implemented robust encryption for tab content and metadata to ensure user privacy.
- **Content Sanitization:** Integrated `DOMPurify` for advanced HTML sanitization, mitigating XSS risks across the application.
- **IPC Validation:** Hardened Inter-Process Communication with strict path validation and enhanced sandboxing.

### UI/UX & Reliability
- **Input Validation:** Added comprehensive validation and error handling for numeric fields and navigation dialogs.
- **Architecture Refinement:** Streamlined preload and main process logic for improved maintainability and performance.

## [1.1.0] - 2025-12-21

### Security Hardening
- **Process Sandboxing:** Enabled Electron's sandbox mode for all windows.
- **Filename Sanitization:** Automated sanitization to prevent OS-specific character conflicts.
- **IPC Hardening:** Refactored handlers for explicit naming and safer data handling.

### Architecture & Platform
- **Intelligent Storage Paths:** Optimized file handling using platform-specific persistent data paths.
- **Windows Readiness:** Added support for app signing and installer location customization.

### UI/UX Refinements
- **Custom Window Design:** Ensured seamless inheritance of Mica background and specialized title bar styling for spawned windows.

## [1.0.0] - 2025-12-21
- **Initial Release:** Core features including Live Preview Markdown, minimal UI, Dark/Light modes, and cross-platform desktop installers.
