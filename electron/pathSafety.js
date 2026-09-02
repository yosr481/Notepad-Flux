import { resolve, dirname, isAbsolute, sep } from 'node:path'

export function createIsPathSafe({ allowedPaths, realpath }) {
    return (filePath) => {
        // Check 1: Not a string or falsy (before any fs call)
        if (!filePath || typeof filePath !== 'string') return false

        // Check 2: Lexical guard on the ORIGINAL filePath (before any fs call)
        if (!isAbsolute(filePath) || filePath.includes('..')) return false

        // Check 3: Canonicalise the request
        let real
        try {
            real = realpath(resolve(filePath))
        } catch {
            // ENOENT: filePath doesn't exist (e.g. new file for save-file)
            // Fall back to parent directory's realpath
            try {
                real = realpath(resolve(dirname(resolve(filePath))))
            } catch {
                // Parent also doesn't exist
                return false
            }
        }

        // Check 4: Match loop — for each allowed entry
        for (const allowed of allowedPaths) {
            let allowedReal
            try {
                allowedReal = realpath(allowed)
            } catch {
                // Stale entry (deleted since being added) — skip, no crash
                continue
            }

            // Match if exact or within the allowed tree (with sep boundary)
            if (real === allowedReal || real.startsWith(allowedReal + sep)) {
                return true
            }
        }

        // Check 5: No match or empty allowlist
        return false
    }
}
