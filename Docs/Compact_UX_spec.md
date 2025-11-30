## 1. Scope & Definitions
- **Scope**: Session behaviour and tab/window management for a Notepad‑like app.
- **First window instance**: Primary app window whose **session is persisted** across runs.
- **Secondary windows**: All other windows. They:
  - Prompt for save on unsaved tabs when closing.
  - Do **not** persist session.

---
# 2. Session Model (First Window Only)
Each **session** for the first window stores:
- **Tabs** (ordered list), each with:
  - `FilePath` (nullable).
  - `Content`.
  - `IsDirty` (unsaved changes).
  - `DisplayTitle` (file name or auto-generated from content).
- `ActiveTabIndex`.

On app start:
- If a session exists: **restore** tabs + active tab (using progressive loading, see §10).
- Else: create a single blank `Untitled` tab.

---
# 3. Window Behaviour
## 3.1 First window instance
- **Close window** (via `File → Close window` or window close button):
  - **No save prompts**, regardless of dirty tabs.
  - Take a **session snapshot**:
    - Persist all tabs (including unsaved).
    - Persist `IsDirty` and `Content` exactly as in memory.
  - Then close the window.

- **Exit** (via `File → Exit`):
  - Same behaviour as `Close window` for the first window:
    - Save the first window’s session.
    - No save prompts.
    - Close the window.
  - If this is the only window, app terminates.
  - (If more windows exist, OS/app decides whether Exit signals them too; but they **do not** get session persistence.)

> Only explicit **tab closure** in the first window prompts to save. **Closing the first window never does.**

## 3.2 Secondary windows
- **Close window** / `File → Close window` / `File → Exit`:
  - For each dirty tab:
    - Prompt: **Save / Don’t Save / Cancel**.
    - `Save`: write to disk, `IsDirty = false`.
    - `Don’t Save`: discard unsaved changes for that tab.
    - `Cancel`: abort window close.
  - If no Cancel:
    - Window closes; **no session is stored**.

---
# 4. Tabs: Creation, Closing, Overflow
## 4.1 Creating tabs
- **File → New tab**
- Tab context menu `New tab`
- `+` button

All:
- Create a tab at the **end** of the list:
  - `FilePath = null`
  - `Content = ""`
  - `IsDirty = false`
  - `DisplayTitle = "Untitled"` (or first-line-based label once user types)
- Make it the **active tab**.

## 4.2 New window
- **File → New window**
  - Creates a **new window instance** (secondary window if the first already exists).
  - New window starts with a single blank tab, same as a fresh app start.
  - This new window’s session is **not persisted**.

## 4.3 Closing a single tab (first or secondary window)
- Via:
  - Tab’s close button.
  - Middle-click.
  - `File → Close tab`.
  - Tab context menu `Close tab`.

Behaviour:
- If `IsDirty == false`: close immediately.
- If `IsDirty == true`:
  - Prompt: **Save / Don’t Save / Cancel**.
  - `Save`:
    - If `FilePath` known: save and close.
    - Else: show Save As, then close.
  - `Don’t Save`: discard unsaved edits for this tab; close.
  - `Cancel`: abort closing this tab.

## 4.4 Tab context menu
On right‑click on a tab:
- `New tab`
- `Close tab`
- `Close other tabs`
- `Close tabs to the right` (grayed out if none to the right)

`Close other tabs` / `Close tabs to the right`:
- For each affected tab:
  - If clean: close silently.
  - If dirty: prompt Save / Don’t Save / Cancel as above.
  - A single **Cancel** aborts the whole bulk close; already-closed tabs stay closed.

## 4.5 Tab strip & overflow
- Tabs arranged **left to right**.
- Active tab visually highlighted.
- Tabs shrink until a **minimum width**.
- Once min width is reached, further tabs trigger **horizontal scrolling**:
  - **Arrow buttons** appear, order:
    - `[Left Arrow] [Right Arrow] [New Tab "+"]`
  - **Right arrow**: scrolls to reveal more tabs on the right.
  - **Left arrow**: scrolls to reveal more on the left.
  - Arrows are **grayed out** if there is no more hidden content in that direction.
- When a tab becomes active, the strip auto‑scrolls to make it **fully visible**.

---
# 5. File Menu: Items & Behaviour
**File**
1. **New tab**  
   - Behaviour: see §4.1.
2. **New window**  
   - Behaviour: see §4.2.
3. **Open**  
   - Show file open dialog.
   - Selected file opens as a **new tab** in the current window.
   - If the same file is already open, behaviour is implementation-defined (allow duplicate tab vs. focus existing tab; you can decide later).
4. **Recent → (recent files or empty)**  
   - Submenu listing recently opened files (or an “Empty”/grayed-out indicator when none).
   - Selecting an item:
     - Opens that file in a **new tab** in the current window.
     - If file missing on disk, show an error and do not create a new tab.
5. **Save**  
   - Operates on the **active tab**:
     - If `FilePath` known: write file, set `IsDirty = false`.
     - If `FilePath` null: show “Save As” dialog, then set path and `IsDirty = false`.
6. **Save all**  
   - Applies to **all tabs in the current window**:
     - For each tab:
       - If `FilePath` known and `IsDirty == true`: save to disk, clear dirty.
       - If `FilePath` null and `IsDirty == true`: open Save As dialog:
         - If user cancels Save As for that tab, it remains dirty and unsaved.
       - Clean tabs with known paths remain untouched.
   - No session-level prompts; acts purely at the document layer.
7. **Export to PDF**  
   - Operates on the **active tab’s current content**:
     - Opens “Export to PDF” dialog (path selection).
     - Generates a PDF from the tab’s content.
     - **Does not** change `FilePath` or `IsDirty` of the tab itself (export is a one‑way operation).
8. **Export to HTML**  
   - Same pattern as Export to PDF but creates an HTML file.
   - Uses active tab’s content; no session/dirty state changes.
9. `---` (separator)
10. **Print**  
    - Opens print dialog for the **active tab** content.
    - Does not modify `IsDirty` or session.
11. `---` (separator)
12. **Close tab**  
    - Closes the **active tab** (see §4.3 behaviour, including prompts).
13. **Close window**  
    - If this is the **first window**:
      - Save its session (all tabs, including unsaved) and **close immediately** with **no prompts**.
    - If **secondary window**:
      - Prompt per dirty tab (Save / Don’t Save / Cancel) and close if no Cancel; no session persistence.
14. **Exit**  
    - Behaviour matches `Close window` for the first window.
    - For secondary windows, same as `Close window` (per-window prompts, no persistence).

---
# 6. Edit Menu: Items & Behaviour
**Edit**
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
   - Open Find UI scoped to the active tab’s content.
10. **Replace**  
    - Open Replace UI (find + replace) for the active tab.
11. **Go to**  
    - Open “Go to line” dialog; jump caret to specified line number in active tab.
12. `---` (separator)
13. **Select all**  
    - Select entire content of the active tab.
14. **Insert date/time**  
    - Insert a formatted date/time string at caret position (or replace selection).  
    - Marks tab as dirty.

All Edit actions operate **only on the active tab**; no cross‑tab or cross‑window effects.

---
# 7. Persistence Summary
- **First window**:
  - Its full tab list, contents, and state are saved when:
    - `File → Close window` or `File → Exit` or window close button is used.
  - No prompts at this stage; dirty state captured as-is.
  - Restored on next app start.

- **Secondary windows**:
  - Never persisted; always start “fresh” when created.
  - Prompt to save dirty tabs when closed.

---
# 8. Settings
## 8.1 Settings Button
- **Location**: Far right end of the menu bar.
- **Layout**: Maintains a proper minimum width between the button and the menu items, based on the window's minimum width.

## 8.2 Settings Window
- **Appearance**: Covers the entire window, including the tabs bar and status bar.
- **Navigation**: "Return" button located at the top left to close settings and return to the editor.
- **Content**:
  - **App theme**: Options for Light, Dark, or Use system setting.
  - **Session Restoration Warnings**:
    - "Warn me if restoring more than [N] tabs" (Default N: 30–50, editable).
    - "Warn me if total session size exceeds [X MB]" (Default X: 80-100, editable).
    - **Prompt**: If either threshold is exceeded, prompt: "Restore all / Restore last N / Start fresh."
  - **Clear saved session**: Option to manually clear the saved session data.

---
# 9. Window Instances
## 9.1 Dimensions
- **Minimum Width and Height**: Values are dynamically determined based on display settings (e.g., screen resolution and scaling) to ensure usability on different screens.

---
