// Save-dialog filter sets keyed off a suggested filename's extension.
// Pure (no electron import) so it can be unit-tested; electron/main.js's
// save-file handler uses it instead of a hardcoded Markdown-only filter.

const ALL_FILES = { name: 'All Files', extensions: ['*'] }

const BY_EXT = {
    pdf: { name: 'PDF Document', extensions: ['pdf'] },
    html: { name: 'HTML Document', extensions: ['html', 'htm'] },
    htm: { name: 'HTML Document', extensions: ['html', 'htm'] },
    md: { name: 'Markdown', extensions: ['md', 'markdown'] },
    markdown: { name: 'Markdown', extensions: ['md', 'markdown'] },
    txt: { name: 'Text', extensions: ['txt'] },
}

export function filtersForName(name) {
    if (typeof name !== 'string') return [ALL_FILES]
    const dot = name.lastIndexOf('.')
    if (dot < 0 || dot === name.length - 1) return [ALL_FILES]
    const ext = name.slice(dot + 1).toLowerCase()
    const match = BY_EXT[ext]
    return match ? [match, ALL_FILES] : [ALL_FILES]
}
