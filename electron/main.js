import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, shell, nativeTheme } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { join, resolve, dirname, basename, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open, readFile, writeFile, opendir, lstat, stat } from 'node:fs/promises'
import { realpathSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { platform } from 'node:process'
import { createIsPathSafe, hasDotDotSegment, pathKey } from './pathSafety.js'
import { filtersForName, OPEN_FILTERS } from './dialogFilters.js'
import { filterAuthorizablePaths } from './authorizePaths.js'
import { buildWindowOptions } from './windowOptions.js'
import { isProbablyText } from './isProbablyText.js'
import { toUserMessage } from './ipcErrorMessage.js'
import { isAppPage } from './appPage.js'
import { createUpdater } from './updater.js'
import { filesFromArgv } from './launchArgs.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Files the user granted access to through a native picker, a Save As dialog or a
// drop. Persisted by MAIN (not the renderer) in <userData>/authorized-paths.json so
// restored tabs and recent files keep working after a relaunch (QA finding 13)
// without the renderer being able to grant itself paths. isPathSafe still
// realpath-checks every read/write against this set.
const allowedPaths = new Set()
// Real location each grant had when it was granted (path -> realpath). isPathSafe
// matches against this, so swapping a granted file for a symlink cannot move the grant.
const grantedReal = new Map()
// Real path now; for a file that doesn't exist yet (Save As) the real parent + name.
const realAtGrant = (abs) => {
    try { return realpathSync(abs) } catch { /* fall through */ }
    try { return join(realpathSync(dirname(abs)), basename(abs)) } catch { return abs }
}
// ponytail: last 500 grants kept; older ones need a re-pick. Raise if anyone hits it.
const MAX_GRANTS = 500
const grantPath = (p) => {
    const abs = resolve(p)
    allowedPaths.delete(abs) // re-insert = most recent last
    allowedPaths.add(abs)
    grantedReal.set(abs, realAtGrant(abs))
    persistGrants()
}
const persistGrants = () => {
    while (allowedPaths.size > MAX_GRANTS) {
        const old = allowedPaths.values().next().value
        allowedPaths.delete(old)
        grantedReal.delete(old)
    }
    try {
        // tmp + rename: a crash mid-write can't leave a torn file that loses every grant
        writeFileSync(`${grantsFile}.tmp`, JSON.stringify([...allowedPaths].map((path) => ({ path, real: grantedReal.get(path) }))))
        renameSync(`${grantsFile}.tmp`, grantsFile)
    } catch (e) {
        log.warn('could not persist authorized paths', e)
    }
}

// Is this path (any case/separator spelling on Windows) a granted entry?
const isGranted = (p) => {
    const k = pathKey(resolve(p), platform)
    for (const a of allowedPaths) if (pathKey(a, platform) === k) return true
    return false
}

// Track the last directory used in file dialogs; starts at documents folder.
let lastDir = app.getPath('documents')

// Scheme allowlist for URLs handed to the OS. Only http/https/mailto; anything
// else (file:, smb:, javascript:, custom protocols) is refused.
const isSafeExternalUrl = (url) => {
    try {
        return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol)
    } catch {
        return false
    }
}

const getPersistentDataPath = () => {
    // E2E override: point userData (session DB, safeStorage keychain scope) at a
    // throwaway dir so a test run never touches the user's real session.
    if (process.env.NOTEPAD_FLUX_USER_DATA) {
        return process.env.NOTEPAD_FLUX_USER_DATA
    }
    const home = homedir()
    if (platform === 'win32') {
        return join(home, 'AppData', 'LocalLow', 'Notepad Flux')
    } else {
        return join(home, '.config', 'notepad-flux')
    }
}

const userDataPath = getPersistentDataPath()
app.setPath('userData', userDataPath)

// Single-instance lock: a second launch focuses the existing window instead of
// starting a second process that fights over the same userData dir + autoUpdater.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', (event, argv, workingDirectory) => {
        // A second launch may carry files to open (the OS default-app handler, a terminal).
        queueLaunchFiles(argv, workingDirectory)
        // Any live app window: the first one may be closed while a New Window lives on.
        const w = appWindows()[0]
        if (w) {
            if (w.isMinimized()) w.restore()
            w.show()
            w.focus()
            if (pendingLaunchFiles.length) w.webContents.send('launch-files')
        }
    })
}

// One rotating log file for retracing a session: <userData>/logs/main.log (1MB, then
// main.old.log). Main-process console.* and uncaught errors land here, and every
// renderer console message is forwarded below (web-contents-created). Never log file
// content or safeStorage payloads - paths and outcomes only.
log.transports.file.resolvePathFn = () => join(userDataPath, 'logs', 'main.log')
Object.assign(console, log.functions)
log.errorHandler.startCatching({ showDialog: false })

const grantsFile = join(userDataPath, 'authorized-paths.json')
try {
    const raw = JSON.parse(readFileSync(grantsFile, 'utf-8'))
    const list = Array.isArray(raw) ? raw : []
    // Current format: [{path, real}]. Older versions wrote bare path strings: those get
    // their real path captured now (once) and are rewritten below in the new format.
    let legacy = false
    for (const e of list) {
        const [p] = filterAuthorizablePaths([typeof e === 'string' ? e : e?.path])
        if (!p) continue
        const real = typeof e === 'object' && typeof e.real === 'string' && isAbsolute(e.real) && !hasDotDotSegment(e.real) ? e.real : null
        if (!real) legacy = true
        allowedPaths.add(p)
        grantedReal.set(p, real ?? realAtGrant(p))
    }
    if (legacy) persistGrants()
} catch (e) {
    if (e.code !== 'ENOENT') log.warn('authorized-paths.json unreadable; starting with no grants', e)
}

const isPathSafe = createIsPathSafe({ allowedPaths, realpath: realpathSync, grantedReal, platform })

// The app's own page: the dev server, or the packaged index.html. Nothing else gets a bridged window.
const isOwnPage = (url) => isAppPage(url, {
    devUrl: process.env.VITE_DEV_SERVER_URL,
    indexPath: join(process.env.DIST, 'index.html'),
    platform: process.platform,
})

const safeHandle = (channel, handler) => {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args)
        } catch (error) {
            console.error(`Error in IPC handler for ${channel}:`, error)
            throw new Error(toUserMessage(error), { cause: error })
        }
    })
}

safeHandle('safe-storage-encrypt', async (event, plainText) => {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
        throw new Error('Safe storage is not available.')
    }
    const buffer = await safeStorage.encryptStringAsync(plainText)
    return buffer.toString('base64')
})

safeHandle('safe-storage-decrypt', async (event, encryptedBase64) => {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
        throw new Error('Safe storage is not available.')
    }
    const buffer = Buffer.from(encryptedBase64, 'base64')
    const { result } = await safeStorage.decryptStringAsync(buffer)
    return result
})

// True when the keyring rotated its key: the page then rewrites its secure key copy.
safeHandle('safe-storage-needs-reencrypt', async (event, encryptedBase64) => {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return false
    const { shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(encryptedBase64, 'base64'))
    if (shouldReEncrypt) log.info('safeStorage: re-encrypting the secure key copy')
    return shouldReEncrypt
})

safeHandle('safe-storage-available', async () => {
    return safeStorage.isAsyncEncryptionAvailable()
})

// Which keyring backs safeStorage. On Linux 'basic_text' is a fixed-key obfuscation,
// not a real keyring, so the page keeps its plaintext key there. 'os' elsewhere.
safeHandle('safe-storage-backend', async () => {
    return process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os'
})

safeHandle('read-file', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
        properties: ['openFile'],
        filters: OPEN_FILTERS,
        defaultPath: lastDir
    })
    if (canceled) return { canceled }

    const filePath = filePaths[0]
    log.info('open: picked', filePath)
    // Selecting a file in the native OS picker IS the authorization; we do not
    // call isPathSafe here (QA finding 3, user-confirmed).
    grantPath(filePath)
    lastDir = dirname(filePath)

    const buf = await readFile(filePath)
    if (!isProbablyText(buf)) {
        throw new Error('Not a text file.')
    }
    const content = buf.toString('utf-8')
    return { canceled, filePath, content }
})

safeHandle('read-file-content', async (event, filePath) => {
    // ponytail: isPathSafe realpath-checks filePath, then readFile re-resolves the
    // raw path - a symlink swapped in between the two is a TOCTOU race. Local
    // attacker only; fully closing it means readFile'ing the realpath'd result,
    // which the new-file save path has no value for. Left as a known corner.
    if (typeof filePath === 'string' && isGranted(filePath) && !existsSync(filePath)) {
        // Granted earlier, gone now: say so (isPathSafe would call it unauthorized).
        log.info('read: missing', filePath)
        throw Object.assign(new Error('File not found.'), { code: 'ENOENT' })
    }
    if (!isPathSafe(filePath)) {
        log.warn('read: denied (not in allowlist)', filePath)
        throw new Error('Access denied: Unauthorized file path.')
    }
    log.info('read', filePath)
    const buf = await readFile(filePath)
    if (!isProbablyText(buf)) {
        throw new Error('Not a text file.')
    }
    return buf.toString('utf-8')
})

safeHandle('save-file', async (event, { filePath, content, suggestedName }) => {
    if (!filePath) {
        const { canceled, filePath: savePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
            defaultPath: suggestedName ? join(lastDir, suggestedName) : lastDir,
            filters: filtersForName(suggestedName)
        })
        if (canceled) return { canceled: true }
        filePath = savePath
        log.info('save-as: picked', filePath)
        grantPath(filePath)
        lastDir = dirname(filePath)
    } else if (!isPathSafe(filePath)) {
        log.warn('save: denied (not in allowlist)', filePath)
        throw new Error('Access denied: Unauthorized file path.')
    }

    // content is a string for text saves, a Uint8Array (from the IPC bridge) for
    // binary exports like PDF. Buffer.from copies the typed array; no encoding arg.
    await writeFile(filePath, typeof content === 'string' ? content : Buffer.from(content))
    lastDir = dirname(filePath)
    log.info('save: wrote', filePath, typeof content === 'string' ? `${content.length} chars` : `${content.length} bytes`)
    return { filePath, canceled: false }
})

// Read a file the user handed us directly (a drop, a command-line argument) and grant it.
// The hand-over is the user's consent, like a picker selection.
const readAndGrant = async (filePath, how) => {
    if (filterAuthorizablePaths([filePath]).length === 0) {
        throw new Error('Access denied: Unauthorized file path.')
    }
    // Stat and read through one handle, so the file checked is the file read (CodeQL #56).
    const fh = await open(filePath, 'r')
    let buf
    try {
        if (!(await fh.stat()).isFile()) throw new Error('Access denied: Unauthorized file path.')
        buf = await fh.readFile()
    } finally {
        await fh.close()
    }
    log.info(`open: ${how}`, filePath)
    if (!isProbablyText(buf)) {
        throw new Error('Not a text file.')
    }
    grantPath(filePath)
    lastDir = dirname(filePath)
    return { filePath, content: buf.toString('utf-8') }
}

// A file dropped on the window. Only the preload calls this, with a path it got from
// webUtils.getPathForFile on a real dropped File - main-world page script can't
// reach ipcRenderer, and can't forge a File that maps to a native path.
safeHandle('open-dropped-file', (event, filePath) => readAndGrant(filePath, 'dropped'))

// Files passed on the command line (first launch, or a later launch handed over by
// second-instance). Only something that can run this binary as the user can put
// paths here; the page can only take what is queued, never add to it.
const pendingLaunchFiles = []
const queueLaunchFiles = (argv, cwd) => {
    for (const p of filesFromArgv(argv, { cwd, defaultApp: !!process.defaultApp })) {
        if (!pendingLaunchFiles.includes(p)) pendingLaunchFiles.push(p)
    }
}
queueLaunchFiles(process.argv, process.cwd())

// The page pulls the queue once on mount and again on each 'launch-files' notice, so
// a file queued before the page was listening is not lost. Per-file errors come back
// as data so one bad file doesn't hide the others.
safeHandle('take-launch-files', async (event) => {
    // Only the app's own page, in its top frame, may take (and so read) queued files.
    if (event.senderFrame !== event.sender.mainFrame || !isOwnPage(event.senderFrame.url)) {
        throw new Error('Access denied: Unauthorized file path.')
    }
    const out = []
    for (const filePath of pendingLaunchFiles.splice(0)) {
        try {
            out.push(await readAndGrant(filePath, 'launch argument'))
        } catch (error) {
            log.warn('open: launch argument failed', filePath, error?.code || error?.message)
            out.push({ filePath, error: toUserMessage(error) })
        }
    }
    // The window that took the files shows them, whichever window main notified.
    if (out.length) BrowserWindow.fromWebContents(event.sender)?.focus()
    return out
})

// Settings > Session data. Neither channel reads or grants a file for the page, and neither takes an argument:
// the page can't choose what gets measured or opened.
const MAX_WALK_ENTRIES = 100_000
const dataFolderWalk = async (root) => {
    let bytes = 0, seen = 0, truncated = false
    const inodes = new Set()   // a hardlink is one file on disk: count it once (bigint stat: NTFS file ids can exceed 2^53)
    const dirs = [root]
    walk: while (dirs.length) {
        const dir = dirs.pop()
        let d
        try { d = await opendir(dir) } catch { continue }
        try {
            for await (const e of d) {
                if (++seen > MAX_WALK_ENTRIES) { truncated = true; break walk }
                const p = join(dir, e.name)
                if (e.isDirectory()) { dirs.push(p); continue }
                try {
                    const st = await lstat(p, { bigint: true })
                    if (!st.isFile()) continue
                    const id = `${st.dev}:${st.ino}`
                    if (inodes.has(id)) continue
                    inodes.add(id)
                    bytes += Number(st.size)
                } catch { /* vanished or unreadable */ }
            }
        } catch { /* unreadable mid-listing: keep what was counted */ }
    }
    return { bytes, truncated }
}
// One walk at a time: concurrent callers share the in-flight one.
let dataWalk = null
const requireOwnTopFrame = (event) => {
    if (event.senderFrame !== event.sender.mainFrame || !isOwnPage(event.senderFrame.url)) {
        throw new Error('Access denied.')
    }
}
safeHandle('get-data-info', async (event) => {
    requireOwnTopFrame(event)
    const path = app.getPath('userData')
    dataWalk ??= (async () => {
        log.info('data-info walk')
        try { return await dataFolderWalk(path) } finally { dataWalk = null }
    })()
    return { path, ...(await dataWalk) }
})
safeHandle('open-data-folder', async (event) => {
    requireOwnTopFrame(event)
    const path = app.getPath('userData')
    if (!(await stat(path).catch(() => null))?.isDirectory()) return { ok: false, error: 'Not a folder' }
    const error = await shell.openPath(path)
    return error === '' ? { ok: true } : { ok: false, error }
})

// Existence probe for restored tabs (QA finding 12). Only answers for granted
// paths; anything else is null ("unknown"), so the page can't probe the disk.
safeHandle('file-exists', async (event, p) => {
    if (typeof p !== 'string' || !isGranted(p)) return null
    let exists = false
    try { exists = existsSync(p) } catch { /* treat as missing */ }
    if (!exists) log.info('file-exists: missing', p)
    return exists
})

// --------- Auto Updater ---------
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

// Status, progress and the Settings button live in updater.js (Docs/internal/update-spec.md).
const updater = createUpdater({
    autoUpdater,
    dialog,
    getWindows: () => appWindows(),
    prepareInstall: () => closeAllForInstall(),
    // isUpdaterActive(): false for a Linux run that isn't an AppImage/deb install (e.g. unpacked).
    isPackaged: app.isPackaged && !process.env.VITE_DEV_SERVER_URL && autoUpdater.isUpdaterActive(),
    log,
})

// Only the app's own page, in its top frame, may drive updates (install quits the app).
const updateHandle = (channel, fn) => safeHandle(channel, async (event) => {
    if (event.senderFrame !== event.sender.mainFrame || !isOwnPage(event.senderFrame.url)) {
        throw new Error('Access denied.')
    }
    return fn()
})
updateHandle('update-get-status', () => updater.getStatus())
updateHandle('update-check', () => updater.check({ manual: true }))
updateHandle('update-download', () => updater.download())
updateHandle('update-install', () => updater.install())

safeHandle('get-app-version', async () => {
    return app.getVersion()
})

safeHandle('open-external', async (event, url) => {
    if (!isSafeExternalUrl(url)) {
        console.warn('Blocked open-external for unsafe URL scheme:', url)
        return
    }
    return await shell.openExternal(url)
})

// The built directory structure
//
// ├─┬ dist
// │ └── index.html
// ├── dist-electron
// │ ├── main.js
// │ └── preload.cjs
//
process.env.DIST_ELECTRON = join(__dirname, '../dist-electron')
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(__dirname, '../public')
    : process.env.DIST

let splash = null

// Every open app window (the first one and each New Window), newest last. Windows
// are equals: the app lives until the last one closes, whichever was first.
const appWindows = () => BrowserWindow.getAllWindows().filter(w => w !== splash && !w.isDestroyed())

// Menu Close Window: close from main so guardClose's flush handshake runs.
ipcMain.on('close-window', (event) => BrowserWindow.fromWebContents(event.sender)?.close())
// Menu Exit: close every window, each through its own close guard (flush handshake,
// unsaved-changes prompt). A window the user keeps open keeps the app running.
ipcMain.on('quit-app', () => appWindows().forEach(w => w.close()))

// Restart to update: close every window through its close guard (tabs get saved), then
// updater.js calls quitAndInstall. While this runs, window-all-closed must not quit on its own.
// A window that refuses ("Keep editing") cancels the install; quitting works normally again.
let installingUpdate = false
let cancelInstall = null
let quitting = false
const closeAllForInstall = () => new Promise((resolve) => {
    const wins = appWindows()
    installingUpdate = true
    const finish = (ok) => {
        cancelInstall = null
        if (!ok) {
            installingUpdate = false
            return resolve(false)
        }
        // quitAndInstall quits on success; on some failures it only logs. Windows are gone and
        // the session is saved, so never linger without a UI: quit anyway after a grace period.
        setTimeout(() => {
            if (quitting) return
            log.warn('update: install did not quit the app; quitting')
            installingUpdate = false
            app.quit()
        }, 10000)
        resolve(true)
    }
    cancelInstall = () => finish(false)
    if (!wins.length) return finish(true)
    let left = wins.length
    for (const w of wins) {
        w.once('closed', () => { if (--left === 0 && cancelInstall) finish(true) })
        w.close()
    }
})

// Close handshake: hold a window's close until its page confirms the session is saved;
// a save still running after CLOSE_ASK_AFTER_MS (stuck or hung page) asks the user.
const CLOSE_ASK_AFTER_MS = 15000
const guardClose = (w) => {
    let ready = false
    let pending = false
    w.on('close', (e) => {
        if (ready) { ready = false; return }
        e.preventDefault()
        if (pending) return
        pending = true
        let timer
        let askAbort = null
        let asking = null
        const wc = w.webContents
        const done = () => {
            if (!pending) return
            clearTimeout(timer)
            ipcMain.removeListener('close-ready', onReady)
            wc.removeListener('render-process-gone', done)
            wc.removeListener('did-finish-load', resend)
            pending = false
            const close = () => {
                if (w.isDestroyed()) return
                ready = true
                w.close()
            }
            // Let a dialog attached to this window go away before the window does.
            if (asking) { askAbort.abort(); asking.finally(close) } else close()
        }
        const onReady = (ev) => { if (ev.sender === wc) done() }
        // A page that reloaded mid-close never got the request; a dead page has nothing to save.
        const resend = () => wc.send('flush-before-close')
        const ask = () => {
            askAbort = new AbortController()
            asking = dialog.showMessageBox(w, {
                type: 'warning',
                buttons: ['Keep waiting', 'Close without saving'],
                defaultId: 0,
                cancelId: 0,
                noLink: true,
                title: 'Notepad Flux',
                message: 'Notepad Flux is still saving your tabs.',
                detail: 'Saving usually takes under a second. If you close now, changes since the last save may be lost.',
                signal: askAbort.signal,
            }).then(({ response }) => {
                asking = null
                if (!pending) return // the save finished while the dialog was open
                if (response === 1) {
                    log.warn('close: renderer did not confirm session flush; user chose to close without saving')
                    done()
                } else {
                    timer = setTimeout(ask, CLOSE_ASK_AFTER_MS)
                }
            }).catch((err) => {
                asking = null
                log.warn('close: wait dialog failed; closing anyway', err)
                done()
            })
        }
        timer = setTimeout(ask, CLOSE_ASK_AFTER_MS)
        ipcMain.on('close-ready', onReady)
        wc.once('render-process-gone', done)
        wc.on('did-finish-load', resend)
        if (wc.isCrashed()) return done()
        resend()
    })
}

const dismissSplash = () => {
    if (splash && !splash.isDestroyed()) {
        splash.close()
    }
    splash = null
}

function createWindow() {
    // Fallback: if the renderer never reaches ready-to-show AND never fails
    // (e.g. a hung load), don't leave the user staring at a frameless splash forever.
    const showTimeout = setTimeout(() => {
        if (splash) {
            log.warn('ready-to-show not fired within 15s; forcing window visible')
            dismissSplash()
            if (!win.isDestroyed()) win.show()
        }
    }, 15000)

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 400,
        minHeight: 300,
        show: false, // Wait until ready-to-show
        ...buildWindowOptions({
            platform: process.platform,
            prefersDark: nativeTheme.shouldUseDarkColors,
            preloadPath: join(process.env.DIST_ELECTRON, 'preload.cjs'),
            iconPath: join(process.env.VITE_PUBLIC, 'icons/desktop/icon.png'),
        }),
    })

    wireWindow(win)

    win.once('ready-to-show', () => {
        clearTimeout(showTimeout)
        win.show()
        dismissSplash()
    })

    // If the renderer fails to load, the splash would otherwise hang indefinitely
    // (ready-to-show never fires) and the app looks frozen with no window.
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return
        if (errorCode === -3) return // ERR_ABORTED — benign (e.g. navigation cancelled)
        clearTimeout(showTimeout)
        log.error(`Renderer failed to load (${errorCode} ${errorDescription}) ${validatedURL}`)
        dismissSplash()
        dialog.showErrorBox(
            'Notepad Flux failed to start',
            `The application window could not load (${errorDescription || errorCode}).`
        )
        if (!win.isDestroyed()) win.destroy()
        app.quit()
    })

    Menu.setApplicationMenu(null)

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(join(process.env.DIST, 'index.html'))
    }
}

// Close guard, window.open / navigation rules and the main-process-message push for
// one app window. Applied to the first window and to every window any app window
// opens (New Window from a New Window too), so all of them follow the same rules.
function wireWindow(w) {
    guardClose(w)
    updater.attachWindow(w)
    w.webContents.on('did-create-window', wireWindow)

    w.webContents.on('did-finish-load', () => {
        if (!w.isDestroyed()) w.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    w.webContents.setWindowOpenHandler(({ url }) => {
        const isOwnOrigin = isOwnPage(url)

        if (!isOwnOrigin) {
            if (url.startsWith('http:') || url.startsWith('https:')) {
                shell.openExternal(url)
            } else {
                log.warn(`Blocked window.open for disallowed URL: ${url}`)
            }
            return { action: 'deny' }
        }

        // App's own origin (dev server in dev, file: index in prod) — real Electron window.
        // "New Window" menu opens window.location.href, which lands here.
        return {
            action: 'allow',
            // Electron closes a window.open child with its opener by default; that
            // took every New Window (and its unsaved text) down with the first window.
            outlivesOpener: true,
            overrideBrowserWindowOptions: {
                ...buildWindowOptions({
                    platform: process.platform,
                    prefersDark: nativeTheme.shouldUseDarkColors,
                    preloadPath: join(process.env.DIST_ELECTRON, 'preload.cjs'),
                    iconPath: join(process.env.VITE_PUBLIC, 'icons/desktop/icon.png'),
                }),
            }
        }
    })

    w.webContents.on('will-navigate', (event, navigationUrl) => {
        if (isOwnPage(navigationUrl)) {
            return
        }
        event.preventDefault()
        // A local file is never handed to the OS to open; only web links leave the app.
        if (/^(https?|mailto):/i.test(navigationUrl)) {
            shell.openExternal(navigationUrl)
        } else {
            log.warn(`Blocked navigation to disallowed URL: ${navigationUrl}`)
        }
    })
}

app.on('window-all-closed', () => {
    if (installingUpdate) return // updater.js quits and installs
    if (process.platform !== 'darwin') app.quit()
})

// A non-primary window (a second app window opened via window.open — it does not
// hold the Web Lock, so it does NOT persist its tabs) calls beforeunload's
// preventDefault() when it has dirty tabs. Electron silently swallows that unless
// the main process handles will-prevent-unload — so without this, the X button on
// such a window does nothing (QA finding 10 follow-up). Give the user a real
// choice. NOTE: preventDefault() HERE means "override the block and close".
app.on('web-contents-created', (_event, contents) => {
    // Forward renderer console (useCommands / SessionContext / crypto errors) into the log file.
    contents.on('console-message', ({ level, message, sourceId, lineNumber }) => {
        const fn = { error: log.error, warning: log.warn, debug: log.debug }[level] ?? log.info
        fn(`[renderer] ${message} (${sourceId?.split('/').pop()}:${lineNumber})`)
    })
    contents.on('render-process-gone', (_e, details) => log.error('renderer process gone', details))
    contents.on('will-prevent-unload', (event) => {
        const owner = BrowserWindow.fromWebContents(contents)
        const choice = dialog.showMessageBoxSync(owner ?? undefined, {
            type: 'question',
            buttons: ['Discard changes and close', 'Keep editing'],
            defaultId: 1,
            cancelId: 1,
            title: 'Unsaved changes',
            message: 'This window has unsaved changes that are not part of the saved session. Close it and discard them?',
        })
        if (choice === 0) event.preventDefault()
        else cancelInstall?.()
    })
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
    quitting = true
    log.info('quit')
})

if (gotTheLock) app.whenReady().then(() => {
    log.info('start', {
        version: app.getVersion(),
        electron: process.versions.electron,
        platform: `${process.platform} ${process.arch}`,
        packaged: app.isPackaged,
        userData: userDataPath,
        safeStorageBackend: process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os',
    })
    // Off the startup path: a slow or failing keyring must not hold up the window.
    safeStorage.isAsyncEncryptionAvailable()
        .then(ok => log.info('keyring', { safeStorage: ok }))
        .catch(err => log.warn('safeStorage check failed', err?.message))
    splash = new BrowserWindow({
        width: 300,
        height: 300,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        icon: join(process.env.VITE_PUBLIC, 'icons/desktop/icon.png'),
    })
    splash.loadFile(join(process.env.VITE_PUBLIC, 'loading.html'))
    createWindow()

    // Check for updates on startup
    if (!process.env.VITE_DEV_SERVER_URL) {
        updater.check({ manual: false })
    }
})
