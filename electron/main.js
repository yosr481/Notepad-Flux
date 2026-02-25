import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, resolve, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { platform } from 'node:process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const allowedPaths = new Set()

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
allowedPaths.add(resolve(userDataPath))

const isPathSafe = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false

    const resolvedPath = resolve(filePath)

    if (!isAbsolute(resolvedPath) || filePath.includes('..')) return false

    for (const allowed of allowedPaths) {
        if (resolvedPath === allowed || resolvedPath.startsWith(allowed + sep)) {
            return true
        }
    }

    return false
}

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
    return { filePath }
})


// --------- Auto Updater ---------
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

autoUpdater.on('update-downloaded', async (info) => {
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

function createWindow() {
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
        if (url.startsWith('http')) {
            shell.openExternal(url)
            return { action: 'deny' }
        }
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

    win.once('ready-to-show', () => {
        win.show()
        if (splash) {
            splash.close()
        }
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

app.whenReady().then(() => {
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
