import { resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterAuthorizablePaths } from './authorizePaths.js'

// File paths from a launch's argv: what the OS default-app handler (GNOME passes
// file:// URIs through %U) or a terminal asked us to open. Pure: no disk access;
// main checks existence and reads through readAndGrant.
export function filesFromArgv(argv, { cwd, defaultApp } = {}) {
    if (!Array.isArray(argv)) return []
    const out = []
    for (const arg of argv.slice(defaultApp ? 2 : 1)) {
        if (typeof arg !== 'string' || !arg || arg.startsWith('-')) continue
        let p = arg
        if (/^file:\/\//i.test(arg)) {
            try { p = fileURLToPath(arg) } catch { continue } // other host, encoded slash, bad escape
        } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(arg)) {
            continue // http(s), ftp, custom schemes: not files
        } else if (!isAbsolute(arg)) {
            // Relative (and Windows C:x) from the launch's dir. Absolute is left raw so the
            // '..' check below still sees it.
            // ponytail: Windows root-relative \x counts as absolute and lands on main's drive,
            // not the launching shell's; Explorer always passes full paths.
            p = resolve(cwd || process.cwd(), arg)
        }
        for (const ok of filterAuthorizablePaths([p])) if (!out.includes(ok)) out.push(ok)
    }
    return out
}
