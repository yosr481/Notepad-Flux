// Launch helper for the packaged-app e2e: a fresh userData per launch (or a shared one for relaunch tests).
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const mkTmp = (p) => mkdtempSync(join(tmpdir(), p))

// extraArgs: e.g. ['--no-sandbox']. Returns { app, win }.
export async function launch({ binary, userData, extraArgs = [], env = {}, prefix = [] }) {
    const xdg = env.XDG_CONFIG_HOME ?? mkdtempSync(join(tmpdir(), 'nf-xdg-'))
    const app = await electron.launch({
        executablePath: binary,
        args: [...prefix, ...extraArgs],
        // XDG_CONFIG_HOME: private per launch. Since 166b8cd the single-instance lock follows NOTEPAD_FLUX_USER_DATA,
        // so this only keeps the *default* profile location (used when no override is set) off the user's real config.
        env: { ...(userData ? process.env : Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NOTEPAD_FLUX_USER_DATA'))), DISPLAY: process.env.DISPLAY, XDG_CONFIG_HOME: xdg, ...(userData ? { NOTEPAD_FLUX_USER_DATA: userData } : {}), ...env },
        timeout: 60000, chromiumSandbox: !extraArgs.includes("--no-sandbox"),
    })
    let win
    const deadline = Date.now() + 30000
    while (Date.now() < deadline && !win) {
        for (const w of app.windows()) {
            try {
                await w.waitForLoadState('domcontentloaded', { timeout: 3000 })
                if (await w.evaluate(() => !!window.electronAPI)) { win = w; break }
            } catch { /* splash may close */ }
        }
        if (!win) await new Promise(r => setTimeout(r, 300))
    }
    if (!win) {
        const urls = app.windows().map(w => w.url())
        await app.close().catch(() => {})
        throw new Error('no window exposed window.electronAPI; windows=' + JSON.stringify(urls))
    }
    return { app, win, xdg }
}

export const stubOpen = (app, paths) => app.evaluate(({ dialog }, ps) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ps })
}, paths)
export const stubSave = (app, p) => app.evaluate(({ dialog }, pp) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: pp })
}, p)
