// Is a URL the app's own page? Pure ESM (no electron import) so it can be unit tested.
// The only pages that may get an app window with the preload bridge are the Vite dev
// server (dev) and the packaged index.html (prod). Any other file: URL is a local file
// the page asked for, and giving it a bridged window would hand it the file IPC.
import { fileURLToPath } from 'node:url'
import { posix, win32 } from 'node:path'

export function isAppPage(url, { devUrl, indexPath, platform }) {
    if (typeof url !== 'string') return false
    if (devUrl && url.startsWith(devUrl)) return true
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'file:') return false
        // fileURLToPath drops the hash and query, decodes %20, and gives a native path
        const windows = platform === 'win32'
        const path = windows ? win32 : posix   // explicit, so the Windows rule is testable on Linux
        const requested = path.resolve(fileURLToPath(parsed, { windows }))
        const own = path.resolve(indexPath)
        return windows ? requested.toLowerCase() === own.toLowerCase() : requested === own
    } catch {
        return false
    }
}
