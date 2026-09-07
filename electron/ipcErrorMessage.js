// Convert an IPC error into a user-facing message. Pure (no electron import)
// so it can be unit-tested; electron/main.js's safeHandle wrapper uses it to
// return meaningful strings instead of a generic fallback for all errors.

const GENERIC = 'An internal system error occurred. Please try again.'

export function toUserMessage(error) {
    // Non-object or null/undefined → generic fallback
    if (!error || typeof error !== 'object') {
        return GENERIC
    }

    const { message, code } = error

    // Message-based checks (exact and substring, in priority order)
    if (message === 'Not a text file.') {
        return 'Not a text file.'
    }

    if (typeof message === 'string') {
        // Case-insensitive substring check
        if (message.toLowerCase().includes('unauthorized file path')) {
            return 'That file path is not authorized.'
        }
        // Case-sensitive substring check (tests don't require case-insensitivity)
        if (message.includes('Safe storage is not available')) {
            return 'Secure storage is unavailable on this system.'
        }
    }

    // Code-based checks (only if message-based checks didn't match)
    if (code === 'EACCES') {
        return 'Permission denied.'
    }
    if (code === 'ENOENT') {
        return 'File not found.'
    }
    if (code === 'EISDIR') {
        return 'That is a folder, not a file.'
    }

    // Unrecognized code or no code → generic fallback
    return GENERIC
}
