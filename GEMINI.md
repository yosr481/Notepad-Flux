# Project: Notepad Flux

## Project Overview
Notepad Flux is a minimal, lightweight markdown writing application designed to offer a fast and distraction-free experience. It combines the simplicity of a plain text editor with powerful modern features, primarily focusing on a WYSIWYG "Live Preview" experience.

### Key Features
*   **Live Preview Experience**: Built on CodeMirror 6, it provides a "Live Preview" mode where Markdown syntax is hidden by default and revealed only when the cursor is active on the element.
*   **Minimalist UI**: Inspired by Windows Notepad, featuring classic File and Edit menus, a simple status bar, and a tabbed interface for multiple files.
*   **Theming**: Supports both Dark and Light modes.
*   **Cross-Platform Desktop App**: Packaged with Electron for a native desktop experience on Windows, and Linux.

### Technology Stack
*   **Frontend**: React + Vite
*   **Desktop**: Electron
*   **Editor Engine**: CodeMirror 6
*   **UI Components**: Lucide React
*   **Markdown Parsing**: Marked
*   **PDF/Image Export**: html2canvas, jspdf

### Roadmap
The application is now wrapped in Electron for distribution as a native desktop application on Windows and Linux.

## Building and Running the Project

### Prerequisites
*   Node.js (version 18+ recommended)

### Installation
1.  Open a terminal in the project root directory.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Development Server
To start the development server:
```bash
npm run dev
```
Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

### Building for Production
To build the project for production:
```bash
npm run build
```

### Linting
To run the linter and check for code style issues:
```bash
npm run lint
```

## Development Conventions

### Linting
The project uses ESLint with configurations for React hooks and refresh. It targets JavaScript/JSX files. A specific rule ignores unused variables that start with an uppercase letter or an underscore (`^[A-Z_]`).

### Code Structure
The `src` directory contains the main application logic, including:
*   `App.jsx`: Main application component.
*   `main.jsx`: Entry point.
*   `components/`: Reusable UI components (Editor, Layout, Print, Settings).
*   `context/`: React context for session management.
*   `extensions/`: CodeMirror extensions (e.g., imagePreview, linkHandler, livePreview).
*   `hooks/`: Custom React hooks.
*   `styles/`: CSS files.
*   `utils/`: Utility functions (e.g., export, fileSystem).
