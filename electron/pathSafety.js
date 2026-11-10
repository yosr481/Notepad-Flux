import { posix, win32 } from 'node:path'

// The one place that decides when two paths are "the same": Windows paths are case- and
// separator-insensitive (C:\Dir\a.md == c:/dir/A.MD), every other platform is exact.
// Platform is a parameter so the win32 rule is testable on Linux.
export const pathKey = (p, platform = process.platform) =>
    platform === 'win32' ? p.replace(/\//g, '\\').toLowerCase() : p

// True when any path SEGMENT is exactly '..' (either separator). 'notes..md' is fine.
export const hasDotDotSegment = (p) => p.split(/[\\/]/).includes('..')

// grantedReal (optional Map: allowed entry -> real path captured when it was granted).
// An entry found there is matched against that frozen real path, so replacing a
// granted file with a symlink later does not move the grant. Entries without one
// (legacy / tests) are realpath()ed at check time as before.
export function createIsPathSafe({ allowedPaths, realpath, grantedReal, platform = process.platform }) {
    const { resolve, dirname, isAbsolute, sep } = platform === 'win32' ? win32 : posix
    const key = (p) => pathKey(p, platform)
    return (filePath) => {
        // Check 1: Not a string or falsy (before any fs call)
        if (!filePath || typeof filePath !== 'string') return false

        // Check 2: Lexical guard on the ORIGINAL filePath (before any fs call)
        if (!isAbsolute(filePath) || hasDotDotSegment(filePath)) return false

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
            let allowedReal = grantedReal?.get(allowed)
            if (!allowedReal) {
                try {
                    allowedReal = realpath(allowed)
                } catch {
                    // Stale entry (deleted since being added) — skip, no crash
                    continue
                }
            }

            // Match if exact or within the allowed tree (with sep boundary)
            const r = key(real)
            const a = key(allowedReal)
            if (r === a || r.startsWith(a + sep)) {
                return true
            }
        }

        // Check 5: No match or empty allowlist
        return false
    }
}
