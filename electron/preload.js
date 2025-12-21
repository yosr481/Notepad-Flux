import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
    readFile: () => ipcRenderer.invoke('read-file'),
    readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    onMainMessage: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('main-process-message', subscription);
        return () => ipcRenderer.removeListener('main-process-message', subscription);
    }
})
