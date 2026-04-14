import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
    readFile: () => ipcRenderer.invoke('read-file'),
    readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
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
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        download: () => ipcRenderer.invoke('updater:download'),
        install: () => ipcRenderer.invoke('updater:install'),
        onEvents: (handlers) => {
            const subscriptions = []

            if (handlers.onChecking) {
                const handler = () => handlers.onChecking()
                ipcRenderer.on('updater:checking', handler)
                subscriptions.push(['updater:checking', handler])
            }

            if (handlers.onUpdateAvailable) {
                const handler = (event, info) => handlers.onUpdateAvailable(info)
                ipcRenderer.on('updater:available', handler)
                subscriptions.push(['updater:available', handler])
            }

            if (handlers.onUpdateNotAvailable) {
                const handler = (event) => handlers.onUpdateNotAvailable()
                ipcRenderer.on('updater:not-available', handler)
                subscriptions.push(['updater:not-available', handler])
            }

            if (handlers.onDownloadProgress) {
                const handler = (event, progress) => handlers.onDownloadProgress(progress)
                ipcRenderer.on('updater:progress', handler)
                subscriptions.push(['updater:progress', handler])
            }

            if (handlers.onUpdateDownloaded) {
                const handler = (event, info) => handlers.onUpdateDownloaded(info)
                ipcRenderer.on('updater:downloaded', handler)
                subscriptions.push(['updater:downloaded', handler])
            }

            if (handlers.onError) {
                const handler = (event, error) => handlers.onError(error)
                ipcRenderer.on('updater:error', handler)
                subscriptions.push(['updater:error', handler])
            }

            return () => {
                subscriptions.forEach(([channel, handler]) => {
                    ipcRenderer.removeListener(channel, handler)
                })
            }
        }
    }
})
