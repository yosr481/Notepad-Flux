import { useEffect } from 'react';
import { fileSystem } from '../utils/fileSystem';

export const openDroppedFiles = async (fileList, deps) => {
    const { createTab, showToast } = deps;

    if (!fileList || typeof fileList[Symbol.iterator] !== 'function') {
        return;
    }

    for (const file of fileList) {
        try {
            if (file.path) {
                // Electron file
                await fileSystem.authorizePaths([file.path]);
                const { content, name } = await fileSystem.openFileFromPath(file.path);
                createTab({
                    title: name,
                    content,
                    filePath: file.path,
                    fileHandle: file.path,
                    isDirty: false,
                });
            } else {
                // Web file
                const content = await file.text();
                createTab({
                    title: file.name,
                    content,
                    filePath: file.name,
                    fileHandle: null,
                    isDirty: false,
                });
            }
        } catch (err) {
            showToast?.(`Could not open "${file.name || 'file'}": ${err?.message || 'unknown error'}`);
        }
    }
};

export const useFileDrop = (deps) => {
    const { createTab, showToast } = deps;

    useEffect(() => {
        const handleDragOver = (e) => {
            e.preventDefault();
        };

        const handleDrop = (e) => {
            e.preventDefault();
            openDroppedFiles(e.dataTransfer?.files ?? [], { createTab, showToast });
        };

        window.addEventListener('dragover', handleDragOver, { capture: true });
        window.addEventListener('drop', handleDrop, { capture: true });

        return () => {
            window.removeEventListener('dragover', handleDragOver, { capture: true });
            window.removeEventListener('drop', handleDrop, { capture: true });
        };
    }, [createTab, showToast]);
};
