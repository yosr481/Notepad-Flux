// UPGRADE-1 (Windows): real upgrade path in the DEFAULT profile (no NOTEPAD_FLUX_USER_DATA).
//   phase 1: node upgrade-win.mjs seed   <installed exe>   -> old build, 2 tabs with text, closed via X
//   (run the new NSIS installer over it, silently)
//   phase 2: node upgrade-win.mjs verify <installed exe>   -> new build restores both tabs; resources\app-update.yml exists
// Run in the interactive desktop session. Touches %USERPROFILE%\AppData\LocalLow\Notepad Flux: VM / throwaway account only.
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { launch } from './lib/launch.mjs'
import { sleep, waitFor, assert } from './lib/harness.mjs'
import * as ui from './lib/ui.mjs'
const [phase, binary] = process.argv.slice(2)
if (!['seed', 'verify'].includes(phase) || !existsSync(binary || '')) { console.error('usage: upgrade-win.mjs seed|verify <Notepad Flux.exe>'); process.exit(2) }
const profile = join(homedir(), 'AppData', 'LocalLow', 'Notepad Flux')
const A = 'UPGRADE-TAB-ONE first note', B = 'UPGRADE-TAB-TWO second note'
const fail = (m) => { console.log('FAIL UPGRADE-1 [' + phase + '] ' + m); process.exit(1) }
try {
    if (phase === 'seed') {
        rmSync(profile, { recursive: true, force: true })
        const { app, win } = await launch({ binary })
        await sleep(2500)
        await ui.typeAtEnd(win, A)
        await win.keyboard.press('Control+n'); await sleep(300)
        await ui.typeAtEnd(win, B); await sleep(1500)
        const v = await app.evaluate(() => process.versions.electron)
        const r = await ui.closeViaX(app)
        assert(r.exited, 'seed build did not exit on X')
        console.log('PASS seed: 2 tabs written by Electron ' + v + ' in ' + profile)
    } else {
        assert(existsSync(profile), 'precondition: seeded profile missing, test would be vacuous')
        assert(existsSync(join(dirname(binary), 'resources', 'app-update.yml')), 'resources\\app-update.yml missing in the new install')
        const { app, win } = await launch({ binary })
        try {
            const v = await app.evaluate(() => process.versions.electron)
            await sleep(2500)
            await waitFor(async () => (await ui.tabsInfo(win)).length >= 2, { what: 'two restored tabs' })
            const n = (await ui.tabsInfo(win)).length, seen = []
            for (let i = 0; i < n; i++) { await win.locator('[class*=tabsList] > div').nth(i).click(); await sleep(300); seen.push(await ui.editorText(win)) }
            assert(seen.some(t => t.includes(A)) && seen.some(t => t.includes(B)), 'tabs not restored with text: ' + JSON.stringify(seen))
            const log = readFileSync(join(profile, 'logs', 'main.log'), 'utf8')
            const errs = log.split('\n').filter(l => /\[error\]/.test(l)).slice(-5)
            console.log('PASS UPGRADE-1: electron ' + v + ', both tabs restored, app-update.yml present; recent [error] lines: ' + JSON.stringify(errs))
        } finally { await app.close().catch(() => {}) }
    }
    process.exit(0)
} catch (e) { fail(String(e.message || e).split('\n')[0]) }
