// E2E against a PACKAGED Notepad Flux binary (linux-unpacked, .deb payload, AppImage).
//   DISPLAY=:77 node electron/e2e/packaged.mjs <binary> [--target=<name>] [--smoke] [--no-sandbox]
// Never touches real app data: every launch uses NOTEPAD_FLUX_USER_DATA=<temp dir>.
import { realpathSync, mkdtempSync, writeFileSync, readFileSync, mkdirSync, symlinkSync, chmodSync, existsSync, rmSync, readdirSync, statSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { launch } from './lib/launch.mjs'
import { stockCaretSequence } from './lib/rtl-control.mjs'
import { multiWindow, overrideScenarios, orphanRows } from './lib/scenarios.mjs'
import { check, na, assert, eq, sleep, waitFor, results, tally, writeResults, setSmoke } from './lib/harness.mjs'
import * as ui from './lib/ui.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const binary = argv.find(a => !a.startsWith('--'))
const flag = (n) => argv.some(a => a === `--${n}`)
const target = (argv.find(a => a.startsWith('--target=')) || '--target=unpacked').slice(9)
if (!binary || !existsSync(binary)) { console.error('usage: packaged.mjs <binary> [--target=name] [--smoke] [--no-sandbox]'); process.exit(2) }
if (!process.env.DISPLAY || process.env.DISPLAY === ':0') { console.error('refusing to run on DISPLAY=' + process.env.DISPLAY + ' (use the nested Xephyr :77)'); process.exit(2) }
setSmoke(flag('smoke'))
const only = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)
const want = (n) => only.length === 0 || only.includes(n)

const shots = join(here, '../../Docs/internal/e2e/shots'); mkdirSync(shots, { recursive: true })
const tmp = (p) => mkdtempSync(join(tmpdir(), p))
const cleanup = []
let noSandbox = flag('no-sandbox')
let sandboxNote = noSandbox ? 'launched with --no-sandbox (requested)' : 'launched WITH chromium sandbox'
const env = /\.AppImage$/.test(binary) ? { APPIMAGE_EXTRACT_AND_RUN: '1' } : {}
const pageErrors = []
// Electron resolves a beforeunload block itself (will-prevent-unload); Playwright's auto-dismiss then races it.
process.on('unhandledRejection', (e) => { if (/handleJavaScriptDialog/.test(String(e?.message) + String(e?.method))) return; throw e })

async function L(userData, extra = {}) {
    const go = (ns) => launch({ binary, userData, extraArgs: ns ? ['--no-sandbox'] : [], env: { ...env, ...extra.env } })
    let r
    try { r = await go(noSandbox) } catch (e) {
        if (noSandbox) throw e
        console.log('NOTE sandboxed launch failed (' + String(e.message).split('\n')[0] + '); retrying --no-sandbox')
        noSandbox = true; sandboxNote = 'DEVIATION: sandboxed launch failed, ran with --no-sandbox'
        r = await go(true)
    }
    r.win.on('pageerror', e => pageErrors.push(`[during ${globalThis.__cur}] ` + String(e.stack || e).replace(/\s+/g, ' ').slice(0, 400)))
    // The renderer loads the saved session ~1-2s after the window is up; actions inside that window hit a
    // tab-id race (see RACE-1). Every scenario except RACE-1 waits it out so one defect does not mask the rest.
    await sleep(extra.settle ?? 2500)
    return r
}
const logOf = (ud) => { try { return readFileSync(join(ud, 'logs', 'main.log'), 'utf8') } catch { return '' } }
// a 60x30 SVG: the 1x1 PNG below is too small to click reliably
const BIG = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='60'%20height='30'%3E%3Crect%20width='60'%20height='30'%20fill='red'/%3E%3C/svg%3E"
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

// ---------------------------------------------------------------- scenario 1: core
const U1 = tmp('nf-u1-'), W = tmp('nf-w1-'); cleanup.push(U1, W)
const granted = join(W, 'granted.md'); writeFileSync(granted, 'granted original\n')
const gdir = join(W, 'gdir'); mkdirSync(gdir)
const outside = join(W, 'outside-secret.txt'); writeFileSync(outside, 'SECRET-OUTSIDE\n')
symlinkSync(outside, join(gdir, 'escape.md'))
const swapped = join(W, 'swapped.md'); writeFileSync(swapped, 'swap me\n')
// Persisted grants as main would have written them in an earlier session (the grants file is main-owned).
const realdir = join(W, 'realdir'); mkdirSync(realdir); const linkdir = join(W, 'linkdir'); symlinkSync(realdir, linkdir)
writeFileSync(join(realdir, 'n.md'), 'via link\n')
const dotted = join(W, 'notes..md'); writeFileSync(dotted, 'dotted body\r\n'); const dotted2 = join(W, 'v1..2.md'); writeFileSync(dotted2, 'v12\n')
// LEGACY format (bare path strings, as written before 5edfcb1): main must migrate it to [{path, real}] on first load.
writeFileSync(join(U1, 'authorized-paths.json'), JSON.stringify([granted, gdir, swapped, join(linkdir, 'n.md')]))

let app, win
if (want('core')) {
try {
    ;({ app, win } = await L(U1))
} catch (e) {
    await check('LAUNCH-1', 'launch', 'packaged binary starts and exposes the preload bridge', () => { throw e }, { smoke: true })
    writeResults(join(here, '../../Docs/internal/e2e/results-linux.json'), target, { binary, sandbox: sandboxNote })
    process.exit(1)
}

await check('LAUNCH-1', 'launch', 'packaged binary starts, splash then main window with window.electronAPI', async () => {
    assert(await win.evaluate(() => typeof window.electronAPI?.saveFile === 'function'), 'no electronAPI.saveFile')
    const argvMain = await app.evaluate(() => process.argv)
    const packaged = await app.evaluate(({ app }) => app.isPackaged)
    assert(packaged, 'app.isPackaged false')
    assert(/app\.asar/.test(win.url()), 'renderer not served from app.asar: ' + win.url())
    const sb = argvMain.includes('--no-sandbox')
    assert(sb === noSandbox, `argv --no-sandbox=${sb} but expected ${noSandbox}`)
    return sandboxNote
}, { smoke: true })

await check('SEC-1', 'security', 'webPreferences: contextIsolation on, sandbox on, nodeIntegration off', async () => {
    const wps = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
        .filter(w => /index\.html/.test(w.webContents.getURL())).map(w => w.webContents.getLastWebPreferences()))
    assert(wps.length >= 1, 'no main window')
    for (const p of wps) { eq(p.contextIsolation, true, 'contextIsolation'); eq(p.sandbox, true, 'sandbox'); assert(!p.nodeIntegration, 'nodeIntegration on') }
    // and page world really has no node
    eq(await win.evaluate(() => [typeof require, typeof process, typeof Buffer]), ['undefined', 'undefined', 'undefined'], 'node globals in page')
}, { smoke: true })

await check('SEC-2', 'security', 'no self-authorization on page bridge (authorizePaths/getPathForFile absent)', async () => {
    const keys = await win.evaluate(() => Object.keys(window.electronAPI))
    for (const k of ['authorizePaths', 'getPathForFile']) assert(!keys.includes(k), `bridge exposes ${k}`)
    return 'bridge keys: ' + keys.join(',')
}, { smoke: true })

await check('SEC-3', 'security', 'file-exists answers only for granted paths (true/false), null otherwise', async () => {
    const r = await win.evaluate(async (p) => [await window.electronAPI.fileExists(p.granted), await window.electronAPI.fileExists('/etc/hostname'),
        await window.electronAPI.fileExists(p.ungrantedNew), await window.electronAPI.fileExists(42), await window.electronAPI.fileExists('relative.md')],
        { granted, ungrantedNew: join(W, 'nope.md') })
    eq(r, [true, null, null, null, null])
}, { smoke: true })

await check('SEC-4', 'security', 'ungranted path cannot be read or written through the bridge (and nothing is created)', async () => {
    const never = join(W, 'never-granted.md')
    const r = await win.evaluate(async (p) => {
        const t = async (f) => { try { await f(); return 'NOT DENIED' } catch (e) { return String(e.message) } }
        return {
            read: await t(() => window.electronAPI.readFileContent('/etc/hostname')),
            readRel: await t(() => window.electronAPI.readFileContent('granted.md')),
            readDots: await t(() => window.electronAPI.readFileContent(p.W + '/gdir/../outside-secret.txt')),
            write: await t(() => window.electronAPI.saveFile({ filePath: p.never, content: 'x' })),
            writeEtc: await t(() => window.electronAPI.saveFile({ filePath: '/tmp/nf-never-' + Date.now(), content: 'x' })),
            outsideRead: await t(() => window.electronAPI.readFileContent(p.outside)),
        }
    }, { W, never, outside })
    for (const [k, v] of Object.entries(r)) assert(/not authorized|Unauthorized|internal system error/i.test(v), `${k}: ${v}`)
    assert(!existsSync(never), 'ungranted write created a file')
    return JSON.stringify(r)
}, { smoke: true })

await check('SEC-5a', 'security', 'symlink inside a granted directory pointing outside is refused (read + write; target untouched)', async () => {
    const link = join(gdir, 'escape.md')
    const r = await win.evaluate(async (l) => {
        const t = async (f) => { try { const v = await f(); return 'NOT DENIED ' + JSON.stringify(v) } catch (e) { return String(e.message) } }
        return [await t(() => window.electronAPI.readFileContent(l)), await t(() => window.electronAPI.saveFile({ filePath: l, content: 'PWNED' }))]
    }, link)
    for (const v of r) assert(/not authorized|Unauthorized|internal system error/i.test(v), v)
    eq(readFileSync(outside, 'utf8'), 'SECRET-OUTSIDE\n', 'outside file changed')
    return 'grant for gdir was seeded into authorized-paths.json (main never grants directories itself)'
})
await check('SEC-5b', 'security', 'granted file replaced by a symlink to another file is refused', async () => {
    rmSync(swapped); symlinkSync(outside, swapped)
    const r = await win.evaluate(async (p) => { try { return 'NOT DENIED ' + await window.electronAPI.readFileContent(p) } catch (e) { return String(e.message) } }, swapped)
    assert(/not authorized|Unauthorized|internal system error/i.test(r), r)
})
await check('SEC-5c', 'security', 'positive control: granted dir allows a real file inside it', async () => {
    const inside = join(gdir, 'ok.md'); writeFileSync(inside, 'inside\n')
    eq(await win.evaluate((p) => window.electronAPI.readFileContent(p), inside), 'inside\n')
})

await check('MIG-1', 'grants', 'a legacy authorized-paths.json (bare strings) is migrated to [{path, real}] on first load; a legacy grant through a symlinked dir keeps working and stays bound', async () => {
    const g = JSON.parse(readFileSync(join(U1, 'authorized-paths.json'), 'utf8'))
    assert(Array.isArray(g) && g.length === 4 && g.every(e => e && typeof e === 'object' && typeof e.path === 'string' && typeof e.real === 'string'), 'not migrated: ' + JSON.stringify(g).slice(0, 300))
    const viaLink = g.find(e => e.path === join(linkdir, 'n.md')); eq(viaLink.real, join(realpathSync(realdir), 'n.md'), 'real path captured for the symlinked-dir grant')
    eq(await win.evaluate((p) => window.electronAPI.readFileContent(p), join(linkdir, 'n.md')), 'via link\n')
    // swap AFTER migration: refused
    const n = join(realdir, 'n.md'); rmSync(n); symlinkSync(outside, n)
    const r = await win.evaluate(async (p) => { try { return 'NOT DENIED ' + await window.electronAPI.readFileContent(p) } catch (e) { return String(e.message) } }, join(linkdir, 'n.md'))
    assert(/not authorized|Unauthorized|internal system error/i.test(r), r); rmSync(n); writeFileSync(n, 'via link\n')
    return 'migrated entries: ' + g.length
}, { smoke: true })
await check('DOTDOT-1', 'grants', 'file names containing ".." (notes..md, v1..2.md) can be opened, dropped, saved in place; a real ".." segment is still refused', async () => {
    const sec = join(W, 'gdir-dd'); mkdirSync(sec)
    await ui.openViaDialog(app, win, dotted2); await waitFor(async () => (await ui.activeTitle(win)) === 'v1..2.md', { what: 'v1..2.md open' }); await sleep(400)
    await ui.stubSave(app, join(W, 'NO.md')); await ui.typeAtEnd(win, 'X'); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(dotted2, 'utf8') === 'v12\nX', { what: 'v1..2.md saved' }); eq(await ui.saveCalls(app), 0, 'save dialog shown')
    await ui.dropFiles(win, [dotted]); await waitFor(async () => (await ui.activeTitle(win)) === 'notes..md', { what: 'dropped notes..md' })
    await ui.typeAtEnd(win, 'Y'); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(dotted, 'utf8') === 'dotted body\r\nY'.replace(/\r\n/, '\r\n'), { what: 'notes..md saved (CRLF kept)' })
    const bad = await win.evaluate(async (p) => { try { return 'NOT DENIED ' + await window.electronAPI.saveFile({ filePath: p, content: 'x' }) } catch (e) { return String(e.message) } }, sec + '/../notes..md')
    assert(/not authorized|Unauthorized|internal system error/i.test(bad), 'traversal: ' + bad)
    for (let k = 0; k < 2; k++) { await waitFor(async () => !(await ui.tabsInfo(win)).find(t => t.active)?.dirty, { what: 'clean tab before Ctrl+W' }); await win.keyboard.press('Control+w'); await sleep(300) }
})
await check('SYM-2', 'grants', 'opening through a symlinked directory and saving in place works (grant bound to the real path at grant time)', async () => {
    const viaLink = join(linkdir, 'n.md')
    await ui.openViaDialog(app, win, viaLink); await waitFor(async () => (await ui.activeTitle(win)) === 'n.md', { what: 'n.md' }); await sleep(400)
    await ui.stubSave(app, join(W, 'NO2.md')); await ui.typeAtEnd(win, 'Z'); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(join(realdir, 'n.md'), 'utf8') === 'via link\nZ', { what: 'saved through the link' }); eq(await ui.saveCalls(app), 0)
    await waitFor(async () => !(await ui.tabsInfo(win)).find(t => t.active)?.dirty, { what: 'clean tab before Ctrl+W' }); await win.keyboard.press('Control+w'); await sleep(300)
})
await check('SEC-6', 'security', 'window.open / navigation to foreign origins denied; http(s) goes to the OS browser only; file:/javascript: blocked', async () => {
    await app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = async (u) => { globalThis.__ext.push(u) } })
    const winsBefore = (await ui.mainWindows(app)).length
    await win.evaluate(() => { window.open('https://example.com/a'); window.open('javascript:alert(1)'); window.open('ftp://x.test/') })
    await sleep(800)
    const ext = await app.evaluate(() => globalThis.__ext)
    const winsAfter = (await ui.mainWindows(app)).length
    eq(winsAfter, winsBefore, 'a window opened')
    assert(ext.includes('https://example.com/a'), 'https not handed to OS browser: ' + ext)
    assert(!ext.some(u => /^(javascript|file|ftp):/.test(u)), 'unsafe scheme reached openExternal: ' + ext)
    return 'ext=' + JSON.stringify(ext)
}, { smoke: true })
await check('SEC-6c', 'security', 'window.open of a foreign file: URL (not the app) does not open a window with the preload bridge', async () => {
    const before = (await ui.mainWindows(app)).length
    await win.evaluate(() => { window.open('file:///etc/hostname', '_blank') })
    await sleep(1200)
    const wins = await ui.mainWindows(app)
    const extra = wins.filter(w => !/app\.asar\/dist\/index\.html/.test(w.url) && w.url !== '')
    // clean up so later UI checks are not covered by a stray window
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => { if (!/app\.asar\/dist\/index\.html/.test(w.webContents.getURL())) w.destroy() }))
    const hadBridge = wins.length > before
    assert(!hadBridge, 'window.open(file:///etc/hostname) opened a new app window (preload attached) with url ' + JSON.stringify(extra.map(w => w.url)))
})
await check('SEC-7', 'security', 'open-external bridge: only http/https/mailto reach the OS', async () => {
    await app.evaluate(() => { globalThis.__ext = [] })
    await win.evaluate(async () => { for (const u of ['file:///etc/passwd', 'smb://h/s', 'javascript:1', 'https://ok.test/', 'mailto:a@b.c']) await window.electronAPI.openExternal(u) })
    eq(await app.evaluate(() => globalThis.__ext), ['https://ok.test/', 'mailto:a@b.c'])
})
await check('SEC-8', 'security', 'a script-built File has no native path: openDroppedFile resolves null and grants nothing', async () => {
    const r = await win.evaluate(async () => [await window.electronAPI.openDroppedFile(new File(['x'], 'etc-hostname.md')),
        await window.electronAPI.fileExists('/etc/hostname')])
    eq(r, [null, null])
})
await check('SEC-9', 'security', 'safeStorage available (keyring) and encrypt/decrypt round-trips with ciphertext != plaintext', async () => {
    const r = await win.evaluate(async () => {
        const s = window.electronAPI.safeStorage; if (!(await s.isAvailable())) return { avail: false }
        const c = await s.encrypt('secret-é'); return { avail: true, c: c !== 'secret-é', d: await s.decrypt(c) }
    })
    assert(r.avail, 'safeStorage unavailable (keyring missing in this environment)')
    assert(r.c && r.d === 'secret-é', JSON.stringify(r))
}, { smoke: true })

await check('LOG-1', 'log', 'main.log has start block (version, packaged:true, safeStorage backend) and no file content', async () => {
    const t = logOf(U1)
    assert(/start \{/.test(t) && /packaged: true/.test(t) && /safeStorage: true/.test(t), 'start block incomplete')
    return (t.match(/version: '([^']+)'/) || [])[0] + ' ' + (t.match(/safeStorageBackend: '([^']+)'/) || [])[0]
}, { smoke: true })

await check('WIN-1', 'window', 'window background colour set explicitly (no white flash): matches theme', async () => {
    const w = (await ui.mainWindows(app)).find(w => /index\.html/.test(w.url))
    assert(/^#(1E1E1E|FFFFFF)$/i.test(w.bg), 'bg ' + w.bg)
    return 'bg ' + w.bg + ' (light host theme)'
})

await check('WIN-2', 'window', 'native frame on Linux: main window has decorations, splash (frameless) differs', async () => {
    // Xephyr has no window manager, so decorations cannot be drawn; read the window-manager hints Electron set instead.
    const tree = execFileSync('xwininfo', ['-root', '-tree'], { env: process.env }).toString()
    const ids = [...tree.matchAll(/(0x[0-9a-f]+) "Notepad Flux"/g)].map(m => m[1])
    assert(ids.length, 'no Notepad Flux X window found')
    const hints = ids.map(id => execFileSync('xprop', ['-id', id, '_MOTIF_WM_HINTS'], { env: process.env }).toString().trim())
    // A frameless window carries _MOTIF_WM_HINTS with decorations = 0; titleBarStyle:'hidden' does too.
    const bare = hints.filter(h => /= 0x2, 0x0, 0x0, 0x0, 0x0/.test(h) || /= 2, 0, 0, 0, 0/.test(h))
    assert(bare.length === 0, 'main window asks WM for no decorations: ' + hints.join(' ; '))
    return 'hints: ' + hints.join(' ; ')
})

await check('WIN-5', 'window', 'WM_CLASS is notepad-flux (matches StartupWMClass) and the window carries an icon (_NET_WM_ICON)', async () => {
    const tree = execFileSync('xwininfo', ['-root', '-tree'], { env: process.env }).toString()
    const ids = [...tree.matchAll(/(0x[0-9a-f]+) "Notepad Flux"/g)].map(m => m[1])
    const props = ids.map(id => execFileSync('xprop', ['-id', id, 'WM_CLASS', '_NET_WM_ICON'], { env: process.env }).toString())
    assert(props.some(p => /WM_CLASS\(STRING\) = "notepad-flux"/i.test(p)), 'WM_CLASS: ' + props.map(p => p.split('\n')[0]).join(' ; '))
    assert(props.some(p => /_NET_WM_ICON\(CARDINAL\) =/.test(p)), 'no _NET_WM_ICON on any Notepad Flux window')
    return props.map(p => p.split('\n')[0]).join(' ; ')
})

// ---- open / save
const ed = () => win.locator('.cm-content')
await check('OPEN-1', 'open', 'Ctrl+O (dialog stubbed) opens a text file into a tab; grant + log line', async () => {
    await ui.openViaDialog(app, win, granted)
    await waitFor(async () => (await ui.activeTitle(win)) === 'granted.md', { what: 'tab granted.md' })
    assert((await ui.editorText(win)).includes('granted original'), 'content not in editor')
    assert(/open: picked .*granted\.md/.test(logOf(U1)), 'no open: picked log')
    return 'dialog stubbed; real IPC read-file handler'
}, { smoke: true })

await check('OPEN-3', 'open', 'Open dialog is parented to the app window, offers Text + All Files filters, and starts in the last-used folder (QA 5/6)', async () => {
    const a = await app.evaluate(() => globalThis.__openArgs)
    assert(a.hasParent, 'dialog not parented to a window'); assert(a.filters.some(f => /^Text:/.test(f)) && a.filters.some(f => /^All Files:\*$/.test(f)), 'filters: ' + a.filters)
    const sub = join(W, 'sub-for-lastdir'); mkdirSync(sub); const lf2 = join(sub, 'l.md'); writeFileSync(lf2, 'l\n')
    await ui.openViaDialog(app, win, lf2); await waitFor(async () => (await ui.activeTitle(win)) === 'l.md', { what: 'l.md' })
    await ui.openViaDialog(app, win, granted); await sleep(500)
    const b = await app.evaluate(() => globalThis.__openArgs); eq(b.defaultPath, sub, 'defaultPath after opening from ' + sub)
    await win.keyboard.press('Control+w'); await win.keyboard.press('Control+w'); await sleep(300)
    await ui.openViaDialog(app, win, granted); await waitFor(async () => (await ui.activeTitle(win)) === 'granted.md', { what: 'reopen granted' })
    return 'filters ' + a.filters.join(' ; ')
})
await check('APP-VER', 'launch', 'status bar version equals app.getVersion() and package.json', async () => {
    const v = await app.evaluate(({ app }) => app.getVersion()); const st = (await ui.status(win))[0]
    eq(st, 'v' + v, 'status bar'); eq(v, JSON.parse(readFileSync(join(here, '../../package.json'), 'utf8')).version, 'package.json')
    return 'version ' + v + ' (run sheet expects 1.4.0: not bumped yet)'
}, { smoke: true })
await check('SAVE-1', 'save', 'type + Ctrl+S saves in place (no dialog); bytes on disk; dirty mark clears', async () => {
    await ui.stubSave(app, join(W, 'SHOULD-NOT-BE-USED.md'))
    await ui.typeAtEnd(win, 'added line')
    await waitFor(async () => (await ui.tabsInfo(win)).find(t => t.active)?.dirty, { what: 'dirty mark after typing' })
    await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(granted, 'utf8') === 'granted original\nadded line', { what: 'file bytes' })
    await waitFor(async () => !(await ui.tabsInfo(win)).find(t => t.active).dirty, { what: 'dirty to clear' })
    eq(await ui.saveCalls(app), 0, 'save dialog was shown')
}, { smoke: true })

await check('SAVE-2', 'save', 'Save As writes new file, retitles tab, keeps original untouched', async () => {
    const dst = join(W, 'sub dir', 'ünï copy.md'); mkdirSync(dirname(dst))
    await ui.stubSave(app, dst)
    await win.keyboard.press('Control+Shift+S')
    await waitFor(() => existsSync(dst), { what: 'Save As file' })
    eq(readFileSync(dst, 'utf8'), 'granted original\nadded line')
    await waitFor(async () => (await ui.activeTitle(win)) === 'ünï copy.md', { what: 'tab retitled' })
    eq(readFileSync(granted, 'utf8'), 'granted original\nadded line')
    assert(/save-as: picked .*copy\.md/.test(logOf(U1)), 'no save-as log')
    // the Save-As target is now granted: a further in-place save works without a dialog
    await ui.typeAtEnd(win, '!'); await ui.stubSave(app, join(W, 'x.md')); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(dst, 'utf8').endsWith('added line!'), { what: 'in-place save after Save As' })
    eq(await ui.saveCalls(app), 0)
}, { smoke: true })

await check('SAVE-3', 'save', 'Ctrl+N then Ctrl+S on an untitled tab opens Save As', async () => {
    const dst = join(W, 'fresh.md'); await ui.stubSave(app, dst)
    await win.keyboard.press('Control+n'); await sleep(300); await ui.typeAtEnd(win, 'brand new')
    await win.keyboard.press('Control+s')
    await waitFor(() => existsSync(dst) && readFileSync(dst, 'utf8') === 'brand new', { what: 'new file saved' })
    eq(await ui.saveCalls(app), 1)
})

// CRLF + BOM
const crlf = join(W, 'crlf-bom.md'); writeFileSync(crlf, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('one\r\ntwo\r\n')]))
const lf = join(W, 'plain-lf.md'); writeFileSync(lf, 'a\nb\n')
await check('EOL-1', 'status bar', 'status bar shows real EOL/charset: CRLF + UTF-8 BOM, then LF + UTF-8 for an LF file', async () => {
    await ui.openViaDialog(app, win, crlf)
    await waitFor(async () => (await ui.status(win)).includes('CRLF'), { what: 'CRLF in status' })
    assert((await ui.status(win)).includes('UTF-8 BOM'), 'status: ' + await ui.status(win))
    await ui.openViaDialog(app, win, lf)
    await waitFor(async () => (await ui.status(win)).includes('LF') && (await ui.status(win)).includes('UTF-8'), { what: 'LF/UTF-8' })
    assert(!(await ui.status(win)).some(s => /%/.test(s)), 'fake zoom indicator still present')
}, { smoke: true })
await check('EOL-2', 'save', 'Save keeps CRLF + BOM: typed Enter becomes CRLF on disk, BOM kept (bytes)', async () => {
    await ui.openViaDialog(app, win, crlf)
    await waitFor(async () => (await ui.activeTitle(win)) === 'crlf-bom.md' || true)
    await sleep(600)
    await ui.typeAtEnd(win, 'X'); await win.keyboard.press('Enter'); await win.keyboard.type('Y')
    await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(crlf).toString('latin1').includes('Y'), { what: 'crlf file saved' })
    const b = readFileSync(crlf)
    eq([...b.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'BOM')
    const body = b.subarray(3).toString('utf8')
    assert(!/(^|[^\r])\n/.test(body), 'bare LF in CRLF file: ' + JSON.stringify(body))
    assert(body.startsWith('one\r\ntwo\r\n') && body.endsWith('Y'), JSON.stringify(body))
}, { smoke: true })
await check('EOL-3', 'save', 'Save As of a CRLF+BOM tab keeps CRLF and BOM in the copy (bytes)', async () => {
    const dst = join(W, 'crlf-copy.md'); await ui.stubSave(app, dst)
    await win.keyboard.press('Control+Shift+S')
    await waitFor(() => existsSync(dst), { what: 'copy' })
    await sleep(300)
    const b = readFileSync(dst)
    eq([...b.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'BOM in copy')
    assert(!/(^|[^\r])\n/.test(b.subarray(3).toString('utf8')), 'bare LF in copy')
    assert(b.includes('\r\n'), 'no CRLF in copy')
}, { smoke: true })
await check('EOL-4', 'save', 'LF file stays LF (no CR introduced) on Save', async () => {
    await ui.openViaDialog(app, win, lf); await sleep(700)
    await ui.typeAtEnd(win, 'c'); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(lf, 'utf8').includes('c'), { what: 'lf saved' })
    eq(readFileSync(lf, 'utf8'), 'a\nb\nc')
})

const spaced = join(W, 'spaced ünïcode name.md'); writeFileSync(spaced, 'x\n'); const empty = join(W, 'empty.md'); writeFileSync(empty, '')
await check('OPEN-2', 'open', 'empty file and a spaced/unicode filename open; unicode-named file saves in place with the right tab title', async () => {
    await ui.openViaDialog(app, win, empty); await sleep(500)
    await ui.openViaDialog(app, win, spaced); await waitFor(async () => (await ui.activeTitle(win)) === 'spaced ünïcode name.md', { what: 'title' })
    await sleep(400); await ui.typeAtEnd(win, 'edit'); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(spaced, 'utf8') === 'x\nedit', { what: 'unicode file saved' })
    assert((await ui.tabsInfo(win)).some(t => t.title === 'empty.md'), 'empty.md tab missing')
})

// binary + errors
const binf = join(W, 'binary.bin'); writeFileSync(binf, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 1, 2, 0, 0xff]))
const rnd = join(W, 'random.bin'); writeFileSync(rnd, Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) & 255)))
await check('ERR-1', 'errors', 'binary files (NUL bytes) are refused with "Not a text file." and no tab opens', async () => {
    for (const f of [binf, rnd]) {
        await ui.toastClear(win)
        const before = (await ui.tabsInfo(win)).length
        await ui.openViaDialog(app, win, f)
        await ui.waitToast(win, /Not a text file\./)
        eq((await ui.tabsInfo(win)).length, before, 'tab opened for ' + basename(f))
    }
    assert(/\[error\].*read-file/.test(logOf(U1)), 'no [error] read-file line')
}, { smoke: true })
await check('ERR-2', 'errors', 'unreadable files surface their reason: mode 000 and symlink->/etc/shadow give "Permission denied."', async () => {
    const f = join(W, 'noperm.md'); writeFileSync(f, 'x'); chmodSync(f, 0)
    const sh = join(W, 'shadow-symlink.md'); symlinkSync('/etc/shadow', sh)
    for (const p of [f, sh]) {
        await ui.toastClear(win); await ui.openViaDialog(app, win, p)
        await ui.waitToast(win, /Permission denied\./)
    }
    await ui.toastClear(win); await ui.openViaDialog(app, win, join(W, 'does-not-exist.md')); await ui.waitToast(win, /File not found\./)
    await ui.toastClear(win); await ui.openViaDialog(app, win, W); await ui.waitToast(win, /folder, not a file/)
    // app keeps working
    await ui.openViaDialog(app, win, granted); await waitFor(async () => (await ui.activeTitle(win)) === 'granted.md', { what: 'open after errors' })
    chmodSync(f, 0o644)
}, { smoke: true })
const ro = join(W, 'readonly.md'); writeFileSync(ro, 'ro\n'); chmodSync(ro, 0o444)
await check('ERR-3', 'errors', 'Save to a read-only file toasts "Permission denied.", keeps typed text and the dirty mark', async () => {
    await ui.openViaDialog(app, win, ro); await waitFor(async () => (await ui.activeTitle(win)) === 'readonly.md', { what: 'ro open' })
    await sleep(400); await ui.toastClear(win); await ui.typeAtEnd(win, 'KEEPME'); await win.keyboard.press('Control+s')
    await ui.waitToast(win, /Permission denied\./)
    assert((await ui.tabsInfo(win)).find(t => t.active).dirty, 'dirty mark cleared')
    assert((await ui.editorText(win)).includes('KEEPME'), 'typed text lost')
    eq(readFileSync(ro, 'utf8'), 'ro\n')
}, { smoke: true })
await check('ERR-4', 'errors', 'long error toast stays inside a narrow window', async () => {
    const long = join(W, 'r'.repeat(150) + '.md'); writeFileSync(long, 'ro\n'); chmodSync(long, 0o444)
    await ui.openViaDialog(app, win, long); await sleep(600)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => /index\.html/.test(w.webContents.getURL())).setSize(480, 640)); await sleep(500)
    await ui.toastClear(win); await ui.typeAtEnd(win, 'z'); await win.keyboard.press('Control+s')
    await ui.waitToast(win, /Permission denied/)
    await sleep(500)
    const box = await win.evaluate(() => { const t = [...document.querySelectorAll('[class*=toast]')].find(e => e.innerText); const r = t.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: t.scrollWidth, cw: t.clientWidth } })
    assert(box.l >= 0 && box.r <= box.w + 0.5, 'toast outside window ' + JSON.stringify(box))
    assert(box.sw <= box.cw + 1, 'toast text clipped ' + JSON.stringify(box))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => /index\.html/.test(w.webContents.getURL())).setSize(1200, 800))
})

// recent
await check('RECENT-1', 'recent', 'opened files are listed under File > Recent', async () => {
    await win.getByText('File', { exact: true }).first().click()
    await win.getByText('Recent', { exact: true }).hover()
    const t = await win.evaluate(() => document.body.innerText)
    assert(t.includes('granted.md') && t.includes('crlf-bom.md'), 'recent list missing entries')
    await win.keyboard.press('Escape'); await win.mouse.click(600, 785)
})
await check('RECENT-2', 'recent', 'recent entry whose file is gone: confirm dialog; Cancel drops it, Locate opens the picker', async () => {
    const gone = join(W, 'gone-soon.md'); writeFileSync(gone, 'bye\n')
    await ui.openViaDialog(app, win, gone); await waitFor(async () => (await ui.activeTitle(win)) === 'gone-soon.md', { what: 'open' })
    await win.keyboard.press('Control+w'); await sleep(400); rmSync(gone)
    const openRecent = async () => { await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover(); await win.locator('[class*=submenu] >> text=gone-soon.md').first().click() }
    await openRecent()
    await waitFor(() => win.getByText(/Pick a new location/).count(), { what: 'locate confirm' })
    await win.getByRole('button', { name: 'Cancel' }).click(); await sleep(400)
    await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover()
    assert(!(await win.evaluate(() => document.body.innerText)).includes('gone-soon.md'), 'entry still in Recent after Cancel')
    await win.keyboard.press('Escape'); await win.mouse.click(600, 785)
    assert(/read: missing .*gone-soon\.md/.test(logOf(U1)), 'no read: missing log')
})
await check('RECENT-4', 'recent', 'Locate... on the missing-file confirm opens the file picker', async () => {
    const gone = join(W, 'gone-two.md'); writeFileSync(gone, 'bye2\n')
    await ui.openViaDialog(app, win, gone); await waitFor(async () => (await ui.activeTitle(win)) === 'gone-two.md', { what: 'open' })
    await win.keyboard.press('Control+w'); await sleep(400); rmSync(gone)
    await app.evaluate(({ dialog }) => { globalThis.__picker = 0; dialog.showOpenDialog = async () => { globalThis.__picker++; return { canceled: true, filePaths: [] } } })
    await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover(); await win.locator('[class*=submenu] >> text=gone-two.md').first().click()
    await waitFor(() => win.getByText(/Pick a new location/).count(), { what: 'locate confirm' })
    assert(await app.evaluate(() => globalThis.__picker) === 0, 'picker opened before the user confirmed')
    await win.getByRole('button', { name: /Locate/ }).click()
    await waitFor(() => app.evaluate(() => globalThis.__picker >= 1), { what: 'picker after Locate' })
})
await check('RECENT-3', 'recent', 'recent entry that now fails with a permission error shows the reason and keeps the entry', async () => {
    const f = join(W, 'perm-later.md'); writeFileSync(f, 'p\n')
    await ui.openViaDialog(app, win, f); await waitFor(async () => (await ui.activeTitle(win)) === 'perm-later.md', { what: 'open' })
    await win.keyboard.press('Control+w'); await sleep(400); chmodSync(f, 0)
    await ui.toastClear(win)
    await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover()
    await win.locator('[class*=submenu] >> text=perm-later.md').first().click()
    await ui.waitToast(win, /Permission denied/)
    await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover()
    assert((await win.evaluate(() => document.body.innerText)).includes('perm-later.md'), 'entry was dropped')
    await win.keyboard.press('Escape'); await win.mouse.click(600, 785); chmodSync(f, 0o644)
})

// drag and drop
const dropA = join(W, 'dropped-a.md'); writeFileSync(dropA, 'dropped A body\r\nline2\r\n')
const dropB = join(W, 'dropped-b.md'); writeFileSync(dropB, 'dropped B body\n')
await check('DND-1', 'drag-drop', 'real file drop (CDP drag with native path) opens a tab, does not paste into the current tab, adds Recent, grants Save', async () => {
    const before = await ui.tabsInfo(win); const prevText = await ui.editorText(win)
    await ui.dropFiles(win, [dropA])
    await waitFor(async () => (await ui.activeTitle(win)) === 'dropped-a.md', { what: 'dropped tab' })
    assert((await ui.editorText(win)).includes('dropped A body'), 'content missing')
    const titles = (ts) => ts.map(t => t.title).sort(); const after = titles(await ui.tabsInfo(win)); const exp = titles([...before, { title: 'dropped-a.md' }])
    eq(after, exp, 'tab titles after the drop')
    assert(!prevText.includes('dropped A body'))
    assert((await ui.status(win)).includes('CRLF'), 'status EOL for dropped CRLF file')
    assert(/open: dropped .*dropped-a\.md/.test(logOf(U1)), 'no open: dropped log')
    await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover()
    assert((await win.evaluate(() => document.body.innerText)).includes('dropped-a.md'), 'not in Recent')
    await win.keyboard.press('Escape'); await win.mouse.click(600, 785)
    await ui.stubSave(app, join(W, 'x.md')); await ui.typeAtEnd(win, 'Q'); await win.keyboard.press('Control+s')
    await waitFor(() => readFileSync(dropA, 'utf8').endsWith('Q'), { what: 'dropped file saved in place' })
    eq(await ui.saveCalls(app), 0)
    return 'OS drop simulated via CDP Input.dispatchDragEvent with file paths (real File objects with native paths)'
}, { smoke: true })
await check('DND-2', 'drag-drop', 'dropping two files opens two tabs; dropping a binary toasts "Not a text file."', async () => {
    const before = (await ui.tabsInfo(win)).length
    await ui.dropFiles(win, [dropB, join(W, 'granted.md')]); await sleep(1200)
    eq((await ui.tabsInfo(win)).length, before + 2, 'tab count after 2-file drop')
    await ui.toastClear(win); await ui.dropFiles(win, [binf]); await ui.waitToast(win, /Not a text file/)
})
await check('DND-3', 'drag-drop', 'dropping TEXT (not a file) inserts at the caret and opens no tab', async () => {
    const before = (await ui.tabsInfo(win)).length
    await ui.focusEditor(win)
    const cdp = await win.context().newCDPSession(win)
    const data = { items: [{ mimeType: 'text/plain', data: 'DROPPED-TEXT-123' }], files: [], dragOperationsMask: 1 }
    const box = await ed().boundingBox()
    for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, x: box.x + 40, y: box.y + 10, data })
    await sleep(500)
    eq((await ui.tabsInfo(win)).length, before, 'a tab opened for a text drop')
    assert((await ui.editorText(win)).includes('DROPPED-TEXT-123'), 'text not inserted')
})

// tabs
await check('TAB-1', 'tabs', 'many tabs scroll inside the list; the + button stays visible and unobstructed', async () => {
    for (let i = 0; i < 30; i++) await win.keyboard.press('Control+n')
    await sleep(600)
    const r = await win.evaluate(() => {
        const list = document.querySelector('[class*=tabsList]'); const b = document.querySelector('[title^="New Tab"]'); const br = b.getBoundingClientRect()
        const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2)
        return { scrolls: list.scrollWidth > list.clientWidth, visible: br.left >= 0 && br.right <= innerWidth && br.width > 0, hit: !!hit?.closest('[title^="New Tab"]'), listRight: list.getBoundingClientRect().right, btnLeft: br.left }
    })
    assert(r.scrolls, 'tab list does not scroll with 30+ tabs'); assert(r.visible, '+ button out of view'); assert(r.hit, '+ button covered'); assert(r.listRight <= r.btnLeft + 1, 'tabs overlap +')
    await win.screenshot({ path: join(here, '../../Docs/internal/e2e/shots', `${target}-many-tabs.png`) })
})

// A cancelled navigation leaves Playwright 'waiting for navigation', so this runs in its own throwaway launch.
{
    const Un = tmp('nf-un-'); cleanup.push(Un)
    const r = await L(Un)
    await check('SEC-6b', 'security', 'will-navigate to a foreign https origin is cancelled and sent to the OS browser', async () => {
        await r.app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = async (u) => { globalThis.__ext.push(u) } })
        r.win.evaluate(() => { location.href = 'https://example.org/nav' }).catch(() => {})
        await waitFor(async () => (await r.app.evaluate(() => globalThis.__ext)).includes('https://example.org/nav'), { what: 'openExternal for navigation' })
        assert(/index\.html/.test(r.win.url()), 'page navigated away: ' + r.win.url())
    })
    await r.app.close().catch(() => {})
}
    await check('LOG-2', 'log', 'no file content reaches main.log (E2)', async () => {
        const t = logOf(U1)
        for (const needle of ['granted original', 'added line', 'KEEPME', 'dropped A body', 'brand new', 'DROPPED-TEXT-123']) assert(!t.includes(needle), 'log contains file content: ' + needle)
    }, { smoke: true })
    await check('LOG-3', 'log', 'every [error] line in main.log is explained by a deliberate action or the update check (E1)', async () => {
        const errs = logOf(U1).split('\n').filter(l => /\[error\]/.test(l))
        const odd = errs.filter(l => !/read-file|read-file-content|save-file|Electron open error|Failed to open|Failed to save|Not a text file|Permission denied|EACCES|File not found|ENOENT|folder|EISDIR|Unauthorized|unauthorized|Access denied|Auto ?Updater|update|Update|No published versions|Could not (open|save)|Running the JavaScript URL violates|\[renderer\] Failed to load resource/.test(l))
        assert(odd.length === 0, 'unexplained [error] lines: ' + odd.slice(0, 3).join(' || '))
        return errs.length + ' error lines, all explained'
    })
    await check('UPD-1', 'log', 'the startup update check does not fail on a missing app-update.yml (INST-9); any remaining update lines are listed', async () => {
        const t = logOf(U1); assert(!/app-update\.yml/.test(t), 'app-update.yml error in the log: ' + (t.match(/.*app-update\.yml.*/) || [''])[0].slice(0, 160))
        const upd = t.split('\n').filter(l => /updat/i.test(l) && /error|warn/i.test(l)); return upd.length ? 'update lines: ' + upd.slice(0, 2).join(' || ').slice(0, 300) : 'no update warnings or errors'
    })
    await check('LOG-4', 'log', 'authorized-paths.json lists only files opened/saved/dropped in the run (+ the seeded dir/file); no stray folders (E3)', async () => {
        const g = JSON.parse(readFileSync(join(U1, 'authorized-paths.json'), 'utf8')).map(e => e.path ?? e)
        assert(Array.isArray(g) && g.length > 5, 'grants: ' + JSON.stringify(g))
        // W itself is granted because ERR-2 makes the STUBBED picker return a directory; the real openFile dialog cannot. (read-file grants before it stats.)
        const stray = g.filter(p => ![granted, gdir, swapped, W, join(linkdir, 'n.md')].includes(p) && (!p.startsWith(W) || (existsSync(p) && statSync(p).isDirectory())))
        assert(stray.length === 0, 'unexpected grants: ' + stray.join(', ')); assert(!g.some(p => p.startsWith('/etc')), 'grant for /etc')
        return g.length + ' grants'
    })
    await win.screenshot({ path: join(shots, `${target}-core.png`) }).catch(() => {})
    await app.close().catch(() => {})
} // end core

// ---------------------------------------------------------------- scenario: live preview
const walk = (d, out = []) => { for (const n of readdirSync(d, { withFileTypes: true })) { const f = join(d, n.name); n.isDirectory() ? walk(f, out) : out.push(f) } return out }
if (want('lp')) {
    const Ulp = tmp('nf-lp-u-'), Wlp = tmp('nf-lp-w-'); cleanup.push(Ulp, Wlp)
    const { app, win } = await L(Ulp)
    const doc = async (name, text) => {
        const f = join(Wlp, name + '.md'); writeFileSync(f, text)
        await ui.openViaDialog(app, win, f)
        await waitFor(async () => (await ui.activeTitle(win)) === name + '.md', { what: 'tab ' + name })
        await sleep(900)
        return f
    }
    const lines = () => win.evaluate(() => [...document.querySelectorAll('.cm-content .cm-line')].map(l => l.innerText))
    const imgs = () => win.evaluate(() => [...document.querySelectorAll('.cm-content img.cm-image')].map(i => ({ src: i.getAttribute('src').slice(0, 60), nw: i.naturalWidth, inA: !!i.closest('a') })))

    await check('LP-1', 'live preview', 'closed ATX heading hides trailing ##; setext underlines (=== / ---) hidden', async () => {
        await doc('atx', 'first\n\n## Closed ATX ##\n\nSetext One\n===\n\nSetext Two\n---\n\nend\n')
        const l = await lines()
        assert(l.includes('Closed ATX'), 'ATX line: ' + JSON.stringify(l))
        assert(l.includes('Setext One') && l.includes('Setext Two'), 'setext titles missing')
        assert(!l.some(x => /^(===|---|#)/.test(x.trim())), 'raw marker visible: ' + JSON.stringify(l))
    }, { smoke: true })
    await check('LP-2', 'live preview', 'markdown inside ```markdown / ```md fences stays raw', async () => {
        await doc('fence', 'first\n\n```markdown\n# not a heading\n**not bold**\n```\n\n```md\n## also raw\n```\n\nend\n')
        const l = await lines()
        assert(l.includes('# not a heading') && l.includes('**not bold**') && l.includes('## also raw'), JSON.stringify(l))
    })
    await check('LP-3', 'live preview', 'backslash escapes and HTML entities render as the literal character; <autolink> hides angle brackets', async () => {
        await doc('esc', 'first\n\n\\*lit\\* &amp; &#39; &lt;\n\n<https://example.com/auto>\n\nend\n')
        const t = (await lines()).join('\n')
        assert(t.includes("*lit* & ' <"), 'escapes/entities: ' + JSON.stringify(t))
        assert(t.includes('https://example.com/auto') && !t.includes('<https'), 'autolink brackets: ' + JSON.stringify(t))
    }, { smoke: true })
    await check('LP-4', 'live preview', 'titled image ![a](url "title") loads (title stripped); ref image, linked image [![a](img)](url), ref + inline image on one line all render', async () => {
        await doc('imgs', `first\n\n![titled](${PNG} "the title")\n\n![ref img][pic]\n\n[pic]: ${PNG}\n\n[![badge](${PNG})](https://example.com/x)\n\n![r][pic] ![i](${PNG})\n\nend\n`)
        const im = await imgs()
        assert(im.length >= 5, `expected >=5 rendered images, got ${im.length}: ` + JSON.stringify(im))
        assert(im.every(i => i.nw > 0), 'an image failed to load: ' + JSON.stringify(im))
    })
    await check('LP-4b', 'live preview', '[![alt](img)](url) is a clickable image: Ctrl+click opens the URL externally (a plain [text](url) link is the control)', async () => {
        await doc('badge', `first\n\n[plain](https://example.com/plain)\n\n[![badge](${BIG})](https://example.com/x)\n\nend\n`)
        await app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = async (u) => { globalThis.__ext.push(u) } })
        await win.locator('.cm-content a.cm-link').first().click({ modifiers: ['Control'] }); await sleep(700)
        assert((await app.evaluate(() => globalThis.__ext)).includes('https://example.com/plain'), 'CONTROL failed: Ctrl+click on a plain link opened nothing, so this check proves nothing')
        await win.locator('.cm-content img.cm-image').first().click({ modifiers: ['Control'] }); await sleep(700)
        const ext = await app.evaluate(() => globalThis.__ext)
        assert(ext.includes('https://example.com/x'), 'Ctrl+click on the linked image opened: ' + JSON.stringify(ext))
    })
    await check('LP-4c', 'live preview', 'linked-image click handling: reference form opens its URL; a bare image, a plain click, and unsafe schemes (javascript:, file:) open nothing', async () => {
        await doc('badge2', `first\n\n[![r][pic]][site]\n\n![bare](${BIG})\n\n[![j](${BIG})](javascript:alert(1))\n\n[![f](${BIG})](file:///etc/passwd)\n\n[pic]: ${BIG}\n[site]: https://example.com/ref\n\nend\n`)
        await app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = async (u) => { globalThis.__ext.push(u) } })
        const ims = win.locator('.cm-content img.cm-image'); eq(await ims.count(), 4, 'image count')
        await ims.nth(0).click({ modifiers: ['Control'] }); await sleep(600)
        eq(await app.evaluate(() => globalThis.__ext), ['https://example.com/ref'], 'reference-form linked image')
        for (const i of [1, 2, 3]) { await ims.nth(i).click({ modifiers: ['Control'] }); await sleep(400) }
        await ims.nth(0).click(); await sleep(400)
        eq(await app.evaluate(() => globalThis.__ext), ['https://example.com/ref'], 'something else opened')
    })
    await check('LP-5', 'live preview', 'tables honour :-- / :-: / --: alignment, \\| is a literal pipe, table inside a blockquote renders; titled link in a cell is clean', async () => {
        await doc('tbl', 'first\n\n| L | C | R |\n|:--|:-:|--:|\n| a | b | c |\n| x \\| y | [lk](https://example.com "tt") | 3 |\n\n> | q1 | q2 |\n> |---|---|\n> | 1 | 2 |\n\nend\n')
        const r = await win.evaluate(() => {
            const tabs = [...document.querySelectorAll('.cm-content .cm-table-widget table')]
            const t = tabs[0]
            return { n: tabs.length, th: [...t.querySelectorAll('th')].map(e => e.className), td: [...t.querySelectorAll('tbody tr:last-child td')].map(e => e.innerText + '|' + e.className),
                href: t.querySelector('a')?.getAttribute('href') }
        })
        eq(r.th, ['cm-align-left', 'cm-align-center', 'cm-align-right'])
        assert(r.td[0].startsWith('x | y|'), 'pipe cell: ' + r.td[0])
        eq(r.href, 'https://example.com', 'link href in cell')
        assert(r.n >= 2, 'blockquote table not rendered (tables=' + r.n + ')')
    })
    await check('LP-6', 'live preview', 'nested blockquotes get one bar per level (depth 1/2/3 classes); ordered list 1./1./1. renumbers 1./2./3.', async () => {
        await doc('quote', 'first\n\n> one\n> > two\n> > > three\n\n1. a\n1. b\n1. c\n\nend\n')
        const r = await win.evaluate(() => ({
            depth: [1, 2, 3].map(d => document.querySelectorAll('.cm-blockquote-depth-' + d).length),
            bars3: (() => { const l = [...document.querySelectorAll('.cm-blockquote-depth-3')].pop(); return l ? l.querySelectorAll('span[contenteditable=false]').length : 0 })(),
            ord: [...document.querySelectorAll('.cm-ordered-marker')].map(e => e.innerText) }))
        assert(r.depth.every(n => n > 0), 'depth classes: ' + JSON.stringify(r.depth)); assert(r.bars3 >= 3, 'bars on level-3 line: ' + r.bars3)
        eq(r.ord, ['1.', '2.', '3.'])
    })
    await check('LP-7', 'live preview', 'GFM [X] and [x] render checked, [ ] unchecked; clicking a checkbox rewrites the source to [x] (bytes after save)', async () => {
        const f = await doc('tasks', 'first\n\n- [X] upper\n- [x] lower\n- [ ] open\n\nend\n')
        const st = await win.evaluate(() => [...document.querySelectorAll('.cm-content input.cm-checkbox')].map(c => c.checked))
        eq(st, [true, true, false], 'checkbox states')
        await win.locator('.cm-content input.cm-checkbox').nth(2).click()
        await win.keyboard.press('Control+s')
        await waitFor(() => /- \[x\] open/.test(readFileSync(f, 'utf8')), { what: 'toggled source on disk' })
    })
    await check('LP-8', 'live preview', 'reference links resolve ([ref][r]); links with no definition stay literal text', async () => {
        await doc('refs', 'first\n\n[ref][r]\n\n[r]: https://example.com\n\n[t][nope] and [word]\n\nend\n')
        const r = await win.evaluate(() => ({ href: document.querySelector('.cm-content a.cm-link')?.getAttribute('href'), text: document.querySelector('.cm-content').innerText }))
        eq(r.href, 'https://example.com'); assert(r.text.includes('[t][nope] and [word]'), 'undefined refs not literal: ' + r.text)
    })
    await check('LP-9', 'live preview', 'image URL with spaces ![a](my pic.png) does not crash; editor stays usable', async () => {
        await doc('spaceimg', 'first\n\n![sp](my pic.png)\n\nend\n')
        const broken = await win.evaluate(() => !!document.querySelector('.cm-image-broken, img.cm-image'))
        await ui.typeAtEnd(win, 'ok-typed'); assert((await ui.editorText(win)).includes('ok-typed'), 'cannot type after')
        return 'renders as ' + (broken ? 'image/broken-image placeholder' : 'plain text') + ' (CommonMark treats it as literal text)'
    })
    await check('LP-10', 'live preview', 'image split across a newline ![a](\\nfoo.png) does not break the editor: new tab shows ITS text, typing goes to it', async () => {
        await doc('prev', 'PREV-DOC-MARKER\n')
        const f = await doc('splitimg', 'first\n\n![split](\nbroken.png)\n\nSPLIT-END\n')
        const t = await ui.editorText(win)
        assert(t.includes('SPLIT-END') && !t.includes('PREV-DOC-MARKER'), 'editor still shows the previous document: ' + JSON.stringify(t.slice(0, 80)))
    })
    await check('LP-11', 'live preview', 'document > 10k chars is decorated to the very end (headings, table at the end render)', async () => {
        let body = 'intro\n\n'; for (let i = 0; i < 700; i++) body += `## Heading ${i}\n\npara ${i} with **bold** text\n\n`
        body += '| T1 | T2 |\n|---|---|\n| end1 | end2 |\n\ntheend\n'
        assert(body.length > 10000)
        await doc('long', body)
        await ui.focusEditor(win); await win.keyboard.press('Control+End'); await sleep(1200)
        const r = await win.evaluate(() => ({ t: document.querySelector('.cm-content').innerText, tables: document.querySelectorAll('.cm-table-widget').length, bold: document.querySelectorAll('.cm-content strong, .cm-content [class*=bold]').length }))
        assert(r.t.includes('para 699') || r.t.includes('theend'), 'not at the end')
        assert(!/(^|\n)##? Heading/.test(r.t), 'raw ## visible near the end of a long doc')
        assert(r.tables >= 1, 'table at the end not rendered'); assert(!r.t.includes('**bold**'), 'raw ** visible near the end')
    })
    await check('RTL-1', 'editor', 'mixed RTL/LTR caret: no more x-jumps than stock CodeMirror (+perLineTextDirection, +per-line dir) in the same Chromium, every position visited once, Shift+Arrow grows contiguously', async () => {
        await doc('rtl', 'abc שלום עולם def ghi\nשורה שניה with english\n')
        await ui.focusEditor(win); await win.keyboard.press('Control+Home'); await win.keyboard.press('Home')
        const probe = () => win.evaluate(() => { const s = getSelection(); let x = null; if (s.rangeCount) { const r = s.getRangeAt(0).cloneRange(); r.collapse(true); const q = r.getClientRects()[0] || r.getBoundingClientRect(); if (q && q.height > 0) x = q.left } return { x, col: Number(([...document.querySelector('[class*=statusBar]').children][1].innerText.match(/Col (\d+)/) || [])[1]) } })
        // Shift+Arrow: never an empty selection mid-way; length changes by one glyph per key except at the (at most 2) bidi run boundaries
        await win.keyboard.press('Home'); const lens = []
        for (let i = 0; i < 12; i++) { await win.keyboard.press('Shift+ArrowRight'); lens.push(await win.evaluate(() => window.getSelection().toString().length)) }
        const big = lens.filter((l, i) => Math.abs(l - (i ? lens[i - 1] : 0)) > 1).length
        assert(lens.every(l => l > 0) && big <= 2, `selection growth ${lens.join(',')} (${big} jumps)`)
        await win.keyboard.press('ArrowRight')
        await win.keyboard.press('Home')
        const app_ = []; for (let i = 0; i < 22; i++) { app_.push(await probe()); await win.keyboard.press('ArrowRight') }
        const ctl = {}; for (const m of ['stock', 'perline', 'perline-dir']) ctl[m] = await stockCaretSequence(app, m)
        const dx = (seq) => seq.slice(1).map((o, i) => { const d = o.x - seq[i].x; return Math.abs(d) < 0.5 ? 0 : d > 0 ? '+' : '-' }).join('')
        const jumps = (seq) => seq.slice(1).filter((o, i) => Math.abs(o.x - seq[i].x) > 40).length   // > ~4 glyphs in one key press
        const ctlJumps = Object.fromEntries(Object.entries(ctl).map(([k, v]) => [k, jumps(v)]))
        assert(new Set(Object.values(ctlJumps)).size === 1, 'controls disagree: ' + JSON.stringify(ctlJumps))
        const note = `caret x-jumps (>40px per key): app ${jumps(app_)} vs stock CodeMirror ${ctlJumps['perline-dir']} (stock, +perLineTextDirection, +per-line dir all agree). app cols ${app_.map(o => o.col).join(',')}; stock heads ${ctl['perline-dir'].map(o => o.head).join(',')}. The app orders positions visually, stock logically, so the sequences are NOT identical; both jump at the two bidi run boundaries (upstream CodeMirror/Chromium limitation)`
        assert(jumps(app_) <= ctlJumps['perline-dir'], 'app jumps more than stock CodeMirror. ' + note)
        assert(new Set(app_.map(o => o.col)).size >= 20, 'caret skipped positions: ' + app_.map(o => o.col))
        return note
    })
    await check('LP-12', 'security', 'Ctrl+click on [x](file:///etc/passwd) opens nothing (unsafe scheme blocked) and logs it (C4)', async () => {
        await doc('badlink', 'first\n\n[x](file:///etc/passwd) [j](javascript:alert(1)) [ok](https://example.com/ok)\n\nend\n')
        await app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = async (u) => { globalThis.__ext.push(u) } })
        const wins0 = (await ui.mainWindows(app)).length
        const links = win.locator('.cm-content a.cm-link')
        for (let i = 0; i < await links.count(); i++) { await links.nth(i).click({ modifiers: ['Control'] }); await sleep(400) }
        const ext = await app.evaluate(() => globalThis.__ext)
        assert(ext.includes('https://example.com/ok'), 'CONTROL: https link did not open: ' + JSON.stringify(ext))
        assert(!ext.some(u => /^(file|javascript):/.test(u)), 'unsafe URL opened: ' + JSON.stringify(ext)); eq((await ui.mainWindows(app)).length, wins0, 'window opened')
    })
    await check('EXPORT-1', 'export', 'File > Export to HTML and Export to PDF write real files (save dialog stubbed)', async () => {
        await doc('exp', 'first\n\n# Export Title\n\nbody **bold** text\n')
        for (const [label, ext, test] of [['Export to HTML', 'html', (b) => /<h1[^>]*>Export Title/.test(b.toString('utf8')) && /<strong>bold/.test(b.toString('utf8'))], ['Export to PDF', 'pdf', (b) => b.subarray(0, 5).toString('latin1') === '%PDF-']]) {
            const dst = join(Wlp, 'out.' + ext); await ui.stubSave(app, dst)
            await win.getByText('File', { exact: true }).first().click(); await win.getByText(label, { exact: true }).click()
            await waitFor(() => existsSync(dst) && readFileSync(dst).length > 100, { timeout: 20000, what: label + ' file' })
            assert(test(readFileSync(dst)), label + ' content wrong: ' + readFileSync(dst).subarray(0, 60).toString('latin1'))
        }
        return 'native print dialog (Ctrl+P) is not automatable; window.print wiring checked in PRINT-1'
    })
    await check('PRINT-1', 'export', 'Ctrl+P calls window.print()', async () => {
        await win.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++ } })
        await ui.focusEditor(win); await win.keyboard.press('Control+p'); await sleep(500)
        assert(await win.evaluate(() => window.__printed) >= 1, 'window.print not called')
    })
    const perf = async (name, lines) => {
        const big = join(Wlp, name + '.md'); writeFileSync(big, lines.join('\n') + '\n')
        const t0 = Date.now(); await ui.openViaDialog(app, win, big)
        await waitFor(async () => (await ui.activeTitle(win)) === name + '.md', { timeout: 30000, what: name + ' tab' })
        await win.locator('.cm-content').click({ timeout: 60000 }); const clickMs = Date.now() - t0
        await win.keyboard.press('Control+End'); await sleep(800)
        const lat = []
        for (const ch of 'typing near the end now') { const t = Date.now(); await win.keyboard.type(ch); await win.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))); lat.push(Date.now() - t) }
        const sorted = [...lat].sort((a, b) => a - b)
        return { size: statSync(big).size, clickMs, median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1), avg: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) }
    }
    let plainMedian = 0
    await check('PERF-1', 'perf', '1.3 MB plain markdown file opens in a few seconds; typing near the end stays responsive (B11)', async () => {
        const r = await perf('large-plain', Array.from({ length: 16500 }, (_, i) => (i % 40 === 0 ? `## Section ${i}` : `line ${i} - lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor`)))
        plainMedian = r.median
        assert(r.clickMs < 8000, 'open + first click took ' + r.clickMs + 'ms'); assert(r.median < 250 && r.max < 1500, `typing latency median ${r.median}ms max ${r.max}ms`)
        return `${r.size} bytes, interactive after ${r.clickMs}ms, typing median ${r.median}ms max ${r.max}ms (software-rendered Xephyr)`
    })
    const dense = (n, gap) => Array.from({ length: n }, (_, i) => (gap && i % gap === gap - 1 ? '' : `line ${i} - lorem ipsum dolor sit amet, **bold** and a [link](https://example.com/${i})`))
    // PERF-2 guards the fastLinkEnd fix (c4afbda). Before it: typing median ~2.4 s on the single-paragraph file (70x the plain file).
    // Two shapes: realistic paragraphs (must be near-plain) and one 1.3 MB paragraph (the quadratic LinkEnd case).
    // Medians over 23 keystrokes, with a threshold relative to the plain-file median measured in the same run so
    // slow software rendering scales both; absolute caps stay well under the old 2.4 s.
    await check('PERF-2a', 'perf', '1.3 MB of bold+link lines WITH paragraph breaks (every 8th line blank): typing median close to the plain file', async () => {
        const r = await perf('large-dense-paras', dense(14500, 8))
        const cap = Math.max(300, plainMedian * 8)
        assert(r.median < cap, `typing median ${r.median}ms (cap ${cap}ms = max(300, 8 x plain median ${plainMedian}ms)); max ${r.max}ms, open+click ${r.clickMs}ms`)
        return `${r.size} bytes, median ${r.median}ms, plain median ${plainMedian}ms`
    })
    await check('PERF-2', 'perf', '1.3 MB single paragraph, bold + link on every line (no blank lines): typing median stays far below the pre-fix level', async () => {
        const r = await perf('large-dense', dense(14500, 0))
        // Pre-fix in this same environment: median ~2400 ms and ~70x the plain-file median. Post-fix author figure ~500 ms;
        // measured here ~1.7 s (software-rendered Xephyr is slow, and noisy), i.e. ~20x plain. Guard: ratio < 40x plain AND < 2.0 s absolute.
        const ratio = r.median / Math.max(plainMedian, 1)
        assert(r.median < 2000 && ratio < 40, `typing median ${r.median}ms = ${ratio.toFixed(1)}x the plain-file median ${plainMedian}ms (limits: <2000ms and <40x; pre-fix ~2400ms / ~70x); max ${r.max}ms, open+click ${r.clickMs}ms`)
        return `${r.size} bytes, median ${r.median}ms (${ratio.toFixed(1)}x plain ${plainMedian}ms), max ${r.max}ms, open+click ${r.clickMs}ms`
    })
    await win.screenshot({ path: join(shots, `${target}-live-preview.png`) }).catch(() => {})
    await app.close().catch(() => {})
}

// ---------------------------------------------------------------- scenario: session restore, encryption, close handshake
if (want('session')) {
    const Us = tmp('nf-s-u-'), Ws = tmp('nf-s-w-'); cleanup.push(Us, Ws)
    const A = join(Ws, 'alpha.md'); writeFileSync(A, 'alpha\n')
    const DOT = join(Ws, 'my..notes.md'); writeFileSync(DOT, 'dot base\n')
    const BIG = join(Ws, 'long.md'); writeFileSync(BIG, Array.from({ length: 400 }, (_, i) => `line ${i} lorem ipsum dolor sit amet`).join('\n') + '\n')
    const MARK = 'UNSAVEDBODY' + Math.random().toString(36).slice(2, 12).toUpperCase()
    const TITLE = 'TITLELINE' + Math.random().toString(36).slice(2, 10).toUpperCase()
    const CONTROL = 'CONTROLPLAINTEXT' + Math.random().toString(36).slice(2, 14).toUpperCase()
    let r = await L(Us); let { app, win } = r
    await ui.openViaDialog(app, win, A); await waitFor(async () => (await ui.activeTitle(win)) === 'alpha.md', { what: 'alpha open' })
    await ui.openViaDialog(app, win, DOT); await waitFor(async () => (await ui.activeTitle(win)) === 'my..notes.md', { what: 'dot open' }); await sleep(400); await ui.typeAtEnd(win, 'DOT-EDIT')
    await win.locator('[class*=tabsList] > div', { hasText: 'alpha.md' }).click(); await sleep(400); await ui.typeAtEnd(win, 'EDIT-A')
    await win.keyboard.press('Control+n'); await sleep(300); await ui.typeAtEnd(win, TITLE); await win.keyboard.press('Enter'); await win.keyboard.type(MARK)
    await ui.openViaDialog(app, win, BIG); await waitFor(async () => (await ui.activeTitle(win)) === 'long.md', { what: 'long open' })
    await win.evaluate((c) => new Promise((res, rej) => { const q = indexedDB.open('e2e-control', 1); q.onupgradeneeded = () => q.result.createObjectStore('s'); q.onsuccess = () => { const t = q.result.transaction('s', 'readwrite'); t.objectStore('s').put(c, 'k'); t.oncomplete = () => res(); t.onerror = () => rej(t.error) } }), CONTROL)
    await sleep(1500)
    await win.screenshot({ path: join(shots, `${target}-session-before-close.png`) }).catch(() => {})
    const descendants = () => { try { const rows = execFileSync('ps', ['-eo', 'pid=,ppid=']).toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number)); const out = new Set([app.process().pid]); let grew = true; while (grew) { grew = false; for (const [pid, ppid] of rows) if (out.has(ppid) && !out.has(pid)) { out.add(pid); grew = true } } return [...out] } catch { return [] } }
    const pids = descendants()
    let closeRes
    await check('CLOSE-1', 'close', 'closing the window (X path) with dirty tabs is not blocked; exits via the flush handshake, no timeout fallback', async () => {
        closeRes = await ui.closeViaX(app)
        assert(closeRes.exited, 'process still running 10s after close (dirty tab blocked closing)')
        const t = logOf(Us); assert(/\bquit\b/.test(t), 'no quit line'); assert(!t.includes('did not confirm session flush'), 'handshake timed out')
        assert(closeRes.ms < 3000, 'close took ' + closeRes.ms + 'ms')
        await sleep(3000)
        const alive = pids.filter(pid => existsSync('/proc/' + pid) && !/Z/.test((readFileSync('/proc/' + pid + '/stat', 'utf8').split(') ')[1] || '')[0] || ''))
        assert(alive.length === 0, 'leftover processes 3s after quit (D8): ' + alive.join(','))
        return closeRes.ms + 'ms; ' + pids.length + ' processes, none left'
    }, { smoke: true })
    await app.close().catch(() => {})
    await check('ENC-1', 'encryption', 'session text is not readable as plaintext anywhere under userData (IndexedDB etc.); control: an unencrypted marker IS findable', async () => {
        const files = walk(Us).filter(f => !/\/logs\//.test(f))
        const find = (needle) => files.filter(f => { try { const b = readFileSync(f); return b.includes(Buffer.from(needle, 'utf8')) || b.includes(Buffer.from(needle, 'utf16le')) } catch { return false } })
        const leaks = [...find(MARK), ...find('EDIT-A'), ...find('lorem ipsum dolor')]  // bodies only; titles are ENC-2
        const ctl = find(CONTROL)
        assert(ctl.length > 0, 'INCONCLUSIVE: control marker not found in any file, so a plaintext search proves nothing')
        assert(leaks.length === 0, 'plaintext session content found in: ' + leaks.map(f => f.replace(Us, '<ud>')).join(', '))
        assert(files.some(f => /IndexedDB/.test(f)), 'no IndexedDB files at all')
        return 'control found in ' + ctl.length + ' file(s), session body text in 0'
    }, { smoke: true })
    await check('ENC-2', 'encryption', 'first line of an unsaved note (tab title) and file paths / names of open files are not stored as plaintext', async () => {
        const files = walk(Us).filter(f => !/\/logs\//.test(f) && /IndexedDB|Local Storage/.test(f))
        const hits = files.filter(f => { try { const b = readFileSync(f); return b.includes(Buffer.from(TITLE, 'utf8')) || b.includes(Buffer.from(Ws, 'utf8')) || b.includes(Buffer.from('alpha.md', 'utf8')) } catch { return false } })
        assert(hits.length === 0, 'first line of the unsaved note "' + TITLE + '" (stored as tab title) is plaintext in: ' + hits.map(f => f.replace(Us, '<ud>')).join(', '))
    })

    r = await L(Us); ({ app, win } = r)
    await sleep(1500)
    await check('SES-1', 'session', 'relaunch restores tabs, unsaved text, dirty marks and the active tab; no decrypt / allowlist errors in the log', async () => {
        const tabs = await ui.tabsInfo(win)
        for (const n of ['alpha.md', 'long.md']) assert(tabs.some(t => t.title === n), 'tab missing: ' + n + ' have ' + JSON.stringify(tabs.map(t => t.title)))
        assert(tabs.find(t => t.title === 'alpha.md').dirty, 'alpha.md lost dirty mark')
        eq(tabs.find(t => t.active).title, 'long.md', 'active tab')
        let found = false
        for (let i = 0; i < tabs.length; i++) { await win.locator('[class*=tabsList] > div').nth(i).click(); await sleep(250); if ((await ui.editorText(win)).includes(MARK)) found = true }
        assert(found, 'unsaved new-tab text not restored')
        const t = logOf(Us); assert(!/Failed to decrypt/i.test(t), 'decrypt failure in log'); assert(!/read: denied/.test(t), 'denied read in log')
    }, { smoke: true })
    await check('SES-2', 'session', 'restored file tab is still saveable in place without re-picking (QA 13): no dialog, no "not authorized", bytes on disk', async () => {
        await ui.stubSave(app, join(Ws, 'MUST-NOT.md'))
        await win.locator('[class*=tabsList] > div', { hasText: 'alpha.md' }).click(); await sleep(400)
        assert((await ui.editorText(win)).includes('EDIT-A'), 'restored text missing')
        await ui.toastClear(win); await win.keyboard.press('Control+s')
        await waitFor(() => readFileSync(A, 'utf8') === 'alpha\nEDIT-A', { what: 'in-place save of restored tab' })
        eq(await ui.saveCalls(app), 0, 'save dialog shown'); assert(!/not authorized/i.test(await ui.toastText(win)), 'authorization toast')
    }, { smoke: true })
    await check('DOTDOT-2', 'grants', 'a restored tab for a file name containing ".." (my..notes.md) is saveable in place after relaunch (grant persisted and re-read)', async () => {
        await ui.stubSave(app, join(Ws, 'MUST-NOT2.md'))
        await win.locator('[class*=tabsList] > div', { hasText: 'my..notes.md' }).click(); await sleep(400)
        assert((await ui.editorText(win)).includes('DOT-EDIT'), 'restored text missing'); assert(!(await ui.tabsInfo(win)).find(t => t.title === 'my..notes.md').missing, 'marked missing')
        await win.keyboard.press('Control+s')
        await waitFor(() => readFileSync(DOT, 'utf8') === 'dot base\nDOT-EDIT', { what: 'in-place save of my..notes.md' }); eq(await ui.saveCalls(app), 0)
    })
    const MV = join(Ws, 'moved-me.md'), GONE = join(Ws, 'gone-soon.md'); writeFileSync(MV, 'moved body\n'); writeFileSync(GONE, 'gone body\n')
    await ui.openViaDialog(app, win, MV); await waitFor(async () => (await ui.activeTitle(win)) === 'moved-me.md', { what: 'mv open' }); await sleep(400)
    await ui.openViaDialog(app, win, GONE); await waitFor(async () => (await ui.activeTitle(win)) === 'gone-soon.md', { what: 'gone open' }); await sleep(1200)
    await ui.closeViaX(app); await app.close().catch(() => {})
    const MOVED = join(Ws, 'moved-away.md'); renameSync(MV, MOVED); rmSync(GONE)
    r = await L(Us); ({ app, win } = r); await sleep(2000)
    await check('SES-3', 'session', 'restored tab whose file was moved/deleted shows the warning mark (tab text kept); log has file-exists: missing', async () => {
        const tabs = await ui.tabsInfo(win)
        for (const n of ['moved-me.md', 'gone-soon.md']) assert(tabs.find(t => t.title === n)?.missing, n + ' not marked missing: ' + JSON.stringify(tabs))
        assert(!tabs.find(t => t.title === 'alpha.md').missing, 'untouched file wrongly marked')
        assert(/file-exists: missing .*moved-me\.md/.test(logOf(Us)), 'no log line')
        await win.locator('[class*=tabsList] > div', { hasText: 'moved-me.md' }).click(); await sleep(300)
        assert((await ui.editorText(win)).includes('moved body'), 'text of missing-file tab lost')
        await win.screenshot({ path: join(shots, `${target}-missing-file-tab.png`) }).catch(() => {})
    })
    await check('SES-4', 'session', 'Ctrl+S on a missing-file tab routes to Save As (new location), writes there, clears the mark', async () => {
        const dst = join(Ws, 'relocated.md'); await ui.stubSave(app, dst)
        await win.keyboard.press('Control+s')
        await waitFor(() => existsSync(dst), { what: 'Save As target' })
        eq(await ui.saveCalls(app), 1, 'Save As dialog count'); assert(!existsSync(join(Ws, 'moved-me.md')), 'file recreated at the old path')
        eq(readFileSync(dst, 'utf8'), 'moved body\n')
        await waitFor(async () => !(await ui.tabsInfo(win)).find(t => t.title === 'relocated.md')?.missing, { what: 'mark cleared' })
    })
    await check('SES-5', 'recent', 'after a relaunch, a file opened in the previous run opens from File > Recent directly: no picker, no error, no denied read (D6)', async () => {
        await ui.toastClear(win)
        await app.evaluate(({ dialog }) => { globalThis.__picker = 0; dialog.showOpenDialog = async () => { globalThis.__picker++; return { canceled: true, filePaths: [] } } })
        const n0 = (await ui.tabsInfo(win)).filter(t => t.title === 'alpha.md').length
        await win.getByText('File', { exact: true }).first().click(); await win.getByText('Recent', { exact: true }).hover()
        await win.locator('[class*=submenu] >> text=alpha.md').first().click()
        await waitFor(async () => (await ui.tabsInfo(win)).filter(t => t.title === 'alpha.md').length === n0 + 1, { what: 'alpha.md tab from Recent' })
        eq(await app.evaluate(() => globalThis.__picker), 0, 'picker opened'); assert(!/read: denied/.test(logOf(Us)), 'denied read in log'); assert((await ui.toastText(win)).trim() === '', 'toast: ' + await ui.toastText(win))
    })
    await app.close().catch(() => {})
}

// ---------------------------------------------------------------- scenario: close races
if (want('close')) {
    for (const via of ['x', 'menu-exit', 'menu-close-window']) {
        const Uc = tmp('nf-c-u-'), Wc = tmp('nf-c-w-'); cleanup.push(Uc, Wc)
        const F = join(Wc, 'dirty.md'); writeFileSync(F, 'base\n')
        const MARK = 'RACE' + via.replace(/\W/g, '') + Math.random().toString(36).slice(2, 8).toUpperCase()
        let { app, win } = await L(Uc)
        await ui.openViaDialog(app, win, F); await waitFor(async () => (await ui.activeTitle(win)) === 'dirty.md', { what: 'open' }); await sleep(400)
        await ui.typeAtEnd(win, MARK)
        // no wait: close immediately after the last keystroke
        let res
        if (via === 'x') res = await ui.closeViaX(app)
        else {
            const proc = app.process(); const exited = new Promise(r => proc.once('exit', r)); const t0 = Date.now()
            await win.getByText('File', { exact: true }).first().click()
            await win.getByText(via === 'menu-exit' ? 'Exit' : 'Close Window', { exact: true }).click()
            await Promise.race([exited, sleep(10000)]); res = { exited: proc.exitCode !== null || proc.signalCode !== null, ms: Date.now() - t0 }
        }
        await check('CLOSE-' + via, 'close', `type then close immediately (${via}) with a dirty file tab: window closes without a prompt, text survives relaunch`, async () => {
            assert(res.exited, 'app did not exit within 10s (dirty tab blocked closing, or a prompt)')
            assert(!logOf(Uc).includes('did not confirm session flush'), 'handshake timed out (fell back to 3s)')
            await app.close().catch(() => {})
            const r2 = await L(Uc); await sleep(1500)
            const tabs = await ui.tabsInfo(r2.win); const d = tabs.find(t => t.title === 'dirty.md'); assert(d, 'tab missing after relaunch'); assert(d.dirty, 'dirty mark lost')
            await r2.win.locator('[class*=tabsList] > div', { hasText: 'dirty.md' }).click(); await sleep(300)
            assert((await ui.editorText(r2.win)).includes(MARK), 'typed text lost: ' + JSON.stringify((await ui.editorText(r2.win)).slice(0, 80)))
            assert(readFileSync(F, 'utf8') === 'base\n', 'unsaved text leaked to disk')
            await r2.app.close().catch(() => {})
            return res.ms + 'ms'
        }, { smoke: via === 'x' })
        await app.close().catch(() => {})
    }
}

// ---------------------------------------------------------------- scenario: opening files right after launch
if (want('race')) {
    const Ur = tmp('nf-r-u-'), Wr = tmp('nf-r-w-'); cleanup.push(Ur, Wr)
    const f1 = join(Wr, 'first-doc.md'), f2 = join(Wr, 'second-doc.md'); writeFileSync(f1, 'FIRST-DOC-BODY\n'); writeFileSync(f2, 'SECOND-DOC-BODY\n')
    const { app, win } = await L(Ur, { settle: 0 })
    await check('RACE-1', 'session', 'two files opened in quick succession right after launch get distinct tabs; the editor shows the active file and typing never lands in another file', async () => {
        await ui.openViaDialog(app, win, f1); await sleep(1500)
        await ui.openViaDialog(app, win, f2); await sleep(1500)
        const tabs = await ui.tabsInfo(win)
        eq(tabs.filter(t => t.active).length, 1, 'tabs flagged active: ' + JSON.stringify(tabs.map(t => t.title + (t.active ? '*' : ''))))
        const t = await ui.editorText(win)
        assert(t.includes('SECOND-DOC-BODY') && !t.includes('FIRST-DOC-BODY'), 'editor shows the wrong document: ' + JSON.stringify(t.slice(0, 40)))
    })
    await app.close().catch(() => {})
}

// ---------------------------------------------------------------- scenario: race with a NON-EMPTY saved session
if (want('race2')) {
    const { cpSync } = await import('node:fs')
    const Ub = tmp('nf-r2-base-'), Wr = tmp('nf-r2-w-'); cleanup.push(Ub, Wr)
    const F = join(Wr, 'early.md'); writeFileSync(F, 'EARLY-FILE-BODY\n')
    { // build a profile that already has saved tabs
        const { app, win } = await L(Ub)
        await ui.typeAtEnd(win, 'SAVED-ONE')
        for (const n of ['TWO', 'THREE']) { await win.keyboard.press('Control+n'); await sleep(300); await ui.typeAtEnd(win, 'SAVED-' + n) }
        await sleep(1500); await ui.closeViaX(app); await app.close().catch(() => {})
    }
    const outcomes = []
    for (let i = 0; i < 3; i++) {
        const Ua = tmp('nf-r2-a-'); cleanup.push(Ua); cpSync(Ub, Ua, { recursive: true })
        const { app, win } = await L(Ua, { settle: 0 })
        await ui.openViaDialog(app, win, F)
        await sleep(5000)
        const tabs = await ui.tabsInfo(win); const text = await ui.editorText(win)
        outcomes.push({ titles: tabs.map(t => t.title), active: tabs.filter(t => t.active).map(t => t.title), early: tabs.some(t => t.title === 'early.md'), editorHasEarly: text.includes('EARLY-FILE-BODY'), restored: tabs.length })
        if (i === 0) await win.screenshot({ path: join(shots, `${target}-race-nonempty-profile.png`) }).catch(() => {})
        await app.close().catch(() => {})
    }
    await check('RACE-2', 'session', 'profile with saved tabs: a file opened right after launch (before the session load finishes) survives, tabs are restored, exactly one tab is active and the editor shows the file', async () => {
        const bad = outcomes.filter(o => !(o.early && o.restored >= 4 && o.active.length === 1 && o.editorHasEarly))
        const summary = outcomes.map((o, i) => `#${i + 1}: tabs=[${o.titles.join(' | ')}] active=[${o.active.join(',')}] earlyTabKept=${o.early} editorShowsEarlyFile=${o.editorHasEarly}`).join(' ;; ')
        assert(bad.length === 0, `${bad.length}/3 attempts wrong. ` + summary)
        return summary
    })
    // Typing straight through the moment the session load completes, with an early tab whose id collides with a saved one.
    // 'slow' = deterministic: from the test side, the main-process safe-storage decrypt handler is wrapped to take 0.6 s per call and the page is reloaded,
    // so the session load (which must decrypt the stored key first) finishes in the middle of the typing on every platform.
    // No application hook is used: only ipcMain.removeHandler/handle through Playwright's app.evaluate.
    const reps = Number((argv.find(a => a.startsWith('--race3=')) || '--race3=1').slice(8)) || 1
    for (const slow of [false, true]) for (let rep = 1; rep <= reps; rep++) {
        const Ua = tmp('nf-r3-a-'); cleanup.push(Ua); cpSync(Ub, Ua, { recursive: true })
        const { app, win } = await L(Ua, { settle: 0 })
        if (slow) {
            await app.evaluate(({ ipcMain, safeStorage }) => {
                ipcMain.removeHandler('safe-storage-decrypt')
                ipcMain.handle('safe-storage-decrypt', async (e, b64) => { await new Promise(r => setTimeout(r, 600)); return safeStorage.decryptString(Buffer.from(b64, 'base64')) })
            })
            await win.reload({ waitUntil: 'domcontentloaded' })
        }
        const tRef = Date.now(); let loadDoneMs = null
        const watcher = (async () => { while (loadDoneMs === null && Date.now() - tRef < 20000) { try { if ((await ui.tabsInfo(win)).length >= 4) loadDoneMs = Date.now() - tRef } catch { /* page busy */ } await sleep(50) } })()
        await ui.openViaDialog(app, win, F)
        const typed = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ'
        let typeErr = null
        const typeStart = Date.now() - tRef; let typeEnd = null
        try { await win.locator('.cm-content').click({ timeout: 8000 }); await win.keyboard.press('Control+End'); await win.keyboard.type(typed, { delay: 60 }); typeEnd = Date.now() - tRef } catch (e) { typeErr = String(e.message).split('\n')[0] }
        await sleep(3000); await watcher
        const tabs = await ui.tabsInfo(win); const seen = {}
        for (let i = 0; i < tabs.length; i++) { await win.locator('[class*=tabsList] > div').nth(i).click(); await sleep(300); seen[tabs[i].title] = (await ui.editorText(win)).replace(/\n+$/, '') }
        const rec = { titles: tabs.map(t => t.title), seen, typeErr, timing: { typeStartMs: typeStart, typeEndMs: typeEnd, loadDoneMs } }
        // relaunch the same profile: every tab exactly once, restored tabs intact, early tab intact (no orphan rows, no stray text)
        await ui.closeViaX(app); await app.close().catch(() => {})
        const rl = await L(Ua); const after = {}; const nAfter = (await ui.tabsInfo(rl.win)).length
        for (let i = 0; i < nAfter; i++) { await rl.win.locator('[class*=tabsList] > div').nth(i).click(); await sleep(300); const t = (await ui.tabsInfo(rl.win))[i].title; after[t] = [...(after[t] || []), (await ui.editorText(rl.win)).replace(/\n+$/, '')] }
        await rl.app.close().catch(() => {})
        rec.relaunch = after
        await check((slow ? 'RACE-3s' : 'RACE-3') + (reps > 1 ? '.' + rep : ''), 'session', (slow ? '[load slowed from the test side] ' : '') + 'typing into an early tab straight through the end of the session load: every key lands in that tab, in order; no restored tab gets stray characters', async () => {
            assert(!typeErr, 'could not type: ' + typeErr)
            if (slow) assert(loadDoneMs !== null && loadDoneMs > typeStart && loadDoneMs < typeEnd, 'precondition not met: the session load did not finish in the middle of the typing ' + JSON.stringify(rec.timing))
            const early = Object.entries(seen).find(([t]) => t === 'early.md')?.[1]
            assert(early !== undefined, 'early tab missing: ' + JSON.stringify(rec))
            assert(early.includes(typed), `early tab text ${JSON.stringify(early)} lacks the typed run ${typed}`)
            for (const n of ['SAVED-ONE', 'SAVED-TWO', 'SAVED-THREE']) assert(seen[n] === n, `restored tab ${n} changed: ${JSON.stringify(seen[n])}; all tabs: ${JSON.stringify(rec)}`)
            const dup = Object.entries(rec.relaunch).filter(([, v]) => v.length !== 1).map(([k]) => k)
            assert(dup.length === 0, 'after relaunch these tabs are missing or duplicated: ' + dup.join(', ') + ' ' + JSON.stringify(rec.relaunch))
            for (const n of ['SAVED-ONE', 'SAVED-TWO', 'SAVED-THREE']) assert(rec.relaunch[n]?.[0] === n, `restored tab ${n} after relaunch: ${JSON.stringify(rec.relaunch[n])}`)
            assert(rec.relaunch['early.md']?.[0]?.startsWith('EARLY-FILE-BODY') && rec.relaunch['early.md'][0].includes(typed), 'early tab after relaunch: ' + JSON.stringify(rec.relaunch['early.md']))
            eq(Object.keys(rec.relaunch).length, 4, 'tab count after relaunch: ' + Object.keys(rec.relaunch).join(','))
            return JSON.stringify(rec)
        })
        await app.close().catch(() => {})
    }
}

// ---------------------------------------------------------------- scenarios: several windows, hand-over, File > Exit (3dfc5e8, afd0354)
const scenarioCtx = () => ({ smoke: flag('smoke'), L, check, na, ui, sleep, waitFor, assert, eq, logOf, tmp, cleanup, join, existsSync, readdirSync, readFileSync, isWin: false })
if (want('failover') || want('multiwin')) await multiWindow(scenarioCtx())
if (want('failover') || want('orphan')) await orphanRows(scenarioCtx())
if (want('override')) await overrideScenarios(scenarioCtx())

// ---------------------------------------------------------------- scenario: second window
if (want('newwin')) {
    const Un = tmp('nf-n-u-'); cleanup.push(Un)
    const { app, win } = await L(Un)
    await check('TAB-2', 'tabs', 'CHANGELOG (corrected): tabs keep a fixed width (3 tabs ~160px each), "+" is pinned at the far right of the tab bar', async () => {
        await win.keyboard.press('Control+n'); await win.keyboard.press('Control+n'); await sleep(400)
        const r = await win.evaluate(() => { const l = document.querySelector('[class*=tabsList]'); const ts = [...l.children].map(t => Math.round(t.getBoundingClientRect().width)); const b = document.querySelector('[title^="New Tab"]').getBoundingClientRect(); const c = document.querySelector('[class*=tabsContainer]').getBoundingClientRect(); return { ts, bRight: b.right, cRight: c.right, lastRight: l.lastElementChild.getBoundingClientRect().right, bLeft: b.left } })
        assert(r.ts.length === 3 && r.ts.every(w => w >= 150 && w <= 170), 'tab widths ' + r.ts)
        assert(r.cRight - r.bRight < 20, `"+" not at the far right: right edge ${r.bRight} vs bar ${r.cRight}`); assert(r.bLeft > r.lastRight, '"+" overlaps the last tab')
    })
    await ui.typeAtEnd(win, 'FIRST-WINDOW-TEXT')
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark' })
    await check('WIN-3', 'window', 'dark theme: a new window gets the dark backgroundColor (#1E1E1E) and the preload bridge', async () => {
        const wp = app.waitForEvent('window', { timeout: 15000 })
        await win.getByText('File', { exact: true }).first().click(); await win.getByText('New Window', { exact: true }).click()
        const w2 = await wp; await w2.waitForLoadState('domcontentloaded')
        assert(await w2.evaluate(() => !!window.electronAPI), 'second window has no bridge')
        const own = (await ui.mainWindows(app)).filter(w => /app\.asar\/dist\/index\.html/.test(w.url)); assert(own.length === 2, 'New Window did not open a second app window: ' + JSON.stringify(own.map(w => w.url)))
        const bgs = await ui.mainWindows(app); assert(bgs.filter(w => /index\.html/.test(w.url)).some(w => w.bg.toUpperCase() === '#1E1E1E'), 'bg: ' + JSON.stringify(bgs.map(w => w.bg)))
        await w2.screenshot({ path: join(shots, `${target}-dark-second-window.png`) }).catch(() => {})
    })
    await check('WIN-4', 'window', 'second window with unsaved text: X asks Keep editing/Discard; Keep keeps it, Discard closes only that window; first window untouched', async () => {
        const w2 = app.windows().filter(w => /index\.html/.test(w.url())).find(w => w !== win); assert(w2, 'second window missing')
        await w2.locator('.cm-content').click(); await w2.keyboard.type('SECOND-WINDOW-TEXT'); await sleep(500)
        await app.evaluate(({ dialog }) => { globalThis.__box = []; globalThis.__choice = 1; dialog.showMessageBoxSync = (...a) => { globalThis.__box.push(1); return globalThis.__choice } })
        const close2 = () => app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows().filter(w => /index\.html/.test(w.webContents.getURL())).sort((a, b) => a.id - b.id); ws[ws.length - 1].close() })
        await close2(); await sleep(2500)
        eq(await app.evaluate(() => globalThis.__box.length), 1, 'prompt count after first close'); eq((await ui.mainWindows(app)).filter(w => /index\.html/.test(w.url)).length, 2, 'window closed despite Keep editing')
        await app.evaluate(() => { globalThis.__choice = 0 }); await close2(); await sleep(2500)
        eq((await ui.mainWindows(app)).filter(w => /index\.html/.test(w.url)).length, 1, 'Discard did not close the window')
        assert((await ui.editorText(win)).includes('FIRST-WINDOW-TEXT'), 'first window text changed')
        return 'prompt (dialog.showMessageBoxSync) stubbed: the real dialog is native and was not clicked'
    })
    await check('WIN-6', 'window', 'legitimate paths through the app-page rule: reload (page.reload(); F5 is Insert-date-time in this app) and navigation to the own page with a query are not blocked; bridge survives', async () => {
        await win.evaluate(() => { window.__marker = 1 }); await win.reload({ waitUntil: 'domcontentloaded' })
        assert(await win.evaluate(() => window.__marker === undefined && !!window.electronAPI), 'reload() did not reload / lost bridge')
        win.evaluate(() => { location.href = location.href.split('#')[0].split('?')[0] + '?q=1' }).catch(() => {})
        await waitFor(async () => { try { return /\?q=1/.test(win.url()) && (await win.evaluate(() => !!window.electronAPI)) } catch { return false } }, { what: 'own-page navigation with query' })
        assert(!/Blocked (window\.open|open-external|unsafe)/.test(logOf(Un)), 'a block was logged: ' + (logOf(Un).match(/.*Blocked (window\.open|open-external|unsafe).*/) || [])[0])
    })
    await app.close().catch(() => {})
}

// ---------------------------------------------------------------- scenario: single instance (A4)
if (want('single')) {
    const Ui = tmp('nf-i-u-'), Xi = tmp('nf-i-x-'); cleanup.push(Ui, Xi)
    const { app, win } = await L(Ui, { env: { XDG_CONFIG_HOME: Xi } })
    await check('SINGLE-1', 'launch', 'launching a second instance focuses the existing window: second process exits, no second window, no second start block (A4)', async () => {
        const { spawn } = await import('node:child_process')
        const args = noSandbox ? ['--no-sandbox'] : []
        const p = spawn(binary, args, { env: { ...process.env, ...env, XDG_CONFIG_HOME: Xi, NOTEPAD_FLUX_USER_DATA: Ui }, stdio: 'ignore' })
        const code = await new Promise(r => { p.once('exit', r); setTimeout(() => { p.kill('SIGKILL'); r('timeout') }, 15000) })
        assert(code !== 'timeout', 'second instance stayed running (no single-instance lock)')
        eq((await ui.mainWindows(app)).filter(w => /index\.html/.test(w.url)).length, 1, 'window count')
        eq((logOf(Ui).match(/start \{/g) || []).length, 1, 'start blocks in log')
        return 'second instance exit code ' + code
    })
    await app.close().catch(() => {})
}

// ---------------------------------------------------------------- scenario: command-line files
if (want('argv')) {
// open files passed on the command line (OS default-app / "Open with"); own profile so it can't share the main run's instance lock
await check('ARGV-1', 'launch', 'launching with a .md path arg opens it in a tab (name + content); a second launch with another path while running opens in the SAME window, no 2nd window', async () => {
    const UA = tmp('nf-ua-'), WA = tmp('nf-wa-'); cleanup.push(UA, WA)
    const f1 = join(WA, 'argv one.md'); writeFileSync(f1, 'ARGV ONE BODY\n')
    const f2 = join(WA, 'argv-two.txt'); writeFileSync(f2, 'ARGV TWO BODY\n')
    const { app: a1, win: w1, xdg } = await launch({ binary, userData: UA, extraArgs: [...(noSandbox ? ['--no-sandbox'] : []), f1], env })
    try {
        await sleep(2500)
        await waitFor(async () => (await ui.tabsInfo(w1)).some(t => t.title === 'argv one.md'), { what: 'tab for argv file' })
        await waitFor(async () => (await ui.activeTitle(w1)) === 'argv one.md', { what: 'argv tab active' })
        assert((await ui.editorText(w1)).includes('ARGV ONE BODY'), 'argv file content not shown')
        // second instance: the single-instance lock forwards argv and the process exits
        const child = spawn(binary, [...(noSandbox ? ['--no-sandbox'] : []), f2], { env: { ...process.env, ...env, XDG_CONFIG_HOME: xdg, NOTEPAD_FLUX_USER_DATA: UA, DISPLAY: process.env.DISPLAY }, stdio: 'ignore' })
        await new Promise(r => { child.on('exit', r); setTimeout(r, 15000) }); child.kill()
        await waitFor(async () => (await ui.tabsInfo(w1)).some(t => t.title === 'argv-two.txt'), { what: 'second-instance file opened in running window' })
        eq((await ui.mainWindows(a1)).length, 1, 'main window count after second launch')
        await waitFor(async () => (await ui.activeTitle(w1)) === 'argv-two.txt', { what: 'new tab focused' })
        assert((await ui.editorText(w1)).includes('ARGV TWO BODY'), 'second file content missing')
    } finally { await a1.close().catch(() => {}) }
})
}

// ---------------------------------------------------------------- done
for (const d of cleanup) try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
writeResults(join(here, '../../Docs/internal/e2e/results-linux.json'), target, { binary, sandbox: sandboxNote, at: new Date().toISOString(), smoke: flag('smoke') }, { merge: only.length > 0 })
console.log('\n' + JSON.stringify(tally()), 'pageErrors:', pageErrors.length, pageErrors.slice(0, 3))
process.exit(results.some(r => r.result === 'fail') ? 1 : 0)
