/**
 * Turn an opened file ({ name, content, handle }, as returned by
 * fileSystem.openFile/openFileFromPath/openFileFromHandle/openDroppedFile)
 * into a new tab, and record it in Recent Files. Single home for the
 * createTab literal that used to be hand-built at each open call site.
 */
export function openIntoTab(file, { createTab, addRecentFile }) {
    createTab({
        title: file.name,
        content: file.content,
        filePath: file.name,
        fileHandle: file.handle,
        isDirty: false,
    });
    addRecentFile?.(file.name, file.name, file.handle);
}
