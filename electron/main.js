import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, shell, nativeTheme } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { join, resolve, dirname, basename, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open, readFile, writeFile } from 'node:fs/promises'
import { realpathSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { platform } from 'node:process'
import { createIsPathSafe, hasDotDotSegment } from './pathSafety.js'
import { filtersForName, OPEN_FILTERS } from './dialogFilters.js'
import { filterAuthorizablePaths } from './authorizePaths.js'
import { buildWindowOptions } from './windowOptions.js'
import { isProbablyText } from './isProbablyText.js'
import { toUserMessage } from './ipcErrorMessage.js'
import { isAppPage } from './appPage.js'

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

// Single-instance lock: a second launch focuses the existing window instead of
// starting a second process that fights over the same userData dir + autoUpdater.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (win && !win.isDestroyed()) {
            if (win.isMinimized()) win.restore()
            win.show()
            win.focus()
        }
    })
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

const isPathSafe = createIsPathSafe({ allowedPaths, realpath: realpathSync, grantedReal })

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
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Safe storage is not available.')
    }
    const buffer = safeStorage.encryptString(plainText)
    return buffer.toString('base64')
})

safeHandle('safe-storage-decrypt', async (event, encryptedBase64) => {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Safe storage is not available.')
    }
    const buffer = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(buffer)
})

safeHandle('safe-storage-available', async () => {
    return safeStorage.isEncryptionAvailable()
})

safeHandle('read-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
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
    if (typeof filePath === 'string' && allowedPaths.has(resolve(filePath)) && !existsSync(filePath)) {
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
        const { canceled, filePath: savePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
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

// A file dropped on the window. Only the preload calls this, with a path it got from
// webUtils.getPathForFile on a real dropped File - main-world page script can't
// reach ipcRenderer, and can't forge a File that maps to a native path. The drop is
// the user's consent, like a picker selection.
safeHandle('open-dropped-file', async (event, filePath) => {
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
    log.info('open: dropped', filePath)
    if (!isProbablyText(buf)) {
        throw new Error('Not a text file.')
    }
    grantPath(filePath)
    lastDir = dirname(filePath)
    return { filePath, content: buf.toString('utf-8') }
})

// Existence probe for restored tabs (QA finding 12). Only answers for granted
// paths; anything else is null ("unknown"), so the page can't probe the disk.
safeHandle('file-exists', async (event, p) => {
    if (typeof p !== 'string' || !allowedPaths.has(resolve(p))) return null
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

autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Download Now', 'Later'],
        title: 'Update Available',
        message: `A new version (${info.version}) of Notepad Flux is available. Would you like to download it now?`,
    })
    if (response === 0) {
        autoUpdater.downloadUpdate()
    }
})

autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart and Install', 'Later'],
        title: 'Update Ready',
        message: 'The update has been downloaded and is ready to be installed. Would you like to restart the application now?',
    })
    if (response === 0) {
        autoUpdater.quitAndInstall()
    }
})

autoUpdater.on('error', (err) => {
    console.error('Auto Updater error:', err)
})

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

let win = null
let splash = null

// Menu Close Window / Exit: close from main so guardClose's flush handshake runs.
ipcMain.on('close-window', (event) => BrowserWindow.fromWebContents(event.sender)?.close())

// Close handshake: hold every app window's close until its renderer confirms the
// session snapshot is written (the async encrypt + IndexedDB write can't finish
// inside beforeunload), max 3s. One-shot: a close the page then blocks (dirty
// secondary window -> "Keep editing") re-runs the handshake next time.
const CLOSE_FLUSH_TIMEOUT_MS = 3000
const guardClose = (w) => {
    let ready = false
    let pending = false
    w.on('close', (e) => {
        if (ready) { ready = false; return }
        e.preventDefault()
        if (pending) return
        pending = true
        const done = () => {
            clearTimeout(timer)
            ipcMain.removeListener('close-ready', onReady)
            pending = false
            if (w.isDestroyed()) return
            ready = true
            w.close()
        }
        const onReady = (ev) => { if (ev.sender === w.webContents) done() }
        const timer = setTimeout(() => {
            log.warn('close: renderer did not confirm session flush within 3s; closing anyway')
            done()
        }, CLOSE_FLUSH_TIMEOUT_MS)
        ipcMain.on('close-ready', onReady)
        w.webContents.send('flush-before-close')
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
            if (win && !win.isDestroyed()) win.show()
        }
    }, 15000)

    win = new BrowserWindow({
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

    guardClose(win)
    win.webContents.on('did-create-window', guardClose)

    win.webContents.setWindowOpenHandler(({ url }) => {
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

    win.webContents.on('will-navigate', (event, navigationUrl) => {
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
        if (win && !win.isDestroyed()) win.destroy()
        app.quit()
    })

    Menu.setApplicationMenu(null)


    // Test active push message to Renderer-process
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(join(process.env.DIST, 'index.html'))
    }
}

app.on('window-all-closed', () => {
    win = null
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
    })
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => log.info('quit'))

if (gotTheLock) app.whenReady().then(() => {
    log.info('start', {
        version: app.getVersion(),
        electron: process.versions.electron,
        platform: `${process.platform} ${process.arch}`,
        packaged: app.isPackaged,
        userData: userDataPath,
        safeStorage: safeStorage.isEncryptionAvailable(),
        safeStorageBackend: process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os',
    })
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
        autoUpdater.checkForUpdates().catch(err => {
            console.error('Failed to check for updates:', err)
        })
    }
})
