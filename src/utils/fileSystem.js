/**
 * File System Access API Wrapper with fallback for unsupported browsers
 * Handles file operations for the browser environment.
 */

// Conditional import of path module (only available in Electron/Node.js)
let path = null;
try {
    path = require('path');
} catch (e) {
    // path module not available (web environment)
}

// --- Utilities ---

/**
 * Sanitize filename by removing/replacing invalid characters
 * Handles Windows, macOS, and Linux invalid characters
 * @param {string} filename - The filename to sanitize
 * @returns {string} - The sanitized filename
 */
export const sanitizeFilename = (filename) => {
    // Invalid characters on Windows, macOS, and Linux
    const invalidChars = /[<>:"|?*\x00-\x1f]/g;
    
    // Replace invalid chars with underscore
    let sanitized = filename.replace(invalidChars, '');
    
    // Remove leading/trailing dots and spaces (Windows reserved)
    sanitized = sanitized.replace(/^\.+|\.+$|^ +| +$/g, '');
    
    // Prevent reserved names (Windows)
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
    if (reserved.test(sanitized)) {
        sanitized = `_${sanitized}`;
    }
    
    return sanitized || 'untitled';
};

/**
 * Extract filename from full file path using Path API (Electron) or fallback
 * @param {string} filePath - The full file path
 * @returns {string} - Just the filename
 */
export const getFilenameFromPath = (filePath) => {
    if (typeof filePath === 'string') {
        // Use path.basename if available (Electron), otherwise use web fallback
        return path ? path.basename(filePath) : filePath.split(/[\\/]/).pop();
    }
    return filePath;
};

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
            const cleanName = sanitizeFilename(suggestedName);
            const handle = await window.showSaveFilePicker({
                suggestedName: cleanName,
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
            const cleanName = sanitizeFilename(suggestedName);
            const handle = await window.showSaveFilePicker({
                suggestedName: cleanName,
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
        const cleanName = sanitizeFilename(suggestedName);
        WebFallbackDriver.downloadFile(content, cleanName);
        return {
            handle: null,
            name: cleanName
        };
    },

    exportFile: async (content, suggestedName, types) => {
        const cleanName = sanitizeFilename(suggestedName);
        WebFallbackDriver.downloadFile(content, cleanName);
        return {
            handle: null,
            name: cleanName
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

            const name = getFilenameFromPath(result.filePath);
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
        const cleanName = sanitizeFilename(suggestedName);
        const result = await window.ipcRenderer.invoke('save-file', { content, suggestedName: cleanName });
        if (result.canceled) return null;

        const name = getFilenameFromPath(result.filePath);
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
        const name = getFilenameFromPath(handle);
        return {
            handle,
            content,
            name
        };
    },

    openFileFromPath: async (filePath) => {
        try {
            const content = await window.ipcRenderer.invoke('read-file-content', filePath);
            const name = getFilenameFromPath(filePath);
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
