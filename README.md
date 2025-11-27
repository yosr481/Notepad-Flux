# Notepad Flux

A minimal, lightweight markdown writing application inspired by the simplicity of Windows Notepad, but with powerful modern features.

## Core Philosophy
The app is designed to be fast and distraction-free. It combines the simplicity of a plain text editor with the power of a WYSIWYG interface.

## Key Features
- **Live Preview Experience**: The core writing experience is built on **CodeMirror 6**, offering a "Live Preview" mode. Markdown syntax is hidden by default and revealed only when the cursor is active on the element, providing a clean, WYSIWYG-style reading and writing environment.
- **Minimalist UI**: Heavily inspired by Windows Notepad.
  - **Menus**: Classic File and Edit menus.
  - **Status Bar**: Simple information display.
  - **Tabs**: Support for multiple open files via a tabbed interface.
- **Theming**: Built-in support for both Dark and Light modes.

## Technology Stack
- **Frontend**: React + Vite
- **Editor Engine**: CodeMirror 6
- **Current Status**: Currently under development and testing in Chrome/Firefox.

## Roadmap
The ultimate goal is to wrap the application in **Electron** to distribute it as a native desktop application for:
- Windows
- Linux

# Project Setup Instructions

Welcome to the **Notepad Flux** project! Since you are setting this up on a new machine, follow these steps to get up and running.

## Prerequisites

- **Node.js**: Ensure you have Node.js installed. You can download it from [nodejs.org](https://nodejs.org/). Version 18+ is recommended.

## Installation

1.  **Open a terminal** in the project root directory.
2.  **Install dependencies** by running:
    ```bash
    npm install
    ```

## Running the Project

1.  **Start the development server**:
    ```bash
    npm run dev
    ```
2.  Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

## Building for Production

To build the project for production:
```bash
npm run build
```

## Linting

To run the linter:
```bash
npm run lint
```

# License
This project is licensed under the [MIT License](LICENSE).