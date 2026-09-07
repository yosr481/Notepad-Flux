// Electron E2E smoke: preload IPC + save/read round-trip + encryption-at-rest.
// Run:  node electron/e2e/smoke.mjs
// Needs a prior `npm run build:vite` (uses dist/ + dist-electron/). Launches its
// own Electron with a throwaway userData dir, so the user's real session is
// untouched and the single-instance lock does not collide with a running dev app.
import { _electron as electron } from 'playwright'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userData = mkdtempSync(join(tmpdir(), 'nf-e2e-'))
const workDir = mkdtempSync(join(tmpdir(), 'nf-work-'))
let app, fail = 0
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++ }

try {
    app = await electron.launch({
        args: ['dist-electron/main.js'],
        env: { ...process.env, NOTEPAD_FLUX_USER_DATA: userData, ELECTRON_ENABLE_LOGGING: '1' },
    })
    // main.js opens a splash window first (no preload) then the real one. Poll
    // every window until one exposes electronAPI, up to ~20s.
    let win
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
        for (const w of app.windows()) {
            try {
                await w.waitForLoadState('domcontentloaded')
                if (await w.evaluate(() => !!window.electronAPI)) { win = w; break }
            } catch { /* window may have closed (splash) */ }
        }
        if (win) break
        await new Promise(r => setTimeout(r, 300))
    }
    if (!win) throw new Error('no window exposed window.electronAPI within 20s')

    // 1. preload bridge is live (the whole point of the .cjs fix)
    const hasApi = await win.evaluate(() => !!window.electronAPI && typeof window.electronAPI.saveFile === 'function')
    ok(hasApi, 'window.electronAPI exposed with saveFile')

    // 2. save-file writes to disk. Simulate the finding-13 case: a file that
    // already exists on disk (picked in a prior session) whose path the renderer
    // re-authorizes on load. isPathSafe only matches allowlist entries that
    // currently resolve, so the file must exist before authorize-paths.
    const target = join(workDir, 'note.md')
    const body = '# hello\n\nרשומה בעברית\n'
    writeFileSync(target, 'old\n')
    const authRes = await win.evaluate(async (p) => {
        try { return await window.electronAPI.authorizePaths([p.target]) }
        catch (e) { return { error: String(e) } }
    }, { target })
    ok(authRes && authRes.added === 1, `authorize-paths accepted the persisted path (${JSON.stringify(authRes)})`)
    const saveRes = await win.evaluate(async (p) => {
        try { return await window.electronAPI.saveFile({ filePath: p.target, content: p.body }) }
        catch (e) { return { error: String(e) } }
    }, { target, body })
    ok(saveRes && saveRes.filePath === target, `save-file returned the path (${JSON.stringify(saveRes)})`)
    ok(readFileSync(target, 'utf-8') === body, 'file on disk matches what we sent')

    // 3. read-file-content reads it back (path is now allowlisted from the save)
    const readBack = await win.evaluate(async (p) => {
        try { return await window.electronAPI.readFileContent(p.target) }
        catch (e) { return { error: String(e) } }
    }, { target })
    ok(readBack === body, 'read-file-content round-trips the same bytes')

    // 4. read of an un-authorized path is denied
    const denied = await win.evaluate(async () => {
        try { await window.electronAPI.readFileContent('/etc/hostname'); return 'NOT DENIED' }
        catch (e) { return String(e) }
    })
    ok(/not authorized|internal system error/i.test(denied), `unauthorized read denied (${denied})`)

    // 5. safeStorage available + encrypts
    const enc = await win.evaluate(async () => {
        try {
            const avail = await window.electronAPI.safeStorage.isAvailable()
            if (!avail) return { avail }
            const c = await window.electronAPI.safeStorage.encrypt('secret')
            const d = await window.electronAPI.safeStorage.decrypt(c)
            return { avail, roundTrip: d === 'secret', looksCiphered: c !== 'secret' }
        } catch (e) { return { error: String(e) } }
    })
    ok(enc.avail === false || (enc.roundTrip && enc.looksCiphered), `safeStorage encrypt/decrypt (${JSON.stringify(enc)})`)
} catch (e) {
    console.error('HARNESS ERROR', e)
    fail++
} finally {
    if (app) await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(workDir, { recursive: true, force: true })
}
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed')
process.exit(fail ? 1 : 0)
