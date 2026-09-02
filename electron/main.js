import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { platform } from 'node:process'
import { createIsPathSafe } from './pathSafety.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ponytail: allowedPaths grows unbounded for the process lifetime (one entry per
// picked file). Ceiling is fine for a desktop notepad session; upgrade path is
// per-session pruning (drop a path when its tab closes) if it ever matters.
const allowedPaths = new Set()

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
    const home = homedir()
    if (platform === 'win32') {
        return join(home, 'AppData', 'LocalLow', 'Notepad Flux')
    } else {
        return join(home, '.config', 'notepad-flux')
    }
}

const userDataPath = getPersistentDataPath()
app.setPath('userData', userDataPath)

const isPathSafe = createIsPathSafe({ allowedPaths, realpath: realpathSync })

const safeHandle = (channel, handler) => {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args)
        } catch (error) {
            console.error(`Error in IPC handler for ${channel}:`, error)
            throw new Error('An internal system error occurred. Please try again.', { cause: error })
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
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    })
    if (canceled) return { canceled }

    const filePath = filePaths[0]
    allowedPaths.add(resolve(filePath))

    const content = await readFile(filePath, 'utf-8')
    return { canceled, filePath, content }
})

safeHandle('read-file-content', async (event, filePath) => {
    // ponytail: isPathSafe realpath-checks filePath, then readFile re-resolves the
    // raw path - a symlink swapped in between the two is a TOCTOU race. Local
    // attacker only; fully closing it means readFile'ing the realpath'd result,
    // which the new-file save path has no value for. Left as a known corner.
    if (!isPathSafe(filePath)) {
        throw new Error('Access denied: Unauthorized file path.')
    }
    return await readFile(filePath, 'utf-8')
})

safeHandle('save-file', async (event, { filePath, content }) => {
    if (!filePath) {
        const { canceled, filePath: savePath } = await dialog.showSaveDialog({
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
        })
        if (canceled) return { canceled: true }
        filePath = savePath
        allowedPaths.add(resolve(filePath))
    } else if (!isPathSafe(filePath)) {
        throw new Error('Access denied: Unauthorized file path.')
    }

    await writeFile(filePath, content, 'utf-8')
    return { filePath, canceled: false }
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
// │ └── preload.js
//
process.env.DIST_ELECTRON = join(__dirname, '../dist-electron')
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(__dirname, '../public')
    : process.env.DIST

let win = null
let splash = null

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
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#00000000', // Transparent background
            symbolColor: '#64748b', // Slate-500 matches UI usually, or use theme color
            height: 40 // Match tab height
        },
        backgroundMaterial: 'mica',
        icon: join(process.env.VITE_PUBLIC, 'icons/desktop/icon.png'),
        webPreferences: {
            preload: join(process.env.DIST_ELECTRON, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
        const devUrl = process.env.VITE_DEV_SERVER_URL
        const isOwnOrigin = (devUrl && url.startsWith(devUrl)) || url.startsWith('file:')

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
                titleBarStyle: 'hidden',
                titleBarOverlay: {
                    color: '#00000000',
                    symbolColor: '#64748b',
                    height: 40
                },
                backgroundMaterial: 'mica',
                icon: join(process.env.VITE_PUBLIC, 'icons/desktop/icon.png'),
                webPreferences: {
                    preload: join(process.env.DIST_ELECTRON, 'preload.js'),
                    sandbox: true,
                }
            }
        }
    })

    win.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl)
        const isDev = !!process.env.VITE_DEV_SERVER_URL
        if (isDev && navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL)) {
            return
        }
        if (parsedUrl.protocol === 'file:') {
            return
        }
        event.preventDefault()
        shell.openExternal(navigationUrl)
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

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

if (gotTheLock) app.whenReady().then(() => {
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
