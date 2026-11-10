// Drives stock CodeMirror (optionally + perLineTextDirection) inside the packaged Electron and records the
// caret sequence for ArrowRight, so RTL-1 can compare the app against its upstream baseline.
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep, waitFor } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export async function stockCaretSequence(app, mode, presses = 22) {
    const dir = mkdtempSync(join(tmpdir(), 'nf-rtl-'))
    await build({ entryPoints: [join(here, 'rtl-control.src.js')], bundle: true, outfile: join(dir, 'b.js'), format: 'iife', nodePaths: [join(here, '../../../node_modules')], logLevel: 'silent' })
    writeFileSync(join(dir, 'i.html'), '<!doctype html><meta charset="utf-8"><body><script src="b.js"></script></body>')
    const wp = app.waitForEvent('window', { timeout: 20000 })
    await app.evaluate(({ BrowserWindow }, url) => { const w = new BrowserWindow({ width: 700, height: 300, webPreferences: { sandbox: true } }); w.loadURL(url) }, `file://${join(dir, 'i.html')}?mode=${mode}`)
    const page = await wp
    await page.waitForLoadState('domcontentloaded')
    await waitFor(() => page.evaluate(() => !!window.__view), { what: 'control view' })
    await page.locator('.cm-content').click(); await page.keyboard.press('Control+Home')
    const probe = () => page.evaluate(() => { const s = getSelection(); let x = null; if (s.rangeCount) { const r = s.getRangeAt(0).cloneRange(); r.collapse(true); const q = r.getClientRects()[0] || r.getBoundingClientRect(); if (q && q.height > 0) x = q.left } return { head: window.__head(), x } })
    const seq = []
    for (let i = 0; i < presses; i++) { seq.push(await probe()); await page.keyboard.press('ArrowRight') }
    await page.close().catch(() => {})
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => { if (/i\.html/.test(w.webContents.getURL())) w.destroy() }))
    await sleep(200)
    rmSync(dir, { recursive: true, force: true })
    return seq
}
