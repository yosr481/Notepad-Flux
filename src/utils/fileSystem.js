/**
 * File System Access API Wrapper with fallback for unsupported browsers
 * Handles file operations for the browser environment.
 */

// Feature detection
const supportsFileSystemAccess = 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;

// Fallback: Create file input element for traditional file picking
const createFileInput = (accept = '*') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    return input;
};

// Fallback: Trigger download
const downloadFile = (content, filename) => {
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
};

export const fileSystem = {
    /**
     * Open a file using the browser's file picker.
     * @returns {Promise<{handle: FileSystemFileHandle|null, content: string, name: string}|null>}
     */
    openFile: async () => {
        if (supportsFileSystemAccess) {
            // Modern File System Access API
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
                if (err.name === 'AbortError') {
                    return null; // User cancelled
                }
                console.error('Error opening file:', err);
                throw err;
            }
        } else {
            // Fallback for Firefox/Safari
            return new Promise((resolve) => {
                const input = createFileInput('.txt,.md,.markdown,.js,.jsx,.json,.css,.html');

                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const content = await file.text();
                        resolve({
                            handle: null, // No handle in fallback mode
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
        }
    },

    /**
     * Save content to an existing file handle.
     * @param {FileSystemFileHandle|null} handle 
     * @param {string} content 
     */
    saveFile: async (handle, content) => {
        if (supportsFileSystemAccess && handle) {
            try {
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
            } catch (err) {
                console.error('Error saving file:', err);
                throw err;
            }
        } else {
            // No handle or fallback mode - cannot save to existing file
            // This should trigger a "Save As" flow
            throw new Error('Cannot save to existing file in fallback mode');
        }
    },

    /**
     * Save content to a new file using the save file picker.
     * @param {string} content 
     * @param {string} suggestedName 
     * @returns {Promise<{handle: FileSystemFileHandle|null, name: string}|null>}
     */
    saveFileAs: async (content, suggestedName = 'Untitled.md') => {
        if (supportsFileSystemAccess) {
            // Modern File System Access API
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
                if (err.name === 'AbortError') {
                    return null; // User cancelled
                }
                console.error('Error saving file as:', err);
                throw err;
            }
        } else {
            // Fallback: Download the file
            downloadFile(content, suggestedName);
            return {
                handle: null, // No handle in fallback mode
                name: suggestedName
            };
        }
    },

    /**
     * Check if File System Access API is supported
     */
    isSupported: () => supportsFileSystemAccess,

    /**
     * Open a file from a stored file handle
     * @param {FileSystemFileHandle} handle 
     * @returns {Promise<{handle: FileSystemFileHandle, content: string, name: string}|null>}
     */
    openFileFromHandle: async (handle) => {
        if (!handle) return null;
        
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
    }
};
