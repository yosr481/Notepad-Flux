import { ipcRenderer, contextBridge, webUtils } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
    readFile: () => ipcRenderer.invoke('read-file'),
    readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    fileExists: (p) => ipcRenderer.invoke('file-exists', p),
    safeStorage: {
        isAvailable: () => ipcRenderer.invoke('safe-storage-available'),
        encrypt: (text) => ipcRenderer.invoke('safe-storage-encrypt', text),
        decrypt: (encrypted) => ipcRenderer.invoke('safe-storage-decrypt', encrypted),
    },
    onMainMessage: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('main-process-message', subscription);
        return () => ipcRenderer.removeListener('main-process-message', subscription);
    },
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    closeWindow: () => ipcRenderer.send('close-window'),
    // Main holds a window close until the callback's promise settles (max 3s).
    onCloseRequested: (callback) => {
        const subscription = async () => {
            try { await callback() } finally { ipcRenderer.send('close-ready') }
        };
        ipcRenderer.on('flush-before-close', subscription);
        return () => ipcRenderer.removeListener('flush-before-close', subscription);
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    // Only Windows draws overlay caption buttons over the page (titleBarOverlay);
    // the renderer reserves top-right space for them on that platform only.
    platform: process.platform,
    // Resolve the native path HERE (isolated world) so the page can only open files
    // the user actually dropped; '' for a File built in script -> refused.
    openDroppedFile: (file) => {
        const p = webUtils.getPathForFile(file)
        return p ? ipcRenderer.invoke('open-dropped-file', p) : Promise.reject(new Error('Not a dropped file.'))
    },
})
