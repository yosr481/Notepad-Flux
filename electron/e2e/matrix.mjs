// Coverage matrix: CHANGELOG [Unreleased] bullets, QA findings 1-13, human QA run-sheet flows -> check ids.
// Merges into Docs/internal/e2e/results-linux.json (key "matrix") using the results of target "unpacked".
//   node electron/e2e/matrix.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const file = join(dirname(fileURLToPath(import.meta.url)), '../../Docs/internal/e2e/results-linux.json')
const all = JSON.parse(readFileSync(file, 'utf8'))
const by = Object.fromEntries((all.targets.unpacked?.checks ?? []).map(c => [c.id, c]))

// [source, id, what, [check ids], not-automatable reason (for the part no check covers)]
const rows = [
    ['CHANGELOG', 'CL-1', 'No markdown rendering inside ```markdown / ```md fences', ['LP-2']],
    ['CHANGELOG', 'CL-2', 'GFM [X] checkbox recognised as checked', ['LP-7']],
    ['CHANGELOG', 'CL-3', 'Backslash escapes and HTML entities render literally', ['LP-3']],
    ['CHANGELOG', 'CL-4', '<https://...> autolink hides angle brackets', ['LP-3']],
    ['CHANGELOG', 'CL-5', 'Image / table-cell link "title" stripped', ['LP-4', 'LP-5']],
    ['CHANGELOG', 'CL-6', 'Tables: alignment, in blockquote, \\| literal pipe', ['LP-5']],
    ['CHANGELOG', 'CL-7', 'Closed ATX / setext markers hidden; ordered list renumber; nested > indent', ['LP-1', 'LP-6']],
    ['CHANGELOG', 'CL-8', 'Reference-style links/images, linked image [![a](i)](u)', ['LP-8', 'LP-4', 'LP-4b']],
    ['CHANGELOG', 'CL-9', 'Ref image before inline image no longer crashes image rendering', ['LP-4']],
    ['CHANGELOG', 'CL-10', 'One bar per blockquote nesting level', ['LP-6']],
    ['CHANGELOG', 'CL-11', 'Explicit window backgroundColor (dark/light), no white flash', ['WIN-1', 'WIN-3'], 'the visual white flash at first paint is not measurable here; only the configured backgroundColor is asserted'],
    ['CHANGELOG', 'CL-12', 'Native window controls kept on Linux (titleBarStyle hidden Windows-only)', ['WIN-2'], 'Xephyr runs no window manager, so the title bar/buttons are never drawn; only the WM hints (decorations on) are asserted'],
    ['CHANGELOG', 'CL-13', 'Preload bridge loads in packaged build; safeStorage keychain', ['LAUNCH-1', 'SEC-1', 'SEC-2', 'SEC-9']],
    ['CHANGELOG', 'CL-14', 'Grants persisted by main; page cannot self-grant', ['SES-1', 'SES-2', 'SEC-2', 'SEC-3', 'LOG-4']],
    ['CHANGELOG', 'CL-15', 'Close waits (<=3s) for session flush', ['CLOSE-1', 'CLOSE-x', 'CLOSE-menu-exit', 'CLOSE-menu-close-window']],
    ['CHANGELOG', 'CL-16', 'Text drag/drop in the editor works; only file drops open tabs', ['DND-3'], 'dragging a selection inside the editor (internal move) is not driven; external text drop is (CDP drag with text/plain)'],
    ['CHANGELOG', 'CL-17', 'Save As keeps CRLF and BOM', ['EOL-3']],
    ['CHANGELOG', 'CL-18', 'Recent: binary/permission failure shows reason and keeps entry; only missing offers Locate', ['RECENT-3', 'RECENT-2', 'RECENT-4'], 'binary-file-via-Recent variant not driven'],
    ['CHANGELOG', 'CL-19', 'Unresolved reference link stays literal; inline image after ref image renders', ['LP-8', 'LP-4']],
    ['CHANGELOG', 'CL-20', 'Binary files refused with a clear message; failed opens/saves say why', ['ERR-1', 'ERR-2', 'ERR-3']],
    ['CHANGELOG', 'CL-21', 'Open/Save dialogs: Text + All Files filters, last folder, parented', ['OPEN-3'], 'the native dialog is stubbed: its call arguments (parent, filters, defaultPath) are asserted, its rendering is not'],
    ['CHANGELOG', 'CL-22', 'Window closes with dirty tab; secondary window asks before discarding', ['CLOSE-1', 'CLOSE-x', 'WIN-4'], 'the secondary-window prompt is a native message box (dialog.showMessageBoxSync, stubbed)'],
    ['CHANGELOG', 'CL-23', 'Dock/taskbar icon on Linux', ['WIN-5'], 'a real dock/taskbar is not available under Xephyr; _NET_WM_ICON and WM_CLASS are asserted'],
    ['CHANGELOG', 'CL-24', 'Correct caret movement across mixed RTL/LTR', ['RTL-1']],
    ['CHANGELOG', 'CL-25', 'Restored tab whose file moved/deleted is marked; next save = Save As', ['SES-3', 'SES-4']],
    ['CHANGELOG', 'CL-26', 'Recent: confirm before re-locating; alerts non-blocking', ['RECENT-2', 'RECENT-4']],
    ['CHANGELOG', 'CL-27', 'Long toasts stay inside the window', ['ERR-4']],
    ['CHANGELOG', 'CL-28', 'Drag files onto the window to open tabs', ['DND-1', 'DND-2'], 'a real file-manager drag cannot be performed; CDP Input.dispatchDragEvent with native paths is the closest simulation'],
    ['CHANGELOG', 'CL-29', 'Status bar: real EOL + charset; fake zoom removed', ['EOL-1', 'EOL-2', 'EOL-4', 'EOL-3']],
    ['CHANGELOG', 'CL-30', 'Session log at <userData>/logs/main.log, never file content', ['LOG-1', 'LOG-2', 'LOG-3']],
    ['CHANGELOG', 'CL-31', 'Tabs stretch full width; + pinned just right of last tab, never scrolls away', ['TAB-1', 'TAB-2']],
    ['QA', 'QA-1', 'Open failure was silent -> toast with reason', ['ERR-2']],
    ['QA', 'QA-2', 'Binary file opened as garbled text', ['ERR-1']],
    ['QA', 'QA-3', 'read-file does not isPathSafe a picked symlink (accepted policy)', ['ERR-2', 'SEC-5a', 'SEC-5b']],
    ['QA', 'QA-4', 'Open picker unusable after a failed open (browser-fallback artifact)', ['ERR-2']],
    ['QA', 'QA-5', 'Picker default folder / last dir', ['OPEN-3']],
    ['QA', 'QA-6', 'Open filters Text / All Files', ['OPEN-3']],
    ['QA', 'QA-7', 'Save failure toast', ['ERR-3']],
    ['QA', 'QA-8', 'Toast overflow', ['ERR-4']],
    ['QA', 'QA-9', 'Missing recent file: confirm before picker', ['RECENT-2', 'RECENT-4']],
    ['QA', 'QA-10', 'Window did not close with dirty tab', ['CLOSE-1', 'CLOSE-x', 'CLOSE-menu-exit', 'WIN-4']],
    ['QA', 'QA-11', 'Drop inserted text instead of opening tab', ['DND-1', 'DND-3']],
    ['QA', 'QA-12', 'Restored tab with missing file', ['SES-3', 'SES-4']],
    ['QA', 'QA-13', 'Granted files stay accessible after relaunch', ['SES-1', 'SES-2', 'SES-5']],
    ['RUNSHEET', 'A1', 'Launch: splash then window, no white flash, version in status bar, start block', ['LAUNCH-1', 'WIN-1', 'APP-VER', 'LOG-1'], 'splash visuals and white flash not observable'],
    ['RUNSHEET', 'A2', 'Dock icon / WM_CLASS', ['WIN-5'], 'real dock not present under Xephyr'],
    ['RUNSHEET', 'A3', 'safeStorage on gnome_libsecret', ['LOG-1', 'SEC-9']],
    ['RUNSHEET', 'A4', 'Second launch focuses existing window', ['SINGLE-1']],
    ['RUNSHEET', 'A5', 'Title-bar minimise/maximise/close buttons work', [], 'no window manager under Xephyr (no title bar exists to click); needs a real desktop session'],
    ['RUNSHEET', 'B1', 'Ctrl+O, filters, opens in new tab', ['OPEN-1', 'OPEN-3']],
    ['RUNSHEET', 'B2', 'Edit + Ctrl+S saves in place', ['SAVE-1']],
    ['RUNSHEET', 'B3', 'Save As to subdir, dialog last folder', ['SAVE-2', 'OPEN-3']],
    ['RUNSHEET', 'B4', 'Ctrl+N + Ctrl+S opens Save As', ['SAVE-3']],
    ['RUNSHEET', 'B5', 'Binary refused with toast', ['ERR-1']],
    ['RUNSHEET', 'B6', 'Empty file, unicode/space name saves in place', ['OPEN-2']],
    ['RUNSHEET', 'B7', 'shadow-symlink -> Permission denied; app keeps working', ['ERR-2']],
    ['RUNSHEET', 'B8', 'Read-only save -> Permission denied; text stays, tab dirty', ['ERR-3']],
    ['RUNSHEET', 'B9', 'CRLF status + preserved on save', ['EOL-1', 'EOL-2'], '`file` utility not used; CR/LF bytes asserted directly'],
    ['RUNSHEET', 'B10', 'Drag a file from Files app onto the editor', ['DND-1'], 'real Files-app drag not possible; CDP native-path drop used'],
    ['RUNSHEET', 'B11', '1.3 MB file responsive', ['PERF-1']],
    ['RUNSHEET', 'B12', 'Save As keeps CRLF', ['EOL-3']],
    ['RUNSHEET', 'C1', 'Long document decorated to the end', ['LP-11']],
    ['RUNSHEET', 'C2', 'RTL/LTR caret and selection', ['RTL-1'], 'code-block, table-line and long wrapping paragraph lines not driven; subjective stutter needs a human'],
    ['RUNSHEET', 'C3', 'Checkbox toggles source; table renders; link opens externally', ['LP-7', 'LP-5', 'LP-4b']],
    ['RUNSHEET', 'C4', 'file:// link blocked', ['LP-12', 'SEC-7']],
    ['RUNSHEET', 'C5', 'Export PDF/HTML, print dialog', ['EXPORT-1', 'PRINT-1'], 'native print dialog not drivable; PDF/HTML opened in a viewer not checked (header/markup asserted)'],
    ['RUNSHEET', 'C6', 'Long toast in narrow window', ['ERR-4']],
    ['RUNSHEET', 'C7', 'Drag word within editor; drop phrase from web page', ['DND-3'], 'internal word drag and drag from a real browser not driven'],
    ['RUNSHEET', 'C8', 'Undefined reference link stays literal', ['LP-8']],
    ['RUNSHEET', 'D1', 'Close with X: no prompt; quit logged; no flush timeout', ['CLOSE-1']],
    ['RUNSHEET', 'D2', 'Relaunch restores tabs, dirty marks, active tab, no decrypt errors', ['SES-1']],
    ['RUNSHEET', 'D3', 'Restored file saves in place', ['SES-2']],
    ['RUNSHEET', 'D4', 'Moved file: warning mark; Ctrl+S -> Save As', ['SES-3', 'SES-4']],
    ['RUNSHEET', 'D5', 'Deleted recent: confirm; Cancel removes; Locate opens picker', ['RECENT-2', 'RECENT-4']],
    ['RUNSHEET', 'D6', 'Recent opens directly after relaunch', ['SES-5']],
    ['RUNSHEET', 'D7', 'New Window: discard prompt; Keep/Discard', ['WIN-4', 'WIN-3']],
    ['RUNSHEET', 'D8', 'No leftover process after quit', ['CLOSE-1']],
    ['RUNSHEET', 'D9', 'Type then Alt+F4 within 1s; File > Exit', ['CLOSE-x', 'CLOSE-menu-exit', 'CLOSE-menu-close-window'], 'Alt+F4 is a window-manager key (no WM); window.close() is the same main-process close path'],
    ['RUNSHEET', 'E1', 'Every [error] explained', ['LOG-3']],
    ['RUNSHEET', 'E2', 'No file content in log', ['LOG-2']],
    ['RUNSHEET', 'E3', 'authorized-paths.json only touched files', ['LOG-4']],
    ['EXTRA', 'X-1', 'Encryption at rest', ['ENC-1', 'ENC-2']],
    ['EXTRA', 'X-2', 'Security posture (isolation, sandbox, window.open, navigation, grants, symlinks)', ['SEC-1', 'SEC-3', 'SEC-4', 'SEC-5a', 'SEC-5b', 'SEC-5c', 'SEC-6', 'SEC-6b', 'SEC-6c', 'SEC-7', 'SEC-8']],
    ['EXTRA', 'X-3', 'Tab-id race: files opened right after launch', ['RACE-1']],
    ['EXTRA', 'X-4', 'Installer metadata (deb/AppImage/asar)', ['PKG-DEB-1', 'PKG-DEB-2', 'PKG-DEB-3', 'PKG-DEB-4', 'PKG-DEB-5', 'PKG-ASAR-1', 'PKG-APPIMG-1', 'PKG-APPIMG-2'], 'dpkg -i install and AppImage runtime execution not possible here'],
]
const pkg = Object.fromEntries((all.targets['installers-static']?.checks ?? []).map(c => [c.id, c]))
const rank = { fail: 3, 'not-run': 2, skipped: 2, pass: 0, 'not-automatable': 1 }
all.matrix = rows.map(([source, id, what, ids, gap]) => {
    const rs = ids.map(i => by[i] ?? pkg[i]).filter(Boolean)
    const missing = ids.filter(i => !(by[i] ?? pkg[i]))
    const worst = rs.length ? rs.reduce((a, b) => rank[b.result] > rank[a.result] ? b : a).result : 'none'
    const status = ids.length === 0 ? 'not-automatable' : missing.length ? 'not-run' : worst === 'pass' ? (gap ? 'automated (partial)' : 'automated') : worst
    return { source, id, what, checks: ids, status, ...(gap ? { gap } : {}), ...(missing.length ? { missing } : {}) }
})
writeFileSync(file, JSON.stringify(all, null, 2))
const tally = {}; for (const r of all.matrix) tally[r.status] = (tally[r.status] || 0) + 1
console.log(all.matrix.length + ' matrix rows', tally)
for (const r of all.matrix.filter(r => /fail|not-run/.test(r.status))) console.log(r.status.toUpperCase(), r.id, r.what, r.missing ? 'missing ' + r.missing : '')
