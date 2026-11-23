// Launch helper for the packaged-app e2e: a fresh userData per launch (or a shared one for relaunch tests).
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diag } from './harness.mjs'

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
    // Stderr + stdout tail for diag(). electron.launch returns only once the app is started and its stderr is read inside Playwright, so
    // this listener cannot see startup output (a failed launch has it in the error's call log instead); the label says so.
    const errTail = ['(stderr from after electron.launch returned; startup output is not available here)']; app._nfStderr = errTail; app._nfUserData = userData
    for (const [stream, tag] of [['stderr', ''], ['stdout', '[out] ']]) app.process()[stream]?.on('data', d => { for (const x of String(d).split('\n')) if (x.trim()) errTail.push(tag + x.slice(0, 300)); if (errTail.length > 80) errTail.splice(1, errTail.length - 80) })
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
        // B17: which preload path was the app given, and is the file there? (main.js builds it from DIST_ELECTRON; fs reads asar.)
        const preload = await Promise.race([app.evaluate(() => { const f = require('node:path').join(process.env.DIST_ELECTRON, 'preload.cjs'); return `${f} exists=${require('node:fs').existsSync(f)}` }), new Promise(r => setTimeout(() => r('(app.evaluate timed out after 5 s)'), 5000))]).catch(e => '(could not ask the app: ' + String(e.message).split('\n')[0] + ')')
        diag('no window exposed window.electronAPI; windows=' + JSON.stringify(urls), { userData, app, preload })
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
