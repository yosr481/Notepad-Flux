/**
 * Pure functions for detecting and normalizing line endings and character sets.
 * Line endings are stored internally as LF; these helpers convert to/from disk format.
 */

/**
 * Detect line ending style from content.
 * @param {*} content - Text content (any type; non-strings → 'LF')
 * @returns {'CRLF' | 'LF'} - 'CRLF' if content contains \\r\\n, else 'LF'
 */
export function detectEol(content) {
    if (typeof content !== 'string') return 'LF';
    return content.includes('\r\n') ? 'CRLF' : 'LF';
}

/**
 * Normalize line endings to the target style.
 * Handles mixed content safely: collapses first, then converts.
 * @param {string} content - Text content (any type treated as no-op LF)
 * @param {string} eol - Target: 'CRLF' (exact, case-sensitive) or anything else → 'LF'
 * @returns {string} - Normalized content; lone \\r left untouched
 */
export function normalizeEol(content, eol) {
    if (typeof content !== 'string') return content;

    if (eol === 'CRLF') {
        // Collapse all line breaks to LF first (prevents \\r\\r\\n from mixed input)
        return content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    }

    // All other targets: collapse \\r\\n to \\n only (LF mode)
    return content.replace(/\r\n/g, '\n');
}

/**
 * Detect character set encoding from content.
 * @param {*} content - Text content (any type; non-strings → 'UTF-8')
 * @returns {'UTF-8 BOM' | 'UTF-8'} - 'UTF-8 BOM' if starts with U+FEFF, else 'UTF-8'
 */
export function detectCharset(content) {
    if (typeof content !== 'string') return 'UTF-8';
    return content.charCodeAt(0) === 0xFEFF ? 'UTF-8 BOM' : 'UTF-8';
}

/**
 * Apply character set encoding to content.
 * Adds or strips exactly one leading U+FEFF based on target.
 * @param {string} content - Text content
 * @param {string} charset - Target: 'UTF-8 BOM' (exact) or anything else → plain 'UTF-8'
 * @returns {string} - Content with BOM added/removed as needed
 */
export function applyCharset(content, charset) {
    if (typeof content !== 'string') return content;

    const hasBom = content.charCodeAt(0) === 0xFEFF;

    if (charset === 'UTF-8 BOM') {
        // Ensure exactly one BOM
        return hasBom ? content : '﻿' + content;
    }

    // All other targets: plain UTF-8 (strip BOM if present)
    return hasBom ? content.slice(1) : content;
}
