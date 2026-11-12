import { resolve, isAbsolute } from 'node:path'
import { hasDotDotSegment } from './pathSafety.js'

// Filter a renderer-supplied list of persisted file paths (restored tabs +
// recent files) down to the ones safe to re-add to the main-process allowlist
// on launch. Same lexical guard as pathSafety Check 2 — absolute, no '..' segment — so
// junk never enters the set. Pure (no electron import) for unit testing;
// electron/main.js's authorize-paths handler uses it.
export function filterAuthorizablePaths(paths) {
    if (!Array.isArray(paths)) return []
    const out = []
    for (const p of paths) {
        if (typeof p === 'string' && p && isAbsolute(p) && !hasDotDotSegment(p)) {
            out.push(resolve(p))
        }
    }
    return out
}
