import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join, resolve, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { platform } from 'node:process'

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Store allowed paths that the user has explicitly opened or saved via dialogs
const allowedPaths = new Set()

// Set userData directory to platform-specific persistent path before app is ready
const getPersistentDataPath = () => {
    const home = homedir()
    if (platform === 'win32') {
        // Windows: %userprofile%\AppData\LocalLow\Notepad Flux
        return join(home, 'AppData', 'LocalLow', 'Notepad Flux')
    } else {
        // Linux: ~/.config/notepad-flux
        return join(home, '.config', 'notepad-flux')
    }
}

const userDataPath = getPersistentDataPath()
app.setPath('userData', userDataPath)
allowedPaths.add(resolve(userDataPath))

/**
 * Validates if a path is safe to access.
 * 1. Must be absolute.
 * 2. Must not contain traversal segments (..).
 * 3. Should be in the allowedPaths set (files explicitly opened/saved by user).
 */
const isPathSafe = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false
    
    const resolvedPath = resolve(filePath)
    
    // Check if it's absolute and normalized (no ..)
    if (!isAbsolute(resolvedPath) || filePath.includes('..')) return false

    // Check if it's in the allowed paths or a subdirectory of an allowed path
    for (const allowed of allowedPaths) {
        if (resolvedPath === allowed || resolvedPath.startsWith(allowed + sep)) {
            return true
        }
    }
    
    return false
}

// Helper for safe IPC handling
const safeHandle = (channel, handler) => {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args)
        } catch (error) {
            console.error(`Error in IPC handler for ${channel}:`, error)
            // Return a generic error message to the renderer
            throw new Error('An internal system error occurred. Please try again.')
        }
    })
}

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
})
