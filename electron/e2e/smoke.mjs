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
// A file the user picked in a "previous session": main persisted the grant in
// <userData>/authorized-paths.json, so this launch must honour it (QA finding 13).
const target = join(workDir, 'note.md')
writeFileSync(target, 'old\n')
writeFileSync(join(userData, 'authorized-paths.json'), JSON.stringify([target]))
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

    // 2. the page cannot grant itself paths any more; persisted grants load in main
    const surface = await win.evaluate(() => ({
        authorizePaths: typeof window.electronAPI.authorizePaths,
        getPathForFile: typeof window.electronAPI.getPathForFile,
    }))
    ok(surface.authorizePaths === 'undefined' && surface.getPathForFile === 'undefined',
        `no self-authorization on the page bridge (${JSON.stringify(surface)})`)
    const exists = await win.evaluate(async (p) => [
        await window.electronAPI.fileExists(p.target),
        await window.electronAPI.fileExists('/etc/hostname'),
    ], { target })
    ok(exists[0] === true && exists[1] === null, `file-exists answers only for granted paths (${JSON.stringify(exists)})`)
    const body = '# hello\n\nרשומה בעברית\n'
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

    // 6. session log captured the run: startup, the save, the denial, forwarded renderer console
    await win.evaluate(() => console.warn('e2e-log-probe'))
    await new Promise(r => setTimeout(r, 300))
    const logText = readFileSync(join(userData, 'logs', 'main.log'), 'utf-8')
    ok(/start \{/.test(logText) && logText.includes(`save: wrote ${target}`) &&
        /read: denied .*\/etc\/hostname/.test(logText) && logText.includes('[renderer] e2e-log-probe') &&
        !logText.includes('רשומה'), 'main.log has start/save/denied/renderer lines and no file content')

    // 7. close handshake: the window closes promptly because the renderer confirms
    // its session flush (no 3s timeout fallback in the log)
    const t0 = Date.now()
    const exited = new Promise(r => app.process().once('exit', r))
    await win.evaluate(() => window.electronAPI.closeWindow()) // menu Close Window; main then runs the same close as the title-bar X
    await Promise.race([exited, new Promise(r => setTimeout(r, 8000))])
    const closeLog = readFileSync(join(userData, 'logs', 'main.log'), 'utf-8')
    ok(app.process().exitCode !== null && !closeLog.includes('did not confirm session flush') && Date.now() - t0 < 3000,
        `window close exits via the flush handshake (${Date.now() - t0}ms)`)
    app = null
} catch (e) {
    console.error('HARNESS ERROR', e)
    fail++
} finally {
    if (app) await app.close().catch(() => {})
    rmSync(userData, { recursive: true, force: true })
    rmSync(workDir, { recursive: true, force: true })
}
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed')
process.exit(fail ? 1 : 0)
