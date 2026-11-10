// UI + main-process helpers for the packaged app.
import { sleep, waitFor } from './harness.mjs'

export const tabsInfo = (win) => win.evaluate(() =>
    [...document.querySelectorAll('[class*=tabsList] > div')].map(t => ({
        title: t.querySelector('[class*=tabTitle]')?.innerText.trim(),
        active: /_activeTab_/.test(t.className),
        dirty: !!t.querySelector('[class*=dirtyIndicator]'),
        missing: !!t.querySelector('[data-testid=tab-file-missing]'),
        w: Math.round(t.getBoundingClientRect().width),
    })))
export const activeTitle = async (win) => (await tabsInfo(win)).find(t => t.active)?.title
export const status = (win) => win.evaluate(() => [...document.querySelector('[class*=statusBar]').children].map(c => c.innerText.trim()))
export const editorText = (win) => win.evaluate(() => document.querySelector('.cm-content')?.innerText ?? '')
export const toastText = (win) => win.evaluate(() => [...document.querySelectorAll('[class*=toast]')].map(t => t.innerText).join(' | '))
export const waitToast = (win, re, timeout = 6000) =>
    waitFor(async () => { const t = await toastText(win); return re.test(t) ? t : false }, { timeout, what: `toast ${re}` })

export const focusEditor = async (win) => { await win.locator(".cm-content").click({ timeout: 5000 }); await win.keyboard.press("Control+End") }
export const typeAtEnd = async (win, text) => { await focusEditor(win); await win.keyboard.type(text) }

// Open through the real Ctrl+O -> IPC read-file path with the native dialog stubbed.
export async function openViaDialog(app, win, path) {
    // records how main called the native dialog (parent window, filters, default folder) for OPEN-3
    await app.evaluate(({ dialog }, p) => {
        dialog.showOpenDialog = async (...a) => {
            const o = a.find(x => x && typeof x === 'object' && 'properties' in x) || {}
            globalThis.__openArgs = { hasParent: a.length > 1 && !!a[0] && typeof a[0].getTitle === 'function', filters: (o.filters || []).map(f => f.name + ':' + f.extensions.join('|')), defaultPath: o.defaultPath }
            return { canceled: false, filePaths: [p] }
        }
    }, path)
    const before = (await tabsInfo(win)).length
    await win.keyboard.press('Control+o')
    await sleep(250)
}
export const stubSave = (app, path) => app.evaluate(({ dialog }, p) => {
    globalThis.__saveCalls = 0
    dialog.showSaveDialog = async () => { globalThis.__saveCalls++; return { canceled: false, filePath: p } }
}, path)
export const saveCalls = (app) => app.evaluate(() => globalThis.__saveCalls ?? 0)

// A REAL OS-path drop: CDP drag events carrying native file paths, so Chromium builds
// File objects that webUtils.getPathForFile resolves (same as dropping from a file manager).
export async function dropFiles(win, files, x = 500, y = 300) {
    const cdp = await win.context().newCDPSession(win)
    const data = { items: [], files, dragOperationsMask: 1 }
    for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, x, y, data })
    await cdp.detach().catch(() => {})
}

export async function closeViaX(app) {
    const proc = app.process()
    const exited = new Promise(r => proc.once('exit', r))
    const t0 = Date.now()
    await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && /index\.html/.test(w.webContents.getURL()))
        w?.close()
    }).catch(() => {})
    await Promise.race([exited, sleep(10000)])
    return { exited: proc.exitCode !== null || proc.signalCode !== null, ms: Date.now() - t0 }
}
export const mainWindows = (app) => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL(), visible: w.isVisible(), bg: w.getBackgroundColor() })))
export const toastClear = (win) => waitFor(async () => (await toastText(win)).trim() === '', { timeout: 6000, what: 'toast to clear' }).catch(() => {})
