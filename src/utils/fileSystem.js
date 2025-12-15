/**
 * File System Access API Wrapper with fallback for unsupported browsers
 * Handles file operations for the browser environment.
 */

// --- Drivers ---

const WebNativeDriver = {
    isSupported: () => 'showOpenFilePicker' in window && 'showSaveFilePicker' in window,

    openFile: async () => {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'Text Files',
                        accept: {
                            'text/plain': ['.txt', '.md', '.markdown', '.js', '.jsx', '.json', '.css', '.html'],
                        },
                    },
                ],
                multiple: false,
            });

            const file = await handle.getFile();
            const content = await file.text();

            return {
                handle,
                content,
                name: file.name
            };
        } catch (err) {
            if (err.name === 'AbortError') return null;
            console.error('Error opening file:', err);
            throw err;
        }
    },

    saveFile: async (handle, content) => {
        try {
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (err) {
            console.error('Error saving file:', err);
            throw err;
        }
    },

    saveFileAs: async (content, suggestedName) => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName,
                types: [
                    {
                        description: 'Markdown File',
                        accept: { 'text/markdown': ['.md'] },
                    },
                    {
                        description: 'Text File',
                        accept: { 'text/plain': ['.txt'] },
                    },
                ],
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

            return {
                handle,
                name: handle.name
            };
        } catch (err) {
            if (err.name === 'AbortError') return null;
            console.error('Error saving file as:', err);
            throw err;
        }
    },

    exportFile: async (content, suggestedName, types) => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName,
                types,
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

            return {
                handle,
                name: handle.name
            };
        } catch (err) {
            if (err.name === 'AbortError') return null;
            console.error('Error exporting file:', err);
            throw err;
        }
    },

    openFileFromHandle: async (handle) => {
        try {
            const file = await handle.getFile();
            const content = await file.text();
            return {
                handle,
                content,
                name: file.name
            };
        } catch (err) {
            console.error('Error opening file from handle:', err);
            throw err;
        }
    },

    openFileFromPath: async () => {
        // Not supported for WebNativeDriver without a picker
        return null;
    }
};

const WebFallbackDriver = {
    // Helpers
    createFileInput: (accept = '*') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        document.body.appendChild(input);
        return input;
    },

    downloadFile: (content, filename) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Interface Implementation
    isSupported: () => true, // Always supported as fallback

    openFile: async () => {
        return new Promise((resolve) => {
            const input = WebFallbackDriver.createFileInput('.txt,.md,.markdown,.js,.jsx,.json,.css,.html');

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const content = await file.text();
                    resolve({
                        handle: null,
                        content,
                        name: file.name
                    });
                } else {
                    resolve(null);
                }
                document.body.removeChild(input);
            };

            input.oncancel = () => {
                resolve(null);
                document.body.removeChild(input);
            };

            input.click();
        });
    },

    saveFile: async (handle, content) => {
        throw new Error('Cannot save to existing file in fallback mode');
    },

    saveFileAs: async (content, suggestedName) => {
        WebFallbackDriver.downloadFile(content, suggestedName);
        return {
            handle: null,
            name: suggestedName
        };
    },

    exportFile: async (content, suggestedName, types) => {
        WebFallbackDriver.downloadFile(content, suggestedName);
        return {
            handle: null,
            name: suggestedName
        };
    },

    openFileFromHandle: async (handle) => {
        throw new Error('Cannot open from handle in fallback mode');
    },

    openFileFromPath: async () => {
        // Not supported for WebFallbackDriver
        return null;
    }
};

// --- Main Export ---

const ElectronDriver = {
    isSupported: () => !!window.ipcRenderer,

    openFile: async () => {
        try {
            const result = await window.ipcRenderer.invoke('read-file');
            if (result.canceled) return null;

            const name = result.filePath.replace(/^.*[\\/]/, '');
            return {
                handle: result.filePath,
                content: result.content,
                name
            };
        } catch (err) {
            console.error('Electron open error:', err);
            throw err;
        }
    },

    saveFile: async (handle, content) => {
        await window.ipcRenderer.invoke('save-file', { filePath: handle, content });
    },

    saveFileAs: async (content, suggestedName) => {
        const result = await window.ipcRenderer.invoke('save-file', { content });
        if (result.canceled) return null;

        const name = result.filePath.replace(/^.*[\\/]/, '');
        return {
            handle: result.filePath,
            name
        };
    },

    exportFile: async (content, suggestedName, types) => {
        return ElectronDriver.saveFileAs(content, suggestedName);
    },

    openFileFromHandle: async (handle) => {
        const content = await window.ipcRenderer.invoke('read-file-content', handle);
        const name = handle.replace(/^.*[\\/]/, '');
        return {
            handle,
            content,
            name
        };
    },

    openFileFromPath: async (filePath) => {
        try {
            const content = await window.ipcRenderer.invoke('read-file-content', filePath);
            const name = filePath.replace(/^.*[\\/]/, '');
            return {
                handle: filePath,
                content,
                name
            };
        } catch (err) {
            console.error('Electron open file from path error:', err);
            throw err;
        }
    }
};

const getDriver = () => {
    if (window.ipcRenderer) return ElectronDriver;

    if (WebNativeDriver.isSupported()) {
        return WebNativeDriver;
    }
    return WebFallbackDriver;
};

export const fileSystem = {
    isSupported: () => WebNativeDriver.isSupported(),

    openFile: () => getDriver().openFile(),

    saveFile: (handle, content) => getDriver().saveFile(handle, content),

    saveFileAs: (content, suggestedName) => getDriver().saveFileAs(content, suggestedName),

    exportFile: (content, suggestedName, types) => getDriver().exportFile(content, suggestedName, types),

    openFileFromHandle: (handle) => getDriver().openFileFromHandle(handle),

};
