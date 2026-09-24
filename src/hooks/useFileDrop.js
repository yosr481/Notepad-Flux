import { useEffect } from 'react';
import { fileSystem } from '../utils/fileSystem';

export const openDroppedFiles = async (fileList, deps) => {
    const { createTab, showToast } = deps;

    if (!fileList || typeof fileList[Symbol.iterator] !== 'function') {
        return;
    }

    for (const file of fileList) {
        try {
            const dropped = await fileSystem.openDroppedFile(file);
            if (dropped) {
                // Electron file: main read it and granted the path.
                createTab({
                    title: dropped.name,
                    content: dropped.content,
                    filePath: dropped.name,
                    fileHandle: dropped.handle,
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
        // Only file drops are ours. Text drags (moving a selection inside the
        // editor, dropping text from another app) must reach CodeMirror, which
        // skips its own drop handling once defaultPrevented is set.
        const hasFiles = (e) => !!e.dataTransfer?.types?.includes('Files');

        const handleDragOver = (e) => {
            if (hasFiles(e)) e.preventDefault();
        };

        const handleDrop = (e) => {
            if (!hasFiles(e)) return;
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
