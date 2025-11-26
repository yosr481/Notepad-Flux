/**
 * File System Access API Wrapper
 * Handles file operations for the browser environment.
 */

export const fileSystem = {
    /**
     * Open a file using the browser's file picker.
     * @returns {Promise<{handle: FileSystemFileHandle, content: string, name: string}|null>}
     */
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
            if (err.name === 'AbortError') {
                return null; // User cancelled
            }
            console.error('Error opening file:', err);
            throw err;
        }
    },

    /**
     * Save content to an existing file handle.
     * @param {FileSystemFileHandle} handle 
     * @param {string} content 
     */
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

    /**
     * Save content to a new file using the save file picker.
     * @param {string} content 
     * @param {string} suggestedName 
     * @returns {Promise<{handle: FileSystemFileHandle, name: string}|null>}
     */
    saveFileAs: async (content, suggestedName = 'Untitled.txt') => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName,
                types: [
                    {
                        description: 'Text File',
                        accept: { 'text/plain': ['.txt', '.md'] },
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
    }
};
