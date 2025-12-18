import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { platform } from 'node:process'

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

app.setPath('userData', getPersistentDataPath())

ipcMain.handle('read-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    })
    if (canceled) return { canceled }
    const content = await readFile(filePaths[0], 'utf-8')
    return { canceled, filePath: filePaths[0], content }
})

ipcMain.handle('read-file-content', async (event, filePath) => {
    try {
        const content = await readFile(filePath, 'utf-8')
        return content
    } catch (e) {
        throw e
    }
})

ipcMain.handle('save-file', async (event, { filePath, content }) => {
    if (!filePath) {
        const { canceled, filePath: savePath } = await dialog.showSaveDialog({
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
        })
        if (canceled) return { canceled: true }
        filePath = savePath
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
