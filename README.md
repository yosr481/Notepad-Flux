# Markdown Editor Project

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
- **Current Status**: Currently under development and testing in Firefox.

## Roadmap
The ultimate goal is to wrap the application in **Electron** to distribute it as a native desktop application for:
- Windows
- Linux
