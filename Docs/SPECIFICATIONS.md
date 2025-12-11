# Product Specifications

**Project:** Notepad Flux  
**Last Updated:** 2025-12-11

---

## Table of Contents

1. [Scope & Definitions](#scope--definitions)
2. [Session Model](#session-model)
3. [Window Behavior](#window-behavior)
4. [Tab Management](#tab-management)
5. [Menu Specifications](#menu-specifications)
6. [Settings](#settings)
7. [Persistence Summary](#persistence-summary)

---

## 1. Scope & Definitions

### Application Scope

Session behavior and tab/window management for a Notepad-like application with multi-tab and multi-window support.

### Window Types

- **First window instance**: Primary app window whose **session is persisted** across runs.
- **Secondary windows**: All other windows. They:
  - Prompt for save on unsaved tabs when closing.
  - Do **not** persist session.

---

## 2. Session Model

**Applies to:** First window only

Each **session** for the first window stores:

### Session Data Structure

- **Tabs** (ordered list), each with:
  - `FilePath` (nullable)
  - `Content`
  - `IsDirty` (unsaved changes)
  - `DisplayTitle` (file name or auto-generated from content)
- `ActiveTabIndex`

### Application Startup Behavior

On app start:
- If a session exists: **restore** tabs + active tab (using progressive loading, see Architecture document).
- Else: create a single blank `Untitled` tab.

---

## 3. Window Behavior

### 3.1 First Window Instance

#### Close Window
**Trigger:** `File → Close window` or window close button

**Behavior:**
- **No save prompts**, regardless of dirty tabs.
- Take a **session snapshot**:
  - Persist all tabs (including unsaved).
  - Persist `IsDirty` and `Content` exactly as in memory.
- Then close the window.

#### Exit
**Trigger:** `File → Exit`

**Behavior:**
- Same behavior as `Close window` for the first window:
  - Save the first window's session.
  - No save prompts.
  - Close the window.
- If this is the only window, app terminates.
- (If more windows exist, OS/app decides whether Exit signals them too; but they **do not** get session persistence.)

> **Important:** Only explicit **tab closure** in the first window prompts to save. **Closing the first window never does.**

### 3.2 Secondary Windows

#### Close Window / Exit
**Trigger:** `File → Close window`, `File → Exit`, or window close button

**Behavior:**
- For each dirty tab:
  - Prompt: **Save / Don't Save / Cancel**.
  - `Save`: write to disk, `IsDirty = false`.
  - `Don't Save`: discard unsaved changes for that tab.
  - `Cancel`: abort window close.
- If no Cancel:
  - Window closes; **no session is stored**.

---

## 4. Tab Management

### 4.1 Tab Reordering

- Tabs can be reordered via drag-and-drop.
- The new order is persisted immediately to the session state.

### 4.2 Creating Tabs

**Methods:**
- **File → New tab**
- Tab context menu `New tab`
- `+` button

**Behavior:**
All methods:
- Create a tab at the **end** of the list:
  - `FilePath = null`
  - `Content = ""`
  - `IsDirty = false`
  - `DisplayTitle = "Untitled"` (or first-line-based label once user types)
- Make it the **active tab**.

### 4.3 New Window

**Trigger:** `File → New window`

**Behavior:**
- Creates a **new window instance** (secondary window if the first already exists).
- New window starts with a single blank tab, same as a fresh app start.
- This new window's session is **not persisted**.

### 4.4 Closing a Single Tab

**Methods:**
- Tab's close button
- Middle-click
- `File → Close tab`
- Tab context menu `Close tab`

**Behavior:**
- If `IsDirty == false`: close immediately.
- If `IsDirty == true`:
  - Prompt: **Save / Don't Save / Cancel**.
  - `Save`:
    - If `FilePath` known: save and close.
    - Else: show Save As, then close.
  - `Don't Save`: discard unsaved edits for this tab; close.
  - `Cancel`: abort closing this tab.

### 4.5 Tab Context Menu

**Trigger:** Right-click on a tab

**Menu Items:**
- `New tab`
- `Close tab`
- `Close other tabs`
- `Close tabs to the right` (grayed out if none to the right)

**Bulk Close Behavior:**
`Close other tabs` / `Close tabs to the right`:
- For each affected tab:
  - If clean: close silently.
  - If dirty: prompt Save / Don't Save / Cancel as above.
  - A single **Cancel** aborts the whole bulk close; already-closed tabs stay closed.

### 4.6 Tab Strip & Overflow

**Layout:**
- Tabs arranged **left to right**.
- Active tab visually highlighted.
- Tabs shrink until a **minimum width**.

**Overflow Behavior:**
Once min width is reached, further tabs trigger **horizontal scrolling**:
- **Arrow buttons** appear, order:
  - `[Left Arrow] [Right Arrow] [New Tab "+"]`
- **Right arrow**: scrolls to reveal more tabs on the right.
- **Left arrow**: scrolls to reveal more on the left.
- Arrows are **grayed out** if there is no more hidden content in that direction.

**Auto-scroll:**
- When a tab becomes active, the strip auto-scrolls to make it **fully visible**.

---

## 5. Menu Specifications

### 5.1 File Menu

1. **New tab**
   - Behavior: see §4.2.

2. **New window**
   - Behavior: see §4.3.

3. **Open**
   - Show file open dialog.
   - Selected file opens as a **new tab** in the current window.
   - If the same file is already open, behavior is implementation-defined (allow duplicate tab vs. focus existing tab).

4. **Recent → (recent files or empty)**
   - Submenu listing recently opened files (or an "Empty"/grayed-out indicator when none).
   - Selecting an item:
     - Opens that file in a **new tab** in the current window.
     - If file missing on disk, show an error and do not create a new tab.

5. **Save**
   - Operates on the **active tab**:
     - If `FilePath` known: write file, set `IsDirty = false`.
     - If `FilePath` null: show "Save As" dialog, then set path and `IsDirty = false`.

6. **Save all**
   - Applies to **all tabs in the current window**:
     - For each tab:
       - If `FilePath` known and `IsDirty == true`: save to disk, clear dirty.
       - If `FilePath` null and `IsDirty == true`: open Save As dialog:
         - If user cancels Save As for that tab, it remains dirty and unsaved.
       - Clean tabs with known paths remain untouched.
   - No session-level prompts; acts purely at the document layer.

7. **Export to PDF**
   - Operates on the **active tab's current content**:
     - Opens "Export to PDF" dialog (path selection).
     - Generates a PDF from the tab's content.
     - **Does not** change `FilePath` or `IsDirty` of the tab itself (export is a one-way operation).

8. **Export to HTML**
   - Same pattern as Export to PDF but creates an HTML file.
   - Uses active tab's content; no session/dirty state changes.

9. `---` (separator)

10. **Print**
    - Opens print dialog for the **active tab** content.
    - Does not modify `IsDirty` or session.

11. `---` (separator)

12. **Close tab**
    - Closes the **active tab** (see §4.4 behavior, including prompts).

13. **Close window**
    - If this is the **first window**:
      - Save its session (all tabs, including unsaved) and **close immediately** with **no prompts**.
    - If **secondary window**:
      - Prompt per dirty tab (Save / Don't Save / Cancel) and close if no Cancel; no session persistence.

14. **Exit**
    - Behavior matches `Close window` for the first window.
    - For secondary windows, same as `Close window` (per-window prompts, no persistence).

### 5.2 Edit Menu

1. **Undo**
   - Undo last edit in the **active tab**.

2. **Redo**
   - Redo last undone edit in the **active tab**.

3. `---` (separator)

4. **Cut**
   - Cut selected text to clipboard, remove selection.

5. **Copy**
   - Copy selected text to clipboard, leave selection.

6. **Paste**
   - Insert clipboard text at caret; replace selection if present.

7. **Delete**
   - Delete selected text without touching clipboard.

8. `---` (separator)

9. **Find**
   - Open Find UI scoped to the active tab's content.

10. **Replace**
    - Open Replace UI (find + replace) for the active tab.

11. **Go to**
    - Open "Go to line" dialog; jump caret to specified line number in active tab.

12. `---` (separator)

13. **Select all**
    - Select entire content of the active tab.

14. **Insert date/time**
    - Insert a formatted date/time string at caret position (or replace selection).
    - Marks tab as dirty.

**Note:** All Edit actions operate **only on the active tab**; no cross-tab or cross-window effects.

---

## 6. Settings

### 6.1 Settings Button

**Location:** Far right end of the menu bar.

**Layout:** Maintains a proper minimum width between the button and the menu items, based on the window's minimum width.

### 6.2 Settings Window

**Appearance:** Covers the entire window, including the tabs bar and status bar.

**Navigation:** "Return" button located at the top left to close settings and return to the editor.

### 6.3 Settings Content

#### App Theme
- Options: Light, Dark, or Use system setting.

#### Session Restoration Warnings
- **Warn me if restoring more than [N] tabs**
  - Default N: 30–50, editable
  
- **Warn me if total session size exceeds [X MB]**
  - Default X: 80-100, editable

- **Prompt Behavior:**
  - If either threshold is exceeded, prompt: "Restore all / Restore last N / Start fresh."

#### Clear Saved Session
- Option to manually clear the saved session data.

---

## 7. Persistence Summary

### First Window Behavior

The first window's full tab list, contents, and state are saved when:
- `File → Close window` or `File → Exit` or window close button is used.
- No prompts at this stage; dirty state captured as-is.
- Restored on next app start.

### Secondary Window Behavior

- Never persisted; always start "fresh" when created.
- Prompt to save dirty tabs when closed.

---

## 8. Window Instances

### Window Dimensions

**Minimum Width and Height:** Values are dynamically determined based on display settings (e.g., screen resolution and scaling) to ensure usability on different screens.

---

## 9. Cross-References

- For architectural details on session loading, see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- For UI/UX design details, see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)
- For markdown feature specifications, see [`FEATURES.md`](./FEATURES.md)

---

*This specification document defines the expected behavior of Notepad Flux and should be used as the source of truth for feature implementation.*
