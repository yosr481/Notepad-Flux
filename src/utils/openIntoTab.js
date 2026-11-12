import { detectCharset, applyCharset } from './eol';

/**
 * Turn an opened file ({ name, content, handle }, as returned by
 * fileSystem.openFile/openFileFromPath/openFileFromHandle/openDroppedFile)
 * into a new tab, and record it in Recent Files. Single home for the
 * createTab literal that used to be hand-built at each open call site.
 *
 * Strips a leading UTF-8 BOM from the content that reaches the CM doc (it
 * was never stripped before — the doc showed a stray leading char and
 * inflated word/char counts). tab.charset still records 'UTF-8 BOM' so
 * useCommands' toDiskContent() re-applies it on save — round-trips without
 * doubling, same as before, just no longer visible in the editor.
 */
export function openIntoTab(file, { createTab, addRecentFile }) {
    const charset = detectCharset(file.content);
    createTab({
        title: file.name,
        content: applyCharset(file.content, 'UTF-8'),
        filePath: file.name,
        fileHandle: file.handle,
        isDirty: false,
        charset,
    });
    addRecentFile?.(file.name, file.name, file.handle);
}
